import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../Cena";
import { caixaChanfrada, prismaDePlanta } from "../util/geometria";

/**
 * Centro Administrativo Governador Virgílio Távora (Cambeba) em miniatura. Posições e contornos do
 * OpenStreetMap (pesquisa/marcos/cambeba/ficha.md), em metros reais com x = leste, y = norte e a
 * origem no centro do conjunto; `K` encolhe os ~870 m do lote e os prédios crescem `E` vezes além
 * disso para lerem de longe. Metros, norte em −z.
 */
type Xy = [number, number];

const K = 0.058;
const E = 1.8;
const emM = ([x, y]: Xy): Xy => [(x - 35) * K, -y * K];

const LOTE: Xy[] = [
  [-353, 277], [-426, -186], [331, -377], [374, -109], [393, 46], [440, 24], [495, 91], [62, 300], [-10, 326], [-164, 368], [-180, 370], [-195, 367], [-276, 311], [-320, 289],
];
const VIA: Xy[] = [[-297, 343], [-180, 180], [-60, 0], [60, -100], [150, -230]];

/** Prédios com contorno do OSM (em volta do próprio centro) e altura já da miniatura */
const COM_CONTORNO: { centro: Xy; pts: Xy[]; h: number; brises: boolean; telhado: string }[] = [
  { centro: [121, -41], pts: [[-14, 22], [-67, -2], [-47, -48], [67, 1], [48, 48], [-5, 26], [-7, 29], [-16, 25]], h: 4.4, brises: true, telhado: "#9b9993" }, // TJCE
  { centro: [-97, 166], pts: [[38, -25], [52, -19], [23, 50], [-55, 4], [-36, -42], [19, -19], [25, -31]], h: 2.4, brises: false, telhado: "#e4e2dc" }, // MP
  { centro: [67, 42], pts: [[-64, -32], [-55, -54], [29, -18], [4, 3], [73, 32], [64, 53], [-47, 7], [-22, -15]], h: 3.6, brises: false, telhado: "#4f524f" }, // Seplag
  { centro: [-274, -109], pts: [[-52, 4], [-34, -38], [-22, -41], [51, -2], [33, 40]], h: 5.4, brises: true, telhado: "#575a57" }, // Seduc
];
/** Prédios só com medidas: centro, comprimento × largura reais, rumo do eixo maior e altura da miniatura */
const CAIXAS: [x: number, y: number, c: number, l: number, rumo: number, h: number, brises: boolean][] = [
  [-167, 219, 77, 38, 67, 4.6, true], // Semace
  [-244, 23, 79, 34, 70, 4.2, true], // Seinfra/SRH
  [-132, -19, 64, 40, 67, 1.8, false], // Centro de Convivência do Servidor
];

