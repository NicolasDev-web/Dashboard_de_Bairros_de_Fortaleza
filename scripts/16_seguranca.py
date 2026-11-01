"""Etapa 16 — Aperreio: a página de segurança (onde a violência pesa mais em Fortaleza).

Junta o que as etapas anteriores já produziram, por AIS (as 10 Áreas Integradas de Segurança de
Fortaleza; a SSPDS não publica dado por bairro):
  - data/raw/seguranca_ais_anual.csv (etapa 3): CVLI, CVP e intervenção policial por AIS, 2019–2025
  - data/processed/bairros_indicadores.csv (etapa 4): população, renda e saneamento por bairro
  - IDH por bairro (SDE/Prefeitura, Censo 2010), do Portal de Dados Abertos de Fortaleza
  - raça das vítimas: SIM/DATASUS (declarações de óbito, DOCEaaaa.dbc em data/cache/sim/) e cor ou
    raça do Censo 2022 por setor (IBGE)
  - série anual do Ceará, 2009–2025, transcrita dos boletins "Estatísticas Mensais" de CVLI e CVP
    da SSPDS/GEESP (dezembro de 2025)

Taxas por 100 mil moradores (Censo 2022), média de 2023 a 2025.

Saída: dashboard/seguranca.js
"""
import importlib.util
import json
import unicodedata
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
SAIDA = ROOT / "dashboard/seguranca.js"
UTM = "EPSG:31984"
IDH_URL = ("https://dados.fortaleza.ce.gov.br/dataset/607f1ecf-73b3-4ef1-9a4f-0db2eb8c7b39/resource/"
           "f7cf7081-b0e3-4c9c-b89e-0ee1b3755437/download/indicededesenvolvimentohumano.xlsx")
IDH_CACHE = ROOT / "data/cache/sde/idh_bairros.xlsx"
ANOS_MEDIA = (2023, 2024, 2025)

# SSPDS/GEESP, "Estatísticas Mensais" de CVLI e de CVP (boletim de dez/2025): vítimas de CVLI e
# ocorrências de CVP no Ceará por ano.
CEARA_CVLI = {2009: 2262, 2010: 2803, 2011: 2806, 2012: 3730, 2013: 4395, 2014: 4439, 2015: 4019,
              2016: 3407, 2017: 5133, 2018: 4518, 2019: 2257, 2020: 4039, 2021: 3299, 2022: 2970,
              2023: 2970, 2024: 3272, 2025: 3021}
CEARA_CVP = {2009: 44206, 2010: 41414, 2011: 35040, 2012: 48830, 2013: 51414, 2014: 33969, 2015: 60964,
             2016: 72661, 2017: 76047, 2018: 64513, 2019: 49579, 2020: 53956, 2021: 48141, 2022: 45930,
             2023: 42607, 2024: 35657, 2025: 27842}

_spec = importlib.util.spec_from_file_location("transito14", ROOT / "scripts/14_transito.py")
t14 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(t14)


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return " ".join(s.lower().replace("-", " ").split())


def titulo(s: str) -> str:
    t = str(s).title()
    for a in (" De ", " Do ", " Da ", " Dos ", " Das ", " E ", " Ii", " Iii"):
        t = t.replace(a, a.lower() if a.strip() in ("De", "Do", "Da", "Dos", "Das", "E") else a.upper())
    return t


def idh() -> pd.DataFrame:
    if not IDH_CACHE.exists():
        IDH_CACHE.parent.mkdir(parents=True, exist_ok=True)
        IDH_CACHE.write_bytes(requests.get(IDH_URL, timeout=120).content)
    x = pd.read_excel(IDH_CACHE)
    x["bairro_slug"] = x["Bairros"].map(slug)
    alias = {"amadeo furtado": "amadeu furtado", "arraial moura brasil": "moura brasil",
             "boa vista": "boa vista castelao", "genibau": "parque genibau", "luciano cavalcante":
             "engenheiro luciano cavalcante", "novo mondubim*": "novo mondubim", "olavo oliveira*": "olavo oliveira",
             "parque santa maria*": "parque santa maria", "prefeito jose valter": "prefeito jose walter",
             "sao joao do tauape": "tauape", "sapiranga/coite": "sapiranga coite", "vila ellery": "ellery",
             "vila pery": "vila peri", "vincente pinzon": "vicente pinzon"}
    # Dendê (bairro de 2019, desmembrado do Edson Queiroz) não está na malha usada pelo painel
    x["bairro_slug"] = x.bairro_slug.replace(alias)
    x["IDH"] = pd.to_numeric(x["IDH"], errors="coerce")
    return x.loc[x.IDH.notna(), ["bairro_slug", "IDH"]].rename(columns={"IDH": "idh"})


