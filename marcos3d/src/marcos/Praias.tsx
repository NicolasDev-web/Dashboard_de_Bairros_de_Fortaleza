import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { Fabrica } from "../Cena";

/**
 * Praias em miniatura sobre uma base comum: mar, arrebentação, areia, calçadão, avenida e um pedaço
 * da cidade. A base é montada num referencial local com o mar em −z e gira para o rumo real do mar
 * (pesquisa/marcos/praia-iracema e praia-futuro, fichas). Metros, norte em −z depois do giro.
 */
const R = 31.5;

interface Faixas {
  /** limites em z (local; o mar fica para −z): linha d'água, fim da areia, fim do calçadão, fim da avenida */
  agua: number;
  areia: number;
  calcadao: number;
  avenida: number;
  /** linhas de espuma no mar, em z */
  espuma: number[];
}

/** Gerador determinístico: a cidade e os guarda-sóis saem iguais em toda visita */
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

/** Faixa do disco entre z1 e z2, deitada no chão */
function faixa(z1: number, z2: number) {
  const pts: THREE.Vector2[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const z = z1 + ((z2 - z1) * i) / n;
    pts.push(new THREE.Vector2(Math.sqrt(Math.max(0, R * R - z * z)), -z));
  }
  for (let i = n; i >= 0; i--) {
    const z = z1 + ((z2 - z1) * i) / n;
    pts.push(new THREE.Vector2(-Math.sqrt(Math.max(0, R * R - z * z)), -z));
  }
  return new THREE.ShapeGeometry(new THREE.Shape(pts));
}

function Faixa({ z1, z2, y, material }: { z1: number; z2: number; y: number; material: THREE.Material }) {
  const geo = useMemo(() => faixa(z1, z2), [z1, z2]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={material} rotation-x={-Math.PI / 2} position-y={y} receiveShadow />;
}

/** Quarteirões atrás da avenida: prédios altos da orla na primeira fila e casas de telhado de barro atrás */
function Cidade({ desde, semente, altos, fab }: { desde: number; semente: number; altos: number; fab: Fabrica }) {
  const lotes = useMemo(() => {
    const rnd = aleatorio(semente);
    const lista: { x: number; z: number; w: number; d: number; h: number; telhado: boolean }[] = [];
    for (let z = desde + 2.5; z < R; z += 4.2) {
      for (let x = -R; x < R; x += 4.4) {
        const px = x + (rnd() - 0.5) * 0.8;
        if (Math.hypot(px, z) > R - 2.5 || rnd() < 0.18) continue;
        const primeira = z < desde + 6;
        const alto = primeira && rnd() < altos;
        lista.push({ x: px, z, w: alto ? 3 : 3.4, d: alto ? 3 : 3.2, h: alto ? 4.5 + rnd() * 5 : 1.4 + rnd() * 1.4, telhado: !alto });
      }
    }
    return lista;
  }, [desde, semente, altos]);
  const paredes = useRef<THREE.InstancedMesh>(null);
  const telhados = useRef<THREE.InstancedMesh>(null);
  const casas = lotes.filter((l) => l.telhado);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const tons = ["#efe9df", "#e8dfcf", "#f3efe6", "#d9e0e3", "#e2d6c3"];
    lotes.forEach((l, i) => {
      o.position.set(l.x, l.h / 2, l.z);
      o.rotation.set(0, 0, 0);
      o.scale.set(l.w, l.h, l.d);
      o.updateMatrix();
      paredes.current!.setMatrixAt(i, o.matrix);
      paredes.current!.setColorAt(i, cor.set(tons[i % tons.length]));
    });
    paredes.current!.instanceMatrix.needsUpdate = true;
    if (paredes.current!.instanceColor) paredes.current!.instanceColor.needsUpdate = true;
    casas.forEach((l, i) => {
      o.position.set(l.x, l.h + 0.5, l.z);
      o.rotation.set(0, Math.PI / 4, 0);
      o.scale.set((l.w / Math.SQRT2) * 1.08, 1, (l.d / Math.SQRT2) * 1.08);
      o.updateMatrix();
      telhados.current!.setMatrixAt(i, o.matrix);
    });
    telhados.current!.instanceMatrix.needsUpdate = true;
  }, [lotes, casas]);
  return (
    <>
      <instancedMesh ref={paredes} args={[undefined, undefined, lotes.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={telhados} args={[undefined, undefined, casas.length]} material={fab.cor("#c8693f", 0.85)} castShadow>
        <coneGeometry args={[1, 1, 4, 1]} />
      </instancedMesh>
    </>
  );
}

/** Mar, espuma, areia, calçadão, avenida e cidade, girados para o rumo real do mar */
function BasePraia({ rumoMar, f, cidadeAltos, corMar, fab, children }: { rumoMar: number; f: Faixas; cidadeAltos: number; corMar: string; fab: Fabrica; children: ReactNode }) {
  return (
    <group rotation-y={-THREE.MathUtils.degToRad(rumoMar)}>
      <Faixa z1={-R} z2={f.agua} y={0.05} material={fab.cor(corMar, 0.2)} />
      {f.espuma.map((z) => (
        <Faixa key={z} z1={z - 0.25} z2={z + 0.25} y={0.08} material={fab.cor("#f4f7f6", 0.6)} />
      ))}
      <Faixa z1={f.agua} z2={f.areia} y={0.06} material={fab.cor("#e6d3a6", 1)} />
      <Faixa z1={f.areia} z2={f.calcadao} y={0.09} material={fab.cor("#d9d2c4", 0.9)} />
      <Faixa z1={f.calcadao} z2={f.avenida} y={0.07} material={fab.cor("#5c5f61", 0.95)} />
      <Faixa z1={f.avenida} z2={R} y={0.06} material={fab.cor("#d3cfc6", 1)} />
      <Cidade desde={f.avenida} semente={Math.round(rumoMar * 7)} altos={cidadeAltos} fab={fab} />
      {children}
    </group>
  );
}

/** Coqueiros em instâncias: tronco inclinado e copa de folhas em estrela */
function Coqueiros({ pontos, fab }: { pontos: [number, number][]; fab: Fabrica }) {
  const troncos = useRef<THREE.InstancedMesh>(null);
  const copas = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    pontos.forEach(([x, z], i) => {
      const inclina = ((i * 37) % 9) / 40 - 0.1;
      o.position.set(x, 1.6, z);
      o.rotation.set(inclina, 0, -inclina);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      troncos.current!.setMatrixAt(i, o.matrix);
      o.position.set(x - inclina * 3, 3.2, z + inclina * 3);
      o.rotation.set(0, i, 0);
      o.scale.set(1.4, 0.35, 1.4);
      o.updateMatrix();
      copas.current!.setMatrixAt(i, o.matrix);
    });
    troncos.current!.instanceMatrix.needsUpdate = true;
    copas.current!.instanceMatrix.needsUpdate = true;
  }, [pontos]);
  return (
    <>
      <instancedMesh ref={troncos} args={[undefined, undefined, pontos.length]} material={fab.cor("#8b7355")} castShadow>
        <cylinderGeometry args={[0.08, 0.13, 3.2, 5]} />
      </instancedMesh>
      <instancedMesh ref={copas} args={[undefined, undefined, pontos.length]} material={fab.cor("#3f7a3a")} castShadow>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
    </>
  );
}

