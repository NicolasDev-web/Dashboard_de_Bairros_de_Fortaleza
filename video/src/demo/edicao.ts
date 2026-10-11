// A edição montada com as marcas da última gravação (marcas.json, escrito por codificar.mjs).
import marcas from "./marcas.json";
import { montar, type Marcas } from "./linha";

const E = montar(marcas as unknown as Marcas);
export const PLANOS = E.planos;
export const LEGENDAS = E.legendas;
export const EFEITOS = E.efeitos;
export const SECAO = E.secoes;
export const DURACAO_DEMO = E.duracao;