/** Gerador determinístico: a mata sai igual em toda visita */
function aleatorio(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dentro([x, y]: Xy, p: Xy[]) {
  let d = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/** Concreto aparente com os brises verticais marrons; a extrusão usa UV em metros (uma lâmina a cada 0,5 m) */
function texturaBrises() {
  const cv = document.createElement("canvas");
  cv.width = 16;
  cv.height = 32;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#a8a69f";
  g.fillRect(0, 0, 16, 32);
  g.fillStyle = "#5c3a2a";
  g.fillRect(6, 0, 5, 26);
  g.fillStyle = "#3c3f40";
  g.fillRect(0, 26, 16, 6);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1 / 1.2);
  return t;
}

function Predios({ fab }: { fab: Fabrica }) {
  const { geos, caixas, brises } = useMemo(() => {
    const g = COM_CONTORNO.map((p) => {
      const [cx, cz] = emM(p.centro);
      return prismaDePlanta(p.pts.map(([x, y]): Xy => [cx + x * K * E, cz - y * K * E]), p.h, 0, 0.1);
    });
    const caixas = CAIXAS.map(([, , c, l, , h]) => caixaChanfrada(c * K * E, h, l * K * E, 0.1));
    const brises = new THREE.MeshStandardMaterial({ map: texturaBrises(), roughness: 0.9 });
    brises.name = "Mat_Concreto_Brises";
    return { geos: g, caixas, brises };
  }, []);
  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose());
      caixas.forEach((g) => g.dispose());
      brises.map?.dispose();
      brises.dispose();
    },
    [geos, caixas, brises],
  );
  const concreto = fab.cor("#a8a69f", 0.9);
  return (
    <>
      {COM_CONTORNO.map((p, i) => (
        <mesh name={`Predio_Contorno_${i + 1}`} key={i} geometry={geos[i]} material={[fab.cor(p.telhado, 0.85), p.brises ? brises : concreto]} castShadow receiveShadow />
      ))}
      {CAIXAS.map(([x, y, c, l, rumo, h, b], i) => {
        const [mx, mz] = emM([x, y]);
        return (
          <mesh name={`Predio_Caixa_${i + 1}`} key={i} geometry={caixas[i]} position={[mx, 0, mz]} rotation-y={THREE.MathUtils.degToRad(90 - rumo)} material={b ? brises : concreto} castShadow receiveShadow />
        );
      })}
    </>
  );
}

/** Escultura helicoidal da rotatória de entrada: uma "trança" de losangos prateados */
function Escultura({ fab }: { fab: Fabrica }) {
  const [x, z] = emM([-297, 343]);
  return (
    <group position={[x, 0, z]}>
      <mesh name="Escultura_Canteiro" position-y={0.08} material={fab.cor("#7fa35a", 0.95)} receiveShadow>
        <cylinderGeometry args={[2.2, 2.2, 0.16, 24]} />
      </mesh>
      <mesh name="Escultura_Base" position-y={0.35} material={fab.cor("#c9c7c0", 0.8)}>
        <boxGeometry args={[0.9, 0.5, 0.9]} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh name={`Escultura_Losango_${i + 1}`} key={i} position-y={0.8 + i * 0.5} rotation={[0, i * 0.55, Math.PI / 4]} material={fab.cor("#d6d9db", 0.25)} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.12]} />
        </mesh>
      ))}
    </group>
  );
}

/** Via interna em diagonal, da rotatória para o sudeste */
function Via({ fab }: { fab: Fabrica }) {
  const trechos = VIA.slice(1).map((p, i) => {
    const [ax, az] = emM(VIA[i]);
    const [bx, bz] = emM(p);
    return { x: (ax + bx) / 2, z: (az + bz) / 2, c: Math.hypot(bx - ax, bz - az), giro: Math.atan2(-(bz - az), bx - ax) };
  });
  return (
    <>
      {trechos.map((t, i) => (
        <mesh name={`Via_Interna_${i + 1}`} key={i} position={[t.x, 0.07, t.z]} rotation={[-Math.PI / 2, 0, t.giro]} material={fab.cor("#6b6d6e", 0.95)} receiveShadow>
          <planeGeometry args={[t.c + 1, 1.3]} />
        </mesh>
      ))}
    </>
  );
}

