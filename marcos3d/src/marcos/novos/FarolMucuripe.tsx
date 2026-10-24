import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Fabrica } from "../../Cena";
import { aleatorio, texturaManchada, texturaTelhas } from "../../util/geometria";
import layout from "../../../blender/saida/farolMucuripe-layout.json";

/**
 * Farol do Mucuripe, o Farol Velho (Cais do Porto / Serviluz; −3,7078217, −38,4704039), erguido entre 1840 e 1846 por
 * pessoas escravizadas, desativado em 1957, tombado em 1983 e restaurado em 2025.
 * As peças estáticas vêm do Blender (`blender/farolMucuripe.py` → `blender/saida/farolMucuripe-pecas.glb`), com a
 * oclusão de ambiente assada nas cores de vértice e numa imagem do chão:
 * - o farol: corpo octogonal largo de alvenaria amarela com frisos brancos, arcos plenos, janelas de verga reta e
 *   coroamento de ameias; a torre octogonal estreita com a varanda de ferro, a lanterna e a cúpula branca;
 * - o recinto gramado murado no alto, com a escadaria a oeste, vinda da Av. Vicente de Castro;
 * - o casario do Serviluz (OSM comprimido), a praia com as pedras e duas jangadas, o mar a NNE e o muro do porto.
 * Aqui entram o mar (`fab.agua()`), os pisos e telhas em canvas, o brilho da lanterna e o que se repete (coqueiros,
 * árvores, gente e carros). Posições em `blender/saida/farolMucuripe-layout.json`. Metros, base em y = 0, rumo real
 * (norte em −z). Fontes em pesquisa/farolMucuripe/ficha.md.
 */

/** Altura da etiqueta com o nome no tour (para-raios da cúpula a ~22,6 m, + ~2,4 m) */
export const ALTURA_ETIQUETA = 25;

const BASE = "/blender/saida/";

type Coqueiro = [x: number, z: number, h: number, giro: number, inclinacao: number];
type Arvore = [x: number, yBase: number, z: number, r: number];
type Pessoa = [x: number, y: number, z: number, giro: number, cor: number];
type Carro = [x: number, z: number, giro: number, cor: number];
const L = layout as { coqueiros: Coqueiro[]; arvores: Arvore[]; pessoas: Pessoa[]; carros: Carro[]; chao: { lado: number; z0: number; zp: number } };
const Z0 = L.chao.z0;

