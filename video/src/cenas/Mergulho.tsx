import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CidadePixels, CIDADE_ALT, CIDADE_LARG } from "../componentes/CidadePixels";
import medidas from "../../public/dados/medidas.json";
import { clamp, COR, EASE } from "../tema";
import { CIDADE_REVELADA, MARCA_NAV, TITULO_REAL } from "./Revelacao";
import { Marca, Titulo } from "../componentes/Texto";

const ROLAGEM_MAPA = medidas.mapa.rolagem; // scrollY do mapa no dashboard (scripts/capturar_telas.mjs)

// 13–17 s. A cidade desenhada vira a cidade da interface real (mesma posição),
// a câmera recua e revela o produto, e a página rola até o mapa.
export const Mergulho: React.FC = () => {
  const frame = useCurrentFrame();
  const escala = interpolate(frame, [16, 46, 98, 120], [1, 0.8, 0.8, 1], { ...clamp, easing: EASE.camera });
  const rolagem = interpolate(frame, [50, 98], [0, ROLAGEM_MAPA], { ...clamp, easing: EASE.camera });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(70% 70% at 50% 40%, #1b2170 0%, ${COR.noite} 75%)` }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            width: 1920, height: 1080, flexShrink: 0, scale: `${escala}`,
            borderRadius: interpolate(escala, [0.8, 1], [22, 0]),
            overflow: "hidden", position: "relative",
            boxShadow: `0 ${interpolate(escala, [0.8, 1], [60, 0])}px 140px rgba(0,0,0,${interpolate(escala, [0.8, 1], [0.55, 0])})`,
            background: COR.papel,
          }}
        >
          {/* página inteira rolando */}
          <Img
            src={staticFile("telas/16_pagina_inteira.png")}
            style={{ position: "absolute", left: 0, top: 0, width: 1920, translate: `0 ${-rolagem}px` }}
          />
          {/* chegada: a mesma vista do mapa, agora com a navegação fixa do dashboard */}
          <Img
            src={staticFile("telas/03_mapa_indice.png")}
            style={{ position: "absolute", inset: 0, width: 1920, height: 1080, opacity: interpolate(frame, [99, 112], [0, 1], clamp) }}
          />
          {/* abertura real do dashboard, com a navegação, por cima até a rolagem começar */}
          <Img
            src={staticFile("telas/01_hero.png")}
            style={{ position: "absolute", inset: 0, width: 1920, height: 1080, opacity: interpolate(frame, [3, 18, 48, 54], [0, 1, 1, 0], clamp) }}
          />
          {/* a cidade do filme cede lugar à cidade do produto */}
          <AbsoluteFill style={{ background: COR.cobaltoFundo, opacity: interpolate(frame, [3, 18], [1, 0], clamp) }} />
          <div
            style={{
              position: "absolute", left: CIDADE_REVELADA.x - CIDADE_LARG / 2, top: CIDADE_REVELADA.y - CIDADE_ALT / 2,
              width: CIDADE_LARG, height: CIDADE_ALT, scale: `${CIDADE_REVELADA.escala}`,
              opacity: interpolate(frame, [0, 16], [1, 0], { ...clamp, easing: EASE.suave }),
            }}
          >
            <CidadePixels montagem={1} varredura={-1} />
          </div>
          {/* título e marca do filme, parados onde estão os da interface: o corte não aparece */}
          <div style={{ position: "absolute", inset: 0, opacity: interpolate(frame, [3, 18], [1, 0], clamp) }}>
            <div style={{ position: "absolute", left: MARCA_NAV.x, top: MARCA_NAV.y, scale: `${MARCA_NAV.escala}`, transformOrigin: "0 0" }}>
              <Marca />
            </div>
            <div style={{ position: "absolute", left: TITULO_REAL.x, top: TITULO_REAL.y, width: 900 }}>
              <Titulo linhas={["Onde morar", "em Fortaleza"]} entra={-60} tamanho={TITULO_REAL.tamanho} entrelinha={TITULO_REAL.entrelinha} espacamento="-0.045em" />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
