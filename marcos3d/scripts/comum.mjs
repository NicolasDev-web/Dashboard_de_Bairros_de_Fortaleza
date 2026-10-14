// Partes comuns dos scripts da oficina: argumentos, servidor Vite, Chrome headless e a lista de marcos.
import { createServer } from "vite";
import puppeteer from "puppeteer-core";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLICADOS = path.resolve(RAIZ, "../dashboard/marcos");

/** --ids a,b --porta 5301 --vistas perspectiva,close --fonte tsx,glb */
export function argumentos() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith("--")) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true;
  return o;
}

/** Lê os registros (ids e arquivos) sem executar TSX: basta o texto dos dois index.ts */
export function listaDeMarcos() {
  const ler = (arq, grupo) => [...readFileSync(path.join(RAIZ, arq), "utf8").matchAll(/^\s*(\w+):\s*\{\s*Modelo:\s*\w+,[^}]*arquivo:\s*"([^"]+)"/gm)].map((m) => ({ id: m[1], arquivo: m[2], grupo }));
  return [...ler("src/marcos/index.ts", "existente"), ...ler("src/marcos/novos/index.ts", "novo")];
}

export function escolher(ids) {
  const todos = listaDeMarcos();
  if (!ids || ids === true) return todos;
  const pedidos = String(ids).split(",");
  const faltam = pedidos.filter((i) => !todos.some((m) => m.id === i));
  if (faltam.length) throw new Error(`marcos fora do registro: ${faltam.join(", ")}`);
  return todos.filter((m) => pedidos.includes(m.id));
}

const CHROME = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean).find((c) => existsSync(c));

/** Sobe o Vite numa porta própria e abre o Chrome headless com WebGL */
export async function abrirOficina(porta = 5300, largura = 1200, altura = 900) {
  // cada porta com o seu cache do Vite: dois agentes rodando ao mesmo tempo não disputam a mesma pasta
  const servidor = await createServer({ root: RAIZ, configFile: path.join(RAIZ, "vite.config.js"), cacheDir: path.join(RAIZ, "node_modules", `.vite-${porta}`), logLevel: "error", server: { port: +porta, strictPort: true } });
  await servidor.listen();
  const navegador = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", `--window-size=${largura},${altura}`],
    defaultViewport: { width: largura, height: altura },
  });
  const base = `http://localhost:${porta}/`;
  return {
    base,
    navegador,
    /** Abre a prévia e espera ela ficar estável; devolve a página */
    async abrir(query, tempo = 120000) {
      const pagina = await navegador.newPage();
      const erros = [];
      pagina.on("pageerror", (e) => erros.push(String(e)));
      pagina.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
      await pagina.goto(base + "?" + new URLSearchParams(query), { waitUntil: "load" });
      await pagina.waitForFunction("window.__pronto === true || !!window.__erro", { timeout: tempo });
      const erro = await pagina.evaluate("window.__erro");
      if (erro) erros.unshift(erro);
      return { pagina, erros };
    },
    async fechar() { await navegador.close(); await servidor.close(); },
  };
}
