import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Fabrica } from "../../Cena";
import { aleatorio, texturaManchada } from "../../util/geometria";
import layout from "../../../blender/saida/estadioPv-layout.json";

/**
 * Estádio Presidente Vargas, o "PV" (Benfica; −3,7459909, −38,5368948), inaugurado em 14/09/1941.
 * As peças estáticas vêm do Blender (`blender/estadioPv.py` → `blender/saida/estadioPv-pecas.glb`), com a oclusão de
 * ambiente assada nas cores de vértice e numa imagem do chão:
 * - o anel de arquibancadas em dois lances com o corredor dos vomitórios, o vidro na divisa com o campo (reforma da Copa)
 *   e as cadeiras azuis da tribuna;
 * - a tribuna coberta do lado oeste: cobertura metálica em arco, cabines de rádio, portal, elevadores e rampas;
 * - as quatro torres de iluminação treliçadas;
 * - a fachada externa com os portões dos setores, as bilheterias, o gradil do lote, as quatro ruas (a Rua Marechal
 *   Deodoro a oeste) e o casario baixo do Benfica.
 * Aqui entram o gramado com as marcações desenhado em canvas, os pisos, as cores das telhas e o que se repete (árvores,
 * gente, carros e as barras do gradil). Posições em `blender/saida/estadioPv-layout.json`. Metros, base em y = 0, no
 * rumo real (eixo longo 13° a oeste do norte). Fontes em pesquisa/estadioPv/ficha.md.
 */

/** Altura da etiqueta com o nome no tour (topo dos painéis das torres de iluminação a 20,4 m, + ~1,5 m) */
export const ALTURA_ETIQUETA = 22;

const BASE = "/blender/saida/";

/** Cor-base dos materiais com textura (o exportador do Blender não leva a cor-base de material com textura) */
const COR_TEXTURADO: Record<string, string> = {
  Mat_Telha_Barro: "#b35b39",
  Mat_Cobertura_Aluminio: "#d3d8da",
  Mat_Esquadrias: "#ffffff",
};

type Arvore = [x: number, yBase: number, z: number, r: number];
type Pessoa = [x: number, y: number, z: number, giro: number, cor: number];
type Carro = [x: number, z: number, giro: number, cor: number];
type Barra = [x: number, z: number, yBase: number, h: number];
const L = layout as { arvores: Arvore[]; pessoas: Pessoa[]; carros: Carro[]; barras: Barra[]; chao: { lado: number; z0: number; ze: number } };
const ZE = L.chao.ze;

/** Área coberta pelo canvas do gramado (a borda do campo no Blender: 2 × 9,7 m por 2 × 13 m) */
const CAMPO = { w: 19.4, h: 26 };
const K_CAMPO = 0.2; // campo oficial de 105 × 68 m

