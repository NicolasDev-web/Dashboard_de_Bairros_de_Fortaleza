# Pesquisa de bases: trânsito por horário e segurança por bairro

Duas análises novas para o painel, separadas uma da outra:

1. **Trânsito ("Avexado"):** quais rotas ficam mais carregadas e como isso muda ao longo do dia.
2. **Segurança ("Aperreio"):** onde a violência se concentra e que fatores aparecem junto, num tom de reportagem, sem rotular bairro.

Primeira rodada em 01/11/2026, só com busca. A segunda rodada, no mesmo dia, foi com o portal liberado: lemos o catálogo inteiro do **dados.fortaleza.ce.gov.br** pela API (CKAN), baixamos e abrimos as bases de trânsito, e os números abaixo saem desses arquivos.

---

## 1. Trânsito

### Resumo

- **Hora a hora, por via, não existe dado aberto.** A AMC tem esse dado: 200 radares com contagem (`TemContagem = S`) e 1.231 semáforos, 591 deles inteligentes (SCOOT). Mas publica o volume só em **média mensal**.
- **O que existe aberto é bom e já dá conteúdo:** volume mensal por radar, 130 mil sinistros com hora e coordenada, horários dos ônibus que esticam no pico e um dia inteiro de GPS dos ônibus (2015).
- **Para o mapa "rota × horário"**, o caminho é uma **API de rotas com trânsito típico** (Mapbox, HERE ou Google) consultada para uns 30 corredores, hora a hora. Em paralelo, um **pedido pela LAI à AMC** com as contagens horárias dos radares, que seriam a versão 100% oficial.

### O que o portal tem de trânsito (conferido em 01/11/2026)

O catálogo tem 22 conjuntos da AMC e 24 da ETUFOR. Os que servem:

| Conjunto | Arquivo | O que tem de fato | Serve para |
|---|---|---|---|
| **Volume Tráfego Mensal** (AMC) | CSV, 2,4 MB, atualizado em 22/07/2025 | 26.526 linhas, **760 pontos**, **jan/2017 a jun/2025**. Colunas: `Sitio`, `DATA` (mês), `ViaSentido`, `VMD` (veículos/dia, média do mês), `Lon`, `Lat`. Uns 240 pontos ativos por mês em 2025 | **"Por onde passa mais carro"**, por sentido |
| **Fiscalização Eletrônica** (AMC) | GeoJSON, 200 equipamentos | `Sitio`, endereço, `ViaSentido`, `Bairro`, `Regional`, nº de faixas, `TemContagem`, data de ativação | Liga o volume à via e ao bairro. Mostra quais radares contam veículos |
| **Semáforo** (AMC/CTAFOR) | GeoJSON, 1.231 cruzamentos | Cruzamento, modo de controle (SCOOT/centralizado), bairro, regional, botoeiras, motobox | Camada de contexto ("onde o semáforo se ajusta ao trânsito") |
| **Sinistros de Trânsito 2015–2024** (AMC) | GeoJSON, 85 MB | **130.823 sinistros** com dia/mês/ano, **HORA**, via (`LOG1`/`LOG2`), lat/lon, tipo de cruzamento, natureza, severidade, mortos/feridos e veículos (moto, carro, ônibus, bicicleta…) | **"Quando e onde acontecem os sinistros"** |
| **GTFS 03/2026** (ETUFOR) | ZIP | Horários de ônibus. Só fim de semana tem viagens, como já anotado no README | Rede atual |
| **GTFS dia útil 2023/24** (Mobility Database, já usado na etapa 12) | ZIP | Horário de cada viagem | **Tempo programado do ônibus por hora**, um indicador indireto do trânsito |
| **Dados de Mobilidade de Ônibus, 11/03/2015** (ETUFOR) | CSV, 237 MB | GPS de **1.890 ônibus** num dia inteiro: `date_time`, lat/lon, `speed`, `bus_id` (mais paradas e validações) | **Um dia da cidade visto pelos ônibus**: velocidade real por hora e por trecho |
| Binários, Vias 30/40/50, Malha cicloviária, Faixas de ônibus/BRT | GeoJSON/CSV | Intervenções e limites de velocidade | Contexto no mapa |
| Viagens Bicicletar 2014–2025 | CSV por ano | Viagens com origem, destino e horário | Fora do escopo (dá outra análise) |

