import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Fabrica } from "../../Cena";
import { aleatorio, texturaManchada } from "../../util/geometria";

/**
 * Reitoria da UFC, o antigo palacete da família Gentil (1918) no Benfica, ampliado em planta H pela UFC
 * depois de 1956 (pesquisa/reitoriaUfc/ficha.md).
 * Planta do OSM (way/371206594):
 * - 77 × 44 m, com o eixo maior paralelo à Av. da Universidade;
 * - pátio da frente voltado para 311° (noroeste);
 * - o palacete com o torreão é a ponta noroeste da ala nordeste.
 * Escala: K = 0,6 na planta e alturas reais, o que dá um exagero vertical de ~1,7× sobre K.
 * Eixos locais: +x ao longo do eixo maior (para sudoeste), +z para a frente (noroeste). Metros, base em y = 0.
 */
const K = 0.6;
const GIRO = THREE.MathUtils.degToRad(180 - 311); // +z local aponta para o rumo 311°

/** Medidas da miniatura (m), tiradas da planta do OSM × K */
const X0 = 23.1; // meia-largura do H (77 m)
const Z0 = 13.2; // meia-profundidade (44 m)
const XA = 12.54; // face interna das alas (alas de 17,6 m)
const ZF = 5.1; // fundo do pátio da frente (13,5 m de recuo)
const ZT = -5.5; // fundo do pátio de trás
const VAR = 1.8; // varanda de 3 m
const HP = 0.6; // embasamento
const Y1 = 4.6; // piso do pavimento superior
const YC = 8.4; // cornija
const YP = 9.25; // topo da platibanda

/** Altura da etiqueta com o nome no tour (topo do torreão + ~2 m) */
export const ALTURA_ETIQUETA = 17;

const COR = {
  reboco: "#f2ae99",
  branco: "#f3f0e8",
  embasamento: "#d6d0c4",
  laje: "#c2bab0",
  piso: "#cdc6b8",
  gramado: "#79a04f",
  asfalto: "#5f6264",
  sebe: "#3f6a33",
  tronco: "#6e5644",
};

type Xz = [number, number];
type V3 = [number, number, number];

/** Acumula faces por material (posição, normal e UV em metros) e devolve uma geometria por chave */
class Construtor {
  partes = new Map<string, { p: number[]; n: number[]; uv: number[] }>();
  private parte(ch: string) {
    let q = this.partes.get(ch);
    if (!q) this.partes.set(ch, (q = { p: [], n: [], uv: [] }));
    return q;
  }
  /** Triângulo com a normal dada; a ordem dos vértices é corrigida para a face olhar para a normal */
  tri(ch: string, a: V3, b: V3, c: V3, n: V3, ua: Xz, ub: Xz, uc: Xz) {
    const q = this.parte(ch);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const d = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
    const pts = d >= 0 ? [a, b, c] : [a, c, b];
    const uvs = d >= 0 ? [ua, ub, uc] : [ua, uc, ub];
    for (let i = 0; i < 3; i++) { q.p.push(...pts[i]); q.n.push(...n); q.uv.push(...uvs[i]); }
  }
  quad(ch: string, a: V3, b: V3, c: V3, d: V3, n: V3, ua: Xz, ub: Xz, uc: Xz, ud: Xz) {
    this.tri(ch, a, b, c, n, ua, ub, uc);
    this.tri(ch, a, c, d, n, ua, uc, ud);
  }
  geometria(ch: string) {
    const q = this.partes.get(ch);
    if (!q) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(q.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(q.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(q.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Prisma vertical de planta qualquer (pontos [x, z]) de y0 a y1: lados em `lado`, tampa em `topo` (null = sem
 * tampa) e fundo em `base` (só onde se vê por baixo, como lajes de varanda). UV dos lados: perímetro × altura.
 */
function prisma(C: Construtor, lado: string, topo: string | null, pts: Xz[], y0: number, y1: number, base: string | null = null) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length]; area += ax * bz - bx * az; }
  const s = area > 0 ? 1 : -1;
  let u = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-6) continue;
    const n: V3 = [(s * (bz - az)) / L, 0, (-s * (bx - ax)) / L];
    C.quad(lado, [ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], n, [u, y0], [u + L, y0], [u + L, y1], [u, y1]);
    u += L;
  }
  const tampa = (ch: string, y: number, ny: number) => {
    const tris = THREE.ShapeUtils.triangulateShape(pts.map(([x, z]) => new THREE.Vector2(x, z)), []);
    for (const [a, b, c] of tris) C.tri(ch, [pts[a][0], y, pts[a][1]], [pts[b][0], y, pts[b][1]], [pts[c][0], y, pts[c][1]], [0, ny, 0], pts[a], pts[b], pts[c]);
  };
  if (topo) tampa(topo, y1, 1);
  if (base) tampa(base, y0, -1);
}

/** Retângulo centrado em (cx, cz), com os cantos chanfrados em `c` e girado `giro` rad em volta do centro */
function retangulo(cx: number, cz: number, w: number, d: number, c = 0, giro = 0): Xz[] {
  const x = w / 2, z = d / 2;
  const base: Xz[] = c > 0
    ? [[-x + c, -z], [x - c, -z], [x, -z + c], [x, z - c], [x - c, z], [-x + c, z], [-x, z - c], [-x, -z + c]]
    : [[-x, -z], [x, -z], [x, z], [-x, z]];
  const co = Math.cos(giro), si = Math.sin(giro);
  return base.map(([px, pz]) => [cx + px * co + pz * si, cz - px * si + pz * co]);
}

