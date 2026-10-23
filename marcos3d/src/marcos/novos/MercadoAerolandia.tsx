import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/** Mercado da Aerolândia: galpão metálico histórico, vãos abertos e cobertura industrial. */
export const ALTURA_ETIQUETA = 13;

export function MercadoAerolandia({ fab }: { fab: Fabrica }) {
  const ferro = fab.cor("#38596a", .72), telha = fab.cor("#b8afa0", .9), tijolo = fab.cor("#a85b43", .88), sombra = fab.cor("#26343b", .38);
  const eixos = [-10, -5, 0, 5, 10];
  return <group rotation-y={.08}>
    <mesh name="Piso_Mercado" geometry={caixaChanfrada(31, .18, 22, .1)} material={fab.cor("#c9bdab", .96)} position-y={.09} receiveShadow />
    <mesh name="Pavilhao_Baixo" geometry={caixaChanfrada(25, 3.2, 14, .14)} material={tijolo} position-y={1.6} castShadow receiveShadow />
    <mesh name="Cobertura_Principal" position={[0, 7.4, 0]} rotation-y={Math.PI / 4} scale={[1.75, 1, 1.05]} material={telha} castShadow><coneGeometry args={[9.2, 4.8, 4]} /></mesh>
    {eixos.map((x, i) => <group key={x}>
      <mesh name={`Portico_Coluna_E_${i}`} geometry={caixaChanfrada(.35, 6.5, .42, .07)} material={ferro} position={[x, 3.25, 6.7]} castShadow />
      <mesh name={`Portico_Coluna_O_${i}`} geometry={caixaChanfrada(.35, 6.5, .42, .07)} material={ferro} position={[x, 3.25, -6.7]} castShadow />
      <mesh name={`Vao_Frontal_${i}`} geometry={caixaChanfrada(3.4, 2.7, .15, .04)} material={sombra} position={[x, 1.55, 7.05]} />
    </group>)}
    <mesh name="Trelica_Frontal" geometry={caixaChanfrada(26, .42, .45, .07)} material={ferro} position={[0, 6.4, 6.7]} castShadow />
    <mesh name="Letreiro_Mercado" geometry={caixaChanfrada(8.5, 1.4, .25, .1)} material={fab.cor("#ece4d0", .86)} position={[0, 4.6, 7.2]} castShadow />
    {[-13.3, 13.3].map((x, i) => <mesh key={x} name={`Ala_Lateral_${i}`} geometry={caixaChanfrada(2.2, 4.2, 14, .12)} material={tijolo} position={[x, 2.1, 0]} castShadow />)}
  </group>;
}
