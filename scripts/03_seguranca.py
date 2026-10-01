"""Etapa 3 — Segurança pública (SSPDS/Supesp) por AIS de Fortaleza.

Fonte: planilhas de "dados detalhados" da SSPDS (um registro por vítima/ocorrência,
com município e AIS), https://www.ce.gov.br/sspds/estatisticas/dados-detalhados/
  - CVLI_2009-a-2025.xlsx  (aba CVLI: homicídio doloso, feminicídio, latrocínio, lesão
                            corporal seguida de morte; aba Intervenção Policial à parte)
  - CVP_2009-a-2025.xlsx   (roubos — crimes violentos contra o patrimônio)
Composição bairro → AIS: https://www.ce.gov.br/sspds/ais/ (texto da página, jul/2026).

Período de referência: 2025 (último ano completo). A divisão de Fortaleza em 10 AIS
(05, 06, 08, 16–22) é a mesma em toda a série 2019–2025, então também saem as
contagens anuais e a média 2023–2025 (CVLI por AIS tem contagens pequenas e oscila).

Saídas:
  data/raw/seguranca_ais.csv          AIS x indicadores
  data/raw/seguranca_ais_anual.csv    AIS x ano x indicador (2019–2025)
  data/raw/bairro_ais.csv             bairro (malha Seuma) → AIS
"""
import sys
import unicodedata
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data/cache/sspds"
RAW = ROOT / "data/raw"
BASE = "https://www.ce.gov.br/sspds/wp-content/uploads/sites/66/2026/01"
ARQS = {"cvli": "CVLI_2009-a-2025.xlsx", "cvp": "CVP_2009-a-2025.xlsx"}
ANO_REF = 2025
ANOS_MEDIA = (2023, 2024, 2025)

# Transcrito de https://www.ce.gov.br/sspds/ais/ (seção "Bairros" de cada AIS de Fortaleza).
AIS_BAIRROS = {
    "AIS 05": "Álvaro Weyne, Carlito Pamplona, Centro, Ellery, Farias Brito, Jacarecanga, Monte Castelo, "
              "Moura Brasil, São Gerardo",
    "AIS 06": "Aeroporto, Benfica, Bom Futuro, Couto Fernandes, Damas, Demócrito Rocha, Rachel de Queiroz, "
              "Fátima, Itaoca, Itaperi, Jardim América, José Bonifácio, Montese, Panamericano, Parangaba, "
              "Parreão, Serrinha, Vila Peri, Vila União",
    "AIS 08": "Aldeota, Cais do Porto, Meireles, Mucuripe, Varjota, Vicente Pinzón",
    "AIS 16": "Ancuri, Barroso, Coaçu, Conjunto Palmeiras, Curió, Guajeru, Jangurussu, Lagoa Redonda, "
              "Messejana, Parque Santa Maria, Paupina, Pedras, São Bento",
    "AIS 17": "Bom Jardim, Conjunto Ceará I, Conjunto Ceará II, Genibaú, Granja Lisboa, Granja Portugal, Siqueira",
    "AIS 18": "Amadeu Furtado, Antônio Bezerra, Autran Nunes, Bela Vista, Bonsucesso, Dom Lustosa, "
              "Henrique Jorge, João XXIII, Jóquei Clube, Olavo Oliveira, Padre Andrade, Parque Araxá, "
              "Parquelândia, Pici, Presidente Kennedy, Quintino Cunha, Rodolfo Teófilo",
    "AIS 19": "Aerolândia, Alto da Balança, Boa Vista / Castelão, Cajazeiras, Cambeba, Cidade dos Funcionários, "
              "Dias Macêdo, Edson Queiroz, Jardim das Oliveiras, José de Alencar, Parque Dois Irmãos, "
              "Parque Iracema, Parque Manibura, Passaré, Sabiaguaba, Sapiranga / Coité",
    "AIS 20": "Barra do Ceará, Cristo Redentor, Floresta, Jardim Guanabara, Jardim Iracema, Pirambu, Vila Velha",
    "AIS 21": "Aracapé, Canindezinho, Conjunto Esperança, Jardim Cearense, Manoel Sátiro, Maraponga, Mondubim, "
              "Novo Mondubim, Parque Presidente Vargas, Parque Santa Rosa, Parque São José, "
              "Planalto Ayrton Senna, Prefeito José Walter",
    "AIS 22": "Cidade 2000, Cocó, De Lourdes, Dionísio Torres, Engenheiro Luciano Cavalcante, Guararapes, "
              "Joaquim Távora, Manuel Dias Branco, Papicu, Praia do Futuro I, Praia do Futuro II, Salinas, Tauape",
}
# Grafia SSPDS → grafia da malha Seuma
ALIAS = {
    "genibau": "parque genibau",
    "panamericano": "pan americano",
    "boa vista / castelao": "boa vista castelao",
    "sapiranga / coite": "sapiranga coite",
}
# Bairros da malha que a página da SSPDS não lista: AIS atribuída por vizinhança/histórico.
SEM_LISTA = {
    "praia de iracema": ("AIS 08", "não listado na página da SSPDS; atribuído à AIS 08 (orla leste, "
                                   "vizinho de Meireles) — conferir"),
}