// ——— Praia de Iracema ———

/** Ponte dos Ingleses: pilares escuros em pente, deck branco, quiosques, pavilhão e torre na ponta */
function PonteDosIngleses({ fab }: { fab: Fabrica }) {
  const deck = { z1: 3, z2: -19, largura: 3, altura: 1.6 };
  const pilares = useRef<THREE.InstancedMesh>(null);
  const posicoes = useMemo(() => {
    const p: [number, number, number][] = [];
    // sob o deck, dos dois lados
    for (let z = deck.z1 - 0.6; z > deck.z2; z -= 1.1) for (const x of [-1.1, 1.1]) p.push([x, z, deck.altura]);
    // trecho de pilares sem piso que continua mar adentro
    for (let z = deck.z2 - 0.8; z > -29; z -= 1.1) for (const x of [-0.5, 0.5]) p.push([x, z, deck.altura - 0.3]);
    return p;
  }, [deck.z1, deck.z2, deck.altura]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    posicoes.forEach(([x, z, h], i) => {
      o.position.set(x, h / 2, z);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      pilares.current!.setMatrixAt(i, o.matrix);
    });
    pilares.current!.instanceMatrix.needsUpdate = true;
  }, [posicoes]);

  const comprimento = deck.z1 - deck.z2;
  const meio = (deck.z1 + deck.z2) / 2;
  const quiosque = (x: number, z: number, r: number) => (
    <group key={`${x}${z}`} position={[x, deck.altura, z]}>
      <mesh position-y={0.55} material={fab.cor("#f4f4f1", 0.7)} castShadow>
        <cylinderGeometry args={[r * 0.85, r * 0.85, 1.1, 8]} />
      </mesh>
      <mesh position-y={1.35} material={fab.cor("#f4f4f1", 0.6)} castShadow>
        <coneGeometry args={[r * 1.15, 0.6, 8]} />
      </mesh>
      {/* lanternim verde-sálvia no topo */}
      <mesh position-y={1.8} material={fab.cor("#9fb8a2", 0.6)}>
        <cylinderGeometry args={[r * 0.28, r * 0.28, 0.35, 8]} />
      </mesh>
    </group>
  );
  return (
    <group rotation-y={THREE.MathUtils.degToRad(-2)}>
      <instancedMesh ref={pilares} args={[undefined, undefined, posicoes.length]} material={fab.cor("#3b3d3e", 0.8)} castShadow>
        <boxGeometry args={[0.35, 1, 0.35]} />
      </instancedMesh>
      <mesh position={[0, deck.altura, meio]} material={fab.cor("#e9e7e1", 0.8)} castShadow receiveShadow>
        <boxGeometry args={[deck.largura, 0.25, comprimento]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (deck.largura / 2 - 0.05), deck.altura + 0.35, meio]} material={fab.cor("#f4f4f1", 0.6)}>
          <boxGeometry args={[0.08, 0.45, comprimento]} />
        </mesh>
      ))}
      {quiosque(-2.2, 2.4, 0.9)}
      {quiosque(2.2, 2.4, 0.9)}
      {quiosque(0, -3.5, 0.9)}
      {quiosque(0, -11, 0.9)}
      {/* pavilhão de quatro águas no meio do deck */}
      <group position={[0, deck.altura, -7.2]}>
        <mesh position-y={0.6} material={fab.cor("#f4f4f1", 0.7)} castShadow>
          <boxGeometry args={[2.2, 1.2, 3.6]} />
        </mesh>
        <mesh position-y={1.5} rotation-y={Math.PI / 4} scale={[1.75, 1, 2.8]} material={fab.cor("#f4f4f1", 0.6)} castShadow>
          <coneGeometry args={[1, 0.7, 4]} />
        </mesh>
      </group>
      {/* torre de observação na ponta do deck */}
      <group position={[0, deck.altura, -16.5]}>
        <mesh position-y={1.7} material={fab.cor("#f4f4f1", 0.6)} castShadow>
          <boxGeometry args={[1.1, 3.4, 1.1]} />
        </mesh>
        <mesh position-y={3.55} material={fab.cor("#f4f4f1", 0.6)} castShadow>
          <boxGeometry args={[1.6, 0.25, 1.6]} />
        </mesh>
        <mesh position-y={2.6} material={fab.cor("#46525d", 0.4)}>
          <boxGeometry args={[1.14, 0.5, 0.6]} />
        </mesh>
      </group>
    </group>
  );
}