FAIXAS = [(0, 17, "até 17"), (18, 24, "18 a 24"), (25, 29, "25 a 29"), (30, 39, "30 a 39"),
          (40, 59, "40 a 59"), (60, 200, "60 ou mais")]
ESCOLA = {"Não Alfabetizado": "Até o fundamental", "Alfabetizado": "Até o fundamental",
          "Ensino Fundamental Incompleto": "Até o fundamental", "Ensino Fundamental Completo": "Até o fundamental",
          "Ensino Médio Incompleto": "Médio", "Ensino Médio Completo": "Médio",
          "Superior Incompleto": "Superior", "Superior Completo": "Superior"}
DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]


def detalhes() -> dict:
    """Planilhas de dados detalhados da SSPDS (as mesmas da etapa 3), só Fortaleza."""
    cache = ROOT / "data/cache/sspds"
    cvli = pd.read_excel(cache / "CVLI_2009-a-2025.xlsx", sheet_name="CVLI")
    cvp = pd.read_excel(cache / "CVP_2009-a-2025.xlsx", sheet_name=0)
    out = {}
    for nome, df in (("cvli", cvli), ("cvp", cvp)):
        df = df[df["Município"].astype(str).str.strip().str.lower() == "fortaleza"].copy()
        df["data"] = pd.to_datetime(df.Data, errors="coerce")
        df["ano"] = df.data.dt.year
        df["hora"] = pd.to_datetime(df.Hora.astype(str), format="%H:%M:%S", errors="coerce").dt.hour
        out[f"serie_{nome}"] = {int(k): int(v) for k, v in df.groupby("ano").size().items()}
        r = df[df.ano.isin(ANOS_MEDIA)]
        m = (r.groupby([r.data.dt.dayofweek, "hora"]).size().unstack(fill_value=0)
              .reindex(index=range(7), columns=range(24), fill_value=0))
        out[f"calor_{nome}"] = m.values.tolist()
        out[f"n_{nome}"] = int(len(r))
        if nome == "cvli":
            idade = pd.to_numeric(r["Idade da Vítima"], errors="coerce")
            faixas = {rot: int(((idade >= a) & (idade <= b)).sum()) for a, b, rot in FAIXAS}
            faixas["não informada"] = int(idade.isna().sum())
            esc = r["Escolaridade da Vítima"].map(ESCOLA).fillna("Não informada").value_counts()
            out["perfil"] = {
                "genero": r["Gênero"].value_counts().to_dict(),
                "idade": faixas,
                "meio": r["Meio Empregado"].value_counts().to_dict(),
                "natureza": r["Natureza"].str.capitalize().value_counts().to_dict(),
                "escolaridade": {k: int(esc.get(k, 0)) for k in ("Até o fundamental", "Médio", "Superior", "Não informada")},
                "raca_nao_informada_pct": round(float((r["Raça da Vítima"] == "Não Informada").mean() * 100)),
                "idade_mediana": float(idade.median()),
            }
            out["perfil"] = json.loads(json.dumps(out["perfil"], default=int))
    return out


COR_URL = ("https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios/"
           "Agregados_por_Setor_csv/Agregados_por_setores_cor_ou_raca_BR.zip")
SIM_DIR = ROOT / "data/cache/sim"
SIM_ANOS = (2023, 2024, 2025)        # mesma janela das taxas da SSPDS; 2026 ainda está pela metade
# Em 2025 o SIM ainda é preliminar: muitas mortes violentas esperam o laudo e ficam como "intenção
# indeterminada". As por arma de fogo (Y22–Y24) entram na conta: em 2025, agressões (537) + arma de
# fogo com intenção indeterminada (221) = 758, perto dos 743 CVLI da SSPDS. Nos anos fechados elas
# são poucas (9 a 41 por ano).
CID_HOMICIDIO = r"^(X8[5-9]|X9\d|Y0\d|Y2[2-4])"
COR_SIM = {"1": "branca", "2": "preta", "3": "amarela", "4": "parda", "5": "indigena"}


