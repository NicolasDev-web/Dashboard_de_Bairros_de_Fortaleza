// Testes de navegador do dashboard: abre dashboard/index.html e morar.html direto do disco
// (file://, como no uso local) e confere o que costuma quebrar quando os dados ou o JS mudam.
// O Leaflet vem de node_modules em vez da CDN, para rodar sem internet e no CI.
//
//   cd tests && npm ci && npm test
//   SAIDA=pasta npm test     # também grava capturas de tela das telas testadas
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync, readFileSync } from "node:fs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const BASE = "file://" + resolve(AQUI, "../dashboard") + "/";
const LEAFLET = resolve(AQUI, "node_modules/leaflet/dist");
const SAIDA = process.env.SAIDA ? resolve(process.env.SAIDA) : null;
if (SAIDA) mkdirSync(SAIDA, { recursive: true });

let falhas = 0;
const ok = (cond, msg) => { if (!cond) falhas++; console.log(`${cond ? "OK   " : "FALHA"} ${msg}`); };
const foto = async (loc, nome) => { if (SAIDA) await loc.screenshot({ path: `${SAIDA}/${nome}.png` }); };

// o Leaflet servido localmente, com um gancho que guarda o mapa do painel em window.__mapa
const leafletJs = readFileSync(`${LEAFLET}/leaflet.js`, "utf8")
  + "\n;L.Map.addInitHook(function () { if (this._container && this._container.id === 'mapa-leaflet') window.__mapa = this; });";

async function pagina(navegador, url, largura = 1500) {
  const p = await navegador.newPage({ viewport: { width: largura, height: 1000 } });
  p.erros = [];
  p.on("pageerror", (e) => p.erros.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_|net::|Failed to load resource/.test(m.text())) p.erros.push(m.text()); });
  // a última rota registrada tem prioridade: primeiro bloqueia tudo de fora (tiles etc.), depois serve o Leaflet
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.route("**/leaflet.min.js", (r) => r.fulfill({ body: leafletJs, contentType: "application/javascript" }));
  await p.route("**/leaflet.min.css", (r) => r.fulfill({ path: `${LEAFLET}/leaflet.css`, contentType: "text/css" }));
  await p.goto(BASE + url, { waitUntil: "load" });
  await p.waitForTimeout(1200);
  return p;
}

// "Quanto tempo de ônibus": escolhe saída e destino pelo value ("b12", "p_centro") ou pelo começo do nome
async function escolher(p, sel, alvo) {
  const v = await p.evaluate(([s, t]) => [...document.querySelector(s).options]
    .find((o) => o.value === t || o.textContent.trim().toUpperCase().startsWith(t.toUpperCase()))?.value, [sel, alvo]);
  if (!v) throw new Error(`opção "${alvo}" não encontrada em ${sel}`);
  await p.selectOption(sel, v);
  await p.waitForTimeout(900);
}
async function rota(p, o, d) {
  await escolher(p, "#tj-origem", o);
  await escolher(p, "#tj-destino", d);
  return p.evaluate(() => {
    const box = document.getElementById("tj-resultado");
    const dir = box.querySelector(".tj-diretas");
    return {
      tempo: box.querySelector(".tj-tempo")?.textContent,
      opcoes: [...box.querySelectorAll(".tj-opcao")].map((b) => b.innerText.replace(/\s+/g, " ")),
      passos: [...box.querySelectorAll(".tj-passos li")].map((li) => li.innerText.replace(/\s+/g, " ")),
      vazio: [...box.querySelectorAll(".tj-vazio")].map((x) => x.textContent),
      tracos: document.querySelectorAll(".leaflet-rota-pane path").length,
      diretas: dir && {
        titulo: dir.querySelector(".tj-sec").textContent,
        texto: dir.innerText.replace(/\s+/g, " "),
        selos: [...dir.querySelectorAll("button.tj-badge")].map((b) => b.textContent),
      },
    };
  });
}

