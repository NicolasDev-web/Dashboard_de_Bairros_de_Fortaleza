import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/**
 * Estádio Presidente Vargas, no Benfica (pesquisa/estadioPv/ficha.md).
 * Planta OSM way/179073475, 190,5 × 254,7 m: K ≈ 0,20 e eixo longo a 167° do norte.
 * Miniatura estilizada: 42 × 50 m, base em y=0, norte em −z.
 */
const GIRO = THREE.MathUtils.degToRad(13);

/** Altura da etiqueta: topo das torres de iluminação + margem. */
export const ALTURA_ETIQUETA = 17;

type Item = [x: number, y: number, z: number, sx?: number, sy?: number, sz?: number, giro?: number];

/** Instancia peças repetidas do estádio com transformação determinística. */
function Instancias({ nome, geo, mat, itens, sombra = true }: { nome: string; geo: THREE.BufferGeometry; mat: THREE.Material; itens: Item[]; sombra?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current!, o = new THREE.Object3D();
    itens.forEach(([x, y, z, sx = 1, sy = 1, sz = 1, giro = 0], i) => {
      o.position.set(x, y, z); o.rotation.set(0, giro, 0); o.scale.set(sx, sy, sz); o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [itens]);
  return <instancedMesh ref={ref} name={nome} args={[geo, mat, itens.length]} castShadow={sombra} receiveShadow />;
}

/** Plano horizontal em x/z, com a normal voltada para cima. */
function plano(largura: number, fundo: number) {
  const g = new THREE.PlaneGeometry(largura, fundo);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Recursos geométricos compartilhados pelas arquibancadas, acessos, gols e torres. */
function useGeometrias() {
  const g = useMemo(() => ({
    chao: new THREE.CircleGeometry(32.6, 64),
    campo: plano(24, 38),
    faixaCampo: plano(24, 3.8),
    linhaLonga: caixaChanfrada(0.10, 0.035, 38, 0.015),
    linhaCurta: caixaChanfrada(24, 0.035, 0.10, 0.015),
    degrauLateral: caixaChanfrada(1, 0.65, 1, 0.07),
    degrauFundo: caixaChanfrada(1, 0.65, 1, 0.07),
    muro: caixaChanfrada(1, 1, 1, 0.12),
    acesso: caixaChanfrada(1, 1, 1, 0.08),
    cabine: caixaChanfrada(5.2, 2.2, 2.4, 0.12),
    coberturaCabine: caixaChanfrada(6, 0.22, 3.1, 0.08),
    poste: new THREE.CylinderGeometry(0.16, 0.24, 1, 8),
    travessa: caixaChanfrada(1, 0.11, 0.11, 0.03),
    refletor: caixaChanfrada(0.65, 0.48, 0.22, 0.06),
    placa: caixaChanfrada(5.4, 2.4, 0.22, 0.08),
    arvoreTronco: new THREE.CylinderGeometry(0.12, 0.18, 1, 6),
    arvoreCopa: new THREE.IcosahedronGeometry(1, 1),
  }), []);
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}

/** Uma lateral da arquibancada, em cinco patamares crescentes para fora do campo. */
function ArquibancadaLateral({ lado, geo, mat }: { lado: -1 | 1; geo: THREE.BufferGeometry; mat: THREE.Material }) {
  const itens: Item[] = [];
  for (let i = 0; i < 5; i++) itens.push([lado * (14.8 + i * 0.72), 0.35 + i * 0.56, 0, 1.35, (0.65 + i * 0.58) / 0.65, 38 - i * 0.55]);
  return <Instancias nome={`Arquibancada_${lado < 0 ? "Oeste" : "Leste"}_Patamares`} geo={geo} mat={mat} itens={itens} />;
}

/** Uma cabeceira da arquibancada, com degraus fechando o anel. */
function ArquibancadaFundo({ lado, geo, mat }: { lado: -1 | 1; geo: THREE.BufferGeometry; mat: THREE.Material }) {
  const itens: Item[] = [];
  for (let i = 0; i < 5; i++) itens.push([0, 0.35 + i * 0.56, lado * (20.1 + i * 0.72), 28.6 - i * 0.5, (0.65 + i * 0.58) / 0.65, 1.35]);
  return <Instancias nome={`Arquibancada_${lado < 0 ? "Norte" : "Sul"}_Patamares`} geo={geo} mat={mat} itens={itens} />;
}

/** Torre de iluminação com poste, travessa e oito refletores. */
function Torre({ x, z, geo, metal, luz, indice }: { x: number; z: number; geo: ReturnType<typeof useGeometrias>; metal: THREE.Material; luz: THREE.Material; indice: number }) {
  const refletores: Item[] = [];
  for (let c = -1.5; c <= 1.5; c += 1) for (let l = 0; l < 2; l++) refletores.push([x + c * 0.72, 13.1 + l * 0.62, z]);
  return (
    <>
      <mesh name={`Torre_${indice}_Mastro`} geometry={geo.poste} material={metal} position={[x, 6.2, z]} scale={[1, 12.4, 1]} castShadow />
      <mesh name={`Torre_${indice}_Travessa`} geometry={geo.travessa} material={metal} position={[x, 13.0, z]} scale={[5.8, 1, 1]} castShadow />
      <Instancias nome={`Torre_${indice}_Refletores`} geo={geo.refletor} mat={luz} itens={refletores} />
    </>
  );
}

/** Miniatura completa do PV: campo, arquibancadas, acessos, cabine e iluminação. */
export function EstadioPv({ fab }: { fab: Fabrica }) {
  const g = useGeometrias();
  const concreto = fab.cor("#d8d4c9", 0.9), concretoEscuro = fab.cor("#8f948f", 0.92);
  const azul = fab.cor("#24639a", 0.78), amarelo = fab.cor("#e3b93c", 0.78), laranja = fab.cor("#d96a32", 0.8);
  const grama = fab.cor("#4f8e42", 0.96), gramaClara = fab.cor("#64a34e", 0.96), branco = fab.cor("#f4f2e8", 0.65);
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ name: "Mat_Metal_Torres", color: "#555d63", roughness: 0.48, metalness: 0.58 }), []);
  const luz = useMemo(() => new THREE.MeshStandardMaterial({ name: "Mat_Refletores", color: "#f2efe0", roughness: 0.25, metalness: 0.25 }), []);
  useEffect(() => () => { metal.dispose(); luz.dispose(); }, [metal, luz]);
  const faixas: Item[] = Array.from({ length: 10 }, (_, i) => [0, 0.075, -17.1 + i * 3.8]);
  const acessosLaterais: Item[] = [-13, -6.5, 0, 6.5, 13].flatMap((z) => [[-20.25, 0, z, 1.15, 2.4, 2.2], [20.25, 0, z, 1.15, 2.4, 2.2]] as Item[]);
  const acessosFundos: Item[] = [-10, -3.3, 3.3, 10].flatMap((x) => [[x, 0, -24.25, 2.1, 2.4, 1.2], [x, 0, 24.25, 2.1, 2.4, 1.2]] as Item[]);
  const arvores: Item[] = [[-26, 0, -8], [-25, 0, 6], [25, 0, -7], [26, 0, 8], [-14, 0, 26], [14, 0, -26]];
  return (
    <group rotation-y={GIRO}>
      <mesh name="Entorno_Piso" geometry={g.chao} material={concretoEscuro} rotation-x={-Math.PI / 2} receiveShadow />
      <mesh name="Campo_Gramado" geometry={g.campo} material={grama} position-y={0.06} receiveShadow />
      <Instancias nome="Campo_Faixas_Claras" geo={g.faixaCampo} mat={gramaClara} itens={faixas.filter((_, i) => i % 2 === 0)} sombra={false} />
      <Instancias nome="Campo_Linhas_Laterais" geo={g.linhaLonga} mat={branco} itens={[[-12, 0.10, 0], [12, 0.10, 0], [0, 0.10, 0]]} sombra={false} />
      <Instancias nome="Campo_Linhas_Fundo" geo={g.linhaCurta} mat={branco} itens={[[0, 0.10, -19], [0, 0.10, 19]]} sombra={false} />
      <mesh name="Campo_Circulo_Central" position-y={0.105} rotation-x={-Math.PI / 2} receiveShadow>
        <ringGeometry args={[3.2, 3.3, 32]} />
        <primitive object={branco} attach="material" />
      </mesh>
      <ArquibancadaLateral lado={-1} geo={g.degrauLateral} mat={azul} />
      <ArquibancadaLateral lado={1} geo={g.degrauLateral} mat={amarelo} />
      <ArquibancadaFundo lado={-1} geo={g.degrauFundo} mat={laranja} />
      <ArquibancadaFundo lado={1} geo={g.degrauFundo} mat={azul} />
      <Instancias nome="Fachada_Muros_Laterais" geo={g.muro} mat={concreto} itens={[[-20.7, 0, 0, 1.1, 4.8, 43], [20.7, 0, 0, 1.1, 4.8, 43]]} />
      <Instancias nome="Fachada_Muros_Cabeceiras" geo={g.muro} mat={concreto} itens={[[0, 0, -24.7, 36, 4.8, 1.1], [0, 0, 24.7, 36, 4.8, 1.1]]} />
      <Instancias nome="Fachada_Acessos_Laterais" geo={g.acesso} mat={concretoEscuro} itens={acessosLaterais} />
      <Instancias nome="Fachada_Acessos_Cabeceiras" geo={g.acesso} mat={concretoEscuro} itens={acessosFundos} />
      <mesh name="Cabine_Imprensa" geometry={g.cabine} material={concreto} position={[18.1, 6.0, 0]} castShadow receiveShadow />
      <mesh name="Cabine_Imprensa_Cobertura" geometry={g.coberturaCabine} material={concretoEscuro} position={[18.1, 8.2, 0]} castShadow />
      <mesh name="Placar_Eletronico" geometry={g.placa} material={metal} position={[0, 5.8, -24.9]} castShadow />
      {[[-20, -23], [20, -23], [-20, 23], [20, 23]].map(([x, z], i) => <Torre key={i} x={x} z={z} geo={g} metal={metal} luz={luz} indice={i + 1} />)}
      <Instancias nome="Entorno_Arvores_Troncos" geo={g.arvoreTronco} mat={fab.cor("#70543c", 0.9)} itens={arvores.map(([x, , z]) => [x, 1.4, z, 1, 2.8, 1])} />
      <Instancias nome="Entorno_Arvores_Copas" geo={g.arvoreCopa} mat={fab.cor("#447a39", 0.9)} itens={arvores.map(([x, , z]) => [x, 4.0, z, 2.1, 1.7, 2.1])} />
    </group>
  );
}
