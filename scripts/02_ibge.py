"""Etapa 2 — IBGE, Censos 2010 e 2022: renda e saneamento por setor censitário (Fortaleza).

A API SIDRA não desce a setor censitário; o IBGE publica esses agregados como arquivos
no FTP (ftp.ibge.gov.br). Este script baixa os arquivos (cache em data/cache/),
recorta Fortaleza (CD_MUN 2304400) e salva:

  data/raw/ibge_2010.csv            indicadores por setor 2010
  data/raw/ibge_2022.csv            indicadores por setor 2022
  data/geo/setores_2010_fortaleza.gpkg   malha de setores 2010
  data/geo/setores_2022_fortaleza.gpkg   malha de setores 2022

Variáveis escolhidas por comparabilidade 2010 x 2022:
  renda   = rendimento nominal médio mensal dos responsáveis COM rendimento
            (2010 Basico V007 | 2022 Renda Responsável V06004). Valores nominais (R$ da época).
  esgoto  = DPP com esgoto via rede geral ou pluvial
            (2010 Domicilio01 V017 | 2022 Domicilio2 V00309)
  agua    = DPP com água da rede geral (2010 V012 | 2022 V00111)
  lixo    = DPP com lixo coletado (2010 V035 | 2022 V00397 + V00398)
Em 2022 o IBGE suprime valores pequenos com "X"; viram vazio (NaN).
Denominador (dpp): 2010 Domicilio01 V002 | 2022 V06001 (responsáveis = DPPO).
"""
import io
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data/cache"
RAW = ROOT / "data/raw"
GEO = ROOT / "data/geo"
COD_MUN = "2304400"  # Fortaleza

FTP22 = "https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022"
FTP10 = "https://ftp.ibge.gov.br/Censos/Censo_Demografico_2010/Resultados_do_Universo/Agregados_por_Setores_Censitarios"
GEOFTP10 = ("https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/"
            "malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2010/setores_censitarios_shp/ce")
URLS = {
    "renda22": f"{FTP22}/Agregados_por_Setores_Censitarios_Rendimento_do_Responsavel/Agregados_por_setores_renda_responsavel_BR_20260508_csv.zip",
    "dom22": f"{FTP22}/Agregados_por_Setores_Censitarios/Agregados_por_Setor_csv/Agregados_por_setores_caracteristicas_domicilio2_BR_20250417.zip",
    "basico22": f"{FTP22}/Agregados_por_Setores_Censitarios/Agregados_por_Setor_csv/Agregados_por_setores_basico_BR_20260520.zip",
    "malha22": f"{FTP22}/Agregados_por_Setores_Censitarios/malha_com_atributos/setores/gpkg/UF/CE/CE_setores_CD2022.gpkg",
    "ce10": f"{FTP10}/CE_20260615.zip",
    "malha10": f"{GEOFTP10}/ce_setores_censitarios.zip",
}



def baixar(chave: str) -> Path:
    destino = CACHE / URLS[chave].rsplit("/", 1)[1]
    if not destino.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"baixando {destino.name} ...")
        with requests.get(URLS[chave], stream=True, timeout=300) as r:
            r.raise_for_status()
            with open(destino, "wb") as f:
                for bloco in r.iter_content(1 << 20):
                    f.write(bloco)
    return destino


def ler_csv_zip(zpath: Path, membro_contem: str, filtro_col: str, usecols=None, **kw) -> pd.DataFrame:
    """Lê um CSV de dentro do zip em blocos, mantendo só linhas de Fortaleza."""
    with zipfile.ZipFile(zpath) as z:
        nome = next(n for n in z.namelist() if membro_contem.lower() in n.lower() and n.lower().endswith(".csv"))
        with z.open(nome) as f:
            partes = []
            for bloco in pd.read_csv(io.TextIOWrapper(f, encoding=kw.pop("encoding", "latin1")), sep=";",
                                     dtype=str, usecols=usecols, chunksize=200_000, **kw):
                partes.append(bloco[bloco[filtro_col].str.startswith(COD_MUN)])
    return pd.concat(partes, ignore_index=True)


def num(s: pd.Series) -> pd.Series:
    """'1.234,5' / '1234.5' / 'X' → float (X = sigilo → NaN)."""
    s = s.str.strip().replace({"X": None, ".": None, "": None})
    if s.str.contains(",", na=False).any():
        s = s.str.replace(".", "", regex=False).str.replace(",", ".", regex=False)
    return pd.to_numeric(s, errors="coerce")


