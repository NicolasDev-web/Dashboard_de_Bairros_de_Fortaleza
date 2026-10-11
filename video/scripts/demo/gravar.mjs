// Grava a demo do produto (roteiro em ROTEIRO_DEMO.md) a partir do dashboard real.
// Rodar de video/:   node scripts/demo/gravar.mjs                 (todos os planos)
//                    node scripts/demo/gravar.mjs mapa camadas    (só esses; os outros andam sem fotografar)
//
// Cada plano vira uma pasta de quadros JPEG em out/demo/quadros/<plano>/ (3840x2160: a página em
// 1920x1080 com DPR 2, para os push-ins da edição continuarem nítidos) e um marcas.json com os
// quadros dos momentos importantes (cliques, resultado), que a edição usa para cortar no ponto.
// Depois: node scripts/demo/codificar.mjs  (quadros -> public/demo/<plano>.mp4)
import path from "node:path";
import { Gravador, VIDEO, easeOut } from "./motor.mjs";

const SO = process.argv.slice(2);
// PREVIA=1: DPR 1 e JPEG mais leve, para conferir o roteiro rápido
const PREVIA = !!process.env.PREVIA;
const g = new Gravador({ saida: path.join(VIDEO, PREVIA ? "out/demo/previa" : "out/demo/quadros"), dpr: PREVIA ? 1 : 2, qualidade: PREVIA ? 70 : 92 });
const feitos = new Set();
async function plano(nome) {
  // gravando só alguns planos: depois do último pedido, não precisa andar o resto
  if (SO.length && SO.every((n) => feitos.has(n))) { await g.fechar(); process.exit(0); }
  feitos.add(nome);
  if (!SO.length || SO.includes(nome)) g.cena(nome); else g.gravando = false;
}

