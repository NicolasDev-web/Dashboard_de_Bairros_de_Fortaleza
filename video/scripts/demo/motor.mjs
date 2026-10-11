// Motor da gravação da demo: abre o dashboard real no Chromium e grava quadro a quadro a 60 fps.
//
// O tempo da página é controlado: o relógio do Playwright (Date, setTimeout, requestAnimationFrame)
// e as animações e transições CSS só andam 1/60 s a cada quadro. Assim a captura não depende da
// velocidade da máquina: nada engasga, nada pula, e o resultado é sempre o mesmo.
//
// Tudo o que aparece é a aplicação de verdade (dashboard/), com cliques, rolagem e arrastes reais.
// O único elemento acrescentado é o cursor, desenhado por cima (o Chromium sem janela não tem um).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const VIDEO = path.resolve(AQUI, "../..");
export const DASH = pathToFileURL(path.resolve(VIDEO, "../dashboard")).href + "/";
export const FPS = 60;

const FONTES_CSS = `
@font-face { font-family: "Geist"; src: url("https://fonts.gstatic.com/local/Geist-Variable.woff2") format("woff2"); font-weight: 100 900; font-display: block; }
@font-face { font-family: "Geist Mono"; src: url("https://fonts.gstatic.com/local/GeistMono-Variable.woff2") format("woff2"); font-weight: 100 900; font-display: block; }`;

