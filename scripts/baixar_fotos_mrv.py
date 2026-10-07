from __future__ import annotations

import csv
import html
import re
import shutil
import sys
import unicodedata
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path


BASE = Path(__file__).resolve().parents[1]
OUTPUT = BASE / "output" / "mrv_empreendimentos"
ZIP_PATH = BASE / "output" / "empreendimentos_mrv_fotos.zip"

EMPREENDIMENTOS = [
    ("RESIDENCIAL FORTITUDINE", "https://www.mrv.com.br/imoveis/ceara/fortaleza/apartamentos-residencial-fortitudine"),
    ("RESIDENCIAL FLOR DO SERTAO", "https://www.mrv.com.br/imoveis/ceara/fortaleza/apartamentos-residencial-flor-do-sertao"),
    ("VILLE DE LISBOA", "https://www.mrv.com.br/imoveis/ceara/caucaia/apartamentos-ville-de-lisboa"),
    ("RESERVA DA LAGOA", "https://www.mrv.com.br/imoveis/ceara/fortaleza/apartamentos-reserva-da-lagoa"),
    ("RESIDENCIAL LA SERENA", "https://www.mrv.com.br/imoveis/ceara/fortaleza/apartamentos-residencial-la-serena"),
    ("FORTE ALENCAR", "https://www.mrv.com.br/imoveis/ceara/fortaleza/apartamentos-forte-alencar"),
    ("PARQUE MARISTA", "https://www.mrv.com.br/imoveis/ceara/fortaleza/apartamentos-parque-marista"),
    ("RESIDENCIAL FAROL DO ATLANTICO", "https://www.mrv.com.br/imoveis/ceara/fortaleza/apartamentos-residencial-farol-do-atlantico"),
    ("RESERVA VILA DO SOL", "https://www.mrv.com.br/imoveis/ceara/fortaleza/apartamentos-sensia-reserva-vila-do-sol"),
    ("VILLE DE PORTO", "https://www.mrv.com.br/imoveis/ceara/caucaia/apartamentos-ville-de-porto"),
    ("TORRE DO MAR", "https://www.mrv.com.br/imoveis/ceara/fortaleza/apartamentos-torre-do-mar"),
    ("PORTO DAS MARES", "https://www.mrv.com.br/imoveis/ceara/fortaleza/apartamentos-porto-das-mares"),
    ("RESIDENCIAL MANDACARU", "https://www.mrv.com.br/imoveis/ceara/fortaleza/apartamentos-residencial-mandacaru"),
    ("RESERVA BRISA DO MAR", "https://www.mrv.com.br/imoveis/ceara/fortaleza/apartamentos-reserva-brisa-do-mar"),
    ("RESIDENCIAL VALPARAISO", "https://www.mrv.com.br/imoveis/ceara/fortaleza/apartamentos-residencial-valparaiso"),
    ("ECO PARK", "https://www.mrv.com.br/imoveis/ceara/eusebio/apartamentos-eco-park"),
]


def ascii_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("._")
    return value or "arquivo"


def request(url: str) -> tuple[bytes, str, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read(), response.geturl(), response.headers.get("Content-Type", "")


def image_urls(page: str) -> list[str]:
    normalized = html.unescape(page).replace(r"\/", "/").replace(r"\u002F", "/")
    matches = re.findall(
        r"https?://[^\s\"'<>]+?\.(?:jpe?g|png|webp)(?:\?[^\s\"'<>]*)?",
        normalized,
        flags=re.IGNORECASE,
    )
    selected: list[str] = []
    seen: set[str] = set()
    for raw in matches:
        url = raw.rstrip("),];}")
        path = urllib.parse.urlparse(url).path.lower()
        is_project_asset = (
            "/content/dam/conhecer/imoveis/" in path
            or "/content/dam/mrv/content-fragments/detalhe-empreendimento/" in path
            or "/imoveis/upload/imovel/" in path
        )
        is_generic = any(token in path for token in ("/linhaproduto/", "logo", "icone", "icon-", "mia"))
        if is_project_asset and not is_generic and url not in seen:
            seen.add(url)
            selected.append(url)
    return selected


def extension(content_type: str, url: str) -> str:
    suffix = Path(urllib.parse.unquote(urllib.parse.urlparse(url).path)).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp"}:
        return suffix
    return {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }.get(content_type.split(";", 1)[0].lower(), ".jpg")


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, object]] = []

    for index, (name, page_url) in enumerate(EMPREENDIMENTOS, start=1):
        folder = OUTPUT / f"{index:02d}_{ascii_name(name)}"
        folder.mkdir(parents=True, exist_ok=True)
        downloaded = 0
        status = "OK"
        final_url = page_url
        error = ""
        try:
            body, final_url, content_type = request(page_url)
            page = body.decode("utf-8", errors="replace")
            if "text/html" not in content_type.lower():
                raise RuntimeError(f"conteudo inesperado: {content_type}")
            urls = image_urls(page)
            for photo_index, photo_url in enumerate(urls, start=1):
                try:
                    photo, photo_final_url, photo_type = request(photo_url)
                    if not photo_type.lower().startswith("image/"):
                        continue
                    original = Path(urllib.parse.unquote(urllib.parse.urlparse(photo_final_url).path)).stem
                    filename = f"{photo_index:02d}_{ascii_name(original)[:120]}{extension(photo_type, photo_final_url)}"
                    (folder / filename).write_bytes(photo)
                    downloaded += 1
                except Exception as exc:  # Mantem o restante da galeria mesmo se uma imagem falhar.
                    error = f"{error}; imagem {photo_index}: {exc}".strip("; ")
            if not urls:
                status = "SEM_FOTOS_NA_PAGINA"
        except Exception as exc:
            status = "PAGINA_INDISPONIVEL"
            error = str(exc)

        (folder / "link_oficial.txt").write_text(
            f"Empreendimento: {name}\nLink pesquisado: {page_url}\nLink final: {final_url}\n"
            f"Status: {status}\nFotos baixadas: {downloaded}\n"
            + (f"Observacao: {error}\n" if error else ""),
            encoding="utf-8",
        )
        rows.append(
            {
                "ordem": index,
                "empreendimento": name,
                "link_oficial": final_url,
                "status": status,
                "fotos_baixadas": downloaded,
                "observacao": error,
            }
        )
        print(f"{index:02d}/16 {name}: {status}, {downloaded} foto(s)")

    with (OUTPUT / "links_oficiais.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys(), delimiter=";")
        writer.writeheader()
        writer.writerows(rows)

    summary = [
        "EMPREENDIMENTOS MRV - LINKS E FOTOS OFICIAIS",
        "",
        "Cada pasta contem o link oficial e as imagens publicamente acessiveis encontradas na pagina.",
        "As imagens permanecem sujeitas aos direitos autorais e termos de uso da MRV.",
        "",
    ]
    summary.extend(
        f"{row['ordem']:02d}. {row['empreendimento']} | {row['status']} | {row['fotos_baixadas']} foto(s) | {row['link_oficial']}"
        for row in rows
    )
    (OUTPUT / "LEIA-ME.txt").write_text("\n".join(summary) + "\n", encoding="utf-8")

    ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(OUTPUT.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(OUTPUT.parent))

    print(f"ZIP: {ZIP_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
