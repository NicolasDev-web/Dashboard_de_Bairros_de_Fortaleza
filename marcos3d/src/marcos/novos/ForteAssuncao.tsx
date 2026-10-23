import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Fabrica } from "../../Cena";
import { aleatorio, texturaManchada } from "../../util/geometria";
import layout from "../../../blender/saida/forteAssuncao-layout.json";

/**
 * Fortaleza de Nossa Senhora da Assunção, hoje sede do Comando da 10ª Região Militar, no alto da colina do Centro.
 * As peças estáticas vêm do Blender (`blender/forteAssuncao.py` → `blender/saida/forteAssuncao-forte.glb`), com a oclusão
 * de ambiente assada nas cores de vértice:
 * - o terreno em níveis (Leste-Oeste embaixo, bateria, platô do forte);
 * - as muralhas caiadas e o quartel rosa-antigo em quadra, com telhado cerâmico e frontão "COMANDO";
 * - o pátio murado com pilaretes, as guaritas do portão, a rampa;
 * - o terraço com o espelho d'água, o casario e as ruas.
 *
 * Aqui entram o que é repetido (árvores, coqueiros, carros, gente), o atlas de letreiros, a telha e a textura dos pisos
 * desenhados em canvas, e a água comum dos marcos. Posições em `blender/saida/forteAssuncao-layout.json`.
 * Metros, norte em −z; fontes em pesquisa/forteAssuncao/ficha.md.
 */

/** Acima do telhado e do frontão (≈ 10,3 m); só a torre treliçada do pátio passa disso (≈ 14 m) */
export const ALTURA_ETIQUETA = 12;

const BASE = "/blender/saida/";

type Arvore = [x: number, y: number, z: number, r: number, h: number];
type Coqueiro = [x: number, y: number, z: number, h: number, giro: number];
type Carro = [x: number, y: number, z: number, giro: number, cor: number];
type Pessoa = [x: number, y: number, z: number, giro: number, cor: number];
const L = layout as { arvores: Arvore[]; coqueiros: Coqueiro[]; carros: Carro[]; pessoas: Pessoa[] };

const ROSA = "#b07f80";

/** Texto centrado que encolhe até caber na largura */
function escrever(g: CanvasRenderingContext2D, t: string, x: number, y: number, larg: number, alt: number, cor: string, peso = 800) {
  let tam = alt;
  g.font = `${peso} ${tam}px system-ui, sans-serif`;
  while (g.measureText(t).width > larg && tam > 6) g.font = `${peso} ${(tam -= 1)}px system-ui, sans-serif`;
  g.fillStyle = cor;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(t, x, y);
}

/** Estrela de 5 pontas */
function estrela(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, cor: string) {
  g.fillStyle = cor;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.fill();
}

