import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Fabrica } from "../Cena";
import { aleatorio, caixaChanfrada, posicionar, prismaDePlanta, texturaJanelas, texturaManchada } from "../util/geometria";

/**
 * North Shopping Fortaleza em miniatura. O contorno vem do OpenStreetMap
 * (pesquisa/marcos/north-shopping/ficha.md), em metros reais com x = leste e y = norte e a origem no
 * centro do prédio; `K` encolhe para caber na base. A caixa é quase cega: o estacionamento de 6
 * níveis fica dentro dela, e as faixas escuras da fachada são as lajes abertas. Metros, norte em −z.
 */
type Xy = [number, number];

const K = 0.17;
const ALTURA = 8;
const emM = ([x, y]: Xy): Xy => [x * K, -y * K];

const CONTORNO: Xy[] = [[-103, 60], [-105, -7], [-37, 1], [-35, -100], [50, -87], [43, -56], [89, -34], [97, -77], [116, -74], [96, 29], [-84, 92], [-103, 93]];
// trecho principal da fachada sul, para a Av. Bezerra de Menezes
const FACHADA: [Xy, Xy] = [[-35, -100], [50, -87]];

function dentro([x, y]: Xy, p: Xy[]) {
  let d = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/** Bege com as faixas escuras das lajes do estacionamento; a extrusão usa UV em metros (repete a cada 2 m) */
function texturaFachada() {
  const cv = document.createElement("canvas");
  cv.width = 16;
  cv.height = 64;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#d8cdb6";
  g.fillRect(0, 0, 16, 64);
  g.fillStyle = "#5a544c";
  g.fillRect(0, 42, 16, 10);
  g.fillStyle = "rgba(255,255,255,.18)";
  g.fillRect(0, 40, 16, 2); // aresta clara da laje, pega a luz
  g.fillStyle = "rgba(0,0,0,.07)";
  g.fillRect(0, 0, 1, 64); // junta dos painéis
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 3, 1 / 2);
  t.anisotropy = 4;
  return t;
}

/** Logo: as duas bandeirolas (vermelha e verde) sobre "NORTH", a faixa vermelha "SHOPPING" e "FORTALEZA" */
function texturaLogo() {
  const cv = document.createElement("canvas");
  cv.width = 320;
  cv.height = 256;
  const g = cv.getContext("2d")!;
  const bandeira = (x: number, cor: string) => {
    g.fillStyle = cor;
    g.beginPath();
    g.moveTo(x, 70);
    g.lineTo(x + 48, 40);
    g.lineTo(x + 48, 82);
    g.lineTo(x, 112);
    g.closePath();
    g.fill();
  };
  bandeira(112, "#d4342c");
  bandeira(164, "#1f9a5b");
  g.textAlign = "center";
  g.fillStyle = "#1f2e4d";
  g.font = "800 72px system-ui, sans-serif";
  g.fillText("NORTH", 160, 176);
  g.fillStyle = "#d4342c";
  g.fillRect(70, 186, 180, 26);
  g.fillStyle = "#ffffff";
  g.font = "700 22px system-ui, sans-serif";
  g.fillText("SHOPPING", 160, 207);
  g.fillStyle = "#1f2e4d";
  g.font = "600 24px system-ui, sans-serif";
  g.fillText("FORTALEZA", 160, 240);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Cilindro com UV em metros (perímetro × altura), para as faixas da fachada baterem com as da caixa */
function cilindroEmMetros(r: number, h: number, lados: number) {
  const g = new THREE.CylinderGeometry(r, r, h, lados);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * r, uv.getY(i) * h);
  return g;
}

