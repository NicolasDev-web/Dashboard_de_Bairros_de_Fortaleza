import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Fabrica } from "../Cena";
import { caixaChanfrada } from "../util/geometria";
import dados from "../../blender/saida/iguatemi-dados.json";

/**
 * Miniatura do Shopping Iguatemi Bosque (Edson Queiroz), refeita do zero sobre a planta real do OSM.
 *
 * A arquitetura e o chão vêm prontos do Blender (`blender/iguatemi.py` → `blender/saida/iguatemi-shopping.glb`),
 * já com a oclusão de ambiente assada em vertex color. Aqui entram só:
 * - as texturas de canvas (grelha do vidro verde, grelha do vidro escuro, grelha de madeira vista através do
 *   policarbonato e juntas de painel das fachadas);
 * - o que se repete às centenas: a mata do Cocó, as árvores de rua, as palmeiras do jardim, os carros e os postes.
 *   As posições saem do mesmo script (`iguatemi-dados.json`), para usar a mesma escala da planta.
 *
 * Escala: K = 0,135 no miolo, com compressão radial suave depois de 170 m reais. Norte em −z.
 */

const URL_PECAS = "/blender/saida/iguatemi-shopping.glb";

type Dados = { arvores: number[][]; palmeiras: number[][]; carros: number[][]; postes: number[][] };
const D = dados as Dados;

// ——— Texturas de canvas (4, até 128 px; UV em metros vindas do Blender) ———

function textura(tam: number, desenhar: (g: CanvasRenderingContext2D, t: number) => void) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = tam;
  desenhar(cv.getContext("2d")!, tam);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Vidro verde da proa (2015) em grelha metálica branca: 1 m de lado, montante a cada 0,5 m e travessa a cada 0,5 m */
function texturaVidroVerde() {
  return textura(128, (g, t) => {
    const grad = g.createLinearGradient(0, 0, 0, t);
    grad.addColorStop(0, "#6fae9b");
    grad.addColorStop(1, "#3f7a6b");
    g.fillStyle = grad;
    g.fillRect(0, 0, t, t);
    g.fillStyle = "rgba(255,255,255,.10)";
    g.fillRect(t * 0.08, 0, t * 0.12, t);
    g.fillRect(t * 0.58, 0, t * 0.12, t);
    g.fillStyle = "#f4f6f2";
    for (const x of [0, t / 2]) g.fillRect(x - 3, 0, 6, t);
    g.fillRect(0, t - 5, t, 5);
    g.fillRect(0, t / 2 - 2, t, 3);
  });
}

/** Vidro escuro das claraboias, da lente, da pirâmide e do plano inclinado: caixilhos brancos a cada 1/3 m */
function texturaVidroEscuro() {
  return textura(96, (g, t) => {
    g.fillStyle = "#2f4a63";
    g.fillRect(0, 0, t, t);
    g.fillStyle = "rgba(170,210,235,.16)";
    for (let i = 0; i < 3; i++) g.fillRect((i * t) / 3 + 6, 4, t / 3 - 18, t / 2.4);
    g.fillStyle = "#e9eef0";
    for (let i = 0; i < 3; i++) {
      g.fillRect((i * t) / 3, 0, 3, t);
      g.fillRect(0, (i * t) / 3, t, 2);
    }
  });
}

/**
 * Cobertura do Garden Court vista de fora: policarbonato leitoso com a grelha de madeira laminada colada por baixo.
 * Uma célula = um vão entre dois arcos (u) e duas terças (v); o arco é a linha grossa, a terça a fina.
 */
function texturaMadeira() {
  return textura(128, (g, t) => {
    g.fillStyle = "#f2e8d2";
    g.fillRect(0, 0, t, t);
    const grad = g.createLinearGradient(0, 0, t, 0);
    grad.addColorStop(0, "rgba(196,146,90,.28)");
    grad.addColorStop(0.5, "rgba(255,255,255,0)");
    grad.addColorStop(1, "rgba(196,146,90,.28)");
    g.fillStyle = grad;
    g.fillRect(0, 0, t, t);
    g.fillStyle = "#b07a45";
    g.fillRect(0, 0, 13, t); // arco principal (20 × 140 cm na obra)
    g.fillStyle = "#c69561";
    g.fillRect(0, 0, t, 6); // terça
    g.fillStyle = "rgba(255,255,255,.35)";
    g.fillRect(15, 8, 3, t - 8); // brilho do policarbonato ao lado do arco
  });
}

