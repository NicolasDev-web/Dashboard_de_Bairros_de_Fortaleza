// Junta os quadros de cada plano gravado (out/demo/quadros/<plano>/) num vídeo para a edição:
// public/demo/<plano>.mp4, 60 fps, 2880x1620 (folga de 1,5x para os push-ins em 1080p) e
// src/demo/marcas.json com a duração, as marcas e os cliques de cada plano (a edição lê dali).
// Rodar de video/:  node scripts/demo/codificar.mjs [planos...]      PREVIA=1 usa out/demo/previa
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { VIDEO } from "./motor.mjs";

const PREVIA = !!process.env.PREVIA;
const ORIGEM = path.join(VIDEO, PREVIA ? "out/demo/previa" : "out/demo/quadros");
const DESTINO = path.join(VIDEO, PREVIA ? "out/demo/previa_mp4" : "public/demo");
fs.mkdirSync(DESTINO, { recursive: true });
const SO = process.argv.slice(2);
const arqMarcas = PREVIA ? path.join(DESTINO, "marcas.json") : path.join(VIDEO, "src/demo/marcas.json");
fs.mkdirSync(path.dirname(arqMarcas), { recursive: true });
const marcas = fs.existsSync(arqMarcas) ? JSON.parse(fs.readFileSync(arqMarcas, "utf8")) : {};

for (const nome of fs.readdirSync(ORIGEM).sort()) {
  if (SO.length && !SO.includes(nome)) continue;
  const pasta = path.join(ORIGEM, nome);
  if (!fs.existsSync(path.join(pasta, "marcas.json"))) continue;
  marcas[nome] = JSON.parse(fs.readFileSync(path.join(pasta, "marcas.json"), "utf8"));
  const saida = path.join(DESTINO, `${nome}.mp4`);
  execFileSync("ffmpeg", [
    "-loglevel", "error", "-y", "-framerate", "60", "-i", path.join(pasta, "%05d.jpg"),
    "-vf", PREVIA ? "scale=960:-2" : "scale=2880:1620:flags=lanczos",
    "-c:v", "libx264", "-preset", PREVIA ? "veryfast" : "slow", "-crf", PREVIA ? "26" : "15",
    "-pix_fmt", "yuv420p", "-g", "30", "-movflags", "+faststart", saida,
  ], { stdio: "inherit" });
  console.log("ok", nome, marcas[nome].quadros, "quadros");
}
fs.writeFileSync(arqMarcas, JSON.stringify(marcas, null, 1));
