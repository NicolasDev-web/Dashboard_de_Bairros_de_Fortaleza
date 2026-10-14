import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Fabrica } from "../Cena";
import { aleatorio, caixaChanfrada, posicionar, texturaJanelas, texturaManchada } from "../util/geometria";

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

/** Meia largura do disco na altura z (com folga), para recortar faixas e listas de pontos */
const meiaCorda = (z: number, folga = 0) => Math.sqrt(Math.max(0, (R - folga) ** 2 - z * z));

/** Faixa do disco entre z1 e z2, deitada no chão (UV em metros: u = x, v = −z) */
function faixa(z1: number, z2: number) {
  const pts: THREE.Vector2[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const z = z1 + ((z2 - z1) * i) / n;
    pts.push(new THREE.Vector2(meiaCorda(z), -z));
  }
  for (let i = n; i >= 0; i--) {
    const z = z1 + ((z2 - z1) * i) / n;
    pts.push(new THREE.Vector2(-meiaCorda(z), -z));
  }
  return new THREE.ShapeGeometry(new THREE.Shape(pts));
}

function Faixa({ nome, z1, z2, y, material }: { nome: string; z1: number; z2: number; y: number; material: THREE.Material }) {
  const geo = useMemo(() => faixa(z1, z2), [z1, z2]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh name={nome} geometry={geo} material={material} rotation-x={-Math.PI / 2} position-y={y} receiveShadow />;
}

/**
 * Linha de espuma ondulada (a crista da onda quebrando): tira estreita em z0 que serpenteia em x, recortada
 * no disco. Já sai deitada, com a normal para cima.
 */
function espumaOndulada(z0: number, largura: number, amp: number, fase: number) {
  const pos: number[] = [];
  const idx: number[] = [];
  const meia = meiaCorda(z0, 0.4);
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const x = -meia + (2 * meia * i) / n;
    const z = z0 + amp * Math.sin(x * 0.33 + fase) + amp * 0.45 * Math.sin(x * 0.91 + fase * 2.3);
    const w = largura * (0.6 + 0.4 * Math.abs(Math.sin(x * 0.21 + fase))); // a crista engrossa e afina
    pos.push(x, 0, z - w / 2, x, 0, z + w / 2);
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ——— Cidade atrás da avenida ———

interface Lote {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  telhado: boolean;
  cor: string;
}

/**
 * Paredes de todos os prédios numa malha só (cor por vértice, UV em metros para a textura de janelas
 * repetir por andar) e as lajes dos prédios altos noutra, com o chanfro de 45° na borda.
 */
function geometriaPredios(lotes: Lote[]) {
  const fach = { p: [] as number[], n: [] as number[], uv: [] as number[], c: [] as number[] };
  const laj = { p: [] as number[], n: [] as number[], c: [] as number[] };
  const cor = new THREE.Color();
  const corTopo = new THREE.Color();
  const quad = (alvo: { p: number[]; n: number[]; c: number[]; uv?: number[] }, v: number[][], n: number[], c: THREE.Color, uv?: number[][]) => {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      alvo.p.push(...v[i]);
      alvo.n.push(...n);
      alvo.c.push(c.r, c.g, c.b);
      if (uv && alvo.uv) alvo.uv.push(...uv[i]);
    }
  };
  const b = 0.1;
  for (const l of lotes) {
    cor.set(l.cor);
    corTopo.copy(cor).multiplyScalar(0.84);
    const x0 = l.x - l.w / 2, x1 = l.x + l.w / 2, z0 = l.z - l.d / 2, z1 = l.z + l.d / 2;
    // casas: parede até o beiral (o telhado cobre o topo); prédios: parede até o chanfro da laje
    const y1 = l.telhado ? l.h : l.h - b, y2 = l.h;
    const faixaU = (c: number): number[][] => {
      const u0 = -(c - Math.floor(c / 1.2) * 1.2) / 2;
      return [[u0, 0], [u0 + c, 0], [u0 + c, y1], [u0, y1]];
    };
    const uW = faixaU(l.w), uD = faixaU(l.d);
    quad(fach, [[x0, 0, z1], [x1, 0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], cor, uW);
    quad(fach, [[x1, 0, z0], [x0, 0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], cor, uW);
    quad(fach, [[x1, 0, z1], [x1, 0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], cor, uD);
    quad(fach, [[x0, 0, z0], [x0, 0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], cor, uD);
    if (l.telhado) continue;
    const k = Math.SQRT1_2;
    quad(laj, [[x0, y1, z1], [x1, y1, z1], [x1 - b, y2, z1 - b], [x0 + b, y2, z1 - b]], [0, k, k], cor);
    quad(laj, [[x1, y1, z0], [x0, y1, z0], [x0 + b, y2, z0 + b], [x1 - b, y2, z0 + b]], [0, k, -k], cor);
    quad(laj, [[x1, y1, z1], [x1, y1, z0], [x1 - b, y2, z0 + b], [x1 - b, y2, z1 - b]], [k, k, 0], cor);
    quad(laj, [[x0, y1, z0], [x0, y1, z1], [x0 + b, y2, z1 - b], [x0 + b, y2, z0 + b]], [-k, k, 0], cor);
    quad(laj, [[x0 + b, y2, z1 - b], [x1 - b, y2, z1 - b], [x1 - b, y2, z0 + b], [x0 + b, y2, z0 + b]], [0, 1, 0], corTopo);
  }
  const fachadas = new THREE.BufferGeometry();
  fachadas.setAttribute("position", new THREE.Float32BufferAttribute(fach.p, 3));
  fachadas.setAttribute("normal", new THREE.Float32BufferAttribute(fach.n, 3));
  fachadas.setAttribute("uv", new THREE.Float32BufferAttribute(fach.uv, 2));
  fachadas.setAttribute("color", new THREE.Float32BufferAttribute(fach.c, 3));
  const lajes = new THREE.BufferGeometry();
  lajes.setAttribute("position", new THREE.Float32BufferAttribute(laj.p, 3));
  lajes.setAttribute("normal", new THREE.Float32BufferAttribute(laj.n, 3));
  lajes.setAttribute("color", new THREE.Float32BufferAttribute(laj.c, 3));
  return { fachadas, lajes };
}

/** Quarteirões atrás da avenida: prédios altos da orla na primeira fila e casas de telhado de barro atrás */
function Cidade({ desde, semente, altos, fab, mats }: { desde: number; semente: number; altos: number; fab: Fabrica; mats: MateriaisPraia }) {
  const lotes = useMemo(() => {
    const rnd = aleatorio(semente);
    const tons = ["#efe9df", "#e8dfcf", "#f3efe6", "#d9e0e3", "#e2d6c3"];
    const lista: Lote[] = [];
    let k = 0;
    for (let z = desde + 2.5; z < R; z += 4.2) {
      for (let x = -R; x < R; x += 4.4) {
        const px = x + (rnd() - 0.5) * 0.8;
        if (Math.hypot(px, z) > R - 2.5 || rnd() < 0.18) continue;
        const primeira = z < desde + 6;
        const alto = primeira && rnd() < altos;
        lista.push({ x: px, z, w: alto ? 3 : 3.4, d: alto ? 3 : 3.2, h: alto ? 4.5 + rnd() * 5 : 1.4 + rnd() * 1.4, telhado: !alto, cor: tons[k++ % tons.length] });
      }
    }
    return lista;
  }, [desde, semente, altos]);
  const casas = useMemo(() => lotes.filter((l) => l.telhado), [lotes]);
  const geo = useMemo(() => {
    // telhado de quatro águas facetado (cone de 4 lados sem índice)
    const telhado = new THREE.ConeGeometry(1, 1, 4, 1).toNonIndexed();
    telhado.computeVertexNormals();
    return { ...geometriaPredios(lotes), telhado };
  }, [lotes]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const telhados = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const tons = ["#c8693f", "#b85a35", "#d27a4c"];
    casas.forEach((l, i) => {
      o.position.set(l.x, l.h + 0.5, l.z);
      o.rotation.set(0, Math.PI / 4, 0);
      o.scale.set((l.w / Math.SQRT2) * 1.12, 1, (l.d / Math.SQRT2) * 1.12);
      o.updateMatrix();
      telhados.current!.setMatrixAt(i, o.matrix);
      telhados.current!.setColorAt(i, cor.set(tons[i % tons.length]));
    });
    telhados.current!.instanceMatrix.needsUpdate = true;
    if (telhados.current!.instanceColor) telhados.current!.instanceColor.needsUpdate = true;
    telhados.current!.computeBoundingSphere();
  }, [casas]);
  return (
    <>
      <mesh name="Cidade_Fachadas" geometry={geo.fachadas} material={mats.fachadas} castShadow receiveShadow />
      <mesh name="Cidade_Lajes" geometry={geo.lajes} material={mats.lajes} castShadow receiveShadow />
      <instancedMesh name="Cidade_Telhados_Ceramica" ref={telhados} args={[geo.telhado, fab.cor("#ffffff", 0.85), casas.length]} castShadow receiveShadow />
    </>
  );
}

// ——— Materiais e mobiliário da orla ———

/** Materiais com textura das praias (janelas da cidade e areia manchada), criados uma vez por praia */
function useMateriaisPraia() {
  const m = useMemo(() => {
    const janelas = texturaJanelas({ parede: "#ffffff", janela: "#4f6070", moldura: "#dcd8cf", larguraJanela: 0.55, alturaJanela: 0.5, tamanho: 64 });
    janelas.repeat.set(1 / 1.2, 1);
    const areia = texturaManchada("#e6d3a6", 0.05, 12, 64);
    areia.repeat.set(1 / 6, 1 / 6);
    const mat = (nome: string, p: THREE.MeshStandardMaterialParameters) => Object.assign(new THREE.MeshStandardMaterial(p), { name: nome });
    return {
      fachadas: mat("Mat_Cidade_Fachadas", { map: janelas, roughness: 0.85, vertexColors: true }),
      lajes: mat("Mat_Cidade_Lajes", { roughness: 0.92, vertexColors: true }),
      areia: mat("Mat_Areia", { map: areia, roughness: 1 }),
      espuma: mat("Mat_Espuma", { color: "#f4f7f6", roughness: 0.6, transparent: true, opacity: 0.9 }),
      folhas: mat("Mat_Folha_Coqueiro", { color: "#4f8a3c", roughness: 0.8, side: THREE.DoubleSide }),
    };
  }, []);
  useEffect(
    () => () => {
      for (const x of Object.values(m)) {
        x.map?.dispose();
        x.dispose();
      }
    },
    [m],
  );
  return m;
}
type MateriaisPraia = ReturnType<typeof useMateriaisPraia>;

/** Postes do calçadão e carros na avenida (duas mãos), espalhados ao longo da orla */
function Orla({ f, semente, fab }: { f: Faixas; semente: number; fab: Fabrica }) {
  const dados = useMemo(() => {
    const rnd = aleatorio(semente + 3);
    const postes: [number, number, number][] = [];
    const zPoste = f.calcadao - 0.35;
    for (let x = -R; x <= R; x += 6) if (Math.abs(x) < meiaCorda(zPoste, 1.2)) postes.push([x, 0, zPoste]);
    const carros: [number, number, number, number, number][] = [];
    const faixaMeio = (f.calcadao + f.avenida) / 2;
    const tracos: [number, number, number][] = [];
    for (let x = -R; x <= R; x += 2.2) if (Math.abs(x) < meiaCorda(faixaMeio, 1)) tracos.push([x, 0.075, faixaMeio]);
    for (const [z, giro] of [[faixaMeio - 0.7, Math.PI / 2], [faixaMeio + 0.7, -Math.PI / 2]] as const) {
      for (let x = -R + rnd() * 4; x <= R; x += 3.5 + rnd() * 5) if (Math.abs(x) < meiaCorda(z, 1.5)) carros.push([x, 0.07, z, 1, giro]);
    }
    return { postes, carros, tracos };
  }, [f, semente]);
  const geo = useMemo(
    () => ({
      poste: mergeGeometries([new THREE.CylinderGeometry(0.05, 0.07, 2.6, 6).translate(0, 1.3, 0), new THREE.BoxGeometry(0.5, 0.06, 0.12).translate(0, 2.6, -0.2)]),
      carro: mergeGeometries([caixaChanfrada(0.42, 0.22, 0.9, 0.05), caixaChanfrada(0.36, 0.16, 0.5, 0.05).translate(0, 0.2, 0.04)]),
      traco: new THREE.BoxGeometry(1.1, 0.01, 0.1),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const postes = useRef<THREE.InstancedMesh>(null);
  const carros = useRef<THREE.InstancedMesh>(null);
  const tracos = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const cores = ["#e9ebec", "#2d3136", "#b8bdc2", "#a3262a", "#e9ebec", "#5b6772", "#1f4f8f", "#d9b23a"];
    posicionar(postes.current!, dados.postes);
    posicionar(carros.current!, dados.carros, dados.carros.map((_, i) => cores[(i * 3) % cores.length]));
    posicionar(tracos.current!, dados.tracos);
  }, [dados]);
  return (
    <>
      <instancedMesh name="Calcadao_Postes" ref={postes} args={[geo.poste, fab.cor("#3a3f44", 0.5), dados.postes.length]} castShadow />
      <instancedMesh name="Avenida_Carros" ref={carros} args={[geo.carro, fab.cor("#ffffff", 0.45), dados.carros.length]} castShadow receiveShadow />
      <instancedMesh name="Avenida_Faixa_Tracejada" ref={tracos} args={[geo.traco, fab.cor("#eeeeea", 0.8), dados.tracos.length]} />
    </>
  );
}

/** Mar (fundo e raso), espuma, areia molhada e seca, calçadão, avenida e cidade, girados para o rumo real do mar */
function BasePraia({ rumoMar, f, cidadeAltos, corMar, fab, mats, children }: { rumoMar: number; f: Faixas; cidadeAltos: number; corMar: string; fab: Fabrica; mats: MateriaisPraia; children: ReactNode }) {
  const espumas = useMemo(() => f.espuma.map((z, i) => espumaOndulada(z, 0.42, 0.35, i * 1.7 + rumoMar)), [f, rumoMar]);
  const beira = useMemo(() => espumaOndulada(f.agua - 0.15, 0.32, 0.25, rumoMar * 0.3), [f, rumoMar]);
  useEffect(() => () => [...espumas, beira].forEach((g) => g.dispose()), [espumas, beira]);
  const raso = useMemo(() => "#" + new THREE.Color(corMar).lerp(new THREE.Color("#8fe0d2"), 0.45).getHexString(), [corMar]);
  return (
    <group name="Base_Praia" rotation-y={-THREE.MathUtils.degToRad(rumoMar)}>
      <Faixa nome="Mar_Fundo" z1={-R} z2={f.agua - 3.2} y={0.05} material={fab.cor(corMar, 0.2)} />
      <Faixa nome="Mar_Raso" z1={f.agua - 3.2} z2={f.agua} y={0.05} material={fab.cor(raso, 0.2)} />
      {espumas.map((g, i) => (
        <mesh key={i} name={`Mar_Espuma_${i + 1}`} geometry={g} position-y={0.08} material={mats.espuma} receiveShadow />
      ))}
      <mesh name="Mar_Espuma_Beira" geometry={beira} position-y={0.085} material={mats.espuma} receiveShadow />
      <Faixa nome="Areia_Molhada" z1={f.agua} z2={f.agua + 1.2} y={0.06} material={fab.cor("#cdb98c", 0.85)} />
      <Faixa nome="Areia_Seca" z1={f.agua + 1.2} z2={f.areia} y={0.06} material={mats.areia} />
      <Faixa nome="Calcadao" z1={f.areia} z2={f.calcadao} y={0.09} material={fab.cor("#d9d2c4", 0.9)} />
      <Faixa nome="Avenida" z1={f.calcadao} z2={f.avenida} y={0.07} material={fab.cor("#5c5f61", 0.95)} />
      <Faixa nome="Quarteiroes_Chao" z1={f.avenida} z2={R} y={0.06} material={fab.cor("#d3cfc6", 1)} />
      <Orla f={f} semente={Math.round(rumoMar)} fab={fab} />
      <Cidade desde={f.avenida} semente={Math.round(rumoMar * 7)} altos={cidadeAltos} fab={fab} mats={mats} />
      {children}
    </group>
  );
}

/**
 * Folha de coqueiro: tira em "V" raso que sobe um pouco e cai em arco, afinando na ponta. Base na origem,
 * correndo em +z; as duas faces aparecem (material de dois lados).
 */
function geometriaFolha(comp = 2.2) {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = 0.45 * t - 1.25 * t * t;
    const w = t < 0.15 ? 0.05 + t * 1.3 : 0.26 * (1 - t) + 0.03;
    const z = comp * t;
    pos.push(-w, y - 0.06, z, 0, y, z, w, y - 0.06, z);
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

const FOLHAS = 8;

/** Coqueiros em instâncias: estipe inclinado, copa de folhas arqueadas e o cacho de cocos */
function Coqueiros({ nome, pontos, fab, mats }: { nome: string; pontos: [number, number][]; fab: Fabrica; mats: MateriaisPraia }) {
  const geo = useMemo(() => ({ folha: geometriaFolha(), estipe: new THREE.CylinderGeometry(0.08, 0.14, 3.2, 6).translate(0, 1.6, 0) }), []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const troncos = useRef<THREE.InstancedMesh>(null);
  const folhas = useRef<THREE.InstancedMesh>(null);
  const cocos = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const topo = new THREE.Vector3();
    const cor = new THREE.Color();
    pontos.forEach(([x, z], i) => {
      const inclina = ((i * 37) % 9) / 40 - 0.1;
      o.position.set(x, 0.06, z);
      o.rotation.set(inclina, 0, -inclina);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      troncos.current!.setMatrixAt(i, o.matrix);
      topo.set(0, 3.2, 0).applyMatrix4(o.matrix);
      o.position.copy(topo);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      cocos.current!.setMatrixAt(i, o.matrix);
      for (let f = 0; f < FOLHAS; f++) {
        const ang = i * 1.3 + (f / FOLHAS) * Math.PI * 2;
        o.position.copy(topo);
        o.rotation.set(f % 2 ? -0.35 : 0.05, ang, 0, "YXZ");
        o.scale.setScalar(f % 2 ? 0.85 : 1);
        o.updateMatrix();
        folhas.current!.setMatrixAt(i * FOLHAS + f, o.matrix);
        folhas.current!.setColorAt(i * FOLHAS + f, cor.set(f % 3 ? "#ffffff" : "#d4e3b8"));
      }
    });
    for (const m of [troncos.current!, folhas.current!, cocos.current!]) {
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
    if (folhas.current!.instanceColor) folhas.current!.instanceColor.needsUpdate = true;
  }, [pontos]);
  return (
    <>
      <instancedMesh name={`${nome}_Estipes`} ref={troncos} args={[geo.estipe, fab.cor("#8b7355"), pontos.length]} castShadow />
      <instancedMesh name={`${nome}_Cocos`} ref={cocos} args={[undefined, fab.cor("#5e5a2e", 0.8), pontos.length]} castShadow>
        <icosahedronGeometry args={[0.26, 0]} />
      </instancedMesh>
      <instancedMesh name={`${nome}_Folhas`} ref={folhas} args={[geo.folha, mats.folhas, pontos.length * FOLHAS]} castShadow />
    </>
  );
}

// ——— Praia de Iracema ———

/** Ponte dos Ingleses: pilares escuros em pente, deck branco com guarda-corpo, quiosques, pavilhão e torre na ponta */
function PonteDosIngleses({ fab }: { fab: Fabrica }) {
  const deck = { z1: 3, z2: -19, largura: 3, altura: 1.6 };
  const pilares = useRef<THREE.InstancedMesh>(null);
  const montantes = useRef<THREE.InstancedMesh>(null);
  const luminarias = useRef<THREE.InstancedMesh>(null);
  const posicoes = useMemo(() => {
    const p: [number, number, number][] = [];
    // sob o deck, dos dois lados
    for (let z = deck.z1 - 0.6; z > deck.z2; z -= 1.1) for (const x of [-1.1, 1.1]) p.push([x, z, deck.altura]);
    // trecho de pilares sem piso que continua mar adentro
    for (let z = deck.z2 - 0.8; z > -29; z -= 1.1) for (const x of [-0.5, 0.5]) p.push([x, z, deck.altura - 0.3]);
    return p;
  }, [deck.z1, deck.z2, deck.altura]);
  const comprimento = deck.z1 - deck.z2;
  const meio = (deck.z1 + deck.z2) / 2;
  const geo = useMemo(
    () => ({
      deck: caixaChanfrada(deck.largura, 0.28, comprimento, 0.06),
      pilar: caixaChanfrada(0.35, 1, 0.35, 0.04),
      pavilhao: caixaChanfrada(2.2, 1.2, 3.6, 0.06),
      torre: caixaChanfrada(1.1, 3.4, 1.1, 0.06),
      torreTopo: caixaChanfrada(1.6, 0.25, 1.6, 0.05),
      quatroAguas: (() => {
        const g = new THREE.ConeGeometry(1, 0.7, 4).toNonIndexed();
        g.computeVertexNormals();
        return g;
      })(),
    }),
    [comprimento],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    posicoes.forEach(([x, z, h], i) => {
      o.position.set(x, 0, z);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      pilares.current!.setMatrixAt(i, o.matrix);
    });
    pilares.current!.instanceMatrix.needsUpdate = true;
    pilares.current!.computeBoundingSphere();
    // montantes do guarda-corpo a cada 1,1 m e luminárias a cada 4,4 m, dos dois lados
    const m: [number, number, number][] = [];
    const l: [number, number, number][] = [];
    for (let z = deck.z1 - 0.3; z > deck.z2; z -= 1.1) for (const s of [-1, 1]) m.push([s * (deck.largura / 2 - 0.06), deck.altura + 0.14, z]);
    for (let z = deck.z1 - 1; z > deck.z2 + 1; z -= 4.4) for (const s of [-1, 1]) l.push([s * (deck.largura / 2 - 0.06), deck.altura + 0.14, z]);
    posicionar(montantes.current!, m);
    posicionar(luminarias.current!, l);
  }, [posicoes]);

  const branco = fab.cor("#f4f4f1", 0.6);
  const quiosque = (x: number, z: number, r: number, i: number) => (
    <group key={`${x}${z}`} name={`Ponte_Quiosque_${i}`} position={[x, deck.altura + 0.14, z]}>
      <mesh name={`Ponte_Quiosque_${i}_Corpo`} position-y={0.55} material={fab.cor("#f4f4f1", 0.7)} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.85, r * 0.85, 1.1, 8]} />
      </mesh>
      <mesh name={`Ponte_Quiosque_${i}_Telhado`} position-y={1.35} material={branco} castShadow>
        <coneGeometry args={[r * 1.15, 0.6, 8]} />
      </mesh>
      {/* lanternim verde-sálvia no topo */}
      <mesh name={`Ponte_Quiosque_${i}_Lanternim`} position-y={1.8} material={fab.cor("#9fb8a2", 0.6)}>
        <cylinderGeometry args={[r * 0.28, r * 0.28, 0.35, 8]} />
      </mesh>
    </group>
  );
  return (
    <group name="Ponte_dos_Ingleses" rotation-y={THREE.MathUtils.degToRad(-2)}>
      <instancedMesh name="Ponte_Pilares" ref={pilares} args={[geo.pilar, fab.cor("#3b3d3e", 0.8), posicoes.length]} castShadow />
      <mesh name="Ponte_Deck" geometry={geo.deck} position={[0, deck.altura - 0.14, meio]} material={fab.cor("#e9e7e1", 0.8)} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} name={`Ponte_Corrimao_${s < 0 ? "Oeste" : "Leste"}`} position={[s * (deck.largura / 2 - 0.06), deck.altura + 0.6, meio]} material={branco}>
          <boxGeometry args={[0.07, 0.06, comprimento]} />
        </mesh>
      ))}
      <instancedMesh name="Ponte_Montantes" ref={montantes} args={[undefined, branco, 40]}>
        <primitive object={useMemo(() => new THREE.BoxGeometry(0.06, 0.46, 0.06).translate(0, 0.23, 0), [])} attach="geometry" />
      </instancedMesh>
      <instancedMesh name="Ponte_Luminarias" ref={luminarias} args={[undefined, fab.cor("#2f3337", 0.5), 10]} castShadow>
        <primitive object={useMemo(() => mergeGeometries([new THREE.CylinderGeometry(0.035, 0.035, 1.4, 5).translate(0, 0.7, 0), new THREE.SphereGeometry(0.11, 8, 6).translate(0, 1.45, 0)]), [])} attach="geometry" />
      </instancedMesh>
      {quiosque(-2.2, 2.4, 0.9, 1)}
      {quiosque(2.2, 2.4, 0.9, 2)}
      {quiosque(0, -3.5, 0.9, 3)}
      {quiosque(0, -11, 0.9, 4)}
      {/* pavilhão de quatro águas no meio do deck */}
      <group name="Ponte_Pavilhao" position={[0, deck.altura + 0.14, -7.2]}>
        <mesh name="Ponte_Pavilhao_Corpo" geometry={geo.pavilhao} material={fab.cor("#f4f4f1", 0.7)} castShadow receiveShadow />
        <mesh name="Ponte_Pavilhao_Telhado" geometry={geo.quatroAguas} position-y={1.55} rotation-y={Math.PI / 4} scale={[1.75, 1, 2.8]} material={branco} castShadow />
      </group>
      {/* torre de observação na ponta do deck */}
      <group name="Ponte_Torre_Observacao" position={[0, deck.altura + 0.14, -16.5]}>
        <mesh name="Ponte_Torre_Corpo" geometry={geo.torre} material={branco} castShadow receiveShadow />
        <mesh name="Ponte_Torre_Mirante" geometry={geo.torreTopo} position-y={3.4} material={branco} castShadow />
        <mesh name="Ponte_Torre_Janela" position-y={2.6} material={fab.cor("#46525d", 0.4)}>
          <boxGeometry args={[1.14, 0.5, 0.6]} />
        </mesh>
      </group>
    </group>
  );
}

