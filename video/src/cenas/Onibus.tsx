import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import contornos from "../../public/dados/contornos.json";
import onibus from "../../public/dados/onibus.json";
import { CidadePixels, CIDADE_ALT, CIDADE_LARG } from "../componentes/CidadePixels";
import { Clarao, LuzVarre, Palco3D, Particulas } from "../componentes/Cinema";
import { Tela, Veu } from "../componentes/Tela";
import { Rotulo, Titulo } from "../componentes/Texto";
import { clamp, COR, EASE, MONO, SANS } from "../tema";

type Ponto = [number, number];
type Perna = { tipo: "pe" | "onibus" | "arce" | "metro"; linha?: string; nome?: string; min: number; espera?: number; sobe?: string; pts: Ponto[] };
const PERNAS = onibus.pernas as Perna[];
const MINUTOS = new Map(contornos.bairros.map((b) => [b.id, b.min as number | null]));
const MAX = contornos.meta.max_centro;
const INICIO = onibus.inicio as Ponto;
const FIM = onibus.fim as Ponto;
const ORIGEM_ID = contornos.bairros.find((b) => b.nome === onibus.origem)?.id;
const CENTRO_ID = contornos.bairros.find((b) => b.nome === "Centro")?.id;

export const AZUL = "#8f96ff"; // ônibus sobre a noite (o cobalto do dashboard, clareado)
export const ROXO = "#c08cf2"; // metropolitanos (ARCE): o roxo do dashboard, clareado
export const LARANJA = "#f0a02a"; // metrô e VLT, como no dashboard
export const COR_TIPO = { onibus: AZUL, arce: ROXO, metro: LARANJA, pe: "#ffffff", pino: "#ffffff" } as const;
const corDe = (p: Perna) => COR_TIPO[p.tipo];

// ---------- geometria da rota ----------
const dist = (a: Ponto, b: Ponto) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const comp = (pts: Ponto[]) => pts.slice(1).reduce((s, p, k) => s + dist(pts[k], p), 0);
/** trecho inicial da linha até a fração f do comprimento */
const cortar = (pts: Ponto[], f: number): Ponto[] => {
  if (f <= 0) return [pts[0]];
  const alvo = comp(pts) * Math.min(1, f);
  const saida: Ponto[] = [pts[0]];
  let andado = 0;
  for (let k = 1; k < pts.length; k++) {
    const d = dist(pts[k - 1], pts[k]);
    if (andado + d >= alvo) {
      const u = d ? (alvo - andado) / d : 0;
      saida.push([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u]);
      return saida;
    }
    andado += d;
    saida.push(pts[k]);
  }
  return saida;
};
// cada perna ganha um tempo de tela pelo comprimento (com piso, para a caminhada curta aparecer)
const PESOS = PERNAS.map((p) => Math.max(comp(p.pts), 26));
const SOMA = PESOS.reduce((a, b) => a + b, 0);
const SOMA_MIN = PERNAS.reduce((s, p) => s + p.min + (p.espera ?? 0), 0);
const LIMITES = PESOS.reduce<number[]>((acc, w) => [...acc, acc[acc.length - 1] + w / SOMA], [0]);

// ---------- linha do tempo (frames locais) ----------
const ONDA = [34, 128] as const; // a cidade acende pelo tempo até o Centro
const VOO = [138, 180] as const; // a câmera vai até o Bom Jardim
const DESENHO = [182, 280] as const; // a rota se desenha
const SAIDA = 284; // recua para a tela real
// para a trilha de efeitos (Lancamento.tsx): quando a câmera voa e quando cada selo aparece
export const MARCOS_ONIBUS = {
  voo: VOO[0],
  selos: PERNAS.map((p, i) => (p.tipo === "pe" ? null : Math.round(interpolate(LIMITES[i], [0, 1], DESENHO)))).filter((x): x is number => x !== null),
  saida: SAIDA,
};

