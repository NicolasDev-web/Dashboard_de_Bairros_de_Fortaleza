import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../Cena";
import { aleatorio, caixaChanfrada, placaDePlanta, posicionar, prismaDePlanta, texturaJanelas, texturaManchada } from "../util/geometria";

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
/** Raio útil do pedestal: nada passa daqui (o pedestal tem 34 m) */
const RAIO_UTIL = 33.2;

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

function dentro([x, y]: Xy, p: Xy[]) {
  let d = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/**
 * Junta várias geometrias numa malha só, com um grupo por material. `mapa[i]` diz para qual material vai o
 * grupo i da peça (nas extrusões, 0 = tampas e 1 = paredes; nos cilindros, 0 = lado e 1/2 = tampas).
 */
function fundir(pecas: [THREE.BufferGeometry, number[]?][]) {
  const planas = pecas.map(([g, mapa]): [THREE.BufferGeometry, number[] | undefined] => [g.index ? g.toNonIndexed() : g, mapa]);
  const destino = (gr: { materialIndex?: number }, mapa?: number[]) => (mapa ? mapa[gr.materialIndex ?? 0] ?? mapa[mapa.length - 1] : gr.materialIndex ?? 0);
  const nMat = Math.max(1, ...planas.flatMap(([g, mapa]) => (g.groups.length ? g.groups : [{ materialIndex: 0 }]).map((gr) => destino(gr, mapa) + 1)));
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  const saida = new THREE.BufferGeometry();
  for (let m = 0; m < nMat; m++) {
    const ini = pos.length / 3;
    for (const [g, mapa] of planas) {
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      const grupos = g.groups.length ? g.groups : [{ start: 0, count: P.count, materialIndex: 0 }];
      for (const gr of grupos) {
        if (destino(gr, mapa) !== m) continue;
        for (let i = gr.start, fim = Math.min(gr.start + gr.count, P.count); i < fim; i++) {
          pos.push(P.getX(i), P.getY(i), P.getZ(i));
          nor.push(N.getX(i), N.getY(i), N.getZ(i));
          uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
        }
      }
    }
    if (pos.length / 3 > ini) saida.addGroup(ini, pos.length / 3 - ini, m);
  }
  saida.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  saida.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  saida.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  for (const [g] of planas) g.dispose();
  for (const [g] of pecas) g.dispose();
  return saida;
}

/** Gira em torno do eixo vertical e leva para (x, y, z): para montar peças antes de `fundir` */
function por(g: THREE.BufferGeometry, x: number, y: number, z: number, giro = 0) {
  return g.rotateY(giro).translate(x, y, z);
}

/**
 * Faixa reta de rua centrada em (cx, cz), na direção (dx, dz), cortada pelo círculo do pedestal: cada canto
 * vai até onde a sua borda cruza o raio útil, então a ponta acompanha a curva da base.
 */
function faixaNoDisco(cx: number, cz: number, dx: number, dz: number, largura: number, r = RAIO_UTIL): Xy[] {
  const nx = -dz, nz = dx, w = largura / 2;
  const alcance = (sentido: number, lado: number) => {
    const ox = cx + lado * w * nx, oz = cz + lado * w * nz;
    let t = 0;
    while (Math.hypot(ox + sentido * (t + 0.05) * dx, oz + sentido * (t + 0.05) * dz) < r && t < 60) t += 0.05;
    return [ox + sentido * t * dx, oz + sentido * t * dz] as Xy;
  };
  return [alcance(-1, -1), alcance(1, -1), alcance(1, 1), alcance(-1, 1)];
}

/** Texto sobre faixa (letreiro do Convivência) ou sobre o telhado claro (Bloco M) */
function texturaTexto(texto: string, fundo: string, cor: string, largura: number, altura = 96) {
  const cv = document.createElement("canvas");
  cv.width = largura;
  cv.height = altura;
  const g = cv.getContext("2d")!;
  g.fillStyle = fundo;
  g.fillRect(0, 0, largura, altura);
  g.fillStyle = cor;
  g.textAlign = "center";
  g.textBaseline = "middle";
  let tamanho = altura * 0.75;
  g.font = `800 ${tamanho}px system-ui, sans-serif`;
  while (g.measureText(texto).width > largura * 0.9 && tamanho > 12) g.font = `800 ${(tamanho -= 2)}px system-ui, sans-serif`;
  g.fillText(texto, largura / 2, altura * 0.54);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Materiais feitos à mão (vidro, metal, painéis, texturas), todos nomeados */
function criarMateriais() {
  // fita de janelas com brises: parede branca (o material tinge) e vidro escuro; módulo de 1,2 × 1,0 m
  const janelas = texturaJanelas({ parede: "#ffffff", janela: "#3a4a5d", moldura: "#d9d9d4", pilastra: "#e6e6e1", colunas: 2, linhas: 1, larguraJanela: 0.86, alturaJanela: 0.46 });
  janelas.repeat.set(1 / 2.4, 1);
  const grama = texturaManchada("#7fa35a", 0.07, 7, 64);
  grama.repeat.set(1 / 9, 1 / 9);
  const m = (nome: string, p: THREE.MeshStandardMaterialParameters) => Object.assign(new THREE.MeshStandardMaterial(p), { name: nome });
  return {
    fachadaBlocos: m("Mat_Fachada_Blocos", { map: janelas, color: "#f1f1ec", roughness: 0.85 }),
    fachadaReitoria: m("Mat_Fachada_Reitoria", { map: janelas, color: "#cfcca8", roughness: 0.85 }),
    gramado: m("Mat_Gramado_Campus", { map: grama, roughness: 0.95 }),
    vidro: m("Mat_Vidro_Azul", { color: "#3f6595", roughness: 0.12, metalness: 0.22 }),
    vidroEscuro: m("Mat_Vidro_Escuro", { color: "#22303f", roughness: 0.1, metalness: 0.3 }),
    metal: m("Mat_Metal_Cobertura", { color: "#d3d7da", roughness: 0.4, metalness: 0.35 }),
    painel: m("Mat_Painel_Solar", { color: "#1f2c4a", roughness: 0.22, metalness: 0.45 }),
    aco: m("Mat_Aco_Estrutura", { color: "#9aa0a3", roughness: 0.45, metalness: 0.4 }),
    copa: m("Mat_Copa_Arvore", { roughness: 0.9, flatShading: true }),
    letreiro: m("Mat_Letreiro_Unifor", { map: texturaTexto("UNIVERSIDADE DE FORTALEZA", "#1e3a6e", "#ffffff", 512, 48), roughness: 0.55 }),
    telhadoM: m("Mat_Telhado_Bloco_M", { map: texturaTexto("UNIFOR", "#c9cdcb", "#ffffff", 256, 64), roughness: 0.8 }),
  };
}
type Materiais = ReturnType<typeof criarMateriais>;

/** Edifício extrudado a partir do contorno local do OSM, com o tamanho exagerado `E` e as quinas chanfradas */
function Extrudado({ nome, local, em, altura, paredes, telhado }: { nome: string; local: Xy[]; em: Xy; altura: number; paredes: THREE.Material; telhado: THREE.Material }) {
  const geo = useMemo(() => {
    const [cx, cz] = emM(em);
    return prismaDePlanta(local.map(([x, y]): Xy => [cx + x * K * E, cz - y * K * E]), altura, 0, 0.12);
  }, [local, em, altura]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh name={nome} geometry={geo} material={[telhado, paredes]} castShadow receiveShadow />;
}

/** Centro de Convivência: tambor branco sobre a faixa de vidro, cúpula baixa, torres de vidro azul e o pórtico */
function CentroDeConvivencia({ fab, mat }: { fab: Fabrica; mat: Materiais }) {
  const [x, z] = emM([-195, -42]);
  const r = 27 * K * E;
  const geo = useMemo(() => {
    // perfil do tambor com a cornija chanfrada no alto (r, y)
    const perfil = [[r * 0.9, 1.05], [r, 1.05], [r, 2.8], [r + 0.14, 2.88], [r + 0.14, 3.06], [r * 0.82, 3.06]].map(([a, b]) => new THREE.Vector2(a, b));
    return { tambor: new THREE.LatheGeometry(perfil, 40), parede: caixaChanfrada(0.32, 2.8, r * 0.9, 0.06), portico: caixaChanfrada(4.4, 3.2, 0.5, 0.1) };
  }, [r]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <group name="Centro_Convivencia" position={[x, 0, z]}>
      <mesh name="Convivencia_Faixa_Vidro" position-y={0.53} material={mat.vidroEscuro} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.9, r * 0.9, 1.06, 32]} />
      </mesh>
      <mesh name="Convivencia_Tambor" geometry={geo.tambor} material={fab.cor("#edede8", 0.8)} castShadow receiveShadow />
      {/* cúpula branca baixa, o ícone do campus */}
      <mesh name="Convivencia_Cupula" position-y={3.04} scale={[1, 0.62, 1]} material={fab.cor("#f6f6f3", 0.45)} castShadow receiveShadow>
        <sphereGeometry args={[r * 0.86, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* torres cilíndricas de vidro azul (com anel de laje no topo) e a parede azul-petróleo, a oeste */}
      {[-1, 1].map((s) => (
        <group key={s} position={[-r * 0.92, 0, s * r * 0.55]}>
          <mesh name={`Torre_Vidro_${s < 0 ? "Norte" : "Sul"}`} position-y={2.6} material={mat.vidro} castShadow receiveShadow>
            <cylinderGeometry args={[0.55, 0.55, 5.2, 16]} />
          </mesh>
          <mesh name={`Torre_Anel_${s < 0 ? "Norte" : "Sul"}`} position-y={5.2} material={fab.cor("#f2f2ef", 0.6)} castShadow>
            <cylinderGeometry args={[0.64, 0.64, 0.18, 16]} />
          </mesh>
        </group>
      ))}
      <mesh name="Convivencia_Parede_Petroleo" position={[-r - 0.5, 0, 0]} geometry={geo.parede} material={fab.cor("#3f7c8a", 0.55)} castShadow receiveShadow />
      {/* pórtico branco com o letreiro, virado para a praça a oeste */}
      <group position={[-r - 1.7, 0, 0]} rotation-y={-Math.PI / 2}>
        <mesh name="Portico_Convivencia" geometry={geo.portico} material={fab.cor("#f2f2ef", 0.6)} castShadow receiveShadow />
        <mesh name="Letreiro_Universidade" position={[0, 2.55, 0.252]} material={mat.letreiro}>
          <planeGeometry args={[4.1, 0.42]} />
        </mesh>
      </group>
    </group>
  );
}

/** Ginásio: base com janelas, abóbada metálica de hangar (geratriz leste–oeste) e as nervuras da estrutura */
function Ginasio({ fab, mat }: { fab: Fabrica; mat: Materiais }) {
  const [x, z] = emM([67, -106]);
  const lado = 80 * K * 1.4;
  const R = lado * 0.47;
  const geo = useMemo(() => {
    const base = caixaChanfrada(lado, 1.6, lado * 0.94, 0.1);
    // meia-casca de cima: θ de 0 a π dá y ≥ 0 depois de deitar o cilindro no eixo x
    const abobada = new THREE.CylinderGeometry(R, R, lado, 28, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(0, 1.6, 0);
    const nervuras = fundir(
      [1, 2, 3, 4, 5].map((i): [THREE.BufferGeometry] => [new THREE.TorusGeometry(R + 0.04, 0.07, 4, 24, Math.PI).rotateY(Math.PI / 2).translate(-lado / 2 + (i * lado) / 6, 1.6, 0)]),
    );
    return { base, abobada, nervuras };
  }, [lado, R]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <group name="Ginasio" position={[x, 0, z]}>
      <mesh name="Ginasio_Base" geometry={geo.base} material={[fab.cor("#e2e3df", 0.85), mat.fachadaBlocos]} castShadow receiveShadow />
      <mesh name="Ginasio_Abobada" geometry={geo.abobada} material={[mat.metal, fab.cor("#edede8", 0.8), fab.cor("#edede8", 0.8)]} castShadow receiveShadow />
      <mesh name="Ginasio_Nervuras" geometry={geo.nervuras} material={mat.aco} castShadow />
    </group>
  );
}

/** Pista de atletismo com o campo e a arquibancada coberta; estacionamento coberto por painéis solares */
function PistaEEstacionamentoSolar({ fab, mat }: { fab: Fabrica; mat: Materiais }) {
  const [px, pz] = emM([270, 0]);
  const [sx, sz] = emM([113, 114]);
  const largura = 158 * K;
  const fundo = 147 * K;
  const compArq = 191 * K * 0.6;
  const arquibancada = useMemo(() => {
    // degraus descendo para o leste (para a pista), muro de fundo e a laje da cobertura
    const s = new THREE.Shape([[0, 0], [1.2, 0], [1.2, 0.35], [0.8, 0.35], [0.8, 0.7], [0.4, 0.7], [0.4, 1.05], [0, 1.05]].map(([a, b]) => new THREE.Vector2(a, b)));
    const degraus = new THREE.ExtrudeGeometry(s, { depth: compArq, bevelEnabled: false }).translate(-0.6, 0, -compArq / 2);
    const muro = caixaChanfrada(0.16, 2.1, compArq, 0.04).translate(-0.62, 0, 0);
    const laje = caixaChanfrada(1.7, 0.12, compArq + 0.3, 0.04).translate(0.1, 2.06, 0);
    return fundir([[degraus, [1, 1]], [muro, [1, 1]], [laje, [0, 0]]]);
  }, [compArq]);
  useEffect(() => () => arquibancada.dispose(), [arquibancada]);

  const paineis = useRef<THREE.InstancedMesh>(null);
  const postes = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const filas = Array.from({ length: 6 }, (_, i) => sz - fundo / 2 + (i + 0.5) * (fundo / 6));
    const o = new THREE.Object3D();
    filas.forEach((fz, i) => {
      o.position.set(sx, 0.72, fz);
      o.rotation.set(-0.22, 0, 0);
      o.updateMatrix();
      paineis.current!.setMatrixAt(i, o.matrix);
    });
    paineis.current!.instanceMatrix.needsUpdate = true;
    paineis.current!.computeBoundingSphere();
    posicionar(postes.current!, filas.flatMap((fz) => [-0.36, 0, 0.36].map((t): [number, number, number] => [sx + t * largura, 0.34, fz])));
  }, [sx, sz, largura, fundo]);

  return (
    <>
      {/* pista oval vermelha com a faixa branca e o campo, eixo quase norte–sul */}
      <group position={[px, 0.11, pz]} rotation-x={-Math.PI / 2}>
        <mesh name="Pista_Atletismo" scale={[121 * K * 0.55, 191 * K * 0.55, 1]} material={fab.cor("#b5675f", 0.9)} receiveShadow>
          <circleGeometry args={[1, 48]} />
        </mesh>
        <mesh name="Pista_Faixa_Interna" position-z={0.01} scale={[121 * K * 0.44, 191 * K * 0.47, 1]} material={fab.cor("#f1efe8", 0.8)} receiveShadow>
          <circleGeometry args={[1, 48]} />
        </mesh>
        <mesh name="Campo_Futebol" position-z={0.02} scale={[121 * K * 0.42, 191 * K * 0.45, 1]} material={fab.cor("#4e8f3a", 0.9)} receiveShadow>
          <circleGeometry args={[1, 48]} />
        </mesh>
      </group>
      <mesh name="Arquibancada_Pista" geometry={arquibancada} position={[px - 121 * K * 0.62, 0, pz]} material={[fab.cor("#f2f2ef", 0.6), fab.cor("#e2e3df", 0.85)]} castShadow receiveShadow />
      {/* estacionamento solar: piso de asfalto, fileiras de painéis azul-escuros sobre pilares de aço */}
      <mesh name="Estacionamento_Solar_Piso" position={[sx, 0.11, sz]} rotation-x={-Math.PI / 2} material={fab.cor("#7e8182", 0.95)} receiveShadow>
        <planeGeometry args={[largura, fundo]} />
      </mesh>
      <instancedMesh name="Paineis_Solares" ref={paineis} args={[undefined, undefined, 6]} material={mat.painel} castShadow receiveShadow>
        <boxGeometry args={[largura * 0.92, 0.08, fundo / 6 - 0.35]} />
      </instancedMesh>
      <instancedMesh name="Pilares_Paineis" ref={postes} args={[undefined, undefined, 18]} material={mat.aco} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.68, 6]} />
      </instancedMesh>
    </>
  );
}

