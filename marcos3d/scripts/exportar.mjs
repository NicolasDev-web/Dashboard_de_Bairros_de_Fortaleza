// Exporta os marcos para GLB: npm run exportar -- --ids theatro,estoril --porta 5302
// componente -> GLTFExporter (no Chrome) -> saida/bruto/<arquivo> -> dedup, weld, prune, meshopt -> saida/<arquivo>
// Para publicar, copie de saida/ para ../dashboard/marcos/ (feito só depois da aprovação).
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { RAIZ, abrirOficina, argumentos, escolher } from "./comum.mjs";

const a = argumentos();
const lista = escolher(a.ids);
const bruto = path.join(RAIZ, "saida", "bruto");
mkdirSync(bruto, { recursive: true });
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
const ofi = await abrirOficina(a.porta || 5300);
let falhas = 0;
try {
  for (const m of lista) {
    const { pagina, erros } = await ofi.abrir({ id: m.id, vista: "perspectiva", fonte: "tsx" });
    if (erros.length) { console.log(`${m.id}: ERROS ${erros.join(" | ")}`); falhas++; await pagina.close(); continue; }
    const b64 = await pagina.evaluate("window.__exportarGLB()");
    const est = await pagina.evaluate("window.__estatisticas()");
    await pagina.close();
    const arqBruto = path.join(bruto, m.arquivo);
    writeFileSync(arqBruto, Buffer.from(b64, "base64"));
    const doc = await io.read(arqBruto);
    await doc.transform(dedup(), weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
    const final = path.join(RAIZ, "saida", m.arquivo);
    await io.write(final, doc);
    const kb = (f) => Math.round(statSync(f).size / 1024);
    console.log(`${m.id} -> saida/${m.arquivo}: ${kb(arqBruto)} KB bruto, ${kb(final)} KB final`, JSON.stringify(est));
  }
} finally {
  await ofi.fechar();
}
process.exit(falhas ? 1 : 0);