/** Mata densa da ARIE do Cambeba, fora dos prédios, da via e da lagoa */
function Mata({ fab }: { fab: Fabrica }) {
  const arvores = useMemo(() => {
    const rnd = aleatorio(41);
    const lote = LOTE.map(emM);
    const livres: [number, number, number][] = [
      ...COM_CONTORNO.map((p): [number, number, number] => [...emM(p.centro), 7]),
      ...CAIXAS.map(([x, y, c]): [number, number, number] => [...emM([x, y]), (c * K * E) / 2 + 1]),
      [...emM([-297, 343]), 2.8],
      [...emM([-108, -144]), 5],
    ];
    const via = VIA.map(emM);
    const pertoDaVia = (px: number, pz: number) => {
      for (let i = 1; i < via.length; i++) {
        const [ax, az] = via[i - 1];
        const [bx, bz] = via[i];
        const dx = bx - ax;
        const dz = bz - az;
        const t = THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
        if (Math.hypot(px - (ax + t * dx), pz - (az + t * dz)) < 1.5) return true;
      }
      return false;
    };
    const lista: { x: number; z: number; s: number }[] = [];
    for (let x = -30; x <= 30; x += 1.4) {
      for (let z = -30; z <= 30; z += 1.4) {
        const px = x + (rnd() - 0.5) * 1;
        const pz = z + (rnd() - 0.5) * 1;
        if (Math.hypot(px, pz) > 30 || !dentro([px, pz], lote) || rnd() < 0.2) continue;
        if (livres.some(([lx, lz, r]) => Math.hypot(px - lx, pz - lz) < r) || pertoDaVia(px, pz)) continue;
        lista.push({ x: px, z: pz, s: 0.75 + rnd() * 0.45 });
      }
    }
    return lista;
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  const troncos = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const tons = ["#2f5e2a", "#3a6a30", "#28522a", "#45743a"];
    arvores.forEach((a, i) => {
      o.position.set(a.x, a.s * 0.9, a.z);
      o.scale.set(a.s, a.s * 0.8, a.s);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
      ref.current!.setColorAt(i, cor.set(tons[i % tons.length]));
      o.position.set(a.x, a.s * 0.38, a.z);
      o.scale.set(a.s * 0.14, a.s * 0.76, a.s * 0.14);
      o.updateMatrix();
      troncos.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
    troncos.current!.instanceMatrix.needsUpdate = true;
  }, [arvores]);
  return (
    <>
      <instancedMesh name="Arvores_Mata" ref={ref} args={[undefined, undefined, arvores.length]} castShadow receiveShadow material={fab.cor("#ffffff", 0.9)}>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
      <instancedMesh name="Arvores_Mata_Troncos" ref={troncos} args={[undefined, undefined, arvores.length]} castShadow material={fab.cor("#72513a", 0.9)}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
      </instancedMesh>
    </>
  );
}

export function Cambeba({ fab }: { fab: Fabrica }) {
  const chao = useMemo(() => new THREE.ShapeGeometry(new THREE.Shape(LOTE.map((p) => {
    const [x, z] = emM(p);
    return new THREE.Vector2(x, -z);
  }))), []);
  useEffect(() => () => chao.dispose(), [chao]);
  const [lx, lz] = emM([-108, -144]);
  const [ex, ez] = emM([-40, 150]);
  return (
    <group>
      <mesh name="Terreno_Cambeba" geometry={chao} rotation-x={-Math.PI / 2} position-y={0.04} material={fab.cor("#6f9450", 0.95)} receiveShadow />
      {/* lagoa e brejo do riacho, alongada norte–sul */}
      <mesh name="Lagoa_Riacho" position={[lx, 0.07, lz]} rotation-x={-Math.PI / 2} scale={[40 * K * 0.9, 150 * K * 0.6, 1]} material={fab.cor("#3f6b62", 0.25)}>
        <circleGeometry args={[1, 24]} />
      </mesh>
      {/* estacionamento do MP com as coberturas azuis de sombreamento */}
      <mesh name="Estacionamento_MP" position={[ex, 0.06, ez]} rotation-x={-Math.PI / 2} material={fab.cor("#8a8c8c", 0.95)} receiveShadow>
        <planeGeometry args={[4.2, 3.4]} />
      </mesh>
      {[-1, 0, 1].map((i) => (
        <mesh name={`Cobertura_Estacionamento_${i + 1}`} key={i} position={[ex, 0.9, ez + i * 1.05]} material={fab.cor("#2e5fb8", 0.5)} castShadow>
          <boxGeometry args={[3.8, 0.08, 0.7]} />
        </mesh>
      ))}
      <Via fab={fab} />
      <Predios fab={fab} />
      <Escultura fab={fab} />
      <Mata fab={fab} />
    </group>
  );
}
