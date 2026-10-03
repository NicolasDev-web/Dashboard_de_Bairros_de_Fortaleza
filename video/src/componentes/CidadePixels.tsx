import React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import cidade from "../../public/dados/cidade.json";
import { clamp, EASE } from "../tema";

type Celula = [number, number, number, number]; // i, j, nota normalizada (0–1), distância ao Centro
const CELULAS = cidade.celulas as Celula[];
export const CIDADE_LARG = cidade.cols * cidade.lado;
export const CIDADE_ALT = cidade.lins * cidade.lado;

/**
 * Fortaleza em pixels, como na abertura do dashboard: cada pixel é um ponto de um bairro,
 * maior e mais claro quanto maior o índice do bairro.
 *
 * montagem: 0 = pixels espalhados pela tela; 1 = cidade formada (ordem: do Centro para fora)
 * varredura: posição (0–1) da faixa de luz que atravessa a cidade (-1 desliga)
 */
export const CidadePixels: React.FC<{
  montagem: number;
  varredura?: number;
  cor?: string;
  espalhar?: number;
}> = ({ montagem, varredura = -1, cor = "#ffffff", espalhar = 1 }) => {
  const frame = useCurrentFrame();
  const lado = cidade.lado;
  return (
    <svg width={CIDADE_LARG} height={CIDADE_ALT} viewBox={`0 0 ${CIDADE_LARG} ${CIDADE_ALT}`} style={{ overflow: "visible" }}>
      {CELULAS.map(([i, j, t, d], k) => {
        // cada pixel chega no seu tempo: do Centro para fora, com um pouco de acaso
        const ordem = d * 0.75 + random(`o${k}`) * 0.25;
        const p = interpolate(montagem, [ordem * 0.7, ordem * 0.7 + 0.3], [0, 1], { ...clamp, easing: EASE.entrada });
        // posição de origem: espalhada pela tela, derivando devagar
        const ox = (random(`x${k}`) - 0.5) * 2600 * espalhar + Math.sin(frame / 50 + k) * 14;
        const oy = (random(`y${k}`) - 0.5) * 1500 * espalhar + Math.cos(frame / 60 + k * 0.7) * 14;
        const x = interpolate(p, [0, 1], [CIDADE_LARG / 2 + ox, i * lado]);
        const y = interpolate(p, [0, 1], [CIDADE_ALT / 2 + oy, j * lado]);
        const onda = varredura < 0 ? 0 : Math.exp(-(((i / cidade.cols - varredura) / 0.06) ** 2));
        const tam = lado * interpolate(p, [0, 1], [0.18, 0.2 + 0.62 * t + 0.25 * onda]);
        const alfa = interpolate(p, [0, 1], [0.18 + 0.2 * random(`a${k}`), Math.min(1, 0.3 + 0.62 * t + 0.35 * onda)]);
        return <rect key={k} x={x + (lado - tam) / 2} y={y + (lado - tam) / 2} width={tam} height={tam} fill={cor} opacity={alfa} />;
      })}
    </svg>
  );
};
