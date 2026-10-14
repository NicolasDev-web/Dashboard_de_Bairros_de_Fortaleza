import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Fabrica } from "../Cena";
import { aleatorio, caixaChanfrada, posicionar, prismaDePlanta } from "../util/geometria";

/**
 * Shopping RioMar em miniatura: um modelo só, com os dois shoppings do grupo como variações. O
 * contorno de cada um vem do OpenStreetMap (pesquisa/marcos/riomar/ficha.md), em metros reais com
 * x = leste e y = norte; `escala` encolhe para caber na base de ~30 m de raio, e as alturas encolhem
 * menos para lerem de longe. Metros, norte em −z, leste em +x.
 */
type Xy = [number, number];

interface Variante {
  nome: string;
  contorno: Xy[];
  escala: number;
  /** desloca o modelo para o prédio e o estacionamento da frente ficarem centrados na base */
  deslocamento: Xy;
  altura: number;
  /** aresta da fachada principal (dois vértices do contorno) */
  fachada: [Xy, Xy];
  torre: { em: Xy; lado: number; altura: number; vidro: boolean; heliponto: boolean };
  paredes: string;
  listras: string;
  /** moldura do pórtico de vidro; sem ela, o pórtico tem brises escuros */
  moldura?: string;
  arcos: boolean;
  lagoa?: { em: Xy; raio: [number, number] };
  /** quantas máquinas de ar-condicionado espalhar na laje */
  maquinas: number;
}

const VARIANTES: Record<"fortaleza" | "kennedy", Variante> = {
  fortaleza: {
    nome: "Fortaleza",
    contorno: [[-111, -35], [-47, -44], [-54, -67], [52, -101], [59, -78], [186, -125], [224, -6], [-157, 132], [-177, 129], [-217, 6]],
    escala: 0.1,
    deslocamento: [-2, 0],
    altura: 8,
    fachada: [[186, -125], [224, -6]],
    torre: { em: [-190, -2], lado: 4.6, altura: 21, vidro: false, heliponto: true },
    paredes: "#c9b9ae",
    listras: "#9b7f72",
    arcos: true,
    lagoa: { em: [250, 70], raio: [4, 6] },
    maquinas: 24,
  },
  kennedy: {
    nome: "Kennedy",
    contorno: [[-86, -74], [-79, -59], [-35, -67], [152, -30], [132, 81], [10, 51], [-54, 48], [-144, 31], [-152, 22], [-135, -73]],
    escala: 0.15,
    deslocamento: [0, 6],
    altura: 7.5,
    fachada: [[-135, -73], [152, -30]],
    torre: { em: [-108, -64], lado: 4.6, altura: 14, vidro: true, heliponto: false },
    paredes: "#f1f2f0",
    listras: "#b8bcbf",
    moldura: "#2f5a4c",
    arcos: false,
    maquinas: 20,
  },
};

function dentro([x, y]: Xy, p: Xy[]) {
  let d = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/** Faixas horizontais das fachadas: a extrusão usa UV em metros, então a textura repete a cada 1,6 m */
function texturaListras(fundo: string, faixa: string) {
  const cv = document.createElement("canvas");
  cv.width = 16;
  cv.height = 32;
  const g = cv.getContext("2d")!;
  g.fillStyle = fundo;
  g.fillRect(0, 0, 16, 32);
  g.fillStyle = faixa;
  g.fillRect(0, 20, 16, 6);
  g.fillStyle = "rgba(255,255,255,.22)";
  g.fillRect(0, 19, 16, 1); // aresta de cima da faixa, que pega a luz
  g.fillStyle = "rgba(0,0,0,.06)";
  g.fillRect(0, 0, 1, 32); // junta dos painéis, a cada 3 m
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 3, 1 / 1.6);
  t.anisotropy = 4;
  return t;
}

