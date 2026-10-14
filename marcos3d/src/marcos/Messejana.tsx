import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../Cena";

/**
 * Miniatura da Lagoa de Messejana com a estátua "Banho de Iracema" e a Igreja Matriz de Nossa Senhora
 * da Conceição (o Centro de Messejana), a sudeste da lagoa. Fora de escala: a lagoa encolhe para ~40 m
 * no eixo norte–sul e a estátua e a torre crescem para ler de longe. Metros, norte em −z, leste em +x.
 */

type Pt = [number, number];

// ——— Contorno da lagoa ———

/** Contorno do OSM em pixels da planta (norte para cima), da ponta norte no sentido horário */
const CONTORNO_PX: Pt[] = [
  [545, 122], [600, 125], [632, 140], [648, 162], [672, 166], [660, 195], [672, 225], [700, 245],
  [728, 252], [745, 282], [785, 315], [828, 338], [870, 368], [915, 368], [950, 395], [963, 430],
  [972, 490], [974, 550], [965, 600], [940, 617], [900, 632], [878, 662], [876, 697], [840, 720],
  [800, 752], [782, 800], [755, 826], [715, 835], [690, 875], [655, 915], [648, 955], [670, 985],
  [625, 1015], [595, 1050], [580, 1100], [562, 1150], [548, 1200], [505, 1245], [470, 1295], [448, 1335],
  [400, 1332], [345, 1305], [290, 1302], [255, 1322], [225, 1295], [175, 1270], [150, 1215], [135, 1160],
  [120, 1100], [100, 1025], [97, 960], [100, 890], [82, 850], [82, 800], [108, 745], [150, 678],
  [200, 560], [240, 488], [290, 438], [340, 390], [365, 345], [410, 275], [460, 213], [500, 173],
];
/** Trecho do contorno com calçadão e guarda-corpo: do lobo leste até o canto sudoeste */
const GRADIL = [12, 45];

/** Pixels da planta para metros da miniatura (~40 m de norte a sul, puxada para oeste para caber a igreja) */
const ESCALA = 40 / 1213;
const px = ([x, y]: Pt): Pt => [(x - 528) * ESCALA - 4, (y - 728) * ESCALA];

/** Arredonda os cantos do polígono (um passo de Chaikin) */
function suavizar(p: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  return out;
}

/** Afasta cada vértice `d` metros para fora, com a quina limitada para não criar laços */
function deslocar(p: Pt[], d: number): Pt[] {
  const n = p.length;
  let area = 0;
  for (let i = 0; i < n; i++) area += p[i][0] * p[(i + 1) % n][1] - p[(i + 1) % n][0] * p[i][1];
  const s = area > 0 ? 1 : -1;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = p[(i - 1 + n) % n];
    const b = p[i];
    const c = p[(i + 1) % n];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
    const n1: Pt = [(s * (b[1] - a[1])) / l1, (-s * (b[0] - a[0])) / l1];
    const n2: Pt = [(s * (c[1] - b[1])) / l2, (-s * (c[0] - b[0])) / l2];
    const f = Math.min(d / (1 + n1[0] * n2[0] + n1[1] * n2[1]), d * 1.6);
    out.push([b[0] + (n1[0] + n2[0]) * f, b[1] + (n1[1] + n2[1]) * f]);
  }
  return out;
}

function dentro([x, y]: Pt, p: Pt[]) {
  let d = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

function aleatorio(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const LAGOA = suavizar(CONTORNO_PX.map(px));
const CALCADAO = deslocar(LAGOA, 1.5);
const ALTURA_CALCADAO = 0.35;
const NIVEL_AGUA = 0.2;

/** Shape deitável: o ponto (x, z) vira (x, −z) para a rotação de −90° em x devolver o z certo */
const forma = (p: Pt[]) => new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z)));

// ——— Posições ———

const IRACEMA: Pt = [8.0, -5.9];
const IGREJA: Pt = [8.2, 15.4];
const CRUZEIRO: Pt = [2.6, 15.4];
const PIER_X = -9.3;
const PRACA: Pt[] = [[0.4, 9.8], [19.6, 9.8], [19.6, 20.2], [-2.2, 20.2]];

