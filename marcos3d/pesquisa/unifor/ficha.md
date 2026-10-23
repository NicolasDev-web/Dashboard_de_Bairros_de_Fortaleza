# Ficha de pesquisa — Unifor (Universidade de Fortaleza)

Marco `unifor` → `src/marcos/Unifor.tsx` (+ peças do Blender em `blender/`). Centro usado no tour: lat −3,7687, lng −38,4777
(Av. Washington Soares, 1321, Edson Queiroz).

## Limitação desta sessão (importante)
- O proxy desta sessão **recusou** `api.openstreetmap.org`, `overpass-api.de`, `pt.wikipedia.org`, `en.wikipedia.org`,
  `upload.wikimedia.org` e `unifor.br` (CONNECT 403; o WebFetch também falhou por DNS). Só o **WebSearch** funcionou.
- Por isso **não há fotos de referência** (`ref-N.jpg`) nem um OSM novo nesta pasta. A planta usada é a que a sessão anterior
  extraiu da API 0.6 do OSM e deixou registrada nas constantes do `Unifor.tsx` antigo (contorno do campus, contornos da
  Reitoria e da Biblioteca, centros e rumos dos blocos, do Centro de Convivência, do Bloco M, do ginásio, da pista, do
  estacionamento solar e do lago), em metros reais (x = leste, y = norte, origem no centro do campus, ~[30, 10] do ponto do tour).
- Tudo o que vem abaixo está marcado como **[confirmado]** (com fonte), **[OSM anterior]** (planta herdada) ou **[dúvida]**
  (não achei; foi simplificado de forma neutra).

