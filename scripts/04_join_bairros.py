"""Etapa 4 — Join espacial setor censitário → bairro e consolidação por bairro.

Método: interseção de áreas (SIRGAS 2000 / UTM 24S). Cada setor reparte suas CONTAGENS
entre os bairros na proporção da área que cai em cada um (frações normalizadas para
somar 1 dentro do município — a malha de 2010 tem bordas no mar que ficam fora dos bairros).
Médias nunca são rateadas diretamente: reparte-se o total (média × peso) e o peso, e a
média do bairro é total / peso.

  renda   2010: soma(renda_total_resp) / soma(responsaveis_com_renda)   (exato)
          2022: soma(renda_media_resp × responsaveis) / soma(responsaveis) (o IBGE não
                publica o nº de responsáveis com rendimento em 2022; ver limitações)
  saneamento = % de domicílios com esgoto via rede geral ou pluvial
               (2022: + fossa séptica ligada à rede, categoria que não existia em 2010)
  segurança  = taxa por 100 mil habitantes da AIS (população 2022 da AIS = soma dos
               seus bairros), média 2023–2025; o mesmo valor para todos os bairros da AIS.

Em 2022 alguns setores têm células suprimidas ("X"); nesses casos o setor sai do
numerador E do denominador daquele indicador.

Saída: data/processed/bairros_indicadores.csv
"""
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
UTM = 31984
OUT = ROOT / "data/processed/bairros_indicadores.csv"
MEDIA = "media_2023_2025"


def pesos_setor_bairro(ano: str, bairros: gpd.GeoDataFrame) -> pd.DataFrame:
    """cd_setor, bairro_id, peso (fração da área do setor dentro de cada bairro)."""
    s = gpd.read_file(ROOT / f"data/geo/setores_{ano}_fortaleza.gpkg").to_crs(UTM)
    o = gpd.overlay(s, bairros[["bairro_id", "geometry"]], how="intersection", keep_geom_type=True)
    o["area"] = o.area
    o = o[o["area"] > 1]  # descarta lascas de digitalização (< 1 m²)
    o["peso"] = o["area"] / o.groupby("cd_setor")["area"].transform("sum")
    return pd.DataFrame(o[["cd_setor", "bairro_id", "peso"]])


def ratear(dados: pd.DataFrame, pesos: pd.DataFrame, colunas: list[str]) -> pd.DataFrame:
    """Soma por bairro das colunas, rateadas pelo peso de área. NaN fica NaN (não vira 0)."""
    d = pesos.merge(dados, on="cd_setor", how="inner")
    for c in colunas:
        d[c] = d[c] * d["peso"]
    return d.groupby("bairro_id")[colunas].sum(min_count=1)


def pct(num: pd.Series, den: pd.Series) -> pd.Series:
    return (num / den * 100).round(2)


def indicadores_2010(pesos: pd.DataFrame) -> pd.DataFrame:
    d = pd.read_csv(ROOT / "data/raw/ibge_2010.csv", dtype={"cd_setor": str})
    for c in ("dpp_esgoto_rede", "dpp_agua_rede", "dpp_lixo_coletado"):
        d[f"dpp_{c}"] = d["dpp"].where(d[c].notna())  # denominador só onde há numerador
    cols = ["moradores_dpp", "dpp", "responsaveis_com_renda", "renda_total_resp",
            "dpp_esgoto_rede", "dpp_agua_rede", "dpp_lixo_coletado",
            "dpp_dpp_esgoto_rede", "dpp_dpp_agua_rede", "dpp_dpp_lixo_coletado"]
    r = ratear(d, pesos, cols)
    return pd.DataFrame({
        "pop_2010": r["moradores_dpp"].round(0),
        "domicilios_2010": r["dpp"].round(0),
        "renda_2010": (r["renda_total_resp"] / r["responsaveis_com_renda"]).round(2),
        "saneamento_2010": pct(r["dpp_esgoto_rede"], r["dpp_dpp_esgoto_rede"]),
        "agua_2010": pct(r["dpp_agua_rede"], r["dpp_dpp_agua_rede"]),
        "lixo_2010": pct(r["dpp_lixo_coletado"], r["dpp_dpp_lixo_coletado"]),
    })


def indicadores_2022(pesos: pd.DataFrame) -> pd.DataFrame:
    d = pd.read_csv(ROOT / "data/raw/ibge_2022.csv", dtype={"cd_setor": str})
    d["renda_x_resp"] = d["renda_media_resp"] * d["responsaveis"]
    d["resp_com_renda_inf"] = d["responsaveis"].where(d["renda_media_resp"].notna())
    # 2022 separa "fossa séptica ligada à rede", que em 2010 era declarada como rede geral.
    # Soma-se para manter a comparabilidade (X na fossa = valor pequeno suprimido → 0).
    d["dpp_esgoto_rede"] = d["dpp_esgoto_rede"] + d["dpp_fossa_ligada_rede"].fillna(0)
    for c in ("dpp_esgoto_rede", "dpp_agua_rede", "dpp_lixo_coletado"):
        d[f"dpp_{c}"] = d["dpp"].where(d[c].notna())
    cols = ["pessoas", "dpp", "renda_x_resp", "resp_com_renda_inf",
            "dpp_esgoto_rede", "dpp_agua_rede", "dpp_lixo_coletado",
            "dpp_dpp_esgoto_rede", "dpp_dpp_agua_rede", "dpp_dpp_lixo_coletado"]
    r = ratear(d, pesos, cols)
    return pd.DataFrame({
        "pop_2022": r["pessoas"].round(0),
        "domicilios_2022": r["dpp"].round(0),
        "renda_2022": (r["renda_x_resp"] / r["resp_com_renda_inf"]).round(2),
        "saneamento_2022": pct(r["dpp_esgoto_rede"], r["dpp_dpp_esgoto_rede"]),
        "agua_2022": pct(r["dpp_agua_rede"], r["dpp_dpp_agua_rede"]),
        "lixo_2022": pct(r["dpp_lixo_coletado"], r["dpp_dpp_lixo_coletado"]),
    })


