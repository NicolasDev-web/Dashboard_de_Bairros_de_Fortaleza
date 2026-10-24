import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Fabrica } from "../../Cena";
import { aleatorio, texturaManchada } from "../../util/geometria";
import layout from "../../../blender/saida/estoril-layout.json";

/**
 * Estoril, a antiga Vila Morena (Praia de Iracema; −3,7190974, −38,516258): casa de veraneio dos anos 1920 da família
 * Magalhães Porto, cassino e clube dos oficiais americanos na Segunda Guerra, restaurante boêmio desde 1948 e, depois da
 * réplica de 1995, equipamento cultural e sede da Secretaria do Turismo de Fortaleza.
 * As peças estáticas vêm do Blender (`blender/estoril.py` → `blender/saida/estoril-pecas.glb`), com a oclusão de ambiente
 * assada nas cores de vértice e numa imagem do chão:
 * - o sobrado de dois pavimentos em L, o bloco oeste, a torre com o mirante em arcos e os telhados de telha marselha;
 * - as varandas em arcada com terraço de balaústres, o anexo leste e o anexo oeste;
 * - a Rua dos Tabajaras (rua compartilhada de bloquetes), o calçadão, a areia e o mar da Praia de Iracema.
 * Aqui entram o piso, os bloquetes, as manchas da areia, do mar e da grama, a cor das telhas e o que se repete
 * (árvores, coqueiros, gente e carros). Posições em `blender/saida/estoril-layout.json`. Metros, base em y = 0, rumo real
 * (eixo a 105,5°, a fachada da torre para a Tabajaras, ao sul). Fontes em pesquisa/estoril/ficha.md.
 */

/** Altura da etiqueta com o nome no tour (pináculo da torre a ~17,2 m, + ~2 m) */
export const ALTURA_ETIQUETA = 19;

const BASE = "/blender/saida/";

/** Cor das telhas marselha (o exportador do Blender não leva a cor-base de material com textura) */
const COR_TELHA: Record<string, string> = { Mat_Telha_Marselha: "#b65a35" };

type Arvore = [x: number, yBase: number, z: number, r: number];
type Coqueiro = [x: number, z: number, h: number, giro: number, inclinacao: number, rumo: number];
type Pessoa = [x: number, y: number, z: number, giro: number, cor: number];
type Carro = [x: number, z: number, giro: number, cor: number];
type GuardaSol = [x: number, z: number, cor: number];
const L = layout as { arvores: Arvore[]; palmeiras: Coqueiro[]; pessoas: Pessoa[]; carros: Carro[]; guardaSois: GuardaSol[]; chao: { lado: number; z0: number } };
const Z0 = L.chao.z0;

