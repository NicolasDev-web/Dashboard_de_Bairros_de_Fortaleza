import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/** Palacete Estoril: casarão amarelo de dois pisos, varanda e cobertura cerâmica. */
export const ALTURA_ETIQUETA = 12;

export function Estoril({ fab }: { fab: Fabrica }) {
  const amarelo = fab.cor("#d8aa61", 0.84), claro = fab.cor("#f1dfb3", 0.86);
  const telha = fab.cor("#9d4932", 0.78), azul = fab.cor("#32687a", 0.46), madeira = fab.cor("#6b4934", 0.76);
  const janelas = [-5, -2.5, 0, 2.5, 5];
  return <group rotation-y={-0.26}>
    <mesh name="Terreno_Estoril" geometry={caixaChanfrada(30, 0.14, 25, 0.1)} material={fab.cor("#c9bc9f", 0.95)} position-y={0.07} receiveShadow />
    <mesh name="Casa_Terreo" geometry={caixaChanfrada(15, 4.2, 10, 0.18)} material={amarelo} position-y={2.1} castShadow receiveShadow />
    <mesh name="Casa_Pavimento_Superior" geometry={caixaChanfrada(12.5, 3.8, 8.3, 0.16)} material={claro} position={[0, 6.1, 0]} castShadow receiveShadow />
    <mesh name="Casa_Telhado" position={[0, 9.1, 0]} rotation-y={Math.PI / 4} scale={[1.25, 1, 0.85]} material={telha} castShadow><coneGeometry args={[7.2, 3, 4]} /></mesh>
    <mesh name="Varanda_Laje" geometry={caixaChanfrada(17, 0.32, 3, 0.08)} material={claro} position={[0, 4.5, 5.3]} castShadow />
    <mesh name="Varanda_Guarda_Corpo" geometry={caixaChanfrada(16.2, 0.75, 0.18, 0.04)} material={madeira} position={[0, 5.05, 6.55]} castShadow />
    {janelas.map((x, i) => <group key={x}>
      <mesh name={`Janela_Terreo_${i}`} geometry={caixaChanfrada(1.2, 2, 0.18, 0.04)} material={azul} position={[x, 2.2, 5.05]} />
      {Math.abs(x) < 5 && <mesh name={`Janela_Superior_${i}`} geometry={caixaChanfrada(1.15, 1.7, 0.18, 0.04)} material={azul} position={[x, 6.4, 4.18]} />}
      <mesh name={`Varanda_Coluna_${i}`} position={[x, 2.25, 6.35]} material={claro} castShadow><cylinderGeometry args={[0.18, 0.22, 4.5, 8]} /></mesh>
    </group>)}
    <mesh name="Escada_Entrada" geometry={caixaChanfrada(5, 0.6, 2.4, 0.08)} material={fab.cor("#b7a88e", 0.95)} position={[0, 0.3, 6]} receiveShadow />
  </group>;
}