/** Juntas de painel discretas nas fachadas das galerias (1 m), com a linha de laje mais marcada */
function texturaPaineis() {
  return textura(64, (g, t) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, t, t);
    g.fillStyle = "rgba(60,50,40,.10)";
    g.fillRect(0, 0, 2, t);
    g.fillRect(t / 2, 0, 1, t);
    g.fillStyle = "rgba(60,50,40,.16)";
    g.fillRect(0, t - 3, t, 3);
  });
}

/** Sombras e texturas nas peças do Blender (o GLB não guarda as marcações de sombra nem as texturas de canvas) */
function prepararPecas(raiz: THREE.Object3D) {
  const cena = raiz.clone(true);
  const mapas: Record<string, () => THREE.Texture> = {
    Mat_Vidro_Verde_Fachada: texturaVidroVerde,
    Mat_Vidro_Escuro: texturaVidroEscuro,
    Mat_Policarbonato_Madeira: texturaMadeira,
    Mat_Fachada_Galerias: texturaPaineis,
  };
  const feitos = new Map<THREE.Material, THREE.Material>();
  cena.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    // as placas do chão não projetam sombra (são finas e só sujariam o shadow map)
    if (/^(Chao|Ruas|Estacionamento|Jardim)/.test(m.name)) m.castShadow = false;
    const mat = m.material as THREE.MeshStandardMaterial;
    let novo = feitos.get(mat) as THREE.MeshStandardMaterial | undefined;
    if (!novo) {
      novo = mat.clone();
      novo.name = mat.name;
      const fazer = mapas[mat.name];
      if (fazer) {
        novo.map = fazer();
        // a cor já está desenhada na textura (as fachadas mantêm o tom do material)
        if (mat.name !== "Mat_Fachada_Galerias") novo.color.set("#ffffff");
      }
      feitos.set(mat, novo);
    }
    m.material = novo;
  });
  return cena;
}

export function Iguatemi({ fab }: { fab: Fabrica }) {
  const gltf = useLoader(GLTFLoader, URL_PECAS);
  const pecas = useMemo(() => prepararPecas(gltf.scene), [gltf]);
  return (
    <group name="Iguatemi_Bosque">
      <primitive object={pecas} />
      <Arvores fab={fab} />
      <Palmeiras fab={fab} />
      <Carros fab={fab} />
      <Postes fab={fab} />
    </group>
  );
}

// ——— Vegetação ———

/** Copa em icosaedro achatado com tronco; mata do Cocó (tipo 0) mais escura e densa, árvores de rua (tipo 1) mais claras */
function Arvores({ fab }: { fab: Fabrica }) {
  const copa = useRef<THREE.InstancedMesh>(null);
  const tronco = useRef<THREE.InstancedMesh>(null);
  const n = D.arvores.length;
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const MATA = ["#2e5527", "#3a6430", "#2a4d24", "#467338", "#335d2b"];
    const RUA = ["#4f7d3a", "#5d8a42", "#46753a"];
    D.arvores.forEach(([x, z, e, tipo], i) => {
      const h = tipo === 0 ? 1.1 + e * 0.7 : 0.7 + e * 0.6;
      o.position.set(x, h + e * 0.55, z);
      o.rotation.set(0, (i * 2.399) % (Math.PI * 2), 0);
      o.scale.set(e, e * (tipo === 0 ? 0.78 : 0.85), e);
      o.updateMatrix();
      copa.current!.setMatrixAt(i, o.matrix);
      const paleta = tipo === 0 ? MATA : RUA;
      copa.current!.setColorAt(i, cor.set(paleta[(i * 7) % paleta.length]));
      o.position.set(x, 0, z);
      o.scale.set(e * 0.8, h + 0.2, e * 0.8);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      tronco.current!.setMatrixAt(i, o.matrix);
    });
    copa.current!.instanceMatrix.needsUpdate = true;
    if (copa.current!.instanceColor) copa.current!.instanceColor.needsUpdate = true;
    tronco.current!.instanceMatrix.needsUpdate = true;
    copa.current!.computeBoundingSphere();
    tronco.current!.computeBoundingSphere();
  }, []);
  const geoTronco = useMemo(() => new THREE.CylinderGeometry(0.1, 0.15, 1, 6).translate(0, 0.5, 0), []);
  return (
    <>
      <instancedMesh name="Arvores_Copas" ref={copa} args={[undefined, undefined, n]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial name="Mat_Arvores_Copas" roughness={0.92} />
      </instancedMesh>
      <instancedMesh name="Arvores_Troncos" ref={tronco} args={[geoTronco, fab.cor("#6e5a45"), n]} castShadow />
    </>
  );
}

