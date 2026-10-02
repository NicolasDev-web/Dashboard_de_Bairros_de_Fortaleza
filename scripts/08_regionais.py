"""Etapa 8 — Regionais de Fortaleza: bairro -> Secretaria Regional.

Desde jan/2021 a cidade tem 12 Secretarias Regionais (Decreto nº 14.899, de
31/12/2020). A composição abaixo é a do decreto; os nomes seguem a malha da Seuma
de 2025, que difere da grafia do decreto em alguns bairros:

  decreto                    malha 2025
  São João do Tauape      -> Tauape
  Luciano Cavalcante      -> Engenheiro Luciano Cavalcante
  Sapiranga               -> Sapiranga-Coité
  Boa Vista               -> Boa Vista-Castelão
  José Walter             -> Prefeito José Walter
  Santa Maria             -> Parque Santa Maria
  Vila Manoel Sátiro      -> Manoel Sátiro
  Panamericano            -> Pan-Americano
  Genibaú                 -> Parque Genibaú
  Dendê                   -> Rachel de Queiroz (renomeado pelo Decreto Legislativo nº 1089/2023)

Saídas: data/raw/bairro_regional.csv e data/geo/regionais_fortaleza.geojson (bairros dissolvidos).
"""
import unicodedata
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
BAIRROS = ROOT / "data/geo/bairros_fortaleza.geojson"
OUT_CSV = ROOT / "data/raw/bairro_regional.csv"
OUT_GEO = ROOT / "data/geo/regionais_fortaleza.geojson"

REGIONAIS = {
    1: ["Álvaro Weyne", "Barra do Ceará", "Carlito Pamplona", "Cristo Redentor", "Floresta", "Jacarecanga",
        "Jardim Guanabara", "Jardim Iracema", "Pirambu", "Vila Velha"],
    2: ["Aldeota", "Cais do Porto", "De Lourdes", "Dionísio Torres", "Joaquim Távora", "Meireles", "Mucuripe",
        "Papicu", "Tauape", "Varjota", "Vicente Pinzón"],
    3: ["Amadeu Furtado", "Antônio Bezerra", "Ellery", "Farias Brito", "Monte Castelo", "Olavo Oliveira",
        "Padre Andrade", "Parque Araxá", "Parquelândia", "Presidente Kennedy", "Quintino Cunha",
        "Rodolfo Teófilo", "São Gerardo"],
    4: ["Aeroporto", "Benfica", "Bom Futuro", "Damas", "Fátima", "Itaoca", "Jardim América", "José Bonifácio",
        "Montese", "Parangaba", "Parreão", "Vila Peri", "Vila União"],
    5: ["Bom Jardim", "Bonsucesso", "Granja Lisboa", "Granja Portugal", "Siqueira"],
    6: ["Aerolândia", "Alto da Balança", "Cambeba", "Cidade dos Funcionários", "Coaçu", "Curió", "Guajeru",
        "Jardim das Oliveiras", "José de Alencar", "Lagoa Redonda", "Messejana", "Parque Iracema",
        "Parque Manibura", "Paupina", "São Bento"],
    7: ["Cidade 2000", "Cocó", "Edson Queiroz", "Guararapes", "Engenheiro Luciano Cavalcante",
        "Manuel Dias Branco", "Praia do Futuro I", "Praia do Futuro II", "Sabiaguaba", "Salinas",
        "Sapiranga-Coité"],
    8: ["Boa Vista-Castelão", "Rachel de Queiroz", "Dias Macêdo", "Itaperi", "Prefeito José Walter",
        "Parque Dois Irmãos", "Passaré", "Planalto Ayrton Senna", "Serrinha"],
    9: ["Ancuri", "Barroso", "Cajazeiras", "Conjunto Palmeiras", "Jangurussu", "Pedras", "Parque Santa Maria"],
    10: ["Aracapé", "Canindezinho", "Conjunto Esperança", "Jardim Cearense", "Manoel Sátiro", "Maraponga",
         "Mondubim", "Novo Mondubim", "Parque Presidente Vargas", "Parque Santa Rosa", "Parque São José"],
    11: ["Autran Nunes", "Bela Vista", "Conjunto Ceará I", "Conjunto Ceará II", "Couto Fernandes",
         "Demócrito Rocha", "Dom Lustosa", "Henrique Jorge", "João XXIII", "Jóquei Clube", "Pan-Americano",
         "Parque Genibaú", "Pici"],
    12: ["Centro", "Moura Brasil", "Praia de Iracema"],
}


def slug(nome: str) -> str:
    """Mesma chave de junção da etapa 1."""
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return " ".join(s.lower().replace("-", " ").split())


def main() -> None:
    g = gpd.read_file(BAIRROS)
    linhas = [{"bairro_slug": slug(b), "regional": r} for r, bs in REGIONAIS.items() for b in bs]
    reg = pd.DataFrame(linhas)
    assert reg.bairro_slug.is_unique, reg[reg.bairro_slug.duplicated(keep=False)]

    g = g.merge(reg, on="bairro_slug", how="left")
    sem = g[g.regional.isna()].nome.tolist()
    sobra = sorted(set(reg.bairro_slug) - set(g.bairro_slug))
    assert not sem and not sobra, f"sem regional: {sem}; fora da malha: {sobra}"
    g["regional"] = g.regional.astype(int)

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    g[["bairro_id", "nome", "bairro_slug", "regional"]].sort_values(["regional", "nome"]).to_csv(OUT_CSV, index=False)

    d = g[["regional", "area_km2", "geometry"]].dissolve(by="regional", aggfunc={"area_km2": "sum"}).reset_index()
    d["n_bairros"] = g.groupby("regional").size().reindex(d.regional).values
    OUT_GEO.unlink(missing_ok=True)
    d.to_file(OUT_GEO, driver="GeoJSON", COORDINATE_PRECISION=6)
    print(d[["regional", "n_bairros", "area_km2"]].round(1).to_string(index=False))
    print(f"-> {OUT_CSV.relative_to(ROOT)}, {OUT_GEO.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
