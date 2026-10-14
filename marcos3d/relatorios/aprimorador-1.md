# Aprimorador — lote 1 (porta 5330)

Marcos: centro, castelao, aeroporto, messejana, praiaIracema + praiaFuturo (Praias.tsx), cambeba.
Modo B (melhorar). "Antes" = GLB publicado em `dashboard/marcos/` (`renders/<id>/glb-*.png` e `npm run checar -- --de publicados`);
"depois" = `saida/<arquivo>.glb` (`renders/<id>/tsx-*.png` e `npm run checar`).

Nota de ferramenta: com quatro agentes renderizando ao mesmo tempo, o `npm run render` estourou o tempo de navegação
padrão do Puppeteer (30 s) já no primeiro quadro. Usei um invólucro no scratchpad que importa `scripts/comum.mjs` sem
alterá-lo e só aumenta o `setDefaultNavigationTimeout` para 300 s; a cena, as vistas e a saída são as mesmas do
`render.mjs`. Sugestão para `scripts/comum.mjs`: passar `{ timeout: tempo }` também ao `pagina.goto`.

---

## centro — Catedral, Praça do Ferreira e Mercado (`Centro.tsx`)

### ANTES (problemas por gravidade)
- **CRÍTICO**
  - O telhado azul do Mercado Central corria em x e o prédio em z: a cumeeira atravessava o bloco em cruz e a maior parte do telhado flutuava fora dele (bem visível no `glb-topo`).
- **ALTO**
  - Telhados de duas águas feitos com cilindro de 3 lados, com normais suaves: liam como tubos (shading errado) na Catedral e no Mercado.
  - Catedral só com caixas lisas: sem lancetas, sem contrafortes, sem frontispício, rosácea solta na parede. A forma gótica só se lia pelas agulhas.
  - Quarteirões com caixas lisas sem janelas e um bug de módulo negativo (`x % 13.8` em JS): as ruas só existiam do lado oeste; a leste os lotes formavam uma massa contínua.
  - 113 malhas e 24 materiais sem nome.
- **MÉDIO**
  - Nenhum chanfro; nenhuma calçada ou meio-fio (prédios direto no asfalto); árvores da praça sem tronco.
  - Cine São Luiz: caixa lisa de 10 m sem janelas nem aletas, roubando a cena da praça.
- **BAIXO**
  - Asfalto chapado; topo dos prédios sem caixa-d'água ou platibanda.

### DEPOIS (alterações)
1. Mercado: telhado agora corre ao longo do bloco (z), facetado, em chapa metálica azul (metalness 0,45), com lanternim na cumeeira, beiral claro, embasamento em tijolo e fachada com janelas.
2. `prismaTelhado` (extrusão triangular com normais por face) substitui o cilindro de 3 lados em todos os telhados; agulhas e cúpula do lanternim com `coneFacetado`.
3. Catedral: nave e transepto com `caixaChanfrada` e textura de vãos ogivais (lanceta de vitral escuro, moldura, friso de impostas, escorrido na base; UV em metros, uma lanceta a cada 2 m); 12 contrafortes de dois estágios instanciados entre as lancetas; frontispício saliente com frontão, rosácea com moldura e três portais ogivais (o central maior); torres em dois estágios com cornijas, oito vãos ogivais por sineira, pináculos, agulha octogonal facetada e cruz; abside com meio cone de telhado; adro como degrau chanfrado.
4. Quarteirões: correção do módulo (ruas a cada três passos, quadras de 2 × 2 lotes dos dois lados); todos os prédios numa malha de fachadas (UV em metros, janelas por andar, cor por vértice) e numa de coberturas com chanfro de 45° na borda; calçadas/meio-fio de 0,12 m instanciados; caixas-d'água em ~45 % dos telhados; faixa tracejada no eixo das ruas.
5. Praça: calçada elevada, troncos nas árvores, copas em três tons, 5 bancos; Coluna da Hora com os 12 pilares instanciados e base/caixa do relógio chanfradas.
6. Cine São Luiz: torre chanfrada com janelas, platibanda, três aletas déco subindo acima da cobertura, marquise chanfrada.
7. Nomes em todas as malhas (`Nave_Principal`, `Torre_Norte_Agulha`, `Quarteiroes_Fachadas`, `Mercado_Telhado` ...) e materiais (`Mat_Catedral_Lancetas`, `Mat_Mercado_Telha_Metalica` ...). Texturas: 4 (lancetas, janelas, piso, letreiro).

