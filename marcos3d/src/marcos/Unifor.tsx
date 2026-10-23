import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Fabrica } from "../Cena";
import { aleatorio, texturaManchada } from "../util/geometria";
import layout from "../../blender/saida/unifor-layout.json";

/**
 * Unifor (Universidade de Fortaleza): a frente do campus vista da Av. Washington Soares.
 * As peças estáticas (chão, avenida, Reitoria verde com arcos, Biblioteca, Centro de Convivência, blocos, jardim) vêm do
 * Blender (`blender/unifor.py` → `blender/saida/unifor-campus.glb`), com a oclusão de ambiente assada nas cores de vértice
 * dos prédios e numa imagem do chão. Aqui entram o que é repetido (mata, palmeiras imperiais, coqueiros, carros), os
 * letreiros desenhados em canvas e a água comum dos marcos. Posições em `blender/saida/unifor-layout.json`.
 * Metros, norte em −z; fontes em pesquisa/unifor/ficha.md.
 */

const BASE = "/blender/saida/";

type Arvore = [x: number, yBase: number, z: number, r: number];
type Imperial = [x: number, z: number, h: number];
type Coqueiro = [x: number, z: number, h: number, giro: number];
type Carro = [x: number, z: number, giro: number, cor: number];
type Pessoa = [x: number, z: number, giro: number, cor: number];
const L = layout as { arvores: Arvore[]; imperiais: Imperial[]; coqueiros: Coqueiro[]; carros: Carro[]; pessoas: Pessoa[]; chao: { lado: number; z0: number } };
const Z0 = L.chao.z0;

/**
 * Atlas dos letreiros (512 × 256, mesmas regiões de `LETREIROS` no unifor.py): faixa "UNIVERSIDADE DE FORTALEZA" do
 * pórtico do Convivência, placa da Fundação Edson Queiroz, totem "Reitoria" e o mural colorido (composição abstrata:
 * a foto só mostra que é colorido e tem uma figura).
 */
function texturaLetreiros() {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext("2d")!;
  const texto = (t: string, x: number, y: number, larg: number, alt: number, cor: string, peso = 800) => {
    let tam = alt;
    g.font = `${peso} ${tam}px system-ui, sans-serif`;
    while (g.measureText(t).width > larg && tam > 6) g.font = `${peso} ${(tam -= 1)}px system-ui, sans-serif`;
    g.fillStyle = cor;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(t, x, y);
  };
  // faixa azul do pórtico
  g.fillStyle = "#1f3f8c";
  g.fillRect(0, 0, 512, 64);
  texto("UNIVERSIDADE DE FORTALEZA", 256, 34, 480, 40, "#ffffff");
  // placa da Fundação: fundo cinza-claro, letras cinza-escuras e o selo à esquerda
  g.fillStyle = "#dcdcd8";
  g.fillRect(0, 64, 256, 64);
  g.fillStyle = "#6d7176";
  g.fillRect(10, 76, 34, 40);
  g.fillStyle = "#dcdcd8";
  g.fillRect(17, 84, 20, 24);
  texto("FUNDAÇÃO EDSON QUEIROZ", 148, 86, 196, 17, "#4a4e53");
  texto("UNIVERSIDADE DE FORTALEZA", 148, 106, 196, 14, "#5d6166", 600);
  // totem "Reitoria": azul com a ponta verde-água em chevron, texto na vertical
  g.fillStyle = "#1d4fa0";
  g.fillRect(256, 64, 64, 192);
  g.fillStyle = "#19a59a";
  g.beginPath();
  g.moveTo(256, 256);
  g.lineTo(256, 222);
  g.lineTo(288, 238);
  g.lineTo(320, 222);
  g.lineTo(320, 256);
  g.fill();
  g.save();
  g.translate(290, 150);
  g.rotate(-Math.PI / 2);
  texto("Reitoria", 0, 0, 140, 34, "#ffffff", 700);
  g.restore();
  // mural: blocos de cor, um sol, padrões em triângulo e uma figura de perfil
  const mx = 320, my = 64;
  const cores = ["#2f8f5b", "#1e66b5", "#f2c230", "#e0593a", "#7a3fa0", "#25a7c9"];
  const r = aleatorio(52);
  g.fillStyle = "#2f8f5b";
  g.fillRect(mx, my, 192, 192);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = cores[Math.floor(r() * cores.length)];
    const x = mx + r() * 170, y = my + r() * 170, s = 20 + r() * 50;
    g.beginPath();
    g.moveTo(x, y + s);
    g.lineTo(x + s / 2, y);
    g.lineTo(x + s, y + s);
    g.fill();
  }
  g.fillStyle = "#f2c230";
  g.beginPath();
  g.arc(mx + 150, my + 46, 22, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1e66b5";
  g.fillRect(mx, my + 150, 192, 42);
  g.fillStyle = "#8a5236";
  g.beginPath();
  g.ellipse(mx + 78, my + 92, 36, 50, -0.15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2a1c18";
  g.beginPath();
  g.ellipse(mx + 70, my + 52, 42, 26, -0.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#c2412f";
  g.fillRect(mx + 46, my + 132, 66, 60);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // UV do glTF: v = 0 no alto da imagem
  t.anisotropy = 4;
  return t;
}

/** Peças do Blender: sombras, nomes por material, água comum, oclusão no chão e letreiros */
function PecasBlender({ fab }: { fab: Fabrica }) {
  const gltf = useLoader(GLTFLoader, `${BASE}unifor-campus.glb`);
  const ao = useLoader(THREE.TextureLoader, `${BASE}unifor-ao-chao.jpg`);
  const extras = useMemo(() => {
    const letreiros = texturaLetreiros();
    const grama = texturaManchada("#ffffff", 0.08, 11, 64);
    grama.repeat.set(9, 9);
    return { letreiros, grama };
  }, []);
  useEffect(() => () => { extras.letreiros.dispose(); extras.grama.dispose(); }, [extras]);
  const cena = useMemo(() => {
    ao.flipY = false;
    ao.colorSpace = THREE.NoColorSpace;
    ao.userData.mimeType = "image/jpeg"; // o GLTFExporter regrava em JPEG em vez de PNG
    ao.needsUpdate = true;
    const raiz = gltf.scene.clone(true);
    raiz.name = "Pecas_Campus";
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
          novo = Object.assign(new THREE.MeshStandardMaterial({ map: extras.letreiros, roughness: 0.55, vertexColors: mat.vertexColors }), { name: "Mat_Letreiros" });
        } else {
          novo = mat;
          if (mat.name.startsWith("Mat_Chao_")) {
            mat.aoMap = ao;
            mat.aoMapIntensity = 1;
            if (mat.name === "Mat_Chao_Grama" || mat.name === "Mat_Chao_Grama_Canteiro") mat.map = extras.grama;
            mat.needsUpdate = true;
          }
        }
        trocas.set(mat, novo);
      }
      m.material = novo;
    });
    return raiz;
  }, [gltf, ao, fab, extras]);
  return <primitive object={cena} />;
}

