import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../../Cena";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { aleatorio, caixaChanfrada, placaDePlanta } from "../../util/geometria";

/**
 * Theatro José de Alencar (Centro; -3.727786, -38.5317064), inaugurado em 1910 (pesquisa/theatroJoseDeAlencar/ficha.md).
 * Planta do OSM: eixo longo a 18° (NNE), fachada eclética olhando para a Praça José de Alencar, pátio interno com a
 * fachada de ferro (Walter MacFarlane, Glasgow) da sala, sala com cobertura metálica, caixa cênica mais alta atrás e o
 * jardim de Burle Marx a leste. Referencial local: −z = rumo da fachada (18°), +x = leste do prédio (108°).
 * Escala: planta K = 0,6; alturas V = 0,84 (1,4 × K). Metros, base em y = 0.
 */
/** Altura da etiqueta com o nome no tour (topo da caixa cênica + ~2 m) */
export const ALTURA_ETIQUETA = 17.5;

const K = 0.6, V = 0.84;
const RUMO = 18;
/** Eixo do prédio (u, metros reais a partir do centro do OSM, + para a praça) para z local da miniatura */
const zDe = (u: number) => -(u - 9.5) * K + 3.4;
const X0 = -5; // o teatro fica a oeste do centro do disco para caber o jardim a leste
const MEIA_LARGURA = 12.85 * K; // 25,7 m de frente
const Z_FRENTE = zDe(43.5), Z_FUNDO_FACHADA = zDe(36), Z_SALA = zDe(19.3), Z_PALCO = zDe(-5.4), Z_FIM_PALCO = zDe(-19.2), Z_FUNDO = zDe(-24.6);

const COR = {
  reboco: "#d3dcae",
  rebocoSombra: "#c3cd9c",
  branco: "#f3f1e8",
  verdePorta: "#3f5a3c",
  ouro: "#c9a34a",
  telhaMetal: "#8d9397",
  calcada: "#d8d3c8",
  praca: "#cfcac0",
  asfalto: "#5d6062",
  grama: "#6f9a4c",
  ocre: "#d8b25a",
};

/** Canvas → textura sRGB com repetição */
function tela(w: number, h: number, desenhar: (g: CanvasRenderingContext2D) => void, repetir: [number, number] = [1, 1]) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  desenhar(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repetir);
  t.anisotropy = 4;
  return t;
}

/** Arco de porta/janela no canvas: retângulo com topo em semicírculo */
function arco(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.beginPath();
  g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath();
}

/**
 * Atlas da fachada (256 × 256): metade de cima é o pavimento superior central (10,2 × 5,1 m de miniatura), metade de
 * baixo o térreo inteiro (15,4 × 5,5 m). Portas, janelas, frontões e o almofadado em leque desenhados a partir da ref-3.
 */