const FOLHAS = 7;

/** Folha de palmeira (mesma do Messejana.tsx): tira em "V" raso que sobe e cai em arco; base na origem, em +z */
function geometriaFolha(comp = 1.5) {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = 0.3 * t - 0.8 * t * t;
    const w = t < 0.15 ? 0.04 + t * 0.9 : 0.17 * (1 - t) + 0.02;
    const z = comp * t;
    pos.push(-w, y - 0.04, z, 0, y, z, w, y - 0.04, z);
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

/** Palmeiras dos canteiros do jardim (vista aérea: copas em estrela entre os caminhos) */
function Palmeiras({ fab }: { fab: Fabrica }) {
  const caule = useRef<THREE.InstancedMesh>(null);
  const folha = useRef<THREE.InstancedMesh>(null);
  const n = D.palmeiras.length;
  const recursos = useMemo(() => {
    const folhas = new THREE.MeshStandardMaterial({ color: "#6b9b3f", roughness: 0.8, side: THREE.DoubleSide });
    folhas.name = "Mat_Folha_Palmeira";
    return { folhas, geo: geometriaFolha(), geoCaule: new THREE.CylinderGeometry(0.06, 0.1, 1, 6).translate(0, 0.5, 0) };
  }, []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    D.palmeiras.forEach(([x, z, e], i) => {
      const h = 2.0 * e;
      o.position.set(x, 0, z);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      caule.current!.setMatrixAt(i, o.matrix);
      for (let f = 0; f < FOLHAS; f++) {
        o.rotation.set(f % 2 ? -0.35 : 0.05, i * 0.7 + (f / FOLHAS) * Math.PI * 2, 0, "YXZ");
        o.position.set(x, h - 0.05, z);
        o.scale.setScalar((f % 2 ? 0.85 : 1) * e);
        o.updateMatrix();
        folha.current!.setMatrixAt(i * FOLHAS + f, o.matrix);
        folha.current!.setColorAt(i * FOLHAS + f, cor.set(f % 3 ? "#ffffff" : "#d9e6c4"));
      }
    });
    caule.current!.instanceMatrix.needsUpdate = true;
    folha.current!.instanceMatrix.needsUpdate = true;
    if (folha.current!.instanceColor) folha.current!.instanceColor.needsUpdate = true;
    caule.current!.computeBoundingSphere();
    folha.current!.computeBoundingSphere();
  }, []);
  return (
    <>
      <instancedMesh name="Palmeiras_Estipes" ref={caule} args={[recursos.geoCaule, fab.cor("#8b7355"), n]} castShadow />
      <instancedMesh name="Palmeiras_Folhas" ref={folha} args={[recursos.geo, recursos.folhas, n * FOLHAS]} castShadow />
    </>
  );
}

// ——— Carros e postes ———

const CORES_CARROS = ["#e9ebec", "#2d3136", "#b8bdc2", "#a3262a", "#e9ebec", "#5b6772", "#1f4f8f"];

/** Carro: caixa chanfrada com a cabine recuada (0,3 × 0,64 m: um pouco acima da escala, para ler de longe) */
function Carros({ fab }: { fab: Fabrica }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => mergeGeometries([caixaChanfrada(0.3, 0.13, 0.64, 0.035), caixaChanfrada(0.26, 0.11, 0.34, 0.03).translate(0, 0.12, 0.03)]), []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    D.carros.forEach(([x, y, z, giro, c], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, giro, 0);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
      ref.current!.setColorAt(i, cor.set(CORES_CARROS[c % CORES_CARROS.length]));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, []);
  return <instancedMesh name="Carros" ref={ref} args={[geo, fab.cor("#ffffff", 0.45), D.carros.length]} castShadow receiveShadow />;
}

/** Postes de luz no canteiro central da Washington Soares */
function Postes({ fab }: { fab: Fabrica }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => mergeGeometries([new THREE.CylinderGeometry(0.035, 0.05, 1.9, 6).translate(0, 0.95, 0), new THREE.BoxGeometry(0.1, 0.05, 0.9).translate(0, 1.88, 0)]), []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    D.postes.forEach(([x, z, giro], i) => {
      o.position.set(x, 0.07, z);
      o.rotation.set(0, giro + Math.PI / 2, 0);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, []);
  return <instancedMesh name="Postes_Avenida" ref={ref} args={[geo, fab.cor("#8d949b", 0.5), D.postes.length]} castShadow />;
}
