import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/** Marco Zero / Praça de Santiago: praça circular, rosa dos ventos e cruzeiro da Barra do Ceará. */
export const ALTURA_ETIQUETA = 12;

export function MarcoZero({ fab }: { fab: Fabrica }) {
  const claro = fab.cor("#d9d0bc", .95), escuro = fab.cor("#665d50", .86), pedra = fab.cor("#a7977e", .9);
  return <group>
    <mesh name="Praca_Circular" position-y={.12} material={claro} receiveShadow><cylinderGeometry args={[15.5, 15.5, .24, 48]} /></mesh>
    <mesh name="Anel_Central" position-y={.22} material={escuro} receiveShadow><cylinderGeometry args={[7.2, 7.2, .12, 40]} /></mesh>
    <mesh name="Disco_Marco_Zero" position-y={.3} material={claro} receiveShadow><cylinderGeometry args={[5.6, 5.6, .1, 40]} /></mesh>
    {[0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4].map((a, i) => <mesh key={a} name={`Rosa_dos_Ventos_${i}`} geometry={caixaChanfrada(11, .05, .42, .05)} material={escuro} position-y={.38} rotation-y={a} />)}
    <mesh name="Pedestal_Cruzeiro" geometry={caixaChanfrada(3.6, 1.3, 3.6, .25)} material={pedra} position-y={.65} castShadow />
    <mesh name="Cruzeiro_Haste" geometry={caixaChanfrada(.75, 7.8, .75, .09)} material={pedra} position-y={5.2} castShadow />
    <mesh name="Cruzeiro_Braco" geometry={caixaChanfrada(4.4, .72, .72, .09)} material={pedra} position-y={7.6} castShadow />
    {Array.from({ length: 12 }, (_, i) => {
      const a = i * Math.PI / 6;
      return <mesh key={i} name={`Banco_${i}`} geometry={caixaChanfrada(2.3, .55, .7, .12)} material={pedra} position={[Math.sin(a) * 12.6, .5, Math.cos(a) * 12.6]} rotation-y={a} castShadow />;
    })}
    <mesh name="Faixa_Rio_Ceara" geometry={caixaChanfrada(32, .07, 3.2, .05)} material={fab.agua()} position={[0, .08, -17]} receiveShadow />
  </group>;
}
