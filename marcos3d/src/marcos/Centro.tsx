import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../Cena";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { aleatorio, caixaChanfrada, posicionar, texturaJanelas } from "../util/geometria";

/**
 * Centro de Fortaleza em miniatura: a Catedral Metropolitana, a Praça do Ferreira com a Coluna da
 * Hora e o Cine São Luiz, e o Mercado Central, mais perto uns dos outros do que na realidade
 * (pesquisa/marcos/centro/ficha.md). Tudo é montado num referencial alinhado à malha do Centro,
 * girada ~18°: x corre a 108° (para lés-sudeste) e −z a 18° (para o norte-nordeste). Metros.
 */
const GIRO_MALHA = -THREE.MathUtils.degToRad(18);

/** Concreto aparente da Catedral (cinza-pardo, sem pintura) */
const COR_CONCRETO = "#9a9890";
const COR_CONCRETO_SOMBRA = "#7d7c75";
/** Altura do meio-fio das quadras: os prédios assentam em cima dele */
const MEIO_FIO = 0.12;

// ——— Peças de geometria ———

/**
 * Telhado de duas águas: prisma triangular com a cumeeira ao longo de x, base em y = 0. Facetado
 * (normais por face), para as duas águas pegarem luz diferente em vez de parecerem um tubo.
 */
function prismaTelhado(largura: number, altura: number, comprimento: number) {
  const s = new THREE.Shape([new THREE.Vector2(-largura / 2, 0), new THREE.Vector2(largura / 2, 0), new THREE.Vector2(0, altura)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: comprimento, bevelEnabled: false });
  g.translate(0, 0, -comprimento / 2);
  g.rotateY(Math.PI / 2); // a extrusão (z) passa a correr em x
  g.computeVertexNormals();
  return g;
}

/** Arco ogival (gótico) de largura w e altura total h, base em y = 0, no plano xy */
function formaOgiva(w: number, h: number) {
  const r = w; // arco quebrado equilátero: cada lado é um arco de raio = vão
  const subida = r * Math.sin(Math.PI / 3);
  const hs = Math.max(0.01, h - subida);
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, hs);
  s.absarc(-w / 2, hs, r, 0, Math.PI / 3, false);
  s.absarc(w / 2, hs, r, (2 * Math.PI) / 3, Math.PI, false);
  s.lineTo(-w / 2, 0);
  return s;
}

/** Cone facetado (normais por face): as agulhas de oito faces da Catedral */
function coneFacetado(raio: number, altura: number, lados: number) {
  const g = new THREE.ConeGeometry(raio, altura, lados, 1).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

// ——— Texturas (4 no total: lancetas, janelas, piso e letreiro) ———

/**
 * Vão de nave da Catedral (2 m × 6 m): concreto manchado, lanceta ogival de vitral escuro com
 * moldura clara e um friso horizontal na altura das impostas. UV em metros, repeat = 1 / módulo.
 */
function texturaLancetas() {
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 192;
  const g = cv.getContext("2d")!;
  g.fillStyle = COR_CONCRETO;
  g.fillRect(0, 0, 64, 192);
  const rnd = aleatorio(7);
  for (let i = 0; i < 90; i++) {
    const v = (rnd() - 0.5) * 0.12;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    g.fillRect(rnd() * 64, rnd() * 192, 2 + rnd() * 10, 2 + rnd() * 14);
  }
  // escorrido mais escuro na base (umidade do concreto)
  const grad = g.createLinearGradient(0, 150, 0, 192);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.16)");
  g.fillStyle = grad;
  g.fillRect(0, 150, 64, 42);
  // friso das impostas
  g.fillStyle = "rgba(255,255,255,0.18)";
  g.fillRect(0, 150, 64, 4);
  // lanceta: moldura e vidro
  const ogiva = (x0: number, x1: number, topo: number, base: number) => {
    const w = x1 - x0, r = w, hs = topo + r * Math.sin(Math.PI / 3);
    g.beginPath();
    g.moveTo(x0, base);
    g.lineTo(x0, hs);
    g.arc(x1, hs, r, Math.PI, Math.PI + Math.PI / 3);
    g.arc(x0, hs, r, -Math.PI / 3, 0);
    g.lineTo(x1, base);
    g.closePath();
    g.fill();
  };
  g.fillStyle = "#c4c1b8";
  ogiva(19, 45, 26, 146);
  g.fillStyle = "#2f3f5c";
  ogiva(23, 41, 32, 142);
  // montante e reflexo do vitral
  g.fillStyle = "rgba(160,190,220,0.22)";
  g.fillRect(23, 60, 18, 18);
  g.fillStyle = "#8f8c84";
  g.fillRect(31, 46, 2, 96);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 2, 1 / 6);
  t.offset.set(0.5, 0); // lancetas nos metros pares, longe das quinas
  t.anisotropy = 4;
  return t;
}

