import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Fabrica } from "../../Cena";
import { aleatorio, texturaManchada } from "../../util/geometria";
import layout from "../../../blender/saida/reitoriaUfc-layout.json";

/**
 * Reitoria da UFC (Benfica; −3,7414294, −38,5393982): o antigo palacete da família Gentil (1918), comprado pela UFC em
 * 1956 e ampliado em planta H (OSM way/371206594).
 * As peças estáticas vêm do Blender (`blender/reitoriaUfc.py` → `blender/saida/reitoriaUfc-pecas.glb`), com a oclusão
 * de ambiente assada nas cores de vértice e numa imagem do chão:
 * - o prédio em H de reboco rosa-salmão e estuque branco, com as varandas de colunas e as sacadas dos dois pátios;
 * - o palacete na ponta da ala nordeste: pórtico de colunas pareadas, sacada, loggia com arco, frontão com volutas,
 *   flor-de-lis e pináculos, e o torreão de cantos chanfrados com o mirante de balaústres;
 * - o jardim da frente com a via interna, o gradil e a Av. da Universidade; atrás, a Concha Acústica.
 * Aqui entram as bandeiras em canvas, os pisos, a cor das telhas e o que se repete (colunas jônicas, balaústres,
 * mangueiras e oitis, carnaúbas, barras do gradil, gente e carros). Posições em `blender/saida/reitoriaUfc-layout.json`.
 * Metros, base em y = 0; a composição é girada para o pátio da frente olhar para a câmera (ver `GIRO` no script e o
 * relatório). Fontes em pesquisa/reitoriaUfc/ficha.md.
 */

/** Altura da etiqueta com o nome no tour (pináculos do mirante do torreão a ~14,2 m, + ~2 m) */
export const ALTURA_ETIQUETA = 16;

const BASE = "/blender/saida/";

/** Cor das telhas de barro (o exportador do Blender não leva a cor-base de material com textura) */
const COR_TELHA: Record<string, string> = { Mat_Telha_Barro: "#ad6247" };
const BRANCO = "#f6f2ea";
/** Materiais com a mancha sutil (variação de cor do reboco envelhecido, das pedras e da arquibancada) */
const MANCHADOS = ["Mat_Reboco_Rosa", "Mat_Embasamento_Pedra", "Mat_Cobertura_Laje", "Mat_Arquibancada"];

type Arvore = [x: number, yBase: number, z: number, r: number, tipo: number];
type Carnauba = [x: number, z: number, h: number, giro: number];
type Pessoa = [x: number, y: number, z: number, giro: number, cor: number];
type Carro = [x: number, z: number, giro: number, cor: number];
type Coluna = [x: number, z: number, yBase: number, h: number, esc: number, giro: number];
type Haste = [x: number, z: number, yBase: number, h: number];
const L = layout as {
  arvores: Arvore[]; carnaubas: Carnauba[]; pessoas: Pessoa[]; carros: Carro[]; colunas: Coluna[];
  balaustres: Haste[]; barras: Haste[]; chao: { lado: number; z0: number };
};
const Z0 = L.chao.z0;

/**
 * Bandeiras dos mastros do pátio (256 × 64, regiões iguais a `BANDEIRAS` no script): Brasil, Ceará (verde com o losango
 * amarelo e o círculo branco) e UFC (branca com o escudo azul; desenho simplificado, a confirmar).
 */
