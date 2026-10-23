import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/** Palácio da Abolição: volumes modernistas horizontais de Sérgio Bernardes e jardins. */
export const ALTURA_ETIQUETA = 11;

export function PalacioAbolicao({ fab }: { fab: Fabrica }) {
  const branco = fab.cor("#e7e5df", 0.78), concreto = fab.cor("#aaa99f", 0.9);
  const vidro = fab.cor("#31536a", 0.22), agua = fab.agua(), verde = fab.cor("#4f7f47", 0.94);
  const pilares = [-12, -8, -4, 0, 4, 8, 12];
  return <group rotation-y={-0.1}>
    <mesh name="Jardim_Base" geometry={caixaChanfrada(52, 0.14, 36, 0.1)} material={verde} position-y={0.07} receiveShadow />
    <mesh name="Palacio_Lamina_Principal" geometry={caixaChanfrada(30, 5.4, 10, 0.18)} material={branco} position={[0, 4.1, 0]} castShadow receiveShadow />
    <mesh name="Palacio_Faixa_Vidro" geometry={caixaChanfrada(29.2, 2.1, 0.2, 0.04)} material={vidro} position={[0, 4.2, 5.02]} />
    <mesh name="Palacio_Cobertura" geometry={caixaChanfrada(34, 0.42, 13, 0.1)} material={branco} position={[0, 7.05, 0]} castShadow />
    <mesh name="Ala_Gabinete" geometry={caixaChanfrada(14, 4.2, 15, 0.16)} material={concreto} position={[19, 2.1, -4]} castShadow receiveShadow />
    <mesh name="Marquise_Cerimonial" geometry={caixaChanfrada(20, 0.35, 7, 0.09)} material={branco} position={[-8, 3.2, 9]} castShadow />
    {pilares.map((x, i) => <mesh key={x} name={`Pilotis_${i}`} geometry={caixaChanfrada(.45, 3.2, .45, .06)} material={concreto} position={[x, 1.6, 3.8]} castShadow />)}
    <mesh name="Espelho_Dagua" geometry={caixaChanfrada(25, 0.16, 8, 0.1)} material={agua} position={[-7, 0.15, 15]} receiveShadow />
    {[-22, -16, 13, 18, 23].map((x, i) => <group key={x} position={[x, 0, i % 2 ? 13 : -13]}>
      <mesh name={`Palmeira_Tronco_${i}`} position-y={2.7} material={fab.cor("#77583d", .9)} castShadow><cylinderGeometry args={[.14, .24, 5.4, 7]} /></mesh>
      <mesh name={`Palmeira_Copa_${i}`} position-y={5.7} material={fab.cor(i % 2 ? "#386f42" : "#477d48", .86)} castShadow><sphereGeometry args={[1.5, 8, 5]} /></mesh>
    </group>)}
  </group>;
}
