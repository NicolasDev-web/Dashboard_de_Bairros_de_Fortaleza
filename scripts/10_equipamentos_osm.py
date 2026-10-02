"""Etapa 10 — Equipamentos por bairro (OpenStreetMap), para a página "Onde morar".

Baixa do OpenStreetMap (osmnx / Overpass) os pontos de saúde, lazer, mobilidade,
escolas e comércio dentro de Fortaleza e dá a cada bairro uma nota de 0 a 100 por
categoria. Ninguém usa só o que cai dentro do limite do próprio bairro, então a
contagem é feita no bairro mais uma faixa de 500 m em volta, dividida pela área
dessa faixa (equipamentos por km² ao alcance de quem mora ali).

  saúde       50% proximidade do hospital mais próximo + 50% clínicas e postos por km²
  lazer       parques, praças, quadras, academias, cultura, shoppings e praia por km²
  mobilidade  40% paradas de ônibus por km² + 30% proximidade de estação de metrô/VLT
              + 30% km de ciclovia por km²
  escolas     escolas, creches, faculdades e universidades por km²
  comércio    supermercados, mercadinhos, padarias e farmácias por km²

A nota é o percentil entre os 121 bairros: 100 = o mais bem servido. É cobertura do
OpenStreetMap, não cadastro oficial — onde o mapeamento é ralo o bairro sai
subestimado.

Saídas: data/processed/bairros_equipamentos.csv e dashboard/equipamentos.js.
O download fica em data/cache/osm/ (fora do git); apague para baixar de novo.
"""
import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import osmnx as ox
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
BAIRROS = ROOT / "data/geo/bairros_fortaleza.geojson"
CACHE = ROOT / "data/cache/osm"
OUT_CSV = ROOT / "data/processed/bairros_equipamentos.csv"
OUT_JS = ROOT / "dashboard/equipamentos.js"
UTM = 31984
BUFFER_M = 500

CATEGORIAS = {
    "hospital": {"amenity": ["hospital"], "healthcare": ["hospital"]},
    "clinica": {"amenity": ["clinic", "doctors"], "healthcare": ["clinic", "centre", "doctor"]},
    "lazer": {"leisure": ["park", "garden", "playground", "sports_centre", "fitness_centre", "pitch"],
              "amenity": ["theatre", "cinema", "arts_centre"], "shop": ["mall"],
              "natural": ["beach"], "tourism": ["museum"]},
    "onibus": {"highway": ["bus_stop"], "amenity": ["bus_station"]},
    "estacao": {"railway": ["station", "halt", "tram_stop"]},
    "ciclovia": {"highway": ["cycleway"], "cycleway": ["lane", "track"]},
    "escola": {"amenity": ["school", "kindergarten", "university", "college"]},
    "comercio": {"shop": ["supermarket", "convenience", "bakery"], "amenity": ["pharmacy"]},
}


def baixar(nome: str, tags: dict, area) -> gpd.GeoDataFrame:
    cache = CACHE / f"{nome}.gpkg"
    if cache.exists():
        return gpd.read_file(cache)
    print(f"  baixando {nome} ...")
    ox.settings.cache_folder = str(CACHE / "osmnx")
    try:
        g = ox.features_from_polygon(area, tags)
    except ox._errors.InsufficientResponseError:
        g = gpd.GeoDataFrame(geometry=[], crs=4326)
    g = g.reset_index()
    keep = [c for c in ("element", "id", "name", "geometry") if c in g.columns]
    g = g[keep].copy()
    if "name" not in g:
        g["name"] = None
    g["name"] = g["name"].astype("string")
    CACHE.mkdir(parents=True, exist_ok=True)
    g.to_file(cache, driver="GPKG")
    return g


def percentil(s: pd.Series) -> pd.Series:
    return (s.rank(pct=True, method="average") * 100).round(1)


def main() -> None:
    b = gpd.read_file(BAIRROS)[["bairro_id", "nome", "geometry"]]
    area = b.union_all()
    bu = b.to_crs(UTM)
    alcance = bu.copy()
    alcance["geometry"] = bu.buffer(BUFFER_M)
    alcance["km2"] = alcance.area / 1e6
    centro = bu.copy()
    centro["geometry"] = bu.representative_point()

    t = b[["bairro_id", "nome"]].copy()
    pontos_mapa = {}
    for nome, tags in CATEGORIAS.items():
        g = baixar(nome, tags, area).to_crs(UTM)
        print(f"  {nome}: {len(g)} feições")
        if nome == "ciclovia":
            linhas = g[g.geom_type.isin(["LineString", "MultiLineString"])]
            km = []
            for geom in alcance.geometry:
                km.append(linhas.intersection(geom).length.sum() / 1000 if len(linhas) else 0.0)
            t["ciclovia_km"] = np.round(km, 2)
            continue
        pts = g.copy()
        pts["geometry"] = g.representative_point()
        if nome in ("hospital", "estacao"):
            # distância do ponto representativo do bairro ao mais próximo
            if len(pts):
                t[f"dist_{nome}_km"] = centro.geometry.map(lambda p: pts.distance(p).min() / 1000).round(2).values
            else:
                t[f"dist_{nome}_km"] = np.nan
            pontos_mapa[nome] = [
                [round(p.y, 5), round(p.x, 5), (n if isinstance(n, str) else None)]
                for p, n in zip(pts.to_crs(4326).geometry, pts["name"])
            ]
        j = gpd.sjoin(pts[["geometry"]], alcance[["bairro_id", "geometry"]], predicate="within")
        t[f"n_{nome}"] = t.bairro_id.map(j.bairro_id.value_counts()).fillna(0).astype(int)

    km2 = t.bairro_id.map(dict(zip(alcance.bairro_id, alcance.km2)))
    dens = lambda c: t[c] / km2  # noqa: E731
    prox = lambda c: percentil(-t[c].fillna(t[c].max() if t[c].notna().any() else 0))  # noqa: E731

    t["saude"] = (0.5 * prox("dist_hospital_km") + 0.5 * percentil(dens("n_clinica") + dens("n_hospital"))).round(1)
    t["lazer"] = percentil(dens("n_lazer"))
    t["mobilidade"] = (0.4 * percentil(dens("n_onibus")) + 0.3 * prox("dist_estacao_km")
                       + 0.3 * percentil(t.ciclovia_km / km2)).round(1)
    t["escolas"] = percentil(dens("n_escola"))
    t["comercio"] = percentil(dens("n_comercio"))

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    t.to_csv(OUT_CSV, index=False)

    notas = ["saude", "lazer", "mobilidade", "escolas", "comercio"]
    contagens = ["n_hospital", "n_clinica", "n_lazer", "n_onibus", "n_estacao", "n_escola", "n_comercio",
                 "dist_hospital_km", "dist_estacao_km", "ciclovia_km"]
    dados = {
        "fonte": "OpenStreetMap",
        "buffer_m": BUFFER_M,
        "bairros": {
            str(int(r.bairro_id)): {c: (None if pd.isna(r[c]) else float(r[c])) for c in notas + contagens}
            for _, r in t.iterrows()
        },
        "hospitais": pontos_mapa.get("hospital", []),
        "estacoes": pontos_mapa.get("estacao", []),
    }
    OUT_JS.write_text("window.EQUIP = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n",
                      encoding="utf-8")
    print(t.sort_values("saude", ascending=False)[["nome"] + notas].head(8).to_string(index=False))
    print(f"-> {OUT_CSV.relative_to(ROOT)}, {OUT_JS.relative_to(ROOT)} ({OUT_JS.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
