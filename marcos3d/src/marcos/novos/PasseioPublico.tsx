import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../../Cena";
import { aleatorio, caixaChanfrada } from "../../util/geometria";

/**
 * Passeio Público / Praça dos Mártires (Centro; -3.7226365, -38.5263038).
 * O bosque histórico é resumido pelos eixos diagonais, fonte central, Café Passeio, bustos e o baobá centenário.
 * Planta OSM orientada a 18° NNE; K≈0,43 para representar o quarteirão no disco. Metros, base em y=0.
 */
export const ALTURA_ETIQUETA = 13.5;

type Item = [number, number, number, number?, number?, number?, number?];

/** Instâncias com escala independente por eixo para árvores, postes, bancos e gradis. */
function Instancias({ nome, geo, mat, itens, cores, sombra = true }: { nome: string; geo: THREE.BufferGeometry; mat: THREE.Material; itens: Item[]; cores?: string[]; sombra?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D(), c = new THREE.Color(), m = ref.current!;
    itens.forEach(([x, y, z, sx = 1, sy = 1, sz = 1, giro = 0], i) => {
      o.position.set(x, y, z); o.rotation.set(0, giro, 0); o.scale.set(sx, sy, sz); o.updateMatrix();
      m.setMatrixAt(i, o.matrix); if (cores) m.setColorAt(i, c.set(cores[i % cores.length]));
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere();
  }, [itens, cores]);
  return <instancedMesh ref={ref} name={nome} args={[geo, mat, itens.length]} castShadow={sombra} receiveShadow />;
}

/** Caminho retangular rotacionado sobre o gramado. */
function caminho(w: number, d: number, a: number) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.rotateY(a); g.translate(0, 0.055, 0); return g;
}

