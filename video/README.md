# Bairros de Fortaleza: filme de lançamento

Filme de 78 s (1920×1080, 30 fps) feito em Remotion, com telas reais do dashboard e cenas animadas a partir dos dados do repositório.

**Conceito: a cidade em pixels.** A abertura do dashboard desenha Fortaleza em pixels, em que cada pixel é maior e mais claro quanto melhor o índice do bairro. O filme usa esse pixel como fio condutor:
- a cidade se monta pixel a pixel sobre um plano em 3D;
- vira o produto, e o corte para a interface real acontece com a cidade, o título e a marca exatamente nas mesmas posições;
- os mesmos pixels acendem pelo tempo de ônibus até o Centro e pelas respostas do "Onde morar";
- fecha com a cidade inteira em cobalto.

**Proposta de valor:** comparar os 121 bairros de Fortaleza por renda, saneamento e segurança, ver como mudaram entre os Censos de 2010 e 2022, saber quanto tempo se leva de ônibus e descobrir onde morar. Tudo com dados públicos.

## Onde está o filme

O vídeo renderizado não fica no git: `video/out/` está no `.gitignore`, porque cada versão tem uns 60 MB e o git guardaria todas. O filme pronto vai como anexo nas [Releases do repositório](https://github.com/NicolasDev-web/Dashboard_de_Bairros_de_Fortaleza/releases). Para gerar de novo, use os comandos abaixo.

## Abrir e renderizar

```sh
cd video
npm i
npm run dev                      # Remotion Studio (composição "Lancamento")
npx remotion render Lancamento out/bairros-de-fortaleza.mp4 --codec=h264 --crf=16 --audio-bitrate=320k
npx remotion still Lancamento out/capa.png --frame=2339   # capa = último frame
node scripts/previa.mjs 100 900 1500                     # frames avulsos em out/previa/
```

Se o Remotion não conseguir baixar o Chrome dele (rede restrita), use um Chrome ou Chromium já instalado: `--browser-executable=/caminho/do/chrome` no `render` e no `still`, e `NAVEGADOR=/caminho/do/chrome` no `previa.mjs`. As fontes (Geist e Geist Mono, licença OFL) estão em `public/fontes/`, então o render não depende do Google Fonts.

Os assets são gerados a partir dos dados do repositório. Para refazer, rode na raiz:

```sh
.venv/Scripts/python video/scripts/gerar_assets.py   # cidade em pixels, contornos, rota de ônibus, camadas, evolução e áudio
cd video && node scripts/capturar_telas.mjs          # telas do dashboard e as posições medidas (public/dados/medidas.json)
```

As telas em `public/telas/` são capturas do `dashboard/` feitas com Playwright em 1920×1080 com DPR 2 (o celular em 390×844 com DPR 3). O script também mede onde estão o mapa, a ficha, o Meireles, o card do "Onde morar" etc., e as cenas leem essas posições: se o layout do painel mudar, basta capturar de novo. As rotas do Strava (`11*`, `12`, `13`) dependem da camada externa do Strava e não são recapturadas pelo script.

## Storyboard

| # | Frames (s) | Cena | Mensagem | Visual | Áudio |
|---|---|---|---|---|---|
| 1 | 0–300 (0–10) | Abertura | "Fortaleza tem 121 bairros." / "Renda, saneamento e segurança mudam de um bairro para o outro." | Noite; pixels se juntam sobre um plano deitado em 3D, do Centro para fora; partículas fora de foco em camadas; o plano se levanta até ficar de frente | drone, vento, pad abrindo; riser a partir de 228 |
| 2 | 300–450 (10–15) | Revelação | "Onde morar em Fortaleza" | Cobalto se abre do centro; a cidade desliza para a direita; título na posição exata do título do app; a marca encolhe até a navegação | **impacto** em 300; o pulso começa |
| 3 | 450–600 (15–20) | Mergulho | (sem texto) | A cidade do filme vira a cidade da captura real; a câmera recua e revela a tela; a página rola até o mapa | **whoosh** em 500 |
| 4 | 600–756 (20–25,2) | Índice | "Uma nota de 0 a 100" / "Cada bairro, em detalhe." | Mapa real; o cursor clica no Meireles; a câmera desce pela ficha até o tempo de ônibus e o cursor clica em "Ver rotas de ônibus" | arpejo entra; **clique** em 701 |
| 5 | 756–1080 (25,2–36) | Ônibus | "Quanto tempo até o Centro?" / "Bom Jardim → Centro" / "As linhas, onde subir e onde descer." | Animada com os dados: a cidade em pixels num plano 3D acende em onda pelo tempo de ônibus até o Centro (relógio de 0 a 1h52); a câmera voa até o Bom Jardim (com desfoque de movimento) e acompanha a rota real sendo desenhada (376 + 387 + Linha Sul), com os selos das linhas em pé e os passos montando-se ao lado; recua para a tela real | respiro + **tique** de relógio; **whoosh** no voo; **pop** em cada selo |
| 6 | 1080–1350 (36–45) | Onde morar | "Os bairros que cabem no seu bolso, perto de onde você vai." | Três perguntas na batida, em duas camadas com paralaxe (a pergunta e a cidade que acende); a câmera mergulha nos pixels e sai no resultado; desliza até o card com o tempo de ônibus | chimbal entra; **cliques** nas respostas; **whoosh** no mergulho |
| 7 | 1350–1494 (45–49,8) | 2010 → 2022 | "Dois censos, a mesma régua." | Renda 2010; uma linha de luz varre e revela 2022 no mesmo enquadramento | **whoosh** em 1408 |
| 8 | 1494–1638 (49,8–54,6) | Evolução | "73 de 121 bairros perderam renda real entre 2010 e 2022." | Uma barra por bairro (dados reais); as perdas acendem em laranja e o número conta até 73 | |
| 9 | 1638–1782 (54,6–59,4) | Praças e hospitais | "484 praças (URBIFOR)" / "87 hospitais (OSM)" | Uma onda circular sai do Centro e liga as camadas no mapa; a câmera desce até o Centro, onde as praças viram polígonos | baixo entra; **whoosh** |
| 10 | 1782–1962 (59,4–65,4) | Rotas | "Rotas mais feitas" / "Av. Beira-Mar, 1ª rota de corrida" | As 10 rotas sobre o mapa; mergulho na orla até o calor do Strava | **whoosh** em 1878 |
| 11 | 1962–2124 (65,4–70,8) | Montagem | "Ajuste os pesos." / "Compare os preços." / "Em qualquer tela." / "Com dados públicos." | 9 planos, um por batida (18 frames): pesos, saneamento, segurança, preços, evolução, celular ×3 (ônibus, questionário, mapa), método | palmas, intensidade máxima; riser a partir de 2052 |
| 12 | 2124–2340 (70,8–78) | Encerramento | "Escolha seu bairro com dados." + "Explore o mapa" | A cidade se forma de novo em cobalto; marca, rótulo, frase e botão. O último frame é a capa | **impacto** + acorde final em Ré maior; **clique** em 2242 |

Todos os números vêm do repositório:
- 121 bairros;
- 16.093 trajetos de ônibus e a rota Bom Jardim → Centro (`data/processed/transporte_tempos.csv`, `dashboard/transporte/`);
- 73 bairros com queda de renda real (`data/processed/bairros_indice.csv`);
- Meireles em 1º no índice com pesos iguais;
- 484 praças e 87 hospitais (`data/raw/pracas_urbifor_2019.geojson`, `dashboard/equipamentos.js`);
- Av. Beira-Mar em 1º nas rotas de corrida (`data/processed/rotas_top.csv`, estimativa do heatmap).

## Áudio e pontos de sincronia

Tudo em `public/audio/` foi **sintetizado** por `scripts/gerar_assets.py`, sem material de terceiros:
- `trilha.wav`: 78 s, ré menor, 100 BPM, de modo que 1 batida = 18 frames. Fica fora do git (é grande e o script refaz);
- `impacto.wav`, `whoosh.wav`, `riser.wav`, `clique.wav`, `tique.wav` (relógio do ônibus), `pop.wav` (selos das linhas).

Para trocar a trilha, substitua `public/audio/trilha.wav` por outra de 78 s que respeite estes marcos (`MARCOS` no script, os mesmos de `CENAS` em `src/tema.ts`):

| Tempo | Frame | O que acontece na trilha |
|---|---|---|
| 0 s | 0 | drone e vento |
| 10 s | 300 | impacto: entram o pad, a progressão Dm–B♭–F–C e um pulso leve |
| 20 s | 600 | arpejo em colcheias e pulso cheio |
| 25,2 s | 756 | respiro no arpejo e relógio em semicolcheias (cena do ônibus) |
| 36 s | 1080 | chimbal |
| 54,6 s | 1638 | baixo |
| 65,4 s | 1962 | palmas: intensidade máxima |
| 70,8 s | 2124 | resolução: acorde longo em Ré maior até o fim |

Os efeitos e seus frames estão em `src/Lancamento.tsx` (`EFEITOS`) e podem ser ajustados no Studio.

## Estrutura

```
video/
  src/Root.tsx, src/Lancamento.tsx   composição e linha do tempo (Sequences + áudio)
  src/tema.ts                         cores e fontes do dashboard (Geist / Geist Mono), curvas, marcos das cenas
  src/componentes/                    CidadePixels, Tela (captura + câmera + cursor), Texto (título com máscara, rótulo, marca),
                                      Cinema (palco 3D, partículas em profundidade, luz que varre, clarão), Atmosfera (grão, vinheta)
  src/cenas/                          uma cena por arquivo
  public/telas/                       capturas reais do dashboard
  public/dados/                       cidade, contornos, rota de ônibus, camadas, evolução e medidas, derivados do projeto
  public/fontes/                      Geist e Geist Mono (OFL)
  public/audio/                       trilha e efeitos sintetizados
  scripts/gerar_assets.py, scripts/capturar_telas.mjs, scripts/previa.mjs   assets, capturas e frames avulsos
```

**Versão vertical:** os textos ficam em contêineres flex alinhados às margens, e a câmera de cada tela é definida por um ponto de foco e um zoom (`Tela`). Para uma versão 1080×1920, basta registrar outra `Composition` e reposicionar os focos.
