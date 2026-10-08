import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import contornos from "../../public/dados/contornos.json";
import medidas from "../../public/dados/medidas.json";
import rede from "../../public/dados/rede.json";
import { CidadePixels, CIDADE_ALT, CIDADE_LARG } from "../componentes/CidadePixels";
import { Clarao, LuzVarre, Palco3D, Particulas } from "../componentes/Cinema";
import { Camera, Cursor, Tela, Veu } from "../componentes/Tela";
import { Rotulo, Titulo } from "../componentes/Texto";
import { clamp, COR, EASE, MONO, SANS } from "../tema";
import { COR_TIPO, Selo } from "./Onibus";

// A camada "Linhas de ônibus": a rede inteira se desenha sobre a cidade, do Centro para fora
// (ônibus, depois as metropolitanas, por fim o metrô); uma linha se destaca, como no clique do
// painel; e o corte para o painel real, no zoom das paradas, com o popup de uma parada.
type Traco = { t: "onibus" | "arce" | "metro"; n: string; d: number; c: number; p: string };
const TRACOS = rede.linhas as Traco[];
const D_MAX = Math.max(...TRACOS.map((x) => x.d));
const DESTAQUE = TRACOS.filter((x) => x.n === rede.destaque.n && x.t === "onibus");

// linha do tempo (frames locais)
const DESENHO = { onibus: [2, 80], arce: [42, 102], metro: [92, 124] } as const; // início do primeiro e do último
const DUR = { onibus: 30, arce: 34, metro: 30 };
const FOCO = [126, 156] as const; // a linha em destaque
const CORTE = 160; // para o painel real
const CLIQUE = 186; // clique na parada

// ponto do meio do traçado em destaque (o mais comprido), para a câmera e o selo
const pontos = (p: string) => p.split(" ").map((q) => q.split(",").map(Number) as [number, number]);
const MAIOR = [...DESTAQUE].sort((a, b) => b.c - a.c)[0];
const MEIO = pontos(MAIOR.p)[Math.floor(pontos(MAIOR.p).length / 2)];

const inicio = (x: Traco) => {
  const [a, b] = DESENHO[x.t];
  return a + (b - a) * (x.d / D_MAX);
};

const naTela = (p: { x: number; y: number }, c: Camera) => {
  const cx = Math.min(Math.max(c.x, 960 / c.zoom), 1920 - 960 / c.zoom);
  const cy = Math.min(Math.max(c.y, 540 / c.zoom), 1080 - 540 / c.zoom);
  return [960 + (p.x - cx) * c.zoom, 540 + (p.y - cy) * c.zoom] as const;
};