/** Mata densa nas margens oeste e norte, em duas fileiras */
const MATA = (() => {
  const rnd = aleatorio(23);
  const out: { x: number; z: number; r: number; cor: number }[] = [];
  const fileiras: [number, number][] = [[3.4, 3], [6.6, 4], [9.6, 5]];
  for (const [d, passo] of fileiras) {
    const anel = deslocar(LAGOA, d);
    for (let i = 0; i < anel.length; i += passo) {
      const [x0, z0] = anel[i];
      if (!(x0 < -8 || z0 < -11)) continue;
      const x = x0 + (rnd() - 0.5) * 1.6;
      const z = z0 + (rnd() - 0.5) * 1.6;
      if (Math.hypot(x, z) > 29 || dentro([x, z], CALCADAO)) continue;
      out.push({ x, z, r: 1.5 + rnd() * 0.9, cor: rnd() });
    }
  }
  return out;
})();

/** Palmeiras no calçadão leste e na praça da Matriz */
const PALMEIRAS: { x: number; z: number; h: number; giro: number }[] = (() => {
  const anel = deslocar(LAGOA, 2.6);
  const lista: Pt[] = [14, 18, 22, 26, 30, 34].map((i) => anel[i * 2]);
  lista.push([1.0, 10.6], [5.2, 10.6], [0.4, 19.4], [19, 10.6], [19, 19.6]);
  const rnd = aleatorio(5);
  return lista.map(([x, z]) => ({ x, z, h: 5.5 + rnd() * 1.5, giro: rnd() * Math.PI }));
})();

// ——— Modelo ———

export function Messejana({ fab }: { fab: Fabrica }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow material={fab.cor("#86a95e")}>
        <circleGeometry args={[31.5, 64]} />
      </mesh>
      <Lagoa fab={fab} />
      <Gradil fab={fab} />
      <Pier fab={fab} />
      <Iracema fab={fab} />
      <Praca fab={fab} />
      <group position={[IGREJA[0], 0, IGREJA[1]]}>
        <Igreja fab={fab} />
      </group>
      <Mata fab={fab} />
      <Palmeiras fab={fab} />
    </group>
  );
}

/** Espelho d'água e calçadão em volta, com um degrau de meio-fio até a água */
function Lagoa({ fab }: { fab: Fabrica }) {
  const geo = useMemo(() => {
    const anel = forma(CALCADAO);
    anel.holes.push(new THREE.Path(LAGOA.map(([x, z]) => new THREE.Vector2(x, -z))));
    return {
      calcadao: new THREE.ExtrudeGeometry(anel, { depth: ALTURA_CALCADAO, bevelEnabled: false }),
      agua: new THREE.ShapeGeometry(forma(LAGOA)),
    };
  }, []);
  useEffect(
    () => () => {
      geo.calcadao.dispose();
      geo.agua.dispose();
    },
    [geo],
  );
  return (
    <>
      <mesh geometry={geo.calcadao} rotation-x={-Math.PI / 2} position-y={0.02} castShadow receiveShadow material={fab.cor("#c9bca6")} />
      <mesh geometry={geo.agua} rotation-x={-Math.PI / 2} position-y={NIVEL_AGUA} receiveShadow material={fab.agua()} />
    </>
  );
}

