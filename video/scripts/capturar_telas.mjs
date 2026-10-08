// Captura as telas do dashboard usadas no filme (public/telas/*.png) e mede as posições que as
// cenas precisam (public/dados/medidas.json). Rodar de video/:  node scripts/capturar_telas.mjs
//
// 1920x1080 em CSS px com DPR 2, então as coordenadas medidas valem direto no quadro do filme.
// A página roda de dashboard/ por file://; Leaflet e as fontes saem de node_modules e de
// public/fontes, sem depender do CDN nem do Google Fonts.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.resolve(AQUI, "..");
const DASH = pathToFileURL(path.resolve(VIDEO, "../dashboard")).href + "/";
const TELAS = path.join(VIDEO, "public/telas");
const SO = process.argv.slice(2); // nomes para capturar só alguns (ex.: 20_onibus)

const FONTES_CSS = `
@font-face { font-family: "Geist"; src: url("https://fonts.gstatic.com/local/Geist-Variable.woff2") format("woff2"); font-weight: 100 900; font-display: block; }
@font-face { font-family: "Geist Mono"; src: url("https://fonts.gstatic.com/local/GeistMono-Variable.woff2") format("woff2"); font-weight: 100 900; font-display: block; }`;

// o Leaflet local, guardando o mapa do painel em window.__mapa (para pôr a câmera num lugar exato)
const LEAFLET_JS = fs.readFileSync(path.join(VIDEO, "node_modules/leaflet/dist/leaflet.js"), "utf8")
  + "\n;L.Map.addInitHook(function () { if (this._container && this._container.id === 'mapa-leaflet') window.__mapa = this; });";

async function preparar(contexto) {
  const cors = { "Access-Control-Allow-Origin": "*" };
  await contexto.route("**/fonts.googleapis.com/**", (r) => r.fulfill({ body: FONTES_CSS, contentType: "text/css", headers: cors }));
  await contexto.route("**/fonts.gstatic.com/local/*", (r) =>
    r.fulfill({ path: path.join(VIDEO, "public/fontes", path.basename(new URL(r.request().url()).pathname)), contentType: "font/woff2", headers: cors }));
  await contexto.route("**/leaflet.min.js", (r) => r.fulfill({ body: LEAFLET_JS, contentType: "application/javascript" }));
  await contexto.route("**/leaflet.min.css", (r) => r.fulfill({ path: path.join(VIDEO, "node_modules/leaflet/dist/leaflet.css"), contentType: "text/css" }));
}

const medidas = fs.existsSync(path.join(VIDEO, "public/dados/medidas.json"))
  ? JSON.parse(fs.readFileSync(path.join(VIDEO, "public/dados/medidas.json"), "utf8")) : {};