// centro, na tela, do polígono do bairro (os paths do Leaflet seguem a ordem do geojson)
const centroBairro = (mapaSel, nome) => g.p.evaluate(([m, n]) => {
  const k = window.DADOS.geojson.features.findIndex((f) => f.properties.nome.toUpperCase() === n);
  const r = document.querySelectorAll(`${m} .leaflet-overlay-pane path`)[k].getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, [mapaSel, nome]);

await g.abrir();

// ============ 01 ABERTURA: hero, a cidade em pixels, "Explorar o mapa" ============
await g.ir("index.html");
g.mouse = { x: 1640, y: 960 };
await g.p.mouse.move(g.mouse.x, g.mouse.y);
await plano("abertura");
await g.esperar(1600); // o título sobe por trás da máscara; cursor parado
g.marcar("cidade");
await g.mover(1452, 344, { dur: 1100, arco: 0.08 }); // um pixel do Meireles: a etiqueta do bairro aparece
await g.esperar(800);
await g.mover(1318, 600, { dur: 700, arco: 0.1 }); // e outro, mais ao sul, já a caminho do botão
await g.esperar(500);
g.marcar("vai_botao");
await g.clicarAncora(".hero-acoes a[href='#mapa']", { rolagem: { dur: 2600 } });
g.marcar("chegou_mapa");
await g.esperar(500);
await g.parar();

// ============ 02 MAPA: indicadores e a ficha de um bairro ============
await plano("mapa");
await g.esperar(400);
for (const ind of ["renda", "saneamento", "seguranca"]) {
  g.marcar("clique_" + ind);
  await g.clicar(`#ctl-indicador button[data-v="${ind}"]`, { pausa: 200 });
  await g.esperar(1300); // a cor do mapa termina a transição (420 ms) e fica um tempo para ler
}
// um bairro: o cursor atravessa o mapa até o Meireles e clica
const mei = await centroBairro("#mapa-leaflet", "MEIRELES");
await g.mover(mei.x - 140, mei.y + 170, { dur: 900 });
await g.mover(mei.x, mei.y, { dur: 700, arco: 0.05 });
await g.esperar(260);
g.marcar("clique_bairro");
await g.clicar({ x: mei.x, y: mei.y }, { pausa: 0 });
await g.mover(mei.x + 260, mei.y - 150, { dur: 900, arco: 0.05 }); // sai de cima do mapa (sem dica presa)
await g.esperar(2400);
await g.parar();

// ============ 03 CAMADAS + STRAVA ============
await plano("camadas");
await g.esperar(300);
await g.clicar("#camadas-botao", { depois: 450 });
g.marcar("pracas");
await g.clicar("#chave-pracas", { depois: 1100 });
g.marcar("hospitais");
await g.clicar("#chave-hospitais", { depois: 1100 });
g.marcar("paradas");
await g.clicar("#chave-paradas", { depois: 1400 });
g.marcar("desliga");
await g.clicar("#chave-paradas", { depois: 250, pausa: 160 });
await g.clicar("#chave-pracas", { depois: 250, pausa: 160 });
await g.clicar("#chave-hospitais", { depois: 450, pausa: 160 });
g.marcar("corrida");
await g.clicar('#ctl-rotas button[data-v="run"]', { depois: 1900 }); // as 10 rotas se desenham
// a rota 1 de cada atividade: o cursor para em cima e a dica mostra o nome e o comprimento
const rota1 = (k) => g.p.evaluate((k) => {
  const p = document.querySelector(".leaflet-rotas-pane path.rota-linha");
  const t = p.getTotalLength(), q = p.getPointAtLength(t * k), m = p.getScreenCTM();
  return { x: q.x * m.a + m.e, y: q.y * m.d + m.f };
}, k);
const beiraMar = await rota1(0.5);
g.marcar("dica");
await g.mover(beiraMar.x, beiraMar.y, { dur: 1100 });
await g.esperar(1700);
g.marcar("pedal"); // o painel de camadas continua aberto
await g.clicar('#ctl-rotas button[data-v="ride"]', { depois: 2100 });
const pedal1 = await rota1(0.55);
g.marcar("dica_pedal");
await g.mover(pedal1.x, pedal1.y, { dur: 1100 });
await g.esperar(1500);
await g.parar();

// ============ 04 ÔNIBUS ============
await plano("onibus");
await g.mover(1700, 760, { dur: 600 });
const ytj = await g.topo("#trajeto-titulo", 92);
await g.rolar(ytj, { dur: 1700 });
await g.esperar(400);
g.marcar("clique_polo");
await g.clicar('#tj-polos button[data-d="p_centro"]', { sair: [120, 160] });
await g.esperar(2600); // tempo rola, a rota se desenha, os pinos caem
// o olhar vai para o mapa
const mapaTj = await g.centro("#mapa-trajeto");
await g.mover(mapaTj.x + 120, mapaTj.y + 40, { dur: 1100 });
await g.esperar(1500);
await g.parar();

// ============ 05 EVOLUÇÃO 2010 → 2022 ============
await plano("evolucao");
await g.rolar(await g.topo("#evo-titulo", 104), { dur: 1900 });
g.marcar("chegou");
await g.esperar(1500); // as barras crescem
g.marcar("renda_real");
await g.clicar('#ctl-evo button[data-v="var_renda_real_pct"]', { depois: 1500 });
g.marcar("esgoto");
await g.clicar('#ctl-evo button[data-v="var_saneamento_pp"]', { depois: 1300 });
// passa o mouse pelas barras: a dica mostra o bairro e a variação
const linhas = await g.centro("#linhas");
await g.mover(linhas.b.x + linhas.b.width * 0.62, linhas.y + 40, { dur: 900 });
g.marcar("dica");
await g.mover(linhas.b.x + linhas.b.width * 0.86, linhas.y + 10, { dur: 1700, arco: 0.03 });
await g.esperar(900);
await g.parar();

// ============ 06 PREÇOS ============
await plano("precos");
await g.mover(1500, 700, { dur: 500 });
await g.rolar(await g.topo("#precos-titulo", 104), { dur: 1600 });
await g.esperar(300);
await g.mover(...Object.values(await g.centro("#regionais-lista li:nth-child(1)")).slice(0, 2), { dur: 900 });
await g.esperar(1200);
await g.parar();

// ============ 07 → "ONDE MORAR" ============
// o botão "Onde morar" está na barra do topo, que acompanha a rolagem
await plano("vai_morar");
await g.clicar(".nav-links a.nav-destaque", { pausa: 260 });
await g.esperar(80);
await g.parar();
g.gravando = false;
g.mouse = { x: 600, y: 990 }; // fora da cidade em pixels: nenhuma etiqueta de bairro aberta no começo
await g.ir("morar.html");
await g.p.mouse.move(g.mouse.x, g.mouse.y);

// ============ 08 QUIZ: abertura e "Começar" ============
await plano("quiz_intro");
await g.esperar(2600); // as linhas do título sobem e a cidade acende
g.marcar("comecar");
await g.clicar("#avancar", { pausa: 280 });
await g.esperar(900);
await g.parar();

// ============ 09 ORÇAMENTO ============
await plano("orcamento");
const [slR, slE] = await g.p.evaluate(() => [...document.querySelectorAll(".passo:last-child .renda-slider")].map((s) => {
  const r = s.getBoundingClientRect(); return { x: r.x, y: r.y + r.height / 2, w: r.width, min: +s.min, max: +s.max, v: +s.value };
}));
// posição do polegar do range (o polegar tem ~16 px: o centro anda de x+8 a x+w-8)
const px = (s, v) => s.x + 8 + (s.w - 16) * (v - s.min) / (s.max - s.min);
await g.esperar(500);
g.marcar("renda");
await g.arrastar({ x: px(slR, slR.v), y: slR.y }, { x: px(slR, 13000), y: slR.y + 1 }, { dur: 1900 });
await g.arrastar({ x: px(slR, 13000), y: slR.y + 1 }, { x: px(slR, 12000), y: slR.y }, { dur: 500, pausa: 120, curva: easeOut });
await g.esperar(700);
g.marcar("entrada");
await g.arrastar({ x: px(slE, slE.v), y: slE.y }, { x: px(slE, 100000), y: slE.y }, { dur: 1300 });
await g.esperar(1100);
g.marcar("continuar");
await g.clicar("#avancar", { pausa: 220 });
await g.esperar(700);
await g.parar();

// ============ 10 TRAJETO ============
await plano("trajeto");
await g.esperar(300);
await g.clicar('.passo:last-child .destino[data-d="p_aldeota"]', { depois: 700 });
g.marcar("importa");
await g.clicar('.passo:last-child .opcao[data-i="2"]', { depois: 1200 });
await g.parar();

// ============ 11 PREFERÊNCIAS ============
// segurança, saúde, lazer, infraestrutura, mobilidade, escolas, comércio, ritmo
await plano("preferencias");
for (const [rot, i] of [["seguranca", 3], ["saude", 2], ["lazer", 3], ["infra", 2], ["mobilidade", 3], ["escolas", 1], ["comercio", 2], ["ritmo", 1]]) {
  await g.esperar(260);
  g.marcar(rot);
  await g.clicar(`.passo:last-child .opcao[data-i="${i}"]`, { pausa: 180 });
  await g.esperar(rot === "ritmo" ? 300 : 820); // a cidade reage; a próxima pergunta entra sozinha
}
await g.parar();

// ============ 12 RESULTADO ============
await plano("resultado");
g.marcar("transicao");
// durante a transição nativa do quiz para o resultado, a mão sai de onde vai abrir o mapa
// (senão a dica de um bairro já nasce aberta embaixo do cursor)
await g.mover(1010, 210, { dur: 900, arco: 0.06 });
await g.esperar(250);
g.marcar("abre");
await g.esperar(2400); // mapa pinta em onda, cards contam a compatibilidade
const c1 = await g.centro("#cards > li:nth-child(1)");
await g.mover(c1.x - 60, c1.b.y + 60, { dur: 1100 });
g.marcar("hover1");
await g.esperar(1000);
const c2 = await g.centro("#cards > li:nth-child(2)");
g.marcar("clique2");
await g.clicar({ x: c2.x - 60, y: c2.b.y + 50 }, { depois: 1600 });
await g.parar();

// ============ 13 PROFUNDIDADE: card e camadas no mapa do resultado ============
await plano("profundidade");
await g.clicar("#camadas label:nth-child(2)", { depois: 1300 }); // hospitais
await g.clicar("#camadas label:nth-child(3)", { depois: 1500 }); // metrô e VLT
await g.parar();

// ============ 14 ENCERRAMENTO: a cidade em pixels, sem cursor ============
g.gravando = false;
g.cursorVisivel = 0;
g.mouse = { x: 1900, y: 1070 };
await g.ir("index.html");
await g.p.mouse.move(g.mouse.x, g.mouse.y);
await g.esperar(2000);
await plano("encerramento");
await g.esperar(6000);
await g.parar();

await g.fechar();
