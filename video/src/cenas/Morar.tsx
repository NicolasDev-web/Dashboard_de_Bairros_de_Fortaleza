import React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import medidas from "../../public/dados/medidas.json";
import { Clarao } from "../componentes/Cinema";
import { Camera, Tela, Veu } from "../componentes/Tela";
import { Rotulo, Titulo } from "../componentes/Texto";
import { BATIDA, clamp, COR, EASE } from "../tema";

// As perguntas respondidas, uma a cada duas batidas. A captura vira duas camadas: a pergunta
// (esquerda) e a cidade (direita), cada uma com a sua câmera, para dar paralaxe.
const PERGUNTAS = ["telas/24b_morar_trajeto.png", "telas/25_morar_seguranca.png", "telas/26_morar_saude.png"];
const DUR_P = 2 * BATIDA; // 36 frames por pergunta
const CORTE_X = 900; // a pergunta acaba antes daqui e a cidade começa depois (fundo liso no meio)
const MERGULHO = 3 * DUR_P; // 108: a câmera entra nos pixels da cidade
const RESULTADO = MERGULHO + 30; // 138
const CARDS = 196;

const { card, card_onibus: linha } = medidas.morar;

const Pergunta: React.FC<{ src: string; k: number }> = ({ src, k }) => {
  const frame = useCurrentFrame(); // local à pergunta
  // pergunta: entra de baixo, como no questionário, e anda pouco (plano de trás)
  const entra = k === 0 ? 1 : interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: EASE.entrada });
  const sai = k === PERGUNTAS.length - 1 ? 0 : interpolate(frame, [DUR_P - 6, DUR_P], [0, 1], { ...clamp, easing: EASE.saida });
  const cam = (x: number, z0: number, z1: number): [number, Camera][] => [[0, { x, y: 540, zoom: z0 }], [DUR_P, { x, y: 540, zoom: z1 }]];
  return (
    <AbsoluteFill>
      {/* cidade: troca no mesmo lugar (dissolve) e avança mais (plano da frente) */}
      <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${CORTE_X}px)`, opacity: k === 0 ? 1 : interpolate(frame, [0, 10], [0, 1], clamp) }}>
        <Tela src={src} chaves={cam(960 + k * 6, 1.02 + k * 0.035, 1.055 + k * 0.035)} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          clipPath: `inset(0 ${1920 - CORTE_X}px 0 0)`,
          opacity: entra * (1 - sai),
          translate: `0 ${(1 - entra) * 60 - sai * 60}px`,
        }}
      >
        <Tela src={src} chaves={cam(960, 1.0, 1.012)} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Morar: React.FC = () => {
  const frame = useCurrentFrame();
  // mergulho nos pixels: a última pergunta acelera para dentro da cidade
  const mergulho = interpolate(frame, [MERGULHO, RESULTADO], [0, 1], { ...clamp, easing: EASE.saida });
  const camResultado: [number, Camera][] = [
    [RESULTADO, { x: 740, y: 380, zoom: 1.3 }],
    [RESULTADO + 26, { x: 760, y: 470, zoom: 1.08 }],
    [CARDS - 4, { x: 1000, y: 560, zoom: 1.04 }],
  ];
  const fx = card.x + card.w / 2, fy = linha.y + 8;
  const camCards: [number, Camera][] = [
    [CARDS, { x: 1300, y: 500, zoom: 1.15 }],
    [CARDS + 34, { x: fx, y: fy, zoom: 1.7 }],
    [270, { x: fx, y: fy, zoom: 1.8 }],
  ];
  return (
    <AbsoluteFill style={{ background: COR.cobaltoFundo }}>
      {PERGUNTAS.map((src, k) => (
        <Sequence key={src} from={k * DUR_P} durationInFrames={k === PERGUNTAS.length - 1 ? RESULTADO - k * DUR_P : DUR_P + 10} layout="none">
          <AbsoluteFill style={k === PERGUNTAS.length - 1 ? { scale: `${interpolate(mergulho, [0, 1], [1, 5.5])}`, transformOrigin: "1400px 520px", opacity: 1 - mergulho * 0.8 } : undefined}>
            {k === PERGUNTAS.length - 1 && frame >= MERGULHO - 2 ? (
              <CameraMotionBlur shutterAngle={220} samples={6}><Pergunta src={src} k={k} /></CameraMotionBlur>
            ) : (
              <Pergunta src={src} k={k} />
            )}
          </AbsoluteFill>
        </Sequence>
      ))}
      <div style={{ position: "absolute", left: 120, top: 1000, opacity: interpolate(frame, [6, 18, MERGULHO - 6, MERGULHO], [0, 1, 1, 0], clamp) }}>
        <Rotulo texto="Onde morar · 10 perguntas, a cidade responde" entra={6} tamanho={26} />
      </div>

      {/* resultado: o título da página, o mapa e os cards */}
      <AbsoluteFill style={{ opacity: interpolate(frame, [RESULTADO - 4, RESULTADO + 4], [0, 1], clamp) }}>
        <Tela src="telas/27_morar_resultado.png" chaves={camResultado} />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: interpolate(frame, [CARDS - 6, CARDS + 6], [0, 1], clamp) }}>
        <Tela src="telas/28_morar_cards.png" chaves={camCards} />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: interpolate(frame, [CARDS + 20, CARDS + 36], [0, 1], clamp) }}>
        <Veu lado="esquerda" forca={0.92} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 120 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <Rotulo texto="Onde morar" entra={CARDS + 24} />
          <Titulo linhas={["Os bairros que cabem", "no seu bolso, perto", "de onde você vai."]} entra={CARDS + 28} tamanho={74} />
        </div>
      </AbsoluteFill>

      <Clarao em={0} dur={10} forca={0.35} />
      <Clarao em={RESULTADO} dur={12} forca={0.7} />
      {[DUR_P, 2 * DUR_P].map((f) => <Clarao key={f} em={f} dur={5} forca={0.12} />)}
    </AbsoluteFill>
  );
};
