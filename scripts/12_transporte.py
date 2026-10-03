"""Etapa 12 — Tempo e rotas de ônibus (e metrô/VLT) entre os bairros e os polos de Fortaleza.

Fontes:
  - GTFS da ETUFOR (ônibus municipais), portal de dados abertos da Prefeitura
  - GTFS do Metrofor (metrô e VLT), se disponível
  - ruas do OpenStreetMap (caminhada até a parada), baixadas do Overpass e gravadas em .osm.pbf

Roteamento com r5py (R5, o mesmo motor do projeto Acesso a Oportunidades do IPEA):
  - saída: um ponto por bairro, no centro ponderado pela população dos setores de 2022
    (onde as pessoas moram, não o meio geográfico do polígono)
  - chegada: os mesmos 121 bairros e os polos abaixo (pontos de trabalho, estudo e eventos)
  - dia útil dentro da vigência do GTFS, saída entre 6h30 e 8h; o tempo é de porta a
    porta (caminhada, espera, viagem, baldeação) e sai a mediana da janela, com o 25º e
    o 75º percentis como faixa ("entre 45 e 60 min, conforme o horário de saída")
  - rotas detalhadas (linhas, onde subir e descer) saindo às 7h, até 3 alternativas

É tempo de TABELA: o GTFS diz quando o ônibus deveria passar, não quando passa. No
pico, o resultado tende a ser otimista, e a página diz isso.

Uso:
  python scripts/12_transporte.py                  # baixa o que faltar, calcula tudo
  python scripts/12_transporte.py --sem-rotas      # só a matriz de tempos (rápido)
  python scripts/12_transporte.py --gtfs a.zip b.zip --osm ruas.osm.pbf

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
UTM = 31984

GTFS_URLS = {
    "etufor": "https://dados.fortaleza.ce.gov.br/dataset/d6f1e64c-aca3-4867-8f39-53b7c9c2d211/resource/"
              "7058bfbe-5ba2-45f4-9a91-af1508a7c05b/download/arquivo_gtfs_03.10.2025.zip",
    # O Metrofor publica o GTFS em https://www.metrofor.ce.gov.br/gtfs/ ; se o link mudar,
    # baixe à mão e passe com --gtfs. Sem ele, metrô e VLT ficam de fora (só ônibus).
    "metrofor": "https://www.metrofor.ce.gov.br/gtfs/gtfs.zip",
}
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://z.overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter"]

# Polos de trabalho, estudo e eventos. O ponto é o lugar em si; `bairro` confere que ele
# caiu no bairro certo da malha de 2025 (se não cair, o script avisa e para).
POLOS = [
    ("centro", "Centro (Praça do Ferreira)", -3.72760, -38.52650, "CENTRO"),
    ("beira_mar", "Beira-Mar", -3.72540, -38.49700, "MEIRELES"),
    ("aldeota", "Aldeota (Av. Santos Dumont)", -3.73820, -38.50020, "ALDEOTA"),
    ("papicu", "Papicu (terminal)", -3.73900, -38.47720, "PAPICU"),
    ("iguatemi", "Iguatemi", -3.75650, -38.48850, None),
    ("unifor", "Unifor", -3.76890, -38.47840, "EDSON QUEIROZ"),
    ("centro_eventos", "Centro de Eventos", -3.77640, -38.48250, None),
    ("parangaba", "Parangaba (terminal)", -3.77630, -38.56330, "PARANGABA"),
    ("messejana", "Messejana (terminal)", -3.83080, -38.49180, "MESSEJANA"),
    ("ufc_benfica", "UFC Benfica", -3.74210, -38.53860, "BENFICA"),
    ("ufc_pici", "UFC Pici", -3.74370, -38.57440, "PICI"),
    ("aeroporto", "Aeroporto", -3.77630, -38.53250, "AEROPORTO"),
]

SAIDA_INICIO = dt.time(6, 30)
JANELA = dt.timedelta(minutes=90)
SAIDA_ROTAS = dt.time(7, 0)
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
        r = requests.get(url, timeout=180)
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
            r = requests.post(url, data={"data": consulta}, timeout=900)
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


def dia_util(feeds: list[dict]) -> dt.date:
    """Uma terça-feira com serviço em todos os GTFS (sem feriado no calendar_dates)."""
    inicios, fins, excecoes = [], [], set()
    for g in feeds:
        if g["calendar"] is not None and len(g["calendar"]):
            inicios.append(pd.to_datetime(g["calendar"].start_date).min())
            fins.append(pd.to_datetime(g["calendar"].end_date).max())
        if g["calendar_dates"] is not None:
            cd = g["calendar_dates"]
            excecoes |= set(pd.to_datetime(cd[cd.exception_type == "2"].date).dt.date)
            if g["calendar"] is None or not len(g["calendar"]):
                datas = pd.to_datetime(cd[cd.exception_type == "1"].date)
                inicios.append(datas.min()); fins.append(datas.max())
    ini, fim = max(inicios).date(), min(fins).date()
    d = dt.date.today() if ini <= dt.date.today() <= fim else ini
    while d <= fim:
        if d.weekday() == 1 and d not in excecoes:
            return d
        d += dt.timedelta(days=1)
    raise SystemExit(f"Nenhuma terça-feira útil na vigência comum dos GTFS ({ini} a {fim}).")


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
            linhas[f"{f}:{r.route_id}"] = [curto, longo.title() if longo.isupper() else longo,
                                           modo_txt.get(str(r.get("route_type")), "onibus")]
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
        dirc = t.direction_id if "direction_id" in t else pd.Series("0", index=t.index)
        mais = t.assign(direction_id=dirc).groupby(["route_id", "direction_id"]).shape_id.agg(lambda s: s.mode().iat[0])
        for (rid, _), sid in mais.items():
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
            opcoes.append({"t": round(total), "p": pernas})
        opcoes.sort(key=lambda x: x["t"])
        saida.setdefault(o, {})[d] = opcoes[:MAX_OPCOES]
    return saida


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--gtfs", nargs="*", help="arquivos GTFS (.zip); padrão: baixa ETUFOR e Metrofor")
    ap.add_argument("--osm", help="ruas em .osm.pbf; padrão: baixa do Overpass")
    ap.add_argument("--sem-rotas", action="store_true", help="só a matriz de tempos, sem rotas detalhadas")
    ap.add_argument("--origens", type=int, default=0, help="limita o número de bairros de saída (teste)")
    args = ap.parse_args()

    import r5py  # importa aqui: a JVM só sobe se for calcular

    b = gpd.read_file(BAIRROS)[["bairro_id", "nome", "geometry"]]
    if args.gtfs:
        caminhos = [(Path(p), Path(p).stem.split("_")[0]) for p in args.gtfs]
    else:
        caminhos = [(baixar(u, CACHE / f"gtfs_{k}.zip"), k) for k, u in GTFS_URLS.items()]
        caminhos = [(c, k) for c, k in caminhos if c]
        if not any(k == "etufor" for _, k in caminhos):
            raise SystemExit("Sem o GTFS da ETUFOR não há o que calcular. Baixe à mão e passe com --gtfs.")
    feeds = [ler_gtfs(c, k) for c, k in caminhos]
    print("GTFS:", ", ".join(f"{g['nome']} ({len(g['routes'])} linhas)" for g in feeds))
    osm = Path(args.osm) if args.osm else ruas_pbf(b)

    dia = dia_util(feeds)
    print(f"Dia de referência: {dia:%d/%m/%Y} (terça-feira), saída {SAIDA_INICIO:%H:%M} + {int(JANELA.total_seconds() // 60)} min")

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

    linhas, tracados, paradas = tabela_linhas(feeds)
    ids_dest = destinos.id.tolist()
    tempos = {}
    for o, grp in ttm.groupby("from_id"):
        g = grp.set_index("to_id").reindex(ids_dest)
        tempos[o] = [[None if pd.isna(v) else int(v) for v in g[c]] for c in ("p25", "p50", "p75")]
    sem_rota = int(ttm.p50.isna().sum())
    print(f"  {len(ttm)} pares, {sem_rota} sem rota em até {int(MAX_TEMPO.total_seconds() // 60)} min")

    usadas: set = set()
    if not args.sem_rotas:
        print(f"Rotas detalhadas saindo às {SAIDA_ROTAS:%H:%M} (demora: são {len(origens) * len(destinos)} pares) ...")
        it = r5py.DetailedItineraries(rede, origins=origens, destinations=destinos, snap_to_network=True,
                                      departure=dt.datetime.combine(dia, SAIDA_ROTAS),
                                      departure_time_window=dt.timedelta(minutes=20),
                                      transport_modes=modos, max_time=MAX_TEMPO, force_all_to_all=True)
        it = pd.DataFrame(it)
        it["feed"] = it.feed.map(nomes_dos_feeds(it, feeds))
        rotas = compactar_rotas(it, linhas, paradas)
        OUT_ROTAS.mkdir(parents=True, exist_ok=True)
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
        print(f"  rotas de {len(rotas)} bairros -> {OUT_ROTAS.relative_to(ROOT)}/")

    usadas = usadas or set(linhas)
    dados = {
        "meta": {"dia": dia.isoformat(), "saida": f"{SAIDA_INICIO:%H:%M}", "janela_min": int(JANELA.total_seconds() // 60),
                 "saida_rotas": f"{SAIDA_ROTAS:%H:%M}", "feeds": [g["nome"] for g in feeds],
                 "max_min": int(MAX_TEMPO.total_seconds() // 60), "rotas": not args.sem_rotas},
        "destinos": ids_dest,
        "polos": [{"id": r.id, "nome": r.nome, "bairro": int(r.bairro_id), "lat": round(r.geometry.y, 5),
                   "lon": round(r.geometry.x, 5)} for r in polos.itertuples()],
        "pontos": {r.id: [round(r.geometry.y, 5), round(r.geometry.x, 5)] for r in destinos.itertuples()},
        "linhas": {k: v for k, v in linhas.items() if k in usadas},
        "tempos": tempos,
    }
    OUT_JS.write_text("window.TRANSPORTE = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n",
                      encoding="utf-8")
    OUT_LINHAS.write_text("window.TRANSPORTE_LINHAS = " + json.dumps({k: v for k, v in tracados.items() if k in usadas},
                          separators=(",", ":")) + ";\n", encoding="utf-8")

    med = ttm[ttm.to_id.str.startswith("p_")].groupby("to_id").p50.median()
    print("Tempo mediano de todos os bairros até cada polo (min):")
    print(med.rename(index=dict(zip(polos.id, polos.nome))).round(0).sort_values().to_string())
    print(f"-> {OUT_JS.relative_to(ROOT)} ({OUT_JS.stat().st_size / 1024:.0f} KB), "
          f"{OUT_LINHAS.relative_to(ROOT)} ({OUT_LINHAS.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