/** Materiais feitos à mão (texturas, vidro, metal, carros), todos nomeados */
function criarMateriais() {
  const m = (nome: string, p: THREE.MeshStandardMaterialParameters) => Object.assign(new THREE.MeshStandardMaterial(p), { name: nome });
  const laje = texturaManchada("#8a949a", 0.05, 3, 64);
  laje.repeat.set(1 / 10, 1 / 10);
  const janelas = texturaJanelas({ parede: "#ece8df", janela: "#3a4757", moldura: "#f6f4ef", colunas: 2, linhas: 1, larguraJanela: 0.62, alturaJanela: 0.5 });
  janelas.repeat.set(1 / 1.6, 1 / 0.9);
  return {
    fachada: m("Mat_Fachada_Faixas_Garagem", { map: texturaFachada(), roughness: 0.88 }),
    logo: m("Mat_Logo_North", { map: texturaLogo(), transparent: true, alphaTest: 0.1, roughness: 0.6 }),
    laje: m("Mat_Laje_Cobertura", { map: laje, roughness: 0.92 }),
    torres: m("Mat_Fachada_Torres_Residenciais", { map: janelas, roughness: 0.85 }),
    vidro: m("Mat_Vidro_Friso", { color: "#5f7f99", roughness: 0.12, metalness: 0.22 }),
    vidroEstacao: m("Mat_Vidro_Estacao_BRT", { color: "#9fc3d8", roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55 }),
    metal: m("Mat_Metal_Estacao_BRT", { color: "#4b8fc7", roughness: 0.4, metalness: 0.35 }),
    maquinas: m("Mat_Maquinas_Cobertura", { color: "#b9bcbd", roughness: 0.55, metalness: 0.3 }),
    carro: m("Mat_Pintura_Carro", { roughness: 0.35, metalness: 0.3 }),
  };
}
type Materiais = ReturnType<typeof criarMateriais>;

/** Escultura de treliça branca do pórtico: barras em ângulo formando um losango irregular */
const BARRAS: [x: number, y: number, comprimento: number, angulo: number][] = [
  [-1.1, 3.2, 4.6, 62],
  [1.2, 3.4, 4.2, -58],
  [0, 5.4, 4.4, 4],
  [-0.4, 1.6, 3.4, -20],
  [1.5, 1.4, 2.6, 75],
  [-1.9, 4.8, 2.2, -70],
];