### IMPACTO
- **Realismo/leitura:** a Catedral lê como gótica de perto (lancetas, contrafortes, portais) e de longe (agulhas com cruz); o Mercado deixou de ter um telhado flutuando. O Centro passou a ter ruas, quadras e janelas: lê como cidade, não como caixas.
- **Qualidade visual:** chanfros e telhados facetados fazem a luz desenhar as arestas; cores por vértice mantêm a variedade dos prédios sem multiplicar materiais.
- **Performance:** 7,4 mil triângulos e 55 malhas no GLB (as caixas da cidade viraram 2 malhas); arquivo praticamente igual (139 → 137 KB).
- **Consistência/organização:** tudo nomeado, helpers da oficina (`caixaChanfrada`, `posicionar`, `texturaJanelas`, `aleatorio`).

### Notas (0–10)
| Critério | Antes | Depois |
|---|---|---|
| Geometria | 4 | 7 |
| Topologia | 5 | 7 |
| Proporções | 5 | 7 |
| Detalhamento | 3 | 7 |
| Materiais | 4 | 7 |
| Texturas | 4 | 7 |
| Shading | 3 | 8 |
| Realismo | 3 | 7 |
| Otimização | 6 | 8 |
| Apresentação | 4 | 7 |

### Números
| | Antes (publicado) | Depois (`saida/`) |
|---|---|---|
| KB | 139 | 137 |
| Triângulos | 1 720 | 7 377 |
| Materiais | 24 (sem nome) | 35 (nomeados) |
| Malhas no GLB | 60 (113 nós sem nome) | 55 (0 sem nome) |
| Altura | 18,7 m | 19,6 m |

### Checklist (item 27)
- [x] Proporção correta · [x] Silhueta convincente · [x] Escala correta · [x] Geometria limpa · [x] Normais corretas · [x] Shading correto
- [x] Sem clipping indesejado (lotes que entravam na abside removidos) · [x] Sem geometria flutuando (telhado do Mercado) · [x] Sem faces duplicadas
- [x] Bevels coerentes · [x] Materiais coerentes · [x] Texturas adequadas (4, ≤ 192 px) · [x] UV organizada (metros)
- [x] Nível de detalhes adequado · [x] Performance adequada · [x] Arquivo organizado · [x] Nomenclatura organizada · [x] Exportação correta (`checar` OK)

**Etiqueta:** o topo subiu de 18,7 para 19,6 m (cruzes nas agulhas). Sugiro `altura: 21` em `src/marcos/index.ts` (hoje 19).

---

## castelao — Arena Castelão (`Castelao.tsx`)

### ANTES (problemas por gravidade)
- **CRÍTICO:** nenhum. O modelo já era o mais forte do lote (superelipses, 60 pórticos treliçados, campo com linhas).
- **ALTO**
  - 135 malhas e 12 materiais sem nome.
  - Pele de vidro chapada (azul-marinho uniforme): a fachada, que ocupa metade da vista frontal, não tinha escala nem montantes.
- **MÉDIO**
  - Cobertura branca lisa, sem juntas de chapa; borda externa com quina viva de 90°.
  - Entorno vazio: a esplanada terminava no pedestal sem nenhuma referência de escala.
- **BAIXO**
  - Campo sem traves; sem mureta entre o anel inferior e o gramado.

### DEPOIS (alterações)
1. `anel()` ganhou u angular opcional (`perimetroU`): as juntas da cobertura ficam radiais em todos os anéis.
2. Textura de chapa da cobertura (juntas a cada 1,5 m com brilho de dobra, emenda a cada 6 m) — `Mat_Cobertura_Chapa`, metalness 0,15.
3. Textura de pele de vidro (gradiente de reflexo do céu, montante a cada 1,6 m, travessa a cada 2,4 m) — `Mat_Vidro_Fachada`, rugosidade 0,22.
4. Chanfro na borda externa da cobertura (9,3 → 9,45 m, recuo de 0,18 m), com a normal suavizada pegando luz.
5. Mureta clara junto ao campo; traves em "Π" nas duas linhas de fundo.
6. Anel de 40 árvores (copas em três tons + troncos, 2 malhas instanciadas) fora da esplanada, com falhas nos quatro acessos, a no máximo 32,4 m do centro.
7. Nomes em todas as malhas e materiais.

### IMPACTO
- **Leitura/realismo:** a fachada ganhou ritmo e escala (montantes e pavimentos); a cobertura lê como chapa metálica montada, não como plástico liso; o chanfro desenha a borda.
- **Apresentação:** as árvores dão escala e enquadram a arena na vista do bairro.
- **Performance:** 261 → 113 KB (o exportar com meshopt comprime muito melhor que o GLB antigo), +4,9 mil triângulos (árvores e mureta).

### Notas (0–10)
| Critério | Antes | Depois |
|---|---|---|
| Geometria | 8 | 8 |
| Topologia | 7 | 7 |
| Proporções | 8 | 8 |
| Detalhamento | 6 | 7 |
| Materiais | 5 | 7 |
| Texturas | 6 | 8 |
| Shading | 7 | 8 |
| Realismo | 6 | 7 |
| Otimização | 6 | 8 |
| Apresentação | 7 | 8 |

