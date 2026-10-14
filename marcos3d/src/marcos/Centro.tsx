import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../Cena";

/**
 * Centro de Fortaleza em miniatura: a Catedral Metropolitana, a Praça do Ferreira com a Coluna da
 * Hora e o Cine São Luiz, e o Mercado Central, mais perto uns dos outros do que na realidade
 * (pesquisa/marcos/centro/ficha.md). Tudo é montado num referencial alinhado à malha do Centro,
 * girada ~18°: x corre a 108° (para lés-sudeste) e −z a 18° (para o norte-nordeste). Metros.
 */
const GIRO_MALHA = -THREE.MathUtils.degToRad(18);

/** Gerador determinístico: os quarteirões saem iguais em toda visita */
function aleatorio(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Telhado de duas águas: prisma triangular deitado ao longo de x, com a cumeeira para cima e a base em y − altura/2 */
function DuasAguas({ largura, comprimento, altura, material, posicao }: { largura: number; comprimento: number; altura: number; material: THREE.Material; posicao: [number, number, number] }) {
  return (
    <mesh position={posicao} rotation={[0, 0, Math.PI / 2]} scale={[altura, comprimento, largura / Math.sqrt(3)]} material={material} castShadow>
      <cylinderGeometry args={[1, 1, 1, 3, 1, false, Math.PI / 2]} />
    </mesh>
  );
}

/** Catedral Metropolitana: nave a 105° (≈ x da malha), fachada a oeste com as duas agulhas */
function Catedral({ fab }: { fab: Fabrica }) {
  const concreto = fab.cor("#9a9890", 0.9);
  const sombra = fab.cor("#7d7c75", 0.9);
  const vitral = fab.cor("#3a5e8c", 0.3);
  const nave = { comprimento: 14, largura: 5.6, altura: 6 };
  const xFachada = -nave.comprimento / 2;
  const xCruzeiro = xFachada + nave.comprimento * 0.66;
  return (
    <group position={[7, 0, -6]}>
      {/* adro claro na frente da fachada */}
      <mesh position={[xFachada - 2.2, 0.08, 0]} rotation-x={-Math.PI / 2} material={fab.cor("#d9d4c8", 0.9)} receiveShadow>
        <planeGeometry args={[4.4, 9]} />
      </mesh>
      <mesh position={[0, nave.altura / 2, 0]} material={concreto} castShadow receiveShadow>
        <boxGeometry args={[nave.comprimento, nave.altura, nave.largura]} />
      </mesh>
      <DuasAguas largura={nave.largura} comprimento={nave.comprimento} altura={1.8} material={sombra} posicao={[0, nave.altura + 0.9, 0]} />
      {/* transepto cruzando a nave */}
      <mesh position={[xCruzeiro, nave.altura / 2, 0]} material={concreto} castShadow receiveShadow>
        <boxGeometry args={[4.6, nave.altura, 11.5]} />
      </mesh>
      <group position={[xCruzeiro, nave.altura + 0.9, 0]} rotation-y={Math.PI / 2}>
        <DuasAguas largura={4.6} comprimento={11.5} altura={1.8} material={sombra} posicao={[0, 0, 0]} />
      </group>
      {/* abside semicircular na ponta leste */}
      <mesh position={[nave.comprimento / 2, nave.altura / 2, 0]} material={concreto} castShadow>
        <cylinderGeometry args={[2.4, 2.4, nave.altura, 16, 1, false, 0, Math.PI]} />
      </mesh>
      {/* lanternim octogonal no cruzeiro, com a cúpula baixa */}
      <mesh position={[xCruzeiro, nave.altura + 2.4, 0]} material={concreto} castShadow>
        <cylinderGeometry args={[1.5, 1.5, 2.6, 8]} />
      </mesh>
      <mesh position={[xCruzeiro, nave.altura + 4.1, 0]} material={sombra} castShadow>
        <coneGeometry args={[1.6, 1.4, 8]} />
      </mesh>
      {/* as duas torres quadradas com as agulhas de oito faces */}
      {[-1.9, 1.9].map((z) => (
        <group key={z} position={[xFachada + 1.1, 0, z]}>
          <mesh position-y={5.5} material={concreto} castShadow receiveShadow>
            <boxGeometry args={[2.2, 11, 2.2]} />
          </mesh>
          <mesh position-y={14.6} material={sombra} castShadow>
            <coneGeometry args={[1.35, 7.2, 8]} />
          </mesh>
          {[-1, 1].flatMap((a) =>
            [-1, 1].map((b) => (
              <mesh key={`${a}${b}`} position={[a * 0.95, 11.6, b * 0.95]} material={sombra}>
                <coneGeometry args={[0.22, 1.2, 4]} />
              </mesh>
            )),
          )}
        </group>
      ))}
      {/* frontão entre as torres e a rosácea sobre o portal central */}
      <mesh position={[xFachada - 0.02, nave.altura + 0.4, 0]} rotation-y={-Math.PI / 2} material={vitral}>
        <circleGeometry args={[0.8, 16]} />
      </mesh>
      {[-1.9, 0, 1.9].map((z) => (
        <mesh key={z} position={[xFachada - 0.02, 1.1, z]} rotation-y={-Math.PI / 2} material={fab.cor("#4b4b47", 0.8)}>
          <planeGeometry args={[z === 0 ? 1.3 : 0.9, 2.2]} />
        </mesh>
      ))}
    </group>
  );
}

/** Coluna da Hora: quatro pilares marrons em três estágios, tubos vermelhos e o relógio no topo */
function ColunaDaHora({ fab }: { fab: Fabrica }) {
  const pilar = fab.cor("#5a2f24", 0.8);
  const estagios: [largura: number, base: number, altura: number][] = [
    [1.3, 0, 1.6],
    [1.05, 1.6, 1.4],
    [0.8, 3, 1.3],
  ];
  return (
    <group>
      <mesh position-y={0.12} material={fab.cor("#5c6e6a", 0.2)}>
        <boxGeometry args={[2.6, 0.12, 2.6]} />
      </mesh>
      {estagios.flatMap(([l, b, h], i) =>
        [-1, 1].flatMap((a) =>
          [-1, 1].map((c) => (
            <mesh key={`${i}${a}${c}`} position={[(a * l) / 2, b + h / 2, (c * l) / 2]} material={pilar} castShadow>
              <boxGeometry args={[0.2, h, 0.2]} />
            </mesh>
          )),
        ),
      )}
      <mesh position-y={2.2} material={fab.cor("#c3312b", 0.6)} castShadow>
        <boxGeometry args={[0.7, 4.2, 0.7]} />
      </mesh>
      <mesh position-y={4.75} material={pilar} castShadow>
        <boxGeometry args={[1, 0.9, 1]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.sin((i * Math.PI) / 2) * 0.51, 4.75, Math.cos((i * Math.PI) / 2) * 0.51]} rotation-y={(i * Math.PI) / 2} material={fab.cor("#f5f5f0", 0.5)}>
          <circleGeometry args={[0.32, 16]} />
        </mesh>
      ))}
    </group>
  );
}