/** Guarda-corpo do calçadão: corrimão laranja contínuo sobre pilares de tijolo */
function Gradil({ fab }: { fab: Fabrica }) {
  const { tubo, pilares } = useMemo(() => {
    const borda = deslocar(LAGOA, 0.3).slice(GRADIL[0] * 2, GRADIL[1] * 2 + 1);
    const curva = new THREE.CatmullRomCurve3(borda.map(([x, z]) => new THREE.Vector3(x, ALTURA_CALCADAO + 0.95, z)));
    const n = Math.round(curva.getLength() / 2.4);
    return { tubo: new THREE.TubeGeometry(curva, n * 4, 0.08, 5, false), pilares: curva.getSpacedPoints(n) };
  }, []);
  useEffect(() => () => tubo.dispose(), [tubo]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    for (let i = 0; i < pilares.length; i++) {
      o.position.set(pilares[i].x, ALTURA_CALCADAO + 0.5, pilares[i].z);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [pilares]);
  return (
    <>
      <mesh geometry={tubo} castShadow material={fab.cor("#d9a13b", 0.6)} />
      <instancedMesh ref={ref} args={[undefined, undefined, pilares.length]} castShadow material={fab.cor("#9a4b32")}>
        <boxGeometry args={[0.32, 1, 0.32]} />
      </instancedMesh>
    </>
  );
}

/** Píer de madeira que sai da margem sul, com um quiosque na ponta */
function Pier({ fab }: { fab: Fabrica }) {
  const madeira = fab.cor("#8a6a4f", 0.8);
  return (
    <group position-x={PIER_X}>
      <mesh position={[0, 0.5, 17.4]} castShadow receiveShadow material={madeira}>
        <boxGeometry args={[1.3, 0.16, 5]} />
      </mesh>
      <mesh position={[0, 0.5, 13.6]} castShadow receiveShadow material={madeira}>
        <boxGeometry args={[3.2, 0.16, 3.2]} />
      </mesh>
      <mesh position={[0, 1.6, 13.6]} castShadow material={fab.cor("#6f5644")}>
        <cylinderGeometry args={[0.12, 0.12, 2.2, 6]} />
      </mesh>
      <mesh position={[0, 3.05, 13.6]} rotation-y={Math.PI / 4} castShadow material={fab.cor("#9a4b32", 0.8)}>
        <coneGeometry args={[2.2, 1.1, 4]} />
      </mesh>
    </group>
  );
}

// ——— Estátua "Banho de Iracema" ———

const CIMA = new THREE.Vector3(0, 1, 0);

/** Cápsula de um ponto a outro, como um osso de boneco */
function Osso({ de, ate, r, material }: { de: [number, number, number]; ate: [number, number, number]; r: number; material: THREE.Material }) {
  const a = new THREE.Vector3(...de);
  const b = new THREE.Vector3(...ate);
  const dir = b.clone().sub(a);
  const comp = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(CIMA, dir.normalize());
  return (
    <mesh position={a.add(b).multiplyScalar(0.5)} quaternion={q} castShadow material={material}>
      <capsuleGeometry args={[r, comp, 4, 10]} />
    </mesh>
  );
}

/**
 * Iracema sentada de lado sobre a rocha, de frente para o calçadão (leste, +x): pernas dobradas para o
 * sul e o braço erguido do lado norte com a cuia no alto, como se vê das fotos tiradas da margem.
 */
function Iracema({ fab }: { fab: Fabrica }) {
  const bronze = fab.cor("#4f7d58", 0.55);
  const cabelo = fab.cor("#3b6347", 0.6);
  return (
    <group position={[IRACEMA[0], 0, IRACEMA[1]]}>
      <mesh position-y={0.9} scale={[1.25, 0.75, 1.05]} castShadow receiveShadow material={fab.cor("#b9b7b0")}>
        <dodecahedronGeometry args={[1.8, 0]} />
      </mesh>
      <mesh position={[-0.8, 1.9, -0.7]} scale={[1, 0.9, 0.9]} castShadow material={fab.cor("#a8a69f")}>
        <dodecahedronGeometry args={[1.0, 0]} />
      </mesh>
      {/* quadril e pernas dobradas para o lado */}
      <mesh position={[0, 2.55, 0.1]} scale={[1, 0.7, 1.1]} castShadow material={bronze}>
        <sphereGeometry args={[0.62, 12, 10]} />
      </mesh>
      <Osso de={[0.05, 2.5, 0.2]} ate={[1.0, 2.35, 0.9]} r={0.36} material={bronze} />
      <Osso de={[1.0, 2.3, 0.95]} ate={[-0.1, 2.2, 1.45]} r={0.28} material={bronze} />
      {/* tronco, pescoço e cabeça */}
      <Osso de={[-0.05, 2.75, 0]} ate={[0.05, 4.3, 0]} r={0.48} material={bronze} />
      <Osso de={[0, 4.35, -0.62]} ate={[0, 4.35, 0.62]} r={0.26} material={bronze} />
      <Osso de={[0.05, 4.45, 0]} ate={[0.08, 4.8, 0]} r={0.17} material={bronze} />
      <mesh position={[0.1, 5.05, 0]} castShadow material={bronze}>
        <sphereGeometry args={[0.42, 14, 12]} />
      </mesh>
      <Osso de={[-0.2, 5.15, 0]} ate={[-0.45, 3.5, 0.05]} r={0.33} material={cabelo} />
      {/* braço erguido com a cuia */}
      <Osso de={[0, 4.4, -0.66]} ate={[0.1, 5.5, -0.82]} r={0.17} material={bronze} />
      <Osso de={[0.1, 5.5, -0.82]} ate={[0.16, 6.6, -0.76]} r={0.15} material={bronze} />
      <mesh position={[0.16, 6.95, -0.76]} scale={[1, 0.75, 1]} castShadow material={bronze}>
        <sphereGeometry args={[0.4, 12, 10]} />
      </mesh>
      {/* braço apoiado na perna */}
      <Osso de={[0, 4.35, 0.66]} ate={[0.3, 3.4, 0.9]} r={0.16} material={bronze} />
      <Osso de={[0.3, 3.4, 0.9]} ate={[0.65, 2.75, 0.85]} r={0.14} material={bronze} />
    </group>
  );
}

// ——— Praça da Matriz e Igreja ———

function Praca({ fab }: { fab: Fabrica }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(forma(PRACA)), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const branco = fab.cor("#f3f4f2");
  const ferro = fab.cor("#2f3337", 0.5);
  return (
    <>
      <mesh geometry={geo} rotation-x={-Math.PI / 2} position-y={0.05} receiveShadow material={fab.cor("#cfc6b8")} />
      {/* losango de pedra portuguesa em volta do cruzeiro */}
      <mesh position={[CRUZEIRO[0], 0.07, CRUZEIRO[1]]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} receiveShadow material={fab.cor("#7a6a5c")}>
        <planeGeometry args={[5.2, 5.2]} />
      </mesh>
      <mesh position={[CRUZEIRO[0], 0.09, CRUZEIRO[1]]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} receiveShadow material={fab.cor("#cfc6b8")}>
        <planeGeometry args={[3.8, 3.8]} />
      </mesh>
      <group position={[CRUZEIRO[0], 0, CRUZEIRO[1]]}>
        <mesh position-y={0.35} castShadow receiveShadow material={branco}>
          <boxGeometry args={[1.6, 0.6, 1.6]} />
        </mesh>
        <mesh position-y={1.0} castShadow material={branco}>
          <boxGeometry args={[0.9, 0.8, 0.9]} />
        </mesh>
        <mesh position-y={2.8} castShadow material={ferro}>
          <boxGeometry args={[0.16, 3, 0.16]} />
        </mesh>
        <mesh position-y={3.6} castShadow material={ferro}>
          <boxGeometry args={[0.16, 0.16, 1.5]} />
        </mesh>
      </group>
    </>
  );
}

function desenharRelogio() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#f7f7f2";
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#2b2b2b";
  g.lineWidth = 5;
  g.stroke();
  g.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(64 + Math.sin(a) * 46, 64 - Math.cos(a) * 46);
    g.lineTo(64 + Math.sin(a) * 54, 64 - Math.cos(a) * 54);
    g.stroke();
  }
  g.lineCap = "round";
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(64, 64);
  g.lineTo(64 + 26, 64 - 10);
  g.stroke();
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(64, 64);
  g.lineTo(64 - 4, 64 - 44);
  g.stroke();
  return cv;
}

