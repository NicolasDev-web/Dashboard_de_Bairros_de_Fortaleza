import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/** Monumento a Iracema e Martim: conjunto escultórico de bronze voltado ao mar do Mucuripe. */
export const ALTURA_ETIQUETA = 13;

function Figura({ fab, nome, x, z, altura, inclinacao = 0 }: { fab: Fabrica; nome: string; x: number; z: number; altura: number; inclinacao?: number }) {
  const bronze = fab.cor("#526957", 0.72);
  return <group name={nome} position={[x, 1.05, z]} rotation-z={inclinacao}>
    <mesh name={`${nome}_Pernas`} position-y={altura * .22} material={bronze} castShadow><cylinderGeometry args={[.34, .42, altura * .44, 8]} /></mesh>
    <mesh name={`${nome}_Tronco`} position-y={altura * .57} material={bronze} castShadow><cylinderGeometry args={[.48, .37, altura * .52, 8]} /></mesh>
    <mesh name={`${nome}_Cabeca`} position-y={altura * .9} material={bronze} castShadow><sphereGeometry args={[.43, 10, 7]} /></mesh>
  </group>;
}

export function IracemaMartim({ fab }: { fab: Fabrica }) {
  const pedra = fab.cor("#9b8f79", .9), bronze = fab.cor("#526957", .72), areia = fab.cor("#d7c39a", .96);
  return <group rotation-y={-.28}>
    <mesh name="Praca_Areia" geometry={caixaChanfrada(29, .16, 21, .08)} material={areia} position-y={.08} receiveShadow />
    <mesh name="Pedestal_Monumento" geometry={caixaChanfrada(12, 1.7, 7, .35)} material={pedra} position={[0, .85, 0]} castShadow receiveShadow />
    <Figura fab={fab} nome="Iracema" x={-2.2} z={0} altura={5.2} inclinacao={-.08} />
    <Figura fab={fab} nome="Martim" x={.2} z={-.25} altura={5.8} inclinacao={.05} />
    <Figura fab={fab} nome="Moacir" x={2.1} z={.35} altura={3.3} />
    <mesh name="Iracema_Braco_Estendido" position={[-3.15, 4.65, .05]} rotation-z={1.18} material={bronze} castShadow><cylinderGeometry args={[.16, .22, 2.4, 8]} /></mesh>
    <mesh name="Martim_Lanca" position={[1.05, 4.8, -.3]} rotation-z={-.28} material={bronze} castShadow><cylinderGeometry args={[.07, .09, 6.8, 8]} /></mesh>
    <group name="Japi_Cao" position={[3.8, 1.75, .9]}>
      <mesh name="Japi_Corpo" rotation-z={Math.PI / 2} material={bronze} castShadow><cylinderGeometry args={[.35, .45, 1.5, 8]} /></mesh>
      <mesh name="Japi_Cabeca" position={[.9, .25, 0]} material={bronze} castShadow><sphereGeometry args={[.38, 8, 6]} /></mesh>
      {[-.45, .45].map((x) => <mesh key={x} name="Japi_Pata" position={[x, -.6, 0]} material={bronze}><cylinderGeometry args={[.09, .1, .8, 6]} /></mesh>)}
    </group>
    <mesh name="Mar_Referencia" geometry={caixaChanfrada(29, .08, 3.5, .05)} material={fab.agua()} position={[0, .1, -11.4]} receiveShadow />
  </group>;
}
