# Especialista Estádio Presidente Vargas: miniatura nova com Blender

Status: **concluído**. O `exportar` e o `checar` foram aprovados. Não publiquei nada em `dashboard/` nem fiz commit.

## 1. Pesquisa e referências
A ficha completa está em `pesquisa/estadioPv/ficha.md`.

**Rede.** A rede bloqueou o OSM, a Wikimedia, a Wikipédia e o Esri: testei uma vez a API do OSM e recebi proxy 403.
Por isso **não houve foto nenhuma para olhar**.

**Planta e rumo.** Vêm da medição anterior do OSM:
- lote `way/179073475` com ~142 × 228 m sem a rotação;
- campo `way/627144484` com ~93 × 124 m;
- eixo longo a 13° para oeste do norte.

**Confirmado por texto (`WebSearch`):**

| Item | Fonte |
|---|---|
| Reforma de 2008–2011 para a Copa, com o PV como centro de treinamento; alambrado trocado por **vidro**; rampas e elevadores | https://stadiumdb.com/stadiums/bra/estadio_presidente_vargas, https://stadiumdb.com/news/2014/09/new_stadiums_the_more_average_brazilian_stadiums, https://www.confea.org.br/node/112691, https://vermelho.org.br/?p=212561 |
| Projeto: "**mantendo-se as torres de iluminação**", "**coberturas que abrigam 20% dos espectadores**", "arquibancadas em três níveis com **rampas monumentais**", "arquibancada especial com **cobertura em formato de arco**" | https://vermelho.org.br/?p=197404 |
| Setor das **cabines de rádio e do portal** com acesso por **rampas e dois elevadores**, cobertura metálica com telha de alumínio, **14 cabines** | https://mais.opovo.com.br/colunistas/raone-saraiva/2020/10/15/novo-gramado-do-presidente-vargas-e-orcado-em-r--2-milhoes--obra-tem-prazo-de-seis-meses.html |
| Reforma de 2021–2022: pintura das arquibancadas, assentos e coberturas metálicas restaurados; **4 bilheterias e 4 setores**; 20.166 lugares | https://www.opovo.com.br/esportes/futebol/times/cearenses/2023/09/14/estadio-presidente-vargas-completa-82-anos-nesta-quinta-14-09.html, https://diariodonordeste.verdesmares.com.br/jogada/reforma-no-pv-avanca-e-estadio-fica-mais-proximo-de-receber-jogos-veja-imagens-1.3182436, https://mpce.mp.br/mpce-vistoria-estadio-presidente-vargas-em-fortaleza/ |
| **Cadeiras azuis** (as laranja saíram por lembrarem o Fortaleza) | https://en.wikipedia.org/wiki/Est%C3%A1dio_Presidente_Vargas_(Cear%C3%A1) |
| Endereço: **Rua Marechal Deodoro da Fonseca, 1187**; entorno de **casario baixo** | https://www.buser.com.br/destinos/pontos-turisticos/ce/fortaleza/estadio-presidente-vargas, StadiumDB |

**Não confirmado:** o lado da tribuna, a forma exata da cobertura, o desenho das torres, as cores da fachada e da
arquibancada, e a rua do lado leste. A lista completa está na seção 10.

As cores da ficha anterior (setores em azul, amarelo e laranja) **não têm fonte** e saíram. O estádio é municipal e
recebe Ceará, Fortaleza e Ferroviário, então o modelo não usa cor de clube.

## 2. Composição e por quê
O recorte é o **quarteirão inteiro do estádio**: o lote de 142 × 228 m cabe no disco com K ≈ 0,20. Em volta ficam:
- as **quatro ruas**, com a Rua Marechal Deodoro a oeste;
- o **casario baixo do Benfica** nos dois lados longos.

Nada foi cortado do estádio. Os protagonistas são:
1. o **anel de arquibancadas** em degraus;
2. a **tribuna coberta** a oeste, com a cobertura em arco, as cadeiras azuis, as 14 cabines, o portal, os dois
   elevadores e as rampas;
3. as **quatro torres de iluminação**.

O resto só situa: esplanada, gradil do lote, bilheterias, postes, árvores, carros, gente e casas.

**Escala.**
- O campo usa K = 0,20 (105 × 68 m → 21 × 13,6 m).
- As arquibancadas foram engrossadas ~1,5× para os degraus lerem: 7,7 m de fundo e 15 degraus.
- As alturas foram exageradas ~2,5×, como nos aprovados: o anel fica a 8,2 m, a cobertura a ~10,5 m e as torres a
  ~20 m com o painel.
