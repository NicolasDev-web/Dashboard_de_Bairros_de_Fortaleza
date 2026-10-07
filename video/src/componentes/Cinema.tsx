import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { clamp, EASE } from "../tema";

/**
 * Palco com perspectiva: o conteúdo é um plano no espaço 3D, e a câmera orbita, inclina e
 * avança sobre ele. Os valores chegam já interpolados pela cena.
 */
export const Palco3D: React.FC<{
  largura: number;
  altura: number;
  inclinar?: number; // rotateX em graus (0 = plano de frente)
  girar?: number; // rotateZ em graus
  guinar?: number; // rotateY em graus
  zoom?: number;
  foco?: [number, number]; // ponto do plano que fica no centro do quadro
  profundidade?: number; // translateZ (px), negativo afasta
  perspectiva?: number;
  centro?: [number, number]; // onde, no quadro, fica o foco
  children: React.ReactNode;
}> = ({ largura, altura, inclinar = 0, girar = 0, guinar = 0, zoom = 1, foco, profundidade = 0, perspectiva = 2200, centro = [960, 540], children }) => {
  const [fx, fy] = foco ?? [largura / 2, altura / 2];
  return (
    <AbsoluteFill style={{ perspective: perspectiva, perspectiveOrigin: `${centro[0]}px ${centro[1]}px` }}>
      <div
        style={{
          position: "absolute", left: centro[0] - fx, top: centro[1] - fy, width: largura, height: altura,
          transformOrigin: `${fx}px ${fy}px`,
          transform: `translateZ(${profundidade}px) rotateX(${inclinar}deg) rotateY(${guinar}deg) rotateZ(${girar}deg) scale(${zoom})`,
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Pixels soltos fora de foco, em camadas de profundidade: os mais próximos são maiores, mais
 * borrados e andam mais rápido (paralaxe). deriva: deslocamento da câmera em px.
 */
export const Particulas: React.FC<{ n?: number; semente?: string; deriva?: [number, number]; opacidade?: number; cor?: string }> = ({
  n = 46, semente = "p", deriva = [0, 0], opacidade = 1, cor = "#ffffff",
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: opacidade, overflow: "hidden" }}>
      {Array.from({ length: n }, (_, k) => {
        const z = random(`${semente}z${k}`); // 0 = longe, 1 = perto
        const tam = 6 + z * z * 54;
        const borrar = z < 0.35 ? 0 : (z - 0.35) * 26;
        const vel = 0.2 + z * 1.4;
        const x = ((random(`${semente}x${k}`) * 2400 - 240 + deriva[0] * vel + frame * vel * 0.6) % 2400 + 2400) % 2400 - 240;
        const y = random(`${semente}y${k}`) * 1300 - 110 + deriva[1] * vel + Math.sin(frame / 40 + k) * 10 * vel;
        const alfa = (0.08 + 0.22 * random(`${semente}a${k}`)) * (z < 0.35 ? 0.7 : 1);
        return (
          <div key={k} style={{ position: "absolute", left: x, top: y, width: tam, height: tam, background: cor, opacity: alfa, filter: borrar ? `blur(${borrar}px)` : undefined }} />
        );
      })}
    </AbsoluteFill>
  );
};

/** Faixa de luz diagonal que atravessa o quadro entre dois frames (brilho de lente). */
export const LuzVarre: React.FC<{ de: number; ate: number; forca?: number; angulo?: number }> = ({ de, ate, forca = 0.35, angulo = 112 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [de, ate], [-0.4, 1.4], { ...clamp, easing: EASE.suave });
  if (frame < de || frame > ate) return null;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none", mixBlendMode: "screen",
        background: `linear-gradient(${angulo}deg, transparent ${p * 100 - 18}%, rgba(255,255,255,${forca}) ${p * 100}%, transparent ${p * 100 + 18}%)`,
      }}
    />
  );
};

/** Clarão curto (corte na batida, impacto). */
export const Clarao: React.FC<{ em: number; dur?: number; forca?: number; cor?: string }> = ({ em, dur = 10, forca = 0.6, cor = "255,255,255" }) => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [em - 2, em, em + dur], [0, forca, 0], clamp);
  return a > 0 ? <AbsoluteFill style={{ pointerEvents: "none", background: `rgba(${cor},${a})` }} /> : null;
};
