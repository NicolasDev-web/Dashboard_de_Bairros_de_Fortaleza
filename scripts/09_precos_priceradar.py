"""Etapa 9 — Preço dos imóveis por regional, coletado com o PriceRadar.

O PriceRadar (github.com/NicolasDev-web/priceradar) faz a parte difícil: raspa os
portais (VivaReal, Zap, ImovelWeb, ChavesNaMão, OLX), descarta locação, faixa de
área e valor implausível, junta o mesmo imóvel anunciado em portais diferentes e
tira os outliers com Random Forest. Este script só chama a busca dele
(`services.search.executar_busca`, a mesma da rota /api/buscar) para Fortaleza,
põe cada anúncio num dos 121 bairros oficiais e resume por regional com as mesmas
contas do `ResumoBairro` do PriceRadar: mediana e média do preço por m².

Uma busca do PriceRadar exige faixa de preço, então a cidade é varrida em faixas
que juntas cobrem o mercado. Depois, cada regional com menos de --reforco anúncios
ganha uma busca só com os bairros dela, porque a varredura da cidade inteira
concentra o resultado onde há mais oferta (Aldeota, Meireles, Cocó).

Uso:
  python scripts/09_precos_priceradar.py                       # coleta nova com o PriceRadar e agrega
  python scripts/09_precos_priceradar.py --fonte historico     # usa as buscas já gravadas no priceradar.db
  python scripts/09_precos_priceradar.py --fonte csv           # só reagrega a última coleta
  python scripts/09_precos_priceradar.py --priceradar C:/caminho/priceradar

`--fonte historico` não raspa nada: lê os anúncios de Fortaleza que as buscas
feitas no app gravaram no banco do PriceRadar nos últimos --dias (90 por padrão),
ficando com a leitura mais recente de cada anúncio.

O PriceRadar é procurado em --priceradar, depois em $PRICERADAR_DIR e por fim na
pasta vizinha a este repositório (../priceradar). O .env dele vale aqui também.

Saídas: data/raw/priceradar_anuncios.csv (a coleta, para reagregar sem raspar de
novo), data/processed/precos_bairros.csv, data/processed/precos_regionais.csv e
dashboard/precos.js.
"""
import argparse
import asyncio
import json
import os
import sqlite3
import sys
import time
import unicodedata
from datetime import datetime
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
BAIRROS = ROOT / "data/geo/bairros_fortaleza.geojson"
REGIONAL = ROOT / "data/raw/bairro_regional.csv"
RAW = ROOT / "data/raw/priceradar_anuncios.csv"
OUT_BAIRROS = ROOT / "data/processed/precos_bairros.csv"
OUT_REGIONAIS = ROOT / "data/processed/precos_regionais.csv"
OUT_JS = ROOT / "dashboard/precos.js"

CIDADE = "Fortaleza, CE"
# Faixas de preço total (R$). Contíguas: o PriceRadar ainda aceita 10% de folga na
# borda, e o anúncio que cair em duas faixas sai na deduplicação por URL.
FAIXAS = [(80_000, 250_000), (250_000, 400_000), (400_000, 650_000),
          (650_000, 1_000_000), (1_000_000, 1_800_000), (1_800_000, 5_000_000)]
FAIXA_REFORCO = (80_000, 5_000_000)
PAUSA_ENTRE_BUSCAS = 20  # s; os portais pontuam rajada (ver .claude/documentacaoantibot.md do PriceRadar)

# Mesmo papel do `pouco_confiavel` da evolução por bairro do PriceRadar: abaixo
# disso o número aparece, mas marcado — mediana de 3 anúncios não é preço de bairro.
MIN_AMOSTRA_BAIRRO = 5
MIN_AMOSTRA_REGIONAL = 15
QUARTOS = ["1", "2", "3", "4+"]

# Só a coordenada publicada pelo portal localiza o anúncio melhor que o nome do bairro.
ORIGEM_EXATA = {"exata"}

