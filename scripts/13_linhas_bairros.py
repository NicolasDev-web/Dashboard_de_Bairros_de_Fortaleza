"""Etapa 13 — Linhas de ônibus e metrô que passam em cada bairro, e as paradas da cidade.

Complementa a etapa 12. Lá o tempo e a rota saem do roteador (R5) num dia útil, e o GTFS
de dia útil mais recente da ETUFOR é de 2023/24. Aqui não há horário: só "quais linhas param
aqui", e isso vale com a rede mais atual, mesmo quando o GTFS não traz as viagens de dia útil.

Fontes (GTFS):
  - ETUFOR (ônibus municipais), 03/2026: 325 linhas, 5.490 paradas
  - ARCE (ônibus metropolitanos: Caucaia, Maracanaú, Eusébio...), 08/2025
  - Metrofor (metrô e VLT)

O GTFS da ETUFOR de 2026 lista 325 linhas, mas 45 não têm nenhuma viagem (as que só rodam em
dia útil). Dessas, as que existem no GTFS de 2023/24 entram com as paradas e o traçado de lá
(--complemento); cada parada antiga a até JUNTAR_M de uma parada de 2026 vira a mesma parada.

Para cada bairro: as linhas com parada dentro dele ou a até RAIO_M da divisa (uns 4 min a pé).
Para cada polo da etapa 12: as linhas com parada a até RAIO_POLO_M. Duas pontas com a mesma
linha = dá para ir sem baldeação (a página mostra isso no "Quanto tempo de ônibus"), desde que
a linha passe primeiro na saída e depois no destino: por isso cada linha leva também a ordem
dos bairros e polos em cada padrão de viagem ("sentido").

Uso:
  python scripts/13_linhas_bairros.py
  python scripts/13_linhas_bairros.py --gtfs etufor_2026.zip arce_2025.zip metrofor_2025.zip

Saídas:
  dashboard/linhas.js            linhas (número, nome, operadora), linhas por bairro e por polo
  dashboard/linhas_sentido.js    ordem dos bairros e polos em cada padrão de viagem (sob demanda)
  dashboard/linhas_tracados.js   traçado de cada linha (sob demanda)
  dashboard/paradas.js           paradas com as linhas de cada uma (sob demanda)
  data/processed/linhas_bairros.csv
"""
import argparse
import importlib.util
import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, box

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data/cache/transporte"
PADRAO = [CACHE / "etufor_2026.zip", CACHE / "arce_2025.zip", CACHE / "metrofor_2025.zip"]
COMPLEMENTO = CACHE / "etufor_2023.zip"
JUNTAR_M = 30
OUT_JS = ROOT / "dashboard/linhas.js"
OUT_TRACADOS = ROOT / "dashboard/linhas_tracados.js"
OUT_SENTIDO = ROOT / "dashboard/linhas_sentido.js"
OUT_PARADAS = ROOT / "dashboard/paradas.js"
OUT_CSV = ROOT / "data/processed/linhas_bairros.csv"
RAIO_M = 300
RAIO_POLO_M = 800  # o polo é um ponto: os terminais do Centro ficam a 700–800 m da Praça do Ferreira
BORDA_M = 3000  # traçados e paradas: a cidade mais esta borda (as metropolitanas vão longe)

