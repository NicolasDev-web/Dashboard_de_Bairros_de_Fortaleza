# Graph Report - .  (2026-10-05)

## Corpus Check
- Large corpus: 85 files · ~752,303 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 607 nodes · 984 edges · 61 communities (56 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Filme e cenas Remotion
- Dependências do vídeo
- Recomendação Onde Morar
- Dashboard interativo
- Rotas de transporte público
- Assets e áudio do filme
- Pixels e trajetos
- Preços imobiliários
- Rotas do Strava
- Configuração TypeScript
- Preços por regionais
- Agregação censitária
- Ingestão do Censo IBGE
- Equipamentos OpenStreetMap
- Hero mobile
- Mapa mobile
- Segurança pública
- Rotas de pedal
- Evolução dos bairros
- Visão e documentação do produto
- Índice composto
- Metodologia dos indicadores
- Visão integral do dashboard
- Estrutura do painel
- Pesos personalizados
- Rotas de corrida
- Detalhe da Beira-Mar
- Fotos de imóveis
- Mapa de segurança
- Mapa de evolução
- Camada de praças
- Malha de bairros
- Secretarias regionais
- Dados de praças
- Tela do mapa do índice
- Detalhe do bairro
- Saneamento por bairro
- Índice com rotas
- Questionário Onde Morar
- Dicionário do Censo 2022
- Exportação de dados
- Hero do dashboard
- Resumo da cidade
- Renda no Censo 2010
- Renda no Censo 2022
- Limitações das rotas
- Filme de lançamento
- Setor e bairro censitário
- Hierarquia censitária
- Dados públicos reproduzíveis
- Prévia de frames

## God Nodes (most connected - your core abstractions)
1. `main()` - 18 edges
2. `trilha()` - 14 edges
3. `clamp` - 14 edges
4. `compilerOptions` - 13 edges
5. `render()` - 12 edges
6. `tempo()` - 12 edges
7. `EASE` - 11 edges
8. `brilho()` - 9 edges
9. `construirTrajeto()` - 9 edges
10. `atualizar()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Renda do responsável pelo domicílio` --conceptually_related_to--> `Índice de bairros`  [INFERRED]
  graphify-out/converted/dicionario_renda_2022_2964bb29.md → README.md
- `Pilha geoespacial Python` --conceptually_related_to--> `Pipeline de dados`  [INFERRED]
  requirements.txt → README.md
- `passos()` --indirect_call--> `alvo()`  [INFERRED]
  dashboard/trajeto.js → dashboard/pixels.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Eixos do índice de bairros** — readme_indice_de_bairros, graphify_out_converted_dicionario_renda_2022_2964bb29_renda_do_responsavel, dashboard_index_metodologia_dos_indicadores [EXTRACTED 1.00]
- **Fluxo de recomendação Onde morar** — dashboard_morar_questionario_de_preferencias, dashboard_morar_estimativa_de_orcamento, dashboard_morar_notas_multicriterio, dashboard_morar_compatibilidade_residencial [EXTRACTED 1.00]
- **Exploração dos bairros** — dashboard_index_mapa_coropletico, dashboard_index_ranking_de_bairros, dashboard_index_evolucao_2010_2022, dashboard_index_precos_por_regional [EXTRACTED 1.00]
- **Exploração interativa do índice** — video_public_telas_03_mapa_indice_mapa_coropletico, video_public_telas_03_mapa_indice_pesos_ajustaveis, video_public_telas_03_mapa_indice_ranking_de_bairros, video_public_telas_03_mapa_indice_filtros_de_indicador [EXTRACTED 1.00]
- **Detalhe contextual do Meireles** — video_public_telas_04_mapa_meireles_meireles_selecionado, video_public_telas_04_mapa_meireles_perfil_multidimensional, video_public_telas_04_mapa_meireles_primeiro_no_indice, video_public_telas_04_mapa_meireles_evolucao_do_meireles [EXTRACTED 1.00]
- **Composição do indicador de segurança** — video_public_telas_08_seguranca_indicador_seguranca_ais, video_public_telas_08_seguranca_cvli_por_habitante, video_public_telas_08_seguranca_roubos_por_habitante [EXTRACTED 1.00]
- **Composição do índice ponderado** — video_public_telas_10_pesos_peso_renda, video_public_telas_10_pesos_peso_saneamento, video_public_telas_10_pesos_peso_seguranca, video_public_telas_10_pesos_indice_pesos_customizados [EXTRACTED 1.00]
- **Rotas populares estimadas pelo Strava** — video_public_telas_11_rotas_corrida_avenida_beira_mar, video_public_telas_11_rotas_corrida_avenida_godofredo_maciel, video_public_telas_11_rotas_corrida_avenida_washington_soares, video_public_telas_11_rotas_corrida_estimativa_rotas_extensao_maxima [EXTRACTED 1.00]
- **Bairros atendidos pela rota Avenida Beira Mar** — video_public_telas_12_rota_beiramar_avenida_beira_mar, video_public_telas_12_rota_beiramar_meireles, video_public_telas_12_rota_beiramar_mucuripe, video_public_telas_12_rota_beiramar_praia_de_iracema [EXTRACTED 1.00]
- **Featured Cycling Corridors** — video_public_telas_13_rotas_pedal_washington_soares_avenue, video_public_telas_13_rotas_pedal_santos_dumont_road, video_public_telas_13_rotas_pedal_godofredo_maciel_avenue [EXTRACTED 1.00]
- **Leading Neighborhood Gains** — video_public_telas_14_evolucao_parque_iracema, video_public_telas_14_evolucao_guararapes, video_public_telas_14_evolucao_pedras [EXTRACTED 1.00]
- **Leading Neighborhood Declines** — video_public_telas_14_evolucao_mucuripe, video_public_telas_14_evolucao_meireles, video_public_telas_14_evolucao_de_lourdes [EXTRACTED 1.00]
- **Composite Index Dimensions** — video_public_telas_15_metodo_income_metric, video_public_telas_15_metodo_sanitation_metric, video_public_telas_15_metodo_security_metric, video_public_telas_15_metodo_composite_neighborhood_index [EXTRACTED 1.00]
- **Primary Public Data Sources** — video_public_telas_15_metodo_ibge_census_2010_2022, video_public_telas_15_metodo_sspds_ceara, video_public_telas_15_metodo_fortaleza_neighborhood_boundaries, video_public_telas_15_metodo_strava_global_heatmap [EXTRACTED 1.00]
- **Dashboard Reading Flow** — video_public_telas_16_pagina_inteira_where_to_live_in_fortaleza, video_public_telas_16_pagina_inteira_city_change_narrative, video_public_telas_16_pagina_inteira_interactive_neighborhood_map, video_public_telas_16_pagina_inteira_neighborhood_evolution_2010_2022, video_public_telas_16_pagina_inteira_data_methodology [EXTRACTED 1.00]
- **Neighborhood Index Dimensions** — video_public_telas_17_celular_hero_income, video_public_telas_17_celular_hero_sanitation, video_public_telas_17_celular_hero_security, video_public_telas_17_celular_hero_composite_neighborhood_index [EXTRACTED 1.00]
- **Adjustable Index Weights** — video_public_telas_18_celular_mapa_income_weight, video_public_telas_18_celular_mapa_sanitation_weight, video_public_telas_18_celular_mapa_security_weight, video_public_telas_18_celular_mapa_axis_weight_controls [EXTRACTED 1.00]

## Communities (61 total, 5 thin omitted)

### Community 0 - "Filme e cenas Remotion"
Cohesion: 0.09
Nodes (43): Abertura(), Encerramento(), Bairro, DADOS, Evolucao(), FOCO_FICHA, FOCO_MAPA, Indice() (+35 more)

### Community 1 - "Dependências do vídeo"
Cohesion: 0.05
Nodes (43): eslint, prettier, react, react-dom, remotion, @remotion/bundler, @remotion/cli, @remotion/eslint-config-flat (+35 more)

### Community 2 - "Recomendação Onde Morar"
Cohesion: 0.13
Nodes (40): ajusteTrajeto(), atualizarNav(), avancar(), avisos(), brilho(), card(), construir(), construirOpcoes() (+32 more)

### Community 3 - "Dashboard interativo"
Cohesion: 0.10
Nodes (31): animarTraco(), atualizar(), bairroEm(), cor(), dentro(), desenharCidade(), desenharRotas(), dominio() (+23 more)

### Community 4 - "Rotas de transporte público"
Cohesion: 0.13
Nodes (33): date, baixar(), compactar_rotas(), da_tabela(), deslocar_calendario(), dia_referencia(), gravar(), ler_gtfs() (+25 more)

### Community 5 - "Assets e áudio do filme"
Cohesion: 0.20
Nodes (23): baixo(), bumbo(), chimbal(), clique(), colocar(), efeitos(), env(), impacto() (+15 more)

### Community 6 - "Pixels e trajetos"
Cohesion: 0.15
Nodes (20): alvo(), bairroEm(), dentro(), desenhar(), focar(), iniciar(), laco(), montar() (+12 more)

### Community 7 - "Preços imobiliários"
Cohesion: 0.19
Nodes (22): achar_priceradar(), atribuir(), carregar_priceradar(), classe_quartos(), coletar(), exportar(), juntar(), ler_historico() (+14 more)

### Community 8 - "Rotas do Strava"
Cohesion: 0.20
Nodes (18): ndarray, amostrar(), calor_trechos(), geo_js(), lonlat_px(), main(), mosaico(), nome_curto() (+10 more)

### Community 9 - "Configuração TypeScript"
Cohesion: 0.12
Nodes (16): es2015, remotion.config.ts, compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, jsx, lib, module (+8 more)

### Community 10 - "Preços por regionais"
Cohesion: 0.30
Nodes (12): atualizar(), detalhe(), dominio(), estilo(), focar(), legenda(), lista(), onEachFeature() (+4 more)

### Community 11 - "Agregação censitária"
Cohesion: 0.27
Nodes (14): indicadores_2010(), indicadores_2022(), main(), pct(), pesos_setor_bairro(), DataFrame, GeoDataFrame, Series (+6 more)

### Community 12 - "Ingestão do Censo IBGE"
Cohesion: 0.29
Nodes (13): baixar(), censo_2010(), censo_2022(), ler_csv_zip(), main(), malhas(), num(), DataFrame (+5 more)

### Community 13 - "Equipamentos OpenStreetMap"
Cohesion: 0.29
Nodes (11): alcance_dos_bairros(), baixar(), calcular_notas(), contar(), main(), percentil(), DataFrame, GeoDataFrame (+3 more)

### Community 14 - "Hero mobile"
Cohesion: 0.20
Nodes (10): 121 Neighborhoods, Two Censuses, Three Security Years, Composite Neighborhood Index, Explore the Map Action, Income, Mobile Dashboard Hero, Pixelated Fortaleza Index Map, Sanitation, Security (+2 more)

### Community 15 - "Mapa mobile"
Cohesion: 0.20
Nodes (10): Index Axis Weight Controls, Equal Weights Reset, Income Weight, Index Range 20 to 83, Leaflet Map, Mobile Neighborhood Map, Neighborhood Index Choropleth, No Neighborhood Selected State (+2 more)

### Community 16 - "Segurança pública"
Cohesion: 0.39
Nodes (8): bairro_ais(), baixar(), eventos_fortaleza(), main(), DataFrame, Path, Etapa 3 — Segurança pública (SSPDS/Supesp) por AIS de Fortaleza.  Fonte: planilh, slug()

### Community 17 - "Rotas de pedal"
Cohesion: 0.22
Nodes (9): Cycling Routes Dashboard, Equal Axis Weights, Avenida Godofredo Maciel, Meireles, Most Used Cycling Routes, Neighborhood Index, Rodovia Santos Dumont, Strava Global Heatmap (+1 more)

### Community 18 - "Evolução dos bairros"
Cohesion: 0.22
Nodes (9): De Lourdes, Guararapes, Income and Sanitation Change, Inflation-adjusted 2010 Income, Meireles, Mucuripe, Neighborhood Evolution Chart 2010–2022, Parque Iracema (+1 more)

### Community 19 - "Visão e documentação do produto"
Cohesion: 0.25
Nodes (8): Renda do responsável pelo domicílio, Bairros de Fortaleza, Índice de bairros, Onde morar, Pipeline de dados, Preço do m² com PriceRadar, Tempo e rotas de transporte público, Pilha geoespacial Python

### Community 20 - "Índice composto"
Cohesion: 0.39
Nodes (7): cvli_ponderado(), fator_ipca(), main(), minmax(), Series, Etapa 5 — Normalização, índice composto e variação 2010 → 2022.  Escalas (0–10, CVLI por 100 mil de cada AIS, média 2019–2025 com peso crescente (população de 2

### Community 21 - "Metodologia dos indicadores"
Cohesion: 0.29
Nodes (8): Census Sector to Neighborhood Aggregation, Composite Neighborhood Index, Fortaleza Neighborhood Boundaries, IBGE Censuses 2010 and 2022, Income Metric, Sanitation Metric, Security Metric, SSPDS Ceará

### Community 22 - "Visão integral do dashboard"
Cohesion: 0.25
Nodes (8): Fortaleza Change Narrative 2010–2022, Citywide Summary Metrics, Data Methodology, Full Neighborhood Dashboard Page, Interactive Neighborhood Map, Neighborhood Evolution 2010–2022, Neighborhood Ranking, Where to Live in Fortaleza

### Community 23 - "Estrutura do painel"
Cohesion: 0.29
Nodes (7): Evolução dos bairros entre 2010 e 2022, Mapa coroplético dos bairros, Metodologia dos indicadores, Painel de bairros, Planejador de trajeto por transporte público, Preços do m² por regional, Ranking de bairros

### Community 24 - "Pesos personalizados"
Cohesion: 0.29
Nodes (7): Índice com pesos customizados, Meireles com índice 78, Peso de renda, Peso de saneamento, Peso de segurança, Ranking pelo índice ponderado, Voltar aos pesos iguais

### Community 25 - "Rotas de corrida"
Cohesion: 0.29
Nodes (7): Avenida Beira Mar, Avenida Godofredo Maciel, Avenida Washington Soares, Estimativa de rotas por trechos no nível máximo de uso, Linhas claras indicam ruas com maior uso, Mapa de rotas de corrida mais feitas, Strava Global Heatmap

### Community 26 - "Detalhe da Beira-Mar"
Cohesion: 0.29
Nodes (7): Avenida Beira Mar, Detalhe da rota Avenida Beira Mar, Extensão de 8,6 km, Meireles, Mucuripe, Praia de Iracema, Strava Global Heatmap

### Community 27 - "Fotos de imóveis"
Cohesion: 0.60
Nodes (5): ascii_name(), extension(), image_urls(), main(), request()

### Community 28 - "Mapa de segurança"
Cohesion: 0.33
Nodes (6): CVLI por habitante, Indicador de segurança da AIS, Mapa de segurança de Fortaleza, Meireles, Ranking de segurança das AIS, Roubos por habitante

### Community 29 - "Mapa de evolução"
Cohesion: 0.33
Nodes (6): Escala perdeu, estável e ganhou muito, Mapa de evolução dos bairros de Fortaleza, Meireles, Mudança em renda e saneamento de 2010 a 2022, Parque Iracema, Ranking de evolução dos bairros

### Community 31 - "Malha de bairros"
Cohesion: 0.50
Nodes (4): main(), Etapa 1 — Malha de bairros de Fortaleza (Seuma, mai/2025).  Baixa o KMZ oficia, Chave de junção: sem acento, minúscula, espaços simples., slug()

### Community 32 - "Secretarias regionais"
Cohesion: 0.50
Nodes (4): main(), Etapa 8 — Regionais de Fortaleza: bairro -> Secretaria Regional.  Desde jan/20, Mesma chave de junção da etapa 1., slug()

### Community 33 - "Dados de praças"
Cohesion: 0.50
Nodes (4): limpar_nome(), main(), Etapa 11 — Praças e espaços públicos cadastrados (URBIFOR, 2019), por bairro., (nome para exibir, tem denominação oficial). "Praça da Rua X (sem denominação

### Community 34 - "Tela do mapa do índice"
Cohesion: 0.40
Nodes (5): Filtros de indicador, ano e rotas, Mapa coroplético do índice por bairro, Pesos ajustáveis de renda, saneamento e segurança, Ranking pesquisável de bairros, Tela do mapa do índice

### Community 35 - "Detalhe do bairro"
Cohesion: 0.40
Nodes (5): Evolução de renda e esgoto do Meireles desde 2010, Meireles selecionado no mapa, Perfil de renda, saneamento e segurança do Meireles, Meireles em primeiro no índice, Tela de detalhe do Meireles

### Community 36 - "Saneamento por bairro"
Cohesion: 0.50
Nodes (5): Domicílios com esgoto em rede em 2022, Mapa de saneamento dos bairros de Fortaleza, Meireles, Perfil do bairro Meireles, Ranking de saneamento dos bairros

### Community 37 - "Índice com rotas"
Cohesion: 0.50
Nodes (5): Calor do Strava desativado, Índice dos bairros de 0 a 100, Mapa do índice com rotas de corrida, Rotas numeradas no mapa, Sobreposição de rotas de corrida

### Community 38 - "Questionário Onde Morar"
Cohesion: 0.50
Nodes (4): Compatibilidade residencial, Estimativa de orçamento imobiliário, Notas multicritério dos bairros, Questionário de preferências residenciais

### Community 39 - "Dicionário do Censo 2022"
Cohesion: 0.50
Nodes (4): Dicionário de variáveis do Censo 2022, Variáveis domiciliares e demográficas, Variáveis de povos indígenas, Variáveis de pessoas quilombolas

### Community 40 - "Exportação de dados"
Cohesion: 0.67
Nodes (3): main(), nome_bonito(), Etapa 6 — Exporta os dados do dashboard.  Gera dashboard/data.js (window.DADOS

### Community 41 - "Hero do dashboard"
Cohesion: 0.50
Nodes (4): Mapa de Fortaleza em pixels, Índice de renda, saneamento e segurança, Navegação para mapa, evolução e ranking, Tela hero Bairros de Fortaleza

### Community 42 - "Resumo da cidade"
Cohesion: 0.67
Nodes (4): Expansão da rede de esgoto entre 2010 e 2022, Métricas agregadas da cidade, Queda da renda real em 73 de 121 bairros, Tela de resumo dos indicadores

### Community 43 - "Renda no Censo 2010"
Cohesion: 0.50
Nodes (4): Mapa da renda média de 2010 corrigida para reais de 2022, Renda do Meireles em 2010, Ranking de renda dos bairros em 2010, Tela do mapa de renda de 2010

### Community 44 - "Renda no Censo 2022"
Cohesion: 0.50
Nodes (4): Mapa da renda média de 2022, Renda do Meireles em 2022, Ranking de renda dos bairros em 2022, Tela do mapa de renda de 2022

### Community 45 - "Limitações das rotas"
Cohesion: 0.50
Nodes (4): Methodological Limitations, OpenStreetMap Roads, Popular Routes Estimation, Strava Global Heatmap

### Community 46 - "Filme de lançamento"
Cohesion: 0.50
Nodes (4): Cidade em pixels, Dados públicos como proposta de valor, Filme de lançamento Bairros de Fortaleza, Storyboard de lançamento

## Knowledge Gaps
- **147 isolated node(s):** `name`, `version`, `description`, `repository`, `license` (+142 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `name`, `version`, `description` to the rest of the system?**
  _147 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Filme e cenas Remotion` be split into smaller, more focused modules?**
  _Cohesion score 0.09114183307731695 - nodes in this community are weakly interconnected._
- **Should `Dependências do vídeo` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._
- **Should `Recomendação Onde Morar` be split into smaller, more focused modules?**
  _Cohesion score 0.13240418118466898 - nodes in this community are weakly interconnected._
- **Should `Dashboard interativo` be split into smaller, more focused modules?**
  _Cohesion score 0.10099573257467995 - nodes in this community are weakly interconnected._
- **Should `Rotas de transporte público` be split into smaller, more focused modules?**
  _Cohesion score 0.1265597147950089 - nodes in this community are weakly interconnected._
- **Should `Configuração TypeScript` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._