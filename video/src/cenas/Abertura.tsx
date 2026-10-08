import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CidadePixels, CIDADE_ALT, CIDADE_LARG } from "../componentes/CidadePixels";
import { LuzVarre, Palco3D, Particulas } from "../componentes/Cinema";
import { Titulo } from "../componentes/Texto";
import { clamp, COR, EASE } from "../tema";

// 0–8 s. Noite. Pixels soltos derivam sobre um plano deitado; duas frases colocam a pergunta;
// os pixels se juntam e formam Fortaleza, e o plano se levanta até ficar de frente (a Revelação
// começa exatamente nesse enquadramento: centro do quadro, escala 0,96, sem rotação).
export const Abertura: React.FC = () => {
  const frame = useCurrentFrame();
  const montagem = interpolate(frame, [120, 234], [0, 1], { ...clamp, easing: EASE.suave });
  return (
    <AbsoluteFill style={{ background: COR.noite }}>
      {/* luz fria que cresce devagar atrás da cidade */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(48% 55% at 50% 52%, rgba(47,55,196,${interpolate(frame, [0, 240], [0.12, 0.42], clamp)}) 0%, transparent 70%)`,
        }}
      />
      <Particulas semente="abertura" n={40} deriva={[-frame * 0.9, frame * 0.15]} opacidade={interpolate(frame, [0, 32, 200, 240], [0, 1, 1, 0.5], clamp)} />
      <Palco3D
        largura={CIDADE_LARG} altura={CIDADE_ALT} perspectiva={1500}
        inclinar={interpolate(frame, [0, 128, 237], [64, 54, 0], { ...clamp, easing: EASE.camera })}
        girar={interpolate(frame, [0, 237], [-16, 0], { ...clamp, easing: EASE.camera })}
        zoom={interpolate(frame, [0, 240], [1.25, 0.96], { ...clamp, easing: EASE.camera })}
        profundidade={interpolate(frame, [0, 237], [-260, 0], { ...clamp, easing: EASE.camera })}
      >
        <div style={{ position: "absolute", inset: 0, opacity: interpolate(frame, [0, 24], [0, 1], clamp) }}>
          <CidadePixels montagem={montagem} varredura={interpolate(frame, [200, 240], [-0.15, 0.5], clamp)} />
        </div>
      </Palco3D>
      <LuzVarre de={210} ate={240} forca={0.18} />

      {/* leitura: escurece o centro enquanto há texto */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(60% 40% at 50% 50%, rgba(10,12,44,.82) 0%, rgba(10,12,44,0) 100%)",
          opacity: interpolate(frame, [8, 32, 192, 216], [0, 1, 1, 0], clamp),
        }}
      />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Titulo linhas={["Fortaleza tem", "121 bairros."]} entra={18} sai={99} tamanho={124} alinhar="center" />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 160px" }}>
        <Titulo
          linhas={["Renda, saneamento e segurança", "mudam de um bairro para o outro."]}
          entra={122} sai={197} tamanho={84} peso={400} alinhar="center"
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