export function PasseioPublico({ fab }: { fab: Fabrica }) {
  const geos = useMemo(() => {
    const disco = new THREE.CircleGeometry(32.6, 64); disco.rotateX(-Math.PI / 2); disco.translate(0, 0.02, 0);
    const busto = new THREE.SphereGeometry(0.42, 10, 8); busto.scale(0.8, 1.25, 0.75);
    return {
      disco, caminhoA: caminho(42, 3.2, Math.PI / 4), caminhoB: caminho(42, 3.2, -Math.PI / 4), caminhoC: caminho(50, 2.5, 0),
      fonte: new THREE.CylinderGeometry(5.3, 5.8, 0.6, 32), agua: new THREE.CylinderGeometry(4.75, 4.75, 0.08, 32),
      coluna: new THREE.CylinderGeometry(0.42, 0.58, 4.5, 12), bacia: new THREE.CylinderGeometry(1.45, 0.75, 0.28, 20), busto,
      pedestal: caixaChanfrada(1.1, 1.25, 1.1, 0.08), cafe: caixaChanfrada(10.5, 3.2, 7.2, 0.15),
      telhado: new THREE.ConeGeometry(6.8, 2.1, 4), varanda: caixaChanfrada(12.2, 0.35, 8.8, 0.08), porta: caixaChanfrada(1.25, 2.25, 0.16, 0.04),
      copa: new THREE.IcosahedronGeometry(1, 1), tronco: new THREE.CylinderGeometry(0.16, 0.24, 1, 7),
      banco: caixaChanfrada(2.4, 0.16, 0.48, 0.06), peBanco: caixaChanfrada(0.18, 0.65, 0.42, 0.04),
      poste: new THREE.CylinderGeometry(0.08, 0.1, 1, 8), globo: new THREE.SphereGeometry(0.2, 8, 6),
      mureta: caixaChanfrada(1, 0.45, 0.28, 0.05), grade: new THREE.BoxGeometry(0.05, 1.1, 0.05),
    };
  }, []);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  const arvores: Item[] = [], copas: Item[] = [], postes: Item[] = [], globos: Item[] = [];
  const rnd = aleatorio(1864);
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2, r = 8 + rnd() * 22, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x + z) < 2.7 || Math.abs(x - z) < 2.7 || Math.hypot(x, z) < 7) continue;
    const e = 0.8 + rnd() * 0.55, h = 4.2 + rnd() * 2.6;
    arvores.push([x, h / 2, z, e, h, e]); copas.push([x, h + 1.2 * e, z, 2.2 * e, 1.65 * e, 2.1 * e, rnd() * 6]);
  }
  // Baobá destacado no quadrante sudoeste: tronco muito mais largo e copa baixa.
  arvores.push([-15, 3.7, 10, 4.1, 7.4, 4.1]); copas.push([-15, 9.2, 10, 5.1, 2.7, 5.1]);
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const r of [10, 20, 27]) {
    const x = Math.cos(a + Math.PI / 4) * r, z = Math.sin(a + Math.PI / 4) * r;
    postes.push([x, 1.65, z, 1, 3.3, 1]); globos.push([x, 3.35, z]);
  }
  const bustos: Item[] = [[-8, 1.55, -3], [8, 1.55, 3], [-3, 1.55, 8], [3, 1.55, -8]];
  const bancos: Item[] = [], pes: Item[] = [];
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r = 12.5; const x = Math.cos(a) * r, z = Math.sin(a) * r; bancos.push([x, 0.72, z, 1, 1, 1, -a]); pes.push([x - Math.sin(a) * 0.75, 0.32, z + Math.cos(a) * 0.75], [x + Math.sin(a) * 0.75, 0.32, z - Math.cos(a) * 0.75]); }
  const muretas: Item[] = [], grades: Item[] = [];
  for (let x = -15; x <= 15; x += 2) { muretas.push([x, 0, -28, 2, 1, 1]); for (let q = -0.75; q <= 0.75; q += 0.5) grades.push([x + q, 0.85, -28]); }

  return (
    <group rotation-y={-THREE.MathUtils.degToRad(18)}>
      <mesh name="Praca_Gramado_Base" geometry={geos.disco} material={fab.cor("#6f9449", 0.98)} receiveShadow />
      <mesh name="Caminho_Diagonal_Noroeste" geometry={geos.caminhoA} material={fab.cor("#d7d0be", 0.94)} receiveShadow />
      <mesh name="Caminho_Diagonal_Nordeste" geometry={geos.caminhoB} material={fab.cor("#d7d0be", 0.94)} receiveShadow />
      <mesh name="Caminho_Orla" geometry={geos.caminhoC} material={fab.cor("#c9c1ae", 0.95)} receiveShadow />
      <mesh name="Fonte_Borda" geometry={geos.fonte} material={fab.cor("#e3ded0", 0.82)} position-y={0.3} castShadow receiveShadow />
      <mesh name="Fonte_Agua" geometry={geos.agua} material={fab.agua()} position-y={0.64} receiveShadow />
      <mesh name="Fonte_Coluna" geometry={geos.coluna} material={fab.cor("#d2c8ad", 0.78)} position-y={2.85} castShadow />
      <mesh name="Fonte_Bacia_Inferior" geometry={geos.bacia} material={fab.cor("#d2c8ad", 0.78)} position-y={3.2} castShadow />
      <mesh name="Fonte_Bacia_Superior" geometry={geos.bacia} material={fab.cor("#d2c8ad", 0.78)} position-y={5.0} scale={0.66} castShadow />
      <mesh name="Fonte_Escultura" geometry={geos.busto} material={fab.cor("#c4b99f", 0.72)} position-y={6.05} castShadow />
      <group position={[17, 0, -14]}>
        <mesh name="Cafe_Passeio_Varanda" geometry={geos.varanda} material={fab.cor("#ddd5bd", 0.9)} castShadow receiveShadow />
        <mesh name="Cafe_Passeio_Corpo" geometry={geos.cafe} material={fab.cor("#f0dfb8", 0.86)} castShadow receiveShadow />
        <mesh name="Cafe_Passeio_Telhado" geometry={geos.telhado} material={fab.cor("#b44532", 0.78)} position-y={3.2} rotation-y={Math.PI / 4} castShadow />
        <Instancias nome="Cafe_Passeio_Portas" geo={geos.porta} mat={fab.cor("#315548", 0.64)} itens={[[-3.2, 0, -3.62], [0, 0, -3.62], [3.2, 0, -3.62]]} />
      </group>
      <Instancias nome="Monumentos_Pedestais" geo={geos.pedestal} mat={fab.cor("#ddd7c8", 0.88)} itens={bustos.map(([x, , z]) => [x, 0, z])} />
      <Instancias nome="Monumentos_Bustos" geo={geos.busto} mat={fab.cor("#9d9687", 0.7)} itens={bustos} />
      <Instancias nome="Arvores_Troncos" geo={geos.tronco} mat={fab.cor("#66503b", 0.93)} itens={arvores} />
      <Instancias nome="Arvores_Copas" geo={geos.copa} mat={fab.cor("#ffffff", 0.92)} itens={copas} cores={["#315d32", "#3d7038", "#507f40", "#2c5530"]} />
      <Instancias nome="Bancos_Assentos" geo={geos.banco} mat={fab.cor("#36523b", 0.82)} itens={bancos} />
      <Instancias nome="Bancos_Pes" geo={geos.peBanco} mat={fab.cor("#202722", 0.58)} itens={pes} />
      <Instancias nome="Postes_Iluminacao" geo={geos.poste} mat={fab.cor("#252d28", 0.46)} itens={postes} sombra={false} />
      <Instancias nome="Postes_Globos" geo={geos.globo} mat={fab.cor("#f2e4ae", 0.25)} itens={globos} sombra={false} />
      <Instancias nome="Mureta_Orla" geo={geos.mureta} mat={fab.cor("#e5e1d5", 0.9)} itens={muretas} />
      <Instancias nome="Gradil_Orla" geo={geos.grade} mat={fab.cor("#25302b", 0.52)} itens={grades} sombra={false} />
    </group>
  );
}