/**
 * Folha de palmeira: tira em "V" raso que sobe um pouco e cai em arco, afinando na ponta (a mesma ideia do Messejana).
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

/** Mata do campus: copas largas e baixas em vários verdes, com tronco (a aérea mostra a copa quase contínua) */
function Mata({ fab }: { fab: Fabrica }) {
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
  const geo = useMemo(() => ({ tronco: new THREE.CylinderGeometry(0.13, 0.2, 1, 6).translate(0, 0.5, 0) }), []);
  useEffect(() => () => geo.tronco.dispose(), [geo]);
  return (
    <>
      <instancedMesh name="Mata_Copas" ref={copa} args={[undefined, undefined, n]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial name="Mat_Copa_Arvore" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh name="Mata_Troncos" ref={tronco} args={[geo.tronco, undefined, n]} castShadow material={fab.cor("#6e5a45")} />
    </>
  );
}

const FOLHAS_IMPERIAL = 11;
const FOLHAS_COQUEIRO = 8;

/**
 * Palmeiras imperiais do jardim da Reitoria (fotos ref-2 e ref-4): estipe liso cinza-claro, bem mais alto que o prédio,
 * palmito verde no alto e coroa de folhas arqueadas. Coqueiros (estipe mais escuro e inclinado) na Praça Central.
 */
function Palmeiras({ fab }: { fab: Fabrica }) {
  const estipe = useRef<THREE.InstancedMesh>(null);
  const palmito = useRef<THREE.InstancedMesh>(null);
  const folhaImp = useRef<THREE.InstancedMesh>(null);
  const estipeCoq = useRef<THREE.InstancedMesh>(null);
  const folhaCoq = useRef<THREE.InstancedMesh>(null);
  const cocos = useRef<THREE.InstancedMesh>(null);
  const recursos = useMemo(() => {
    const folhas = Object.assign(new THREE.MeshStandardMaterial({ color: "#5f9440", roughness: 0.8, side: THREE.DoubleSide }), { name: "Mat_Folha_Palmeira" });
    return {
      folhas,
      folhaImp: geometriaFolha(2.3, 1.15),
      folhaCoq: geometriaFolha(2.3, 1.4),
      estipe: new THREE.CylinderGeometry(0.11, 0.16, 1, 8).translate(0, 0.5, 0),
      palmito: new THREE.CylinderGeometry(0.12, 0.15, 1, 8).translate(0, 0.5, 0),
      estipeCoq: new THREE.CylinderGeometry(0.1, 0.15, 1, 6).translate(0, 0.5, 0),
    };
  }, []);
  useEffect(() => () => { Object.values(recursos).forEach((x) => x.dispose()); }, [recursos]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const r = aleatorio(19);
    L.imperiais.forEach(([x, z, h], i) => {
      const hp = 0.85; // palmito
      o.position.set(x, Z0, z);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, h - hp, 1);
      o.updateMatrix();
      estipe.current!.setMatrixAt(i, o.matrix);
      o.position.set(x, Z0 + h - hp, z);
      o.scale.set(1, hp, 1);
      o.updateMatrix();
      palmito.current!.setMatrixAt(i, o.matrix);
      const giro = r() * Math.PI * 2;
      for (let f = 0; f < FOLHAS_IMPERIAL; f++) {
        const a = giro + (f / FOLHAS_IMPERIAL) * Math.PI * 2;
        // coroa em leque: folhas de cima erguidas, as de baixo caídas
        o.rotation.set(f % 3 === 0 ? -0.85 : f % 3 === 1 ? -0.4 : -0.05, a, 0, "YXZ");
        o.position.set(x, Z0 + h - 0.05, z);
        o.scale.setScalar(f % 3 === 0 ? 0.8 : 1);
        o.updateMatrix();
        folhaImp.current!.setMatrixAt(i * FOLHAS_IMPERIAL + f, o.matrix);
        folhaImp.current!.setColorAt(i * FOLHAS_IMPERIAL + f, cor.set(f % 3 ? "#ffffff" : "#dfe9c9"));
      }
    });
    L.coqueiros.forEach(([x, z, h, g], i) => {
      // estipe inclinado ~8° para o lado `g`
      const inc = 0.14;
      o.position.set(x, Z0, z);
      o.rotation.set(inc, g, 0, "YXZ");
      o.scale.set(1, h, 1);
      o.updateMatrix();
      estipeCoq.current!.setMatrixAt(i, o.matrix);
      const topo = new THREE.Vector3(0, h, 0).applyEuler(new THREE.Euler(inc, g, 0, "YXZ")).add(new THREE.Vector3(x, Z0, z));
      o.position.copy(topo).add(new THREE.Vector3(0, -0.2, 0));
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      cocos.current!.setMatrixAt(i, o.matrix);
      for (let f = 0; f < FOLHAS_COQUEIRO; f++) {
        const a = g + (f / FOLHAS_COQUEIRO) * Math.PI * 2;
        o.rotation.set(f % 2 ? -0.3 : 0.1, a, 0, "YXZ");
        o.position.copy(topo);
        o.scale.setScalar(f % 2 ? 0.85 : 1);
        o.updateMatrix();
        folhaCoq.current!.setMatrixAt(i * FOLHAS_COQUEIRO + f, o.matrix);
        folhaCoq.current!.setColorAt(i * FOLHAS_COQUEIRO + f, cor.set(f % 3 ? "#ffffff" : "#d9e6c4"));
      }
    });
    for (const m of [estipe, palmito, folhaImp, estipeCoq, folhaCoq, cocos].map((x) => x.current!)) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, []);
  const ni = L.imperiais.length, nc = L.coqueiros.length;
  return (
    <>
      <instancedMesh name="Imperiais_Estipes" ref={estipe} args={[recursos.estipe, undefined, ni]} castShadow material={fab.cor("#c8c1b2", 0.8)} />
      <instancedMesh name="Imperiais_Palmitos" ref={palmito} args={[recursos.palmito, undefined, ni]} castShadow material={fab.cor("#7f9d48", 0.7)} />
      <instancedMesh name="Imperiais_Folhas" ref={folhaImp} args={[recursos.folhaImp, recursos.folhas, ni * FOLHAS_IMPERIAL]} castShadow />
      <instancedMesh name="Coqueiros_Estipes" ref={estipeCoq} args={[recursos.estipeCoq, undefined, nc]} castShadow material={fab.cor("#6e5a45")} />
      <instancedMesh name="Coqueiros_Cachos" ref={cocos} args={[undefined, undefined, nc]} castShadow material={fab.cor("#7f9d48", 0.7)}>
        <icosahedronGeometry args={[0.3, 0]} />
      </instancedMesh>
      <instancedMesh name="Coqueiros_Folhas" ref={folhaCoq} args={[recursos.folhaCoq, recursos.folhas, nc * FOLHAS_COQUEIRO]} castShadow />
    </>
  );
}

