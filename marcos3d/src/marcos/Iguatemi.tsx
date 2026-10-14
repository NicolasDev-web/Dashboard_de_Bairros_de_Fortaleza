import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Fabrica } from "../Cena";
import { aleatorio, caixaChanfrada, placaDePlanta, posicionar, prismaDePlanta, texturaManchada } from "../util/geometria";

/**
 * Shopping Iguatemi Bosque em miniatura. O contorno sai da planta do OpenStreetMap
 * (pesquisa/marcos/iguatemi/planta-osm.png, norte para cima, 200 m = 285 px): cada ponto está em
 * pixels dessa imagem e vira metros com `K`, que encolhe os ~500 m reais do prédio para ~54 m. As
 * alturas também encolhem, mas menos, para os volumes lerem de longe. Metros, norte em −z, leste em +x.
 */
type Px = [number, number];

const CENTRO: Px = [470, 610];
const K = 0.0745;
const emM = ([x, y]: Px): [number, number] => [(x - CENTRO[0]) * K, (y - CENTRO[1]) * K];

// massa principal das galerias (dois pisos de lojas)
const MASSA: Px[] = [
  [182, 425], [368, 292], [500, 400], [478, 432], [520, 412], [632, 490], [770, 645], [700, 725], [640, 690],
  [600, 765], [650, 800], [710, 885], [680, 922], [540, 890], [460, 855], [420, 790], [370, 700], [330, 650],
  [260, 655], [200, 620], [168, 545], [205, 462],
];
const ALTURA_MASSA = 3.2;

/** Blocos mais altos levantados pela prefeitura no OSM; `h` já é a altura da miniatura */
const BLOCOS: { pts: Px[]; h: number; cor: string }[] = [
  // espinha central das galerias, onde ficam a claraboia em lente e as pirâmides
  { pts: [[380, 410], [400, 395], [645, 640], [625, 662]], h: 4.6, cor: "#e9ebea" },
  { pts: [[408, 572], [450, 518], [530, 580], [490, 638]], h: 6, cor: "#e3e5e4" },
  { pts: [[318, 575], [348, 572], [358, 622], [388, 700], [438, 788], [425, 812], [372, 728], [340, 740]], h: 6.4, cor: "#d8cbb4" },
  { pts: [[450, 830], [488, 778], [550, 828], [510, 882]], h: 6.8, cor: "#e1e3e2" },
  { pts: [[568, 808], [605, 778], [690, 850], [702, 880], [672, 918], [552, 872]], h: 8.2, cor: "#e6e8e7" },
];

// edifício-garagem de 4 níveis no lado sudeste
const GARAGEM: Px[] = [[600, 765], [655, 695], [715, 740], [718, 830], [700, 848], [650, 800]];

// bolsões de estacionamento de superfície a nordeste e a leste
const ESTACIONAMENTOS: Px[][] = [
  [[405, 290], [470, 272], [560, 320], [700, 450], [790, 575], [770, 620], [655, 525], [650, 470], [535, 380]],
  [[765, 735], [818, 620], [870, 622], [862, 775], [800, 792]],
];
const PRACA: Px[] = [[150, 640], [330, 660], [430, 820], [450, 900], [300, 880], [170, 760]];
// trecho da fachada sul (Av. Washington Soares) onde ficam a entrada principal e o letreiro
const FACHADA_SUL: [Px, Px] = [[540, 890], [680, 922]];

function dentro([x, y]: [number, number], p: [number, number][]) {
  let d = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/** Fachada das galerias: painéis claros com juntas a cada 2 m, a linha da laje e a sombra da platibanda (módulo 2 × 3,2 m) */
function texturaFachada() {
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 128;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = "rgba(0,0,0,.07)";
  g.fillRect(0, 0, 2, 128); // junta vertical dos painéis
  g.fillStyle = "rgba(0,0,0,.16)";
  g.fillRect(0, 10, 64, 4); // sombra sob a platibanda
  g.fillStyle = "rgba(0,0,0,.1)";
  g.fillRect(0, 62, 64, 3); // laje do segundo piso
  g.fillStyle = "rgba(255,255,255,.5)";
  g.fillRect(0, 0, 64, 6); // topo da platibanda, mais claro
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 2, 1 / ALTURA_MASSA);
  t.anisotropy = 4;
  return t;
}

