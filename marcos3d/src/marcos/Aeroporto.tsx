import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Fabrica } from "../Cena";
import { aleatorio, caixaChanfrada, posicionar, texturaManchada } from "../util/geometria";

/*
 * Aeroporto Internacional Pinto Martins em miniatura. Tudo é montado num referencial alinhado à pista
 * (x ao longo dela, +z para o lado do terminal) e o grupo inteiro gira para o rumo verdadeiro de 105°.
 * Medidas exageradas de propósito: a pista real tem 2,7 km, aqui tem 56 m.
 */

// rumo verdadeiro da pista 13/31 é ~105°: 15° abaixo da linha leste–oeste
const GIRO_PISTA = -THREE.MathUtils.degToRad(15);

const COR = {
  grama: "#a3a067",
  asfalto: "#3d3f42",
  taxi: "#56595c",
  concreto: "#bdbab2",
  branco: "#f1f2f0",
  cobertura: "#d9dbda",
  cumeeira: "#c6cacb",
  vidro: "#3c6fa8",
  vidroEscuro: "#2c5480",
  amarelo: "#e8c547",
  ponte: "#c4c7c9",
  cinza: "#8d9194",
  logo: "#24409a",
  toldo: "#2b5fb8",
  estacionamento: "#9c9b96",
  hangar: "#d3d6d4",
};

// ——— Pista e pistas de táxi ———

const PISTA = { z: -8, comprimento: 56, largura: 4 };
const TAXI_SUL = { z: -3.4, de: -26, ate: 24, largura: 1.6 };
const TAXI_NORTE = { z: -13.4, de: -22, ate: 20, largura: 1.3 };

/** Caixa instanciada: centro (x, y, z), medidas (l × a × p) e giro em torno de y */
interface Peca {
  x: number;
  y: number;
  z: number;
  l: number;
  a: number;
  p: number;
  giro?: number;
}

/** Sinalização branca da pista: eixo tracejado, bordas, cabeceiras e zona de toque */
function marcasDaPista(): Peca[] {
  const out: Peca[] = [];
  const y = 0.105;
  const meio = PISTA.comprimento / 2;
  for (let x = -21; x <= 21; x += 3) out.push({ x, y, z: PISTA.z, l: 1.6, a: 0.01, p: 0.18 });
  for (const lado of [-1, 1]) {
    out.push({ x: 0, y, z: PISTA.z + lado * 1.82, l: PISTA.comprimento - 0.6, a: 0.01, p: 0.08 });
    // faixas de cabeceira ("teclas de piano")
    for (let k = 0; k < 4; k++) {
      for (const s of [-1, 1]) out.push({ x: lado * (meio - 1.1), y, z: PISTA.z + s * (0.3 + k * 0.42), l: 1.5, a: 0.01, p: 0.24 });
    }
    // zona de toque
    for (const s of [-1, 1]) out.push({ x: lado * (meio - 6.4), y, z: PISTA.z + s * 0.9, l: 1.8, a: 0.01, p: 0.45 });
  }
  return out;
}

/** Ligações entre a pista e as pistas de táxi; as do meio são saídas rápidas, inclinadas */
function ligacoes(): Peca[] {
  const out: Peca[] = [];
  const y = 0.04;
  const vaoSul = TAXI_SUL.z - PISTA.z;
  for (const x of [-25.2, 22.6]) out.push({ x, y, z: PISTA.z + vaoSul / 2, l: 1.4, a: 0.08, p: vaoSul });
  for (const [x, ang] of [
    [-9, 0.6],
    [7, 0.6],
  ]) {
    out.push({ x, y, z: PISTA.z + vaoSul / 2, l: 1.3, a: 0.08, p: vaoSul / Math.cos(ang), giro: ang });
  }
  const vaoNorte = PISTA.z - TAXI_NORTE.z;
  for (const x of [-19.5, 0, 17.5]) out.push({ x, y, z: TAXI_NORTE.z + vaoNorte / 2, l: 1.2, a: 0.08, p: vaoNorte });
  return out;
}

/** Linha amarela no eixo das pistas de táxi */
function linhasAmarelas(): Peca[] {
  const y = 0.085;
  return [TAXI_SUL, TAXI_NORTE].map((t) => ({ x: (t.de + t.ate) / 2, y, z: t.z, l: t.ate - t.de - 0.4, a: 0.01, p: 0.08 }));
}

// ——— Terminal em "banana": um arco com o centro ao sul, face convexa (lado ar) voltada para o pátio ———