def slug(nome: str) -> str:
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return " ".join(s.lower().replace("-", " ").split())


def baixar(nome: str) -> Path:
    destino = CACHE / nome
    if not destino.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"baixando {nome} ...")
        r = requests.get(f"{BASE}/{nome}", headers={"User-Agent": "Mozilla/5.0"}, timeout=300)
        r.raise_for_status()
        destino.write_bytes(r.content)
    return destino


def eventos_fortaleza() -> pd.DataFrame:
    cvli = pd.read_excel(baixar(ARQS["cvli"]), sheet_name=["CVLI", "Intervenção Policial"])
    cvp = pd.read_excel(baixar(ARQS["cvp"]), sheet_name=0)
    partes = [
        cvli["CVLI"].assign(indicador="cvli"),
        cvli["Intervenção Policial"].assign(indicador="intervencao_policial"),
        cvp.assign(indicador="cvp"),
    ]
    ev = pd.concat([p[["Município", "AIS", "Data", "indicador"]] for p in partes], ignore_index=True)
    ev = ev[ev["Município"].astype(str).str.strip().str.lower() == "fortaleza"].copy()
    ev["ano"] = pd.to_datetime(ev["Data"], errors="coerce").dt.year
    ev["AIS"] = ev["AIS"].str.strip()
    return ev


def bairro_ais() -> pd.DataFrame:
    malha = gpd.read_file(ROOT / "data/geo/bairros_fortaleza.geojson")[["bairro_id", "nome", "bairro_slug"]]
    linhas = []
    for ais, lista in AIS_BAIRROS.items():
        for nome in lista.split(", "):
            s = slug(nome)
            linhas.append({"bairro_sspds": nome, "bairro_slug": ALIAS.get(s, s), "ais": ais, "obs": ""})
    for s, (ais, obs) in SEM_LISTA.items():
        linhas.append({"bairro_sspds": "", "bairro_slug": s, "ais": ais, "obs": obs})
    m = pd.DataFrame(linhas)

    sobra_sspds = m[~m.bairro_slug.isin(malha.bairro_slug)]
    sobra_malha = malha[~malha.bairro_slug.isin(m.bairro_slug)]
    dup = m[m.bairro_slug.duplicated(keep=False)]
    if len(sobra_sspds) or len(sobra_malha) or len(dup):
        print("SSPDS sem par na malha:\n", sobra_sspds, "\nmalha sem AIS:\n", sobra_malha, "\nduplicados:\n", dup)
        sys.exit(1)
    return malha.merge(m, on="bairro_slug")[["bairro_id", "nome", "bairro_slug", "ais", "bairro_sspds", "obs"]] \
                .sort_values(["ais", "nome"])


def main() -> None:
    ev = eventos_fortaleza()
    anual = (ev[ev.ano.between(2019, ANO_REF)]
             .groupby(["AIS", "ano", "indicador"]).size().rename("ocorrencias").reset_index()
             .rename(columns={"AIS": "ais"}))
    anual.to_csv(RAW / "seguranca_ais_anual.csv", index=False)

    piv = anual.pivot_table(index="ais", columns=["indicador", "ano"], values="ocorrencias", fill_value=0)
    tab = pd.DataFrame(index=piv.index)
    for ind in ("cvli", "cvp", "intervencao_policial"):
        tab[f"{ind}_{ANO_REF}"] = piv[(ind, ANO_REF)]
        tab[f"{ind}_media_{ANOS_MEDIA[0]}_{ANOS_MEDIA[-1]}"] = piv[ind][list(ANOS_MEDIA)].mean(axis=1).round(1)
    tab = tab.reset_index()

    ba = bairro_ais()
    ba.to_csv(RAW / "bairro_ais.csv", index=False, encoding="utf-8")
    tab["n_bairros"] = tab["ais"].map(ba.groupby("ais").size()).astype("Int64")
    tab.to_csv(RAW / "seguranca_ais.csv", index=False)

    print(tab.to_string(index=False))
    print(f"\n{len(ba)} bairros mapeados para {ba.ais.nunique()} AIS -> data/raw/bairro_ais.csv")
    nao_id = tab[tab.n_bairros.isna()]
    if len(nao_id):
        print("obs: linhas sem bairro (ocorrências sem AIS identificada):", nao_id.ais.tolist())


if __name__ == "__main__":
    main()
