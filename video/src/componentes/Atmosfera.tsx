import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

// Grão de filme muito sutil (ruído SVG com semente por frame) + vinheta leve.
export const Grao: React.FC<{ intensidade?: number }> = ({ intensidade = 0.06 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: intensidade }}>
      <svg width="100%" height="100%">
        <filter id="grao">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 24} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grao)" />
      </svg>
    </AbsoluteFill>
  );
};

export const Vinheta: React.FC<{ forca?: number }> = ({ forca = 0.35 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(120% 95% at 50% 45%, transparent 55%, rgba(5,6,30,${forca}) 100%)`,
    }}
  />
);