const ret = (r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
const caixa = async (p, sel) => { const b = await p.locator(sel).first().boundingBox(); return b && ret(b); };
const espera = (p, ms) => p.waitForTimeout(ms);

async function abrir(contexto, arquivo) {
  const p = await contexto.newPage();
  p.on("pageerror", (e) => console.log("  erro na página:", e.message));
  await p.goto(DASH + arquivo, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await espera(p, 1200);
  return p;
}
async function irPara(p, sel) {
  await p.evaluate((s) => document.querySelector(s).scrollIntoView({ behavior: "instant", block: "start" }), sel);
  await espera(p, 900);
  return p.evaluate(() => window.scrollY);
}
async function foto(p, nome, opcoes = {}) {
  if (SO.length && !SO.includes(nome)) return;
  await p.screenshot({ path: path.join(TELAS, `${nome}.png`), ...opcoes });
  console.log("ok", nome);
}
// centro, na tela, do polígono do bairro no mapa (os paths do Leaflet seguem a ordem do geojson)
async function centroBairro(p, mapaSel, nome) {
  return p.evaluate(([m, n]) => {
    const k = window.DADOS.geojson.features.findIndex((f) => f.properties.nome.toUpperCase() === n);
    const r = document.querySelectorAll(`${m} .leaflet-overlay-pane path`)[k].getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, [mapaSel, nome]);
}
async function escolher(p, sel, texto) {
  const v = await p.evaluate(([s, t]) => [...document.querySelector(s).options].find((o) => o.textContent.trim().toUpperCase() === t)?.value, [sel, texto]);
  await p.selectOption(sel, v);
}

const navegador = await chromium.launch();
const desk = await navegador.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
await preparar(desk);

// ---------- abertura, página inteira até o mapa e o mapa ----------
{
  const p = await abrir(desk, "index.html");
  await espera(p, 1500);
  medidas.hero = {
    cidade: await caixa(p, "#cidade"),
    titulo: await caixa(p, "#hero-titulo"),
    titulo_px: await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#hero-titulo")).fontSize)),
    marca: await caixa(p, ".nav .marca"),
  };
  await foto(p, "01_hero");
  const rolagem = await irPara(p, "#mapa");
  medidas.mapa = { rolagem, mapa: await caixa(p, "#mapa-leaflet"), pesos: await caixa(p, "#pesos"), painel: await caixa(p, ".painel") };
  await foto(p, "03_mapa_indice");
  // página inteira (DPR 1) do topo até o fim da vista do mapa, para a rolagem do Mergulho
  await p.evaluate(() => window.scrollTo(0, 0));
  await espera(p, 600);
  if (!SO.length || SO.includes("16_pagina_inteira")) {
    const pg = await desk.browser().newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    await preparar(pg);
    const q = await abrir(pg, "index.html");
    await espera(q, 1500);
    await q.screenshot({ path: path.join(TELAS, "16_pagina_inteira.png"), fullPage: true, clip: { x: 0, y: 0, width: 1920, height: rolagem + 1080 } });
    console.log("ok 16_pagina_inteira");
    await pg.close();
  }
  // o Meireles: clique no polígono, a ficha abre (com o tempo de ônibus até três polos)
  medidas.mapa.meireles = await centroBairro(p, "#mapa-leaflet", "MEIRELES");
  await irPara(p, "#mapa");
  medidas.mapa.meireles = await centroBairro(p, "#mapa-leaflet", "MEIRELES");
  await p.mouse.click(medidas.mapa.meireles.x, medidas.mapa.meireles.y);
  await p.mouse.move(1900, 1060);
  await espera(p, 900);
  medidas.mapa.ficha = await caixa(p, "#ficha");
  medidas.mapa.ficha_onibus = await caixa(p, ".ficha-onibus");
  await foto(p, "04_mapa_meireles");
  await p.close();
}

// ---------- indicadores e anos (página limpa a cada um) ----------
for (const [nome, ind, ano] of [["07_saneamento", "saneamento", "2022"]]) {
  if (SO.length && !SO.includes(nome)) continue;
  const p = await abrir(desk, "index.html");
  await irPara(p, "#mapa");
  await p.click(`#ctl-indicador button[data-v="${ind}"]`);
  const botaoAno = p.locator(`#ctl-ano button[data-v="${ano}"]`);
  if (await botaoAno.isEnabled()) await botaoAno.click(); // segurança e evolução não têm ano
  await p.mouse.move(1900, 1060);
  await espera(p, 900);
  await foto(p, nome);
  await p.close();
}

// ---------- pesos: renda pesando mais ----------
{
  const p = await abrir(desk, "index.html");
  await irPara(p, "#mapa");
  await p.locator('#pesos input[data-eixo="renda"]').fill("9");
  await p.locator('#pesos input[data-eixo="seguranca"]').fill("2");
  await p.mouse.move(1900, 1060);
  await espera(p, 900);
  await foto(p, "10_pesos");
  // camadas: praças e hospitais ligados, cidade inteira e depois perto do Centro
  await p.locator('#pesos input[data-eixo="renda"]').fill("5");
  await p.locator('#pesos input[data-eixo="seguranca"]').fill("5");
  await p.click("#camadas-botao");
  await p.check("#ctl-pracas");
  await p.check("#ctl-hospitais");
  await espera(p, 900);
  medidas.camadas = { painel: await caixa(p, "#camadas-painel") };
  await foto(p, "19_camadas");
  // camada de linhas: a rede inteira, e depois o Centro no zoom das paradas, com o popup de uma parada
  await p.uncheck("#ctl-pracas");
  await p.uncheck("#ctl-hospitais");
  await p.check("#ctl-linhas");
  await espera(p, 1500);
  await p.click("#camadas-botao");
  await p.mouse.move(1900, 1060);
  await espera(p, 600);
  medidas.linhas = { mapa: await caixa(p, "#mapa-leaflet") };
  await foto(p, "31_linhas_cidade");
  // o mapa ocupando a tela, logo abaixo da navegação
  await p.evaluate(() => window.scrollBy(0, document.querySelector("#mapa-leaflet").getBoundingClientRect().top - 84));
  await espera(p, 700);
  // a parada com mais linhas a até 1,2 km da Praça do Ferreira (carrega as paradas no zoom 15)
  await p.evaluate(() => { window.__mapa.setView([-3.7276, -38.5265], 15, { animate: false }); });
  await p.waitForFunction(() => (window.PARADAS || []).length > 0, null, { timeout: 15000 });
  const alvo = await p.evaluate(() => {
    // mais linhas da ETUFOR, mas com o popup cabendo na tela (até 18 linhas)
    let melhor = null;
    for (const [la, lo, , idxs] of window.PARADAS) {
      if (idxs.length > 18 || Math.hypot(la + 3.7276, lo + 38.5265) * 111000 > 1500) continue;
      const etufor = idxs.filter((i) => window.LINHAS.linhas[i][3] === "etufor").length;
      const nota = etufor + 0.5 * (idxs.length - etufor);
      if (!melhor || nota > melhor[3]) melhor = [la, lo, idxs.length, nota];
    }
    return melhor;
  });
  // a parada um pouco abaixo do centro do mapa, para o popup caber em cima
  await p.evaluate(([la, lo]) => { window.__mapa.setView([la + 0.0016, lo + 0.0035], 15.5, { animate: false }); }, alvo);
  await espera(p, 2000);
  const parada = await p.evaluate(([la, lo]) => {
    const m = window.__mapa, r = m.getContainer().getBoundingClientRect(), pt = m.latLngToContainerPoint([la, lo]);
    return { x: Math.round(r.left + pt.x), y: Math.round(r.top + pt.y) };
  }, alvo);
  console.log("  parada com", alvo[2], "linhas em", parada);
  await foto(p, "31b_linhas_zoom");
  await p.mouse.click(parada.x, parada.y);
  await p.mouse.move(1900, 1060);
  await espera(p, 900);
  medidas.linhas.parada = parada;
  medidas.linhas.popup = await caixa(p, ".popup-parada");
  await foto(p, "31c_linhas_parada");
  await p.close();
}

// ---------- ônibus: Bom Jardim -> Centro, com a rota desenhada ----------
{
  const p = await abrir(desk, "index.html");
  medidas.onibus = { rolagem: await irPara(p, "#trajeto") };
  await escolher(p, "#tj-origem", "BOM JARDIM");
  await espera(p, 600);
  await escolher(p, "#tj-destino", "CENTRO (PRAÇA DO FERREIRA)");
  await p.mouse.move(1900, 1060);
  await espera(p, 4500);
  medidas.onibus.resultado = await caixa(p, "#tj-resultado");
  medidas.onibus.mapa = await caixa(p, "#mapa-trajeto");
  medidas.onibus.tempo = await caixa(p, "#tj-resultado .tj-tempo");
  medidas.onibus.opcao = await caixa(p, "#tj-resultado .tj-opcao-caixa");
  await foto(p, "20_onibus");
  // as linhas diretas, logo abaixo do resultado; depois o clique numa delas desenha o trajeto
  await p.evaluate(() => {
    const d = document.querySelector(".tj-diretas"), g = document.querySelector(".tj-grade");
    window.scrollTo(0, window.scrollY + d.getBoundingClientRect().bottom - 1080 + 60);
  });
  await espera(p, 900);
  medidas.diretas = {
    caixa: await caixa(p, ".tj-diretas"),
    selo: await caixa(p, ".tj-diretas button.tj-badge"),
    mapa: await caixa(p, "#mapa-trajeto"),
  };
  await foto(p, "32_diretas");
  await p.click(".tj-diretas button.tj-badge");
  await p.mouse.move(1900, 1060);
  await espera(p, 2500);
  // sobe até o mapa do trajeto, com a linha direta desenhada
  await p.evaluate(() => window.scrollBy(0, document.querySelector("#mapa-trajeto").getBoundingClientRect().top - 84));
  await espera(p, 900);
  medidas.diretas.mapa_linha = await caixa(p, "#mapa-trajeto");
  await foto(p, "32c_diretas_mapa");
  await p.close();
}

// ---------- preços ----------
{
  const p = await abrir(desk, "index.html");
  await irPara(p, "#precos");
  await espera(p, 900);
  await foto(p, "22_precos");
  await p.close();
}

// ---------- Onde morar: o questionário e o resultado ----------
{
  const p = await abrir(desk, "morar.html");
  await espera(p, 1200);
  medidas.morar = { cidade: await caixa(p, "#cidade-quiz") };
  await p.click("#avancar");
  await espera(p, 900); // orçamento: fica com os valores padrão
  // Cada resposta avança sozinha; para fotografar a pergunta respondida (com a cidade acesa),
  // responde, volta um passo e espera a cidade assentar.
  const responder = async (tecla) => {
    await p.keyboard.press(tecla);
    await espera(p, 800);
    await p.click("#voltar");
    await p.mouse.move(1900, 1060);
    await espera(p, 1600);
  };
  await p.click("#avancar"); // trajeto: Centro, pesa "importa"; a cidade acende pelo tempo de ônibus
  await espera(p, 700);
  await p.click('.destinos button[data-d="p_centro"]');
  await responder("3");
  await foto(p, "24b_morar_trajeto");
  await p.click("#avancar");
  await espera(p, 700);
  await responder("4"); // segurança: essencial
  await foto(p, "25_morar_seguranca");
  await p.click("#avancar");
  await espera(p, 700);
  await responder("3"); // saúde: importa
  await foto(p, "26_morar_saude");
  await p.close();

  const r = await abrir(desk, "morar.html#r=6000&e=50000&q=2&n=3222222&m=1&d=p_centro&dn=2");
  await espera(r, 2500);
  medidas.morar.cards = await caixa(r, "#cards");
  medidas.morar.mapa = await caixa(r, "#mapa-morar");
  medidas.morar.titulo = await caixa(r, "#res-titulo");
  await foto(r, "27_morar_resultado");
  await r.evaluate(() => document.querySelector("#cards").scrollIntoView({ behavior: "instant", block: "start" }));
  await espera(r, 900);
  medidas.morar.rolagem_cards = await r.evaluate(() => window.scrollY);
  medidas.morar.card = await caixa(r, "#cards > li");
  medidas.morar.card_onibus = await caixa(r, "#cards > li .card-trajeto");
  medidas.morar.mapa_rolado = await caixa(r, "#mapa-morar");
  await foto(r, "28_morar_cards");
  await r.close();
}
await desk.close();

// ---------- celular ----------
{
  const cel = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await preparar(cel);
  const p = await abrir(cel, "index.html");
  await espera(p, 1500);
  await irPara(p, "#mapa");
  await foto(p, "18_celular_mapa");
  await irPara(p, "#trajeto");
  await escolher(p, "#tj-origem", "BOM JARDIM");
  await espera(p, 500);
  await escolher(p, "#tj-destino", "CENTRO (PRAÇA DO FERREIRA)");
  await espera(p, 3500);
  await p.evaluate(() => document.querySelector("#tj-resultado").scrollIntoView({ behavior: "instant", block: "start" }));
  await espera(p, 700);
  await foto(p, "29_celular_onibus");
  await p.close();
  const m = await abrir(cel, "morar.html");
  await espera(m, 1500);
  await m.click("#avancar");
  await espera(m, 900);
  await foto(m, "30_celular_morar");
  await m.close();
  await cel.close();
}
await navegador.close();

fs.writeFileSync(path.join(VIDEO, "public/dados/medidas.json"), JSON.stringify(medidas, null, 1));
console.log("medidas ->", JSON.stringify(medidas));
