import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../Cena";

/** Ponto do perfil de revolução: semieixo L–O (a), semieixo N–S (b), altura (y) e expoente da superelipse (n) */
type Anel = [a: number, b: number, y: number, n: number];

// Medidas da miniatura, em metros: o contorno real (262 × 221 m) cai para ~54 × 45 m e as alturas são exageradas
const A = 22.6; // semieixo L–O da borda externa da cobertura
const B = 26.8; // semieixo N–S
const N_EXT = 2.3; // planta de "almofada": um pouco mais quadrada que a elipse
const ABERTURA: Anel = [10.2, 14.5, 8.8, 2.8]; // vazio da cobertura (142 × 100 m)
const PICO: Anel = [A - 1.2, B - 1.2, 10, 2.35]; // ponto mais alto da cobertura, perto da borda
const PORTICOS = 60;
const GIRO = -0.09; // eixo maior ~5° a leste do norte verdadeiro
const CAMPO = { w: 17.2, h: 25.6 }; // retângulo verde sob a base das arquibancadas
const ESCALA = 21.5 / 105; // gramado de 105 × 68 m

const CORES = {
  cobertura: "#E7ECEA",
  policarbonato: "#BAC4C9",
  porticos: "#F2F3F1",
  vidro: "#61737F",
  embasamento: "#2E373E",
  camarotes: "#3D4A54",
  esplanada: "#CFCBC2",
  passeio: "#BEB9AF",
};

function superelipse(a: number, b: number, n: number, t: number): [number, number] {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n)];
}

function mistura(p: Anel, q: Anel, f: number): Anel {
  return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f, p[3] + (q[3] - p[3]) * f];
}

/**
 * Superfície "torneada" sobre superelipses: cada ponto do perfil vira um anel fechado. A face aponta para
 * (sentido do perfil × avanço do anel): perfil subindo → normal para fora; indo para o centro → para cima.
 * O UV é em metros (u ao longo do anel, v ao longo do perfil), para texturas repetidas.
 */
