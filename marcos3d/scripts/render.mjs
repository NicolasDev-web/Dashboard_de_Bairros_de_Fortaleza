// Renders dos marcos: npm run render -- --ids centro,unifor --fonte tsx,glb --vistas perspectiva,frente,close --porta 5301
// Saída: renders/<id>/<fonte>-<vista>.png (fonte=glb é o arquivo publicado hoje; tsx é o componente da oficina)
import { mkdirSync } from "node:fs";
import path from "node:path";
import { RAIZ, abrirOficina, argumentos, escolher } from "./comum.mjs";

const a = argumentos();
const lista = escolher(a.ids);
const fontes = String(a.fonte || "tsx").split(",");
const vistas = String(a.vistas || "perspectiva,frente,close").split(",");
const ofi = await abrirOficina(a.porta || 5300);
let falhas = 0;
try {
  for (const m of lista) {
    const pasta = path.join(RAIZ, "renders", m.id);
    mkdirSync(pasta, { recursive: true });
    for (const fonte of fontes) {
      if (fonte === "glb" && m.grupo === "novo") continue; // marco novo ainda não tem GLB publicado
      for (const vista of vistas) {
        const { pagina, erros } = await ofi.abrir({ id: m.id, vista, fonte });
        const arq = path.join(pasta, `${fonte}-${vista}.png`);
        await pagina.screenshot({ path: arq });
        const est = await pagina.evaluate("window.__estatisticas && window.__estatisticas()");
        console.log(`${m.id} ${fonte} ${vista} -> ${path.relative(RAIZ, arq)}`, JSON.stringify(est), erros.length ? `ERROS: ${erros.join(" | ")}` : "");
        if (erros.length) falhas++;
        await pagina.close();
      }
    }
  }
} finally {
  await ofi.fechar();
}
process.exit(falhas ? 1 : 0);
