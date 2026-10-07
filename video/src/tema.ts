import { Easing, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";

// Mesmas famílias do dashboard (dashboard/styles.css), em arquivos locais (public/fontes, do
// pacote "geist", licença OFL): o render não depende do Google Fonts. As variáveis aceitam
// qualquer peso entre 100 e 900, inclusive os 420 dos títulos.
export const SANS = "Geist";
export const MONO = "Geist Mono";
loadFont({ family: SANS, url: staticFile("fontes/Geist-Variable.woff2"), weight: "100 900" });
loadFont({ family: MONO, url: staticFile("fontes/GeistMono-Variable.woff2"), weight: "100 900" });

// Tokens do dashboard
export const COR = {
  cobalto: "#2f37c4",
  cobaltoFundo: "#2a31b8",
  cobaltoEscuro: "#1f2599",
  noite: "#0a0c2c",
  papel: "#ececf2",
  papelClaro: "#f5f5f9",
  tinta: "#15184f",
  tinta2: "#4a4e7a",
  tintaClara: "#b9bce9",
  perda: "#e8631e",
  branco: "#ffffff",
};

// Curvas: entradas longas e decididas, saídas rápidas, câmera com inércia
export const EASE = {
  entrada: Easing.bezier(0.16, 1, 0.3, 1),
  saida: Easing.bezier(0.7, 0, 0.84, 0),
  camera: Easing.bezier(0.45, 0, 0.15, 1),
  suave: Easing.bezier(0.33, 0, 0.2, 1),
};

export const FPS = 30;
export const BATIDA = 18; // 100 BPM a 30 fps

// Linha do tempo (frames). A trilha (public/audio/trilha.wav) foi composta sobre estes marcos
// (MARCOS em scripts/gerar_assets.py = de / 30). Do Índice em diante, tudo cai na batida (18 frames).
export const CENAS = {
  abertura: { de: 0, dur: 300 }, // 0–10 s     atmosfera + tensão (drone, vento)
  revelacao: { de: 300, dur: 150 }, // 10–15 s   impacto, pulso começa
  mergulho: { de: 450, dur: 150 }, // 15–20 s    whoosh, entra na interface
  indice: { de: 600, dur: 156 }, // 20–25,2 s     arpejo começa
  onibus: { de: 756, dur: 324 }, // 25,2–36 s     respiro, relógio
  morar: { de: 1080, dur: 270 }, // 36–45 s       chimbal
  tempo: { de: 1350, dur: 144 }, // 45–49,8 s
  evolucao: { de: 1494, dur: 144 }, // 49,8–54,6 s
  camadas: { de: 1638, dur: 144 }, // 54,6–59,4 s baixo
  rotas: { de: 1782, dur: 180 }, // 59,4–65,4 s
  montagem: { de: 1962, dur: 162 }, // 65,4–70,8 s palmas, intensidade máxima
  encerramento: { de: 2124, dur: 216 }, // 70,8–78 s acorde final
};
export const DURACAO = 2340;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
