"""Etapa extra — Rotas mais feitas de corrida e pedal, a partir do Strava Global Heatmap.

Não há dado numérico público do Strava por trecho (a API exige Extended Access desde
set/2026 e o Strava Metro exige convênio). Então a rota é ESTIMADA a partir dos tiles
públicos do heatmap (zoom 12, ~38 m por pixel):

  - Os tiles são PNG indexados: o índice do pixel (0–255) é a intensidade do heatmap,
    igual em todas as paletas (só a tabela de cores muda). 0 = sem atividade.
  - Cada rua do OpenStreetMap (osmnx, rede "all": ruas, ciclovias, calçadões, trilhas)
    é amostrada a cada 10 m; o calor do trecho é a mediana das amostras (0–1).
  - Trechos quentes = percentil 90 do calor, ponderado pela extensão.
  - Rota = trechos quentes contínuos com o mesmo nome de rua (componentes conectados);
    trechos sem nome formam "caminhos" pelo mesmo critério. Rota mínima: 1 km.
    Vias paralelas a menos de 40 m (pista dupla, calçadão, ciclovia) viram uma rota só,
    e a extensão conta o corredor uma vez (área do buffer de 20 m ÷ 40 m).
  - Ordem: km do corredor no nível máximo do heatmap (calor >= 0,97), desempate pelo
    calor médio. O heatmap satura perto do pixel 255 nos trechos mais usados, então a
    média sozinha empata; vale a rota com mais extensão no topo de uso.
  - Por bairro: calor médio das ruas (ponderado pela extensão), 0–100 relativo ao
    bairro mais movimentado. Não entra no índice; é contexto.

Limitações: intensidade relativa (o Strava normaliza o heatmap), não contagem de
viagens; viés de quem usa Strava; derivar dados dos tiles é zona cinzenta nos termos
de uso do Strava.

Saídas:
  data/processed/rotas_top.csv, data/processed/rotas_strava.geojson,
  data/processed/bairros_strava.csv, dashboard/rotas.js
"""
import io
import json
import math
import sys
from pathlib import Path

import geopandas as gpd
import networkx as nx
import numpy as np
import osmnx as ox
import pandas as pd
import requests
from PIL import Image
from pyproj import Transformer
from shapely.geometry import mapping
from shapely.ops import linemerge, unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from importlib import import_module  # noqa: E402

slug = import_module("01_malha_bairros").slug

CACHE = ROOT / "data/cache/strava"
PROC = ROOT / "data/processed"
OUT_JS = ROOT / "dashboard/rotas.js"
Z = 12
TILE = 256
UTM = 31984
ATIVIDADES = {"run": "corrida", "ride": "pedal"}
PASSO_M = 10
PCT_QUENTE = 0.90
MIN_ROTA_M = 1000
BUFFER_M = 20      # largura usada para medir o corredor
PARALELA_M = 40    # vias a menos disso de uma rota já escolhida são a mesma rota
SATURADO = 0.97    # nível máximo do heatmap (o pixel satura perto de 255)
TOP = 10
URL = "https://heatmap-external-{s}.strava.com/tiles/{a}/hot/{z}/{x}/{y}.png?px=256"


# ---------- tiles ----------
def lonlat_px(lon, lat):
    """Coordenadas de pixel globais (Web Mercator) no zoom Z."""
    n = TILE * 2 ** Z
    lat = np.clip(lat, -85.05, 85.05)
    x = (np.asarray(lon) + 180.0) / 360.0 * n
    y = (1 - np.log(np.tan(np.radians(lat)) + 1 / np.cos(np.radians(lat))) / math.pi) / 2 * n
    return x, y


