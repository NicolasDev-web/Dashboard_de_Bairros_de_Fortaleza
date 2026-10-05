"""Etapa 12 — Tempo e rotas de ônibus (e metrô/VLT) entre os bairros e os polos de Fortaleza.

Fontes:
  - GTFS da ETUFOR (ônibus municipais), cópia de 11/2023 do Mobility Database: o do portal de
    dados abertos da Prefeitura (03/2026) não traz as viagens de dia útil
  - GTFS do Metrofor (metrô e VLT), se disponível, com o calendário movido para a vigência
    da ETUFOR (os horários continuam os dele; ver --deslocar-calendario)
  - ruas do OpenStreetMap (caminhada até a parada), baixadas do Overpass e gravadas em .osm.pbf

Roteamento com r5py (R5, o mesmo motor do projeto Acesso a Oportunidades do IPEA):
  - saída: um ponto por bairro, no centro ponderado pela população dos setores de 2022
    (onde as pessoas moram, não o meio geográfico do polígono)
  - chegada: os mesmos 121 bairros e os polos abaixo (pontos de trabalho, estudo e eventos)
  - dia útil dentro da vigência do GTFS (sábado se o GTFS não tiver viagem de dia útil),
    saída entre 6h30 e 8h; o tempo é de porta a
    porta (caminhada, espera, viagem, baldeação) e sai a mediana da janela, com o 25º e
    o 75º percentis como faixa ("entre 45 e 60 min, conforme o horário de saída")
  - rotas detalhadas (linhas, onde subir e descer) saindo entre 7h e 7h05, até 3 alternativas, de cada
    bairro até os polos. Bairro a bairro sai só o tempo: o R5 devolve centenas de
    alternativas por par e os 16 mil pares levariam horas (--rotas-entre-bairros liga isso)

É tempo de TABELA: o GTFS diz quando o ônibus deveria passar, não quando passa. No
pico, o resultado tende a ser otimista, e a página diz isso.

Uso:
  python scripts/12_transporte.py                  # baixa o que faltar, calcula tudo
  python scripts/12_transporte.py --sem-rotas      # só a matriz de tempos (rápido)
  python scripts/12_transporte.py --rotas-entre-bairros   # rotas também bairro a bairro (horas)
  python scripts/12_transporte.py --da-tabela      # refaz transporte.js da última tabela, sem rotear
  python scripts/12_transporte.py --gtfs a.zip b.zip --osm ruas.osm.pbf
  python scripts/12_transporte.py --gtfs etufor_2023.zip metrofor.zip --deslocar-calendario metrofor
      # vigências que não se cruzam: move as datas do Metrofor para a vigência da ETUFOR
      # (sem --gtfs isso já é o padrão; com --gtfs, só se pedir)

Precisa de Java 21 (o r5py usa o R5, escrito em Java) e de `pip install r5py osmium`.

Saídas:
  dashboard/transporte.js              tempos (bairro -> bairros e polos), polos, linhas
  dashboard/transporte_linhas.js       traçado de cada linha (carregado só quando precisa)
  dashboard/transporte/o_<id>.js       rotas detalhadas saindo de cada bairro (sob demanda)
  data/processed/transporte_tempos.csv
"""
import argparse
import datetime as dt
import io
import json
import sys
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import requests
from shapely.geometry import LineString, Point

ROOT = Path(__file__).resolve().parents[1]
BAIRROS = ROOT / "data/geo/bairros_fortaleza.geojson"
SETORES = ROOT / "data/geo/setores_2022_fortaleza.gpkg"
IBGE_2022 = ROOT / "data/raw/ibge_2022.csv"
CACHE = ROOT / "data/cache/transporte"
OUT_JS = ROOT / "dashboard/transporte.js"
OUT_LINHAS = ROOT / "dashboard/transporte_linhas.js"
OUT_ROTAS = ROOT / "dashboard/transporte"
OUT_CSV = ROOT / "data/processed/transporte_tempos.csv"
OUT_META = ROOT / "data/processed/transporte_meta.json"  # dia de referência e GTFS da tabela acima
UTM = 31984

GTFS_URLS = {
    # Cópia do Mobility Database (vigência 10/11/2023 a 10/02/2024, 27.340 viagens de dia útil). O
    # GTFS do portal da Prefeitura (03/2026, .../resource/7058bfbe-5ba2-45f4-9a91-af1508a7c05b/download/
    # arquivo_google.zip) declara o dia útil no calendar.txt mas não traz nenhuma viagem dele, e o
    # recurso é sobrescrito a cada mês (as versões antigas somem). A rede mudou pouco de 2023 para
    # 2026: 312 linhas em comum de 318/325, 93% das paradas a até 30 m, sábado com -2,6% de viagens.
    "etufor": "https://storage.googleapis.com/mdb-latest/br-ceara-etufor-gtfs-2011.zip",
    # Link da página https://www.ce.gov.br/metrofor/gtfs/ (o endereço antigo, metrofor.ce.gov.br,
    # redireciona para lá). Se mudar, baixe à mão e passe com --gtfs; sem ele, metrô e VLT
    # ficam de fora (só ônibus).
    "metrofor": "https://info.metrofor.ce.gov.br/gtfs_file",
}
# Sem --gtfs, o calendário deste feed vai para a vigência da ETUFOR quando as duas não se cruzam
# (o Metrofor vale 2026-27; a ETUFOR acima, 2023-24).
DESLOCAR_PADRAO = "metrofor"
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://z.overpass-api.de/api/interpreter",
            "https://lz4.overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
