import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Fabrica } from "../../Cena";
import { aleatorio, texturaManchada } from "../../util/geometria";
import layout from "../../../blender/saida/theatroJoseDeAlencar-layout.json";

/**
 * Theatro José de Alencar (Centro; −3,727786, −38,5317064), inaugurado em 17/06/1910.
 * As peças estáticas vêm do Blender (`blender/theatroJoseDeAlencar.py` → `blender/saida/theatroJoseDeAlencar-pecas.glb`),
 * com a oclusão de ambiente assada nas cores de vértice e numa imagem do chão:
 * - a fachada eclética verde-clara e branca: corpo central de 2 pavimentos, entrada de 3 arcos entre colunas, alas térreas
 *   com terraço de balaustrada, coroamento com brasão, pinhas e estátuas douradas;
 * - as galerias do pátio interno e, no fundo do pátio, a fachada de ferro art nouveau (Glasgow) com os vitrais;
 * - a sala de espetáculos, a caixa cênica alta e o fundo do palco;
 * - o jardim de Burle Marx ao lado, a Rua Liberato Barroso e a Praça José de Alencar com o monumento.
 * Aqui entram os vitrais desenhados em canvas (com um leve brilho próprio, como à noite), o piso das calçadas, as cores
 * das chapas do telhado e o que se repete (árvores, palmeiras, gente e carros). Posições em
 * `blender/saida/theatroJoseDeAlencar-layout.json`. Metros, base em y = 0; a composição é girada para a fachada olhar
 * para a câmera (ver `GIRO` no script e o relatório). Fontes em pesquisa/theatroJoseDeAlencar/ficha.md.
 */

/** Altura da etiqueta com o nome no tour (cumeeira da caixa cênica a ~15,8 m, + ~2 m) */
export const ALTURA_ETIQUETA = 18;

const BASE = "/blender/saida/";

/** Cor das telhas (o exportador do Blender não leva a cor-base de material com textura): chapa metálica e barro */
const COR_TELHA: Record<string, string> = { Mat_Telha_Metalica: "#8e9296", Mat_Telha_Barro: "#b9603c" };

type Arvore = [x: number, yBase: number, z: number, r: number];
type Palmeira = [x: number, z: number, h: number, giro: number];
type Pessoa = [x: number, y: number, z: number, giro: number, cor: number];
type Carro = [x: number, z: number, giro: number, cor: number];
type Barra = [x: number, z: number, yBase: number, h: number];
const L = layout as { arvores: Arvore[]; palmeiras: Palmeira[]; pessoas: Pessoa[]; carros: Carro[]; barras: Barra[]; chao: { lado: number; z0: number } };
const Z0 = L.chao.z0;

const VITRAL = ["#2d6fb8", "#e0a63a", "#c0392b", "#3c9a5a", "#f2d06b", "#7a4fa0", "#e0a63a", "#2d6fb8"];
const FERRO = "#2f5a45";
const CHUMBO = "#1b2a22";
const OURO = "#d8b04e";

/**
 * Atlas dos vitrais (512 × 256, regiões iguais a `VITRAIS` no script):
 * - ferro (0–376 × 0–256): elevação da fachada de ferro do pátio, 14,4 × 9,8 m, 5 vãos (2,6 + 2,6 + 4 + 2,6 + 2,6 m) em
 *   3 níveis: portas em arco com bandeira em leque, janelas de vitral em grade e janelas altas em arco no último nível,
 *   com ornatos dourados e volutas art nouveau entre os arcos. O ferro é verde-escuro e os vitrais azul, âmbar,
 *   vermelho, verde e amarelo (as fontes citam verde, vermelho e azul; o desenho exato é interpretação);
 * - leque (376–512 × 0–68): meia-lua do coroamento, em raios coloridos;
 * - brasão (376–512 × 68–256): cartela branca com escudo dourado (relevo pintado; o desenho é neutro, sem heráldica).
 */