**Descartados no portal:**
- *Óbitos no trânsito:* DATASUS municipal 2010–2019, sem local nem hora.
- *Chamadas da Polícia:* tem lat/lon, mas é de 2005–2007.
- *Ocorrências da Guarda Municipal:* é uma tabela de eventos (Réveillon, Carnaval), não ocorrências.

### O que já dá para tirar das bases abertas (números conferidos)

**Volume, as vias mais carregadas** (maior ponto de cada via, média jul/2024–jun/2025, veículos por dia e por sentido):

| Via | Veículos/dia | Via | Veículos/dia |
|---|---|---|---|
| Av. Raul Barbosa | 38.048 | Av. José Bastos | 32.460 |
| Av. Aguanambi | 37.751 | Av. Alberto Craveiro | 32.087 |
| Av. Pres. Castelo Branco (Leste-Oeste) | 37.375 | Av. Abolição | 31.006 |
| Av. Farias Brito | 35.837 | Av. Santos Dumont | 30.314 |
| Av. Pres. Costa e Silva (Perimetral) | 34.620 | Av. Bezerra de Menezes | 28.166 |
| Av. Eng. Santana Júnior | 32.482 | | |

Cuidado com a série histórica: o parque de radares foi trocado por volta de 2023 (só 3 pontos têm dado em 2019 e em 2025). Comparar anos só vale com os mesmos pontos, e assim a série firme começa em 2023. O total "da cidade" somado mês a mês engana, porque o número de radares muda.

**Sinistros:**
- Caíram de 16.831 (2015) para 9.230 (2020) e voltaram a 12.743 (2024).
- As mortes caíram de 255 (2015) para **140 (2024)**.
- **58% envolvem moto.**
- Os sinistros se espalham das 7h às 18h. As mortes pesam mais **das 15h às 19h** (cerca de 6% por hora, contra uns 3% de madrugada).
- Vias com mais registros desde 2022: BR-116, Perimetral (Costa e Silva), Washington Soares, Mister Hull, Osório de Paiva, Godofredo Maciel.
- O nome da via vem com grafias diferentes ("Avenida Washington Soares" e "Washington Soares") e precisa ser padronizado.

**Horário programado dos ônibus (GTFS dia útil):**
- Em várias linhas a ETUFOR já põe o pico na tabela. A linha 0032 leva **49 min às 4h, 76 min às 7h e 73 min às 17h**. A 0051 vai de 33 min (4h) a 52 min (7h e 17h).
- Outras linhas têm tempo fixo o dia todo, então só entram as linhas cujo horário varia.

**GPS de 2015:** a velocidade mediana dos ônibus em movimento cai de uns 22–23 km/h no meio da manhã para **18 km/h às 17h**. É um dia só e antigo, mas é dado real e dá um retrato bonito ("um dia de março de 2015").

### Como fazer o mapa "rota × horário"

| Opção | Como funciona | Custo | Termos de uso | Avaliação |
|---|---|---|---|---|
| **Mapbox Directions** (`driving-traffic` + `depart_at`) | Tempo de viagem com trânsito **típico** (histórico) para o horário pedido | 100 mil requisições/mês grátis | Ver se pode guardar e publicar um índice derivado **[conferir]** | **Recomendada para começar:** cota folgada, dá para fazer os 7 dias da semana |
| **HERE Routing v8** (`departureTime`) | Igual: horário no passado ou no futuro usa trânsito histórico | Cota grátis mensal (fonte de terceiros fala em ~250 mil) **[conferir]** | **[conferir]** | Alternativa forte ou validação |
| **Google Routes API** (`TRAFFIC_AWARE`) | Trânsito previsto por horário. Um estudo da ANPET (2026) validou contra os radares em 47 trechos de Fortaleza | ~5 mil chamadas Pro/mês grátis | **Restringe cache e exibição fora do mapa do Google** | Usar só para validar |
| **TomTom Traffic Flow** | Velocidade **atual** por trecho, então precisa coletar a cada hora por semanas | 2.500/dia grátis (preço mudou em 07/2026) | Restritivo | Só se quiser velocidade observada |
| **Pedido pela LAI à AMC** | Contagem e velocidade **por hora** dos 200 radares com contagem (dado que a UFC já usou em dissertações) | Grátis, demora (20 + 10 dias) | Dado público, livre para publicar | **A melhor base. Vale pedir já** |

