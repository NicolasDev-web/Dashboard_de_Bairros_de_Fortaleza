import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Fabrica } from "../../Cena";
import { aleatorio, texturaManchada } from "../../util/geometria";
import layout from "../../../blender/saida/marcoZero-layout.json";

/**
 * Marco Zero de Fortaleza (Praça do Santiago, Barra do Ceará; monumento em −3,6940003, −38,5862496): o cruzeiro de
 * granito de 12 m e mais de 10 t que o governo da Espanha deu à cidade nos 400 anos do Fortim de Santiago (1604–2004),
 * com as imagens de Jesus Cristo, Santiago, Nossa Senhora da Assunção e São José, no lugar onde o Rio Ceará encontra o mar.
 * As peças estáticas vêm do Blender (`blender/marcoZero.py` → `blender/saida/marcoZero-pecas.glb`), com a oclusão de
 * ambiente assada nas cores de vértice e numa imagem do chão:
 * - o cruzeiro no tipo do cruceiro galego (degraus, pedestal, fuste octogonal, capitel, cruz) e as quatro imagens;
 * - o canteiro de grama, a praça, o enrocamento da margem, o rio e o mar, os quiosques hexagonais, a torre de
 *   salvamento, as barracas, o Mercado Vila do Mar, a quadra, o estacionamento e a Rua José Roberto Sales.
 * Aqui entram a água (`fab.agua()`), os pisos e o grão do granito em canvas, e o que se repete (coqueiros, gente e
 * carros). Posições em `blender/saida/marcoZero-layout.json`. Metros, base em y = 0, norte em −z (rumo real).
 * Fontes em pesquisa/marcoZero/ficha.md.
 */

/** Altura da etiqueta com o nome no tour (pomo do alto da cruz a ~16,3 m, + ~2 m) */
export const ALTURA_ETIQUETA = 18;

const BASE = "/blender/saida/";

type Coqueiro = [x: number, z: number, h: number, giro: number, inclinacao: number, rumo: number];
type Pessoa = [x: number, y: number, z: number, giro: number, cor: number];
type Carro = [x: number, z: number, giro: number, cor: number];
const L = layout as { coqueiros: Coqueiro[]; pessoas: Pessoa[]; carros: Carro[]; chao: { lado: number; z0: number } };
const Z0 = L.chao.z0;

