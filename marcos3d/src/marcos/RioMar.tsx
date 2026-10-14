import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../Cena";

/**
 * Shopping RioMar em miniatura: um modelo só, com os dois shoppings do grupo como variações. O
 * contorno de cada um vem do OpenStreetMap (pesquisa/marcos/riomar/ficha.md), em metros reais com
 * x = leste e y = norte; `escala` encolhe para caber na base de ~30 m de raio, e as alturas encolhem
 * menos para lerem de longe. Metros, norte em −z, leste em +x.
 */
type Xy = [number, number];

interface Variante {
  nome: string;
  contorno: Xy[];
  escala: number;
  /** desloca o modelo para o prédio e o estacionamento da frente ficarem centrados na base */
  deslocamento: Xy;
  altura: number;
  /** aresta da fachada principal (dois vértices do contorno) */
  fachada: [Xy, Xy];
  torre: { em: Xy; lado: number; altura: number; vidro: boolean; heliponto: boolean };
  paredes: string;
  listras: string;
  /** moldura do pórtico de vidro; sem ela, o pórtico tem brises escuros */
  moldura?: string;
  arcos: boolean;
  lagoa?: { em: Xy; raio: [number, number] };
}

const VARIANTES: Record<"fortaleza" | "kennedy", Variante> = {
  fortaleza: {
    nome: "Fortaleza",
    contorno: [[-111, -35], [-47, -44], [-54, -67], [52, -101], [59, -78], [186, -125], [224, -6], [-157, 132], [-177, 129], [-217, 6]],
    escala: 0.1,
    deslocamento: [-2, 0],
    altura: 8,
    fachada: [[186, -125], [224, -6]],
    torre: { em: [-190, -2], lado: 4.6, altura: 21, vidro: false, heliponto: true },
    paredes: "#c9b9ae",
    listras: "#9b7f72",
    arcos: true,
    lagoa: { em: [250, 70], raio: [4, 6] },
  },
  kennedy: {
    nome: "Kennedy",
    contorno: [[-86, -74], [-79, -59], [-35, -67], [152, -30], [132, 81], [10, 51], [-54, 48], [-144, 31], [-152, 22], [-135, -73]],
    escala: 0.15,
    deslocamento: [0, 6],
    altura: 7.5,
    fachada: [[-135, -73], [152, -30]],
    torre: { em: [-108, -64], lado: 4.6, altura: 14, vidro: true, heliponto: false },
    paredes: "#f1f2f0",
    listras: "#b8bcbf",
    moldura: "#2f5a4c",
    arcos: false,
  },
};

/** Gerador determinístico: o estacionamento sai igual em toda visita */
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

/** Faixas horizontais das fachadas: a extrusão usa UV em metros, então a textura repete a cada 1,6 m */
function texturaListras(fundo: string, faixa: string) {
  const cv = document.createElement("canvas");
  cv.width = 4;
  cv.height = 32;
  const g = cv.getContext("2d")!;
  g.fillStyle = fundo;
  g.fillRect(0, 0, 4, 32);
  g.fillStyle = faixa;
  g.fillRect(0, 20, 4, 6);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1 / 1.6);
  return t;
}

