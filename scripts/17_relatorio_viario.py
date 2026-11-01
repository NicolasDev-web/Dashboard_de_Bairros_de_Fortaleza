"""Etapa 17 — Números do Relatório Anual de Segurança Viária de Fortaleza 2023 para a página de trânsito.

O relatório (Prefeitura/AMC, mai/2024) traz o que o geojson aberto de sinistros não tem: a série
oficial de mortes desde 2002 (consolidada com SIM, IJF e PEFOCE), quem morreu (tipo de usuário,
idade, sexo) e a comparação com outras cidades. Os números foram transcritos, com a página, em
data/raw/relatorio_viario_2023.json; esta etapa só confere as somas e gera o arquivo da página.

Saída: dashboard/relatorio_viario.js
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENTRADA = ROOT / "data/raw/relatorio_viario_2023.json"
SAIDA = ROOT / "dashboard/relatorio_viario.js"


def sem_notas(d):
    return {k: v for k, v in d.items() if not k.startswith("_")}


def main() -> None:
    r = json.loads(ENTRADA.read_text(encoding="utf-8"))
    mortos = {int(a): v for a, v in sem_notas(r["mortos_ano"]).items()}
    usuario = sem_notas(r["mortos_2023_usuario"])
    # a Tabela 04 (por usuário) tem de fechar com a Figura 16 (total do ano)
    assert sum(usuario.values()) == mortos[2023], (sum(usuario.values()), mortos[2023])
    # a Figura 20 soma 99% (o resto é idade não informada); a 19 soma 99,9%
    for chave in ("mortos", "feridos"):
        assert abs(sum(r["idade_2023"][chave]) - 100) <= 1.05, chave

    dados = {
        "fonte": r["fonte"],
        "mortos_ano": mortos,
        "taxa_100mil": {int(a): v for a, v in sem_notas(r["taxa_100mil"]).items()},
        "marcos": r["marcos"],
        "usuario_2023": usuario,
        "idade_2023": sem_notas(r["idade_2023"]),
        "homens_pct_2023": sem_notas(r["homens_pct_2023"]),
        "comparacao": r["comparacao_100mil"]["lugares"],
    }
    SAIDA.write_text("window.RELATORIO_VIARIO = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n",
                     encoding="utf-8")
    print(f"mortes {min(mortos)}–{max(mortos)}: {mortos[min(mortos)]} → {mortos[max(mortos)]}; "
          f"2023 por usuário: {usuario}")
    print(f"-> {SAIDA.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