**Coleta proposta (Mapbox ou HERE):**
- **~30 corredores, nos dois sentidos**, entre pontos conhecidos. Por exemplo: Washington Soares (Iguatemi → Messejana), BR-116 (Aguanambi → Messejana), Bezerra de Menezes, Leste-Oeste, Perimetral, Santos Dumont, Dom Luís, Abolição, Beira-Mar, Mister Hull, Osório de Paiva, Godofredo Maciel, Raul Barbosa, José Bastos, Via Expressa, Sargento Hermínio, Augusto dos Anjos, Alberto Craveiro, Rogaciano Leite, Santana Júnior, Heráclito Graça, Senador Virgílio Távora, Antônio Sales, Barão de Studart, 13 de Maio, João Pessoa, Carapinima, Expedicionários, Frei Cirilo, Juscelino Kubitschek.
- **A cada 30 min, das 5h às 23h, nos 7 dias:** 30 × 2 × 37 × 7 ≈ **15.500 consultas**. Cabe na cota grátis e dá para repetir todo mês.
- **Indicador "fator lentidão"** = tempo com trânsito ÷ tempo com a via livre (madrugada). 1,0 = livre; 2,0 = leva o dobro.
- **Seis viagens do dia a dia** (Messejana → Centro, Parangaba → Aldeota, Conjunto Ceará → Centro, Barra do Ceará → Iguatemi, Papicu → Unifor, Mondubim → Benfica): tempo de porta a porta por horário. Ficam ao lado do tempo de ônibus que o painel já calcula na etapa 12.
- Salvar só o índice agregado por corredor e horário (não as rotas brutas), dentro do que os termos permitirem.

**Pedido pela LAI à AMC** (Fala.BR / Ouvidoria de Fortaleza), texto sugerido: *"Solicito, em formato aberto (CSV), a contagem horária de veículos e a velocidade média horária por equipamento de fiscalização eletrônica com contagem (campo TemContagem = S do conjunto Fiscalização Eletrônica), de janeiro de 2024 até o mês mais recente disponível."*

---

## 2. Segurança

### Resumo

**Não existe base aberta de crime por bairro em Fortaleza.** A SSPDS publica os microdados por município e AIS (10 em Fortaleza). O painel já usa isso na etapa 3. A análise sai por AIS, em taxa por 100 mil, com horário, perfil das vítimas, tendência e fatores de contexto, e com a ressalva clara de que todos os bairros de uma AIS aparecem com a mesma cor. Para o recorte por bairro, pedido pela LAI à SSPDS.

### Bases

| Base | O que tem | Recorte | Uso |
|---|---|---|---|
| **SSPDS: CVLI, dados detalhados** (`CVLI_2009-a-2025.xlsx`, já baixado na etapa 3) | Uma linha por vítima: Município, AIS, Natureza, Data, **Hora**, Dia da semana, Meio empregado, Gênero, Idade, Escolaridade, Raça | AIS, 2009–2025 | Taxa por AIS, mapa de calor hora × dia, perfil das vítimas, armas, série |
| **SSPDS: CVP, roubos** (`CVP_2009-a-2025.xlsx`, já baixado) | Uma linha por ocorrência | AIS, 2009–2025 | Mapa "onde mais se rouba", separado das mortes. Ver se tem hora **[conferir]** |
| **SSPDS: boletins mensais e anuais (PDF)** | Totais, turno, dia da semana | Fortaleza/RMF/interior | Números de manchete: queda de 11% em 2025 e de 62% em 2026 (até junho) |
| **Pedido pela LAI à SSPDS/Supesp** | CVLI e CVP por bairro | Bairro | O ranking por bairro de verdade |
| **Comitê Cearense pela Prevenção de Homicídios na Adolescência** | Relatórios por bairro e território | Bairro | Contexto e citações |
| **Portal de Fortaleza, SDE** (conferido no catálogo) | `idh-fortaleza` (IDH por bairro), `ibeu` (Índice de Bem-Estar Urbano), `infra-urbana-fortaleza`, `rendimentos-e-domicilios-fortaleza`, `estoque-empregos-fortaleza` | Bairro | Fatores de contexto |
| **Portal de Fortaleza, SCSP** | `pontos_iluminacao_publica` (XLSX georreferenciado, 2022) | Ponto → bairro | Fator de contexto: pontos de luz por km de rua |
| **IBGE Censo 2022 e Favelas e Comunidades Urbanas 2022** | Renda, idade, escolaridade, saneamento, favelas | Setor → bairro | Denominador e fatores (já no projeto, etapas 2 e 4) |
| **IPECE: Informe 272** | Renda por bairro com o Censo 2022 | Bairro | Fator atual |

