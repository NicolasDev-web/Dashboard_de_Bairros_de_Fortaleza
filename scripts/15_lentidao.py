"""Etapa 15 — Lentidão: onde o trânsito de Fortaleza é mais lento (Mapbox, trânsito típico).

As avenidas da cidade (classes Expressa, Arterial I e Arterial II dos Trechos de Logradouro da
Seuma) são cortadas em pedaços de ~2 km. Para cada pedaço, nos dois sentidos, a Mapbox Directions
API (perfil driving-traffic, com depart_at) devolve o tempo de viagem com o trânsito típico de
um dia útil em quatro horários: 3h (via livre), 7h30, 12h e 18h, em dois dias úteis.

Indicador "fator lentidão" = tempo no horário ÷ tempo às 3h. 1,0 é via livre; 2,0 é levar o
dobro do tempo. O pedaço fica com o sentido mais lento (e o tooltip diz qual).

Sentidos em que a rota da Mapbox foge da avenida (rota 50% mais longa que o pedaço, típico de
mão única) são descartados.

Guarda só os índices derivados (fator, minutos a mais, velocidade), não as rotas da Mapbox.

Uso:
  MAPBOX_TOKEN=pk.... python scripts/15_lentidao.py        # coleta (retoma de onde parou) e gera a página
  python scripts/15_lentidao.py --da-tabela                 # só refaz dashboard/lentidao.js da tabela

Saídas:
  data/cache/mapbox/coleta.csv          durações brutas por pedaço/sentido/dia/hora (cache, fora do git)
  data/processed/lentidao_trechos.csv   fator por pedaço e horário
  dashboard/lentidao.js
"""
import argparse
import csv
import importlib.util
import json
import math
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import requests
import shapely
from shapely import wkt
from shapely.ops import substring

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data/cache/mapbox"
COLETA = CACHE / "coleta.csv"
TABELA = ROOT / "data/processed/lentidao_trechos.csv"
SAIDA = ROOT / "dashboard/lentidao.js"
UTM = "EPSG:31984"
CLASSES = ["Expressa", "Arterial I", "Arterial II"]
PEDACO = 2000          # m
MIN_TRECHO = 1000      # m: ruas (ou partes) menores ficam de fora
HORAS = ["03:00", "07:30", "12:00", "18:00"]
PERIODOS = {"07:30": "manha", "12:00": "almoco", "18:00": "tarde"}
DESVIO = 1.5
URL = "https://api.mapbox.com/directions/v5/mapbox/driving-traffic/{coords}"

# reaproveita a malha, a projeção e os nomes da etapa 14
_spec = importlib.util.spec_from_file_location("transito14", ROOT / "scripts/14_transito.py")
t14 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(t14)


def dias_uteis() -> list[str]:
    """Próxima terça e quarta a pelo menos 2 dias de hoje (fora de feriado nacional fixo)."""
    feriados = {(1, 1), (4, 21), (5, 1), (9, 7), (10, 12), (11, 2), (11, 15), (11, 20), (12, 25)}
    d, out = date.today() + timedelta(days=2), []
    while len(out) < 2:
        if d.weekday() in (1, 2) and (d.month, d.day) not in feriados:
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def pedacos() -> gpd.GeoDataFrame:
    tr = pd.read_csv(t14.baixar("trechos.csv"), usecols=["nome", "class_viaria", "the_geom"])
    tr = gpd.GeoDataFrame(tr, geometry=tr.the_geom.map(wkt.loads), crs=UTM)
    tr = tr[tr.class_viaria.isin(CLASSES) & tr.nome.notna()]
    linhas = []
    for nome, g in tr.groupby("nome"):
        m = shapely.line_merge(g.geometry.union_all())
        for parte in (m.geoms if hasattr(m, "geoms") else [m]):
            if parte.length < MIN_TRECHO:
                continue
            n = max(1, round(parte.length / PEDACO))
            passo = parte.length / n
            for k in range(n):
                linhas.append({"rua": nome, "geometry": substring(parte, k * passo, (k + 1) * passo)})
    p = gpd.GeoDataFrame(linhas, crs=UTM)
    p["id"] = range(len(p))
    p["comp_m"] = p.length.round()
    return p