/** Barras de aula (uma malha só, chanfradas e com a fita de janelas) e a mata que cobre o resto do campus */
function BlocosEMata({ fab, mat }: { fab: Fabrica; mat: Materiais }) {
  const { blocos, arvores, geo } = useMemo(() => {
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
    const a: [number, number, number, number, number][] = [];
    const cores: string[] = [];
    const tons = ["#2f5a2a", "#4a7a3a", "#3a6a30", "#2a5226", "#56813f"];
    for (let x = -30; x <= 30; x += 1.5) {
      for (let z = -30; z <= 30; z += 1.5) {
        const px = x + (rnd() - 0.5) * 1.1;
        const pz = z + (rnd() - 0.5) * 1.1;
        if (Math.hypot(px, pz) > 30 || !dentro([px, pz], campus)) continue;
        if (livres.some(([lx, lz, r]) => Math.hypot(px - lx, pz - lz) < r)) continue;
        if (rnd() < 0.25) continue;
        const s = 0.7 + rnd() * 0.5;
        // a copa encosta no chão (o icosaedro tem meia altura de 0,85 × 0,8 da escala)
        a.push([px, s * 0.62, pz, s, rnd() * Math.PI]);
        cores.push(tons[Math.floor(rnd() * tons.length)]);
      }
    }
    // as barras: caixa chanfrada (paredes com janelas) e a laje de cobertura um pouco recuada, mais cinza
    const pecas: [THREE.BufferGeometry, number[]?][] = [];
    for (const q of b) {
      pecas.push([por(caixaChanfrada(q.c, 2.2, q.l, 0.12), q.x, 0, q.z, q.giro), [0, 1]]);
      pecas.push([por(caixaChanfrada(q.c - 0.5, 0.14, q.l - 0.5, 0.04), q.x, 2.2, q.z, q.giro), [2, 2]]);
    }
    return { blocos: b, arvores: { itens: a, cores }, geo: fundir(pecas) };
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);

  const copas = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = copas.current!;
    posicionar(m, arvores.itens.map(([x, y, z, s, g]) => [x, y, z, s, g]), arvores.cores);
    // achata a copa (0,8 em y) sem perder o giro de cada uma
    const o = new THREE.Matrix4(), e = new THREE.Matrix4().makeScale(1, 0.8, 1);
    for (let i = 0; i < m.count; i++) {
      m.getMatrixAt(i, o);
      m.setMatrixAt(i, o.multiply(e));
    }
    m.instanceMatrix.needsUpdate = true;
  }, [arvores]);

  return (
    <>
      <mesh name="Blocos_Aula" geometry={geo} material={[fab.cor("#e2e3df", 0.85), mat.fachadaBlocos, fab.cor("#cfd1cf", 0.9)]} castShadow receiveShadow />
      <instancedMesh name="Arvores_Mata" ref={copas} args={[undefined, undefined, arvores.itens.length]} material={mat.copa} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
    </>
  );
}

