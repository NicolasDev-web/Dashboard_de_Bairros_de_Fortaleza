"""Etapa 1 — Malha de bairros de Fortaleza (Seuma, mai/2025).

Baixa o KMZ oficial, converte para GeoJSON (EPSG:4326) e valida os 121 bairros.
Saída: data/geo/bairros_fortaleza.geojson
"""
import unicodedata
import zipfile
from pathlib import Path

import geopandas as gpd
import requests

ROOT = Path(__file__).resolve().parents[1]
KMZ_URL = (
    "https://dados.fortaleza.ce.gov.br/dataset/a90409b9-4c2c-4ad0-bcc0-3e24a381c531/"
    "resource/08c58502-965e-4f28-bb6e-b08dab04b788/download/bairros_2025.kmz"
)
KMZ = ROOT / "data/raw/bairros_2025.kmz"
KML = ROOT / "data/raw/bairros_2025.kml"
OUT = ROOT / "data/geo/bairros_fortaleza.geojson"
N_BAIRROS = 121


def slug(nome: str) -> str:
    """Chave de junção: sem acento, minúscula, espaços simples."""
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return " ".join(s.lower().replace("-", " ").split())


def main() -> None:
    if not KMZ.exists():
        KMZ.parent.mkdir(parents=True, exist_ok=True)
        KMZ.write_bytes(requests.get(KMZ_URL, timeout=60).content)
    with zipfile.ZipFile(KMZ) as z:
        KML.write_bytes(z.read("doc.kml"))

    # O KML tem duas camadas: NOMES (pontos de rótulo) e POLIGONAIS (limites).
    gdf = gpd.read_file(KML, layer="POLIGONAIS")
    gdf = gdf.to_crs(4326)
    gdf["geometry"] = gdf.geometry.make_valid()

    gdf["nome"] = gdf["nome"].str.strip()
    gdf["bairro_id"] = gdf["id2"].astype(int)  # "id" do schema vira "id2" no GDAL
    gdf["bairro_slug"] = gdf["nome"].map(slug)
    gdf["area_km2"] = gdf.to_crs(31984).area / 1e6  # SIRGAS 2000 / UTM 24S
    gdf = gdf[["bairro_id", "nome", "bairro_slug", "legislacao", "area_km2", "geometry"]]
    gdf = gdf.sort_values("nome").reset_index(drop=True)

    assert len(gdf) == N_BAIRROS, f"esperado {N_BAIRROS} bairros, veio {len(gdf)}"
    assert gdf["bairro_slug"].is_unique, gdf[gdf["bairro_slug"].duplicated(keep=False)]
    assert gdf["bairro_id"].is_unique

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.unlink(missing_ok=True)
    gdf.to_file(OUT, driver="GeoJSON", COORDINATE_PRECISION=6)
    print(f"{len(gdf)} bairros -> {OUT.relative_to(ROOT)}  (área total {gdf.area_km2.sum():.1f} km²)")


if __name__ == "__main__":
    main()