def pontos_lonlat(geom) -> list[tuple[float, float]]:
    pts = gpd.GeoSeries([geom.interpolate(f, normalized=True) for f in (0.02, 0.5, 0.98)], crs=UTM).to_crs(4326)
    return [(round(p.x, 6), round(p.y, 6)) for p in pts]


def coletar(p: gpd.GeoDataFrame, token: str) -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    feitos = set()
    if COLETA.exists():
        for r in csv.DictReader(open(COLETA, encoding="utf-8")):
            feitos.add((int(r["id"]), r["sentido"], r["dia"], r["hora"]))
    dias = dias_uteis()
    tarefas = []
    for row in p.itertuples():
        a, m, b = pontos_lonlat(row.geometry)
        for sentido, coords in (("ida", [a, m, b]), ("volta", [b, m, a])):
            for dia in dias:
                for hora in HORAS:
                    if (row.id, sentido, dia, hora) not in feitos:
                        tarefas.append((row.id, sentido, dia, hora, coords))
    print(f"{len(p)} pedaços, dias {dias}; faltam {len(tarefas)} consultas")
    sess = requests.Session()
    novo = not COLETA.exists()
    with open(COLETA, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if novo:
            w.writerow(["id", "sentido", "dia", "hora", "duracao_s", "distancia_m", "codigo"])
        for i, (pid, sentido, dia, hora, coords) in enumerate(tarefas, 1):
            url = URL.format(coords=";".join(f"{x},{y}" for x, y in coords))
            params = {"overview": "false", "depart_at": f"{dia}T{hora}", "radiuses": "60;60;60", "access_token": token}
            for tentativa in range(5):
                r = sess.get(url, params=params, timeout=30)
                if r.status_code == 429:
                    time.sleep(10 * (tentativa + 1))
                    continue
                break
            d = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            rota = (d.get("routes") or [{}])[0]
            w.writerow([pid, sentido, dia, hora, round(rota.get("duration", 0), 1), round(rota.get("distance", 0)),
                        d.get("code", r.status_code)])
            if i % 200 == 0:
                f.flush()
                print(f"  {i}/{len(tarefas)}")
            time.sleep(0.21)   # ~285 por minuto, abaixo do limite de 300


def resumir(p: gpd.GeoDataFrame) -> pd.DataFrame:
    c = pd.read_csv(COLETA)
    c = c[(c.codigo == "Ok") & (c.duracao_s > 0)]
    c = c.merge(p[["id", "comp_m"]], on="id")
    livre = c[c.hora == "03:00"].groupby(["id", "sentido", "dia"]).agg(livre=("duracao_s", "mean"), dist=("distancia_m", "mean"))
    pico = c[c.hora != "03:00"].set_index(["id", "sentido", "dia"]).join(livre, how="inner")
    pico = pico[pico.dist <= pico.comp_m * DESVIO]          # rota fugiu da avenida: fora
    # tempo no pico menor que o da madrugada é ruído do trânsito típico: conta como via livre (1,0)
    pico["fator"] = (pico.duracao_s / pico.livre).clip(lower=1.0)
    pico["extra_min_km"] = (pico.duracao_s - pico.livre) / 60 / (pico.dist / 1000)
    pico["kmh"] = pico.dist / pico.duracao_s * 3.6
    pico["kmh_livre"] = pico.dist / pico.livre * 3.6
    g = (pico.reset_index().groupby(["id", "sentido", "hora"])
              .agg(fator=("fator", "mean"), extra=("extra_min_km", "mean"), kmh=("kmh", "mean"),
                   kmh_livre=("kmh_livre", "mean"), dist=("dist", "mean"), livre=("livre", "mean"),
                   dur=("duracao_s", "mean"))
              .reset_index())
    # sentido mais lento de cada pedaço, por horário
    g = g.sort_values("fator", ascending=False).drop_duplicates(["id", "hora"])
    return g


def gerar(p: gpd.GeoDataFrame, g: pd.DataFrame) -> None:
    bairros = gpd.read_file(ROOT / "data/geo/bairros_fortaleza.geojson").to_crs(UTM)
    tela = t14.Tela(bairros.total_bounds)
    ini = gpd.GeoDataFrame(p[["id"]], geometry=p.geometry.interpolate(0.02, normalized=True), crs=UTM)
    fim = gpd.GeoDataFrame(p[["id"]], geometry=p.geometry.interpolate(0.98, normalized=True), crs=UTM)

    def bairro_de(pts):
        j = gpd.sjoin(pts, bairros[["nome", "geometry"]], how="left", predicate="within").drop_duplicates("id")
        return j.set_index("id")["nome"].map(lambda s: t14_titulo(s) if isinstance(s, str) else "")

    b_ini, b_fim = bairro_de(ini), bairro_de(fim)
    tab = g.merge(p[["id", "rua", "comp_m"]], on="id")
    tab["periodo"] = tab.hora.map(PERIODOS)
    tab["rua_bonita"] = tab.rua.map(t14.via_bonita)
    tab["de"] = np.where(tab.sentido == "ida", tab.id.map(b_ini), tab.id.map(b_fim))
    tab["para"] = np.where(tab.sentido == "ida", tab.id.map(b_fim), tab.id.map(b_ini))
    TABELA.parent.mkdir(parents=True, exist_ok=True)
    tab[["id", "rua_bonita", "periodo", "hora", "sentido", "de", "para", "fator", "extra", "kmh", "kmh_livre",
         "dist", "livre", "dur"]].round(3).to_csv(TABELA, index=False)

    trechos = []
    for row in p.itertuples():
        t = tab[tab.id == row.id]
        if t.empty:
            continue
        per = {}
        for r in t.itertuples():
            per[r.periodo] = {"f": round(r.fator, 2), "kmh": round(r.kmh), "kmhl": round(r.kmh_livre),
                              "min": round(r.dur / 60, 1), "minl": round(r.livre / 60, 1), "de": r.de, "para": r.para}
        trechos.append({"id": int(row.id), "rua": t14.via_bonita(row.rua), "km": round(row.comp_m / 1000, 1),
                        "d": tela.caminho(row.geometry.simplify(6)), "p": per})

    # média da cidade ponderada pela extensão, por horário
    cidade = {}
    for per in PERIODOS.values():
        x = tab[tab.periodo == per]
        cidade[per] = {"fator": round(float(np.average(x.fator, weights=x.comp_m)), 3),
                       "kmh": round(float(np.average(x.kmh, weights=x.comp_m)), 1),
                       "kmh_livre": round(float(np.average(x.kmh_livre, weights=x.comp_m)), 1)}
    dados = {"dias": sorted(pd.read_csv(COLETA).dia.unique().tolist()), "horas": PERIODOS, "cidade": cidade,
             "n_pedacos": len(trechos), "km": round(sum(t["km"] for t in trechos)), "trechos": trechos}
    SAIDA.write_text("window.LENTIDAO = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n",
                     encoding="utf-8")
    print(f"{len(trechos)} pedaços ({dados['km']} km) -> {SAIDA.relative_to(ROOT)} ({SAIDA.stat().st_size / 1024:.0f} KB)")
    for per, v in cidade.items():
        print(f"  {per}: fator médio {v['fator']:.2f}, {v['kmh']} km/h (livre {v['kmh_livre']} km/h)")
    top = tab[tab.periodo == "tarde"].sort_values("fator", ascending=False).head(10)
    print(top[["rua_bonita", "de", "para", "fator", "kmh", "kmh_livre"]].to_string(index=False))


def t14_titulo(s: str) -> str:
    t = s.title()
    for a in (" De ", " Do ", " Da ", " Dos ", " Das ", " E "):
        t = t.replace(a, a.lower())
    return t


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--da-tabela", action="store_true", help="não consulta a Mapbox, só refaz a saída")
    args = ap.parse_args()
    p = pedacos()
    if not args.da_tabela:
        token = os.environ.get("MAPBOX_TOKEN")
        if not token:
            sys.exit("defina MAPBOX_TOKEN (token público da Mapbox, pk....)")
        coletar(p, token)
    gerar(p, resumir(p))


if __name__ == "__main__":
    main()