// cursor: seta escura com borda branca, discreta; encolhe um pouco no clique
const CURSOR = () => {
  const montar = () => {
    if (document.getElementById("__cursor")) return;
    const c = document.createElement("div");
    c.id = "__cursor";
    c.innerHTML = `<svg width="22" height="26" viewBox="0 0 22 26" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 1.5 L2 20.5 L6.9 16.1 L10.1 23.4 L13.6 21.9 L10.5 14.8 L17 14.6 Z" fill="#15184f" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    Object.assign(c.style, {
      position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none",
      transform: "translate(-200px,-200px)", transformOrigin: "2px 2px", filter: "drop-shadow(0 2px 3px rgba(10,12,44,.28))",
      transition: "none", opacity: "1",
    });
    document.documentElement.appendChild(c);
  };
  window.__cursor = (x, y, escala = 1, opacidade = 1) => {
    montar();
    const c = document.getElementById("__cursor");
    c.style.transform = `translate(${x - 2}px,${y - 2}px) scale(${escala})`;
    c.style.opacity = String(opacidade);
  };
  // anda as animações da página (CSS e Web Animations) em passos fixos, junto com o relógio
  window.__avanca = (dt) => {
    for (const a of document.getAnimations()) {
      if (a.effect && a.effect.target && a.effect.target.id === "__cursor") continue;
      if (!a.__f) { a.__f = 1; a.pause(); }
      const t = (a.currentTime ?? 0) + dt;
      const fim = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
      if (t >= fim) a.finish(); else a.currentTime = t;
    }
  };
};

// curvas
export const suave = (t) => t * t * t * (t * (t * 6 - 15) + 10); // smootherstep (jerk mínimo)
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

export class Gravador {
  constructor({ saida, dpr = 2, largura = 1920, altura = 1080, qualidade = 92 }) {
    this.saida = saida; this.dpr = dpr; this.largura = largura; this.altura = altura; this.qualidade = qualidade;
    this.k = 0; this.tms = 0; this.gravando = false; this.pasta = null; this.n = 0;
    this.mouse = { x: largura * 0.62, y: altura * 0.7 }; this.cursorVisivel = 1; this.escala = 1;
    this.marcas = {};
  }

  async abrir() {
    this.nav = await chromium.launch();
    this.ctx = await this.nav.newContext({ viewport: { width: this.largura, height: this.altura }, deviceScaleFactor: this.dpr });
    const cors = { "Access-Control-Allow-Origin": "*" };
    await this.ctx.route("**/fonts.googleapis.com/**", (r) => r.fulfill({ body: FONTES_CSS, contentType: "text/css", headers: cors }));
    await this.ctx.route("**/fonts.gstatic.com/local/*", (r) =>
      r.fulfill({ path: path.join(VIDEO, "public/fontes", path.basename(new URL(r.request().url()).pathname)), contentType: "font/woff2", headers: cors }));
    await this.ctx.route("**/leaflet.min.js", (r) => r.fulfill({ path: path.join(VIDEO, "node_modules/leaflet/dist/leaflet.js"), contentType: "application/javascript" }));
    await this.ctx.route("**/leaflet.min.css", (r) => r.fulfill({ path: path.join(VIDEO, "node_modules/leaflet/dist/leaflet.css"), contentType: "text/css" }));
    this.p = await this.ctx.newPage();
    this.p.on("pageerror", (e) => console.log("  erro na página:", e.message));
    await this.p.clock.install({ time: new Date("2026-10-08T09:00:00-03:00") });
    await this.p.addInitScript(CURSOR);
    this.cdp = await this.ctx.newCDPSession(this.p);
  }

  async ir(arquivo, { aquecer = 0 } = {}) {
    await this.p.goto(DASH + arquivo, { waitUntil: "load" });
    await this.p.evaluate(() => document.fonts.ready);
    await this.p.mouse.move(this.mouse.x, this.mouse.y);
    await this.cursor();
    if (aquecer) await this.esperar(aquecer);
  }

  // começa um plano novo: os quadros vão para <saida>/<nome>/
  cena(nome) {
    this.pasta = path.join(this.saida, nome);
    fs.rmSync(this.pasta, { recursive: true, force: true });
    fs.mkdirSync(this.pasta, { recursive: true });
    this.gravando = true; this.n = 0; this.nomeCena = nome; this.marcas[nome] = {};
    console.log("cena", nome);
  }
  // quadro de cada clique, para a edição pôr o som no ponto exato
  anotarClique() { if (this.gravando) (this.marcas[this.nomeCena].cliques ??= []).push(this.n); }
  marcar(rotulo) { if (this.gravando) this.marcas[this.nomeCena][rotulo] = this.n; }
  async parar() {
    if (this.gravando) {
      fs.writeFileSync(path.join(this.pasta, "marcas.json"), JSON.stringify({ quadros: this.n, ...this.marcas[this.nomeCena] }, null, 1));
      console.log(`  ${this.n} quadros (${(this.n / FPS).toFixed(2)} s)`, JSON.stringify(this.marcas[this.nomeCena]));
    }
    this.gravando = false;
  }

  async cursor() {
    await this.p.evaluate(([x, y, e, o]) => window.__cursor(x, y, e, o), [this.mouse.x, this.mouse.y, this.escala, this.cursorVisivel]);
  }

  // um quadro: anda o relógio e as animações 1/60 s e fotografa
  async quadro() {
    const alvo = Math.round((this.k + 1) * 1000 / FPS);
    const dt = alvo - this.tms; this.tms = alvo; this.k++;
    await this.p.clock.runFor(dt);
    await this.p.evaluate((d) => window.__avanca(d), dt);
    await this.cursor();
    if (!this.gravando) return;
    const r = await this.cdp.send("Page.captureScreenshot", { format: "jpeg", quality: this.qualidade, optimizeForSpeed: true });
    this.n++;
    fs.writeFileSync(path.join(this.pasta, `${String(this.n).padStart(5, "0")}.jpg`), Buffer.from(r.data, "base64"));
  }

  quadros(ms) { return Math.max(1, Math.round(ms * FPS / 1000)); }

  async esperar(ms) { for (let i = 0, n = this.quadros(ms); i < n; i++) await this.quadro(); }

  // espera fora da gravação (carregar camadas, etc.) sem gastar quadros do filme
  async semGravar(fn) { const g = this.gravando; this.gravando = false; try { return await fn(); } finally { this.gravando = g; } }

  // ---------- cursor ----------
  // trajeto em curva (Bézier com um leve arco), velocidade com jerk mínimo, duração pela distância
  async mover(x, y, { dur, arco = 0.12, chegada = 0 } = {}) {
    const x0 = this.mouse.x, y0 = this.mouse.y;
    const dx = x - x0, dy = y - y0, dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    dur = dur ?? Math.min(1250, 380 + dist * 0.55);
    // ponto de controle deslocado para o lado: mão humana não anda em linha reta
    const nx = -dy / dist, ny = dx / dist, lado = (Math.round(x0 + y) % 2 ? 1 : -1);
    const cx1 = x0 + dx * 0.3 + nx * dist * arco * lado, cy1 = y0 + dy * 0.3 + ny * dist * arco * lado;
    const cx2 = x0 + dx * 0.75 + nx * dist * arco * 0.4 * lado, cy2 = y0 + dy * 0.75 + ny * dist * arco * 0.4 * lado;
    const n = this.quadros(dur);
    for (let i = 1; i <= n; i++) {
      const t = suave(i / n), u = 1 - t;
      const px = u * u * u * x0 + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * x;
      const py = u * u * u * y0 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y;
      this.mouse = { x: px, y: py };
      await this.p.mouse.move(px, py);
      await this.quadro();
    }
    if (chegada) await this.esperar(chegada);
  }

  async centro(sel) {
    const b = await this.p.locator(sel).first().boundingBox();
    if (!b) throw new Error("sem caixa: " + sel);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
  }

  // vai até o alvo, desacelera, para um instante e clica; depois a mão sai devagar
  async clicar(alvo, { pausa = 220, depois = 0, sair = null, dx = 0, dy = 0, dur } = {}) {
    const c = typeof alvo === "string" ? await this.centro(alvo) : alvo;
    await this.mover(c.x + dx, c.y + dy, { dur });
    await this.esperar(pausa);
    this.escala = 0.88;
    this.anotarClique();
    await this.p.mouse.down();
    await this.esperar(80);
    await this.p.mouse.up();
    this.escala = 1;
    await this.esperar(50);
    if (sair) await this.mover(this.mouse.x + sair[0], this.mouse.y + sair[1], { dur: 700, arco: 0.05 });
    if (depois) await this.esperar(depois);
  }

  // arrasta (sliders): pega, puxa com aceleração humana, solta
  async arrastar(de, ate, { dur = 1600, curva = suave, pausa = 200 } = {}) {
    await this.mover(de.x, de.y);
    await this.esperar(pausa);
    this.escala = 0.88;
    this.anotarClique();
    await this.p.mouse.down();
    await this.esperar(90);
    const n = this.quadros(dur);
    for (let i = 1; i <= n; i++) {
      const t = curva(i / n);
      this.mouse = { x: de.x + (ate.x - de.x) * t, y: de.y + (ate.y - de.y) * t };
      await this.p.mouse.move(this.mouse.x, this.mouse.y);
      await this.quadro();
    }
    await this.esperar(120);
    await this.p.mouse.up();
    this.escala = 1;
    await this.esperar(60);
  }

  // roda do mouse (zoom do Leaflet): notches com um intervalo humano entre eles
  async girar(notches, { passo = 100, intervalo = 220 } = {}) {
    for (let i = 0; i < Math.abs(notches); i++) {
      await this.p.mouse.wheel(0, Math.sign(notches) * passo);
      await this.esperar(intervalo);
    }
  }

  async mostrarCursor(v, dur = 300) {
    const de = this.cursorVisivel, n = this.quadros(dur);
    for (let i = 1; i <= n; i++) { this.cursorVisivel = de + (v - de) * suave(i / n); await this.quadro(); }
  }

  // ---------- rolagem ----------
  // rolagem de trackpad: acelera e desacelera suave, termina parada no ponto
  async rolar(ate, { dur, curva = suave } = {}) {
    if (typeof ate === "string") ate = await this.topo(ate);
    const de = await this.p.evaluate(() => window.scrollY);
    const max = await this.p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    ate = Math.max(0, Math.min(max, Math.round(ate)));
    const dist = Math.abs(ate - de);
    if (dist < 1) return;
    dur = dur ?? Math.min(2200, 700 + dist * 0.6);
    const n = this.quadros(dur);
    for (let i = 1; i <= n; i++) {
      const y = de + (ate - de) * curva(clamp01(i / n));
      await this.p.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y);
      // o mouse fica parado na tela; a página passa por baixo dele
      await this.p.mouse.move(this.mouse.x, this.mouse.y);
      await this.quadro();
    }
  }
  // o html do painel tem scroll-behavior: smooth, que o compositor anima em tempo real (fora do
  // relógio da gravação). Num link interno, o clique é de verdade, mas a rolagem até a âncora é
  // feita aqui, quadro a quadro, até o mesmo ponto (com o scroll-margin-top da seção).
  async clicarAncora(sel, opcoes = {}) {
    await this.p.evaluate((s) => document.querySelector(s).addEventListener("click", (e) => e.preventDefault(), { once: true }), sel);
    const href = await this.p.evaluate((s) => document.querySelector(s).getAttribute("href"), sel);
    await this.clicar(sel, opcoes);
    const folga = await this.p.evaluate((h) => parseFloat(getComputedStyle(document.querySelector(h)).scrollMarginTop) || 0, href);
    await this.rolar(await this.topo(href, folga), opcoes.rolagem || {});
  }
  async topo(sel, folga = 0) {
    return this.p.evaluate(([s, f]) => document.querySelector(s).getBoundingClientRect().top + window.scrollY - f, [sel, folga]);
  }
  async pularPara(y) { await this.p.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y); }

  async fechar() { await this.nav.close(); }
}
