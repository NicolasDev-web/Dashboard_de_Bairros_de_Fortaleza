"""Trilha da demo do produto: eletrônica leve e minimalista, sem vocal e sem batida agressiva.

Cresce aos poucos até a revelação do "Onde morar", resolve no resultado e fecha com um acorde longo.
As seções seguem src/demo/secoes.json, as mesmas da edição (src/demo/linha.ts).

Rodar de video/:  python3 scripts/demo/trilha_demo.py      (só precisa de numpy)
Saída: public/audio/trilha_demo.wav (fora do git; o script refaz).
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sintese import SR, baixo, bumbo, chimbal, colocar, env, lp_rapido, pad, pluck, riser, rng, salvar, tempo  # noqa: E402

S = json.loads((Path(__file__).resolve().parents[2] / "src/demo/secoes.json").read_text(encoding="utf-8"))
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
DUR = S["fim"] + 2.0  # cauda do acorde final

# Dm9 – B♭maj7 – F – C, como o filme de lançamento, mas mais aberto e sem pressa
PROG = [[50, 53, 57, 64], [46, 50, 53, 57], [41, 48, 53, 57], [48, 52, 55, 62]]
RAIZ = [38, 34, 41, 36]


def acorde_em(t):
    return int((t - S["mapa"]) // BAR) % 4 if t >= S["mapa"] else 0


def trilha():
    n = int(DUR * SR)
    mix = np.zeros(n)
    t = tempo(DUR)
    fim = S["encerramento"]

    # textura: ar filtrado bem baixo, abre devagar e some no fim
    ar = lp_rapido(rng.standard_normal(n), 700, 3) * 2.2
    ar *= np.clip(t / 2.5, 0, 1) * np.where(t < fim, 1, np.exp(-(t - fim) * 0.6)) * 0.18
    mix += ar

    # pad sustentado do começo ao fim, um acorde por compasso (abertura: só Dm9, crescendo)
    colocar(mix, pad(PROG[0], S["mapa"] + 0.4, 0.1) * env(int((S["mapa"] + 0.4) * SR), 3.2, 0.5, 0.5), 0)
    k, tb = 0, S["mapa"]
    while tb < fim:
        d = BAR + 0.35
        brilho = 0.14 if tb < S["morar"] else 0.24
        g = 0.42 if not (S["morar"] <= tb < S["orcamento"]) else 0.5
        colocar(mix, pad(PROG[k % 4], d, brilho) * env(int(d * SR), 0.3, 0.4, g), tb)
        k += 1
        tb += BAR

    # pulso: bumbo macio a partir do mapa; some no respiro do "Onde morar"; mais firme no quiz
    tk = S["mapa"]
    while tk < fim:
        if not (S["morar"] <= tk < S["orcamento"]):
            g = 0.26 if tk < S["camadas"] else (0.36 if tk < S["orcamento"] else (0.46 if tk < S["resultado"] else 0.4))
            colocar(mix, bumbo(0.4, 95, 44), tk, g)
        tk += BEAT

    # arpejo em colcheias (camadas em diante), mais presente no quiz
    ta, i = S["camadas"], 0
    while ta < fim:
        c = PROG[acorde_em(ta)]
        m = (c + [c[1] + 12, c[2] + 12])[i % 6] + 12
        g = 0.1 if ta < S["morar"] else (0.07 if ta < S["orcamento"] else (0.14 if ta < S["resultado"] else 0.12))
        colocar(mix, pluck(m, 0.45), ta, g)
        ta += BEAT / 2
        i += 1

    # chimbal leve no contratempo (ônibus em diante); semicolcheias na reta final do quiz
    th = S["onibus"]
    while th < fim:
        if not (S["morar"] <= th < S["orcamento"]):
            colocar(mix, chimbal(), th + BEAT / 2, 0.12 if th < S["preferencias"] else 0.17)
            if S["preferencias"] <= th < S["resultado"]:
                colocar(mix, chimbal(0.04), th + BEAT / 4, 0.07)
                colocar(mix, chimbal(0.04), th + 3 * BEAT / 4, 0.07)
        th += BEAT

    # baixo (orçamento em diante)
    tx = S["orcamento"]
    while tx < fim:
        r = RAIZ[acorde_em(tx)]
        colocar(mix, baixo(r, BEAT * 0.9), tx, 0.34)
        colocar(mix, baixo(r, BEAT * 0.45), tx + BEAT * 1.5, 0.24)
        tx += 2 * BEAT

    # "Onde morar": motivo de pergunta (três notas que sobem e ficam no ar)
    for j, m in enumerate([69, 72, 76]):
        colocar(mix, pluck(m, 1.6), S["morar"] + 1.2 + j * BEAT, 0.2)

    # subida para o resultado e resolução em Ré maior
    colocar(mix, riser(2.4), S["revelacao"] - 2.4, 0.22)
    res = pad([38, 50, 54, 57, 62, 66], 4.8, 0.2) * env(int(4.8 * SR), 0.02, 2.2, 0.8)
    colocar(mix, res, S["revelacao"], 0.9)
    for j, m in enumerate([74, 78, 81]):
        colocar(mix, pluck(m, 2.4), S["revelacao"] + j * 0.18, 0.18)

    # fecho: acorde longo em Ré maior, arpejo descendo devagar
    d = DUR - fim
    final = pad([38, 50, 54, 57, 62, 66], d, 0.2) * env(int(d * SR), 0.05, 3.5, 0.85) * np.exp(-tempo(d) * 0.18)
    colocar(mix, final, fim, 1.7)
    for j, m in enumerate([81, 78, 74, 69]):
        colocar(mix, pluck(m, 2.6), fim + 0.4 + j * BEAT, 0.16)

    mix = lp_rapido(mix, 9000, 1)
    salvar("trilha_demo.wav", mix, estereo_larg=0.5)


if __name__ == "__main__":
    trilha()