# O Overpass responde 406 ao User-Agent padrão do requests ("python-requests/x").
CABECALHO = {"User-Agent": "Dashboard-de-Bairros-de-Fortaleza/1.0 (scripts/12_transporte.py)"}

# Polos de trabalho, estudo e eventos. O ponto é o lugar em si; `bairro` confere que ele
# caiu no bairro certo da malha de 2025 (se não cair, o script avisa e para). Terminais,
# shopping e Centro de Eventos conferidos com o OpenStreetMap em 10/2026.
POLOS = [
    ("centro", "Centro (Praça do Ferreira)", -3.72760, -38.52650, "CENTRO"),
    ("beira_mar", "Beira-Mar", -3.72540, -38.49700, "MEIRELES"),
    ("aldeota", "Aldeota (Av. Santos Dumont)", -3.73820, -38.50020, "ALDEOTA"),
    ("papicu", "Papicu (terminal)", -3.73830, -38.48518, "PAPICU"),
    ("iguatemi", "Iguatemi", -3.75543, -38.48877, "EDSON QUEIROZ"),
    ("unifor", "Unifor", -3.76890, -38.47840, "EDSON QUEIROZ"),
    ("centro_eventos", "Centro de Eventos", -3.76453, -38.48042, "EDSON QUEIROZ"),
    ("parangaba", "Parangaba (terminal)", -3.77630, -38.56330, "PARANGABA"),
    ("messejana", "Messejana (terminal)", -3.83130, -38.50194, "MESSEJANA"),
    ("ufc_benfica", "UFC Benfica", -3.74210, -38.53860, "BENFICA"),
    ("ufc_pici", "UFC Pici", -3.74370, -38.57440, "PICI"),
    ("aeroporto", "Aeroporto", -3.77630, -38.53250, "AEROPORTO"),
]

SAIDA_INICIO = dt.time(6, 30)
JANELA = dt.timedelta(minutes=90)
SAIDA_ROTAS = dt.time(7, 0)
# O R5 gera alternativas para cada minuto da janela; 5 min bastam para as 3 opções mostradas
# (com 20 min a memória passou de 4,5 GB sem terminar)
JANELA_ROTAS = dt.timedelta(minutes=5)
LOTE_ROTAS = 10  # bairros de saída por vez na fase das rotas
MAX_TEMPO = dt.timedelta(minutes=150)
MAX_OPCOES = 3
MAX_A_PE = 30  # min: só mostra a opção "a pé" quando ela é curta


# ---------------------------------------------------------------------------
# Entradas
# ---------------------------------------------------------------------------
def baixar(url: str, destino: Path) -> Path | None:
    if destino.exists():
        return destino
    try:
        r = requests.get(url, timeout=180, headers=CABECALHO)
        r.raise_for_status()
        zipfile.ZipFile(io.BytesIO(r.content))  # confere que é um zip de verdade
    except Exception as e:
        print(f"  não consegui baixar {url}: {e}")
        return None
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(r.content)
    return destino


def ruas_pbf(bairros: gpd.GeoDataFrame) -> Path:
    """Ruas de Fortaleza (mais 2 km de borda) do Overpass, gravadas em .osm.pbf para o R5."""
    pbf = CACHE / "fortaleza_ruas.osm.pbf"
    if pbf.exists():
        return pbf
    import osmium  # pip install osmium

    x0, y0, x1, y1 = bairros.to_crs(UTM).total_bounds
    caixa = gpd.GeoSeries([Point(x0 - 2000, y0 - 2000), Point(x1 + 2000, y1 + 2000)], crs=UTM).to_crs(4326)
    s, w, n, e = caixa.y.min(), caixa.x.min(), caixa.y.max(), caixa.x.max()
    consulta = f'[out:xml][timeout:600];(way["highway"]({s},{w},{n},{e}););(._;>;);out body;'
    xml = CACHE / "fortaleza_ruas.osm"
    for url in OVERPASS:
        try:
            print(f"  baixando ruas do OpenStreetMap ({url}) ...")
            r = requests.post(url, data={"data": consulta}, timeout=900, headers=CABECALHO)
            r.raise_for_status()
            CACHE.mkdir(parents=True, exist_ok=True)
            xml.write_bytes(r.content)
            break
        except Exception as ex:
            print(f"    falhou: {ex}")
    else:
        raise SystemExit("Overpass indisponível. Tente de novo mais tarde ou passe um .osm.pbf com --osm.")
    with osmium.SimpleWriter(str(pbf)) as w:
        for obj in osmium.FileProcessor(str(xml)):
            w.add(obj)
    return pbf