### Números
| | Antes (publicado) | Depois (`saida/`) |
|---|---|---|
| KB | 261 | 113 |
| Triângulos | 32 178 | 37 090 |
| Materiais | 12 (sem nome) | 17 (nomeados) |
| Malhas no GLB | 17 (135 nós sem nome) | 21 (0 sem nome) |
| Altura | 13,5 m | 13,5 m |

### Checklist (item 27)
- [x] Proporção · [x] Silhueta · [x] Escala · [x] Geometria limpa · [x] Normais · [x] Shading · [x] Sem clipping · [x] Sem flutuação · [x] Sem faces duplicadas
- [x] Bevels coerentes (borda da cobertura) · [x] Materiais coerentes · [x] Texturas (4, ≤ 408 × 614 px do campo — já existente) · [x] UV em metros/angular
- [x] Detalhe adequado · [x] Performance · [x] Organização · [x] Nomenclatura · [x] Exportação (`checar` OK)

**Etiqueta:** sem mudança (topo 13,5 m; `altura: 12` atual).

---

## aeroporto — Aeroporto Pinto Martins (`Aeroporto.tsx`)

### ANTES (problemas por gravidade)
- **CRÍTICO:** nenhum (composição, rumo da pista e terminal em "banana" corretos).
- **ALTO**
  - 178 nós e 34 materiais sem nome; 439 KB para 7,4 mil triângulos (GLB antigo mal comprimido).
  - Coberturas solares do estacionamento flutuando a 1,1 m, sem pilares.
  - Faixas de vidro do terminal chapadas (azul liso), sem montantes: o terminal não tinha escala.
- **MÉDIO**
  - Terminal, cumeeiras e viaduto com arestas vivas (extrusões sem bisel).
  - Hangares sem portão (meio cilindro cinza fechado); bloco do hangar e terminal de cargas como caixas mudas.
  - Estacionamento e via vazios; gramado do sítio de uma cor só.
  - 28 triângulos degenerados por avião (polos da cápsula da fuselagem).
- **BAIXO**
  - Cilindro do lado terra sem arremate no topo.

### DEPOIS (alterações)
1. `Laje` ganhou `chanfro` (bisel para dentro, a planta não cresce) — terminal 0,14 m, píer 0,12, cumeeiras 0,06–0,08, viaduto 0,06.
2. Faixas de vidro refeitas como setores de cilindro (`faixaCurva`) com UV em metros ao longo do arco e textura de pano de vidro (reflexo do céu, montante a cada 1 m, caixilho) — `Mat_Vidro_Terminal`; a do lado terra vira a face para dentro do arco.
3. Estacionamento: 2 pilares por cobertura solar (36), ~30 carros sob as coberturas e 5 na via, instanciados, com cores de frota.
4. Hangares com portão escuro em meio disco; bloco do hangar com portão; terminal de cargas chanfrado com 4 docas viradas para o pátio; base da torre e do cilindro chanfradas; coroa no topo do cilindro.
5. Gramado com `texturaManchada` (variação suave, sem sujeira) — `Mat_Grama_Sitio`.
6. Fuselagens sem triângulos degenerados (`semDegenerados`).
7. Nomes em todas as malhas (`Terminal_Corpo`, `Embarque_Pontes`, `Torre_Cabine_Vidro`, `Carros` ...) e materiais (números das cabeceiras viraram `Mat_Pista_Numero_13/31`).

### IMPACTO
- **Leitura/escala:** montantes no vidro, carros e pilares dão a escala humana que faltava; os portões dizem "hangar".
- **Coerência estrutural:** nada mais flutua (coberturas solares apoiadas).
- **Qualidade visual:** os biséis fazem a luz contornar o arco do terminal; o gramado deixa de ser um disco chapado.
- **Performance:** 439 → 174 KB; 7,4 → 10,6 mil triângulos; 0 triângulos degenerados.

### Notas (0–10)
| Critério | Antes | Depois |
|---|---|---|
| Geometria | 7 | 8 |
| Topologia | 6 | 8 |
| Proporções | 7 | 7 |
| Detalhamento | 6 | 8 |
| Materiais | 5 | 7 |
| Texturas | 4 | 7 |
| Shading | 6 | 8 |
| Realismo | 6 | 7 |
| Otimização | 4 | 8 |
| Apresentação | 7 | 8 |

### Números
| | Antes (publicado) | Depois (`saida/`) |
|---|---|---|
| KB | 439 | 174 |
| Triângulos | 7 444 | 10 626 |
| Materiais | 34 (sem nome) | 35 (nomeados) |
| Malhas no GLB | 55 (178 nós sem nome) | 56 (0 sem nome) |
| Altura | 17,2 m | 17,2 m |

