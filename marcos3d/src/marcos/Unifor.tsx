import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../Cena";

/**
 * Campus da Unifor em miniatura. As posições vêm do OpenStreetMap (pesquisa/marcos/unifor/ficha.md),
 * em metros reais com x = leste, y = norte e a origem no centro do campus; `K` encolhe o campus de
 * ~1 km para caber na base. Os edifícios-chave crescem `E` vezes além disso para lerem de longe.
 * Metros, norte em −z.
 */
type Xy = [number, number];

const K = 0.058;
const E = 1.7;
const CENTRO: Xy = [30, 10];
const emM = ([x, y]: Xy): Xy => [(x - CENTRO[0]) * K, -(y - CENTRO[1]) * K];

const CAMPUS: Xy[] = [
  [-328, 80], [-461, 68], [-422, -280], [367, -215], [415, -113], [529, 48], [460, 76], [456, 192], [390, 183], [322, 231], [277, 242], [105, 208], [98, 301], [-337, 262],
];
const REITORIA: Xy[] = [[-7, -7], [38, -19], [42, 5], [-4, 9], [-11, 41], [-24, 36], [-20, 20], [-21, 2], [-27, -13], [-35, -26], [-25, -35], [-16, -23], [-10, -9]];
const BIBLIOTECA: Xy[] = [[-5, -39], [7, -34], [8, -37], [22, -31], [20, -27], [32, -22], [4, 40], [-32, 24]];

/** Barras de aula: centro, comprimento × largura (m reais) e rumo do eixo maior; o Bloco M fica à parte */
const BLOCOS: [x: number, y: number, c: number, l: number, rumo: number][] = [
  [-170, 140, 78, 19, 65], [-150, 112, 78, 19, 65], [-130, 84, 78, 19, 65],
  [-291, -189, 119, 45, 155], [-30, 60, 86, 22, 155], [20, 120, 80, 20, 65], [-10, -110, 84, 22, 155],
  [-120, -160, 80, 20, 65], [-240, 130, 70, 20, 155], [-250, -95, 76, 20, 155], [140, -20, 80, 20, 155],
  [-60, -210, 84, 20, 65], [180, -170, 76, 20, 65], [60, 200, 70, 20, 65], [-210, 220, 70, 20, 65],
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

/** Forma deitada no chão (pontos em metros já convertidos, x e z) */
function forma(pts: Xy[]) {
  return new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
}

/** Texto branco sobre faixa azul-marinho (letreiro do Convivência) ou sobre o telhado claro (Bloco M) */
function texturaTexto(texto: string, fundo: string, cor: string, largura: number) {
  const cv = document.createElement("canvas");
  cv.width = largura;
  cv.height = 96;
  const g = cv.getContext("2d")!;
  g.fillStyle = fundo;
  g.fillRect(0, 0, largura, 96);
  g.fillStyle = cor;
  g.textAlign = "center";
  g.textBaseline = "middle";
  let tamanho = 72;
  g.font = `800 ${tamanho}px system-ui, sans-serif`;
  while (g.measureText(texto).width > largura * 0.92 && tamanho > 20) g.font = `800 ${(tamanho -= 4)}px system-ui, sans-serif`;
  g.fillText(texto, largura / 2, 52);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Edifício extrudado a partir do contorno local do OSM, com o tamanho exagerado `E` */
function Extrudado({ local, em, altura, paredes, telhado }: { local: Xy[]; em: Xy; altura: number; paredes: THREE.Material; telhado: THREE.Material }) {
  const geo = useMemo(() => {
    const [cx, cz] = emM(em);
    const pts = local.map(([x, y]): Xy => [cx + x * K * E, cz - y * K * E]);
    return new THREE.ExtrudeGeometry(forma(pts), { depth: altura, bevelEnabled: false });
  }, [local, em, altura]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={[telhado, paredes]} rotation-x={-Math.PI / 2} castShadow receiveShadow />;
}

function CentroDeConvivencia({ fab }: { fab: Fabrica }) {
  const letreiro = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: texturaTexto("UNIVERSIDADE DE FORTALEZA", "#1e3a6e", "#ffffff", 1024), roughness: 0.6 });
    return m;
  }, []);
  useEffect(
    () => () => {
      letreiro.map?.dispose();
      letreiro.dispose();
    },
    [letreiro],
  );
  const [x, z] = emM([-195, -42]);
  const r = 27 * K * E;
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={1.5} material={fab.cor("#edede8", 0.85)} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, 3, 32]} />
      </mesh>
      {/* cúpula branca baixa, o ícone do campus */}
      <mesh position-y={3} scale={[1, 0.62, 1]} material={fab.cor("#f4f5f2", 0.5)} castShadow>
        <sphereGeometry args={[r * 0.86, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* torres cilíndricas de vidro azul e a parede azul-petróleo, a oeste */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-r * 0.92, 2.6, s * r * 0.55]} material={fab.cor("#3d5f8c", 0.15)} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 5.2, 16]} />
        </mesh>
      ))}
      <mesh position={[-r - 0.5, 1.4, 0]} material={fab.cor("#3f7c8a", 0.6)} castShadow>
        <boxGeometry args={[0.3, 2.8, r * 0.9]} />
      </mesh>
      {/* pórtico branco com o letreiro, virado para a praça a oeste */}
      <group position={[-r - 1.7, 0, 0]} rotation-y={-Math.PI / 2}>
        <mesh position-y={1.6} material={fab.cor("#f4f4f2", 0.6)} castShadow>
          <boxGeometry args={[4.4, 3.2, 0.5]} />
        </mesh>
        <mesh position={[0, 2.5, 0.26]} material={letreiro}>
          <planeGeometry args={[4.2, 0.45]} />
        </mesh>
      </group>
    </group>
  );
}