/** Bandeira do Brasil num retângulo (verde, losango amarelo, círculo azul com faixa branca) */
function bandeira(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.fillStyle = "#1f8a3c";
  g.fillRect(x, y, w, h);
  g.fillStyle = "#f2cf1d";
  g.beginPath();
  g.moveTo(x + w * 0.08, y + h / 2);
  g.lineTo(x + w / 2, y + h * 0.1);
  g.lineTo(x + w * 0.92, y + h / 2);
  g.lineTo(x + w / 2, y + h * 0.9);
  g.fill();
  g.fillStyle = "#1d3f8f";
  g.beginPath();
  g.arc(x + w / 2, y + h / 2, h * 0.25, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#ffffff";
  g.lineWidth = Math.max(1, h * 0.04);
  g.beginPath();
  g.arc(x + w / 2 + h * 0.05, y + h * 0.95, h * 0.5, -Math.PI * 0.68, -Math.PI * 0.32);
  g.stroke();
}

/**
 * Atlas dos letreiros (512 × 256, mesmas regiões de `LETREIROS` no forteAssuncao.py):
 * - frontão escalonado (ref-5): as Armas Nacionais entre duas bandeiras do Brasil drapeadas, com um canhão atrás, e
 *   "COMANDO" embaixo, sobre o rosa da parede;
 * - faixa "10ª REGIÃO MILITAR";
 * - bandeira do Brasil do mastro do portão.
 */
function texturaLetreiros() {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext("2d")!;
  // frontão
  g.fillStyle = ROSA;
  g.fillRect(0, 0, 256, 256);
  // canhão atravessado e roda
  g.save();
  g.translate(128, 150);
  g.rotate(-0.12);
  g.fillStyle = "#2b2b2b";
  g.fillRect(-105, -9, 210, 18);
  g.restore();
  g.strokeStyle = "#3a2c22";
  g.lineWidth = 7;
  g.beginPath();
  g.arc(162, 166, 30, 0, Math.PI * 2);
  g.stroke();
  // bandeiras drapeadas (folhas verdes com o losango amarelo)
  for (const s of [-1, 1]) {
    g.save();
    g.translate(128 + s * 64, 118);
    g.rotate(s * 0.28);
    g.fillStyle = "#24873d";
    g.beginPath();
    g.ellipse(0, 0, 34, 70, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f2cf1d";
    g.beginPath();
    g.moveTo(0, -30);
    g.lineTo(22, 0);
    g.lineTo(0, 30);
    g.lineTo(-22, 0);
    g.fill();
    g.fillStyle = "#1d3f8f";
    g.beginPath();
    g.arc(0, 0, 12, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // escudo prateado com o disco azul e as estrelas
  g.fillStyle = "#dfe2e4";
  g.beginPath();
  g.moveTo(92, 92);
  g.lineTo(164, 92);
  g.lineTo(164, 150);
  g.quadraticCurveTo(160, 186, 128, 200);
  g.quadraticCurveTo(96, 186, 92, 150);
  g.closePath();
  g.fill();
  g.strokeStyle = "#8f9498";
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = "#1f4fa0";
  g.beginPath();
  g.arc(128, 140, 25, 0, Math.PI * 2);
  g.fill();
  const r = aleatorio(10);
  g.fillStyle = "#ffffff";
  for (let i = 0; i < 14; i++) g.fillRect(110 + r() * 34, 124 + r() * 30, 2.5, 2.5);
  // estrela das Armas Nacionais em cima
  estrela(g, 128, 58, 36, "#f2cf1d");
  estrela(g, 128, 60, 26, "#24873d");
  g.fillStyle = "#1d3f8f";
  g.beginPath();
  g.arc(128, 61, 11, 0, Math.PI * 2);
  g.fill();
  // "COMANDO"
  g.fillStyle = "#e9dfc6";
  g.fillRect(20, 214, 216, 40);
  escrever(g, "COMANDO", 128, 235, 200, 34, "#3a2a28");
  // faixa "10ª REGIÃO MILITAR"
  g.fillStyle = ROSA;
  g.fillRect(256, 0, 256, 48);
  escrever(g, "10ª REGIÃO MILITAR", 384, 25, 236, 30, "#3a2a28");
  // bandeira do mastro
  bandeira(g, 256, 64, 128, 90);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // UV do glTF: v = 0 no alto da imagem
  t.anisotropy = 4;
  return t;
}

/** Telha cerâmica capa-e-canal (128 px, repete): seis canais por repetição, fiadas com a sombra da sobreposição */
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

/** Peças do Blender: sombras, nomes por material, água comum, letreiros, telha e pisos manchados */
function PecasBlender({ fab }: { fab: Fabrica }) {
  const gltf = useLoader(GLTFLoader, `${BASE}forteAssuncao-forte.glb`);
  const extras = useMemo(() => {
    const letreiros = texturaLetreiros();
    const telha = texturaTelha();
    const mancha = texturaManchada("#ffffff", 0.09, 17, 64);
    mancha.repeat.set(10, 10);
    return { letreiros, telha, mancha };
  }, []);
  useEffect(() => () => { Object.values(extras).forEach((t) => t.dispose()); }, [extras]);
  const cena = useMemo(() => {
    const raiz = gltf.scene.clone(true);
    raiz.name = "Pecas_Forte";
    const trocas = new Map<THREE.Material, THREE.Material>();
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
        if (mat.name === "Mat_Agua") novo = fab.agua();
        else if (mat.name === "Mat_Letreiros") {
          novo = Object.assign(new THREE.MeshStandardMaterial({ map: extras.letreiros, roughness: 0.6, vertexColors: mat.vertexColors }), { name: "Mat_Letreiros" });
        } else {
          novo = mat;
          if (mat.name === "Mat_Telha_Ceramica") {
            mat.map = extras.telha;
            mat.color.set("#ffffff");
            mat.needsUpdate = true;
          } else if (mat.name === "Mat_Chao_Grama" || mat.name === "Mat_Chao_Paralelepipedo" || mat.name === "Mat_Chao_Calcada") {
            mat.map = extras.mancha;
            mat.needsUpdate = true;
          }
        }
        trocas.set(mat, novo);
      }
      m.material = novo;
    });
    return raiz;
  }, [gltf, fab, extras]);
  return <primitive object={cena} />;
}

/** Atualiza matrizes e cores de uma lista de InstancedMesh */
function finalizar(ms: THREE.InstancedMesh[]) {
  for (const m of ms) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }
}

/**
 * Árvores: as duas fileiras do pátio interno e as do estacionamento (nós do OSM), as copas grandes do Passeio Público
 * (o Benjamin tombado é a maior) e as da praça das velas e da Leste-Oeste. Copa baixa em vários verdes, com tronco.
 */
