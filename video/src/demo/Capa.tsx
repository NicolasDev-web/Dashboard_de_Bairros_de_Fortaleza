import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { COR, MONO, SANS } from "../tema";

// Thumbnail da demo (1920x1080): a cidade em pixels ao fundo, a tela real do resultado do
// "Onde morar" em primeiro plano e o título grande, legível mesmo em miniatura.
// npx remotion still DemoCapa out/bairros-de-fortaleza-demo-capa.png   (DemoCapaEN: em inglês)
// Os dois quadros vêm direto da gravação (capa.json diz quais; codificar.mjs os copia para
// public/demo/capa/), em 3840x2160.
const Quadro: React.FC<{ nome: string; style?: React.CSSProperties }> = ({ nome, style }) => (
  <Img src={staticFile(`demo/capa/${nome}.jpg`)} style={{ width: 1920, height: 1080, display: "block", ...style }} />
);

// textos da capa em português e em inglês (DemoCapa e DemoCapaEN)
const TEXTOS = {
  pt: {
    titulo: ["Onde morar", "em Fortaleza?"],
    apoio: "Os 121 bairros comparados com dados públicos, e um quiz que mostra os que combinam com você.",
    etiquetas: ["Renda", "Saneamento", "Segurança", "Ônibus", "Strava"],
  },
  en: {
    titulo: ["Where to live", "in Fortaleza?"],
    apoio: "All 121 neighborhoods compared with open data, plus a quiz that finds the ones that fit you.",
    etiquetas: ["Income", "Sanitation", "Safety", "Transit", "Strava"],
  },
};

export const Capa: React.FC<{ idioma?: keyof typeof TEXTOS }> = ({ idioma = "pt" }) => {
  const T = TEXTOS[idioma];
  return (
  <AbsoluteFill style={{ background: COR.cobaltoFundo }}>
    {/* a cidade em pixels do hero, empurrada para a direita */}
    <AbsoluteFill style={{ opacity: 0.9 }}>
      <Quadro nome="cidade" style={{ transformOrigin: "0 0", scale: "1.25", translate: `${960 - 1200 * 1.25}px ${540 - 520 * 1.25}px` }} />
    </AbsoluteFill>
    <AbsoluteFill
      style={{ background: "linear-gradient(90deg, rgb(42,49,184) 0%, rgb(42,49,184) 42%, rgba(42,49,184,.55) 60%, rgba(42,49,184,0) 78%)" }}
    />

    {/* a tela do resultado, como uma janela inclinada */}
    <div style={{ position: "absolute", left: 930, top: 300, width: 1180, height: 664, perspective: 2400 }}>
      <div
        style={{
          width: "100%", height: "100%", borderRadius: 14, overflow: "hidden", position: "relative",
          transform: "rotateY(-14deg) rotateX(4deg) rotateZ(-1deg)", transformOrigin: "0% 50%",
          boxShadow: "0 60px 120px -30px rgba(5,6,30,.65), 0 0 0 1px rgba(255,255,255,.25)",
        }}
      >
        <div style={{ position: "relative", width: 1920, height: 1080, transform: `scale(${1180 / 1920})`, transformOrigin: "0 0" }}>
          <Quadro nome="resultado" />
        </div>
      </div>
    </div>

    {/* texto */}
    <div style={{ position: "absolute", left: 110, top: 0, bottom: 0, width: 820, display: "flex", flexDirection: "column", justifyContent: "center", color: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: MONO, fontSize: 26, letterSpacing: "0.04em", color: "rgba(255,255,255,.85)" }}>
        <span style={{ display: "inline-flex", gap: 5 }}>
          <span style={{ width: 15, height: 13, background: "#fff" }} />
          <span style={{ width: 6, height: 13, background: "#fff" }} />
        </span>
        Bairros de Fortaleza
      </div>
      <div style={{ fontFamily: SANS, fontSize: 132, fontWeight: 430, letterSpacing: "-0.05em", lineHeight: 0.95, marginTop: 34 }}>
        {T.titulo[0]}<br />{T.titulo[1]}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 38, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.22, marginTop: 38, color: "rgba(255,255,255,.9)", maxWidth: 700 }}>
        {T.apoio}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 52 }}>
        {T.etiquetas.map((t) => (
          <span key={t} style={{ fontFamily: MONO, fontSize: 21, padding: "9px 14px", border: "1.5px solid rgba(255,255,255,.55)", borderRadius: 4, color: "#fff" }}>{t}</span>
        ))}
      </div>
    </div>

  </AbsoluteFill>
  );
};
