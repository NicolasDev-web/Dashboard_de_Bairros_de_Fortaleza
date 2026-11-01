"""Etapa 14 — Trânsito: onde passa mais carro e onde acontecem os sinistros (AMC).

Fontes (Portal de Dados Abertos de Fortaleza, https://dados.fortaleza.ce.gov.br):
  - Volume Tráfego Mensal (AMC): veículos por dia, média de cada mês, em cada equipamento de
    fiscalização eletrônica com contagem, de jan/2017 a jun/2025.
  - Sinistros de Trânsito 2015–2024 (AMC/SIAT): um registro por sinistro, com hora e coordenada.
  - Trechos de Logradouro (Seuma): o eixo de cada trecho de rua, com nome e classe viária.

O que sai:
  - cada avenida medida, desenhada pelos trechos de rua, com o volume do radar mais próximo
    (os dois sentidos somados quando a via tem radar nos dois); trechos a mais de 2 km do radar
    ficam sem cor, para não afirmar volume onde ninguém mediu;
  - os pontos de radar e o ranking das vias;
  - sinistros de 2022 a 2024: pontos críticos (quadrículas de 150 m), mapa de calor hora x dia,
    vias com mais registros, série anual 2015–2024.

Tudo vai projetado em SIRGAS 2000 / UTM 24S e convertido para o viewBox do SVG da página,
então a página não precisa de biblioteca de mapa.

Saída: dashboard/transito.js
"""
import json
import re
import unicodedata
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import requests
from shapely import wkt
from shapely.geometry import Point

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data/cache/amc"
SAIDA = ROOT / "dashboard/transito.js"
UTM = "EPSG:31984"
BASE = "https://dados.fortaleza.ce.gov.br/dataset"
ARQS = {
    "volume.csv": f"{BASE}/94e77a67-a8a5-4f54-a27c-f9f58c4fe176/resource/fcccc36d-50ee-488a-a814-e7e7e27f9872/download/dadosabertos_volumetrafegomensal.csv",
    "sinistros.geojson": f"{BASE}/76c32db6-97b4-439a-9f12-c0f6413b2013/resource/75f7e594-cab6-4907-b682-9b6af11ebc2c/download/sinistros-2015-2024.geojson",
    "trechos.csv": f"{BASE}/81c6b77f-60fd-4591-a013-bf328daa31ef/resource/e329b528-d24f-46e7-ab03-be6f41ec98a7/download/trechos-de-logradouros.csv",
}
JANELA = ("2024-07", "2025-06")       # últimos 12 meses publicados
MIN_MESES = 6                          # radar precisa ter contado pelo menos 6 desses meses
ANOS_SIN = (2022, 2023, 2024)
CLASSES_BASE = ["Expressa", "Arterial I", "Arterial II", "Coletora"]
ALCANCE = 2000                         # m: até onde o volume de um radar pinta a própria rua
LARGURA_SVG = 1000

ABREV = {
    "AV": "Av.", "R": "R.", "PRES": "Presidente", "ENG": "Engenheiro", "GEN": "General",
    "ALM": "Almirante", "DR": "Doutor", "SEN": "Senador", "DEP": "Deputado", "JORN": "Jornalista",
    "GOV": "Governador", "MAL": "Marechal", "CEL": "Coronel", "PE": "Padre", "STO": "Santo",
    "STA": "Santa", "PROF": "Professor", "DES": "Desembargador", "SGT": "Sargento", "VISC": "Visconde",
    "MIN": "Ministro", "CAP": "Capitão", "BR": "BR", "TEN": "Tenente", "CDE": "Conde", "DQ": "Duque",
    "AVENIDA": "Av.", "RUA": "R.", "PRS": "Presidente", "GAL": "General", "MIT": "Mister", "SGTO": "Sargento",
    "MONS": "Monsenhor", "PIN": "Pintor", "ENGº": "Engenheiro", "DRA": "Doutora", "PDE": "Padre", "VER": "Vereador",
}
MINUSC = {"de", "da", "do", "dos", "das", "e"}
ACENTOS = {  # grafia sem acento do radar → com acento
    "Abolicao": "Abolição", "Jose": "José", "Joao": "João", "Osorio": "Osório", "Junior": "Júnior",
    "Saboia": "Saboia", "Antonio": "Antônio", "Luis": "Luís", "Herminio": "Hermínio",
    "Lauro": "Lauro", "Heraclito": "Heráclito", "Graca": "Graça", "Virgilio": "Virgílio",
    "Tavora": "Távora", "Expedicionarios": "Expedicionários", "Maciel": "Maciel", "Fabio": "Fábio",
    "Sa": "Sá", "Contôrno": "Contorno", "Marinho": "Marinho", "Hipolito": "Hipólito", "Paiva": "Paiva", "Liduina": "Liduína",
    "Ceara": "Ceará", "Barao": "Barão", "Conceicao": "Conceição", "Uniao": "União", "Apolonio": "Apolônio",
}
APELIDO = {
    "Av. Presidente Castelo Branco": "Av. Leste-Oeste (Pres. Castelo Branco)",
    "Av. Presidente Costa e Silva": "Av. Perimetral (Pres. Costa e Silva)",
    "Rodovia BR 116": "BR-116", "Av. Doutor Raul Barbosa": "Av. Raul Barbosa", "Rodovia Br 116": "BR-116",
}