def cor_por_setor() -> pd.DataFrame:
    """Censo 2022, pessoas por cor ou raça em cada setor de Fortaleza (V01317–V01321)."""
    cache = ROOT / "data/cache/ibge/cor_raca_fortaleza.csv"
    if not cache.exists():
        import io, zipfile
        z = ROOT / "data/cache/ibge/cor_raca_2022.zip"
        if not z.exists():
            z.parent.mkdir(parents=True, exist_ok=True)
            z.write_bytes(requests.get(COR_URL, timeout=900).content)
        with zipfile.ZipFile(z) as zf:
            nome = zf.namelist()[0]
            partes = [c[c.CD_SETOR.str.startswith("2304400")]
                      for c in pd.read_csv(zf.open(nome), sep=";", dtype=str, chunksize=200000, encoding="latin-1")]
        pd.concat(partes).to_csv(cache, index=False)
    d = pd.read_csv(cache, dtype=str)
    for col, nome in (("V01317", "branca"), ("V01318", "preta"), ("V01319", "amarela"), ("V01320", "parda"),
                      ("V01321", "indigena")):
        d[nome] = pd.to_numeric(d[col], errors="coerce").fillna(0)
    d = d.rename(columns={"CD_SETOR": "cd_setor"})[["cd_setor", "branca", "preta", "amarela", "parda", "indigena"]]
    setores = gpd.read_file(ROOT / "data/geo/setores_2022_fortaleza.gpkg")
    bairros = gpd.read_file(ROOT / "data/geo/bairros_fortaleza.geojson").to_crs(setores.crs)
    pts = setores.assign(geometry=setores.representative_point())
    j = gpd.sjoin(pts, bairros[["bairro_id", "geometry"]], predicate="within").drop_duplicates("cd_setor")
    return d.merge(j[["cd_setor", "bairro_id"]], on="cd_setor", how="left")


def raca_sim(pop_cor: dict) -> dict | None:
    """Homicídios (agressões, CID X85–Y09, mais arma de fogo com intenção indeterminada, Y22–Y24) ocorridos em Fortaleza no SIM/DATASUS, por raça/cor.

    Arquivos DOCEaaaa.dbc (DATASUS, Transferência de Arquivos > SIM > DO) em data/cache/sim/.
    """
    arqs = sorted(SIM_DIR.glob("DOCE20*.dbc"))
    if not arqs:
        print("sem arquivos do SIM em data/cache/sim/ — a raça das vítimas fica de fora")
        return None
    import datasus_dbc
    from dbfread import DBF
    serie, base = {}, []
    for a in arqs:
        ano = int(a.stem[-4:])
        dbf = a.with_suffix(".dbf")
        if not dbf.exists():
            datasus_dbc.decompress(str(a), str(dbf))
        t = pd.DataFrame(iter(DBF(dbf, encoding="latin-1", char_decode_errors="ignore")))
        t = t[t.CAUSABAS.astype(str).str.match(CID_HOMICIDIO) & t.CODMUNOCOR.astype(str).str.startswith("230440")]
        cor = t.RACACOR.astype(str).map(COR_SIM).fillna("ignorada")
        n = len(t)
        serie[ano] = {"n": n, "fogo_indeterminada": int(t.CAUSABAS.astype(str).str.match(r"^Y2[2-4]").sum()),
                      "negros_pct": round(float(cor.isin(["preta", "parda"]).mean() * 100), 1),
                      "ignorada_pct": round(float((cor == "ignorada").mean() * 100), 1),
                      "parcial": ano > max(SIM_ANOS)}
        if ano in SIM_ANOS:
            base.append(pd.DataFrame({"cor": cor, "sexo": t.SEXO.astype(str)}))
    b = pd.concat(base)
    neg = b.cor.isin(["preta", "parda"])
    nn = b.cor.isin(["branca", "amarela", "indigena"])
    pop_neg = pop_cor["preta"] + pop_cor["parda"]
    pop_nn = pop_cor["branca"] + pop_cor["amarela"] + pop_cor["indigena"]
    anos = len(SIM_ANOS)
    mulheres = b[b.sexo == "2"]
    return {
        "anos": list(SIM_ANOS),
        "serie": serie,
        "n": int(len(b)),
        "contagem": {k: int(v) for k, v in b.cor.value_counts().items()},
        "vitimas_negras_pct": round(float(neg.mean() * 100), 1),
        "mulheres_negras_pct": round(float(mulheres.cor.isin(["preta", "parda"]).mean() * 100), 1),
        "pop_negra_pct": round(pop_neg / (pop_neg + pop_nn) * 100, 1),
        "pop": {k: int(v) for k, v in pop_cor.items()},
        "taxa_negros": round(neg.sum() / anos / pop_neg * 1e5, 1),
        "taxa_nao_negros": round(nn.sum() / anos / pop_nn * 1e5, 1),
    }