function anel(perfil: Anel[], seg = 160) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let v = 0;
  for (let k = 0; k < perfil.length; k++) {
    const [a, b, y, n] = perfil[k];
    if (k > 0) {
      const [a0, b0, y0] = perfil[k - 1];
      v += Math.hypot((a - a0 + b - b0) / 2, y - y0);
    }
    let u = 0;
    let [px, pz] = superelipse(a, b, n, 0);
    for (let i = 0; i <= seg; i++) {
      const [x, z] = superelipse(a, b, n, (i / seg) * Math.PI * 2);
      u += Math.hypot(x - px, z - pz);
      px = x;
      pz = z;
      pos.push(x, y, z);
      uv.push(u, v);
    }
  }
  const linha = seg + 1;
  for (let k = 0; k < perfil.length - 1; k++) {
    for (let i = 0; i < seg; i++) {
      const p = k * linha + i;
      idx.push(p, p + linha, p + 1, p + 1, p + linha, p + linha + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Pórtico treliçado visto de lado (x = para fora da borda da cobertura, y = altura), com os vazados da treliça */
function geometriaPortico() {
  const v2 = (p: number[][]) => p.map(([x, y]) => new THREE.Vector2(x, y));
  const fora = new THREE.SplineCurve(v2([[-1.5, 0], [-0.3, 3], [0.7, 6.2], [1.1, 8.8], [0.7, 11.3], [-0.6, 13]]));
  const dentro = new THREE.SplineCurve(v2([[-2.1, 0], [-1.55, 3.4], [-0.8, 6.6], [-0.3, 8.9], [-0.45, 10.9], [-0.6, 13]]));
  const pf = fora.getPoints(28);
  const pd = dentro.getPoints(28);
  const forma = new THREE.Shape([...pf, ...pd.slice(0, -1).reverse()]);
  const niveis = 7;
  for (let k = 0; k < niveis; k++) {
    const s0 = 0.05 + (k / niveis) * 0.8;
    const s1 = 0.05 + ((k + 1) / niveis) * 0.8;
    const o0 = fora.getPoint(s0);
    const o1 = fora.getPoint(s1);
    const i0 = dentro.getPoint(s0);
    const i1 = dentro.getPoint(s1);
    const triangulos = k % 2 ? [[o0, o1, i0], [o1, i1, i0]] : [[o0, i1, i0], [o0, o1, i1]];
    for (const t of triangulos) {
      const cx = (t[0].x + t[1].x + t[2].x) / 3;
      const cy = (t[0].y + t[1].y + t[2].y) / 3;
      forma.holes.push(new THREE.Path(t.map((p) => new THREE.Vector2(cx + (p.x - cx) * 0.52, cy + (p.y - cy) * 0.52))));
    }
  }
  const g = new THREE.ExtrudeGeometry(forma, { depth: 0.34, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -0.17);
  return g;
}

/** Referencial de cada pórtico: na borda externa da cobertura, com x local apontando para fora */
function referenciaisPorticos() {
  const amostras = 1440;
  const pts: [number, number][] = [];
  const acum: number[] = [0];
  for (let i = 0; i <= amostras; i++) {
    pts.push(superelipse(A, B, N_EXT, (i / amostras) * Math.PI * 2));
    if (i > 0) acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = acum[amostras];
  const out: THREE.Matrix4[] = [];
  const cima = new THREE.Vector3(0, 1, 0);
  let j = 0;
  for (let k = 0; k < PORTICOS; k++) {
    const alvo = ((k + 0.5) / PORTICOS) * total;
    while (j < amostras - 1 && acum[j + 1] < alvo) j++;
    const [x0, z0] = pts[j];
    const [x1, z1] = pts[j + 1];
    const fora = new THREE.Vector3(z1 - z0, 0, -(x1 - x0)).normalize();
    if (fora.x * x0 + fora.z * z0 < 0) fora.negate();
    const lado = new THREE.Vector3().crossVectors(fora, cima);
    out.push(new THREE.Matrix4().makeBasis(fora, cima, lado).setPosition((x0 + x1) / 2, 0, (z0 + z1) / 2));
  }
  return out;
}

function novoCanvas(w: number, h: number) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  return { cv, g: cv.getContext("2d")! };
}

/** Gramado com faixas de corte e as linhas do campo */
function desenharCampo() {
  const px = 24;
  const { cv, g } = novoCanvas(CAMPO.w * px, CAMPO.h * px);
  const larg = 68 * ESCALA * px;
  const comp = 105 * ESCALA * px;
  const x0 = (cv.width - larg) / 2;
  const y0 = (cv.height - comp) / 2;
  g.fillStyle = "#3E8E3A";
  g.fillRect(0, 0, cv.width, cv.height);
  const faixas = 14;
  for (let i = 0; i < faixas; i += 2) {
    g.fillStyle = "#4FA447";
    g.fillRect(x0, y0 + (i * comp) / faixas, larg, comp / faixas);
  }
  const m = (metros: number) => metros * ESCALA * px;
  g.strokeStyle = "#f4f6f2";
  g.lineWidth = 3;
  g.strokeRect(x0, y0, larg, comp);
  g.beginPath();
  g.moveTo(x0, y0 + comp / 2);
  g.lineTo(x0 + larg, y0 + comp / 2);
  g.stroke();
  g.beginPath();
  g.arc(cv.width / 2, cv.height / 2, m(9.15), 0, Math.PI * 2);
  g.stroke();
  for (const lado of [0, 1]) {
    const yLinha = lado ? y0 + comp : y0;
    const s = lado ? -1 : 1;
    // grande área, pequena área e meia-lua
    g.strokeRect(cv.width / 2 - m(20.15), lado ? yLinha - m(16.5) : yLinha, m(40.3), m(16.5));
    g.strokeRect(cv.width / 2 - m(9.16), lado ? yLinha - m(5.5) : yLinha, m(18.32), m(5.5));
    g.beginPath();
    const ang = Math.acos(5.5 / 9.15);
    if (lado) g.arc(cv.width / 2, yLinha - m(11), m(9.15), -Math.PI / 2 - ang, -Math.PI / 2 + ang);
    else g.arc(cv.width / 2, yLinha + m(11), m(9.15), Math.PI / 2 - ang, Math.PI / 2 + ang);
    g.stroke();
    g.fillStyle = "#f4f6f2";
    g.fillRect(cv.width / 2 - 2, yLinha + s * m(11) - 2, 4, 4);
  }
  return cv;
}

/** Um degrau da arquibancada: assento claro, espelho em sombra e o corredor de escada */
function desenharDegrau() {
  const { cv, g } = novoCanvas(128, 32);
  g.fillStyle = "#C8C6B4";
  g.fillRect(0, 0, 128, 32);
  g.fillStyle = "#8F8D7F";
  g.fillRect(0, 22, 128, 10);
  g.fillStyle = "#A3A39C";
  g.fillRect(0, 0, 7, 32);
  return cv;
}

function texturaDe(cv: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Arena Castelão: anel de cobertura branco com o vazio oval, coroa de 60 pórticos e fachada de vidro escuro */
export function Castelao({ fab }: { fab: Fabrica }) {
  const geo = useMemo(() => {
    const ext = (d: number, y: number, n = N_EXT): Anel => [A + d, B + d, y, n];
    const poli = mistura(ABERTURA, PICO, 0.2);
    return {
      // esplanada clara em volta, com o passeio mais escuro junto à fachada
      esplanadaTopo: anel([[26.8, 29.4, 0.22, 2.4], [0, 0, 0.22, 2.4]], 96),
      esplanadaBorda: anel([[26.8, 29.4, 0, 2.4], [26.8, 29.4, 0.22, 2.4]], 96),
      passeio: anel([ext(2.6, 0.235), ext(-2.9, 0.235)], 120),
      // embasamento recuado e a pele de vidro, inclinada para fora
      embasamento: anel([ext(-2.8, 0.2), ext(-2.8, 1.4)]),
      vidro: anel([ext(-2.5, 1.4), ext(-0.5, 8.6)]),
      // cobertura: chapa branca com leve caimento para o vazio, faixa de policarbonato na borda interna
      coberturaTopo: anel([ext(0, 9.4), PICO, ABERTURA]),
      policarbonato: anel([[poli[0], poli[1], poli[2] + 0.04, poli[3]], [ABERTURA[0], ABERTURA[1], ABERTURA[2] + 0.04, ABERTURA[3]]]),
      coberturaFundo: anel([[ABERTURA[0], ABERTURA[1], 8.2, ABERTURA[3]], ext(0, 8.6)]),
      coberturaBorda: anel([ext(0, 8.6), ext(0, 9.4)]),
      coberturaVazio: anel([ABERTURA, [ABERTURA[0], ABERTURA[1], 8.2, ABERTURA[3]]]),
      // arquibancadas: anel inferior perto do campo, faixa de camarotes e anel superior sob a cobertura
      anelInferior: anel([[13.2, 17.6, 3.4, 3], [8.4, 12.6, 0.24, 4]]),
      camarotes: anel([[13.5, 17.9, 4.5, 3], [13.2, 17.6, 3.4, 3]]),
      anelSuperior: anel([[19, 23.4, 8.1, 2.6], [13.5, 17.9, 4.5, 3]]),
      portico: geometriaPortico(),
      tirante: new THREE.CylinderGeometry(0.05, 0.05, 1, 4),
    };
  }, []);

  const tex = useMemo(() => {
    const degrau = texturaDe(desenharDegrau());
    degrau.wrapS = degrau.wrapT = THREE.RepeatWrapping;
    degrau.repeat.set(1 / 4.5, 1 / 0.75);
    const campo = texturaDe(desenharCampo());
    return {
      degrau,
      campo,
      arquibancada: new THREE.MeshStandardMaterial({ map: degrau, roughness: 0.9 }),
      gramado: new THREE.MeshStandardMaterial({ map: campo, roughness: 0.95 }),
    };
  }, []);

  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g.dispose();
      for (const t of Object.values(tex)) t.dispose();
    },
    [geo, tex],
  );

  const porticos = useRef<THREE.InstancedMesh>(null);
  const tirantes = useRef<THREE.InstancedMesh>(null);
  const referenciais = useMemo(() => referenciaisPorticos(), []);

  useLayoutEffect(() => {
    // tirante da ponta do pórtico até a cobertura, no referencial local do pórtico
    const ponta = new THREE.Vector3(-0.6, 13, 0);
    const apoio = new THREE.Vector3(-4.5, 9.8, 0);
    const meio = ponta.clone().add(apoio).multiplyScalar(0.5);
    const dir = apoio.clone().sub(ponta);
    const local = new THREE.Matrix4().compose(
      meio,
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      new THREE.Vector3(1, dir.length(), 1),
    );
    const m = new THREE.Matrix4();
    for (let i = 0; i < referenciais.length; i++) {
      porticos.current!.setMatrixAt(i, referenciais[i]);
      tirantes.current!.setMatrixAt(i, m.multiplyMatrices(referenciais[i], local));
    }
    porticos.current!.instanceMatrix.needsUpdate = true;
    tirantes.current!.instanceMatrix.needsUpdate = true;
    porticos.current!.computeBoundingSphere();
    tirantes.current!.computeBoundingSphere();
  }, [referenciais]);

  const branco = fab.cor(CORES.cobertura, 0.55);
  return (
    <group rotation-y={GIRO}>
      <mesh geometry={geo.esplanadaTopo} material={fab.cor(CORES.esplanada, 0.95)} receiveShadow />
      <mesh geometry={geo.esplanadaBorda} material={fab.cor(CORES.esplanada, 0.95)} receiveShadow />
      <mesh geometry={geo.passeio} material={fab.cor(CORES.passeio, 0.95)} receiveShadow />
      <mesh rotation-x={-Math.PI / 2} position-y={0.24} material={tex.gramado} receiveShadow>
        <planeGeometry args={[CAMPO.w, CAMPO.h]} />
      </mesh>

      <mesh geometry={geo.anelInferior} material={tex.arquibancada} castShadow receiveShadow />
      <mesh geometry={geo.camarotes} material={fab.cor(CORES.camarotes, 0.35)} receiveShadow />
      <mesh geometry={geo.anelSuperior} material={tex.arquibancada} castShadow receiveShadow />

      <mesh geometry={geo.embasamento} material={fab.cor(CORES.embasamento, 0.6)} castShadow receiveShadow />
      <mesh geometry={geo.vidro} material={fab.cor(CORES.vidro, 0.42)} castShadow receiveShadow />

      <mesh geometry={geo.coberturaTopo} material={branco} castShadow receiveShadow />
      <mesh geometry={geo.policarbonato} material={fab.cor(CORES.policarbonato, 0.4)} receiveShadow />
      <mesh geometry={geo.coberturaFundo} material={branco} castShadow receiveShadow />
      <mesh geometry={geo.coberturaBorda} material={branco} castShadow receiveShadow />
      <mesh geometry={geo.coberturaVazio} material={branco} castShadow receiveShadow />

      <instancedMesh ref={porticos} args={[geo.portico, fab.cor(CORES.porticos, 0.45), PORTICOS]} castShadow receiveShadow />
      <instancedMesh ref={tirantes} args={[geo.tirante, fab.cor("#C9CDD0", 0.5), PORTICOS]} />
    </group>
  );
}
