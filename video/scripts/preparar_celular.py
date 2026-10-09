"""Prepara a foto do celular no gramado para a cena "Na palma da mão" (Montagem).

  originais/celular_gramado.webp   foto original (752x564), com outro app na tela
  public/fotos/celular_gramado.jpg  a foto em 1920x1440 (cobre o quadro de 1920x1080), com a tela apagada
  public/dados/celular.json         os quatro cantos da tela na foto ampliada, para encaixar as capturas do dashboard

A tela original é pintada com a cor da borda do aparelho: o filme desenha a captura por cima,
com cantos arredondados, e qualquer sobra fica parecendo a borda.

Rodar da raiz do repositório:  .venv/Scripts/python video/scripts/preparar_celular.py
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

RAIZ = Path(__file__).resolve().parents[2]
ORIGEM = RAIZ / "video/originais/celular_gramado.webp"
PUB = RAIZ / "video/public"

LARGURA = 1920
# Cantos da tela na foto original (px), medidos pela passagem da borda escura para a tela:
# superior esquerdo, superior direito, inferior direito, inferior esquerdo. O aparelho está
# encostado e um pouco inclinado, por isso a tela não é um retângulo.
TELA = [(307.0, 190.5), (447.5, 192.0), (430.5, 484.5), (287.5, 481.5)]
BORDA = (14, 14, 18)  # cor da borda do aparelho
FOLGA = 0.5  # px da foto original: a área apagada passa um pouco da tela


def expandir(quad, d):
    cx = sum(x for x, _ in quad) / 4
    cy = sum(y for _, y in quad) / 4
    return [(x + d * (1 if x > cx else -1), y + d * (1 if y > cy else -1)) for x, y in quad]


def main():
    foto = Image.open(ORIGEM).convert("RGB")
    k = LARGURA / foto.width
    alt = round(foto.height * k)
    foto = foto.resize((LARGURA, alt), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    ImageDraw.Draw(foto).polygon([(x * k, y * k) for x, y in expandir(TELA, FOLGA)], fill=BORDA)
    (PUB / "fotos").mkdir(parents=True, exist_ok=True)
    foto.save(PUB / "fotos/celular_gramado.jpg", quality=92)
    dados = {"largura": LARGURA, "altura": alt, "tela": [[round(x * k, 1), round(y * k, 1)] for x, y in TELA]}
    (PUB / "dados/celular.json").write_text(json.dumps(dados, indent=1), encoding="utf-8")
    print(dados)


if __name__ == "__main__":
    main()