/** Prisma triangular unitário (base 1, altura 1, comprimento 1 em z) para telhado e frontão */
function criarPrisma() {
  const s = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  return g;
}

// medidas da igreja, no sistema dela: fachada em x = 0 virada para oeste (−x), nave para +x
const ADRO = 0.6;
const NAVE = { de: 0.4, ate: 11, meia: 3.2, alto: 5 };
const FACHADA = { meia: 3.8, alto: 6, meiaCentro: 1.6, altoCentro: 7.2 };
const TORRE = { x: 0.9, lado: 2.6, de: ADRO + 6, ate: ADRO + 11.3 };

/** Igreja Matriz: paredes azuis com frisos brancos, torre central com relógio e flecha piramidal */
function Igreja({ fab }: { fab: Fabrica }) {
  const prisma = useMemo(() => criarPrisma(), []);
  const relogio = useMemo(() => {
    const t = new THREE.CanvasTexture(desenharRelogio());
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  }, []);
  useEffect(
    () => () => {
      prisma.dispose();
      relogio.map?.dispose();
      relogio.dispose();
    },
    [prisma, relogio],
  );
  const azul = fab.cor("#6d93c2");
  const azulCentro = fab.cor("#5c83b5");
  const barrado = fab.cor("#3e5f8c");
  const branco = fab.cor("#f3f4f2");
  const telhado = fab.cor("#5a5c5e", 0.85);
  const escuro = fab.cor("#26303a", 0.6);
  const y0 = ADRO;
  const naveC = (NAVE.de + NAVE.ate) / 2;
  const naveL = NAVE.ate - NAVE.de;
  const frente = -0.5;
  const frenteCentro = -0.65;
  const tAlt = TORRE.ate - TORRE.de;
  const tFace = TORRE.x - TORRE.lado / 2 - 0.06;
  return (
    <>
      {/* adro elevado com escada para a praça */}
      <mesh position={[4.7, ADRO / 2, 0]} castShadow receiveShadow material={fab.cor("#ecebe6")}>
        <boxGeometry args={[13.8, ADRO, 9.2]} />
      </mesh>
      <mesh position={[-2.6, 0.15, 0]} castShadow receiveShadow material={fab.cor("#ecebe6")}>
        <boxGeometry args={[0.8, 0.3, 3]} />
      </mesh>

      {/* nave com barrado escuro, cornija branca e telhado de duas águas */}
      <mesh position={[naveC, y0 + NAVE.alto / 2, 0]} castShadow receiveShadow material={azul}>
        <boxGeometry args={[naveL, NAVE.alto, NAVE.meia * 2]} />
      </mesh>
      <mesh position={[naveC, y0 + 0.5, 0]} receiveShadow material={barrado}>
        <boxGeometry args={[naveL + 0.1, 1, NAVE.meia * 2 + 0.1]} />
      </mesh>
      <mesh position={[naveC, y0 + NAVE.alto - 0.1, 0]} castShadow material={branco}>
        <boxGeometry args={[naveL + 0.2, 0.3, NAVE.meia * 2 + 0.3]} />
      </mesh>
      <mesh geometry={prisma} position={[naveC + 0.1, y0 + NAVE.alto + 0.05, 0]} rotation-y={Math.PI / 2} scale={[NAVE.meia * 2 + 0.6, 2.1, naveL + 0.4]} castShadow receiveShadow material={telhado} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[NAVE.ate - 0.15, y0 + NAVE.alto / 2, s * (NAVE.meia - 0.05)]} castShadow material={branco}>
          <boxGeometry args={[0.45, NAVE.alto, 0.45]} />
        </mesh>
      ))}
      <JanelasNave fab={fab} />

      {/* fachada: corpo largo, parte central mais alta e saliente */}
      <mesh position={[0, y0 + FACHADA.alto / 2, 0]} castShadow receiveShadow material={azul}>
        <boxGeometry args={[1, FACHADA.alto, FACHADA.meia * 2]} />
      </mesh>
      <mesh position={[-0.05, y0 + FACHADA.altoCentro / 2, 0]} castShadow receiveShadow material={azulCentro}>
        <boxGeometry args={[1.2, FACHADA.altoCentro, FACHADA.meiaCentro * 2]} />
      </mesh>
      <mesh position={[0, y0 + 0.55, 0]} receiveShadow material={barrado}>
        <boxGeometry args={[1.08, 1.1, FACHADA.meia * 2 + 0.08]} />
      </mesh>
      {/* pilastras e cornijas brancas */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[frente - 0.05, y0 + FACHADA.alto / 2, s * (FACHADA.meia - 0.22)]} castShadow material={branco}>
            <boxGeometry args={[0.2, FACHADA.alto, 0.5]} />
          </mesh>
          <mesh position={[frenteCentro - 0.08, y0 + FACHADA.altoCentro / 2, s * (FACHADA.meiaCentro - 0.2)]} castShadow material={branco}>
            <boxGeometry args={[0.2, FACHADA.altoCentro, 0.45]} />
          </mesh>
        </group>
      ))}
      <mesh position={[-0.1, y0 + FACHADA.alto, 0]} castShadow material={branco}>
        <boxGeometry args={[1.3, 0.3, FACHADA.meia * 2 + 0.3]} />
      </mesh>
      <mesh position={[-0.15, y0 + FACHADA.altoCentro, 0]} castShadow material={branco}>
        <boxGeometry args={[1.5, 0.3, FACHADA.meiaCentro * 2 + 0.4]} />
      </mesh>
      <mesh position={[frenteCentro - 0.06, y0 + 4.6, 0]} material={branco}>
        <boxGeometry args={[0.14, 0.2, FACHADA.meiaCentro * 2]} />
      </mesh>
      {/* frontão triangular sobre a parte central */}
      <mesh geometry={prisma} position={[frenteCentro + 0.05, y0 + FACHADA.altoCentro + 0.15, 0]} rotation-y={Math.PI / 2} scale={[FACHADA.meiaCentro * 2 + 0.4, 0.95, 0.4]} castShadow material={branco} />
      <mesh geometry={prisma} position={[frenteCentro + 0.02, y0 + FACHADA.altoCentro + 0.3, 0]} rotation-y={Math.PI / 2} scale={[FACHADA.meiaCentro * 2 - 0.4, 0.6, 0.4]} material={azulCentro} />

      {/* portas em arco e óculos */}
      <Porta fab={fab} x={frenteCentro} z={0} largura={1.1} altura={2.4} cor="#2a2f36" />
      <Porta fab={fab} x={frente} z={-2.7} largura={0.85} altura={2} cor="#c9cfc8" />
      <Porta fab={fab} x={frente} z={2.7} largura={0.85} altura={2} cor="#c9cfc8" />
      <Oculo fab={fab} x={frenteCentro} y={y0 + 3.9} z={0} r={0.5} />
      <Oculo fab={fab} x={frente} y={y0 + 3.6} z={-2.7} r={0.38} />
      <Oculo fab={fab} x={frente} y={y0 + 3.6} z={2.7} r={0.38} />

      {/* torre: núcleo branco (cunhais) com painéis azuis em cada face */}
      <group position={[TORRE.x, TORRE.de + tAlt / 2, 0]}>
        <mesh castShadow receiveShadow material={branco}>
          <boxGeometry args={[TORRE.lado, tAlt, TORRE.lado]} />
        </mesh>
        <mesh castShadow material={azul}>
          <boxGeometry args={[TORRE.lado + 0.08, tAlt - 0.3, TORRE.lado - 0.6]} />
        </mesh>
        <mesh castShadow material={azul}>
          <boxGeometry args={[TORRE.lado - 0.6, tAlt - 0.3, TORRE.lado + 0.08]} />
        </mesh>
      </group>
      {/* nicho da santa, relógio e janela do sino na face oeste */}
      <Arco fab={fab} x={tFace} y={TORRE.de + 2.6} largura={0.7} altura={1.1} cor="#26303a" />
      <Arco fab={fab} x={tFace} y={TORRE.ate - 0.95} largura={0.6} altura={0.6} cor="#26303a" />
      {(
        [
          [tFace - 0.02, 0, -Math.PI / 2],
          [TORRE.x, -TORRE.lado / 2 - 0.08, Math.PI],
          [TORRE.x, TORRE.lado / 2 + 0.08, 0],
        ] as const
      ).map(([x, z, ry], i) => (
        <group key={i} position={[x, TORRE.ate - 2, z]} rotation-y={ry}>
          <mesh material={branco}>
            <circleGeometry args={[0.68, 24]} />
          </mesh>
          <mesh position-z={0.01} material={relogio}>
            <circleGeometry args={[0.58, 24]} />
          </mesh>
        </group>
      ))}
      {/* cornija do topo, tambor octogonal, flecha piramidal e cruz */}
      <mesh position={[TORRE.x, TORRE.ate + 0.12, 0]} castShadow material={branco}>
        <boxGeometry args={[TORRE.lado + 0.4, 0.25, TORRE.lado + 0.4]} />
      </mesh>
      <mesh position={[TORRE.x, TORRE.ate + 0.55, 0]} rotation-y={Math.PI / 8} castShadow material={azul}>
        <cylinderGeometry args={[1, 1.05, 0.65, 8]} />
      </mesh>
      <mesh position={[TORRE.x, TORRE.ate + 0.92, 0]} rotation-y={Math.PI / 8} castShadow material={branco}>
        <cylinderGeometry args={[1.12, 1.12, 0.12, 8]} />
      </mesh>
      <mesh position={[TORRE.x, TORRE.ate + 1.68, 0]} rotation-y={Math.PI / 4} castShadow material={branco}>
        <coneGeometry args={[1.1, 1.45, 4]} />
      </mesh>
      <mesh position={[TORRE.x, TORRE.ate + 2.75, 0]} castShadow material={escuro}>
        <boxGeometry args={[0.08, 0.75, 0.08]} />
      </mesh>
      <mesh position={[TORRE.x, TORRE.ate + 2.85, 0]} material={escuro}>
        <boxGeometry args={[0.08, 0.08, 0.5]} />
      </mesh>
    </>
  );
}