/** Gramado com faixas de corte, linhas brancas oficiais, áreas, meias-luas e marcas do pênalti (canvas 388 × 520) */
function texturaGramado() {
  const px = 20;
  const cv = document.createElement("canvas");
  cv.width = Math.round(CAMPO.w * px);
  cv.height = Math.round(CAMPO.h * px);
  const g = cv.getContext("2d")!;
  const m = (metros: number) => metros * K_CAMPO * px;
  const larg = m(68), comp = m(105);
  const x0 = (cv.width - larg) / 2, y0 = (cv.height - comp) / 2;
  g.fillStyle = "#3f873a";
  g.fillRect(0, 0, cv.width, cv.height);
  // faixas de corte atravessando o campo, continuando um pouco além das linhas
  const faixas = 14;
  for (let i = 0; i < faixas; i++) {
    g.fillStyle = i % 2 ? "#4c9a43" : "#438e3c";
    g.fillRect(x0 - m(3), y0 + (i * comp) / faixas, larg + m(6), comp / faixas + 0.5);
  }
  g.strokeStyle = "#f3f5ef";
  g.lineWidth = 2.6;
  g.strokeRect(x0, y0, larg, comp);
  g.beginPath(); g.moveTo(x0, y0 + comp / 2); g.lineTo(x0 + larg, y0 + comp / 2); g.stroke();
  g.beginPath(); g.arc(cv.width / 2, cv.height / 2, m(9.15), 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#f3f5ef";
  g.beginPath(); g.arc(cv.width / 2, cv.height / 2, 2.2, 0, Math.PI * 2); g.fill();
  for (const lado of [0, 1]) {
    const yl = lado ? y0 + comp : y0;
    const s = lado ? -1 : 1;
    g.strokeRect(cv.width / 2 - m(20.16), lado ? yl - m(16.5) : yl, m(40.32), m(16.5));
    g.strokeRect(cv.width / 2 - m(9.16), lado ? yl - m(5.5) : yl, m(18.32), m(5.5));
    const ang = Math.acos(5.5 / 9.15);
    g.beginPath();
    if (lado) g.arc(cv.width / 2, yl - m(11), m(9.15), -Math.PI / 2 - ang, -Math.PI / 2 + ang);
    else g.arc(cv.width / 2, yl + m(11), m(9.15), Math.PI / 2 - ang, Math.PI / 2 + ang);
    g.stroke();
    g.beginPath(); g.arc(cv.width / 2, yl + s * m(11), 2.2, 0, Math.PI * 2); g.fill();
    // arcos de canto
    for (const xc of [x0, x0 + larg]) {
      g.beginPath(); g.arc(xc, yl, m(1), 0, Math.PI * 2); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // UV do glTF: v = 0 no alto da imagem
  t.anisotropy = 4;
  return t;
}

/** Piso em placas com juntas (esplanada e calçadas); em cinza claro, a cor vem de cada material do chão */
function texturaPiso(semente: number, quadros: number) {
  const n = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = n;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#f4f4f4";
  g.fillRect(0, 0, n, n);
  const r = aleatorio(semente);
  const q = n / quadros;
  for (let i = 0; i < quadros; i++) for (let j = 0; j < quadros; j++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.07})`;
    g.fillRect(i * q, j * q, q, q);
  }
  g.strokeStyle = "rgba(0,0,0,0.24)";
  g.lineWidth = quadros > 4 ? 1.5 : 2;
  for (let i = 0; i <= quadros; i++) {
    g.beginPath(); g.moveTo(i * q, 0); g.lineTo(i * q, n); g.stroke();
    g.beginPath(); g.moveTo(0, i * q); g.lineTo(n, i * q); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Peças do Blender: sombras, nomes por material, gramado em canvas, cores das texturas, vidro, oclusão e pisos */
function PecasBlender() {
  const gltf = useLoader(GLTFLoader, `${BASE}estadioPv-pecas.glb`);
  const ao = useLoader(THREE.TextureLoader, `${BASE}estadioPv-ao-chao.jpg`);
  const extras = useMemo(() => {
    const gramado = texturaGramado();
    const piso = texturaPiso(41, 2);
    piso.repeat.set(L.chao.lado / 2.4, L.chao.lado / 2.4);
    const calcada = texturaPiso(19, 4);
    calcada.repeat.set(L.chao.lado / 3, L.chao.lado / 3);
    const asfalto = texturaManchada("#ffffff", 0.06, 23, 64);
    asfalto.repeat.set(10, 10);
    const grama = texturaManchada("#ffffff", 0.08, 11, 64);
    grama.repeat.set(9, 9);
    return { gramado, piso, calcada, asfalto, grama };
  }, []);
  useEffect(() => () => { Object.values(extras).forEach((x) => x.dispose()); }, [extras]);
  const cena = useMemo(() => {
    ao.flipY = false;
    ao.colorSpace = THREE.NoColorSpace;
    ao.userData.mimeType = "image/jpeg"; // o GLTFExporter regrava em JPEG em vez de PNG
    ao.needsUpdate = true;
    const raiz = gltf.scene.clone(true);
    raiz.name = "Pecas_Estadio_PV";
    const feitos = new Set<THREE.Material>();
    const mapaChao: Record<string, THREE.Texture> = {
      Mat_Chao_Rua: extras.asfalto, Mat_Chao_Piso: extras.piso, Mat_Chao_Calcada: extras.calcada, Mat_Chao_Grama: extras.grama,
    };
    raiz.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const pai = m.parent && m.parent !== raiz ? m.parent.name : m.name;
      m.name = `${pai}_${mat.name.replace(/^Mat_/, "")}`;
      const chao = mat.name.startsWith("Mat_Chao_");
      m.castShadow = !chao && mat.name !== "Mat_Faixa_Viaria" && mat.name !== "Mat_Gramado_Campo";
      m.receiveShadow = true;
      if (feitos.has(mat)) return;
      feitos.add(mat);
      if (COR_TEXTURADO[mat.name]) mat.color.set(COR_TEXTURADO[mat.name]);
      if (mat.name === "Mat_Gramado_Campo") {
        mat.map = extras.gramado;
        mat.color.set("#ffffff");
      } else if (mat.name === "Mat_Vidro_Divisa") {
        mat.transparent = true;
        mat.opacity = 0.42;
        mat.depthWrite = false;
        mat.side = THREE.DoubleSide;
      } else if (chao) {
        mat.aoMap = ao;
        mat.aoMapIntensity = 1;
        mat.map = mapaChao[mat.name] ?? null;
      }
      mat.needsUpdate = true;
    });
    return raiz;
  }, [gltf, ao, extras]);
  return <primitive object={cena} />;
}

/** Oitis e outras árvores de copa densa nas calçadas, nos canteiros das cabeceiras e nos quintais */
function Arvores({ fab }: { fab: Fabrica }) {
  const copa = useRef<THREE.InstancedMesh>(null);
  const tronco = useRef<THREE.InstancedMesh>(null);
  const n = L.arvores.length;
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const r = aleatorio(41);
    const tons = ["#2f5a2b", "#3d6b33", "#2a4f27", "#4c7a3a", "#355f2e", "#5a8541"];
    L.arvores.forEach(([x, yb, z, raio], i) => {
      o.position.set(x, yb + raio * 0.78, z);
      o.scale.set(raio, raio * 0.82, raio * (0.9 + r() * 0.2));
      o.rotation.set(0, r() * Math.PI * 2, 0);
      o.updateMatrix();
      copa.current!.setMatrixAt(i, o.matrix);
      copa.current!.setColorAt(i, cor.set(tons[Math.floor(r() * tons.length)]));
      o.position.set(x, ZE, z);
      o.scale.set(1, yb - ZE + 0.4, 1);
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
  const rec = useMemo(() => ({
    tronco: new THREE.CylinderGeometry(0.11, 0.17, 1, 6).translate(0, 0.5, 0),
    copa: new THREE.IcosahedronGeometry(1, 1),
    mat: Object.assign(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), { name: "Mat_Copa_Arvore" }),
  }), []);
  useEffect(() => () => { Object.values(rec).forEach((x) => x.dispose()); }, [rec]);
  return (
    <>
      <instancedMesh name="Arvores_Copas" ref={copa} args={[rec.copa, rec.mat, n]} castShadow receiveShadow />
      <instancedMesh name="Arvores_Troncos" ref={tronco} args={[rec.tronco, undefined, n]} castShadow material={fab.cor("#6e5a45")} />
    </>
  );
}

/** Gente no portal, nos portões, nas filas das bilheterias e nas calçadas (~0,8 m: exagero para ler na escala do estádio) */
function Pessoas({ fab }: { fab: Fabrica }) {
  const corpo = useRef<THREE.InstancedMesh>(null);
  const cabeca = useRef<THREE.InstancedMesh>(null);
  const pernas = useRef<THREE.InstancedMesh>(null);
  const rec = useMemo(() => ({
    corpo: new THREE.CylinderGeometry(0.095, 0.11, 0.33, 7).translate(0, 0.46, 0),
    cabeca: new THREE.IcosahedronGeometry(0.078, 1).translate(0, 0.71, 0),
    pernas: new THREE.CylinderGeometry(0.075, 0.065, 0.3, 6).translate(0, 0.15, 0),
    mat: Object.assign(new THREE.MeshStandardMaterial({ roughness: 0.8 }), { name: "Mat_Pessoas" }),
  }), []);
  useEffect(() => () => { Object.values(rec).forEach((x) => x.dispose()); }, [rec]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    // camisas: brancas, pretas, azuis, vermelhas, amarelas e cinza (torcidas variadas; nenhuma cor de clube dominando)
    const camisas = ["#f2f2ee", "#1f2226", "#2f5fa8", "#c8463c", "#e0b23a", "#8e959c", "#3d8a5a"];
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

/** Carros estacionados junto aos meios-fios e passando nas quatro ruas (~2,2 m) */
function Carros({ fab }: { fab: Fabrica }) {
  const corpo = useRef<THREE.InstancedMesh>(null);
  const cabine = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => ({
    c: new THREE.BoxGeometry(2.2, 0.42, 0.98).translate(0, 0.31, 0),
    k: new THREE.BoxGeometry(1.18, 0.34, 0.86).translate(-0.12, 0.69, 0),
  }), []);
  useEffect(() => () => { geo.c.dispose(); geo.k.dispose(); }, [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const tons = ["#f2f2ef", "#c8ccd0", "#2b2f36", "#8e959c", "#b33a32", "#1f4e8c", "#d9d4c4", "#5d6b4a"];
    L.carros.forEach(([x, z, g, k], i) => {
      o.position.set(x, L.chao.z0, z);
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

/** Barras grafite do gradil do lote nas cabeceiras */
function Barras({ fab }: { fab: Fabrica }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.BoxGeometry(0.04, 1, 0.04).translate(0, 0.5, 0), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    L.barras.forEach(([x, z, y, h], i) => {
      o.position.set(x, y, z);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, []);
  return <instancedMesh name="Gradil_Barras" ref={ref} args={[geo, undefined, L.barras.length]} castShadow material={fab.cor("#2f3438", 0.5)} />;
}

export function EstadioPv({ fab }: { fab: Fabrica }) {
  return (
    <group name="Estadio_Presidente_Vargas">
      <PecasBlender />
      <Arvores fab={fab} />
      <Pessoas fab={fab} />
      <Carros fab={fab} />
      <Barras fab={fab} />
    </group>
  );
}