def censo_2022() -> pd.DataFrame:
    renda = ler_csv_zip(baixar("renda22"), "renda", "CD_SETOR")
    dom = ler_csv_zip(baixar("dom22"), "domicilio2", "setor",
                      usecols=["setor", "V00309", "V00310", "V00111", "V00397", "V00398"]).rename(columns={"setor": "CD_SETOR"})
    basico = ler_csv_zip(baixar("basico22"), "basico", "CD_SETOR",
                         usecols=["CD_SETOR", "SITUACAO", "CD_TIPO", "NM_BAIRRO", "v0001", "v0007"])

    df = basico.merge(renda, on="CD_SETOR", how="left").merge(dom, on="CD_SETOR", how="left")
    for c in df.columns.difference(["CD_SETOR", "SITUACAO", "CD_TIPO", "NM_BAIRRO"]):
        df[c] = num(df[c])
    return pd.DataFrame({
        "cd_setor": df["CD_SETOR"],
        "situacao": df["SITUACAO"],
        "cd_tipo": df["CD_TIPO"],
        "nm_bairro_ibge": df["NM_BAIRRO"],
        "pessoas": df["v0001"],
        "responsaveis": df["V06001"],
        "moradores_dpp": df["V06002"],
        "renda_media_resp": df["V06004"],
        "renda_mediana_resp": df["V06006"],
        "dpp": df["V06001"],  # 1 responsável por DPPO; sem sigilo, ao contrário das categorias
        "dpp_esgoto_rede": df["V00309"],
        "dpp_fossa_ligada_rede": df["V00310"],
        "dpp_agua_rede": df["V00111"],
        "dpp_lixo_coletado": df[["V00397", "V00398"]].sum(axis=1, min_count=1),
    })


def censo_2010() -> pd.DataFrame:
    z = baixar("ce10")
    basico = ler_csv_zip(z, "csv/basico_", "Cod_setor",
                         usecols=["Cod_setor", "Nome_do_bairro", "Situacao_setor", "V001", "V002", "V005", "V007"])
    dom = ler_csv_zip(z, "csv/domicilio01_", "Cod_setor",
                      usecols=["Cod_setor", "V002", "V012", "V016", "V017", "V018", "V035"])
    resp = ler_csv_zip(z, "csv/responsavelrenda_", "Cod_setor",
                       usecols=["Cod_setor", "V020", "V021", "V022"])
    df = (basico.merge(dom, on="Cod_setor", how="left", suffixes=("", "_dom"))
                .merge(resp, on="Cod_setor", how="left", suffixes=("", "_resp")))
    for c in df.columns.difference(["Cod_setor", "Nome_do_bairro", "Situacao_setor"]):
        df[c] = num(df[c])
    return pd.DataFrame({
        "cd_setor": df["Cod_setor"],
        "situacao": df["Situacao_setor"],
        "nm_bairro_ibge": df["Nome_do_bairro"],
        "responsaveis": df["V020"],
        "responsaveis_com_renda": df["V021"],
        "renda_total_resp": df["V022"],
        "moradores_dpp": df["V002"],
        "renda_media_resp": df["V007"],
        "renda_media_resp_com_sem": df["V005"],
        "dpp": df["V002_dom"],
        "dpp_esgoto_rede": df["V017"],
        "dpp_fossa_septica": df["V018"],
        "dpp_agua_rede": df["V012"],
        "dpp_lixo_coletado": df["V035"],
    })


def malhas() -> None:
    m22 = gpd.read_file(baixar("malha22"), where=f"CD_MUN = '{COD_MUN}'", columns=["CD_SETOR", "CD_MUN"])
    z10 = baixar("malha10")
    m10 = gpd.read_file(f"zip://{z10}")
    m10 = m10[m10["CD_GEOCODM"] == COD_MUN][["CD_GEOCODI", "geometry"]].rename(columns={"CD_GEOCODI": "cd_setor"})
    m22 = m22.rename(columns={"CD_SETOR": "cd_setor"})[["cd_setor", "geometry"]]
    for ano, m in (("2010", m10), ("2022", m22)):
        out = GEO / f"setores_{ano}_fortaleza.gpkg"
        out.unlink(missing_ok=True)
        m.to_crs(4326).to_file(out, driver="GPKG")
        print(f"malha {ano}: {len(m)} setores -> {out.relative_to(ROOT)}")


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    for ano, df in (("2010", censo_2010()), ("2022", censo_2022())):
        out = RAW / f"ibge_{ano}.csv"
        df.to_csv(out, index=False, encoding="utf-8")
        print(f"ibge {ano}: {len(df)} setores -> {out.relative_to(ROOT)}")
    malhas()


if __name__ == "__main__":
    main()