/** Abertura em arco pleno pintada na face oeste (−x) */
function Arco({ fab, x, y, largura, altura, cor }: { fab: Fabrica; x: number; y: number; largura: number; altura: number; cor: string }) {
  const r = largura / 2;
  return (
    <group position={[x, y, 0]} rotation-y={-Math.PI / 2}>
      <mesh position-y={-r / 2} material={fab.cor("#f3f4f2")}>
        <planeGeometry args={[largura + 0.24, altura - r + 0.12]} />
      </mesh>
      <mesh position-y={altura / 2 - r} material={fab.cor("#f3f4f2")}>
        <circleGeometry args={[r + 0.12, 16, 0, Math.PI]} />
      </mesh>
      <mesh position={[0, -r / 2, 0.01]} material={fab.cor(cor, 0.6)}>
        <planeGeometry args={[largura, altura - r]} />
      </mesh>
      <mesh position={[0, altura / 2 - r, 0.01]} material={fab.cor(cor, 0.6)}>
        <circleGeometry args={[r, 16, 0, Math.PI]} />
      </mesh>
    </group>
  );
}

function Porta({ fab, x, z, largura, altura, cor }: { fab: Fabrica; x: number; z: number; largura: number; altura: number; cor: string }) {
  return (
    <group position-z={z}>
      <Arco fab={fab} x={x - 0.01} y={ADRO + altura / 2 + 0.02} largura={largura} altura={altura} cor={cor} />
    </group>
  );
}

