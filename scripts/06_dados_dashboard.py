"""Etapa 6 — Exporta os dados do dashboard.

Gera dashboard/data.js (window.DADOS = {...}) com a malha simplificada, os indicadores
por bairro e o contorno das 12 regionais (etapa 8). É um .js, não .json, para o dashboard
abrir direto do disco (file://) sem servidor — fetch() de arquivo local é bloqueado pelos navegadores.
"""
import json
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dashboard/data.js"
MINUSCULAS = {"de", "do", "da", "dos", "das", "e"}
ROMANOS = {"i", "ii", "iii", "xxiii"}

CAMPOS = [
    "ais", "pop_2010", "pop_2022", "area_km2", "densidade_2022",
    "renda_real_2010", "renda_real_2022", "renda_2010", "renda_2022",
    "saneamento_2010", "saneamento_2022", "agua_2010", "agua_2022", "lixo_2010", "lixo_2022",
    "cvli", "cvp", "cvli_2025", "cvp_2025", "cvli_pond", "n_bairros_ais",
    "score_renda_2010", "score_renda_2022", "score_saneamento_2010", "score_saneamento_2022",
    "score_cvli", "score_cvp", "score_seguranca",
    "indice", "indice_socio_2010", "indice_socio_2022",
    "var_renda_real_pct", "var_saneamento_pp", "var_indice_socio",
    "rank_indice", "rank_socio_2010", "rank_socio_2022", "var_rank_socio",
]


def nome_bonito(nome: str) -> str:
    partes = []
    for i, p in enumerate(nome.lower().split(" ")):
        sub = "-".join(
            s.upper() if s in ROMANOS else (s if (s in MINUSCULAS and i > 0) else s[:1].upper() + s[1:])
            for s in p.split("-")
        )
        partes.append(sub)
    return " ".join(partes)


def main() -> None:
    t = pd.read_csv(ROOT / "data/processed/bairros_indice.csv")
    meta = json.loads((ROOT / "data/processed/indice_meta.json").read_text(encoding="utf-8"))
    ais = pd.read_csv(ROOT / "data/raw/seguranca_ais.csv")
    ais = ais[ais.ais.str.match(r"AIS \d+$")]

    g = gpd.read_file(ROOT / "data/geo/bairros_fortaleza.geojson")[["bairro_id", "geometry"]]
    g["geometry"] = g.to_crs(31984).simplify(12, preserve_topology=True).to_crs(4326)  # 12 m
    g = g.merge(t, on="bairro_id")
    reg = pd.read_csv(ROOT / "data/raw/bairro_regional.csv")
    g = g.merge(reg[["bairro_id", "regional"]], on="bairro_id")

    feats = []
    for _, r in g.iterrows():
        props = {"id": int(r.bairro_id), "nome": nome_bonito(r.bairro), "regional": int(r.regional)}
        for c in CAMPOS:
            v = r[c]
            props[c] = v if isinstance(v, str) else (None if pd.isna(v) else round(float(v), 2))
        geom = json.loads(gpd.GeoSeries([r.geometry]).to_json())["features"][0]["geometry"]
        geom["coordinates"] = json.loads(json.dumps(geom["coordinates"]),
                                         parse_float=lambda x: round(float(x), 5))
        feats.append({"type": "Feature", "properties": props, "geometry": geom})

    # Regionais: contorno dos bairros dissolvidos, simplificado como a malha
    rg = gpd.read_file(ROOT / "data/geo/regionais_fortaleza.geojson")
    rg["geometry"] = rg.to_crs(31984).simplify(12, preserve_topology=True).to_crs(4326)
    regionais = []
    rotulos = rg.to_crs(31984).representative_point().to_crs(4326)  # ponto garantido dentro, para o número
    for (_, r), pt in zip(rg.iterrows(), rotulos):
        geom = json.loads(gpd.GeoSeries([r.geometry]).to_json())["features"][0]["geometry"]
        geom["coordinates"] = json.loads(json.dumps(geom["coordinates"]),
                                         parse_float=lambda x: round(float(x), 5))
        regionais.append({"type": "Feature", "geometry": geom, "properties": {
            "regional": int(r.regional), "n_bairros": int(r.n_bairros), "area_km2": round(float(r.area_km2), 1),
            "rotulo": [round(pt.y, 5), round(pt.x, 5)],
            "pop_2022": int(t.merge(reg, on="bairro_id").query("regional == @r.regional").pop_2022.sum()),
        }})

    # Totais da cidade (ponderados) para os números de abertura
    cidade = {
        "pop_2022": int(t.pop_2022.sum()),
        "pop_2010": int(t.pop_2010.sum()),
        "saneamento_2010": round(float((t.saneamento_2010 * t.domicilios_2010).sum() / t.domicilios_2010.sum()), 1),
        "saneamento_2022": round(float((t.saneamento_2022 * t.domicilios_2022).sum() / t.domicilios_2022.sum()), 1),
        "renda_2022_oficial": 3084.07,  # IBGE, município, V06004
        "cvli_cidade": round(float(ais.cvli_media_2023_2025.sum() / t.pop_2022.sum() * 1e5), 1),
        "bairros_perda_renda": int((t.var_renda_real_pct < 0).sum()),
    }
    dados = {
        "geojson": {"type": "FeatureCollection", "features": feats},
        "regionais": {"type": "FeatureCollection", "features": regionais},
        "meta": meta,
        "cidade": cidade,
        "ais": ais[["ais", "cvli_2025", "cvli_media_2023_2025", "cvp_2025", "cvp_media_2023_2025", "n_bairros"]]
               .to_dict(orient="records"),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("window.DADOS = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n",
                   encoding="utf-8")
    print(f"{len(feats)} bairros -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")
    print(cidade)
    print(sorted(f["properties"]["nome"] for f in feats)[:200:12])


if __name__ == "__main__":
    main()
