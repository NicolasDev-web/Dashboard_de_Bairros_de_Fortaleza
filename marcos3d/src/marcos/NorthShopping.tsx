import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../Cena";

/**
 * North Shopping Fortaleza em miniatura. O contorno vem do OpenStreetMap
 * (pesquisa/marcos/north-shopping/ficha.md), em metros reais com x = leste e y = norte e a origem no
 * centro do prédio; `K` encolhe para caber na base. A caixa é quase cega: o estacionamento de 6
 * níveis fica dentro dela, e as faixas escuras da fachada são as lajes abertas. Metros, norte em −z.
 */
type Xy = [number, number];

const K = 0.17;
const ALTURA = 8;
const emM = ([x, y]: Xy): Xy => [x * K, -y * K];

const CONTORNO: Xy[] = [[-103, 60], [-105, -7], [-37, 1], [-35, -100], [50, -87], [43, -56], [89, -34], [97, -77], [116, -74], [96, 29], [-84, 92], [-103, 93]];
// trecho principal da fachada sul, para a Av. Bezerra de Menezes
const FACHADA: [Xy, Xy] = [[-35, -100], [50, -87]];

/** Gerador determinístico: carros e árvores saem iguais em toda visita */
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

/** Bege com as faixas escuras das lajes do estacionamento; a extrusão usa UV em metros (repete a cada 2 m) */
function texturaFachada() {
  const cv = document.createElement("canvas");
  cv.width = 4;
  cv.height = 40;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#d8cdb6";
  g.fillRect(0, 0, 4, 40);
  g.fillStyle = "#5a544c";
  g.fillRect(0, 26, 4, 6);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1 / 2);
  return t;
}