**Descartadas:** Fogo Cruzado (não cobre Fortaleza), SIM/DATASUS (sem bairro), "Chamadas da Polícia" do portal (2005–2007), listas de blogs.

### Como contar sem rotular o bairro

- **Taxa por 100 mil moradores** e média de 3 anos (2023–2025).
- **Mortes e roubos em mapas separados.** O roubo pesa onde há comércio e movimento.
- **Mostrar a tendência:** a queda de 2025 e 2026 é a manchete.
- **Fatores como contexto, não como causa:** "aparecem juntos".
- **Recorte explicado na tela**, sem citar facção.

---

## 3. Proposta de design

O que já está no painel: Geist e Geist Mono, azul cobalto `#2f37c4` sobre papel lilás `#ececf2`, laranja `--perda` `#e8631e` como cor de alerta, pixels como textura. As duas análises entram como páginas próprias, no formato de `morar.html` (`transito.html` e `seguranca.html`), em **rolagem que conta uma história** (scrollytelling): um bloco de texto curto à esquerda e o gráfico fixo à direita, mudando conforme a pessoa rola. No celular, o gráfico vai para cima do texto.

### "Avexado: o trânsito de Fortaleza hora a hora"

1. **Abertura, "o relógio da cidade":** um relógio de 24h em anel, cada fatia pintada pelo fator lentidão médio da cidade. O pico da manhã e o da tarde acendem em laranja. Frase em destaque, por exemplo: "Às 18h, atravessar a cidade leva quase o dobro do tempo das 10h" (o número sai da coleta).
2. **O mapa que respira (peça central):** os ~30 corredores desenhados como linhas grossas sobre o mapa claro, com cor e espessura pelo fator lentidão (cobalto claro = livre, laranja = travado). Embaixo, uma barra de horário de 5h a 23h com botão ▶: as vias "acendem" no pico e "apagam" depois, e o relógio do canto gira junto. Ao lado, o ranking "As 10 mais travadas agora", que se reordena com animação quando o horário muda. Seletor dia útil / sábado / domingo.
3. **"Quanto dura a mesma viagem":** seis cartões, cada um com uma viagem do dia a dia e uma curva do tempo de carro ao longo do dia (e o de ônibus, da etapa 12, tracejado). Exemplo de texto: "Se avexe não: saindo às 9h30, você chega 20 min antes."
4. **"Por onde passa mais carro":** o volume dos radares como círculos proporcionais no mapa, com destaque para Raul Barbosa, Aguanambi e Leste-Oeste (38 mil veículos/dia).
5. **"Quando o trânsito machuca":** mapa de calor hora × dia da semana dos sinistros 2022–2024, com o recorte das motos (58%) e o mapa de pontos críticos. Tom de serviço público, não de alarme.
6. **"O dia em que 1.890 ônibus contaram a cidade"** (bônus): animação com os pontos de GPS de 11/03/2015 andando pelo mapa num dia acelerado, que ficam vermelhos quando a velocidade cai.

### "Aperreio: onde a violência pesa mais"

1. **Abertura com a manchete positiva:** a queda das mortes violentas em 2025–2026 numa linha grande, que se desenha ao rolar.
2. **Mapa por AIS:** taxa por 100 mil, com troca entre mortes e roubos e o aviso fixo "dados por área, não por bairro". Ao passar o mouse, a ficha da AIS com os bairros, a taxa, a tendência e a comparação com a cidade.
3. **"A que horas":** mapa de calor hora × dia da semana dos CVLI.
4. **"Quem são as vítimas":** pictograma de 100 pessoas pintado por faixa etária e gênero (mais forte que barras).
5. **"O que aparece junto":** as 10 AIS lado a lado em colunas (taxa, renda, % de jovens, IDH, iluminação, serviços), ligadas por linhas (coordenadas paralelas). Mostra o padrão sem prometer causa.

