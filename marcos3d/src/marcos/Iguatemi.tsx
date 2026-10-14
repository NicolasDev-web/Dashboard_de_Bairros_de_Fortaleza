import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../Cena";

/**
 * Shopping Iguatemi Bosque em miniatura. O contorno sai da planta do OpenStreetMap
 * (pesquisa/marcos/iguatemi/planta-osm.png, norte para cima, 200 m = 285 px): cada ponto está em
 * pixels dessa imagem e vira metros com `K`, que encolhe os ~500 m reais do prédio para ~54 m. As
 * alturas também encolhem, mas menos, para os volumes lerem de longe. Metros, norte em −z, leste em +x.
 */
type Px = [number, number];

const CENTRO: Px = [470, 610];
const K = 0.0745;
const emM = ([x, y]: Px): [number, number] => [(x - CENTRO[0]) * K, (y - CENTRO[1]) * K];

// massa principal das galerias (dois pisos de lojas)
const MASSA: Px[] = [
  [182, 425], [368, 292], [500, 400], [478, 432], [520, 412], [632, 490], [770, 645], [700, 725], [640, 690],
  [600, 765], [650, 800], [710, 885], [680, 922], [540, 890], [460, 855], [420, 790], [370, 700], [330, 650],
  [260, 655], [200, 620], [168, 545], [205, 462],
];

/** Blocos mais altos levantados pela prefeitura no OSM; `h` já é a altura da miniatura */
const BLOCOS: { pts: Px[]; h: number; cor: string }[] = [
  // espinha central das galerias, onde ficam a claraboia em lente e as pirâmides
  { pts: [[380, 410], [400, 395], [645, 640], [625, 662]], h: 4.6, cor: "#e9ebea" },
  { pts: [[408, 572], [450, 518], [530, 580], [490, 638]], h: 6, cor: "#e3e5e4" },
  { pts: [[318, 575], [348, 572], [358, 622], [388, 700], [438, 788], [425, 812], [372, 728], [340, 740]], h: 6.4, cor: "#d8cbb4" },
  { pts: [[450, 830], [488, 778], [550, 828], [510, 882]], h: 6.8, cor: "#e1e3e2" },
  { pts: [[568, 808], [605, 778], [690, 850], [702, 880], [672, 918], [552, 872]], h: 8.2, cor: "#e6e8e7" },
];

// edifício-garagem de 4 níveis no lado sudeste
const GARAGEM: Px[] = [[600, 765], [655, 695], [715, 740], [718, 830], [700, 848], [650, 800]];

// bolsões de estacionamento de superfície a nordeste e a leste
const ESTACIONAMENTOS: Px[][] = [
  [[405, 290], [470, 272], [560, 320], [700, 450], [790, 575], [770, 620], [655, 525], [650, 470], [535, 380]],
  [[765, 735], [818, 620], [870, 622], [862, 775], [800, 792]],
];

/** Gerador determinístico: o shopping sai igual em toda visita */
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

