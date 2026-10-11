import React from "react";
import { Composition } from "remotion";
import { Lancamento } from "./Lancamento";
import { Capa } from "./demo/Capa";
import { Demo } from "./demo/Demo";
import { DURACAO_DEMO } from "./demo/edicao";
import { DURACAO, FPS } from "./tema";

// Filme de lançamento: 1920x1080, 30 fps, 78 s. A capa é o último frame (ver README).
// Demo do produto: a aplicação real gravada quadro a quadro, 1920x1080 a 60 fps (ver ROTEIRO_DEMO.md).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Lancamento" component={Lancamento} durationInFrames={DURACAO} fps={FPS} width={1920} height={1080} />
    <Composition id="Demo" component={Demo} durationInFrames={DURACAO_DEMO} fps={60} width={1920} height={1080} />
    <Composition id="DemoCapa" component={Capa} durationInFrames={1} fps={60} width={1920} height={1080} />
  </>
);
