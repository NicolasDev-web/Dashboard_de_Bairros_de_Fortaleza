import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/** Mosteiro de São Bento: conjunto monástico em torno do pátio, igreja e campanário. */
export const ALTURA_ETIQUETA = 18;

export function MosteiroSaoBento({ fab }: { fab: Fabrica }) {
  const creme = fab.cor("#e5d5b7", .9), telha = fab.cor("#9f4c32", .82), madeira = fab.cor("#5e4937", .78), jardim = fab.cor("#59804c", .94);
  const alas = [
    { n: "Norte", p: [0, 3.2, -11] as [number, number, number], s: [28, 6.4, 6] as [number, number, number] },
    { n: "Leste", p: [11, 3.2, 0] as [number, number, number], s: [6, 6.4, 22] as [number, number, number] },
    { n: "Oeste", p: [-11, 3.2, 0] as [number, number, number], s: [6, 6.4, 22] as [number, number, number] },
  ];
  return <group rotation-y={.12}>
    <mesh name="Terreno_Mosteiro" geometry={caixaChanfrada(38, .16, 35, .1)} material={jardim} position-y={.08} receiveShadow />
    {alas.map((a) => <group key={a.n}>
      <mesh name={`Ala_${a.n}`} geometry={caixaChanfrada(a.s[0], a.s[1], a.s[2], .16)} material={creme} position={a.p} castShadow receiveShadow />
      <mesh name={`Telhado_${a.n}`} geometry={caixaChanfrada(a.s[0] + 1, .7, a.s[2] + 1, .1)} material={telha} position={[a.p[0], 6.75, a.p[2]]} castShadow />
    </group>)}
    <mesh name="Igreja" geometry={caixaChanfrada(11, 9.5, 18, .2)} material={creme} position={[0, 4.75, 7]} castShadow />
    <mesh name="Telhado_Igreja" position={[0, 11, 7]} rotation-y={Math.PI / 4} scale={[.9, 1, 1.35]} material={telha} castShadow><coneGeometry args={[6.8, 3.4, 4]} /></mesh>
    <mesh name="Campanario" geometry={caixaChanfrada(5.1, 13.8, 4.8, .18)} material={creme} position={[-7.4, 6.9, 9]} castShadow />
    <mesh name="Campanario_Cobertura" position={[-7.4, 15, 9]} rotation-y={Math.PI / 4} material={telha} castShadow><coneGeometry args={[3.4, 2.6, 4]} /></mesh>
    <mesh name="Porta_Igreja" geometry={caixaChanfrada(2.5, 4.1, .18, .05)} material={madeira} position={[0, 2.1, 16.05]} />
    {[-7, -3.5, 0, 3.5, 7].map((x, i) => <mesh key={x} name={`Arcada_Claustro_${i}`} position={[x, 3.1, -7.92]} material={madeira}><boxGeometry args={[1.5, 2.5, .16]} /></mesh>)}
    <mesh name="Patio_Claustro" geometry={caixaChanfrada(14, .12, 11, .08)} material={fab.cor("#c5b38e", .96)} position={[0, .18, -1]} receiveShadow />
    <mesh name="Cruz_Haste" geometry={caixaChanfrada(.34, 2.8, .3, .04)} material={madeira} position={[-7.4, 17.3, 9]} />
    <mesh name="Cruz_Braco" geometry={caixaChanfrada(1.8, .32, .3, .04)} material={madeira} position={[-7.4, 17.7, 9]} />
  </group>;
}