def ler_gtfs(caminho: Path, nome: str) -> dict[str, pd.DataFrame]:
    with zipfile.ZipFile(caminho) as z:
        arqs = {Path(n).name: n for n in z.namelist()}
        ler = lambda a: pd.read_csv(z.open(arqs[a]), dtype=str, encoding="utf-8-sig") if a in arqs else None  # noqa: E731
        g = {a[:-4]: ler(a) for a in ["routes.txt", "trips.txt", "stops.txt", "shapes.txt", "calendar.txt",
                                      "calendar_dates.txt", "stop_times.txt"]}
    g["nome"] = nome
    return g


DIAS_SEMANA = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def viagens_no_dia(g: dict, d: dt.date) -> int:
    """Quantas viagens do GTFS rodam na data (calendar + exceções do calendar_dates)."""
    ativos = set()
    cal = g["calendar"]
    if cal is not None and len(cal):
        dia = d.strftime("%Y%m%d")
        ok = (cal[DIAS_SEMANA[d.weekday()]] == "1") & (cal.start_date <= dia) & (cal.end_date >= dia)
        ativos |= set(cal[ok].service_id)
    cd = g["calendar_dates"]
    if cd is not None and len(cd):
        no_dia = cd[cd.date == d.strftime("%Y%m%d")]
        ativos |= set(no_dia[no_dia.exception_type == "1"].service_id)
        ativos -= set(no_dia[no_dia.exception_type == "2"].service_id)
    return int(g["trips"].service_id.isin(ativos).sum())


def vigencia(g: dict) -> tuple[dt.date, dt.date]:
    """Primeiro e último dia de serviço: o calendar.txt mais as datas com serviço acrescentado no
    calendar_dates. As retiradas não contam: o Metrofor traz os feriados de 2025 num calendar de 2026-27."""
    datas = []
    cal, cd = g["calendar"], g["calendar_dates"]
    if cal is not None and len(cal):
        datas += [cal.start_date.min(), cal.end_date.max()]
    if cd is not None and len(cd):
        extra = cd[cd.exception_type == "1"].date
        if len(extra):
            datas += [extra.min(), extra.max()]
    return pd.to_datetime(min(datas)).date(), pd.to_datetime(max(datas)).date()


def deslocar_calendario(caminho: Path, g: dict, alvo: tuple[dt.date, dt.date]) -> tuple[Path, dict]:
    """Copia o GTFS com as datas do calendar, calendar_dates e feed_info movidas para começar na
    vigência `alvo`. Move em semanas inteiras, para o dia da semana não mudar; viagens e horários
    continuam os do arquivo original. A cópia vai para o cache."""
    ini, fim = vigencia(g)
    dias = (alvo[0] - ini).days // 7 * 7
    mover = lambda s: (pd.to_datetime(s, format="%Y%m%d") + pd.Timedelta(days=dias)).dt.strftime("%Y%m%d")  # noqa: E731
    colunas = {"calendar.txt": ["start_date", "end_date"], "calendar_dates.txt": ["date"],
               "feed_info.txt": ["feed_start_date", "feed_end_date"]}
    destino = CACHE / f"{caminho.stem}_deslocado.zip"
    destino.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(caminho) as zin, zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            cols = colunas.get(Path(item.filename).name)
            if not cols:
                zout.writestr(item, zin.read(item))
                continue
            df = pd.read_csv(zin.open(item), dtype=str, encoding="utf-8-sig")
            for c in cols:
                if c in df:
                    ok = df[c].notna()  # as datas do feed_info são opcionais
                    df.loc[ok, c] = mover(df.loc[ok, c])
            zout.writestr(item.filename, df.to_csv(index=False))
    desl = dt.timedelta(days=dias)
    return destino, {"feed": g["nome"], "dias": dias, "vigencia_original": [ini.isoformat(), fim.isoformat()],
                     "vigencia_deslocada": [(ini + desl).isoformat(), (fim + desl).isoformat()]}