function dentro([x, y]: [number, number], p: [number, number][]) {
  let d = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/** Prisma vertical com a forma da planta, da base `y0` até `y0 + h` */
function Volume({ pts, h, y0 = 0, topo, lados }: { pts: Px[]; h: number; y0?: number; topo: THREE.Material; lados: THREE.Material }) {
  const geo = useMemo(() => {
    const forma = new THREE.Shape(pts.map((p) => {
      const [x, z] = emM(p);
      return new THREE.Vector2(x, -z);
    }));
    return new THREE.ExtrudeGeometry(forma, { depth: h, bevelEnabled: false });
  }, [pts, h]);
  useEffect(() => () => geo.dispose(), [geo]);
  // a extrusão sai em +z: deitar faz a base ir para o chão e a altura subir em +y
  return <mesh geometry={geo} material={[topo, lados]} rotation-x={-Math.PI / 2} position-y={y0} castShadow receiveShadow />;
}

function Piso({ pts, cor, fab }: { pts: Px[]; cor: string; fab: Fabrica }) {
  const geo = useMemo(
    () => new THREE.ShapeGeometry(new THREE.Shape(pts.map((p) => {
      const [x, z] = emM(p);
      return new THREE.Vector2(x, -z);
    }))),
    [pts],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={fab.cor(cor, 0.95)} rotation-x={-Math.PI / 2} position-y={0.04} receiveShadow />;
}

/** Placa com o letreiro IGUATEMI da entrada principal */
function Letreiro({ posicao, giro }: { posicao: [number, number, number]; giro: number }) {
  const material = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 96;
    const g = cv.getContext("2d")!;
    g.fillStyle = "#f4f4f2";
    g.fillRect(0, 0, 512, 96);
    g.fillStyle = "#5a6068";
    g.font = "700 64px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("IGUATEMI", 256, 52);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  }, []);
  useEffect(
    () => () => {
      material.map?.dispose();
      material.dispose();
    },
    [material],
  );
  return (
    <mesh position={posicao} rotation-y={giro} material={material} castShadow>
      <boxGeometry args={[9, 1.7, 0.3]} />
    </mesh>
  );
}

/** Mata do Parque do Cocó colada ao norte e ao leste, e carros nos estacionamentos */
function MataECarros({ fab }: { fab: Fabrica }) {
  const { arvores, carros } = useMemo(() => {
    const rnd = aleatorio(19);
    const massa = MASSA.map(emM);
    const estac = ESTACIONAMENTOS.map((e) => e.map(emM));
    // eixo maior do prédio (NO → SE) e a normal que aponta para o lado da mata (NE)
    const eixo = new THREE.Vector2(0.73, 0.68);
    const nordeste = new THREE.Vector2(0.68, -0.73);
    const lista: { x: number; z: number; s: number }[] = [];
    for (let x = -29; x <= 29; x += 2.4) {
      for (let z = -29; z <= 29; z += 2.4) {
        const px = x + (rnd() - 0.5) * 1.6;
        const pz = z + (rnd() - 0.5) * 1.6;
        if (Math.hypot(px, pz) > 29.5) continue;
        if (dentro([px, pz], massa) || estac.some((e) => dentro([px, pz], e))) continue;
        const lado = px * nordeste.x + pz * nordeste.y;
        const ao = px * eixo.x + pz * eixo.y;
        // mata a nordeste do prédio; do outro lado ficam a praça e a avenida
        if (lado < 9 && !(ao > 20 && lado > -6)) continue;
        lista.push({ x: px, z: pz, s: 1.2 + rnd() * 0.9 });
      }
    }
    const vagas: { x: number; z: number; giro: number }[] = [];
    for (const e of estac) {
      for (let x = -30; x <= 30; x += 1.1) {
        for (let z = -30; z <= 30; z += 2) {
          if (dentro([x, z], e) && rnd() < 0.42) vagas.push({ x, z, giro: rnd() < 0.5 ? 0 : Math.PI });
        }
      }
    }
    return { arvores: lista, carros: vagas };
  }, []);

  const copas = useRef<THREE.InstancedMesh>(null);
  const autos = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const tons = ["#2e5e2a", "#3f7a34", "#356b2e", "#4a8a3c"];
    arvores.forEach((a, i) => {
      o.position.set(a.x, a.s * 1.1, a.z);
      o.scale.set(a.s, a.s * 0.85, a.s);
      o.updateMatrix();
      copas.current!.setMatrixAt(i, o.matrix);
      copas.current!.setColorAt(i, cor.set(tons[i % tons.length]));
    });
    copas.current!.instanceMatrix.needsUpdate = true;
    if (copas.current!.instanceColor) copas.current!.instanceColor.needsUpdate = true;
    const coresCarro = ["#f4f4f2", "#c9cccf", "#2b2e33", "#9a9ea3", "#3c4f6b"];
    o.scale.set(1, 1, 1);
    carros.forEach((v, i) => {
      o.position.set(v.x, 0.22, v.z);
      o.rotation.set(0, v.giro, 0);
      o.updateMatrix();
      autos.current!.setMatrixAt(i, o.matrix);
      autos.current!.setColorAt(i, cor.set(coresCarro[i % coresCarro.length]));
    });
    autos.current!.instanceMatrix.needsUpdate = true;
    if (autos.current!.instanceColor) autos.current!.instanceColor.needsUpdate = true;
  }, [arvores, carros]);

  return (
    <>
      <instancedMesh ref={copas} args={[undefined, undefined, arvores.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={autos} args={[undefined, undefined, carros.length]}>
        <boxGeometry args={[0.45, 0.35, 0.9]} />
        <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
      {ESTACIONAMENTOS.map((e, i) => (
        <Piso key={i} pts={e} cor="#7d7f80" fab={fab} />
      ))}
    </>
  );
}

/** Sheds em "serra" voltados para a Av. Washington Soares, na frente sul */
function Sheds({ fab }: { fab: Fabrica }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const [a, b] = [emM([452, 836]), emM([548, 878])];
  const n = 7;
  const giro = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      o.position.set(a[0] + (b[0] - a[0]) * t, 4.3, a[1] + (b[1] - a[1]) * t);
      // prisma triangular (cilindro de 3 lados deitado) com a aresta para cima
      o.rotation.set(0, giro, 0);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [a, b, giro]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} material={fab.cor("#f1f2f0", 0.7)} castShadow>
      <coneGeometry args={[0.9, 2.2, 4]} />
    </instancedMesh>
  );
}

