import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../Cena";

/**
 * Terminal de Integração Antônio Bezerra em miniatura. As medidas e posições vêm do OpenStreetMap
 * (pesquisa/marcos/terminal-antonio-bezerra/ficha.md), em metros reais com x = leste, y = norte e a
 * origem no centro do lote; `K` encolhe para caber na base e as alturas encolhem menos. A assinatura
 * é o "pente" de três coberturas longas a 174°. Metros, norte em −z.
 */
type Xy = [number, number];

const K = 0.23;
const emM = ([x, y]: Xy): Xy => [(x + 8) * K, -(y - 5) * K];
// as coberturas correm a 174° (quase norte–sul, levemente para leste no sul)
const GIRO = THREE.MathUtils.degToRad(6);
const ALTURA = 2.6;

const LOTE: Xy[] = [[70, -72], [59, 19], [46, 20], [49, 31], [42, 77], [30, 94], [11, 104], [5, 112], [-7, 113], [-66, 58], [-59, -42], [-51, -50], [-47, -81], [-43, -88], [-25, -97], [74, -84]];
const COBERTURAS: { centro: Xy; c: number; l: number; solar?: boolean }[] = [
  { centro: [-32, 11], c: 152, l: 20 },
  { centro: [6, 14], c: 157, l: 28 },
  { centro: [46, -1], c: 95, l: 26, solar: true },
];
const VAPT_VUPT: Xy[] = [[-95, -55], [-50, -55], [-65, 56]];

function forma(pts: Xy[]) {
  return new THREE.Shape(pts.map((p) => {
    const [x, z] = emM(p);
    return new THREE.Vector2(x, -z);
  }));
}

/** Cobertura de duas águas bem baixa sobre pilares cilíndricos com anéis azuis */
function Cobertura({ centro, c, l, solar, fab }: { centro: Xy; c: number; l: number; solar?: boolean; fab: Fabrica }) {
  const [x, z] = emM(centro);
  const comprimento = c * K;
  const largura = l * K;
  const pilares = useRef<THREE.InstancedMesh>(null);
  const aneis = useRef<THREE.InstancedMesh>(null);
  const pontos = useMemo(() => {
    const p: Xy[] = [];
    for (let s = -comprimento / 2 + 1; s <= comprimento / 2 - 1; s += 3) for (const lado of [-1, 1]) p.push([lado * (largura / 2 - 0.4), s]);
    return p;
  }, [comprimento, largura]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    pontos.forEach(([px, pz], i) => {
      o.position.set(px, ALTURA / 2, pz);
      o.updateMatrix();
      pilares.current!.setMatrixAt(i, o.matrix);
      o.position.set(px, ALTURA - 0.45, pz);
      o.updateMatrix();
      aneis.current!.setMatrixAt(i, o.matrix);
    });
    pilares.current!.instanceMatrix.needsUpdate = true;
    aneis.current!.instanceMatrix.needsUpdate = true;
  }, [pontos]);
  const telha = fab.cor("#b9c2bc", 0.5);
  return (
    <group position={[x, 0, z]} rotation-y={GIRO}>
      <instancedMesh ref={pilares} args={[undefined, undefined, pontos.length]} material={fab.cor("#c9cbc6", 0.85)} castShadow>
        <cylinderGeometry args={[0.16, 0.16, ALTURA, 8]} />
      </instancedMesh>
      <instancedMesh ref={aneis} args={[undefined, undefined, pontos.length]} material={fab.cor("#4fa3d1", 0.5)}>
        <cylinderGeometry args={[0.19, 0.19, 0.22, 8]} />
      </instancedMesh>
      {/* treliça espacial por baixo, em sombra, e as duas águas da telha metálica */}
      <mesh position-y={ALTURA + 0.12} material={fab.cor("#5e6461", 0.8)} castShadow>
        <boxGeometry args={[largura, 0.25, comprimento]} />
      </mesh>
      {[-1, 1].map((lado) => (
        <mesh key={lado} position={[(lado * largura) / 4, ALTURA + 0.42, 0]} rotation-z={-lado * 0.12} material={solar && lado > 0 ? fab.cor("#2c3a57", 0.3) : telha} castShadow receiveShadow>
          <boxGeometry args={[largura / 2 + 0.1, 0.1, comprimento + 0.4]} />
        </mesh>
      ))}
      {/* blocos de lojas e bilheterias em pastilha laranja, sob a cobertura */}
      {[-0.3, 0.05, 0.35].map((t) => (
        <mesh key={t} position={[0, 0.7, t * comprimento]} material={fab.cor("#e2652f", 0.8)} castShadow>
          <boxGeometry args={[largura * 0.45, 1.4, 2.2]} />
        </mesh>
      ))}
    </group>
  );
}