/** Carros na Washington Soares (a pista do lado do campus segue para o norte, a outra para o sul) e no estacionamento */
function Carros({ fab }: { fab: Fabrica }) {
  const corpo = useRef<THREE.InstancedMesh>(null);
  const cabine = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const c = new THREE.BoxGeometry(1.9, 0.42, 0.86).translate(0, 0.3, 0);
    const k = new THREE.BoxGeometry(1.0, 0.34, 0.76).translate(-0.12, 0.66, 0);
    return { c, k };
  }, []);
  useEffect(() => () => { geo.c.dispose(); geo.k.dispose(); }, [geo]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const tons = ["#f2f2ef", "#c8ccd0", "#2b2f36", "#8e959c", "#b33a32", "#f2f2ef", "#1f4e8c", "#d9d4c4"];
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

/** Gente na Praça Central, no largo da fonte e no eixo (exageradas como os carros, para darem escala na vista de perto) */
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
    L.pessoas.forEach(([x, z, g, k], i) => {
      o.position.set(x, Z0, z);
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

export function Unifor({ fab }: { fab: Fabrica }) {
  return (
    <group name="Unifor">
      <PecasBlender fab={fab} />
      <Mata fab={fab} />
      <Palmeiras fab={fab} />
      <Carros fab={fab} />
      <Pessoas fab={fab} />
    </group>
  );
}
