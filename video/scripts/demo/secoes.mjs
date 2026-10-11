// Escreve src/demo/secoes.json (início de cada seção da edição, em segundos) para a trilha
// (trilha_demo.py) cair nos cortes. Rodar de video/ depois de codificar.mjs:
//   node --experimental-strip-types scripts/demo/secoes.mjs
import fs from "node:fs";
import path from "node:path";
import { VIDEO } from "./motor.mjs";
import { montar } from "../../src/demo/linha.ts";

const marcas = JSON.parse(fs.readFileSync(path.join(VIDEO, "src/demo/marcas.json"), "utf8"));
const { secoes, duracao } = montar(marcas);
const s = { _: "Gerado por scripts/demo/secoes.mjs a partir de src/demo/linha.ts: início de cada seção, em segundos." };
for (const [k, v] of Object.entries(secoes).sort((a, b) => a[1] - b[1])) s[k] = +(v / 60).toFixed(3);
s.fim = +(duracao / 60).toFixed(3);
fs.writeFileSync(path.join(VIDEO, "src/demo/secoes.json"), JSON.stringify(s, null, 2) + "\n");
console.log(s);