function texturaVitrais() {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext("2d")!;
  const r = aleatorio(1908);
  const PX = 376 / 14.4, PY = 256 / 9.76;
  const X = (m: number) => m * PX;
  const Y = (z: number) => 256 - (z - 0.04) * PY;
  const cor = () => VITRAL[Math.floor(r() * VITRAL.length)];

  /** Grade de vidros coloridos dentro de um retângulo (em pixels) */
  const grade = (x0: number, y0: number, x1: number, y1: number, cols: number, lins: number) => {
    const w = (x1 - x0) / cols, h = (y1 - y0) / lins;
    for (let i = 0; i < cols; i++) for (let j = 0; j < lins; j++) {
      g.fillStyle = cor();
      g.fillRect(x0 + i * w, y0 + j * h, w, h);
    }
    g.strokeStyle = CHUMBO;
    g.lineWidth = 1;
    for (let i = 0; i <= cols; i++) { g.beginPath(); g.moveTo(x0 + i * w, y0); g.lineTo(x0 + i * w, y1); g.stroke(); }
    for (let j = 0; j <= lins; j++) { g.beginPath(); g.moveTo(x0, y0 + j * h); g.lineTo(x1, y0 + j * h); g.stroke(); }
  };
  /** Leque de raios coloridos numa meia-lua de centro (cx, cy) e raio rr */
  const leque = (cx: number, cy: number, rr: number, n: number, miolo: number) => {
    for (let k = 0; k < n; k++) {
      g.fillStyle = VITRAL[(k * 3 + 1) % 6];
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, rr, Math.PI + (k / n) * Math.PI, Math.PI + ((k + 1) / n) * Math.PI);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = CHUMBO;
    g.lineWidth = 1.2;
    for (let k = 0; k <= n; k++) {
      const a = Math.PI + (k / n) * Math.PI;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); g.stroke();
    }
    g.beginPath(); g.arc(cx, cy, rr * 0.62, Math.PI, 0); g.stroke();
    g.fillStyle = OURO;
    g.beginPath(); g.arc(cx, cy, miolo, Math.PI, 0); g.fill();
  };
  /** Janela alta em arco: grade de vidros embaixo e leque no arco */
  const janelaArco = (x0: number, x1: number, yTop: number, yBase: number, cols: number) => {
    const rr = (x1 - x0) / 2, cx = (x0 + x1) / 2, yArco = yTop + rr;
    g.fillStyle = "#5f8f6a";
    g.fillRect(x0 - 2, yArco, x1 - x0 + 4, yBase - yArco + 2);
    g.beginPath(); g.arc(cx, yArco, rr + 2, Math.PI, 0); g.fill();
    grade(x0, yArco, x1, yBase, cols, Math.max(2, Math.round((yBase - yArco) / ((x1 - x0) / cols))));
    leque(cx, yArco, rr, 7, rr * 0.28);
    g.strokeStyle = OURO;
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(cx, yArco, rr + 3, Math.PI, 0); g.stroke();
  };
  /** Voluta art nouveau (chicote) dourada ou verde-clara */
  const voluta = (x: number, y: number, s: number, esp: number, c: string) => {
    g.strokeStyle = c;
    g.lineWidth = esp;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + 6 * s, y - 10, x + 14 * s, y + 2, x + 9 * s, y + 7);
    g.bezierCurveTo(x + 5 * s, y + 10, x + 2 * s, y + 4, x + 6 * s, y + 3);
    g.stroke();
  };

  // ferro de fundo e frisos verde-claros dos níveis
  g.fillStyle = FERRO;
  g.fillRect(0, 0, 376, 256);
  const vaos: [number, number][] = [[0, 2.6], [2.6, 5.2], [5.2, 9.2], [9.2, 11.8], [11.8, 14.4]];
  for (const [a, b] of vaos) {
    const x0 = X(a + 0.22), x1 = X(b - 0.22);
    const largo = b - a > 3;
    // térreo: portas em arco (vidro escuro embaixo, bandeira em leque)
    const xm0 = largo ? X(a + 0.6) : x0 + 4, xm1 = largo ? X(b - 0.6) : x1 - 4;
    const rr = (xm1 - xm0) / 2, cx = (xm0 + xm1) / 2, ya = Y(3.3) + rr;
    g.fillStyle = "#24302c";
    g.fillRect(xm0, ya, xm1 - xm0, Y(0.05) - ya);
    g.strokeStyle = "#5f8f6a";
    g.lineWidth = 1.5;
    for (let k = 1; k < (largo ? 4 : 2); k++) { const xx = xm0 + ((xm1 - xm0) * k) / (largo ? 4 : 2); g.beginPath(); g.moveTo(xx, ya); g.lineTo(xx, Y(0.05)); g.stroke(); }
    leque(cx, ya, rr, largo ? 9 : 6, rr * 0.25);
    // nível 1: vitral em grade com bandeira de vidros quadrados
    grade(x0, Y(6.2), x1, Y(3.78), largo ? 9 : 5, 6);
    g.fillStyle = OURO;
    g.fillRect(x0, Y(5.25), x1 - x0, 2);
    // nível 2: janela alta em arco
    janelaArco(x0 + 3, x1 - 3, Y(9.35), Y(6.62), largo ? 8 : 4);
  }
  // ornamentos: frisos dourados nas vigas e volutas entre os arcos do último nível
  g.fillStyle = OURO;
  for (const z of [3.5, 6.42, 9.62]) g.fillRect(0, Y(z) - 1, 376, 2);
  for (const [a, b] of vaos) {
    voluta(X(a) + 3, Y(9.2), 1, 1.6, OURO);
    voluta(X(b) - 3, Y(9.2), -1, 1.6, OURO);
    voluta(X(a) + 4, Y(6.0), 1, 1.2, "#7fb08a");
    voluta(X(b) - 4, Y(6.0), -1, 1.2, "#7fb08a");
  }

  // leque do coroamento
  g.fillStyle = FERRO;
  g.fillRect(376, 0, 136, 68);
  leque(444, 68, 66, 13, 16);
  g.strokeStyle = OURO;
  g.lineWidth = 2;
  g.beginPath(); g.arc(444, 68, 66, Math.PI, 0); g.stroke();

  // brasão: cartela branca, escudo com borda e ornato dourados
  g.fillStyle = "#f4f2ea";
  g.fillRect(376, 68, 136, 188);
  const bx = 444, by = 80;
  g.fillStyle = OURO;
  g.beginPath();
  g.moveTo(bx - 46, by + 12); g.lineTo(bx + 46, by + 12); g.lineTo(bx + 46, by + 100);
  g.quadraticCurveTo(bx + 44, by + 150, bx, by + 168); g.quadraticCurveTo(bx - 44, by + 150, bx - 46, by + 100); g.closePath();
  g.fill();
  g.fillStyle = "#e9e3cf";
  g.beginPath();
  g.moveTo(bx - 36, by + 22); g.lineTo(bx + 36, by + 22); g.lineTo(bx + 36, by + 98);
  g.quadraticCurveTo(bx + 34, by + 138, bx, by + 154); g.quadraticCurveTo(bx - 34, by + 138, bx - 36, by + 98); g.closePath();
  g.fill();
  g.strokeStyle = OURO;
  g.lineWidth = 5;
  g.beginPath(); g.arc(bx, by + 84, 22, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(bx, by + 30); g.lineTo(bx, by + 140); g.stroke();

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // UV do glTF: v = 0 no alto da imagem
  t.anisotropy = 4;
  return t;
}