def dia_referencia(feeds: list[dict]) -> tuple[dt.date, str]:
    """Uma terça-feira com viagens em todos os GTFS. Se não houver, um sábado.

    Conta viagens, não só o calendar: o GTFS da ETUFOR de 03/2026 declara o serviço de
    dia útil no calendar.txt mas não traz nenhuma viagem dele, só as de sábado e domingo.
    """
    feriados = set()
    for g in feeds:
        cd = g["calendar_dates"]
        if cd is not None and len(cd):  # data com serviço retirado = feriado (ex.: 21/04 roda tabela de domingo)
            feriados |= set(pd.to_datetime(cd[cd.exception_type == "2"].date).dt.date)
    vig = [vigencia(g) for g in feeds]
    ini, fim = max(v[0] for v in vig), min(v[1] for v in vig)
    if ini > fim:
        raise SystemExit("As vigências dos GTFS não se cruzam: "
                         + ", ".join(f"{g['nome']} {a:%d/%m/%Y} a {b:%d/%m/%Y}" for g, (a, b) in zip(feeds, vig))
                         + ". Use --deslocar-calendario NOME para mover as datas de um deles.")
    hoje = dt.date.today()
    for semana, rotulo in ((1, "dia útil"), (5, "sábado")):
        d = hoje if ini <= hoje <= fim else ini
        while d <= fim:
            if d.weekday() == semana and d not in feriados and all(viagens_no_dia(g, d) for g in feeds):
                if semana != 1:
                    print("  AVISO: nenhuma terça-feira com viagens em todos os GTFS; usando a tabela de sábado.")
                    for g in feeds:  # a terça seguinte: a anterior pode cair antes da vigência
                        print(f"    {g['nome']}: {viagens_no_dia(g, d + dt.timedelta(days=3))} viagens na terça seguinte")
                return d, rotulo
            d += dt.timedelta(days=1)
    raise SystemExit(f"Nenhuma terça-feira nem sábado com viagens em todos os GTFS ({ini} a {fim}).")