function texturaBandeiras() {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext("2d")!;
  const losango = (x0: number, x1: number, cor: string, m = 6) => {
    g.fillStyle = cor;
    g.beginPath();
    g.moveTo((x0 + x1) / 2, m); g.lineTo(x1 - m, 32); g.lineTo((x0 + x1) / 2, 64 - m); g.lineTo(x0 + m, 32);
    g.closePath();
    g.fill();
  };
  // Brasil
  g.fillStyle = "#109a43"; g.fillRect(0, 0, 85, 64);
  losango(0, 85, "#f7d417");
  g.fillStyle = "#1f3f8f"; g.beginPath(); g.arc(42.5, 32, 14, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#ffffff"; g.lineWidth = 2.5; g.beginPath(); g.arc(42.5, 46, 17, Math.PI * 1.22, Math.PI * 1.78); g.stroke();
  // Ceará
  g.fillStyle = "#14894a"; g.fillRect(85, 0, 85, 64);
  losango(85, 170, "#f2cf1d");
  g.fillStyle = "#ffffff"; g.beginPath(); g.arc(127.5, 32, 12, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#2f7d4a"; g.beginPath(); g.arc(127.5, 32, 6, 0, Math.PI * 2); g.fill();
  // UFC
  g.fillStyle = "#f7f7f4"; g.fillRect(170, 0, 86, 64);
  g.fillStyle = "#1d4f9c";
  g.beginPath();
  g.moveTo(199, 12); g.lineTo(227, 12); g.lineTo(227, 34); g.quadraticCurveTo(226, 50, 213, 56); g.quadraticCurveTo(200, 50, 199, 34);
  g.closePath();
  g.fill();
  g.fillStyle = "#f2cf1d"; g.fillRect(205, 26, 16, 4);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // UV do glTF: v = 0 no alto da imagem
  t.anisotropy = 4;
  return t;
}

/** Piso em placas com juntas (calçadas, pedra clara, paralelepípedo miúdo); em cinza, a cor vem de cada material */
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

/** Peças do Blender: sombras, nomes por material, bandeiras em canvas, cor das telhas, oclusão e pisos no chão */
function PecasBlender() {
  const gltf = useLoader(GLTFLoader, `${BASE}reitoriaUfc-pecas.glb`);
  const ao = useLoader(THREE.TextureLoader, `${BASE}reitoriaUfc-ao-chao.jpg`);
  const extras = useMemo(() => {
    const bandeiras = texturaBandeiras();
    const piso = texturaPiso(31, 2);
    piso.repeat.set(L.chao.lado / 2.4, L.chao.lado / 2.4);
    const pedra = texturaPiso(53, 4, 0.18);
    pedra.repeat.set(L.chao.lado / 3, L.chao.lado / 3);
    const asfalto = texturaManchada("#ffffff", 0.06, 23, 64);
    asfalto.repeat.set(14, 14);
    const grama = texturaManchada("#ffffff", 0.05, 11, 64);
    grama.repeat.set(6, 6);
    // mancha sutil do reboco e das pedras (UV em metros/3 vindo do script)
    const mancha = texturaManchada("#ffffff", 0.05, 7, 64);
    return { bandeiras, piso, pedra, asfalto, grama, mancha };
  }, []);
  useEffect(() => () => { Object.values(extras).forEach((x) => x.dispose()); }, [extras]);
  const cena = useMemo(() => {
    ao.flipY = false;
    ao.colorSpace = THREE.NoColorSpace;
    ao.userData.mimeType = "image/jpeg"; // o GLTFExporter regrava em JPEG em vez de PNG
    ao.needsUpdate = true;
    const raiz = gltf.scene.clone(true);
    raiz.name = "Pecas_Reitoria";
    const mapas: Record<string, THREE.Texture> = {
      Mat_Chao_Grama: extras.grama, Mat_Chao_Asfalto: extras.asfalto, Mat_Chao_Piso: extras.piso, Mat_Chao_Pedra: extras.pedra,
    };
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
        if (mat.name === "Mat_Bandeiras") {
          novo = Object.assign(new THREE.MeshStandardMaterial({ map: extras.bandeiras, roughness: 0.8, vertexColors: mat.vertexColors }), { name: "Mat_Bandeiras" });
        } else {
          novo = mat;
          if (COR_TELHA[mat.name]) mat.color.set(COR_TELHA[mat.name]);
          if (MANCHADOS.includes(mat.name)) {
            mat.map = extras.mancha;
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
  }, [gltf, ao, extras]);
  return <primitive object={cena} />;
}

/**
 * Colunas jônicas brancas das varandas e do pórtico: fuste torneado com base e leve êntase (esticado até a laje) e o
 * capitel em tamanho fixo, com as duas volutas viradas para fora da fachada.
 */
function Colunas({ fab }: { fab: Fabrica }) {
  const fuste = useRef<THREE.InstancedMesh>(null);
  const capitel = useRef<THREE.InstancedMesh>(null);
  const H_CAP = 0.24;
  const geo = useMemo(() => {
    // fuste em unidades da altura (y de 0 a 1), raio em metros
    // sem os polos (r = 0): as pontas ficam escondidas no piso e no capitel, e o torno não gera triângulos degenerados
    const perfil = [[0.235, 0], [0.235, 0.03], [0.2, 0.045], [0.215, 0.06], [0.172, 0.09], [0.168, 0.4], [0.15, 0.97], [0.165, 1]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const f = new THREE.LatheGeometry(perfil, 9);
    // capitel: equino, ábaco e as volutas (cilindros deitados nas pontas)
    const equino = new THREE.CylinderGeometry(0.21, 0.165, 0.09, 9, 1, true).translate(0, 0.045, 0);
    const abaco = new THREE.BoxGeometry(0.46, 0.06, 0.4).translate(0, 0.21, 0);
    const volutas = [-1, 1].map((s) => new THREE.CylinderGeometry(0.085, 0.085, 0.36, 8).rotateX(Math.PI / 2).translate(s * 0.19, 0.12, 0));
    const c = mergeGeometries([equino, abaco, ...volutas].map((x) => x.toNonIndexed()), false)!;
    return { f, c };
  }, []);
  useEffect(() => () => { geo.f.dispose(); geo.c.dispose(); }, [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    L.colunas.forEach(([x, z, y, h, e, g], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, g, 0);
      o.scale.set(e, h - H_CAP * e, e);
      o.updateMatrix();
      fuste.current!.setMatrixAt(i, o.matrix);
      o.position.set(x, y + h - H_CAP * e, z);
      o.scale.setScalar(e);
      o.updateMatrix();
      capitel.current!.setMatrixAt(i, o.matrix);
    });
    for (const m of [fuste.current!, capitel.current!]) {
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, []);
  const n = L.colunas.length;
  const mat = fab.cor(BRANCO, 0.62);
  return (
    <>
      <instancedMesh name="Colunas_Fustes" ref={fuste} args={[geo.f, mat, n]} castShadow receiveShadow />
      <instancedMesh name="Colunas_Capiteis" ref={capitel} args={[geo.c, mat, n]} castShadow receiveShadow />
    </>
  );
}

/** Balaústres torneados (vaso) das sacadas, do alto do palacete e do torreão: brancos, ~0,7 m */
function Balaustres({ fab }: { fab: Fabrica }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    // sem os polos: o pé e a cabeça encostam na base e no corrimão
    const perfil = [[0.06, 0], [0.034, 0.12], [0.078, 0.37], [0.06, 0.55], [0.033, 0.7], [0.06, 1]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(perfil, 5);
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    L.balaustres.forEach(([x, z, y, h], i) => {
      o.position.set(x, y, z);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, []);
  return <instancedMesh name="Balaustres" ref={ref} args={[geo, fab.cor(BRANCO, 0.62), L.balaustres.length]} castShadow receiveShadow />;
}

/** Barras de ferro escuro do gradil da Reitoria na Av. da Universidade */
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
  return <instancedMesh name="Gradil_Barras" ref={ref} args={[geo, fab.cor("#3b4045", 0.5), L.barras.length]} castShadow />;
}

/**
 * Mangueiras (tipo 0) e oitis (tipo 1) do Benfica: a mangueira com tronco grosso e curto, dois galhos abertos e a copa
 * larga e baixa em cinco massas de verde-escuro; o oiti com a copa mais redonda e compacta, num verde mais claro.
 */
function Arvores({ fab }: { fab: Fabrica }) {
  const massas = useRef<THREE.InstancedMesh>(null);
  const troncos = useRef<THREE.InstancedMesh>(null);
  const galhos = useRef<THREE.InstancedMesh>(null);
  const MANGUEIRA: [number, number, number, number][] = [[0, 0.05, 0, 1], [0.52, -0.12, 0.18, 0.68], [-0.48, -0.08, 0.28, 0.66], [0.08, -0.16, -0.56, 0.66], [-0.2, 0.3, -0.12, 0.6]];
  const OITI: [number, number, number, number][] = [[0, 0, 0, 1], [0.42, -0.1, 0.2, 0.62], [-0.36, 0.06, -0.3, 0.6]];
  const lista = useMemo(() => L.arvores.flatMap(([x, yb, z, r, t], i) => (t === 0 ? MANGUEIRA : OITI).map((m) => ({ x, yb, z, r, t, i, m }))), []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const r = aleatorio(1956);
    const tonsManga = ["#24451f", "#2c5226", "#335c2a", "#294b23"];
    const tonsOiti = ["#3f6f30", "#4a7a36", "#38662c"];
    const giros = L.arvores.map(() => r() * Math.PI * 2);
    lista.forEach(({ x, yb, z, r: raio, t, i, m: [dx, dy, dz, s] }, k) => {
      const g = giros[i];
      const px = dx * Math.cos(g) - dz * Math.sin(g), pz = dx * Math.sin(g) + dz * Math.cos(g);
      const achata = t === 0 ? 0.72 : 0.86;
      o.position.set(x + px * raio, yb + raio * (t === 0 ? 0.62 : 0.78) + dy * raio, z + pz * raio);
      o.scale.set(raio * s, raio * s * achata, raio * s * (0.92 + r() * 0.16));
      o.rotation.set(0, r() * Math.PI * 2, 0);
      o.updateMatrix();
      massas.current!.setMatrixAt(k, o.matrix);
      const tons = t === 0 ? tonsManga : tonsOiti;
      massas.current!.setColorAt(k, cor.set(tons[(i + k) % tons.length]).offsetHSL(0, 0, (r() - 0.5) * 0.04));
    });
    L.arvores.forEach(([x, yb, z, raio, t], i) => {
      o.rotation.set(0, 0, 0);
      o.position.set(x, Z0, z);
      const grosso = t === 0 ? 1.45 : 1.05;
      o.scale.set(grosso, yb - Z0 + 0.5, grosso);
      o.updateMatrix();
      troncos.current!.setMatrixAt(i, o.matrix);
      for (let b = 0; b < 2; b++) {
        const g = giros[i] + b * Math.PI + 0.5;
        o.position.set(x, yb - 0.2, z);
        o.rotation.set(0, g, t === 0 ? 0.85 : 0.6, "YXZ");
        o.scale.set(grosso * 0.7, raio * 0.75, grosso * 0.7);
        o.updateMatrix();
        galhos.current!.setMatrixAt(i * 2 + b, o.matrix);
      }
    });
    for (const m of [massas.current!, troncos.current!, galhos.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [lista]);
  const geo = useMemo(() => ({
    tronco: new THREE.CylinderGeometry(0.15, 0.22, 1, 7).translate(0, 0.5, 0),
    galho: new THREE.CylinderGeometry(0.07, 0.11, 1, 5).translate(0, 0.5, 0),
  }), []);
  useEffect(() => () => { geo.tronco.dispose(); geo.galho.dispose(); }, [geo]);
  const n = L.arvores.length;
  const tronco = fab.cor("#5e4a3a", 0.95);
  return (
    <>
      <instancedMesh name="Arvores_Copas" ref={massas} args={[undefined, undefined, lista.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial name="Mat_Copa_Arvore" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh name="Arvores_Troncos" ref={troncos} args={[geo.tronco, tronco, n]} castShadow />
      <instancedMesh name="Arvores_Galhos" ref={galhos} args={[geo.galho, tronco, n * 2]} castShadow />
    </>
  );
}

/**
 * Folha de carnaúba: leque palmado quase redondo e pregueado na ponta de um pecíolo, no plano xz (pecíolo em +z).
 * Material de dois lados.
 */
function geometriaLeque(pec: number, raio: number) {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = 12;
  // pecíolo: tira estreita
  pos.push(-0.04, 0, 0, 0.04, 0, 0, 0.04, 0, pec, -0.04, 0, pec);
  idx.push(0, 1, 2, 0, 2, 3);
  const c = 4;
  pos.push(0, 0, pec);
  for (let i = 0; i <= n; i++) {
    const a = -1.25 + (2.5 * i) / n;
    const dobra = i % 2 ? 0.1 : -0.06;
    pos.push(Math.sin(a) * raio, dobra - 0.12 * (1 - Math.cos(a)), pec + Math.cos(a) * raio);
  }
  for (let i = 0; i < n; i++) idx.push(c, c + 1 + i, c + 2 + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const LEQUES = 20;

/**
 * Carnaúbas do jardim e do pátio da frente (ficha: palmeiras altas): estipe fino cinza com a base mais escura e a copa
 * redonda de folhas em leque verde-acinzentado, umas erguidas, outras caídas.
 */
function Carnaubas({ fab }: { fab: Fabrica }) {
  const estipe = useRef<THREE.InstancedMesh>(null);
  const base = useRef<THREE.InstancedMesh>(null);
  const folhas = useRef<THREE.InstancedMesh>(null);
  const rec = useMemo(() => ({
    mat: Object.assign(new THREE.MeshStandardMaterial({ color: "#8ea46c", roughness: 0.75, side: THREE.DoubleSide }), { name: "Mat_Folha_Carnauba" }),
    folha: geometriaLeque(0.75, 1.05),
    estipe: new THREE.CylinderGeometry(0.12, 0.16, 1, 7).translate(0, 0.5, 0),
    base: new THREE.CylinderGeometry(0.19, 0.21, 1, 7).translate(0, 0.5, 0),
  }), []);
  useEffect(() => () => { Object.values(rec).forEach((x) => x.dispose()); }, [rec]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const r = aleatorio(1934);
    L.carnaubas.forEach(([x, z, h, giro], i) => {
      o.rotation.set(0, 0, 0);
      o.position.set(x, Z0, z);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      estipe.current!.setMatrixAt(i, o.matrix);
      o.scale.set(1, h * 0.28, 1);
      o.updateMatrix();
      base.current!.setMatrixAt(i, o.matrix);
      for (let f = 0; f < LEQUES; f++) {
        const a = giro + (f / LEQUES) * Math.PI * 2 + (r() - 0.5) * 0.3;
        // cinco andares de leques: os de cima quase em pé, os de baixo caídos, para a copa sair redonda
        const inc = [-1.3, -0.8, -0.35, 0.1, 0.55][f % 5];
        o.rotation.set(inc, a, (r() - 0.5) * 1.2, "YXZ");
        o.position.set(x, Z0 + h - 0.05 + (inc < -1 ? 0.15 : 0), z);
        o.scale.setScalar(inc < -1 ? 0.75 : 0.85 + r() * 0.25);
        o.updateMatrix();
        folhas.current!.setMatrixAt(i * LEQUES + f, o.matrix);
        folhas.current!.setColorAt(i * LEQUES + f, cor.set(inc > 0.3 ? "#c9c2a0" : f % 3 ? "#ffffff" : "#dfe6cf"));
      }
    });
    for (const m of [estipe.current!, base.current!, folhas.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, []);
  const n = L.carnaubas.length;
  return (
    <>
      <instancedMesh name="Carnaubas_Estipes" ref={estipe} args={[rec.estipe, undefined, n]} castShadow material={fab.cor("#9b9384", 0.85)} />
      <instancedMesh name="Carnaubas_Base" ref={base} args={[rec.base, undefined, n]} castShadow material={fab.cor("#6f6556", 0.9)} />
      <instancedMesh name="Carnaubas_Folhas" ref={folhas} args={[rec.folha, rec.mat, n * LEQUES]} castShadow />
    </>
  );
}

/** Gente na calçada da avenida, diante do prédio, no pátio e na arquibancada da Concha (na escala do prédio, ~1,4 m) */
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

/** Carros na Av. da Universidade (duas faixas em cada sentido, mão à direita) e na via interna (~3,7 m) */
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

export function ReitoriaUfc({ fab }: { fab: Fabrica }) {
  return (
    <group name="Reitoria_UFC">
      <PecasBlender />
      <Colunas fab={fab} />
      <Balaustres fab={fab} />
      <Barras fab={fab} />
      <Arvores fab={fab} />
      <Carnaubas fab={fab} />
      <Pessoas fab={fab} />
      <Carros fab={fab} />
    </group>
  );
}