const navegador = await chromium.launch();
try {
  // ---------------- painel ----------------
  const p = await pagina(navegador, "index.html");
  ok(/dia útil/.test(await p.textContent("#metodo-dia")), "texto do método fala em dia útil");

  // ficha do bairro: linhas que passam e o botão que desenha os traçados
  await p.evaluate(() => document.querySelector("#mapa").scrollIntoView());
  await p.fill("#busca", "Bom Jardim");
  await p.waitForTimeout(300);
  await p.click("#ranking-lista button");
  await p.waitForTimeout(900);
  const selosFicha = await p.locator(".ficha-linhas .tj-badge").count();
  ok(selosFicha > 0, `ficha do Bom Jardim com ${selosFicha} linhas`);
  await p.click(".ficha-linhas .link-botao");
  await p.waitForTimeout(1200);
  ok(await p.locator(".leaflet-linhasBairro-pane path").count() > 0, "traçados das linhas do bairro no mapa");
  await p.click(".ficha-linhas .link-botao"); // tira de novo

  // camada "Linhas de ônibus": rede inteira em canvas; paradas só no zoom
  await p.click("#camadas-botao");
  await p.check("#ctl-linhas");
  await p.waitForTimeout(1500);
  await p.click("#camadas-botao");
  ok(await p.locator(".leaflet-redeLinhas-pane canvas").count() > 0, "camada de linhas desenhada (canvas no pane redeLinhas)");
  const leg1 = await p.textContent("#legenda");
  ok(/metrô e VLT/.test(leg1) && /aproxime para ver as paradas/.test(leg1), "legenda com as cores das linhas e a dica do zoom");
  await foto(p.locator("#mapa-leaflet"), "camada_linhas");
  await p.evaluate(() => { window.__mapa.setView([-3.7275, -38.5275], 15, { animate: false }); }); // Centro
  await p.waitForTimeout(2500);
  const leg2 = await p.textContent("#legenda");
  ok(/parada \(clique/.test(leg2), "no zoom 15 as paradas aparecem (legenda de parada)");
  // clica na parada mais perto do centro da tela e espera o popup com as linhas
  const alvo = await p.evaluate(() => {
    const m = window.__mapa, c = m.getCenter();
    let melhor = null, dm = Infinity;
    for (const [la, lo] of window.PARADAS || []) {
      const d = (la - c.lat) ** 2 + (lo - c.lng) ** 2;
      if (d < dm) { dm = d; melhor = [la, lo]; }
    }
    const pt = m.latLngToContainerPoint(melhor), r = m.getContainer().getBoundingClientRect();
    return { x: r.left + pt.x, y: r.top + pt.y };
  });
  await p.mouse.click(alvo.x, alvo.y);
  await p.waitForTimeout(600);
  const popup = await p.locator(".popup-parada").count();
  ok(popup > 0 && await p.locator(".popup-parada .tj-badge").count() > 0, "clique na parada abre o popup com as linhas");
  await foto(p.locator("#mapa-leaflet"), "camada_linhas_parada");
  await p.click("#camadas-botao");
  await p.uncheck("#ctl-linhas");
  await p.click("#camadas-botao");

  // ---------------- "Quanto tempo de ônibus" ----------------
  await p.evaluate(() => document.querySelector("#trajeto").scrollIntoView());
  let r = await rota(p, "Bom Jardim", "p_centro");
  ok(r.opcoes.length >= 1 && r.opcoes.length <= 3, `Bom Jardim → Centro: ${r.opcoes.length} opções (${r.tempo})`);
  ok(r.tracos > 0, "rota desenhada no mapa do trajeto");
  ok(!r.passos.some((s) => /Caminhe 0 min/i.test(s)), "sem passo \"caminhe 0 min\"");
  ok(r.diretas && r.diretas.selos.length > 0, `linhas diretas Bom Jardim → Centro: ${r.diretas && r.diretas.selos.length}`);
  await foto(p.locator(".tj-grade"), "rota_bomjardim_centro");

  r = await rota(p, "Canindezinho", "p_centro");
  ok(r.opcoes.length > 0, `Canindezinho → Centro tem rota (${r.tempo})`);

  r = await rota(p, "Benfica", "Fátima");
  ok(r.tempo && (r.opcoes.length > 0 || r.vazio.some((v) => /Entre bairros aparece só o tempo/.test(v))), `bairro → bairro: ${r.tempo}`);

  // linhas diretas no sentido certo: um par em que alguma linha só vai de A para B
  const par = await p.evaluate(() => {
    const LN = window.Linhas, B = LN.D.bairros;
    for (const [a, va] of Object.entries(B)) for (const [b, vb] of Object.entries(B)) {
      if (a === b) continue;
      const s = new Set(vb.linhas);
      const i = va.linhas.find((k) => s.has(k) && LN.vaiDe(k, +a, `b${b}`) === true && LN.vaiDe(k, +b, `b${a}`) === false);
      if (i != null) return { a: `b${a}`, b: `b${b}`, linha: LN.info(i).curto };
    }
    return null;
  });
  ok(par, `há linha que vai só num sentido: ${par && `${par.linha} (${par.a} → ${par.b})`}`);
  if (par) {
    const ida = await rota(p, par.a, par.b), volta = await rota(p, par.b, par.a);
    ok(ida.diretas.selos.includes(par.linha), `na ida a linha ${par.linha} aparece entre as diretas`);
    ok(!volta.diretas.selos.includes(par.linha) && /sentido contrário/.test(volta.diretas.texto),
      `na volta a linha ${par.linha} sai das diretas e a nota do sentido contrário aparece`);
  }
  const metro = await p.evaluate(() => {
    const LN = window.Linhas, i = LN.D.linhas.findIndex((l) => /Sul/.test(l[1]) && l[3] === "metrofor");
    const id = (n) => +[...document.querySelector("#tj-origem").options].find((o) => o.textContent.trim().toUpperCase() === n).value.slice(1);
    return [LN.vaiDe(i, id("PARANGABA"), "p_centro"), LN.vaiDe(i, id("CENTRO"), "p_parangaba")];
  });
  ok(metro[0] && metro[1], "Linha Sul do metrô vale nos dois sentidos (Parangaba ↔ Centro)");
  ok(p.erros.length === 0, "painel sem erros de JS" + (p.erros.length ? ": " + JSON.stringify(p.erros) : ""));
  await p.close();

  // ---------------- "Onde morar" ----------------
  const m = await pagina(navegador, "morar.html#r=6000&e=50000&q=2&n=2222222&m=1&d=p_centro&dn=2");
  await m.waitForTimeout(1500);
  const cards = await m.$$eval(".card-trajeto", (ns) => ns.map((n) => n.querySelector("a")?.getAttribute("href")));
  ok(cards.length > 0, `Onde morar: ${cards.length} cards com tempo de ônibus`);
  ok(m.erros.length === 0, "Onde morar sem erros de JS" + (m.erros.length ? ": " + JSON.stringify(m.erros) : ""));
  await m.close();

  // ---------------- celular ----------------
  const c = await pagina(navegador, "index.html", 390);
  ok(c.erros.length === 0, "painel no celular (390 px) sem erros de JS");
  ok(await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "sem rolagem horizontal no celular");
  await c.close();
} finally {
  await navegador.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo.");
process.exitCode = falhas ? 1 : 0;