## O que é
- Universidade privada mantida pela Fundação Edson Queiroz, aula inaugural em 21/03/1973. **[confirmado]**
  (https://unifor.br/web/50-anos/-/ja-ouviu-a-historia-dos-50-anos-da-unifor ; https://en.wikipedia.org/wiki/University_of_Fortaleza)
- Campus de 490 mil a 720 mil m² conforme a fonte (o portfólio de 2024 diz ~630 mil m²). **[confirmado, números divergentes]**
  (https://unifor.br/en/web/50-anos/-/a-natureza-como-parte-da-aprendizagem ; https://unifor.br/documents/d/guest/unifor_portfolio_2024)

## Planta e rumo [OSM anterior]
- Campus de ~1 km leste–oeste por ~0,55 km norte–sul. A **Av. Washington Soares corre na borda oeste**, quase norte–sul
  (~6° de inclinação). A Av. Valmir Pontes fica no lado leste/sul (Acesso 4, perto do ginásio). **[confirmado: acessos]**
  (https://unifor.br/-/acesso-4-do-campus-unifor-esta-liberado-para-entrada-de-veiculos-de-alunos-veja-os-horarios)
- Ordem de oeste para leste: **Reitoria** (encostada na Washington Soares, x ≈ −403) → **Biblioteca Central** (x ≈ −309) →
  **Centro de Convivência** (x ≈ −195, contorno redondo de ~54 m) → **Bloco M** (x ≈ −81) → **estacionamento solar**
  (x ≈ 113, y ≈ 114, ~158 × 147 m) → **ginásio** (x ≈ 67, y ≈ −106) → **estádio de atletismo** (x ≈ 270, oval de ~121 × 191 m,
  eixo norte–sul) → **lago** no nordeste (x ≈ 312, y ≈ 294, ~284 × 115 m, eixo a 107°).
- Os blocos de aula seguem uma malha girada: eixos a **65° e 155°** de azimute (≈ 25° fora do norte).
- Conversão: x = Δlng·cos(lat)·111320; z = −Δlat·110540 (norte em −z).

## Elementos que identificam a Unifor
| Elemento | O que se sabe | Fonte |
|---|---|---|
| Reitoria | Prédio na frente da Washington Soares; o portão "em frente à Reitoria" recebe quem vem pela **passarela sobre a Washington Soares**. O 2º andar abriga o **Espaço Cultural Unifor** (~1.200 m², 1988, patrimônio turístico de Fortaleza desde 2016). | https://unifor.br/-/novo-acesso-ao-campus-da-unifor-entra-em-funcionamento-a-partir-de-22-de-abril ; https://unifor.br/espaco-cultural ; https://unifor.br/-/fortaleza-298-anos-espaco-cultural-unifor-e-marco-historico-da-cidade |
| Praça Central | A **Biblioteca Central** e o **Centro de Convivência ("CC")** ficam na praça central. O CC tem térreo e piso superior/mezanino (restaurante, lanchonetes, farmácia, gráfica, livraria, Central de Carreiras). | https://unifor.br/-/coluna-newslink-biblioteca-central-da-unifor-disponibiliza-mais-de-300-mil-obras ; https://unifor.br/-/coluna-newslink-unifor-oferece-espaco-de-interacao-e-convivio-durante-os-intervalos ; https://unifor.br/-/unifor-inaugura-novo-espaco-da-central-de-carreiras-e-egressos |
| Blocos de aula | Identificados por **letras (A a Z)** e, desde 2022, por **"bairros" de cores** na sinalização: amarelo (A–E, NAMI), azul (N, P, Q, R, S), laranja (F, L, O, Academia, DAD, DAE), rosa (Z e Complexo Desportivo), roxo (I, J, K, M e CC), verde (Reitoria, Biblioteca, H). | https://unifor.br/-/qual-e-a-cor-do-seu-bairro-preferido-no-campus ; https://unifor.br/-/universidade-de-fortaleza-chega-de-cara-nova-para-o-semestre-2022.2 ; https://unifor.br/-/campus-da-universidade-de-fortaleza-recebe-nova-sinalizacao |
| Estacionamento solar | Usina sobre o **estacionamento coberto perto do Bloco M**: 5.580 painéis, ~22 mil m², 2,1 MWp, 735 vagas sombreadas, ligada em 2021 ("2º maior estacionamento solar do país"). | https://unifor.br/-/unifor-instala-em-seu-campus-o-2-maior-estacionamento-solar-do-pais ; https://unifor.br/-/cobertura-vegetal-e-usina-solar-representam-compromisso-com-a-sustentabilidade |
| Parque Desportivo | **Estádio de atletismo** (pista IAAF classe 2 + campo de futebol oficial, arquibancada para ~1.000 pessoas, inaugurado em 2005); **Ginásio Poliesportivo** (3 quadras, 850 lugares); **piscina semiolímpica** 25 × 20 m, 8 raias; quadras de tênis, campo society, arena de areia. | https://unifor.br/esporte/parque-desportivo ; https://diariodonordeste.verdesmares.com.br/jogada/estadio-de-atletismo-da-unifor-e-uma-referencia-1.119371 |
| Mata e jardins | Campus "com cara de parque", vegetação densa protegida, jardins com espécies nativas, **palmeiras imperiais**, um baobá de mais de 40 anos, um pau-brasil plantado pelo fundador, **esculturas entre as árvores**. | https://unifor.br/en/web/50-anos/-/a-natureza-como-parte-da-aprendizagem ; https://unifor.br/-/campus-aberto-apos-dois-anos-unifor-recebe-publico-aos-sabados |
| Lagoa | Lagoa com muitas plantas aquáticas, gansos, patos e marrecos. | https://unifor.br/en/web/50-anos/-/a-natureza-como-parte-da-aprendizagem ; https://diariodonordeste.verdesmares.com.br/metro/campus-da-unifor-oferece-ao-publico-espaco-de-convivencia-1.1308916 |
| Teatro Celina Queiroz | No Bloco T, ~300 lugares, de 2003. | https://unifor.br/teatro-celina-queiroz/apresentacao |
| Complexo Cultural Yolanda e Edson Queiroz | Em obras ao lado do campus, no terreno do antigo Centro de Convenções (projeto de Luiz Deusdará): museu (1ª etapa, abre em 12/11/2026), teatro e torres de ensino (19 andares) nas etapas seguintes. | https://diariodonordeste.verdesmares.com.br/ceara/complexo-cultural-yolanda-e-edson-queiroz-inaugura-primeira-etapa-em-novembro-1.3794106 ; https://nossomeio.com.br/complexo-cultural-yolanda-e-edson-queiroz-vai-reunir-museu-teatro-e-torre-educacional-em-fortaleza/ |

## Materiais e cores
- **[dúvida]** Não achei descrição textual das fachadas (a busca não devolve imagens e as fotos do Commons estavam bloqueadas).
  Decisão neutra: prédios em **reboco branco-gelo** com **fitas de vidro escuro**, **brises verticais de concreto claro**,
  lajes/platibandas cinza-claro, cobertura técnica cinza. É o que a modelagem anterior também assumia.
- **[confirmado]** As cores dos "bairros" (amarelo, azul, laranja, rosa, roxo, verde) entram como **faixas/totens de sinalização**
  com a letra do bloco, que é o detalhe colorido real e recente.
- **[confirmado]** Painéis solares azul-escuros sobre estrutura metálica; pista de atletismo vermelha (padrão IAAF) com campo de grama.
- **[OSM anterior / herdado]** O "UNIFOR" pintado no telhado do Bloco M e a abóbada do ginásio vieram da sessão anterior
  (provavelmente do satélite); não consegui reconfirmar. Mantive a abóbada do ginásio (forma neutra para um ginásio) e
  **não** pintei o letreiro no telhado.

## Dúvidas abertas
1. Aparência real das fachadas (Reitoria, Biblioteca, CC, blocos): cores, material, número de pavimentos. Simplificado.
2. Forma da cobertura do Centro de Convivência (a sessão anterior fez uma cúpula; não achei fonte). Fiz cobertura baixa
   com lanternim central, sem afirmar cúpula.
3. Posição exata da lagoa (a sessão anterior a pôs fora da cerca, no nordeste).
4. O Complexo Cultural ficou de fora (obra; aparência das torres desconhecida e fora do campus).

## Composição escolhida (ver relatório)
Recorte "corredor central" condensado de oeste para leste, com escalas diferentes por papel:
Washington Soares + passarela → Reitoria → Praça Central (Biblioteca + CC) → blocos de aula → estacionamento solar +
Bloco M → ginásio → estádio de atletismo; lagoa no nordeste; a mata preenche o resto.