/** Iracema Guardiã, de Zenon Barreto: figura cor de cobre segurando um grande arco com a corda esticada */
function IracemaGuardia({ fab }: { fab: Fabrica }) {
  const cobre = fab.cor("#b8703e", 0.45);
  // pontas e empunhadura do arco (toro de raio 1,9 m, 207° de abertura, girado 0,35 rad e centrado a 3,2 m)
  const noArco = (a: number): [number, number] => [1.9 * Math.cos(a + 0.35), 3.2 + 1.9 * Math.sin(a + 0.35)];
  const geo = useMemo(() => {
    const ponta1 = noArco(0), ponta2 = noArco(Math.PI * 1.15), punho = noArco(Math.PI * 0.575);
    const haste = (a: [number, number], b: [number, number], r: number) => {
      const va = new THREE.Vector3(a[0], a[1], 0), vb = new THREE.Vector3(b[0], b[1], 0);
      const d = vb.clone().sub(va);
      return new THREE.CylinderGeometry(r, r, d.length(), 5).applyMatrix4(new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1)));
    };
    return {
      base: caixaChanfrada(2.4, 0.5, 2.4, 0.08),
      corda: haste(ponta1, ponta2, 0.025),
      braco: haste([-0.25, 3.5], punho, 0.09),
    };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <group name="Iracema_Guardia" position={[14, 0, 3.5]} rotation-y={-0.4}>
      <mesh name="Guardia_Base" geometry={geo.base} position-y={0.02} rotation-y={Math.PI / 4} material={fab.cor("#cfc8b8", 0.9)} castShadow receiveShadow />
      <mesh name="Guardia_Corpo" position-y={2.1} material={cobre} castShadow>
        <capsuleGeometry args={[0.35, 2.6, 4, 10]} />
      </mesh>
      <mesh name="Guardia_Cabeca" position-y={3.9} material={cobre} castShadow>
        <sphereGeometry args={[0.35, 12, 10]} />
      </mesh>
      <mesh name="Guardia_Arco" position={[0, 3.2, 0]} rotation={[0, 0, 0.35]} material={cobre} castShadow>
        <torusGeometry args={[1.9, 0.11, 6, 24, Math.PI * 1.15]} />
      </mesh>
      <mesh name="Guardia_Corda" geometry={geo.corda} material={fab.cor("#e8dccb", 0.6)} />
      <mesh name="Guardia_Braco" geometry={geo.braco} material={cobre} castShadow />
    </group>
  );
}