function texturaFachada() {
  return tela(256, 256, (g) => {
    // ——— pavimento superior (y 0..128), 10,2 m de largura
    const sx = 256 / 10.2, sy = 128 / 5.1;
    const X = (m: number) => m * sx, Y = (m: number) => 128 - m * sy; // m a partir do piso do pavimento
    g.fillStyle = COR.reboco; g.fillRect(0, 0, 256, 128);
    g.fillStyle = "rgba(0,0,0,.05)"; for (let y = 6; y < 128; y += 9) g.fillRect(0, y, 256, 1); // juntas leves do reboco
    const janela = (cx: number, w: number, base: number, alt: number, folhas = 2) => {
      g.fillStyle = COR.branco; g.fillRect(X(cx - w / 2) - 3, Y(base + alt) - 3, X(w) + 6, alt * sy + 6);
      g.fillStyle = "#2c3638"; g.fillRect(X(cx - w / 2), Y(base + alt), X(w), alt * sy);
      g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(X(cx - w / 2), Y(base + alt), X(w), alt * sy * 0.3);
      g.fillStyle = COR.branco;
      for (let i = 1; i < folhas; i++) g.fillRect(X(cx - w / 2 + (w * i) / folhas) - 1, Y(base + alt), 2, alt * sy);
      g.fillRect(X(cx - w / 2), Y(base + alt * 0.62), X(w), 2);
    };
    // pilastras brancas nas divisas dos panos
    g.fillStyle = COR.branco;
    for (const m of [0, 2.6, 3.9, 6.3, 7.6, 10.2]) g.fillRect(X(m) - 4, 0, 8, 128);
    // pavilhões das pontas: duas janelas, sacadinha de ferro e o arco ornamental por cima
    for (const p of [0, 7.6]) {
      janela(p + 0.85, 0.66, 1.2, 1.9); janela(p + 1.75, 0.66, 1.2, 1.9);
      g.fillStyle = "#4a3f2e"; g.fillRect(X(p + 0.35), Y(1.25), X(1.9), 0.45 * sy); // sacada de ferro
      g.strokeStyle = COR.branco; g.lineWidth = 4;
      g.beginPath(); g.arc(X(p + 1.3), Y(3.3), X(1.15), Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      g.fillStyle = COR.branco; g.fillRect(X(p + 1.1), Y(4.15), X(0.4), 0.5 * sy); // cartela
    }
    // panos de uma janela com frontão triangular
    for (const c of [3.25, 6.95]) {
      janela(c, 0.72, 1.1, 2.0);
      g.fillStyle = COR.branco;
      g.beginPath(); g.moveTo(X(c - 0.6), Y(3.35)); g.lineTo(X(c), Y(3.9)); g.lineTo(X(c + 0.6), Y(3.35)); g.closePath(); g.fill();
    }
    // centro: janela tripla com frontão em arco pleno e cartela
    janela(5.1, 1.8, 1.0, 2.15, 3);
    g.strokeStyle = COR.branco; g.lineWidth = 5;
    g.beginPath(); g.arc(X(5.1), Y(3.35), X(1.1), Math.PI, 0); g.stroke();
    g.fillStyle = COR.branco; g.beginPath(); g.arc(X(5.1), Y(3.7), X(0.32), 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(0, 124, 256, 4);

    // ——— térreo (y 128..256), 15,4 m de largura
    const tx = 256 / 15.4, ty = 128 / 5.5;
    const A = (m: number) => m * tx, B = (m: number) => 256 - m * ty;
    g.fillStyle = COR.reboco; g.fillRect(0, 128, 256, 128);
    // almofadado horizontal leve
    g.fillStyle = "rgba(255,255,255,.18)"; for (let m = 0.6; m < 5.2; m += 0.42) g.fillRect(0, B(m), 256, 1);
    g.fillStyle = COR.branco; g.fillRect(0, B(0.4), 256, 0.4 * ty); // embasamento
    // nichos cegos das alas
    for (const c of [1.25, 14.15]) {
      g.fillStyle = COR.branco; arco(g, A(c - 0.72), B(4.0), A(1.44), 3.2 * ty); g.fill();
      g.fillStyle = "#c7d1a0"; arco(g, A(c - 0.55), B(3.85), A(1.1), 2.95 * ty); g.fill();
      g.fillStyle = "rgba(0,0,0,.10)"; g.fillRect(A(c - 0.55), B(1.0), A(1.1), 3);
    }
    // portas de grade dos panos laterais, com leque por cima
    for (const c of [3.35, 4.65, 10.75, 12.05]) {
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1;
      for (let i = 0; i <= 8; i++) { const a = Math.PI + (i * Math.PI) / 8; g.beginPath(); g.moveTo(A(c), B(3.3)); g.lineTo(A(c) + Math.cos(a) * A(0.85), B(3.3) + Math.sin(a) * A(0.85)); g.stroke(); }
      g.fillStyle = COR.branco; arco(g, A(c - 0.52), B(3.6), A(1.04), 3.2 * ty); g.fill();
      g.fillStyle = "#33372f"; arco(g, A(c - 0.42), B(3.45), A(0.84), 3.05 * ty); g.fill();
      g.strokeStyle = "rgba(170,170,150,.55)"; g.lineWidth = 1;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(A(c - 0.42 + i * 0.21), B(3.2)); g.lineTo(A(c - 0.42 + i * 0.21), B(0.4)); g.stroke(); }
      for (let m = 0.9; m < 3.2; m += 0.5) { g.beginPath(); g.moveTo(A(c - 0.42), B(m)); g.lineTo(A(c + 0.42), B(m)); g.stroke(); }
    }
    // as três portas verdes da entrada, em arco
    for (const c of [6.05, 7.7, 9.35]) {
      g.fillStyle = COR.branco; arco(g, A(c - 0.66), B(4.1), A(1.32), 3.75 * ty); g.fill();
      g.fillStyle = COR.verdePorta; arco(g, A(c - 0.56), B(3.95), A(1.12), 3.6 * ty); g.fill();
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(A(c) - 1, B(3.4), 2, 3.0 * ty);
      g.fillStyle = "rgba(255,255,255,.10)"; g.fillRect(A(c - 0.5), B(2.2), A(1.0), 2);
    }
    // pilastras e faixa de cornija
    g.fillStyle = COR.branco;
    for (const m of [0, 2.45, 5.2, 10.2, 12.95, 15.4]) g.fillRect(A(m) - 4, 128, 8, 128);
    g.fillRect(0, 128, 256, 5);
  });
}

/** Fachada de ferro da sala (a que dá para o pátio): ferro verde-escuro, arcos e vitrais coloridos */
function texturaVitral() {
  return tela(128, 256, (g) => {
    g.fillStyle = "#2e4a40"; g.fillRect(0, 0, 128, 256);
    const r = aleatorio(1910);
    const cores = ["#d9a43a", "#3d6fb0", "#b8433a", "#5f9b55", "#e7d8a0", "#7a4f9a"];
    const vitral = (x: number, y: number, w: number, h: number) => {
      for (let i = x; i < x + w; i += 4) for (let j = y; j < y + h; j += 4) { g.fillStyle = cores[Math.floor(r() * cores.length)]; g.fillRect(i, j, 4, 4); }
    };
    // térreo: três arcos de entrada; meio: galeria com colunetas; alto: lunetas com vitral em leque
    for (let i = 0; i < 3; i++) {
      const x = 8 + i * 40;
      g.save(); arco(g, x, 170, 32, 80); g.clip(); vitral(x, 170, 32, 80); g.restore();
      g.fillStyle = "#1f2f29"; g.fillRect(x + 6, 205, 20, 45);
    }
    g.fillStyle = "#3f6155"; g.fillRect(0, 150, 128, 12); // balcão de ferro
    for (let i = 0; i < 6; i++) { const x = 4 + i * 21; g.save(); arco(g, x, 70, 17, 72); g.clip(); vitral(x, 70, 17, 72); g.restore(); }
    g.save(); g.beginPath(); g.arc(64, 64, 58, Math.PI, 0); g.closePath(); g.clip(); vitral(6, 4, 116, 62); g.restore();
    g.strokeStyle = "#2e4a40"; g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { const a = Math.PI + (i * Math.PI) / 8; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60); g.stroke(); }
    g.fillStyle = "#c9a34a"; g.fillRect(0, 64, 128, 4); g.fillRect(0, 146, 128, 3); // frisos dourados
    for (let x = 0; x <= 128; x += 21) { g.fillStyle = "#24392f"; g.fillRect(x - 2, 66, 4, 190); }
  });
}

/** Paredes laterais da sala e das galerias: reboco verde-claro, pilastra branca e janela alta em arco (módulo 3 × 5 m) */
function texturaLateral() {
  return tela(64, 128, (g) => {
    g.fillStyle = COR.reboco; g.fillRect(0, 0, 64, 128);
    g.fillStyle = "rgba(255,255,255,.16)"; for (let y = 6; y < 128; y += 8) g.fillRect(0, y, 64, 1);
    g.fillStyle = COR.branco; g.fillRect(0, 0, 6, 128); g.fillRect(58, 0, 6, 128); g.fillRect(0, 0, 64, 6);
    g.fillStyle = COR.branco; arco(g, 18, 26, 28, 84); g.fill();
    g.fillStyle = "#33413b"; arco(g, 21, 29, 22, 80); g.fill();
    g.fillStyle = "rgba(220,190,120,.35)"; g.fillRect(21, 40, 22, 2); g.fillRect(31, 29, 2, 80);
  }, [1, 1]);
}