/** Logo RioMar (as três ondas azul-clara, azul-escura e verde) com o nome da unidade embaixo */
function texturaLogo(unidade: string) {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 200;
  const g = cv.getContext("2d")!;
  const onda = (y: number, cor: string) => {
    g.strokeStyle = cor;
    g.lineWidth = 16;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(26, y);
    g.quadraticCurveTo(78, y + 34, 150, y - 4);
    g.stroke();
  };
  onda(62, "#5bb4e0");
  onda(86, "#1f4f86");
  onda(110, "#8cc63f");
  g.fillStyle = "#24476b";
  g.font = "700 92px system-ui, sans-serif";
  g.textBaseline = "middle";
  g.fillText("RioMar", 172, 88);
  g.font = "600 34px system-ui, sans-serif";
  g.fillText(unidade, 176, 160);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Materiais feitos à mão (texturas, vidro, metal, carros e copas), todos nomeados */
function criarMateriais(v: Variante) {
  const m = (nome: string, p: THREE.MeshStandardMaterialParameters) => Object.assign(new THREE.MeshStandardMaterial(p), { name: nome });
  return {
    listras: m(`Mat_Fachada_Listras_${v.nome}`, { map: texturaListras(v.paredes, v.listras), roughness: 0.85 }),
    logo: m(`Mat_Logo_RioMar_${v.nome}`, { map: texturaLogo(v.nome), transparent: true, alphaTest: 0.1, roughness: 0.6 }),
    torre: v.torre.vidro
      ? m("Mat_Vidro_Torre", { color: "#557891", roughness: 0.12, metalness: 0.25 })
      : m("Mat_Concreto_Torre", { color: "#d9d9d6", roughness: 0.8 }),
    faixaTorre: v.torre.vidro
      ? m("Mat_Laje_Torre", { color: "#d5dbe0", roughness: 0.5, metalness: 0.2 })
      : m("Mat_Janelas_Torre", { color: "#5d6e7c", roughness: 0.15, metalness: 0.22 }),
    vidroPortico: m("Mat_Vidro_Portico", { color: "#5f8199", roughness: 0.1, metalness: 0.22 }),
    claraboia: m("Mat_Vidro_Claraboia", { color: "#dfe9ea", roughness: 0.18, metalness: 0.25 }),
    metal: m("Mat_Metal_Claro", { color: "#b9c0c4", roughness: 0.35, metalness: 0.35 }),
    maquinas: m("Mat_Maquinas_Cobertura", { color: "#b9bcbd", roughness: 0.55, metalness: 0.3 }),
    carro: m("Mat_Pintura_Carro", { roughness: 0.35, metalness: 0.3 }),
  };
}
type Materiais = ReturnType<typeof criarMateriais>;

function RioMar({ v, fab }: { v: Variante; fab: Fabrica }) {
  const k = v.escala;
  const emM = useMemo(() => ([x, y]: Xy): Xy => [x * k + v.deslocamento[0], -y * k + v.deslocamento[1]], [k, v.deslocamento]);
  const mat = useMemo(() => criarMateriais(v), [v]);

  const geo = useMemo(() => {
    const L = v.torre.lado;
    return {
      // caixa do shopping com a borda do telhado chanfrada
      caixa: prismaDePlanta(v.contorno.map(emM), v.altura, 0, 0.2),
      torre: caixaChanfrada(L, v.torre.altura, L, 0.12),
      laje: caixaChanfrada(L + 0.12, 0.32, L + 0.12, 0.04),
      coroamento: caixaChanfrada(L + 0.3, 0.45, L + 0.3, 0.08),
      maquina: caixaChanfrada(1.4, 0.6, 0.9, 0.06),
    };
  }, [v, emM]);
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

  // fachada principal: meio da aresta, direção ao longo dela e a normal para fora do prédio
  const [a, b] = v.fachada.map(emM);
  const meio: Xy = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const comprimento = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const centro = v.contorno.map(emM).reduce<Xy>((s, p) => [s[0] + p[0] / v.contorno.length, s[1] + p[1] / v.contorno.length], [0, 0]);
  let normal: Xy = [-(b[1] - a[1]) / comprimento, (b[0] - a[0]) / comprimento];
  if (normal[0] * (meio[0] - centro[0]) + normal[1] * (meio[1] - centro[1]) < 0) normal = [-normal[0], -normal[1]];
  const giroFachada = Math.atan2(normal[0], normal[1]);
  const [tx, tz] = emM(v.torre.em);

  // lajes da torre (uma InstancedMesh) e máquinas na cobertura, longe da borda e da torre
  const lajes = useRef<THREE.InstancedMesh>(null);
  const maquinas = useRef<THREE.InstancedMesh>(null);
  const itensMaquinas = useMemo(() => {
    const rnd = aleatorio(v.nome.length * 13);
    const lista: [number, number, number, number, number][] = [];
    const xs = v.contorno.map((p) => p[0]), ys = v.contorno.map((p) => p[1]);
    for (let i = 0; i < 600 && lista.length < v.maquinas; i++) {
      const x = Math.min(...xs) + rnd() * (Math.max(...xs) - Math.min(...xs)), y = Math.min(...ys) + rnd() * (Math.max(...ys) - Math.min(...ys));
      const d = 1.5 / k; // 1,5 m da miniatura em metros reais
      if (![[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]].every(([dx, dy]) => dentro([x + dx, y + dy], v.contorno))) continue;
      const [mx, mz] = emM([x, y]);
      if (Math.hypot(mx - tx, mz - tz) < v.torre.lado + 1.5) continue;
      if (lista.some(([x2, , z2]) => Math.hypot(mx - x2, mz - z2) < 2.4)) continue;
      // longe das claraboias em arco (faixas perpendiculares à fachada)
      const [ax, az] = [Math.cos(giroFachada), -Math.sin(giroFachada)]; // eixo das claraboias
      if (v.arcos && [-0.18, 0, 0.18].some((t) => { const [cx, cz] = emM([20 + t * 260, 0]); return Math.abs((mx - cx) * az - (mz - cz) * ax) < 2.6; })) continue;
      lista.push([mx, v.altura, mz, 0.8 + rnd() * 0.5, giroFachada + (rnd() < 0.5 ? 0 : Math.PI / 2)]);
    }
    return lista;
  }, [v, emM, k, tx, tz, giroFachada]);
  useLayoutEffect(() => {
    const n = Math.floor(v.torre.altura / 1.4);
    posicionar(lajes.current!, Array.from({ length: n }, (_, i): [number, number, number] => [tx, 0.84 + i * 1.4, tz]));
    posicionar(maquinas.current!, itensMaquinas);
  }, [v, tx, tz, itensMaquinas]);

  return (
    <group name={`RioMar_${v.nome}`}>
      <mesh name="Caixa_Shopping" geometry={geo.caixa} material={[fab.cor("#e4e2dd", 0.9), mat.listras]} castShadow receiveShadow />
      <instancedMesh name="Maquinas_Cobertura" ref={maquinas} args={[geo.maquina, undefined, itensMaquinas.length]} material={mat.maquinas} castShadow receiveShadow />

      {/* pórtico de entrada no meio da fachada principal, mais alto que a caixa */}
      <group name="Portico_Entrada" position={[meio[0] + normal[0] * 0.5, 0, meio[1] + normal[1] * 0.5]} rotation-y={giroFachada}>
        {v.moldura ? (
          <>
            <Moldura largura={comprimento * 0.36} altura={v.altura + 1.2} cor={fab.cor(v.moldura, 0.55)} />
            <mesh name="Portico_Vidro" position={[0, (v.altura - 0.4) / 2, 0.12]} material={mat.vidroPortico}>
              <boxGeometry args={[comprimento * 0.32, v.altura - 0.4, 1]} />
            </mesh>
            {/* montantes do pano de vidro */}
            {Array.from({ length: 7 }, (_, i) => (
              <mesh key={i} name={`Portico_Montante_${i + 1}`} position={[comprimento * 0.32 * ((i + 1) / 8 - 0.5), (v.altura - 0.4) / 2, 0.64]} material={mat.metal}>
                <boxGeometry args={[0.09, v.altura - 0.4, 0.06]} />
              </mesh>
            ))}
          </>
        ) : (
          <>
            <mesh name="Portico_Fundo_Escuro" position-y={(v.altura * 0.75) / 2} material={fab.cor("#4a4b52", 0.5)} castShadow>
              <boxGeometry args={[comprimento * 0.4, v.altura * 0.75, 1]} />
            </mesh>
            <Brises largura={comprimento * 0.4} cor={fab.cor("#f2f2f0", 0.6)} />
            {/* marquise da entrada, em balanço */}
            <mesh name="Portico_Marquise" position={[0, 1.15, 1.2]} material={fab.cor("#f2f2f0", 0.6)} castShadow receiveShadow>
              <boxGeometry args={[comprimento * 0.3, 0.16, 1.6]} />
            </mesh>
          </>
        )}
        {/* logo RioMar no alto da fachada */}
        <mesh name="Logo_RioMar" position={[v.moldura ? comprimento * 0.13 : 0, v.altura * (v.moldura ? 0.62 : 0.88), v.moldura ? 0.68 : 0.58]} material={mat.logo}>
          <planeGeometry args={[7.2, 2.8]} />
        </mesh>
      </group>

      {/* torre comercial colada numa ponta: corpo chanfrado, lajes salientes, coroamento e o heliponto */}
      <mesh name="Torre_Comercial" geometry={geo.torre} position={[tx, 0, tz]} material={[fab.cor("#e2e2de", 0.7), mat.torre]} castShadow receiveShadow />
      <instancedMesh name="Torre_Lajes" ref={lajes} args={[geo.laje, undefined, Math.floor(v.torre.altura / 1.4)]} material={mat.faixaTorre} castShadow receiveShadow />
      <mesh name="Torre_Coroamento" geometry={geo.coroamento} position={[tx, v.torre.altura, tz]} material={fab.cor("#e2e2de", 0.7)} castShadow />
      {v.torre.heliponto && (
        <group name="Heliponto" position={[tx, v.torre.altura + 0.45, tz]}>
          <mesh name="Heliponto_Disco" position-y={0.06} material={fab.cor("#2f5f9e", 0.6)}>
            <cylinderGeometry args={[v.torre.lado * 0.42, v.torre.lado * 0.42, 0.12, 24]} />
          </mesh>
          {/* o "H" branco pintado no disco */}
          {[[-0.42, 0, 0.16, 1.3], [0.42, 0, 0.16, 1.3], [0, 0, 0.7, 0.16]].map(([x, z, w, d], i) => (
            <mesh key={i} name={`Heliponto_H_${i + 1}`} position={[x, 0.13, z]} material={fab.cor("#f4f4f2", 0.6)}>
              <boxGeometry args={[w, 0.02, d]} />
            </mesh>
          ))}
        </group>
      )}

      {/* claraboias de vidro em arco cruzando o telhado, com o aro de metal nas pontas (só o de Fortaleza) */}
      {v.arcos &&
        [-0.18, 0, 0.18].map((t) => {
          const [cx, cz] = emM([20 + t * 260, 0]);
          return (
            <group key={t} position={[cx, v.altura, cz]} rotation={[0, giroFachada, Math.PI / 2]}>
              <mesh name={`Claraboia_Arco_${Math.round(t * 100)}`} material={[mat.claraboia, mat.metal, mat.metal]} castShadow receiveShadow>
                <cylinderGeometry args={[1.6, 1.6, 12, 18, 1, false, 0, Math.PI]} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh key={s} name={`Claraboia_Aro_${Math.round(t * 100)}_${s < 0 ? "A" : "B"}`} position-y={s * 6} rotation-x={Math.PI / 2} material={mat.metal} castShadow>
                  <torusGeometry args={[1.64, 0.1, 4, 18, Math.PI]} />
                </mesh>
              ))}
            </group>
          );
        })}

      <Estacionamento v={v} mat={mat} meio={meio} normal={normal} comprimento={comprimento} giro={giroFachada} fab={fab} />

      {v.lagoa &&
        (() => {
          const [lx, lz] = emM(v.lagoa.em);
          return (
            <group position={[lx, 0, lz]} rotation-x={-Math.PI / 2}>
              <mesh name="Lagoa_Margem" position-z={0.04} scale={[v.lagoa.raio[0] + 0.5, v.lagoa.raio[1] + 0.5, 1]} material={fab.cor("#7c9c56", 0.95)} receiveShadow>
                <circleGeometry args={[1, 32]} />
              </mesh>
              <mesh name="Lagoa_Agua" position-z={0.06} scale={[v.lagoa.raio[0], v.lagoa.raio[1], 1]} material={fab.agua()} receiveShadow>
                <circleGeometry args={[1, 32]} />
              </mesh>
            </group>
          );
        })()}
    </group>
  );
}

