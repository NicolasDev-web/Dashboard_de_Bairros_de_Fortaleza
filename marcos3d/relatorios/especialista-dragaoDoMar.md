# Especialista Dragão do Mar — miniatura nova

Status: **concluído**. O export e o `checar` foram aprovados. Nada foi publicado em `dashboard/` e não fiz nenhum commit.

## 1. Pesquisa e referências
Ficha completa em `pesquisa/dragaoDoMar/ficha.md`. As referências `ref-1..5` estão em `pesquisa/dragaoDoMar/`, fora do
git.

**Fotos (Wikimedia Commons):**
- ref-1, aérea de 2018 que mostra o conjunto inteiro:
  https://commons.wikimedia.org/wiki/File:JADEQUEIROZ_DRAGAO_DO_MAR_FORTALEZA_CE_(40209562125).jpg
- ref-2, torres brancas, passarela vermelha, pirâmides e mar de telhados:
  https://commons.wikimedia.org/wiki/File:Centro_Drag%C3%A3o_do_Mar.jpg
- ref-3, Planetário: https://commons.wikimedia.org/wiki/File:Planet%C3%A1rio_Rubens_de_Azevedo_02.jpg
- ref-4, montagem de três aéreas:
  - `Centro_Dragão_do_Mar_de_Arte_e_Cultura_(4).jpg`;
  - `JADEQUEIROZ…(40394002284).jpg`, quase zenital;
  - `JADEQUEIROZ…(40209562125).jpg`.
- ref-5, folha de contato da Praça Almirante Saldanha (casarões).

**Categorias consultadas:** https://commons.wikimedia.org/wiki/Category:Centro_Drag%C3%A3o_do_Mar_de_Arte_e_Cultura, mais
as subcategorias Planetário Rubens de Azevedo, Passarela vermelha, Anfiteatro Sérgio Motta, Praça Almirante Saldanha e
Aerial photographs. Ao todo foram cerca de 150 miniaturas de 250 px, montadas em folhas de contato.

**Texto:**
- https://pt.wikipedia.org/wiki/Centro_Drag%C3%A3o_do_Mar_de_Arte_e_Cultura (1999, Fausto Nilo e Delberg Ponce de Leon,
  "linhas arrojadas que contrastam com os casarões");
- go-astronomy (cúpula de ~10,5 m).

