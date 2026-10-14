// Captura o tour 3D do site (servido à parte, ex.: python -m http.server dentro de dashboard/):
// node scripts/foto-tour.mjs --url http://127.0.0.1:8765/index.html --ids 10,65 --caps 0,1 --saida renders/tour --largura 1440 --altura 860
// Abre #b3d=<id>, avança até cada capítulo pedido e salva <saida>/<prefixo><id>-cap<n>.png
import { mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import puppeteer from "puppeteer-core";
import { RAIZ, argumentos } from "./comum.mjs";

const a = argumentos();
const url = a.url || "http://127.0.0.1:8765/index.html";
const ids = String(a.ids || "10").split(",");
const caps = String(a.caps || "0").split(",").map(Number);
const saida = path.resolve(RAIZ, a.saida || "renders/tour");
const prefixo = a.prefixo || "";
mkdirSync(saida, { recursive: true });
const navegador = await puppeteer.launch({
  executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  userDataDir: path.join(os.tmpdir(), `oficina-tour-${process.pid}`),
  args: ["--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  defaultViewport: { width: +(a.largura || 1440), height: +(a.altura || 860), deviceScaleFactor: 1 },
});
const erros = [];
try {
  for (const id of ids) {
    const p = await navegador.newPage();
    p.on("pageerror", (e) => erros.push(`${id}: ${e}`));
    await p.goto(`${url}#b3d=${id}`, { waitUntil: "load", timeout: 120000 });
    await new Promise((r) => setTimeout(r, 3500));
    let atual = 0;
    for (const c of caps) {
      while (atual < c) { await p.keyboard.press("ArrowRight"); atual++; }
      await new Promise((r) => setTimeout(r, atual ? 2200 : 0));
      const arq = path.join(saida, `${prefixo}${id}-cap${c}.png`);
      await p.screenshot({ path: arq });
      console.log(path.relative(RAIZ, arq));
    }
    await p.close();
  }
} finally {
  await navegador.close();
}
if (erros.length) { console.log("ERROS:", erros.join(" | ")); process.exit(1); }
