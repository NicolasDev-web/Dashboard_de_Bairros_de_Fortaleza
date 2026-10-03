import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { clamp, EASE, MONO, SANS } from "../tema";

/**
 * Título que sobe por trás de uma máscara, linha a linha (mesmo gesto da abertura do dashboard).
 * entra: frame de entrada; sai: frame de saída (opcional).
 */
export const Titulo: React.FC<{
  linhas: string[];
  entra: number;
  sai?: number;
  tamanho?: number;
  cor?: string;
  peso?: number;
  alinhar?: "left" | "center";
  atraso?: number;
  entrelinha?: number;
  espacamento?: string;
}> = ({ linhas, entra, sai, tamanho = 112, cor = "#fff", peso = 420, alinhar = "left", atraso = 5, entrelinha = 0.98, espacamento = "-0.04em" }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ fontFamily: SANS, fontSize: tamanho, fontWeight: peso, lineHeight: entrelinha, letterSpacing: espacamento, color: cor, textAlign: alinhar }}>
      {linhas.map((l, k) => (
        <div key={k} style={{ overflow: "hidden", paddingBottom: "0.08em" }}>
          <div
            style={{
              translate: `0 ${interpolate(frame, [entra + k * atraso, entra + k * atraso + 26], [110, 0], { ...clamp, easing: EASE.entrada }) +
                (sai === undefined ? 0 : interpolate(frame, [sai + k * 2, sai + k * 2 + 14], [0, -110], { ...clamp, easing: EASE.saida }))}%`,
            }}
          >
            {l}
          </div>
        </div>
      ))}
    </div>
  );
};

/** Frase de apoio: fade + leve subida, sem máscara. */
export const Apoio: React.FC<{
  texto: string;
  entra: number;
  sai?: number;
  tamanho?: number;
  cor?: string;
  alinhar?: "left" | "center";
  largura?: number;
}> = ({ texto, entra, sai, tamanho = 46, cor = "rgba(255,255,255,.86)", alinhar = "left", largura = 900 }) => {
  const frame = useCurrentFrame();
  const opacidade =
    interpolate(frame, [entra, entra + 18], [0, 1], { ...clamp, easing: EASE.suave }) *
    (sai === undefined ? 1 : interpolate(frame, [sai, sai + 12], [1, 0], clamp));
  return (
    <div
      style={{
        fontFamily: SANS, fontSize: tamanho, fontWeight: 400, lineHeight: 1.22, letterSpacing: "-0.015em",
        color: cor, maxWidth: largura, textAlign: alinhar, opacity: opacidade,
        translate: `0 ${interpolate(frame, [entra, entra + 22], [18, 0], { ...clamp, easing: EASE.entrada })}px`,
        textWrap: "balance",
      }}
    >
      {texto}
    </div>
  );
};

/** Rótulo monoespaçado com a marca de dois blocos do dashboard. */
export const Rotulo: React.FC<{ texto: string; entra: number; sai?: number; cor?: string; tamanho?: number }> = ({
  texto, entra, sai, cor = "rgba(255,255,255,.85)", tamanho = 32,
}) => {
  const frame = useCurrentFrame();
  const opacidade =
    interpolate(frame, [entra, entra + 14], [0, 1], clamp) * (sai === undefined ? 1 : interpolate(frame, [sai, sai + 10], [1, 0], clamp));
  const largura = interpolate(frame, [entra, entra + 22], [0, 1], { ...clamp, easing: EASE.entrada });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: MONO, fontSize: tamanho, color: cor, opacity: opacidade }}>
      <span style={{ display: "inline-flex", gap: 5, scale: `${largura} 1`, transformOrigin: "left" }}>
        <span style={{ width: 16, height: 14, background: "currentColor" }} />
        <span style={{ width: 7, height: 14, background: "currentColor" }} />
      </span>
      <span>{texto}</span>
    </div>
  );
};

/** Marca: "Bairros" + "de Fortaleza" em mono, como no cabeçalho do dashboard. */
export const Marca: React.FC<{ escala?: number; cor?: string }> = ({ escala = 1, cor = "#fff" }) => (
  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, color: cor }}>
    <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 68 * escala, letterSpacing: "-0.03em" }}>Bairros</span>
    <span style={{ fontFamily: MONO, fontSize: 25 * escala, letterSpacing: "0.14em", marginTop: 8 * escala, opacity: 0.85 }}>de Fortaleza</span>
  </div>
);
