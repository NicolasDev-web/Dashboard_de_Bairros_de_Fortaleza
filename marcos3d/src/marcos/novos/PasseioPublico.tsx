import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Fabrica } from "../../Cena";
import { aleatorio, texturaManchada } from "../../util/geometria";
import layout from "../../../blender/saida/passeioPublico-layout.json";

/**
 * Passeio Público (Praça dos Mártires), a praça mais antiga de Fortaleza, no alto da colina sobre a Leste-Oeste.
 * As peças estáticas vêm do Blender (`blender/passeioPublico.py` → `blender/saida/passeioPublico-praca.glb`), com a
 * oclusão de ambiente assada nas cores de vértice:
 * - os três planos que descem para o mar: a praça (1º), o degrau do Exército (2º) e a avenida (3º);
 * - a planta real das alamedas (OSM), o gradil com colunas e portões, a mureta da Avenida Caio Prado;
 * - a fonte com os peixes, o baobá de 1910, as estátuas greco-romanas, os bustos e o Café Passeio;
 * - a beira do quartel do Forte (a leste), a Santa Casa (a oeste), o casario da Dr. João Moreira.
 *
 * Aqui entram o que é repetido (árvores, palmeiras, postes, bancos, mesas do café, carros, gente), a telha e o piso
 * das alamedas desenhados em canvas, e a água comum dos marcos. Posições em `blender/saida/passeioPublico-layout.json`.
 * Metros, norte em −z; fontes em pesquisa/passeioPublico/ficha.md.
 */

/** Acima das copas mais altas e da cumeeira do quartel (≈ 9,7 m) */
export const ALTURA_ETIQUETA = 11;

const BASE = "/blender/saida/";

type Arvore = [x: number, y: number, z: number, r: number, h: number, tipo: number];
type Palmeira = [x: number, y: number, z: number, h: number, giro: number, tipo: number];
type Ponto = [x: number, y: number, z: number];
type Giro = [x: number, y: number, z: number, giro: number];
type Carro = [x: number, y: number, z: number, giro: number, cor: number];
const L = layout as {
  arvores: Arvore[]; palmeiras: Palmeira[]; postes: Ponto[]; bancos: Giro[]; mesas: Ponto[]; carros: Carro[]; pessoas: Carro[];
};