export function PraiaDeIracema({ fab }: { fab: Fabrica }) {
  const mats = useMateriaisPraia();
  // a costa corre a ~107°: o mar fica a ~17° (NNE)
  const f = useMemo<Faixas>(() => ({ agua: -1, areia: 6, calcadao: 8, avenida: 11, espuma: [-2.2, -5] }), []);
  const coqueiros = useMemo<[number, number][]>(() => [[-14, 7], [-9, 7], [6, 7], [10, 7], [19, 7], [-20, 6.5]], []);
  return (
    <BasePraia rumoMar={17} f={f} cidadeAltos={0.4} corMar="#2d8a84" fab={fab} mats={mats}>
      <PonteDosIngleses fab={fab} />
      <IracemaGuardia fab={fab} />
      <Coqueiros nome="Coqueiros_Calcadao" pontos={coqueiros} fab={fab} mats={mats} />
    </BasePraia>
  );
}

// ——— Praia do Futuro ———

/** Palha da cobertura das barracas: fibras verticais claras e escuras, mais escura na borda do beiral */
function texturaPalha() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#a8875a";
  g.fillRect(0, 0, 64, 64);
  const rnd = aleatorio(77);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = rnd() < 0.5 ? "rgba(255,240,200,0.18)" : "rgba(60,40,15,0.18)";
    g.fillRect(rnd() * 64, 0, 1 + rnd() * 2, 64);
  }
  g.fillStyle = "rgba(50,30,10,0.25)";
  g.fillRect(0, 56, 64, 8);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  return t;
}