export function Iguatemi({ fab }: { fab: Fabrica }) {
  const telhado = fab.cor("#e9ebea", 0.85);
  const fachada = fab.cor("#d8cbb4", 0.9);
  const vidro = fab.cor("#3b5e9a", 0.15);
  const vidroVerde = fab.cor("#5e8c8a", 0.15);
  const [sx, sz] = emM([272, 555]);
  const [lx, lz] = emM([505, 520]);
  const [cx, cz] = emM([640, 455]);
  const [mx, mz] = emM([330, 720]);
  const [ex, ez] = emM([615, 905]);
  const [dx, dz] = emM([525, 720]);
  // o eixo maior do conjunto corre a ~133° do norte (NO → SE)
  const eixo = -THREE.MathUtils.degToRad(133 - 90);

  return (
    <group>
      {/* praça ajardinada da entrada sudoeste */}
      <Piso pts={[[150, 640], [330, 660], [430, 820], [450, 900], [300, 880], [170, 760]]} cor="#8bab5f" fab={fab} />
      <MataECarros fab={fab} />

      <Volume pts={MASSA} h={3.2} topo={telhado} lados={fachada} />
      {BLOCOS.map((b, i) => (
        <Volume key={i} pts={b.pts} h={b.h} topo={fab.cor(b.cor, 0.85)} lados={fachada} />
      ))}
      <Volume pts={GARAGEM} h={4.6} topo={fab.cor("#a9a7a2", 0.95)} lados={fab.cor("#c9c5be", 0.95)} />

      {/* volume semicircular da ponta oeste, com a cobertura branca circular */}
      <mesh position={[sx, 3, sz]} material={fab.cor("#c4b49a", 0.85)} castShadow receiveShadow>
        <cylinderGeometry args={[7.6, 7.6, 6, 40]} />
      </mesh>
      <mesh position={[sx, 6.15, sz]} material={telhado} castShadow>
        <cylinderGeometry args={[7.9, 7.9, 0.3, 40]} />
      </mesh>
      <mesh position={[sx, 6.4, sz]} material={fab.cor("#f6f7f6", 0.7)}>
        <cylinderGeometry args={[5.6, 6.2, 0.35, 40]} />
      </mesh>

      {/* claraboia em lente sobre a espinha central */}
      <mesh position={[lx, 4.6, lz]} rotation-y={eixo} scale={[5.2, 0.9, 2.2]} material={vidroVerde} castShadow>
        <sphereGeometry args={[1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      {/* pirâmides de vidro azul e a cúpula facetada */}
      {([[565, 655, 1.7], [598, 695, 1.4], [540, 610, 1.2]] as [number, number, number][]).map(([px, py, r]) => {
        const [x, z] = emM([px, py]);
        return (
          <mesh key={px} position={[x, 4.6 + r * 0.6, z]} rotation-y={Math.PI / 4 + eixo} material={vidro} castShadow>
            <coneGeometry args={[r * 1.4, r * 1.2, 4]} />
          </mesh>
        );
      })}
      <mesh position={[dx, 3.2, dz]} material={vidro} castShadow>
        <sphereGeometry args={[1.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      <Sheds fab={fab} />

      {/* marquise triangular pontuda em balanço na entrada sudoeste */}
      <group position={[mx, 4.4, mz]} rotation-y={THREE.MathUtils.degToRad(35)}>
        <mesh material={fab.cor("#f3f4f2", 0.6)} castShadow receiveShadow>
          <cylinderGeometry args={[4.6, 4.6, 0.25, 3]} />
        </mesh>
        <mesh position={[-1.4, -2.2, 0]} material={fab.cor("#c8cdd2", 0.4)} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 4.4, 8]} />
        </mesh>
      </group>

      {/* cone de vidro e letreiro da entrada principal, de frente para a Washington Soares */}
      <mesh position={[ex, 3.9, ez - 0.6]} material={vidroVerde} castShadow>
        <coneGeometry args={[1.1, 2.6, 16]} />
      </mesh>
      <Letreiro posicao={[ex, 2.2, ez + 0.4]} giro={0} />

      {/* torre cilíndrica (caixa d'água e exaustão) no lado norte */}
      <mesh position={[cx, 4.5, cz]} material={fab.cor("#d5d0c6", 0.8)} castShadow>
        <cylinderGeometry args={[0.7, 0.7, 9, 14]} />
      </mesh>
    </group>
  );
}