export function NorthShopping({ fab }: { fab: Fabrica }) {
  const mat = useMemo(criarMateriais, []);
  const geo = useMemo(() => {
    const pts = CONTORNO.map(emM);
    return {
      // caixa com a borda do telhado chanfrada: a quina pega a luz e desenha o contorno
      caixa: prismaDePlanta(pts, ALTURA, 0, 0.18),
      // platibanda: anel baixo por dentro da borda, que esconde as máquinas
      esquina: cilindroEmMetros(2.6, ALTURA, 28),
      torreLogo: caixaChanfrada(3.6, ALTURA + 2.4, 5.4, 0.14),
      torreTopo: caixaChanfrada(3.9, 0.3, 5.7, 0.08),
      marquise: caixaChanfrada(5, 0.18, 1.6, 0.05),
      painelPortico: caixaChanfrada(6.2, 6.2, 0.12, 0.03),
      barra: caixaChanfrada(1, 0.22, 0.22, 0.04),
    };
  }, []);
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      for (const m of Object.values(mat)) {
        m.map?.dispose();
        m.dispose();
      }
    },
    [geo, mat],
  );

  // fachada principal: meio, comprimento e giro para ficar virada para fora (sul)
  const [a, b] = FACHADA.map(emM);
  const meio: Xy = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const comprimento = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const giro = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  const [qx, qz] = emM([-35, -100]);
  const [tx, tz] = emM([104, -56]);

  return (
    <group name="North_Shopping">
      <mesh name="Caixa_Shopping" geometry={geo.caixa} material={[mat.laje, mat.fachada]} castShadow receiveShadow />
      <Cobertura mat={mat} />

      {/* esquina oeste arredondada, com as mesmas faixas (UV em metros, como a caixa) */}
      <mesh name="Esquina_Oeste_Cilindro" geometry={geo.esquina} position={[qx + 1.2, ALTURA / 2, qz - 1.2]} material={[mat.fachada, mat.laje, mat.laje]} castShadow receiveShadow />

      {/* friso de vidro iluminado na linha do telhado */}
      <mesh name="Friso_Vidro_Fachada" position={[meio[0], ALTURA - 0.55, meio[1]]} rotation-y={giro} material={mat.vidro}>
        <boxGeometry args={[comprimento, 0.5, 0.12]} />
      </mesh>

      {/* pórtico recuado com a treliça branca e o logo ao lado */}
      <group name="Portico_Entrada" position={[meio[0], 0, meio[1]]} rotation-y={giro} scale={[1.35, 1.25, 1]}>
        <mesh name="Portico_Painel" geometry={geo.painelPortico} position={[0.8, 0, 0.05]} material={fab.cor("#cbbd9f", 0.9)} receiveShadow />
        {BARRAS.map(([x, y, l, ang], i) => (
          <mesh key={i} name={`Trelica_Barra_${i + 1}`} geometry={geo.barra} position={[x + 0.8, y - 0.11, 0.45]} rotation-z={THREE.MathUtils.degToRad(ang)} scale={[l, 1, 1]} material={fab.cor("#f2f2f0", 0.5)} castShadow />
        ))}
        <mesh name="Logo_Fachada" position={[-4.6, 5.2, 0.12]} material={mat.logo}>
          <planeGeometry args={[3.6, 2.9]} />
        </mesh>
        {/* marquise da entrada */}
        <mesh name="Marquise_Entrada" geometry={geo.marquise} position={[0.8, 2.0, 0.9]} material={fab.cor("#e9e6df", 0.6)} castShadow receiveShadow />
      </group>

      {/* volume mais alto no canto leste com o logo repetido e o capitel claro */}
      <mesh name="Torre_Logo_Leste" geometry={geo.torreLogo} position={[tx, 0, tz]} material={[fab.cor("#e2d8c2", 0.85), fab.cor("#cfc2a6", 0.9)]} castShadow receiveShadow />
      <mesh name="Torre_Logo_Topo" geometry={geo.torreTopo} position={[tx, ALTURA + 2.4, tz]} material={fab.cor("#efe9dc", 0.7)} castShadow />
      <mesh name="Logo_Torre_Leste" position={[tx, ALTURA + 0.6, tz + 2.72]} material={mat.logo}>
        <planeGeometry args={[3.4, 2.75]} />
      </mesh>

      <Entorno fab={fab} mat={mat} meio={meio} giro={giro} comprimento={comprimento} />
    </group>
  );
}

