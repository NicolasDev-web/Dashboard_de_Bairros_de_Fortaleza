// Controle de qualidade automático dos GLB: npm run checar -- --ids theatro [--de publicados]
// Lê saida/<arquivo> (ou ../dashboard/marcos com --de publicados) e confere o contrato dos marcos:
// cabe no pedestal de 68 m, base em y = 0, nada abaixo do chão, tudo nomeado, normais válidas,
// sem triângulo degenerado demais e dentro do orçamento (600 KB, 40 materiais).
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { PUBLICADOS, RAIZ, argumentos, escolher } from "./comum.mjs";

const LIMITE_KB = 600, LIMITE_MATERIAIS = 40, RAIO = 34;

/** Matriz coluna-maior de translação, rotação (quatérnio) e escala */
function compor(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q, x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [(1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0, (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0, (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1];
}
function multiplicar(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function matrizesDoNo(no) {
  const w = no.getWorldMatrix();
  const inst = no.getExtension("EXT_mesh_gpu_instancing");
  if (!inst) return [w];
  const T = inst.getAttribute("TRANSLATION"), R = inst.getAttribute("ROTATION"), S = inst.getAttribute("SCALE");
  const total = (T || R || S).getCount(), out = [];
  for (let i = 0; i < total; i++) out.push(multiplicar(w, compor(T && T.getElement(i, []), R && R.getElement(i, []), S && S.getElement(i, []))));
  return out;
}
const a = argumentos();
const pasta = a.de === "publicados" ? PUBLICADOS : path.join(RAIZ, "saida");
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
let reprovados = 0;
for (const m of escolher(a.ids)) {
  const arq = path.join(pasta, m.arquivo);
  if (!existsSync(arq)) { console.log(`${m.id}: sem arquivo em ${path.relative(RAIZ, arq)} (rode npm run exportar)`); reprovados++; continue; }
  const doc = await io.read(arq);
  const raiz = doc.getRoot();
  const erros = [], avisos = [];
  let tri = 0, rMax = 0, yMin = Infinity, yMax = -Infinity, normaisRuins = 0, degenerados = 0;
  const v = [0, 0, 0], n = [0, 0, 0];
  for (const no of raiz.listNodes()) {
    const malha = no.getMesh();
    if (!malha) continue;
    // InstancedMesh vira EXT_mesh_gpu_instancing: cada instância tem a sua matriz sobre a do nó
    for (const w of matrizesDoNo(no)) for (const p of malha.listPrimitives()) {
      const pos = p.getAttribute("POSITION"), nor = p.getAttribute("NORMAL"), idx = p.getIndices();
      const c = pos.getCount();
      tri += (idx ? idx.getCount() : c) / 3;
      const mundo = [];
      for (let i = 0; i < c; i++) {
        pos.getElement(i, v);
        const x = w[0] * v[0] + w[4] * v[1] + w[8] * v[2] + w[12], y = w[1] * v[0] + w[5] * v[1] + w[9] * v[2] + w[13], z = w[2] * v[0] + w[6] * v[1] + w[10] * v[2] + w[14];
        mundo.push([x, y, z]);
        rMax = Math.max(rMax, Math.hypot(x, z)); yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
        if (nor) { nor.getElement(i, n); const l = Math.hypot(...n); if (!Number.isFinite(l) || l < 0.5) normaisRuins++; }
      }
      if (!nor) avisos.push(`malha "${malha.getName() || no.getName()}" sem normais`);
      if (idx) for (let i = 0; i < idx.getCount(); i += 3) {
        const [p0, p1, p2] = [idx.getScalar(i), idx.getScalar(i + 1), idx.getScalar(i + 2)].map((k) => mundo[k]);
        const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
        if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-7) degenerados++;
      }
    }
  }
  const semNome = raiz.listNodes().filter((x) => x.getMesh() && !x.getName()).length;
  const matSemNome = raiz.listMaterials().filter((x) => !x.getName()).length;
  const kb = Math.round(statSync(arq).size / 1024);
  if (rMax > RAIO + 0.5) erros.push(`sai do pedestal: raio ${rMax.toFixed(1)} m (máx. ${RAIO})`);
  if (Math.abs(yMin) > 0.05) erros.push(`a base não está em y = 0 (mín. ${yMin.toFixed(2)})`);
  if (kb > LIMITE_KB) erros.push(`${kb} KB (limite ${LIMITE_KB})`);
  if (raiz.listMaterials().length > LIMITE_MATERIAIS) erros.push(`${raiz.listMaterials().length} materiais (limite ${LIMITE_MATERIAIS})`);
  if (normaisRuins) erros.push(`${normaisRuins} normais inválidas`);
  if (semNome) (m.grupo === "novo" ? erros : avisos).push(`${semNome} malhas sem nome`);
  if (matSemNome) (m.grupo === "novo" ? erros : avisos).push(`${matSemNome} materiais sem nome`);
  if (degenerados > tri * 0.01) avisos.push(`${degenerados} triângulos degenerados`);
  const ok = !erros.length;
  if (!ok) reprovados++;
  console.log(`${ok ? "OK " : "REPROVADO"} ${m.id}: ${kb} KB, ${Math.round(tri)} triângulos, ${raiz.listMeshes().length} malhas, ${raiz.listMaterials().length} materiais, raio ${rMax.toFixed(1)} m, altura ${yMax.toFixed(1)} m`);
  for (const e of erros) console.log("   erro:", e);
  for (const e of avisos) console.log("   aviso:", e);
}
process.exit(reprovados ? 1 : 0);