function Oculo({ fab, x, y, z, r }: { fab: Fabrica; x: number; y: number; z: number; r: number }) {
  return (
    <group position={[x - 0.01, y, z]} rotation-y={-Math.PI / 2}>
      <mesh material={fab.cor("#f3f4f2")}>
        <circleGeometry args={[r + 0.13, 20]} />
      </mesh>
      <mesh position-z={0.01} material={fab.cor("#33404d", 0.6)}>
        <circleGeometry args={[r, 20]} />
      </mesh>
    </group>
  );
}

const JANELAS_X = [2.4, 4.6, 6.8, 9];

/** Janelas em arco das laterais da nave: moldura branca e vão escuro, instanciados */
function JanelasNave({ fab }: { fab: Fabrica }) {
  const moldura = useRef<THREE.InstancedMesh>(null);
  const vao = useRef<THREE.InstancedMesh>(null);
  const n = JANELAS_X.length * 2;
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    let k = 0;
    for (const x of JANELAS_X) {
      for (const s of [-1, 1]) {
        o.position.set(x, ADRO + 2.8, s * (NAVE.meia + 0.02));
        o.updateMatrix();
        moldura.current!.setMatrixAt(k, o.matrix);
        o.position.set(x, ADRO + 2.8, s * (NAVE.meia + 0.06));
        o.updateMatrix();
        vao.current!.setMatrixAt(k, o.matrix);
        k++;
      }
    }
    moldura.current!.instanceMatrix.needsUpdate = true;
    vao.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <>
      <instancedMesh ref={moldura} args={[undefined, undefined, n]} material={fab.cor("#f3f4f2")}>
        <boxGeometry args={[1, 2.3, 0.06]} />
      </instancedMesh>
      <instancedMesh ref={vao} args={[undefined, undefined, n]} material={fab.cor("#33404d", 0.6)}>
        <boxGeometry args={[0.6, 1.8, 0.06]} />
      </instancedMesh>
    </>
  );
}

