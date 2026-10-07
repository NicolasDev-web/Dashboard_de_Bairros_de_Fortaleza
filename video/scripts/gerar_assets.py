"""Gera os assets do filme a partir dos dados reais do projeto + a trilha sintetizada.

  public/dados/cidade.json    Fortaleza em pixels (grade de células coloridas pelo índice)
  public/dados/evolucao.json  mudança 2010 -> 2022 por bairro (renda e saneamento)
  public/dados/contornos.json bairros no mesmo espaço da cidade em pixels, com o tempo de ônibus até o Centro
  public/dados/onibus.json    a rota Bom Jardim -> Centro (ônibus + metrô), pronta para desenhar
  public/dados/camadas.json   praças (URBIFOR) e hospitais (OpenStreetMap) no mesmo espaço
  public/audio/*.wav          trilha e efeitos, sintetizados aqui (sem material de terceiros)

Rodar da raiz do repositório:  .venv/Scripts/python video/scripts/gerar_assets.py
"""
import json
import re
import wave
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import LineString, Point
from shapely.ops import substring

RAIZ = Path(__file__).resolve().parents[2]
PUB = RAIZ / "video/public"
(PUB / "dados").mkdir(parents=True, exist_ok=True)
(PUB / "audio").mkdir(parents=True, exist_ok=True)

FPS = 30
DURACAO_S = 78.0
SR = 48_000
BPM = 100
BEAT = 60 / BPM  # 0,6 s = 18 frames


