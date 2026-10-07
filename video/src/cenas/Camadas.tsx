import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import camadas from "../../public/dados/camadas.json";
import medidas from "../../public/dados/medidas.json";
import { Camera, Tela, Veu } from "../componentes/Tela";
import { Rotulo, Titulo } from "../componentes/Texto";
import { clamp, COR, EASE, SANS } from "../tema";

// O mapa do índice; as praças (URBIFOR) e os hospitais se espalham a partir do Centro, numa
// onda circular, e a câmera desce até o Centro, onde as praças viram polígonos.
const C = medidas.camadas.centro; // Centro na captura (onde a onda começa)
const ONDA = [10, 64] as const;
const DESCE = 84;

// amostras como na legenda do dashboard: praça = ponto verde; hospital = quadrado branco com cruz
const AmostraPraca = () => <span style={{ width: 24, height: 24, background: "#138a5e", borderRadius: 12, border: "2px solid #fff", translate: "0 -10px" }} />;
const AmostraHospital = () => (
  <span style={{ position: "relative", width: 26, height: 26, background: "#fff", borderRadius: 3, translate: "0 -10px" }}>
    <span style={{ position: "absolute", left: 5, top: 11, width: 16, height: 4, background: COR.cobaltoEscuro }} />
    <span style={{ position: "absolute", left: 11, top: 5, width: 4, height: 16, background: COR.cobaltoEscuro }} />
  </span>
);

const Numero: React.FC<{ valor: number; rotulo: string; entra: number; amostra: React.ReactNode }> = ({ valor, rotulo, entra, amostra }) => {
  const frame = useCurrentFrame();
  const n = Math.round(interpolate(frame, [entra, entra + 44], [0, valor], { ...clamp, easing: EASE.suave }));
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 18, opacity: interpolate(frame, [entra, entra + 8], [0, 1], clamp) }}>
      {amostra}
      <span style={{ fontFamily: SANS, fontSize: 120, fontWeight: 400, letterSpacing: "-0.05em", lineHeight: 0.9, color: "#fff", fontVariantNumeric: "tabular-nums", minWidth: 220 }}>{n}</span>
      <span style={{ fontFamily: SANS, fontSize: 40, color: "rgba(255,255,255,.85)" }}>{rotulo}</span>
    </div>
  );
};

export const Camadas: React.FC = () => {
  const frame = useCurrentFrame();
  const raio = interpolate(frame, ONDA, [0, 1500], { ...clamp, easing: EASE.suave });
  const cam: [number, Camera][] = [
    [0, { x: 760, y: 700, zoom: 1.08 }],
    [DESCE - 4, { x: 760, y: 690, zoom: 1.16 }],
  ];
  const camCentro: [number, Camera][] = [
    [DESCE, { x: 760, y: 700, zoom: 1.6 }],
    [144, { x: 780, y: 690, zoom: 1.2 }],
  ];
  return (
    <AbsoluteFill style={{ background: COR.papel }}>
      <Tela src="telas/03_mapa_indice.png" chaves={cam} />
      {/* a onda revela a captura com as camadas ligadas */}
      <AbsoluteFill style={{ clipPath: `circle(${raio}px at ${960 + (C.x - 760) * 1.1}px ${540 + (C.y - 700) * 1.1}px)` }}>
        <Tela src="telas/19_camadas.png" chaves={cam} />
      </AbsoluteFill>
      {/* frente da onda */}
      <div
        style={{
          position: "absolute", left: 960 + (C.x - 760) * 1.1 - raio, top: 540 + (C.y - 700) * 1.1 - raio, width: raio * 2, height: raio * 2,
          borderRadius: "50%", border: "3px solid rgba(255,255,255,.9)", boxShadow: "0 0 40px 10px rgba(255,255,255,.35)",
          opacity: interpolate(frame, [ONDA[0], ONDA[0] + 6, ONDA[1] - 10, ONDA[1]], [0, 1, 1, 0], clamp),
        }}
      />
      <AbsoluteFill style={{ opacity: interpolate(frame, [DESCE - 4, DESCE + 12], [0, 1], { ...clamp, easing: EASE.suave }) }}>
        <Tela src="telas/19b_camadas_centro.png" chaves={camCentro} />
      </AbsoluteFill>

      <Veu lado="esquerda" forca={0.88} />
      <div style={{ position: "absolute", left: 120, top: 170, display: "flex", flexDirection: "column", gap: 36 }}>
        <Rotulo texto="Camadas do mapa" entra={6} />
        <Titulo linhas={["Praças e", "hospitais"]} entra={10} tamanho={112} />
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 30 }}>
          <Numero valor={camadas.pracas.length} rotulo="praças (URBIFOR)" entra={24} amostra={<AmostraPraca />} />
          <Numero valor={camadas.hospitais.length} rotulo="hospitais (OSM)" entra={40} amostra={<AmostraHospital />} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