/** Telha cerâmica capa-e-canal (128 px, repete): a mesma do modelo do Forte, para o quartel ficar igual nos dois */
function texturaTelha() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d")!;
  const r = aleatorio(31);
  const tons = ["#b8634a", "#b05a43", "#bf6c50", "#a9553f", "#c47457"];
  for (let f = 0; f < 4; f++) {
    for (let c = 0; c < 6; c++) {
      const x = (c * 128) / 6, y = f * 32, w = 128 / 6;
      g.fillStyle = tons[Math.floor(r() * tons.length)];
      g.fillRect(x, y, w, 32);
      g.fillStyle = "rgba(255,235,210,0.18)";
      g.fillRect(x + w * 0.3, y, w * 0.32, 32);
      g.fillStyle = "rgba(60,20,10,0.28)";
      g.fillRect(x, y, 2, 32);
    }
    g.fillStyle = "rgba(60,20,10,0.35)";
    g.fillRect(0, f * 32 + 28, 128, 4);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/**
 * Piso das alamedas (128 px = 1,5 m, repete): blocos de concreto claros em fiadas desencontradas, como o
 * `surface=paving_stones` do OSM, com juntas finas e variação de tom de bloco para bloco.
 */
function texturaPavimento() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#b9b09e";
  g.fillRect(0, 0, 128, 128);
  const r = aleatorio(1864);
  const tons = ["#ddd4c2", "#d6ccb9", "#e2dacb", "#d0c6b2", "#dad1bf"];
  for (let f = 0; f < 8; f++) {
    const off = f % 2 ? 16 : 0;
    for (let c = -1; c < 5; c++) {
      const x = c * 32 + off, y = f * 16;
      g.fillStyle = tons[Math.floor(r() * tons.length)];
      g.fillRect(x + 1, y + 1, 30, 14);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Peças do Blender: sombras, nomes por material, água comum, telha, piso das alamedas e pisos manchados */
function PecasBlender({ fab }: { fab: Fabrica }) {
  const gltf = useLoader(GLTFLoader, `${BASE}passeioPublico-praca.glb`);
  const extras = useMemo(() => {
    const telha = texturaTelha();
    const pavimento = texturaPavimento();
    const mancha = texturaManchada("#ffffff", 0.09, 17, 64);
    mancha.repeat.set(10, 10);
    return { telha, pavimento, mancha };
  }, []);
  useEffect(() => () => { Object.values(extras).forEach((t) => t.dispose()); }, [extras]);
  const cena = useMemo(() => {
    const raiz = gltf.scene.clone(true);
    raiz.name = "Pecas_Passeio";
    const trocas = new Map<THREE.Material, THREE.Material>();
    const manchados = ["Mat_Chao_Grama", "Mat_Chao_Paralelepipedo", "Mat_Chao_Calcada", "Mat_Chao_Concreto", "Mat_Chao_Lajota"];
    raiz.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const pai = m.parent && m.parent !== raiz ? m.parent.name : m.name;
      m.name = `${pai}_${mat.name.replace(/^Mat_/, "")}`;
      const chao = mat.name.startsWith("Mat_Chao_") || mat.name === "Mat_Agua";
      m.castShadow = !chao;
      m.receiveShadow = true;
      let novo = trocas.get(mat);
      if (!novo) {
        novo = mat;
        if (mat.name === "Mat_Agua") novo = fab.agua();
        else if (mat.name === "Mat_Telha_Ceramica") {
          mat.map = extras.telha;
          mat.color.set("#ffffff");
          mat.needsUpdate = true;
        } else if (mat.name === "Mat_Chao_Caminho") {
          mat.map = extras.pavimento;
          mat.color.set("#ffffff");
          mat.needsUpdate = true;
        } else if (manchados.includes(mat.name)) {
          mat.map = extras.mancha;
          mat.needsUpdate = true;
        }
        trocas.set(mat, novo);
      }
      m.material = novo;
    });
    return raiz;
  }, [gltf, fab, extras]);
  return <primitive object={cena} />;
}

/** Material do GLB pelo nome (o ferro do gradil e o mármore servem também aos postes) */
function useMaterialDoGlb(nome: string) {
  const gltf = useLoader(GLTFLoader, `${BASE}passeioPublico-praca.glb`);
  return useMemo(() => {
    let achado: THREE.Material | null = null;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!achado && m.isMesh && (m.material as THREE.Material).name === nome) achado = m.material as THREE.Material;
    });
    return achado ?? new THREE.MeshStandardMaterial({ name: nome });
  }, [gltf, nome]);
}

/** Atualiza matrizes e cores de uma lista de InstancedMesh */
function finalizar(ms: THREE.InstancedMesh[]) {
  for (const m of ms) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }
}

/** Copa em nuvem: cinco bolas de icosaedro coladas (raio 1), mais larga que alta, para o bosque não parecer de bolinhas */
function geometriaCopa() {
  const partes: THREE.BufferGeometry[] = [];
  const r = aleatorio(5);
  const bolas: [number, number, number, number][] = [[0, 0.05, 0, 0.72], [0.48, -0.08, 0.18, 0.55], [-0.42, -0.05, 0.3, 0.56], [0.1, -0.1, -0.5, 0.55], [-0.2, 0.3, -0.12, 0.5]];
  for (const [x, y, z, s] of bolas) {
    const g = new THREE.IcosahedronGeometry(s, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + (r() - 0.5) * 0.12) + x, p.getY(i) + y, p.getZ(i) * (1 + (r() - 0.5) * 0.12) + z);
    partes.push(g.toNonIndexed());
  }
  const g = mergeGeometries(partes)!;
  g.computeVertexNormals();
  partes.forEach((p) => p.dispose());
  return g;
}

/**
 * Árvores: as do OSM dentro do gradil (as tombadas com o porte da espécie: o Benjamin é a copa maior e mais escura;
 * mungubeiras, timbaúba e pau-d'arco em copa larga) e o preenchimento do bosque; poucas no 2º plano e na avenida.
 * Tronco alto, para ver por baixo das copas as alamedas, as estátuas e a fonte.
 */
