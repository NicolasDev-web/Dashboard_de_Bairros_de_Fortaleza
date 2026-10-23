import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Fabrica } from "../../Cena";
import { aleatorio, texturaManchada } from "../../util/geometria";
import layout from "../../../blender/saida/dragaoDoMar-layout.json";

/**
 * Centro Dragão do Mar de Arte e Cultura (Centro/Praia de Iracema; −3,7216677, −38,5201742).
 * As peças estáticas vêm do Blender (`blender/dragaoDoMar.py` → `blender/saida/dragaoDoMar-pecas.glb`), com a oclusão de
 * ambiente assada nas cores de vértice e numa imagem do chão. São elas:
 * - o museu de cubos brancos com pirâmides rosa;
 * - o Planetário com a cúpula geodésica;
 * - a Torre do Café, a torre sul e as passarelas de treliça vermelha sobre o calçadão da Rua Dragão do Mar;
 * - a rampa curva;
 * - os casarões coloridos;
 * - o Anfiteatro e o mobiliário da Praça Almirante Saldanha.
 *
 * Aqui entram o que se repete (árvores, coqueiros, gente), os murais e o letreiro desenhados em canvas e o piso de pedra
 * das praças. Posições em `blender/saida/dragaoDoMar-layout.json`.
 * Metros, base em y = 0, norte em −z; fontes em pesquisa/dragaoDoMar/ficha.md.
 */

/** Altura da etiqueta com o nome no tour (topo da torre sul, ~13,4 m, + ~2 m) */
export const ALTURA_ETIQUETA = 15;

const BASE = "/blender/saida/";

type Arvore = [x: number, yBase: number, z: number, r: number];
type Coqueiro = [x: number, z: number, h: number, giro: number];
type Pessoa = [x: number, y: number, z: number, giro: number, cor: number];
const L = layout as { arvores: Arvore[]; coqueiros: Coqueiro[]; pessoas: Pessoa[]; chao: { lado: number; z0: number } };
const Z0 = L.chao.z0;

/**
 * Atlas dos murais (512 × 256, mesmas regiões de `MURAIS` no dragaoDoMar.py). As fotos mostram que os murais existem e
 * como são as cores, mas mudam com o tempo; aqui são composições que lembram cada um:
 * - retrato: rosto estilizado sobre fundo amarelo (aérea de 2018);
 * - peixes: grafite colorido de peixes e barco (fotos de 2025);
 * - letreiro: logotipo vermelho e "DRAGÃO DO MAR" (foto da entrada);
 * - azul: mosaico azul com figuras brancas.
 */