/** Tapete de piso diante da entrada: placas claras com círculos entrelaçados (UV em metros, módulo de ~3,3 m) */
function texturaPraca() {
  return tela(128, 128, (g) => {
    g.fillStyle = COR.praca; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(0,0,0,.10)"; g.lineWidth = 1;
    for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
    g.strokeStyle = "rgba(90,90,85,.55)"; g.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) for (let j = 0; j <= 128; j += 32) { g.beginPath(); g.arc(i, j, 16, 0, Math.PI * 2); g.stroke(); }
  }, [0.3, 0.3]);
}

/** Plano com UV em metros (para texturas que repetem por módulo) */
function planoMetros(w: number, h: number, modulo: [number, number]) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / modulo[0], (uv.getY(i) * h) / modulo[1]);
  return g;
}

/** Plano que mostra só um retângulo do atlas (u0, v0, u1, v1 em 0..1, v de baixo para cima) */
function planoAtlas(w: number, h: number, [u0, v0, u1, v1]: [number, number, number, number]) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  return g;
}

/** Telhado de quatro águas (largura em x, fundo em z), base em y = 0; a cumeeira ocupa `cumeeira` do fundo */
function telhadoQuatroAguas(largura: number, fundo: number, altura: number, cumeeira = 0.4, beiral = 0.3) {
  const w = largura / 2 + beiral, d = fundo / 2 + beiral, c = (fundo * cumeeira) / 2;
  const p = [[-w, 0, -d], [w, 0, -d], [w, 0, d], [-w, 0, d], [0, altura, -c], [0, altura, c]];
  const f = [[0, 4, 1], [1, 4, 5], [1, 5, 2], [2, 5, 3], [3, 5, 4], [3, 4, 0]];
  const pos: number[] = [];
  for (const t of f) for (const i of t) pos.push(...p[i]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

type Item = [x: number, y: number, z: number, sx?: number, sy?: number, sz?: number, giro?: number];

/** InstancedMesh a partir de uma lista de [x, y, z, escalas, giro]; cores opcionais por instância */
function Instancias({ nome, geo, mat, itens, cores, sombra = true }: { nome: string; geo: THREE.BufferGeometry; mat: THREE.Material; itens: Item[]; cores?: string[]; sombra?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current!, o = new THREE.Object3D(), c = new THREE.Color();
    itens.forEach(([x, y, z, sx = 1, sy = 1, sz = 1, giro = 0], i) => {
      o.position.set(x, y, z); o.rotation.set(0, giro, 0); o.scale.set(sx, sy, sz); o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (cores) m.setColorAt(i, c.set(cores[i % cores.length]));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [itens, cores]);
  return <instancedMesh ref={ref} name={nome} args={[geo, mat, itens.length]} castShadow={sombra} receiveShadow />;
}

/** Geometrias e materiais com textura, criados uma vez e descartados ao desmontar */
function useRecursos() {
  const r = useMemo(() => {
    const mat = (name: string, map: THREE.Texture, roughness: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ name, map, roughness, ...extra });
    const fachada = texturaFachada(), vitral = texturaVitral(), lateral = texturaLateral(), praca = texturaPraca();
    return {
      matFachada: mat("Mat_Fachada_Theatro", fachada, 0.85),
      matVitral: mat("Mat_Fachada_Ferro_Vitral", vitral, 0.45, { metalness: 0.35 }),
      matLateral: mat("Mat_Parede_Lateral_Janelas", lateral, 0.88),
      matPraca: mat("Mat_Piso_Praca", praca, 0.95),
      matMetal: new THREE.MeshStandardMaterial({ name: "Mat_Cobertura_Metalica", color: COR.telhaMetal, roughness: 0.5, metalness: 0.45 }),
      matOuro: new THREE.MeshStandardMaterial({ name: "Mat_Dourado_Estatuas", color: COR.ouro, roughness: 0.4, metalness: 0.6 }),
      matFerro: new THREE.MeshStandardMaterial({ name: "Mat_Ferro_Fundido", color: "#2b3a33", roughness: 0.55, metalness: 0.5 }),
      texturas: [fachada, vitral, lateral, praca],
    };
  }, []);
  useEffect(() => () => { r.texturas.forEach((t) => t.dispose()); [r.matFachada, r.matVitral, r.matLateral, r.matPraca, r.matMetal, r.matOuro, r.matFerro].forEach((m) => m.dispose()); }, [r]);
  return r;
}

/** Bloco da fachada: térreo inteiro, pavimento superior central, alas com terraço, colunas, cornijas e coroamento */
function Fachada({ fab, r }: { fab: Fabrica; r: ReturnType<typeof useRecursos> }) {
  const reboco = fab.cor(COR.reboco, 0.88), branco = fab.cor(COR.branco, 0.7);
  const L = MEIA_LARGURA * 2, fundo = Z_FUNDO_FACHADA - Z_FRENTE, zc = (Z_FRENTE + Z_FUNDO_FACHADA) / 2;
  const T = 5.5, S = 5.1, LS = 10.2; // térreo, pavimento superior, largura do bloco superior
  const geos = useMemo(() => ({
    terreo: caixaChanfrada(L, T, fundo, 0.12),
    superior: caixaChanfrada(LS, S, fundo - 0.1, 0.12),
    pilastra: caixaChanfrada(0.34, 1, 0.2, 0.05),
    entablamento: caixaChanfrada(6.0, 0.55, 1.0, 0.08),
    cornijaT: caixaChanfrada(L + 0.5, 0.42, fundo + 0.5, 0.12),
    cornijaS: caixaChanfrada(LS + 0.5, 0.5, fundo + 0.1, 0.14),
    atico: caixaChanfrada(3.4, 0.95, 1.2, 0.1),
    terraco: caixaChanfrada(L + 0.1, 0.03, fundo + 0.1, 0.01),
    coberturaPiso: caixaChanfrada(LS + 0.1, 0.03, fundo - 0.1, 0.01),
    base: caixaChanfrada(L + 0.3, 0.45, fundo + 0.3, 0.1),
    frenteT: planoAtlas(L, T, [0, 0, 1, 0.5]),
    frenteS: planoAtlas(LS, S, [0, 0.5, 1, 1]),
    coluna: new THREE.CylinderGeometry(0.24, 0.28, 1, 12),
    capitel: caixaChanfrada(0.72, 0.32, 0.72, 0.06),
    balaustre: new THREE.CylinderGeometry(0.07, 0.1, 1, 6),
    corrimao: caixaChanfrada(1, 0.14, 0.26, 0.04),
    pinha: new THREE.SphereGeometry(0.26, 10, 8),
    pedestal: caixaChanfrada(0.5, 0.6, 0.5, 0.05),
    escada: caixaChanfrada(6.4, 0.18, 1.2, 0.04),
    corpo: new THREE.CapsuleGeometry(0.2, 0.75, 4, 8),
    cabeca: new THREE.SphereGeometry(0.15, 8, 6),
    brasao: (() => {
      // cartela recortada do brasão central: base reta, ombros em voluta e topo em ponta
      const s = new THREE.Shape();
      s.moveTo(-1.2, 0); s.lineTo(1.2, 0); s.quadraticCurveTo(1.25, 0.55, 0.75, 0.6); s.quadraticCurveTo(0.6, 1.15, 0.2, 1.2);
      s.lineTo(0, 1.55); s.lineTo(-0.2, 1.2); s.quadraticCurveTo(-0.6, 1.15, -0.75, 0.6); s.quadraticCurveTo(-1.25, 0.55, -1.2, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1, curveSegments: 6 });
      g.translate(0, 0, -0.15);
      return g;
    })(),
  }), [L, fundo]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  const yS = T + 0.42; // piso do pavimento superior (sobre a cornija do térreo)
  const yTopo = yS + S; // cornija de cima
  const zf = Z_FRENTE;
  // colunas do pórtico e balaústres
  const colunas: Item[] = [-2.45, -0.85, 0.85, 2.45].map((x) => [x, 0.45 + 2.3, zf - 0.55, 1, 4.6, 1]);
  const capiteis: Item[] = colunas.flatMap(([x]) => [[x, 0.45 + 4.6, zf - 0.55], [x, 0.45, zf - 0.55, 1, 0.9, 1]] as Item[]);
  // pilastras brancas em relevo: térreo (divisas dos panos) e pavimento superior (divisas dos pavilhões)
  const pilastras: Item[] = [
    ...[-7.7, -5.25, -2.5, 2.5, 5.25, 7.7].map((x) => [x * 0.985, 0.45, zf - 0.08, 1, T - 0.45, 1] as Item),
    ...[-5.1, -2.5, -1.2, 1.2, 2.5, 5.1].map((x) => [x * 0.98, yS, zf + 0.0, 1, S, 1] as Item),
  ];
  const balaustres: Item[] = [];
  const corrimaos: Item[] = [];
  const pinhas: Item[] = [], pedestais: Item[] = [];
  for (const s of [-1, 1]) {
    // terraço das alas: frente e lateral
    const x0 = s * (LS / 2 + 0.15), x1 = s * (L / 2 - 0.1);
    for (let x = Math.min(x0, x1) + 0.2; x < Math.max(x0, x1); x += 0.3) balaustres.push([x, yS + 0.31, zf + 0.2, 1, 0.62, 1]);
    for (let z = zf + 0.45; z < Z_FUNDO_FACHADA - 0.1; z += 0.3) balaustres.push([x1 - s * 0.05, yS + 0.31, z, 1, 0.62, 1]);
    corrimaos.push([(x0 + x1) / 2, yS + 0.62, zf + 0.2, Math.abs(x1 - x0), 1, 1]);
    corrimaos.push([x1 - s * 0.05, yS + 0.62, (zf + Z_FUNDO_FACHADA) / 2, 0.3, 1, (Z_FUNDO_FACHADA - zf) / 0.26]);
    pedestais.push([x1 - s * 0.1, yS, zf + 0.2], [x0 + s * 0.15, yS, zf + 0.2]);
    pinhas.push([x1 - s * 0.1, yS + 0.86, zf + 0.2], [x0 + s * 0.15, yS + 0.86, zf + 0.2]);
    // pinhas do coroamento ao lado do ático
    pinhas.push([s * 2.2, yTopo + 1.36, zf + 0.35]);
    pedestais.push([s * 2.2, yTopo + 0.5, zf + 0.35]);
    pedestais.push([s * (LS / 2 - 0.25), yTopo + 0.5, zf + 0.35]);
  }
  // balcão da janela central, sobre o entablamento do pórtico
  for (let x = -1.15; x <= 1.15; x += 0.3) balaustres.push([x, yS + 0.28, zf - 0.6, 1, 0.55, 1]);
  corrimaos.push([0, yS + 0.55, zf - 0.6, 2.6, 1, 1]);

  return (
    <group position={[0, 0, zc]}>
      <group position={[0, 0, -zc]}>
        <mesh name="Fachada_Embasamento" geometry={geos.base} material={branco} position={[0, 0, zc]} castShadow receiveShadow />
        <mesh name="Fachada_Terreo" geometry={geos.terreo} material={reboco} position={[0, 0.02, zc]} castShadow receiveShadow />
        <mesh name="Fachada_Terreo_Frente" geometry={geos.frenteT} material={r.matFachada} position={[0, T / 2 + 0.02, zf - 0.015]} rotation-y={Math.PI} receiveShadow />
        <mesh name="Fachada_Cornija_Terreo" geometry={geos.cornijaT} material={branco} position={[0, T, zc]} castShadow receiveShadow />
        <mesh name="Fachada_Superior" geometry={geos.superior} material={reboco} position={[0, yS, zc + 0.05]} castShadow receiveShadow />
        <mesh name="Fachada_Superior_Frente" geometry={geos.frenteS} material={r.matFachada} position={[0, yS + S / 2, zf + 0.1 - 0.015]} rotation-y={Math.PI} receiveShadow />
        <Instancias nome="Fachada_Pilastras" geo={geos.pilastra} mat={branco} itens={pilastras} />
        <mesh name="Fachada_Entablamento_Portico" geometry={geos.entablamento} material={branco} position={[0, 5.37, zf - 0.5]} castShadow receiveShadow />
        <mesh name="Fachada_Cornija_Topo" geometry={geos.cornijaS} material={branco} position={[0, yTopo, zc + 0.05]} castShadow receiveShadow />
        {/* pisos dos terraços (alas e cobertura) em cimentado cinza, dentro das cornijas brancas */}
        <mesh name="Fachada_Terracos_Piso" geometry={geos.terraco} material={fab.cor("#bdb8ad", 0.95)} position={[0, yS, zc]} receiveShadow />
        <mesh name="Fachada_Cobertura_Piso" geometry={geos.coberturaPiso} material={fab.cor("#bdb8ad", 0.95)} position={[0, yTopo + 0.5, zc + 0.05]} receiveShadow />
        <mesh name="Fachada_Atico_Central" geometry={geos.atico} material={reboco} position={[0, yTopo + 0.5, zf + 0.75]} castShadow />
        <mesh name="Fachada_Brasao" geometry={geos.brasao} material={branco} position={[0, yTopo + 0.5, zf + 0.2]} castShadow />
        <mesh name="Fachada_Escadaria" geometry={geos.escada} material={fab.cor("#b9b5ab", 0.9)} position={[0, 0, zf - 0.7]} receiveShadow />
        <Instancias nome="Fachada_Colunas_Portico" geo={geos.coluna} mat={branco} itens={colunas} />
        <Instancias nome="Fachada_Capiteis_Bases" geo={geos.capitel} mat={branco} itens={capiteis} />
        <Instancias nome="Fachada_Balaustres" geo={geos.balaustre} mat={branco} itens={balaustres} sombra={false} />
        <Instancias nome="Fachada_Corrimaos" geo={geos.corrimao} mat={branco} itens={corrimaos} />
        <Instancias nome="Fachada_Pedestais" geo={geos.pedestal} mat={branco} itens={pedestais} />
        <Instancias nome="Fachada_Pinhas" geo={geos.pinha} mat={r.matOuro} itens={pinhas} />
        {/* as duas estátuas douradas nas quinas do coroamento */}
        <Instancias nome="Fachada_Estatuas_Corpo" geo={geos.corpo} mat={r.matOuro} itens={[[-(LS / 2 - 0.25), yTopo + 1.68, zf + 0.35], [LS / 2 - 0.25, yTopo + 1.68, zf + 0.35]]} />
        <Instancias nome="Fachada_Estatuas_Cabeca" geo={geos.cabeca} mat={r.matOuro} itens={[[-(LS / 2 - 0.25), yTopo + 2.35, zf + 0.35], [LS / 2 - 0.25, yTopo + 2.35, zf + 0.35]]} />
      </group>
    </group>
  );
}

/** Galerias em volta do pátio, a fachada de ferro com vitrais, a sala com a cobertura metálica e a caixa cênica */
function Corpo({ fab, r }: { fab: Fabrica; r: ReturnType<typeof useRecursos> }) {
  const reboco = fab.cor(COR.reboco, 0.88), branco = fab.cor(COR.branco, 0.7), sombra = fab.cor(COR.rebocoSombra, 0.9);
  const L = MEIA_LARGURA * 2;
  const G = 3; // largura das galerias
  const alturaSala = 10.4, alturaPalco = 14.7, alturaGaleria = 6;
  const fundoGaleria = Z_SALA - Z_FUNDO_FACHADA;
  const fundoSala = Z_FIM_PALCO - Z_SALA;
  const geos = useMemo(() => ({
    galeria: caixaChanfrada(G, alturaGaleria, fundoGaleria, 0.1),
    telhadoGaleria: telhadoQuatroAguas(G, fundoGaleria, 0.9, 0.7, 0.25),
    lateralTorre: planoMetros(Z_FIM_PALCO - Z_PALCO - 0.3, alturaPalco - alturaSala - 0.3, [2.75, 4.6]),
    fundoTorre: planoMetros(7.6, alturaPalco - alturaSala - 0.3, [2.53, 4.6]),
    fundoPalco: planoMetros(7.6, alturaSala - 0.6, [2.53, 9.8]),
    sala: caixaChanfrada(L, alturaSala, fundoSala, 0.15),
    friso: caixaChanfrada(L + 0.3, 0.35, fundoSala + 0.3, 0.08),
    palco: caixaChanfrada(7.9, alturaPalco - alturaSala, Z_FIM_PALCO - Z_PALCO, 0.12),
    palcoBase: caixaChanfrada(7.9, alturaSala, Z_FUNDO - Z_FIM_PALCO, 0.12),
    telhado: telhadoQuatroAguas(L, Z_PALCO - Z_SALA, 2.3, 0.35, 0.35),
    telhadoPalco: telhadoQuatroAguas(7.9, Z_FIM_PALCO - Z_PALCO, 1.1, 0.5, 0.2),
    lanternim: caixaChanfrada(2.2, 0.7, 3.6, 0.08),
    vitral: planoAtlas(L - 2 * G, alturaSala - 0.2, [0, 0, 1, 1]),
    lateralSala: planoMetros(fundoSala - 0.4, alturaSala - 1.2, [3, 9.2]),
    lateralGaleria: planoMetros(fundoGaleria - 0.4, alturaGaleria - 0.6, [3, 5.4]),
    patio: placaDePlanta([[-(L / 2 - G), Z_FUNDO_FACHADA], [L / 2 - G, Z_FUNDO_FACHADA], [L / 2 - G, Z_SALA], [-(L / 2 - G), Z_SALA]], 0.06),
    canteiro: caixaChanfrada(1.6, 0.4, 1.6, 0.08),
    coluneta: new THREE.CylinderGeometry(0.12, 0.12, 1, 8),
    arbusto: new THREE.IcosahedronGeometry(0.9, 1),
  }), [L, fundoGaleria, fundoSala]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  const zG = (Z_FUNDO_FACHADA + Z_SALA) / 2, zS = (Z_SALA + Z_FIM_PALCO) / 2;
  // colunetas de ferro da varanda das galerias voltada para o pátio
  const colunetas: Item[] = [];
  for (const s of [-1, 1]) for (let z = Z_FUNDO_FACHADA + 0.8; z < Z_SALA - 0.3; z += 1.6) colunetas.push([s * (L / 2 - G - 0.2), alturaGaleria / 2, z, 1, alturaGaleria, 1]);
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (L / 2 - G / 2), 0, zG]}>
          <mesh name={`Galeria_${s < 0 ? "Oeste" : "Leste"}`} geometry={geos.galeria} material={reboco} castShadow receiveShadow />
          <mesh name={`Galeria_${s < 0 ? "Oeste" : "Leste"}_Telhado`} geometry={geos.telhadoGaleria} material={r.matMetal} position-y={alturaGaleria} castShadow receiveShadow />
          <mesh name={`Galeria_${s < 0 ? "Oeste" : "Leste"}_Janelas`} geometry={geos.lateralGaleria} material={r.matLateral} position={[s * (G / 2 + 0.02), alturaGaleria / 2 - 0.1, 0]} rotation-y={(s * Math.PI) / 2} receiveShadow />
        </group>
      ))}
      <Instancias nome="Patio_Colunetas_Ferro" geo={geos.coluneta} mat={r.matFerro} itens={colunetas} />
      <mesh name="Patio_Piso" geometry={geos.patio} material={fab.cor("#e2ddd2", 0.9)} receiveShadow />
      <Instancias nome="Patio_Canteiros" geo={geos.canteiro} mat={fab.cor("#bdb6a6", 0.9)} itens={[[-2, 0, (Z_FUNDO_FACHADA + Z_SALA) / 2], [2, 0, (Z_FUNDO_FACHADA + Z_SALA) / 2]]} />
      <Instancias nome="Patio_Arbustos" geo={geos.arbusto} mat={fab.cor("#4f7d3a", 0.9)} itens={[[-2, 1.1, (Z_FUNDO_FACHADA + Z_SALA) / 2, 1, 0.9, 1], [2, 1.1, (Z_FUNDO_FACHADA + Z_SALA) / 2, 1, 0.9, 1]]} />
      {/* sala de espetáculos */}
      <mesh name="Sala_Volume" geometry={geos.sala} material={reboco} position={[0, 0, zS]} castShadow receiveShadow />
      <mesh name="Sala_Fachada_Ferro_Vitral" geometry={geos.vitral} material={r.matVitral} position={[0, (alturaSala - 0.2) / 2, Z_SALA - 0.02]} rotation-y={Math.PI} receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} name={`Sala_Lateral_${s < 0 ? "Oeste" : "Leste"}`} geometry={geos.lateralSala} material={r.matLateral} position={[s * (L / 2 + 0.02), (alturaSala - 1.2) / 2 + 0.4, zS]} rotation-y={(s * Math.PI) / 2} receiveShadow />
      ))}
      <mesh name="Sala_Friso_Cornija" geometry={geos.friso} material={branco} position={[0, alturaSala - 0.2, zS]} castShadow receiveShadow />
      <mesh name="Sala_Cobertura_Metalica" geometry={geos.telhado} material={r.matMetal} position={[0, alturaSala + 0.15, (Z_SALA + Z_PALCO) / 2]} castShadow receiveShadow />
      <mesh name="Sala_Lanternim" geometry={geos.lanternim} material={r.matMetal} position={[0, alturaSala + 1.9, (Z_SALA + Z_PALCO) / 2]} castShadow />
      {/* caixa cênica e o fundo do palco */}
      <mesh name="Palco_Caixa_Cenica" geometry={geos.palco} material={sombra} position={[0.1, alturaSala, (Z_PALCO + Z_FIM_PALCO) / 2]} castShadow receiveShadow />
      <mesh name="Palco_Cobertura" geometry={geos.telhadoPalco} material={r.matMetal} position={[0.1, alturaPalco, (Z_PALCO + Z_FIM_PALCO) / 2]} castShadow />
      <mesh name="Palco_Fundo" geometry={geos.palcoBase} material={sombra} position={[0.1, 0, (Z_FIM_PALCO + Z_FUNDO) / 2]} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} name={`Palco_Torre_Janelas_${s < 0 ? "Oeste" : "Leste"}`} geometry={geos.lateralTorre} material={r.matLateral} position={[0.1 + s * (3.95 + 0.02), (alturaSala + alturaPalco) / 2, (Z_PALCO + Z_FIM_PALCO) / 2]} rotation-y={(s * Math.PI) / 2} receiveShadow />
      ))}
      <mesh name="Palco_Torre_Janelas_Fundo" geometry={geos.fundoTorre} material={r.matLateral} position={[0.1, (alturaSala + alturaPalco) / 2, Z_FIM_PALCO + 0.02]} receiveShadow />
      <mesh name="Palco_Fundo_Janelas" geometry={geos.fundoPalco} material={r.matLateral} position={[0.1, alturaSala / 2, Z_FUNDO + 0.02]} receiveShadow />
    </group>
  );
}