function Arvores({ fab }: { fab: Fabrica }) {
  const copa = useRef<THREE.InstancedMesh>(null);
  const tronco = useRef<THREE.InstancedMesh>(null);
  const n = L.arvores.length;
  const geo = useMemo(() => ({ copa: geometriaCopa(), tronco: new THREE.CylinderGeometry(0.1, 0.17, 1, 6).translate(0, 0.5, 0) }), []);
  useEffect(() => () => { geo.copa.dispose(); geo.tronco.dispose(); }, [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const r = aleatorio(7);
    const tons = [["#2f5a2b", "#3d6b33", "#2a4f27", "#355f2e", "#456f36"], ["#4c7a3a", "#5a8541", "#3f6f34", "#53803d"], ["#24461f", "#28501f"]];
    L.arvores.forEach(([x, y, z, raio, h, tipo], i) => {
      const achatar = tipo === 1 ? 0.62 : tipo === 2 ? 0.7 : 0.8;
      o.position.set(x, y + h + raio * achatar * 0.55, z);
      o.scale.set(raio, raio * achatar, raio * (0.92 + r() * 0.16));
      o.rotation.set(0, r() * Math.PI * 2, 0);
      o.updateMatrix();
      copa.current!.setMatrixAt(i, o.matrix);
      const lista = tons[tipo] ?? tons[0];
      copa.current!.setColorAt(i, cor.set(lista[Math.floor(r() * lista.length)]));
      o.position.set(x, y, z);
      const grosso = tipo === 2 ? 2.7 : raio > 2.3 ? 2.0 : 1.6;
      o.scale.set(grosso, h + raio * achatar * 0.4, grosso);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      tronco.current!.setMatrixAt(i, o.matrix);
    });
    finalizar([copa.current!, tronco.current!]);
  }, []);
  return (
    <>
      <instancedMesh name="Arvores_Copas" ref={copa} args={[geo.copa, undefined, n]} castShadow receiveShadow>
        <meshStandardMaterial name="Mat_Copa_Arvore" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh name="Arvores_Troncos" ref={tronco} args={[geo.tronco, undefined, n]} castShadow material={fab.cor("#6e5a45")} />
    </>
  );
}

/**
 * Folha de palmeira: tipo 0, leque da carnaúba (pregas em raio); tipo 1, folha de pena da macaúba (tira em "V" que cai
 * em arco). Base na origem, correndo em +z.
 */
