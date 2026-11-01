# Pesquisa de bases: segurança por bairro e trânsito por horário

Levantamento feito em 01/11/2026 para duas análises novas do painel, separadas uma da outra:

1. **Segurança:** onde a violência se concentra em Fortaleza e que fatores aparecem junto, num tom de reportagem, sem rotular bairro.
2. **Trânsito:** quais rotas ficam mais carregadas e como isso muda ao longo do dia.

> Os portais oficiais (dados.fortaleza.ce.gov.br, ce.gov.br/sspds, sspds.ce.gov.br) não abriram no ambiente da pesquisa, por causa da rede. O que está abaixo vem de buscas, das páginas dos conjuntos indexadas, de trabalhos acadêmicos e de repositórios que já baixaram esses dados. Os pontos marcados **[conferir]** precisam ser abertos no portal antes de entrar no pipeline.

---

## 1. Segurança

### Resumo

**Não existe base aberta de crimes por bairro em Fortaleza.** A SSPDS publica os microdados com município e AIS (Área Integrada de Segurança). Fortaleza tem 10 AIS, cada uma com 6 a 19 bairros. O painel já usa esses dados na etapa 3 (`scripts/03_seguranca.py`), e todo bairro de uma AIS recebe o mesmo valor.

Na prática, um ranking honesto de "bairros mais perigosos" só sai com dados que a SSPDS não publica. Dá para contar a história bem com o que existe: por AIS, em taxa por 100 mil moradores, com horário, perfil das vítimas, tendência e fatores de contexto. E dá para pedir o recorte por bairro pela Lei de Acesso à Informação.

### Bases

| Base | O que tem | Recorte | Uso na análise | Situação |
|---|---|---|---|---|
| **SSPDS: CVLI, dados detalhados** (`CVLI_2009-a-2025.xlsx`) | Uma linha por vítima: Município, AIS, Natureza, Data, **Hora**, Dia da semana, Meio empregado (arma), Gênero, Idade, Escolaridade, Raça. Aba de intervenção policial à parte | AIS, 2009–2025 | Taxa por AIS, mapa de calor hora × dia da semana, perfil das vítimas, armas, série histórica | Já é baixada pela etapa 3 |
| **SSPDS: CVP (roubos), dados detalhados** (`CVP_2009-a-2025.xlsx`) | Uma linha por ocorrência, com município, AIS e data | AIS, 2009–2025 | "Onde mais se rouba" (separado das mortes) | Já é baixada pela etapa 3. Ver se tem hora e tipo de roubo **[conferir]** |
| **SSPDS: furtos** | Aparece nos boletins mensais (CVLI, CVP e furto) | Município/região | Talvez um terceiro indicador | Ver se existe planilha detalhada **[conferir]** |
| **SSPDS: boletins mensais e anuais (PDF)** | Totais, turno, dia da semana | Estado, Fortaleza, RMF, interior | Números de manchete (ex.: a queda de 2025 e 2026) | Aberto |
| **Pedido pela LAI à SSPDS/Supesp** (Ceará Transparente) | CVLI e CVP por **bairro** do fato | Bairro | O ranking por bairro de verdade | Pedido a fazer. Em 2023 a SSPDS disse que estudava publicar por bairro |
| **Comitê Cearense pela Prevenção de Homicídios na Adolescência** ("Cada Vida Importa", ALECE + Unicef) | Relatórios com homicídios de adolescentes por bairro e território | Bairro, anos específicos | Contexto e citações (ex.: 44% das mortes em 17 bairros) | Relatórios em PDF |
| **IBGE Censo 2022** | População, renda, faixa etária, escolaridade, saneamento | Setor → bairro | Denominador da taxa e fatores de contexto | Já está no projeto (etapas 2 e 4) |
| **IBGE: Favelas e Comunidades Urbanas 2022** | Área e população em favelas | Setor → bairro | Fator de contexto (precariedade urbana) | Aberto |
| **IDH por bairro (SDE Fortaleza)** | IDH-B com renda, longevidade e alfabetização | Bairro, Censo 2010 | Fator de contexto, com o aviso de que é de 2010 | Aberto (PDF/tabela) |
| **IPECE: Informe 272 (ago/2025)** | Desigualdade de renda por bairro com o Censo 2022 | Bairro | Fator de contexto atual | Aberto |
| **OpenStreetMap / equipamentos** | Escolas, saúde, lazer, praças | Bairro | Fator de contexto (oferta de serviços) | Já está no projeto (etapas 10 e 11) |

**Descartadas:**
- *Fogo Cruzado:* só cobre Rio, Recife, Salvador e Belém.
- *SIM/DATASUS:* tem município de residência, sem bairro.
- *Listas de "bairros mais perigosos" de blogs:* não dizem de onde vêm os números.

### Como contar sem rotular o bairro