/** Piso em placas com juntas (praça, calçadão, intertravado); em cinza, a cor vem de cada material do chão */
function texturaPiso(semente: number, quadros: number, junta = 0.24, desencontrado = false) {
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
    g.fillRect(i * q + (desencontrado && j % 2 ? q / 2 : 0), j * q, q, q);
  }
  g.strokeStyle = `rgba(0,0,0,${junta})`;
  g.lineWidth = 1.6;
  for (let j = 0; j <= quadros; j++) {
    g.beginPath(); g.moveTo(0, j * q); g.lineTo(n, j * q); g.stroke();
    for (let i = 0; i <= quadros; i++) {
      const x = i * q + (desencontrado && j % 2 ? q / 2 : 0);
      g.beginPath(); g.moveTo(x, j * q); g.lineTo(x, (j + 1) * q); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Grão do granito: pintas escuras e claras miúdas sobre o claro (a cor vem do material); UV = metros / 40, repetido 25× */
function texturaGranito() {
  const n = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = n;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#efefef";
  g.fillRect(0, 0, n, n);
  const r = aleatorio(2004);
  for (let k = 0; k < 1400; k++) {
    const escuro = r() < 0.55;
    g.fillStyle = escuro ? `rgba(40,38,36,${0.18 + r() * 0.3})` : `rgba(255,255,255,${0.4 + r() * 0.5})`;
    const s = 0.8 + r() * 1.6;
    g.fillRect(r() * n, r() * n, s, s);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Peças do Blender: sombras, nomes por material, rio e mar, oclusão e texturas no chão, grão do granito */
function PecasBlender({ fab }: { fab: Fabrica }) {
  const gltf = useLoader(GLTFLoader, `${BASE}marcoZero-pecas.glb`);
  const ao = useLoader(THREE.TextureLoader, `${BASE}marcoZero-ao-chao.jpg`);
  const extras = useMemo(() => {
    const lado = L.chao.lado;
    const praca = texturaPiso(19, 2, 0.2);
    praca.repeat.set(lado / 2.0, lado / 2.0);
    const calcadao = texturaPiso(31, 4, 0.2);
    calcadao.repeat.set(lado / 3.0, lado / 3.0);
    const intertravado = texturaPiso(47, 8, 0.32, true);
    intertravado.repeat.set(lado / 2.4, lado / 2.4);
    const manchada = texturaManchada("#ffffff", 0.09, 11, 64);
    manchada.repeat.set(8, 8);
    const granito = texturaGranito();
    granito.repeat.set(25, 25);
    return { praca, calcadao, intertravado, manchada, granito };
  }, []);
  useEffect(() => () => { Object.values(extras).forEach((x) => x.dispose()); }, [extras]);
  const cena = useMemo(() => {
    ao.flipY = false;
    ao.colorSpace = THREE.NoColorSpace;
    ao.userData.mimeType = "image/jpeg"; // o GLTFExporter regrava em JPEG em vez de PNG
    ao.needsUpdate = true;
    const raiz = gltf.scene.clone(true);
    raiz.name = "Pecas_Marco_Zero";
    const MAPA: Record<string, THREE.Texture> = {
      Mat_Chao_Praca: extras.praca, Mat_Chao_Calcadao: extras.calcadao, Mat_Chao_Intertravado: extras.intertravado,
      Mat_Chao_Areia: extras.manchada, Mat_Chao_Areia_Molhada: extras.manchada, Mat_Chao_Grama: extras.manchada,
      Mat_Chao_Quadra: extras.manchada, Mat_Chao_Quadra_Borda: extras.manchada,
    };
    const CHAO = ["Mat_Agua_Mar", "Mat_Espuma", "Mat_Faixa_Branca"];
    const trocas = new Map<THREE.Material, THREE.Material>();
    raiz.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const pai = m.parent && m.parent !== raiz ? m.parent.name : m.name;
      m.name = `${pai}_${mat.name.replace(/^Mat_/, "")}`;
      const chao = mat.name.startsWith("Mat_Chao_") || CHAO.includes(mat.name);
      m.castShadow = !chao;
      m.receiveShadow = true;
      let novo = trocas.get(mat);
      if (!novo) {
        if (mat.name === "Mat_Agua_Mar") novo = fab.agua();
        else {
          novo = mat;
          if (mat.name === "Mat_Granito") {
            mat.map = extras.granito;
            mat.needsUpdate = true;
          }
          if (mat.name.startsWith("Mat_Chao_")) {
            mat.aoMap = ao;
            mat.aoMapIntensity = 1;
            if (MAPA[mat.name]) mat.map = MAPA[mat.name];
            mat.needsUpdate = true;
          }
        }
        trocas.set(mat, novo);
      }
      m.material = novo;
    });
    return raiz;
  }, [gltf, ao, extras, fab]);
  return <primitive object={cena} />;
}

/**
 * Folha de coqueiro: tira em "V" raso que sobe um pouco e cai em arco, afinando na ponta (a da Unifor).
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

/** Coqueiros da praça, da faixa dos quiosques e da areia (genéricos da orla: sem posição real): estipe fino e inclinado, cocos e coroa de folhas arqueadas */
function Coqueiros({ fab }: { fab: Fabrica }) {
  const estipe = useRef<THREE.InstancedMesh>(null);
  const cocos = useRef<THREE.InstancedMesh>(null);
  const folhas = useRef<THREE.InstancedMesh>(null);
  const rec = useMemo(() => ({
    mat: Object.assign(new THREE.MeshStandardMaterial({ color: "#5f9a3c", roughness: 0.8, side: THREE.DoubleSide }), { name: "Mat_Folha_Coqueiro" }),
    folha: geometriaFolha(3.0, 1.35),
    estipe: new THREE.CylinderGeometry(0.12, 0.19, 1, 8).translate(0, 0.5, 0),
    cocos: new THREE.IcosahedronGeometry(0.4, 0).translate(0, -0.25, 0),
  }), []);
  useEffect(() => () => { Object.values(rec).forEach((x) => x.dispose()); }, [rec]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const topo = new THREE.Vector3();
    L.coqueiros.forEach(([x, z, h, giro, inc, rumo], i) => {
      o.position.set(x, Z0, z);
      o.rotation.set(inc, rumo, 0, "YXZ");
      o.scale.set(1, h, 1);
      o.updateMatrix();
      estipe.current!.setMatrixAt(i, o.matrix);
      topo.set(0, h, 0).applyEuler(new THREE.Euler(inc, rumo, 0, "YXZ")).add(new THREE.Vector3(x, Z0, z));
      o.position.copy(topo);
      o.rotation.set(0, giro, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      cocos.current!.setMatrixAt(i, o.matrix);
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
    for (const m of [estipe.current!, cocos.current!, folhas.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, []);
  const n = L.coqueiros.length;
  return (
    <>
      <instancedMesh name="Coqueiros_Estipes" ref={estipe} args={[rec.estipe, undefined, n]} castShadow material={fab.cor("#9c8f7c", 0.85)} />
      <instancedMesh name="Coqueiros_Cocos" ref={cocos} args={[rec.cocos, undefined, n]} castShadow material={fab.cor("#7a6a35", 0.7)} />
      <instancedMesh name="Coqueiros_Folhas" ref={folhas} args={[rec.folha, rec.mat, n * FOLHAS]} castShadow />
    </>
  );
}

/** Gente em volta do canteiro, na praça, nos quiosques, na areia, na quadra e na calçada (~1,6 m) */
function Pessoas({ fab }: { fab: Fabrica }) {
  const corpo = useRef<THREE.InstancedMesh>(null);
  const cabeca = useRef<THREE.InstancedMesh>(null);
  const pernas = useRef<THREE.InstancedMesh>(null);
  const rec = useMemo(() => ({
    corpo: new THREE.CylinderGeometry(0.18, 0.21, 0.64, 7).translate(0, 0.9, 0),
    cabeca: new THREE.IcosahedronGeometry(0.15, 1).translate(0, 1.39, 0),
    pernas: new THREE.CylinderGeometry(0.15, 0.12, 0.6, 6).translate(0, 0.3, 0),
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

/** Carros no estacionamento da orla e nos dois sentidos da Rua José Roberto Sales (~3,7 m) */
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
      o.position.set(x, Z0 + 0.006, z);
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

export function MarcoZero({ fab }: { fab: Fabrica }) {
  return (
    <group name="Marco_Zero_Barra_do_Ceara">
      <PecasBlender fab={fab} />
      <Coqueiros fab={fab} />
      <Pessoas fab={fab} />
      <Carros fab={fab} />
    </group>
  );
}
