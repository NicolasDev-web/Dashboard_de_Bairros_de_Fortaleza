import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Fabrica } from "../Cena";
import { caixaChanfrada, texturaManchada } from "../util/geometria";

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

/** Tira os triângulos de área zero (os polos das cápsulas) de uma geometria sem índice */
function semDegenerados(g: THREE.BufferGeometry) {
  const pos = g.attributes.position;
  const manter: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1).sub(a);
    c.fromBufferAttribute(pos, i + 2).sub(a);
    if (b.cross(c).length() > 1e-8) manter.push(i, i + 1, i + 2);
  }
  const out = new THREE.BufferGeometry();
  for (const n of Object.keys(g.attributes)) {
    const at = g.attributes[n] as THREE.BufferAttribute;
    const arr = new Float32Array(manter.length * at.itemSize);
    manter.forEach((k, j) => {
      for (let e = 0; e < at.itemSize; e++) arr[j * at.itemSize + e] = at.array[k * at.itemSize + e];
    });
    out.setAttribute(n, new THREE.BufferAttribute(arr, at.itemSize));
  }
  g.dispose();
  return out;
}

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
  const grama = useMemo(() => {
    const t = texturaManchada("#86a95e", 0.05, 4, 64);
    t.repeat.set(6, 6);
    return Object.assign(new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }), { name: "Mat_Grama_Margem" });
  }, []);
  useEffect(
    () => () => {
      grama.map?.dispose();
      grama.dispose();
    },
    [grama],
  );
  return (
    <group name="Lagoa_de_Messejana">
      <mesh name="Terreno_Gramado" rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow material={grama}>
        <circleGeometry args={[31.5, 64]} />
      </mesh>
      <Lagoa fab={fab} />
      <Gradil fab={fab} />
      <Pier fab={fab} />
      <Iracema fab={fab} />
      <Praca fab={fab} />
      <group name="Igreja_Matriz" position={[IGREJA[0], 0, IGREJA[1]]}>
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
    // faixa rasa mais clara junto à margem (0,9 m para dentro), por baixo do espelho principal
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
      <mesh name="Calcadao_Lagoa" geometry={geo.calcadao} rotation-x={-Math.PI / 2} position-y={0.02} castShadow receiveShadow material={fab.cor("#c9bca6")} />
      <mesh name="Lagoa_Espelho_Agua" geometry={geo.agua} rotation-x={-Math.PI / 2} position-y={NIVEL_AGUA} receiveShadow material={fab.agua()} />
    </>
  );
}

