# Especialista Estoril — miniatura nova

Status: **concluído**. O `exportar` e o `checar` foram aprovados. Nada foi publicado em `dashboard/` e não fiz nenhum
commit (a ficha e o relatório parcial foram commitados pelo coordenador como ponto de controle).

## 1. Pesquisa e referências
- Ficha em `pesquisa/estoril/ficha.md` (história, planta do OSM, entorno, dúvidas e fontes com URL).
- Rede: Wikimedia, Wikipédia, OSM e Esri com 403; `WebFetch` sem DNS. Só o `WebSearch` respondeu: **sem fotos**.
- Confirmado por texto: Vila Morena (1920–25), cassino/clube dos oficiais americanos na Segunda Guerra, Estoril a partir
  de 1948, tombado em 1986, torre e parte da fachada desabaram em 1994, réplica reaberta em 1995, sede da Setfor desde
  2017. **Dois pavimentos e uma torre, telha marselha, varandas, eclético com predominância neocolonial.**
- Planta: OSM `building:part` (corpo de 2 pavimentos em L, torre de 11,1 m na quina sudeste, bloco oeste, varandas
  térreas, anexos leste e oeste), eixo a 105,5°, fachada sul para a Rua dos Tabajaras.

## 2. Modelagem e rodadas de render → crítica → correção (luz do site)
- `blender/estoril.py` gera `blender/saida/estoril-pecas.glb`, `-ao-chao.jpg` e `-layout.json`;
  `src/marcos/novos/Estoril.tsx` carrega as peças e instancia árvores, coqueiros, pessoas e carros.
- Rumo real (GIRO = −15,5°): a fachada da torre, para a Tabajaras, já olha para as câmeras do sul. Não precisei girar.

### Rodada 1 (render da oficina)
Leitura geral boa: palacete de dois pavimentos com telhados de telha, torre, varandas em arcada, mar atrás.
Problemas:
- **Crítico:** as paredes "brancas" saem **lilás** com a luz do chão azul do site.
- **Alto:** a torre quase não passa da cumeeira (mirante a 12,5 m, cumeeira a 11,1 m), e ela é o ícone do prédio.
- **Alto:** os dois táxis do ponto da Tabajaras ficaram **fora do disco**.
- **Médio:** a metade sul do disco é piso vazio; a frente do prédio até a rua (~10 m) não conta nada.
- **Médio:** a cobertura do anexo oeste usa o piso cerâmico do terraço e parece um caixote aberto.
- **Baixo:** as linhas de espuma são contínuas demais e parecem listras.
- **Correções:** paredes em branco quente `#f6ead2`; o fuste da torre passa 1,5 m do beiral, com friso e janelinhas,
  e o mirante vai a 13,9 m (pináculo a 17,2 m); táxis dentro do disco; a Tabajaras 2 m mais perto do prédio; canteiros
  de grama com arbustos dos dois lados da escadinha e bancos no pátio; cobertura cinza no anexo oeste; espuma em trechos.

### Rodada 2
A torre agora lê como torre com mirante, nas três vistas. A frente tem canteiros e escadinha, os táxis voltaram para
a rua. Exportação de teste: **394 KB**, 21,6 mil triângulos, 58 malhas, 34 materiais, `checar` OK.
Problemas:
- **Alto:** a fachada sul fica sempre na sombra (a luz vem do noroeste), e o branco ainda sai **cinza-lilás**.
- **Médio:** o lado de lá da Tabajaras continua vazio. Não dá para pôr casas ali: na vista "frente" (9°) elas
  esconderiam o térreo do Estoril.
- **Médio:** a praia tem pouca vida para dizer "beira-mar" no tamanho do tour.
- **Correções:** parede `#fdebc4`, que na sombra do site sai branco quente (a luz do chão é azul); abrigo do ponto
  de táxi; gente na calçada de lá da Tabajaras; seis guarda-sóis coloridos na areia (InstancedMesh).

### Rodada 3
A fachada sul lê como **casarão branco de telhado de barro com torre-mirante**, entre a rua e a praia. Os guarda-sóis
fazem o "beira-mar" aparecer já na vista de longe.
Problema: o abrigo do táxi ficou meio fora do disco. Abrigo e táxis vieram uns 5 m para leste.
- **Correção:** abrigo e táxis ~8 m para leste.

