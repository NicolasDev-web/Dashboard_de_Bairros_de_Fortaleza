import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/**
 * Palácio da Abolição (Meireles; -3.7281783, -38.5038238). PROVISÓRIO: bloco no lugar do modelo, a ser construído pelo agente Criador.
 * Metros, base em y = 0, norte em −z.
 */
/** Altura da etiqueta com o nome no tour (topo do modelo + ~2 m) */
export const ALTURA_ETIQUETA = 10;

export function PalacioAbolicao({ fab }: { fab: Fabrica }) {
  return <mesh name="Provisorio_Bloco" geometry={caixaChanfrada(20, 8, 14, 0.3)} material={fab.cor("#c9c4b8", 0.9)} castShadow receiveShadow />;
}