/** Guarda-corpo do calçadão: corrimão laranja contínuo sobre pilares de tijolo, e postes de luz a cada ~10 m */
function Gradil({ fab }: { fab: Fabrica }) {
  const { tubo, pilares, postes, geoPoste, geoLuminaria } = useMemo(() => {
    const borda = deslocar(LAGOA, 0.3).slice(GRADIL[0] * 2, GRADIL[1] * 2 + 1);
    const curva = new THREE.CatmullRomCurve3(borda.map(([x, z]) => new THREE.Vector3(x, ALTURA_CALCADAO + 0.95, z)));
    const n = Math.round(curva.getLength() / 2.4);
    const fora = deslocar(LAGOA, 1.2).slice(GRADIL[0] * 2, GRADIL[1] * 2 + 1);
    const curvaPostes = new THREE.CatmullRomCurve3(fora.map(([x, z]) => new THREE.Vector3(x, ALTURA_CALCADAO, z)));
    return {
      tubo: new THREE.TubeGeometry(curva, n * 4, 0.08, 5, false),
      pilares: curva.getSpacedPoints(n),
      postes: curvaPostes.getSpacedPoints(Math.round(curvaPostes.getLength() / 10)),
      geoPoste: new THREE.CylinderGeometry(0.05, 0.07, 2.8, 6).translate(0, 1.4, 0),
      geoLuminaria: new THREE.SphereGeometry(0.2, 8, 6).translate(0, 2.9, 0),
    };
  }, []);
  useEffect(
    () => () => {
      tubo.dispose();
      geoPoste.dispose();
      geoLuminaria.dispose();
    },
    [tubo, geoPoste, geoLuminaria],
  );
  const ref = useRef<THREE.InstancedMesh>(null);
  const refPostes = useRef<THREE.InstancedMesh>(null);
  const refLuz = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    for (let i = 0; i < pilares.length; i++) {
      o.position.set(pilares[i].x, ALTURA_CALCADAO, pilares[i].z);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
    for (let i = 0; i < postes.length; i++) {
      o.position.copy(postes[i]);
      o.updateMatrix();
      refPostes.current!.setMatrixAt(i, o.matrix);
      refLuz.current!.setMatrixAt(i, o.matrix);
    }
    refPostes.current!.instanceMatrix.needsUpdate = true;
    refLuz.current!.instanceMatrix.needsUpdate = true;
    refPostes.current!.computeBoundingSphere();
    refLuz.current!.computeBoundingSphere();
  }, [pilares, postes]);
  return (
    <>
      <mesh name="Gradil_Corrimao" geometry={tubo} castShadow material={fab.cor("#d9a13b", 0.6)} />
      <instancedMesh name="Gradil_Pilares_Tijolo" ref={ref} args={[undefined, undefined, pilares.length]} castShadow receiveShadow material={fab.cor("#9a4b32")}>
        <primitive object={useMemo(() => caixaChanfrada(0.32, 1, 0.32, 0.04), [])} attach="geometry" />
      </instancedMesh>
      <instancedMesh name="Calcadao_Postes" ref={refPostes} args={[geoPoste, fab.cor("#2f3337", 0.5), postes.length]} castShadow />
      <instancedMesh name="Calcadao_Luminarias" ref={refLuz} args={[geoLuminaria, fab.cor("#f6f1e2", 0.4), postes.length]} />
    </>
  );
}

