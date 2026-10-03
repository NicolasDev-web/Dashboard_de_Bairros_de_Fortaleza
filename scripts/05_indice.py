"""Etapa 5 — Normalização, índice composto e variação 2010 → 2022.

Escalas (0–100, maior = melhor):
  renda       min-max do log da renda REAL (R$ de jul/2022, IPCA). Mínimo e máximo
              são tirados de 2010 e 2022 juntos, então os scores dos dois anos estão na
              mesma régua. Log porque a renda é muito assimétrica (R$ 1,3 mil a 14,8 mil).
  saneamento  o próprio % de domicílios com esgoto em rede (já é 0–100 e interpretável).
  seguranca   mortes violentas (CVLI) por 100 mil, min-max INVERTIDO entre as 10 AIS
              (AIS com menor taxa = 100). Taxa média de 2019 a 2025 com peso crescente
              (2019 pesa 1, 2025 pesa 7): estável, mas sem ignorar a tendência recente.
              Roubos (CVP) saem à parte, só como informação: roubo registrado se concentra
              onde há comércio e circulação e é sub-registrado na periferia, então pesá-lo
              fazia áreas violentas e pobres parecerem seguras (revisão de out/2026).
              Só existe para o período atual e é um valor por AIS, igual para os bairros dela.

Índices:
  indice        (snapshot 2022) = média ponderada de renda, saneamento e segurança.
                Pesos iguais (1/3); o dashboard pode recalcular com outros pesos a partir
                dos scores de cada eixo, que também saem no arquivo.
  indice_socio_2010 / _2022 = média de renda e saneamento (sem segurança, que não tem
                série comparável por bairro em 2010) — base da comparação temporal.

Saídas:
  data/processed/bairros_indice.csv
  data/processed/indice_meta.json   (pesos, IPCA, limites da normalização)
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
IN = ROOT / "data/processed/bairros_indicadores.csv"
OUT = ROOT / "data/processed/bairros_indice.csv"
META = ROOT / "data/processed/indice_meta.json"

PESOS = {"renda": 1 / 3, "saneamento": 1 / 3, "seguranca": 1 / 3}
PESOS_SEGURANCA = {"cvli": 1.0, "cvp": 0.0}
ANUAL = ROOT / "data/raw/seguranca_ais_anual.csv"
ANOS_CVLI = range(2019, 2026)  # peso = ano - 2018
# Data de referência dos dois censos: 31 de julho.
SIDRA_IPCA = "https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2266/p/201007,202207?formato=json"


def fator_ipca() -> tuple[float, dict]:
    try:
        linhas = requests.get(SIDRA_IPCA, timeout=60).json()[1:]
        idx = {l["D3C"]: float(l["V"]) for l in linhas}
    except Exception as e:  # sem rede: o IPCA de jul/2010 e jul/2022 não muda, reaproveita o último cálculo
        ipca = json.loads(META.read_text(encoding="utf-8"))["ipca"]
        print(f"SIDRA indisponível ({type(e).__name__}); usando o IPCA salvo em {META.name}")
        idx = {"201007": ipca["indice_jul2010"], "202207": ipca["indice_jul2022"]}
    return idx["202207"] / idx["201007"], idx


def cvli_ponderado(pop_ais: pd.Series) -> pd.Series:
    """CVLI por 100 mil de cada AIS, média 2019–2025 com peso crescente (população de 2022)."""
    a = pd.read_csv(ANUAL)
    a = a[(a.indicador == "cvli") & a.ano.isin(ANOS_CVLI) & a.ais.isin(pop_ais.index)].copy()
    a["taxa"] = a.ocorrencias / a.ais.map(pop_ais) * 1e5
    a["peso"] = a.ano - (min(ANOS_CVLI) - 1)
    return (a.taxa * a.peso).groupby(a.ais).sum() / a.peso.groupby(a.ais).sum()


def minmax(x: pd.Series, lo: float, hi: float, inverter: bool = False) -> pd.Series:
    s = (x - lo) / (hi - lo) * 100
    return (100 - s if inverter else s).clip(0, 100)


def main() -> None:
    t = pd.read_csv(IN)
    fator, idx = fator_ipca()

    # Renda real (R$ jul/2022)
    t["renda_real_2010"] = (t["renda_2010"] * fator).round(2)
    t["renda_real_2022"] = t["renda_2022"]
    log10, log22 = np.log(t["renda_real_2010"]), np.log(t["renda_real_2022"])
    lo, hi = min(log10.min(), log22.min()), max(log10.max(), log22.max())
    t["score_renda_2010"] = minmax(log10, lo, hi)
    t["score_renda_2022"] = minmax(log22, lo, hi)

    # Saneamento
    t["score_saneamento_2010"] = t["saneamento_2010"]
    t["score_saneamento_2022"] = t["saneamento_2022"]

    # Segurança (limites entre as AIS, não entre bairros — o valor é por AIS)
    pop_ais = t.drop_duplicates("ais").set_index("ais").pop_ais_2022
    t["cvli_pond"] = t.ais.map(cvli_ponderado(pop_ais)).round(2)
    t["n_bairros_ais"] = t.groupby("ais").bairro_id.transform("size")
    ais = t.drop_duplicates("ais")
    lim_seg = {"cvli": (float(ais.cvli_pond.min()), float(ais.cvli_pond.max())),
               "cvp": (float(ais.cvp.min()), float(ais.cvp.max()))}
    t["score_cvli"] = minmax(t["cvli_pond"], *lim_seg["cvli"], inverter=True)
    t["score_cvp"] = minmax(t["cvp"], *lim_seg["cvp"], inverter=True)
    t["score_seguranca"] = sum(t[f"score_{c}"] * w for c, w in PESOS_SEGURANCA.items())

    # Índices
    t["indice"] = (t["score_renda_2022"] * PESOS["renda"]
                   + t["score_saneamento_2022"] * PESOS["saneamento"]
                   + t["score_seguranca"] * PESOS["seguranca"])
    for ano in ("2010", "2022"):
        t[f"indice_socio_{ano}"] = (t[f"score_renda_{ano}"] + t[f"score_saneamento_{ano}"]) / 2

    # Variação temporal
    t["var_renda_real_pct"] = (t["renda_real_2022"] / t["renda_real_2010"] - 1) * 100
    t["var_saneamento_pp"] = t["saneamento_2022"] - t["saneamento_2010"]
    t["var_indice_socio"] = t["indice_socio_2022"] - t["indice_socio_2010"]

    # Rankings (1 = melhor)
    t["rank_indice"] = t["indice"].rank(ascending=False, method="min").astype(int)
    t["rank_socio_2010"] = t["indice_socio_2010"].rank(ascending=False, method="min").astype(int)
    t["rank_socio_2022"] = t["indice_socio_2022"].rank(ascending=False, method="min").astype(int)
    t["var_rank_socio"] = t["rank_socio_2010"] - t["rank_socio_2022"]  # positivo = subiu

    score_cols = [c for c in t.columns if c.startswith(("score_", "indice", "var_"))]
    t[score_cols] = t[score_cols].round(2)
    t = t.sort_values("rank_indice")
    t.to_csv(OUT, index=False, encoding="utf-8")

    META.write_text(json.dumps({
        "pesos": PESOS,
        "pesos_seguranca": PESOS_SEGURANCA,
        "cvli_janela": f"{min(ANOS_CVLI)}–{max(ANOS_CVLI)}, peso = ano − {min(ANOS_CVLI) - 1}",
        "ipca": {"indice_jul2010": idx["201007"], "indice_jul2022": idx["202207"], "fator": round(fator, 6),
                 "fonte": "IBGE/SIDRA tabela 1737, variável 2266"},
        "renda_log_min_max": [round(float(lo), 6), round(float(hi), 6)],
        "seguranca_min_max_ais": lim_seg,
        "renda_real_em": "R$ de julho/2022",
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    cols = ["rank_indice", "bairro", "ais", "indice", "score_renda_2022", "score_saneamento_2022", "score_seguranca"]
    print(f"IPCA jul/2010→jul/2022: ×{fator:.4f}\n")
    print("Top 10:\n", t[cols].head(10).round(1).to_string(index=False))
    print("\nÚltimos 5:\n", t[cols].tail(5).round(1).to_string(index=False))
    v = ["bairro", "renda_real_2010", "renda_real_2022", "var_renda_real_pct", "var_saneamento_pp", "var_indice_socio", "var_rank_socio"]
    print("\nMaiores avanços (índice socio):\n", t.sort_values("var_indice_socio", ascending=False)[v].head(5).round(1).to_string(index=False))
    print("\nMaiores recuos:\n", t.sort_values("var_indice_socio")[v].head(5).round(1).to_string(index=False))
    print(f"\nrenda real média dos bairros: 2010 R$ {t.renda_real_2010.mean():,.0f} → 2022 R$ {t.renda_real_2022.mean():,.0f}"
          f" | bairros com perda real: {(t.var_renda_real_pct < 0).sum()}")
    print(f"{len(t)} bairros -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