/** Moldura do pórtico (Kennedy): dois montantes e a verga, em vez de uma caixa cheia atrás do vidro */
function Moldura({ largura, altura, cor }: { largura: number; altura: number; cor: THREE.Material }) {
  const geo = useMemo(() => {
    const montante = caixaChanfrada(0.9, altura, 1, 0.08);
    const g = mergeGeometries([
      montante.clone().translate(-largura / 2 + 0.45, 0, 0),
      montante.clone().translate(largura / 2 - 0.45, 0, 0),
      caixaChanfrada(largura, 1.0, 1, 0.08).translate(0, altura - 1.0, 0),
      caixaChanfrada(largura, 0.5, 1, 0.08),
    ]);
    montante.dispose();
    return g;
  }, [largura, altura]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh name="Portico_Moldura" geometry={geo} material={cor} castShadow receiveShadow />;
}

/** Brises brancos horizontais sobre o fundo escuro do pórtico (Fortaleza), numa malha só */
function Brises({ largura, cor }: { largura: number; cor: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => posicionar(ref.current!, Array.from({ length: 6 }, (_, i): [number, number, number] => [0, 0.9 + i * 0.95, 0.52])), []);
  return (
    <instancedMesh name="Portico_Brises" ref={ref} args={[undefined, undefined, 6]} material={cor} castShadow>
      <boxGeometry args={[largura, 0.14, 0.16]} />
    </instancedMesh>
  );
}

/** Estacionamento descoberto na frente da fachada principal, com fileiras de palmeiras e carros */
function Estacionamento({ v, mat, meio, normal, comprimento, giro, fab }: { v: Variante; mat: Materiais; meio: Xy; normal: Xy; comprimento: number; giro: number; fab: Fabrica }) {
  const profundidade = 7;
  const largura = comprimento * 0.95;
  const centro: Xy = [meio[0] + normal[0] * (profundidade / 2 + 0.6), meio[1] + normal[1] * (profundidade / 2 + 0.6)];
  const { palmeiras, carros, faixas, geoCarro } = useMemo(() => {
    const rnd = aleatorio(v.nome.length * 97);
    const p: Xy[] = [];
    const c: [number, number, number, number, number][] = [];
    // coordenadas locais do estacionamento: u ao longo da fachada, w para longe dela
    for (let u = -largura / 2 + 1.5; u < largura / 2 - 1; u += 3.2) p.push([u, profundidade / 2 - 0.5]);
    for (let fila = 0; fila < 3; fila++) {
      for (let u = -largura / 2 + 0.8; u < largura / 2 - 0.6; u += 0.75) if (rnd() < 0.55) c.push([u, 0.05, -profundidade / 2 + 1 + fila * 2, 1, rnd() < 0.5 ? 0 : Math.PI]);
    }
    // corredores de circulação entre as fileiras de vagas
    const f: [number, number, number][] = [0, 1].map((i) => [0, 0.05, -profundidade / 2 + 2 + i * 2]);
    const corpo = new THREE.BoxGeometry(0.46, 0.2, 0.92).translate(0, 0.1, 0);
    const cabine = new THREE.BoxGeometry(0.4, 0.16, 0.5).translate(0, 0.28, 0.05);
    const geo = mergeGeometries([corpo, cabine]);
    corpo.dispose();
    cabine.dispose();
    return { palmeiras: p, carros: c, faixas: f, geoCarro: geo };
  }, [v.nome, largura]);
  useEffect(() => () => geoCarro.dispose(), [geoCarro]);

  const troncos = useRef<THREE.InstancedMesh>(null);
  const copas = useRef<THREE.InstancedMesh>(null);
  const autos = useRef<THREE.InstancedMesh>(null);
  const corredores = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    posicionar(troncos.current!, palmeiras.map(([u, w]): [number, number, number] => [u, 1.3, w]));
    // coroa da palmeira: icosaedro achatado e girado, para não parecer uma bola
    posicionar(copas.current!, palmeiras.map(([u, w], i): [number, number, number, number, number] => [u, 2.7, w, 1, i * 0.9]));
    const o = new THREE.Matrix4(), e = new THREE.Matrix4().makeScale(1.15, 0.5, 1.15);
    for (let i = 0; i < copas.current!.count; i++) {
      copas.current!.getMatrixAt(i, o);
      copas.current!.setMatrixAt(i, o.multiply(e));
    }
    copas.current!.instanceMatrix.needsUpdate = true;
    posicionar(autos.current!, carros, ["#f4f4f2", "#c9cccf", "#2b2e33", "#9a9ea3", "#3c4f6b", "#8c2f2f"]);
    posicionar(corredores.current!, faixas);
  }, [palmeiras, carros, faixas]);

  return (
    <group name="Estacionamento_Frente" position={[centro[0], 0, centro[1]]} rotation-y={giro}>
      <mesh name="Estacionamento_Piso" rotation-x={-Math.PI / 2} position-y={0.04} material={fab.cor("#8a8c8c", 0.95)} receiveShadow>
        <planeGeometry args={[largura, profundidade]} />
      </mesh>
      <mesh name="Estacionamento_Calcada" position={[0, 0.06, profundidade / 2 - 0.5]} material={fab.cor("#cdc6b6", 0.9)} receiveShadow>
        <boxGeometry args={[largura, 0.08, 1.1]} />
      </mesh>
      <instancedMesh name="Estacionamento_Corredores" ref={corredores} args={[undefined, undefined, faixas.length]} material={fab.cor("#6f7273", 0.95)} receiveShadow>
        <boxGeometry args={[largura - 0.4, 0.02, 0.9]} />
      </instancedMesh>
      <instancedMesh name="Palmeiras_Troncos" ref={troncos} args={[undefined, undefined, palmeiras.length]} material={fab.cor("#8b7355")} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 2.6, 6]} />
      </instancedMesh>
      <instancedMesh name="Palmeiras_Copas" ref={copas} args={[undefined, undefined, palmeiras.length]} material={fab.cor("#3f6e2e")} castShadow>
        <icosahedronGeometry args={[0.85, 0]} />
      </instancedMesh>
      <instancedMesh name="Carros_Estacionamento" ref={autos} args={[geoCarro, undefined, carros.length]} material={mat.carro} castShadow />
    </group>
  );
}

export function RioMarFortaleza({ fab }: { fab: Fabrica }) {
  return <RioMar v={VARIANTES.fortaleza} fab={fab} />;
}

export function RioMarKennedy({ fab }: { fab: Fabrica }) {
  return <RioMar v={VARIANTES.kennedy} fab={fab} />;
}