def main() -> None:
    ind = pd.read_csv(ROOT / "data/processed/bairros_indicadores.csv")
    ind = ind.merge(idh(), on="bairro_slug", how="left")
    sem_idh = ind[ind.idh.isna()].bairro.tolist()
    if sem_idh:
        print("bairros sem IDH (ficam fora da média da AIS):", sem_idh)
    anual = pd.read_csv(ROOT / "data/raw/seguranca_ais_anual.csv")

    malha = gpd.read_file(ROOT / "data/geo/bairros_fortaleza.geojson").to_crs(UTM)
    malha = malha.merge(ind[["bairro_id", "ais"]], on="bairro_id")
    tela = t14.Tela(malha.total_bounds)
    cores = cor_por_setor().merge(ind[["bairro_id", "ais"]], on="bairro_id", how="left")
    COLS_COR = ["branca", "preta", "amarela", "parda", "indigena"]
    negros_ais = (cores.groupby("ais")[COLS_COR].sum()
                  .pipe(lambda g: (g.preta + g.parda) / g.sum(axis=1) * 100).round(1))

    def media_pond(g, col):
        ok = g[col].notna() & g.pop_2022.notna()
        return float(np.average(g.loc[ok, col], weights=g.loc[ok, "pop_2022"])) if ok.any() else None

    areas = []
    for ais, g in ind.groupby("ais"):
        pop = float(g.pop_2022.sum())
        serie = {}
        for indic in ("cvli", "cvp", "intervencao_policial"):
            a = anual[(anual.ais == ais) & (anual.indicador == indic)].set_index("ano").ocorrencias
            serie[indic] = {int(k): int(v) for k, v in a.items()}
        def taxa(indic):
            vals = [serie[indic].get(y, 0) for y in ANOS_MEDIA]
            return round(sum(vals) / len(vals) / pop * 1e5, 1)
        geom = malha[malha.ais == ais].geometry.union_all()
        cx, cy = geom.representative_point().coords[0]
        areas.append({
            "ais": ais, "num": ais.replace("AIS ", ""),
            "bairros": sorted(titulo(b) for b in g.bairro),
            # nome para leigo: os dois bairros mais populosos da área
            "regiao": " e ".join(titulo(b) for b in g.sort_values("pop_2022", ascending=False).bairro.head(2)),
            "pop": int(pop),
            "cvli_taxa": taxa("cvli"), "cvp_taxa": taxa("cvp"),
            "cvli": serie["cvli"], "cvp": serie["cvp"], "intervencao": serie["intervencao_policial"],
            "renda": round(media_pond(g, "renda_2022")), "saneamento": round(media_pond(g, "saneamento_2022"), 1),
            "idh": round(media_pond(g, "idh"), 3), "densidade": round(pop / g.area_km2.sum()),
            "negros": float(negros_ais.get(ais, np.nan)),
            "d": tela.caminho(geom.simplify(25)), "centro": list(tela.xy(cx, cy)),
        })
    areas.sort(key=lambda a: -a["cvli_taxa"])

    pop_cidade = float(ind.pop_2022.sum())
    anos = sorted(anual.ano.unique())
    forta = {ind_: {int(y): int(anual[(anual.indicador == ind_) & (anual.ano == y)].ocorrencias.sum()) for y in anos}
             for ind_ in ("cvli", "cvp")}
    cidade = {
        "pop": int(pop_cidade),
        "cvli_taxa": round(np.mean([forta["cvli"][y] for y in ANOS_MEDIA]) / pop_cidade * 1e5, 1),
        "cvp_taxa": round(np.mean([forta["cvp"][y] for y in ANOS_MEDIA]) / pop_cidade * 1e5, 1),
        "serie": forta,
    }
    det = detalhes()
    cidade["serie"] = {"cvli": det.pop("serie_cvli"), "cvp": det.pop("serie_cvp")}
    # correlação simples entre renda/IDH e taxa de CVLI nas 10 áreas (para o texto, não para modelo)
    df = pd.DataFrame(areas)
    corr = {c: round(float(np.corrcoef(df[c], df.cvli_taxa)[0, 1]), 2) for c in ("renda", "idh", "saneamento", "negros")}
    raca = raca_sim({c: float(cores[c].sum()) for c in COLS_COR})

    dados = {
        "viewBox": [0, 0, tela.w, tela.h],
        "anos_media": list(ANOS_MEDIA),
        "areas": areas,
        "bairros": [{"nome": titulo(r.nome), "ais": r.ais, "d": tela.caminho(r.geometry.simplify(20))}
                    for r in malha.itertuples()],
        "contorno": tela.caminho(malha.geometry.union_all().simplify(25)),
        "cidade": cidade,
        "ceara": {"cvli": CEARA_CVLI, "cvp": CEARA_CVP},
        "correlacao": corr,
        "dias": DIAS,
        "raca": raca,
        **det,
    }
    SAIDA.write_text("window.SEGURANCA = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n",
                     encoding="utf-8")
    print(df[["ais", "pop", "cvli_taxa", "cvp_taxa", "renda", "idh", "saneamento", "negros"]].to_string(index=False))
    if raca:
        print("raça (SIM):", {k: v for k, v in raca.items() if k not in ("serie", "pop")})
    print("cidade:", {k: v for k, v in cidade.items() if k != "serie"}, "correlação com a taxa de CVLI:", corr)
    print(f"-> {SAIDA.relative_to(ROOT)} ({SAIDA.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