# Nome usado pelos portais -> bairro da malha 2025 (slug). O que não está aqui é
# comparado direto com o slug oficial.
APELIDOS = {
    "sao joao do tauape": "tauape",
    "luciano cavalcante": "engenheiro luciano cavalcante",
    "eng luciano cavalcante": "engenheiro luciano cavalcante",
    "sapiranga": "sapiranga coite",
    "coite": "sapiranga coite",
    "lagoa da sapiranga": "sapiranga coite",
    "boa vista": "boa vista castelao",
    "castelao": "boa vista castelao",
    "jose walter": "prefeito jose walter",
    "conjunto prefeito jose walter": "prefeito jose walter",
    "santa maria": "parque santa maria",
    "vila manoel satiro": "manoel satiro",
    "manuel satiro": "manoel satiro",
    "panamericano": "pan americano",
    "genibau": "parque genibau",
    "dende": "rachel de queiroz",
    "dias macedo": "dias macedo",
    "alagadico": "sao gerardo",
    "bairro de fatima": "fatima",
    "ellery": "ellery",
    "vila ellery": "ellery",
    "joquei clube": "joquei clube",
    "dionisio torres": "dionisio torres",
    "vicente pinzon": "vicente pinzon",
    "jardim iracema": "jardim iracema",
    "cidade 2000": "cidade 2000",
    "presidente vargas": "parque presidente vargas",
    "manibura": "parque manibura",
    "parque manibura": "parque manibura",
    "conjunto esperanca": "conjunto esperanca",
    "parque iracema": "parque iracema",
    "mucuripe": "mucuripe",
    "praia de iracema": "praia de iracema",
    "dois irmaos": "parque dois irmaos",
}
# Nomes que os portais usam para uma área partida em mais de um bairro oficial,
# mas toda dentro de uma regional: dá para contar na regional, não no bairro.
APELIDOS_REGIONAL = {
    "praia do futuro": 7,
    "conjunto ceara": 11,
}
# Nome que o portal entende, para as buscas de reforço por bairro.
NOME_NO_PORTAL = {
    "tauape": "São João do Tauape",
    "sapiranga coite": "Sapiranga",
    "boa vista castelao": "Castelão",
    "parque genibau": "Genibaú",
    "rachel de queiroz": "Dendê",
    "manoel satiro": "Vila Manoel Sátiro",
    "pan americano": "Pan Americano",
}

NOMES_REGIONAL = {r: f"Regional {r}" for r in range(1, 13)}


def slug(nome: str) -> str:
    """Mesma chave de junção da etapa 1."""
    s = unicodedata.normalize("NFKD", str(nome)).encode("ascii", "ignore").decode()
    return " ".join(s.lower().replace("-", " ").replace(".", " ").split())


# ---------------------------------------------------------------------------
# Coleta (PriceRadar)
# ---------------------------------------------------------------------------
def achar_priceradar(arg: str | None) -> Path:
    candidatos = [arg, os.getenv("PRICERADAR_DIR"), ROOT.parent / "priceradar"]
    for c in candidatos:
        if not c:
            continue
        base = Path(c).expanduser().resolve()
        for back in (base / "priceradar/backend", base / "backend", base):
            if (back / "services/search.py").exists():
                return back
    raise SystemExit(
        "PriceRadar não encontrado. Clone github.com/NicolasDev-web/priceradar ao lado deste "
        "repositório ou passe --priceradar <pasta>."
    )


def carregar_priceradar(backend: Path):
    """Importa o backend do PriceRadar como ele roda: a partir da própria pasta, com o .env dele."""
    os.chdir(backend)  # caches do PriceRadar (data/) são relativos ao backend
    sys.path.insert(0, str(backend))
    try:
        from dotenv import load_dotenv
        load_dotenv(backend / ".env")
    except ImportError:
        pass
    if os.getenv("MOCK", "false").lower() == "true":
        raise SystemExit("O .env do PriceRadar está com MOCK=true: os dados seriam fictícios. Desligue para coletar.")
    from models import BuscaRequest
    from services.search import executar_busca
    return BuscaRequest, executar_busca


def rodar_busca(BuscaRequest, executar_busca, rotulo: str, preco_min: float, preco_max: float,
                bairros: list[str] | None = None) -> pd.DataFrame:
    req = BuscaRequest(cidade=CIDADE, preco_min=preco_min, preco_max=preco_max, bairros=bairros)
    t0 = time.time()
    res = asyncio.run(executar_busca(req))
    d = res.diagnostico
    print(f"  {rotulo}: {res.total} anúncios em {time.time() - t0:.0f}s"
          f" (brutos {d.total_bruto if d else '?'}; ok {d.fontes_ok if d else []};"
          f" erro {d.fontes_erro if d else []})")
    linhas = [{
        "url_anuncio": e.url_anuncio, "portal": e.portal, "cidade": e.cidade, "bairro_portal": e.bairro,
        "latitude": e.latitude, "longitude": e.longitude, "origem_coordenada": e.origem_coordenada,
        "preco": e.preco, "area_m2": e.area_m2, "preco_m2": e.preco_m2, "quartos": e.quartos,
        "tipo_edificacao": e.tipo_edificacao, "nome_empreendimento": e.nome_empreendimento,
        "construtora": e.construtora, "data_coleta": e.data_coleta.isoformat(timespec="seconds"),
        "busca": rotulo,
    } for e in res.empreendimentos]
    return pd.DataFrame(linhas)