export const Onibus: React.FC = () => {
  const frame = useCurrentFrame();

  // relógio da onda: minutos até o Centro (0 -> o mais longe)
  const tau = interpolate(frame, ONDA, [0, MAX], { ...clamp, easing: EASE.suave });
  // progresso do desenho da rota e a ponta da linha
  const u = interpolate(frame, DESENHO, [0, 1], { ...clamp, easing: EASE.suave });
  const k = Math.max(0, LIMITES.findIndex((l, i) => i > 0 && u <= l) - 1);
  const fracPerna = (i: number) => interpolate(u, [LIMITES[i], LIMITES[i + 1]], [0, 1], clamp);
  const ponta = (() => {
    const pts = cortar(PERNAS[k].pts, fracPerna(k));
    return pts[pts.length - 1];
  })();
  // soma viagem + espera de cada perna, na escala do total da opção (a espera na primeira parada também conta)
  const minutosAteAgora = (PERNAS.reduce((s, p, i) => s + (p.min + (p.espera ?? 0)) * fracPerna(i), 0) * onibus.total) / SOMA_MIN;

  // ---------- câmera ----------
  const voo = interpolate(frame, VOO, [0, 1], { ...clamp, easing: EASE.camera });
  const fimDesenho = interpolate(frame, [DESENHO[1] - 50, DESENHO[1]], [0, 1], { ...clamp, easing: EASE.camera });
  const meioRota: Ponto = [(INICIO[0] + FIM[0]) / 2, (INICIO[1] + FIM[1]) / 2];
  const focoGeral: Ponto = [CIDADE_LARG / 2, CIDADE_ALT / 2];
  const seguir: Ponto = [ponta[0] * (1 - fimDesenho) + meioRota[0] * fimDesenho, ponta[1] * (1 - fimDesenho) + meioRota[1] * fimDesenho];
  const foco: Ponto = frame < VOO[1]
    ? [focoGeral[0] + (INICIO[0] - focoGeral[0]) * voo, focoGeral[1] + (INICIO[1] - focoGeral[1]) * voo]
    : seguir;
  const entrada = interpolate(frame, [0, 26], [0, 1], { ...clamp, easing: EASE.entrada });
  const recuo = interpolate(frame, [SAIDA, SAIDA + 22], [0, 1], { ...clamp, easing: EASE.saida });
  const zoom = frame < VOO[1]
    ? interpolate(voo, [0, 1], [0.92, 2.7])
    : interpolate(fimDesenho, [0, 1], [2.7, 1.55]) * interpolate(frame, [DESENHO[0], DESENHO[0] + 60], [1, 0.92], clamp);
  const inclinar = interpolate(frame, [0, 26, VOO[0], VOO[1], DESENHO[1]], [0, 34, 36, 50, 32], { ...clamp, easing: EASE.camera });
  const girar = interpolate(frame, [0, VOO[0], VOO[1], DESENHO[1]], [-9, 2, -6, 3], { ...clamp, easing: EASE.camera });
  // a ponta da rota fica no terço direito; a coluna da esquerda é do texto
  const centro: [number, number] = [
    interpolate(voo, [0, 1], [1210, 1300]) + interpolate(fimDesenho, [0, 1], [0, -40]),
    interpolate(voo, [0, 1], [560, 470]) + interpolate(fimDesenho, [0, 1], [0, 90]),
  ];
  const profundidade = interpolate(entrada, [0, 1], [-1400, 0]) + interpolate(recuo, [0, 1], [0, -1800]);

  // pixels: na onda, cada bairro acende quando o relógio passa o tempo dele; na rota, a cidade recua
  const naRota = interpolate(frame, [VOO[0] - 6, VOO[0] + 20], [0, 1], clamp);
  const nota = (b: number) => {
    const m = MINUTOS.get(b);
    if (m == null) return null;
    if (naRota > 0 && (b === ORIGEM_ID || b === CENTRO_ID)) return 1;
    if (tau < m) return null;
    const perto = 1 - m / MAX;
    const lampejo = Math.max(0, 1 - (tau - m) / 7);
    return Math.min(1, (0.15 + 0.75 * perto + 0.45 * lampejo) * (1 - 0.55 * naRota));
  };

  const palco = (
    <Palco3D largura={CIDADE_LARG} altura={CIDADE_ALT} inclinar={inclinar} girar={girar} zoom={zoom} foco={foco} centro={centro} profundidade={profundidade}>
      <div style={{ position: "absolute", inset: 0, opacity: entrada * (1 - recuo) }}>
        <CidadePixels montagem={1} nota={nota} apagado={0.1} />
      </div>
      <svg width={CIDADE_LARG} height={CIDADE_ALT} style={{ position: "absolute", inset: 0, overflow: "visible", opacity: 1 - recuo }}>
        <defs>
          <filter id="brilho" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>
        {/* contornos: desenham-se na entrada; Bom Jardim e Centro ganham destaque na rota */}
        {contornos.bairros.map((b) => {
          const destaque = (b.id === ORIGEM_ID || b.id === CENTRO_ID) ? naRota : 0;
          return (
            <path key={b.id} d={b.d} pathLength={1} fill={`rgba(255,255,255,${0.1 * destaque})`}
              stroke="#fff" strokeOpacity={0.14 + 0.5 * destaque} strokeWidth={0.6 + 0.6 * destaque}
              strokeDasharray={1} strokeDashoffset={interpolate(frame, [4, 40], [1, 0], { ...clamp, easing: EASE.suave })} />
          );
        })}
        {/* a rota: brilho largo por baixo, linha por cima; caminhada pontilhada */}
        {PERNAS.map((p, i) => {
          const f = fracPerna(i);
          if (f <= 0) return null;
          const pts = cortar(p.pts, f).map((q) => q.join(",")).join(" ");
          return p.tipo === "pe" ? (
            <polyline key={i} points={pts} fill="none" stroke="#fff" strokeWidth={2.2} strokeDasharray="0.1 4" strokeLinecap="round" opacity={0.95} />
          ) : (
            <g key={i}>
              <polyline points={pts} fill="none" stroke={corDe(p)} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} filter="url(#brilho)" />
              <polyline points={pts} fill="none" stroke="#0a0c2c" strokeWidth={5.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
              <polyline points={pts} fill="none" stroke={corDe(p)} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
        {/* a ponta da linha: um ponto que respira */}
        {u > 0 && u < 1 && (
          <circle cx={ponta[0]} cy={ponta[1]} r={3.2 + Math.sin(frame / 3) * 0.8} fill="#fff" />
        )}
      </svg>
      {/* pinos e selos em pé, sempre de frente para a câmera */}
      <Selo x={INICIO[0]} y={INICIO[1]} inclinar={inclinar} girar={girar} zoom={zoom} entra={VOO[1] - 10} texto={onibus.origem} tipo="pino" haste={175} />
      <Selo x={FIM[0]} y={FIM[1]} inclinar={inclinar} girar={girar} zoom={zoom} entra={VOO[1] - 10} texto="Centro" tipo="pino" />
      {PERNAS.map((p, i) => p.tipo === "pe" ? null : (
        <Selo key={i} x={p.pts[0][0]} y={p.pts[0][1]} inclinar={inclinar} girar={girar} zoom={zoom}
          entra={interpolate(LIMITES[i], [0, 1], DESENHO)} texto={p.linha ?? ""} tipo={p.tipo}
          haste={PERNAS.slice(0, i).filter((q) => q.tipo !== "pe").length % 2 ? 78 : 30} />
      ))}
    </Palco3D>
  );

  return (
    <AbsoluteFill style={{ background: `radial-gradient(70% 80% at 62% 50%, #1a2080 0%, ${COR.noite} 72%)` }}>
      <Particulas semente="onibus" deriva={[-(foco[0] - CIDADE_LARG / 2) * 0.8, -(foco[1] - CIDADE_ALT / 2) * 0.5]} opacidade={1 - recuo} />
      {frame >= VOO[0] - 2 && frame <= VOO[1] + 4 ? (
        <CameraMotionBlur shutterAngle={200} samples={7}>{palco}</CameraMotionBlur>
      ) : palco}

      {/* a tela real, onde a mesma rota aparece no painel */}
      <AbsoluteFill style={{ opacity: interpolate(frame, [SAIDA + 4, SAIDA + 20], [0, 1], clamp) }}>
        <Tela src="telas/20_onibus.png" chaves={[[SAIDA, { x: 700, y: 640, zoom: 1.3 }], [324, { x: 640, y: 660, zoom: 1.12 }]]} />
        <Veu lado="baixo" forca={0.9} />
        <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 0 110px 120px" }}>
          <Titulo linhas={["As linhas, onde subir", "e onde descer."]} entra={SAIDA + 12} tamanho={92} />
        </AbsoluteFill>
      </AbsoluteFill>

      {/* texto: a pergunta e o relógio da onda */}
      <AbsoluteFill style={{ opacity: interpolate(frame, [10, 28, 124, 140], [0, 1, 1, 0], clamp) }}>
        <Veu lado="esquerda" forca={0.78} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 120, top: 200, display: "flex", flexDirection: "column", gap: 30 }}>
        <Rotulo texto={`${contornos.meta.pares.toLocaleString("pt-BR")} trajetos calculados`} entra={16} sai={124} />
        <Titulo linhas={["Quanto tempo", "até o Centro?"]} entra={20} sai={124} tamanho={104} />
      </div>
      <Contador valor={tau} entra={30} sai={126} rotulo="de ônibus, saindo de manhã" y={640} />

      {/* texto: a rota */}
      <AbsoluteFill style={{ opacity: interpolate(frame, [VOO[0] + 6, VOO[0] + 26, SAIDA - 6, SAIDA + 6], [0, 1, 1, 0], clamp) }}>
        <Veu lado="esquerda" forca={0.7} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 120, top: 150, display: "flex", flexDirection: "column", gap: 24 }}>
        <Rotulo texto="a rota mais rápida, saindo às 7h" entra={VOO[0] + 12} sai={SAIDA - 8} />
        <Titulo linhas={[onibus.origem, "→ Centro"]} entra={VOO[0] + 16} sai={SAIDA - 8} tamanho={96} />
      </div>
      <Contador valor={minutosAteAgora} entra={DESENHO[0] - 6} sai={SAIDA - 6} rotulo="porta a porta" y={470} />
      <Passos u={u} sai={SAIDA - 6} />

      <LuzVarre de={DESENHO[1] - 4} ate={DESENHO[1] + 26} forca={0.22} />
      <Clarao em={0} dur={14} forca={0.5} />
    </AbsoluteFill>
  );
};