const CX = -10;
const CZ = 51;
const R_AR = 42; // fachada do lado ar
const R_TERRA = 36; // fachada do lado terra no corpo principal
const R_PIER = 38.5; // o píer a leste é mais estreito
const FI_OESTE = -0.3;
const FI_PIER = 0.35;
const FI_LESTE = 0.62;
const FI_ABOBADA = -0.05;
// pontes de embarque ao longo da fachada; o vão da abóbada fica livre
const FI_PONTES = [-0.25, -0.17, 0.06, 0.15, 0.24, 0.33, 0.42, 0.51, 0.59];

/** Ponto (x, z) no raio r e ângulo fi do arco do terminal */
function noArco(r: number, fi: number): [number, number] {
  return [CX + r * Math.sin(fi), CZ - r * Math.cos(fi)];
}

/** Coroa circular entre os raios r0 e r1, na planta (x, −z), para extrudar para cima */
function setor(r0: number, r1: number, f0: number, f1: number, n = 36) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const [x, z] = noArco(r1, f0 + ((f1 - f0) * i) / n);
    if (i === 0) s.moveTo(x, -z);
    else s.lineTo(x, -z);
  }
  for (let i = n; i >= 0; i--) {
    const [x, z] = noArco(r0, f0 + ((f1 - f0) * i) / n);
    s.lineTo(x, -z);
  }
  return s;
}

/** Pátio de concreto: do arco do terminal até a pista de táxi, com o canto do terminal de cargas */
function formaDoPatio() {
  const s = new THREE.Shape();
  const borda = TAXI_SUL.z + TAXI_SUL.largura / 2;
  s.moveTo(-25.5, -borda);
  s.lineTo(22, -borda);
  s.lineTo(22, -6);
  s.lineTo(17, -6);
  for (let i = 0; i <= 30; i++) {
    const [x, z] = noArco(R_AR + 0.2, 0.66 - (1.02 * i) / 30);
    s.lineTo(x, -z);
  }
  return s;
}

const FORMAS = {
  patio: formaDoPatio(),
  corpo: setor(R_TERRA, R_AR, FI_OESTE, FI_PIER),
  pier: setor(R_PIER, R_AR, FI_PIER, FI_LESTE, 20),
  cumeeira: setor(37.3, 40.8, FI_OESTE + 0.03, FI_PIER - 0.02),
  cumeeiraPier: setor(39.3, 41.3, FI_PIER + 0.02, FI_LESTE - 0.02, 20),
  vidroAr: setor(R_AR - 0.05, R_AR + 0.08, FI_OESTE, FI_LESTE, 48),
  vidroTerra: setor(R_TERRA - 0.08, R_TERRA + 0.05, 0.03, FI_PIER, 24),
  vidroTerraPier: setor(R_PIER - 0.08, R_PIER + 0.05, FI_PIER, FI_LESTE, 20),
  via: setor(30, 33.2, FI_OESTE, 0.66, 40),
  viaduto: setor(33.4, 35.6, 0.03, 0.6, 30),
  estacionamento: setor(25.5, 29.6, -0.12, 0.3, 20),
};

/** Dedos, pontes de embarque e os pilares que as seguram */
function pontesDeEmbarque() {
  const dedos: Peca[] = [];
  const pontes: Peca[] = [];
  const pilares: Peca[] = [];
  for (const fi of FI_PONTES) {
    const giro = -fi;
    const [dx, dz] = noArco(R_AR + 0.6, fi);
    dedos.push({ x: dx, y: 1.2, z: dz, l: 1.1, a: 2.4, p: 1.3, giro });
    const [px, pz] = noArco(R_AR + 2.9, fi);
    pontes.push({ x: px, y: 1.75, z: pz, l: 0.55, a: 0.6, p: 3.4, giro });
    const [cx, cz] = noArco(R_AR + 4.5, fi);
    pontes.push({ x: cx, y: 1.75, z: cz, l: 0.9, a: 0.8, p: 0.6, giro });
    pilares.push({ x: cx, y: 0.72, z: cz, l: 0.22, a: 1.44, p: 0.22, giro });
  }
  return { dedos, pontes, pilares };
}

/** Torres de iluminação do pátio, entre os aviões */
function torresDeLuz(): Peca[] {
  const out: Peca[] = [];
  for (const fi of [-0.05, 0.2, 0.47]) {
    const [x, z] = noArco(51.4, fi);
    out.push({ x, y: 3.3, z, l: 0.16, a: 6.6, p: 0.16 });
    out.push({ x, y: 6.65, z, l: 0.8, a: 0.3, p: 0.3, giro: -fi });
  }
  return out;
}

/** Toldos azuis (placas solares) do estacionamento do lado terra */
function toldos(): Peca[] {
  const out: Peca[] = [];
  for (const r of [26.4, 27.6, 28.8]) {
    for (let fi = -0.08; fi <= 0.27; fi += 0.07) {
      const [x, z] = noArco(r, fi);
      out.push({ x, y: 1.1, z, l: 2.3, a: 0.1, p: 0.85, giro: -fi });
    }
  }
  return out;
}

