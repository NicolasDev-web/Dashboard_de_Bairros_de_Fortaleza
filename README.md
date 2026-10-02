# Bairros de Fortaleza

Dashboard que compara os 121 bairros de Fortaleza por renda, saneamento e segurança, com a evolução entre os Censos de 2010 e 2022, e o preço do m² dos imóveis em cada uma das 12 regionais, coletado com o [PriceRadar](https://github.com/NicolasDev-web/priceradar).

**Ver o dashboard:** abra `dashboard/index.html` no navegador (precisa de internet para a fonte, o Leaflet e a camada do Strava).

## Pipeline de dados

```sh
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows; no Linux/macOS: .venv/bin/python

.venv/Scripts/python scripts/01_malha_bairros.py    # malha Seuma (KMZ) -> data/geo/bairros_fortaleza.geojson
.venv/Scripts/python scripts/02_ibge.py             # Censos 2010/2022 por setor -> data/raw/ibge_*.csv
.venv/Scripts/python scripts/03_seguranca.py        # SSPDS por AIS -> data/raw/seguranca_ais.csv, bairro_ais.csv
.venv/Scripts/python scripts/04_join_bairros.py     # setor -> bairro -> data/processed/bairros_indicadores.csv
.venv/Scripts/python scripts/05_indice.py           # notas 0-100 e índice -> data/processed/bairros_indice.csv
.venv/Scripts/python scripts/06_dados_dashboard.py  # -> dashboard/data.js
.venv/Scripts/python scripts/07_rotas_strava.py     # rotas de corrida e pedal (heatmap Strava + OSM) -> dashboard/rotas.js
.venv/Scripts/python scripts/08_regionais.py        # bairro -> regional (Decreto 14.899/2020) -> data/raw/bairro_regional.csv
.venv/Scripts/python scripts/09_precos_priceradar.py  # preço do m² por regional com o PriceRadar -> dashboard/precos.js
```

A etapa 6 lê a saída da 8: se mexer nas regionais, rode a 8 e depois a 6.

## Preço do m² por regional (PriceRadar)

A etapa 9 usa o PriceRadar para coletar anúncios de venda de apartamentos em Fortaleza, põe cada um num bairro oficial (pela coordenada do portal ou pelo nome do bairro) e resume por regional e por bairro, com mediana, média e quartis do preço por m², também por número de quartos.

```sh
# o PriceRadar clonado ao lado deste repositório (../priceradar), com o venv dele ou estas dependências:
.venv/Scripts/python -m pip install -r ../priceradar/priceradar/backend/requirements.txt

.venv/Scripts/python scripts/09_precos_priceradar.py                    # coleta nova (6 faixas de preço + reforço por bairro)
.venv/Scripts/python scripts/09_precos_priceradar.py --fonte historico  # usa as buscas já gravadas no priceradar.db (90 dias)
.venv/Scripts/python scripts/09_precos_priceradar.py --fonte csv        # só reagrega a última coleta
.venv/Scripts/python scripts/09_precos_priceradar.py --priceradar C:/outro/caminho/priceradar
```

A coleta usa o `.env` do PriceRadar e precisa de uma rede de onde os portais respondam (a mesma em que o app funciona). Enquanto `dashboard/precos.js` não existir, a seção "Preços" mostra só as regionais e como gerar os números. Anúncios com bairro que não foi reconhecido aparecem no fim da saída do script: acrescente o apelido em `APELIDOS` no próprio script.

Os downloads brutos (~330 MB) ficam em `data/cache/`, fora do git; os scripts baixam de novo se faltarem.

## Fontes

| Dado | Fonte |
|---|---|
| Limites dos bairros | Prefeitura de Fortaleza / Seuma, mai/2025 |
| Renda e saneamento | IBGE, agregados por setor censitário, Censos 2010 e 2022 |
| CVLI e CVP | SSPDS/Supesp, dados detalhados 2019–2025, por AIS |
| Contexto visual e rotas mais feitas | Strava Global Heatmap (tiles públicos até zoom 12), cruzado com ruas do OpenStreetMap |
| Regionais | Prefeitura de Fortaleza, Decreto nº 14.899/2020 (12 Secretarias Regionais) |
| Preço do m² | Anúncios de VivaReal, Zap, ImovelWeb, ChavesNaMão e OLX, coletados e limpos pelo PriceRadar |

As decisões de método e as limitações estão na seção "De onde vêm os números" do próprio dashboard e no cabeçalho de cada script.