/** Piso em placas com juntas (pátio, calçadão, bloquetes da Tabajaras); em cinza, a cor vem de cada material do chão */
function texturaPiso(semente: number, quadros: number, tijolo = false) {
  const n = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = n;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#f4f4f4";
  g.fillRect(0, 0, n, n);
  const r = aleatorio(semente);
  const q = n / quadros;
  for (let i = 0; i < quadros; i++) for (let j = 0; j < quadros; j++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.08})`;
    g.fillRect(i * q + (tijolo && j % 2 ? q / 2 : 0), j * q, q, q);
  }
  g.strokeStyle = "rgba(0,0,0,0.26)";
  g.lineWidth = quadros > 4 ? 1.5 : 2;
  for (let j = 0; j <= quadros; j++) { g.beginPath(); g.moveTo(0, j * q); g.lineTo(n, j * q); g.stroke(); }
  for (let j = 0; j < quadros; j++) for (let i = 0; i <= quadros; i++) {
    const x = i * q + (tijolo && j % 2 ? q / 2 : 0);
    g.beginPath(); g.moveTo(x, j * q); g.lineTo(x, (j + 1) * q); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Peças do Blender: sombras, nomes por material, cor das telhas, oclusão e texturas no chão */
function PecasBlender() {
  const gltf = useLoader(GLTFLoader, `${BASE}estoril-pecas.glb`);
  const ao = useLoader(THREE.TextureLoader, `${BASE}estoril-ao-chao.jpg`);
  const extras = useMemo(() => {
    const piso = texturaPiso(31, 2);
    piso.repeat.set(L.chao.lado / 2.4, L.chao.lado / 2.4);
    const calcadao = texturaPiso(17, 2);
    calcadao.repeat.set(L.chao.lado / 3.2, L.chao.lado / 3.2);
    // bloquetes da rua compartilhada: o mesmo desenho, miúdo e em fiadas desencontradas
    const rua = texturaPiso(47, 8, true);
    rua.repeat.set(L.chao.lado / 2.2, L.chao.lado / 2.2);
    const mancha = texturaManchada("#ffffff", 0.1, 11, 64);
    mancha.repeat.set(9, 9);
    return { piso, calcadao, rua, mancha };
  }, []);
  useEffect(() => () => { Object.values(extras).forEach((x) => x.dispose()); }, [extras]);
  const cena = useMemo(() => {
    ao.flipY = false;
    ao.colorSpace = THREE.NoColorSpace;
    ao.userData.mimeType = "image/jpeg"; // o GLTFExporter regrava em JPEG em vez de PNG
    ao.needsUpdate = true;
    const raiz = gltf.scene.clone(true);
    raiz.name = "Pecas_Estoril";
    const vistos = new Set<THREE.Material>();
    raiz.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const pai = m.parent && m.parent !== raiz ? m.parent.name : m.name;
      m.name = `${pai}_${mat.name.replace(/^Mat_/, "")}`;
      const chao = mat.name.startsWith("Mat_Chao_");
      m.castShadow = !chao && mat.name !== "Mat_Espuma";
      m.receiveShadow = true;
      if (vistos.has(mat)) return;
      vistos.add(mat);
      if (COR_TELHA[mat.name]) mat.color.set(COR_TELHA[mat.name]);
      if (chao) {
        mat.aoMap = ao;
        mat.aoMapIntensity = 1;
        mat.map = mat.name === "Mat_Chao_Rua" ? extras.rua
          : mat.name === "Mat_Chao_Calcadao" ? extras.calcadao
          : mat.name === "Mat_Chao_Piso" ? extras.piso : extras.mancha;
        mat.needsUpdate = true;
      }
    });
    return raiz;
  }, [gltf, ao, extras]);
  return <primitive object={cena} />;
}

/** Castanholas/amendoeiras de copa larga no gramado do Largo dos Tremembés e no pátio oeste */
function Arvores({ fab }: { fab: Fabrica }) {
  const copa = useRef<THREE.InstancedMesh>(null);
  const tronco = useRef<THREE.InstancedMesh>(null);
  const n = L.arvores.length;
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const r = aleatorio(7);
    const tons = ["#3d6b33", "#4c7a3a", "#355f2e", "#5a8541", "#46733a"];
    L.arvores.forEach(([x, yb, z, raio], i) => {
      o.position.set(x, yb + raio * 0.7, z);
      o.scale.set(raio * 1.1, raio * 0.62, raio * (1.0 + r() * 0.2));
      o.rotation.set(0, r() * Math.PI * 2, 0);
      o.updateMatrix();
      copa.current!.setMatrixAt(i, o.matrix);
      copa.current!.setColorAt(i, cor.set(tons[Math.floor(r() * tons.length)]));
      o.position.set(x, Z0, z);
      o.scale.set(1, yb - Z0 + 0.5, 1);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      tronco.current!.setMatrixAt(i, o.matrix);
    });
    for (const m of [copa.current!, tronco.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, []);
  const geo = useMemo(() => ({ tronco: new THREE.CylinderGeometry(0.16, 0.24, 1, 6).translate(0, 0.5, 0) }), []);
  useEffect(() => () => geo.tronco.dispose(), [geo]);
  return (
    <>
      <instancedMesh name="Arvores_Copas" ref={copa} args={[undefined, undefined, n]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial name="Mat_Copa_Arvore" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh name="Arvores_Troncos" ref={tronco} args={[geo.tronco, undefined, n]} castShadow material={fab.cor("#6e5a45")} />
    </>
  );
}

/**
 * Folha de coqueiro: tira em "V" raso que sobe um pouco e cai em arco, afinando na ponta (a da Unifor, mais longa).
 * Base na origem, correndo em +z; material de dois lados.
 */
function geometriaFolha(comp: number, queda: number) {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = 7;
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
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const FOLHAS = 11;

/** Coqueiros do calçadão e da areia: estipe fino e inclinado, cinza-pardo, coroa de folhas arqueadas */
function Coqueiros({ fab }: { fab: Fabrica }) {
  const estipe = useRef<THREE.InstancedMesh>(null);
  const palmito = useRef<THREE.InstancedMesh>(null);
  const folhas = useRef<THREE.InstancedMesh>(null);
  const rec = useMemo(() => ({
    mat: Object.assign(new THREE.MeshStandardMaterial({ color: "#5a8f3c", roughness: 0.8, side: THREE.DoubleSide }), { name: "Mat_Folha_Coqueiro" }),
    folha: geometriaFolha(3.0, 1.35),
    estipe: new THREE.CylinderGeometry(0.12, 0.19, 1, 8).translate(0, 0.5, 0),
    palmito: new THREE.IcosahedronGeometry(0.42, 1),
  }), []);
  useEffect(() => () => { Object.values(rec).forEach((x) => x.dispose()); }, [rec]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const topo = new THREE.Vector3();
    L.palmeiras.forEach(([x, z, h, giro, inc, rumo], i) => {
      // estipe inclinado: gira em x pela inclinação e em y pelo rumo; a coroa vai para a ponta
      o.position.set(x, Z0, z);
      o.rotation.set(inc, rumo, 0, "YXZ");
      o.scale.set(1, h, 1);
      o.updateMatrix();
      estipe.current!.setMatrixAt(i, o.matrix);
      topo.set(0, h, 0).applyEuler(new THREE.Euler(inc, rumo, 0, "YXZ")).add(new THREE.Vector3(x, Z0, z));
      o.position.copy(topo);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 0.8, 1);
      o.updateMatrix();
      palmito.current!.setMatrixAt(i, o.matrix);
      for (let f = 0; f < FOLHAS; f++) {
        const a = giro + (f / FOLHAS) * Math.PI * 2;
        o.rotation.set(f % 3 === 0 ? -0.75 : f % 3 === 1 ? -0.3 : 0.05, a, 0, "YXZ");
        o.position.copy(topo);
        o.scale.setScalar(f % 3 === 0 ? 0.8 : 1);
        o.updateMatrix();
        folhas.current!.setMatrixAt(i * FOLHAS + f, o.matrix);
        folhas.current!.setColorAt(i * FOLHAS + f, cor.set(f % 3 ? "#ffffff" : "#e6d9a8"));
      }
    });
    for (const m of [estipe.current!, palmito.current!, folhas.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, []);
  const n = L.palmeiras.length;
  return (
    <>
      <instancedMesh name="Coqueiros_Estipes" ref={estipe} args={[rec.estipe, undefined, n]} castShadow material={fab.cor("#9c8f7c", 0.85)} />
      <instancedMesh name="Coqueiros_Cocos" ref={palmito} args={[rec.palmito, undefined, n]} castShadow material={fab.cor("#7a6a35", 0.7)} />
      <instancedMesh name="Coqueiros_Folhas" ref={folhas} args={[rec.folha, rec.mat, n * FOLHAS]} castShadow />
    </>
  );
}

/** Gente no pátio, na Tabajaras, no calçadão e na areia (na escala do prédio, ~1,4 m) */
function Pessoas({ fab }: { fab: Fabrica }) {
  const corpo = useRef<THREE.InstancedMesh>(null);
  const cabeca = useRef<THREE.InstancedMesh>(null);
  const pernas = useRef<THREE.InstancedMesh>(null);
  const rec = useMemo(() => ({
    corpo: new THREE.CylinderGeometry(0.16, 0.19, 0.58, 7).translate(0, 0.8, 0),
    cabeca: new THREE.IcosahedronGeometry(0.135, 1).translate(0, 1.24, 0),
    pernas: new THREE.CylinderGeometry(0.13, 0.11, 0.54, 6).translate(0, 0.27, 0),
    mat: Object.assign(new THREE.MeshStandardMaterial({ roughness: 0.8 }), { name: "Mat_Pessoas" }),
  }), []);
  useEffect(() => () => { Object.values(rec).forEach((x) => x.dispose()); }, [rec]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const camisas = ["#f2f2ee", "#2f5fa8", "#e0b23a", "#c8463c", "#3d8a5a", "#1e2a44"];
    const peles = ["#c99a74", "#8d5e3c", "#e3bf9b", "#a8714b"];
    L.pessoas.forEach(([x, y, z, g, k], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, g, 0);
      o.updateMatrix();
      for (const m of [corpo.current!, cabeca.current!, pernas.current!]) m.setMatrixAt(i, o.matrix);
      corpo.current!.setColorAt(i, cor.set(camisas[k % camisas.length]));
      cabeca.current!.setColorAt(i, cor.set(peles[(i * 3 + k) % peles.length]));
    });
    for (const m of [corpo.current!, cabeca.current!, pernas.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
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

/** Táxis brancos no ponto da Tabajaras (OSM) e carros passando devagar na rua compartilhada (~3,7 m) */
function Carros({ fab }: { fab: Fabrica }) {
  const corpo = useRef<THREE.InstancedMesh>(null);
  const cabine = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => ({
    c: new THREE.BoxGeometry(3.7, 0.72, 1.62).translate(0, 0.52, 0),
    k: new THREE.BoxGeometry(1.95, 0.58, 1.42).translate(-0.2, 1.17, 0),
  }), []);
  useEffect(() => () => { geo.c.dispose(); geo.k.dispose(); }, [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const tons = ["#f2f2ef", "#c8ccd0", "#2b2f36", "#8e959c", "#b33a32", "#1f4e8c"];
    L.carros.forEach(([x, z, g, k], i) => {
      o.position.set(x, Z0, z);
      o.rotation.set(0, g, 0);
      o.updateMatrix();
      corpo.current!.setMatrixAt(i, o.matrix);
      cabine.current!.setMatrixAt(i, o.matrix);
      corpo.current!.setColorAt(i, cor.set(tons[k % tons.length]));
    });
    for (const m of [corpo.current!, cabine.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
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

/** Guarda-sóis coloridos na areia da Praia de Iracema: haste clara e copa em cone baixo de 8 gomos */
function GuardaSois({ fab }: { fab: Fabrica }) {
  const copa = useRef<THREE.InstancedMesh>(null);
  const haste = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => ({
    copa: new THREE.ConeGeometry(1.3, 0.45, 8).translate(0, 2.12, 0),
    haste: new THREE.CylinderGeometry(0.035, 0.035, 2.3, 5).translate(0, 1.15, 0),
  }), []);
  useEffect(() => () => { geo.copa.dispose(); geo.haste.dispose(); }, [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const tons = ["#d8443a", "#f2c230", "#2f7fc1", "#f4f1e8", "#e0773a", "#3d9a6a"];
    L.guardaSois.forEach(([x, z, k], i) => {
      o.position.set(x, Z0, z);
      o.rotation.set(0.06 * ((i % 3) - 1), i, 0);
      o.updateMatrix();
      copa.current!.setMatrixAt(i, o.matrix);
      haste.current!.setMatrixAt(i, o.matrix);
      copa.current!.setColorAt(i, cor.set(tons[k % tons.length]));
    });
    for (const m of [copa.current!, haste.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, []);
  const n = L.guardaSois.length;
  return (
    <>
      <instancedMesh name="Guarda_Sois_Copas" ref={copa} args={[geo.copa, undefined, n]} castShadow>
        <meshStandardMaterial name="Mat_Guarda_Sol" roughness={0.75} flatShading />
      </instancedMesh>
      <instancedMesh name="Guarda_Sois_Hastes" ref={haste} args={[geo.haste, undefined, n]} castShadow material={fab.cor("#e9e4d8", 0.6)} />
    </>
  );
}

export function Estoril({ fab }: { fab: Fabrica }) {
  return (
    <group name="Estoril">
      <PecasBlender />
      <Arvores fab={fab} />
      <Coqueiros fab={fab} />
      <Pessoas fab={fab} />
      <Carros fab={fab} />
      <GuardaSois fab={fab} />
    </group>
  );
}
