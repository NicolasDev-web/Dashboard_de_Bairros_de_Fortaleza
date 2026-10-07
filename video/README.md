# Bairros de Fortaleza: filme de lançamento

Filme de 55 s (1920×1080, 30 fps) feito em Remotion, com telas reais do dashboard.

**Conceito: a cidade em pixels.** A abertura do dashboard desenha Fortaleza em pixels, em que cada pixel é maior e mais claro quanto melhor o índice do bairro. O filme usa esse pixel como fio condutor:
- a cidade se monta pixel a pixel;
- vira o produto, e o corte para a interface real acontece com a cidade, o título e a marca exatamente nas mesmas posições;
- o filme mostra o que o produto faz;
- fecha com a cidade inteira em cobalto.

**Proposta de valor:** comparar os 121 bairros de Fortaleza por renda, saneamento e segurança, ver como mudaram entre os Censos de 2010 e 2022 e saber onde mais se corre e pedala. Tudo com dados públicos.

## Onde está o filme

O vídeo renderizado não fica no git: `video/out/` está no `.gitignore`, porque cada versão tem uns 60 MB e o git guardaria todas. O filme pronto vai como anexo nas [Releases do repositório](https://github.com/NicolasDev-web/Dashboard_de_Bairros_de_Fortaleza/releases). Para gerar de novo, use os comandos abaixo.

## Abrir e renderizar

```sh
cd video
npm i
npm run dev                      # Remotion Studio (composição "Lancamento")
npx remotion render Lancamento out/bairros-de-fortaleza.mp4 --codec=h264 --crf=16 --audio-bitrate=320k
npx remotion still Lancamento out/capa.png --frame=1649   # capa = último frame
```

Os assets são gerados a partir dos dados do repositório. Para refazer, rode na raiz:

```sh
.venv/Scripts/python video/scripts/gerar_assets.py   # cidade em pixels, evolução e áudio
```

As telas em `public/telas/` são capturas do `dashboard/index.html`, feitas com Playwright em 1920×1080 com DPR 2.

## Storyboard

| # | Frames (s) | Cena | Mensagem | Visual | Áudio |
|---|---|---|---|---|---|
| 1 | 0–300 (0–10) | Abertura | "Fortaleza tem 121 bairros." / "Renda, saneamento e segurança mudam de um bairro para o outro." | Noite; pixels soltos que se juntam e formam a cidade, do Centro para fora | drone, vento, pad abrindo; riser a partir de 228 |
| 2 | 300–450 (10–15) | Revelação | "Onde morar em Fortaleza" | Cobalto se abre do centro; a cidade desliza para a direita; título na posição exata do título do app; a marca encolhe até a navegação | **impacto** em 300; o pulso começa |
| 3 | 450–600 (15–20) | Mergulho | (sem texto) | A cidade do filme vira a cidade da captura real; a câmera recua e revela a tela; a página rola até o mapa | **whoosh** em 500 |
| 4 | 600–780 (20–26) | Índice | "Uma nota de 0 a 100" / "Cada bairro, em detalhe." | Mapa real; o cursor clica no Meireles e a câmera vai até a ficha | arpejo entra; **clique** em 721 |
| 5 | 780–960 (26–32) | 2010 → 2022 | "Dois censos, a mesma régua." | Renda 2010; uma linha de luz varre e revela 2022 no mesmo enquadramento | **whoosh** em 854 |
| 6 | 960–1110 (32–37) | Evolução | "73 de 121 bairros perderam renda real entre 2010 e 2022." | Uma barra por bairro (dados reais); as perdas acendem em laranja e o número conta até 73 | chimbal entra |
| 7 | 1110–1290 (37–43) | Rotas | "Rotas mais feitas" / "Av. Beira-Mar, 1ª rota de corrida" | As 10 rotas sobre o mapa; mergulho na orla até o calor do Strava | baixo entra; **whoosh** em 1206 |
| 8 | 1290–1440 (43–48) | Montagem | "Ajuste os pesos." / "Compare indicadores." / "Em qualquer tela." / "Com dados públicos." | 8 planos, um por batida (18 frames): pesos, saneamento, segurança, evolução, pedal, celular ×2, método | palmas, intensidade máxima; riser a partir de 1368 |
| 9 | 1440–1650 (48–55) | Encerramento | "Escolha seu bairro com dados." + "Explore o mapa" | A cidade se forma de novo em cobalto; marca, rótulo, frase e botão. O último frame é a capa | **impacto** + acorde final em Ré maior; **clique** em 1558 |

Todos os números vêm do repositório:
- 121 bairros;
- 73 bairros com queda de renda real (`data/processed/bairros_indice.csv`);
- Meireles em 1º no índice com pesos iguais;
- Av. Beira-Mar em 1º nas rotas de corrida (`data/processed/rotas_top.csv`, estimativa do heatmap).

## Áudio e pontos de sincronia

Tudo em `public/audio/` foi **sintetizado** por `scripts/gerar_assets.py`, sem material de terceiros:
- `trilha.wav`: 55 s, ré menor, 100 BPM, de modo que 1 batida = 18 frames;
- `impacto.wav`, `whoosh.wav`, `riser.wav`, `clique.wav`.

Para trocar a trilha, substitua `public/audio/trilha.wav` por outra de 55 s que respeite estes marcos:

| Tempo | Frame | O que acontece na trilha |
|---|---|---|
| 0 s | 0 | drone e vento |
| 10 s | 300 | impacto: entram o pad, a progressão Dm–B♭–F–C e um pulso leve |
| 20 s | 600 | arpejo em colcheias e pulso cheio |
| 32 s | 960 | chimbal |
| 37 s | 1110 | baixo |
| 43 s | 1290 | palmas: intensidade máxima |
| 48 s | 1440 | resolução: acorde longo em Ré maior até o fim |

Os efeitos e seus frames estão em `src/Lancamento.tsx` (`EFEITOS`) e podem ser ajustados no Studio.

## Estrutura

```
video/
  src/Root.tsx, src/Lancamento.tsx   composição e linha do tempo (Sequences + áudio)
  src/tema.ts                         cores e fontes do dashboard (Geist / Geist Mono), curvas, marcos das cenas
  src/componentes/                    CidadePixels, Tela (captura + câmera + cursor), Texto (título com máscara, rótulo, marca), Atmosfera (grão, vinheta)
  src/cenas/                          uma cena por arquivo
  public/telas/                       capturas reais do dashboard
  public/dados/                       cidade.json e evolucao.json, derivados dos dados do projeto
  public/audio/                       trilha e efeitos sintetizados
  scripts/gerar_assets.py, scripts/previa.mjs   geração de assets e renderização de frames avulsos
```

**Versão vertical:** os textos ficam em contêineres flex alinhados às margens, e a câmera de cada tela é definida por um ponto de foco e um zoom (`Tela`). Para uma versão 1080×1920, basta registrar outra `Composition` e reposicionar os focos.
