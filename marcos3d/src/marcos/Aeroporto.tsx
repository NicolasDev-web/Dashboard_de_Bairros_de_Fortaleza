import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Fabrica } from "../Cena";

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

/** Peças do avião já posicionadas, com o nariz em −z: corpo branco, deriva colorida e motores */
function geometriasDoAviao() {
  const fuselagem = new THREE.CapsuleGeometry(0.42, 5.3, 4, 14).rotateX(Math.PI / 2).translate(0, 0.95, 0);
  const asa = new THREE.ExtrudeGeometry(formaAsa(2.9, 1.3, 1.1, 0.45), { depth: 0.1, bevelEnabled: false })
    .rotateX(-Math.PI / 2)
    .translate(0, 0.72, 0.1);
  const profundor = new THREE.ExtrudeGeometry(formaAsa(1.25, 0.9, 0.55, 0.35), { depth: 0.07, bevelEnabled: false })
    .rotateX(-Math.PI / 2)
    .translate(0, 1.12, 2.75);
  const corpo = mergeGeometries([semIndice(fuselagem), semIndice(asa), semIndice(profundor)]);
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
      <instancedMesh ref={corpo} args={[geo.corpo, fab.cor("#f4f5f6", 0.45), n]} castShadow receiveShadow />
      <instancedMesh ref={deriva} args={[geo.deriva, fab.cor("#ffffff", 0.5), n]} castShadow />
      <instancedMesh ref={motores} args={[geo.motores, fab.cor("#a9aeb3", 0.4), n]} castShadow />
    </>
  );
}

// ——— Peças genéricas ———

/** Caixas repetidas numa só malha instanciada */
function Caixas({ lista, material, sombra = true }: { lista: Peca[]; material: THREE.Material; sombra?: boolean }) {
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
    <instancedMesh ref={ref} args={[undefined, undefined, lista.length]} material={material} castShadow={sombra} receiveShadow>
      <boxGeometry />
    </instancedMesh>
  );
}