---

## 4. Próximos passos

1. **Chave de API:** criar uma conta gratuita na Mapbox (ou na HERE) e passar a chave como variável de ambiente, para rodar a coleta dos corredores. Liberar `api.mapbox.com` (ou `router.hereapi.com`) na rede.
2. **Pedidos pela LAI:** AMC (contagem horária dos radares) e SSPDS (crimes por bairro).
3. **Pipeline:**
   - `14_transito_abertos.py`: volume, sinistros, GTFS por hora e GPS 2015 → `dashboard/transito*.js`.
   - `15_transito_coleta.py`: corredores × horário via API.
   - `16_seguranca_analise.py`: estende a etapa 3 com hora, perfil e fatores.
4. **Protótipo visual** da página de trânsito com os dados abertos já baixados, enquanto a coleta não fica pronta.

## 5. Fontes

- Portal Fortaleza Dados Abertos, API do catálogo: https://dados.fortaleza.ce.gov.br/api/3/action/package_search
- AMC, Volume Tráfego Mensal: https://dados.fortaleza.ce.gov.br/dataset/volume-trafego-mensal
- AMC, Fiscalização Eletrônica: https://dados.fortaleza.ce.gov.br/dataset/fiscalizacao-eletronica
- AMC, Semáforo: https://dados.fortaleza.ce.gov.br/dataset/semaforo
- AMC, Sinistros de Trânsito: https://dados.fortaleza.ce.gov.br/dataset/sinistros-transito
- ETUFOR, GPS/paradas/validação de 11/03/2015: https://dados.fortaleza.ce.gov.br/dataset/dados_mobilidade_onibus_2015_gps_paradas_validacao
- ETUFOR, GTFS 03/2026: https://dados.fortaleza.ce.gov.br/dataset/especificacao-geral-feed-transito-gtfs-010-2025
- GTFS ETUFOR dia útil 2023/24 (Mobility Database): https://storage.googleapis.com/mdb-latest/br-ceara-etufor-gtfs-2011.zip
- SDE, IDH por bairro: https://dados.fortaleza.ce.gov.br/dataset/idh-fortaleza
- SCSP, Iluminação pública: https://dados.fortaleza.ce.gov.br/dataset/pontos_iluminacao_publica
- Variabilidade do volume a partir da fiscalização eletrônica (UFC, 2018): https://repositorio.ufc.br/handle/riufc/72782
- Radares × Google Distance Matrix em Fortaleza (ANPET): https://transportes.anpet.org.br/anpet/article/view/3166
- Mapbox Directions API: https://docs.mapbox.com/api/navigation/directions/
- HERE, tráfego no Routing/Matrix v8: https://docs.here.com/routing/docs/matrix-v8-traffic
- TomTom, preços: https://docs.tomtom.com/pricing
- Google Maps Platform, termos específicos: https://cloud.google.com/terms/maps-platform/eea/maps-service-terms
- TomTom Traffic Index, Fortaleza: https://www.tomtom.com/traffic-index/fortaleza-traffic
- SSPDS, estatísticas: https://www.sspds.ce.gov.br/estatisticas-2-3/
- Colunas da planilha de CVLI: https://github.com/erivandosena/paper-cvli-models-ml-statistic-comparison
- SSPDS, fechamento de 2025: https://www.sspds.ce.gov.br/2026/01/08/ceara-encerra-2025-com-reducao-de-77-nas-mortes-violentas-diminuicao-em-fortaleza-foi-de-11/
- O Povo, queda de 62% nos homicídios em 2026: https://www.opovo.com.br/noticias/seguranca-publica/2026/06/10/fortaleza-tem-queda-de-62-nos-homicidios-em-2026.html
- IPECE, Informe 272: https://www.ipece.ce.gov.br/wp-content/uploads/sites/45/2025/08/ipece_informe_272_05_ago2025.pdf