def mosaico(atividade: str, bbox) -> tuple[np.ndarray, int, int]:
    """Matriz de intensidade 0–1 cobrindo o bbox; devolve (matriz, x0_px, y0_px)."""
    (x_min, y_max), (x_max, y_min) = [lonlat_px(bbox[0], bbox[1]), lonlat_px(bbox[2], bbox[3])]
    tx = range(int(x_min // TILE), int(x_max // TILE) + 1)
    ty = range(int(y_min // TILE), int(y_max // TILE) + 1)
    m = np.zeros((len(ty) * TILE, len(tx) * TILE), dtype=np.float32)
    pasta = CACHE / atividade
    pasta.mkdir(parents=True, exist_ok=True)
    vazios = 0
    for j, y in enumerate(ty):
        for i, x in enumerate(tx):
            arq = pasta / f"{Z}_{x}_{y}.png"
            if not arq.exists():
                r = requests.get(URL.format(s="abc"[(x + y) % 3], a=atividade, z=Z, x=x, y=y), timeout=60)
                if r.status_code == 404:  # sem atividade (mar)
                    arq.write_bytes(b"")
                else:
                    r.raise_for_status()
                    arq.write_bytes(r.content)
            if arq.stat().st_size == 0:
                vazios += 1
                continue
            im = Image.open(io.BytesIO(arq.read_bytes()))
            assert im.mode == "P", f"tile {arq.name} não é indexado ({im.mode})"
            m[j * TILE:(j + 1) * TILE, i * TILE:(i + 1) * TILE] = np.asarray(im, dtype=np.float32) / 255.0
    print(f"  {atividade}: {len(tx) * len(ty)} tiles ({vazios} vazios)")
    return m, tx[0] * TILE, ty[0] * TILE


def amostrar(m: np.ndarray, x0: int, y0: int, lon, lat) -> np.ndarray:
    """Interpolação bilinear no mosaico."""
    px, py = lonlat_px(lon, lat)
    px, py = px - x0 - 0.5, py - y0 - 0.5
    i0 = np.clip(np.floor(px).astype(int), 0, m.shape[1] - 2)
    j0 = np.clip(np.floor(py).astype(int), 0, m.shape[0] - 2)
    fx, fy = np.clip(px - i0, 0, 1), np.clip(py - j0, 0, 1)
    return (m[j0, i0] * (1 - fx) * (1 - fy) + m[j0, i0 + 1] * fx * (1 - fy)
            + m[j0 + 1, i0] * (1 - fx) * fy + m[j0 + 1, i0 + 1] * fx * fy)


# ---------- ruas ----------
def ruas(area_4326) -> gpd.GeoDataFrame:
    cache = CACHE / "osm_ruas_v2.gpkg"
    if cache.exists():
        return gpd.read_file(cache)
    print("  baixando ruas do OpenStreetMap ...")
    ox.settings.useful_tags_way = list(set(ox.settings.useful_tags_way) | {"footway"})
    ox.settings.cache_folder = str(CACHE / "osmnx")
    g = ox.graph_from_polygon(area_4326, network_type="all", retain_all=True)
    g = ox.convert.to_undirected(g)
    e = ox.graph_to_gdfs(g, nodes=False).reset_index()
    e = e.reindex(columns=["u", "v", "name", "highway", "footway", "geometry"])
    for c in ("name", "highway", "footway"):  # osmnx devolve lista quando o trecho junta vários valores
        e[c] = e[c].map(lambda v: v[0] if isinstance(v, list) else v)
    e = e.to_crs(UTM)
    e["comp_m"] = e.length
    CACHE.mkdir(parents=True, exist_ok=True)
    e.to_file(cache, driver="GPKG")
    return e


def calor_trechos(e: gpd.GeoDataFrame, mos: dict) -> gpd.GeoDataFrame:
    """Mediana do calor a cada PASSO_M metros, por trecho e atividade."""
    ids, xs, ys = [], [], []
    for k, geom in zip(e.index, e.geometry):
        d = np.arange(0, geom.length + 1e-6, PASSO_M) if geom.length > PASSO_M else [geom.length / 2]
        pts = [geom.interpolate(t) for t in d]
        ids += [k] * len(pts)
        xs += [p.x for p in pts]
        ys += [p.y for p in pts]
    lon, lat = Transformer.from_crs(UTM, 4326, always_xy=True).transform(np.array(xs), np.array(ys))
    amostras = pd.DataFrame({"k": ids})
    for a, (m, x0, y0) in mos.items():
        amostras[a] = amostrar(m, x0, y0, lon, lat)
        e[f"calor_{a}"] = amostras.groupby("k")[a].median().reindex(e.index).fillna(0).values
    return e


# ---------- rotas ----------
def nome_curto(n: str) -> str:
    for longo, curto in (("Avenida ", "Av. "), ("Rua ", "R. "), ("Travessa ", "Tv. "), ("Rodovia ", "Rod. ")):
        if n.startswith(longo):
            return curto + n[len(longo):]
    return n


def rotas(e: gpd.GeoDataFrame, a: str, bairros: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    col = f"calor_{a}"
    ordem = e.sort_values(col)
    acum = ordem["comp_m"].cumsum() / ordem["comp_m"].sum()
    corte = float(ordem.loc[acum >= PCT_QUENTE, col].iloc[0])
    q = e[e[col] >= corte].copy()
    q["grupo"] = q["name"].fillna("").map(lambda n: slug(n) if n else "")

    # 1) candidatas: trechos quentes contínuos com o mesmo nome (ou sem nome)
    cand = []
    for grupo, sub in q.groupby("grupo"):
        g = nx.Graph()
        for k, r in sub.iterrows():
            g.add_edge(r.u, r.v, k=k)
        for comp in nx.connected_components(g):
            ks = [d["k"] for _, _, d in g.subgraph(comp).edges(data=True)]
            t = sub.loc[ks]
            u = unary_union(t.geometry.values)
            geom = linemerge(u) if u.geom_type == "MultiLineString" else u
            # extensão do corredor: pistas paralelas (pista dupla, calçadão, ciclovia) contam uma vez
            km = geom.buffer(BUFFER_M).area / (2 * BUFFER_M) / 1000
            if km * 1000 < MIN_ROTA_M:
                continue
            sat = t[t[col] >= SATURADO]
            km_sat = unary_union(sat.geometry.values).buffer(BUFFER_M).area / (2 * BUFFER_M) / 1000 if len(sat) else 0.0
            cand.append({
                "nome_osm": t["name"].dropna().iloc[0] if grupo else None,
                "calor": float(np.average(t[col], weights=t["comp_m"])),
                "km": km,
                "km_max": km_sat,
                "geometry": geom,
            })
    # 2) o heatmap satura (pixel ~255) nos trechos mais usados, então a média empata.
    #    Ordem: km do corredor no nível máximo do heatmap; desempate pelo calor médio.
    cand.sort(key=lambda c: (round(c["km_max"], 1), c["calor"]), reverse=True)

    # 3) junta candidatas paralelas (avenida + calçadão + ciclovia lado a lado)
    sel = []
    for c in cand:
        alvo = next((s_ for s_ in sel
                     if c["geometry"].intersection(s_["zona"]).length > 0.5 * c["geometry"].length), None)
        if alvo is None:
            sel.append({**c, "nomes": [c["nome_osm"]], "zona": c["geometry"].buffer(PARALELA_M)})
        else:
            alvo["nomes"].append(c["nome_osm"])
            alvo["geometry"] = unary_union([alvo["geometry"], c["geometry"]])
            # a zona fica a da rota original: sem isso a rota "engole" vizinhas em cadeia
        if len(sel) == TOP and alvo is None:
            break
    for x in sel:
        x["km"] = x["geometry"].buffer(BUFFER_M).area / (2 * BUFFER_M) / 1000
        nomes = [n for n in x["nomes"] if isinstance(n, str)]
        vias = [n for n in nomes if n.split(" ")[0] in ("Avenida", "Rua", "Rodovia", "Travessa", "Estrada")]
        x["nome_osm"] = (vias or nomes or [None])[0]
    r = gpd.GeoDataFrame([{k: v for k, v in x.items() if k not in ("zona", "nomes")} for x in sel], crs=UTM)
    r = r.rename(columns={"km": "comp_km"}).head(TOP).reset_index(drop=True)

    # bairros cortados (por extensão dentro de cada um)
    corte_b = gpd.overlay(r.reset_index()[["index", "geometry"]], bairros[["nome", "geometry"]],
                          how="intersection", keep_geom_type=True)
    corte_b["m"] = corte_b.length
    por_rota = (corte_b[corte_b.m > 50].sort_values("m", ascending=False)
                .groupby("index")["nome"].apply(list))
    r["bairros"] = r.index.map(lambda i: por_rota.get(i, []))
    r["nome"] = [nome_curto(n) if isinstance(n, str) else f"Caminho em {b[0] if b else 'Fortaleza'}"
                 for n, b in zip(r["nome_osm"], r["bairros"])]
    r["posicao"] = range(1, len(r) + 1)
    r["atividade"] = a
    print(f"\n  corte de trecho quente ({a}): calor >= {corte:.2f}")
    return r


def por_bairro(e: gpd.GeoDataFrame, bairros: gpd.GeoDataFrame) -> pd.DataFrame:
    pts = e.copy()
    pts["geometry"] = e.geometry.interpolate(0.5, normalized=True)
    j = gpd.sjoin(pts, bairros[["bairro_id", "nome", "geometry"]], predicate="within")
    out = {}
    for a in ATIVIDADES:
        w = j.groupby("bairro_id").apply(lambda t: np.average(t[f"calor_{a}"], weights=t["comp_m"]),
                                         include_groups=False)
        out[f"strava_{a}"] = (w / w.max() * 100).round(1)
    df = pd.DataFrame(out).reset_index()
    assert len(df) == len(bairros), "há bairro sem rua amostrada"
    return df


def geo_js(gdf: gpd.GeoDataFrame, props: list[str], tol: float) -> dict:
    g = gdf.copy()
    g["geometry"] = g.geometry.simplify(tol)
    g = g.to_crs(4326)
    feats = []
    for _, r in g.iterrows():
        geom = json.loads(json.dumps(mapping(r.geometry)), parse_float=lambda x: round(float(x), 5))
        feats.append({"type": "Feature", "geometry": geom,
                      "properties": {p: (round(r[p], 3) if isinstance(r[p], float) else r[p]) for p in props}})
    return {"type": "FeatureCollection", "features": feats}


def main() -> None:
    bairros = gpd.read_file(ROOT / "data/geo/bairros_fortaleza.geojson")
    bairros["nome"] = bairros["nome"].map(import_module("06_dados_dashboard").nome_bonito)
    area = bairros.union_all()
    print("tiles do heatmap (zoom 12):")
    mos = {a: mosaico(a, bairros.total_bounds) for a in ATIVIDADES}

    e = ruas(area)
    # calçadas e faixas de pedestre espelham a rua ao lado; acessos de serviço são
    # estacionamentos e entradas. Nenhum deles é rota, e contariam a mesma via duas vezes.
    fora = e["footway"].isin(["sidewalk", "crossing", "traffic_island"]) | (e["highway"] == "service")
    print(f"  {len(e)} trechos no OSM; {fora.sum()} calçadas, faixas e acessos de serviço removidos")
    e = e[~fora].reset_index(drop=True)
    e = calor_trechos(e, mos)
    print(f"  {len(e)} trechos de rua, {e.comp_m.sum() / 1000:,.0f} km")
    bairros_u = bairros.to_crs(UTM)

    tops, saida = [], {}
    for a, rot in ATIVIDADES.items():
        r = rotas(e, a, bairros_u)
        assert len(r) == TOP, f"só {len(r)} rotas de {rot}"
        tops.append(r)
        print(f"  top {TOP} {rot}:")
        for _, x in r.iterrows():
            print(f"   {x.posicao:>2}. {x.nome:<40} {x.comp_km:5.1f} km ({x.km_max:4.1f} no máx.)  calor {x.calor:.2f}  {', '.join(x.bairros[:3])}")
        saida[a] = {
            "top": geo_js(r, ["posicao", "nome", "comp_km", "km_max", "calor", "bairros"], 6),
        }

    pb = por_bairro(e, bairros_u)
    pb.to_csv(PROC / "bairros_strava.csv", index=False)
    todas = pd.concat(tops, ignore_index=True)
    todas.drop(columns="geometry").assign(bairros=todas.bairros.map(", ".join)).to_csv(PROC / "rotas_top.csv", index=False)
    gpd.GeoDataFrame(todas.assign(bairros=todas.bairros.map(", ".join)), crs=UTM).to_crs(4326) \
        .to_file(PROC / "rotas_strava.geojson", driver="GeoJSON")

    saida["bairros"] = {int(r.bairro_id): [r.strava_run, r.strava_ride] for r in pb.itertuples()}
    OUT_JS.write_text("window.ROTAS = " + json.dumps(saida, ensure_ascii=False, separators=(",", ":")) + ";\n",
                      encoding="utf-8")
    print(f"\n-> {OUT_JS.relative_to(ROOT)} ({OUT_JS.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