/** Forma da planta extrudada para cima a partir de y; material duplo = [topo, laterais] */
function Laje({ forma, y = 0, altura, material, sombra = true }: { forma: THREE.Shape; y?: number; altura: number; material: THREE.Material | THREE.Material[]; sombra?: boolean }) {
  return (
    <mesh position-y={y} rotation-x={-Math.PI / 2} material={material} castShadow={sombra} receiveShadow>
      <extrudeGeometry args={[forma, { depth: altura, bevelEnabled: false, curveSegments: 1 }]} />
    </mesh>
  );
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

// ——— Conjuntos ———

function Pistas({ fab }: { fab: Fabrica }) {
  const numeros = useMemo(() => ({ treze: desenharNumero("13"), trintaEUm: desenharNumero("31") }), []);
  useEffect(
    () => () => {
      numeros.treze.dispose();
      numeros.trintaEUm.dispose();
    },
    [numeros],
  );
  const meio = PISTA.comprimento / 2;
  return (
    <>
      <mesh position={[0, 0.05, PISTA.z]} material={fab.cor(COR.asfalto, 0.85)} receiveShadow>
        <boxGeometry args={[PISTA.comprimento, 0.1, PISTA.largura]} />
      </mesh>
      {[TAXI_SUL, TAXI_NORTE].map((t) => (
        <mesh key={t.z} position={[(t.de + t.ate) / 2, 0.04, t.z]} material={fab.cor(COR.taxi, 0.9)} receiveShadow>
          <boxGeometry args={[t.ate - t.de, 0.08, t.largura]} />
        </mesh>
      ))}
      <Caixas lista={LIGACOES} material={fab.cor(COR.taxi, 0.9)} sombra={false} />
      <Caixas lista={MARCAS} material={fab.cor("#ffffff", 0.8)} sombra={false} />
      <Caixas lista={LINHAS} material={fab.cor(COR.amarelo, 0.8)} sombra={false} />
      {/* números das cabeceiras, legíveis para quem chega */}
      <mesh position={[-(meio - 3.4), 0.11, PISTA.z]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
        <planeGeometry args={[2, 2]} />
        <meshStandardMaterial map={numeros.treze} transparent roughness={0.8} depthWrite={false} />
      </mesh>
      <mesh position={[meio - 3.4, 0.11, PISTA.z]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[2, 2]} />
        <meshStandardMaterial map={numeros.trintaEUm} transparent roughness={0.8} depthWrite={false} />
      </mesh>
    </>
  );
}

function Terminal({ fab }: { fab: Fabrica }) {
  const branco = fab.cor(COR.branco, 0.7);
  const telhado = [fab.cor(COR.cobertura, 0.6), branco];
  const vidro = fab.cor(COR.vidro, 0.2);
  const [ax, az] = noArco(R_AR - 2.3, FI_ABOBADA);
  const [cx, cz] = noArco(34.6, FI_ABOBADA);
  const r = RAIO_ABOBADA;
  return (
    <>
      <Laje forma={FORMAS.corpo} altura={3.4} material={telhado} />
      <Laje forma={FORMAS.pier} altura={2.8} material={telhado} />
      <Laje forma={FORMAS.cumeeira} y={3.4} altura={0.5} material={[fab.cor(COR.cumeeira, 0.5), branco]} />
      <Laje forma={FORMAS.cumeeiraPier} y={2.8} altura={0.35} material={[fab.cor(COR.cumeeira, 0.5), branco]} />
      {/* faixas de vidro: térreo do lado ar e nível de embarque do lado terra */}
      <Laje forma={FORMAS.vidroAr} y={0.9} altura={1.3} material={vidro} sombra={false} />
      <Laje forma={FORMAS.vidroTerra} y={1.9} altura={1.1} material={vidro} sombra={false} />
      <Laje forma={FORMAS.vidroTerraPier} y={1.6} altura={0.9} material={vidro} sombra={false} />

      {/* abóbada de vidro azul no meio da fachada do lado ar; −z local aponta para o pátio */}
      <group position={[ax, 0, az]} rotation-y={-FI_ABOBADA}>
        <mesh position={[0, 2.4, 0]} rotation-x={Math.PI / 2} material={fab.cor(COR.cobertura, 0.5)} castShadow receiveShadow>
          <cylinderGeometry args={[r, r, 7.2, 28, 1, true, Math.PI / 2, Math.PI]} />
        </mesh>
        <mesh position={[0, 1.2, -2.85]} material={branco} castShadow receiveShadow>
          <boxGeometry args={[2 * r, 2.4, 1.5]} />
        </mesh>
        <mesh position={[0, 1.3, -3.62]} material={fab.cor(COR.vidroEscuro, 0.2)}>
          <boxGeometry args={[2 * r - 0.6, 1.4, 0.06]} />
        </mesh>
        <mesh position={[0, 2.4, -3.62]} rotation-y={Math.PI} material={fab.cor("#5e8fc4", 0.15)}>
          <circleGeometry args={[r - 0.05, 28, 0, Math.PI]} />
        </mesh>
        <group position={[0, 2.4, -3.7]}>
          <Caixas lista={MAINEIS} material={branco} sombra={false} />
        </group>
        <mesh position={[0, 2.4, -3.66]} material={branco} castShadow>
          <torusGeometry args={[r, 0.16, 6, 28, Math.PI]} />
        </mesh>
      </group>

      {/* cilindro branco do lado terra, com o letreiro e as antenas; +z local aponta para a rua */}
      <group position={[cx, 0, cz]} rotation-y={-FI_ABOBADA}>
        <mesh position-y={4.75} material={branco} castShadow receiveShadow>
          <cylinderGeometry args={[1.5, 1.5, 9.5, 32]} />
        </mesh>
        <mesh position-y={6.9} material={fab.cor(COR.logo, 0.5)}>
          <cylinderGeometry args={[1.52, 1.52, 1.5, 24, 1, true, -0.75, 1.5]} />
        </mesh>
        <mesh position={[0, 0.6, 1.6]} material={branco} castShadow receiveShadow>
          <boxGeometry args={[3.2, 1.2, 1.2]} />
        </mesh>
        <Caixas lista={ANTENAS} material={fab.cor("#d5d8da", 0.5)} />
        {/* "asas" de painéis brancos dos dois lados do cilindro */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 4.3, 2.4, -1.35]} rotation-z={s * -0.03} material={branco} castShadow receiveShadow>
            <boxGeometry args={[5.4, 4.8, 0.5]} />
          </mesh>
        ))}
      </group>

      <Caixas lista={PONTES.dedos} material={branco} />
      <Caixas lista={PONTES.pontes} material={fab.cor(COR.ponte, 0.5)} />
      <Caixas lista={PONTES.pilares} material={fab.cor(COR.cinza, 0.7)} />
    </>
  );
}