/** Iracema Guardiã, de Zenon Barreto: figura cor de cobre segurando um grande arco */
function IracemaGuardia({ fab }: { fab: Fabrica }) {
  const cobre = fab.cor("#b8703e", 0.45);
  return (
    <group position={[14, 0, 3.5]} rotation-y={-0.4}>
      <mesh position-y={0.25} material={fab.cor("#cfc8b8", 0.9)} receiveShadow>
        <cylinderGeometry args={[1.2, 1.3, 0.5, 16]} />
      </mesh>
      <mesh position-y={2.1} material={cobre} castShadow>
        <capsuleGeometry args={[0.35, 2.6, 4, 10]} />
      </mesh>
      <mesh position-y={3.9} material={cobre} castShadow>
        <sphereGeometry args={[0.35, 12, 10]} />
      </mesh>
      <mesh position={[0, 3.2, 0]} rotation={[0, 0, 0.35]} material={cobre} castShadow>
        <torusGeometry args={[1.9, 0.11, 6, 24, Math.PI * 1.15]} />
      </mesh>
    </group>
  );
}

export function PraiaDeIracema({ fab }: { fab: Fabrica }) {
  // a costa corre a ~107°: o mar fica a ~17° (NNE)
  const f: Faixas = { agua: -1, areia: 6, calcadao: 8, avenida: 11, espuma: [-2.2, -5] };
  return (
    <BasePraia rumoMar={17} f={f} cidadeAltos={0.4} corMar="#2d8a84" fab={fab}>
      <PonteDosIngleses fab={fab} />
      <IracemaGuardia fab={fab} />
      <Coqueiros pontos={[[-14, 7], [-9, 7], [6, 7], [10, 7], [19, 7], [-20, 6.5]]} fab={fab} />
    </BasePraia>
  );
}

