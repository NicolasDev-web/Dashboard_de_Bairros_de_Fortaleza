# Bairros de Fortaleza

Dashboard que compara os 121 bairros de Fortaleza por renda, saneamento e segurança, com a evolução entre os Censos de 2010 e 2022.

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
```

Os downloads brutos (~330 MB) ficam em `data/cache/`, fora do git; os scripts baixam de novo se faltarem.

## Fontes

| Dado | Fonte |
|---|---|
| Limites dos bairros | Prefeitura de Fortaleza / Seuma, mai/2025 |
| Renda e saneamento | IBGE, agregados por setor censitário, Censos 2010 e 2022 |
| CVLI e CVP | SSPDS/Supesp, dados detalhados 2019–2025, por AIS |
| Contexto visual e rotas mais feitas | Strava Global Heatmap (tiles públicos até zoom 12), cruzado com ruas do OpenStreetMap |

As decisões de método e as limitações estão na seção "De onde vêm os números" do próprio dashboard e no cabeçalho de cada script.
