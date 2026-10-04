"""Gera os assets do filme a partir dos dados reais do projeto + a trilha sintetizada.

  public/dados/cidade.json    Fortaleza em pixels (grade de células coloridas pelo índice)
  public/dados/evolucao.json  mudança 2010 -> 2022 por bairro (renda e saneamento)
  public/audio/*.wav          trilha e efeitos, sintetizados aqui (sem material de terceiros)

Rodar da raiz do repositório:  .venv/Scripts/python video/scripts/gerar_assets.py
"""
import json
import wave
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import Point

RAIZ = Path(__file__).resolve().parents[2]
PUB = RAIZ / "video/public"
(PUB / "dados").mkdir(parents=True, exist_ok=True)
(PUB / "audio").mkdir(parents=True, exist_ok=True)

FPS = 30
DURACAO_S = 55.0
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
    out = {"lado": lado, "cols": cols, "lins": lins, "celulas": celulas}
    (PUB / "dados/cidade.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"cidade: {len(celulas)} pixels em {cols}x{lins}")


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


def trilha():
    """Ré menor, 100 BPM (1 tempo = 18 frames). Seções casadas com o storyboard."""
    n = int(DURACAO_S * SR)
    mix = np.zeros(n)
    t = tempo(DURACAO_S)
    compasso = 4 * BEAT
    prog = [[50, 53, 57, 64], [46, 50, 53, 60], [41, 45, 48, 57], [48, 52, 55, 62]]  # Dm9 Bb F C
    raizes = [38, 34, 41, 36]

    # A (0–10 s): drone + vento + pad abrindo
    drone = (np.sin(2 * np.pi * nota(26) * t) + 0.5 * np.sin(2 * np.pi * nota(38) * t)) * 0.22
    drone *= np.clip(t / 4, 0, 1) * np.where(t < 48, 1, 1.6 * np.exp(-(t - 48) * 0.22))
    vento = lp_rapido(rng.standard_normal(n), 500, 3) * 3.5
    vento *= np.clip(t / 3, 0, 1) * np.clip((16 - t) / 6, 0.15, 1) * np.where(t < 48, 1, 0.1)
    mix += drone + vento * 0.25
    colocar(mix, pad([50, 57, 64, 69], 10.5, 0.08) * env(int(10.5 * SR), 6, 0.6, 0.55), 0)

    # B (10 s em diante): progressão em loop, pad sustentado
    inicio_b = 10.0
    k = 0
    while inicio_b + k * compasso < 48:
        c = prog[(k // 1) % 4]
        colocar(mix, pad(c, compasso + 0.3, 0.22) * env(int((compasso + 0.3) * SR), 0.25, 0.4, 0.42), inicio_b + k * compasso)
        k += 1

    # pulsação: bumbo leve a partir de 10 s, cheio a partir de 20 s
    tb = 10.0
    while tb < 48:
        g = 0.35 if tb < 20 else (0.6 if tb < 37 else 0.8)
        colocar(mix, bumbo(), tb, g)
        tb += BEAT

    # arpejo (20 s+): colcheias
    ta, i = 20.0, 0
    while ta < 48:
        c = prog[int((ta - inicio_b) // compasso) % 4]
        m = (c + [c[1] + 12, c[2] + 12])[i % 6] + 12
        g = 0.16 if ta < 32 else (0.22 if ta < 43 else 0.28)
        colocar(mix, pluck(m), ta, g)
        ta += BEAT / 2
        i += 1

    # chimbal (32 s+) e palmas (43–48 s)
    th = 32.0
    while th < 48:
        colocar(mix, chimbal(), th + BEAT / 2, 0.22 if th < 43 else 0.32)
        if th >= 43:
            colocar(mix, chimbal(), th, 0.14)
        th += BEAT
    tp = 43.0 + BEAT
    while tp < 48:
        colocar(mix, palma(), tp, 0.32)
        tp += 2 * BEAT

    # baixo (37 s+)
    tbx = 37.0
    while tbx < 48:
        r = raizes[int((tbx - inicio_b) // compasso) % 4]
        colocar(mix, baixo(r, BEAT * 0.9), tbx, 0.42)
        colocar(mix, baixo(r, BEAT * 0.45), tbx + BEAT * 1.5, 0.3)
        tbx += 2 * BEAT

    # final (48 s): acorde resolvido em Ré maior, longo
    fim = pad([38, 50, 54, 57, 62, 66], 7.0, 0.22) * env(int(7.0 * SR), 0.02, 2.5, 0.85) * np.exp(-tempo(7.0) * 0.12)
    colocar(mix, fim, 48.0, 2.6)
    colocar(mix, pluck(74, 3.0), 48.0, 0.3)
    colocar(mix, pluck(78, 3.0), 48.3, 0.22)
    colocar(mix, pluck(81, 3.0), 48.6, 0.18)

    mix = lp_rapido(mix, 9000, 1)
    salvar("trilha.wav", mix, estereo_larg=0.5)


def efeitos():
    salvar("impacto.wav", impacto())
    salvar("whoosh.wav", whoosh(), estereo_larg=0.6)
    salvar("riser.wav", riser())
    salvar("clique.wav", clique())


if __name__ == "__main__":
    cidade()
    evolucao()
    efeitos()
    trilha()