/** Pino ou selo de linha em pé no plano: desfaz a rotação e o zoom do palco. */
export const Selo: React.FC<{ x: number; y: number; inclinar: number; girar: number; zoom: number; entra: number; texto: string; tipo: "pino" | "onibus" | "arce" | "metro" | "pe"; haste?: number }> = ({
  x, y, inclinar, girar, zoom, entra, texto, tipo, haste,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [entra, entra + 12], [0, 1], { ...clamp, easing: EASE.entrada });
  if (p <= 0) return null;
  const pino = tipo === "pino";
  return (
    <div
      style={{
        position: "absolute", left: x, top: y, width: 0, height: 0, transformStyle: "preserve-3d",
        transform: `scale(${1 / zoom}) rotateZ(${-girar}deg) rotateX(${-inclinar}deg)`,
      }}
    >
      <div
        style={{
          position: "absolute", left: 0, bottom: 0, translate: "-50% 0", display: "flex", flexDirection: "column", alignItems: "center",
          opacity: p, scale: `${interpolate(p, [0, 1], [0.6, 1])}`, transformOrigin: "50% 100%",
        }}
      >
        <div
          style={{
            fontFamily: pino ? SANS : MONO, fontWeight: pino ? 500 : 500, fontSize: pino ? 30 : 30, whiteSpace: "nowrap",
            padding: pino ? "6px 14px" : "5px 12px", borderRadius: 4,
            background: COR_TIPO[tipo], color: pino ? COR.tinta : tipo === "metro" ? "#2a1700" : "#0a0c2c",
            boxShadow: "0 10px 30px rgba(0,0,0,.45)",
          }}
        >
          {texto}
        </div>
        <div style={{ width: 2, height: haste ?? (pino ? 46 : 30), background: COR_TIPO[tipo] }} />
      </div>
    </div>
  );
};