### Rodada 4 (final)
Tudo dentro do disco. Nas cinco vistas, a torre-mirante é o ponto mais alto e a leitura vai da Tabajaras ao mar.

**"Alguém de Fortaleza reconhece o Estoril?"** Sim, pelo que é confirmado:
- a ~200 px (vista geral): o casarão claro de dois pavimentos e telhados de barro, com a **torre** na quina, sozinho
  entre a rua de bloquetes e o calçadão, com o mar, a areia e os coqueiros logo atrás;
- no close: a torre com o mirante de arcos e o pináculo, as varandas em arcada com terraço de balaústres, a sacada,
  a escadinha da porta, as porta-janelas de venezianas e o anexo de portas em arco.

A fidelidade de cor e de ornamento é limitada: sem fotos nesta sessão, ver as dúvidas.

## 3. Composição e por quê
- **Recorte:** o palacete inteiro, no **rumo real** (eixo a 105,5°; `GIRO = −15,5`). A fachada da torre, que é a da
  Tabajaras (o endereço), olha para o sul, de frente para as câmeras da oficina. Não foi preciso girar como no Theatro.
- **De sul para norte:**
  1. calçada de lá da Tabajaras com o ponto de táxi (OSM `amenity=taxi`);
  2. **Rua dos Tabajaras** como rua compartilhada de bloquetes, sem meio-fio (OSM `living_street`,
     `paving_stones`), a ~6° do eixo do prédio, como no OSM;
  3. pátio da frente com canteiros e bancos;
  4. **o palacete**;
  5. **calçadão**, com postes e bancos;
  6. **areia**, com guarda-sóis;
  7. **mar**, com a espuma da arrebentação.
- A leste fica o gramado do Largo dos Tremembés.
- **Escala:**
  - planta × 1,15 (o prédio real tem só ~41 × 15 m e cabe quase inteiro);
  - alturas: térreo 4,6 m, beiral 9 m, cumeeira 11,1 m;
  - torre: fuste até 10,5 m, mirante até 13,9 m, pináculo a 17,2 m (OSM: 8,3 e 11,1 m). A torre foi exagerada de
    propósito, porque é o ícone.
  - A frente até a rua (~21 m reais) foi comprimida para ~10 m.
  - A praia real fica a ~45 m; foi comprimida para a faixa norte do disco (calçadão 10–19 m, areia 19–25 m, mar depois).
- **A Ponte dos Ingleses** (~70–100 m a noroeste) ficou de fora: não cabe sem distorcer e já faz parte do marco
  `praiaDeIracema` (`src/marcos/Praias.tsx`).
- **Casas do outro lado da rua:** não pus. Na vista "frente" (9°) elas esconderiam o térreo do Estoril.

## 4. Como gerar de novo
```sh
cd marcos3d
<python-com-bpy> blender/estoril.py            # ~4 s: modela, assa a oclusão e exporta (--sem-bake: ~2 s)
export CHROME=<invólucro do chrome>
npm run render -- --ids estoril --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta 5377
npm run exportar -- --ids estoril --porta 5377
npm run checar -- --ids estoril
```
`<python-com-bpy>` é o venv do scratchpad, com Blender 5.2.3.

**O que o `blender/estoril.py` faz:**
- Modela num referencial do prédio. A planta do OSM entra por (u, v) do eixo, pela função `m(u, v)`, e tudo gira no
  fim (`MUNDO`).
- Usa a mesma base de `bmesh` do Theatro: prismas chanfrados, cintas, tornos, placas extrudadas e o recorte no disco.
- Tem duas peças novas:
  - `arcada()`: pilares, tímpanos com o recorte do arco pleno, arquivolta branca, capitel e base;
  - `telhado()`: quatro águas com beiral largo, testeira, forro, **cachorros de madeira** e espigões. Cada água é
    cortada numa grade de 1,6 m, para a **telha marselha** do atlas manter o tamanho.
- Gera um **atlas de 256 px** em Python:
  - porta almofadada com bandeira em leque;
  - janela de venezianas;
  - porta-janela em arco abatido;
  - porta de vidro "francesa" em arco;
  - janela pequena;
  - janela em arco com venezianas;
  - telha marselha (4 × 4 telhas com canais e sombra da fiada);
  - balaústres.
