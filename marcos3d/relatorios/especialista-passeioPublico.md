# Especialista passeioPublico — Passeio Público (Praça dos Mártires)

Status: **concluído**.
- Refeito do zero: a versão anterior foi descartada.
- 5 rodadas de render → crítica → correção na luz do site.
- `exportar` e `checar` **aprovados**.
- Nada publicado em `dashboard/` e nada commitado por mim.

## 1. Pesquisa e referências
A ficha completa está em `pesquisa/passeioPublico/ficha.md`, com a planta do OSM, os textos com URL, as cores e as dúvidas.

**Rede nesta sessão:**
- Wikimedia, Wikipédia, API do OSM e Esri estavam bloqueados (403), e o `WebFetch` ficou sem DNS.
- Só o `WebSearch` respondeu: usei os resumos das páginas e as URLs estão na ficha.
- Não baixei nenhuma foto. Para olhar, usei as duas aéreas do Commons que já estavam na pasta do Forte:
  - `pesquisa/forteAssuncao/ref-1.jpg`: https://commons.wikimedia.org/wiki/File:Atual_Quartel_da_10%C2%AA_Regi%C3%A3o_Militar_-_Vis%C3%A3o_a%C3%A9rea.jpg
  - `pesquisa/forteAssuncao/ref-2.jpg`: https://commons.wikimedia.org/wiki/File:Entrada_do_atual_Quartel_da_10%C2%AA_Regi%C3%A3o_Militar_-_Vis%C3%A3o_a%C3%A9rea.jpg
  - As duas mostram o Passeio como uma massa fechada de copas grandes e escuras, colada ao quartel.

**Confirmado por texto:**
- **Praça mais antiga** da cidade: obras de 1864, nome de 1879, inauguração em 1880; tombada pelo Iphan.
- **Três planos descendo para o mar:**
  - Caio Prado, "de frente para o mar", a elite;
  - Carapinima, o plano do meio;
  - Padre Mororó, o plano de baixo, com o lago.
- **Hoje só o 1º plano é praça.** O 2º foi cedido ao Exército em 1963 e tem edificações da 10ª RM. O 3º sumiu: em 1945 era usina da Light, e hoje ali passa a Leste-Oeste.
- **Baobá** de 1910, tombado (nó do OSM com `species` e `start_date`).
- **Réplicas de estátuas greco-romanas** "no corredor principal": nos títulos do Commons, Apolo, Prometeu e Vênus com Cupido; 14 esculturas restauradas em 2022.
- **Gradil com colunas:** retirado em 1932 e refeito nos anos 1990.
- **Chafarizes com peixes**, bustos, postes, muretas e caixa d'água.
- **Café Passeio** num antigo quiosque, com almoço ao ar livre.
- **Carnaúbas** em homenagem aos revolucionários (obra de 2020).

**Planta:** `pesquisa/passeioPublico/osm.xml`. Usei:
- o gradil (via 24439917) e o muro norte;
- os 3 portões;
- 11 caminhos, entre eles a "Avenida Caio Prado" (via 937444724);
- a fonte;
- os 3 nós do baobá;
- as 10 árvores tombadas e as 29 outras árvores;
- o Café Passeio e o pavilhão redondo, com o piso do café;
- os prédios do Exército e a quadra;
- as ruas;
- a fachada do quartel e a da Santa Casa.

## Diagnóstico da versão anterior (descartada)
- **CRÍTICO:**
  - parecia uma praça qualquer: disco de grama com cruz de caminhos e fonte azul, sem a planta real;
  - sem os três planos, sem o gradil, sem o Forte ao lado;
  - o baobá era igual às outras árvores.
- **ALTO:** estátuas e bustos minúsculos, árvores genéricas espalhadas, pavilhão com telhado vermelho inventado.

