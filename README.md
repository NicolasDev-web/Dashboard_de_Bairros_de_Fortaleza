# Bairros de Fortaleza

Dashboard que compara os 121 bairros de Fortaleza por renda, saneamento e segurança, com a evolução entre os Censos de 2010 e 2022, e o preço do m² dos imóveis em cada uma das 12 regionais, coletado com o [PriceRadar](https://github.com/NicolasDev-web/priceradar).

**Ver o dashboard:** abra `dashboard/index.html` no navegador (precisa de internet para a fonte, o Leaflet e a camada do Strava).

**Onde morar:** `dashboard/morar.html` é uma página à parte com um questionário de 9 perguntas (renda, entrada e quartos, e o peso de segurança, saúde, lazer, infraestrutura, mobilidade, escolas, comércio e ritmo do bairro). A cidade em pixels acende conforme as respostas e, no fim, o mapa e a lista mostram os bairros mais compatíveis dentro do orçamento. O resultado fica no endereço da página, então dá para compartilhar o link.

**O que falta:** [PENDENCIAS.md](PENDENCIAS.md) lista o que ficou de fora, com o motivo e o passo a passo de cada item.

## Requisitos

- **Python 3.12 ou mais novo** para o pipeline (`requirements.txt`).
- **Java 21** só para a etapa 12, que usa o motor R5 ([Adoptium](https://adoptium.net); no Linux, `apt install openjdk-21-jre-headless`).
- **Node 20 ou mais novo** só para os testes (`tests/`) e o vídeo (`video/`).
- O painel em si não precisa de nada: é HTML estático, abre direto do disco ou de qualquer hospedagem (a Vercel publica a pasta `dashboard/`).

## Pipeline de dados

```sh
python -m venv .venv
# ative o ambiente: no Windows (PowerShell) .venv\Scripts\Activate.ps1; no Linux/macOS source .venv/bin/activate
python -m pip install -r requirements.txt

python scripts/01_malha_bairros.py    # malha Seuma (KMZ) -> data/geo/bairros_fortaleza.geojson
python scripts/02_ibge.py             # Censos 2010/2022 por setor -> data/raw/ibge_*.csv
python scripts/03_seguranca.py        # SSPDS por AIS -> data/raw/seguranca_ais.csv, bairro_ais.csv
python scripts/04_join_bairros.py     # setor -> bairro -> data/processed/bairros_indicadores.csv
python scripts/05_indice.py           # notas 0-100 e índice -> data/processed/bairros_indice.csv
python scripts/06_dados_dashboard.py  # -> dashboard/data.js
python scripts/07_rotas_strava.py     # rotas de corrida e pedal (heatmap Strava + OSM) -> dashboard/rotas.js
python scripts/08_regionais.py        # bairro -> regional (Decreto 14.899/2020) -> data/raw/bairro_regional.csv
python scripts/09_precos_priceradar.py  # preço do m² por regional com o PriceRadar -> dashboard/precos.js
python scripts/10_equipamentos_osm.py   # saúde, lazer, mobilidade, escolas e comércio (OpenStreetMap) -> dashboard/equipamentos.js
                                                       #   --das-contagens refaz só as notas, sem baixar
python scripts/11_pracas.py             # praças da URBIFOR (2019) por bairro -> dashboard/pracas.js
python scripts/12_transporte.py         # tempo e rotas de ônibus/metrô -> dashboard/transporte*.js
python scripts/13_linhas_bairros.py     # linhas por bairro e paradas (rede atual) -> dashboard/linhas*.js, paradas.js
```

A etapa 6 lê a saída da 8: se mexer nas regionais, rode a 8 e depois a 6.

## Preço do m² por regional (PriceRadar)

A etapa 9 usa o PriceRadar para coletar anúncios de venda de apartamentos em Fortaleza, põe cada um num bairro oficial (pela coordenada do portal ou pelo nome do bairro) e resume por regional e por bairro, com mediana, média e quartis do preço por m², também por número de quartos.

```sh
# o PriceRadar clonado ao lado deste repositório (../priceradar), com o venv dele ou estas dependências:
python -m pip install -r ../priceradar/priceradar/backend/requirements.txt

python scripts/09_precos_priceradar.py                    # coleta nova (6 faixas de preço + reforço por bairro)
python scripts/09_precos_priceradar.py --fonte historico  # usa as buscas já gravadas no priceradar.db (90 dias)
python scripts/09_precos_priceradar.py --fonte csv        # só reagrega a última coleta
python scripts/09_precos_priceradar.py --priceradar /outro/caminho/priceradar
```

## Tempo e rotas de ônibus (etapa 12)

Calcula, com o r5py (o motor R5, o mesmo do projeto Acesso a Oportunidades do IPEA), o tempo de porta a porta por transporte público de cada bairro até os outros 120 e até 12 polos (Centro, Beira-Mar, Aldeota, Papicu, Iguatemi, Unifor, Centro de Eventos, Parangaba, Messejana, UFC Benfica, UFC Pici, Aeroporto), num dia útil com saída entre 6h30 e 8h. Até os polos sai também o passo a passo: até 3 opções de linhas, onde subir e descer. Cada bairro sai do centro ponderado pela população, levado para a rua residencial mais próxima, com até 20 min a pé até a parada e até 3 conduções.

**Qual GTFS.** O GTFS da ETUFOR publicado no portal da Prefeitura em 2026 traz só as viagens de sábado e domingo (o serviço de dia útil aparece no `calendar.txt`, sem viagens). A tabela publicada usa o GTFS da ETUFOR de 10/11/2023 a 10/02/2024 e o do Metrofor de 2024, os mais recentes com dia útil, guardados no [Mobility Database](https://mobilitydatabase.org). Com um GTFS sem viagens de dia útil o script cai sozinho para o sábado, e a página ajusta o texto. Comparando os 16 mil pares, a tabela publicada dá em média 2 min a mais que a de sábado de 2026 (80% dos pares entre −3 e +8 min), parte disso pelos limites de caminhada e de conduções acrescentados junto.

```sh
# precisa de Java 21 (veja Requisitos); o r5py e o osmium já vêm no requirements.txt

# a tabela publicada (GTFS com dia útil, do Mobility Database, + os metropolitanos da ARCE):
curl -L -o data/cache/transporte/etufor_2023.zip https://storage.googleapis.com/mdb-latest/br-ceara-etufor-gtfs-2011.zip
curl -L -o data/cache/transporte/metrofor_2024.zip https://storage.googleapis.com/mobilitydata-datasets-prod/mdb-2010/latest.zip
# data/cache/transporte/arce_2025.zip: GTFS da ARCE (GTFS_Arce_01082025.zip, ônibus metropolitanos)
python scripts/12_transporte.py --gtfs data/cache/transporte/etufor_2023.zip data/cache/transporte/metrofor_2024.zip \
    data/cache/transporte/arce_2025.zip --deslocar-calendario arce   # ~2h

python scripts/12_transporte.py                 # padrão: ETUFOR 2023/24 (Mobility Database) + Metrofor atual, com o
                                                              #   calendário do Metrofor movido para 2023 (--deslocar-calendario)
python scripts/12_transporte.py --sem-rotas     # só os tempos (poucos minutos)
python scripts/12_transporte.py --da-tabela     # refaz transporte.js da última tabela, sem Java
python scripts/12_transporte.py --memoria 4G    # limita a memória da JVM do R5 (padrão 6G)
```

O nome de cada arquivo passado em `--gtfs` precisa começar por `etufor_` ou `metrofor_`. Sem `--gtfs`, o Metrofor baixado (vigência 2026-27) não cruza com a ETUFOR de 2023/24, e o script move as datas dele em semanas inteiras para a vigência da ETUFOR (os horários continuam os do arquivo; o deslocamento fica em `transporte_meta.json`). A tabela publicada usa o Metrofor de 2024, que já cruza com a ETUFOR, sem deslocar nada. Se o link do Metrofor mudar, baixe em https://www.ce.gov.br/metrofor/gtfs/ e passe com `--gtfs` (sem ele, só ônibus). As ruas vêm do Overpass e ficam em `data/cache/transporte/fortaleza_ruas.osm.pbf`; se o Overpass não responder, passe outro `.osm.pbf` com `--osm`. Se o cálculo das rotas parar no meio, `--continuar` pula os bairros que já têm arquivo em `dashboard/transporte/`. As rotas passo a passo entre quaisquer dois bairros ficam atrás de `--rotas-entre-bairros`, porque levam horas. Para conferir a ordem de grandeza, `data/processed/transporte_validacao.csv` tem 12 trajetos com o tempo calculado e o link do Google Maps em modo transporte público, com colunas em branco para anotar o tempo de lá. É tempo de tabela: o resultado não considera trânsito e tende a ser otimista no pico.

## Linhas por bairro e paradas (etapa 13)

O tempo e a rota da etapa 12 precisam de horário de dia útil, e o GTFS de dia útil mais recente da ETUFOR é de 2023/24. Já "quais linhas param aqui" não depende de horário, então a etapa 13 usa a rede mais atual: o GTFS da ETUFOR de 03/2026 (Mobility Database, `mdb-2934`), o da ARCE (ônibus metropolitanos, 08/2025) e o do Metrofor. As 40 linhas da ETUFOR que estão no GTFS de 2026 sem nenhuma viagem (as que só rodam em dia útil) entram com as paradas e o traçado de 2023/24.

Para cada bairro, saem as linhas com parada dentro dele ou a até 300 m da divisa; para cada polo, as linhas a até 800 m. A ficha do bairro mostra essas linhas e as desenha no mapa; o "Quanto tempo de ônibus" mostra as linhas que passam perto da saída e depois do destino, no sentido da viagem (dá para ir sem baldeação; `linhas_sentido.js` guarda, para cada padrão de viagem, a primeira e a última parada em cada bairro e polo); a camada "Linhas de ônibus" desenha a rede inteira, com as 7.407 paradas a partir do zoom 15 e as linhas de cada uma; e os cards do "Onde morar" dizem quantas linhas passam no bairro.

```sh
# em data/cache/transporte/: etufor_2026.zip (mdb-2934), arce_2025.zip, metrofor_2025.zip e etufor_2023.zip (complemento)
python scripts/13_linhas_bairros.py
```

## Testes

`tests/navegador.mjs` abre o painel e o "Onde morar" direto do disco com o Playwright e confere o que costuma quebrar quando os dados ou o JS mudam:
- o painel abre sem erro de JS, também no celular;
- a ficha do bairro mostra e desenha as linhas;
- a camada de linhas liga, as paradas aparecem no zoom e o clique numa parada mostra as linhas;
- Bom Jardim → Centro e Canindezinho → Centro têm passo a passo;
- as linhas diretas respeitam o sentido da viagem;
- o "Onde morar" monta os cards com o tempo de ônibus.

```sh
cd tests
npm ci
npx playwright install chromium   # só na primeira vez
npm test                          # SAIDA=capturas npm test grava também as capturas de tela
```

O GitHub Actions (`.github/workflows/testes.yml`) roda isso, mais a checagem de sintaxe dos scripts e do JS, em cada PR e em cada push na main.

## Onde morar: o que cada arquivo alimenta

A página funciona só com `data.js`. `precos.js` (etapa 9) troca a estimativa de orçamento pela comparação com o preço mediano dos anúncios; sem ele, o orçamento usa a renda dos moradores do bairro como aproximação. `equipamentos.js` (etapa 10) liga as perguntas de saúde, mobilidade, escolas e comércio e completa o lazer; sem ele, essas perguntas aparecem desligadas com o aviso. As constantes do financiamento (30% da renda, 360 meses, 10,5% ao ano) ficam no topo de `dashboard/morar.js`.

A coleta usa o `.env` do PriceRadar e precisa de uma rede de onde os portais respondam (a mesma em que o app funciona). Enquanto `dashboard/precos.js` não existir, a seção "Preços" mostra só as regionais e como gerar os números. Anúncios com bairro que não foi reconhecido aparecem no fim da saída do script: acrescente o apelido em `APELIDOS` no próprio script.

Os downloads brutos (~330 MB) ficam em `data/cache/`, fora do git; os scripts baixam de novo se faltarem.

## Fontes

| Dado | Fonte |
|---|---|
| Limites dos bairros | Prefeitura de Fortaleza / Seuma, mai/2025 |
| Renda e saneamento | IBGE, agregados por setor censitário, Censos 2010 e 2022 |
| CVLI e CVP | SSPDS/Supesp, dados detalhados 2019–2025, por AIS. A nota de segurança usa só mortes violentas (CVLI), média 2019–2025 com peso crescente; roubos (CVP) aparecem à parte, fora da nota |
| Contexto visual e rotas mais feitas | Strava Global Heatmap (tiles públicos até zoom 12), cruzado com ruas do OpenStreetMap |
| Regionais | Prefeitura de Fortaleza, Decreto nº 14.899/2020 (12 Secretarias Regionais) |
| Preço do m² | Anúncios de VivaReal, Zap, ImovelWeb, ChavesNaMão e OLX, coletados e limpos pelo PriceRadar |
| Hospitais, lazer, transporte, escolas e comércio | OpenStreetMap (Overpass, via osmnx), contados no bairro e num raio de 500 m |
| Ônibus, metrô e VLT | GTFS da ETUFOR (nov/2023 a fev/2024) e do Metrofor (2024), cópias do Mobility Database, e da ARCE (ônibus metropolitanos, 2025), roteados com r5py sobre as ruas do OpenStreetMap |
| Linhas por bairro e paradas | GTFS da ETUFOR de 03/2026 (Mobility Database), da ARCE (08/2025) e do Metrofor: a rede atual, sem horário |
| Praças e espaços públicos | URBIFOR, cadastro de 2019 (484 polígonos), em `data/raw/pracas_urbifor_2019.geojson`; camada de contexto, fora do índice e da nota do "Onde morar" |

As decisões de método e as limitações estão na seção "De onde vêm os números" do próprio dashboard e no cabeçalho de cada script.