### Checklist (item 27)
- [x] Proporção · [x] Silhueta · [x] Escala · [x] Geometria limpa (0 degenerados) · [x] Normais (faixa do lado terra invertida de propósito) · [x] Shading
- [x] Sem clipping · [x] Sem flutuação (coberturas solares) · [x] Sem faces duplicadas · [x] Bevels coerentes · [x] Materiais coerentes
- [x] Texturas (4: números 13/31, vidro, gramado; ≤ 128 px) · [x] UV em metros · [x] Detalhe adequado · [x] Performance · [x] Organização · [x] Nomenclatura · [x] Exportação (`checar` OK)

**Etiqueta:** sem mudança (topo 17,2 m; `altura: 16`).

---

## messejana — Lagoa e Matriz de Messejana (`Messejana.tsx`)

### ANTES (problemas por gravidade)
- **CRÍTICO:** nenhum (composição boa: lagoa do OSM, mata nas margens, igreja bem resolvida).
- **ALTO**
  - 331 nós e 33 materiais sem nome; 101 malhas (acima das ~80 do orçamento); 420 KB.
  - 200 triângulos degenerados (20 por cápsula da estátua).
  - Palmeiras com folhas de caixa reta (tábuas horizontais): a copa não lia como palmeira.
- **MÉDIO**
  - Rocha da estátua descendo 0,45 m abaixo de y = 0 (para dentro do pedestal).
  - Igreja sem chanfros nas massas (nave, fachada, torre, adro); flecha e rocha com normais suaves em formas facetadas.
  - Quiosque do píer apoiado num mastro central único; calçadão sem iluminação; gramado de uma cor só.
- **BAIXO**
  - Estátua um pouco pequena e escura para ler de longe.

### DEPOIS (alterações)
1. Folhas de palmeira refeitas: tira em "V" que sobe e cai em arco, afinando na ponta (`geometriaFolha`), 8 por palmeira, alternando erguidas e caídas, dois tons, material de dois lados (`Mat_Folha_Palmeira`); cacho de cocos no topo.
2. Estátua: peças de bronze juntas numa malha (`Iracema_Figura_Bronze`) e o cabelo noutra, cápsulas sem triângulos degenerados, conjunto 15 % maior, bronze um pouco mais claro, rocha facetada apoiada em y = 0 e base de pedras na água.
3. Igreja: adro, degrau, nave, fachada, fachada central e núcleo da torre com `caixaChanfrada`; flecha facetada; arcos (portas, nicho, sineira) com uma forma só por moldura e por vão (`formaArco`) — 20 → 10 malhas.
4. Píer: passarela e deck chanfrados, quiosque sobre quatro esteios; 6 postes com luminária no calçadão (instanciados); pilares do gradil chanfrados.
5. Gramado com `texturaManchada` (`Mat_Grama_Margem`).
6. Nomes em todas as malhas e materiais.

### IMPACTO
- **Leitura:** as palmeiras agora leem como palmeiras de longe e de perto — eram o elemento mais repetido e mais fraco.
- **Correção técnica:** 0 triângulos degenerados; nada abaixo do chão; 101 → 73 malhas no GLB.
- **Qualidade visual:** chanfros na igreja pegam luz nas quinas; postes e esteios dão escala humana ao calçadão.
- **Performance:** 420 → 159 KB.

### Notas (0–10)
| Critério | Antes | Depois |
|---|---|---|
| Geometria | 7 | 8 |
| Topologia | 5 | 8 |
| Proporções | 7 | 7 |
| Detalhamento | 6 | 7 |
| Materiais | 6 | 7 |
| Texturas | 5 | 6 |
| Shading | 6 | 8 |
| Realismo | 6 | 7 |
| Otimização | 4 | 8 |
| Apresentação | 7 | 8 |

### Números
| | Antes (publicado) | Depois (`saida/`) |
|---|---|---|
| KB | 420 | 159 |
| Triângulos | 13 304 | 15 774 |
| Materiais | 33 (sem nome) | 34 (nomeados) |
| Malhas no GLB | 101 (331 nós sem nome) | 73 (0 sem nome) |
| Triângulos degenerados | 200 | 0 |
| Altura | 15,5 m | 15,5 m |

### Checklist (item 27)
- [x] Proporção · [x] Silhueta · [x] Escala · [x] Geometria limpa · [x] Normais · [x] Shading · [x] Sem clipping · [x] Sem flutuação · [x] Sem faces duplicadas
- [x] Bevels coerentes · [x] Materiais coerentes · [x] Texturas (2: relógio e gramado) · [x] UV · [x] Detalhe adequado · [x] Performance · [x] Organização · [x] Nomenclatura · [x] Exportação (`checar` OK)

**Etiqueta:** sem mudança (topo 15,5 m; `altura: 14`).

---
