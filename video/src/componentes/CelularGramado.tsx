import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import celular from "../../public/dados/celular.json";
import { clamp, EASE } from "../tema";

type Ponto = [number, number];

// Transformação projetiva que leva o retângulo largura x altura aos quatro cantos (sup. esq.,
// sup. dir., inf. dir., inf. esq.), em matrix3d. A tela da foto não é um retângulo: o aparelho
// está encostado e um pouco inclinado.
const projetar = (largura: number, altura: number, [p0, p1, p2, p3]: Ponto[]) => {
  const dx1 = p1[0] - p2[0], dx2 = p3[0] - p2[0], dy1 = p1[1] - p2[1], dy2 = p3[1] - p2[1];
  const sx = p0[0] - p1[0] + p2[0] - p3[0], sy = p0[1] - p1[1] + p2[1] - p3[1];
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / det, h = (dx1 * sy - sx * dy1) / det;
  const a = p1[0] - p0[0] + g * p1[0], b = p3[0] - p0[0] + h * p3[0];
  const d = p1[1] - p0[1] + g * p1[1], e = p3[1] - p0[1] + h * p3[1];
  const m = [a / largura, d / largura, 0, g / largura, b / altura, e / altura, 0, h / altura, 0, 0, 1, 0, p0[0], p0[1], 0, 1];
  return `matrix3d(${m.join(",")})`;
};

const dist = (p: Ponto, q: Ponto) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const TELA = celular.tela as Ponto[];
// A tela é desenhada na resolução das capturas (1170 px de largura, DPR 3) e reduzida pela
// projeção, para continuar nítida quando a câmera chega perto.
const TELA_LARG = 1170;
const TELA_ALT = Math.round((TELA_LARG * (dist(TELA[0], TELA[3]) + dist(TELA[1], TELA[2]))) / (dist(TELA[0], TELA[1]) + dist(TELA[3], TELA[2])));
const MATRIZ = projetar(TELA_LARG, TELA_ALT, TELA);
export const CENTRO_TELA: Ponto = [TELA.reduce((s, p) => s + p[0], 0) / 4, TELA.reduce((s, p) => s + p[1], 0) / 4];

export type CameraFoto = { x: number; y: number; zoom: number };

/**
 * A foto do celular no gramado (public/fotos/celular_gramado.jpg, 1920x1440) com as capturas
 * do dashboard na tela. telas: [frame, captura] em frames locais; cada troca é um fade curto.
 * camera: ponto da foto no centro do quadro + zoom, já interpolado pela cena.
 */
export const CelularGramado: React.FC<{ telas: [number, string][]; camera: CameraFoto; desfoque?: number }> = ({ telas, camera, desfoque = 0 }) => {
  const frame = useCurrentFrame();
  const z = Math.max(camera.zoom, 1080 / celular.altura, 1920 / celular.largura);
  // a câmera nunca mostra além da borda da foto
  const cx = Math.min(Math.max(camera.x, 960 / z), celular.largura - 960 / z);
  const cy = Math.min(Math.max(camera.y, 540 / z), celular.altura - 540 / z);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#0b0d26" }}>
      <div
        style={{
          position: "absolute", left: 0, top: 0, width: celular.largura, height: celular.altura,
          transformOrigin: "0 0", translate: `${960 - cx * z}px ${540 - cy * z}px`, scale: `${z}`,
          filter: desfoque > 0.05 ? `blur(${desfoque}px)` : undefined,
        }}
      >
        <Img src={staticFile("fotos/celular_gramado.jpg")} style={{ position: "absolute", width: celular.largura, height: celular.altura }} />
        <div
          style={{
            position: "absolute", left: 0, top: 0, width: TELA_LARG, height: TELA_ALT,
            transformOrigin: "0 0", transform: MATRIZ, borderRadius: 54, overflow: "hidden", background: "#fff",
          }}
        >
          {telas.map(([de, src], k) => (
            <Img
              key={src}
              src={staticFile(src)}
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top",
                opacity: k === 0 ? 1 : interpolate(frame, [de - 2, de + 3], [0, 1], clamp),
              }}
            />
          ))}
          {/* reflexo do vidro e a câmera frontal, como no aparelho da foto */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(118deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 38%)" }} />
          <div style={{ position: "absolute", left: TELA_LARG / 2 - 18, top: 22, width: 36, height: 36, borderRadius: "50%", background: "#0b0b10" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Câmera da entrada: começa colada na tela e recua até mostrar o aparelho no gramado. */
export const recuoDaTela = (frame: number, dur: number): CameraFoto => {
  const p = interpolate(frame, [0, 26], [0, 1], { ...clamp, easing: EASE.entrada });
  const deriva = interpolate(frame, [0, dur], [0, 0.05], clamp);
  return {
    x: interpolate(p, [0, 1], [CENTRO_TELA[0], 960]),
    y: interpolate(p, [0, 1], [CENTRO_TELA[1], 740]),
    zoom: interpolate(p, [0, 1], [1.62, 1]) + deriva,
  };
};