---

## 6. Raça das vítimas (pesquisa de 01/11/2026)

**O problema na SSPDS.** Na planilha de CVLI, a raça da vítima em Fortaleza vem como "Não Informada" na maior parte dos casos. O preenchimento era de 0 a 2% até 2011, ficou perto de 17 a 20% de 2013 a 2022 e subiu para 30% (2023), 39% (2024) e 38% (2025). Um estudo da UFC (preprint SciELO, 2015–2025) mostra que a divergência entre a SSPDS e a Perícia Forense (PEFOCE) se concentra justamente na cor/raça. Entre os casos de 2023–2025 que têm raça informada (828 de 2.315), 91% das vítimas eram negras (pretas ou pardas).

**A fonte que resolve: SIM/DATASUS.** No Sistema de Informações sobre Mortalidade, a raça vem da declaração de óbito e está quase sempre preenchida. Em 2020, o último ano com arquivo aberto alcançável deste ambiente (`diaad.s3…/sim/Mortalidade_Geral_2020.csv`):
- 1.318 mortes por agressão (CID X85–Y09) ocorridas em Fortaleza, com raça ignorada em só 0,5%;
- 95,8% das vítimas eram negras (95,6% pardas e 0,2% pretas) e 3,7% brancas;
- na mesma conta, a SSPDS tinha raça informada em só 19% dos 1.250 CVLI de 2020.

**A população (Censo 2022, cor ou raça por setor, IBGE).** Fortaleza tem 60,1% de pardos, 7,0% de pretos e 32,7% de brancos, ou seja, 67,1% de negros. Por AIS, os negros vão de 53% (AIS 22 e AIS 08) a 75% (AIS 17). A correlação entre a % de negros da área e a taxa de CVLI nas 10 AIS é de +0,70.

**Taxa por raça (aproximada).** São os óbitos de 2020 sobre a população de 2022: negros 77,6 por 100 mil; não negros 6,1 por 100 mil, cerca de 12 vezes. Duas ressalvas:
- na declaração de óbito, a raça costuma ser atribuída por quem preenche (no Ceará, muitas vezes "parda"), enquanto o Censo é autodeclarado. Isso tende a inflar a razão, e o número de pretos no SIM (0,2%) é baixo demais para ser real;
- 2020 foi ano atípico (motim da PM em fevereiro).

O Atlas da Violência 2026 (dados de 2024) dá para o Ceará uma taxa de homicídio de negros de 34,3 por 100 mil, com alta de 24,3% de 2019 a 2024.

**Para atualizar (2021–2024).** Os arquivos mais novos do SIM estão no FTP do DATASUS (`ftp.datasus.gov.br`, formato .dbc) e no TabNet (`tabnet.datasus.gov.br`). Os dois estão fora da rede deste ambiente: o FTP não passa pelo proxy HTTPS e o TabNet não resolve. Os arquivos do OpenDataSUS no S3 depois de 2020 respondem 403. Caminhos possíveis:
- liberar `tabnet.datasus.gov.br`;
- baixar os .dbc fora daqui e enviar;
- usar a base do SIM na Base dos Dados (BigQuery), com uma credencial do Google Cloud.

Fontes:
- [SIM/OpenDataSUS, estrutura dos dados](https://diaad.s3.sa-east-1.amazonaws.com/sim/Mortalidade_Geral+-+Estrutura.pdf)
- [IBGE, agregados por setor, cor ou raça (2022)](https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios/Agregados_por_Setor_csv/)
- [Preprint UFC sobre homicídios no Ceará](https://preprints.scielo.org/index.php/scielo/preprint/view/17780)
- [O Povo, 58,6% sem raça em 2024](https://mais.opovo.com.br/jornal/cidades/2024/12/01/ce-tem-a-8-maior-taxa-de-negros-mortos-por-arma-de-fogo-no-pais.html)
- [Alma Preta, Atlas da Violência 2026](https://almapreta.com.br/sessao/cotidiano/homicidios-negros-atlas-da-violencia-2026/)
- [Cedeca Ceará](https://cedecaceara.org.br/2025/05/26/atlas-da-violencia-e-o-recorte-do-cedeca-ceara/)
