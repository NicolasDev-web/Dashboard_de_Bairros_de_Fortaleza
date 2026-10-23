import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/** Farol velho do Mucuripe: torre octogonal de alvenaria, lanternim e casa do faroleiro. */
export const ALTURA_ETIQUETA = 20;

export function FarolMucuripe({ fab }: { fab: Fabrica }) {
  const pedra = fab.cor("#d9c8a6", 0.92), claro = fab.cor("#eee5cf", 0.88);
  const ferro = fab.cor("#303536", 0.34), vermelho = fab.cor("#a84332", 0.68), vidro = fab.cor("#34566a", 0.2);
  return <group rotation-y={0.18}>
    <mesh name="Terreno_Farol" material={fab.cor("#b8aa8c", 0.96)} position-y={0.05} receiveShadow><cylinderGeometry args={[18, 18, 0.1, 32]} /></mesh>
    <mesh name="Farol_Base" material={pedra} position-y={1.2} castShadow receiveShadow><cylinderGeometry args={[4.1, 4.8, 2.4, 8]} /></mesh>
    <mesh name="Farol_Torre" material={claro} position-y={8.0} castShadow receiveShadow><cylinderGeometry args={[2.05, 3.5, 13.6, 8]} /></mesh>
    {[3.5, 7, 10.5].map((y, i) => <mesh key={y} name={`Farol_Janela_${i}`} geometry={caixaChanfrada(0.75, 1.25, 0.18, 0.04)} material={vidro} position={[0, y, 3.15 - y * 0.09]} />)}
    <mesh name="Farol_Balcao" material={ferro} position-y={15.0} rotation-x={Math.PI / 2} castShadow><torusGeometry args={[2.5, 0.16, 8, 32]} /></mesh>
    <mesh name="Farol_Lanternim" material={vidro} position-y={16.0} castShadow><cylinderGeometry args={[1.55, 1.55, 2.0, 12]} /></mesh>
    <mesh name="Farol_Cupula" material={vermelho} position-y={17.45} castShadow><coneGeometry args={[1.9, 1.4, 12]} /></mesh>
    <mesh name="Casa_Faroleiro" geometry={caixaChanfrada(9, 3.5, 6, 0.16)} material={pedra} position={[8, 1.75, 2]} castShadow receiveShadow />
    <mesh name="Casa_Telhado" position={[8, 4.15, 2]} rotation-y={Math.PI / 4} scale={[1.1, 1, .72]} material={vermelho} castShadow><coneGeometry args={[5.3, 2.2, 4]} /></mesh>
    <mesh name="Casa_Porta" geometry={caixaChanfrada(1.3, 2.3, 0.16, 0.04)} material={ferro} position={[8, 1.5, 5.05]} />
  </group>;
}