function geometriaFolha(tipo: number) {
  const pos: number[] = [];
  const idx: number[] = [];
  if (tipo === 0) {
    // leque: pecíolo curto e lâmina em semicírculo pregueado
    const n = 9, R = 0.78, l0 = 0.22;
    pos.push(0, 0, 0);
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI * 0.42 + (Math.PI * 0.84 * i) / n;
      const rr = i % 2 ? R : R * 0.9;
      pos.push(Math.sin(a) * rr, 0.2 + (i % 2 ? 0.06 : -0.04) - Math.abs(Math.sin(a)) * 0.25, l0 + Math.cos(a) * rr);
    }
    for (let i = 1; i <= n; i++) idx.push(0, i, i + 1);
  } else {
    const n = 7, comp = 2.0, queda = 1.3;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = 0.5 * t - queda * t * t;
      const w = t < 0.15 ? 0.06 + t * 1.6 : 0.3 * (1 - t) + 0.03;
      const z = comp * t;
      pos.push(-w, y - 0.07, z, 0, y, z, w, y - 0.07, z);
    }
    for (let i = 0; i < n; i++) {
      const a = i * 3, b = a + 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const FOLHAS = 11;

/** Carnaúbas da homenagem aos revolucionários (fileira junto ao gradil sul) e a macaúba tombada: estipe reto e coroa */
function Palmeiras({ fab }: { fab: Fabrica }) {
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];
  const estipe = useRef<THREE.InstancedMesh>(null);
  const rec = useMemo(() => ({
    folhas: Object.assign(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8, side: THREE.DoubleSide }), { name: "Mat_Folha_Palmeira" }),
    folha0: geometriaFolha(0),
    folha1: geometriaFolha(1),
    estipe: new THREE.CylinderGeometry(0.1, 0.14, 1, 6).translate(0, 0.5, 0),
  }), []);
  useEffect(() => () => { Object.values(rec).forEach((x) => x.dispose()); }, [rec]);
  const porTipo = [L.palmeiras.filter((p) => p[5] === 0), L.palmeiras.filter((p) => p[5] === 1)];
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    L.palmeiras.forEach(([x, y, z, h], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      estipe.current!.setMatrixAt(i, o.matrix);
    });
    porTipo.forEach((lista, tipo) => {
      lista.forEach(([x, y, z, h, g], i) => {
        for (let f = 0; f < FOLHAS; f++) {
          const a = g + (f / FOLHAS) * Math.PI * 2;
          // carnaúba: leques em várias alturas, inclinados para cima; macaúba: folhas em arco
          const sobe = tipo === 0 ? (f % 3 === 0 ? -0.9 : f % 3 === 1 ? -0.45 : 0.05) : f % 2 ? -0.35 : 0.1;
          o.position.set(x, y + h - (tipo === 0 ? (f % 3) * 0.12 : 0), z);
          o.rotation.set(sobe, a, 0, "YXZ");
          o.scale.setScalar(tipo === 0 ? 1.05 : 1);
          o.updateMatrix();
          refs[tipo].current!.setMatrixAt(i * FOLHAS + f, o.matrix);
          refs[tipo].current!.setColorAt(i * FOLHAS + f, cor.set(tipo === 0 ? (f % 2 ? "#7f9f63" : "#8aa96d") : f % 3 ? "#5f9440" : "#7aa257"));
        }
      });
    });
    finalizar([estipe.current!, ...refs.map((r) => r.current!)]);
  }, []);
  return (
    <>
      <instancedMesh name="Palmeiras_Estipes" ref={estipe} args={[rec.estipe, undefined, L.palmeiras.length]} castShadow material={fab.cor("#8a7d6a")} />
      <instancedMesh name="Carnaubas_Folhas" ref={refs[0]} args={[rec.folha0, rec.folhas, Math.max(1, porTipo[0].length * FOLHAS)]} castShadow />
      <instancedMesh name="Macauba_Folhas" ref={refs[1]} args={[rec.folha1, rec.folhas, Math.max(1, porTipo[1].length * FOLHAS)]} castShadow />
    </>
  );
}

/**
 * Postes de ferro das alamedas (`lit=yes`): base, fuste fino, capitel e lanterna de globo branco (2,6 m). O ferro e o
 * vidro usam o ferro do gradil e o mármore claro do GLB.
 */
function Postes() {
  const ferro = useMaterialDoGlb("Mat_Grade_Ferro");
  const branco = useMaterialDoGlb("Mat_Marmore");
  const poste = useRef<THREE.InstancedMesh>(null);
  const globo = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const base = new THREE.CylinderGeometry(0.1, 0.13, 0.28, 8).translate(0, 0.14, 0);
    const fuste = new THREE.CylinderGeometry(0.035, 0.05, 2.1, 6).translate(0, 1.33, 0);
    const capitel = new THREE.CylinderGeometry(0.09, 0.05, 0.1, 8).translate(0, 2.42, 0);
    const chapeu = new THREE.ConeGeometry(0.17, 0.14, 8).translate(0, 2.83, 0);
    const p = mergeGeometries([base.toNonIndexed(), fuste.toNonIndexed(), capitel.toNonIndexed(), chapeu.toNonIndexed()])!;
    [base, fuste, capitel, chapeu].forEach((g) => g.dispose());
    return { poste: p, globo: new THREE.IcosahedronGeometry(0.14, 1).translate(0, 2.62, 0) };
  }, []);
  useEffect(() => () => { geo.poste.dispose(); geo.globo.dispose(); }, [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    L.postes.forEach(([x, y, z], i) => {
      o.position.set(x, y, z);
      o.updateMatrix();
      poste.current!.setMatrixAt(i, o.matrix);
      globo.current!.setMatrixAt(i, o.matrix);
    });
    finalizar([poste.current!, globo.current!]);
  }, []);
  return (
    <>
      <instancedMesh name="Postes_Ferro" ref={poste} args={[geo.poste, ferro, L.postes.length]} castShadow />
      <instancedMesh name="Postes_Globos" ref={globo} args={[geo.globo, branco, L.postes.length]} />
    </>
  );
}

