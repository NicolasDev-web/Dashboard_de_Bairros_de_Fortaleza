import type { Fabrica } from "../../Cena";
import { caixaChanfrada } from "../../util/geometria";

/**
 * Centro Cultural Bom Jardim (Granja Lisboa; -3.7859455, -38.6097667). PROVISÓRIO: bloco no lugar do modelo, a ser construído pelo agente Criador.
 * Metros, base em y = 0, norte em −z.
 */
/** Altura da etiqueta com o nome no tour (topo do modelo + ~2 m) */
export const ALTURA_ETIQUETA = 10;

export function CentroCulturalBomJardim({ fab }: { fab: Fabrica }) {
  return <mesh name="Provisorio_Bloco" geometry={caixaChanfrada(20, 8, 14, 0.3)} material={fab.cor("#c9c4b8", 0.9)} castShadow receiveShadow />;
}
