import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/** Centro Cultural Bom Jardim: volumes baixos e coloridos organizados em torno de uma praça cultural. */
export const ALTURA_ETIQUETA = 10;

export function CentroCulturalBomJardim({ fab }: { fab: Fabrica }) {
  const branco = fab.cor("#e2ded2", .88), azul = fab.cor("#356f95", .8), amarelo = fab.cor("#e2a638", .82), vermelho = fab.cor("#b84d43", .82), concreto = fab.cor("#aaa394", .92);
  return <group rotation-y={.16}>
    <mesh name="Praca_Cultural" geometry={caixaChanfrada(43, .16, 32, .1)} material={concreto} position-y={.08} receiveShadow />
    <mesh name="Bloco_Teatro" geometry={caixaChanfrada(15, 6.5, 12, .22)} material={azul} position={[-11, 3.25, -7]} castShadow receiveShadow />
    <mesh name="Bloco_Formacao" geometry={caixaChanfrada(20, 4.5, 8, .18)} material={branco} position={[8, 2.25, -9]} castShadow receiveShadow />
    <mesh name="Bloco_Midiateca" geometry={caixaChanfrada(11, 4.8, 11, .18)} material={amarelo} position={[13, 2.4, 6]} castShadow receiveShadow />
    <mesh name="Galeria_Artes" geometry={caixaChanfrada(9, 4, 12, .16)} material={vermelho} position={[-14, 2, 7]} castShadow receiveShadow />
    <mesh name="Marquise_Conexao" geometry={caixaChanfrada(30, .42, 3.4, .1)} material={branco} position={[0, 4.4, 2]} castShadow />
    {[-12, -8, -4, 0, 4, 8, 12].map((x, i) => <mesh key={x} name={`Pergola_${i}`} geometry={caixaChanfrada(.34, 4.2, .34, .06)} material={fab.cor("#665348", .8)} position={[x, 2.1, 2]} castShadow />)}
    <mesh name="Palco_Aberto" position={[-1, .38, 9]} material={azul} receiveShadow><cylinderGeometry args={[6, 6, .6, 20, 1, false, 0, Math.PI]} /></mesh>
    {[7.2, 8.7, 10.2].map((z, i) => <mesh key={z} name={`Arquibancada_${i}`} geometry={caixaChanfrada(15 - i * 2, .35 + i * .25, 1.2, .08)} material={concreto} position={[-1, .3 + i * .2, z]} receiveShadow />)}
    <mesh name="Mural_Comunitario" geometry={caixaChanfrada(12, 2.3, .28, .07)} material={fab.cor("#6d4d85", .76)} position={[3, 1.25, -13.1]} castShadow />
  </group>;
}