/** Bancos de madeira com encosto (OSM: bench, backrest, wood): assento e encosto de ripas, pés de ferro */
function Bancos({ fab }: { fab: Fabrica }) {
  const ferro = useMaterialDoGlb("Mat_Grade_Ferro");
  const madeira = useRef<THREE.InstancedMesh>(null);
  const pes = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const assento = new THREE.BoxGeometry(1.15, 0.06, 0.36).translate(0, 0.4, 0.02);
    const encosto = new THREE.BoxGeometry(1.15, 0.28, 0.05).rotateX(-0.2).translate(0, 0.62, -0.17);
    const m = mergeGeometries([assento.toNonIndexed(), encosto.toNonIndexed()])!;
    const pe1 = new THREE.BoxGeometry(0.05, 0.4, 0.36).translate(-0.48, 0.2, 0);
    const pe2 = new THREE.BoxGeometry(0.05, 0.4, 0.36).translate(0.48, 0.2, 0);
    const p = mergeGeometries([pe1.toNonIndexed(), pe2.toNonIndexed()])!;
    [assento, encosto, pe1, pe2].forEach((g) => g.dispose());
    return { madeira: m, pes: p };
  }, []);
  useEffect(() => () => { geo.madeira.dispose(); geo.pes.dispose(); }, [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    L.bancos.forEach(([x, y, z, g], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, g, 0);
      o.updateMatrix();
      madeira.current!.setMatrixAt(i, o.matrix);
      pes.current!.setMatrixAt(i, o.matrix);
    });
    finalizar([madeira.current!, pes.current!]);
  }, []);
  return (
    <>
      <instancedMesh name="Bancos_Madeira" ref={madeira} args={[geo.madeira, undefined, L.bancos.length]} castShadow receiveShadow material={fab.cor("#86603e", 0.8)} />
      <instancedMesh name="Bancos_Pes" ref={pes} args={[geo.pes, ferro, L.bancos.length]} castShadow />
    </>
  );
}

/** Mesas do Café Passeio ao ar livre, sob as árvores: mesa redonda, cadeiras e guarda-sol claro (cor não confirmada) */
function MesasCafe() {
  const ferro = useMaterialDoGlb("Mat_Grade_Ferro");
  const mesa = useRef<THREE.InstancedMesh>(null);
  const sol = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const tampo = new THREE.CylinderGeometry(0.34, 0.34, 0.04, 10).translate(0, 0.5, 0);
    const pe = new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5).translate(0, 0.7, 0);
    const cad: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) cad.push(new THREE.BoxGeometry(0.26, 0.04, 0.26).translate(s * 0.5, 0.32, 0).toNonIndexed(), new THREE.BoxGeometry(0.04, 0.3, 0.26).translate(s * 0.64, 0.48, 0).toNonIndexed());
    const m = mergeGeometries([tampo.toNonIndexed(), pe.toNonIndexed(), ...cad])!;
    tampo.dispose();
    pe.dispose();
    return { mesa: m, sol: new THREE.ConeGeometry(0.85, 0.32, 8).translate(0, 1.5, 0) };
  }, []);
  useEffect(() => () => { geo.mesa.dispose(); geo.sol.dispose(); }, [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    L.mesas.forEach(([x, y, z], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, i * 0.7, 0);
      o.updateMatrix();
      mesa.current!.setMatrixAt(i, o.matrix);
      sol.current!.setMatrixAt(i, o.matrix);
      sol.current!.setColorAt(i, cor.set(i % 3 ? "#efe7d2" : "#e2d6b8"));
    });
    finalizar([mesa.current!, sol.current!]);
  }, []);
  const n = Math.max(1, L.mesas.length);
  return (
    <>
      <instancedMesh name="Cafe_Mesas" ref={mesa} args={[geo.mesa, ferro, n]} castShadow />
      <instancedMesh name="Cafe_Guarda_Sois" ref={sol} args={[geo.sol, undefined, n]} castShadow>
        <meshStandardMaterial name="Mat_Guarda_Sol" roughness={0.85} flatShading />
      </instancedMesh>
    </>
  );
}