// ——— Praia do Futuro ———

/** Mega-barraca: deck de madeira, telhado de palha sobre pilares, piscina e coqueiral em volta */
function Barraca({ x, fab }: { x: number; fab: Fabrica }) {
  return (
    <group position={[x, 0, 6]}>
      <mesh position-y={0.2} material={fab.cor("#b88a62", 0.8)} receiveShadow>
        <boxGeometry args={[9, 0.3, 6.5]} />
      </mesh>
      {[-3.6, 3.6].flatMap((px) =>
        [-2.2, 2.2].map((pz) => (
          <mesh key={`${px}${pz}`} position={[px, 1.4, pz + 0.6]} material={fab.cor("#7a5a3e", 0.8)}>
            <boxGeometry args={[0.22, 2.4, 0.22]} />
          </mesh>
        )),
      )}
      <mesh position={[0, 3, 0.6]} rotation-y={Math.PI / 4} scale={[5.4, 1, 3.6]} material={fab.cor("#8b7c68", 0.95)} castShadow receiveShadow>
        <coneGeometry args={[1, 1.4, 4]} />
      </mesh>
      {/* piscina azul na frente da barraca, do lado do mar */}
      <mesh position={[-1.5, 0.37, -2.4]} rotation-x={-Math.PI / 2} material={fab.agua()}>
        <planeGeometry args={[3.6, 1.6]} />
      </mesh>
    </group>
  );
}

function GuardaSois({ fab }: { fab: Fabrica }) {
  const pontos = useMemo(() => {
    const rnd = aleatorio(5);
    const p: [number, number, number][] = [];
    for (let x = -24; x <= 24; x += 2.2) for (let z = -3; z <= 1.6; z += 2.1) if (Math.hypot(x, z) < R - 3 && rnd() < 0.7) p.push([x + (rnd() - 0.5) * 0.6, z, Math.floor(rnd() * 4)]);
    return p;
  }, []);
  const hastes = useRef<THREE.InstancedMesh>(null);
  const lonas = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const tons = ["#ffffff", "#ff8b22", "#ffb719", "#e94b3c"];
    pontos.forEach(([x, z, c], i) => {
      o.position.set(x, 0.6, z);
      o.updateMatrix();
      hastes.current!.setMatrixAt(i, o.matrix);
      o.position.set(x, 1.25, z);
      o.updateMatrix();
      lonas.current!.setMatrixAt(i, o.matrix);
      lonas.current!.setColorAt(i, cor.set(tons[c]));
    });
    hastes.current!.instanceMatrix.needsUpdate = true;
    lonas.current!.instanceMatrix.needsUpdate = true;
    if (lonas.current!.instanceColor) lonas.current!.instanceColor.needsUpdate = true;
  }, [pontos]);
  return (
    <>
      <instancedMesh ref={hastes} args={[undefined, undefined, pontos.length]} material={fab.cor("#8a8a8a")}>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 4]} />
      </instancedMesh>
      <instancedMesh ref={lonas} args={[undefined, undefined, pontos.length]} castShadow>
        <coneGeometry args={[0.75, 0.32, 8, 1, true]} />
        <meshStandardMaterial roughness={0.7} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}

export function PraiaDoFuturo({ fab }: { fab: Fabrica }) {
  // a costa corre a ~155°: o mar fica a ~65° (ENE); areia larga e várias linhas de arrebentação
  const f: Faixas = { agua: -5, areia: 12, calcadao: 13.5, avenida: 16.5, espuma: [-6.2, -9, -12.5] };
  const coqueiros = useMemo(() => {
    const p: [number, number][] = [];
    for (const bx of [-17, 0, 17]) for (const [dx, dz] of [[-4.8, 9.6], [-2, 10], [1.4, 9.8], [4.6, 9.4], [-5.2, 4], [5.2, 4.6], [-5, 7], [5.4, 7.4]]) p.push([bx + dx, dz]);
    return p;
  }, []);
  return (
    <BasePraia rumoMar={65} f={f} cidadeAltos={0.15} corMar="#2fa9a0" fab={fab}>
      {[-17, 0, 17].map((x) => (
        <Barraca key={x} x={x} fab={fab} />
      ))}
      <Coqueiros pontos={coqueiros} fab={fab} />
      <GuardaSois fab={fab} />
    </BasePraia>
  );
}