def seguranca(tab: pd.DataFrame) -> pd.DataFrame:
    seg = pd.read_csv(ROOT / "data/raw/seguranca_ais.csv")
    pop_ais = tab.groupby("ais")["pop_2022"].sum().rename("pop_ais_2022")
    seg = seg.merge(pop_ais, left_on="ais", right_index=True, how="inner")  # descarta "Não Identificada"
    return pd.DataFrame({
        "ais": seg["ais"],
        "pop_ais_2022": seg["pop_ais_2022"],
        "cvli": (seg[f"cvli_{MEDIA}"] / seg["pop_ais_2022"] * 1e5).round(2),
        "cvp": (seg[f"cvp_{MEDIA}"] / seg["pop_ais_2022"] * 1e5).round(1),
        "cvli_2025": (seg["cvli_2025"] / seg["pop_ais_2022"] * 1e5).round(2),
        "cvp_2025": (seg["cvp_2025"] / seg["pop_ais_2022"] * 1e5).round(1),
        "cvli_ocorrencias_media": seg[f"cvli_{MEDIA}"],
        "cvp_ocorrencias_media": seg[f"cvp_{MEDIA}"],
    })


def validar(tab: pd.DataFrame) -> None:
    ibge22 = pd.read_csv(ROOT / "data/raw/ibge_2022.csv", dtype={"cd_setor": str})
    ibge10 = pd.read_csv(ROOT / "data/raw/ibge_2010.csv", dtype={"cd_setor": str})
    assert len(tab) == 121 and tab["bairro"].is_unique
    assert abs(tab.pop_2022.sum() - ibge22.pessoas.sum()) < 5, "população 2022 não fecha"
    assert abs(tab.pop_2010.sum() - ibge10.moradores_dpp.sum()) < 5, "população 2010 não fecha"
    vazios = tab.columns[tab.isna().any()].tolist()
    print("colunas com vazios:", {c: int(tab[c].isna().sum()) for c in vazios} or "nenhuma")

    # Conferência: o IBGE 2022 já marca o bairro de cada setor. Compara população.
    from importlib import import_module
    slug = import_module("01_malha_bairros").slug
    ibge22["bairro_slug"] = ibge22["nm_bairro_ibge"].fillna("").map(slug)
    pop_ibge = ibge22.groupby("bairro_slug")["pessoas"].sum()
    cmp = tab.set_index("bairro_slug")["pop_2022"].to_frame().join(pop_ibge.rename("pop_ibge"))
    cmp["dif_pct"] = (cmp.pop_2022 / cmp.pop_ibge - 1) * 100
    print(f"bairros com nome casado no IBGE 2022: {cmp.pop_ibge.notna().sum()}/121; "
          f"|dif. pop| > 5%: {(cmp.dif_pct.abs() > 5).sum()}")
    grandes = cmp[cmp.dif_pct.abs() > 5].sort_values("dif_pct")
    if len(grandes):
        print(grandes.round(1).to_string())


def main() -> None:
    import sys
    sys.path.insert(0, str(ROOT / "scripts"))
    bairros = gpd.read_file(ROOT / "data/geo/bairros_fortaleza.geojson").to_crs(UTM)
    ba = pd.read_csv(ROOT / "data/raw/bairro_ais.csv")[["bairro_id", "ais"]]

    tab = (bairros[["bairro_id", "nome", "bairro_slug", "area_km2"]]
           .merge(ba, on="bairro_id")
           .merge(indicadores_2010(pesos_setor_bairro("2010", bairros)), left_on="bairro_id", right_index=True, how="left")
           .merge(indicadores_2022(pesos_setor_bairro("2022", bairros)), left_on="bairro_id", right_index=True, how="left"))
    tab = tab.merge(seguranca(tab), on="ais", how="left")
    tab = tab.rename(columns={"nome": "bairro"})
    tab["densidade_2022"] = (tab.pop_2022 / tab.area_km2).round(0)
    tab["area_km2"] = tab["area_km2"].round(3)

    principais = ["bairro", "ais", "renda_2010", "renda_2022", "saneamento_2010", "saneamento_2022", "cvli", "cvp"]
    tab = tab[principais + [c for c in tab.columns if c not in principais]].sort_values("bairro")
    validar(tab)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tab.to_csv(OUT, index=False, encoding="utf-8")
    print(f"{len(tab)} bairros -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