/** Baias entre as coberturas: ônibus brancos e azul-claros e a fileira de palmeiras no canteiro */
function Baias({ fab }: { fab: Fabrica }) {
  const { onibus, palmeiras } = useMemo(() => {
    const o: { x: number; z: number; cor: number }[] = [];
    const p: Xy[] = [];
    // baias entre A e B (x real ≈ -13) e entre B e a cobertura leste (x real ≈ 26)
    for (const [bx, de, ate] of [[-13, -55, 80], [26, -40, 45]] as [number, number, number][]) {
      for (let y = de; y < ate; y += 17) {
        const [x, z] = emM([bx - 3, y]);
        o.push({ x, z, cor: o.length % 3 });
      }
      for (let y = de + 6; y < ate; y += 14) p.push(emM([bx + 4, y]));
    }
    return { onibus: o, palmeiras: p };
  }, []);
  const carrocerias = useRef<THREE.InstancedMesh>(null);
  const troncos = useRef<THREE.InstancedMesh>(null);
  const folhas = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const cor = new THREE.Color();
    const tons = ["#e9f1f6", "#7ec3e6", "#f0f0ec"];
    onibus.forEach((b, i) => {
      o.position.set(b.x, 0.45, b.z);
      o.rotation.set(0, GIRO, 0);
      o.updateMatrix();
      carrocerias.current!.setMatrixAt(i, o.matrix);
      carrocerias.current!.setColorAt(i, cor.set(tons[b.cor]));
    });
    carrocerias.current!.instanceMatrix.needsUpdate = true;
    if (carrocerias.current!.instanceColor) carrocerias.current!.instanceColor.needsUpdate = true;
    o.rotation.set(0, 0, 0);
    palmeiras.forEach(([x, z], i) => {
      o.position.set(x, 1.1, z);
      o.updateMatrix();
      troncos.current!.setMatrixAt(i, o.matrix);
      o.position.set(x, 2.3, z);
      o.updateMatrix();
      folhas.current!.setMatrixAt(i, o.matrix);
    });
    troncos.current!.instanceMatrix.needsUpdate = true;
    folhas.current!.instanceMatrix.needsUpdate = true;
  }, [onibus, palmeiras]);
  return (
    <>
      <instancedMesh ref={carrocerias} args={[undefined, undefined, onibus.length]} castShadow>
        <boxGeometry args={[0.62, 0.7, 2.8]} />
        <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={troncos} args={[undefined, undefined, palmeiras.length]} material={fab.cor("#8b7355")} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 2.2, 5]} />
      </instancedMesh>
      <instancedMesh ref={folhas} args={[undefined, undefined, palmeiras.length]} material={fab.cor("#4f7a3a")} castShadow>
        <icosahedronGeometry args={[0.75, 0]} />
      </instancedMesh>
    </>
  );
}

export function TerminalAntonioBezerra({ fab }: { fab: Fabrica }) {
  const { chao, vapt } = useMemo(
    () => ({
      chao: new THREE.ShapeGeometry(forma(LOTE)),
      vapt: new THREE.ExtrudeGeometry(forma(VAPT_VUPT), { depth: 2.8, bevelEnabled: false }),
    }),
    [],
  );
  useEffect(
    () => () => {
      chao.dispose();
      vapt.dispose();
    },
    [chao, vapt],
  );
  const [nx, nz] = emM([-13, 92]);
  const [ax, az] = emM([0, -100]);
  return (
    <group>
      <mesh geometry={chao} rotation-x={-Math.PI / 2} position-y={0.05} material={fab.cor("#8e8d88", 0.95)} receiveShadow />
      {COBERTURAS.map((c) => (
        <Cobertura key={c.centro.join()} {...c} fab={fab} />
      ))}
      <Baias fab={fab} />
      {/* bloco norte de dois pavimentos */}
      <mesh position={[nx, 0.9, nz]} rotation-y={-THREE.MathUtils.degToRad(84 - 90)} material={fab.cor("#e2652f", 0.85)} castShadow>
        <boxGeometry args={[46 * K, 1.8, 16 * K]} />
      </mesh>
      {/* prédio triangular do Vapt Vupt, colado no lado oeste */}
      <mesh geometry={vapt} material={[fab.cor("#f2f2ef", 0.8), fab.cor("#e8e6e0", 0.85)]} rotation-x={-Math.PI / 2} castShadow receiveShadow />
      {/* Av. Mister Hull ao sul, a ~82°, com o canteiro central arborizado */}
      <group position={[ax, 0, az]} rotation-y={THREE.MathUtils.degToRad(8)}>
        <mesh position-y={0.04} rotation-x={-Math.PI / 2} material={fab.cor("#5f605d", 0.95)} receiveShadow>
          <planeGeometry args={[32, 6.5]} />
        </mesh>
        <mesh position-y={0.1} rotation-x={-Math.PI / 2} material={fab.cor("#7fa35a", 0.95)}>
          <planeGeometry args={[32, 1]} />
        </mesh>
        {[-12, -6, 0, 6, 12].map((x) => (
          <mesh key={x} position={[x, 1.2, 0]} material={fab.cor("#4e7a36", 0.9)} castShadow>
            <icosahedronGeometry args={[0.9, 0]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