- O lote real tem 28 m de largura na escala; a arena exagerada passa disso um pouco, e as ruas ficam encostadas.

**Rumo e `GIRO`.** **Não girei** a composição: ficou o rumo real, com o eixo longo 13° a oeste do norte. As câmeras da
oficina vêm do sul, e com esse rumo:
- a **perspectiva** (−32°) pega a fachada oeste, com o portal e as rampas, e a cabeceira sul, as duas a ~45°;
- o **close** (+24°) pega a tribuna coberta **de frente**, por cima do anel leste: cadeiras azuis, cobertura e
  cabines.

A fachada principal fica visível sem truque. No script, `GIRO = 13` é o rumo real.

## 3. Como o Blender foi usado e como gerar de novo
```sh
cd marcos3d
<python-com-bpy> blender/estadioPv.py            # ~5 s: modela, assa a oclusão e exporta (--sem-bake: ~2 s, só forma)
export CHROME=<invólucro do chrome>
npm run render -- --ids estadioPv --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta 5376
npm run exportar -- --ids estadioPv --porta 5376
npm run checar -- --ids estadioPv
```
Nesta máquina, `<python-com-bpy>` é `scratchpad/blender-venv/bin/python` (Blender 5.2.3 como módulo).

**`blender/estadioPv.py`:**
- **Anel.** É um retângulo de cantos arredondados (64 segmentos) deslocado ao longo da normal. Todos os anéis têm os
  mesmos vértices, então degraus, espelhos, corredor, parapeito e fachada se costuram em quadriláteros sem booleana.
- **Peças:**
  - `Campo`: piso em anéis, gols, bancos de reservas e vidro da divisa;
  - `Arquibancadas`;
  - `Fachada_Externa`;
  - `Portal_Rampas`;
  - `Tribuna_Coberta`: cobertura em grade 12 × 8 com perfil curvo, vigas em balanço, pilares e tirantes;
  - `Torres_Iluminacao`: treliças de 4 montantes, 10 níveis e diagonais alternadas;
  - `Gradil_Lote`, `Bilheterias`, `Postes` e `Casario`;
  - o chão em `Chao_Base` e `Chao_Pisos`.
- **Atlas de 256 px gerado em Python:** portões, cabines, refletores (frente e costas), elevador, porta e janela das
  casas, bilheteria, aberturas da circulação, telha de barro, alumínio trapezoidal e portão do lote.
- **Oclusão de ambiente no Cycles (CPU):**
  - nas cores de vértice das peças, remapeada para 0,55–1;
  - numa imagem de 256 px do chão, com UV planar.

  As árvores e os carros entram como volumes provisórios e são apagados antes da exportação.
- **Cores das paredes das casas:** cada casa tem a sua, multiplicada nas cores de vértice. As "tintas" seguem o padrão
  do Theatro.
- **Saídas:** `blender/saida/estadioPv-pecas.glb`, `-ao-chao.jpg` e `-layout.json`. O JSON traz 24 árvores, 49
  pessoas, 19 carros e 352 barras do gradil, em coordenadas do three.

**`src/marcos/novos/EstadioPv.tsx`:**
- Carrega as peças e renomeia cada primitiva como `<Peça>_<Material>`.
- Desenha o **gramado em canvas** (388 × 520): faixas de corte e todas as marcações oficiais na escala.
- Aplica a cor-base das texturas (telha e alumínio), porque o exportador do Blender não leva essa cor.
- Deixa o vidro da divisa translúcido.
- Põe aoMap e pisos de canvas no chão: placas, calçada, asfalto manchado e grama.
- Instancia as árvores, as pessoas, os carros e as barras do gradil.
- A textura de oclusão leva `userData.mimeType = "image/jpeg"`.

**Inspeção:** o script descartável `scratchpad/inspecionar.py` renderizou no Cycles o lado oeste de frente (portal,
elevadores e rampas) e a tribuna vista do campo, que as vistas da oficina só pegam de viés.

## 4. O que foi modelado nos 4 níveis do MASTERCRAFT
**Nível 1 — forma principal:**
- anel retangular de cantos arredondados em volta do campo, aberto para o céu;
- tribuna coberta no lado oeste;
- quatro torres de ~20 m nos cantos;
- quarteirão com quatro ruas.

**Nível 2 — formas secundárias:**
- arquibancada em dois lances (8 degraus inferiores e 7 superiores), com o **corredor de circulação** no meio;
- parapeito no alto e fachada com soco, pilares em todos os 64 vértices, cinta na altura da circulação e cornija;
- **portal** com marquise, três portões e as janelas do setor;
- **dois poços de elevador** envidraçados;
- **rampas em ziguezague** de três lances com patamares e pilares, dos dois lados do portal;
- **cobertura em arco**: borda da frente em arco na planta e perfil curvo, sobre vigas em balanço e 7 pilares;
- faixa das **14 cabines de rádio**;
- casas térreas e sobrados, alguns com platibanda.

