import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CidadePixels, CIDADE_ALT, CIDADE_LARG } from "../componentes/CidadePixels";
import { Apoio, Marca, Rotulo, Titulo } from "../componentes/Texto";
import { clamp, COR, EASE, MONO } from "../tema";
import { CIDADE_REVELADA } from "./Revelacao";

// Botão no mesmo desenho do "Explorar o mapa" do dashboard (botao-claro), em escala de vídeo.
const Botao: React.FC<{ entra: number }> = ({ entra }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [entra, entra + 20], [0, 1], { ...clamp, easing: EASE.entrada });
  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 22, padding: "14px 30px 14px 14px",
        background: "#fff", color: COR.cobalto, borderRadius: 6, fontFamily: MONO, fontSize: 36,
        opacity: p, translate: `0 ${interpolate(p, [0, 1], [24, 0])}px`,
        boxShadow: "0 20px 60px rgba(5,6,40,.35)",
      }}
    >
      <span style={{ width: 52, height: 52, display: "grid", placeItems: "center", background: COR.cobalto, color: "#fff", borderRadius: 4, fontSize: 36 }}>+</span>
      Explore o mapa
    </div>
  );
};

// 63–70,2 s. A cidade se forma de novo, agora inteira em cobalto. A síntese, a marca e o convite.
// O último frame é a peça de campanha: marca, frase, botão e a cidade.
export const Encerramento: React.FC = () => {
  const frame = useCurrentFrame();
  const raio = interpolate(frame, [0, 16], [0, 160], { ...clamp, easing: EASE.entrada });
  return (
    <AbsoluteFill style={{ background: COR.noite }}>
      <AbsoluteFill style={{ background: COR.cobaltoFundo, clipPath: `circle(${raio}% at 70% 50%)` }} />
      <AbsoluteFill
        style={{
          background: "radial-gradient(45% 60% at 72% 52%, rgba(255,255,255,.10) 0%, transparent 70%)",
          opacity: interpolate(frame, [20, 80], [0, 1], clamp),
        }}
      />
      <div
        style={{
          position: "absolute", left: CIDADE_REVELADA.x - CIDADE_LARG / 2, top: CIDADE_REVELADA.y - CIDADE_ALT / 2,
          width: CIDADE_LARG, height: CIDADE_ALT,
          scale: `${interpolate(frame, [0, 120], [0.98, CIDADE_REVELADA.escala], { ...clamp, easing: EASE.camera })}`,
        }}
      >
        <CidadePixels
          montagem={interpolate(frame, [6, 84], [0, 1], { ...clamp, easing: EASE.suave })}
          varredura={interpolate(frame, [96, 176], [-0.15, 1.15], clamp)}
          espalhar={0.7}
        />
      </div>

      <div style={{ position: "absolute", left: 120, top: 96, opacity: interpolate(frame, [84, 104], [0, 1], clamp) }}>
        <Marca escala={0.62} />
      </div>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 120 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 36, marginTop: 60 }}>
          <Rotulo texto="121 bairros · 435 linhas · dados públicos" entra={30} />
          <Titulo linhas={["Escolha", "seu bairro", "com dados."]} entra={22} tamanho={128} />
          <Apoio texto="O mapa, os ônibus e o seu próximo endereço. Tudo aberto, para você explorar." entra={92} largura={760} tamanho={40} />
          <div>
            <Botao entra={118} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
