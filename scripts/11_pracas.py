"""Etapa 11 — Praças e espaços públicos cadastrados (URBIFOR, 2019), por bairro.

Entrada: data/raw/pracas_urbifor_2019.geojson, o cadastro de praças da Prefeitura
(484 polígonos: praças, largos, areninhas, calçadões e polos de lazer).

O bairro de cada praça é refeito pela posição, na malha atual de 2025: o campo
`cod_bairro` do cadastro segue a divisão de 2019 e erra em bairros criados ou
redesenhados depois (Planalto Ayrton Senna, Conjunto Palmeiras, Parque Santa
Maria, Aracapé). A área vem da própria geometria, em SIRGAS 2000 / UTM 24S.

Por bairro: quantidade, área total, m² por morador (Censo 2022) e parte do
território. É "área de praças e espaços cadastrados", não área verde: o cadastro
não diz quanto é arborizado. Bairro sem nenhum polígono pode não ter praça ou só
não ter sido cadastrado — o painel diz isso, e o dado não entra no índice.

Saídas: data/processed/bairros_pracas.csv e dashboard/pracas.js.
"""
import json
import re
import unicodedata
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ENTRADA = ROOT / "data/raw/pracas_urbifor_2019.geojson"
BAIRROS = ROOT / "data/geo/bairros_fortaleza.geojson"
INDICE = ROOT / "data/processed/bairros_indice.csv"
OUT_CSV = ROOT / "data/processed/bairros_pracas.csv"
OUT_JS = ROOT / "dashboard/pracas.js"
UTM = 31984

# mesmo bairro com outro nome na malha de 2025 (ver a etapa 8): não conta como mudança
RENOMEADOS = {
    "bairro ellery": "ellery", "dende": "rachel de queiroz", "genibau": "parque genibau",
    "luciano cavalcante": "engenheiro luciano cavalcante", "panamericano": "pan americano",
    "santa maria": "parque santa maria", "sapiranga": "sapiranga coite", "sao joao do tauape": "tauape",
    "vila manuel satiro": "manoel satiro", "boa vista": "boa vista castelao", "jose walter": "prefeito jose walter",
}
_SEM_NOME = re.compile(r"sem\s+denomin", re.IGNORECASE)
_SO_CODIGO = re.compile(r"^(praça\s+)?(sem denomina\w+ oficial|gid\s*\d+)\b", re.IGNORECASE)


def limpar_nome(nome: str) -> tuple[str | None, bool]:
    """(nome para exibir, tem denominação oficial). "Praça da Rua X (sem denominação
    oficial)" vira "Praça da Rua X"; o que é só código ou "sem denominação" vira None."""
    nome = (nome or "").strip()
    oficial = not _SEM_NOME.search(nome)
    limpo = re.sub(r"\s*\(sem denomin[^)]*\)\s*", "", nome, flags=re.IGNORECASE).strip()
    limpo = re.sub(r"\s*-\s*GID\s*\d+$", "", limpo).strip()
    if not limpo or _SO_CODIGO.match(limpo):
        return None, False
    return limpo, oficial


