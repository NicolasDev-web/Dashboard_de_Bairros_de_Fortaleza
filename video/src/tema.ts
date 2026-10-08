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
// (MARCOS em scripts/gerar_assets.py = de / 30).
export const CENAS = {
  abertura: { de: 0, dur: 240 }, // 0–8 s         atmosfera + tensão (drone, vento)
  revelacao: { de: 240, dur: 150 }, // 8–13 s     impacto, pulso começa
  mergulho: { de: 390, dur: 120 }, // 13–17 s     whoosh, entra na interface
  indice: { de: 510, dur: 156 }, // 17–22,2 s      arpejo começa
  onibus: { de: 666, dur: 324 }, // 22,2–33 s      respiro, relógio
  rede: { de: 990, dur: 234 }, // 33–40,8 s        a rede de linhas; o baixo entra
  diretas: { de: 1224, dur: 126 }, // 40,8–45 s    linhas diretas
  morar: { de: 1350, dur: 234 }, // 45–52,8 s      chimbal
  evolucao: { de: 1584, dur: 144 }, // 52,8–57,6 s
  montagem: { de: 1728, dur: 162 }, // 57,6–63 s   palmas, intensidade máxima
  encerramento: { de: 1890, dur: 216 }, // 63–70,2 s acorde final
};
export const DURACAO = 2106;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