def coletar(args) -> pd.DataFrame:
    backend = achar_priceradar(args.priceradar)
    print(f"PriceRadar: {backend}")
    BuscaRequest, executar_busca = carregar_priceradar(backend)
    faixas = FAIXAS if not args.faixas else [tuple(float(x) * 1000 for x in f.split("-")) for f in args.faixas.split(",")]

    partes = []
    print(f"Varredura de {CIDADE} em {len(faixas)} faixas de preço")
    for i, (a, b) in enumerate(faixas):
        if i:
            time.sleep(PAUSA_ENTRE_BUSCAS)
        partes.append(rodar_busca(BuscaRequest, executar_busca, f"faixa {a / 1e3:.0f}-{b / 1e3:.0f} mil", a, b))
    anuncios = juntar(partes)

    if args.reforco:
        reg = pd.read_csv(REGIONAL)
        contagem = atribuir(anuncios)[0].regional.value_counts()
        fracas = [r for r in range(1, 13) if contagem.get(r, 0) < args.reforco]
        if fracas:
            print(f"Reforço por bairro nas regionais com menos de {args.reforco} anúncios: {fracas}")
        for r in fracas:
            nomes = [NOME_NO_PORTAL.get(s, nome_bonito(n)) for s, n in reg[reg.regional == r][["bairro_slug", "nome"]].values]
            time.sleep(PAUSA_ENTRE_BUSCAS)
            partes.append(rodar_busca(BuscaRequest, executar_busca, f"reforço regional {r}", *FAIXA_REFORCO, nomes))
        anuncios = juntar(partes)
    return anuncios


def ler_historico(args) -> pd.DataFrame:
    """Anúncios de Fortaleza gravados pelas buscas do app, a leitura mais recente de cada um."""
    backend = achar_priceradar(args.priceradar)
    url = os.getenv("DATABASE_URL", "")
    db = Path(url.split("///", 1)[1]) if url.startswith("sqlite") and "///" in url else backend / "priceradar.db"
    if not db.is_absolute():
        db = backend / db
    if not db.exists():
        raise SystemExit(f"Banco do PriceRadar não encontrado em {db}. Faça uma busca no app ou use a coleta nova.")
    desde = (pd.Timestamp.now() - pd.Timedelta(days=args.dias)).strftime("%Y-%m-%d")
    sql = """
        SELECT e.url_anuncio, e.portal, e.cidade, e.bairro AS bairro_portal, e.latitude, e.longitude,
               e.origem_coordenada, e.preco, e.area_m2, e.preco_m2, e.quartos, e.tipo_edificacao,
               e.nome_empreendimento, e.construtora, e.data_coleta, 'historico' AS busca
        FROM empreendimentos e JOIN buscas b ON b.id = e.busca_id
        WHERE lower(b.cidade) LIKE 'fortaleza%' AND e.data_coleta >= ?
        ORDER BY e.data_coleta DESC
    """
    with sqlite3.connect(f"file:{db}?mode=ro", uri=True) as con:
        df = pd.read_sql_query(sql, con, params=[desde])
    print(f"Histórico do PriceRadar ({db}): {len(df)} leituras desde {desde}")
    return juntar([df])


def juntar(partes: list[pd.DataFrame]) -> pd.DataFrame:
    """Concatena as buscas tirando o anúncio repetido (mesma URL sem query, como o PriceRadar compara)."""
    df = pd.concat([p for p in partes if len(p)], ignore_index=True) if any(len(p) for p in partes) else pd.DataFrame()
    if df.empty:
        return df
    chave = df.url_anuncio.fillna("").str.split("?").str[0].str.split("#").str[0].str.rstrip("/")
    return df[~chave.duplicated()].reset_index(drop=True)