/** Mainéis brancos da fachada de vidro sob a abóbada (no referencial da abóbada) */
function maineis(raio: number): Peca[] {
  const out: Peca[] = [];
  for (const x of [-3.15, -2.1, -1.05, 0, 1.05, 2.1, 3.15]) {
    const h = Math.sqrt(raio * raio - x * x);
    out.push({ x, y: h / 2, z: 0, l: 0.08, a: h, p: 0.08 });
  }
  out.push({ x: 0, y: 1.6, z: 0, l: 2 * Math.sqrt(raio * raio - 1.6 * 1.6), a: 0.08, p: 0.08 });
  return out;
}

const MARCAS = marcasDaPista();
const LIGACOES = ligacoes();
const LINHAS = linhasAmarelas();
const PONTES = pontesDeEmbarque();
const LUZES = torresDeLuz();
const TOLDOS = toldos();
const RAIO_ABOBADA = 4.2;
const MAINEIS = maineis(RAIO_ABOBADA - 0.05);
const PILARES_VIADUTO: Peca[] = Array.from({ length: 7 }, (_, i) => {
  const fi = 0.06 + i * 0.085;
  const [x, z] = noArco(34.5, fi);
  return { x, y: 0.72, z, l: 0.35, a: 1.44, p: 0.9, giro: -fi };
});
const ANTENAS: Peca[] = [
  { x: 0, y: 10.8, z: 0, l: 0.14, a: 2.6, p: 0.14 },
  { x: -0.9, y: 10, z: 0.6, l: 0.1, a: 1.1, p: 0.1 },
  { x: 0.9, y: 10, z: -0.5, l: 0.1, a: 1.1, p: 0.1 },
];

// ——— Aviões ———

interface Aviao {
  x: number;
  z: number;
  giro: number;
  cor: string;
}

/** Três estacionados nas pontes (nariz para o terminal), um decolando e um taxiando */
function avioes(): Aviao[] {
  const out: Aviao[] = [];
  const cores = ["#1d4f9c", "#e8641b", "#d0103a"];
  const estacionados = [-0.17, 0.06, 0.33];
  for (let i = 0; i < estacionados.length; i++) {
    const fi = estacionados[i] + 0.7 / 49.8;
    const [x, z] = noArco(49.8, fi);
    out.push({ x, z, giro: Math.PI - fi, cor: cores[i] });
  }
  out.push({ x: -13, z: PISTA.z, giro: -Math.PI / 2, cor: "#d0103a" });
  out.push({ x: 13, z: TAXI_SUL.z, giro: Math.PI / 2, cor: "#1d4f9c" });
  return out;
}
const AVIOES = avioes();

/** Planta (vista de cima) de um par de asas enflechadas; y é a frente */
function formaAsa(meia: number, raiz: number, flecha: number, ponta: number) {
  const s = new THREE.Shape();
  s.moveTo(-meia, -flecha);
  s.lineTo(-0.4, raiz / 2);
  s.lineTo(0.4, raiz / 2);
  s.lineTo(meia, -flecha);
  s.lineTo(meia, -flecha - ponta);
  s.lineTo(0.4, -raiz / 2);
  s.lineTo(-0.4, -raiz / 2);
  s.lineTo(-meia, -flecha - ponta);
  s.lineTo(-meia, -flecha);
  return s;
}

/** mergeGeometries exige todas iguais: tira o índice só de quem tem (as extrusões já vêm sem) */
const semIndice = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);