// ——— Vegetação ———

function Mata({ fab }: { fab: Fabrica }) {
  const copa = useRef<THREE.InstancedMesh>(null);
  const tronco = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    for (let i = 0; i < MATA.length; i++) {
      const a = MATA[i];
      o.position.set(a.x, 1.4 * a.r + 0.6, a.z);
      o.scale.set(a.r, a.r * 0.85, a.r);
      o.rotation.set(0, a.cor * 6, 0);
      o.updateMatrix();
      copa.current!.setMatrixAt(i, o.matrix);
      copa.current!.setColorAt(i, cor.set(a.cor < 0.5 ? "#2f5a2b" : a.cor < 0.8 ? "#4c7a3a" : "#5e8a44"));
      o.position.set(a.x, 0.8, a.z);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      tronco.current!.setMatrixAt(i, o.matrix);
    }
    copa.current!.instanceMatrix.needsUpdate = true;
    if (copa.current!.instanceColor) copa.current!.instanceColor.needsUpdate = true;
    tronco.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <>
      <instancedMesh ref={copa} args={[undefined, undefined, MATA.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={tronco} args={[undefined, undefined, MATA.length]} castShadow material={fab.cor("#7a6249")}>
        <cylinderGeometry args={[0.18, 0.26, 1.6, 6]} />
      </instancedMesh>
    </>
  );
}

const FOLHAS = 7;

function Palmeiras({ fab }: { fab: Fabrica }) {
  const caule = useRef<THREE.InstancedMesh>(null);
  const folha = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    for (let i = 0; i < PALMEIRAS.length; i++) {
      const p = PALMEIRAS[i];
      o.position.set(p.x, p.h / 2, p.z);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, p.h, 1);
      o.updateMatrix();
      caule.current!.setMatrixAt(i, o.matrix);
      o.scale.set(1, 1, 1);
      for (let f = 0; f < FOLHAS; f++) {
        const ang = p.giro + (f / FOLHAS) * Math.PI * 2;
        o.rotation.set(0.45, ang, 0, "YXZ");
        o.position.set(p.x + Math.sin(ang) * 1.2, p.h - 0.35, p.z + Math.cos(ang) * 1.2);
        o.updateMatrix();
        folha.current!.setMatrixAt(i * FOLHAS + f, o.matrix);
      }
    }
    caule.current!.instanceMatrix.needsUpdate = true;
    folha.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <>
      <instancedMesh ref={caule} args={[undefined, undefined, PALMEIRAS.length]} castShadow material={fab.cor("#8b7355")}>
        <cylinderGeometry args={[0.14, 0.22, 1, 6]} />
      </instancedMesh>
      <instancedMesh ref={folha} args={[undefined, undefined, PALMEIRAS.length * FOLHAS]} castShadow material={fab.cor("#6b9b3f")}>
        <boxGeometry args={[0.5, 0.08, 2.8]} />
      </instancedMesh>
    </>
  );
}