const BARRACAS = [-17, 0, 17];

/** Mega-barracas: deck de madeira, cobertura de palha sobre esteios, balcão, mesas e piscina, todas instanciadas */
function Barracas({ fab }: { fab: Fabrica }) {
  const geo = useMemo(() => {
    const cobertura = new THREE.ConeGeometry(1, 1.4, 4, 1).toNonIndexed();
    cobertura.computeVertexNormals();
    return {
      deck: caixaChanfrada(9, 0.3, 6.5, 0.06),
      esteio: caixaChanfrada(0.22, 2.4, 0.22, 0.04),
      cobertura,
      balcao: caixaChanfrada(3.2, 0.9, 0.7, 0.06),
      borda: caixaChanfrada(3, 0.1, 1.7, 0.04),
      mesa: mergeGeometries([new THREE.CylinderGeometry(0.32, 0.32, 0.05, 10).translate(0, 0.62, 0), new THREE.CylinderGeometry(0.04, 0.04, 0.6, 5).translate(0, 0.3, 0)]),
    };
  }, []);
  const palha = useMemo(() => Object.assign(new THREE.MeshStandardMaterial({ map: texturaPalha(), roughness: 1 }), { name: "Mat_Palha_Barraca" }), []);
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      palha.map?.dispose();
      palha.dispose();
    },
    [geo, palha],
  );
  const refs = {
    deck: useRef<THREE.InstancedMesh>(null),
    esteio: useRef<THREE.InstancedMesh>(null),
    cobertura: useRef<THREE.InstancedMesh>(null),
    balcao: useRef<THREE.InstancedMesh>(null),
    borda: useRef<THREE.InstancedMesh>(null),
    agua: useRef<THREE.InstancedMesh>(null),
    mesa: useRef<THREE.InstancedMesh>(null),
  };
  useLayoutEffect(() => {
    const z = 6;
    posicionar(refs.deck.current!, BARRACAS.map((x): [number, number, number] => [x, 0.05, z]));
    posicionar(refs.esteio.current!, BARRACAS.flatMap((x) => [-3.6, 0, 3.6].flatMap((px) => [-2.2, 2.2].map((pz): [number, number, number] => [x + px, 0.35, z + pz + 0.6]))));
    const o = new THREE.Object3D();
    BARRACAS.forEach((x, i) => {
      o.position.set(x, 3.35, z + 0.6);
      o.rotation.set(0, Math.PI / 4, 0);
      o.scale.set(5.6, 1, 3.8);
      o.updateMatrix();
      refs.cobertura.current!.setMatrixAt(i, o.matrix);
    });
    refs.cobertura.current!.instanceMatrix.needsUpdate = true;
    refs.cobertura.current!.computeBoundingSphere();
    posicionar(refs.balcao.current!, BARRACAS.map((x): [number, number, number] => [x + 1.5, 0.35, z + 2.4]));
    posicionar(refs.borda.current!, BARRACAS.map((x): [number, number, number] => [x - 1.8, 0.35, z - 2.35]));
    posicionar(refs.agua.current!, BARRACAS.map((x): [number, number, number] => [x - 1.8, 0.46, z - 2.35]));
    const mesas: [number, number, number][] = [];
    for (const x of BARRACAS) for (const [dx, dz] of [[-3, 0.2], [-1.6, 0.6], [0, 0], [1.6, 0.4], [3, 0], [-2.2, 1.8], [-0.6, 2], [3.6, 1.4]]) mesas.push([x + dx, 0.35, z + dz]);
    posicionar(refs.mesa.current!, mesas);
  }, []);
  const n = BARRACAS.length;
  return (
    <group name="Barracas">
      <instancedMesh name="Barracas_Decks" ref={refs.deck} args={[geo.deck, fab.cor("#b88a62", 0.8), n]} castShadow receiveShadow />
      <instancedMesh name="Barracas_Esteios" ref={refs.esteio} args={[geo.esteio, fab.cor("#7a5a3e", 0.8), n * 6]} castShadow />
      <instancedMesh name="Barracas_Coberturas_Palha" ref={refs.cobertura} args={[geo.cobertura, palha, n]} castShadow receiveShadow />
      <instancedMesh name="Barracas_Balcoes" ref={refs.balcao} args={[geo.balcao, fab.cor("#6b4a32", 0.75), n]} castShadow receiveShadow />
      <instancedMesh name="Barracas_Piscinas_Borda" ref={refs.borda} args={[geo.borda, fab.cor("#f1efe8", 0.7), n]} receiveShadow />
      <instancedMesh name="Barracas_Piscinas_Agua" ref={refs.agua} args={[undefined, fab.agua(), n]}>
        <boxGeometry args={[2.7, 0.01, 1.45]} />
      </instancedMesh>
      <instancedMesh name="Barracas_Mesas" ref={refs.mesa} args={[geo.mesa, fab.cor("#efe9dc", 0.7), n * 8]} castShadow />
    </group>
  );
}