- Assa a **oclusão no Cycles** nas cores de vértice (faixa 0,58–1) e numa imagem de 256 px do chão. Árvores,
  coqueiros, carros e guarda-sóis entram como volumes provisórios, só para fazer sombra.
- Exporta `blender/saida/estoril-pecas.glb`, `-ao-chao.jpg` e `-layout.json`, com 5 árvores, 5 coqueiros
  (com inclinação), 37 pessoas, 4 carros e 6 guarda-sóis.

**O que o `src/marcos/novos/Estoril.tsx` faz:**
- Carrega as peças, liga as sombras e renomeia cada primitiva como `<Peça>_<Material>`.
- Põe a cor da telha (`#b65a35`): o exportador do Blender não leva a cor-base de material com textura.
- No chão, aplica o aoMap e as texturas de canvas: piso do pátio, placas do calçadão, bloquetes em fiadas
  desencontradas e manchas na areia, no mar e na grama.
- Instancia árvores, **coqueiros inclinados**, pessoas, carros e **guarda-sóis**.
- O JPEG da oclusão leva `userData.mimeType`.

## 5. Os 4 níveis do MASTERCRAFT
**Nível 1 — forma principal:**
- sobrado de 2 pavimentos em L (corpo da frente e ala para o mar);
- bloco oeste de 2 pavimentos;
- **torre** de 4 níveis;
- volumes térreos (varandas) e os dois anexos;
- rua, pátio, calçadão, areia e mar.

**Nível 2 — formas secundárias:**
- soco, cunhais, friso entre os pavimentos, cornija e pilastras;
- telhados de quatro águas com beiral largo;
- **varanda da frente em arcada** (4 arcos e 1 na lateral) e **varanda leste em arcada voltada para o mar**
  (4 arcos e 1), as duas com terraço de balaústres;
- sacada no eixo da fachada e sacada para o mar sobre mãos-francesas;
- **mirante em arcos** nos quatro lados, com parapeito de balaústres;
- platibanda do anexo oeste.

**Nível 3 — detalhes:**
- porta principal almofadada com bandeira em leque, moldura e escadinha de 3 degraus;
- porta-janelas e janelas de venezianas com peitoril e cimalha;
- balcõezinhos de ferro;
- portas de vidro em arco;
- cachorros de madeira sob o beiral, espigões e cumeeira;
- pináculo da torre;
- canteiros com arbustos e bancos;
- postes de globo; abrigo e táxis do ponto da Tabajaras;
- guarda-sóis, coqueiros e gente.

**Nível 4 — microdetalhes:**
- oclusão assada nos vértices e no chão;
- canais e sobreposição das telhas no atlas;
- juntas do piso e dos bloquetes;
- manchas na areia, no mar e na grama;
- espuma em trechos;
- variação por instância nas copas, roupas, carros e guarda-sóis;
- coqueiros com inclinação e rumo próprios;
- rugosidades distintas:

  | Material | Rugosidade | Metalness |
  |---|---|---|
  | Reboco | 0,85 | — |
  | Frisos | 0,7 | — |
  | Telha | 0,75 | — |
  | Mar | 0,22 | — |
  | Ferro | 0,5 | 0,3 |
  | Postes | 0,45 | 0,4 |

## 6. Notas (0–10)
Marco novo, sem modelo anterior: o "antes" é o placeholder de caixas.

| Critério | Antes (placeholder) | Depois |
|---|---|---|
| Geometria | 2 | 8 |
| Topologia | 5 | 7 |
| Proporções | 3 | 7 |
| Detalhamento | 1 | 8 |
| Materiais | 2 | 7 |
| Texturas | 0 | 8 |
| Shading | 4 | 8 |
| Realismo (fidelidade e leitura do lugar) | 1 | 7 |
| Otimização | 6 | 8 |
| Apresentação | 1 | 8 |

O realismo fica em 7 porque cores e ornamentos não puderam ser confirmados por foto.