/** Piso das calçadas e da praça (concreto claro em placas com juntas); em cinza, a cor vem de cada material do chão */
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
  g.strokeStyle = "rgba(0,0,0,0.26)";
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

/** Peças do Blender: sombras, nomes por material, vitrais em canvas, telhas, oclusão e piso no chão */
function PecasBlender() {
  const gltf = useLoader(GLTFLoader, `${BASE}theatroJoseDeAlencar-pecas.glb`);
  const ao = useLoader(THREE.TextureLoader, `${BASE}theatroJoseDeAlencar-ao-chao.jpg`);
  const extras = useMemo(() => {
    const vitrais = texturaVitrais();
    const piso = texturaPiso(31, 2);
    piso.repeat.set(L.chao.lado / 3, L.chao.lado / 3);
    // paralelepípedo da Rua Liberato Barroso: o mesmo desenho, bem miúdo
    const rua = texturaPiso(47, 8);
    rua.repeat.set(L.chao.lado / 2.4, L.chao.lado / 2.4);
    const grama = texturaManchada("#ffffff", 0.08, 11, 64);
    grama.repeat.set(9, 9);
    return { vitrais, piso, rua, grama };
  }, []);
  useEffect(() => () => { Object.values(extras).forEach((x) => x.dispose()); }, [extras]);
  const cena = useMemo(() => {
    ao.flipY = false;
    ao.colorSpace = THREE.NoColorSpace;
    ao.userData.mimeType = "image/jpeg"; // o GLTFExporter regrava em JPEG em vez de PNG
    ao.needsUpdate = true;
    const raiz = gltf.scene.clone(true);
    raiz.name = "Pecas_Theatro";
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
        if (mat.name === "Mat_Vitrais") {
          // vitrais com um leve brilho próprio: na sombra do pátio continuam coloridos (como com as luzes acesas)
          novo = Object.assign(new THREE.MeshStandardMaterial({
            map: extras.vitrais, emissiveMap: extras.vitrais, emissive: "#ffffff", emissiveIntensity: 0.32,
            roughness: 0.35, vertexColors: mat.vertexColors,
          }), { name: "Mat_Vitrais" });
        } else {
          novo = mat;
          if (COR_TELHA[mat.name]) mat.color.set(COR_TELHA[mat.name]);
          if (chao) {
            mat.aoMap = ao;
            mat.aoMapIntensity = 1;
            mat.map = mat.name === "Mat_Chao_Grama" ? extras.grama : mat.name === "Mat_Chao_Rua" ? extras.rua : extras.piso;
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

/** Oitis e outras árvores de copa densa da praça, do jardim e do lote vizinho (verde-escuro, como os oitis do Centro) */
function Arvores({ fab }: { fab: Fabrica }) {
  const copa = useRef<THREE.InstancedMesh>(null);
  const tronco = useRef<THREE.InstancedMesh>(null);
  const n = L.arvores.length;
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const r = aleatorio(7);
    const tons = ["#2f5a2b", "#3d6b33", "#2a4f27", "#4c7a3a", "#355f2e", "#5a8541"];
    L.arvores.forEach(([x, yb, z, raio], i) => {
      o.position.set(x, yb + raio * 0.78, z);
      o.scale.set(raio, raio * 0.82, raio * (0.9 + r() * 0.2));
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

const FOLHAS = 10;

/** Palmeiras do jardim de Burle Marx: estipe liso cinza-claro, palmito verde e coroa de folhas arqueadas */
function Palmeiras({ fab }: { fab: Fabrica }) {
  const estipe = useRef<THREE.InstancedMesh>(null);
  const palmito = useRef<THREE.InstancedMesh>(null);
  const folhas = useRef<THREE.InstancedMesh>(null);
  const rec = useMemo(() => ({
    mat: Object.assign(new THREE.MeshStandardMaterial({ color: "#5f9440", roughness: 0.8, side: THREE.DoubleSide }), { name: "Mat_Folha_Palmeira" }),
    folha: geometriaFolha(2.6, 1.2),
    estipe: new THREE.CylinderGeometry(0.13, 0.19, 1, 8).translate(0, 0.5, 0),
    palmito: new THREE.CylinderGeometry(0.14, 0.17, 1, 8).translate(0, 0.5, 0),
  }), []);
  useEffect(() => () => { Object.values(rec).forEach((x) => x.dispose()); }, [rec]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    L.palmeiras.forEach(([x, z, h, giro], i) => {
      const hp = 0.9;
      o.position.set(x, Z0, z);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, h - hp, 1);
      o.updateMatrix();
      estipe.current!.setMatrixAt(i, o.matrix);
      o.position.set(x, Z0 + h - hp, z);
      o.scale.set(1, hp, 1);
      o.updateMatrix();
      palmito.current!.setMatrixAt(i, o.matrix);
      for (let f = 0; f < FOLHAS; f++) {
        const a = giro + (f / FOLHAS) * Math.PI * 2;
        o.rotation.set(f % 3 === 0 ? -0.8 : f % 3 === 1 ? -0.35 : 0.0, a, 0, "YXZ");
        o.position.set(x, Z0 + h - 0.05, z);
        o.scale.setScalar(f % 3 === 0 ? 0.8 : 1);
        o.updateMatrix();
        folhas.current!.setMatrixAt(i * FOLHAS + f, o.matrix);
        folhas.current!.setColorAt(i * FOLHAS + f, cor.set(f % 3 ? "#ffffff" : "#dfe9c9"));
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
      <instancedMesh name="Palmeiras_Estipes" ref={estipe} args={[rec.estipe, undefined, n]} castShadow material={fab.cor("#c8c1b2", 0.8)} />
      <instancedMesh name="Palmeiras_Palmitos" ref={palmito} args={[rec.palmito, undefined, n]} castShadow material={fab.cor("#7f9d48", 0.7)} />
      <instancedMesh name="Palmeiras_Folhas" ref={folhas} args={[rec.folha, rec.mat, n * FOLHAS]} castShadow />
    </>
  );
}

/** Gente na calçada da entrada, na praça, no pátio e no caminho do jardim (na escala do prédio, ~1,4 m) */
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

/** Carros estacionados na Rua Liberato Barroso, do lado da praça, e um passando (na escala do prédio, ~3,7 m) */
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

/** Barras de ferro verde-escuro dos gradis do jardim e do lote vizinho e dos guarda-corpos dos balcões da fachada de ferro */
function Barras({ fab }: { fab: Fabrica }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.BoxGeometry(0.035, 1, 0.035).translate(0, 0.5, 0), []);
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
  return <instancedMesh name="Gradis_Barras" ref={ref} args={[geo, undefined, L.barras.length]} castShadow material={fab.cor("#2f5a45", 0.5)} />;
}

export function TheatroJoseDeAlencar({ fab }: { fab: Fabrica }) {
  return (
    <group name="Theatro_Jose_de_Alencar">
      <PecasBlender />
      <Arvores fab={fab} />
      <Palmeiras fab={fab} />
      <Pessoas fab={fab} />
      <Carros fab={fab} />
      <Barras fab={fab} />
    </group>
  );
}
