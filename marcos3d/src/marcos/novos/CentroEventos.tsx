import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/** Centro de Eventos do Ceará: grande pavilhão contemporâneo, marquise e fachadas coloridas. */
export const ALTURA_ETIQUETA = 13;

export function CentroEventos({ fab }: { fab: Fabrica }) {
  const branco = fab.cor("#e7e8e4", .78), concreto = fab.cor("#aaaead", .9), vidro = fab.cor("#31546a", .28);
  const cores = ["#d54a3e", "#e1a53d", "#4f82a8", "#59895a"];
  return <group rotation-y={-.12}>
    <mesh name="Esplanada" geometry={caixaChanfrada(52, .16, 36, .1)} material={fab.cor("#c8c5bd", .96)} position-y={.08} receiveShadow />
    <mesh name="Pavilhao_Principal" geometry={caixaChanfrada(48, 8, 25, .25)} material={branco} position={[0, 4, -2]} castShadow receiveShadow />
    <mesh name="Fachada_Vidro" geometry={caixaChanfrada(37, 4.8, .25, .06)} material={vidro} position={[-3, 3.8, 10.6]} />
    <mesh name="Marquise_Entrada" geometry={caixaChanfrada(44, .5, 8.5, .14)} material={branco} position={[-1, 7.3, 13.5]} castShadow />
    {[-17, -11, -5, 1, 7, 13].map((x, i) => <mesh key={x} name={`Aleta_Colorida_${i}`} geometry={caixaChanfrada(1.1, 7.2, .55, .1)} material={fab.cor(cores[i % cores.length], .78)} position={[x, 4.1, 10.9]} castShadow />)}
    {[-18, -12, -6, 0, 6, 12, 18].map((x, i) => <mesh key={x} name={`Pilotis_${i}`} geometry={caixaChanfrada(.48, 7, .48, .08)} material={concreto} position={[x, 3.5, 15.2]} castShadow />)}
    {[-18, -9, 0, 9, 18].map((x, i) => <mesh key={x} name={`Onda_Cobertura_${i}`} geometry={caixaChanfrada(10.2, .45, 28, .18)} material={branco} position={[x, 8.2 + (i % 2) * .55, -2]} rotation-z={(i % 2 ? -1 : 1) * .035} castShadow />)}
    <mesh name="Bloco_Apoio" geometry={caixaChanfrada(9, 5.5, 18, .18)} material={concreto} position={[25, 2.75, -3]} castShadow />
    <mesh name="Espelho_Dagua" geometry={caixaChanfrada(18, .12, 4.5, .08)} material={fab.agua()} position={[15, .15, 15]} receiveShadow />
  </group>;
}