/** Tira os triângulos de área zero (os polos da cápsula) de uma geometria sem índice */
function semDegenerados(g: THREE.BufferGeometry) {
  const nomes = Object.keys(g.attributes);
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
  for (const n of nomes) {
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

/** Peças do avião já posicionadas, com o nariz em −z: corpo branco, deriva colorida e motores */
function geometriasDoAviao() {
  const fuselagem = new THREE.CapsuleGeometry(0.42, 5.3, 4, 14).rotateX(Math.PI / 2).translate(0, 0.95, 0);
  const asa = new THREE.ExtrudeGeometry(formaAsa(2.9, 1.3, 1.1, 0.45), { depth: 0.1, bevelEnabled: false })
    .rotateX(-Math.PI / 2)
    .translate(0, 0.72, 0.1);
  const profundor = new THREE.ExtrudeGeometry(formaAsa(1.25, 0.9, 0.55, 0.35), { depth: 0.07, bevelEnabled: false })
    .rotateX(-Math.PI / 2)
    .translate(0, 1.12, 2.75);
  const corpo = semDegenerados(mergeGeometries([semIndice(fuselagem), semIndice(asa), semIndice(profundor)]));
  const perfil = new THREE.Shape();
  perfil.moveTo(0, 0);
  perfil.lineTo(1.2, 0);
  perfil.lineTo(1.65, 1.45);
  perfil.lineTo(1.15, 1.45);
  perfil.lineTo(0, 0);
  const deriva = new THREE.ExtrudeGeometry(perfil, { depth: 0.09, bevelEnabled: false })
    .rotateY(-Math.PI / 2)
    .translate(0.045, 1.2, 1.65);
  const motor1 = new THREE.CylinderGeometry(0.22, 0.2, 0.85, 12).rotateX(Math.PI / 2).translate(-1.25, 0.5, -0.2);
  const motor2 = motor1.clone().translate(2.5, 0, 0);
  const motores = mergeGeometries([motor1, motor2]);
  for (const g of [fuselagem, asa, profundor, motor1, motor2]) g.dispose();
  return { corpo, deriva, motores };
}

function Avioes({ fab }: { fab: Fabrica }) {
  const geo = useMemo(() => geometriasDoAviao(), []);
  useEffect(
    () => () => {
      geo.corpo.dispose();
      geo.deriva.dispose();
      geo.motores.dispose();
    },
    [geo],
  );
  const corpo = useRef<THREE.InstancedMesh>(null);
  const deriva = useRef<THREE.InstancedMesh>(null);
  const motores = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const malhas = [corpo.current, deriva.current, motores.current];
    if (malhas.some((m) => !m)) return;
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    for (let i = 0; i < AVIOES.length; i++) {
      const a = AVIOES[i];
      o.position.set(a.x, 0, a.z);
      o.rotation.set(0, a.giro, 0);
      o.updateMatrix();
      for (const m of malhas) m!.setMatrixAt(i, o.matrix);
      deriva.current!.setColorAt(i, cor.set(a.cor));
    }
    for (const m of malhas) {
      m!.instanceMatrix.needsUpdate = true;
      m!.computeBoundingSphere();
    }
    if (deriva.current!.instanceColor) deriva.current!.instanceColor.needsUpdate = true;
  }, []);
  const n = AVIOES.length;
  return (
    <>
      <instancedMesh name="Avioes_Fuselagem_Asas" ref={corpo} args={[geo.corpo, fab.cor("#f4f5f6", 0.45), n]} castShadow receiveShadow />
      <instancedMesh name="Avioes_Derivas" ref={deriva} args={[geo.deriva, fab.cor("#ffffff", 0.5), n]} castShadow />
      <instancedMesh name="Avioes_Motores" ref={motores} args={[geo.motores, fab.cor("#a9aeb3", 0.4), n]} castShadow />
    </>
  );
}

// ——— Peças genéricas ———

/** Caixas repetidas numa só malha instanciada */
function Caixas({ nome, lista, material, sombra = true }: { nome: string; lista: Peca[]; material: THREE.Material; sombra?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const malha = ref.current;
    if (!malha) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < lista.length; i++) {
      const c = lista[i];
      o.position.set(c.x, c.y, c.z);
      o.rotation.set(0, c.giro ?? 0, 0);
      o.scale.set(c.l, c.a, c.p);
      o.updateMatrix();
      malha.setMatrixAt(i, o.matrix);
    }
    malha.instanceMatrix.needsUpdate = true;
    malha.computeBoundingSphere();
  }, [lista]);
  return (
    <instancedMesh name={nome} ref={ref} args={[undefined, undefined, lista.length]} material={material} castShadow={sombra} receiveShadow>
      <boxGeometry />
    </instancedMesh>
  );
}

/**
 * Forma da planta extrudada para cima a partir de y; material duplo = [topo, laterais]. Com chanfro, as
 * arestas de cima e de baixo ganham um bisel (a planta não cresce: o bisel entra para dentro).
 */