/** Piso de pedra portuguesa clara com as faixas cinza diagonais */
function texturaPiso() {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#e6e1d6";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#8e8b84";
  g.lineWidth = 6;
  for (let i = -128; i < 256; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 128, 128);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 6);
  return t;
}

/** Letreiro cursivo do cinema na marquise */
function texturaLetreiro() {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#f2f2ee";
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#a3262a";
  g.font = "italic 700 42px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("São Luiz", 128, 34);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Praça do Ferreira (retângulo ao longo da malha), Coluna da Hora, árvores e o Cine São Luiz na borda oeste */
function PracaDoFerreira({ fab }: { fab: Fabrica }) {
  const { piso, letreiro } = useMemo(
    () => ({
      piso: new THREE.MeshStandardMaterial({ map: texturaPiso(), roughness: 0.95 }),
      letreiro: new THREE.MeshStandardMaterial({ map: texturaLetreiro(), roughness: 0.6 }),
    }),
    [],
  );
  useEffect(
    () => () => {
      for (const m of [piso, letreiro]) {
        m.map?.dispose();
        m.dispose();
      }
    },
    [piso, letreiro],
  );
  const copas = useRef<THREE.InstancedMesh>(null);
  const arvores: [number, number][] = [[-2.6, -6.5], [2.6, -6.5], [-2.8, -2], [2.8, -2.4], [-2.6, 3], [2.7, 3.4], [-2.4, 7], [2.5, 7.2], [0, 7.4]];
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    arvores.forEach(([x, z], i) => {
      o.position.set(x, 1.8, z);
      o.scale.setScalar(1.1 + (i % 3) * 0.15);
      o.updateMatrix();
      copas.current!.setMatrixAt(i, o.matrix);
    });
    copas.current!.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={[-8, 0, 9]}>
      <mesh position-y={0.08} rotation-x={-Math.PI / 2} material={piso} receiveShadow>
        <planeGeometry args={[7, 16]} />
      </mesh>
      <group position={[0, 0.1, -1.6]}>
        <ColunaDaHora fab={fab} />
      </group>
      <instancedMesh ref={copas} args={[undefined, undefined, arvores.length]} material={fab.cor("#4e7a36", 0.9)} castShadow>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
      {/* Cine São Luiz: torre creme art déco na borda oeste, com a marquise virada para a praça */}
      <group position={[-6.3, 0, 1]}>
        <mesh position-y={5} material={fab.cor("#e3d8c2", 0.85)} castShadow receiveShadow>
          <boxGeometry args={[3.4, 10, 6]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[1.7, 5, s * 3]} material={fab.cor("#e3d8c2", 0.85)} castShadow>
            <cylinderGeometry args={[0.6, 0.6, 10, 12]} />
          </mesh>
        ))}
        <mesh position={[1.7, 0.9, 0]} material={fab.cor("#5b3328", 0.8)}>
          <boxGeometry args={[0.15, 1.8, 6]} />
        </mesh>
        <mesh position={[2.3, 2.1, 0]} material={fab.cor("#f2f2ee", 0.6)} castShadow>
          <boxGeometry args={[1.3, 0.25, 5]} />
        </mesh>
        <mesh position={[2.96, 2.55, 0]} rotation-y={Math.PI / 2} material={letreiro}>
          <planeGeometry args={[3.2, 0.8]} />
        </mesh>
      </group>
    </group>
  );
}