/** Relógio grande em minutos (vira "1h04" depois de uma hora). */
const Contador: React.FC<{ valor: number; entra: number; sai: number; rotulo: string; y: number }> = ({ valor, entra, sai, rotulo, y }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [entra, entra + 12, sai, sai + 10], [0, 1, 1, 0], clamp);
  const m = Math.round(valor);
  const txt = m < 60 ? `${m}` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
  return (
    <div style={{ position: "absolute", left: 120, top: y, opacity: op, display: "flex", alignItems: "baseline", gap: 22 }}>
      <span style={{ fontFamily: SANS, fontSize: 200, fontWeight: 380, letterSpacing: "-0.05em", lineHeight: 0.9, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{txt}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: MONO, fontSize: 28, color: "rgba(255,255,255,.75)" }}>
        <span>{m < 60 ? "min" : ""}</span>
        <span>{rotulo}</span>
      </span>
    </div>
  );
};

/** A lista de passos (como no painel), montando-se conforme a rota avança. */
const Passos: React.FC<{ u: number; sai: number }> = ({ u, sai }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [sai, sai + 10], [1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 120, top: 680, display: "flex", flexDirection: "column", gap: 10, opacity: op }}>
      {PERNAS.map((p, i) => {
        const a = interpolate(u, [LIMITES[i], LIMITES[i] + 0.04], [0, 1], clamp);
        if (a <= 0) return null;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, opacity: a, translate: `${(1 - a) * -24}px 0`, fontFamily: SANS, fontSize: 30, color: "rgba(255,255,255,.9)" }}>
            {p.tipo === "pe" ? (
              <span style={{ fontFamily: MONO, fontSize: 24, padding: "3px 10px", border: "1.5px solid rgba(255,255,255,.6)", borderRadius: 3 }}>a pé</span>
            ) : (
              <span style={{ fontFamily: MONO, fontSize: 24, padding: "3px 10px", borderRadius: 3, background: corDe(p), color: p.tipo === "metro" ? "#2a1700" : "#0a0c2c" }}>{p.linha}</span>
            )}
            <span>{p.tipo === "pe" ? `${p.min} min` : p.tipo === "metro" ? `${p.min} min de metrô` : `${(p.nome ?? "").replace(/ \(.*$/, "").replace(/ via .*$/, "")} · ${p.min} min`}</span>
          </div>
        );
      })}
    </div>
  );
};