/** Logo: as duas bandeirolas (vermelha e verde) sobre "NORTH", a faixa vermelha "SHOPPING" e "FORTALEZA" */
function texturaLogo() {
  const cv = document.createElement("canvas");
  cv.width = 320;
  cv.height = 256;
  const g = cv.getContext("2d")!;
  const bandeira = (x: number, cor: string) => {
    g.fillStyle = cor;
    g.beginPath();
    g.moveTo(x, 70);
    g.lineTo(x + 48, 40);
    g.lineTo(x + 48, 82);
    g.lineTo(x, 112);
    g.closePath();
    g.fill();
  };
  bandeira(112, "#d4342c");
  bandeira(164, "#1f9a5b");
  g.textAlign = "center";
  g.fillStyle = "#1f2e4d";
  g.font = "800 72px system-ui, sans-serif";
  g.fillText("NORTH", 160, 176);
  g.fillStyle = "#d4342c";
  g.fillRect(70, 186, 180, 26);
  g.fillStyle = "#ffffff";
  g.font = "700 22px system-ui, sans-serif";
  g.fillText("SHOPPING", 160, 207);
  g.fillStyle = "#1f2e4d";
  g.font = "600 24px system-ui, sans-serif";
  g.fillText("FORTALEZA", 160, 240);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Escultura de treliça branca do pórtico: barras em ângulo formando um losango irregular */
const BARRAS: [x: number, y: number, comprimento: number, angulo: number][] = [
  [-1.1, 3.2, 4.6, 62],
  [1.2, 3.4, 4.2, -58],
  [0, 5.4, 4.4, 4],
  [-0.4, 1.6, 3.4, -20],
  [1.5, 1.4, 2.6, 75],
  [-1.9, 4.8, 2.2, -70],
];

export function NorthShopping({ fab }: { fab: Fabrica }) {
  const { caixa, lados, logo } = useMemo(() => {
    const forma = new THREE.Shape(CONTORNO.map((p) => {
      const [x, z] = emM(p);
      return new THREE.Vector2(x, -z);
    }));
    const geo = new THREE.ExtrudeGeometry(forma, { depth: ALTURA, bevelEnabled: false });
    const mat = new THREE.MeshStandardMaterial({ map: texturaFachada(), roughness: 0.9 });
    const matLogo = new THREE.MeshStandardMaterial({ map: texturaLogo(), transparent: true, alphaTest: 0.1, roughness: 0.6 });
    return { caixa: geo, lados: mat, logo: matLogo };
  }, []);
  useEffect(
    () => () => {
      caixa.dispose();
      lados.map?.dispose();
      lados.dispose();
      logo.map?.dispose();
      logo.dispose();
    },
    [caixa, lados, logo],
  );

  // fachada principal: meio, comprimento e giro para ficar virada para fora (sul)
  const [a, b] = FACHADA.map(emM);
  const meio: Xy = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const comprimento = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const giro = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  const [qx, qz] = emM([-35, -100]);
  const [tx, tz] = emM([104, -56]);

  return (
    <group>
      <mesh geometry={caixa} material={[fab.cor("#7f8a91", 0.85), lados]} rotation-x={-Math.PI / 2} castShadow receiveShadow />

      {/* esquina oeste arredondada, com as mesmas faixas */}
      <mesh position={[qx + 1.2, ALTURA / 2, qz - 1.2]} material={lados} castShadow>
        <cylinderGeometry args={[2.6, 2.6, ALTURA, 24]} />
      </mesh>

      {/* friso de vidro iluminado na linha do telhado */}
      <mesh position={[meio[0], ALTURA - 0.5, meio[1]]} rotation-y={giro} material={fab.cor("#6f8ba2", 0.2)}>
        <boxGeometry args={[comprimento, 0.5, 0.1]} />
      </mesh>

      {/* pórtico recuado com a treliça branca e o logo ao lado */}
      <group position={[meio[0], 0, meio[1]]} rotation-y={giro} scale={[1.35, 1.25, 1]}>
        <mesh position={[0.8, 3.1, 0.05]} material={fab.cor("#cbbd9f", 0.9)}>
          <boxGeometry args={[6.2, 6.2, 0.1]} />
        </mesh>
        {BARRAS.map(([x, y, l, ang], i) => (
          <mesh key={i} position={[x + 0.8, y, 0.45]} rotation-z={THREE.MathUtils.degToRad(ang)} material={fab.cor("#f2f2f0", 0.5)} castShadow>
            <boxGeometry args={[l, 0.22, 0.22]} />
          </mesh>
        ))}
        <mesh position={[-4.6, 5.2, 0.12]} material={logo}>
          <planeGeometry args={[3.6, 2.9]} />
        </mesh>
        {/* marquise da entrada */}
        <mesh position={[0.8, 2.1, 0.9]} material={fab.cor("#e9e6df", 0.6)} castShadow>
          <boxGeometry args={[5, 0.18, 1.6]} />
        </mesh>
      </group>

      {/* volume mais alto no canto leste com o logo repetido */}
      <mesh position={[tx, (ALTURA + 2.4) / 2, tz]} material={fab.cor("#cfc2a6", 0.9)} castShadow receiveShadow>
        <boxGeometry args={[3.6, ALTURA + 2.4, 5.4]} />
      </mesh>
      <mesh position={[tx, ALTURA + 0.6, tz + 2.72]} material={logo}>
        <planeGeometry args={[3.4, 2.75]} />
      </mesh>

      <Entorno fab={fab} meio={meio} giro={giro} comprimento={comprimento} />
    </group>
  );
}

/** Avenida com a estação de BRT e palmeiras, estacionamento descoberto e as torres do recorte sudoeste */
function Entorno({ fab, meio, giro, comprimento }: { fab: Fabrica; meio: Xy; giro: number; comprimento: number }) {
  const { carros, palmeiras, copas } = useMemo(() => {
    const rnd = aleatorio(23);
    // estacionamento descoberto do recorte sudeste (x de 43 a 97, y de -77 a -40 no referencial real)
    const c: Xy[] = [];
    for (let x = 50; x < 92; x += 4.5) for (let y = -72; y < -44; y += 9) if (rnd() < 0.6) c.push(emM([x, y]));
    const p: number[] = [];
    for (let u = -comprimento * 0.75; u < comprimento * 1.3; u += 3.4) p.push(u);
    // mata ao norte do prédio
    const v: Xy[] = [];
    for (let i = 0; i < 16; i++) v.push(emM([-90 + i * 12 + (rnd() - 0.5) * 6, 112 + (i % 3) * 10 - i * 4.2]));
    return { carros: c, palmeiras: p, copas: v };
  }, [comprimento]);

  const autos = useRef<THREE.InstancedMesh>(null);
  const troncos = useRef<THREE.InstancedMesh>(null);
  const folhas = useRef<THREE.InstancedMesh>(null);
  const arvores = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const tons = ["#f4f4f2", "#c9cccf", "#2b2e33", "#9a9ea3", "#3c4f6b", "#8c2f2f"];
    carros.forEach(([x, z], i) => {
      o.position.set(x, 0.22, z);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      autos.current!.setMatrixAt(i, o.matrix);
      autos.current!.setColorAt(i, cor.set(tons[i % tons.length]));
    });
    autos.current!.instanceMatrix.needsUpdate = true;
    if (autos.current!.instanceColor) autos.current!.instanceColor.needsUpdate = true;
    copas.forEach(([x, z], i) => {
      o.position.set(x, 1.6, z);
      o.scale.setScalar(1.3 + (i % 3) * 0.3);
      o.updateMatrix();
      arvores.current!.setMatrixAt(i, o.matrix);
    });
    arvores.current!.instanceMatrix.needsUpdate = true;
  }, [carros, copas]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    palmeiras.forEach((u, i) => {
      o.position.set(u, 1.3, 2.4);
      o.updateMatrix();
      troncos.current!.setMatrixAt(i, o.matrix);
      o.position.set(u, 2.7, 2.4);
      o.updateMatrix();
      folhas.current!.setMatrixAt(i, o.matrix);
    });
    troncos.current!.instanceMatrix.needsUpdate = true;
    folhas.current!.instanceMatrix.needsUpdate = true;
  }, [palmeiras]);

  // estacionamento descoberto do recorte sudeste
  const [ex, ez] = emM([70, -58]);
  return (
    <>
      <mesh position={[ex, 0.04, ez]} rotation-x={-Math.PI / 2} material={fab.cor("#8a8c8c", 0.95)} receiveShadow>
        <planeGeometry args={[46 * K, 38 * K]} />
      </mesh>
      <instancedMesh ref={autos} args={[undefined, undefined, carros.length]}>
        <boxGeometry args={[0.45, 0.35, 0.9]} />
        <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={arvores} args={[undefined, undefined, copas.length]} material={fab.cor("#3f7a34", 0.9)} castShadow>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>

      {/* torres residenciais do recorte sudoeste (não são do shopping, mas marcam a vista da avenida) */}
      {([[-88, -30], [-60, -30], [-88, -75], [-60, -75]] as Xy[]).map((p, i) => {
        const [x, z] = emM(p);
        return (
          <mesh key={i} position={[x, 5, z]} material={fab.cor("#ece8df", 0.9)} castShadow receiveShadow>
            <boxGeometry args={[2.4, 10, 2.4]} />
          </mesh>
        );
      })}

      {/* Av. Bezerra de Menezes na frente, com a estação de BRT no canteiro e as palmeiras na calçada */}
      <group position={[meio[0], 0, meio[1]]} rotation-y={giro}>
        <mesh position={[comprimento * 0.25, 0.03, 5.6]} rotation-x={-Math.PI / 2} material={fab.cor("#5c5f61", 0.95)} receiveShadow>
          <planeGeometry args={[comprimento * 2.6, 4.6]} />
        </mesh>
        <mesh position={[-1, 1.2, 5.6]} material={fab.cor("#e9ecee", 0.5)} castShadow>
          <boxGeometry args={[9, 0.2, 1.4]} />
        </mesh>
        {[-5, -1, 3].map((x) => (
          <mesh key={x} position={[x, 0.6, 5.6]} material={fab.cor("#4b8fc7", 0.5)}>
            <boxGeometry args={[0.12, 1.2, 0.12]} />
          </mesh>
        ))}
        <instancedMesh ref={troncos} args={[undefined, undefined, palmeiras.length]} material={fab.cor("#8b7355")} castShadow>
          <cylinderGeometry args={[0.08, 0.12, 2.6, 5]} />
        </instancedMesh>
        <instancedMesh ref={folhas} args={[undefined, undefined, palmeiras.length]} material={fab.cor("#3e6b2f")} castShadow>
          <icosahedronGeometry args={[0.85, 0]} />
        </instancedMesh>
      </group>
    </>
  );
}