function Arvores({ fab }: { fab: Fabrica }) {
  const copa = useRef<THREE.InstancedMesh>(null);
  const tronco = useRef<THREE.InstancedMesh>(null);
  const n = L.arvores.length;
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const r = aleatorio(7);
    const tons = ["#2f5a2b", "#3d6b33", "#4c7a3a", "#2a4f27", "#5a8541", "#355f2e"];
    L.arvores.forEach(([x, y, z, raio, h], i) => {
      o.position.set(x, y + h + raio * 0.7, z);
      o.scale.set(raio, raio * 0.78, raio * (0.9 + r() * 0.2));
      o.rotation.set(0, r() * Math.PI * 2, 0);
      o.updateMatrix();
      copa.current!.setMatrixAt(i, o.matrix);
      copa.current!.setColorAt(i, cor.set(tons[Math.floor(r() * tons.length)]));
      o.position.set(x, y, z);
      o.scale.set(1, h + 0.4, 1);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      tronco.current!.setMatrixAt(i, o.matrix);
    });
    finalizar([copa.current!, tronco.current!]);
  }, []);
  const geo = useMemo(() => ({ tronco: new THREE.CylinderGeometry(0.11, 0.17, 1, 6).translate(0, 0.5, 0) }), []);
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
 * Folha de coqueiro: tira em "V" raso que sobe um pouco e cai em arco, afinando na ponta (a mesma ideia da Unifor).
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

const FOLHAS = 9;

/** Coqueiros da bateria do baluarte (ref-3): estipe inclinado, cocos e coroa de folhas arqueadas */
function Coqueiros({ fab }: { fab: Fabrica }) {
  const estipe = useRef<THREE.InstancedMesh>(null);
  const folha = useRef<THREE.InstancedMesh>(null);
  const cocos = useRef<THREE.InstancedMesh>(null);
  const rec = useMemo(() => ({
    folhas: Object.assign(new THREE.MeshStandardMaterial({ color: "#5f9440", roughness: 0.8, side: THREE.DoubleSide }), { name: "Mat_Folha_Coqueiro" }),
    folha: geometriaFolha(2.2, 1.35),
    estipe: new THREE.CylinderGeometry(0.09, 0.14, 1, 6).translate(0, 0.5, 0),
  }), []);
  useEffect(() => () => { Object.values(rec).forEach((x) => x.dispose()); }, [rec]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    L.coqueiros.forEach(([x, y, z, h, g], i) => {
      const inc = 0.13; // estipe inclinado ~7° para o lado `g`
      o.position.set(x, y, z);
      o.rotation.set(inc, g, 0, "YXZ");
      o.scale.set(1, h, 1);
      o.updateMatrix();
      estipe.current!.setMatrixAt(i, o.matrix);
      const topo = new THREE.Vector3(0, h, 0).applyEuler(new THREE.Euler(inc, g, 0, "YXZ")).add(new THREE.Vector3(x, y, z));
      o.position.copy(topo).add(new THREE.Vector3(0, -0.2, 0));
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      cocos.current!.setMatrixAt(i, o.matrix);
      for (let f = 0; f < FOLHAS; f++) {
        const a = g + (f / FOLHAS) * Math.PI * 2;
        o.rotation.set(f % 2 ? -0.35 : 0.1, a, 0, "YXZ");
        o.position.copy(topo);
        o.scale.setScalar(f % 2 ? 0.85 : 1);
        o.updateMatrix();
        folha.current!.setMatrixAt(i * FOLHAS + f, o.matrix);
        folha.current!.setColorAt(i * FOLHAS + f, cor.set(f % 3 ? "#ffffff" : "#d9e6c4"));
      }
    });
    finalizar([estipe.current!, folha.current!, cocos.current!]);
  }, []);
  const n = L.coqueiros.length;
  return (
    <>
      <instancedMesh name="Coqueiros_Estipes" ref={estipe} args={[rec.estipe, undefined, n]} castShadow material={fab.cor("#7a6a55")} />
      <instancedMesh name="Coqueiros_Cachos" ref={cocos} args={[undefined, undefined, n]} castShadow material={fab.cor("#7f9d48", 0.7)}>
        <icosahedronGeometry args={[0.28, 0]} />
      </instancedMesh>
      <instancedMesh name="Coqueiros_Folhas" ref={folha} args={[rec.folha, rec.folhas, n * FOLHAS]} castShadow />
    </>
  );
}

/** Carros no pátio murado (ref-2: quase todos claros e escuros) e nas ruas: Dr. João Moreira, Alberto Nepomuceno, Leste-Oeste */
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

/** Gente no terraço, na porta, no Passeio e nas calçadas; os dois primeiros são os soldados de guarda no portão */
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
    const camisas = ["#f2f2ee", "#2f5fa8", "#e0b23a", "#c8463c", "#3d8a5a", "#1e2a44", "#5b6b3a"];
    const peles = ["#c99a74", "#8d5e3c", "#e3bf9b", "#a8714b"];
    L.pessoas.forEach(([x, y, z, g, k], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, g, 0);
      o.updateMatrix();
      for (const m of [corpo.current!, cabeca.current!, pernas.current!]) m.setMatrixAt(i, o.matrix);
      corpo.current!.setColorAt(i, cor.set(camisas[k % camisas.length]));
      cabeca.current!.setColorAt(i, cor.set(k === 6 ? "#4f5a33" : peles[(i * 3 + k) % peles.length])); // soldado: boina/capacete
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

export function ForteAssuncao({ fab }: { fab: Fabrica }) {
  return (
    <group name="Forte_Assuncao">
      <PecasBlender fab={fab} />
      <Arvores fab={fab} />
      <Coqueiros fab={fab} />
      <Carros fab={fab} />
      <Pessoas fab={fab} />
    </group>
  );
}