export const Rede: React.FC = () => {
  const frame = useCurrentFrame();
  const foco = interpolate(frame, FOCO, [0, 1], { ...clamp, easing: EASE.camera });
  const entrada = interpolate(frame, [0, 24], [0, 1], { ...clamp, easing: EASE.entrada });
  const saida = interpolate(frame, [CORTE - 6, CORTE + 6], [0, 1], clamp);

  // câmera: entra deitando o plano, gira devagar; no destaque, voa até o meio da linha
  const centroCidade: [number, number] = [CIDADE_LARG / 2, CIDADE_ALT / 2];
  const alvo: [number, number] = [centroCidade[0] + (MEIO[0] - centroCidade[0]) * foco, centroCidade[1] + (MEIO[1] - centroCidade[1]) * foco];
  const zoom = interpolate(frame, [0, FOCO[0]], [0.86, 1.02], { ...clamp, easing: EASE.suave }) * interpolate(foco, [0, 1], [1, 1.7]);
  const inclinar = interpolate(frame, [0, 34, FOCO[0], FOCO[1]], [10, 40, 44, 52], { ...clamp, easing: EASE.camera });
  const girar = interpolate(frame, [0, FOCO[1]], [-12, 6], { ...clamp, easing: EASE.camera });
  const profundidade = interpolate(entrada, [0, 1], [-900, 0]);

  const traco = (x: Traco, k: number, apagar: number) => {
    const a = inicio(x);
    const u = interpolate(frame, [a, a + DUR[x.t]], [0, 1], { ...clamp, easing: EASE.suave });
    if (u <= 0) return null;
    const metro = x.t === "metro";
    return (
      <polyline key={k} points={x.p} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - u} fill="none"
        stroke={COR_TIPO[x.t]} strokeWidth={metro ? 3.4 : x.t === "arce" ? 1.4 : 1.2} strokeLinecap="round" strokeLinejoin="round"
        opacity={(metro ? 1 : 0.62) * apagar} />
    );
  };
  const apagar = interpolate(foco, [0, 1], [1, 0.16]);
  const uDestaque = interpolate(frame, [FOCO[0] + 2, FOCO[1] - 2], [0, 1], { ...clamp, easing: EASE.suave });

  const palco = (
    <Palco3D largura={CIDADE_LARG} altura={CIDADE_ALT} inclinar={inclinar} girar={girar} zoom={zoom} foco={alvo} centro={[1240, 560]} profundidade={profundidade}>
      <div style={{ position: "absolute", inset: 0, opacity: entrada * 0.55 }}>
        <CidadePixels montagem={1} nota={() => null} apagado={0.16} />
      </div>
      <svg width={CIDADE_LARG} height={CIDADE_ALT} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id="brilhoRede" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        {contornos.bairros.map((b) => (
          <path key={b.id} d={b.d} fill="none" stroke="#fff" strokeOpacity={0.1} strokeWidth={0.5} />
        ))}
        {/* brilho: a rede inteira borrada por baixo, para as linhas parecerem acesas */}
        <g filter="url(#brilhoRede)" opacity={0.55 * (1 - foco * 0.8)}>{TRACOS.map((x, k) => traco(x, k, 1))}</g>
        <g>{TRACOS.map((x, k) => traco(x, k, apagar))}</g>
        {/* a linha em destaque: brilho largo, contorno escuro e a cor por cima */}
        {uDestaque > 0 && DESTAQUE.map((x, k) => (
          <g key={k}>
            <polyline points={x.p} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - uDestaque} fill="none" stroke="#fff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} filter="url(#brilhoRede)" />
            <polyline points={x.p} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - uDestaque} fill="none" stroke="#fff" strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={x.p} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - uDestaque} fill="none" stroke={COR_TIPO.onibus} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </svg>
      <Selo x={MEIO[0]} y={MEIO[1]} inclinar={inclinar} girar={girar} zoom={zoom} entra={FOCO[0] + 14} texto={rede.destaque.n} tipo="onibus" haste={70} />
    </Palco3D>
  );

  // painel real: zoom nas paradas, cursor clica na parada, o popup abre com as linhas
  const P = medidas.linhas.parada;
  const camPainel: [number, Camera][] = [
    [CORTE, { x: P.x + 40, y: P.y + 20, zoom: 1.25 }],
    [CLIQUE, { x: P.x + 20, y: P.y - 20, zoom: 1.5 }],
    [234, { x: P.x + 10, y: P.y - 40, zoom: 1.62 }],
  ];
  const [cx, cy] = naTela(P, { x: P.x + 20, y: P.y - 20, zoom: 1.5 });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(75% 85% at 64% 50%, #171c6e 0%, ${COR.noite} 72%)` }}>
      <Particulas semente="rede" n={36} deriva={[-frame * 0.6, frame * 0.1]} opacidade={1 - saida} />
      <AbsoluteFill style={{ opacity: 1 - saida }}>
        {frame >= FOCO[0] - 2 && frame <= FOCO[1] + 2 ? <CameraMotionBlur shutterAngle={180} samples={6}>{palco}</CameraMotionBlur> : palco}
      </AbsoluteFill>

      {/* texto da rede: a contagem por tipo */}
      <AbsoluteFill style={{ opacity: interpolate(frame, [6, 24, FOCO[0] - 4, FOCO[0] + 8], [0, 0.85, 0.85, 0], clamp) }}>
        <Veu lado="esquerda" forca={0.85} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 120, top: 190, display: "flex", flexDirection: "column", gap: 30 }}>
        <Rotulo texto="Camada nova · Linhas de ônibus" entra={10} sai={FOCO[0] - 6} />
        <Titulo linhas={["A cidade inteira,", "linha por linha."]} entra={14} sai={FOCO[0] - 6} tamanho={100} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 26 }}>
          <Contagem valor={rede.por_tipo.onibus} rotulo="ônibus da ETUFOR" cor={COR_TIPO.onibus} de={18} ate={DESENHO.onibus[1] + 20} sai={FOCO[0] - 6} />
          <Contagem valor={rede.por_tipo.arce} rotulo="metropolitanas (ARCE)" cor={COR_TIPO.arce} de={DESENHO.arce[0]} ate={DESENHO.arce[1] + 14} sai={FOCO[0] - 4} />
          <Contagem valor={rede.por_tipo.metro} rotulo="metrô e VLT" cor={COR_TIPO.metro} de={DESENHO.metro[0]} ate={DESENHO.metro[0] + 16} sai={FOCO[0] - 2} />
        </div>
      </div>

      {/* texto do destaque */}
      <AbsoluteFill style={{ opacity: interpolate(frame, [FOCO[0] + 4, FOCO[0] + 18, CORTE - 4, CORTE + 4], [0, 0.8, 0.8, 0], clamp) }}>
        <Veu lado="esquerda" forca={0.8} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 120, top: 330 }}>
        <Titulo linhas={["Clique numa linha:", "ela se destaca."]} entra={FOCO[0] + 8} sai={CORTE - 8} tamanho={92} />
      </div>

      {/* o painel real */}
      <AbsoluteFill style={{ opacity: saida }}>
        <Tela src="telas/31b_linhas_zoom.png" chaves={camPainel} />
        <Tela src="telas/31c_linhas_parada.png" chaves={camPainel} opacidade={interpolate(frame, [CLIQUE, CLIQUE + 5], [0, 1], clamp)} />
        <Cursor chaves={[[CORTE + 6, cx + 260, cy + 220], [CLIQUE - 2, cx, cy], [CLIQUE + 14, cx + 4, cy + 4]]} clique={CLIQUE} />
        <AbsoluteFill style={{ opacity: interpolate(frame, [CORTE + 10, CORTE + 24], [0, 1], clamp) }}>
          <Veu lado="baixo" forca={0.88} />
        </AbsoluteFill>
        <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 0 110px 120px" }}>
          <Rotulo texto={`${rede.paradas.toLocaleString("pt-BR")} paradas, a partir do zoom 15`} entra={CORTE + 12} />
          <div style={{ height: 22 }} />
          <Titulo linhas={["Clique na parada:", "as linhas que passam ali."]} entra={CLIQUE + 4} tamanho={84} />
        </AbsoluteFill>
      </AbsoluteFill>

      <LuzVarre de={DESENHO.metro[0]} ate={DESENHO.metro[0] + 30} forca={0.16} />
      <Clarao em={0} dur={12} forca={0.3} />
      <Clarao em={CORTE} dur={10} forca={0.45} />
    </AbsoluteFill>
  );
};

/** Número que conta enquanto as linhas daquele tipo se desenham, com a amostra da cor. */
const Contagem: React.FC<{ valor: number; rotulo: string; cor: string; de: number; ate: number; sai: number }> = ({ valor, rotulo, cor, de, ate, sai }) => {
  const frame = useCurrentFrame();
  const n = Math.round(interpolate(frame, [de, ate], [0, valor], { ...clamp, easing: EASE.suave }));
  const op = interpolate(frame, [de, de + 10, sai, sai + 10], [0, 1, 1, 0], clamp);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, opacity: op, translate: `${interpolate(op, [0, 1], [-20, 0])}px 0` }}>
      <span style={{ width: 34, height: 6, borderRadius: 3, background: cor }} />
      <span style={{ fontFamily: SANS, fontSize: 64, fontWeight: 400, letterSpacing: "-0.04em", color: "#fff", fontVariantNumeric: "tabular-nums", minWidth: 120 }}>{n}</span>
      <span style={{ fontFamily: MONO, fontSize: 28, color: "rgba(255,255,255,.8)" }}>{rotulo}</span>
    </div>
  );
};