**Planta:** `osm.xml` (API 0.6 do OSM). Partes com `height`, as passarelas em `layer=3` (inclusive a "Passarela
Vermelha"), a rampa 638574565, os gramados, o Espaço Rogaciano Leite Filho, o Anfiteatro e as árvores.

**Rede:** no meio da pesquisa a rede passou a recusar `upload.wikimedia.org`, o Esri e o `en.wikipedia.org` (403 do
proxy). Por isso só 4 fotos ficaram em 1280 px; o resto foi visto nas miniaturas.

## 2. Composição e por quê
O complexo tem ~150 × 220 m e não cabe legível num disco de 67 m. Escolhi o **miolo que a aérea ref-1 mostra**, com o
**norte real** mantido (contrato):
- **norte:** Anfiteatro, com a lona branca e a arquibancada;
- **oeste:** museu, com os cubos brancos de pirâmides rosa e os murais;
- **centro:** Planetário dentro da rampa curva e dos jardins;
- **leste:** Praça Almirante Saldanha (coqueiros, árvores do OSM, bancos, postes de globo);
- **sul:** do outro lado do calçadão da Rua Dragão do Mar, os casarões com os bares, a Torre do Café e a passarela que
  **cruza o calçadão**, o pavilhão de mirante vermelho, a Passarela Vermelha sobre o Espaço Rogaciano Leite Filho e a
  torre sul.

**Escala:** a planta passa por `mapa()`:
- centro em (−12; −7) m reais;
- K = 0,56 até 44 m e compressão radial suave (0,38) além disso, o que cabe ~68 m reais de raio;
- Planetário e torres crescem 1,3–1,45×;
- alturas ~0,62 da real.

**Por que este lado fica de frente:** a câmera do site (az −32°) olha de sul-sudoeste, então o primeiro plano é o mesmo
da ref-2:
- telhados de barro e de fibrocimento;
- as duas torres brancas com pirâmide rosa e as treliças vermelhas;
- atrás, o museu e a cúpula.

As fachadas coloridas dos casarões olham para o norte (para o calçadão), como na realidade.

**Ficaram de fora** (fora do raio): a Praça Verde, a Passarela Vermelha sobre a Rua José Avelino (fica só um toco cortado
na borda), o Porto Iracema das Artes e a Biblioteca.

## 3. Como gerar de novo
```sh
cd marcos3d
<python-com-bpy> blender/dragaoDoMar.py            # ~5 s: modela, assa a oclusão e exporta (--sem-bake: ~1,5 s)
export CHROME=<invólucro do chrome>
npm run render -- --ids dragaoDoMar --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta 5372
npm run exportar -- --ids dragaoDoMar --porta 5372
npm run checar -- --ids dragaoDoMar
```
`<python-com-bpy>` aqui é o venv do scratchpad, com Blender 5.2.3.

**O que o `blender/dragaoDoMar.py` faz:**
- Lê o OSM direto de `pesquisa/dragaoDoMar/osm.xml`: lotes, rampa, gramados, pátio do Rogaciano e árvores.
- Modela com `bmesh`:
  - prismas e caixas chanfradas;
  - pirâmides com beiral, testeira e ponteira, e as fiadas de telha em UV;
  - tornos para o tambor do Planetário;
  - icosfera cortada para a cúpula geodésica;
  - perfis de seção retangular para as treliças;
  - Catmull-Rom sobre o eixo do OSM para a rampa;
  - retângulo mínimo de cada lote para os telhados de quatro águas.
- Gera um **atlas de 256 px** com:
  - porta e janela de casarão;
  - fiadas de telha;
  - vão de vidro do museu;
  - parede com furos;
  - guarda-corpo em X;
  - xadrez;
  - balaústres;
  - fita de janelas.
- Assa a **oclusão de ambiente no Cycles**:
  - nas cores de vértice por canto de face, faixa 0,5–1;
  - numa imagem de 256 px do chão.
- **Tintas:** as paredes dos casarões e dos fundos usam um único material branco. A cor de cada um entra nas cores de
  vértice junto com a oclusão (função `tinta()`), o que dá 9 cores de casarão com 1 material. As facetas da cúpula ganham
  tons diferentes da mesma forma.
- Exporta:
  - `blender/saida/dragaoDoMar-pecas.glb`;
  - `blender/saida/dragaoDoMar-ao-chao.jpg`;
  - `blender/saida/dragaoDoMar-layout.json` (45 árvores, 14 coqueiros, 48 pessoas).

**O que o `src/marcos/novos/DragaoDoMar.tsx` faz:**
- Carrega as peças e liga as sombras.
- Renomeia cada primitiva como `<Peça>_<Material>`.
- Põe as cores das telhas: o exportador do Blender não leva a cor-base de um material com textura, então a cor é aplicada
  aqui.
- No chão, aplica o aoMap e o piso de pedra em canvas.
- Desenha os murais em canvas (512 × 256): retrato amarelo, grafite de peixes, letreiro "DRAGÃO DO MAR" e mosaico azul.
- Instancia as árvores, os coqueiros e as pessoas.
- O JPEG da oclusão leva `userData.mimeType = "image/jpeg"`.

**Inspeção no Blender:** `renders/dragaoDoMar/blender-casaroes.png` é um render Cycles do GLB visto do calçadão, para
conferir as fachadas dos casarões, que nenhuma vista da oficina pega de frente.

## 4. O que foi modelado nos 4 níveis do MASTERCRAFT
**Nível 1 — forma principal:**
- museu: 6 volumes com pirâmides (o mais alto a oeste, a 13 m);
- Planetário: tambor em pilotis e cúpula, topo a ~11 m;
- duas torres de 10,2 e 10,6 m com pirâmide;
- passarelas a 3,9 m;
- rampa curva;
- fileiras de casarões e lotes de fundos;
- anfiteatro;
- disco de praça.

**Nível 2 — formas secundárias:**
- Museu:
  - pódio com escadaria e terraços com guarda-corpo;
  - braço onde pousa a passarela;
  - ponte de vigas vermelhas até o terraço do Planetário.
- Planetário:
  - 12 pilotis;
  - laje saliente;
  - faixas de granito;
  - tambor superior com anel e varanda.
- Torres: arcos na base, cornija, portas na altura das passarelas.
- Treliças: banzos, montantes, X nas laterais e no teto, vigas sob o piso, corrimão.
- Pavilhão: mirante de pórticos vermelhos.
- Casarões: pilastras, cornijas, platibanda, frontões, varanda no casarão rosa.
- Rampa: testeiras, colunas, escadaria final.
- Anfiteatro: arquibancada em degraus, palco, lona em abóbada.

**Nível 3 — detalhes:**
- portas em arco de madeira vermelha e janelas com venezianas;
- balaústres;
- aberturas triangulares do Planetário e dos pavilhões;
- furos quadrados no alto das torres e do volume alto;
- piso xadrez sob o Planetário;
- ponteiras das pirâmides;
- murais;
- letreiro;
- caixas d'água;
- fitas de janela dos fundos;
- mesas azuis e guarda-sóis dos bares;
- postes com globo, bancos e floreiras;
- gente na praça, na rampa e na passarela.

**Nível 4 — microdetalhes:**
- oclusão assada nos vértices e no chão;
- fiadas de telha;
- facetas da cúpula com tons diferentes;
- piso de pedra com juntas;
- gramado manchado;
- rugosidades distintas:

  | Material | Rugosidade | Metalness |
  |---|---|---|
  | Vidro da cúpula | 0,2 | 0,25 |
  | Treliça | 0,5 | 0,3 |
  | Granito | 0,55 | — |
  | Reboco | 0,85 | — |
  | Lona | 0,6 | — |

## 5. Rodadas de render → crítica → correção (luz do site)
1. **R1:**
   - Crítica:
     - pirâmides e telhas quase brancas, porque o exportador do Blender ignora a cor-base quando há imagem;
     - os lotes de fundos viraram caixotes brancos de 5,6 m que dominavam a frente;
     - a rampa saiu escura, porque o material do chão recebia o aoMap sem UV planar;
     - a lona do palco parecia um disco voador.
   - Correção:
     - cor das telhas no `.tsx`;
     - material `Mat_Piso_Elevado` próprio para rampa, decks e pódio;
     - guarda-corpo mais claro;
     - lona em abóbada.
2. **R2:**
   - Crítica: faltava o mar de telhados da ref-2, porque os fundos tinham teto chato.
   - Correção: fundos no retângulo mínimo do lote, mais baixos (2,4–3,8 m), com telhado de quatro águas em barro ou
     fibrocimento, fitas de janela e caixas d'água. Resultado: a vista de sudoeste ficou como a ref-2.
3. **R3:**
   - Crítica:
     - Planetário pequeno perto do museu e cúpula escura;
     - fachadas oeste do museu cegas;
     - muro branco vazio atrás da cúpula;
     - o pavilhão noroeste saía do disco (`checar` reprovado com raio 35,5 m).
   - Correção:
     - Planetário +8% e cúpula mais clara;
     - vãos, furos e triângulos nas fachadas oeste;
     - mosaico azul no muro do anfiteatro;
     - pavilhão noroeste reduzido;
     - lona e toco da passarela recuados.
4. **R4:**
   - Crítica: o fundo do palco era um caixote preto na borda norte (vista lateral), a cúpula ainda estava cinza perto do
     azul-prateado das fotos e o pátio do Rogaciano estava vazio.
   - Correção: fundo do palco em cinza, cúpula `#a6c2e6` e gente no pátio.
   - Conferência no Blender: as fachadas dos casarões, vistas do calçadão, leem como na ref-5.

**"Alguém de Fortaleza reconhece?"**
- Na perspectiva e na lateral, a cúpula geodésica dentro da rampa branca, as torres brancas com pirâmide e as treliças
  vermelhas cruzando o calçadão leem já a ~200 px.
- No close: pirâmides rosa, mural, Planetário em pilotis e a fileira de casarões com os bares.

## 6. Notas (0–10)
Marco novo: o "antes" era um bloco provisório.

| Critério | Antes (bloco) | Depois |
|---|---|---|
| Geometria | 1 | 8 |
| Topologia | 5 | 7 |
| Proporções | 1 | 7 |
| Detalhamento | 0 | 8 |
| Materiais | 1 | 8 |
| Texturas | 0 | 7 |
| Shading | 3 | 8 |
| Realismo (fidelidade ao lugar) | 0 | 8 |
| Otimização | 9 | 8 |
| Apresentação | 1 | 8 |

## 7. Números (`saida/centro-dragao-do-mar.glb`)
| Item | Valor |
|---|---|
| Tamanho | **486 KB** (bruto 1.423 KB; limite 600) |
| Triângulos | **31.705** |
| Malhas | **65** |
| Materiais | **35** (limite 40) |
| Texturas | 4: atlas de esquadrias 256, murais 512 × 256, AO do chão 256 (JPEG), piso 128; mais a mancha 64 do gramado, que vem da `texturaManchada` comum, como na Unifor |
| `checar` | **OK**: raio 34,0 m com o pedestal, altura 14,4 m com o pedestal |

O atlas de murais tem 512 px de largura, acima dos 256 da convenção, pela mesma razão da Unifor: o letreiro ficaria
ilegível.

## 8. Checklist (item 27)
- [x] Proporção correta: planta e posições do OSM; exageros e recorte documentados.
- [x] Silhueta convincente: cúpula, torres com pirâmide, treliças, pirâmides do museu.
- [x] Escala coerente com os outros marcos: pessoas de 0,8 m, como na Unifor.
- [x] Geometria limpa: vértices soldados; sem bevel em peças finas.
- [x] Normais corretas: o `checar` não acusa normais inválidas; perfis e faces orientados para fora; lona com dois lados.
- [x] Shading correto: suavização por ângulo de 32°; cúpula facetada de propósito.
- [x] Sem clipping indesejado relevante: a rampa foi afastada do Planetário, o pavilhão noroeste ficou fora dos vizinhos
      e as pirâmides encostam sem se cruzar no topo.
- [x] Sem geometria flutuando: tudo pousa em z = 0,10; passarelas apoiadas em torres, terraço e pilares.
- [x] Sem faces duplicadas: `remove_doubles`; o `checar` não acusa degenerados.
- [x] Bevels coerentes: 0,03–0,06 m nas massas.
- [x] Materiais coerentes e nomeados: 35.
- [x] Texturas adequadas: todas geradas (Python, canvas e bake).
- [x] UV organizada: atlas por regiões; chão com UV planar.
- [x] Nível de detalhe adequado ao close e à vista geral.
- [x] Performance adequada: 486 KB, 32 mil triângulos, 65 malhas.
- [x] Arquivo organizado: script fonte versionado; saídas em `blender/saida/dragaoDoMar-*`.
- [x] Nomenclatura em português.
- [x] Exportação correta: `exportar` + `checar` OK.

## 9. Altura da etiqueta
O ponto mais alto é a ponteira da torre sul, a ~13,9 m. A torre do volume alto do museu chega a ~13 m e a cúpula a ~11 m.
**`ALTURA_ETIQUETA = 16`** no `.tsx`.

Se o `dashboard/historias.js` tiver altura própria para este marco, sugiro 16 lá também. Não editei esse arquivo.

## 10. Dúvidas abertas
1. **Pirâmides do museu:** o número e a posição exata não são confirmáveis nas aéreas pequenas. Ficaram 6 volumes numa
   grade plausível sobre as partes do OSM; a pink e o retrato amarelo seguem a aérea de 2018.
2. **Cor das pirâmides:** mudou com o tempo (terracota em ~2008, rosa de 2018 a 2025). Usei o rosa.
3. **Murais:** mudam com frequência. Ficaram como composições que lembram os das fotos (retrato amarelo, peixes, mosaico
   azul), não como cópias.
4. **Fundos dos lotes e fachadas para a Rua José Avelino:** sem foto clara. Ficaram neutros, com paredes caiadas, fitas
   de janela e telhado de barro ou fibrocimento.
5. **"swimming_pool" do OSM** a oeste do museu: não aparece nas aéreas. Ficou de fora, com piso e árvores no lugar.
6. **Anfiteatro:** encolhido e puxado para dentro do disco; a forma exata da lona é aproximada (abóbada branca).
7. **Ordem das cores dos casarões:** segue a aérea ref-1 e as fotos da praça, mas a correspondência casa a casa com os
   lotes reais não é certa.

## Renders finais
- `renders/dragaoDoMar/tsx-perspectiva.png`
- `renders/dragaoDoMar/tsx-close.png`
- `renders/dragaoDoMar/tsx-frente.png`
- `renders/dragaoDoMar/tsx-lado.png`
- `renders/dragaoDoMar/tsx-topo.png`
- Conferência no Blender: `renders/dragaoDoMar/blender-casaroes.png`