## 2. Composição e por quê
**Recorte com intenção:** a praça (~140 × 70 m) no meio do disco e, ao norte, a descida em degraus até a Leste-Oeste, que é o que a distingue.
- A planta é encolhida **em eixos alinhados com a praça**:
  - u vai ao longo do lado maior, a 108°;
  - v vai para o mar, a 18°;
  - cada eixo é comprimido por faixas lineares.
- A praça fica com K ≈ 0,34 × 0,41.
- Os vizinhos entram mais comprimidos:
  - a rua e o casario ao sul;
  - a Barão do Rio Branco e a Santa Casa a oeste;
  - a Floriano Peixoto e o quartel a leste.
- O 2º plano (52 m reais → 9,3 m) e a avenida (36 m → 9,3 m) ficam numa faixa ao norte.
- Tudo é modelado nesse quadro local e girado −18° no fim, então o rumo real é mantido (norte em −z).

**Níveis**, porque os três planos descem para o mar:

| Nível | Altura |
|---|---|
| 3º plano: Leste-Oeste | 0,1 m |
| 2º plano: Exército | 1,05 m |
| ruas do Centro | 2,0 m |
| 1º plano: praça | 2,14 m (um degrau acima da calçada) |
| platô do Forte | 3,2 m (o mesmo desnível de 1,2 m do modelo do Forte) |

- A rampa da Barão do Rio Branco desce do alto até a avenida.
- O muro caiado da Caio Prado tem cordão de pedra e, por cima, a mureta com pilaretes.

**Hierarquia de leitura:**
1. o bosque fechado dentro do gradil com colunas;
2. no meio, o **baobá** (tronco em garrafa cinza-rosado, galhos grossos em leque, tufos ralos), ao lado da **fonte** redonda com repuxo de duas taças e quatro peixes;
3. as **estátuas brancas** ao longo do corredor principal e as duas junto à fonte;
4. o **Café Passeio** com guarda-sóis;
5. a **ala rosa do quartel** do outro lado da Floriano;
6. a descida para o mar: a mureta da Caio Prado com bancos virados para o norte, o 2º plano com os prédios baixos do Exército e a quadra, e a Leste-Oeste com carros.

**Coerência com o Forte:**
- O Forte desenhou "a beira do Passeio" com gradil de ferro escuro e árvores grandes. Aqui o gradil usa o mesmo ferro `#24282a`, agora com as colunas confirmadas pelo texto.
- O quartel usa as mesmas cores, o mesmo atlas de janelas em arco, a mesma telha (canvas idêntico) e o mesmo desnível do platô.
- **Divergência registrada:** o modelo do Forte supôs que o terreno ao norte da praça fosse o platô alto do forte. Pelos textos, o 2º plano é **mais baixo** que a praça, e foi isso que modelei.

**Exageros:**
- Árvores de ~9–10 m.
- Baobá de 9,7 m, com tronco de Ø 3 m.
- Estátuas de 1,6 m sobre pedestal de 1,25 m.
- Fonte de Ø 3,5 m (real 6,9 m × K = 2,5 m).
- Café 1,25× a planta.
- Quartel com cimalha a 5,0 m sobre o platô e cumeeira a ~9,6 m.

## 3. Como gerar de novo
```sh
cd marcos3d
<python-com-bpy> blender/passeioPublico.py            # ~5 s: modela, assa a oclusão e exporta (--sem-bake: ~2 s)
#   --planta <arq.json> grava a planta do quadro local para depuração (fora do repositório)
export CHROME=<invólucro do chrome>
npm run render -- --ids passeioPublico --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta 5374
npm run exportar -- --ids passeioPublico --porta 5374
npm run checar -- --ids passeioPublico
```
`<python-com-bpy>` é `scratchpad/blender-venv/bin/python` (Blender 5.2.3).

