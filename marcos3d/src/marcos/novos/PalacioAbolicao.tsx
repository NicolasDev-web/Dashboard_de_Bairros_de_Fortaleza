import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Fabrica } from "../../Cena";
import { aleatorio, texturaManchada } from "../../util/geometria";
import layout from "../../../blender/saida/palacioAbolicao-layout.json";

/**
 * Palácio da Abolição (Meireles; −3,7281783, −38,5038238), sede do governo do Ceará, de Sérgio Bernardes (1970).
 * As peças estáticas vêm do Blender (`blender/palacioAbolicao.py` → `blender/saida/palacioAbolicao-pecas.glb`), com a
 * oclusão de ambiente assada nas cores de vértice e numa imagem do chão:
 * - a barra do palácio (84 m reais, 20 módulos de 4,20 m) com o piso elevado, as fachadas de vidro, as empenas cegas de
 *   cerâmica, as varandas dos dois pavimentos com o banco de madeira e a laje de cobertura com beiral;
 * - o anexo transversal com os basculantes de madeira, a passarela coberta e a peça alta no pé dela;
 * - a capela de pirâmide dividida, o Mausoléu Castelo Branco (1972) em balanço sobre o espelho d'água, a guarita;
 * - o chão com o fosso escavado que contorna o palácio, o pátio da entrada e a borda da Av. Barão de Studart.
 * Aqui entram a água do fosso, os pisos, e o que se repete: os 238 tubos de aço pretos dos pórticos (pares de tubos
 * Mannesmann), as árvores, a gente e os carros. Posições em `blender/saida/palacioAbolicao-layout.json`.
 * Metros, base em y = 0, norte em −z (rumo real; ver `GIRO` no script). Fontes em pesquisa/palacioAbolicao/ficha.md.
 */

/** Altura da etiqueta com o nome no tour (topo da peça alta junto ao anexo a ~11,5 m, + ~2,5 m) */
export const ALTURA_ETIQUETA = 14;

const BASE = "/blender/saida/";

type Tubo = [x1: number, y1: number, z1: number, x2: number, y2: number, z2: number];
type Arvore = [x: number, yBase: number, z: number, r: number, tipo: number];
type Pessoa = [x: number, y: number, z: number, giro: number, cor: number];
type Carro = [x: number, z: number, giro: number, cor: number];
const L = layout as { tubos: Tubo[]; arvores: Arvore[]; pessoas: Pessoa[]; carros: Carro[]; chao: { lado: number; z0: number } };
const Z0 = L.chao.z0;