**Nível 3 — detalhes:**
- vomitórios escuros no corredor e faixas claras das escadas;
- **vidro na divisa** com o campo;
- **cadeiras azuis** no setor coberto;
- gols com rede e bancos de reservas com cobertura de acrílico;
- portões gradeados dos setores com marquise e três bilheterias com guichês;
- treliça das torres, plataforma, painel de 4 × 3 refletores e as costas do painel com as carcaças;
- tirantes da cobertura e telha trapezoidal;
- gradil do lote com mureta, pilaretes, barras e portão de correr;
- postes, faixas de rolamento e de pedestres, meios-fios;
- portas e janelas de venezianas nas casas, carros e gente.

**Nível 4 — microdetalhes:**
- oclusão assada nos degraus (cada espelho escurece o pé do degrau de cima), sob a cobertura, no pé da fachada e no
  chão sob árvores, torres e carros;
- faixas de corte no gramado;
- placas no piso da esplanada e manchas no asfalto;
- variação de cor por instância em copas, carros, camisas e peles;
- rugosidades distintas: vidro 0,15, cadeiras 0,6, alumínio 0,45, concreto 0,92, metal das torres 0,45 com metalness 0,4.

## 5. Rodadas de render → crítica → correção (luz do site)
1. **R1** (17,5 mil triângulos no Blender; 31,5 mil na cena):
   - Crítica:
     - o anel, as cadeiras azuis, a cobertura em arco (ótima no topo) e as torres já liam como estádio;
     - mas a **fachada** era um paredão lilás-acinzentado com **duas fileiras de vãos pretos** (lia como prédio de
       escritórios e dominava a vista "frente");
     - os **painéis das torres** estavam grandes demais e as costas viravam outdoors cinza.
   - Correção:
     - uma fileira de vãos só, na altura da circulação;
     - pilares e cintas num branco mais claro que o pano;
     - painéis de 4,6 × 2,7 para 3,9 × 2,3 m.
2. **R2** (primeiro `exportar` + `checar`: 446 KB, OK):
   - Crítica:
     - a inspeção no Blender mostrou que o portal, os elevadores e as rampas leem bem de frente;
     - mas a **cobertura flutuava** ~1,5 m acima das cabines e parecia uma casca solta.
   - Correção: cobertura baixada (10,15 → 9,5 m, barriga de 0,38 m) e vigas e tirantes reajustados.
3. **R3**:
   - Crítica:
     - a cobertura baixa assentou bem;
     - mas o creme novo da fachada (`#ead9bd`) virou um **malva amarronzado** sob a luz azul do site, pior que o
       branco;
     - as costas dos painéis ainda pareciam placas lisas.
   - Correção:
     - fachada em branco quente bem claro (`#f1e9d8`);
     - painel com caixa grafite e costas desenhadas no atlas (quadro, carcaças dos 12 refletores e travessas).
4. **R4**:
   - Crítica: no close, as torres agora leem como refletores vistos por trás. O medidor de raio que escrevi mostrou o
     **gradil das cabeceiras a 33,9 m** do centro, fora do contrato de 33,5 m.
   - Correção: o gradil para em √(32,7² − 25,3²). A malha mais distante passou a ser a telha do casario, a 33,41 m.

**"Alguém de Fortaleza reconhece?"**
- A ~200 px se lê um estádio de bairro: anel de concreto claro aberto, quatro torres treliçadas, tribuna coberta com
  cadeiras azuis de um lado só, encaixado num quarteirão de casas baixas.
- No close aparecem a cobertura em arco, as cabines, os vomitórios, o vidro e o gramado com todas as marcações.

Sem foto, o que reconhece é a tipologia e os elementos que as fontes descrevem, não a fachada exata.

## 6. Notas (0–10)
"Antes" é a versão começada sem Blender, descartada.

| Critério | Antes | Depois |
|---|---|---|
| Geometria | 3 | 8 |
| Topologia | 5 | 8 |
| Proporções | 4 | 7 |
| Detalhamento | 2 | 8 |
| Materiais | 3 | 7 |
| Texturas | 2 | 7 |
| Shading | 3 | 8 |
| Realismo (fidelidade ao lugar) | 3 | 6 (sem foto: fachada, torres e cores são interpretação) |
| Otimização | 6 | 8 |
| Apresentação | 3 | 8 |