- **Taxa por 100 mil moradores**, nunca só o número absoluto. AIS grande tem mais casos só porque tem mais gente.
- **Média de 3 anos** (2023–2025), porque CVLI por AIS é número pequeno e oscila. A etapa 3 já calcula.
- **Mortes e roubos em mapas separados.** Os dois se concentram em lugares diferentes: o roubo pesa onde há comércio e movimento, como o Centro e a Aldeota.
- **Tendência:** mostrar se a área está melhorando. Fortaleza teve queda forte em 2025 e 2026.
- **Fatores como contexto, não como causa.** Mostrar lado a lado (renda, jovens de 15 a 29 anos, escolaridade, favela, serviços) e dizer "aparecem juntos", não "causam".
- **Deixar claro o recorte:** "os dados oficiais são por área (AIS), e todos os bairros de uma área aparecem com a mesma cor".
- Não citar facção nem território de grupo. Não há base aberta para isso, e foge do tom do projeto.

### Gráficos possíveis

1. Mapa por AIS com a taxa de CVLI por 100 mil (média 2023–2025), com troca para roubos.
2. Mapa de calor hora × dia da semana dos CVLI de Fortaleza (campos `Hora` e `Dia da Semana`).
3. Linha 2009–2025(26) por AIS: a área está melhorando ou piorando?
4. Quem são as vítimas: faixa etária, gênero e raça, em barras simples.
5. "O que aparece junto": dispersão da taxa de CVLI contra renda ou contra % de jovens, um ponto por AIS (são só 10 pontos, então mostrar como comparação e não como modelo estatístico).

---

## 2. Trânsito

### Resumo

**Não há base aberta de congestionamento por horário em Fortaleza.** A AMC tem os dados (sensores dos radares e semáforos do CTAFOR, com leitura de placa desde 2013), mas publica o volume em **média mensal**. Para ver "rota × horário", o caminho mais viável é coletar tempos de viagem numa API de mapas (Google ou TomTom) para um conjunto fixo de corredores, hora a hora, e completar com as bases abertas da AMC.

### Bases

| Base | O que tem | Resolução no tempo | Uso na análise | Situação |
|---|---|---|---|---|
| **Google Routes API** (trânsito previsto por horário de saída) | Tempo de viagem com trânsito entre dois pontos, para qualquer horário | Hora a hora (dia útil, sábado, domingo) | **Mapa principal:** corredores coloridos pela lentidão, com um controle de horário | Pago, com cota grátis mensal (por volta de 5 mil chamadas Pro) **[conferir]**. Um estudo da ANPET de 2026 comparou com os radares em 47 trechos de Fortaleza |
| **TomTom Traffic Flow API** | Velocidade atual × velocidade livre por trecho | Tempo real (precisa coletar por semanas) | Alternativa ou validação do Google com velocidade observada | Grátis até cerca de 2.500 chamadas/dia. Preço muda desde 01/07/2026 **[conferir]** |
| **TomTom Traffic Index: Fortaleza** | Congestionamento da cidade por hora e dia da semana. 121 h perdidas no pico em 2025 | Hora × dia da semana | Abertura da seção: "a cidade hora a hora" | Aberto para consulta e citação |
| **AMC: Volume Tráfego Mensal** (dados.fortaleza) | Média mensal de veículos por equipamento de fiscalização, desde jan/2017 | Mensal | "Por onde passa mais carro", e a série com a pandemia | Aberto. Ver formato e última atualização **[conferir]** |
| **AMC: Fiscalização Eletrônica** (GeoJSON) | Posição de cada radar, com o campo `temcontagem` | – | Pôr o volume no mapa | Aberto |
| **AMC: Sinistros de Trânsito 2015–2024** (GeoJSON, ~81 MB) | ~130 mil sinistros com data, **hora**, bairro, rua, lat/lon, severidade, mortos/feridos e tipo de veículo | Ocorrência | Complemento opcional: "onde e a que horas acontecem os acidentes" | Aberto |
| **AMC: Vias 30/40/50** | Limite de velocidade por via | – | Contexto | Aberto |
| **GTFS da ETUFOR** (já no projeto) | Horários programados dos ônibus | Por viagem | Cruzamento grátis: velocidade programada do ônibus por faixa horária nos corredores (a ETUFOR já embute o pico na tabela) | Já baixado (etapas 12 e 13) |
| **GPS dos ônibus (ETUFOR)** | Posição da frota | Contínua | Velocidade real do ônibus por hora e corredor | Usado em pesquisas da UFC, sem conjunto aberto encontrado. Pedido pela LAI |
| **Dados horários dos radares (AMC)** | Contagem e velocidade por equipamento | 15 min / hora | A melhor base, toda oficial | Usada em dissertações da UFC (Barroso, 2018). Pedido pela LAI à AMC |

**Descartadas:**
- *Uber Movement:* encerrado em 2023.
- *Waze for Cities:* exige parceria com a Prefeitura, e não achei parceria ativa em Fortaleza.

### Atenção aos termos de uso

Google e TomTom limitam guardar e republicar o que as APIs devolvem. O Google, por exemplo, restringe cache e exibição fora do mapa do Google. Antes de publicar, ver se um índice agregado e derivado (ex.: "lentidão relativa por hora, por corredor") cabe nos termos. Se não couber, o caminho todo oficial é o pedido pela LAI dos dados horários dos radares à AMC.

### Desenho proposto da coleta