/** Copa de palmeira: oito folhas compridas saindo do topo do estipe e caindo para fora */
function copaPalmeira() {
  const folhas = Array.from({ length: 8 }, (_, i) => {
    const f = new THREE.BoxGeometry(1.9, 0.05, 0.42);
    f.translate(0.95, 0, 0); f.rotateZ(-0.38 - (i % 2) * 0.22); f.rotateY((i * Math.PI) / 4 + (i % 2) * 0.3);
    return f;
  });
  const g = mergeGeometries(folhas)!;
  folhas.forEach((f) => f.dispose());
  return g;
}

/** Copas e troncos de árvores e palmeiras (jardim de Burle Marx e praça) */
function Vegetacao({ fab, arvores, palmeiras }: { fab: Fabrica; arvores: [number, number, number][]; palmeiras: [number, number][] }) {
  const geos = useMemo(() => ({
    copa: new THREE.IcosahedronGeometry(1, 1),
    tronco: new THREE.CylinderGeometry(0.14, 0.2, 1, 6),
    estipe: new THREE.CylinderGeometry(0.12, 0.17, 1, 6),
    folhas: copaPalmeira(),
  }), []);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  const tons = ["#4f7d3a", "#5b8a3f", "#46733a", "#62913f"];
  return (
    <>
      <Instancias nome="Arvores_Troncos" geo={geos.tronco} mat={fab.cor("#6b5440", 0.9)} itens={arvores.map(([x, z, e]) => [x, e * 1.1, z, e, e * 2.2, e])} />
      <Instancias nome="Arvores_Copas" geo={geos.copa} mat={fab.cor("#ffffff", 0.9)} cores={tons} itens={arvores.map(([x, z, e], i) => [x, e * 3.1, z, e * 1.9, e * 1.5, e * 1.9, i])} />
      <Instancias nome="Palmeiras_Estipes" geo={geos.estipe} mat={fab.cor("#9c9282", 0.9)} itens={palmeiras.map(([x, z], i) => [x, 3.4 + (i % 3) * 0.4, z, 1, 6.8 + (i % 3) * 0.8, 1])} />
      <Instancias nome="Palmeiras_Copas" geo={geos.folhas} mat={fab.cor("#4d7f3c", 0.85)} itens={palmeiras.map(([x, z], i) => [x, 6.9 + (i % 3) * 0.8, z, 1, 1, 1, i * 0.7])} />
    </>
  );
}

