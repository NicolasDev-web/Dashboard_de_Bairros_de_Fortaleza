"""Síntese de áudio do filme: instrumentos e efeitos feitos só com numpy, sem material de terceiros.
Usado por gerar_assets.py (filme de lançamento) e demo/trilha_demo.py (demo do produto)."""
import wave
from pathlib import Path

import numpy as np

SR = 48_000
AUDIO = Path(__file__).resolve().parents[1] / "public/audio"

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
    AUDIO.mkdir(parents=True, exist_ok=True)
    with wave.open(str(AUDIO / nome), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"audio/{nome}: {len(x) / SR:.1f}s")


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