# ---------------------------------------------------------------------------
# Anúncio -> bairro -> regional
# ---------------------------------------------------------------------------
def atribuir(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Põe cada anúncio num bairro oficial e numa regional.

    Ordem: coordenada exata do portal (ponto no polígono) > nome do bairro dado
    pelo portal > coordenada aproximada > apelido que só resolve a regional.
    """
    g = gpd.read_file(BAIRROS)[["bairro_id", "bairro_slug", "geometry"]]
    reg = pd.read_csv(REGIONAL)[["bairro_id", "regional"]]
    reg_por_id = dict(zip(reg.bairro_id, reg.regional))
    id_por_slug = dict(zip(g.bairro_slug, g.bairro_id))

    df = df.copy()
    diag = {"coletados": len(df)}

    # Anúncio de outra cidade (Caucaia, Eusébio...) não entra. `cidade` vem normalizada do PriceRadar.
    if "cidade" in df and df.cidade.notna().any():
        fora = df.cidade.notna() & ~df.cidade.map(lambda c: "fortaleza" in slug(c))
        diag["outra_cidade"] = int(fora.sum())
        df = df[~fora]

    tem_xy = df.latitude.notna() & df.longitude.notna()
    pts = gpd.GeoDataFrame(df[tem_xy], geometry=gpd.points_from_xy(df.longitude[tem_xy], df.latitude[tem_xy]), crs=4326)
    pip = gpd.sjoin(pts, g[["bairro_id", "geometry"]], how="left", predicate="within")
    pip = pip[~pip.index.duplicated()]["bairro_id"]
    df["bairro_pip"] = pip.reindex(df.index)

    def por_nome(nome):
        if not isinstance(nome, str) or not nome.strip():
            return None
        s = slug(nome)
        return id_por_slug.get(APELIDOS.get(s, s))

    df["bairro_nome"] = df.bairro_portal.map(por_nome)
    exata = df.origem_coordenada.isin(ORIGEM_EXATA) & df.bairro_pip.notna()
    df["bairro_id"] = df.bairro_pip.where(exata, df.bairro_nome).fillna(df.bairro_pip)
    df["metodo"] = "sem_bairro"
    df.loc[df.bairro_nome.notna(), "metodo"] = "nome"
    df.loc[exata, "metodo"] = "coordenada"
    df.loc[df.bairro_nome.isna() & ~exata & df.bairro_pip.notna(), "metodo"] = "coordenada_aprox"

    # Coordenada exata fora de todos os bairros = fora do município.
    fora_xy = df.origem_coordenada.isin(ORIGEM_EXATA) & tem_xy.reindex(df.index) & df.bairro_pip.isna()
    diag["coordenada_fora_da_cidade"] = int(fora_xy.sum())
    df = df[~fora_xy]

    df["regional"] = df.bairro_id.map(reg_por_id)
    so_nome = df.bairro_portal.map(lambda n: APELIDOS_REGIONAL.get(slug(n)) if isinstance(n, str) else None).astype(float)
    so_reg = df.regional.isna() & so_nome.notna()
    df["regional"] = df.regional.fillna(so_nome)
    df.loc[so_reg, "metodo"] = "so_regional"

    sem = df.regional.isna()
    diag["sem_bairro"] = int(sem.sum())
    diag["sem_bairro_nomes"] = df[sem].bairro_portal.fillna("(vazio)").value_counts().head(15).to_dict()
    diag["metodo"] = df[~sem].metodo.value_counts().to_dict()
    df = df[~sem].copy()
    df["regional"] = df.regional.astype(int)
    df["bairro_id"] = df.bairro_id.astype("Int64")
    diag["usados"] = len(df)
    return df, diag


# ---------------------------------------------------------------------------
# Resumo (as contas do ResumoBairro do PriceRadar, mais quartis)
# ---------------------------------------------------------------------------
def classe_quartos(q):
    if pd.isna(q):
        return None
    q = int(q)
    return "4+" if q >= 4 else str(q) if q >= 1 else None


def resumo(grupo: pd.DataFrame) -> dict:
    p = grupo.preco_m2
    return {
        "n": int(len(grupo)),
        "mediana": round(float(p.median()), 0),
        "media": round(float(p.mean()), 0),
        "p25": round(float(p.quantile(0.25)), 0),
        "p75": round(float(p.quantile(0.75)), 0),
        "min": round(float(p.min()), 0),
        "max": round(float(p.max()), 0),
        "preco_mediano": round(float(grupo.preco.median()), -3),
        "area_mediana": round(float(grupo.area_m2.median()), 0),
    }


def resumir(df: pd.DataFrame, chave: str, minimo: int) -> pd.DataFrame:
    linhas = []
    df = df.assign(classe=df.quartos.map(classe_quartos))
    for k, grp in df.groupby(chave):
        base = {chave: k, "quartos": "todos", **resumo(grp), "pouco_confiavel": len(grp) < minimo}
        linhas.append(base)
        for c in QUARTOS:
            sub = grp[grp.classe == c]
            if len(sub):
                linhas.append({chave: k, "quartos": c, **resumo(sub), "pouco_confiavel": len(sub) < minimo})
    return pd.DataFrame(linhas)


def nome_bonito(nome: str) -> str:
    peq = {"de", "do", "da", "dos", "das", "e"}
    rom = {"i", "ii", "iii", "xxiii"}
    return " ".join(
        "-".join(s.upper() if s in rom else (s if (s in peq and i) else s[:1].upper() + s[1:]) for s in p.split("-"))
        for i, p in enumerate(nome.lower().split(" "))
    )


def exportar(df: pd.DataFrame, diag: dict) -> None:
    reg = pd.read_csv(REGIONAL)
    rb = resumir(df[df.bairro_id.notna()].assign(bairro_id=lambda d: d.bairro_id.astype(int)), "bairro_id", MIN_AMOSTRA_BAIRRO)
    rr = resumir(df, "regional", MIN_AMOSTRA_REGIONAL)

    rb_out = rb.merge(reg, on="bairro_id", how="left")
    OUT_BAIRROS.parent.mkdir(parents=True, exist_ok=True)
    rb_out.sort_values(["regional", "nome", "quartos"]).to_csv(OUT_BAIRROS, index=False)
    rr.sort_values(["regional", "quartos"]).to_csv(OUT_REGIONAIS, index=False)

    def registros(t: pd.DataFrame, chave: str) -> dict:
        saida = {}
        for k, grp in t.groupby(chave):
            saida[str(int(k))] = {
                r.quartos: {"n": int(r.n), "pouco_confiavel": bool(r.pouco_confiavel),
                            **{c: float(r[c]) for c in ["mediana", "media", "p25", "p75", "min", "max",
                                                         "preco_mediano", "area_mediana"]}}
                for _, r in grp.iterrows()
            }
        return saida

    datas = pd.to_datetime(df.data_coleta)
    dados = {
        "fonte": "PriceRadar",
        "cidade": CIDADE,
        "coleta_inicio": datas.min().strftime("%Y-%m-%d"),
        "coleta_fim": datas.max().strftime("%Y-%m-%d"),
        "total": int(len(df)),
        "portais": df.portal.value_counts().to_dict(),
        "min_amostra": {"bairro": MIN_AMOSTRA_BAIRRO, "regional": MIN_AMOSTRA_REGIONAL},
        "cidade_resumo": resumo(df),
        "diagnostico": diag,
        "regionais": registros(rr, "regional"),
        "bairros": registros(rb, "bairro_id"),
    }
    OUT_JS.write_text("window.PRECOS = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n",
                      encoding="utf-8")

    t = rr[rr.quartos == "todos"].sort_values("mediana", ascending=False)
    print(f"\n{len(df)} anúncios usados de {diag['coletados']} coletados; método: {diag['metodo']}")
    if diag["sem_bairro"]:
        print(f"sem bairro: {diag['sem_bairro']} — nomes mais comuns: {diag['sem_bairro_nomes']}")
    print("\nPreço por m² por regional (R$):")
    print(t[["regional", "n", "mediana", "media", "p25", "p75", "preco_mediano"]].to_string(index=False))
    print(f"\n-> {OUT_BAIRROS.relative_to(ROOT)}, {OUT_REGIONAIS.relative_to(ROOT)}, {OUT_JS.relative_to(ROOT)}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--priceradar", help="pasta do PriceRadar (raiz do repositório ou o backend)")
    ap.add_argument("--fonte", choices=["coleta", "historico", "csv"], default="coleta",
                    help="coleta nova (padrão), histórico do priceradar.db ou o último data/raw/priceradar_anuncios.csv")
    ap.add_argument("--dias", type=int, default=90, help="com --fonte historico: janela em dias")
    ap.add_argument("--faixas", help="faixas em mil reais, ex.: 80-250,250-400")
    ap.add_argument("--reforco", type=int, default=40,
                    help="busca por bairro nas regionais com menos anúncios que isso (0 desliga)")
    args = ap.parse_args()

    if args.fonte == "csv":
        if not RAW.exists():
            raise SystemExit(f"{RAW.relative_to(ROOT)} não existe: rode com --fonte coleta ou historico primeiro.")
        anuncios = pd.read_csv(RAW)
    else:
        anuncios = coletar(args) if args.fonte == "coleta" else ler_historico(args)
        if anuncios.empty:
            raise SystemExit("O PriceRadar não trouxe nenhum anúncio. Veja o diagnóstico acima (fontes com erro).")
        RAW.parent.mkdir(parents=True, exist_ok=True)
        anuncios.to_csv(RAW, index=False)
        print(f"{len(anuncios)} anúncios únicos -> {RAW.relative_to(ROOT)}")

    df, diag = atribuir(anuncios)
    if df.empty:
        raise SystemExit("Nenhum anúncio pôde ser posto num bairro de Fortaleza.")
    exportar(df, diag)


if __name__ == "__main__":
    main()