/** Logo RioMar (as três ondas azul-clara, azul-escura e verde) com o nome da unidade embaixo */
function texturaLogo(unidade: string) {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 200;
  const g = cv.getContext("2d")!;
  const onda = (y: number, cor: string) => {
    g.strokeStyle = cor;
    g.lineWidth = 16;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(26, y);
    g.quadraticCurveTo(78, y + 34, 150, y - 4);
    g.stroke();
  };
  onda(62, "#5bb4e0");
  onda(86, "#1f4f86");
  onda(110, "#8cc63f");
  g.fillStyle = "#24476b";
  g.font = "700 92px system-ui, sans-serif";
  g.textBaseline = "middle";
  g.fillText("RioMar", 172, 88);
  g.font = "600 34px system-ui, sans-serif";
  g.fillText(unidade, 176, 160);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function RioMar({ v, fab }: { v: Variante; fab: Fabrica }) {
  const k = v.escala;
  const emM = useMemo(() => ([x, y]: Xy): Xy => [x * k + v.deslocamento[0], -y * k + v.deslocamento[1]], [k, v.deslocamento]);

  const { caixa, lados, logo } = useMemo(() => {
    const forma = new THREE.Shape(v.contorno.map((p) => {
      const [x, z] = emM(p);
      return new THREE.Vector2(x, -z);
    }));
    const geo = new THREE.ExtrudeGeometry(forma, { depth: v.altura, bevelEnabled: false });
    const listras = texturaListras(v.paredes, v.listras);
    const mat = new THREE.MeshStandardMaterial({ map: listras, roughness: 0.85 });
    const mapaLogo = texturaLogo(v.nome);
    const matLogo = new THREE.MeshStandardMaterial({ map: mapaLogo, transparent: true, alphaTest: 0.1, roughness: 0.6 });
    return { caixa: geo, lados: mat, logo: matLogo };
  }, [v, emM]);
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

  // fachada principal: meio da aresta, direção ao longo dela e a normal para fora do prédio
  const [a, b] = v.fachada.map(emM);
  const meio: Xy = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const comprimento = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const centro = v.contorno.map(emM).reduce<Xy>((s, p) => [s[0] + p[0] / v.contorno.length, s[1] + p[1] / v.contorno.length], [0, 0]);
  let normal: Xy = [-(b[1] - a[1]) / comprimento, (b[0] - a[0]) / comprimento];
  if (normal[0] * (meio[0] - centro[0]) + normal[1] * (meio[1] - centro[1]) < 0) normal = [-normal[0], -normal[1]];
  const giroFachada = Math.atan2(normal[0], normal[1]);
  const [tx, tz] = emM(v.torre.em);

  return (
    <group>
      <mesh geometry={caixa} material={[fab.cor("#e4e2dd", 0.9), lados]} rotation-x={-Math.PI / 2} castShadow receiveShadow />

      {/* pórtico de entrada no meio da fachada principal, mais alto que a caixa */}
      <group position={[meio[0] + normal[0] * 0.5, 0, meio[1] + normal[1] * 0.5]} rotation-y={giroFachada}>
        {v.moldura ? (
          <>
            <mesh position-y={(v.altura + 1.2) / 2} material={fab.cor(v.moldura, 0.6)} castShadow>
              <boxGeometry args={[comprimento * 0.36, v.altura + 1.2, 1]} />
            </mesh>
            <mesh position={[0, (v.altura - 0.4) / 2, 0.12]} material={fab.cor("#6f8da3", 0.12)}>
              <boxGeometry args={[comprimento * 0.32, v.altura - 0.4, 1]} />
            </mesh>
          </>
        ) : (
          <>
            <mesh position-y={(v.altura * 0.75) / 2} material={fab.cor("#4a4b52", 0.5)} castShadow>
              <boxGeometry args={[comprimento * 0.4, v.altura * 0.75, 1]} />
            </mesh>
            {Array.from({ length: 6 }, (_, i) => (
              <mesh key={i} position={[0, 0.9 + i * 0.95, 0.52]} material={fab.cor("#f2f2f0", 0.6)}>
                <boxGeometry args={[comprimento * 0.4, 0.14, 0.12]} />
              </mesh>
            ))}
          </>
        )}
        {/* logo RioMar no alto da fachada */}
        <mesh position={[v.moldura ? comprimento * 0.13 : 0, v.altura * (v.moldura ? 0.62 : 0.88), v.moldura ? 0.65 : 0.55]} material={logo}>
          <planeGeometry args={[7.2, 2.8]} />
        </mesh>
      </group>

      {/* torre comercial colada numa ponta */}
      <mesh position={[tx, v.torre.altura / 2, tz]} material={fab.cor(v.torre.vidro ? "#5f7f96" : "#d9d9d6", v.torre.vidro ? 0.2 : 0.8)} castShadow receiveShadow>
        <boxGeometry args={[v.torre.lado, v.torre.altura, v.torre.lado]} />
      </mesh>
      {Array.from({ length: Math.floor(v.torre.altura / 1.4) }, (_, i) => (
        <mesh key={i} position={[tx, 1 + i * 1.4, tz]} material={fab.cor(v.torre.vidro ? "#d5dbe0" : "#6f7f8c", 0.5)}>
          <boxGeometry args={[v.torre.lado + 0.06, 0.32, v.torre.lado + 0.06]} />
        </mesh>
      ))}
      {v.torre.heliponto && (
        <mesh position={[tx, v.torre.altura + 0.1, tz]} material={fab.cor("#2f5f9e", 0.6)}>
          <cylinderGeometry args={[v.torre.lado * 0.42, v.torre.lado * 0.42, 0.2, 20]} />
        </mesh>
      )}

      {/* claraboias em arco cruzando o telhado (só o de Fortaleza) */}
      {v.arcos &&
        [-0.18, 0, 0.18].map((t) => {
          const [cx, cz] = emM([20 + t * 260, 0]);
          return (
            <mesh key={t} position={[cx, v.altura, cz]} rotation={[0, giroFachada, Math.PI / 2]} material={fab.cor("#eef2f1", 0.3)} castShadow>
              <cylinderGeometry args={[1.6, 1.6, 12, 16, 1, false, 0, Math.PI]} />
            </mesh>
          );
        })}

      <Estacionamento v={v} meio={meio} normal={normal} comprimento={comprimento} giro={giroFachada} fab={fab} />

      {v.lagoa &&
        (() => {
          const [lx, lz] = emM(v.lagoa.em);
          return (
            <mesh position={[lx, 0.06, lz]} rotation-x={-Math.PI / 2} scale={[v.lagoa.raio[0], v.lagoa.raio[1], 1]} material={fab.agua()} receiveShadow>
              <circleGeometry args={[1, 28]} />
            </mesh>
          );
        })()}
    </group>
  );
}

/** Estacionamento descoberto na frente da fachada principal, com fileiras de palmeiras e carros */
function Estacionamento({ v, meio, normal, comprimento, giro, fab }: { v: Variante; meio: Xy; normal: Xy; comprimento: number; giro: number; fab: Fabrica }) {
  const profundidade = 7;
  const largura = comprimento * 0.95;
  const centro: Xy = [meio[0] + normal[0] * (profundidade / 2 + 0.6), meio[1] + normal[1] * (profundidade / 2 + 0.6)];
  const { palmeiras, carros } = useMemo(() => {
    const rnd = aleatorio(v.nome.length * 97);
    const p: Xy[] = [];
    const c: Xy[] = [];
    // coordenadas locais do estacionamento: u ao longo da fachada, w para longe dela
    for (let u = -largura / 2 + 1.5; u < largura / 2 - 1; u += 3.2) p.push([u, profundidade / 2 - 0.5]);
    for (let fila = 0; fila < 3; fila++) {
      for (let u = -largura / 2 + 0.8; u < largura / 2 - 0.6; u += 0.75) if (rnd() < 0.55) c.push([u, -profundidade / 2 + 1 + fila * 2]);
    }
    return { palmeiras: p, carros: c };
  }, [v.nome, largura]);

  const troncos = useRef<THREE.InstancedMesh>(null);
  const copas = useRef<THREE.InstancedMesh>(null);
  const autos = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    palmeiras.forEach(([u, w], i) => {
      o.position.set(u, 1.3, w);
      o.updateMatrix();
      troncos.current!.setMatrixAt(i, o.matrix);
      o.position.set(u, 2.7, w);
      o.updateMatrix();
      copas.current!.setMatrixAt(i, o.matrix);
    });
    troncos.current!.instanceMatrix.needsUpdate = true;
    copas.current!.instanceMatrix.needsUpdate = true;
    const tons = ["#f4f4f2", "#c9cccf", "#2b2e33", "#9a9ea3", "#3c4f6b", "#8c2f2f"];
    carros.forEach(([u, w], i) => {
      o.position.set(u, 0.22, w);
      o.updateMatrix();
      autos.current!.setMatrixAt(i, o.matrix);
      autos.current!.setColorAt(i, cor.set(tons[i % tons.length]));
    });
    autos.current!.instanceMatrix.needsUpdate = true;
    if (autos.current!.instanceColor) autos.current!.instanceColor.needsUpdate = true;
  }, [palmeiras, carros]);

  return (
    <group position={[centro[0], 0, centro[1]]} rotation-y={giro}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.04} material={fab.cor("#8a8c8c", 0.95)} receiveShadow>
        <planeGeometry args={[largura, profundidade]} />
      </mesh>
      <instancedMesh ref={troncos} args={[undefined, undefined, palmeiras.length]} material={fab.cor("#8b7355")} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 2.6, 5]} />
      </instancedMesh>
      <instancedMesh ref={copas} args={[undefined, undefined, palmeiras.length]} material={fab.cor("#3f6e2e")} castShadow>
        <icosahedronGeometry args={[0.85, 0]} />
      </instancedMesh>
      <instancedMesh ref={autos} args={[undefined, undefined, carros.length]}>
        <boxGeometry args={[0.45, 0.35, 0.9]} />
        <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
    </group>
  );
}

export function RioMarFortaleza({ fab }: { fab: Fabrica }) {
  return <RioMar v={VARIANTES.fortaleza} fab={fab} />;
}

export function RioMarKennedy({ fab }: { fab: Fabrica }) {
  return <RioMar v={VARIANTES.kennedy} fab={fab} />;
}