function Ginasio({ fab }: { fab: Fabrica }) {
  const [x, z] = emM([67, -106]);
  const lado = 80 * K * 1.4;
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.8} material={fab.cor("#e4e6e3", 0.85)} castShadow receiveShadow>
        <boxGeometry args={[lado, 1.6, lado * 0.94]} />
      </mesh>
      {/* abóbada metálica em forma de hangar, geratriz leste–oeste */}
      <mesh position-y={1.6} rotation-z={Math.PI / 2} material={fab.cor("#d6d9db", 0.35)} castShadow receiveShadow>
        <cylinderGeometry args={[lado * 0.47, lado * 0.47, lado, 24, 1, false, Math.PI / 2, Math.PI]} />
      </mesh>
    </group>
  );
}

function PistaEEstacionamentoSolar({ fab }: { fab: Fabrica }) {
  const [px, pz] = emM([270, 0]);
  const [sx, sz] = emM([113, 114]);
  const largura = 158 * K;
  const fundo = 147 * K;
  return (
    <>
      {/* pista oval vermelha com o campo, eixo quase norte–sul */}
      <group position={[px, 0.05, pz]} rotation-x={-Math.PI / 2}>
        <mesh scale={[121 * K * 0.55, 191 * K * 0.55, 1]} material={fab.cor("#b5675f", 0.9)} receiveShadow>
          <circleGeometry args={[1, 40]} />
        </mesh>
        <mesh position-z={0.02} scale={[121 * K * 0.42, 191 * K * 0.45, 1]} material={fab.cor("#4e8f3a", 0.9)} receiveShadow>
          <circleGeometry args={[1, 40]} />
        </mesh>
      </group>
      <mesh position={[px - 121 * K * 0.62, 0.6, pz]} material={fab.cor("#e4e6e3", 0.8)} castShadow>
        <boxGeometry args={[0.8, 1.2, 191 * K * 0.6]} />
      </mesh>
      {/* estacionamento solar: fileiras de painéis azul-escuros */}
      <mesh position={[sx, 0.04, sz]} rotation-x={-Math.PI / 2} material={fab.cor("#8a8c8c", 0.95)} receiveShadow>
        <planeGeometry args={[largura, fundo]} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[sx, 0.7, sz - fundo / 2 + (i + 0.5) * (fundo / 6)]} rotation-x={-0.25} material={fab.cor("#2b3a5c", 0.3)} castShadow>
          <boxGeometry args={[largura * 0.92, 0.08, fundo / 6 - 0.35]} />
        </mesh>
      ))}
    </>
  );
}