/** Bloco M com o "UNIFOR" pintado em branco no telhado, legível do alto */
function BlocoM({ fab, mat }: { fab: Fabrica; mat: Materiais }) {
  const [x, z] = emM([-81, -5]);
  const c = 70 * K * E;
  const l = 41 * K * E;
  const geo = useMemo(() => caixaChanfrada(c, 3, l, 0.14), [c, l]);
  useEffect(() => () => geo.dispose(), [geo]);
  // lido de norte para sul no satélite: o texto corre ao longo do eixo maior, a 156°
  return (
    <group name="Bloco_M" position={[x, 0, z]} rotation-y={-THREE.MathUtils.degToRad(156 - 90)}>
      <mesh name="Bloco_M_Volume" geometry={geo} material={[fab.cor("#e2e3df", 0.85), mat.fachadaBlocos]} castShadow receiveShadow />
      <mesh name="Bloco_M_Telhado_Letreiro" position-y={3.012} rotation-x={-Math.PI / 2} material={mat.telhadoM} receiveShadow>
        <planeGeometry args={[c * 0.94, l * 0.88]} />
      </mesh>
    </group>
  );
}

export function Unifor({ fab }: { fab: Fabrica }) {
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
  const { chao, avenida, canteiro } = useMemo(() => {
    // Av. Washington Soares na borda oeste, levemente inclinada (6°) e cortada pela borda do pedestal
    const [wx] = emM([-470, 0]);
    const d = THREE.MathUtils.degToRad(6);
    return {
      // gramado como uma laje fina de 10 cm com a borda chanfrada: o campus ganha uma aresta nítida sobre a base
      chao: prismaDePlanta(CAMPUS.map(emM), 0.1, 0, 0.03),
      avenida: placaDePlanta(faixaNoDisco(wx - 0.9, 0, Math.sin(d), -Math.cos(d), 2.4), 0.02),
      canteiro: placaDePlanta(faixaNoDisco(wx - 0.9, 0, Math.sin(d), -Math.cos(d), 0.28, RAIO_UTIL - 0.4), 0.05),
    };
  }, []);
  useEffect(
    () => () => {
      chao.dispose();
      avenida.dispose();
      canteiro.dispose();
    },
    [chao, avenida, canteiro],
  );
  const [lx, lz] = emM([312, 294]);
  const giroLago = -THREE.MathUtils.degToRad(107 - 90);
  return (
    <group name="Unifor">
      <mesh name="Gramado_Campus" geometry={chao} material={[mat.gramado, fab.cor("#6d8a4a", 0.95)]} receiveShadow />
      <mesh name="Av_Washington_Soares" geometry={avenida} material={fab.cor("#5c5f61", 0.95)} receiveShadow />
      <mesh name="Av_Washington_Soares_Canteiro" geometry={canteiro} material={fab.cor("#d8d4c8", 0.9)} receiveShadow />
      {/* laguinho, fora da cerca no nordeste, com a margem de areia */}
      <group position={[lx, 0, lz]} rotation={[-Math.PI / 2, 0, giroLago]}>
        <mesh name="Lago_Margem" position-z={0.045} scale={[284 * K * 0.54, 115 * K * 0.58, 1]} material={fab.cor("#cfc6a6", 0.95)} receiveShadow>
          <circleGeometry args={[1, 32]} />
        </mesh>
        <mesh name="Lago_Agua" position-z={0.07} scale={[284 * K * 0.5, 115 * K * 0.5, 1]} material={fab.agua()} receiveShadow>
          <circleGeometry args={[1, 32]} />
        </mesh>
      </group>

      <Extrudado nome="Reitoria" local={REITORIA} em={[-403, -18]} altura={3.2} paredes={mat.fachadaReitoria} telhado={fab.cor("#e9e8df", 0.8)} />
      <Extrudado nome="Biblioteca" local={BIBLIOTECA} em={[-309, -2]} altura={2.6} paredes={mat.fachadaBlocos} telhado={fab.cor("#e2e3df", 0.85)} />
      <CentroDeConvivencia fab={fab} mat={mat} />
      <BlocoM fab={fab} mat={mat} />
      <Ginasio fab={fab} mat={mat} />
      <PistaEEstacionamentoSolar fab={fab} mat={mat} />
      <BlocosEMata fab={fab} mat={mat} />
    </group>
  );
}
