// Renderiza frames avulsos para inspeção: node scripts/previa.mjs 100 450 900 ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "Lancamento" });
for (const frame of frames) {
  const output = path.resolve(`out/previa/f${String(frame).padStart(4, "0")}.png`);
  await renderStill({ composition, serveUrl, output, frame });
  console.log("ok", frame);
}