/** Caixa de x0..x1 × z0..z1 (cantos, não centro), útil para as massas alinhadas da planta em H */
function caixaXZ(C: Construtor, lado: string, topo: string | null, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, c = 0, base: string | null = null) {
  prisma(C, lado, topo, retangulo((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, c), y0, y1, base);
}

/** Junta geometrias (com ou sem índice) numa só, só com posição, normal e UV */
function juntar(geos: THREE.BufferGeometry[]) {
  const limpas = geos.map((g) => {
    const h = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(h.attributes)) if (!["position", "normal", "uv"].includes(k)) h.deleteAttribute(k);
    return h;
  });
  const m = mergeGeometries(limpas, false)!;
  limpas.forEach((g) => g.dispose());
  return m;
}

/** Matriz de instância: posição, giro em y e escala (não uniforme) */
function mat4(x: number, y: number, z: number, giro = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), giro), new THREE.Vector3(sx, sy, sz));
}

function instancias(nome: string, geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[], cores?: string[], sombra = true) {
  const im = new THREE.InstancedMesh(geo, mat, ms.length);
  im.name = nome;
  const c = new THREE.Color();
  ms.forEach((m, i) => { im.setMatrixAt(i, m); if (cores) im.setColorAt(i, c.set(cores[i % cores.length])); });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = sombra;
  im.receiveShadow = true;
  im.computeBoundingSphere();
  return im;
}

function texturaCanvas(cv: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Folha de janela/porta: venezianas de madeira clara, bandeira de vidro escuro no alto (0..1 em u e v) */
function texturaVeneziana() {
  const cv = document.createElement("canvas");
  cv.width = 64; cv.height = 128;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#e4dccb"; g.fillRect(0, 0, 64, 128);
  g.fillStyle = "#34414d"; g.fillRect(0, 0, 64, 30); // bandeira de vidro
  g.fillStyle = "#e9e4d8"; g.fillRect(30, 0, 4, 30); g.fillRect(0, 14, 64, 3);
  g.fillStyle = "#cfc5b0"; g.fillRect(0, 30, 64, 4);
  for (let y = 38; y < 124; y += 5) { g.fillStyle = "#b9ad95"; g.fillRect(4, y, 56, 2); }
  g.fillStyle = "#a89c84"; g.fillRect(31, 30, 2, 98); // encontro das duas folhas
  return texturaCanvas(cv);
}

/** Balaústres brancos em vaso com corrimão e rodapé; fundo transparente (alphaTest). Um módulo = 1,2 m × 0,9 m */
function texturaBalaustrada() {
  const cv = document.createElement("canvas");
  cv.width = 128; cv.height = 96;
  const g = cv.getContext("2d")!;
  g.clearRect(0, 0, 128, 96);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 128, 14); // corrimão
  g.fillRect(0, 84, 128, 12); // rodapé
  for (let i = 0; i < 6; i++) {
    const cx = 10.7 + i * 21.3;
    g.beginPath(); g.ellipse(cx, 56, 7, 16, 0, 0, Math.PI * 2); g.fill(); // bojo do vaso
    g.fillRect(cx - 3.5, 14, 7, 70); // haste
    g.fillRect(cx - 6, 14, 12, 6); g.fillRect(cx - 6, 78, 12, 6); // cabeça e pé
  }
  const t = texturaCanvas(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Faixa de balaustrada (plano vertical) entre dois pontos, de y a y + 0,9; UV repete a cada 1,2 m */
function balaustrada(lista: THREE.BufferGeometry[], ax: number, az: number, bx: number, bz: number, y: number, h = 0.9) {
  const L = Math.hypot(bx - ax, bz - az);
  const g = new THREE.PlaneGeometry(L, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (L / 1.2));
  g.rotateY(-Math.atan2(bz - az, bx - ax));
  g.translate((ax + bx) / 2, y + h / 2, (az + bz) / 2);
  lista.push(g);
}

/** Moldura de vão (retângulo ou arco pleno) com peitoril e, nos retos, cimalha; voltada para +z, centro na origem */
function geometriaMoldura(w: number, h: number, arco: boolean, b = 0.14, d = 0.1) {
  const fora = new THREE.Shape(), dentro = new THREE.Path();
  const desenha = (s: THREE.Shape | THREE.Path, W: number, H: number) => {
    const x = W / 2, y = H / 2;
    s.moveTo(-x, -y); s.lineTo(x, -y);
    if (arco) { s.lineTo(x, y - x); s.absarc(0, y - x, x, 0, Math.PI, false); } else { s.lineTo(x, y); s.lineTo(-x, y); }
    s.lineTo(-x, -y);
  };
  desenha(fora, w + 2 * b, h + 2 * b);
  desenha(dentro, w, h);
  fora.holes.push(dentro);
  const partes: THREE.BufferGeometry[] = [new THREE.ExtrudeGeometry(fora, { depth: d, bevelEnabled: false, curveSegments: 8 })];
  const peitoril = new THREE.BoxGeometry(w + 2 * b + 0.16, 0.1, d + 0.1);
  peitoril.translate(0, -h / 2 - b - 0.03, d / 2 + 0.03);
  partes.push(peitoril);
  if (!arco) {
    const cimalha = new THREE.BoxGeometry(w + 2 * b + 0.22, 0.13, d + 0.12);
    cimalha.translate(0, h / 2 + b + 0.06, d / 2 + 0.04);
    partes.push(cimalha);
  }
  return juntar(partes);
}

/** Folha do vão (com a textura de veneziana mapeada de 0 a 1), um pouco à frente da parede */
function geometriaFolha(w: number, h: number, arco: boolean) {
  const s = new THREE.Shape();
  const x = w / 2, y = h / 2;
  s.moveTo(-x, -y); s.lineTo(x, -y);
  if (arco) { s.lineTo(x, y - x); s.absarc(0, y - x, x, 0, Math.PI, false); } else { s.lineTo(x, y); s.lineTo(-x, y); }
  s.lineTo(-x, -y);
  const g = new THREE.ShapeGeometry(s, 8);
  const p = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + x) / w, (p.getY(i) + y) / h);
  g.translate(0, 0, 0.02);
  return g;
}