**`blender/passeioPublico.py`:**
- lê o `osm.xml` direto, sem números copiados à mão;
- monta, nesta ordem:
  - **terreno** em três planos e a rampa;
  - **pisos:** gramado e 11 alamedas do OSM em quadriláteros com esquadria, com o anel da fonte e o piso do café;
  - **muro da Caio Prado** e muro do 2º plano sobre a avenida;
  - **gradil:** mureta, colunas com pinha, ferro com montantes a cada 0,19 m e 3 portões com colunas altas e folhas abertas;
  - **fonte**, **baobá**, **10 estátuas** (4 variantes), **3 bustos**;
  - **Café Passeio** e pavilhão redondo;
  - **quartel**, **Santa Casa**, **casario** e **prédios do Exército** (do OSM, com tinta pastel nas cores de vértice);
  - **quadra** e **ruas**;
- **oclusão de ambiente** no Cycles (CPU, 96 amostras, raio 2,6 m) em cor de vértice, com volumes provisórios de árvores e carros;
- exporta `blender/saida/passeioPublico-praca.glb` e `passeioPublico-layout.json`:
  - 52 árvores, 4 palmeiras, 34 postes, 42 bancos;
  - 6 mesas, 71 carros, 41 pessoas.

**`src/marcos/novos/PasseioPublico.tsx`:**
- carrega o GLB, renomeia as malhas como `<Peça>_<Material>`, liga as sombras e troca a água por `fab.agua()`;
- **3 texturas em canvas** (lição do Dragão do Mar: a cor de material com textura é aplicada aqui):
  - telha 128 px, a mesma do Forte;
  - piso das alamedas 128 px, blocos claros desencontrados;
  - mancha 64 px, nos pisos;
- **instancia:**
  - **árvores** com copa "em nuvem" (4 icosaedros colados) em três portes: redonda, larga e o Benjamin escuro;
  - **carnaúbas** de leque e a **macaúba**;
  - **postes** de ferro com globo e **bancos** de madeira com pés de ferro (o ferro e o globo reaproveitam os materiais do GLB);
  - **mesas** com guarda-sol;
  - carros e gente.

## 4. Os 4 níveis do MASTERCRAFT
**Nível 1 — forma principal:** praça retangular no alto, com o bosque; degraus do 2º plano e da avenida ao norte; ala do quartel a leste; ruas e casario.

**Nível 2 — formas secundárias:**
- gradil com mureta e colunas; portões;
- muro e mureta da Caio Prado com pilaretes;
- rampa da Barão;
- fonte em bacia com repuxo;
- tronco e galhos do baobá;
- café com cimalha, telhado truncado e lanternim; pavilhão redondo;
- quartel com embasamento, cordão, cimalha e telhado de quatro águas; Santa Casa com frisos.

**Nível 3 — detalhes:**
- montantes do gradil; pinhas das colunas;
- folhas abertas dos portões e soleiras;
- peixes da fonte;
- estátuas (drapeada, de manto, com tocha, Vênus com Cupido) sobre pedestal de plinto, dado e cornija;
- bustos de bronze sobre estela;
- postes com globo; bancos com encosto; mesas com guarda-sol;
- janelas em arco do quartel; faixas das ruas; quadra com linhas;
- carros e pessoas.

**Nível 4 — microdetalhes:**
- oclusão assada: pé das colunas, sob as copas, quinas dos muros, em volta da fonte;
- blocos do piso com variação de tom;
- pisos manchados; telha variada;
- tons por copa e por espécie;
- rugosidades distintas: mármore 0,45, ferro 0,5 com metalness 0,3, bronze 0,5 com metalness 0,35, água 0,08, reboco 0,75–0,85.

