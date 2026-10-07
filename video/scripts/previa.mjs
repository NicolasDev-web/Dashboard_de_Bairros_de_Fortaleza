// Renderiza frames avulsos para inspeção: node scripts/previa.mjs 100 450 900 ...
// NAVEGADOR=/caminho/do/chrome usa um Chrome/Chromium já instalado (sem baixar o do Remotion).
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const frames = process.argv.slice(2).map(Number);
const browserExecutable = process.env.NAVEGADOR || null;
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "Lancamento", browserExecutable });
for (const frame of frames) {
  const output = path.resolve(`out/previa/f${String(frame).padStart(4, "0")}.png`);
  await renderStill({ composition, serveUrl, output, frame, browserExecutable });
  console.log("ok", frame);
}
