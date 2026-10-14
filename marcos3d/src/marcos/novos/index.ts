import type { Marco } from "../index";
import { TheatroJoseDeAlencar, ALTURA_ETIQUETA as alturaTheatroJoseDeAlencar } from "./TheatroJoseDeAlencar";
import { PasseioPublico, ALTURA_ETIQUETA as alturaPasseioPublico } from "./PasseioPublico";
import { ForteAssuncao, ALTURA_ETIQUETA as alturaForteAssuncao } from "./ForteAssuncao";
import { DragaoDoMar, ALTURA_ETIQUETA as alturaDragaoDoMar } from "./DragaoDoMar";
import { Estoril, ALTURA_ETIQUETA as alturaEstoril } from "./Estoril";
import { FarolMucuripe, ALTURA_ETIQUETA as alturaFarolMucuripe } from "./FarolMucuripe";
import { PalacioAbolicao, ALTURA_ETIQUETA as alturaPalacioAbolicao } from "./PalacioAbolicao";
import { IracemaMartim, ALTURA_ETIQUETA as alturaIracemaMartim } from "./IracemaMartim";
import { MarcoZero, ALTURA_ETIQUETA as alturaMarcoZero } from "./MarcoZero";
import { ReitoriaUfc, ALTURA_ETIQUETA as alturaReitoriaUfc } from "./ReitoriaUfc";
import { EstadioPv, ALTURA_ETIQUETA as alturaEstadioPv } from "./EstadioPv";
import { IgrejaFatima, ALTURA_ETIQUETA as alturaIgrejaFatima } from "./IgrejaFatima";
import { MosteiroSaoBento, ALTURA_ETIQUETA as alturaMosteiroSaoBento } from "./MosteiroSaoBento";
import { CasaAlencar, ALTURA_ETIQUETA as alturaCasaAlencar } from "./CasaAlencar";
import { MercadoAerolandia, ALTURA_ETIQUETA as alturaMercadoAerolandia } from "./MercadoAerolandia";
import { CentroEventos, ALTURA_ETIQUETA as alturaCentroEventos } from "./CentroEventos";
import { CentroCulturalBomJardim, ALTURA_ETIQUETA as alturaCentroCulturalBomJardim } from "./CentroCulturalBomJardim";

/**
 * Registro dos marcos novos (agente Criador). Cada entrada segue o mesmo contrato de ../index.ts:
 * Modelo em metros, centrado na origem, base em y = 0, norte em −z, pegada de até ~50 m dentro do pedestal
 * de 68 m; a altura da etiqueta vem do ALTURA_ETIQUETA de cada arquivo; `arquivo` é o GLB.
 * Os agentes não editam este registro: só o .tsx do próprio marco.
 */
export const novos: Record<string, Marco> = {
  theatroJoseDeAlencar: { Modelo: TheatroJoseDeAlencar, altura: alturaTheatroJoseDeAlencar, arquivo: "theatro-jose-de-alencar.glb", nome: "Theatro José de Alencar" },
  passeioPublico: { Modelo: PasseioPublico, altura: alturaPasseioPublico, arquivo: "passeio-publico.glb", nome: "Passeio Público (Praça dos Mártires)" },
  forteAssuncao: { Modelo: ForteAssuncao, altura: alturaForteAssuncao, arquivo: "fortaleza-nossa-senhora-da-assuncao.glb", nome: "Fortaleza de Nossa Senhora da Assunção" },
  dragaoDoMar: { Modelo: DragaoDoMar, altura: alturaDragaoDoMar, arquivo: "centro-dragao-do-mar.glb", nome: "Centro Dragão do Mar de Arte e Cultura" },
  estoril: { Modelo: Estoril, altura: alturaEstoril, arquivo: "estoril.glb", nome: "Estoril" },
  farolMucuripe: { Modelo: FarolMucuripe, altura: alturaFarolMucuripe, arquivo: "farol-do-mucuripe.glb", nome: "Farol do Mucuripe (Farol Velho)" },
  palacioAbolicao: { Modelo: PalacioAbolicao, altura: alturaPalacioAbolicao, arquivo: "palacio-da-abolicao.glb", nome: "Palácio da Abolição" },
  iracemaMartim: { Modelo: IracemaMartim, altura: alturaIracemaMartim, arquivo: "iracema-e-martim-mucuripe.glb", nome: "Monumento a Iracema e Martim (Mucuripe)" },
  marcoZero: { Modelo: MarcoZero, altura: alturaMarcoZero, arquivo: "marco-zero-barra-do-ceara.glb", nome: "Marco Zero / Praça de Santiago" },
  reitoriaUfc: { Modelo: ReitoriaUfc, altura: alturaReitoriaUfc, arquivo: "reitoria-ufc.glb", nome: "Reitoria da UFC (antigo palacete Gentil)" },
  estadioPv: { Modelo: EstadioPv, altura: alturaEstadioPv, arquivo: "estadio-presidente-vargas.glb", nome: "Estádio Presidente Vargas" },
  igrejaFatima: { Modelo: IgrejaFatima, altura: alturaIgrejaFatima, arquivo: "igreja-de-fatima.glb", nome: "Igreja (Santuário) de Nossa Senhora de Fátima" },
  mosteiroSaoBento: { Modelo: MosteiroSaoBento, altura: alturaMosteiroSaoBento, arquivo: "mosteiro-de-sao-bento.glb", nome: "Mosteiro de São Bento" },
  casaAlencar: { Modelo: CasaAlencar, altura: alturaCasaAlencar, arquivo: "casa-de-jose-de-alencar.glb", nome: "Casa de José de Alencar" },
  mercadoAerolandia: { Modelo: MercadoAerolandia, altura: alturaMercadoAerolandia, arquivo: "mercado-da-aerolandia.glb", nome: "Mercado da Aerolândia" },
  centroEventos: { Modelo: CentroEventos, altura: alturaCentroEventos, arquivo: "centro-de-eventos-do-ceara.glb", nome: "Centro de Eventos do Ceará" },
  ccbj: { Modelo: CentroCulturalBomJardim, altura: alturaCentroCulturalBomJardim, arquivo: "centro-cultural-bom-jardim.glb", nome: "Centro Cultural Bom Jardim" },
};
