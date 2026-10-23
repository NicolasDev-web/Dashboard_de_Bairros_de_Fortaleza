import type { ComponentType } from "react";
import type { Fabrica } from "../Cena";
import { Aeroporto } from "./Aeroporto";
import { Cambeba } from "./Cambeba";
import { Castelao } from "./Castelao";
import { Centro } from "./Centro";
import { Iguatemi } from "./Iguatemi";
import { Messejana } from "./Messejana";
import { NorthShopping } from "./NorthShopping";
import { PraiaDeIracema, PraiaDoFuturo } from "./Praias";
import { RioMarFortaleza, RioMarKennedy } from "./RioMar";
import { TerminalAntonioBezerra } from "./TerminalAntonioBezerra";
import { Unifor } from "./Unifor";

/**
 * Miniaturas 3D de lugares da cidade. Cada modelo é feito em metros, centrado na origem, com ~50 m de
 * pegada, base em y = 0 e o próprio norte em −z; a cena gira e posiciona. `altura` é onde a etiqueta
 * com o nome fica; `arquivo` é o GLB em dashboard/marcos/.
 */
export interface Marco {
  Modelo: ComponentType<{ fab: Fabrica }>;
  altura: number;
  arquivo: string;
  nome: string;
}

export const marcos: Record<string, Marco> = {
  castelao: { Modelo: Castelao, altura: 12, arquivo: "arena-castelao.glb", nome: "Arena Castelão" },
  aeroporto: { Modelo: Aeroporto, altura: 16, arquivo: "aeroporto-pinto-martins.glb", nome: "Aeroporto Pinto Martins" },
  iguatemi: { Modelo: Iguatemi, altura: 8, arquivo: "shopping-iguatemi.glb", nome: "Shopping Iguatemi Bosque" },
  messejana: { Modelo: Messejana, altura: 14, arquivo: "lagoa-e-centro-de-messejana.glb", nome: "Lagoa e Matriz de Messejana" },
  northShopping: { Modelo: NorthShopping, altura: 13, arquivo: "north-shopping-fortaleza.glb", nome: "North Shopping Fortaleza" },
  riomarFortaleza: { Modelo: RioMarFortaleza, altura: 22, arquivo: "riomar-fortaleza.glb", nome: "RioMar Fortaleza" },
  riomarKennedy: { Modelo: RioMarKennedy, altura: 15, arquivo: "riomar-kennedy.glb", nome: "RioMar Kennedy" },
  unifor: { Modelo: Unifor, altura: 9, arquivo: "unifor.glb", nome: "Unifor" },
  praiaIracema: { Modelo: PraiaDeIracema, altura: 7, arquivo: "praia-de-iracema.glb", nome: "Praia de Iracema" },
  praiaFuturo: { Modelo: PraiaDoFuturo, altura: 6, arquivo: "praia-do-futuro.glb", nome: "Praia do Futuro" },
  centro: { Modelo: Centro, altura: 21, arquivo: "centro-catedral-praca-do-ferreira-mercado.glb", nome: "Catedral, Praça do Ferreira e Mercado" },
  terminalAntonioBezerra: { Modelo: TerminalAntonioBezerra, altura: 5, arquivo: "terminal-antonio-bezerra.glb", nome: "Terminal Antônio Bezerra" },
  cambeba: { Modelo: Cambeba, altura: 7, arquivo: "centro-administrativo-do-cambeba.glb", nome: "Centro Administrativo do Cambeba" },
};