- **Uns 30 corredores** com nome conhecido: Av. Bezerra de Menezes, Washington Soares, Santos Dumont, Aguanambi/BR-116, Augusto dos Anjos, Leste-Oeste, Beira-Mar, Dom Luís, Mister Hull, Osório de Paiva, Perimetral, Via Expressa, Abolição, José Bastos, Godofredo Maciel, Raul Barbosa, Sargento Hermínio etc. Os dois sentidos.
- **24 horários × 2 tipos de dia** (útil e sábado): 30 × 2 × 24 × 2 = **2.880 chamadas**, dentro da cota grátis.
- **Indicador:** tempo com trânsito ÷ tempo sem trânsito (1,0 = livre; 2,0 = leva o dobro). Fácil de explicar: "na Washington Soares às 18h você leva o dobro do tempo".
- **Página:** mapa com os corredores coloridos e um controle de horário (6h, 7h... 22h), mais um gráfico "as 10 rotas mais travadas neste horário".

---

## 3. Domínios para liberar no ambiente

Para baixar as bases neste ambiente na nuvem, liberar na configuração de rede: `dados.fortaleza.ce.gov.br`, `www.ce.gov.br`, `www.sspds.ce.gov.br`, `mapas.fortaleza.ce.gov.br` e, para a coleta de trânsito, `routes.googleapis.com` e/ou `api.tomtom.com`.

## 4. Fontes

- SSPDS, estatísticas e indicadores: https://www.sspds.ce.gov.br/estatisticas-2-3/ e https://www.ce.gov.br/sspds/estatisticas/dados-detalhados/
- Colunas da planilha de CVLI (repositório que usou 2009–2023): https://github.com/erivandosena/paper-cvli-models-ml-statistic-comparison
- SSPDS, fechamento de 2025: https://www.sspds.ce.gov.br/2026/01/08/ceara-encerra-2025-com-reducao-de-77-nas-mortes-violentas-diminuicao-em-fortaleza-foi-de-11/
- Diário do Nordeste, como os dados de segurança são divulgados no Ceará (falta de recorte por bairro): https://diariodonordeste.verdesmares.com.br/seguranca/entenda-como-os-dados-de-seguranca-sao-captados-e-divulgados-no-ceara-estado-e-referencia-no-brasil-1.3423787
- O Povo, queda de 62% nos homicídios em 2026: https://www.opovo.com.br/noticias/seguranca-publica/2026/06/10/fortaleza-tem-queda-de-62-nos-homicidios-em-2026.html
- Concentração de homicídios de adolescentes por bairro: https://periodicos.ufc.br/psicologiaufc/article/view/19313/30926 e https://ihu.unisinos.br/categorias/568453-o-raio-x-das-mortes-na-capital-mais-perigosa-do-brasil-para-adolescentes
- IPECE, Informe 272: https://www.ipece.ce.gov.br/wp-content/uploads/sites/45/2025/08/ipece_informe_272_05_ago2025.pdf
- IDH por bairro: https://diariodonordeste.verdesmares.com.br/ceara/proporcao-de-pessoas-pretas-e-maior-nos-bairros-de-fortaleza-com-menor-idh-veja-dados-por-local-1.3589524
- Fogo Cruzado, cobertura: https://github.com/voltdatalab/crossfire
- AMC, Sinistros de Trânsito: https://dados.fortaleza.ce.gov.br/dataset/sinistros-transito
- Colunas da base de sinistros tratada: https://github.com/AnadyCdeMesquita/Projeto_Sinistros-de-Transito-na-Cidade-de-Fortaleza-2015-2024- e https://github.com/jotap53/eda_sinistros_de_transito_fortaleza
- AMC, Volume Tráfego Mensal: https://dados.fortaleza.ce.gov.br/dataset/activity/volume-trafego-mensal
- AMC, Fiscalização Eletrônica: https://dados.fortaleza.ce.gov.br/dataset/fiscalizacao-eletronica e https://mapas.fortaleza.ce.gov.br/mapa/538/equipamentos-de-fiscalizacao-eletronica
- AMC, organização no portal: https://dados.fortaleza.ce.gov.br/organization/amc
- AMC, Plano de Dados Abertos 2023–2025: https://dados.fortaleza.ce.gov.br/dataset/e5bdf7d4-5837-41b5-ae2a-5bb346e45c99/resource/e71919d1-43d6-473f-a685-211114a56385/download/plano-de-dados-abertos-amc-2023-2025_2.0.pdf
- Variabilidade do volume a partir da fiscalização eletrônica (UFC, 2018): https://repositorio.ufc.br/handle/riufc/72782
- Radares × Google Distance Matrix em Fortaleza (ANPET): https://transportes.anpet.org.br/anpet/article/view/3166
- GPS dos ônibus em pesquisas: https://repositorio.ufc.br/handle/riufc/34835 e https://doaj.org/article/8e7dee4364ad4243804b1f246bfa4b4b
- TomTom Traffic Index, Fortaleza: https://www.tomtom.com/traffic-index/fortaleza-traffic
- TomTom, preços: https://docs.tomtom.com/pricing
- Google Maps Platform, preços: https://developers.google.com/maps/billing-and-pricing/pricing