function texturaMurais() {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext("2d")!;
  const r = aleatorio(1999);
  // retrato sobre fundo amarelo
  g.fillStyle = "#f2c230";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#e39a26";
  for (let i = 0; i < 9; i++) g.fillRect(r() * 256, r() * 256, 18 + r() * 40, 6 + r() * 10);
  g.fillStyle = "#5a3424";
  g.beginPath();
  g.ellipse(128, 120, 62, 84, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2a1a14";
  g.beginPath();
  g.ellipse(128, 58, 70, 36, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f3efe6";
  for (const x of [104, 152]) {
    g.beginPath();
    g.ellipse(x, 112, 12, 7, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#1c1210";
  for (const x of [104, 152]) {
    g.beginPath();
    g.arc(x, 112, 5, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#3d2219";
  g.fillRect(118, 120, 20, 30);
  g.fillStyle = "#b8483a";
  g.fillRect(106, 166, 44, 10);
  g.fillStyle = "#2f6fb3";
  g.fillRect(40, 214, 176, 42);
  // grafite de peixes sobre fundo vermelho
  g.fillStyle = "#d6452f";
  g.fillRect(256, 0, 256, 128);
  const cores = ["#2a62b8", "#f2c230", "#2f9a5b", "#25a7c9", "#f08a3c", "#7a3fa0"];
  for (let i = 0; i < 5; i++) {
    const x = 280 + i * 46 + r() * 10, y = 34 + r() * 60, s = 18 + r() * 16;
    g.fillStyle = cores[i % cores.length];
    g.beginPath();
    g.ellipse(x, y, s * 1.3, s * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(x + s * 1.1, y);
    g.lineTo(x + s * 2.0, y - s * 0.7);
    g.lineTo(x + s * 2.0, y + s * 0.7);
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(x - s * 0.7, y - s * 0.15, s * 0.18, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#1f3f8c";
  g.beginPath();
  g.moveTo(300, 118);
  g.lineTo(470, 118);
  g.lineTo(440, 100);
  g.lineTo(330, 100);
  g.fill();
  // letreiro: logotipo (jangada estilizada) e o nome em vermelho-escuro sobre branco
  g.fillStyle = "#f4f2ec";
  g.fillRect(256, 128, 256, 48);
  g.fillStyle = "#8f1d22";
  g.beginPath();
  g.moveTo(266, 140);
  g.lineTo(316, 140);
  g.lineTo(306, 160);
  g.lineTo(276, 160);
  g.fill();
  g.fillRect(272, 134, 6, 8);
  g.fillRect(300, 134, 6, 8);
  g.font = "800 22px system-ui, sans-serif";
  g.textBaseline = "middle";
  g.textAlign = "left";
  let tam = 22;
  while (g.measureText("DRAGÃO DO MAR").width > 180 && tam > 8) g.font = `800 ${(tam -= 1)}px system-ui, sans-serif`;
  g.fillText("DRAGÃO DO MAR", 324, 152);
  // mosaico azul com figuras brancas
  for (let y = 176; y < 256; y += 6) {
    for (let x = 256; x < 512; x += 6) {
      const v = r();
      g.fillStyle = v < 0.5 ? "#2c5aa8" : v < 0.8 ? "#3d74c4" : "#1d3f86";
      g.fillRect(x, y, 6, 6);
    }
  }
  g.fillStyle = "#eef1f6";
  for (let i = 0; i < 5; i++) {
    const x = 285 + i * 48, y = 210;
    g.beginPath();
    g.arc(x, y - 18, 8, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(x, y + 14, 14, 26, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // UV do glTF: v = 0 no alto da imagem
  t.anisotropy = 4;
  return t;
}

/**
 * Piso de pedra das praças e do calçadão (fotos da Praça Almirante Saldanha): grandes quadros claros com juntas e uma
 * faixa diagonal de pedra mais escura. Em tons de cinza; a cor vem de cada material do chão.
 */
function texturaPiso() {
  const n = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = n;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#f4f4f4";
  g.fillRect(0, 0, n, n);
  const r = aleatorio(31);
  for (let i = 0; i < 260; i++) {
    const v = r() * 0.07;
    g.fillStyle = `rgba(0,0,0,${v})`;
    g.fillRect(r() * n, r() * n, 2 + r() * 5, 2 + r() * 5);
  }
  g.strokeStyle = "rgba(0,0,0,0.10)";
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(0, n);
  g.lineTo(n, 0);
  g.stroke();
  g.strokeStyle = "rgba(0,0,0,0.28)";
  g.lineWidth = 2;
  g.strokeRect(1, 1, n - 2, n - 2);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Peças do Blender: sombras, nomes por material, oclusão e piso no chão, murais */
function PecasBlender() {
  const gltf = useLoader(GLTFLoader, `${BASE}dragaoDoMar-pecas.glb`);
  const ao = useLoader(THREE.TextureLoader, `${BASE}dragaoDoMar-ao-chao.jpg`);
  const extras = useMemo(() => {
    const murais = texturaMurais();
    const piso = texturaPiso();
    piso.repeat.set(L.chao.lado / 2.6, L.chao.lado / 2.6);
    const grama = texturaManchada("#ffffff", 0.08, 11, 64);
    grama.repeat.set(9, 9);
    return { murais, piso, grama };
  }, []);
  useEffect(() => () => { extras.murais.dispose(); extras.piso.dispose(); extras.grama.dispose(); }, [extras]);
  const cena = useMemo(() => {
    ao.flipY = false;
    ao.colorSpace = THREE.NoColorSpace;
    ao.userData.mimeType = "image/jpeg"; // o GLTFExporter regrava em JPEG em vez de PNG
    ao.needsUpdate = true;
    const raiz = gltf.scene.clone(true);
    raiz.name = "Pecas_Dragao_do_Mar";
    const trocas = new Map<THREE.Material, THREE.Material>();
    raiz.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const pai = m.parent && m.parent !== raiz ? m.parent.name : m.name;
      m.name = `${pai}_${mat.name.replace(/^Mat_/, "")}`;
      const chao = mat.name.startsWith("Mat_Chao_");
      m.castShadow = !chao;
      m.receiveShadow = true;
      let novo = trocas.get(mat);
      if (!novo) {
        if (mat.name === "Mat_Murais") {
          novo = Object.assign(new THREE.MeshStandardMaterial({ map: extras.murais, roughness: 0.7, vertexColors: mat.vertexColors }), { name: "Mat_Murais" });
        } else {
          novo = mat;
          if (chao) {
            mat.aoMap = ao;
            mat.aoMapIntensity = 1;
            mat.map = mat.name === "Mat_Chao_Grama" ? extras.grama : extras.piso;
            mat.needsUpdate = true;
          }
        }
        trocas.set(mat, novo);
      }
      m.material = novo;
    });
    return raiz;
  }, [gltf, ao, extras]);
  return <primitive object={cena} />;
}

/** Árvores das praças: copas baixas em vários verdes, com tronco (posições do OSM levadas à miniatura) */
function Arvores({ fab }: { fab: Fabrica }) {
  const copa = useRef<THREE.InstancedMesh>(null);
  const tronco = useRef<THREE.InstancedMesh>(null);
  const n = L.arvores.length;
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const r = aleatorio(7);
    const tons = ["#2f5a2b", "#3d6b33", "#4c7a3a", "#2a4f27", "#5a8541", "#355f2e"];
    L.arvores.forEach(([x, yb, z, raio], i) => {
      o.position.set(x, yb + raio * 0.82, z);
      o.scale.set(raio, raio * 0.8, raio * (0.9 + r() * 0.2));
      o.rotation.set(0, r() * Math.PI * 2, 0);
      o.updateMatrix();
      copa.current!.setMatrixAt(i, o.matrix);
      copa.current!.setColorAt(i, cor.set(tons[Math.floor(r() * tons.length)]));
      o.position.set(x, Z0, z);
      o.scale.set(1, yb - Z0 + 0.35, 1);
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
  const geo = useMemo(() => ({ tronco: new THREE.CylinderGeometry(0.12, 0.18, 1, 6).translate(0, 0.5, 0) }), []);
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

const FOLHAS = 8;

/** Coqueiros dos jardins de dentro da rampa e da Praça Almirante Saldanha (estipe inclinado, cachos e coroa) */
function Coqueiros({ fab }: { fab: Fabrica }) {
  const estipe = useRef<THREE.InstancedMesh>(null);
  const folhas = useRef<THREE.InstancedMesh>(null);
  const cocos = useRef<THREE.InstancedMesh>(null);
  const rec = useMemo(() => ({
    mat: Object.assign(new THREE.MeshStandardMaterial({ color: "#5f9440", roughness: 0.8, side: THREE.DoubleSide }), { name: "Mat_Folha_Palmeira" }),
    folha: geometriaFolha(2.1, 1.35),
    estipe: new THREE.CylinderGeometry(0.09, 0.14, 1, 6).translate(0, 0.5, 0),
  }), []);
  useEffect(() => () => { Object.values(rec).forEach((x) => x.dispose()); }, [rec]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    L.coqueiros.forEach(([x, z, h, g], i) => {
      const inc = 0.12;
      o.position.set(x, Z0, z);
      o.rotation.set(inc, g, 0, "YXZ");
      o.scale.set(1, h, 1);
      o.updateMatrix();
      estipe.current!.setMatrixAt(i, o.matrix);
      const topo = new THREE.Vector3(0, h, 0).applyEuler(new THREE.Euler(inc, g, 0, "YXZ")).add(new THREE.Vector3(x, Z0, z));
      o.position.copy(topo).add(new THREE.Vector3(0, -0.18, 0));
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      cocos.current!.setMatrixAt(i, o.matrix);
      for (let f = 0; f < FOLHAS; f++) {
        const a = g + (f / FOLHAS) * Math.PI * 2;
        o.rotation.set(f % 2 ? -0.3 : 0.1, a, 0, "YXZ");
        o.position.copy(topo);
        o.scale.setScalar(f % 2 ? 0.85 : 1);
        o.updateMatrix();
        folhas.current!.setMatrixAt(i * FOLHAS + f, o.matrix);
        folhas.current!.setColorAt(i * FOLHAS + f, cor.set(f % 3 ? "#ffffff" : "#d9e6c4"));
      }
    });
    for (const m of [estipe.current!, folhas.current!, cocos.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, []);
  const n = L.coqueiros.length;
  return (
    <>
      <instancedMesh name="Coqueiros_Estipes" ref={estipe} args={[rec.estipe, undefined, n]} castShadow material={fab.cor("#7a6650")} />
      <instancedMesh name="Coqueiros_Cachos" ref={cocos} args={[undefined, undefined, n]} castShadow material={fab.cor("#7f9d48", 0.7)}>
        <icosahedronGeometry args={[0.28, 0]} />
      </instancedMesh>
      <instancedMesh name="Coqueiros_Folhas" ref={folhas} args={[rec.folha, rec.mat, n * FOLHAS]} castShadow />
    </>
  );
}

/** Gente no calçadão, na praça, sob o Planetário, na rampa e na passarela (exagerada como nos outros marcos) */
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

export function DragaoDoMar({ fab }: { fab: Fabrica }) {
  return (
    <group name="Dragao_do_Mar">
      <PecasBlender />
      <Arvores fab={fab} />
      <Coqueiros fab={fab} />
      <Pessoas fab={fab} />
    </group>
  );
}
