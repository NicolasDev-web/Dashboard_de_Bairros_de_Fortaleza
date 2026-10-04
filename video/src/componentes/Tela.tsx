import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, EASE } from "../tema";

// As capturas têm 1920x1080 em CSS px (gravadas com DPR 2), então coordenadas medidas no
// dashboard valem direto aqui.
export type Camera = { x: number; y: number; zoom: number }; // ponto da tela no centro do quadro + zoom

/**
 * Captura real do dashboard com câmera: interpola entre quadros-chave de câmera.
 * chaves: [[frame, {x, y, zoom}], ...] em frames locais.
 */
export const Tela: React.FC<{
  src: string;
  chaves: [number, Camera][];
  opacidade?: number;
  largura?: number;
  altura?: number;
  filtro?: string;
}> = ({ src, chaves, opacidade = 1, largura = 1920, altura = 1080, filtro }) => {
  const frame = useCurrentFrame();
  const fs = chaves.map((c) => c[0]);
  const op = { ...clamp, easing: EASE.camera };
  const cxLivre = chaves.length > 1 ? interpolate(frame, fs, chaves.map((c) => c[1].x), op) : chaves[0][1].x;
  const cyLivre = chaves.length > 1 ? interpolate(frame, fs, chaves.map((c) => c[1].y), op) : chaves[0][1].y;
  const z = chaves.length > 1 ? interpolate(frame, fs, chaves.map((c) => c[1].zoom), op) : chaves[0][1].zoom;
  // a câmera nunca mostra além da borda da captura
  const meiaL = 960 / z, meiaA = 540 / z;
  const cx = Math.min(Math.max(cxLivre, meiaL), largura - meiaL);
  const cy = Math.min(Math.max(cyLivre, meiaA), altura - meiaA);
  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: opacidade }}>
      <Img
        src={staticFile(src)}
        style={{
          position: "absolute", left: 0, top: 0, width: largura, height: altura,
          transformOrigin: "0 0",
          translate: `${960 - cx * z}px ${540 - cy * z}px`,
          scale: `${z}`,
          filter: filtro,
        }}
      />
    </AbsoluteFill>
  );
};

/** Faixa escura degradê para dar leitura ao texto sobre a interface. */
export const Veu: React.FC<{ lado?: "esquerda" | "baixo"; forca?: number; cor?: string }> = ({
  lado = "esquerda", forca = 0.9, cor = "10,12,44",
}) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background:
        lado === "esquerda"
          ? `linear-gradient(90deg, rgba(${cor},${forca}) 0%, rgba(${cor},${forca * 0.85}) 32%, rgba(${cor},0) 62%)`
          : `linear-gradient(0deg, rgba(${cor},${forca}) 0%, rgba(${cor},${forca * 0.8}) 30%, rgba(${cor},0) 60%)`,
    }}
  />
);

/** Cursor do sistema, usado só quando explica uma ação (clique num bairro). */
export const Cursor: React.FC<{ chaves: [number, number, number][]; clique?: number }> = ({ chaves, clique }) => {
  const frame = useCurrentFrame();
  const fs = chaves.map((c) => c[0]);
  const x = interpolate(frame, fs, chaves.map((c) => c[1]), { ...clamp, easing: EASE.camera });
  const y = interpolate(frame, fs, chaves.map((c) => c[2]), { ...clamp, easing: EASE.camera });
  const pressao = clique === undefined ? 1 : interpolate(frame, [clique - 3, clique, clique + 6], [1, 0.82, 1], clamp);
  const anel = clique === undefined ? 0 : interpolate(frame, [clique, clique + 16], [0, 1], clamp);
  const fim = fs[fs.length - 1];
  const opacidade = interpolate(frame, [fs[0], fs[0] + 8, fim, fim + 8], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: opacidade }}>
      {clique !== undefined && frame >= clique && (
        <div
          style={{
            position: "absolute", left: -40 * anel, top: -40 * anel, width: 80 * anel, height: 80 * anel,
            border: "3px solid #fff", borderRadius: 4, opacity: 1 - anel,
          }}
        />
      )}
      <svg width="44" height="52" viewBox="0 0 22 26" style={{ scale: `${pressao}`, transformOrigin: "0 0", filter: "drop-shadow(0 3px 6px rgba(0,0,0,.35))" }}>
        <path d="M2 1 L2 20 L7 15.5 L10.5 23.5 L13.6 22.2 L10.2 14.4 L17 14.4 Z" fill="#fff" stroke="#15184f" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
};