def main() -> None:
    p = gpd.read_file(ENTRADA).to_crs(UTM)
    b = gpd.read_file(BAIRROS)[["bairro_id", "nome", "geometry"]].to_crs(UTM)
    pop = pd.read_csv(INDICE)[["bairro_id", "pop_2022"]]

    p["area_m2"] = p.area
    pts = p.copy()
    pts["geometry"] = p.representative_point()
    j = gpd.sjoin(pts[["geometry"]], b[["bairro_id", "nome", "geometry"]], predicate="within", how="left")
    j = j[~j.index.duplicated()]
    p["bairro_id"] = j.bairro_id
    p["bairro_atual"] = j.nome
    fora = p.bairro_id.isna().sum()
    assert not fora, f"{fora} praças fora da malha de 2025"
    p["bairro_id"] = p.bairro_id.astype(int)
    chave = lambda n: " ".join(unicodedata.normalize("NFKD", str(n)).encode("ascii", "ignore").decode()  # noqa: E731
                               .lower().replace("-", " ").split())
    antigo = p.bairro.map(chave).replace(RENOMEADOS)
    mudou = p[antigo != p.bairro_atual.map(chave)]

    nomes = p.nome.map(limpar_nome)
    p["nome_exibir"] = [n for n, _ in nomes]
    p["oficial"] = [o for _, o in nomes]
    p["popular"] = p.nome_pop.where(~p.nome_pop.str.lower().str.strip().isin(["sem informação", "sem informacao", ""]))

    # resumo por bairro (os 121, inclusive os sem cadastro)
    area_b = dict(zip(b.bairro_id, b.area))
    t = b[["bairro_id", "nome"]].merge(pop, on="bairro_id")
    g = p.groupby("bairro_id").agg(n_pracas=("area_m2", "size"), area_pracas_m2=("area_m2", "sum"),
                                   maior_m2=("area_m2", "max"))
    t = t.merge(g, on="bairro_id", how="left").fillna({"n_pracas": 0, "area_pracas_m2": 0, "maior_m2": 0})
    t["n_pracas"] = t.n_pracas.astype(int)
    t["m2_por_morador"] = (t.area_pracas_m2 / t.pop_2022).round(2)
    t["pct_territorio"] = (t.area_pracas_m2 / t.bairro_id.map(area_b) * 100).round(2)
    t["area_pracas_m2"] = t.area_pracas_m2.round(0)
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    t.drop(columns="maior_m2").to_csv(OUT_CSV, index=False)

    # polígonos para o mapa: simplificados a 1 m (as praças são pequenas) e o ponto para o zoom da cidade
    geo = p.copy()
    geo["geometry"] = p.simplify(1, preserve_topology=True)
    geo = geo.to_crs(4326)
    ponto = pts.to_crs(4326).geometry
    feats = []
    for (_, r), pt in zip(geo.iterrows(), ponto):
        gj = json.loads(gpd.GeoSeries([r.geometry]).to_json())["features"][0]["geometry"]
        gj["coordinates"] = json.loads(json.dumps(gj["coordinates"]), parse_float=lambda x: round(float(x), 6))
        feats.append({"type": "Feature", "geometry": gj, "properties": {
            "nome": r.nome_exibir, "oficial": bool(r.oficial),
            "popular": r.popular if isinstance(r.popular, str) else None,
            "bairro": int(r.bairro_id), "area": round(float(r.area_m2)),
            "ponto": [round(pt.y, 6), round(pt.x, 6)],
        }})

    total, habitantes = float(p.area_m2.sum()), float(pop.pop_2022.sum())
    dados = {
        "fonte": "URBIFOR", "ano": 2019,
        "cidade": {"n": len(p), "area_m2": round(total), "m2_por_morador": round(total / habitantes, 2),
                   "bairros_com_praca": int((t.n_pracas > 0).sum())},
        "bairros": {str(int(r.bairro_id)): {"n": int(r.n_pracas), "area_m2": float(r.area_pracas_m2),
                                            "m2_hab": float(r.m2_por_morador), "pct": float(r.pct_territorio)}
                    for _, r in t.iterrows()},
        "geojson": {"type": "FeatureCollection", "features": feats},
    }
    OUT_JS.write_text("window.PRACAS = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n",
                      encoding="utf-8")

    print(f"{len(p)} praças, {total / 1e6:.2f} km², {total / habitantes:.2f} m² por morador")
    print(f"bairro refeito pela posição: {len(mudou)} praças caem em outro bairro que o do cadastro "
          f"(fora as renomeações): {mudou.groupby(['bairro', 'bairro_atual']).size().to_dict()}")
    print(f"bairros com praça: {(t.n_pracas > 0).sum()} de {len(t)}; sem nenhuma: "
          f"{', '.join(sorted(t[t.n_pracas == 0].nome.str.title()))}")
    print(f"sem denominação oficial: {(~p.oficial).sum()}; com nome popular: {p.popular.notna().sum()}")
    print(t.sort_values("m2_por_morador", ascending=False)[["nome", "n_pracas", "area_pracas_m2", "m2_por_morador"]]
          .head(6).to_string(index=False))
    print(f"-> {OUT_CSV.relative_to(ROOT)}, {OUT_JS.relative_to(ROOT)} ({OUT_JS.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