# a etapa 12 já sabe ler GTFS, montar nomes de linha e desenhar o metrô sem shapes.txt
_spec = importlib.util.spec_from_file_location("transporte", ROOT / "scripts/12_transporte.py")
T = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(T)
UTM = T.UTM
OPERADORA = {"etufor": "ETUFOR", "arce": "Metropolitana (ARCE)", "metrofor": "Metrofor"}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--gtfs", nargs="*", help="GTFS (.zip); o nome começa pela operadora (etufor_, arce_, metrofor_)")
    ap.add_argument("--complemento", default=str(COMPLEMENTO),
                    help="GTFS antigo da ETUFOR para as linhas sem viagens no atual ('' desliga)")
    args = ap.parse_args()
    caminhos = [Path(p) for p in args.gtfs] if args.gtfs else [p for p in PADRAO if p.exists()]
    if not caminhos:
        raise SystemExit(f"Nenhum GTFS encontrado em {CACHE.relative_to(ROOT)}; passe os arquivos com --gtfs.")

    b = gpd.read_file(T.BAIRROS)[["bairro_id", "nome", "geometry"]].to_crs(UTM)
    cidade = box(*b.total_bounds).buffer(BORDA_M)
    polos = T.pontos_polos(b.to_crs(4326)).to_crs(UTM)

    zonas_bairro = b.assign(geometry=b.buffer(RAIO_M))[["bairro_id", "geometry"]]
    linhas, tracados, fontes = [], {}, []
    sem_viagens: dict[str, list] = {}  # número da linha -> [route_id, nome] no GTFS atual
    sentido: dict[int, dict] = {}  # índice da linha -> padrões de viagem: pares (A, B) -> primeira e última parada por zona

    def zonas_das_paradas(s):
        """stop_id -> zonas da parada: bairros a até RAIO_M (ids) e polos a até RAIO_POLO_M ("p_...")."""
        j = gpd.sjoin(s[["stop_id", "geometry"]], zonas_bairro, predicate="within")
        z = {k: sorted(int(x) for x in v) for k, v in j.groupby("stop_id").bairro_id}
        for p in polos.itertuples():
            for k in s.stop_id[s.distance(p.geometry) <= RAIO_POLO_M]:
                z.setdefault(k, []).append(p.id)
        return z

    def sentidos(g, s, idx, so=None):
        """Cada padrão de viagem da linha vira, para cada zona (bairro ou polo) por onde passa, a
        primeira e a última parada nela. Dá para ir de A até B se a linha chega em A antes de sair
        de B pela última vez: diz se a linha vai de A para B ou só de B para A."""
        zonas = zonas_das_paradas(s)
        st = g["stop_times"][["trip_id", "stop_id", "stop_sequence"]]
        st = st[st.stop_id.isin(zonas)].assign(n=lambda d: d.stop_sequence.astype(int)).sort_values(["trip_id", "n"])
        pad = st.groupby("trip_id", sort=False).stop_id.agg(tuple)
        rota = g["trips"].set_index("trip_id").route_id
        pad = pd.DataFrame({"route_id": rota.loc[pad.index].values, "p": pad.values}).drop_duplicates()
        for rid, paradas in zip(pad.route_id, pad.p):
            if rid not in idx or (so is not None and rid not in so):
                continue
            ini, fim = {}, {}
            for k, parada in enumerate(paradas):
                for z in zonas[parada]:
                    ini.setdefault(z, k)
                    fim[z] = k
            pares = frozenset((o, d) for o in ini for d in ini if o != d and ini[o] < fim[d])
            sentido.setdefault(idx[rid], {})[pares] = (ini, fim)

    def processar(g, op, so=None, chave_de=None, nome_de=None):
        """Linhas de g com parada na cidade; devolve as paradas (com os índices das linhas).
        so: só estas route_ids; chave_de/nome_de: chave e nome vindos do GTFS atual."""
        nomes, formas, _ = T.tabela_linhas([g])  # nome de cada linha e traçados (até 2 por linha)
        if g["shapes"] is None:
            formas = T.tracados_pelas_paradas(g)
        st = g["stop_times"][["trip_id", "stop_id"]].merge(g["trips"][["trip_id", "route_id"]], on="trip_id")
        if so is not None:
            st = st[st.route_id.isin(so)]
        por_parada = st.drop_duplicates(["stop_id", "route_id"]).groupby("stop_id").route_id.apply(list)
        s = g["stops"].dropna(subset=["stop_lat", "stop_lon"])
        s = gpd.GeoDataFrame(s, geometry=gpd.points_from_xy(s.stop_lon.astype(float), s.stop_lat.astype(float)), crs=4326).to_crs(UTM)
        s = s[s.within(cidade) & s.stop_id.isin(por_parada.index)]
        usadas = set(r for lista in por_parada.loc[s.stop_id] for r in lista)
        idx = {}
        for rid in sorted(usadas):
            chave = chave_de(rid) if chave_de else f"{op}:{rid}"
            curto, longo, modo, *_ = nome_de(rid) if nome_de else nomes[f"{op}:{rid}"]
            idx[rid] = len(linhas)
            linhas.append({"chave": chave, "curto": curto, "longo": " ".join(longo.split()), "op": op, "modo": modo})
            # traçado recortado na cidade (as metropolitanas seguem até Caucaia, Maracanaú...)
            for forma in formas.get(f"{op}:{rid}", []):
                geo = gpd.GeoSeries([LineString([(lon, lat) for lat, lon in forma])], crs=4326).to_crs(UTM).intersection(cidade)
                partes = [geo.iloc[0]] if geo.iloc[0].geom_type == "LineString" else list(getattr(geo.iloc[0], "geoms", []))
                for parte in partes:
                    if parte.is_empty or parte.length < 200:
                        continue
                    ll = gpd.GeoSeries([parte.simplify(12)], crs=UTM).to_crs(4326).iloc[0]
                    tracados.setdefault(idx[rid], []).append([[round(y, 5), round(x, 5)] for x, y in ll.coords])
        sentidos(g, s, idx, so)
        s = s.assign(linhas=s.stop_id.map(lambda k: sorted(idx[r] for r in por_parada[k])),
                     nome=s.stop_name.fillna("").astype(str).str.strip())
        return s[["nome", "linhas", "geometry"]], usadas, g

    lotes = []
    for c in caminhos:
        op = c.stem.removeprefix("gtfs_").split("_")[0]
        g = T.ler_gtfs(c, op)
        de, ate = T.vigencia(g)
        lote, usadas, g = processar(g, op)
        lotes.append(lote)
        fontes.append({"nome": op, "operadora": OPERADORA.get(op, op), "de": de.isoformat(), "ate": ate.isoformat(),
                       "linhas": len(usadas), "paradas": len(lote)})
        print(f"{op}: {len(usadas)} linhas com parada em Fortaleza, {len(lote)} paradas ({de:%d/%m/%Y} a {ate:%d/%m/%Y})")
        if op == "etufor":
            nomes_atual, _, _ = T.tabela_linhas([g])
            for r in g["routes"][~g["routes"].route_id.isin(g["trips"].route_id)].itertuples():
                sem_viagens[str(r.route_short_name).strip()] = [r.route_id, nomes_atual[f"etufor:{r.route_id}"]]

    # linhas da ETUFOR sem viagens no GTFS atual: paradas e traçado do GTFS antigo
    if sem_viagens and args.complemento and Path(args.complemento).exists():
        ga = T.ler_gtfs(Path(args.complemento), "etufor")
        r = ga["routes"].assign(n=ga["routes"].route_short_name.astype(str).str.strip())
        r = r[r.n.isin(sem_viagens) & r.route_id.isin(ga["trips"].route_id)]
        num = dict(zip(r.route_id, r.n))
        antigo, usadas, _ = processar(ga, "etufor", so=set(r.route_id),
                                      chave_de=lambda rid: f"etufor:{sem_viagens[num[rid]][0]}", nome_de=lambda rid: sem_viagens[num[rid]][1])
        # parada antiga perto de uma atual vira a mesma parada
        atual = lotes[[k for k, c in enumerate(caminhos) if c.stem.startswith(("etufor", "gtfs_etufor"))][0]]
        j = gpd.sjoin_nearest(antigo, atual[["geometry"]].reset_index(names="alvo"), max_distance=JUNTAR_M, how="left")
        j = j[~j.index.duplicated()]
        for alvo, novas in zip(j.alvo, j.linhas):
            if pd.notna(alvo):
                atual.at[int(alvo), "linhas"] = sorted(set(atual.at[int(alvo), "linhas"]) | set(novas))
        lotes.append(antigo[j.alvo.isna().values])
        faltam = sorted(set(sem_viagens) - set(num.values()), key=lambda x: (len(x), x))
        fontes[0]["complemento"] = {"arquivo": Path(args.complemento).name, "linhas": len(usadas), "de": T.vigencia(ga)[0].isoformat(),
                                    "ate": T.vigencia(ga)[1].isoformat()}
        print(f"  + {len(usadas)} linhas sem viagens no GTFS atual, com as paradas de {Path(args.complemento).name} "
              f"({int(j.alvo.notna().sum())} paradas juntadas às atuais, {int(j.alvo.isna().sum())} novas)"
              + (f"; sem dados em nenhum dos dois: {', '.join(faltam)}" if faltam else ""))
    paradas = lotes
    paradas = gpd.GeoDataFrame(pd.concat(paradas, ignore_index=True), crs=UTM)

    # linhas por bairro: paradas dentro do bairro ou a até RAIO_M da divisa
    perto = gpd.sjoin(paradas, b.assign(geometry=b.buffer(RAIO_M))[["bairro_id", "geometry"]], predicate="within")
    dentro = gpd.sjoin(paradas, b[["bairro_id", "geometry"]], predicate="within")
    ordem = lambda i: (["etufor", "arce", "metrofor"].index(linhas[i]["op"]) if linhas[i]["op"] in OPERADORA else 9,  # noqa: E731
                       int(linhas[i]["curto"]) if linhas[i]["curto"].isdigit() else 10**6, linhas[i]["curto"])
    por_bairro = {int(k): sorted({i for lst in v for i in lst}, key=ordem) for k, v in perto.groupby("bairro_id").linhas}
    paradas_no_bairro = dentro.groupby("bairro_id").size().to_dict()
    por_polo = {}
    for p in polos.itertuples():
        q = paradas[paradas.distance(p.geometry) <= RAIO_POLO_M]
        por_polo[p.id] = sorted({i for lst in q.linhas for i in lst}, key=ordem)

    linhas_saida = [[x["chave"], x["curto"], x["longo"], x["op"], x["modo"]] for x in linhas]
    bairros_saida = {str(k): {"linhas": v, "paradas": int(paradas_no_bairro.get(k, 0))} for k, v in por_bairro.items()}
    # cada padrão vira [zona, primeira, última, zona, ...], com as posições renumeradas a partir de 0;
    # um padrão cujos pares (A antes de B) já estão todos num outro da mesma linha não acrescenta nada
    sentido_saida = {}
    for i, pads in sorted(sentido.items()):
        pares = sorted(pads, key=len, reverse=True)
        fica = [a for k, a in enumerate(pares) if not any(a <= b for b in pares[:k])]
        saida = []
        for a in fica:
            ini, fim = pads[a]
            pos = {v: n for n, v in enumerate(sorted(set(ini.values()) | set(fim.values())))}
            saida.append([x for z in sorted(ini, key=lambda z: (ini[z], str(z))) for x in (z, pos[ini[z]], pos[fim[z]])])
        sentido_saida[str(i)] = saida
    dados = {"meta": {"fontes": fontes, "raio_m": RAIO_M, "raio_polo_m": RAIO_POLO_M, "paradas": len(paradas)},
             "linhas": linhas_saida, "bairros": bairros_saida, "polos": por_polo}
    OUT_JS.write_text("window.LINHAS = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    OUT_SENTIDO.write_text("window.LINHAS_SENTIDO = " + json.dumps(sentido_saida, ensure_ascii=False, separators=(",", ":")) + ";\n",
                           encoding="utf-8")
    OUT_TRACADOS.write_text("window.LINHAS_TRACADOS = " + json.dumps({str(k): v for k, v in tracados.items()}, separators=(",", ":")) + ";\n",
                            encoding="utf-8")
    pll = paradas.to_crs(4326)
    # paradas sem nome no GTFS (a ARCE tem "Stop 86099") ganham o nome da parada mais próxima
    nomes = T.nomear_paradas({k: [n, g.y, g.x] for k, (n, g) in enumerate(zip(pll.nome, pll.geometry))})
    lista = [[round(g.y, 5), round(g.x, 5), nomes[k][0], l] for k, (g, l) in enumerate(zip(pll.geometry, pll.linhas))]
    OUT_PARADAS.write_text("window.PARADAS = " + json.dumps(lista, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")

    nome = dict(zip(b.bairro_id, b.nome))
    linhas_csv = pd.DataFrame([{"bairro_id": k, "bairro": nome[k], "paradas": paradas_no_bairro.get(k, 0),
                                "linhas": len(v), "etufor": sum(linhas[i]["op"] == "etufor" for i in v),
                                "metropolitanas": sum(linhas[i]["op"] == "arce" for i in v),
                                "metro_vlt": sum(linhas[i]["op"] == "metrofor" for i in v),
                                "numeros": " ".join(linhas[i]["curto"] for i in v)} for k, v in sorted(por_bairro.items())])
    linhas_csv.to_csv(OUT_CSV, index=False)
    sem = sorted(set(b.bairro_id) - set(por_bairro))
    print(f"{len(linhas)} linhas, {len(paradas)} paradas; linhas por bairro: mediana {linhas_csv.linhas.median():.0f}, "
          f"mínimo {linhas_csv.linhas.min()} ({linhas_csv.loc[linhas_csv.linhas.idxmin(), 'bairro']})"
          + (f"; sem nenhuma linha: {[nome[k] for k in sem]}" if sem else ""))
    for f in (OUT_JS, OUT_SENTIDO, OUT_TRACADOS, OUT_PARADAS):
        print(f"-> {f.relative_to(ROOT)} ({f.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