/** Canteiros sinuosos (contorno de bolha com ondulações) */
function bolha(cx: number, cz: number, rx: number, rz: number, semente: number, n = 22): [number, number][] {
  const rnd = aleatorio(semente), f1 = 2 + Math.floor(rnd() * 2), fase = rnd() * 6;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, k = 1 + 0.18 * Math.sin(a * f1 + fase);
    return [cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k] as [number, number];
  });
}

/** Retângulo [x0, x1] × [z0, z1] recortado pelo disco de raio R (polígono convexo, ordenado pelo ângulo) */
function retanguloNoDisco(x0: number, x1: number, z0: number, z1: number, R: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) pts.push([x, z]);
  }
  const borda: [number, number][] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = borda[k], [bx, bz] = borda[(k + 1) % 4];
    for (let t = 0; t <= 1; t += 1 / 64) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (Math.hypot(x, z) <= R) pts.push([x, z]); }
  }
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.sort((a, b) => Math.atan2(a[1] - cz, a[0] - cx) - Math.atan2(b[1] - cz, b[0] - cx));
}

/** Entorno: calçada, Praça José de Alencar em frente, jardim de Burle Marx a leste, Rua 24 de Maio e casario a oeste */
function Entorno({ fab, r }: { fab: Fabrica; r: ReturnType<typeof useRecursos> }) {
  const xJ0 = MEIA_LARGURA + X0 + 1.2, zJ0 = Z_FUNDO_FACHADA - 2, xJ1 = 23.5;
  const geos = useMemo(() => {
    const disco = new THREE.CircleGeometry(32.6, 64);
    disco.rotateX(-Math.PI / 2); disco.translate(0, 0.03, 0);
    const deitar = (formas: [number, number][][], y: number) => {
      const g = new THREE.ShapeGeometry(formas.map((p) => new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z)))));
      g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
      return g;
    };
    // canteiros orgânicos de Burle Marx no gramado do jardim
    const canteiros = [bolha(9, -6, 3, 2.2, 3), bolha(16, 1, 2.6, 3.4, 7), bolha(8.5, 8, 2.4, 3, 11), bolha(17.5, 11, 2.2, 1.8, 13), bolha(14.5, -9.5, 2.4, 1.4, 17)];
    const flores = [bolha(11.5, -2, 1.1, 0.8, 21), bolha(13, 7.5, 1.0, 1.3, 23), bolha(20, -6, 1.2, 0.9, 29)];
    // caminho sinuoso de pedra no gramado
    const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(6, 0, -13.5), new THREE.Vector3(12.5, 0, -5), new THREE.Vector3(11.5, 0, 3), new THREE.Vector3(16, 0, 7.5), new THREE.Vector3(21, 0, 14)]);
    const esq: [number, number][] = [], dir: [number, number][] = [];
    curva.getPoints(40).forEach((p, i) => {
      const t = curva.getTangent(i / 40), nx = -t.z, nz = t.x;
      esq.push([p.x + nx * 0.65, p.z + nz * 0.65]); dir.push([p.x - nx * 0.65, p.z - nz * 0.65]);
    });
    return {
      disco,
      praca: placaDePlanta(retanguloNoDisco(-40, 40, -40, Z_FRENTE - 0.2, 32.6), 0.07),
      rua: placaDePlanta(retanguloNoDisco(-19.4, -14.6, Z_FRENTE - 0.2, 40, 32.6), 0.05),
      jardim: placaDePlanta(retanguloNoDisco(xJ0, xJ1, zJ0, 22, 32.4), 0.1),
      canteiros: deitar(canteiros, 0.14),
      flores: deitar(flores, 0.17),
      caminho: placaDePlanta([...esq, ...dir.reverse()], 0.13),
      mureta: caixaChanfrada(1, 0.6, 0.35, 0.06),
      pilar: caixaChanfrada(0.55, 1.9, 0.55, 0.06),
      grade: new THREE.BoxGeometry(0.05, 1, 0.05),
      trilho: new THREE.BoxGeometry(1, 0.06, 0.07),
      tapete: placaDePlanta([[X0 - 5, Z_FRENTE - 1.4], [X0 + 5, Z_FRENTE - 1.4], [X0 + 5, Z_FRENTE - 7.4], [X0 - 5, Z_FRENTE - 7.4]], 0.09),
      baliza: new THREE.CylinderGeometry(0.12, 0.12, 1, 8),
      faixa: new THREE.CylinderGeometry(0.125, 0.125, 1, 8),
      casa: caixaChanfrada(1, 1, 1, 0.08),
      telhaCasa: telhadoQuatroAguas(1, 1, 0.5, 0.2, 0.05),
    };
  }, [xJ0, zJ0]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  // mureta ocre com gradil preto e pilares: frente do jardim (lado da praça) e lado da Rua General Sampaio
  const muretas: Item[] = [], grades: Item[] = [], trilhos: Item[] = [], pilares: Item[] = [];
  for (let x = xJ0; x < xJ1 - 0.5; x += 3) {
    const w = Math.min(3, xJ1 - x);
    muretas.push([x + w / 2, 0, zJ0, w, 1, 1]); trilhos.push([x + w / 2, 1.5, zJ0, w, 1, 1]); pilares.push([x, 0, zJ0]);
    for (let b = 0.3; b < w - 0.1; b += 0.3) grades.push([x + b, 1.05, zJ0, 1, 0.9, 1]);
  }
  for (let z = zJ0; z < 15; z += 3) {
    muretas.push([xJ1, 0, z + 1.5, 3, 1, 1, Math.PI / 2]); trilhos.push([xJ1, 1.5, z + 1.5, 3, 1, 1, Math.PI / 2]); pilares.push([xJ1, 0, z]);
    for (let b = 0.3; b < 2.9; b += 0.3) grades.push([xJ1, 1.05, z + b, 1, 0.9, 1]);
  }
  // balizadores pretos e brancos ao longo da praça, diante da fachada
  const balizas: Item[] = [], faixas: Item[] = [];
  for (let x = -18; x <= 22; x += 1.6) {
    if (Math.abs(x - X0) < 3.4) continue;
    balizas.push([x, 0.5, Z_FRENTE - 2.8]);
    faixas.push([x, 0.55, Z_FRENTE - 2.8, 1, 0.22, 1], [x, 0.9, Z_FRENTE - 2.8, 1, 0.12, 1]);
  }
  // casario térreo do outro lado da Rua 24 de Maio, a oeste
  const casas: Item[] = [], telhas: Item[] = [], cores: string[] = [];
  const rnd = aleatorio(24);
  for (let z = -13.8; z < 14; z += 5.2) {
    const h = 2.8 + rnd() * 1.6;
    casas.push([-23.3, 0, z, 6, h, 4.8]);
    telhas.push([-23.3, h, z, 6, 1.6, 4.8]);
    cores.push(["#e9dcc3", "#f0e6d4", "#d9cba8", "#e6d2bd", "#cfd8c6"][Math.floor(rnd() * 5)]);
  }
  const arvores: [number, number, number][] = [[-15, -25, 1.1], [10, -25.5, 1.05], [16.5, -22.5, 1.1], [21.5, -17.5, 0.95], [22, 4, 1.1], [7.5, 15, 1.2], [19.5, 18.5, 0.9], [8, 2.5, 0.85], [-16.8, 18, 0.8]];
  const palmeiras: [number, number][] = [[-18, -21.5], [-21, -17.8], [12.5, -2.5], [10.5, -7.5], [18.5, -2], [15, 13], [6.5, -10], [21, 8.5]];
  return (
    <>
      <mesh name="Chao_Calcada" geometry={geos.disco} material={fab.cor(COR.calcada, 0.95)} receiveShadow />
      <mesh name="Praca_Jose_de_Alencar_Piso" geometry={geos.praca} material={fab.cor("#cdc8bd", 0.95)} receiveShadow />
      <mesh name="Praca_Tapete_Circulos" geometry={geos.tapete} material={r.matPraca} receiveShadow />
      <mesh name="Rua_24_de_Maio" geometry={geos.rua} material={fab.cor(COR.asfalto, 0.95)} receiveShadow />
      <mesh name="Jardim_Burle_Marx_Gramado" geometry={geos.jardim} material={fab.cor(COR.grama, 0.95)} receiveShadow />
      <mesh name="Jardim_Burle_Marx_Canteiros" geometry={geos.canteiros} material={fab.cor("#3f6e33", 0.95)} receiveShadow />
      <mesh name="Jardim_Burle_Marx_Flores" geometry={geos.flores} material={fab.cor("#c8513c", 0.85)} receiveShadow />
      <mesh name="Jardim_Burle_Marx_Caminho" geometry={geos.caminho} material={fab.cor("#e4dccb", 0.9)} receiveShadow />
      <Instancias nome="Jardim_Mureta" geo={geos.mureta} mat={fab.cor(COR.ocre, 0.85)} itens={muretas} />
      <Instancias nome="Jardim_Gradil_Barras" geo={geos.grade} mat={r.matFerro} itens={grades} sombra={false} />
      <Instancias nome="Jardim_Gradil_Trilhos" geo={geos.trilho} mat={r.matFerro} itens={trilhos} sombra={false} />
      <Instancias nome="Jardim_Pilares" geo={geos.pilar} mat={fab.cor(COR.ocre, 0.85)} itens={pilares} />
      <Instancias nome="Praca_Balizadores" geo={geos.baliza} mat={fab.cor("#f1f0ea", 0.6)} itens={balizas} sombra={false} />
      <Instancias nome="Praca_Balizadores_Faixas" geo={geos.faixa} mat={fab.cor("#1e1f22", 0.6)} itens={faixas} sombra={false} />
      <Instancias nome="Casario_Oeste" geo={geos.casa} mat={fab.cor("#ffffff", 0.9)} itens={casas} cores={cores} />
      <Instancias nome="Casario_Oeste_Telhados" geo={geos.telhaCasa} mat={fab.cor("#b8603a", 0.85)} itens={telhas} />
      <Vegetacao fab={fab} arvores={arvores} palmeiras={palmeiras} />
    </>
  );
}

export function TheatroJoseDeAlencar({ fab }: { fab: Fabrica }) {
  const r = useRecursos();
  return (
    <group rotation-y={-THREE.MathUtils.degToRad(RUMO)}>
      <Entorno fab={fab} r={r} />
      <group position-x={X0}>
        <Fachada fab={fab} r={r} />
        <Corpo fab={fab} r={r} />
      </group>
    </group>
  );
}
