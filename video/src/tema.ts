import { Easing } from "remotion";
import { loadFont as carregarGeist } from "@remotion/google-fonts/Geist";
import { loadFont as carregarGeistMono } from "@remotion/google-fonts/GeistMono";

// Mesmas famílias do dashboard (dashboard/styles.css)
export const { fontFamily: SANS } = carregarGeist("normal", {
  weights: ["300", "400", "500", "600"],
  subsets: ["latin", "latin-ext"],
});
export const { fontFamily: MONO } = carregarGeistMono("normal", {
  weights: ["400", "500"],
  subsets: ["latin", "latin-ext"],
});

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

// Linha do tempo (frames). A trilha (public/audio/trilha.wav) foi composta sobre estes marcos.
export const CENAS = {
  abertura: { de: 0, dur: 300 }, // 0–10 s  atmosfera + tensão (drone, vento)
  revelacao: { de: 300, dur: 150 }, // 10–15 s impacto, pulso começa
  mergulho: { de: 450, dur: 150 }, // 15–20 s whoosh, entra na interface
  indice: { de: 600, dur: 180 }, // 20–26 s arpejo começa
  tempo: { de: 780, dur: 180 }, // 26–32 s
  evolucao: { de: 960, dur: 150 }, // 32–37 s chimbal
  rotas: { de: 1110, dur: 180 }, // 37–43 s baixo
  montagem: { de: 1290, dur: 150 }, // 43–48 s palmas, intensidade máxima
  encerramento: { de: 1440, dur: 210 }, // 48–55 s acorde final
};
export const DURACAO = 1650;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
