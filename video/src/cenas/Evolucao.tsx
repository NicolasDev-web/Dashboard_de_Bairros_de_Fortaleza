import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import evolucao from "../../public/dados/evolucao.json";
import { Apoio, Rotulo } from "../componentes/Texto";
import { clamp, COR, EASE, SANS } from "../tema";

type Bairro = { nome: string; v: number; renda: number };
const DADOS = [...(evolucao as Bairro[])].sort((a, b) => a.renda - b.renda);
const PERDERAM = DADOS.filter((d) => d.renda < 0).length; // 73, calculado dos dados

// Gráfico redesenhado do dashboard (uma linha por bairro), com a variação da renda real.
const X0 = 120, X1 = 1800, ZERO = 740, ALTURA_MAX = 300;
const ESC = ALTURA_MAX / Math.max(...DADOS.map((d) => d.renda));
const PASSO = (X1 - X0) / DADOS.length;
const PERDA_TEXTO = "#c9530f"; // laranja do dashboard escurecido para texto sobre o papel

// 32–37 s. Um bairro por linha. As perdas acendem em laranja e o número sobe até 73.
export const Evolucao: React.FC = () => {
  const frame = useCurrentFrame();
  const destaque = interpolate(frame, [62, 80], [0, 1], clamp);
  const contagem = Math.round(interpolate(frame, [58, 96], [0, PERDERAM], { ...clamp, easing: EASE.suave }));
  return (
    <AbsoluteFill style={{ background: COR.papel }}>
      <div style={{ position: "absolute", left: 120, top: 110, display: "flex", alignItems: "flex-end", gap: 40 }}>
        <div
          style={{
            fontFamily: SANS, fontSize: 230, fontWeight: 420, letterSpacing: "-0.05em", lineHeight: 0.8,
            color: PERDA_TEXTO, fontVariantNumeric: "tabular-nums", minWidth: 260,
            opacity: interpolate(frame, [52, 62], [0, 1], clamp),
          }}
        >
          {contagem}
        </div>
        <div style={{ paddingBottom: 6 }}>
          <Apoio texto="de 121 bairros perderam renda real entre 2010 e 2022." entra={64} cor={COR.tinta} tamanho={52} largura={760} />
        </div>
      </div>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={X0} x2={X1} y1={ZERO} y2={ZERO} stroke={COR.tinta2} strokeWidth={2}
          opacity={interpolate(frame, [0, 12], [0, 0.7], clamp)} />
        {DADOS.map((d, k) => {
          const cresce = interpolate(frame, [4 + k * 0.32, 26 + k * 0.32], [0, 1], { ...clamp, easing: EASE.entrada });
          const h = Math.abs(d.renda) * ESC * cresce;
          const perda = d.renda < 0;
          return (
            <rect
              key={d.nome}
              x={X0 + k * PASSO + PASSO * 0.2} width={PASSO * 0.6} rx={2}
              y={perda ? ZERO + 2 : ZERO - 2 - h} height={Math.max(0, h)}
              fill={perda ? COR.perda : COR.cobalto}
              opacity={perda ? 1 : interpolate(destaque, [0, 1], [1, 0.28])}
            />
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: 120, top: 930 }}>
        <Rotulo texto="Variação da renda real, um bairro por linha" entra={14} cor={COR.tinta2} />
      </div>
    </AbsoluteFill>
  );
};