/** Piso de pedra portuguesa clara com as faixas cinza diagonais */
function texturaPiso() {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#e6e1d6";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#8e8b84";
  g.lineWidth = 6;
  for (let i = -128; i < 256; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 128, 128);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 6);
  return t;
}

/** Letreiro cursivo do cinema na marquise */
function texturaLetreiro() {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#f2f2ee";
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#a3262a";
  g.font = "italic 700 42px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("São Luiz", 128, 34);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Materiais com textura do Centro, criados uma vez e descartados juntos */
function useMateriais() {
  const m = useMemo(() => {
    const lanceta = texturaLancetas();
    // janelas dos quarteirões: um andar a cada 1 m, uma janela a cada 1,2 m; a parede branca é tingida pela cor do prédio
    const janelas = texturaJanelas({ parede: "#ffffff", janela: "#4a5566", moldura: "#d9d6cf", larguraJanela: 0.55, alturaJanela: 0.5, tamanho: 64 });
    janelas.repeat.set(1 / 1.2, 1);
    const mat = (nome: string, p: THREE.MeshStandardMaterialParameters) => Object.assign(new THREE.MeshStandardMaterial(p), { name: nome });
    return {
      lancetas: mat("Mat_Catedral_Lancetas", { map: lanceta, roughness: 0.92 }),
      fachadas: mat("Mat_Quarteiroes_Fachadas", { map: janelas, roughness: 0.88, vertexColors: true }),
      coberturas: mat("Mat_Quarteiroes_Coberturas", { roughness: 0.95, vertexColors: true }),
      cine: mat("Mat_Cine_Fachada", { map: janelas, color: "#e3d8c2", roughness: 0.85 }),
      mercado: mat("Mat_Mercado_Fachada", { map: janelas, color: "#d5cdbf", roughness: 0.85 }),
      telhaAzul: mat("Mat_Mercado_Telha_Metalica", { color: "#2346ad", roughness: 0.42, metalness: 0.45 }),
      piso: mat("Mat_Praca_Pedra_Portuguesa", { map: texturaPiso(), roughness: 0.95 }),
      letreiro: mat("Mat_Cine_Letreiro", { map: texturaLetreiro(), roughness: 0.6 }),
    };
  }, []);
  useEffect(
    () => () => {
      const texturas = new Set<THREE.Texture>();
      for (const x of Object.values(m)) {
        if (x.map) texturas.add(x.map);
        x.dispose();
      }
      texturas.forEach((t) => t.dispose());
    },
    [m],
  );
  return m;
}
type Materiais = ReturnType<typeof useMateriais>;

// ——— Catedral Metropolitana ———

/** Uma torre da fachada: dois estágios com cornijas, sineira com lancetas, pináculos, agulha e cruz */
function TorreCatedral({ fab, z }: { fab: Fabrica; z: number }) {
  const geo = useMemo(
    () => ({
      base: caixaChanfrada(2.4, 7, 2.4, 0.1),
      sineira: caixaChanfrada(2.1, 4.2, 2.1, 0.08),
      cornija: caixaChanfrada(2.6, 0.3, 2.6, 0.06),
      cornijaAlta: caixaChanfrada(2.4, 0.3, 2.4, 0.06),
      agulha: coneFacetado(1.3, 7, 8),
      pinaculo: coneFacetado(0.22, 1.3, 4),
      vao: new THREE.ShapeGeometry(formaOgiva(0.5, 2)),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const concreto = fab.cor(COR_CONCRETO, 0.9);
  const sombra = fab.cor(COR_CONCRETO_SOMBRA, 0.85);
  const escuro = fab.cor("#262a30", 0.7);
  const pinaculos = useRef<THREE.InstancedMesh>(null);
  const vaos = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    posicionar(pinaculos.current!, [[-0.95, 11.9, -0.95], [0.95, 11.9, -0.95], [-0.95, 11.9, 0.95], [0.95, 11.9, 0.95]]);
    // dois vãos ogivais da sineira em cada face (as quatro faces, girando em y)
    const o = new THREE.Object3D();
    let k = 0;
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2;
      for (const s of [-0.42, 0.42]) {
        o.position.set(Math.sin(a) * 1.07 + Math.cos(a) * s, 8.3, Math.cos(a) * 1.07 - Math.sin(a) * s);
        o.rotation.set(0, a, 0);
        o.updateMatrix();
        vaos.current!.setMatrixAt(k++, o.matrix);
      }
    }
    vaos.current!.instanceMatrix.needsUpdate = true;
    vaos.current!.computeBoundingSphere();
  }, []);
  const nome = z < 0 ? "Norte" : "Sul";
  return (
    <group position={[-5.9, 0, z]}>
      <mesh name={`Torre_${nome}_Base`} geometry={geo.base} material={concreto} castShadow receiveShadow />
      <mesh name={`Torre_${nome}_Cornija_Media`} geometry={geo.cornija} position-y={6.85} material={sombra} castShadow receiveShadow />
      <mesh name={`Torre_${nome}_Sineira`} geometry={geo.sineira} position-y={7.1} material={concreto} castShadow receiveShadow />
      <mesh name={`Torre_${nome}_Cornija_Alta`} geometry={geo.cornijaAlta} position-y={11.2} material={sombra} castShadow receiveShadow />
      <instancedMesh name={`Torre_${nome}_Vaos_Sineira`} ref={vaos} args={[geo.vao, escuro, 8]} />
      <instancedMesh name={`Torre_${nome}_Pinaculos`} ref={pinaculos} args={[geo.pinaculo, sombra, 4]} castShadow />
      <mesh name={`Torre_${nome}_Agulha`} geometry={geo.agulha} position-y={11.5 + 3.5} material={sombra} castShadow />
      <group name={`Torre_${nome}_Cruz`} position-y={18.72}>
        <mesh name={`Torre_${nome}_Cruz_Haste`} material={escuro}>
          <boxGeometry args={[0.08, 0.7, 0.08]} />
        </mesh>
        <mesh name={`Torre_${nome}_Cruz_Braco`} position-y={0.12} material={escuro}>
          <boxGeometry args={[0.08, 0.08, 0.38]} />
        </mesh>
      </group>
    </group>
  );
}

/** Catedral Metropolitana: nave a 105° (≈ x da malha), fachada a oeste com as duas agulhas */
function Catedral({ fab, mats }: { fab: Fabrica; mats: Materiais }) {
  const nave = { comprimento: 14, largura: 5.6, altura: 6 };
  const xFachada = -nave.comprimento / 2;
  const xCruzeiro = xFachada + nave.comprimento * 0.66;
  // frente do frontispício (saliente 0,75 m além das torres) e frente das torres
  const X_FRENTE = -7.85;
  const X_TORRE = -7.1;
  const geo = useMemo(
    () => ({
      nave: caixaChanfrada(nave.comprimento, nave.altura, nave.largura, 0.12),
      transepto: caixaChanfrada(5.2, nave.altura, 11.5, 0.12),
      frontispicio: caixaChanfrada(1.1, 7.4, 2, 0.1),
      telhadoNave: prismaTelhado(nave.largura + 0.5, 2.6, nave.comprimento + 0.2),
      telhadoTransepto: prismaTelhado(5.7, 2.6, 11.9),
      frontao: prismaTelhado(2.2, 1.6, 1.1),
      // contraforte em dois estágios: o de baixo mais fundo, o de cima recuado até a cornija
      contraforte: mergeGeometries([caixaChanfrada(0.5, 3.4, 1, 0.08), caixaChanfrada(0.42, 2.3, 0.6, 0.06).translate(0, 3.3, 0)]),
      portal: new THREE.ShapeGeometry(formaOgiva(1.3, 2.9)),
      moldura: new THREE.ShapeGeometry(formaOgiva(1.7, 3.3)),
      lanternim: coneFacetado(1.6, 1.6, 8),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const concreto = fab.cor(COR_CONCRETO, 0.9);
  const sombra = fab.cor(COR_CONCRETO_SOMBRA, 0.85);
  const telha = fab.cor("#5f605c", 0.75);
  const vitral = fab.cor("#34507a", 0.25);
  const escuro = fab.cor("#2b2c2e", 0.75);

  // contrafortes entre as lancetas, dos dois lados da nave (fora do cruzeiro) e nas pontas do transepto
  const contrafortes = useRef<THREE.InstancedMesh>(null);
  const portais = useRef<THREE.InstancedMesh>(null);
  const molduras = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const itens: [number, number, number, number?, number?][] = [];
    for (const x of [-3, -1, 5.3]) for (const s of [-1, 1]) itens.push([x, 0, s * (nave.largura / 2 + 0.3)]);
    for (const x of [xCruzeiro - 1, xCruzeiro + 1]) for (const s of [-1, 1]) itens.push([x, 0, s * (5.75 + 0.3)]);
    posicionar(contrafortes.current!, itens);
    // três portais na fachada oeste (o do meio maior), virados para −x
    const giro = -Math.PI / 2;
    posicionar(portais.current!, [[X_FRENTE - 0.03, 0.18, 0, 1, giro], [X_TORRE - 0.03, 0.18, -1.9, 0.72, giro], [X_TORRE - 0.03, 0.18, 1.9, 0.72, giro]]);
    posicionar(molduras.current!, [[X_FRENTE - 0.02, 0.18, 0, 1, giro], [X_TORRE - 0.02, 0.18, -1.9, 0.72, giro], [X_TORRE - 0.02, 0.18, 1.9, 0.72, giro]]);
  }, []);

  return (
    <group name="Catedral_Metropolitana" position={[7, 0, -6]}>
      {/* adro claro na frente da fachada, um degrau acima da rua */}
      <mesh name="Catedral_Adro" position={[xFachada - 2.2, 0, 0]} material={fab.cor("#d9d4c8", 0.9)} receiveShadow>
        <primitive object={useMemo(() => caixaChanfrada(4.4, 0.18, 9, 0.05), [])} attach="geometry" />
      </mesh>
      <mesh name="Nave_Principal" geometry={geo.nave} material={mats.lancetas} castShadow receiveShadow />
      <mesh name="Nave_Telhado" geometry={geo.telhadoNave} position-y={nave.altura} material={telha} castShadow receiveShadow />
      <mesh name="Transepto" geometry={geo.transepto} position-x={xCruzeiro} material={mats.lancetas} castShadow receiveShadow />
      <mesh name="Transepto_Telhado" geometry={geo.telhadoTransepto} position={[xCruzeiro, nave.altura, 0]} rotation-y={Math.PI / 2} material={telha} castShadow receiveShadow />
      <instancedMesh name="Nave_Contrafortes" ref={contrafortes} args={[geo.contraforte, sombra, 12]} castShadow receiveShadow />
      {/* abside semicircular na ponta leste, com o meio cone do telhado */}
      <mesh name="Abside" position={[nave.comprimento / 2, nave.altura / 2, 0]} material={concreto} castShadow receiveShadow>
        <cylinderGeometry args={[2.6, 2.6, nave.altura, 16, 1, false, 0, Math.PI]} />
      </mesh>
      <mesh name="Abside_Telhado" position={[nave.comprimento / 2, nave.altura + 0.9, 0]} material={telha} castShadow>
        <coneGeometry args={[2.85, 1.8, 16, 1, false, 0, Math.PI]} />
      </mesh>
      {/* lanternim octogonal no cruzeiro, com a cúpula baixa e a cruz */}
      <mesh name="Lanternim_Tambor" position={[xCruzeiro, nave.altura + 2.6, 0]} rotation-y={Math.PI / 8} material={concreto} castShadow>
        <cylinderGeometry args={[1.45, 1.5, 2.2, 8]} />
      </mesh>
      <mesh name="Lanternim_Cupula" geometry={geo.lanternim} position={[xCruzeiro, nave.altura + 4.5, 0]} rotation-y={Math.PI / 8} material={sombra} castShadow />
      {/* frontispício entre as torres: corpo saliente, frontão triangular, rosácea e portais ogivais */}
      <mesh name="Fachada_Frontispicio" geometry={geo.frontispicio} position-x={X_FRENTE + 0.55} material={concreto} castShadow receiveShadow />
      <mesh name="Fachada_Frontao" geometry={geo.frontao} position={[X_FRENTE + 0.55, 7.4, 0]} rotation-y={Math.PI / 2} material={concreto} castShadow />
      <mesh name="Fachada_Rosacea_Moldura" position={[X_FRENTE - 0.02, 5.4, 0]} rotation-y={-Math.PI / 2} material={sombra}>
        <torusGeometry args={[0.68, 0.1, 6, 20]} />
      </mesh>
      <mesh name="Fachada_Rosacea_Vitral" position={[X_FRENTE - 0.01, 5.4, 0]} rotation-y={-Math.PI / 2} material={vitral}>
        <circleGeometry args={[0.68, 20]} />
      </mesh>
      <instancedMesh name="Fachada_Portais_Moldura" ref={molduras} args={[geo.moldura, sombra, 3]} />
      <instancedMesh name="Fachada_Portais" ref={portais} args={[geo.portal, escuro, 3]} />
      <TorreCatedral fab={fab} z={-1.9} />
      <TorreCatedral fab={fab} z={1.9} />
    </group>
  );
}

// ——— Praça do Ferreira ———

/** Coluna da Hora: quatro pilares marrons em três estágios, tubos vermelhos e o relógio no topo */
function ColunaDaHora({ fab }: { fab: Fabrica }) {
  const pilar = fab.cor("#5a2f24", 0.8);
  const pilares = useRef<THREE.InstancedMesh>(null);
  const estagios: [largura: number, base: number, altura: number][] = [
    [1.3, 0, 1.6],
    [1.05, 1.6, 1.4],
    [0.8, 3, 1.3],
  ];
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    let k = 0;
    for (const [l, b, h] of estagios)
      for (const a of [-1, 1])
        for (const c of [-1, 1]) {
          o.position.set((a * l) / 2, b + h / 2, (c * l) / 2);
          o.scale.set(1, h, 1);
          o.updateMatrix();
          pilares.current!.setMatrixAt(k++, o.matrix);
        }
    pilares.current!.instanceMatrix.needsUpdate = true;
    pilares.current!.computeBoundingSphere();
  }, []);
  return (
    <group name="Coluna_da_Hora">
      <mesh name="Coluna_Espelho_Base" position-y={0.06} material={fab.cor("#5c6e6a", 0.2)} receiveShadow>
        <primitive object={useMemo(() => caixaChanfrada(2.6, 0.14, 2.6, 0.04), [])} attach="geometry" />
      </mesh>
      <instancedMesh name="Coluna_Pilares" ref={pilares} args={[undefined, pilar, 12]} castShadow>
        <boxGeometry args={[0.2, 1, 0.2]} />
      </instancedMesh>
      <mesh name="Coluna_Tubos_Vermelhos" position-y={2.2} material={fab.cor("#c3312b", 0.6)} castShadow>
        <boxGeometry args={[0.7, 4.2, 0.7]} />
      </mesh>
      <mesh name="Coluna_Caixa_Relogio" position-y={4.3} material={pilar} castShadow>
        <primitive object={useMemo(() => caixaChanfrada(1, 0.9, 1, 0.06), [])} attach="geometry" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} name={`Coluna_Mostrador_${i + 1}`} position={[Math.sin((i * Math.PI) / 2) * 0.51, 4.75, Math.cos((i * Math.PI) / 2) * 0.51]} rotation-y={(i * Math.PI) / 2} material={fab.cor("#f5f5f0", 0.5)}>
          <circleGeometry args={[0.32, 16]} />
        </mesh>
      ))}
    </group>
  );
}

