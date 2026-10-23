import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/** Santuário de Nossa Senhora de Fátima: nave branca, torre sineira central e telhados cerâmicos. */
export const ALTURA_ETIQUETA = 20;

export function IgrejaFatima({ fab }: { fab: Fabrica }) {
  const branco = fab.cor("#eee9df", .84), telha = fab.cor("#a94d35", .82), sombra = fab.cor("#28333a", .42), pedra = fab.cor("#b9ad98", .92);
  const janelas = [-8.5, -5.5, -2.5, 2.5, 5.5, 8.5];
  return <group rotation-y={-.06}>
    <mesh name="Adro" geometry={caixaChanfrada(32, .18, 35, .1)} material={pedra} position-y={.09} receiveShadow />
    <mesh name="Nave_Central" geometry={caixaChanfrada(15, 8.5, 24, .2)} material={branco} position={[0, 4.25, -2]} castShadow receiveShadow />
    <mesh name="Nave_Telhado" position={[0, 10.2, -2]} rotation-y={Math.PI / 4} scale={[1.15, 1, 1.65]} material={telha} castShadow><coneGeometry args={[8.3, 4, 4]} /></mesh>
    <mesh name="Torre_Sineira" geometry={caixaChanfrada(6.2, 15.2, 5.3, .18)} material={branco} position={[0, 7.6, 11]} castShadow />
    <mesh name="Torre_Coroamento" position={[0, 16.5, 11]} rotation-y={Math.PI / 4} material={telha} castShadow><coneGeometry args={[4.1, 3.4, 4]} /></mesh>
    <mesh name="Porta_Principal" geometry={caixaChanfrada(2.7, 4.8, .2, .08)} material={sombra} position={[0, 2.5, 13.68]} />
    {[-1.75, 0, 1.75].map((x, i) => <mesh key={x} name={`Sineira_Vao_${i}`} position={[x, 10.8, 13.7]} material={sombra}><boxGeometry args={[.9, 2.6, .18]} /></mesh>)}
    {janelas.map((x, i) => <mesh key={x} name={`Janela_Lateral_${i}`} geometry={caixaChanfrada(1.2, 2.4, .18, .04)} material={sombra} position={[i < 3 ? -7.58 : 7.58, 4.7, x]} rotation-y={Math.PI / 2} />)}
    <mesh name="Cruz_Vertical" geometry={caixaChanfrada(.38, 3.1, .32, .04)} material={fab.cor("#705635", .78)} position={[0, 19.1, 11]} castShadow />
    <mesh name="Cruz_Horizontal" geometry={caixaChanfrada(2.1, .36, .32, .04)} material={fab.cor("#705635", .78)} position={[0, 19.5, 11]} castShadow />
    <mesh name="Escadaria" geometry={caixaChanfrada(9, .65, 4, .1)} material={pedra} position={[0, .42, 15]} receiveShadow />
  </group>;
}
