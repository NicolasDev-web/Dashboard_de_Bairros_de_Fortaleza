import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import medidas from "../../public/dados/medidas.json";
import { Clarao } from "../componentes/Cinema";
import { Camera, Cursor, Tela, Veu } from "../componentes/Tela";
import { Apoio, Rotulo, Titulo } from "../componentes/Texto";
import { clamp } from "../tema";

// As linhas diretas do "Quanto tempo de ônibus": a câmera desce até a caixa, o cursor escolhe
// uma linha e o mapa do trajeto mostra por onde ela passa.
const { caixa, selo } = medidas.diretas;
const CLIQUE = 54;
const MAPA = 70; // corte para o mapa do trajeto

const naTela = (p: { x: number; y: number }, c: Camera) => {
  const cx = Math.min(Math.max(c.x, 960 / c.zoom), 1920 - 960 / c.zoom);
  const cy = Math.min(Math.max(c.y, 540 / c.zoom), 1080 - 540 / c.zoom);
  return [960 + (p.x - cx) * c.zoom, 540 + (p.y - cy) * c.zoom] as const;
};

export const Diretas: React.FC = () => {
  const frame = useCurrentFrame();
  const cxCaixa = caixa.x + caixa.w / 2, cyCaixa = caixa.y + caixa.h / 2;
  const NA_CAIXA: Camera = { x: cxCaixa, y: cyCaixa, zoom: 2.3 };
  const cam: [number, Camera][] = [
    [0, { x: cxCaixa + 120, y: cyCaixa - 160, zoom: 1.5 }],
    [34, NA_CAIXA],
    [MAPA, { ...NA_CAIXA, zoom: 2.4 }],
  ];
  const camMapa: [number, Camera][] = [
    [MAPA, { x: 1200, y: 400, zoom: 1.5 }],
    [126, { x: 1180, y: 410, zoom: 1.3 }],
  ];
  const s = { x: selo.x + selo.w / 2, y: selo.y + selo.h / 2 };
  const [sx, sy] = naTela(s, { ...NA_CAIXA, zoom: 2.33 });
  const noMapa = interpolate(frame, [MAPA - 4, MAPA + 6], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#ececf2" }}>
      <Tela src="telas/32_diretas.png" chaves={cam} />
      <Cursor chaves={[[20, sx + 300, sy + 200], [CLIQUE - 2, sx, sy], [MAPA - 6, sx + 3, sy + 3]]} clique={CLIQUE} />
      {/* o texto à direita da caixa */}
      <AbsoluteFill
        style={{
          opacity: interpolate(frame, [4, 20, MAPA - 6, MAPA], [0, 1, 1, 0], clamp),
          background: "linear-gradient(270deg, rgba(10,12,44,.9) 0%, rgba(10,12,44,.82) 34%, rgba(10,12,44,0) 60%)",
        }}
      />
      <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "center", paddingRight: 120 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28, width: 700 }}>
          <Rotulo texto="Sem baldeação" entra={8} sai={MAPA - 10} />
          <Titulo linhas={["Linhas diretas,", "no sentido", "da sua viagem."]} entra={10} sai={MAPA - 10} tamanho={92} />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ opacity: noMapa }}>
        <Tela src="telas/32c_diretas_mapa.png" chaves={camMapa} />
        <Veu lado="baixo" forca={0.85} />
        <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 0 110px 120px" }}>
          <Apoio texto="Clique numa linha e veja o trajeto dela no mapa." entra={MAPA + 6} tamanho={56} largura={1200} cor="#fff" />
        </AbsoluteFill>
      </AbsoluteFill>
      <Clarao em={MAPA} dur={8} forca={0.3} />
    </AbsoluteFill>
  );
};