function BlocosEMata({ fab }: { fab: Fabrica }) {
  const { blocos, arvores } = useMemo(() => {
    const b = BLOCOS.map(([x, y, c, l, rumo]) => {
      const [mx, mz] = emM([x, y]);
      return { x: mx, z: mz, c: c * K * 1.25, l: l * K * 1.5, giro: -THREE.MathUtils.degToRad(rumo - 90) };
    });
    // áreas sem árvores: em volta de cada edifício e da pista (em metros da miniatura)
    const livres: [number, number, number][] = [
      ...b.map((q): [number, number, number] => [q.x, q.z, q.c / 2 + 0.8]),
      [...emM([-403, -18]), 4.8], [...emM([-309, -2]), 3.8], [...emM([-195, -42]), 4.5], [...emM([-81, -5]), 4.2],
      [...emM([67, -106]), 4.6], [...emM([270, 0]), 7], [...emM([113, 114]), 5.6], [...emM([312, 294]), 8],
    ];
    const campus = CAMPUS.map(emM);
    const rnd = aleatorio(31);
    const a: { x: number; z: number; s: number }[] = [];
    for (let x = -30; x <= 30; x += 1.5) {
      for (let z = -30; z <= 30; z += 1.5) {
        const px = x + (rnd() - 0.5) * 1.1;
        const pz = z + (rnd() - 0.5) * 1.1;
        if (Math.hypot(px, pz) > 30 || !dentro([px, pz], campus)) continue;
        if (livres.some(([lx, lz, r]) => Math.hypot(px - lx, pz - lz) < r)) continue;
        if (rnd() < 0.25) continue;
        a.push({ x: px, z: pz, s: 0.7 + rnd() * 0.5 });
      }
    }
    return { blocos: b, arvores: a };
  }, []);

  const barras = useRef<THREE.InstancedMesh>(null);
  const copas = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    blocos.forEach((q, i) => {
      o.position.set(q.x, 1.1, q.z);
      o.rotation.set(0, q.giro, 0);
      o.scale.set(q.c, 2.2, q.l);
      o.updateMatrix();
      barras.current!.setMatrixAt(i, o.matrix);
    });
    barras.current!.instanceMatrix.needsUpdate = true;
    const cor = new THREE.Color();
    const tons = ["#2f5a2a", "#4a7a3a", "#3a6a30", "#2a5226"];
    o.rotation.set(0, 0, 0);
    arvores.forEach((t, i) => {
      o.position.set(t.x, t.s * 0.9, t.z);
      o.scale.set(t.s, t.s * 0.8, t.s);
      o.updateMatrix();
      copas.current!.setMatrixAt(i, o.matrix);
      copas.current!.setColorAt(i, cor.set(tons[i % tons.length]));
    });
    copas.current!.instanceMatrix.needsUpdate = true;
    if (copas.current!.instanceColor) copas.current!.instanceColor.needsUpdate = true;
  }, [blocos, arvores]);

  return (
    <>
      <instancedMesh ref={barras} args={[undefined, undefined, blocos.length]} material={fab.cor("#edede8", 0.85)} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={copas} args={[undefined, undefined, arvores.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
    </>
  );
}

/** Bloco M com o "UNIFOR" pintado em branco no telhado, legível do alto */
function BlocoM({ fab }: { fab: Fabrica }) {
  const telhado = useMemo(() => new THREE.MeshStandardMaterial({ map: texturaTexto("UNIFOR", "#c9cdcb", "#ffffff", 512), roughness: 0.8 }), []);
  useEffect(
    () => () => {
      telhado.map?.dispose();
      telhado.dispose();
    },
    [telhado],
  );
  const [x, z] = emM([-81, -5]);
  const c = 70 * K * E;
  const l = 41 * K * E;
  // lido de norte para sul no satélite: o texto corre ao longo do eixo maior, a 156°
  return (
    <group position={[x, 0, z]} rotation-y={-THREE.MathUtils.degToRad(156 - 90)}>
      <mesh position-y={1.5} material={fab.cor("#edede8", 0.85)} castShadow receiveShadow>
        <boxGeometry args={[c, 3, l]} />
      </mesh>
      <mesh position-y={3.02} rotation-x={-Math.PI / 2} material={telhado}>
        <planeGeometry args={[c * 0.96, l * 0.9]} />
      </mesh>
    </group>
  );
}

export function Unifor({ fab }: { fab: Fabrica }) {
  const chao = useMemo(() => new THREE.ShapeGeometry(forma(CAMPUS.map(emM))), []);
  useEffect(() => () => chao.dispose(), [chao]);
  const [lx, lz] = emM([312, 294]);
  const [wx] = emM([-470, 0]);
  return (
    <group>
      <mesh geometry={chao} rotation-x={-Math.PI / 2} position-y={0.03} material={fab.cor("#7fa35a", 0.95)} receiveShadow />
      {/* Av. Washington Soares na borda oeste */}
      <mesh position={[wx - 0.8, 0.02, 0]} rotation={[-Math.PI / 2, 0, THREE.MathUtils.degToRad(-6)]} material={fab.cor("#5c5f61", 0.95)} receiveShadow>
        <planeGeometry args={[2, 30]} />
      </mesh>
      {/* laguinho, fora da cerca no nordeste */}
      <mesh position={[lx, 0.06, lz]} rotation={[-Math.PI / 2, 0, -THREE.MathUtils.degToRad(107 - 90)]} scale={[284 * K * 0.5, 115 * K * 0.5, 1]} material={fab.agua()} receiveShadow>
        <circleGeometry args={[1, 28]} />
      </mesh>

      <Extrudado local={REITORIA} em={[-403, -18]} altura={3.2} paredes={fab.cor("#c9c7a2", 0.85)} telhado={fab.cor("#e9e8df", 0.8)} />
      <Extrudado local={BIBLIOTECA} em={[-309, -2]} altura={2.6} paredes={fab.cor("#edede8", 0.85)} telhado={fab.cor("#e4e6e3", 0.85)} />
      <CentroDeConvivencia fab={fab} />
      <BlocoM fab={fab} />
      <Ginasio fab={fab} />
      <PistaEEstacionamentoSolar fab={fab} />
      <BlocosEMata fab={fab} />
    </group>
  );
}
