import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Camera, Tela, Veu } from "../componentes/Tela";
import { Apoio, Rotulo, Titulo } from "../componentes/Texto";
import { clamp } from "../tema";

// 59,4–65,4 s. As 10 rotas de corrida sobre o mapa; a câmera mergulha na orla e
// atravessa para o calor do Strava em volta da Av. Beira-Mar, a 1ª da lista.
export const Rotas: React.FC = () => {
  const frame = useCurrentFrame();
  const visao: [number, Camera][] = [
    [0, { x: 760, y: 560, zoom: 1.12 }],
    [86, { x: 780, y: 520, zoom: 1.2 }],
    [118, { x: 830, y: 348, zoom: 3.4 }],
  ];
  const orla: [number, Camera][] = [
    // zoom >= 1,45 para o calor preencher o quadro (o contêiner do mapa tem 1408x760)
    [104, { x: 760, y: 592, zoom: 2.0 }],
    [136, { x: 760, y: 592, zoom: 1.52 }],
    [180, { x: 780, y: 592, zoom: 1.46 }],
  ];
  return (
    <AbsoluteFill style={{ background: "#0d1033" }}>
      <Tela src="telas/11b_rotas_corrida_indice.png" chaves={visao} opacidade={interpolate(frame, [0, 10], [0, 1], clamp)} />
      <Tela src="telas/12_rota_beiramar.png" chaves={orla} opacidade={interpolate(frame, [104, 122], [0, 1], clamp)} />

      <AbsoluteFill style={{ opacity: interpolate(frame, [4, 22, 84, 100], [0, 1, 1, 0], clamp) }}>
        <Veu lado="esquerda" />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 120 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          <Titulo linhas={["Rotas mais", "feitas"]} entra={14} sai={86} tamanho={116} />
          <Apoio texto="Corrida e pedal, estimadas pelo mapa de calor do Strava." entra={32} sai={84} largura={620} />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ opacity: interpolate(frame, [124, 140], [0, 1], clamp) }}>
        <Veu lado="baixo" forca={0.92} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 0 120px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Rotulo texto="1ª rota de corrida" entra={128} />
          <Titulo linhas={["Av. Beira-Mar"]} entra={132} tamanho={116} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
