import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/** Centro Dragão do Mar: passarela vermelha, torres brancas, galerias e planetário. */
export const ALTURA_ETIQUETA = 14;

export function DragaoDoMar({ fab }: { fab: Fabrica }) {
  const branco = fab.cor("#e9e6dc", 0.82), vermelho = fab.cor("#b93c2d", 0.62);
  const terracota = fab.cor("#a84c34", 0.78), vidro = fab.cor("#263e52", 0.25);
  const piso = fab.cor("#b8b6ad", 0.94), prata = fab.cor("#aeb8bd", 0.32);
  const caixas = [-1, 1];
  return <group rotation-y={-0.18}>
    <mesh name="Praca_Piso" geometry={caixaChanfrada(48, 0.16, 37, 0.12)} material={piso} position-y={0.08} receiveShadow />
    <mesh name="Galeria_Museu" geometry={caixaChanfrada(19, 4.3, 8, 0.18)} material={branco} position={[-8, 2.15, -10]} castShadow receiveShadow />
    <mesh name="Galeria_Cinema" geometry={caixaChanfrada(17, 4.8, 9, 0.18)} material={branco} position={[10, 2.4, 10]} castShadow receiveShadow />
    <mesh name="Galeria_Telhado_Oeste" geometry={caixaChanfrada(20, 0.35, 9, 0.08)} material={terracota} position={[-8, 4.55, -10]} castShadow />
    <mesh name="Galeria_Telhado_Leste" geometry={caixaChanfrada(18, 0.35, 10, 0.08)} material={terracota} position={[10, 5.0, 10]} castShadow />
    {caixas.map((lado) => <group key={lado} position={[lado * 11.5, 0, 0]}>
      <mesh name={`Torre_${lado < 0 ? "Oeste" : "Leste"}`} geometry={caixaChanfrada(3.4, 10.5, 3.4, 0.16)} material={branco} position-y={5.25} castShadow receiveShadow />
      <mesh name={`Torre_Coroamento_${lado}`} material={terracota} position-y={11.25} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[2.5, 2, 4]} /></mesh>
      <mesh name={`Torre_Vidro_${lado}`} geometry={caixaChanfrada(2.5, 3, 0.16, 0.04)} material={vidro} position={[0, 6.2, lado < 0 ? 1.73 : -1.73]} />
    </group>)}
    <mesh name="Passarela_Piso" geometry={caixaChanfrada(23, 0.55, 2.6, 0.08)} material={vermelho} position={[0, 8.0, 0]} castShadow />
    {[-1.35, 1.35].map((z) => <group key={z} position-z={z}>
      <mesh name={`Passarela_Guarda_${z}`} geometry={caixaChanfrada(23, 0.18, 0.15, 0.03)} material={vermelho} position-y={9.45} castShadow />
      {[-8, -4, 0, 4, 8].map((x, i) => <mesh key={x} name={`Passarela_Trelica_${z}_${i}`} geometry={caixaChanfrada(5.2, 0.16, 0.12, 0.03)} material={vermelho} position={[x, 8.75, 0]} rotation-z={(i % 2 ? 1 : -1) * 0.48} castShadow />)}
    </group>)}
    <mesh name="Planetario_Tambor" position={[-15, 1.7, 10]} material={branco} castShadow><cylinderGeometry args={[4.2, 4.2, 3.4, 24]} /></mesh>
    <mesh name="Planetario_Cupula" position={[-15, 3.4, 10]} material={prata} castShadow><sphereGeometry args={[4.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
    <mesh name="Anfiteatro" position={[15, 0.5, -9]} rotation-x={-Math.PI / 2} material={vermelho} receiveShadow><ringGeometry args={[4, 8, 24, 4, 0, Math.PI]} /></mesh>
  </group>;
}