/** Praça do Ferreira (retângulo ao longo da malha), Coluna da Hora, árvores e o Cine São Luiz na borda oeste */
function PracaDoFerreira({ fab, mats }: { fab: Fabrica; mats: Materiais }) {
  const copas = useRef<THREE.InstancedMesh>(null);
  const troncos = useRef<THREE.InstancedMesh>(null);
  const bancos = useRef<THREE.InstancedMesh>(null);
  const arvores: [number, number][] = [[-2.6, -6.5], [2.6, -6.5], [-2.8, -2], [2.8, -2.4], [-2.6, 3], [2.7, 3.4], [-2.4, 7], [2.5, 7.2], [0, 7.4]];
  const geo = useMemo(
    () => ({
      calcada: caixaChanfrada(7.6, 0.16, 16.6, 0.05),
      torre: caixaChanfrada(3.4, 10, 6, 0.12),
      platibanda: caixaChanfrada(3.6, 0.35, 6.2, 0.06),
      aleta: caixaChanfrada(0.18, 8.6, 0.3, 0.04),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  useLayoutEffect(() => {
    // copas em dois tons, um pouco achatadas, sobre troncos finos
    const tons = ["#4e7a36", "#3f6b2e", "#5b8a3f"];
    posicionar(copas.current!, arvores.map(([x, z], i): [number, number, number, number, number] => [x, 2.2, z, 1.1 + (i % 3) * 0.15, i]), arvores.map((_, i) => tons[i % 3]));
    posicionar(troncos.current!, arvores.map(([x, z]): [number, number, number] => [x, 0.16, z]));
    // bancos de concreto em volta da Coluna da Hora
    posicionar(bancos.current!, [[-1.6, 0.16, -4.2], [1.6, 0.16, -4.2], [-1.6, 0.16, 1], [1.6, 0.16, 1], [0, 0.16, 4.8, 1, Math.PI / 2]]);
  }, []);
  return (
    <group name="Praca_do_Ferreira" position={[-8, 0, 9]}>
      <mesh name="Praca_Calcada" geometry={geo.calcada} material={fab.cor("#cbc6bb", 0.9)} receiveShadow />
      <mesh name="Praca_Piso" position-y={0.165} rotation-x={-Math.PI / 2} material={mats.piso} receiveShadow>
        <planeGeometry args={[7, 16]} />
      </mesh>
      <group position={[0, 0.16, -1.6]}>
        <ColunaDaHora fab={fab} />
      </group>
      <instancedMesh name="Praca_Arvores_Copas" ref={copas} args={[undefined, undefined, arvores.length]} material={fab.cor("#ffffff", 0.9)} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
      </instancedMesh>
      <instancedMesh name="Praca_Arvores_Troncos" ref={troncos} args={[undefined, fab.cor("#6e5a45", 0.9), arvores.length]} castShadow>
        <primitive object={useMemo(() => new THREE.CylinderGeometry(0.12, 0.17, 1.6, 6).translate(0, 0.8, 0), [])} attach="geometry" />
      </instancedMesh>
      <instancedMesh name="Praca_Bancos" ref={bancos} args={[undefined, fab.cor("#b9b4aa", 0.9), 5]} castShadow receiveShadow>
        <primitive object={useMemo(() => caixaChanfrada(1.6, 0.4, 0.5, 0.06), [])} attach="geometry" />
      </instancedMesh>
      {/* Cine São Luiz: torre creme art déco na borda oeste, com a marquise virada para a praça */}
      <group name="Cine_Sao_Luiz" position={[-6.3, 0, 1]}>
        <mesh name="Cine_Torre" geometry={geo.torre} material={mats.cine} castShadow receiveShadow />
        <mesh name="Cine_Platibanda" geometry={geo.platibanda} position-y={10} material={fab.cor("#d6c9ae", 0.85)} castShadow />
        {[-1, 1].map((s) => (
          <mesh key={s} name={`Cine_Cilindro_${s < 0 ? "Norte" : "Sul"}`} position={[1.7, 5.2, s * 3]} material={fab.cor("#e3d8c2", 0.85)} castShadow receiveShadow>
            <cylinderGeometry args={[0.6, 0.6, 10.4, 14]} />
          </mesh>
        ))}
        {/* aletas verticais déco na fachada da praça, subindo acima da platibanda */}
        {[-1.6, 0, 1.6].map((z, i) => (
          <mesh key={z} name={`Cine_Aleta_${i + 1}`} geometry={geo.aleta} position={[1.78, 2.5, z]} material={fab.cor("#efe7d6", 0.8)} castShadow />
        ))}
        <mesh name="Cine_Embasamento" position={[1.72, 0.95, 0]} material={fab.cor("#5b3328", 0.8)} receiveShadow>
          <boxGeometry args={[0.15, 1.9, 5.6]} />
        </mesh>
        <mesh name="Cine_Marquise" position={[2.3, 2.1, 0]} material={fab.cor("#f2f2ee", 0.6)} castShadow receiveShadow>
          <primitive object={useMemo(() => caixaChanfrada(1.3, 0.26, 5, 0.05), [])} attach="geometry" />
        </mesh>
        <mesh name="Cine_Letreiro" position={[2.96, 2.62, 0]} rotation-y={Math.PI / 2} material={mats.letreiro}>
          <planeGeometry args={[3.2, 0.8]} />
        </mesh>
      </group>
    </group>
  );
}

// ——— Mercado Central ———

/** Mercado Central: bloco de quatro pavimentos com o grande telhado azul, ao norte da Catedral */
function MercadoCentral({ fab, mats }: { fab: Fabrica; mats: Materiais }) {
  const geo = useMemo(
    () => ({
      corpo: caixaChanfrada(4.6, 5.2, 13, 0.12),
      embasamento: caixaChanfrada(5, 1, 13.4, 0.08),
      // a cumeeira corre ao longo do comprimento do prédio (z local)
      telhado: prismaTelhado(5.4, 1.5, 13.8).rotateY(Math.PI / 2),
      lanternim: caixaChanfrada(1, 0.5, 11, 0.06),
      beiral: caixaChanfrada(5.3, 0.16, 13.7, 0.04),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <group name="Mercado_Central" position={[-6, 0, -16]} rotation-y={-THREE.MathUtils.degToRad(30 - 18)}>
      <mesh name="Mercado_Embasamento" geometry={geo.embasamento} material={fab.cor("#8f6b55", 0.85)} castShadow receiveShadow />
      <mesh name="Mercado_Corpo" geometry={geo.corpo} material={mats.mercado} castShadow receiveShadow />
      <mesh name="Mercado_Beiral" geometry={geo.beiral} position-y={5.2} material={fab.cor("#ece9e2", 0.8)} castShadow receiveShadow />
      <mesh name="Mercado_Telhado" geometry={geo.telhado} position-y={5.34} material={mats.telhaAzul} castShadow receiveShadow />
      <mesh name="Mercado_Lanternim" geometry={geo.lanternim} position-y={6.6} material={mats.telhaAzul} castShadow />
    </group>
  );
}

// ——— Quarteirões ———

interface Lote {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  cor: string;
}

/**
 * Fachadas e coberturas de todos os prédios em duas malhas só (cor por vértice). As paredes têm UV
 * em metros, para a textura de janelas repetir por andar; a cobertura tem a borda chanfrada.
 */
function geometriaQuarteiroes(lotes: Lote[]) {
  const fach = { p: [] as number[], n: [] as number[], uv: [] as number[], c: [] as number[] };
  const cob = { p: [] as number[], n: [] as number[], c: [] as number[] };
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
  const b = 0.12;
  for (const l of lotes) {
    cor.set(l.cor);
    corTopo.copy(cor).multiplyScalar(0.82);
    const x0 = l.x - l.w / 2, x1 = l.x + l.w / 2, z0 = l.z - l.d / 2, z1 = l.z + l.d / 2;
    const y0 = MEIO_FIO, y1 = MEIO_FIO + l.h - b, y2 = MEIO_FIO + l.h;
    const alt = y1 - y0;
    // u centrado: as janelas ficam simétricas na fachada, com sobra de parede igual nas duas quinas
    const faixaU = (c: number): number[][] => {
      const u0 = -(c - Math.floor(c / 1.2) * 1.2) / 2;
      return [[u0, 0], [u0 + c, 0], [u0 + c, alt], [u0, alt]];
    };
    const uW = faixaU(l.w), uD = faixaU(l.d);
    // quatro paredes (sentido anti-horário visto de fora)
    quad(fach, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], cor, uW);
    quad(fach, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], cor, uW);
    quad(fach, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], cor, uD);
    quad(fach, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], cor, uD);
    // chanfro de 45° em volta da cobertura e a laje do topo
    const k = Math.SQRT1_2;
    quad(cob, [[x0, y1, z1], [x1, y1, z1], [x1 - b, y2, z1 - b], [x0 + b, y2, z1 - b]], [0, k, k], cor);
    quad(cob, [[x1, y1, z0], [x0, y1, z0], [x0 + b, y2, z0 + b], [x1 - b, y2, z0 + b]], [0, k, -k], cor);
    quad(cob, [[x1, y1, z1], [x1, y1, z0], [x1 - b, y2, z0 + b], [x1 - b, y2, z1 - b]], [k, k, 0], cor);
    quad(cob, [[x0, y1, z0], [x0, y1, z1], [x0 + b, y2, z1 - b], [x0 + b, y2, z0 + b]], [-k, k, 0], cor);
    quad(cob, [[x0 + b, y2, z1 - b], [x1 - b, y2, z1 - b], [x1 - b, y2, z0 + b], [x0 + b, y2, z0 + b]], [0, 1, 0], corTopo);
  }
  const fachadas = new THREE.BufferGeometry();
  fachadas.setAttribute("position", new THREE.Float32BufferAttribute(fach.p, 3));
  fachadas.setAttribute("normal", new THREE.Float32BufferAttribute(fach.n, 3));
  fachadas.setAttribute("uv", new THREE.Float32BufferAttribute(fach.uv, 2));
  fachadas.setAttribute("color", new THREE.Float32BufferAttribute(fach.c, 3));
  const coberturas = new THREE.BufferGeometry();
  coberturas.setAttribute("position", new THREE.Float32BufferAttribute(cob.p, 3));
  coberturas.setAttribute("normal", new THREE.Float32BufferAttribute(cob.n, 3));
  coberturas.setAttribute("color", new THREE.Float32BufferAttribute(cob.c, 3));
  return { fachadas, coberturas };
}

/** Áreas sem prédios (no referencial da malha): Catedral com o adro, praça com o cine, e o Mercado */
const LIVRES: [x1: number, z1: number, x2: number, z2: number][] = [
  [-4.8, -12.6, 17.4, 0.4],
  [-16.6, 0.4, -3.8, 17.8],
  [-10, -23.4, -2, -8.6],
];

/** Quarteirões do Centro: quadras de 2 × 2 lotes com ruas a cada três passos da malha, calçadas e caixas d'água */
function Quarteiroes({ fab, mats }: { fab: Fabrica; mats: Materiais }) {
  const { lotes, calcadas, caixas, faixas } = useMemo(() => {
    const rnd = aleatorio(18);
    const PASSO = 4.6;
    const cores = ["#bdbab2", "#d8d3c8", "#e6e1d6", "#c8b9a3", "#a9a59c", "#d6c6a4", "#c3c9c6"];
    const lotes: Lote[] = [];
    const calcadas: [number, number, number][] = [];
    const caixas: [number, number, number, number?, number?][] = [];
    for (let i = -6; i <= 6; i++) {
      for (let j = -6; j <= 6; j++) {
        if (i % 3 === 0 || j % 3 === 0) continue; // ruas
        const x = i * PASSO, z = j * PASSO;
        const meio = PASSO / 2;
        if (Math.hypot(Math.abs(x) + meio, Math.abs(z) + meio) > 29.7) continue;
        if (LIVRES.some(([x1, z1, x2, z2]) => x + meio > x1 && x - meio < x2 && z + meio > z1 && z - meio < z2)) continue;
        calcadas.push([x, 0, z]);
        const torre = rnd() < 0.09;
        const w = 3.7 + rnd() * 0.5, d = 3.7 + rnd() * 0.5;
        const h = torre ? 5 + rnd() * 4 : 1.4 + rnd() * 2.4;
        lotes.push({ x, z, w, d, h, cor: cores[Math.floor(rnd() * cores.length)] });
        if (rnd() < 0.45) caixas.push([x + (rnd() - 0.5) * (w - 1.4), MEIO_FIO + h, z + (rnd() - 0.5) * (d - 1.4), 1, rnd() < 0.5 ? 0 : Math.PI / 2]);
      }
    }
    // faixa tracejada no eixo das ruas (a cada três passos da malha), fora da praça, do adro e do Mercado
    const faixas: [number, number, number, number?, number?][] = [];
    for (let k = -2; k <= 2; k++) {
      const e = k * 3 * PASSO;
      for (let t = -29; t <= 29; t += 2.4) {
        for (const [x, z, giro] of [[e, t, 0], [t, e, Math.PI / 2]] as const) {
          if (Math.hypot(x, z) > 29.2 || LIVRES.some(([x1, z1, x2, z2]) => x > x1 - 1 && x < x2 + 1 && z > z1 - 1 && z < z2 + 1)) continue;
          if (Math.abs(((t % (3 * PASSO)) + 3 * PASSO) % (3 * PASSO)) < 2.4 || Math.abs((((t % (3 * PASSO)) + 3 * PASSO) % (3 * PASSO)) - 3 * PASSO) < 2.4) continue; // cruzamentos
          faixas.push([x, 0.04, z, 1, giro]);
        }
      }
    }
    return { lotes, calcadas, caixas, faixas };
  }, []);
  const geo = useMemo(
    () => ({ ...geometriaQuarteiroes(lotes), calcada: caixaChanfrada(4.6, MEIO_FIO, 4.6, 0.04), caixa: caixaChanfrada(0.9, 0.55, 0.7, 0.05) }),
    [lotes],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const refCalcadas = useRef<THREE.InstancedMesh>(null);
  const refCaixas = useRef<THREE.InstancedMesh>(null);
  const refFaixas = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    posicionar(refCalcadas.current!, calcadas);
    posicionar(refCaixas.current!, caixas);
    posicionar(refFaixas.current!, faixas);
  }, [calcadas, caixas, faixas]);
  return (
    <group name="Quarteiroes">
      <mesh name="Ruas_Asfalto" position-y={0.03} rotation-x={-Math.PI / 2} material={fab.cor("#86847f", 0.95)} receiveShadow>
        <circleGeometry args={[30.5, 48]} />
      </mesh>
      <instancedMesh name="Ruas_Faixas_Tracejadas" ref={refFaixas} args={[undefined, fab.cor("#ecebe4", 0.8), faixas.length]} receiveShadow>
        <boxGeometry args={[0.14, 0.02, 1.2]} />
      </instancedMesh>
      <instancedMesh name="Quadras_Calcadas" ref={refCalcadas} args={[geo.calcada, fab.cor("#cfcac0", 0.92), calcadas.length]} receiveShadow />
      <mesh name="Quarteiroes_Fachadas" geometry={geo.fachadas} material={mats.fachadas} castShadow receiveShadow />
      <mesh name="Quarteiroes_Coberturas" geometry={geo.coberturas} material={mats.coberturas} castShadow receiveShadow />
      <instancedMesh name="Quarteiroes_Caixas_Dagua" ref={refCaixas} args={[geo.caixa, fab.cor("#8d918f", 0.8), caixas.length]} castShadow />
    </group>
  );
}

export function Centro({ fab }: { fab: Fabrica }) {
  const mats = useMateriais();
  return (
    <group name="Centro" rotation-y={GIRO_MALHA}>
      <Quarteiroes fab={fab} mats={mats} />
      <Catedral fab={fab} mats={mats} />
      <PracaDoFerreira fab={fab} mats={mats} />
      <MercadoCentral fab={fab} mats={mats} />
    </group>
  );
}
