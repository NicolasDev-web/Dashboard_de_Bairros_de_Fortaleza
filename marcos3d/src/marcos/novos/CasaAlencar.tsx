import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/** Casa de José de Alencar: casa térrea colonial, alpendre, telhado cerâmico e sítio arborizado. */
export const ALTURA_ETIQUETA = 11;

export function CasaAlencar({ fab }: { fab: Fabrica }) {
  const branco = fab.cor("#e8e0ce", .9), telha = fab.cor("#a14e32", .84), madeira = fab.cor("#594432", .78), verde = fab.cor("#547b45", .96);
  return <group rotation-y={-.18}>
    <mesh name="Sitio_Base" geometry={caixaChanfrada(39, .16, 31, .1)} material={verde} position-y={.08} receiveShadow />
    <mesh name="Casa_Corpo" geometry={caixaChanfrada(19, 4.5, 10, .15)} material={branco} position-y={2.25} castShadow receiveShadow />
    <mesh name="Casa_Telhado" position={[0, 5.8, 0]} rotation-y={Math.PI / 4} scale={[1.5, 1, .85]} material={telha} castShadow><coneGeometry args={[7.3, 3.2, 4]} /></mesh>
    <mesh name="Alpendre_Cobertura" geometry={caixaChanfrada(21, .35, 4, .08)} material={telha} position={[0, 4.1, 6.1]} castShadow />
    {[-8, -5.4, -2.7, 0, 2.7, 5.4, 8].map((x, i) => <mesh key={x} name={`Alpendre_Coluna_${i}`} position={[x, 2.05, 7.4]} material={branco} castShadow><cylinderGeometry args={[.18, .24, 4.1, 8]} /></mesh>)}
    <mesh name="Porta_Principal" geometry={caixaChanfrada(1.7, 2.8, .18, .05)} material={madeira} position={[0, 1.45, 5.08]} />
    {[-6.5, -3.3, 3.3, 6.5].map((x, i) => <mesh key={x} name={`Janela_${i}`} geometry={caixaChanfrada(1.6, 1.9, .18, .05)} material={fab.cor("#47677a", .45)} position={[x, 2.3, 5.08]} />)}
    <mesh name="Calcada_Tijolos" geometry={caixaChanfrada(23, .12, 5, .06)} material={fab.cor("#9b6950", .94)} position={[0, .18, 8.3]} receiveShadow />
    {[[-14, -7], [14, -8], [-15, 9], [15, 8]].map(([x, z], i) => <group key={i} position={[x, 0, z]}>
      <mesh name={`Arvore_Tronco_${i}`} position-y={2.5} material={madeira}><cylinderGeometry args={[.22, .35, 5, 7]} /></mesh>
      <mesh name={`Arvore_Copa_${i}`} position-y={5.6} material={fab.cor(i % 2 ? "#3d7044" : "#4b8149", .9)} castShadow><sphereGeometry args={[2.3, 9, 6]} /></mesh>
    </group>)}
  </group>;
}