/** Máquinas de ar-condicionado e exaustores espalhados na laje (dão escala ao telhado, a vista mais vista do tour) */
function Cobertura({ mat }: { mat: Materiais }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const itens = useMemo(() => {
    const rnd = aleatorio(41);
    const lista: [number, number, number, number, number][] = [];
    for (let i = 0; i < 500 && lista.length < 30; i++) {
      const x = -100 + rnd() * 210, y = -95 + rnd() * 185;
      // a 8 m reais da borda e afastadas umas das outras
      if (![[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].every(([dx, dy]) => dentro([x + dx, y + dy], CONTORNO))) continue;
      const [mx, mz] = emM([x, y]);
      if (lista.some(([x2, , z2]) => Math.hypot(mx - x2, mz - z2) < 2.6)) continue;
      lista.push([mx, ALTURA, mz, 0.8 + rnd() * 0.6, rnd() < 0.5 ? 0.1 : 0.1 + Math.PI / 2]);
    }
    return lista;
  }, []);
  const geo = useMemo(() => caixaChanfrada(1.4, 0.6, 0.9, 0.06), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useLayoutEffect(() => posicionar(ref.current!, itens), [itens]);
  return <instancedMesh name="Maquinas_Cobertura" ref={ref} args={[geo, undefined, itens.length]} material={mat.maquinas} castShadow receiveShadow />;
}

/** Avenida com a estação de BRT e palmeiras, estacionamento descoberto e as torres do recorte sudoeste */
function Entorno({ fab, mat, meio, giro, comprimento }: { fab: Fabrica; mat: Materiais; meio: Xy; giro: number; comprimento: number }) {
  const { carros, palmeiras, copas, faixas, geo } = useMemo(() => {
    const rnd = aleatorio(23);
    // estacionamento descoberto do recorte sudeste (x de 43 a 97, y de -77 a -40 no referencial real)
    const c: [number, number, number, number, number][] = [];
    for (let x = 50; x < 92; x += 4.5) for (let y = -72; y < -44; y += 9) if (rnd() < 0.6) { const [mx, mz] = emM([x, y]); c.push([mx, 0.06, mz, 1, rnd() < 0.5 ? 0 : Math.PI]); }
    const p: number[] = [];
    for (let u = -comprimento * 0.75; u < comprimento * 1.3; u += 3.4) p.push(u);
    // mata ao norte do prédio
    const v: [number, number, number, number, number][] = [];
    for (let i = 0; i < 16; i++) {
      const [x, z] = emM([-90 + i * 12 + (rnd() - 0.5) * 6, 112 + (i % 3) * 10 - i * 4.2]);
      const s = 1.3 + (i % 3) * 0.3;
      v.push([x, s * 0.7, z, s, rnd() * Math.PI]);
    }
    // tracejado das faixas da avenida (duas linhas, uma de cada lado do canteiro do BRT)
    const f: [number, number, number][] = [];
    for (let u = -comprimento * 1.05; u < comprimento * 1.55; u += 1.6) for (const w of [4.5, 6.7]) f.push([u, 0.045, w]);
    const corpo = new THREE.BoxGeometry(0.46, 0.2, 0.92).translate(0, 0.1, 0);
    const cabine = new THREE.BoxGeometry(0.4, 0.16, 0.5).translate(0, 0.28, 0.05);
    const carro = mergeGeometries([corpo, cabine]);
    corpo.dispose();
    cabine.dispose();
    return { carros: c, palmeiras: p, copas: v, faixas: f, geo: { carro, torre: caixaChanfrada(2.4, 10, 2.4, 0.1), torreTopo: caixaChanfrada(2.6, 0.25, 2.6, 0.06), plataforma: caixaChanfrada(9.4, 0.22, 1.6, 0.05), cobertura: caixaChanfrada(9.8, 0.16, 1.9, 0.05) } };
  }, [comprimento]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  const autos = useRef<THREE.InstancedMesh>(null);
  const troncos = useRef<THREE.InstancedMesh>(null);
  const folhas = useRef<THREE.InstancedMesh>(null);
  const arvores = useRef<THREE.InstancedMesh>(null);
  const tracos = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    posicionar(autos.current!, carros, ["#f4f4f2", "#c9cccf", "#2b2e33", "#9a9ea3", "#3c4f6b", "#8c2f2f"]);
    posicionar(arvores.current!, copas, ["#3f7a34", "#356b2e", "#4a8a3c"]);
    posicionar(troncos.current!, palmeiras.map((u): [number, number, number] => [u, 1.3, 2.4]));
    // coroa da palmeira: icosaedro achatado, girado para as pontas não alinharem
    posicionar(folhas.current!, palmeiras.map((u, i): [number, number, number, number, number] => [u, 2.7, 2.4, 1, i * 0.7]));
    const o = new THREE.Matrix4(), e = new THREE.Matrix4().makeScale(1.15, 0.5, 1.15);
    for (let i = 0; i < folhas.current!.count; i++) {
      folhas.current!.getMatrixAt(i, o);
      folhas.current!.setMatrixAt(i, o.multiply(e));
    }
    folhas.current!.instanceMatrix.needsUpdate = true;
    posicionar(tracos.current!, faixas);
  }, [carros, copas, palmeiras, faixas]);

  // estacionamento descoberto do recorte sudeste
  const [ex, ez] = emM([70, -58]);
  return (
    <>
      <mesh name="Estacionamento_Descoberto" position={[ex, 0.04, ez]} rotation-x={-Math.PI / 2} material={fab.cor("#8a8c8c", 0.95)} receiveShadow>
        <planeGeometry args={[46 * K, 38 * K]} />
      </mesh>
      <instancedMesh name="Carros_Estacionamento" ref={autos} args={[geo.carro, undefined, carros.length]} material={mat.carro} castShadow />
      <instancedMesh name="Arvores_Mata_Norte" ref={arvores} args={[undefined, undefined, copas.length]} material={fab.cor("#ffffff", 0.9)} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>

      {/* torres residenciais do recorte sudoeste (não são do shopping, mas marcam a vista da avenida) */}
      {([[-88, -30], [-60, -30], [-88, -75], [-60, -75]] as Xy[]).map((p, i) => {
        const [x, z] = emM(p);
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh name={`Torre_Residencial_${i + 1}`} geometry={geo.torre} material={[fab.cor("#e4e0d6", 0.85), mat.torres]} castShadow receiveShadow />
            <mesh name={`Torre_Residencial_${i + 1}_Coroamento`} geometry={geo.torreTopo} position-y={10} material={fab.cor("#d6d1c6", 0.8)} castShadow />
          </group>
        );
      })}

      {/* Av. Bezerra de Menezes na frente, com a estação de BRT no canteiro e as palmeiras na calçada */}
      <group name="Av_Bezerra_de_Menezes" position={[meio[0], 0, meio[1]]} rotation-y={giro}>
        <mesh name="Av_Bezerra_Asfalto" position={[comprimento * 0.25, 0.03, 5.6]} rotation-x={-Math.PI / 2} material={fab.cor("#5c5f61", 0.95)} receiveShadow>
          <planeGeometry args={[comprimento * 2.6, 4.6]} />
        </mesh>
        <mesh name="Calcada_Shopping" position={[comprimento * 0.25, 0.035, 2.6]} rotation-x={-Math.PI / 2} material={fab.cor("#cdc6b6", 0.9)} receiveShadow>
          <planeGeometry args={[comprimento * 2.6, 1.4]} />
        </mesh>
        <instancedMesh name="Faixas_Tracejadas" ref={tracos} args={[undefined, undefined, faixas.length]} material={fab.cor("#f1efe6", 0.6)}>
          <boxGeometry args={[0.8, 0.02, 0.1]} />
        </instancedMesh>
        <mesh name="Estacao_BRT_Plataforma" geometry={geo.plataforma} position={[-1, 0, 5.6]} material={fab.cor("#bfbab0", 0.9)} castShadow receiveShadow />
        <mesh name="Estacao_BRT_Cobertura" geometry={geo.cobertura} position={[-1, 1.42, 5.6]} material={fab.cor("#e9ecee", 0.5)} castShadow receiveShadow />
        {[-5, -1, 3].map((x) => (
          <mesh key={x} name={`Estacao_BRT_Pilar_${x + 6}`} position={[x, 0.82, 5.6]} material={mat.metal} castShadow>
            <boxGeometry args={[0.14, 1.2, 0.14]} />
          </mesh>
        ))}
        <mesh name="Estacao_BRT_Vidro" position={[-1, 0.85, 5.0]} material={mat.vidroEstacao}>
          <boxGeometry args={[8.6, 0.9, 0.05]} />
        </mesh>
        <instancedMesh name="Palmeiras_Troncos" ref={troncos} args={[undefined, undefined, palmeiras.length]} material={fab.cor("#8b7355")} castShadow>
          <cylinderGeometry args={[0.08, 0.12, 2.6, 6]} />
        </instancedMesh>
        <instancedMesh name="Palmeiras_Copas" ref={folhas} args={[undefined, undefined, palmeiras.length]} material={fab.cor("#3e6b2f")} castShadow>
          <icosahedronGeometry args={[0.85, 0]} />
        </instancedMesh>
      </group>
    </>
  );
}
