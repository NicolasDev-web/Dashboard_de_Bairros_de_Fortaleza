import React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { Grao, Vinheta } from "./componentes/Atmosfera";
import { Abertura } from "./cenas/Abertura";
import { Diretas } from "./cenas/Diretas";
import { Encerramento } from "./cenas/Encerramento";
import { Evolucao } from "./cenas/Evolucao";
import { Indice } from "./cenas/Indice";
import { Mergulho } from "./cenas/Mergulho";
import { Montagem } from "./cenas/Montagem";
import { DUR_P, Morar } from "./cenas/Morar";
import { MARCOS_ONIBUS, Onibus } from "./cenas/Onibus";
import { Rede } from "./cenas/Rede";
import { Revelacao } from "./cenas/Revelacao";
import { CENAS, clamp, DURACAO } from "./tema";

// Efeitos sonoros e o frame em que tocam. A trilha já traz as seções nesses marcos
// (ver video/README.md, "Pontos de sincronia").
const EFEITOS: { nome: string; arquivo: string; frame: number; volume: number }[] = [
  { nome: "Subida para a revelação", arquivo: "audio/riser.wav", frame: CENAS.revelacao.de - 72, volume: 0.45 },
  { nome: "Impacto: revelação", arquivo: "audio/impacto.wav", frame: CENAS.revelacao.de, volume: 0.8 },
  { nome: "Whoosh: entra na interface", arquivo: "audio/whoosh.wav", frame: CENAS.mergulho.de + 50, volume: 0.5 },
  { nome: "Clique no Meireles", arquivo: "audio/clique.wav", frame: CENAS.indice.de + 101, volume: 0.55 },
  { nome: "Whoosh: para a noite do ônibus", arquivo: "audio/whoosh.wav", frame: CENAS.onibus.de - 8, volume: 0.55 },
  { nome: "Whoosh: voo até o Bom Jardim", arquivo: "audio/whoosh.wav", frame: CENAS.onibus.de + MARCOS_ONIBUS.voo, volume: 0.5 },
  ...MARCOS_ONIBUS.selos.map((f, k) => ({ nome: `Selo da linha ${k + 1}`, arquivo: "audio/pop.wav", frame: CENAS.onibus.de + f, volume: 0.45 })),
  { nome: "Whoosh: volta para a tela", arquivo: "audio/whoosh.wav", frame: CENAS.onibus.de + MARCOS_ONIBUS.saida - 6, volume: 0.4 },
  { nome: "Whoosh: a rede de linhas", arquivo: "audio/whoosh.wav", frame: CENAS.rede.de - 6, volume: 0.45 },
  { nome: "Selo da linha em destaque", arquivo: "audio/pop.wav", frame: CENAS.rede.de + 140, volume: 0.5 },
  { nome: "Whoosh: para o painel", arquivo: "audio/whoosh.wav", frame: CENAS.rede.de + 154, volume: 0.4 },
  { nome: "Clique na parada", arquivo: "audio/clique.wav", frame: CENAS.rede.de + 186, volume: 0.5 },
  { nome: "Clique na linha direta", arquivo: "audio/clique.wav", frame: CENAS.diretas.de + 54, volume: 0.5 },
  { nome: "Whoosh: mapa do trajeto", arquivo: "audio/whoosh.wav", frame: CENAS.diretas.de + 64, volume: 0.35 },
  ...[0, 1, 2].map((k) => ({ nome: `Resposta ${k + 1}`, arquivo: "audio/clique.wav", frame: CENAS.morar.de + k * DUR_P, volume: 0.45 })),
  { nome: "Whoosh: mergulho nos pixels", arquivo: "audio/whoosh.wav", frame: CENAS.morar.de + 3 * DUR_P - 8, volume: 0.55 },
  { nome: "Subida para o final", arquivo: "audio/riser.wav", frame: CENAS.encerramento.de - 72, volume: 0.5 },
  { nome: "Impacto: encerramento", arquivo: "audio/impacto.wav", frame: CENAS.encerramento.de, volume: 0.85 },
  { nome: "Clique: botão final", arquivo: "audio/clique.wav", frame: CENAS.encerramento.de + 118, volume: 0.35 },
];

const CENA: [keyof typeof CENAS, string, React.FC][] = [
  ["abertura", "Abertura", Abertura],
  ["revelacao", "Revelação", Revelacao],
  ["mergulho", "Mergulho na interface", Mergulho],
  ["indice", "Índice", Indice],
  ["onibus", "Ônibus", Onibus],
  ["rede", "Rede de linhas", Rede],
  ["diretas", "Linhas diretas", Diretas],
  ["morar", "Onde morar", Morar],
  ["evolucao", "Evolução", Evolucao],
  ["montagem", "Montagem", Montagem],
  ["encerramento", "Encerramento", Encerramento],
];

export const Lancamento: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#0a0c2c" }}>
      {CENA.map(([id, nome, C]) => (
        <Sequence key={id} name={nome} from={CENAS[id].de} durationInFrames={CENAS[id].dur}><C /></Sequence>
      ))}

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