/** Piso em placas com juntas (calçamento, calçada, caminhos do platô); em cinza, a cor vem de cada material */
function texturaPiso(semente: number, quadros: number, junta = 0.26) {
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
    g.fillRect(i * q + ((j % 2) * q) / 2, j * q, q, q);
  }
  g.strokeStyle = `rgba(0,0,0,${junta})`;
  g.lineWidth = quadros > 4 ? 1.2 : 2;
  for (let j = 0; j <= quadros; j++) {
    g.beginPath(); g.moveTo(0, j * q); g.lineTo(n, j * q); g.stroke();
    for (let i = 0; i <= quadros; i++) {
      const x = i * q + ((j % 2) * q) / 2;
      g.beginPath(); g.moveTo(x, j * q); g.lineTo(x, (j + 1) * q); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Peças do Blender: sombras, nomes por material, mar, telhas, lanterna acesa, oclusão e pisos no chão */
function PecasBlender({ fab }: { fab: Fabrica }) {
  const gltf = useLoader(GLTFLoader, `${BASE}farolMucuripe-pecas.glb`);
  const ao = useLoader(THREE.TextureLoader, `${BASE}farolMucuripe-ao-chao.jpg`);
  const extras = useMemo(() => {
    const lado = L.chao.lado;
    const rua = texturaPiso(23, 8, 0.3);          // paralelepípedo das ruas do Serviluz
    rua.repeat.set(lado / 2.4, lado / 2.4);
    const calcada = texturaPiso(31, 2);
    calcada.repeat.set(lado / 2.5, lado / 2.5);
    const manchada = texturaManchada("#ffffff", 0.08, 11, 64);
    manchada.repeat.set(7, 7);
    const telhas = texturaTelhas("#ffffff", 64);
    telhas.wrapS = telhas.wrapT = THREE.RepeatWrapping;
    telhas.repeat.set(1 / 1.6, 1 / 1.6);           // UV das águas em metros: uma fiada a cada 0,2 m
    return { rua, calcada, manchada, telhas };
  }, []);
  useEffect(() => () => { Object.values(extras).forEach((x) => x.dispose()); }, [extras]);
  const cena = useMemo(() => {
    ao.flipY = false;
    ao.colorSpace = THREE.NoColorSpace;
    ao.userData.mimeType = "image/jpeg"; // o GLTFExporter regrava em JPEG em vez de PNG
    ao.needsUpdate = true;
    const raiz = gltf.scene.clone(true);
    raiz.name = "Pecas_Farol";
    const trocas = new Map<THREE.Material, THREE.Material>();
    const MAPA: Record<string, THREE.Texture> = {
      Mat_Chao_Rua: extras.rua, Mat_Chao_Calcada: extras.calcada, Mat_Chao_Piso: extras.calcada,
      Mat_Chao_Terra: extras.manchada, Mat_Chao_Areia: extras.manchada, Mat_Chao_Grama: extras.manchada, Mat_Chao_Asfalto: extras.manchada,
    };
    raiz.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const pai = m.parent && m.parent !== raiz ? m.parent.name : m.name;
      m.name = `${pai}_${mat.name.replace(/^Mat_/, "")}`;
      const chao = mat.name.startsWith("Mat_Chao_") || mat.name === "Mat_Agua_Mar" || mat.name === "Mat_Espuma" || mat.name === "Mat_Faixa_Branca";
      m.castShadow = !chao;
      m.receiveShadow = true;
      let novo = trocas.get(mat);
      if (!novo) {
        if (mat.name === "Mat_Agua_Mar") novo = fab.agua();
        else if (mat.name === "Mat_Vidro_Lanterna") {
          // a lanterna voltou a acender na restauração de 2025: vidro claro com brilho quente
          novo = Object.assign(new THREE.MeshStandardMaterial({ color: "#fff4cf", emissive: "#ffcf5a", emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.0 }), { name: "Mat_Vidro_Lanterna" });
        } else {
          novo = mat;
          if (mat.name === "Mat_Telha_Barro") {
            mat.color.set("#b4603f");
            mat.map = extras.telhas;
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
 * Folha de palmeira: tira em "V" raso que sobe um pouco e cai em arco, afinando na ponta (a mesma da Unifor).
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

/** Coqueiros da beira da praia: estipe fino e inclinado para o mar, cocos e coroa de folhas caídas */
function Coqueiros({ fab }: { fab: Fabrica }) {
  const estipe = useRef<THREE.InstancedMesh>(null);
  const cocos = useRef<THREE.InstancedMesh>(null);
  const folhas = useRef<THREE.InstancedMesh>(null);
  const rec = useMemo(() => ({
    mat: Object.assign(new THREE.MeshStandardMaterial({ color: "#6a9a3c", roughness: 0.8, side: THREE.DoubleSide }), { name: "Mat_Folha_Coqueiro" }),
    folha: geometriaFolha(2.4, 1.3),
    estipe: new THREE.CylinderGeometry(0.11, 0.17, 1, 7).translate(0, 0.5, 0),
    cocos: new THREE.IcosahedronGeometry(0.32, 0).translate(0, -0.25, 0),
  }), []);
  useEffect(() => () => { Object.values(rec).forEach((x) => x.dispose()); }, [rec]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    L.coqueiros.forEach(([x, z, h, giro, inc], i) => {
      // inclinação para o mar (NNE: (+0,58; −0,81) em x, z no three): giro em x leva o topo para +z, em z para −x
      o.position.set(x, Z0, z);
      o.rotation.set(-0.81 * inc, 0, -0.58 * inc, "XYZ");
      o.scale.set(1, h, 1);
      o.updateMatrix();
      estipe.current!.setMatrixAt(i, o.matrix);
      const topo = new THREE.Vector3(0, h, 0).applyEuler(o.rotation).add(new THREE.Vector3(x, Z0, z));
      o.position.copy(topo);
      o.rotation.set(0, giro, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      cocos.current!.setMatrixAt(i, o.matrix);
      for (let f = 0; f < FOLHAS; f++) {
        const a = giro + (f / FOLHAS) * Math.PI * 2;
        o.rotation.set(f % 3 === 0 ? -0.6 : f % 3 === 1 ? -0.15 : 0.15, a, 0, "YXZ");
        o.position.copy(topo);
        o.scale.setScalar(f % 3 === 0 ? 0.8 : 1);
        o.updateMatrix();
        folhas.current!.setMatrixAt(i * FOLHAS + f, o.matrix);
        folhas.current!.setColorAt(i * FOLHAS + f, cor.set(f % 3 ? "#ffffff" : "#d9c98c"));
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
      <instancedMesh name="Coqueiros_Estipes" ref={estipe} args={[rec.estipe, undefined, n]} castShadow material={fab.cor("#9b8a72", 0.85)} />
      <instancedMesh name="Coqueiros_Cocos" ref={cocos} args={[rec.cocos, undefined, n]} castShadow material={fab.cor("#7f8a3a", 0.7)} />
      <instancedMesh name="Coqueiros_Folhas" ref={folhas} args={[rec.folha, rec.mat, n * FOLHAS]} castShadow />
    </>
  );
}

/** Árvores de copa densa entre as casas (castanholas, oitis: genéricas do bairro) */
function Arvores({ fab }: { fab: Fabrica }) {
  const copa = useRef<THREE.InstancedMesh>(null);
  const tronco = useRef<THREE.InstancedMesh>(null);
  const n = L.arvores.length;
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const r = aleatorio(7);
    const tons = ["#3d6b33", "#4c7a3a", "#355f2e", "#5a8541"];
    L.arvores.forEach(([x, yb, z, raio], i) => {
      o.position.set(x, yb + raio * 0.75, z);
      o.scale.set(raio, raio * 0.8, raio * (0.9 + r() * 0.2));
      o.rotation.set(0, r() * Math.PI * 2, 0);
      o.updateMatrix();
      copa.current!.setMatrixAt(i, o.matrix);
      copa.current!.setColorAt(i, cor.set(tons[Math.floor(r() * tons.length)]));
      o.position.set(x, Z0, z);
      o.scale.set(1, yb - Z0 + 0.4, 1);
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
  const geo = useMemo(() => ({ tronco: new THREE.CylinderGeometry(0.14, 0.2, 1, 6).translate(0, 0.5, 0) }), []);
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

/** Gente no platô do farol, na escadaria, na praia e nas ruas (~1,3 m, na escala do casario) */
function Pessoas({ fab }: { fab: Fabrica }) {
  const corpo = useRef<THREE.InstancedMesh>(null);
  const cabeca = useRef<THREE.InstancedMesh>(null);
  const pernas = useRef<THREE.InstancedMesh>(null);
  const rec = useMemo(() => ({
    corpo: new THREE.CylinderGeometry(0.15, 0.18, 0.54, 7).translate(0, 0.75, 0),
    cabeca: new THREE.IcosahedronGeometry(0.13, 1).translate(0, 1.16, 0),
    pernas: new THREE.CylinderGeometry(0.12, 0.1, 0.5, 6).translate(0, 0.25, 0),
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

/** Carros na Av. Vicente de Castro (~3 m, na escala do casario) */
function Carros({ fab }: { fab: Fabrica }) {
  const corpo = useRef<THREE.InstancedMesh>(null);
  const cabine = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => ({
    c: new THREE.BoxGeometry(3.0, 0.6, 1.35).translate(0, 0.45, 0),
    k: new THREE.BoxGeometry(1.6, 0.5, 1.2).translate(-0.15, 1.0, 0),
  }), []);
  useEffect(() => () => { geo.c.dispose(); geo.k.dispose(); }, [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const tons = ["#f2f2ef", "#c8ccd0", "#2b2f36", "#8e959c", "#b33a32", "#1f4e8c", "#d9d4c4"];
    L.carros.forEach(([x, z, g, k], i) => {
      o.position.set(x, Z0 + 0.008, z);
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

export function FarolMucuripe({ fab }: { fab: Fabrica }) {
  return (
    <group name="Farol_do_Mucuripe">
      <PecasBlender fab={fab} />
      <Coqueiros fab={fab} />
      <Arvores fab={fab} />
      <Pessoas fab={fab} />
      <Carros fab={fab} />
    </group>
  );
}
