import React from "react";
import { Composition } from "remotion";
import { Lancamento } from "./Lancamento";
import { DURACAO, FPS } from "./tema";

// Filme de lançamento: 1920x1080, 30 fps, 78 s. A capa é o último frame (ver README).
export const RemotionRoot: React.FC = () => (
  <Composition id="Lancamento" component={Lancamento} durationInFrames={DURACAO} fps={FPS} width={1920} height={1080} />
);
