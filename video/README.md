# Bairros de Fortaleza: filme de lançamento

Filme de 70 s (1920×1080, 30 fps) feito em Remotion, com telas reais do dashboard e cenas animadas a partir dos dados do repositório.

**Conceito: a cidade em pixels.** A abertura do dashboard desenha Fortaleza em pixels, em que cada pixel é maior e mais claro quanto melhor o índice do bairro. O filme usa esse pixel como fio condutor:
- a cidade se monta pixel a pixel sobre um plano em 3D;
- vira o produto, e o corte para a interface real acontece com a cidade, o título e a marca exatamente nas mesmas posições;
- os mesmos pixels acendem pelo tempo de ônibus até o Centro e pelas respostas do "Onde morar";
- a rede de ônibus inteira se desenha sobre a cidade, do Centro para fora;
- fecha com a cidade inteira em cobalto.

**Proposta de valor:** comparar os 121 bairros de Fortaleza por renda, saneamento e segurança, ver como mudaram entre os Censos de 2010 e 2022, saber quanto tempo se leva de ônibus (e por quais linhas, inclusive as metropolitanas), ver a rede de linhas e paradas no mapa e descobrir onde morar. Tudo com dados públicos.

## Onde está o filme

O vídeo renderizado não fica no git: `video/out/` está no `.gitignore`, porque cada versão tem de 25 a 110 MB e o git guardaria todas. O filme pronto vai como anexo nas [Releases do repositório](https://github.com/NicolasDev-web/Dashboard_de_Bairros_de_Fortaleza/releases). Para gerar de novo, use os comandos abaixo.

## Abrir e renderizar

```sh
cd video
npm i
npm run dev                      # Remotion Studio (composição "Lancamento")
npx remotion render Lancamento out/bairros-de-fortaleza.mp4 --codec=h264 --crf=16 --audio-bitrate=320k
npx remotion still Lancamento out/capa.png --frame=2105   # capa = último frame
node scripts/previa.mjs 100 900 1100                     # frames avulsos em out/previa/
```

Se o Remotion não conseguir baixar o Chrome dele (rede restrita), use um Chrome ou Chromium já instalado: `--browser-executable=/caminho/do/chrome` no `render` e no `still`, e `NAVEGADOR=/caminho/do/chrome` no `previa.mjs`. As fontes (Geist e Geist Mono, licença OFL) estão em `public/fontes/`, então o render não depende do Google Fonts.

Os assets são gerados a partir dos dados do repositório. Para refazer, rode na raiz:

```sh
python video/scripts/gerar_assets.py   # cidade em pixels, contornos, rota de ônibus, rede de linhas, evolução e áudio
cd video && node scripts/capturar_telas.mjs          # telas do dashboard e as posições medidas (public/dados/medidas.json)
```

As telas em `public/telas/` são capturas do `dashboard/` feitas com Playwright em 1920×1080 com DPR 2 (o celular em 390×844 com DPR 3). O script também mede onde estão o mapa, a ficha, o Meireles, a parada clicada, a caixa das linhas diretas, o card do "Onde morar" etc., e as cenas leem essas posições: se o layout do painel mudar, basta capturar de novo.

## Storyboard

| # | Frames (s) | Cena | Mensagem | Visual | Áudio |
|---|---|---|---|---|---|
| 1 | 0–240 (0–8) | Abertura | "Fortaleza tem 121 bairros." / "Renda, saneamento e segurança mudam de um bairro para o outro." | Noite; pixels se juntam sobre um plano deitado em 3D, do Centro para fora; partículas fora de foco em camadas; o plano se levanta até ficar de frente | drone, vento, pad abrindo; riser a partir de 168 |
| 2 | 240–390 (8–13) | Revelação | "Onde morar em Fortaleza" | Cobalto se abre do centro; a cidade desliza para a direita; título na posição exata do título do app; a marca encolhe até a navegação | **impacto** em 240; o pulso começa |
| 3 | 390–510 (13–17) | Mergulho | (sem texto) | A cidade do filme vira a cidade da captura real; a câmera recua e revela a tela; a página rola até o mapa | **whoosh** em 440 |
| 4 | 510–666 (17–22,2) | Índice | "Uma nota de 0 a 100" / "Cada bairro, em detalhe." | Mapa real; o cursor clica no Meireles; a câmera desce pela ficha até o tempo de ônibus e o cursor clica em "Ver rotas de ônibus" | arpejo entra; **clique** em 611 |
| 5 | 666–990 (22,2–33) | Ônibus | "Quanto tempo até o Centro?" / "Bom Jardim → Centro" / "As linhas, onde subir e onde descer." | A cidade em pixels acende em onda pelo tempo de ônibus até o Centro; a câmera voa até o Bom Jardim e acompanha a rota real sendo desenhada (366 + 32304, metropolitana, + 102), com os selos em pé e os passos ao lado; recua para a tela real | respiro + **tique** de relógio; **whoosh** no voo; **pop** em cada selo |
| 6 | 990–1224 (33–40,8) | Rede de linhas | "A cidade inteira, linha por linha." / "Clique numa linha: ela se destaca." / "Clique na parada: as linhas que passam ali." | As 435 linhas se desenham sobre a cidade em 3D, do Centro para fora (ônibus, metropolitanas, metrô), com a contagem por tipo; a câmera voa até a linha 26, que acende sozinha; corte para o painel no zoom das paradas, o cursor clica numa parada e o popup abre | baixo entra; **whoosh**; **pop** no selo; **clique** na parada |
| 7 | 1224–1350 (40,8–45) | Linhas diretas | "Linhas diretas, no sentido da sua viagem." / "Clique numa linha e veja o trajeto dela no mapa." | A câmera desce até a caixa das linhas diretas; o cursor escolhe a 333; o mapa do trajeto mostra a linha | **clique** + **whoosh** |
| 8 | 1350–1584 (45–52,8) | Onde morar | "Os bairros que cabem no seu bolso, perto de onde você vai." | Três perguntas, em duas camadas com paralaxe (a pergunta e a cidade que acende); a câmera mergulha nos pixels e sai no resultado; desliza até o card com o tempo de ônibus | chimbal entra; **cliques** nas respostas; **whoosh** no mergulho |
| 9 | 1584–1728 (52,8–57,6) | Evolução | "73 de 121 bairros perderam renda real entre 2010 e 2022." | Uma barra por bairro (dados reais); as perdas acendem em laranja e o número conta até 73 | |
| 10 | 1728–1890 (57,6–63) | Montagem | "Ajuste os pesos." / "Ligue as camadas." / "Compare os preços." / "Em qualquer tela." | 8 planos na batida: pesos, saneamento, praças e hospitais, linhas de ônibus, preços, celular ×3 | palmas, intensidade máxima; riser a partir de 1818 |
| 11 | 1890–2106 (63–70,2) | Encerramento | "Escolha seu bairro com dados." + "Explore o mapa" | A cidade se forma de novo em cobalto; marca, rótulo, frase, convite e botão. O último frame é a capa | **impacto** + acorde final em Ré maior; **clique** em 2008 |

Todos os números vêm do repositório:
- 121 bairros;
- 16.093 trajetos de ônibus e a rota Bom Jardim → Centro (`data/processed/transporte_tempos.csv`, `dashboard/transporte/`);
- 435 linhas (320 da ETUFOR, 112 metropolitanas, 3 de metrô e VLT) e 7.407 paradas (`dashboard/linhas.js`, `dashboard/linhas_tracados.js`);
- 73 bairros com queda de renda real (`data/processed/bairros_indice.csv`);
- Meireles em 1º no índice com pesos iguais.

## Áudio e pontos de sincronia

Tudo em `public/audio/` foi **sintetizado** por `scripts/gerar_assets.py`, sem material de terceiros:
- `trilha.wav`: 70,2 s, ré menor, 100 BPM, de modo que 1 batida = 18 frames. Fica fora do git (é grande e o script refaz);
- `impacto.wav`, `whoosh.wav`, `riser.wav`, `clique.wav`, `tique.wav` (relógio do ônibus), `pop.wav` (selos das linhas).

Para trocar a trilha, substitua `public/audio/trilha.wav` por outra de 70,2 s que respeite estes marcos (`MARCOS` no script, os mesmos de `CENAS` em `src/tema.ts`):

| Tempo | Frame | O que acontece na trilha |
|---|---|---|
| 0 s | 0 | drone e vento |
| 8 s | 240 | impacto: entram o pad, a progressão Dm–B♭–F–C e um pulso leve |
| 17 s | 510 | arpejo em colcheias e pulso cheio |
| 22,2 s | 666 | respiro no arpejo e relógio em semicolcheias (cena do ônibus) |
| 33 s | 990 | baixo (a rede de linhas) |
| 45 s | 1350 | chimbal |
| 57,6 s | 1728 | palmas: intensidade máxima |
| 63 s | 1890 | resolução: acorde longo em Ré maior até o fim |

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
  public/dados/                       cidade, contornos, rota de ônibus, rede de linhas, evolução e medidas, derivados do projeto
  public/fontes/                      Geist e Geist Mono (OFL)
  public/audio/                       trilha e efeitos sintetizados
  scripts/gerar_assets.py, scripts/capturar_telas.mjs, scripts/previa.mjs   assets, capturas e frames avulsos
```

**Versão vertical:** os textos ficam em contêineres flex alinhados às margens, e a câmera de cada tela é definida por um ponto de foco e um zoom (`Tela`). Para uma versão 1080×1920, basta registrar outra `Composition` e reposicionar os focos.