## 5. Rodadas de render → crítica → correção (luz do site)
1. **R1** (sem oclusão):
   - **Crítico:** a ala do quartel cortada pelo disco virava um paredão rosa cego na vista lateral; a Santa Casa e o prédio além da avenida viravam "crescentes" curvos na borda.
   - **Alto:** o baobá se perdia entre as copas; as árvores pareciam pirulitos; as estátuas eram pequenas demais.
   - **Médio:** carros demais na Leste-Oeste; carnaúbas como moitas; a rampa passava 0,6 m da borda.
   - **Correção:**
     - quartel como ala inteira (v = −12,4 a 10), dentro do disco, em quatro águas e com janelas nas quatro faces;
     - Santa Casa como bloco retangular inteiro; o prédio além da avenida saiu;
     - baobá maior (tronco Ø 3 m, galhos de 2,7–3,4 m, tufos menores) com clareira de 5 m;
     - estátuas a 1,3×; troncos mais grossos; metade dos carros na avenida; rampa recortada.
2. **R2** (com oclusão):
   - **Funcionou:** o baobá virou o centro da cena; o quartel ficou coerente com o Forte.
   - **Alto:** de cima, o bosque estava ralo, e as aéreas mostram copa fechada.
   - **Médio:** o corte do platô do Forte era uma faixa marrom de 3 m.
   - **Correção:** copas 20% maiores e mais próximas; corte do platô caiado com cordão (lê como a muralha do forte); leques das carnaúbas menores.
3. **R3:**
   - **Resultado:** bosque fechado e protagonistas legíveis.
   - `exportar` e `checar` OK, mas com 64,1 mil triângulos e 81 malhas, acima das metas.
4. **R4:**
   - **Correção:** copa com 4 bolas (−4 mil triângulos) e frisos da Santa Casa no material da parede (−2 malhas).
   - **Crítica:** no `close`, a fonte sumia atrás das copas e das carnaúbas.
5. **R5:**
   - **Correção:** clareira de 5,25 m em volta da fonte (um largo central com as duas estátuas); carnaúbas mais para leste.
   - **Resultado:** a fonte aparece ao lado do baobá na perspectiva e no topo.
   - **Pendência:** no `close` (de SSE), árvores reais do OSM ainda tapam parte dela. Mantive, por serem árvores mapeadas.

**"Alguém de Fortaleza reconhece?"**
- **Na perspectiva e na frente:** o bosque cercado pelo gradil de colunas, com o baobá em garrafa no meio, a fonte e as estátuas brancas, e o quartel rosa do Forte ao lado, como nas aéreas.
- **No topo:** a grade de alamedas da planta real, o baobá em estrela e o café com guarda-sóis.
- **De lado:** os três planos descendo até a Leste-Oeste.
- **O que ainda falta para um "sim" sem hesitar:** fotos de perto, para acertar a forma das estátuas, do café e dos postes. A rede não deixou.

## 6. Notas (0–10), versão anterior → esta
| Critério | Antes | Depois |
|---|---|---|
| Geometria | 3 | 8 |
| Topologia | 5 | 7 |
| Proporções | 3 | 8 |
| Detalhamento | 3 | 8 |
| Materiais | 4 | 8 |
| Texturas | 1 | 7 |
| Shading | 4 | 8 |
| Realismo (fidelidade ao lugar) | 2 | 7 |
| Otimização | 6 | 7 |
| Apresentação | 3 | 8 |

## 7. Números (`saida/passeio-publico.glb`)
| | Valor |
|---|---|
| Tamanho | **550 KB** (limite 600; a meta de 300 KB não foi atingida) |
| Triângulos | **61.460** (~37 mil das peças do Blender; o resto são as copas instanciadas) |
| Malhas | **79** |
| Materiais | **38** (30 do Blender + 8 do `.tsx`; postes, pés de banco e mesas reaproveitam o ferro e o mármore do GLB) |
| Texturas | 4: atlas de esquadrias 256 (Blender), telha 128, piso das alamedas 128, mancha 64 |
| `checar` | **OK**: raio 34,0 m com o pedestal, altura 10,6 m, nada sem nome |

A meta de 300 KB não foi atingida pelo mesmo motivo do Forte e da Unifor: cores de vértice e normais facetadas comprimem pouco. O peso está no gradil (5,4 mil triângulos), nas estátuas e nas janelas do quartel.