/** Mercado Central: o grande telhado azul a norte da Catedral */
function MercadoCentral({ fab }: { fab: Fabrica }) {
  return (
    <group position={[-6, 0, -16]} rotation-y={-THREE.MathUtils.degToRad(30 - 18)}>
      <mesh position-y={2.6} material={fab.cor("#d5d0c6", 0.85)} castShadow receiveShadow>
        <boxGeometry args={[4.6, 5.2, 13]} />
      </mesh>
      <DuasAguas largura={4.8} comprimento={13.2} altura={1.2} material={fab.cor("#1f3fa8", 0.5)} posicao={[0, 5.8, 0]} />
    </group>
  );
}

/** Quarteirões do Centro: prédios comerciais baixos, algumas torres e telhados cerâmicos */
function Quarteiroes({ fab }: { fab: Fabrica }) {
  const lotes = useMemo(() => {
    const rnd = aleatorio(18);
    const livres: [number, number, number, number][] = [
      [-3.5, -13, 22, 1],
      [-18, 0, -3, 19],
      [-10.5, -23.5, -1.5, -8.5],
    ];
    const lista: { x: number; z: number; w: number; d: number; h: number; cor: string }[] = [];
    const cores = ["#bdbab2", "#d8d3c8", "#e6e1d6", "#c8b9a3", "#a9a59c"];
    for (let x = -28; x <= 28; x += 4.6) {
      for (let z = -28; z <= 28; z += 4.6) {
        if (Math.abs(x % 13.8) < 1 || Math.abs(z % 13.8) < 1) continue;
        const px = x + 1.2;
        const pz = z + 1.2;
        if (Math.hypot(px, pz) > 28.5) continue;
        if (livres.some(([x1, z1, x2, z2]) => px > x1 && px < x2 && pz > z1 && pz < z2)) continue;
        const torre = rnd() < 0.08;
        lista.push({ x: px, z: pz, w: 3.6, d: 3.6, h: torre ? 5 + rnd() * 4 : 1.4 + rnd() * 2.4, cor: cores[Math.floor(rnd() * cores.length)] });
      }
    }
    return lista;
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    lotes.forEach((l, i) => {
      o.position.set(l.x, l.h / 2, l.z);
      o.scale.set(l.w, l.h, l.d);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
      ref.current!.setColorAt(i, cor.set(l.cor));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [lotes]);
  return (
    <>
      <mesh position-y={0.04} rotation-x={-Math.PI / 2} material={fab.cor("#8e8c88", 0.95)} receiveShadow>
        <circleGeometry args={[30.5, 40]} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, lotes.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
    </>
  );
}

export function Centro({ fab }: { fab: Fabrica }) {
  return (
    <group rotation-y={GIRO_MALHA}>
      <Quarteiroes fab={fab} />
      <Catedral fab={fab} />
      <PracaDoFerreira fab={fab} />
      <MercadoCentral fab={fab} />
    </group>
  );
}