/** Coluna jônica simplificada em torno (base, fuste com êntase leve, capitel), 3,7 m de altura de referência */
function geometriaColuna() {
  const perfil = [[0.27, 0], [0.27, 0.12], [0.21, 0.19], [0.19, 0.3], [0.17, 1.6], [0.155, 3.22], [0.2, 3.36], [0.27, 3.5], [0.29, 3.58], [0.29, 3.7]].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(perfil, 10);
}

type Vao = { x: number; y: number; z: number; giro: number };

/** Vãos espaçados igualmente ao longo de uma parede (de a até b), com a face voltada para a normal (nx, nz) */
function vaosNaParede(lista: Vao[], ax: number, az: number, bx: number, bz: number, nx: number, nz: number, passo: number, y: number) {
  const L = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.floor(L / passo));
  const giro = Math.atan2(nx, nz);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    lista.push({ x: ax + (bx - ax) * t + nx * 0.005, y, z: az + (bz - az) * t + nz * 0.005, giro });
  }
}

function construir(fab: Fabrica) {
  const grupo = new THREE.Group();
  const C = new Construtor();
  const descartar: { dispose(): void }[] = [];

  // ---------- Materiais ----------
  const manchaReboco = texturaManchada("#ffffff", 0.05, 11, 64);
  manchaReboco.repeat.set(1 / 6, 1 / 6);
  const manchaGrama = texturaManchada("#ffffff", 0.1, 12, 64);
  manchaGrama.repeat.set(1 / 9, 1 / 9);
  const tVeneziana = texturaVeneziana();
  const tBalaustre = texturaBalaustrada();
  descartar.push(manchaReboco, manchaGrama, tVeneziana, tBalaustre);
  const M = {
    reboco: new THREE.MeshStandardMaterial({ name: "Mat_Reboco_Rosa", color: COR.reboco, map: manchaReboco, roughness: 0.88 }),
    branco: new THREE.MeshStandardMaterial({ name: "Mat_Estuque_Branco", color: COR.branco, roughness: 0.62 }),
    embasamento: new THREE.MeshStandardMaterial({ name: "Mat_Embasamento_Pedra", color: COR.embasamento, roughness: 0.92 }),
    laje: new THREE.MeshStandardMaterial({ name: "Mat_Cobertura_Laje", color: COR.laje, map: manchaReboco, roughness: 0.95 }),
    piso: new THREE.MeshStandardMaterial({ name: "Mat_Piso_Calcada", color: COR.piso, roughness: 0.9 }),
    gramado: new THREE.MeshStandardMaterial({ name: "Mat_Gramado", color: COR.gramado, map: manchaGrama, roughness: 0.97 }),
    asfalto: new THREE.MeshStandardMaterial({ name: "Mat_Asfalto", color: COR.asfalto, roughness: 0.95 }),
    folha: new THREE.MeshStandardMaterial({ name: "Mat_Veneziana_Madeira", map: tVeneziana, roughness: 0.6 }),
    balaustre: new THREE.MeshStandardMaterial({ name: "Mat_Balaustrada", color: COR.branco, map: tBalaustre, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.62 }),
    copa: new THREE.MeshStandardMaterial({ name: "Mat_Copa_Arvores", color: "#ffffff", roughness: 0.9, flatShading: true }),
    tronco: fab.cor(COR.tronco, 0.95),
    sebe: new THREE.MeshStandardMaterial({ name: "Mat_Sebe", color: COR.sebe, roughness: 0.95, flatShading: true }),
    metal: new THREE.MeshStandardMaterial({ name: "Mat_Metal_Mastro", color: "#c9ccd0", roughness: 0.35, metalness: 0.6 }),
  };
  M.tronco.name = "Mat_Tronco";
  descartar.push(...Object.values(M));

  // ---------- Chão: gramado, via interna diante do palacete e calçadas ----------
  const chao = new THREE.Mesh(new THREE.CircleGeometry(33.2, 64).rotateX(-Math.PI / 2).translate(0, 0.02, 0), M.gramado);
  chao.name = "Gramado_Jardins";
  chao.receiveShadow = true;
  grupo.add(chao);
  // via interna asfaltada que passa diante da frente (foto 05), com meio-fio branco
  caixaXZ(C, "asfalto", "asfalto", -25.6, 25.6, 16.4, 20.2, 0, 0.06);
  caixaXZ(C, "branco", "branco", -27.4, 27.4, 16.2, 16.4, 0, 0.14);
  caixaXZ(C, "branco", "branco", -25.4, 25.4, 20.2, 20.4, 0, 0.14);
  // calçada de pedra em volta do embasamento e caminho do pátio da frente até a via
  prisma(C, "piso", "piso", [[-X0 - 1.4, -Z0 - 1.4], [-XA + 0.6, -Z0 - 1.4], [-XA + 0.6, ZT + 0.01], [XA - 0.6, ZT + 0.01], [XA - 0.6, -Z0 - 1.4], [X0 + 1.4, -Z0 - 1.4], [X0 + 1.4, Z0 + 1.4], [XA - 0.6, Z0 + 1.4], [XA - 0.6, ZF - 0.01], [-XA + 0.6, ZF - 0.01], [-XA + 0.6, Z0 + 1.4], [-X0 - 1.4, Z0 + 1.4]], 0, 0.08);
  caixaXZ(C, "piso", "piso", -1.1, 1.1, -Z0 - 1.4, ZT, 0, 0.08); // passeio no eixo do jardim de trás
  caixaXZ(C, "piso", "piso", -18.8, -15.2, Z0 + 1.4, 16.2, 0, 0.08);
  caixaXZ(C, "piso", "piso", -1.3, 1.3, ZF, 16.2, 0, 0.08);

  // ---------- Embasamento em H (0,6 m) com degraus diante do pórtico ----------
  const H: Xz[] = [[-X0, -Z0], [-XA, -Z0], [-XA, ZT], [XA, ZT], [XA, -Z0], [X0, -Z0], [X0, Z0], [XA, Z0], [XA, ZF], [-XA, ZF], [-XA, Z0], [-X0, Z0]];
  prisma(C, "embasamento", "piso", H, 0, HP);
  const PC = -17.0; // eixo do pórtico do palacete
  const TX = -X0 + 1.6, TZ = Z0 - 1.6; // centro do torreão
  const ZP = Z0 + 0.8; // frente do pórtico
  caixaXZ(C, "embasamento", "piso", PC - 1.9, PC + 1.9, Z0 - 0.01, ZP + 0.15, 0, HP); // patamar do pórtico
  caixaXZ(C, "embasamento", "piso", PC - 1.9, PC + 1.9, ZP + 0.15, ZP + 0.5, 0, 0.4); // dois degraus
  caixaXZ(C, "embasamento", "piso", PC - 2.1, PC + 2.1, ZP + 0.5, ZP + 0.85, 0, 0.2);
  // degraus do pátio da frente
  caixaXZ(C, "embasamento", "piso", -2.4, 2.4, ZF - 0.01, ZF + 0.7, 0, 0.3);

  // ---------- Massas das alas e do corpo central (paredes até a platibanda) ----------
  const XI = XA + VAR; // face das paredes internas das alas (atrás das varandas dos pátios)
  const XE = -X0 + VAR; // parede externa da ala nordeste (atrás da varanda externa)
  const massas: [number, number, number, number][] = [
    [XE, -XI, -Z0, 5.6], // ala nordeste, parte de trás
    [XE, -XI, 5.6, Z0], // palacete (ponta noroeste da ala nordeste)
    [-XI, XI, ZT + VAR, ZF - VAR], // corpo central
    [XI, X0, -Z0, Z0], // ala sudoeste
  ];
  massas.forEach(([x0, x1, z0, z1], i) => {
    const palacete = i === 1;
    const topo = palacete ? YC + 0.35 : YP;
    caixaXZ(C, "reboco", "laje", x0, x1, z0, z1, HP, topo, 0.12);
    // cornija branca saliente e remate da platibanda
    caixaXZ(C, "branco", "branco", x0 - 0.24, x1 + 0.24, z0 - 0.24, z1 + 0.24, YC, YC + 0.35, 0.1, "branco");
    caixaXZ(C, "branco", "branco", x0 - 0.12, x1 + 0.12, z0 - 0.12, z1 + 0.12, Y1 - 0.18, Y1 + 0.12, 0.06, "branco"); // friso entre pavimentos
    caixaXZ(C, "branco", "branco", x0 - 0.06, x1 + 0.06, z0 - 0.06, z1 + 0.06, HP, HP + 0.45, 0.04); // rodapé
    if (!palacete) {
      for (const [a, b, c, d] of [[x0 - 0.1, x1 + 0.1, z0 - 0.1, z0 + 0.22], [x0 - 0.1, x1 + 0.1, z1 - 0.22, z1 + 0.1], [x0 - 0.1, x0 + 0.22, z0 + 0.22, z1 - 0.22], [x1 - 0.22, x1 + 0.1, z0 + 0.22, z1 - 0.22]])
        caixaXZ(C, "branco", "branco", a, b, c, d, YP, YP + 0.14);
    }
    // pilastras brancas nos quatro cantos
    for (const [px, pz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) caixaXZ(C, "branco", null, px - 0.2, px + 0.2, pz - 0.2, pz + 0.2, HP + 0.45, YC, 0.05);
  });

  // ---------- Varandas: colunas no térreo, laje que vira sacada, balaustrada ----------
  const colunas: THREE.Matrix4[] = [];
  const balaustres: THREE.BufferGeometry[] = [];
  /** Varanda ao longo de uma borda (a → b), com a parede recuada VAR para dentro (normal para fora nx, nz) */
  const varanda = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number, sacada = true) => {
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.round(L / 2.15));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      colunas.push(mat4(ax + (bx - ax) * t - nx * 0.32, HP, az + (bz - az) * t - nz * 0.32));
    }
    // laje: faixa entre a borda e a parede, com a testeira branca
    const px = -nx * VAR, pz = -nz * VAR;
    const faixa: Xz[] = [[ax, az], [bx, bz], [bx + px, bz + pz], [ax + px, az + pz]];
    prisma(C, "branco", "piso", faixa, Y1 - 0.32, Y1, "branco");
    if (sacada) balaustrada(balaustres, ax - nx * 0.12, az - nz * 0.12, bx - nx * 0.12, bz - nz * 0.12, Y1);
  };
  // pátio da frente: fundo e laterais das alas
  varanda(-XA, ZF, XA, ZF, 0, 1);
  varanda(-XA, ZF, -XA, Z0, 1, 0);
  varanda(XA, Z0, XA, ZF, -1, 0);
  // pátio de trás
  varanda(XA, ZT, -XA, ZT, 0, -1);
  varanda(-XA, -Z0, -XA, ZT, 1, 0);
  varanda(XA, ZT, XA, -Z0, -1, 0);
  // lado externo nordeste (foto 02), até o torreão
  varanda(-X0, -Z0, -X0, 9.6, -1, 0);
  // os cantos das varandas internas se cruzam: tira a coluna repetida de cada canto
  const vistas = new Set<string>();
  const colunasUnicas = colunas.filter((m) => { const p = new THREE.Vector3().setFromMatrixPosition(m); const k = `${p.x.toFixed(1)}|${p.z.toFixed(1)}`; if (vistas.has(k)) return false; vistas.add(k); return true; });

  // ---------- Palacete: pórtico com dois pares de colunas, sacada, loggia com arco e frontão ----------
  caixaXZ(C, "reboco", "laje", PC - 1.55, PC + 1.55, Z0 - 0.1, Z0 + 0.25, HP, YC, 0.05); // avanço do corpo do pórtico
  prisma(C, "branco", "piso", retangulo(PC, (Z0 + ZP) / 2, 3.5, ZP - Z0 + 0.2), Y1 - 0.3, Y1, "branco"); // laje da sacada
  balaustrada(balaustres, PC - 1.72, ZP - 0.08, PC + 1.72, ZP - 0.08, Y1);
  caixaXZ(C, "branco", "branco", PC - 1.75, PC + 1.75, Z0, ZP + 0.1, YC - 0.55, YC, 0.05, "branco"); // entablamento da loggia
  for (const dx of [-1.25, -0.65, 0.65, 1.25]) {
    colunasUnicas.push(mat4(PC + dx, HP, ZP - 0.35));
    colunasUnicas.push(mat4(PC + dx * 0.95, Y1, ZP - 0.35, 0, 0.85, (YC - 0.55 - Y1) / 3.7, 0.85));
  }
  // arco da loggia entre o par do meio
  const arco = new THREE.TorusGeometry(0.58, 0.12, 6, 12, Math.PI);
  arco.translate(PC, YC - 1.3, ZP - 0.35);
  // frontão (ático) acima da cornija: bloco com cimalha, voluta central e dois pináculos
  caixaXZ(C, "reboco", "laje", PC - 1.45, PC + 1.45, Z0 - 0.3, Z0 + 0.35, YC + 0.35, YC + 1.6, 0.05);
  caixaXZ(C, "branco", "branco", PC - 1.6, PC + 1.6, Z0 - 0.4, Z0 + 0.45, YC + 1.6, YC + 1.8, 0.05, "branco");
  const voluta = new THREE.CylinderGeometry(0.75, 0.75, 0.3, 14, 1, false, -Math.PI / 2, Math.PI);
  voluta.rotateX(-Math.PI / 2); voluta.translate(PC, YC + 1.8, Z0 + 0.05);
  const pinaculos: THREE.Matrix4[] = [mat4(PC - 1.42, YC + 1.8, Z0 + 0.05), mat4(PC + 1.42, YC + 1.8, Z0 + 0.05), mat4(PC, YC + 2.55, Z0 + 0.05, 0, 0.8, 0.8, 0.8)];
  // balaustrada no alto do palacete (fotos 02 e 05), dos dois lados do frontão e nas laterais
  const yb = YC + 0.35;
  balaustrada(balaustres, TX + 2.1, Z0 - 0.15, PC - 1.6, Z0 - 0.15, yb);
  balaustrada(balaustres, PC + 1.6, Z0 - 0.15, -XI - 0.1, Z0 - 0.15, yb);
  balaustrada(balaustres, -XI - 0.15, Z0 - 0.1, -XI - 0.15, 5.7, yb);
  balaustrada(balaustres, XE + 0.15, 5.7, XE + 0.15, 9.6, yb);

  // ---------- Torreão de cantos chanfrados no canto norte do palacete ----------
  const torreBaixa = retangulo(TX, TZ, 4.0, 4.0, 0.95);
  const torreAlta = retangulo(TX, TZ, 3.3, 3.3, 0.78);
  prisma(C, "reboco", null, torreBaixa, HP, YC);
  prisma(C, "branco", "branco", retangulo(TX, TZ, 4.45, 4.45, 1.05), YC, YC + 0.38, "branco");
  prisma(C, "branco", null, retangulo(TX, TZ, 4.15, 4.15, 0.98), Y1 - 0.18, Y1 + 0.12);
  prisma(C, "reboco", null, torreAlta, YC + 0.38, 13.6);
  prisma(C, "branco", "laje", retangulo(TX, TZ, 3.8, 3.8, 0.9), 13.6, 14.0, "branco");
  // balaustradas da torre: na cornija do meio e no topo
  const contorno = (pts: Xz[], y: number, recuo: number) => {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const q = pts.map(([x, z]): Xz => [cx + (x - cx) * recuo, cz + (z - cz) * recuo]);
    for (let i = 0; i < q.length; i++) balaustrada(balaustres, q[i][0], q[i][1], q[(i + 1) % q.length][0], q[(i + 1) % q.length][1], y, 0.8);
  };
  contorno(retangulo(TX, TZ, 4.35, 4.35, 1.02), YC + 0.38, 0.97);
  contorno(retangulo(TX, TZ, 3.75, 3.75, 0.88), 14.0, 0.96);
  // pilastras nos chanfros da torre
  for (const [x, z] of torreBaixa) caixaXZ(C, "branco", null, x - 0.12, x + 0.12, z - 0.12, z + 0.12, HP, YC, 0.04);

  // ---------- Vãos: portas no térreo, portas-balcão em cima, janelas da torre ----------
  const portas: Vao[] = [], janelas: Vao[] = [], terreas: Vao[] = [], arcos: Vao[] = [], arcadas: Vao[] = [];
  const yPorta = HP + 1.5, yJanela = Y1 + 1.35, yTerrea = HP + 1.9;
  /** Parede com portas embaixo e portas-balcão em cima, ou janelas nos dois (fachadas sem varanda) */
  const fachada = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number, comVaranda: boolean, passo = 2.15) => {
    vaosNaParede(comVaranda ? portas : terreas, ax, az, bx, bz, nx, nz, passo, comVaranda ? yPorta : yTerrea);
    vaosNaParede(janelas, ax, az, bx, bz, nx, nz, passo, yJanela);
    if (!comVaranda) {
      // pilastras brancas a cada dois vãos nas fachadas lisas, como nas do palacete
      const n = Math.max(1, Math.floor(Math.hypot(bx - ax, bz - az) / passo));
      for (let i = 2; i < n; i += 2) {
        const x = ax + ((bx - ax) * i) / n + nx * 0.06, z = az + ((bz - az) * i) / n + nz * 0.06;
        caixaXZ(C, "branco", null, x - 0.17, x + 0.17, z - 0.17, z + 0.17, HP + 0.45, YC, 0.04);
      }
    }
  };
  fachada(-XI, ZF - VAR, XI, ZF - VAR, 0, 1, true); // corpo central, frente
  fachada(XI, ZT + VAR, -XI, ZT + VAR, 0, -1, true); // corpo central, fundo
  fachada(-XI, ZF - VAR, -XI, Z0, 1, 0, true); // ala NE, pátio da frente
  fachada(XI, Z0, XI, ZF - VAR, -1, 0, true); // ala SO, pátio da frente
  fachada(-XI, -Z0, -XI, ZT + VAR, 1, 0, true); fachada(XI, ZT + VAR, XI, -Z0, -1, 0, true); // pátio de trás
  fachada(XE, -Z0, XE, 9.0, -1, 0, true); // lado externo nordeste
  fachada(X0, -Z0, X0, Z0, 1, 0, false); // lado externo sudoeste
  fachada(XE, -Z0, -XI, -Z0, 0, -1, false, 2.3); fachada(XI, -Z0, X0, -Z0, 0, -1, false, 2.3); // pontas de trás
  fachada(XI, Z0, X0, Z0, 0, 1, false, 2.3); // ponta noroeste da ala sudoeste
  // frente do palacete: porta no eixo, janelas ao lado (entre os pares de colunas) e porta-balcão na loggia
  portas.push({ x: PC, y: yPorta, z: Z0 + 0.26, giro: 0 });
  terreas.push({ x: PC - 1.98, y: yTerrea, z: Z0 + 0.005, giro: 0 }, { x: PC + 1.98, y: yTerrea, z: Z0 + 0.005, giro: 0 });
  janelas.push({ x: PC, y: yJanela, z: Z0 + 0.26, giro: 0 }, { x: PC - 1.98, y: yJanela, z: Z0 + 0.005, giro: 0 }, { x: PC + 1.98, y: yJanela, z: Z0 + 0.005, giro: 0 });
  // torre: arcada no térreo (fim da varanda), janela reta no segundo nível, janelas em arco no alto
  const facesTorre: [number, number][] = [[0, 1], [-1, 0], [0, -1], [1, 0]];
  for (const [nx, nz] of facesTorre) {
    const giro = Math.atan2(nx, nz);
    if (nx !== 1 && nz !== -1) { // as outras duas faces encostam no palacete
      arcadas.push({ x: TX + nx * 2.005, y: HP + 1.75, z: TZ + nz * 2.005, giro });
      janelas.push({ x: TX + nx * 2.005, y: yJanela, z: TZ + nz * 2.005, giro });
    }
    arcos.push({ x: TX + nx * 1.655, y: YC + 2.75, z: TZ + nz * 1.655, giro });
  }

  const tipos: [string, Vao[], number, number, boolean][] = [
    ["Portas_Terreo", portas, 1.05, 2.75, false],
    ["Janelas_Terreo", terreas, 0.95, 2.1, false],
    ["Portas_Balcao", janelas, 0.95, 2.35, false],
    ["Janelas_Arco_Torre", arcos, 0.9, 2.7, true],
  ];
  for (const [nome, vaos, w, h, ehArco] of tipos) {
    const ms = vaos.map((v) => mat4(v.x, v.y, v.z, v.giro));
    const moldura = geometriaMoldura(w, h, ehArco);
    const folha = geometriaFolha(w, h, ehArco);
    descartar.push(moldura, folha);
    grupo.add(instancias(`Molduras_${nome}`, moldura, M.branco, ms));
    grupo.add(instancias(`Folhas_${nome}`, folha, M.folha, ms, undefined, false));
  }
  // arcos abertos da arcada no pé da torre: vão escuro em arco com moldura branca
  {
    const ms = arcadas.map((v) => mat4(v.x, v.y, v.z, v.giro));
    const moldura = geometriaMoldura(1.5, 2.9, true, 0.18, 0.14);
    const vao = geometriaFolha(1.5, 2.9, true);
    descartar.push(moldura, vao);
    grupo.add(instancias("Molduras_Arcada_Torre", moldura, M.branco, ms));
    const sombra = new THREE.MeshStandardMaterial({ name: "Mat_Vao_Sombra", color: "#3b3433", roughness: 1 });
    descartar.push(sombra);
    grupo.add(instancias("Vaos_Arcada_Torre", vao, sombra, ms, undefined, false));
  }

  // ---------- Colunas, pináculos, arcos ----------
  const coluna = geometriaColuna();
  coluna.scale(1, (Y1 - 0.32 - HP) / 3.7, 1);
  descartar.push(coluna);
  grupo.add(instancias("Colunas_Jonicas", coluna, M.branco, colunasUnicas));
  const pinaculo = juntar([new THREE.CylinderGeometry(0.12, 0.2, 0.35, 8).translate(0, 0.17, 0), new THREE.SphereGeometry(0.2, 8, 6).translate(0, 0.5, 0), new THREE.ConeGeometry(0.08, 0.4, 6).translate(0, 0.8, 0)]);
  descartar.push(pinaculo);
  grupo.add(instancias("Pinaculos_Frontao", pinaculo, M.branco, pinaculos));

  // ---------- Malhas estáticas do construtor ----------
  const malha = (nome: string, ch: string, mat: THREE.Material, sombra = true, extra: THREE.BufferGeometry[] = []) => {
    const g0 = C.geometria(ch);
    const lista = [...(g0 ? [g0] : []), ...extra];
    if (!lista.length) return;
    const g = lista.length > 1 ? juntar(lista) : lista[0];
    descartar.push(g);
    const m = new THREE.Mesh(g, mat);
    m.name = nome; m.castShadow = sombra; m.receiveShadow = true;
    grupo.add(m);
  };
  malha("Paredes_Reboco", "reboco", M.reboco);
  malha("Estuque_Cornijas_Frisos", "branco", M.branco, true, [arco, voluta]);
  malha("Embasamento_Degraus", "embasamento", M.embasamento);
  malha("Cobertura_Lajes", "laje", M.laje);
  malha("Pisos_Calcadas", "piso", M.piso, false);
  malha("Via_Interna", "asfalto", M.asfalto, false);
  {
    const g = juntar(balaustres);
    balaustres.forEach((b) => b.dispose());
    descartar.push(g);
    const m = new THREE.Mesh(g, M.balaustre);
    m.name = "Balaustradas"; m.castShadow = true; m.receiveShadow = true;
    grupo.add(m);
  }

  // ---------- Jardins: sebes, mangueiras, palmeiras e mastros ----------
  const sebes: THREE.Matrix4[] = [];
  const sebe = (x0: number, x1: number, z0: number, z1: number) => sebes.push(mat4((x0 + x1) / 2, 0, (z0 + z1) / 2, 0, x1 - x0, 1, z1 - z0));
  // canteiros do pátio da frente (foto 03)
  sebe(-XA + 0.9, -2.8, ZF + 1.0, ZF + 1.6); sebe(2.8, XA - 0.9, ZF + 1.0, ZF + 1.6);
  sebe(-XA + 0.9, -XA + 1.5, ZF + 1.6, Z0 + 0.6); sebe(XA - 1.5, XA - 0.9, ZF + 1.6, Z0 + 0.6);
  // pátio de trás
  sebe(-XA + 0.9, XA - 0.9, ZT - 1.0, ZT - 0.4);
  sebe(-XA + 0.9, -XA + 1.5, -Z0 - 0.5, ZT - 1.0); sebe(XA - 1.5, XA - 0.9, -Z0 - 0.5, ZT - 1.0);
  const geoSebe = new THREE.BoxGeometry(1, 0.8, 1).translate(0, 0.4, 0);
  descartar.push(geoSebe);
  grupo.add(instancias("Sebes_Canteiros", geoSebe, M.sebe, sebes));

  // árvores: mangueiras e oitizeiros em volta, sem invadir o prédio, a via e os caminhos
  const rnd = aleatorio(1918);
  const arvores: [number, number, number][] = [];
  const livre = (x: number, z: number, r: number) => {
    if (Math.hypot(x, z) > 32.4 - r * 0.6) return false;
    if (x > -X0 - 3 - r * 0.6 && x < X0 + 3 + r * 0.6 && z > -Z0 - 3 - r * 0.6 && z < Z0 + 3 + r * 0.6) {
      // dentro do retângulo do prédio só nos pátios, longe das varandas
      const noPatioFrente = x > -XA + 2.5 && x < XA - 2.5 && z > ZF + 2.4 && z < Z0 + 3;
      if (!noPatioFrente) return false;
    }
    if (z > 15.6 - r * 0.4 && z < 21 + r * 0.4) return false; // via
    if (x > -19.5 && x < -14.5 && z > Z0) return false; // caminho do palacete
    if (Math.abs(x) < 2.2 && z > ZF) return false; // caminho do pátio
    return arvores.every(([ax, az, ar]) => Math.hypot(x - ax, z - az) > (r + ar) * 0.75);
  };
  for (let k = 0; k < 900 && arvores.length < 26; k++) {
    const x = (rnd() - 0.5) * 66, z = (rnd() - 0.5) * 66, r = 1.5 + rnd() * 1.4;
    if (livre(x, z, r)) arvores.push([x, z, r]);
  }
  const copas: THREE.Matrix4[] = [], troncos: THREE.Matrix4[] = [];
  for (const [x, z, r] of arvores) {
    // mangueira: copa larga e baixa, tronco curto
    const h = 1.5 + r * 0.95;
    troncos.push(mat4(x, 0, z, 0, 1, h, 1));
    copas.push(mat4(x, h, z, rnd() * 6, r * 1.1, r * 0.72, r * 1.1));
  }
  const geoCopa = new THREE.IcosahedronGeometry(1, 1);
  const geoTronco = new THREE.CylinderGeometry(0.18, 0.26, 1, 6).translate(0, 0.5, 0);
  descartar.push(geoCopa, geoTronco);
  grupo.add(instancias("Copas_Mangueiras", geoCopa, M.copa, copas, ["#3e6e30", "#4f8038", "#356029", "#5a8a3e"]));
  grupo.add(instancias("Troncos_Arvores", geoTronco, M.tronco, troncos));

  // palmeiras altas no pátio da frente e diante do palacete (foto 03)
  const palmeiras: Xz[] = [[-6, ZF + 3.0], [6.5, ZF + 3.4], [-9.5, ZF + 5.6], [-13.4, Z0 + 3.4], [-8.5, Z0 + 2.4]];
  const geoEstipe = new THREE.CylinderGeometry(0.14, 0.2, 1, 6).translate(0, 0.5, 0);
  const geoLeque = juntar(Array.from({ length: 10 }, (_, i) => {
    // lâmina de 2,2 m que sai do topo do estipe e cai ~30°, girada em volta do eixo
    const l = new THREE.BoxGeometry(0.34, 0.05, 2.2).translate(0, 0, 1.1);
    l.rotateX(0.35 + (i % 2) * 0.25);
    l.rotateY((i / 10) * Math.PI * 2);
    return l;
  }));
  descartar.push(geoEstipe, geoLeque);
  grupo.add(instancias("Estipes_Palmeiras", geoEstipe, M.tronco, palmeiras.map(([x, z], i) => mat4(x, 0, z, 0, 1, 10 + (i % 3) * 1.2, 1))));
  const folhaPalmeira = new THREE.MeshStandardMaterial({ name: "Mat_Folha_Palmeira", color: "#55823b", roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
  descartar.push(folhaPalmeira);
  grupo.add(instancias("Leques_Palmeiras", geoLeque, folhaPalmeira, palmeiras.map(([x, z], i) => mat4(x, 10 + (i % 3) * 1.2, z, i))));

  // mastros com as bandeiras na ponta sudoeste do pátio da frente (foto 03)
  const geoMastro = new THREE.CylinderGeometry(0.05, 0.07, 1, 6).translate(0, 0.5, 0);
  descartar.push(geoMastro);
  const mastros: Xz[] = [[XA - 2.2, Z0 + 0.4], [XA - 1.2, Z0 + 0.4], [XA - 0.2, Z0 + 0.4]];
  grupo.add(instancias("Mastros_Bandeiras", geoMastro, M.metal, mastros.map(([x, z]) => mat4(x, 0, z, 0, 1, 9, 1))));
  const bandeiras = ["#2f8f4e", "#2e7d32", "#1f4f9a"];
  mastros.forEach(([x, z], i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.03).translate(0.58, 8.5, 0), fab.cor(bandeiras[i], 0.8));
    b.position.set(x, 0, z);
    b.name = `Bandeira_${["Brasil", "Ceara", "UFC"][i]}`;
    b.castShadow = true;
    descartar.push(b.geometry);
    grupo.add(b);
  });

  return { grupo, dispose: () => descartar.forEach((d) => d.dispose()) };
}

export function ReitoriaUfc({ fab }: { fab: Fabrica }) {
  const r = useMemo(() => construir(fab), [fab]);
  useEffect(() => () => r.dispose(), [r]);
  return (
    <group name="Reitoria_UFC" rotation-y={GIRO}>
      <primitive object={r.grupo} />
    </group>
  );
}