/** Edifício-garagem: concreto com as faixas escuras dos pavimentos abertos (um nível a cada 1,15 m) */
function texturaGaragem() {
  const cv = document.createElement("canvas");
  cv.width = 32;
  cv.height = 32;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#cfcac2";
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = "#4b4a48";
  g.fillRect(0, 9, 32, 15);
  g.fillStyle = "#6a6966";
  g.fillRect(14, 9, 3, 15); // pilar entre os vãos
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 2.4, 1 / 1.15);
  return t;
}

/** Letreiro IGUATEMI: letras grafite sobre a placa clara */
function texturaLetreiro() {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 96;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#f4f4f2";
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = "#4f555d";
  g.font = "700 64px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("IGUATEMI", 256, 52);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Materiais feitos à mão (vidro, metal, texturas, carros e copas), todos nomeados */
function criarMateriais() {
  const m = (nome: string, p: THREE.MeshStandardMaterialParameters) => Object.assign(new THREE.MeshStandardMaterial(p), { name: nome });
  const fachada = texturaFachada();
  const grama = texturaManchada("#8bab5f", 0.07, 11, 64);
  grama.repeat.set(1 / 8, 1 / 8);
  return {
    fachadaBege: m("Mat_Fachada_Galerias_Bege", { map: fachada, color: "#d8cbb4", roughness: 0.88 }),
    fachadaClara: m("Mat_Fachada_Galerias_Clara", { map: fachada, color: "#e6e6e2", roughness: 0.85 }),
    garagem: m("Mat_Fachada_Garagem", { map: texturaGaragem(), roughness: 0.92 }),
    letreiro: m("Mat_Letreiro_Iguatemi", { map: texturaLetreiro(), roughness: 0.5 }),
    praca: m("Mat_Gramado_Praca", { map: grama, roughness: 0.95 }),
    vidroAzul: m("Mat_Vidro_Azul", { color: "#34588f", roughness: 0.1, metalness: 0.25 }),
    vidroVerde: m("Mat_Vidro_Verde", { color: "#5b8a87", roughness: 0.1, metalness: 0.22 }),
    vidroEscuro: m("Mat_Vidro_Escuro", { color: "#27323d", roughness: 0.12, metalness: 0.3 }),
    metal: m("Mat_Metal_Claro", { color: "#c8cdd2", roughness: 0.35, metalness: 0.35 }),
    maquinas: m("Mat_Maquinas_Cobertura", { color: "#b9bcbd", roughness: 0.55, metalness: 0.3 }),
    carro: m("Mat_Pintura_Carro", { roughness: 0.35, metalness: 0.3 }),
    copa: m("Mat_Copa_Arvore", { roughness: 0.9, flatShading: true }),
  };
}
type Materiais = ReturnType<typeof criarMateriais>;

/** Prisma vertical com a forma da planta, da base `y0` até `y0 + h`, com as quinas de cima chanfradas */
function Volume({ nome, pts, h, y0 = 0, topo, lados, chanfro = 0.12 }: { nome: string; pts: Px[]; h: number; y0?: number; topo: THREE.Material; lados: THREE.Material; chanfro?: number }) {
  const geo = useMemo(() => prismaDePlanta(pts.map(emM), h, y0, chanfro), [pts, h, y0, chanfro]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh name={nome} geometry={geo} material={[topo, lados]} castShadow receiveShadow />;
}

function Piso({ nome, pts, material, y = 0.04 }: { nome: string; pts: Px[]; material: THREE.Material; y?: number }) {
  const geo = useMemo(() => placaDePlanta(pts.map(emM), y), [pts, y]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh name={nome} geometry={geo} material={material} receiveShadow />;
}

/** Placa com o letreiro IGUATEMI, alinhada à fachada sul e um palmo à frente dela (antes ficava meio enterrada na parede) */
function Letreiro({ mat, fab }: { mat: Materiais; fab: Fabrica }) {
  const [a, b] = FACHADA_SUL.map(emM);
  const giro = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  // normal da fachada para fora (sul, +z)
  const comp = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n: [number, number] = [-(b[1] - a[1]) / comp, (b[0] - a[0]) / comp];
  const t = 0.42; // posição ao longo da fachada, a oeste do cone de vidro
  const x = a[0] + (b[0] - a[0]) * t + n[0] * 0.32;
  const z = a[1] + (b[1] - a[1]) * t + n[1] * 0.32;
  return (
    <group position={[x, 0, z]} rotation-y={giro}>
      <mesh name="Letreiro_Iguatemi" position-y={2.25} material={[fab.cor("#e9e9e6", 0.6), fab.cor("#e9e9e6", 0.6), fab.cor("#e9e9e6", 0.6), fab.cor("#e9e9e6", 0.6), mat.letreiro, fab.cor("#e9e9e6", 0.6)]} castShadow>
        <boxGeometry args={[7.6, 1.45, 0.3]} />
      </mesh>
    </group>
  );
}

/** Mata do Parque do Cocó colada ao norte e ao leste, árvores da praça e carros nos estacionamentos */
function MataECarros({ mat, fab }: { mat: Materiais; fab: Fabrica }) {
  const { arvores, carros, geoCarro } = useMemo(() => {
    const rnd = aleatorio(19);
    const massa = MASSA.map(emM);
    const estac = ESTACIONAMENTOS.map((e) => e.map(emM));
    const praca = PRACA.map(emM);
    // eixo maior do prédio (NO → SE) e a normal que aponta para o lado da mata (NE)
    const eixo = new THREE.Vector2(0.73, 0.68);
    const nordeste = new THREE.Vector2(0.68, -0.73);
    const tons = ["#2e5e2a", "#3f7a34", "#356b2e", "#4a8a3c", "#2a5427"];
    const itens: [number, number, number, number, number][] = [];
    const cores: string[] = [];
    for (let x = -29; x <= 29; x += 2.4) {
      for (let z = -29; z <= 29; z += 2.4) {
        const px = x + (rnd() - 0.5) * 1.6;
        const pz = z + (rnd() - 0.5) * 1.6;
        const s = 1.2 + rnd() * 0.9;
        const g = rnd() * Math.PI;
        const c = tons[Math.floor(rnd() * tons.length)];
        if (Math.hypot(px, pz) > 31.5 - s) continue;
        if (dentro([px, pz], massa) || estac.some((e) => dentro([px, pz], e))) continue;
        const lado = px * nordeste.x + pz * nordeste.y;
        const ao = px * eixo.x + pz * eixo.y;
        // mata a nordeste do prédio; do outro lado ficam a praça e a avenida
        if (lado < 9 && !(ao > 20 && lado > -6)) continue;
        itens.push([px, s * 0.7, pz, s, g]);
        cores.push(c);
      }
    }
    // árvores esparsas na praça ajardinada da entrada sudoeste, longe das paredes
    for (let i = 0; i < 40 && itens.length < 400; i++) {
      const px = -24 + rnd() * 18, pz = 1 + rnd() * 22, s = 0.8 + rnd() * 0.4;
      if (!dentro([px, pz], praca) || dentro([px, pz], massa) || Math.hypot(px + 14.6, pz + 4) < 9) continue;
      if (itens.some(([x2, , z2]) => Math.hypot(px - x2, pz - z2) < 2.6)) continue;
      itens.push([px, s * 0.7, pz, s, rnd() * Math.PI]);
      cores.push(tons[i % 2 ? 1 : 3]);
    }
    const vagas: [number, number, number, number, number][] = [];
    for (const e of estac) {
      for (let x = -30; x <= 30; x += 1.1) {
        for (let z = -30; z <= 30; z += 2) {
          if (dentro([x, z], e) && rnd() < 0.42) vagas.push([x, 0.06, z, 1, rnd() < 0.5 ? 0 : Math.PI]);
        }
      }
    }
    // carro: carroceria baixa e cabine recuada (as duas caixas numa geometria só)
    const corpo = new THREE.BoxGeometry(0.46, 0.2, 0.92).translate(0, 0.1, 0);
    const cabine = new THREE.BoxGeometry(0.4, 0.16, 0.5).translate(0, 0.28, 0.05);
    const geo = mergeGeometries([corpo, cabine]);
    corpo.dispose();
    cabine.dispose();
    return { arvores: { itens, cores }, carros: vagas, geoCarro: geo };
  }, []);
  useEffect(() => () => geoCarro.dispose(), [geoCarro]);

  const copas = useRef<THREE.InstancedMesh>(null);
  const autos = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = copas.current!;
    posicionar(m, arvores.itens, arvores.cores);
    const o = new THREE.Matrix4(), e = new THREE.Matrix4().makeScale(1, 0.85, 1);
    for (let i = 0; i < m.count; i++) {
      m.getMatrixAt(i, o);
      m.setMatrixAt(i, o.multiply(e));
    }
    m.instanceMatrix.needsUpdate = true;
    posicionar(autos.current!, carros, ["#f4f4f2", "#c9cccf", "#2b2e33", "#9a9ea3", "#3c4f6b", "#7d2a2a"]);
  }, [arvores, carros]);

  return (
    <>
      <instancedMesh name="Arvores_Mata_Coco" ref={copas} args={[undefined, undefined, arvores.itens.length]} material={mat.copa} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
      <instancedMesh name="Carros_Estacionamento" ref={autos} args={[geoCarro, undefined, carros.length]} material={mat.carro} castShadow />
      {ESTACIONAMENTOS.map((e, i) => (
        <Piso key={i} nome={`Estacionamento_${i === 0 ? "Nordeste" : "Leste"}`} pts={e} material={fab.cor("#7d7f80", 0.95)} />
      ))}
    </>
  );
}

/** Máquinas de ar-condicionado e casas de máquinas sobre a laje das galerias (o que dá escala ao telhado) */
function Maquinas({ mat }: { mat: Materiais }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const itens = useMemo(() => {
    const rnd = aleatorio(5);
    const massa = MASSA.map(emM);
    const altos = BLOCOS.map((b) => b.pts.map(emM));
    const lista: [number, number, number, number, number][] = [];
    for (let i = 0; i < 400 && lista.length < 26; i++) {
      const x = -22 + rnd() * 44, z = -26 + rnd() * 50;
      if (!dentro([x, z], massa) || altos.some((p) => dentro([x, z], p))) continue;
      // longe da borda (1,5 m) e das outras máquinas
      if ([[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].some(([dx, dz]) => !dentro([x + dx, z + dz], massa))) continue;
      if (lista.some(([x2, , z2]) => Math.hypot(x - x2, z - z2) < 2.4)) continue;
      // fora da rotunda oeste e da praça das pirâmides
      if (Math.hypot(x - emM([272, 555])[0], z - emM([272, 555])[1]) < 9) continue;
      lista.push([x, ALTURA_MASSA, z, 0.8 + rnd() * 0.5, -THREE.MathUtils.degToRad(43) + (rnd() < 0.5 ? 0 : Math.PI / 2)]);
    }
    // duas ou três casas de máquinas no alto de cada bloco mais alto, longe da borda
    BLOCOS.forEach((b, i) => {
      if (i === 0) return;
      let n = 0;
      for (let t = 0; t < 200 && n < (b.h > 7 ? 3 : 2); t++) {
        const x = -30 + rnd() * 60, z = -30 + rnd() * 60;
        if ([[0, 0], [1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]].some(([dx, dz]) => !dentro([x + dx, z + dz], altos[i]))) continue;
        if (lista.some(([x2, , z2]) => Math.hypot(x - x2, z - z2) < 2.2)) continue;
        lista.push([x, b.h, z, 0.9, -THREE.MathUtils.degToRad(43)]);
        n++;
      }
    });
    return lista;
  }, []);
  const geo = useMemo(() => caixaChanfrada(1.3, 0.55, 0.8, 0.06), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useLayoutEffect(() => posicionar(ref.current!, itens), [itens]);
  return <instancedMesh name="Maquinas_Cobertura" ref={ref} args={[geo, undefined, itens.length]} material={mat.maquinas} castShadow receiveShadow />;
}

/** Sheds em "serra" voltados para a Av. Washington Soares, na frente sul */
function Sheds({ fab }: { fab: Fabrica }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const [a, b] = [emM([452, 836]), emM([548, 878])];
  const n = 7;
  const giro = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      o.position.set(a[0] + (b[0] - a[0]) * t, 4.3, a[1] + (b[1] - a[1]) * t);
      // pirâmide de 4 lados com a aresta para cima
      o.rotation.set(0, giro, 0);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [a, b, giro]);
  return (
    <instancedMesh name="Sheds_Fachada_Sul" ref={ref} args={[undefined, undefined, n]} material={fab.cor("#f1f2f0", 0.7)} castShadow receiveShadow>
      <coneGeometry args={[0.9, 2.2, 4]} />
    </instancedMesh>
  );
}

/** Volume semicircular da ponta oeste: tambor bege com a fita de vidro e a cobertura branca em dois anéis */
function Rotunda({ fab, mat }: { fab: Fabrica; mat: Materiais }) {
  const [sx, sz] = emM([272, 555]);
  const geo = useMemo(() => {
    // perfil (raio, altura): tambor com a quina de cima chanfrada
    // perfis sem ponto no eixo (r = 0 gera triângulos degenerados): o topo é um disco à parte
    const tambor = new THREE.LatheGeometry([[7.6, 0], [7.6, 5.82], [7.48, 5.94]].map(([r, y]) => new THREE.Vector2(r, y)), 48);
    const aba = new THREE.LatheGeometry([[7.6, 5.94], [7.95, 6.0], [7.95, 6.24], [7.7, 6.3], [6.2, 6.3], [5.7, 6.62]].map(([r, y]) => new THREE.Vector2(r, y)), 48);
    const disco = new THREE.CircleGeometry(5.7, 48).rotateX(-Math.PI / 2).translate(0, 6.62, 0);
    const cobertura = mergeGeometries([aba, disco]);
    aba.dispose();
    disco.dispose();
    return { tambor, cobertura };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <group name="Rotunda_Oeste" position={[sx, 0, sz]}>
      <mesh name="Rotunda_Tambor" geometry={geo.tambor} material={fab.cor("#c4b49a", 0.85)} castShadow receiveShadow />
      <mesh name="Rotunda_Fita_Vidro" position-y={4.1} material={mat.vidroEscuro}>
        <cylinderGeometry args={[7.63, 7.63, 0.9, 48, 1, true]} />
      </mesh>
      <mesh name="Rotunda_Cobertura" geometry={geo.cobertura} material={fab.cor("#f3f4f2", 0.6)} castShadow receiveShadow />
    </group>
  );
}

export function Iguatemi({ fab }: { fab: Fabrica }) {
  const mat = useMemo(criarMateriais, []);
  useEffect(
    () => () => {
      for (const m of Object.values(mat)) {
        m.map?.dispose();
        m.dispose();
      }
    },
    [mat],
  );
  const telhado = fab.cor("#e9ebea", 0.85);
  const [lx, lz] = emM([505, 520]);
  const [cx, cz] = emM([640, 455]);
  const [mx, mz] = emM([330, 720]);
  const [ex, ez] = emM([615, 905]);
  const [dx, dz] = emM([525, 720]);
  // o eixo maior do conjunto corre a ~133° do norte (NO → SE)
  const eixo = -THREE.MathUtils.degToRad(133 - 90);

  return (
    <group name="Iguatemi">
      {/* praça ajardinada da entrada sudoeste */}
      <Volume nome="Praca_Entrada_Sudoeste" pts={PRACA} h={0.1} topo={mat.praca} lados={fab.cor("#6f8a4c", 0.95)} chanfro={0.03} />
      <MataECarros mat={mat} fab={fab} />

      <Volume nome="Galerias_Massa" pts={MASSA} h={ALTURA_MASSA} topo={telhado} lados={mat.fachadaBege} />
      {BLOCOS.map((b, i) => (
        <Volume key={i} nome={`Galerias_Bloco_${i + 1}`} pts={b.pts} h={b.h} topo={fab.cor(b.cor, 0.85)} lados={i === 2 ? mat.fachadaBege : mat.fachadaClara} chanfro={0.15} />
      ))}
      <Volume nome="Edificio_Garagem" pts={GARAGEM} h={4.6} topo={fab.cor("#a9a7a2", 0.95)} lados={mat.garagem} />
      <Maquinas mat={mat} />
      <Rotunda fab={fab} mat={mat} />

      {/* claraboia em lente sobre a espinha central, num aro de metal */}
      <group position={[lx, 4.6, lz]} rotation-y={eixo}>
        <mesh name="Claraboia_Lente" scale={[5.2, 0.9, 2.2]} material={mat.vidroVerde} castShadow>
          <sphereGeometry args={[1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh name="Claraboia_Aro" scale={[5.35, 1, 2.35]} position-y={0.06} material={mat.metal} castShadow>
          <cylinderGeometry args={[1, 1, 0.12, 28]} />
        </mesh>
      </group>

      {/* pirâmides de vidro azul sobre bases de metal, e a cúpula facetada */}
      {([[565, 655, 1.7], [598, 695, 1.4], [540, 610, 1.2]] as [number, number, number][]).map(([px, py, r]) => {
        const [x, z] = emM([px, py]);
        return (
          <group key={px} position={[x, 4.6, z]} rotation-y={Math.PI / 4 + eixo}>
            <mesh name={`Piramide_Vidro_${px}`} position-y={0.18 + r * 0.6} material={mat.vidroAzul} castShadow>
              <coneGeometry args={[r * 1.4, r * 1.2, 4]} />
            </mesh>
            <mesh name={`Piramide_Base_${px}`} position-y={0.09} material={mat.metal} castShadow>
              <cylinderGeometry args={[r * 1.48, r * 1.48, 0.18, 4]} />
            </mesh>
          </group>
        );
      })}
      <mesh name="Cupula_Facetada" position={[dx, 3.2, dz]} material={mat.vidroAzul} castShadow>
        <sphereGeometry args={[1.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      <Sheds fab={fab} />

      {/* marquise triangular pontuda em balanço na entrada sudoeste, num pilar de aço */}
      <group position={[mx, 4.4, mz]} rotation-y={THREE.MathUtils.degToRad(35)}>
        <mesh name="Marquise_Triangular" material={fab.cor("#f3f4f2", 0.6)} castShadow receiveShadow>
          <cylinderGeometry args={[4.6, 4.6, 0.25, 3]} />
        </mesh>
        <mesh name="Marquise_Pilar" position={[-1.4, -2.2, 0]} material={mat.metal} castShadow>
          <cylinderGeometry args={[0.18, 0.22, 4.4, 10]} />
        </mesh>
      </group>

      {/* cone de vidro e letreiro da entrada principal, de frente para a Washington Soares */}
      <mesh name="Cone_Vidro_Entrada" position={[ex, 3.9, ez - 0.6]} material={mat.vidroVerde} castShadow>
        <coneGeometry args={[1.1, 2.6, 16]} />
      </mesh>
      <Letreiro mat={mat} fab={fab} />

      {/* torre cilíndrica (caixa d'água e exaustão) no lado norte, com o anel do topo */}
      <mesh name="Torre_Caixa_Dagua" position={[cx, 4.5, cz]} material={fab.cor("#d5d0c6", 0.8)} castShadow receiveShadow>
        <cylinderGeometry args={[0.7, 0.7, 9, 16]} />
      </mesh>
      <mesh name="Torre_Caixa_Dagua_Topo" position={[cx, 9.06, cz]} material={mat.metal} castShadow>
        <cylinderGeometry args={[0.82, 0.82, 0.14, 16]} />
      </mesh>
    </group>
  );
}