## 7. Números
| | Versão começada (não exportada) | Final (`saida/estadio-presidente-vargas.glb`) |
|---|---|---|
| Tamanho | — | **448 KB** (limite 600; a meta de 300 KB não foi atingida) |
| Triângulos | — | **31.186** |
| Malhas | — | **59** |
| Materiais | — | **31** |
| Texturas | — | 6: atlas 256, gramado 388 × 520, oclusão 256 JPEG, piso, calçada, mancha |
| `checar` | — | **OK** (raio 34,0 m com o pedestal, o modelo sozinho 33,41 m; altura 20,4 m) |

Como nos aprovados, o peso vem das cores de vértice e das normais por face dos degraus.

## 8. Checklist (item 27)
- [x] Proporção correta: planta, campo e rumo do OSM; exageros documentados.
- [x] Silhueta convincente: anel, cobertura em arco e quatro torres.
- [x] Escala coerente com os outros marcos: anel a 8,2 m (o Castelão tem ~10), pessoas de 0,8 m, carros de 2,2 m.
- [x] Geometria limpa: anéis costurados com os mesmos vértices, vértices soldados, sem booleanas.
- [x] Normais corretas: cada polígono é orientado pela normal desejada (`Peca.poli(normal=...)`); o `checar` não acusa
  normais inválidas.
- [x] Shading correto: suavização por ângulo de 32° (degraus vivos, curvas dos cantos lisas).
- [x] Sem clipping indesejado relevante: os pilares da tribuna encostam nos da fachada de propósito.
- [x] Sem geometria flutuando: o estádio e as casas pousam em 0,24 m (calçada); os carros no asfalto, a 0,10 m.
- [x] Sem faces duplicadas: `remove_doubles`; o `checar` não acusa degenerados.
- [x] Bevels coerentes: 0,03–0,06 m nos volumes, nenhum nas peças finas.
- [x] Materiais coerentes e nomeados: 31.
- [x] Texturas adequadas, todas geradas (Python, canvas e bake).
- [x] UV organizada: atlas por regiões; chão em UV planar; gramado em UV de campo.
- [x] Nível de detalhe adequado ao close e à vista geral.
- [x] Performance adequada: 448 KB, 31 mil triângulos, 59 malhas.
- [x] Arquivo organizado: script fonte versionado, saídas em `blender/saida/`.
- [x] Nomenclatura em português.
- [x] Exportação correta: `exportar` + `checar` OK.

## 9. Altura da etiqueta
O ponto mais alto são os painéis das torres de iluminação, a **20,4 m**. A tribuna coberta chega a ~10,5 m e o anel a
8,2 m. O `.tsx` exporta **`ALTURA_ETIQUETA = 22`**. No `dashboard/historias.js` não há altura para este ponto; não editei.

## 10. Dúvidas abertas
1. **Lado da tribuna, das cabines e do portal.** Pus a oeste, na Rua Marechal Deodoro, que é a rua do endereço. Não
   confirmei que ela passa a oeste e não a leste. Se for a leste, basta espelhar x no script.
2. **"Cobertura em formato de arco".** Interpretei como borda em arco na planta e perfil curvo, sobre o trecho reto da
   tribuna (~17% do anel, perto dos 20% do projeto).
3. **"Três níveis".** O modelo tem dois lances de degraus com o corredor no meio, mais a faixa das cabines.
4. **Torres.** O número (4) e a manutenção na reforma têm fonte. A estrutura treliçada e o painel inclinado são a forma
   usual, não confirmada.
5. **Cores.** Fachada branco-quente, arquibancada em concreto claro e telha de alumínio clara são neutras; só as cadeiras
   azuis têm fonte.
6. **Fachada externa** (pilares, uma fileira de aberturas gradeadas, portões com marquise): forma neutra, sem foto.
7. **Entorno.** A rua do lado leste e as transversais ficaram sem nome. O casario é genérico. A Avenida da Universidade
   fica algumas quadras a oeste, perto da Reitoria, fora do recorte.
8. **Placar e letreiro:** não modelados, porque não há fonte sobre a posição deles.
9. **Mesma linguagem da Reitoria da UFC.** Usei o mesmo método e a mesma família de árvores, pessoas, carros, pisos e
   telhas do Theatro. O especialista da Reitoria está refazendo o modelo agora, então vale conferir os dois lado a lado
   no tour.

## Renders finais
- `renders/estadioPv/tsx-perspectiva.png`
- `renders/estadioPv/tsx-close.png`
- `renders/estadioPv/tsx-frente.png`
- `renders/estadioPv/tsx-lado.png`
- `renders/estadioPv/tsx-topo.png`