function GuardaSois({ fab }: { fab: Fabrica }) {
  const pontos = useMemo(() => {
    const rnd = aleatorio(5);
    const p: [number, number, number][] = [];
    // fileiras soltas na areia, com jitter em x e z para não parecer grade
    for (let x = -24; x <= 24; x += 2.2) for (let z = -3; z <= 1.6; z += 2.1) if (Math.hypot(x, z) < R - 3 && rnd() < 0.7) p.push([x + (rnd() - 0.5) * 0.9, z + (rnd() - 0.5) * 0.7, Math.floor(rnd() * 4)]);
    return p;
  }, []);
  const hastes = useRef<THREE.InstancedMesh>(null);
  const lonas = useRef<THREE.InstancedMesh>(null);
  const lonaMat = useMemo(() => Object.assign(new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }), { name: "Mat_Lona_Guarda_Sol" }), []);
  useEffect(() => () => lonaMat.dispose(), [lonaMat]);
  useLayoutEffect(() => {
    const tons = ["#ffffff", "#ff8b22", "#ffb719", "#e94b3c"];
    posicionar(hastes.current!, pontos.map(([x, z]): [number, number, number] => [x, 0.6, z]));
    posicionar(lonas.current!, pontos.map(([x, z], i): [number, number, number, number, number] => [x, 1.25, z, 1, i * 0.7]), pontos.map(([, , c]) => tons[c]));
  }, [pontos]);
  return (
    <>
      <instancedMesh name="Guarda_Sois_Hastes" ref={hastes} args={[undefined, fab.cor("#8a8a8a"), pontos.length]}>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 4]} />
      </instancedMesh>
      <instancedMesh name="Guarda_Sois_Lonas" ref={lonas} args={[undefined, lonaMat, pontos.length]} castShadow>
        <coneGeometry args={[0.75, 0.32, 8, 1, true]} />
      </instancedMesh>
    </>
  );
}

export function PraiaDoFuturo({ fab }: { fab: Fabrica }) {
  const mats = useMateriaisPraia();
  // a costa corre a ~155°: o mar fica a ~65° (ENE); areia larga e várias linhas de arrebentação
  const f = useMemo<Faixas>(() => ({ agua: -5, areia: 12, calcadao: 13.5, avenida: 16.5, espuma: [-6.2, -9, -12.5] }), []);
  const coqueiros = useMemo(() => {
    const p: [number, number][] = [];
    for (const bx of BARRACAS) for (const [dx, dz] of [[-4.8, 9.6], [-2, 10], [1.4, 9.8], [4.6, 9.4], [-5.2, 4], [5.2, 4.6], [-5, 7], [5.4, 7.4]]) p.push([bx + dx, dz]);
    return p;
  }, []);
  return (
    <BasePraia rumoMar={65} f={f} cidadeAltos={0.15} corMar="#2fa9a0" fab={fab} mats={mats}>
      <Barracas fab={fab} />
      <Coqueiros nome="Coqueiros_Barracas" pontos={coqueiros} fab={fab} mats={mats} />
      <GuardaSois fab={fab} />
    </BasePraia>
  );
}