# =============================================================== dados
def cidade(lado=14, largura=1000, altura=860):
    b = gpd.read_file(RAIZ / "data/geo/bairros_fortaleza.geojson").to_crs(31984)
    t = pd.read_csv(RAIZ / "data/processed/bairros_indice.csv")[["bairro_id", "indice"]]
    b = b.merge(t, on="bairro_id")
    x0, y0, x1, y1 = b.total_bounds
    esc = min(largura / (x1 - x0), altura / (y1 - y0))
    cols, lins = int((x1 - x0) * esc / lado) + 1, int((y1 - y0) * esc / lado) + 1
    pts = [Point(x0 + (i + .5) * lado / esc, y1 - (j + .5) * lado / esc) for j in range(lins) for i in range(cols)]
    g = gpd.GeoDataFrame({"i": [k % cols for k in range(len(pts))], "j": [k // cols for k in range(len(pts))]},
                         geometry=pts, crs=31984)
    s = gpd.sjoin(g, b[["bairro_id", "indice", "geometry"]], predicate="within")
    lo, hi = b.indice.min(), b.indice.max()
    centro = b[b.nome == "CENTRO"].geometry.iloc[0].centroid
    ci, cj = (centro.x - x0) * esc / lado, (y1 - centro.y) * esc / lado
    celulas = [[int(r.i), int(r.j), round((r.indice - lo) / (hi - lo), 3),
                round(float(np.hypot(r.i - ci, r.j - cj)) / max(cols, lins), 3)]
               for r in s.itertuples()]
    # 5º campo: o bairro do pixel (para acender a cidade por bairro, ex.: tempo de ônibus)
    for c, r in zip(celulas, s.itertuples()):
        c.append(int(r.bairro_id))
    out = {"lado": lado, "cols": cols, "lins": lins, "celulas": celulas,
           "proj": {"x0": round(x0, 2), "y1": round(y1, 2), "esc": esc}}
    (PUB / "dados/cidade.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"cidade: {len(celulas)} pixels em {cols}x{lins}")
    return out["proj"]


def projetor(proj):
    """lon/lat -> coordenadas da cidade em pixels (as mesmas do cidade.json)."""
    from pyproj import Transformer
    tr = Transformer.from_crs(4326, 31984, always_xy=True)

    def f(lon, lat):
        x, y = tr.transform(lon, lat)
        return round((x - proj["x0"]) * proj["esc"], 1), round((proj["y1"] - y) * proj["esc"], 1)
    return f


def ler_js(arquivo, var):
    texto = (RAIZ / "dashboard" / arquivo).read_text(encoding="utf-8")
    return json.loads(re.sub(rf"^.*?{re.escape(var)}\s*=\s*", "", texto, count=1, flags=re.S).rstrip().rstrip(";"))


def contornos(proj):
    """Bairros como caminhos SVG no espaço da cidade, com o tempo de ônibus até o Centro (p50)."""
    b = gpd.read_file(RAIZ / "data/geo/bairros_fortaleza.geojson").to_crs(31984)
    b["geometry"] = b.simplify(25)
    tempos = pd.read_csv(RAIZ / "data/processed/transporte_tempos.csv")
    ate = tempos[tempos.to_id == "p_centro"].set_index("from_id").p50
    pts = pd.read_csv(RAIZ / "data/processed/transporte_pontos.csv").set_index("id")
    f = projetor(proj)
    xy = lambda x, y: (round((x - proj["x0"]) * proj["esc"], 1), round((proj["y1"] - y) * proj["esc"], 1))  # noqa: E731
    saida = []
    for r in b.itertuples():
        polis = r.geometry.geoms if r.geometry.geom_type == "MultiPolygon" else [r.geometry]
        d = " ".join("M" + " L".join(f"{a},{c}" for a, c in (xy(*q[:2]) for q in pol.exterior.coords)) + " Z" for pol in polis)
        bid = f"b{r.bairro_id}"
        c = r.geometry.representative_point()
        saida.append({"id": int(r.bairro_id), "nome": r.nome.title(), "d": d,
                      "min": None if pd.isna(ate.get(bid)) else int(ate[bid]),
                      "ponto": list(f(pts.at[bid, "lon"], pts.at[bid, "lat"])) if bid in pts.index else list(xy(c.x, c.y))})
    validos = [x["min"] for x in saida if x["min"] is not None]
    meta = {"pares": int(len(tempos)), "bairros": int(tempos.from_id.nunique()), "polos": int(tempos.to_id.str.startswith("p_").sum() // tempos.from_id.nunique()),
            "mediana_centro": int(np.median(validos)), "max_centro": int(max(validos))}
    (PUB / "dados/contornos.json").write_text(json.dumps({"meta": meta, "bairros": saida}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"contornos: {len(saida)} bairros; até o Centro: mediana {meta['mediana_centro']} min, máx. {meta['max_centro']} min")


def onibus(proj, origem="b72", destino="p_centro"):
    """A opção mais rápida de origem -> destino (dashboard/transporte), com o traçado de cada
    linha cortado entre a parada de subida e a de descida, e as caminhadas em linha reta."""
    f = projetor(proj)
    T = ler_js("transporte.js", "window.TRANSPORTE")
    tracados = ler_js("transporte_linhas.js", "window.TRANSPORTE_LINHAS")
    R = ler_js(f"transporte/o_{origem[1:]}.js", "]")
    op = R["rotas"][destino][0]
    paradas = R["paradas"]
    pts = pd.read_csv(RAIZ / "data/processed/transporte_pontos.csv").set_index("id")
    polo = next(p for p in T["polos"] if p["id"] == destino)
    inicio = f(pts.at[origem, "lon"], pts.at[origem, "lat"])
    fim = f(polo["lon"], polo["lat"])
    pernas, atual = [], inicio
    for k, perna in enumerate(op["p"]):
        if perna[0] == "a":
            prox = next((q for q in op["p"][k + 1:] if q[0] == "l"), None)
            alvo = f(paradas[prox[4]][2], paradas[prox[4]][1]) if prox else fim
            pernas.append({"tipo": "pe", "min": perna[1], "pts": [list(atual), list(alvo)]})
            atual = alvo
            continue
        _, chave, viagem, espera, sobe, desce = perna
        curto, longo, modo = T["linhas"][chave]
        a = Point(f(paradas[sobe][2], paradas[sobe][1]))
        b = Point(f(paradas[desce][2], paradas[desce][1]))
        melhor = None
        for forma in tracados.get(chave, []):
            linha = LineString([f(lon, lat) for lat, lon in forma])
            pa, pb = linha.project(a), linha.project(b)
            erro = linha.distance(a) + linha.distance(b)
            if pb > pa and (melhor is None or erro < melhor[0]):
                melhor = (erro, substring(linha, pa, pb))
        geo = [list(map(lambda v: round(v, 1), c)) for c in melhor[1].coords] if melhor else [list(a.coords[0]), list(b.coords[0])]
        pernas.append({"tipo": "onibus" if modo == "onibus" else "metro", "linha": curto, "nome": longo, "min": viagem,
                       "espera": espera, "sobe": paradas[sobe][0], "desce": paradas[desce][0], "pts": geo})
        atual = tuple(geo[-1])
    nome = {f"b{c['id']}": c["nome"] for c in json.loads((PUB / "dados/contornos.json").read_text(encoding="utf-8"))["bairros"]}
    out = {"origem": nome.get(origem, origem), "destino": polo["nome"], "total": op["t"], "inicio": list(inicio), "fim": list(fim), "pernas": pernas}
    (PUB / "dados/onibus.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"ônibus: {out['origem']} -> {out['destino']}, {out['total']} min, " + " + ".join(p.get("linha", "a pé") for p in pernas))


def camadas(proj):
    f = projetor(proj)
    pr = gpd.read_file(RAIZ / "data/raw/pracas_urbifor_2019.geojson").to_crs(31984)
    centro = gpd.read_file(RAIZ / "data/geo/bairros_fortaleza.geojson").to_crs(31984)
    c0 = centro[centro.nome == "CENTRO"].geometry.iloc[0].centroid
    xy = lambda x, y: [round((x - proj["x0"]) * proj["esc"], 1), round((proj["y1"] - y) * proj["esc"], 1)]  # noqa: E731
    pracas = [xy(g.centroid.x, g.centroid.y) + [round(float(g.area)), round(float(g.centroid.distance(c0)))] for g in pr.geometry]
    E = ler_js("equipamentos.js", "window.EQUIP")
    hospitais = [list(f(lon, lat)) for lat, lon, *_ in E["hospitais"]]
    out = {"pracas": pracas, "hospitais": hospitais, "centro": xy(c0.x, c0.y)}
    (PUB / "dados/camadas.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"camadas: {len(pracas)} praças, {len(hospitais)} hospitais")


def evolucao():
    t = pd.read_csv(RAIZ / "data/processed/bairros_indice.csv")
    t = t.sort_values("var_indice_socio")
    out = [{"nome": n, "v": round(v, 2), "renda": round(r, 1)}
           for n, v, r in zip(t.bairro, t.var_indice_socio, t.var_renda_real_pct)]
    (PUB / "dados/evolucao.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"evolução: {len(out)} bairros; perderam renda real: {(t.var_renda_real_pct < 0).sum()}")


# =============================================================== áudio
rng = np.random.default_rng(7)


def tempo(seg):
    return np.arange(int(seg * SR)) / SR


def lowpass(x, corte):
    """Passa-baixa de um polo (corte pode variar no tempo)."""
    corte = np.broadcast_to(np.asarray(corte, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * corte / SR)
    y = np.empty_like(x)
    acc = 0.0
    for k in range(len(x)):
        acc = (1 - a[k]) * x[k] + a[k] * acc
        y[k] = acc
    return y


def lp_rapido(x, corte, passes=2):
    """Passa-baixa de corte fixo, vetorizado via média móvel (rápido para trechos longos)."""
    n = max(1, int(SR / corte / 2))
    k = np.ones(n) / n
    for _ in range(passes):
        x = np.convolve(x, k, mode="same")
    return x


def nota(freq_midi):
    return 440.0 * 2 ** ((freq_midi - 69) / 12)


def pad(acorde, dur, brilho=0.25):
    t = tempo(dur)
    s = np.zeros_like(t)
    for m in acorde:
        f = nota(m)
        for det in (-0.07, 0.0, 0.07):  # três vozes levemente desafinadas
            fase = rng.uniform(0, 2 * np.pi)
            ff = f * 2 ** (det / 12)
            s += np.sin(2 * np.pi * ff * t + fase) + brilho * np.sin(2 * np.pi * 2 * ff * t + fase) \
                + 0.5 * brilho * np.sin(2 * np.pi * 3 * ff * t + fase)
    return s / (len(acorde) * 3)


def env(n, a, r, sus=1.0):
    e = np.ones(n) * sus
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, sus, na) if na else e[:na]
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def colocar(mix, sinal, inicio_s, ganho=1.0):
    i = int(inicio_s * SR)
    f = min(len(mix), i + len(sinal))
    if f > i:
        mix[i:f] += sinal[: f - i] * ganho


def bumbo(dur=0.45, f0=110, f1=42):
    t = tempo(dur)
    f = f1 + (f0 - f1) * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)


def chimbal(dur=0.06):
    t = tempo(dur)
    n = rng.standard_normal(len(t))
    n = n - lp_rapido(n, 6000, 1)
    return n * np.exp(-t * 70)


def palma(dur=0.22):
    t = tempo(dur)
    n = rng.standard_normal(len(t))
    n = lp_rapido(n, 3500, 1) - lp_rapido(n, 900, 1)
    e = np.exp(-t * 18) * (1 + 0.6 * (np.sin(2 * np.pi * 90 * t) > 0))
    return n * e


def pluck(m, dur=0.5):
    t = tempo(dur)
    f = nota(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    return s * np.exp(-t * 7) * env(len(t), 0.004, 0.05)


def baixo(m, dur):
    t = tempo(dur)
    f = nota(m)
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    return s * env(len(t), 0.01, 0.08) * np.exp(-t * 1.2)


def impacto(dur=3.0):
    t = tempo(dur)
    sub = np.sin(2 * np.pi * np.cumsum(34 + 60 * np.exp(-t * 9)) / SR) * np.exp(-t * 1.6)
    ruido = rng.standard_normal(len(t))
    ruido = lp_rapido(ruido, 1800, 2) * np.exp(-t * 5)
    corpo = pad([38, 45, 50], dur, 0.1) * np.exp(-t * 1.1)
    return 0.9 * sub + 0.5 * ruido + 0.35 * corpo


def whoosh(dur=1.2):
    t = tempo(dur)
    n = rng.standard_normal(len(t))
    pos = t / dur
    forma = np.sin(np.pi * pos) ** 2.2
    corte = 300 + 5200 * np.sin(np.pi * pos) ** 1.5
    s = lowpass(n, corte) - lp_rapido(lowpass(n, corte), 250, 1)
    return s * forma * 2.2


def riser(dur=2.4):
    t = tempo(dur)
    n = rng.standard_normal(len(t))
    pos = t / dur
    s = lowpass(n, 200 + 6000 * pos ** 2) * pos ** 2.5
    tom = np.sin(2 * np.pi * np.cumsum(220 + 660 * pos ** 2) / SR) * pos ** 3 * 0.25
    return (s + tom) * env(len(t), 0.0, 0.03)


def clique():
    t = tempo(0.08)
    s = np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 90) + 0.4 * rng.standard_normal(len(t)) * np.exp(-t * 160)
    return s * 0.6


def salvar(nome, x, estereo_larg=0.0):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89  # pico -1 dBFS
    if estereo_larg:
        atraso = int(0.011 * SR)
        e, d = x.copy(), np.concatenate([np.zeros(atraso), x[:-atraso]])
        st = np.stack([e * (1 - estereo_larg / 2) + d * estereo_larg / 2, d * (1 - estereo_larg / 2) + e * estereo_larg / 2], 1)
    else:
        st = np.stack([x, x], 1)
    pcm = (np.clip(st, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(PUB / "audio" / nome), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"audio/{nome}: {len(x) / SR:.1f}s")


# Marcos da trilha (s), os mesmos de CENAS em src/tema.ts (frame / 30)
MARCOS = {"revelacao": 10.0, "arpejo": 20.0, "onibus": 25.2, "morar": 36.0, "tempo": 45.0,
          "camadas": 54.6, "rotas": 59.4, "montagem": 65.4, "final": 70.8}


def tique():
    """Tique de relógio: madeira curta e aguda (o contador da cena do ônibus)."""
    t = tempo(0.09)
    s = (np.sin(2 * np.pi * 1850 * t) + 0.6 * np.sin(2 * np.pi * 3100 * t)) * np.exp(-t * 85)
    return s + 0.25 * rng.standard_normal(len(t)) * np.exp(-t * 300)


def pop():
    """Selo de linha aparecendo: bolha curta com subida de altura."""
    t = tempo(0.22)
    f = 520 + 900 * (1 - np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22) * env(len(t), 0.003, 0.04)


def trilha():
    """Ré menor, 100 BPM (1 tempo = 18 frames). Seções casadas com o storyboard (MARCOS)."""
    M = MARCOS
    n = int(DURACAO_S * SR)
    mix = np.zeros(n)
    t = tempo(DURACAO_S)
    compasso = 4 * BEAT
    prog = [[50, 53, 57, 64], [46, 50, 53, 60], [41, 45, 48, 57], [48, 52, 55, 62]]  # Dm9 Bb F C
    raizes = [38, 34, 41, 36]
    fim_b = M["final"]

    # A (0–10 s): drone + vento + pad abrindo
    drone = (np.sin(2 * np.pi * nota(26) * t) + 0.5 * np.sin(2 * np.pi * nota(38) * t)) * 0.22
    drone *= np.clip(t / 4, 0, 1) * np.where(t < fim_b, 1, 1.6 * np.exp(-(t - fim_b) * 0.22))
    vento = lp_rapido(rng.standard_normal(n), 500, 3) * 3.5
    vento *= np.clip(t / 3, 0, 1) * np.clip((16 - t) / 6, 0.15, 1) * np.where(t < fim_b, 1, 0.1)
    mix += drone + vento * 0.25
    colocar(mix, pad([50, 57, 64, 69], 10.5, 0.08) * env(int(10.5 * SR), 6, 0.6, 0.55), 0)

    # B (10 s em diante): progressão em loop, pad sustentado
    inicio_b = M["revelacao"]
    k = 0
    while inicio_b + k * compasso < fim_b:
        c = prog[k % 4]
        colocar(mix, pad(c, compasso + 0.3, 0.22) * env(int((compasso + 0.3) * SR), 0.25, 0.4, 0.42), inicio_b + k * compasso)
        k += 1

    # pulsação: bumbo leve na revelação, cheio no arpejo, mais forte na montagem
    tb = inicio_b
    while tb < fim_b:
        g = 0.35 if tb < M["arpejo"] else (0.6 if tb < M["camadas"] else (0.72 if tb < M["montagem"] else 0.85))
        colocar(mix, bumbo(), tb, g)
        tb += BEAT

    # arpejo (20 s+): colcheias; abre um respiro no começo do ônibus
    ta, i = M["arpejo"], 0
    while ta < fim_b:
        c = prog[int((ta - inicio_b) // compasso) % 4]
        m = (c + [c[1] + 12, c[2] + 12])[i % 6] + 12
        g = 0.16 if ta < M["morar"] else (0.22 if ta < M["montagem"] else 0.28)
        if M["onibus"] <= ta < M["onibus"] + 1.2:
            g *= 0.3
        colocar(mix, pluck(m), ta, g)
        ta += BEAT / 2
        i += 1

    # relógio: o tempo de ônibus sendo contado (tique em semicolcheias, mais forte no tempo)
    tt, i = M["onibus"] + 1.2, 0
    while tt < M["onibus"] + 8.4:
        colocar(mix, tique(), tt, 0.16 if i % 4 else 0.26)
        tt += BEAT / 4
        i += 1

    # chimbal (Onde morar em diante) e palmas (montagem)
    th = M["morar"]
    while th < fim_b:
        colocar(mix, chimbal(), th + BEAT / 2, 0.22 if th < M["montagem"] else 0.32)
        if th >= M["montagem"]:
            colocar(mix, chimbal(), th, 0.14)
        th += BEAT
    tp = M["montagem"] + BEAT
    while tp < fim_b:
        colocar(mix, palma(), tp, 0.32)
        tp += 2 * BEAT

    # baixo (camadas em diante)
    tbx = M["camadas"]
    while tbx < fim_b:
        r = raizes[int((tbx - inicio_b) // compasso) % 4]
        colocar(mix, baixo(r, BEAT * 0.9), tbx, 0.42)
        colocar(mix, baixo(r, BEAT * 0.45), tbx + BEAT * 1.5, 0.3)
        tbx += 2 * BEAT

    # final: acorde resolvido em Ré maior, longo
    dur_fim = DURACAO_S - fim_b
    fim_acorde = pad([38, 50, 54, 57, 62, 66], dur_fim, 0.22) * env(int(dur_fim * SR), 0.02, 2.5, 0.85) * np.exp(-tempo(dur_fim) * 0.12)
    colocar(mix, fim_acorde, fim_b, 2.6)
    colocar(mix, pluck(74, 3.0), fim_b, 0.3)
    colocar(mix, pluck(78, 3.0), fim_b + 0.3, 0.22)
    colocar(mix, pluck(81, 3.0), fim_b + 0.6, 0.18)

    mix = lp_rapido(mix, 9000, 1)
    salvar("trilha.wav", mix, estereo_larg=0.5)


def efeitos():
    salvar("impacto.wav", impacto())
    salvar("whoosh.wav", whoosh(), estereo_larg=0.6)
    salvar("riser.wav", riser())
    salvar("clique.wav", clique())
    salvar("tique.wav", tique())
    salvar("pop.wav", pop())


if __name__ == "__main__":
    proj = cidade()
    evolucao()
    contornos(proj)
    onibus(proj)
    camadas(proj)
    efeitos()
    trilha()
