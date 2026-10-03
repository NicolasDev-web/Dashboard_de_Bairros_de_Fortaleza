import React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { Grao, Vinheta } from "./componentes/Atmosfera";
import { Abertura } from "./cenas/Abertura";
import { Encerramento } from "./cenas/Encerramento";
import { Evolucao } from "./cenas/Evolucao";
import { Indice } from "./cenas/Indice";
import { Mergulho } from "./cenas/Mergulho";
import { Montagem } from "./cenas/Montagem";
import { Revelacao } from "./cenas/Revelacao";
import { Rotas } from "./cenas/Rotas";
import { Tempo } from "./cenas/Tempo";
import { CENAS, clamp, DURACAO } from "./tema";

// Efeitos sonoros e o frame em que tocam. A trilha já traz as seções nesses marcos
// (ver video/README.md, "Pontos de sincronia").
const EFEITOS: { nome: string; arquivo: string; frame: number; volume: number }[] = [
  { nome: "Subida para a revelação", arquivo: "audio/riser.wav", frame: CENAS.revelacao.de - 72, volume: 0.45 },
  { nome: "Impacto: revelação", arquivo: "audio/impacto.wav", frame: CENAS.revelacao.de, volume: 0.8 },
  { nome: "Whoosh: entra na interface", arquivo: "audio/whoosh.wav", frame: CENAS.mergulho.de + 50, volume: 0.5 },
  { nome: "Clique no Meireles", arquivo: "audio/clique.wav", frame: CENAS.indice.de + 121, volume: 0.55 },
  { nome: "Whoosh: 2010 para 2022", arquivo: "audio/whoosh.wav", frame: CENAS.tempo.de + 74, volume: 0.45 },
  { nome: "Whoosh: mergulho na orla", arquivo: "audio/whoosh.wav", frame: CENAS.rotas.de + 96, volume: 0.5 },
  { nome: "Subida para o final", arquivo: "audio/riser.wav", frame: CENAS.encerramento.de - 72, volume: 0.5 },
  { nome: "Impacto: encerramento", arquivo: "audio/impacto.wav", frame: CENAS.encerramento.de, volume: 0.85 },
  { nome: "Clique: botão final", arquivo: "audio/clique.wav", frame: CENAS.encerramento.de + 118, volume: 0.35 },
];

export const Lancamento: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#0a0c2c" }}>
      <Sequence name="Abertura" from={CENAS.abertura.de} durationInFrames={CENAS.abertura.dur}><Abertura /></Sequence>
      <Sequence name="Revelação" from={CENAS.revelacao.de} durationInFrames={CENAS.revelacao.dur}><Revelacao /></Sequence>
      <Sequence name="Mergulho na interface" from={CENAS.mergulho.de} durationInFrames={CENAS.mergulho.dur}><Mergulho /></Sequence>
      <Sequence name="Índice" from={CENAS.indice.de} durationInFrames={CENAS.indice.dur}><Indice /></Sequence>
      <Sequence name="2010 → 2022" from={CENAS.tempo.de} durationInFrames={CENAS.tempo.dur}><Tempo /></Sequence>
      <Sequence name="Evolução" from={CENAS.evolucao.de} durationInFrames={CENAS.evolucao.dur}><Evolucao /></Sequence>
      <Sequence name="Rotas" from={CENAS.rotas.de} durationInFrames={CENAS.rotas.dur}><Rotas /></Sequence>
      <Sequence name="Montagem" from={CENAS.montagem.de} durationInFrames={CENAS.montagem.dur}><Montagem /></Sequence>
      <Sequence name="Encerramento" from={CENAS.encerramento.de} durationInFrames={CENAS.encerramento.dur}><Encerramento /></Sequence>

      <Vinheta forca={0.3} />
      <Grao intensidade={0.07} />

      <Audio
        src={staticFile("audio/trilha.wav")}
        volume={(f) => interpolate(f, [0, 20, DURACAO - 30, DURACAO], [0, 0.9, 0.9, 0.6], clamp)}
      />
      {EFEITOS.map((e) => (
        <Sequence key={e.nome} name={`Som: ${e.nome}`} from={e.frame} layout="none">
          <Audio src={staticFile(e.arquivo)} volume={e.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