## 7. Números (`saida/estoril.glb`)
| Item | Valor |
|---|---|
| Tamanho | **407 KB** (bruto 1.213 KB; limite 600) |
| Triângulos | **22.604** |
| Malhas | **61** |
| Materiais | **36** (limite 40) |
| Texturas | 5, todas geradas (ver abaixo) |
| `checar` | **OK**: raio 34,0 m com o pedestal, altura 17,7 m com o pedestal |

As 5 texturas:
- atlas de esquadrias e telha, 256 px;
- oclusão do chão, 256 px em JPEG;
- piso, 128 px, em duas variações (pátio e calçadão);
- bloquetes, 128 px;
- mancha, 64 px.

## 8. Checklist (item 27)
- [x] Proporção correta: planta do OSM × 1,15; alturas e torre exageradas, documentado.
- [x] Silhueta convincente: torre-mirante acima das águas do telhado, varandas em arcada.
- [x] Escala coerente: pessoas de ~1,4 m e carros de 3,7 m, na escala do prédio.
- [x] Geometria limpa: vértices soldados, chanfro só nas massas.
- [x] Normais corretas: o `checar` não acusa normais inválidas.
- [x] Shading correto: suavização por ângulo de 32°.
- [x] Sem clipping indesejado relevante. Os telhados em L se cruzam nas águas, como um rincão.
- [x] Sem geometria flutuando: tudo pousa em z = 0,10; sacadas apoiadas em mãos-francesas.
- [x] Sem faces duplicadas: `remove_doubles`; o `checar` não acusa degenerados.
- [x] Bevels coerentes: 0,03 m nas massas.
- [x] Materiais coerentes e nomeados: 36.
- [x] Texturas adequadas: todas geradas.
- [x] UV organizada: atlas por regiões; telhado em grade de 1,6 m; chão com UV planar.
- [x] Nível de detalhe adequado ao close e à vista geral.
- [x] Performance adequada: 407 KB, 22,6 mil triângulos, 61 malhas.
- [x] Arquivo organizado: script versionado; saídas em `blender/saida/estoril-*`.
- [x] Nomenclatura em português.
- [x] Exportação correta: `exportar` e `checar` OK.

## 9. Altura da etiqueta
- O ponto mais alto é o pináculo da torre, a ~17,2 m (17,7 m com o pedestal).
- A cumeeira do sobrado fica a 11,1 m e o mirante a 13,9 m.
- **`ALTURA_ETIQUETA = 19`** no `.tsx`. Se o `dashboard/historias.js` ganhar altura própria para este marco, sugiro 19
  lá também. Não editei esse arquivo.

## 10. Dúvidas abertas
1. **Cores:** nenhuma fonte de texto confirma a cor das paredes, frisos ou esquadrias. Ficou branco quente
   `#fdebc4` (na sombra do site sai branco), frisos brancos e esquadrias de madeira escura. O placeholder antigo dizia
   "amarelo", sem fonte. **É a primeira coisa a conferir numa foto.**
2. **Torre:** só se sabe que existe, que desabou em 1994 e foi refeita, e que tem 11,1 m no OSM. O mirante de arcos e o
   telhado piramidal são interpretação neocolonial. A torre foi exagerada para ~17 m.
3. **Varandas:** onde ficam e como são não foi confirmado. As partes térreas do OSM viraram arcadas com terraço de
   balaústres.
4. **Telhados:** a telha marselha está confirmada; as quatro águas, o beiral largo e os cachorros são interpretação.
5. **Fachada sul:** a ordem e o número de vãos, a sacada e a escadinha são interpretação. Não há letreiro: o atual
   não foi confirmado ("Vila Morena" estava na fachada original em 1989).
6. **Anexos leste e oeste:** só volume e altura (OSM); coberturas e vãos neutros.
7. **Pátio da frente:** canteiros e bancos são interpretação; o que há de fato entre o prédio e a Tabajaras não foi
   confirmado.
8. **Entorno:**
   - coqueiros, guarda-sóis, postes e bancos do calçadão são genéricos da orla;
   - a praia foi comprimida;
   - a Ponte dos Ingleses ficou de fora (está no marco `praiaDeIracema`).

## Renders finais
- `renders/estoril/tsx-perspectiva.png`
- `renders/estoril/tsx-close.png`
- `renders/estoril/tsx-frente.png`
- `renders/estoril/tsx-lado.png`
- `renders/estoril/tsx-topo.png`