/** Píer de madeira que sai da margem sul, com um quiosque de telhado de quatro águas na ponta */
function Pier({ fab }: { fab: Fabrica }) {
  const madeira = fab.cor("#8a6a4f", 0.8);
  const geo = useMemo(
    () => ({
      passarela: caixaChanfrada(1.3, 0.16, 5, 0.04),
      deck: caixaChanfrada(3.2, 0.16, 3.2, 0.04),
      telhado: new THREE.ConeGeometry(2.2, 1.1, 4).toNonIndexed(),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  geo.telhado.computeVertexNormals();
  return (
    <group name="Pier_Madeira" position-x={PIER_X}>
      <mesh name="Pier_Passarela" geometry={geo.passarela} position={[0, 0.42, 17.4]} castShadow receiveShadow material={madeira} />
      <mesh name="Pier_Deck" geometry={geo.deck} position={[0, 0.42, 13.6]} castShadow receiveShadow material={madeira} />
      {[-1, 1].flatMap((a) =>
        [-1, 1].map((b) => (
          <mesh key={`${a}${b}`} name={`Pier_Esteio_${a < 0 ? "O" : "L"}${b < 0 ? "N" : "S"}`} position={[a * 1.3, 1.55, 13.6 + b * 1.3]} castShadow material={fab.cor("#6f5644")}>
            <cylinderGeometry args={[0.08, 0.08, 2.1, 6]} />
          </mesh>
        )),
      )}
      <mesh name="Pier_Quiosque_Telhado" geometry={geo.telhado} position={[0, 3.05, 13.6]} rotation-y={Math.PI / 4} castShadow material={fab.cor("#9a4b32", 0.8)} />
    </group>
  );
}

// ——— Estátua "Banho de Iracema" ———

const CIMA = new THREE.Vector3(0, 1, 0);

type V3 = [number, number, number];

/** Cápsula de um ponto a outro, como um osso de boneco, já posicionada (sem os triângulos degenerados dos polos) */
function osso(de: V3, ate: V3, r: number) {
  const a = new THREE.Vector3(...de);
  const b = new THREE.Vector3(...ate);
  const dir = b.clone().sub(a);
  const g = semDegenerados(new THREE.CapsuleGeometry(r, dir.length(), 4, 10).toNonIndexed());
  const q = new THREE.Quaternion().setFromUnitVectors(CIMA, dir.normalize());
  return g.applyMatrix4(new THREE.Matrix4().compose(a.add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
}

/** Esfera achatada já posicionada, sem índice (para juntar com as cápsulas) */
function bola(r: number, centro: V3, escala: V3 = [1, 1, 1]) {
  return new THREE.SphereGeometry(r, 12, 10).toNonIndexed().scale(...escala).translate(...centro);
}

/**
 * Iracema sentada de lado sobre a rocha, de frente para o calçadão (leste, +x): pernas dobradas para o
 * sul e o braço erguido do lado norte com a cuia no alto, como se vê das fotos tiradas da margem.
 * O conjunto cresce 15 % para a figura ler de longe; a rocha ganha uma base de pedras na água.
 * As peças de bronze são uma malha só (corpo) e o cabelo outra.
 */
function Iracema({ fab }: { fab: Fabrica }) {
  const bronze = fab.cor("#5a8a63", 0.5);
  const cabelo = fab.cor("#35593f", 0.6);
  const geo = useMemo(() => {
    const rocha = new THREE.DodecahedronGeometry(1.8, 0).toNonIndexed();
    rocha.computeVertexNormals();
    const corpo = mergeGeometries([
      // quadril e pernas dobradas para o lado
      bola(0.62, [0, 2.55, 0.1], [1, 0.7, 1.1]),
      osso([0.05, 2.5, 0.2], [1.0, 2.35, 0.9], 0.36),
      osso([1.0, 2.3, 0.95], [-0.1, 2.2, 1.45], 0.28),
      // tronco, ombros, pescoço e cabeça
      osso([-0.05, 2.75, 0], [0.05, 4.3, 0], 0.48),
      osso([0, 4.35, -0.62], [0, 4.35, 0.62], 0.26),
      osso([0.05, 4.45, 0], [0.08, 4.8, 0], 0.17),
      bola(0.42, [0.1, 5.05, 0]),
      // braço erguido com a cuia
      osso([0, 4.4, -0.66], [0.1, 5.5, -0.82], 0.17),
      osso([0.1, 5.5, -0.82], [0.16, 6.6, -0.76], 0.15),
      bola(0.4, [0.16, 6.95, -0.76], [1, 0.75, 1]),
      // braço apoiado na perna
      osso([0, 4.35, 0.66], [0.3, 3.4, 0.9], 0.16),
      osso([0.3, 3.4, 0.9], [0.65, 2.75, 0.85], 0.14),
    ]);
    return { rocha, corpo, cabelo: osso([-0.2, 5.15, 0], [-0.45, 3.5, 0.05], 0.33) };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <group name="Estatua_Iracema" position={[IRACEMA[0], 0, IRACEMA[1]]} scale={1.15}>
      <mesh name="Iracema_Pedras_Base" geometry={geo.rocha} position-y={0.45} scale={[1.7, 0.25, 1.4]} castShadow receiveShadow material={fab.cor("#8f8c85", 0.9)} />
      <mesh name="Iracema_Rocha" geometry={geo.rocha} position-y={1.3} scale={[1.25, 0.75, 1.05]} castShadow receiveShadow material={fab.cor("#b9b7b0")} />
      <mesh name="Iracema_Rocha_Encosto" geometry={geo.rocha} position={[-0.8, 1.9, -0.7]} scale={[0.55, 0.5, 0.5]} castShadow material={fab.cor("#a8a69f")} />
      <mesh name="Iracema_Figura_Bronze" geometry={geo.corpo} castShadow material={bronze} />
      <mesh name="Iracema_Cabelo" geometry={geo.cabelo} castShadow material={cabelo} />
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
    <group name="Praca_da_Matriz">
      <mesh name="Praca_Piso" geometry={geo} rotation-x={-Math.PI / 2} position-y={0.05} receiveShadow material={fab.cor("#cfc6b8")} />
      {/* losango de pedra portuguesa em volta do cruzeiro */}
      <mesh name="Praca_Losango_Escuro" position={[CRUZEIRO[0], 0.07, CRUZEIRO[1]]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} receiveShadow material={fab.cor("#7a6a5c")}>
        <planeGeometry args={[5.2, 5.2]} />
      </mesh>
      <mesh name="Praca_Losango_Claro" position={[CRUZEIRO[0], 0.09, CRUZEIRO[1]]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} receiveShadow material={fab.cor("#cfc6b8")}>
        <planeGeometry args={[3.8, 3.8]} />
      </mesh>
      <group name="Cruzeiro" position={[CRUZEIRO[0], 0, CRUZEIRO[1]]}>
        <mesh name="Cruzeiro_Base" position-y={0.05} castShadow receiveShadow material={branco}>
          <primitive object={useMemo(() => caixaChanfrada(1.6, 0.6, 1.6, 0.06), [])} attach="geometry" />
        </mesh>
        <mesh name="Cruzeiro_Pedestal" position-y={0.6} castShadow material={branco}>
          <primitive object={useMemo(() => caixaChanfrada(0.9, 0.8, 0.9, 0.05), [])} attach="geometry" />
        </mesh>
        <mesh name="Cruzeiro_Haste" position-y={2.8} castShadow material={ferro}>
          <boxGeometry args={[0.16, 3, 0.16]} />
        </mesh>
        <mesh name="Cruzeiro_Braco" position-y={3.6} castShadow material={ferro}>
          <boxGeometry args={[0.16, 0.16, 1.5]} />
        </mesh>
      </group>
    </group>
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
  const naveC = (NAVE.de + NAVE.ate) / 2;
  const naveL = NAVE.ate - NAVE.de;
  const tAlt = TORRE.ate - TORRE.de;
  const geo = useMemo(
    () => ({
      prisma: criarPrisma(),
      adro: caixaChanfrada(13.8, ADRO, 9.2, 0.08),
      degrau: caixaChanfrada(0.8, 0.3, 3, 0.05),
      nave: caixaChanfrada(naveL, NAVE.alto, NAVE.meia * 2, 0.08),
      fachada: caixaChanfrada(1, FACHADA.alto, FACHADA.meia * 2, 0.06),
      fachadaCentro: caixaChanfrada(1.2, FACHADA.altoCentro, FACHADA.meiaCentro * 2, 0.06),
      torre: caixaChanfrada(TORRE.lado, tAlt, TORRE.lado, 0.08),
      flecha: (() => {
        const g = new THREE.ConeGeometry(1.1, 1.45, 4).toNonIndexed();
        g.computeVertexNormals();
        return g;
      })(),
    }),
    [],
  );
  const relogio = useMemo(() => {
    const t = new THREE.CanvasTexture(desenharRelogio());
    t.colorSpace = THREE.SRGBColorSpace;
    return Object.assign(new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), { name: "Mat_Relogio_Torre" });
  }, []);
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      relogio.map?.dispose();
      relogio.dispose();
    },
    [geo, relogio],
  );
  const azul = fab.cor("#6d93c2");
  const azulCentro = fab.cor("#5c83b5");
  const barrado = fab.cor("#3e5f8c");
  const branco = fab.cor("#f3f4f2");
  const telhado = fab.cor("#5a5c5e", 0.85);
  const escuro = fab.cor("#26303a", 0.6);
  const y0 = ADRO;
  const frente = -0.5;
  const frenteCentro = -0.65;
  const tFace = TORRE.x - TORRE.lado / 2 - 0.06;
  return (
    <>
      {/* adro elevado com escada para a praça */}
      <mesh name="Igreja_Adro" geometry={geo.adro} position={[4.7, 0, 0]} castShadow receiveShadow material={fab.cor("#ecebe6")} />
      <mesh name="Igreja_Degrau" geometry={geo.degrau} position={[-2.6, 0, 0]} castShadow receiveShadow material={fab.cor("#ecebe6")} />

      {/* nave com barrado escuro, cornija branca e telhado de duas águas */}
      <mesh name="Nave_Paredes" geometry={geo.nave} position={[naveC, y0, 0]} castShadow receiveShadow material={azul} />
      <mesh name="Nave_Barrado" position={[naveC, y0 + 0.5, 0]} receiveShadow material={barrado}>
        <boxGeometry args={[naveL + 0.1, 1, NAVE.meia * 2 + 0.1]} />
      </mesh>
      <mesh name="Nave_Cornija" position={[naveC, y0 + NAVE.alto - 0.1, 0]} castShadow material={branco}>
        <boxGeometry args={[naveL + 0.2, 0.3, NAVE.meia * 2 + 0.3]} />
      </mesh>
      <mesh name="Nave_Telhado" geometry={geo.prisma} position={[naveC + 0.1, y0 + NAVE.alto + 0.05, 0]} rotation-y={Math.PI / 2} scale={[NAVE.meia * 2 + 0.6, 2.1, naveL + 0.4]} castShadow receiveShadow material={telhado} />
      {[-1, 1].map((s) => (
        <mesh key={s} name={`Nave_Cunhal_${s < 0 ? "Norte" : "Sul"}`} position={[NAVE.ate - 0.15, y0 + NAVE.alto / 2, s * (NAVE.meia - 0.05)]} castShadow material={branco}>
          <boxGeometry args={[0.45, NAVE.alto, 0.45]} />
        </mesh>
      ))}
      <JanelasNave fab={fab} />

      {/* fachada: corpo largo, parte central mais alta e saliente */}
      <mesh name="Fachada_Corpo" geometry={geo.fachada} position={[0, y0, 0]} castShadow receiveShadow material={azul} />
      <mesh name="Fachada_Centro" geometry={geo.fachadaCentro} position={[-0.05, y0, 0]} castShadow receiveShadow material={azulCentro} />
      <mesh name="Fachada_Barrado" position={[0, y0 + 0.55, 0]} receiveShadow material={barrado}>
        <boxGeometry args={[1.08, 1.1, FACHADA.meia * 2 + 0.08]} />
      </mesh>
      {/* pilastras e cornijas brancas */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh name={`Fachada_Pilastra_${s < 0 ? "Norte" : "Sul"}`} position={[frente - 0.05, y0 + FACHADA.alto / 2, s * (FACHADA.meia - 0.22)]} castShadow material={branco}>
            <boxGeometry args={[0.2, FACHADA.alto, 0.5]} />
          </mesh>
          <mesh name={`Fachada_Pilastra_Centro_${s < 0 ? "Norte" : "Sul"}`} position={[frenteCentro - 0.08, y0 + FACHADA.altoCentro / 2, s * (FACHADA.meiaCentro - 0.2)]} castShadow material={branco}>
            <boxGeometry args={[0.2, FACHADA.altoCentro, 0.45]} />
          </mesh>
        </group>
      ))}
      <mesh name="Fachada_Cornija" position={[-0.1, y0 + FACHADA.alto, 0]} castShadow material={branco}>
        <boxGeometry args={[1.3, 0.3, FACHADA.meia * 2 + 0.3]} />
      </mesh>
      <mesh name="Fachada_Cornija_Centro" position={[-0.15, y0 + FACHADA.altoCentro, 0]} castShadow material={branco}>
        <boxGeometry args={[1.5, 0.3, FACHADA.meiaCentro * 2 + 0.4]} />
      </mesh>
      <mesh name="Fachada_Friso" position={[frenteCentro - 0.06, y0 + 4.6, 0]} material={branco}>
        <boxGeometry args={[0.14, 0.2, FACHADA.meiaCentro * 2]} />
      </mesh>
      {/* frontão triangular sobre a parte central */}
      <mesh name="Fachada_Frontao" geometry={geo.prisma} position={[frenteCentro + 0.05, y0 + FACHADA.altoCentro + 0.15, 0]} rotation-y={Math.PI / 2} scale={[FACHADA.meiaCentro * 2 + 0.4, 0.95, 0.4]} castShadow material={branco} />
      <mesh name="Fachada_Frontao_Timpano" geometry={geo.prisma} position={[frenteCentro + 0.02, y0 + FACHADA.altoCentro + 0.3, 0]} rotation-y={Math.PI / 2} scale={[FACHADA.meiaCentro * 2 - 0.4, 0.6, 0.4]} material={azulCentro} />

      {/* portas em arco e óculos */}
      <Porta fab={fab} nome="Porta_Central" x={frenteCentro} z={0} largura={1.1} altura={2.4} cor="#2a2f36" />
      <Porta fab={fab} nome="Porta_Norte" x={frente} z={-2.7} largura={0.85} altura={2} cor="#c9cfc8" />
      <Porta fab={fab} nome="Porta_Sul" x={frente} z={2.7} largura={0.85} altura={2} cor="#c9cfc8" />
      <Oculo fab={fab} nome="Oculo_Central" x={frenteCentro} y={y0 + 3.9} z={0} r={0.5} />
      <Oculo fab={fab} nome="Oculo_Norte" x={frente} y={y0 + 3.6} z={-2.7} r={0.38} />
      <Oculo fab={fab} nome="Oculo_Sul" x={frente} y={y0 + 3.6} z={2.7} r={0.38} />

      {/* torre: núcleo branco (cunhais) com painéis azuis em cada face */}
      <group name="Torre" position={[TORRE.x, TORRE.de + tAlt / 2, 0]}>
        <mesh name="Torre_Nucleo" geometry={geo.torre} position-y={-tAlt / 2} castShadow receiveShadow material={branco} />
        <mesh name="Torre_Painel_Leste_Oeste" castShadow material={azul}>
          <boxGeometry args={[TORRE.lado + 0.08, tAlt - 0.3, TORRE.lado - 0.6]} />
        </mesh>
        <mesh name="Torre_Painel_Norte_Sul" castShadow material={azul}>
          <boxGeometry args={[TORRE.lado - 0.6, tAlt - 0.3, TORRE.lado + 0.08]} />
        </mesh>
      </group>
      {/* nicho da santa, relógio e janela do sino na face oeste */}
      <Arco fab={fab} nome="Torre_Nicho" x={tFace} y={TORRE.de + 2.6} largura={0.7} altura={1.1} cor="#26303a" />
      <Arco fab={fab} nome="Torre_Sineira" x={tFace} y={TORRE.ate - 0.95} largura={0.6} altura={0.6} cor="#26303a" />
      {(
        [
          [tFace - 0.02, 0, -Math.PI / 2, "Oeste"],
          [TORRE.x, -TORRE.lado / 2 - 0.08, Math.PI, "Norte"],
          [TORRE.x, TORRE.lado / 2 + 0.08, 0, "Sul"],
        ] as const
      ).map(([x, z, ry, lado]) => (
        <group key={lado} position={[x, TORRE.ate - 2, z]} rotation-y={ry}>
          <mesh name={`Relogio_${lado}_Aro`} material={branco}>
            <circleGeometry args={[0.68, 24]} />
          </mesh>
          <mesh name={`Relogio_${lado}_Mostrador`} position-z={0.01} material={relogio}>
            <circleGeometry args={[0.58, 24]} />
          </mesh>
        </group>
      ))}
      {/* cornija do topo, tambor octogonal, flecha piramidal e cruz */}
      <mesh name="Torre_Cornija" position={[TORRE.x, TORRE.ate + 0.12, 0]} castShadow material={branco}>
        <boxGeometry args={[TORRE.lado + 0.4, 0.25, TORRE.lado + 0.4]} />
      </mesh>
      <mesh name="Torre_Tambor" position={[TORRE.x, TORRE.ate + 0.55, 0]} rotation-y={Math.PI / 8} castShadow material={azul}>
        <cylinderGeometry args={[1, 1.05, 0.65, 8]} />
      </mesh>
      <mesh name="Torre_Tambor_Friso" position={[TORRE.x, TORRE.ate + 0.92, 0]} rotation-y={Math.PI / 8} castShadow material={branco}>
        <cylinderGeometry args={[1.12, 1.12, 0.12, 8]} />
      </mesh>
      <mesh name="Torre_Flecha" geometry={geo.flecha} position={[TORRE.x, TORRE.ate + 1.68, 0]} rotation-y={Math.PI / 4} castShadow material={branco} />
      <mesh name="Torre_Cruz_Haste" position={[TORRE.x, TORRE.ate + 2.75, 0]} castShadow material={escuro}>
        <boxGeometry args={[0.08, 0.75, 0.08]} />
      </mesh>
      <mesh name="Torre_Cruz_Braco" position={[TORRE.x, TORRE.ate + 2.85, 0]} material={escuro}>
        <boxGeometry args={[0.08, 0.08, 0.5]} />
      </mesh>
    </>
  );
}

/** Arco pleno (retângulo + meio círculo) de raio r, da base yb até o centro do arco yc, no plano xy */
function formaArco(r: number, yb: number, yc: number) {
  const s = new THREE.Shape();
  s.moveTo(-r, yb);
  s.lineTo(r, yb);
  s.lineTo(r, yc);
  s.absarc(0, yc, r, 0, Math.PI, false);
  s.lineTo(-r, yb);
  return s;
}

/** Abertura em arco pleno pintada na face oeste (−x): moldura branca e vão, uma malha cada */
function Arco({ fab, nome, x, y, largura, altura, cor }: { fab: Fabrica; nome: string; x: number; y: number; largura: number; altura: number; cor: string }) {
  const r = largura / 2;
  const geo = useMemo(
    () => ({
      moldura: new THREE.ShapeGeometry(formaArco(r + 0.12, -altura / 2 - 0.06, altura / 2 - r), 8),
      vao: new THREE.ShapeGeometry(formaArco(r, -altura / 2, altura / 2 - r), 8),
    }),
    [r, altura],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <group name={nome} position={[x, y, 0]} rotation-y={-Math.PI / 2}>
      <mesh name={`${nome}_Moldura`} geometry={geo.moldura} material={fab.cor("#f3f4f2")} />
      <mesh name={`${nome}_Vao`} geometry={geo.vao} position-z={0.01} material={fab.cor(cor, 0.6)} />
    </group>
  );
}

function Porta({ fab, nome, x, z, largura, altura, cor }: { fab: Fabrica; nome: string; x: number; z: number; largura: number; altura: number; cor: string }) {
  return (
    <group position-z={z}>
      <Arco fab={fab} nome={nome} x={x - 0.01} y={ADRO + altura / 2 + 0.02} largura={largura} altura={altura} cor={cor} />
    </group>
  );
}

function Oculo({ fab, nome, x, y, z, r }: { fab: Fabrica; nome: string; x: number; y: number; z: number; r: number }) {
  return (
    <group name={nome} position={[x - 0.01, y, z]} rotation-y={-Math.PI / 2}>
      <mesh name={`${nome}_Moldura`} material={fab.cor("#f3f4f2")}>
        <circleGeometry args={[r + 0.13, 20]} />
      </mesh>
      <mesh name={`${nome}_Vidro`} position-z={0.01} material={fab.cor("#33404d", 0.6)}>
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
    moldura.current!.computeBoundingSphere();
    vao.current!.computeBoundingSphere();
  }, []);
  return (
    <>
      <instancedMesh name="Nave_Janelas_Moldura" ref={moldura} args={[undefined, undefined, n]} material={fab.cor("#f3f4f2")}>
        <boxGeometry args={[1, 2.3, 0.06]} />
      </instancedMesh>
      <instancedMesh name="Nave_Janelas_Vao" ref={vao} args={[undefined, undefined, n]} material={fab.cor("#33404d", 0.6)}>
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
    copa.current!.computeBoundingSphere();
    tronco.current!.computeBoundingSphere();
  }, []);
  return (
    <>
      <instancedMesh name="Mata_Copas" ref={copa} args={[undefined, undefined, MATA.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial name="Mat_Mata_Copas" roughness={0.9} />
      </instancedMesh>
      <instancedMesh name="Mata_Troncos" ref={tronco} args={[undefined, undefined, MATA.length]} castShadow material={fab.cor("#7a6249")}>
        <cylinderGeometry args={[0.18, 0.26, 1.6, 6]} />
      </instancedMesh>
    </>
  );
}

const FOLHAS = 8;

/**
 * Folha de palmeira: tira em "V" raso de 2,8 m que sobe um pouco e cai em arco, afinando na ponta.
 * Base na origem, correndo em +z; as duas faces aparecem (material de dois lados).
 */
function geometriaFolha(comp = 2.8) {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = 0.55 * t - 1.5 * t * t;
    const w = t < 0.15 ? 0.06 + t * 1.6 : 0.3 * (1 - t) + 0.03;
    const z = comp * t;
    pos.push(-w, y - 0.07, z, 0, y, z, w, y - 0.07, z);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 3, b = a + 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function Palmeiras({ fab }: { fab: Fabrica }) {
  const caule = useRef<THREE.InstancedMesh>(null);
  const folha = useRef<THREE.InstancedMesh>(null);
  const cocos = useRef<THREE.InstancedMesh>(null);
  const mats = useMemo(() => {
    const folhas = Object.assign(new THREE.MeshStandardMaterial({ color: "#6b9b3f", roughness: 0.8, side: THREE.DoubleSide }), { name: "Mat_Folha_Palmeira" });
    return { folhas, geo: geometriaFolha() };
  }, []);
  useEffect(
    () => () => {
      mats.folhas.dispose();
      mats.geo.dispose();
    },
    [mats],
  );
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    for (let i = 0; i < PALMEIRAS.length; i++) {
      const p = PALMEIRAS[i];
      o.position.set(p.x, p.h / 2, p.z);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, p.h, 1);
      o.updateMatrix();
      caule.current!.setMatrixAt(i, o.matrix);
      o.position.set(p.x, p.h - 0.25, p.z);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      cocos.current!.setMatrixAt(i, o.matrix);
      for (let f = 0; f < FOLHAS; f++) {
        const ang = p.giro + (f / FOLHAS) * Math.PI * 2;
        // folhas alternadas mais erguidas e mais caídas, como na copa real
        o.rotation.set(f % 2 ? -0.35 : 0.05, ang, 0, "YXZ");
        o.position.set(p.x, p.h - 0.1, p.z);
        o.scale.setScalar(f % 2 ? 0.85 : 1);
        o.updateMatrix();
        folha.current!.setMatrixAt(i * FOLHAS + f, o.matrix);
        folha.current!.setColorAt(i * FOLHAS + f, cor.set(f % 3 ? "#ffffff" : "#d9e6c4"));
      }
    }
    caule.current!.instanceMatrix.needsUpdate = true;
    folha.current!.instanceMatrix.needsUpdate = true;
    cocos.current!.instanceMatrix.needsUpdate = true;
    if (folha.current!.instanceColor) folha.current!.instanceColor.needsUpdate = true;
    caule.current!.computeBoundingSphere();
    folha.current!.computeBoundingSphere();
    cocos.current!.computeBoundingSphere();
  }, []);
  return (
    <>
      <instancedMesh name="Palmeiras_Estipes" ref={caule} args={[undefined, undefined, PALMEIRAS.length]} castShadow material={fab.cor("#8b7355")}>
        <cylinderGeometry args={[0.14, 0.22, 1, 6]} />
      </instancedMesh>
      <instancedMesh name="Palmeiras_Cachos" ref={cocos} args={[undefined, undefined, PALMEIRAS.length]} castShadow material={fab.cor("#5e5a2e", 0.8)}>
        <icosahedronGeometry args={[0.32, 0]} />
      </instancedMesh>
      <instancedMesh name="Palmeiras_Folhas" ref={folha} args={[mats.geo, mats.folhas, PALMEIRAS.length * FOLHAS]} castShadow />
    </>
  );
}
