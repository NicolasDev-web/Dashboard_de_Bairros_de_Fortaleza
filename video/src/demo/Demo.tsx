import React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { Escurece, Gravacao, Legenda } from "./componentes";
import { DURACAO_DEMO, EFEITOS, LEGENDAS, PLANOS, SECAO } from "./edicao";
import { clamp, COR, EASE, MONO, SANS } from "../tema";

// Demo do produto: a aplicação real, gravada quadro a quadro (scripts/demo/gravar.mjs), montada
// em planos com câmera leve, legendas curtas e a trilha da demo. 1920x1080, 60 fps.
export const Demo: React.FC = () => (
  <AbsoluteFill style={{ background: COR.noite }}>
    {PLANOS.map((p) => (
      <Sequence key={p.nome} name={p.nome} from={p.inicio} durationInFrames={p.dur}>
        <Funde entra={p.funde ?? 0}>
          <Gravacao clip={p.clip} de={p.de} vel={p.vel} chaves={p.chaves} />
        </Funde>
      </Sequence>
    ))}
    {LEGENDAS.map((l, k) => (
      <Sequence key={k} name={`Legenda: ${l.texto}`} from={l.em} durationInFrames={l.dur}>
        <Legenda texto={l.texto} sub={l.sub} dur={l.dur} lugar={l.lugar} tamanho={l.tamanho} clara={l.clara} />
      </Sequence>
    ))}
    <Sequence name="Encerramento" from={SECAO.encerramento} durationInFrames={DURACAO_DEMO - SECAO.encerramento}>
      <Fecho />
    </Sequence>
    <Abre />
    <Audio src={staticFile("audio/trilha_demo.wav")} volume={(f) => interpolate(f, [DURACAO_DEMO - 70, DURACAO_DEMO], [1, 0], clamp)} />
    {EFEITOS.map((e, k) => (
      <Sequence key={k} name={`Som: ${e.nome}`} from={e.frame} durationInFrames={Math.min(240, DURACAO_DEMO - e.frame)}>
        <Audio src={staticFile(e.arquivo)} volume={e.volume} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

/** O plano entra fundindo com o anterior (só onde a edição pede; o resto é corte seco). */
const Funde: React.FC<{ entra: number; children: React.ReactNode }> = ({ entra, children }) => {
  const frame = useCurrentFrame();
  const o = entra ? interpolate(frame, [0, entra], [0, 1], { ...clamp, easing: EASE.suave }) : 1;
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

/** Primeiros quadros: sai do escuro para o hero. */
const Abre: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 22], [1, 0], { ...clamp, easing: EASE.suave });
  return o > 0 ? <AbsoluteFill style={{ background: COR.noite, opacity: o, pointerEvents: "none" }} /> : null;
};

/**
 * Fecho sobre a cidade em pixels (o plano "encerramento" da gravação): escurece de leve,
 * um véu cobalto à esquerda dá leitura ao texto, e o filme termina num fade.
 */
const Fecho: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = DURACAO_DEMO - SECAO.encerramento;
  const sobe = (de: number) => ({
    opacity: interpolate(frame, [de, de + 22], [0, 1], { ...clamp, easing: EASE.suave }),
    translate: `0 ${interpolate(frame, [de, de + 30], [22, 0], { ...clamp, easing: EASE.entrada })}px`,
  });
  const veu = interpolate(frame, [0, 40], [0, 1], { ...clamp, easing: EASE.suave });
  const sai = interpolate(frame, [dur - 50, dur - 4], [0, 1], { ...clamp, easing: EASE.suave });
  return (
    <AbsoluteFill>
      <Escurece de={0} ate={dur} forca={0.16} dur={40} />
      <AbsoluteFill
        style={{
          opacity: veu,
          background: "linear-gradient(90deg, rgb(31,37,153) 0%, rgb(31,37,153) 40%, rgba(31,37,153,0) 66%)",
        }}
      />
      <div style={{ position: "absolute", left: 120, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", color: "#fff", width: 860 }}>
        <div style={{ ...sobe(18), fontFamily: MONO, fontSize: 22, letterSpacing: "0.04em", opacity: 0.8 * (sobe(18).opacity as number), display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ display: "inline-flex", gap: 4 }}>
            <span style={{ width: 12, height: 11, background: "#fff" }} />
            <span style={{ width: 5, height: 11, background: "#fff" }} />
          </span>
          121 bairros · dados públicos
        </div>
        <div style={{ ...sobe(26), fontFamily: SANS, fontSize: 104, fontWeight: 420, letterSpacing: "-0.045em", lineHeight: 0.98, marginTop: 26 }}>
          Bairros de<br />Fortaleza
        </div>
        <div style={{ ...sobe(56), fontFamily: SANS, fontSize: 38, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.25, marginTop: 34, color: "rgba(255,255,255,.9)" }}>
          Dados para entender a cidade.<br />Uma experiência para encontrar seu lugar nela.
        </div>
        <div style={{ ...sobe(96), fontFamily: SANS, fontSize: 24, marginTop: 56, color: "rgba(255,255,255,.78)" }}>
          Projeto desenvolvido por Nicolas dos Santos Xavier
        </div>
        <div style={{ ...sobe(110), fontFamily: MONO, fontSize: 22, marginTop: 12, color: COR.tintaClara }}>dashboardfortaleza.vercel.app</div>
      </div>
      <AbsoluteFill style={{ background: COR.noite, opacity: sai }} />
    </AbsoluteFill>
  );
};
