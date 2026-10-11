import React from "react";
import { AbsoluteFill, Freeze, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { clamp, COR, EASE, MONO, SANS } from "../tema";
import { quadroFonte, type Velocidade } from "./linha";

// Câmera sobre a gravação: ponto da página (em CSS px, 1920x1080) que fica no centro do quadro + zoom.
export type Camera = { x: number; y: number; zoom: number };
export const CHEIO: Camera = { x: 960, y: 540, zoom: 1 };

/**
 * Um plano da gravação real (public/demo/<clip>.mp4, 2880x1620 a 60 fps) com câmera.
 * de: quadro do clipe em que o plano começa.
 * vel: velocidade constante, ou [[frame local, velocidade], ...] para um speed ramp suave
 *      (o quadro do clipe é a integral da velocidade, então a rampa não dá saltos).
 * chaves: [[frame local, câmera], ...]; entre elas a câmera anda com inércia.
 */
export const Gravacao: React.FC<{ clip: string; de: number; vel?: Velocidade; chaves?: [number, Camera][] }> = ({
  clip, de, vel = 1, chaves = [[0, CHEIO]],
}) => {
  const frame = useCurrentFrame();
  const fs = chaves.map((c) => c[0]);
  const op = { ...clamp, easing: EASE.camera };
  const val = (k: keyof Camera) => (chaves.length > 1 ? interpolate(frame, fs, chaves.map((c) => c[1][k]), op) : chaves[0][1][k]);
  const z = val("zoom");
  // a câmera nunca mostra além da borda da gravação
  const meiaL = 960 / z, meiaA = 540 / z;
  const cx = Math.min(Math.max(val("x"), meiaL), 1920 - meiaL);
  const cy = Math.min(Math.max(val("y"), meiaA), 1080 - meiaA);
  const fonte = Math.round(de + quadroFonte(frame, vel));
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: COR.papelClaro }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", translate: `${960 - cx * z}px ${540 - cy * z}px`, scale: `${z}` }}>
        <Freeze frame={fonte}>
          <OffthreadVideo src={staticFile(`demo/${clip}.mp4`)} muted style={{ width: 1920, height: 1080, display: "block" }} />
        </Freeze>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Legenda editorial: uma etiqueta escura e compacta, com a marca de dois blocos do dashboard.
 * Fica num canto livre da interface; entra subindo por trás de uma máscara e sai rápido.
 */
// um dos cantos, ou um ponto livre: a borda (esquerda ou direita) e a base do cartão, em px do quadro
export type Lugar = "baixo-esq" | "baixo-dir" | "cima-esq" | "cima-dir" | "centro" | { x: number; base: number; ancora: "esq" | "dir" };
export const Legenda: React.FC<{
  texto: string; sub?: string; dur: number; lugar?: Lugar; tamanho?: number; clara?: boolean;
}> = ({ texto, sub, dur, lugar = "baixo-esq", tamanho = 40, clara = false }) => {
  const frame = useCurrentFrame();
  const entra = interpolate(frame, [0, 26], [0, 1], { ...clamp, easing: EASE.entrada });
  const sai = interpolate(frame, [dur - 14, dur], [0, 1], { ...clamp, easing: EASE.saida });
  const fundo = clara ? "rgba(255,255,255,.96)" : "rgba(21,24,79,.94)";
  const tinta = clara ? COR.tinta : "#fff";
  const pos: React.CSSProperties =
    typeof lugar === "object"
      ? { [lugar.ancora === "esq" ? "left" : "right"]: lugar.ancora === "esq" ? lugar.x : 1920 - lugar.x, bottom: 1080 - lugar.base,
        alignItems: lugar.ancora === "esq" ? "flex-start" : "flex-end" }
      : lugar === "centro" ? { left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }
        : { [lugar.endsWith("esq") ? "left" : "right"]: 64, [lugar.startsWith("baixo") ? "bottom" : "top"]: lugar.startsWith("cima") ? 112 : 64,
          alignItems: lugar.endsWith("esq") ? "flex-start" : "flex-end" };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", ...pos }}>
        <div
          style={{
            background: fundo, color: tinta, borderRadius: 6, padding: `${tamanho * 0.42}px ${tamanho * 0.62}px ${tamanho * 0.46}px`,
            boxShadow: "0 18px 50px -22px rgba(10,12,44,.55)",
            opacity: entra * (1 - sai), translate: `0 ${(1 - entra) * 18 - sai * 8}px`,
            clipPath: `inset(0 ${(1 - entra) * 100}% 0 0 round 6px)`,
            maxWidth: 1500,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: tamanho * 0.36 }}>
            <span style={{ display: "inline-flex", gap: 4, flex: "none" }}>
              <span style={{ width: tamanho * 0.3, height: tamanho * 0.26, background: clara ? COR.cobalto : COR.tintaClara }} />
              <span style={{ width: tamanho * 0.13, height: tamanho * 0.26, background: clara ? COR.cobalto : COR.tintaClara }} />
            </span>
            <span style={{ fontFamily: SANS, fontSize: tamanho, fontWeight: 450, letterSpacing: "-0.02em", lineHeight: 1.12 }}>{texto}</span>
          </div>
          {sub && (
            <div style={{ fontFamily: MONO, fontSize: tamanho * 0.4, letterSpacing: "0.02em", marginTop: tamanho * 0.3, marginLeft: tamanho * 0.79, opacity: 0.78 }}>
              {sub}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Escurecimento uniforme e leve (fecho e respiros), sem esconder a interface. */
export const Escurece: React.FC<{ de: number; ate: number; forca: number; dur?: number }> = ({ de, ate, forca, dur = 30 }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [de, de + dur, ate, ate + 20], [0, forca, forca, forca], clamp);
  return <AbsoluteFill style={{ background: `rgba(10,12,44,${o})`, pointerEvents: "none" }} />;
};
