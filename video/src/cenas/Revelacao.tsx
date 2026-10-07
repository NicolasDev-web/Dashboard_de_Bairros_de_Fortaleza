import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CidadePixels, CIDADE_ALT, CIDADE_LARG } from "../componentes/CidadePixels";
import { Apoio, Marca, Rotulo, Titulo } from "../componentes/Texto";
import medidas from "../../public/dados/medidas.json";
import { clamp, COR, EASE } from "../tema";

// Posição da cidade no fim da revelação; o Mergulho começa exatamente daqui.
// Conferido contra a captura real (telas/01_hero.png), comparando a caixa dos pixels acesos.
export const CIDADE_REVELADA = { x: 1404, y: 566, escala: 0.903 };
// Título na mesma posição, corpo e entrelinha do título real da abertura (medidas.json, hero.titulo).
export const TITULO_REAL = { x: 56, y: medidas.hero.titulo.y, tamanho: medidas.hero.titulo_px, entrelinha: 0.912 };
// Marca na navegação do dashboard (x 56, ~y 20, "Bairros" com 17 px = 0,25 da marca grande).
export const MARCA_NAV = { x: 56, y: 20, escala: 0.25 };

// 10–15 s. Impacto: o cobalto do produto se abre a partir do centro da cidade.
// A cidade desliza para a direita e o produto se apresenta com a frase da própria abertura.
// No fim, a marca encolhe até o lugar dela na navegação: o próximo plano já é a interface real.
export const Revelacao: React.FC = () => {
  const frame = useCurrentFrame();
  const raio = interpolate(frame, [0, 18], [0, 160], { ...clamp, easing: EASE.entrada });
  const mov = interpolate(frame, [8, 56], [0, 1], { ...clamp, easing: EASE.camera });
  const cx = interpolate(mov, [0, 1], [960, CIDADE_REVELADA.x]);
  const cy = interpolate(mov, [0, 1], [540, CIDADE_REVELADA.y]);
  const esc = interpolate(mov, [0, 1], [0.96, CIDADE_REVELADA.escala]);
  const marca = interpolate(frame, [118, 148], [0, 1], { ...clamp, easing: EASE.camera });
  return (
    <AbsoluteFill style={{ background: COR.noite }}>
      <AbsoluteFill style={{ background: COR.cobaltoFundo, clipPath: `circle(${raio}% at 50% 50%)` }} />
      {/* clarão do impacto */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(40% 40% at 50% 50%, rgba(255,255,255,.55), transparent 70%)",
          opacity: interpolate(frame, [0, 3, 22], [0, 1, 0], clamp),
        }}
      />
      <div
        style={{
          position: "absolute", left: cx - CIDADE_LARG / 2, top: cy - CIDADE_ALT / 2,
          width: CIDADE_LARG, height: CIDADE_ALT, scale: `${esc}`,
        }}
      >
        <CidadePixels montagem={1} varredura={interpolate(frame, [30, 150], [-0.15, 1.15], clamp)} />
      </div>

      {/* marca: grande ao entrar, depois vai para a navegação (x 56, y 18, 17 px) */}
      <div
        style={{
          position: "absolute",
          left: interpolate(marca, [0, 1], [120, MARCA_NAV.x]),
          top: interpolate(marca, [0, 1], [96, MARCA_NAV.y]),
          scale: `${interpolate(marca, [0, 1], [0.62, MARCA_NAV.escala])}`,
          transformOrigin: "0 0",
          opacity: interpolate(frame, [26, 44], [0, 1], clamp),
        }}
      >
        <Marca />
      </div>

      <div style={{ position: "absolute", left: TITULO_REAL.x + 6, top: TITULO_REAL.y - 105 }}>
        <Rotulo texto="121 bairros, dois censos, sete anos de segurança" entra={34} sai={124} />
      </div>
      <div style={{ position: "absolute", left: TITULO_REAL.x, top: TITULO_REAL.y, width: 900 }}>
        <Titulo
          linhas={["Onde morar", "em Fortaleza"]} entra={40} tamanho={TITULO_REAL.tamanho}
          entrelinha={TITULO_REAL.entrelinha} espacamento="-0.045em"
        />
      </div>
      <div style={{ position: "absolute", left: TITULO_REAL.x + 6, top: TITULO_REAL.y + 279 }}>
        <Apoio texto="Renda, segurança, ônibus e preço, bairro a bairro." entra={70} sai={122} tamanho={44} largura={720} />
      </div>
    </AbsoluteFill>
  );
};
