import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Camera, Tela, Veu } from "../componentes/Tela";
import { Apoio, Rotulo, Titulo } from "../componentes/Texto";
import { clamp, COR, EASE } from "../tema";

// 45–49,8 s. Renda por bairro em 2010; uma linha de luz varre o mapa e revela 2022,
// no mesmo enquadramento e na mesma régua de cores.
export const Tempo: React.FC = () => {
  const frame = useCurrentFrame();
  const camera: [number, Camera][] = [
    [0, { x: 760, y: 700, zoom: 1.12 }],
    [144, { x: 790, y: 700, zoom: 1.2 }],
  ];
  const corte = interpolate(frame, [64, 92], [0, 100], { ...clamp, easing: EASE.camera });
  return (
    <AbsoluteFill style={{ background: COR.papel }}>
      <Tela src="telas/05_renda_2010.png" chaves={camera} />
      <AbsoluteFill style={{ clipPath: `inset(0 ${100 - corte}% 0 0)` }}>
        <Tela src="telas/06_renda_2022.png" chaves={camera} />
      </AbsoluteFill>
      {/* a linha de luz que faz o corte */}
      <div
        style={{
          position: "absolute", top: 0, bottom: 0, left: `${corte}%`, width: 4, marginLeft: -2,
          background: "#fff", boxShadow: "0 0 30px 8px rgba(255,255,255,.75), 0 0 90px 20px rgba(47,55,196,.45)",
          opacity: interpolate(frame, [62, 68, 88, 94], [0, 1, 1, 0], clamp),
        }}
      />

      <Veu lado="esquerda" cor="236,236,242" forca={0.94} />
      <div style={{ position: "absolute", left: 120, top: 150, display: "flex", flexDirection: "column", gap: 20 }}>
        <Rotulo texto="Renda média de quem sustenta a casa" entra={8} cor={COR.cobalto} />
        <div style={{ position: "relative", height: 230 }}>
          <div style={{ position: "absolute" }}>
            <Titulo linhas={["2010"]} entra={10} sai={70} tamanho={220} cor={COR.cobaltoEscuro} espacamento="-0.05em" />
          </div>
          <div style={{ position: "absolute" }}>
            <Titulo linhas={["2022"]} entra={80} tamanho={220} cor={COR.cobaltoEscuro} espacamento="-0.05em" />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 120, bottom: 130 }}>
        <Apoio texto="Dois censos, a mesma régua. A renda de 2010 já vem corrigida pela inflação." entra={96} cor={COR.tinta} largura={700} />
      </div>
    </AbsoluteFill>
  );
};