/** Carros na Dr. João Moreira, na Barão do Rio Branco (que desce até a avenida), na Floriano e nas pistas da Leste-Oeste */
function Carros({ fab }: { fab: Fabrica }) {
  const corpo = useRef<THREE.InstancedMesh>(null);
  const cabine = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => ({
    c: new THREE.BoxGeometry(1.75, 0.4, 0.8).translate(0, 0.28, 0),
    k: new THREE.BoxGeometry(0.95, 0.32, 0.7).translate(-0.1, 0.62, 0),
  }), []);
  useEffect(() => () => { geo.c.dispose(); geo.k.dispose(); }, [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const tons = ["#f2f2ef", "#c8ccd0", "#2b2f36", "#8e959c", "#b33a32", "#f2f2ef", "#1f4e8c", "#d9d4c4"];
    L.carros.forEach(([x, y, z, g, k], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, g, 0);
      o.updateMatrix();
      corpo.current!.setMatrixAt(i, o.matrix);
      cabine.current!.setMatrixAt(i, o.matrix);
      corpo.current!.setColorAt(i, cor.set(tons[k % tons.length]));
    });
    finalizar([corpo.current!, cabine.current!]);
  }, []);
  const n = L.carros.length;
  return (
    <>
      <instancedMesh name="Carros_Carroceria" ref={corpo} args={[geo.c, undefined, n]} castShadow receiveShadow>
        <meshStandardMaterial name="Mat_Carroceria" roughness={0.45} metalness={0.2} />
      </instancedMesh>
      <instancedMesh name="Carros_Cabine" ref={cabine} args={[geo.k, undefined, n]} castShadow material={fab.cor("#2c3540", 0.3)} />
    </>
  );
}

/** Gente nas alamedas, em volta da fonte e do baobá, nas mesas do café, na Caio Prado e nas calçadas */
function Pessoas({ fab }: { fab: Fabrica }) {
  const corpo = useRef<THREE.InstancedMesh>(null);
  const cabeca = useRef<THREE.InstancedMesh>(null);
  const pernas = useRef<THREE.InstancedMesh>(null);
  const rec = useMemo(() => ({
    corpo: new THREE.CylinderGeometry(0.1, 0.12, 0.36, 7).translate(0, 0.5, 0),
    cabeca: new THREE.IcosahedronGeometry(0.085, 1).translate(0, 0.77, 0),
    pernas: new THREE.CylinderGeometry(0.08, 0.07, 0.34, 6).translate(0, 0.17, 0),
    mat: Object.assign(new THREE.MeshStandardMaterial({ roughness: 0.8 }), { name: "Mat_Pessoas" }),
  }), []);
  useEffect(() => () => { Object.values(rec).forEach((x) => x.dispose()); }, [rec]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const camisas = ["#f2f2ee", "#2f5fa8", "#e0b23a", "#c8463c", "#3d8a5a", "#1e2a44", "#d77a9a"];
    const peles = ["#c99a74", "#8d5e3c", "#e3bf9b", "#a8714b"];
    L.pessoas.forEach(([x, y, z, g, k], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, g, 0);
      o.updateMatrix();
      for (const m of [corpo.current!, cabeca.current!, pernas.current!]) m.setMatrixAt(i, o.matrix);
      corpo.current!.setColorAt(i, cor.set(camisas[k % camisas.length]));
      cabeca.current!.setColorAt(i, cor.set(peles[(i * 3 + k) % peles.length]));
    });
    finalizar([corpo.current!, cabeca.current!, pernas.current!]);
  }, []);
  const n = L.pessoas.length;
  return (
    <>
      <instancedMesh name="Pessoas_Corpo" ref={corpo} args={[rec.corpo, rec.mat, n]} castShadow />
      <instancedMesh name="Pessoas_Cabeca" ref={cabeca} args={[rec.cabeca, rec.mat, n]} castShadow />
      <instancedMesh name="Pessoas_Pernas" ref={pernas} args={[rec.pernas, undefined, n]} castShadow material={fab.cor("#2c3540", 0.3)} />
    </>
  );
}

export function PasseioPublico({ fab }: { fab: Fabrica }) {
  return (
    <group name="Passeio_Publico">
      <PecasBlender fab={fab} />
      <Arvores fab={fab} />
      <Palmeiras fab={fab} />
      <Postes />
      <Bancos fab={fab} />
      <MesasCafe />
      <Carros fab={fab} />
      <Pessoas fab={fab} />
    </group>
  );
}