def baixar(nome: str) -> Path:
    destino = CACHE / nome
    if not destino.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"baixando {nome} ...")
        with requests.get(ARQS[nome], stream=True, timeout=600) as r:
            r.raise_for_status()
            with open(destino, "wb") as f:
                for parte in r.iter_content(1 << 20):
                    f.write(parte)
    return destino


def sem_acento(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper()


def via_bonita(via: str) -> str:
    """'AV. PRES. CASTELO BRANCO' → 'Av. Presidente Castelo Branco'."""
    partes = []
    for i, p in enumerate(re.split(r"\s+", via.strip())):
        chave = p.rstrip(".").upper()
        if chave in ABREV:
            partes.append(ABREV[chave])
        elif p.lower() in MINUSC and i > 0:
            partes.append(p.lower())
        else:
            t = p.capitalize()
            partes.append(ACENTOS.get(t, t))
    nome = " ".join(partes)
    return APELIDO.get(nome, nome)


def palavra_chave(via: str) -> str:
    """A palavra mais longa do nome, para conferir se o trecho é da mesma via."""
    toks = [t for t in re.split(r"[^A-Z0-9]+", sem_acento(via)) if len(t) >= 4 and t not in {"AVENIDA", "RUA"}]
    return max(toks, key=len) if toks else ""


# ---------------------------------------------------------------- projeção para o SVG
class Tela:
    def __init__(self, limites):
        x0, y0, x1, y1 = limites
        pad = 300
        self.x0, self.y1 = x0 - pad, y1 + pad
        self.k = LARGURA_SVG / (x1 - x0 + 2 * pad)
        self.w = LARGURA_SVG
        self.h = round((y1 - y0 + 2 * pad) * self.k, 1)

    def xy(self, x, y):
        return round((x - self.x0) * self.k, 1), round((self.y1 - y) * self.k, 1)

    def caminho(self, geom) -> str:
        """Geometria shapely (linha, polígono ou multi) → atributo d do SVG."""
        out = []
        tipo = geom.geom_type
        if tipo.startswith("Multi") or tipo == "GeometryCollection":
            return "".join(self.caminho(g) for g in geom.geoms)
        if tipo == "Polygon":
            for anel in [geom.exterior, *geom.interiors]:
                out.append(self._linha(anel.coords) + "Z")
        elif tipo == "LineString":
            out.append(self._linha(geom.coords))
        return "".join(out)

    def _linha(self, coords):
        pts = [self.xy(x, y) for x, y, *_ in coords]
        s = f"M{pts[0][0]} {pts[0][1]}"
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            s += f"l{round(bx - ax, 1)} {round(by - ay, 1)}"
        return s


def main() -> None:
    # ------------------------------------------------------------ malhas
    bairros = gpd.read_file(ROOT / "data/geo/bairros_fortaleza.geojson").to_crs(UTM)
    tela = Tela(bairros.total_bounds)

    tr = pd.read_csv(baixar("trechos.csv"), usecols=["nome", "class_viaria", "the_geom"])
    tr = gpd.GeoDataFrame(tr, geometry=tr.the_geom.map(wkt.loads), crs=UTM).drop(columns="the_geom")
    tr = tr[tr.nome.notna()]
    tr["nome_sa"] = tr.nome.map(sem_acento)
    principais = tr[tr.class_viaria.isin(CLASSES_BASE)].reset_index(drop=True)

    # ------------------------------------------------------------ radares
    vol = pd.read_csv(baixar("volume.csv"), dtype={"Sitio": str})
    jan = vol[vol.DATA.between(*JANELA)]
    rad = (jan.groupby(["Sitio", "ViaSentido"])
              .agg(vmd=("VMD", "mean"), meses=("VMD", "size"), lon=("Lon", "median"), lat=("Lat", "median"))
              .reset_index())
    rad = rad[rad.meses >= MIN_MESES].copy()
    rad["via"] = rad.ViaSentido.str.replace(r"\s*\[.*$", "", regex=True).str.strip()
    rad["sentido"] = rad.ViaSentido.str.extract(r"\[(.*)\]", expand=False).fillna("")
    rad = gpd.GeoDataFrame(rad, geometry=gpd.points_from_xy(rad.lon, rad.lat), crs="EPSG:4326").to_crs(UTM)

    # cada radar → trecho de via principal mais próximo com a mesma palavra-chave no nome
    idx = principais.sindex
    ruas = []
    for _, r in rad.iterrows():
        chave = palavra_chave(r.via)
        cand = principais.iloc[idx.query(r.geometry.buffer(120))]
        cand = cand.assign(d=cand.distance(r.geometry)).sort_values("d")
        bate = cand[cand.nome_sa.str.contains(chave, regex=False)] if chave else cand.iloc[0:0]
        if len(bate):
            ruas.append(bate.iloc[0].nome)
        elif len(cand) and cand.iloc[0].d < 40:
            ruas.append(cand.iloc[0].nome)
        else:
            ruas.append(None)
    rad["rua"] = ruas
    sem = rad[rad.rua.isna()]
    if len(sem):
        print(f"{len(sem)} radares sem trecho de rua por perto (ficam só como ponto):", sorted(sem.via.unique())[:10])

    # pontos de medição: radares da mesma rua a até 300 m viram um ponto (sentidos somados)
    pontos = []
    for rua, g in rad[rad.rua.notna()].groupby("rua"):
        g = g.sort_values("vmd", ascending=False)
        usados = set()
        for i, r in g.iterrows():
            if i in usados:
                continue
            perto = g[g.distance(r.geometry) <= 300]
            usados |= set(perto.index)
            por_sentido = perto.groupby("sentido").vmd.max()
            x, y = perto.union_all().centroid.coords[0] if len(perto) > 1 else r.geometry.coords[0]
            pontos.append({"rua": rua, "via": via_bonita(r.via), "x": x, "y": y,
                           "vmd": int(round(por_sentido.sum())),
                           "sentidos": {s: int(round(v)) for s, v in por_sentido.items()}})
    pontos = pd.DataFrame(pontos)

    # trechos de cada rua medida → ponto de medição mais próximo da mesma rua
    corredores = []
    for rua, pts in pontos.groupby("rua"):
        seg = tr[tr.nome == rua]
        if seg.empty:
            continue
        cent = seg.geometry.interpolate(0.5, normalized=True)
        pxy = np.array(pts[["x", "y"]])
        d = np.hypot(cent.x.values[:, None] - pxy[:, 0], cent.y.values[:, None] - pxy[:, 1])
        mais = d.argmin(axis=1)
        ok = d.min(axis=1) <= ALCANCE
        for j, (_, p) in enumerate(pts.iterrows()):
            g = seg[(mais == j) & ok]
            if g.empty:
                continue
            geom = g.geometry.union_all().simplify(6)
            corredores.append({"via": p.via, "vmd": p.vmd, "d": tela.caminho(geom)})
    corredores.sort(key=lambda c: c["vmd"])  # os maiores por cima

    ranking = (pontos.sort_values("vmd", ascending=False).drop_duplicates("via").head(15))
    bairro_de = gpd.sjoin(gpd.GeoDataFrame(ranking, geometry=gpd.points_from_xy(ranking.x, ranking.y), crs=UTM),
                          bairros[["nome", "geometry"]], how="left", predicate="within")["nome"]
    ranking = [{"via": r.via, "vmd": int(r.vmd), "bairro": b.title().replace(" De ", " de ").replace(" Do ", " do ").replace(" Da ", " da ").replace(" Dos ", " dos ") if isinstance(b, str) else "",
                "sentidos": len(r.sentidos)} for r, b in zip(ranking.itertuples(), bairro_de)]

    # ------------------------------------------------------------ sinistros
    sj = json.load(open(baixar("sinistros.geojson"), encoding="utf-8"))
    sin = pd.DataFrame([f["properties"] for f in sj["features"]])
    sin["data"] = pd.to_datetime(dict(year=sin.ANO, month=sin.MES, day=sin.DIA), errors="coerce")
    sin["hora"] = pd.to_numeric(sin.HORA.str[:2], errors="coerce")
    anual = (sin.groupby("ANO").agg(sinistros=("COD_ACIDENTE", "size"), mortos=("MORTOS", "sum"),
                                     feridos=("FERIDOS", "sum")).reset_index())
    rec = sin[sin.ANO.isin(ANOS_SIN) & sin.LATITUDE.notna()].copy()
    rec = gpd.GeoDataFrame(rec, geometry=gpd.points_from_xy(rec.LONGITUDE, rec.LATITUDE), crs="EPSG:4326").to_crs(UTM)
    rec = rec[rec.within(bairros.union_all().buffer(200))]
    n_rec = len(rec)

    # mapa de calor: dia da semana (seg=0) x hora, média por semana do período
    semanas = (rec.data.max() - rec.data.min()).days / 7
    calor = (rec.groupby([rec.data.dt.dayofweek, "hora"]).size()
                .unstack(fill_value=0).reindex(index=range(7), columns=range(24), fill_value=0))

    # pontos críticos: quadrículas de 150 m
    q = 150
    rec["qx"] = (rec.geometry.x // q).astype(int)
    rec["qy"] = (rec.geometry.y // q).astype(int)
    quad = (rec.groupby(["qx", "qy"]).agg(n=("COD_ACIDENTE", "size"), mortos=("MORTOS", "sum"),
                                         moto=("MOTOCICLETA", lambda s: int((s > 0).sum())),
                                         x=("geometry", lambda g: g.x.mean()), y=("geometry", lambda g: g.y.mean()),
                                         log=("LOG1", lambda s: s.mode().iat[0] if len(s.mode()) else ""))
               .reset_index())
    quad = quad[quad.n >= 8].sort_values("n", ascending=False).head(160).reset_index(drop=True)
    qg = gpd.GeoDataFrame(quad, geometry=gpd.points_from_xy(quad.x, quad.y), crs=UTM)
    nomes = (gpd.sjoin_nearest(qg, principais[["nome", "geometry"]], how="left", max_distance=80)
                .reset_index().drop_duplicates("index").set_index("index")["nome"])
    quad["local"] = [via_bonita(n) if isinstance(n, str) else via_bonita(str(l).split(",")[0])
                     for n, l in zip(nomes.reindex(quad.index), quad.log)]

    # cada sinistro → via principal a até 35 m (cruzamentos ficam com a mais próxima)
    perto = gpd.sjoin_nearest(rec[["COD_ACIDENTE", "MORTOS", "MOTOCICLETA", "geometry"]],
                              principais[["nome", "geometry"]], how="left", max_distance=35, distance_col="dist")
    perto = perto.drop_duplicates("COD_ACIDENTE")
    por_via = (perto.dropna(subset=["nome"]).groupby("nome")
                    .agg(n=("COD_ACIDENTE", "size"), mortos=("MORTOS", "sum")).reset_index()
                    .sort_values("n", ascending=False).head(12))
    por_via["via"] = por_via.nome.map(via_bonita)

    # ------------------------------------------------------------ base do mapa
    base = {}
    for classe in CLASSES_BASE:
        g = principais[principais.class_viaria == classe].geometry.union_all().simplify(8)
        base[classe] = tela.caminho(g)
    contorno = bairros.geometry.union_all().simplify(25)
    bairros_svg = [{"nome": r.nome, "d": tela.caminho(r.geometry.simplify(20))} for r in bairros.itertuples()]

    def pt(x, y):
        return list(tela.xy(x, y))

    dados = {
        "viewBox": [0, 0, tela.w, tela.h],
        "escala_m_por_unidade": round(1 / tela.k, 2),
        "janela": list(JANELA),
        "anos_sinistros": list(ANOS_SIN),
        "contorno": tela.caminho(contorno),
        "bairros": bairros_svg,
        "base": base,
        "corredores": corredores,
        "radares": [{"via": p.via, "vmd": p.vmd, "xy": pt(p.x, p.y),
                     "sentidos": p.sentidos} for p in pontos.itertuples()],
        "ranking": ranking,
        "resumo": {
            "radares": int(len(rad)),
            "pontos": int(len(pontos)),
            "vias": int(pontos.via.nunique()),
            "sinistros_periodo": int(n_rec),
            "moto_pct": round(float((rec.MOTOCICLETA > 0).mean() * 100), 1),
            "mortos_periodo": int(rec.MORTOS.sum()),
        },
        "anual": anual.to_dict(orient="records"),
        "calor": {"semanas": round(semanas, 1), "matriz": calor.values.tolist()},
        "criticos": [{"xy": pt(r.x, r.y), "n": int(r.n), "mortos": int(r.mortos), "moto": int(r.moto),
                      "local": r.local}
                     for r in quad.itertuples()],
        "sinistros_vias": por_via[["via", "n", "mortos"]].to_dict(orient="records"),
    }
    SAIDA.write_text("window.TRANSITO = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n",
                     encoding="utf-8")
    print(f"{len(rad)} radares em {len(pontos)} pontos de medição, {len(corredores)} trechos de corredor")
    print("ranking:", *(f"{r['via']}: {r['vmd']:,}" for r in ranking[:8]), sep="\n  ")
    print(f"sinistros {ANOS_SIN[0]}–{ANOS_SIN[-1]}: {n_rec}, pontos críticos: {len(quad)}")
    print(f"-> {SAIDA.relative_to(ROOT)} ({SAIDA.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
