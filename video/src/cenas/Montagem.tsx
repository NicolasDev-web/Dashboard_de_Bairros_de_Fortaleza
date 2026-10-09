import React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { CelularGramado, recuoDaTela } from "../componentes/CelularGramado";
import { Camera, Tela, Veu } from "../componentes/Tela";
import { Titulo } from "../componentes/Texto";
import { BATIDA, clamp, COR, EASE } from "../tema";

type Plano = { src: string; de: Camera; ate: Camera; batidas?: number };

// Um plano por batida (18 frames), cada um com um leve avanço de câmera.
const ANTES: Plano[] = [
  { src: "telas/10_pesos.png", de: { x: 560, y: 321, zoom: 1.9 }, ate: { x: 620, y: 321, zoom: 2.05 } },
  { src: "telas/07_saneamento.png", de: { x: 760, y: 700, zoom: 1.2 }, ate: { x: 760, y: 700, zoom: 1.3 } },
  { src: "telas/22_precos.png", de: { x: 900, y: 600, zoom: 1.12 }, ate: { x: 900, y: 600, zoom: 1.22 } },
  { src: "telas/08_seguranca.png", de: { x: 760, y: 700, zoom: 1.2 }, ate: { x: 760, y: 700, zoom: 1.3 } },
];
const DEPOIS: Plano[] = [
  { src: "telas/15_metodo.png", de: { x: 960, y: 560, zoom: 1.1 }, ate: { x: 960, y: 560, zoom: 1.24 }, batidas: 2 },
];

// O celular: um plano só, na foto do aparelho no gramado, com as telas trocando na batida.
const CELULAR = { de: ANTES.length * BATIDA, dur: 3 * BATIDA };
const TELAS_CELULAR: [number, string][] = [
  [0, "telas/17_celular_hero.png"],
  [BATIDA, "telas/18_celular_mapa.png"],
  [2 * BATIDA, "telas/29_celular_onibus.png"],
];

const PlanoUnico: React.FC<{ p: Plano }> = ({ p }) => (
  <Tela src={p.src} chaves={[[0, p.de], [(p.batidas ?? 1) * BATIDA, p.ate]]} />
);

const PlanoCelular: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <CelularGramado
        telas={TELAS_CELULAR}
        camera={recuoDaTela(frame, CELULAR.dur)}
        desfoque={interpolate(frame, [0, 10], [5, 0], { ...clamp, easing: EASE.suave })}
      />
      {/* a frase fica no céu da foto, acima do aparelho */}
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 58 }}>
        <Titulo linhas={["Fortaleza inteira", "na palma da sua mão!"]} entra={4} tamanho={96} cor={COR.tinta} alinhar="center" />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// uma frase por grupo de planos: pesos e mapas, preços, celular e o fecho com o método
const FRASES = [
  { de: 0, dur: 2 * BATIDA, texto: "Ajuste os pesos." },
  { de: 2 * BATIDA, dur: 2 * BATIDA, texto: "Compare os preços." },
  { de: CELULAR.de + CELULAR.dur, dur: 2 * BATIDA, texto: "Com dados públicos." },
];
// cortes: os planos de antes, o celular e os de depois, em sequência
const PLANOS: { de: number; dur: number; c: React.ReactNode; nome: string }[] = [
  ...ANTES.map((p, k) => ({ de: k * BATIDA, dur: BATIDA, c: <PlanoUnico p={p} />, nome: p.src })),
  { ...CELULAR, c: <PlanoCelular />, nome: "Celular no gramado" },
  ...DEPOIS.map((p, k) => ({ de: CELULAR.de + CELULAR.dur + k * BATIDA, dur: (p.batidas ?? 1) * BATIDA, c: <PlanoUnico p={p} />, nome: p.src })),
];
const CORTES = PLANOS.map((p) => p.de);

// 65,4–70,8 s. Ritmo máximo: cortes na batida; o celular segura três batidas num plano só.
export const Montagem: React.FC = () => {
  const frame = useCurrentFrame();
  const ultimoCorte = Math.max(...CORTES.filter((c) => c <= frame));
  const noCelular = frame >= CELULAR.de && frame < CELULAR.de + CELULAR.dur;
  return (
    <AbsoluteFill style={{ background: COR.noite }}>
      {PLANOS.map((p, k) => (
        <Sequence key={p.nome} name={`Plano ${k + 1}: ${p.nome}`} from={p.de} durationInFrames={p.dur}>
          {p.c}
        </Sequence>
      ))}
      {/* respiro de luz a cada corte */}
      <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame - ultimoCorte, [0, 3], [0.14, 0], clamp) }} />
      {!noCelular && <Veu lado="baixo" forca={0.88} />}
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
