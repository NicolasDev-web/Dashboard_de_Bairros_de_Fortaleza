# Especialista forteAssuncao — Fortaleza de Nossa Senhora da Assunção

Status: **concluído**.
- 3 rodadas de render → crítica → correção, mais um render de inspeção do norte no Blender.
- `exportar` e `checar` **aprovados**.
- Nada publicado em `dashboard/` e nada commitado por mim.

## 1. Pesquisa e referências
A ficha completa está em `pesquisa/forteAssuncao/ficha.md`, com URLs, medidas do OSM, cores e dúvidas.

**Fotos** (Wikimedia Commons, em `pesquisa/forteAssuncao/ref-1..5.jpg`, fora do git; categoria
https://commons.wikimedia.org/wiki/Category:Fortaleza_de_Nossa_Senhora_da_Assun%C3%A7%C3%A3o):
- ref-1, aérea do quartel com o pátio e o mar ao fundo: https://commons.wikimedia.org/wiki/File:Atual_Quartel_da_10%C2%AA_Regi%C3%A3o_Militar_-_Vis%C3%A3o_a%C3%A9rea.jpg
- ref-2, aérea da entrada, do pátio murado e das guaritas: https://commons.wikimedia.org/wiki/File:Entrada_do_atual_Quartel_da_10%C2%AA_Regi%C3%A3o_Militar_-_Vis%C3%A3o_a%C3%A9rea.jpg
- ref-3, muralhas vistas da Leste-Oeste: https://commons.wikimedia.org/wiki/File:Forte_de_Nossa_Senhora_de_Assun%C3%A7%C3%A3o.jpg
- ref-4, fachada principal, muro com pilaretes e rampa: https://commons.wikimedia.org/wiki/File:Fortaleza_Nossa_Senhora_da_Assun%C3%A7%C3%A3o_02.jpg
- ref-5, portão com as guaritas e o frontão "COMANDO": https://commons.wikimedia.org/wiki/File:ASCENCAO_FORTRESS,_FORTZLEZA,_BRAZIL.jpg
- Também olhei outras 14 fotos da categoria, entre elas `Cmdo_10ª_Região_Militar.jpg` e as fachadas laterais (07, 11).

**Texto:**
- Diário do Nordeste, sobre o desabamento da "bateria inferior do baluarte nordeste" em 2021 e a reforma de 2024;
- en.wikipedia;
- IBGE (desarmado em 1910);
- as URLs estão na ficha.

**Planta:** `pesquisa/forteAssuncao/osm.xml`. O que já estava na pasta bastou:
- relação 15829081, o quartel em quadra com pátio (3 pavimentos, 10,2 m);
- vias `city_wall` das duas faces da muralha norte;
- relação 8778621, o pátio murado;
- nós da porta (5958129785) e do portão (5958040923);
- o espelho d'água;
- as 39 árvores mapeadas.

**Rede nesta sessão:** a Esri, a API do OSM e a Wikipédia foram bloqueadas pelo proxy. As duas aéreas do Commons
substituíram a vista de satélite.

**O que as fotos mudaram em relação à versão antiga, feita sem fotos** (um quadrado cor de areia com quatro baluartes):
- o forte de hoje se lê por dois elementos:
  - o **quartel do Comando**: quadra rosa-antigo com frisos creme, janelas em arco verdes com sacadas, telhado
    cerâmico e frontão escalonado "COMANDO" na fachada leste;
  - as **muralhas caiadas em dois níveis** sobre a Leste-Oeste;
- entre os dois fica o **pátio murado**, com pilaretes, gradil, duas guaritas e rampa.

## 2. Composição e por quê
**Recorte:** planta real, sem giro (norte em −z).
- Encolhida em volta de C = (−2, −22) m: K = 0,37 até 70 m e, daí para fora, 55% do excesso de raio (compressão
  radial suave, como no Iguatemi).
- Só os vértices são transformados, então todas as fachadas continuam retas.
- Assim cabem, sem cortar, o quartel inteiro, o pátio murado e o portão, o terraço do espelho d'água, a bateria e a ponta
  do baluarte nordeste. A ponta está a 95 m do centro e entra comprimida.

**Colina em níveis**, porque o forte fica no alto, sobre a antiga foz do Pajeú:

| Nível | Altura |
|---|---|
| Leste-Oeste | 0,1 m |
| ruas do Centro e Passeio Público | 1,5 m |
| bateria inferior | 2,0 m |
| esplanada de fora | 2,45 m |
| platô do forte | 2,7 m |

A borda da colina cai num talude gramado até o pedestal.

**Hierarquia de leitura:**
1. o quartel rosa com o telhado cerâmico em volta do pátio arborizado;
2. as muralhas brancas com a bateria de coqueiros, vistas do norte;
3. a fachada leste com o frontão "COMANDO", o pátio murado, as guaritas e a bandeira;
4. o entorno:
   - a beira do Passeio Público (árvores grandes e gradil) a oeste;
   - o casario baixo da Dr. João Moreira ao sul;
   - a praça das velas e a Alberto Nepomuceno a sudeste;
   - a Leste-Oeste com carros ao norte.

**Alturas:** o quartel tem 2 pavimentos, com cimalha a 6,3 m e cumeeira a 7,85 m sobre o platô (exagero de ~1,8× em
relação a K, como nos aprovados). O casario fica comprimido a ≤ 2,2 m para não tampar a fachada sul.

**Fora do recorte:** o mar, que fica além da Leste-Oeste; a Catedral; o Mercado Central.

## 3. Como o Blender foi usado e como gerar de novo
Opção 1 (Blender como fonte de peças), sem .blend:
```sh
cd marcos3d
<python-com-bpy> blender/forteAssuncao.py            # ~30 s: modela, assa a oclusão e exporta (--sem-bake: ~3 s)
export CHROME=<invólucro do chrome>
npm run render -- --ids forteAssuncao --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta 5371
npm run exportar -- --ids forteAssuncao --porta 5371
npm run checar -- --ids forteAssuncao
```
O `<python-com-bpy>` desta máquina é `scratchpad/blender-venv/bin/python`, com Blender 5.2.3. Os avisos "Draco/MeshOptimizer
is not available" do exportador do Blender são inofensivos: a compressão é feita pela oficina.

**`blender/forteAssuncao.py`:**
- **Planta e terreno:**
  - os dados da planta vêm do OSM, comentados no topo do script;
  - o casario é lido direto de `pesquisa/forteAssuncao/osm.xml`, com a altura do cadastro;
  - o terreno é feito em placas de nível recortadas no disco: colina, bateria, platô, esplanada e rampa inclinada.
- **Muros com talude** (`muro_talude`): muralha norte com cordão e parapeito nas duas faces, fim da bateria, muro oeste do
  Passeio e muro do pátio. Os pilaretes têm capitel e bola; o gradil é de barras finas em seção triangular.
- **Quartel:**
  - contorno inteiro (7 vértices) e pátio;
  - embasamento cinza em talude até a rua no sul e no oeste;
  - frisos em anel: embasamento, cordão e cimalha;
  - pilastras de canto;
  - ~220 vãos em arco pleno, com moldura creme e esquadria do atlas; sacadas de ferro no leste, no sul e no chanfro;
  - corpo central com pilastras que passam da cimalha, frontão escalonado de 6 degraus (com o brasão no atlas de
    letreiros), porta em arco com bandeira em leque, faixa "10ª REGIÃO MILITAR" e escadaria;
  - telhado em anel de quatro águas, com cumeeira nos pontos médios entre a quadra e o pátio; a ala noroeste tem espigão
    ao norte e rincão na quina reentrante; cumeeiras, espigões e rincões em telha mais clara.
- **Demais peças:**
  - anexo de dois pavimentos com telhado de quatro águas;
  - torre treliçada vermelha e branca no pátio;
  - terraço com espelho d'água, pedestal, estátua, 3 canhões e bancos;
  - praça das velas;
  - mastro da porta e mastro com a bandeira do Brasil junto ao portão;
  - gradil do Passeio.
- **Atlas de esquadrias de 256 px**, gerado em Python: porta-janela verde, janela do térreo com grade, porta principal e
  fita genérica.
- **Oclusão de ambiente no Cycles (CPU, 96 amostras, raio 2,4 m)**:
  - assada em cor de vértice, com os pisos cortados numa grade de 1,2 a 3,2 m;
  - a vegetação e os carros entram como volumes provisórios;
  - média por vértice e degraus de 1/40;
  - no casario, a cor pastel de cada prédio é multiplicada na cor de vértice, o que economiza materiais.
- **Exporta** `blender/saida/forteAssuncao-forte.glb` e `forteAssuncao-layout.json`: 48 árvores, 12 coqueiros, 122 carros
  e 19 pessoas.

**`src/marcos/novos/ForteAssuncao.tsx`:**
- carrega o GLB, renomeia as malhas como `<Peça>_<Material>`, liga as sombras e troca a água por `fab.agua()`;
- desenha em canvas:
  - o atlas de letreiros (512 × 256): frontão com as Armas Nacionais, as bandeiras, o canhão e "COMANDO"; a faixa
    "10ª REGIÃO MILITAR"; a bandeira do Brasil;
  - a telha capa-e-canal (128 px, repete);
- aplica a textura manchada (64 px) no gramado, no paralelepípedo e na calçada;
- instancia as árvores, os coqueiros, os carros e as pessoas. Os dois soldados do portão têm farda verde-oliva.

**Inspeção:** `scratchpad/inspecionar.py` renderiza o GLB bruto pelo norte, a vista da ref-3, que a oficina não tem.
O resultado está em `renders/forteAssuncao/blender-norte.png`. As copas saem brancas nele porque o importador do Blender
não traz a cor das instâncias; isso não acontece no site.

## 4. Os 4 níveis do MASTERCRAFT
**Nível 1 — forma principal:**
- quadra do quartel com pátio e ala noroeste, sobre o platô;
- muralha norte em dois níveis, com a bateria e o baluarte nordeste;
- colina com talude;
- Leste-Oeste embaixo.

**Nível 2 — formas secundárias:**
- telhado de quatro águas contínuo, com beiral e testeira;
- corpo central avançado com frontão escalonado; pilastras;
- cordão e cimalha; embasamento em talude;
- muro do pátio em talude com pilaretes;
- guaritas com cimalha e remate;
- rampa e esplanada;
- anexo;
- terraço com espelho d'água;
- torre treliçada.

**Nível 3 — detalhes:**
- janelas em arco com moldura;
- sacadas de ferro com montantes;
- porta com leque;
- brasão, "COMANDO" e "10ª REGIÃO MILITAR";
- escadaria;
- nichos em arco das guaritas;
- gradil entre os pilaretes;
- canhões com reparo e rodas;
- bancos, estátua e mastros com a bandeira;
- gradil do Passeio;
- escultura das velas com canteiro e gradil;
- faixas amarelas das vagas e faixas tracejadas das ruas;
- carros e pessoas.

**Nível 4 — microdetalhes:**
- oclusão assada (pé dos muros, quinas do pátio, sob os beirais e as copas);
- telha com variação por peça;
- pisos manchados;
- cumeeiras mais claras;
- variação de cor nas copas, folhas, carros e camisas;
- rugosidades distintas: reboco 0,85, frisos 0,7, ferro 0,5 com metalness 0,3, inox 0,35 com metalness 0,4, água 0,08.

## 5. Rodadas de render → crítica → correção (luz do site)
1. **R1** (sem bake):
   - Crítica:
     - o quartel, o telhado, o pátio e as guaritas já se liam;
     - **crítico:** o casario da Dr. João Moreira virou um bloco branco de até 3,4 m no primeiro plano, que tampava a
       fachada sul na vista de frente;
     - **alto:** a esplanada leste era uma placa escura de asfalto vazia;
     - **alto:** as muralhas, que são o que dá o nome, ficaram baixas.
   - Correção:
     - casario comprimido a ≤ 2,5 m;
     - esplanada em calçada, com a pista em asfalto e vagas com carros;
     - níveis subidos (bateria 2,0 m, platô 2,7 m), e a face de fora da muralha passou a ter ~2,4 m.
2. **R2** (com bake):
   - Crítica:
     - **reprovado:** 615 KB;
     - o casario continuava claro demais.
   - Correção:
     - gradil com montantes a cada 0,55 m e barras finas em seção triangular;
     - sacadas com menos montantes;
     - pilaretes com bola mais leve;
     - grade de oclusão mais larga nas placas que ficam escondidas sob o platô;
     - casario ≤ 2,2 m e com tons pastel mais marcados;
     - resultado: 534 KB.
3. **R3:**
   - Crítica: no render de inspeção do norte (vista da ref-3), as árvores da faixa da Leste-Oeste tampavam o pé da
     muralha caiada.
   - Correção: no máximo 5 árvores ali, a pelo menos 3 m da muralha.
   - Resultado: a face branca em talude, a bateria com coqueiros e o terraço do espelho d'água se leem como na foto.
     No close, aparecem o frontão "COMANDO", a porta em arco, as guaritas e a bandeira.

**"Alguém de Fortaleza reconhece?"**
- Na perspectiva e no topo: o casarão rosa de telhado cerâmico em volta do pátio arborizado, que é a imagem das aéreas.
- De lado (leste) e no close: a fachada do Comando com o frontão, o pátio murado e as guaritas brancas.
- Do norte: as muralhas brancas sobre a Leste-Oeste.

## 6. Notas (0–10), versão sem fotos → esta
| Critério | Antes | Depois |
|---|---|---|
| Geometria | 3 | 8 |
| Topologia | 5 | 7 |
| Proporções | 2 | 8 |
| Detalhamento | 3 | 8 |
| Materiais | 3 | 8 |
| Texturas | 1 | 7 |
| Shading | 4 | 8 |
| Realismo (fidelidade ao lugar) | 1 | 8 |
| Otimização | 6 | 7 |
| Apresentação | 3 | 8 |

## 7. Números (`saida/fortaleza-nossa-senhora-da-assuncao.glb`)
| | Valor |
|---|---|
| Tamanho | **532 KB** (limite 600; a meta de 300 KB não foi atingida) |
| Triângulos | **40.939** (26,8 mil das peças do Blender) |
| Malhas | **73** |
| Materiais | **33** (24 do Blender + 9 do `.tsx`) |
| Texturas | 4: atlas de esquadrias 256, letreiros 512 × 256, telha 128, mancha 64 |
| `checar` | **OK**: raio 34,0 m com o pedestal, altura 15,1 m, nada sem nome |

A meta de 300 KB não foi atingida pelo mesmo motivo da Unifor: cores de vértice e normais facetadas comprimem pouco. O
peso está nos ~220 vãos com moldura e nos gradis, que são justamente o que dá a leitura de perto.

## 8. Checklist (item 27)
- [x] Proporção correta (planta do OSM; exageros de altura documentados)
- [x] Silhueta convincente (quadra com telhado, frontão, guaritas, muralhas, torre, coqueiros)
- [x] Escala coerente com os outros marcos (carros de 1,75 m; pessoas de 0,8 m; guaritas de 2,4 m)
- [x] Geometria limpa (vértices soldados; faces orientadas por normal desejada)
- [x] Normais corretas (`checar` sem normais inválidas)
- [x] Shading correto (suavização por ângulo de 32°)
- [x] Sem clipping relevante (as águas da ala noroeste cobrem a da quadra de propósito, sem z-fighting)
- [x] Sem geometria flutuando (tudo pousa nos níveis 0,1 / 1,5 / 2,0 / 2,45 / 2,7)
- [x] Sem faces duplicadas (`remove_doubles`)
- [x] Bevels coerentes (0,03–0,04 m nas caixas grossas; peças finas sem chanfro)
- [x] Materiais coerentes e nomeados (33)
- [x] Texturas adequadas (4, todas geradas)
- [x] UV organizada (atlas por quadrantes; telha em metros na água; pisos em UV planar)
- [x] Nível de detalhe adequado ao close e à vista geral
- [x] Performance adequada (532 KB, 41 mil triângulos, 73 malhas)
- [x] Arquivo organizado (script fonte versionado, saídas em `blender/saida/`)
- [x] Nomenclatura em português
- [x] Exportação correta (`exportar` + `checar` OK)

## 9. Altura da etiqueta
- O telhado e o frontão chegam a ~10,5 m.
- A torre treliçada do pátio chega a ~14,6 m, mas é fina.
- `ALTURA_ETIQUETA = 12` já está no `.tsx`. Para o `dashboard/historias.js` sugiro o mesmo valor; não editei esse
  arquivo.

## 10. Dúvidas abertas
1. Cor das fachadas laterais: as fotos recentes mostram trechos creme ou cinza-malva. Usei o rosa-antigo da fachada
   principal em tudo.
2. As fachadas do pátio interno são neutras: a aérea sugere varandas, que não modelei.
3. O monumento no meio do espelho d'água e a estátua do terraço viraram um pedestal e uma figura neutros.
4. Os canhões existem (categoria do Commons), mas a posição no terrapleno é suposição.
5. Não confirmei o nome da escultura das velas na praça a sudeste.
6. Os desníveis (colina, bateria, platô) foram estimados pelas fotos.
7. As cores do casario são pastéis neutros, só sugeridos.
8. **Problema da oficina:** a primeira tentativa de `exportar` falhou com o aviso "createRoot() on a container that has
   already been passed". Isso aconteceu logo depois de o script do Blender regravar o GLB; a segunda tentativa passou.
   Parece um recarregamento do Vite no meio da exportação. Não mexi nos scripts.

## Renders finais
- `renders/forteAssuncao/tsx-perspectiva.png`, `tsx-close.png`, `tsx-frente.png`, `tsx-lado.png`, `tsx-topo.png`;
- inspeção pelo norte: `renders/forteAssuncao/blender-norte.png`.