def pontos_bairros(b: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Centro de cada bairro ponderado pela população dos setores de 2022 (dentro do bairro)."""
    s = gpd.read_file(SETORES).to_crs(UTM)
    s["cd_setor"] = s.cd_setor.astype(str)
    pop = pd.read_csv(IBGE_2022, dtype={"cd_setor": str})[["cd_setor", "pessoas"]]
    s = s.merge(pop, on="cd_setor")
    s = s[s.pessoas > 0]
    s["geometry"] = s.representative_point()
    bu = b.to_crs(UTM)
    j = gpd.sjoin(s, bu[["bairro_id", "geometry"]], predicate="within")
    linhas = []
    for _, r in bu.iterrows():
        q = j[j.bairro_id == r.bairro_id]
        if len(q):
            w = q.pessoas.astype(float)
            p = Point((q.geometry.x * w).sum() / w.sum(), (q.geometry.y * w).sum() / w.sum())
            if not r.geometry.contains(p):  # bairro em forma de "C": usa o setor mais populoso
                p = q.loc[q.pessoas.idxmax()].geometry
        else:
            p = r.geometry.representative_point()
        linhas.append({"id": f"b{int(r.bairro_id)}", "geometry": p})
    return gpd.GeoDataFrame(linhas, crs=UTM).to_crs(4326)


def pontos_polos(b: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    pts = gpd.GeoDataFrame([{"id": f"p_{k}", "nome": n, "bairro_esperado": bb, "geometry": Point(lo, la)}
                            for k, n, la, lo, bb in POLOS], crs=4326)
    j = gpd.sjoin(pts, b[["bairro_id", "nome", "geometry"]].rename(columns={"nome": "bairro"}),
                  predicate="within", how="left")
    erros = j[j.bairro_esperado.notna() & (j.bairro != j.bairro_esperado)]
    if len(erros):
        raise SystemExit(f"Polos fora do bairro esperado, confira as coordenadas:\n{erros[['nome', 'bairro', 'bairro_esperado']]}")
    if j.bairro_id.isna().any():
        raise SystemExit(f"Polos fora de Fortaleza: {j[j.bairro_id.isna()].nome.tolist()}")
    return j[["id", "nome", "bairro_id", "geometry"]].reset_index(drop=True)


# ---------------------------------------------------------------------------
# Linhas: nome e traçado
# ---------------------------------------------------------------------------
def tabela_linhas(feeds: list[dict]) -> tuple[dict, dict, dict]:
    """(linhas, traçados, paradas). Chave "feed:route_id" e "feed:stop_id"."""
    linhas, tracados, paradas = {}, {}, {}
    for g in feeds:
        f = g["nome"]
        modo_txt = {"0": "vlt", "1": "metro", "2": "trem", "3": "onibus"}
        for _, r in g["routes"].iterrows():
            curto = (r.get("route_short_name") or "").strip() if isinstance(r.get("route_short_name"), str) else ""
            longo = (r.get("route_long_name") or "").strip() if isinstance(r.get("route_long_name"), str) else ""
            longo = longo.title() if longo.isupper() else longo
            if not curto and longo:
                # O Metrofor não tem número de linha e marca tudo como VLT (route_type 0), até o
                # metrô da Linha Sul: o selo fica com o nome ("Linha Sul") e o trajeto vai para o texto.
                desc = (r.get("route_desc") or "").strip() if isinstance(r.get("route_desc"), str) else ""
                curto = longo.replace("Vlt", "VLT")
                longo = f"{curto} ({desc})" if desc else curto
            linhas[f"{f}:{r.route_id}"] = [curto, longo, modo_txt.get(str(r.get("route_type")), "onibus")]
        for _, r in g["stops"].iterrows():
            paradas[f"{f}:{r.stop_id}"] = [r.get("stop_name") if isinstance(r.get("stop_name"), str) else "",
                                           round(float(r.stop_lat), 5), round(float(r.stop_lon), 5)]
        if g["shapes"] is None:
            continue
        sh = g["shapes"].copy()
        sh["seq"] = sh.shape_pt_sequence.astype(int)
        sh = sh.sort_values(["shape_id", "seq"])
        geo = {k: LineString(list(zip(v.shape_pt_lon.astype(float), v.shape_pt_lat.astype(float))))
               for k, v in sh.groupby("shape_id") if len(v) > 1}
        t = g["trips"]
        if "shape_id" not in t:
            continue
        # Até 2 traçados por linha (ida e volta), os mais usados. Agrupa pelo shape_id e não pelo
        # direction_id: na ETUFOR ele vem em branco, e o groupby descartaria todas as viagens.
        uso = t.dropna(subset=["shape_id"]).groupby(["route_id", "shape_id"]).size().sort_values(ascending=False)
        mais = uso.groupby(level="route_id").head(2)
        for (rid, sid), _ in mais.items():
            if sid in geo:
                linha = gpd.GeoSeries([geo[sid]], crs=4326).to_crs(UTM).simplify(15).to_crs(4326).iloc[0]
                tracados.setdefault(f"{f}:{rid}", []).append([[round(y, 5), round(x, 5)] for x, y in linha.coords])
    return linhas, tracados, paradas


# ---------------------------------------------------------------------------
# Rotas detalhadas -> formato compacto
# ---------------------------------------------------------------------------
def nomes_dos_feeds(it: pd.DataFrame, feeds: list[dict]) -> dict:
    """O R5 identifica cada GTFS pelo feed_id ou pelo nome do arquivo; descobre qual é qual
    pelas linhas que cada um usa."""
    mapa = {}
    for f in it.feed.dropna().unique():
        rotas = set(it.loc[it.feed == f, "route_id"].dropna().astype(str))
        mapa[f] = max(feeds, key=lambda g: len(rotas & set(g["routes"].route_id)))["nome"]
    return mapa


def compactar_rotas(it: pd.DataFrame, linhas: dict, paradas: dict) -> dict:
    """{from: {to: [opção, ...]}}; opção = {"t": min, "p": [perna, ...]}.
    perna = ["a", min] (a pé) | ["l", chave_linha, min_viagem, min_espera, parada_sobe, parada_desce]."""
    saida: dict = {}
    it = it.copy()
    it["min"] = it.travel_time.dt.total_seconds() / 60
    it["espera"] = it.wait_time.fillna(pd.Timedelta(0)).dt.total_seconds() / 60
    for (o, d), grp in it.groupby(["from_id", "to_id"]):
        opcoes, vistas = [], set()
        for _, op in grp.groupby("option"):
            op = op.sort_values("segment") if "segment" in op else op
            pernas, total = [], 0.0
            for _, r in op.iterrows():
                total += r["min"] + r["espera"]
                modo = str(r.transport_mode).split(".")[-1].upper()
                if modo in ("WALK", "TransportMode.WALK"):
                    if pernas and pernas[-1][0] == "a":
                        pernas[-1][1] += r["min"]
                    else:
                        pernas.append(["a", r["min"]])
                else:
                    chave = f"{r.feed}:{r.route_id}"
                    pernas.append(["l", chave, r["min"], r["espera"],
                                   f"{r.feed}:{r.start_stop_id}", f"{r.feed}:{r.end_stop_id}"])
            assinatura = tuple(p[1] for p in pernas if p[0] == "l")
            if assinatura in vistas or (not assinatura and total > MAX_A_PE):  # 2 h a pé não é sugestão
                continue
            vistas.add(assinatura)
            for p in pernas:
                p[1:] = [round(v) if isinstance(v, float) else v for v in p[1:]]
            pernas = [p for p in pernas if p[0] != "a" or p[1] >= 1]  # baldeação na mesma parada
            opcoes.append({"t": round(total), "p": pernas})
        opcoes.sort(key=lambda x: x["t"])
        saida.setdefault(o, {})[d] = opcoes[:MAX_OPCOES]
    return saida


def tempos_por_origem(ttm: pd.DataFrame, ids_dest: list[str]) -> dict:
    tempos = {}
    for o, grp in ttm.groupby("from_id"):
        g = grp.set_index("to_id").reindex(ids_dest)
        tempos[o] = [[None if pd.isna(v) else int(v) for v in g[c]] for c in ("p25", "p50", "p75")]
    return tempos


def gravar(meta: dict, polos: gpd.GeoDataFrame, destinos: gpd.GeoDataFrame, tempos: dict,
           linhas: dict, tracados: dict) -> None:
    """Grava os dois arquivos que a página lê. Chamado logo depois da matriz (tempos já valem
    sozinhos, mesmo se a fase das rotas cair) e de novo no fim, com as rotas."""
    dados = {
        "meta": meta,
        "destinos": destinos.id.tolist(),
        "polos": [{"id": r.id, "nome": r.nome, "bairro": int(r.bairro_id), "lat": round(r.geometry.y, 5),
                   "lon": round(r.geometry.x, 5)} for r in polos.itertuples()],
        "pontos": {r.id: [round(r.geometry.y, 5), round(r.geometry.x, 5)] for r in destinos.itertuples()},
        "linhas": linhas,
        "tempos": tempos,
    }
    OUT_JS.write_text("window.TRANSPORTE = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n",
                      encoding="utf-8")
    OUT_LINHAS.write_text("window.TRANSPORTE_LINHAS = " + json.dumps(tracados, separators=(",", ":")) + ";\n",
                          encoding="utf-8")


def meta_base(dia: dt.date, dia_rotulo: str, feeds: list[str], deslocado: dict | None = None) -> dict:
    m = {"dia": dia.isoformat(), "dia_rotulo": dia_rotulo, "saida": f"{SAIDA_INICIO:%H:%M}",
         "janela_min": int(JANELA.total_seconds() // 60), "saida_rotas": f"{SAIDA_ROTAS:%H:%M}", "feeds": feeds,
         "max_min": int(MAX_TEMPO.total_seconds() // 60), "rotas": False, "rotas_entre_bairros": False}
    if deslocado:
        m["calendario_deslocado"] = deslocado
    return m


def da_tabela(args) -> None:
    """Refaz transporte.js a partir da última tabela de tempos, sem Java nem GTFS (sem rotas)."""
    if not OUT_CSV.exists():
        raise SystemExit(f"{OUT_CSV.relative_to(ROOT)} não existe: rode o script sem --da-tabela primeiro.")
    if OUT_META.exists():
        m = json.loads(OUT_META.read_text(encoding="utf-8"))
        dia, dia_rotulo, feeds = dt.date.fromisoformat(m["dia"]), m["dia_rotulo"], m["feeds"]
        deslocado = m.get("calendario_deslocado")
    elif args.dia:
        deslocado = None
        dia = dt.date.fromisoformat(args.dia)
        dia_rotulo, feeds = ("sábado" if dia.weekday() == 5 else "domingo" if dia.weekday() == 6 else "dia útil"), ["etufor", "metrofor"]
    else:
        raise SystemExit(f"Falta {OUT_META.relative_to(ROOT)}: diga o dia de referência da tabela com --dia AAAA-MM-DD.")
    b = gpd.read_file(BAIRROS)[["bairro_id", "nome", "geometry"]]
    polos = pontos_polos(b)
    destinos = pd.concat([pontos_bairros(b), polos[["id", "geometry"]]], ignore_index=True)
    ttm = pd.read_csv(OUT_CSV)
    faltam = set(ttm.to_id) - set(destinos.id)
    if faltam:
        raise SystemExit(f"A tabela tem destinos que não existem mais (polos mudaram?): {sorted(faltam)[:5]}")
    tempos = tempos_por_origem(ttm, destinos.id.tolist())
    gravar(meta_base(dia, dia_rotulo, feeds, deslocado), polos, destinos, tempos, {}, {})
    if not OUT_META.exists():
        OUT_META.write_text(json.dumps({"dia": dia.isoformat(), "dia_rotulo": dia_rotulo, "feeds": feeds,
                                        "origens": len(tempos)}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(tempos)} bairros de saída, {len(ttm)} pares, dia {dia:%d/%m/%Y} ({dia_rotulo}), sem rotas detalhadas")
    print(f"-> {OUT_JS.relative_to(ROOT)} ({OUT_JS.stat().st_size / 1024:.0f} KB)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--gtfs", nargs="*", help="arquivos GTFS (.zip); padrão: baixa ETUFOR e Metrofor")
    ap.add_argument("--osm", help="ruas em .osm.pbf; padrão: baixa do Overpass")
    ap.add_argument("--sem-rotas", action="store_true", help="só a matriz de tempos, sem rotas detalhadas")
    ap.add_argument("--rotas-entre-bairros", action="store_true",
                    help="rotas detalhadas também entre bairros, não só até os polos (demora horas)")
    ap.add_argument("--origens", type=int, default=0, help="limita o número de bairros de saída (teste)")
    ap.add_argument("--memoria", default="6G", help="memória máxima da JVM do R5 (padrão: 6G)")
    ap.add_argument("--da-tabela", action="store_true",
                    help="refaz transporte.js da última tabela de tempos (data/processed), sem rotear")
    ap.add_argument("--dia", help="com --da-tabela, se faltar o transporte_meta.json: dia de referência AAAA-MM-DD")
    ap.add_argument("--deslocar-calendario", metavar="FEED",
                    help="move as datas do GTFS FEED (ex.: metrofor) para a vigência dos outros, em semanas "
                         "inteiras, quando as vigências não se cruzam; as viagens são as do arquivo original")
    args = ap.parse_args()
    if args.da_tabela:
        return da_tabela(args)

    # O r5py lê --max-memory da linha de comando; sem isso, a JVM pode crescer até 80% da RAM
    sys.argv += ["--max-memory", args.memoria]
    import r5py  # importa aqui: a JVM só sobe se for calcular

    b = gpd.read_file(BAIRROS)[["bairro_id", "nome", "geometry"]]
    if args.gtfs:
        caminhos = [(Path(p), Path(p).stem.removeprefix("gtfs_").split("_")[0]) for p in args.gtfs]
    else:
        # o nome do arquivo da URL entra no do cache: trocar o link não reaproveita o zip antigo
        caminhos = [(baixar(u, CACHE / f"gtfs_{k}_{Path(u).stem}.zip"), k) for k, u in GTFS_URLS.items()]
        caminhos = [(c, k) for c, k in caminhos if c]
        if not any(k == "etufor" for _, k in caminhos):
            raise SystemExit("Sem o GTFS da ETUFOR não há o que calcular. Baixe à mão e passe com --gtfs.")
    feeds = [ler_gtfs(c, k) for c, k in caminhos]
    print("GTFS:", ", ".join(f"{g['nome']} ({len(g['routes'])} linhas)" for g in feeds))
    deslocado = None
    mover = args.deslocar_calendario or (None if args.gtfs else DESLOCAR_PADRAO)
    i = next((i for i, g in enumerate(feeds) if g["nome"] == mover), None)
    if args.deslocar_calendario and (i is None or len(feeds) < 2):
        raise SystemExit(f"--deslocar-calendario: não há outro GTFS além de {mover!r} "
                         f"para servir de referência (GTFS: {[g['nome'] for g in feeds]}).")
    if i is not None and len(feeds) > 1:
        outros = [vigencia(g) for j, g in enumerate(feeds) if j != i]
        alvo = (max(v[0] for v in outros), min(v[1] for v in outros))
        ini, fim = vigencia(feeds[i])
        if ini <= alvo[1] and alvo[0] <= fim:
            print(f"  --deslocar-calendario: a vigência de {feeds[i]['nome']} já cruza a dos outros; nada a mover.")
        else:
            novo, deslocado = deslocar_calendario(caminhos[i][0], feeds[i], alvo)
            caminhos[i] = (novo, feeds[i]["nome"])
            feeds[i] = ler_gtfs(novo, feeds[i]["nome"])
            novo_ini, novo_fim = (dt.date.fromisoformat(x) for x in deslocado["vigencia_deslocada"])
            print(f"  AVISO: calendário de {deslocado['feed']} deslocado "
                  f"{deslocado['dias']:+d} dias ({deslocado['dias'] // 7:+d} semanas): {ini:%d/%m/%Y} a {fim:%d/%m/%Y} "
                  f"-> {novo_ini:%d/%m/%Y} a {novo_fim:%d/%m/%Y}, "
                  f"para cruzar com {alvo[0]:%d/%m/%Y} a {alvo[1]:%d/%m/%Y}. Os horários são os do arquivo "
                  f"original; os feriados dele caem em outras datas.")
    osm = Path(args.osm) if args.osm else ruas_pbf(b)

    dia, dia_rotulo = dia_referencia(feeds)
    print(f"Dia de referência: {dia:%d/%m/%Y} ({dia_rotulo}), saída {SAIDA_INICIO:%H:%M} + {int(JANELA.total_seconds() // 60)} min")

    origens = pontos_bairros(b)
    if args.origens:
        origens = origens.head(args.origens)
    polos = pontos_polos(b)
    destinos = pd.concat([pontos_bairros(b), polos[["id", "geometry"]]], ignore_index=True)

    rede = r5py.TransportNetwork(str(osm), [str(c) for c, _ in caminhos])
    modos = [r5py.TransportMode.TRANSIT, r5py.TransportMode.WALK]

    print("Matriz de tempos ...")
    ttm = r5py.TravelTimeMatrix(rede, origins=origens, destinations=destinos, snap_to_network=True,
                                departure=dt.datetime.combine(dia, SAIDA_INICIO), departure_time_window=JANELA,
                                transport_modes=modos, percentiles=[25, 50, 75], max_time=MAX_TEMPO)
    ttm = pd.DataFrame(ttm)
    col = {p: next(c for c in ttm.columns if c.endswith(f"p{p}") or c == f"travel_time_p{p}") for p in (25, 50, 75)}
    ttm = ttm.rename(columns={col[25]: "p25", col[50]: "p50", col[75]: "p75"})
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    ttm[["from_id", "to_id", "p25", "p50", "p75"]].to_csv(OUT_CSV, index=False)
    nomes_feeds = [g["nome"] for g in feeds]
    OUT_META.write_text(json.dumps({"dia": dia.isoformat(), "dia_rotulo": dia_rotulo, "feeds": nomes_feeds,
                                    "origens": len(origens),
                                    **({"calendario_deslocado": deslocado} if deslocado else {})},
                                   ensure_ascii=False, indent=1), encoding="utf-8")

    linhas, tracados, paradas = tabela_linhas(feeds)
    tempos = tempos_por_origem(ttm, destinos.id.tolist())
    meta = meta_base(dia, dia_rotulo, nomes_feeds, deslocado)
    # os tempos já valem sozinhos: grava agora, para não perder tudo se a fase das rotas cair
    gravar(meta, polos, destinos, tempos, linhas, {k: v for k, v in tracados.items()})
    sem_rota = int(ttm.p50.isna().sum())
    print(f"  {len(ttm)} pares, {sem_rota} sem rota em até {int(MAX_TEMPO.total_seconds() // 60)} min")

    usadas: set = set()
    if not args.sem_rotas:
        alvos = destinos if args.rotas_entre_bairros else polos[["id", "geometry"]]
        print(f"Rotas detalhadas saindo às {SAIDA_ROTAS:%H:%M} ({len(origens) * len(alvos)} pares, "
              f"em lotes de {LOTE_ROTAS} bairros; demora) ...")
        OUT_ROTAS.mkdir(parents=True, exist_ok=True)
        feitos = 0
        # Em lotes: o R5 guarda todas as alternativas de todos os pares até o fim, e de uma vez só
        # os 1.452 pares passaram de 4,5 GB. Cada lote já grava os seus arquivos.
        for ini_lote in range(0, len(origens), LOTE_ROTAS):
            lote = origens.iloc[ini_lote:ini_lote + LOTE_ROTAS]
            it = r5py.DetailedItineraries(rede, origins=lote, destinations=alvos, snap_to_network=True,
                                          departure=dt.datetime.combine(dia, SAIDA_ROTAS),
                                          departure_time_window=JANELA_ROTAS,
                                          transport_modes=modos, max_time=MAX_TEMPO, force_all_to_all=True)
            it = pd.DataFrame(it)
            it["feed"] = it.feed.map(nomes_dos_feeds(it, feeds))
            rotas = compactar_rotas(it, linhas, paradas)
            del it
            for o, dests in rotas.items():
                nomes = {}
                for opcoes in dests.values():
                    for op in opcoes:
                        for p in op["p"]:
                            if p[0] == "l":
                                usadas.add(p[1])
                                for k in (p[4], p[5]):
                                    nomes[k] = paradas.get(k, ["", None, None])
                corpo = json.dumps({"rotas": dests, "paradas": nomes}, ensure_ascii=False, separators=(",", ":"))
                (OUT_ROTAS / f"o_{o[1:]}.js").write_text(
                    f"(window.ROTAS_TP = window.ROTAS_TP || {{}})[{json.dumps(o)}] = {corpo};\n", encoding="utf-8")
            feitos += len(rotas)
            print(f"  {min(ini_lote + LOTE_ROTAS, len(origens))}/{len(origens)} bairros "
                  f"({dt.datetime.now():%H:%M})", flush=True)
        print(f"  rotas de {feitos} bairros -> {OUT_ROTAS.relative_to(ROOT)}/")

    if not args.sem_rotas:
        usadas = usadas or set(linhas)
        meta.update(rotas=True, rotas_entre_bairros=bool(args.rotas_entre_bairros))
        gravar(meta, polos, destinos, tempos, {k: v for k, v in linhas.items() if k in usadas},
               {k: v for k, v in tracados.items() if k in usadas})

    med = ttm[ttm.to_id.str.startswith("p_")].groupby("to_id").p50.median()
    print("Tempo mediano de todos os bairros até cada polo (min):")
    print(med.rename(index=dict(zip(polos.id, polos.nome))).round(0).sort_values().to_string())
    print(f"-> {OUT_JS.relative_to(ROOT)} ({OUT_JS.stat().st_size / 1024:.0f} KB), "
          f"{OUT_LINHAS.relative_to(ROOT)} ({OUT_LINHAS.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
