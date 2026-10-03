import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Camera, Cursor, Tela, Veu } from "../componentes/Tela";
import { Apoio, Titulo } from "../componentes/Texto";
import { clamp } from "../tema";

// Posições medidas no dashboard (1920x1080, mapa rolado): centro do Meireles e da ficha.
const MEIRELES = { x: 825, y: 365 };
const FOCO_MAPA: Camera = { x: 820, y: 520, zoom: 1.18 };
// a câmera é limitada à borda da captura, então a ficha fica no terço direito do quadro
const FOCO_FICHA: Camera = { x: 1560, y: 420, zoom: 1.75 };
const naTela = (p: { x: number; y: number }, c: Camera) => [960 + (p.x - c.x) * c.zoom, 540 + (p.y - c.y) * c.zoom] as const;

// 20–26 s. O mapa do índice. A câmera aproxima, o cursor escolhe o Meireles e a ficha abre.
export const Indice: React.FC = () => {
  const frame = useCurrentFrame();
  const camera: [number, Camera][] = [
    [0, { x: 960, y: 540, zoom: 1 }],
    [46, FOCO_MAPA],
    [126, FOCO_MAPA],
    [160, FOCO_FICHA],
    [180, { ...FOCO_FICHA, zoom: 1.8 }],
  ];
  const [mx, my] = naTela(MEIRELES, FOCO_MAPA);
  return (
    <AbsoluteFill>
      <Tela src="telas/03_mapa_indice.png" chaves={camera} />
      <Tela src="telas/04_mapa_meireles.png" chaves={camera} opacidade={interpolate(frame, [122, 130], [0, 1], clamp)} />

      <AbsoluteFill style={{ opacity: interpolate(frame, [8, 26, 92, 108], [0, 1, 1, 0], clamp) }}>
        <Veu lado="esquerda" />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 120 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          <Titulo linhas={["Uma nota", "de 0 a 100"]} entra={20} sai={92} tamanho={116} />
          <Apoio texto="Renda, saneamento e segurança, bairro a bairro." entra={40} sai={90} largura={640} />
        </div>
      </AbsoluteFill>

      <Cursor chaves={[[94, 1260, 820], [120, mx, my], [134, mx + 6, my + 4]]} clique={121} />

      <AbsoluteFill style={{ opacity: interpolate(frame, [138, 156], [0, 1], clamp) }}>
        <Veu lado="baixo" forca={0.85} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 0 120px 120px" }}>
        <Titulo linhas={["Cada bairro, em detalhe."]} entra={142} tamanho={96} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