/** Piso em placas com juntas (pátio, calçadas); em cinza, a cor vem de cada material */
function texturaPiso(semente: number, quadros: number, junta = 0.24) {
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
  g.strokeStyle = `rgba(0,0,0,${junta})`;
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

/** Peças do Blender: sombras, nomes por material, água do fosso, oclusão e pisos no chão */
function PecasBlender({ fab }: { fab: Fabrica }) {
  const gltf = useLoader(GLTFLoader, `${BASE}palacioAbolicao-pecas.glb`);
  const ao = useLoader(THREE.TextureLoader, `${BASE}palacioAbolicao-ao-chao.jpg`);
  const extras = useMemo(() => {
    const piso = texturaPiso(31, 2);
    piso.repeat.set(L.chao.lado / 2.4, L.chao.lado / 2.4);
    // uma só mancha sutil para a grama, o asfalto e o fundo do fosso
    const mancha = texturaManchada("#ffffff", 0.07, 11, 64);
    mancha.repeat.set(8, 8);
    // juntas da laje de cobertura e do piso das varandas: placas de 2,2 m, o módulo dos pórticos (UV = metros / 4,4)
    const laje = texturaPiso(53, 2, 0.13);
    return { piso, mancha, laje };
  }, []);
  useEffect(() => () => { Object.values(extras).forEach((x) => x.dispose()); }, [extras]);
  const cena = useMemo(() => {
    ao.flipY = false;
    ao.colorSpace = THREE.NoColorSpace;
    ao.userData.mimeType = "image/jpeg"; // o GLTFExporter regrava em JPEG em vez de PNG
    ao.needsUpdate = true;
    const raiz = gltf.scene.clone(true);
    raiz.name = "Pecas_Palacio";
    const mapas: Record<string, THREE.Texture> = {
      Mat_Chao_Grama: extras.mancha, Mat_Chao_Asfalto: extras.mancha, Mat_Chao_Piso: extras.piso, Mat_Chao_Fosso: extras.mancha,
    };
    const LAJES = ["Mat_Cobertura_Laje", "Mat_Piso_Varanda"];
    const trocas = new Map<THREE.Material, THREE.Material>();
    raiz.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const pai = m.parent && m.parent !== raiz ? m.parent.name : m.name;
      m.name = `${pai}_${mat.name.replace(/^Mat_/, "")}`;
      const chao = mat.name.startsWith("Mat_Chao_");
      const agua = mat.name === "Mat_Agua";
      m.castShadow = !chao && !agua;
      m.receiveShadow = true;
      let novo = trocas.get(mat);
      if (!novo) {
        if (agua) {
          novo = fab.agua();
        } else {
          novo = mat;
          if (LAJES.includes(mat.name)) {
            mat.map = extras.laje;
            mat.needsUpdate = true;
          }
          if (chao) {
            mat.aoMap = ao;
            mat.aoMapIntensity = 1;
            if (mapas[mat.name]) mat.map = mapas[mat.name];
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
 * Pórticos de aço (ficha: dois tubos Mannesmann de 10" pintados de preto, como pilares e vigas): cada tubo é um cilindro
 * de 0,13 m de raio esticado entre os dois pontos do layout.
 */
function Tubos({ fab }: { fab: Fabrica }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.CylinderGeometry(0.13, 0.13, 1, 8).translate(0, 0.5, 0), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
    const cima = new THREE.Vector3(0, 1, 0);
    L.tubos.forEach(([x1, y1, z1, x2, y2, z2], i) => {
      a.set(x1, y1, z1);
      b.set(x2, y2, z2);
      d.subVectors(b, a);
      const comp = d.length();
      o.position.copy(a);
      o.quaternion.setFromUnitVectors(cima, d.normalize());
      o.scale.set(1, comp, 1);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, []);
  return <instancedMesh name="Porticos_Tubos_Aco" ref={ref} args={[geo, fab.cor("#17181a", 0.42), L.tubos.length]} castShadow receiveShadow />;
}

/**
 * Vegetação de espécies nativas (ficha; espécies não confirmadas): tipo 0 copa larga e baixa em massas verde-escuras,
 * tipo 1 copa redonda e compacta, tipo 2 copa alta e mais clara.
 */
function Arvores({ fab }: { fab: Fabrica }) {
  const massas = useRef<THREE.InstancedMesh>(null);
  const troncos = useRef<THREE.InstancedMesh>(null);
  const FORMAS: [number, number, number, number][][] = [
    [[0, 0.05, 0, 1], [0.52, -0.12, 0.18, 0.68], [-0.48, -0.08, 0.28, 0.66], [0.08, -0.16, -0.56, 0.66]],
    [[0, 0, 0, 1], [0.42, -0.1, 0.2, 0.62], [-0.36, 0.06, -0.3, 0.6]],
    [[0, 0.2, 0, 0.9], [0.2, -0.4, 0.1, 0.75]],
  ];
  const lista = useMemo(() => L.arvores.flatMap(([x, yb, z, r, t], i) => FORMAS[t % 3].map((m) => ({ x, yb, z, r, t, i, m }))), []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const r = aleatorio(1970);
    const tons = [["#2a4d24", "#31582a", "#27461f"], ["#3f6f30", "#4a7a36", "#38662c"], ["#5a8a3e", "#4f7f3a", "#66944a"]];
    const giros = L.arvores.map(() => r() * Math.PI * 2);
    lista.forEach(({ x, yb, z, r: raio, t, i, m: [dx, dy, dz, s] }, k) => {
      const g = giros[i];
      const px = dx * Math.cos(g) - dz * Math.sin(g), pz = dx * Math.sin(g) + dz * Math.cos(g);
      const achata = t === 0 ? 0.72 : t === 1 ? 0.86 : 1.15;
      o.position.set(x + px * raio, yb + raio * (t === 2 ? 0.95 : 0.7) + dy * raio, z + pz * raio);
      o.scale.set(raio * s, raio * s * achata, raio * s * (0.92 + r() * 0.16));
      o.rotation.set(0, r() * Math.PI * 2, 0);
      o.updateMatrix();
      massas.current!.setMatrixAt(k, o.matrix);
      const ts = tons[t % 3];
      massas.current!.setColorAt(k, cor.set(ts[(i + k) % ts.length]).offsetHSL(0, 0, (r() - 0.5) * 0.04));
    });
    L.arvores.forEach(([x, yb, z, , t], i) => {
      o.rotation.set(0, 0, 0);
      o.position.set(x, Z0, z);
      const grosso = t === 0 ? 1.35 : 1.0;
      o.scale.set(grosso, yb - Z0 + 0.6, grosso);
      o.updateMatrix();
      troncos.current!.setMatrixAt(i, o.matrix);
    });
    for (const m of [massas.current!, troncos.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [lista]);
  const geo = useMemo(() => new THREE.CylinderGeometry(0.15, 0.22, 1, 7).translate(0, 0.5, 0), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <>
      <instancedMesh name="Arvores_Copas" ref={massas} args={[undefined, undefined, lista.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial name="Mat_Copa_Arvore" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh name="Arvores_Troncos" ref={troncos} args={[geo, fab.cor("#5e4a3a", 0.95), L.arvores.length]} castShadow />
    </>
  );
}

/** Gente no pátio da entrada, nas varandas, no caminho de trás e na calçada da avenida (~1,4 m, na escala do prédio) */
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

/** Carros na Av. Barão de Studart (mão única para o sul) e no estacionamento do anexo (~3,7 m) */
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
    const tons = ["#f2f2ef", "#c8ccd0", "#2b2f36", "#8e959c", "#b33a32", "#1f4e8c", "#d9d4c4"];
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

export function PalacioAbolicao({ fab }: { fab: Fabrica }) {
  return (
    <group name="Palacio_da_Abolicao">
      <PecasBlender fab={fab} />
      <Tubos fab={fab} />
      <Arvores fab={fab} />
      <Pessoas fab={fab} />
      <Carros fab={fab} />
    </group>
  );
}