function LadoTerra({ fab }: { fab: Fabrica }) {
  const concreto = fab.cor("#c9c6bf", 0.9);
  return (
    <>
      <Laje forma={FORMAS.via} altura={0.07} material={fab.cor(COR.asfalto, 0.9)} sombra={false} />
      <Laje forma={FORMAS.viaduto} y={1.45} altura={0.32} material={concreto} />
      <Caixas lista={PILARES_VIADUTO} material={concreto} />
      <Laje forma={FORMAS.estacionamento} altura={0.05} material={fab.cor(COR.estacionamento, 0.95)} sombra={false} />
      <Caixas lista={TOLDOS} material={fab.cor(COR.toldo, 0.4)} />
    </>
  );
}

function LadoNorte({ fab }: { fab: Fabrica }) {
  const branco = fab.cor(COR.branco, 0.7);
  const hangar = fab.cor(COR.hangar, 0.45);
  return (
    <>
      {/* pátio da aviação geral */}
      <mesh position={[-2, 0.035, -17.2]} material={fab.cor(COR.concreto, 0.95)} receiveShadow>
        <boxGeometry args={[30, 0.07, 5.6]} />
      </mesh>
      {/* hangares de cobertura em arco */}
      {[-14, -8.6].map((x) => (
        <mesh key={x} position={[x, 0, -18.3]} rotation-x={Math.PI / 2} material={hangar} castShadow receiveShadow>
          <cylinderGeometry args={[2.1, 2.1, 4.4, 20, 1, false, Math.PI / 2, Math.PI]} />
        </mesh>
      ))}
      <mesh position={[-2.6, 1.1, -18.4]} material={hangar} castShadow receiveShadow>
        <boxGeometry args={[4.4, 2.2, 3.4]} />
      </mesh>
      {/* torre de controle: fuste esbelto, varanda, cabine envidraçada e antena */}
      <group position={[7, 0, -19]}>
        <mesh position-y={0.8} material={branco} castShadow receiveShadow>
          <boxGeometry args={[4, 1.6, 3]} />
        </mesh>
        <mesh position-y={6.8} material={fab.cor("#e6e4df", 0.7)} castShadow receiveShadow>
          <cylinderGeometry args={[0.55, 0.85, 12, 16]} />
        </mesh>
        <mesh position-y={12.95} material={fab.cor(COR.cinza, 0.6)} castShadow>
          <cylinderGeometry args={[1.3, 1.1, 0.4, 16]} />
        </mesh>
        <mesh position-y={13.9} material={fab.cor("#2c5d8f", 0.12)} castShadow>
          <cylinderGeometry args={[1.6, 1.25, 1.5, 8]} />
        </mesh>
        <mesh position-y={14.8} material={branco} castShadow>
          <cylinderGeometry args={[1.75, 1.75, 0.3, 8]} />
        </mesh>
        <mesh position-y={15.8} material={fab.cor("#d5d8da", 0.5)}>
          <boxGeometry args={[0.1, 1.7, 0.1]} />
        </mesh>
      </group>
    </>
  );
}

/** Aeroporto Internacional Pinto Martins: pista 13/31, terminal curvo com a abóbada azul, o cilindro e a torre */
export function Aeroporto({ fab }: { fab: Fabrica }) {
  return (
    <group rotation-y={GIRO_PISTA}>
      {/* gramado seco do sítio aeroportuário */}
      <mesh position-y={0.01} rotation-x={-Math.PI / 2} material={fab.cor(COR.grama, 1)} receiveShadow>
        <circleGeometry args={[30.5, 48]} />
      </mesh>
      <Laje forma={FORMAS.patio} altura={0.06} material={fab.cor(COR.concreto, 0.95)} sombra={false} />
      <Pistas fab={fab} />
      <Terminal fab={fab} />
      <Caixas lista={LUZES} material={fab.cor("#b9bcbf", 0.5)} />
      <Avioes fab={fab} />
      {/* terminal de cargas a leste do de passageiros */}
      <mesh position={[21.4, 1.1, 8.6]} material={fab.cor(COR.branco, 0.7)} castShadow receiveShadow>
        <boxGeometry args={[7, 2.2, 3.2]} />
      </mesh>
      <LadoTerra fab={fab} />
      <LadoNorte fab={fab} />
    </group>
  );
}