## 8. Checklist (item 27)
- [x] **Proporção correta:** planta do OSM; exageros documentados.
- [x] **Silhueta convincente:** bosque, baobá, repuxo, colunas do gradil, ala do quartel.
- [x] **Escala coerente:** carros de 1,75 m e pessoas de 0,8 m, como no Forte; estátuas de 1,6 m.
- [x] **Geometria limpa:** vértices soldados; faces orientadas pela normal desejada.
- [x] **Normais corretas:** o `checar` não acusa normais inválidas.
- [x] **Shading correto:** suavização por ângulo de 32°; baobá e figuras lisos.
- [x] **Sem clipping relevante:** as alamedas se sobrepõem em alturas escalonadas de 2,5 mm, sem z-fighting.
- [x] **Sem geometria flutuando:** tudo pousa em 0,1 / 1,05 / 2,0 / 2,14 / 3,2 m.
- [x] **Sem faces duplicadas** (`remove_doubles`).
- [x] **Bevels coerentes:** chanfros de 0,02–0,03 m nos pedestais e bases; peças finas sem chanfro.
- [x] **Materiais coerentes e nomeados** (38).
- [x] **Texturas adequadas:** 4, todas geradas.
- [x] **UV organizada:** atlas por quadrantes; alamedas em metros; pisos em UV planar; telha em metros.
- [x] **Nível de detalhe** adequado ao close e à vista geral.
- [x] **Performance adequada:** 550 KB, 61 mil triângulos, 79 malhas.
- [x] **Arquivo organizado:** script-fonte versionado; saídas em `blender/saida/`.
- [x] **Nomenclatura em português.**
- [x] **Exportação correta:** `exportar` + `checar` OK.

## 9. Altura da etiqueta
- As copas mais altas, o baobá e a cumeeira do quartel chegam a ~9,7–10,1 m sobre a base.
- `ALTURA_ETIQUETA = 11` já está no `.tsx`. Sugiro o mesmo valor para o `dashboard/historias.js`; não editei esse arquivo.

## 10. Dúvidas abertas
1. **Posição do baobá:** três nós a ≤ 15 m; usei o centro deles, ao sul da fonte, junto ao caminho do portão sul.
2. **Estátuas:** as figuras são genéricas, e a posição de cada uma e o material (mármore ou pedra artificial) não foram confirmados.
3. **Bustos:** quem são, onde ficam e de que material são não foi confirmado; pus 3 de bronze na alameda norte.
4. **Gradil:** cor, altura e espaçamento das colunas não foram confirmados.
5. **Café Passeio:** a cobertura e as cores não foram confirmadas (telhado cinza neutro). O pavilhão redondo ao lado pode ser a caixa d'água restaurada em 2020.
6. **Fonte:** o repuxo é genérico; dos peixes só se sabe que existem.
7. **Carnaúbas:** a posição foi suposta (junto ao gradil sul, a leste do portão).
8. **Desníveis dos planos:** estimados. Divergem do modelo do Forte, que pôs o terreno ao norte da praça mais alto.
9. **Prédios do Exército e Santa Casa:** neutros, sem foto. A Santa Casa foi encurtada para caber inteira no disco.
10. **Quartel:** a ala foi encurtada ao sul (v = −12,4) para fechar em quatro águas dentro do disco. A cor das fachadas laterais repete a dúvida 1 do Forte: usei o rosa-antigo em tudo.
11. **Mar:** fica fora do recorte, além da Leste-Oeste e de uma quadra de prédios.

## Renders finais
- `renders/passeioPublico/tsx-perspectiva.png`
- `renders/passeioPublico/tsx-frente.png`
- `renders/passeioPublico/tsx-close.png`
- `renders/passeioPublico/tsx-topo.png`
- `renders/passeioPublico/tsx-lado.png`