function Laje({ nome, forma, y = 0, altura, material, sombra = true, chanfro = 0 }: { nome: string; forma: THREE.Shape; y?: number; altura: number; material: THREE.Material | THREE.Material[]; sombra?: boolean; chanfro?: number }) {
  const geo = useMemo(() => {
    const b = Math.min(chanfro, altura / 4);
    return new THREE.ExtrudeGeometry(forma, { depth: Math.max(0.001, altura - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.7, bevelOffset: -b * 0.7, bevelSegments: 1, curveSegments: 1 }).translate(0, 0, b);
  }, [forma, altura, chanfro]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh name={nome} geometry={geo} position-y={y} rotation-x={-Math.PI / 2} material={material} castShadow={sombra} receiveShadow />;
}

/**
 * Faixa de vidro curva no arco do terminal (raio r, de f0 a f1), com UV em metros: u ao longo do arco,
 * v na altura. `paraDentro` vira a face para o centro do arco (o lado terra é côncavo).
 */
function faixaCurva(r: number, f0: number, f1: number, y: number, altura: number, paraDentro = false) {
  const n = Math.max(8, Math.round((f1 - f0) * 60));
  const g = new THREE.CylinderGeometry(r, r, altura, n, 1, true, Math.PI - f1, f1 - f0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * (f1 - f0), uv.getY(i) * altura);
  if (paraDentro) {
    const idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
    const nor = g.attributes.normal;
    for (let i = 0; i < nor.count; i++) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
  }
  return g.translate(CX, y + altura / 2, CZ);
}

/** Número da cabeceira pintado na pista */
function desenharNumero(texto: string) {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.font = "bold 92px Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(texto, 64, 68);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Pano de vidro do terminal (módulo de 1 m): reflexo do céu no alto, montante claro e caixilho na base */
function desenharVidroTerminal() {
  const cv = document.createElement("canvas");
  cv.width = 32;
  cv.height = 32;
  const g = cv.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, "#7fa6cf");
  grad.addColorStop(0.5, "#3f6ea3");
  grad.addColorStop(1, "#2c5480");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = "#e9eef2";
  g.fillRect(0, 0, 3, 32);
  g.fillRect(0, 29, 32, 3);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// ——— Conjuntos ———

function Pistas({ fab }: { fab: Fabrica }) {
  const numeros = useMemo(() => {
    const mat = (t: THREE.Texture, nome: string) => Object.assign(new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, depthWrite: false }), { name: nome });
    return { treze: mat(desenharNumero("13"), "Mat_Pista_Numero_13"), trintaEUm: mat(desenharNumero("31"), "Mat_Pista_Numero_31") };
  }, []);
  useEffect(
    () => () => {
      for (const m of [numeros.treze, numeros.trintaEUm]) {
        m.map?.dispose();
        m.dispose();
      }
    },
    [numeros],
  );
  const meio = PISTA.comprimento / 2;
  return (
    <>
      <mesh name="Pista_13_31" position={[0, 0.05, PISTA.z]} material={fab.cor(COR.asfalto, 0.85)} receiveShadow>
        <boxGeometry args={[PISTA.comprimento, 0.1, PISTA.largura]} />
      </mesh>
      {[TAXI_SUL, TAXI_NORTE].map((t) => (
        <mesh key={t.z} name={t === TAXI_SUL ? "Taxi_Sul" : "Taxi_Norte"} position={[(t.de + t.ate) / 2, 0.04, t.z]} material={fab.cor(COR.taxi, 0.9)} receiveShadow>
          <boxGeometry args={[t.ate - t.de, 0.08, t.largura]} />
        </mesh>
      ))}
      <Caixas nome="Taxi_Ligacoes" lista={LIGACOES} material={fab.cor(COR.taxi, 0.9)} sombra={false} />
      <Caixas nome="Pista_Sinalizacao_Branca" lista={MARCAS} material={fab.cor("#ffffff", 0.8)} sombra={false} />
      <Caixas nome="Taxi_Linhas_Amarelas" lista={LINHAS} material={fab.cor(COR.amarelo, 0.8)} sombra={false} />
      {/* números das cabeceiras, legíveis para quem chega */}
      <mesh name="Pista_Numero_13" position={[-(meio - 3.4), 0.11, PISTA.z]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} material={numeros.treze}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <mesh name="Pista_Numero_31" position={[meio - 3.4, 0.11, PISTA.z]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={numeros.trintaEUm}>
        <planeGeometry args={[2, 2]} />
      </mesh>
    </>
  );
}

function Terminal({ fab }: { fab: Fabrica }) {
  const branco = fab.cor(COR.branco, 0.7);
  const telhado = [fab.cor(COR.cobertura, 0.6), branco];
  const [ax, az] = noArco(R_AR - 2.3, FI_ABOBADA);
  const [cx, cz] = noArco(34.6, FI_ABOBADA);
  const r = RAIO_ABOBADA;
  const vidro = useMemo(() => {
    const t = desenharVidroTerminal();
    return {
      mat: Object.assign(new THREE.MeshStandardMaterial({ map: t, roughness: 0.15, metalness: 0.3 }), { name: "Mat_Vidro_Terminal" }),
      ar: faixaCurva(R_AR + 0.06, FI_OESTE, FI_LESTE, 0.9, 1.3),
      terra: faixaCurva(R_TERRA - 0.06, 0.03, FI_PIER, 1.9, 1.1, true),
      terraPier: faixaCurva(R_PIER - 0.06, FI_PIER, FI_LESTE, 1.6, 0.9, true),
      asa: caixaChanfrada(5.4, 4.8, 0.5, 0.1),
    };
  }, []);
  useEffect(
    () => () => {
      vidro.mat.map?.dispose();
      vidro.mat.dispose();
      vidro.ar.dispose();
      vidro.terra.dispose();
      vidro.terraPier.dispose();
      vidro.asa.dispose();
    },
    [vidro],
  );
  return (
    <>
      <Laje nome="Terminal_Corpo" forma={FORMAS.corpo} altura={3.4} material={telhado} chanfro={0.14} />
      <Laje nome="Terminal_Pier_Leste" forma={FORMAS.pier} altura={2.8} material={telhado} chanfro={0.12} />
      <Laje nome="Terminal_Cumeeira" forma={FORMAS.cumeeira} y={3.4} altura={0.5} material={[fab.cor(COR.cumeeira, 0.5), branco]} chanfro={0.08} />
      <Laje nome="Terminal_Cumeeira_Pier" forma={FORMAS.cumeeiraPier} y={2.8} altura={0.35} material={[fab.cor(COR.cumeeira, 0.5), branco]} chanfro={0.06} />
      {/* faixas de vidro: térreo do lado ar e nível de embarque do lado terra */}
      <mesh name="Terminal_Vidro_Lado_Ar" geometry={vidro.ar} material={vidro.mat} receiveShadow />
      <mesh name="Terminal_Vidro_Lado_Terra" geometry={vidro.terra} material={vidro.mat} receiveShadow />
      <mesh name="Terminal_Vidro_Lado_Terra_Pier" geometry={vidro.terraPier} material={vidro.mat} receiveShadow />

      {/* abóbada de vidro azul no meio da fachada do lado ar; −z local aponta para o pátio */}
      <group name="Terminal_Abobada" position={[ax, 0, az]} rotation-y={-FI_ABOBADA}>
        <mesh name="Abobada_Casca" position={[0, 2.4, 0]} rotation-x={Math.PI / 2} material={fab.cor(COR.cobertura, 0.5)} castShadow receiveShadow>
          <cylinderGeometry args={[r, r, 7.2, 28, 1, true, Math.PI / 2, Math.PI]} />
        </mesh>
        <mesh name="Abobada_Embasamento" position={[0, 0, -2.85]} material={branco} castShadow receiveShadow>
          <primitive object={useMemo(() => caixaChanfrada(2 * r, 2.4, 1.5, 0.1), [])} attach="geometry" />
        </mesh>
        <mesh name="Abobada_Vidro_Terreo" position={[0, 1.3, -3.62]} material={fab.cor(COR.vidroEscuro, 0.2)}>
          <boxGeometry args={[2 * r - 0.6, 1.4, 0.06]} />
        </mesh>
        <mesh name="Abobada_Vidro_Arco" position={[0, 2.4, -3.62]} rotation-y={Math.PI} material={fab.cor("#5e8fc4", 0.15)}>
          <circleGeometry args={[r - 0.05, 28, 0, Math.PI]} />
        </mesh>
        <group position={[0, 2.4, -3.7]}>
          <Caixas nome="Abobada_Maineis" lista={MAINEIS} material={branco} sombra={false} />
        </group>
        <mesh name="Abobada_Arco_Testa" position={[0, 2.4, -3.66]} material={branco} castShadow>
          <torusGeometry args={[r, 0.16, 6, 28, Math.PI]} />
        </mesh>
      </group>

      {/* cilindro branco do lado terra, com o letreiro e as antenas; +z local aponta para a rua */}
      <group name="Terminal_Cilindro" position={[cx, 0, cz]} rotation-y={-FI_ABOBADA}>
        <mesh name="Cilindro_Corpo" position-y={4.75} material={branco} castShadow receiveShadow>
          <cylinderGeometry args={[1.5, 1.5, 9.5, 32]} />
        </mesh>
        <mesh name="Cilindro_Coroa" position-y={9.55} material={fab.cor(COR.cumeeira, 0.5)} castShadow>
          <cylinderGeometry args={[1.58, 1.58, 0.18, 32]} />
        </mesh>
        <mesh name="Cilindro_Letreiro" position-y={6.9} material={fab.cor(COR.logo, 0.5)}>
          <cylinderGeometry args={[1.52, 1.52, 1.5, 24, 1, true, -0.75, 1.5]} />
        </mesh>
        <mesh name="Cilindro_Base" position={[0, 0, 1.6]} material={branco} castShadow receiveShadow>
          <primitive object={useMemo(() => caixaChanfrada(3.2, 1.2, 1.2, 0.1), [])} attach="geometry" />
        </mesh>
        <Caixas nome="Cilindro_Antenas" lista={ANTENAS} material={fab.cor("#d5d8da", 0.5)} />
        {/* "asas" de painéis brancos dos dois lados do cilindro */}
        {[-1, 1].map((s) => (
          <mesh key={s} name={`Cilindro_Asa_${s < 0 ? "Oeste" : "Leste"}`} geometry={vidro.asa} position={[s * 4.3, 0, -1.35]} rotation-z={s * -0.03} material={branco} castShadow receiveShadow />
        ))}
      </group>

      <Caixas nome="Embarque_Dedos" lista={PONTES.dedos} material={branco} />
      <Caixas nome="Embarque_Pontes" lista={PONTES.pontes} material={fab.cor(COR.ponte, 0.5)} />
      <Caixas nome="Embarque_Pilares" lista={PONTES.pilares} material={fab.cor(COR.cinza, 0.7)} />
    </>
  );
}

/** Pilares das coberturas solares (dois por toldo), carros sob elas e alguns na via de acesso */
function estacionamento() {
  const pilares: Peca[] = [];
  const carros: [number, number, number, number, number][] = [];
  const rnd = aleatorio(31);
  for (const t of TOLDOS) {
    const fi = -(t.giro ?? 0);
    const r = Math.hypot(t.x - CX, t.z - CZ);
    for (const s of [-1, 1]) {
      const [x, z] = noArco(r, fi + (s * 0.85) / r);
      pilares.push({ x, y: 0.55, z, l: 0.08, a: 1.1, p: 0.08 });
    }
    for (const s of [-1, 1]) {
      if (rnd() < 0.2) continue;
      const [x, z] = noArco(r, fi + (s * 0.5) / r);
      carros.push([x, 0.05, z, 1, -fi]);
    }
  }
  // na via, andando ao longo do arco (giro de 90° em relação ao raio)
  for (const [r, fi] of [[30.9, -0.2], [30.9, 0.1], [32.3, 0.3], [32.3, -0.05], [30.9, 0.45]]) {
    const [x, z] = noArco(r, fi);
    carros.push([x, 0.07, z, 1, -fi + Math.PI / 2]);
  }
  return { pilares, carros };
}
const ESTACIONAMENTO = estacionamento();
const CORES_CARROS = ["#e9ebec", "#2d3136", "#b8bdc2", "#a3262a", "#e9ebec", "#5b6772", "#1f4f8f"];

function LadoTerra({ fab }: { fab: Fabrica }) {
  const concreto = fab.cor("#c9c6bf", 0.9);
  const carros = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    // carro: caixa chanfrada com a cabine recuada em cima (0,42 m × 0,9 m na miniatura)
    const g = mergeGeometries([caixaChanfrada(0.42, 0.22, 0.9, 0.05), caixaChanfrada(0.36, 0.16, 0.5, 0.05).translate(0, 0.2, 0.04)]);
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  useLayoutEffect(() => {
    posicionar(carros.current!, ESTACIONAMENTO.carros, ESTACIONAMENTO.carros.map((_, i) => CORES_CARROS[(i * 5) % CORES_CARROS.length]));
  }, []);
  return (
    <>
      <Laje nome="Via_Acesso" forma={FORMAS.via} altura={0.07} material={fab.cor(COR.asfalto, 0.9)} sombra={false} />
      <Laje nome="Viaduto_Embarque" forma={FORMAS.viaduto} y={1.45} altura={0.32} material={concreto} chanfro={0.06} />
      <Caixas nome="Viaduto_Pilares" lista={PILARES_VIADUTO} material={concreto} />
      <Laje nome="Estacionamento_Piso" forma={FORMAS.estacionamento} altura={0.05} material={fab.cor(COR.estacionamento, 0.95)} sombra={false} />
      <Caixas nome="Estacionamento_Coberturas_Solares" lista={TOLDOS} material={fab.cor(COR.toldo, 0.4)} />
      <Caixas nome="Estacionamento_Pilares" lista={ESTACIONAMENTO.pilares} material={fab.cor("#9da2a6", 0.6)} />
      <instancedMesh name="Carros" ref={carros} args={[geo, fab.cor("#ffffff", 0.45), ESTACIONAMENTO.carros.length]} castShadow receiveShadow />
    </>
  );
}

function LadoNorte({ fab }: { fab: Fabrica }) {
  const branco = fab.cor(COR.branco, 0.7);
  const hangar = fab.cor(COR.hangar, 0.45);
  const portao = fab.cor("#4a5058", 0.7);
  const geo = useMemo(() => ({ bloco: caixaChanfrada(4.4, 2.2, 3.4, 0.1), baseTorre: caixaChanfrada(4, 1.6, 3, 0.1) }), []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <>
      {/* pátio da aviação geral */}
      <mesh name="Patio_Aviacao_Geral" position={[-2, 0.035, -17.2]} material={fab.cor(COR.concreto, 0.95)} receiveShadow>
        <boxGeometry args={[30, 0.07, 5.6]} />
      </mesh>
      {/* hangares de cobertura em arco, com o portão escuro virado para a pista de táxi */}
      {[-14, -8.6].map((x, i) => (
        <group key={x} name={`Hangar_Arco_${i + 1}`} position={[x, 0, -18.3]}>
          <mesh name={`Hangar_Arco_${i + 1}_Casca`} rotation-x={Math.PI / 2} material={hangar} castShadow receiveShadow>
            <cylinderGeometry args={[2.1, 2.1, 4.4, 20, 1, false, Math.PI / 2, Math.PI]} />
          </mesh>
          <mesh name={`Hangar_Arco_${i + 1}_Portao`} position-z={2.21} material={portao}>
            <circleGeometry args={[1.8, 16, 0, Math.PI]} />
          </mesh>
        </group>
      ))}
      <mesh name="Hangar_Bloco" geometry={geo.bloco} position={[-2.6, 0, -18.4]} material={hangar} castShadow receiveShadow />
      <mesh name="Hangar_Bloco_Portao" position={[-2.6, 0.85, -16.69]} material={portao}>
        <planeGeometry args={[3.4, 1.7]} />
      </mesh>
      {/* torre de controle: fuste esbelto, varanda, cabine envidraçada e antena */}
      <group name="Torre_de_Controle" position={[7, 0, -19]}>
        <mesh name="Torre_Base" geometry={geo.baseTorre} material={branco} castShadow receiveShadow />
        <mesh name="Torre_Fuste" position-y={6.8} material={fab.cor("#e6e4df", 0.7)} castShadow receiveShadow>
          <cylinderGeometry args={[0.55, 0.85, 12, 16]} />
        </mesh>
        <mesh name="Torre_Varanda" position-y={12.95} material={fab.cor(COR.cinza, 0.6)} castShadow>
          <cylinderGeometry args={[1.3, 1.1, 0.4, 16]} />
        </mesh>
        <mesh name="Torre_Cabine_Vidro" position-y={13.9} material={fab.cor("#2c5d8f", 0.12)} castShadow>
          <cylinderGeometry args={[1.6, 1.25, 1.5, 8]} />
        </mesh>
        <mesh name="Torre_Teto" position-y={14.8} material={branco} castShadow>
          <cylinderGeometry args={[1.75, 1.75, 0.3, 8]} />
        </mesh>
        <mesh name="Torre_Antena" position-y={15.8} material={fab.cor("#d5d8da", 0.5)}>
          <boxGeometry args={[0.1, 1.7, 0.1]} />
        </mesh>
      </group>
    </>
  );
}

/** Terminal de cargas a leste do de passageiros: galpão chanfrado com as docas viradas para o pátio */
function TerminalDeCargas({ fab }: { fab: Fabrica }) {
  const geo = useMemo(() => caixaChanfrada(7, 2.2, 3.2, 0.12), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const docas: Peca[] = [-2.4, -0.8, 0.8, 2.4].map((x) => ({ x: 21.4 + x, y: 0.75, z: 8.6 - 1.62, l: 1.1, a: 1.4, p: 0.05 }));
  return (
    <>
      <mesh name="Cargas_Galpao" geometry={geo} position={[21.4, 0, 8.6]} material={fab.cor(COR.branco, 0.7)} castShadow receiveShadow />
      <Caixas nome="Cargas_Docas" lista={docas} material={fab.cor("#4a5058", 0.7)} sombra={false} />
    </>
  );
}

/** Aeroporto Internacional Pinto Martins: pista 13/31, terminal curvo com a abóbada azul, o cilindro e a torre */
export function Aeroporto({ fab }: { fab: Fabrica }) {
  const grama = useMemo(() => {
    const t = texturaManchada(COR.grama, 0.05, 3, 64);
    t.repeat.set(7, 7);
    return Object.assign(new THREE.MeshStandardMaterial({ map: t, roughness: 1 }), { name: "Mat_Grama_Sitio" });
  }, []);
  useEffect(
    () => () => {
      grama.map?.dispose();
      grama.dispose();
    },
    [grama],
  );
  return (
    <group name="Aeroporto_Pinto_Martins" rotation-y={GIRO_PISTA}>
      {/* gramado seco do sítio aeroportuário, com manchas suaves */}
      <mesh name="Sitio_Gramado" position-y={0.01} rotation-x={-Math.PI / 2} material={grama} receiveShadow>
        <circleGeometry args={[30.5, 48]} />
      </mesh>
      <Laje nome="Patio_Aeronaves" forma={FORMAS.patio} altura={0.06} material={fab.cor(COR.concreto, 0.95)} sombra={false} />
      <Pistas fab={fab} />
      <Terminal fab={fab} />
      <Caixas nome="Patio_Torres_de_Luz" lista={LUZES} material={fab.cor("#b9bcbf", 0.5)} />
      <Avioes fab={fab} />
      <TerminalDeCargas fab={fab} />
      <LadoTerra fab={fab} />
      <LadoNorte fab={fab} />
    </group>
  );
}
