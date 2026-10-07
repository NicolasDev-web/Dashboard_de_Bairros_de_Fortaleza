import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Camera, Cursor, Tela, Veu } from "../componentes/Tela";
import { Apoio, Titulo } from "../componentes/Texto";
import medidas from "../../public/dados/medidas.json";
import { clamp } from "../tema";

// Posições medidas no dashboard (scripts/capturar_telas.mjs): o Meireles, a ficha e, nela, o
// tempo de ônibus até três polos.
const MEIRELES = medidas.mapa.meireles;
const { ficha, ficha_onibus: fo } = medidas.mapa;
const FOCO_MAPA: Camera = { x: 800, y: 640, zoom: 1.18 };
// a câmera é limitada à borda da captura, então a ficha fica no terço direito do quadro
const FOCO_FICHA: Camera = { x: ficha.x + ficha.w / 2, y: ficha.y + 280, zoom: 1.75 };
const FOCO_ONIBUS: Camera = { x: fo.x + fo.w / 2, y: fo.y + fo.h / 2, zoom: 2.6 };
// a mesma conta da Tela: a câmera não passa da borda da captura
const naTela = (p: { x: number; y: number }, c: Camera) => {
  const cx = Math.min(Math.max(c.x, 960 / c.zoom), 1920 - 960 / c.zoom);
  const cy = Math.min(Math.max(c.y, 540 / c.zoom), 1080 - 540 / c.zoom);
  return [960 + (p.x - cx) * c.zoom, 540 + (p.y - cy) * c.zoom] as const;
};
// o link "Ver rotas de ônibus a partir daqui", na base do bloco de ônibus da ficha
const LINK = { x: fo.x + 110, y: fo.y + fo.h - 12 };

// 20–25,2 s. O mapa do índice. A câmera aproxima, o cursor escolhe o Meireles, a ficha abre e a
// câmera desce até o tempo de ônibus, que puxa a cena seguinte.
export const Indice: React.FC = () => {
  const frame = useCurrentFrame();
  const camera: [number, Camera][] = [
    [0, { x: 960, y: 540, zoom: 1 }],
    [40, FOCO_MAPA],
    [104, FOCO_MAPA],
    [124, FOCO_FICHA],
    [146, FOCO_ONIBUS],
    [156, { ...FOCO_ONIBUS, zoom: 2.75 }],
  ];
  const [mx, my] = naTela(MEIRELES, FOCO_MAPA);
  const [lx, ly] = naTela(LINK, { ...FOCO_ONIBUS, zoom: 2.7 });
  return (
    <AbsoluteFill>
      <Tela src="telas/03_mapa_indice.png" chaves={camera} />
      <Tela src="telas/04_mapa_meireles.png" chaves={camera} opacidade={interpolate(frame, [100, 108], [0, 1], clamp)} />

      <AbsoluteFill style={{ opacity: interpolate(frame, [8, 26, 86, 100], [0, 1, 1, 0], clamp) }}>
        <Veu lado="esquerda" />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 120 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          <Titulo linhas={["Uma nota", "de 0 a 100"]} entra={16} sai={70} tamanho={116} />
          <Apoio texto="Renda, saneamento e segurança, bairro a bairro." entra={32} sai={74} largura={640} />
        </div>
      </AbsoluteFill>

      <Cursor chaves={[[78, 1260, 820], [100, mx, my], [112, mx + 6, my + 4]]} clique={101} />
      {/* o clique no link de ônibus da ficha puxa a cena seguinte */}
      <Cursor chaves={[[136, lx + 160, ly + 140], [150, lx, ly], [156, lx, ly]]} clique={151} />

      <AbsoluteFill style={{ opacity: interpolate(frame, [116, 132], [0, 1], clamp) }}>
        <Veu lado="baixo" forca={0.85} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 0 120px 120px" }}>
        <Titulo linhas={["Cada bairro, em detalhe."]} entra={118} sai={146} tamanho={96} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
