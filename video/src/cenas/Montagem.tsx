import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Camera, Tela, Veu } from "../componentes/Tela";
import { Titulo } from "../componentes/Texto";
import { BATIDA, clamp, COR, EASE } from "../tema";

type Plano = { src: string; de: Camera; ate: Camera; dur: number; celular?: boolean };

// Um plano por batida (18 frames; os preços ficam duas), cada um com um leve avanço de câmera.
const PLANOS: Plano[] = [
  { src: "telas/10_pesos.png", de: { x: 560, y: 321, zoom: 1.9 }, ate: { x: 620, y: 321, zoom: 2.05 }, dur: BATIDA },
  { src: "telas/07_saneamento.png", de: { x: 760, y: 700, zoom: 1.2 }, ate: { x: 760, y: 700, zoom: 1.3 }, dur: BATIDA },
  { src: "telas/19_camadas.png", de: { x: 760, y: 700, zoom: 1.2 }, ate: { x: 760, y: 700, zoom: 1.3 }, dur: BATIDA },
  { src: "telas/31_linhas_cidade.png", de: { x: 760, y: 700, zoom: 1.25 }, ate: { x: 760, y: 700, zoom: 1.38 }, dur: BATIDA },
  { src: "telas/22_precos.png", de: { x: 900, y: 600, zoom: 1.12 }, ate: { x: 900, y: 600, zoom: 1.26 }, dur: 2 * BATIDA },
  { src: "telas/29_celular_onibus.png", de: { x: 0, y: 0, zoom: 1 }, ate: { x: 0, y: 0, zoom: 1.04 }, dur: BATIDA, celular: true },
  { src: "telas/30_celular_morar.png", de: { x: 0, y: 0, zoom: 1 }, ate: { x: 0, y: 0, zoom: 1.04 }, dur: BATIDA, celular: true },
  { src: "telas/18_celular_mapa.png", de: { x: 0, y: 0, zoom: 1 }, ate: { x: 0, y: 0, zoom: 1.04 }, dur: BATIDA, celular: true },
];
const INICIO = PLANOS.reduce<number[]>((acc, p) => [...acc, acc[acc.length - 1] + p.dur], [0]);

const Celular: React.FC<{ src: string; zoom: number }> = ({ src, zoom }) => (
  <AbsoluteFill style={{ background: `radial-gradient(60% 70% at 50% 45%, #2a31b8 0%, ${COR.noite} 80%)`, justifyContent: "center", alignItems: "center" }}>
    <div
      style={{
        width: 410, height: 888, borderRadius: 56, padding: 12, background: "#0b0d26", scale: `${zoom}`,
        boxShadow: "0 50px 120px rgba(0,0,0,.55), inset 0 0 0 2px rgba(255,255,255,.12)",
      }}
    >
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", borderRadius: 44, objectFit: "cover" }} />
    </div>
  </AbsoluteFill>
);

const PlanoUnico: React.FC<{ p: Plano }> = ({ p }) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, p.dur], [p.de.zoom, p.ate.zoom], { ...clamp, easing: EASE.suave });
  if (p.celular) return <Celular src={p.src} zoom={z} />;
  return <Tela src={p.src} chaves={[[0, p.de], [p.dur, p.ate]]} />;
};

// uma frase por grupo de planos: pesos, camadas, preços e celular
const FRASES = [
  { de: 0, dur: 36, texto: "Ajuste os pesos." },
  { de: 36, dur: 36, texto: "Ligue as camadas." },
  { de: 72, dur: 36, texto: "Compare os preços." },
  { de: 108, dur: 54, texto: "Em qualquer tela." },
];

// 57,6–63 s. Ritmo máximo: cortes na batida.
export const Montagem: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: COR.noite }}>
      {PLANOS.map((p, k) => (
        <Sequence key={p.src} name={`Plano ${k + 1}`} from={INICIO[k]} durationInFrames={p.dur}>
          <PlanoUnico p={p} />
        </Sequence>
      ))}
      {/* respiro de luz a cada corte */}
      <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame % BATIDA, [0, 3], [0.14, 0], clamp) }} />
      <Veu lado="baixo" forca={0.88} />
      {FRASES.map((f) => (
        <Sequence key={f.texto} name={f.texto} from={f.de} durationInFrames={f.dur}>
          <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 0 120px 120px" }}>
            <Titulo linhas={[f.texto]} entra={0} tamanho={104} atraso={0} />
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
