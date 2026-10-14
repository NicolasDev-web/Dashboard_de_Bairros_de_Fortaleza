/* Confere dashboard/historias.js contra dashboard/data.js antes de publicar: todo bairro tem história, todo
 * capítulo tem texto e fonte, todo marco existe (com o .glb em dashboard/marcos/) e cada pino cai dentro do
 * próprio bairro na malha da Seuma.
 *
 *   node scripts/validar_historias.js            (sai com código 1 se houver erro)
 */
const fs = require("fs"), path = require("path");
const dir = path.resolve(__dirname, "..", "dashboard");
global.window = {};
require(path.join(dir, "data.js")); require(path.join(dir, "historias.js"));
const F = window.DADOS.geojson.features, H = window.HISTORIAS, M = window.MARCOS;
const dentro = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const onde = (lat, lng) => { const f = F.find((f) => dentro(lng, lat, f.geometry.coordinates[0])); return f ? f.properties.id : null; };
const erros = [], avisos = [];
let caps = 0, pinos = 0, chars = 0, destaques = 0;
for (const f of F) {
  const { id, nome } = f.properties, h = H[id];
  if (!h || !h.capitulos || !h.capitulos.length) { erros.push(`${id} ${nome}: sem história`); continue; }
  for (const c of h.capitulos) {
    caps++; chars += [].concat(c.texto).join(" ").length; if (c.destaque) destaques++;
    if (!c.titulo || !c.texto || ![].concat(c.texto).every((t) => typeof t === "string" && t.length > 20)) erros.push(`${id} ${nome}: capítulo sem título/texto`);
    if (!c.fonte || !c.fonte.length || c.fonte.some((x) => !x.nome || !x.url)) erros.push(`${id} ${nome} / ${c.titulo}: sem fonte`);
    if (!["bairro", "marco", "ponto"].includes(c.tipo)) erros.push(`${id}: tipo ${c.tipo}`);
    // o ano em destaque tem que estar no próprio texto do capítulo (nada de fato novo só no destaque)
    if (c.destaque && !(/^\d+$/.test(c.destaque.valor) && [].concat(c.texto).join(" ").includes(c.destaque.valor) && c.destaque.legenda)) erros.push(`${id} ${nome} / ${c.titulo}: destaque "${c.destaque.valor}" não aparece no texto`);
    if (c.tipo === "marco") {
      const m = M[c.marco];
      if (!m) { erros.push(`${id}: marco ${c.marco} não existe`); continue; }
      if (!fs.existsSync(path.join(dir, "marcos", m.arquivo))) erros.push(`${c.marco}: falta ${m.arquivo}`);
      const b = onde(c.lat ?? m.lat, c.lng ?? m.lng);
      if (b !== id) avisos.push(`${id} ${nome}: marco ${c.marco} cai no bairro ${b}`);
    }
    if (c.tipo === "ponto") {
      pinos++;
      if (c.lat == null) { erros.push(`${id}: ponto sem lat/lng`); continue; }
      const b = onde(c.lat, c.lng);
      if (b !== id) erros.push(`${id} ${nome}: ponto "${c.rotulo}" cai no bairro ${b}`);
    }
  }
}
const ids = new Set(F.map((f) => f.properties.id));
for (const k of Object.keys(H)) if (!ids.has(+k)) erros.push(`HISTORIAS[${k}] não é bairro`);
for (const [k, m] of Object.entries(M)) if (!Object.values(H).some((h) => h.capitulos.some((c) => c.marco === k))) avisos.push(`marco ${k} sem capítulo`);
console.log(`${Object.keys(H).length} bairros, ${caps} capítulos (${destaques} com ano em destaque), ${pinos} pinos, ${Object.keys(M).length} marcos, ${chars} caracteres de texto`);
avisos.forEach((a) => console.log("aviso:", a)); erros.forEach((e) => console.log("ERRO:", e));
process.exit(erros.length ? 1 : 0);
