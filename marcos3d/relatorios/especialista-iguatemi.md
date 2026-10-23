# Especialista Iguatemi — Shopping Iguatemi Bosque refeito do zero

Status: **concluído** (3 rodadas de render → crítica → correção; `exportar` e `checar` aprovados). Não publicado em `dashboard/`.

## Etapa 1 — Entender (concluída)

- **"Antes"** (publicado em `dashboard/marcos/shopping-iguatemi.glb`): 150 KB, 4.470 triângulos, 34 malhas (185 nós sem nome), 29 materiais sem nome, altura 9,5 m.
- **Versão da oficina antes deste trabalho:** 113 KB, 6.646 triângulos, 33 malhas, 26 materiais, altura 9,6 m.
- **Diagnóstico do antigo:**
  - **CRÍTICO (leitura):** um tapete de lajes brancas sem hierarquia; nada diz "Iguatemi".
  - **ALTO:**
    - cones de vidro e pirâmides soltos sobre o telhado;
    - gramado em hexágono deslocado da praça;
    - "torre de caixa d'água" sem fonte;
    - letreiro genérico cortado;
    - copas em icosaedro sem tronco.
  - **MÉDIO:** fachadas em textura chapada; nenhuma sombra de contato.
- **Barra de qualidade** (renders de Castelão, Aeroporto, Messejana e Praia do Futuro, na luz do site): leitura imediata do ícone; árvores com tronco e copa; ruas com faixa e carros; chão coberto; formas secundárias com sombra.

## Etapa 2 — Pesquisa (concluída, com limitação de rede)

- Ver `pesquisa/iguatemi/ficha.md`.
- O proxy bloqueou OSM, Wikimedia e Wikipédia; só o WebSearch funcionou. **Não há fotos de referência.**
- Ícones confirmados por fonte:
  - **cobertura de madeira MLC curvilínea de ~4.500 m² (vão de 48 m)** sobre o Garden Court da expansão de 2015 (LaGuarda.Low);
  - **fachada de vidro verde em estrutura metálica branca**, com pé-direito triplo na entrada e alumínio composto perfurado;
  - **marquise sobre um cone de tubos de aço de 10 m** (anos 1990);
  - **claraboia de vidro sobre o corredor** (1992);
  - **edifício-garagem**;
  - **mata do Cocó ao norte e a leste**;
  - **frente na Av. Washington Soares** (rumo 135°).

## Etapa 2b — Passada de referências com rede (concluída)

- **OSM (API 0.6):** a planta real do shopping está mapeada em detalhe, com o contorno inteiro e ~40 partes com altura do cadastro da Prefeitura. Isso substituiu o contorno aproximado da sessão anterior.
- **Vista aérea Esri** (só para olhar, alinhada com o OSM): revelou a **forma em gota** da cobertura do Garden Court, que tem ~4.500 m², a área declarada da cobertura de madeira. Revelou também a **proa de vidro em grelha branca**, a **rotunda em leque**, a **claraboia em lente**, a **pirâmide** e a **cúpula octogonal**, o **plano de vidro inclinado com aletas** e a claraboia longa da espinha.
- **Commons e Wikipédia:** nenhuma foto do exterior. Só interiores (`Iguatemi_3.JPG`: abóbada de vidro com nervuras brancas) e um feirão no estacionamento. As dúvidas de fachada continuam e estão na ficha.
- Referências salvas em `pesquisa/iguatemi/ref-1..5` (fora do git). A ficha foi atualizada, com a seção "Atualização com rede liberada".

## Composição (nova, a partir da planta real)

- **Planta real, sem giro (norte em −z),** encolhida em torno do ponto real (0, 35):
  - **K = 0,135** até 170 m do centro;
  - **daí para fora, compressão radial suave** (o excesso de raio entra a 55%);
  - assim o miolo icônico (gota, proa, rotunda, lente, pirâmide, cúpula) fica grande, e as pontas (cinema, bloco norte, extremos da espinha) cabem até ~30 m.
- **Alturas:**
  - h' = 0,297·h até 16 m reais; acima disso, 0,2 m por metro;
  - os blocos altos da borda (cinema, 26 m) não roubam a cena do Garden Court, que fica como o ponto mais alto do miolo (~7 m).
- **Hierarquia de leitura:**
  1. a gota bege com grelha de madeira e anel branco;
  2. a proa de vidro verde em grelha branca e a rotunda;
  3. a espinha com a claraboia;
  4. o resto: embasamento cinza-quente com máquinas, garagem em lajes, estacionamentos, a mata do Cocó em faixa ao norte e a leste, e a Washington Soares ao sul.

## Como o Blender foi usado (opção 1: Blender como fonte de peças)

- **Fonte versionada (não há .blend):**
  - `blender/iguatemi.py`, o construtor: geometria em bmesh, chanfros explícitos, AO, exportação;
  - `blender/iguatemi_planta.py`, os dados da planta: contorno, partes com altura, vias, estacionamentos, jardim, entradas e vizinhos. Foi gerado do OSM por um script de conversão e é só dado.
- **Saída** (exportador glTF do Blender, sem compressão):
  - `blender/saida/iguatemi-shopping.glb`: 65 objetos, 27.921 triângulos, 27 materiais. A oclusão de ambiente vai em `COLOR_0`;
  - `blender/saida/iguatemi-dados.json`: posições de 159 árvores, 30 palmeiras, 165 carros e 11 postes.
- **O que o Blender fez:**
  - **chanfros** de 7 cm nas quinas e na platibanda (feitos no próprio contorno, sem modificador, para não quebrar as faces);
  - **casca de dupla curvatura** do Garden Court, parametrizada ao longo do eixo da gota (espaçamento em cosseno, para fechar a ponta e a parte redonda), com UV de "uma célula da grelha de madeira por vão";
  - **bake de oclusão de ambiente** (Cycles CPU, 160 amostras, raio 1,3 m) em vertex color por canto. Antes do bake, as faces horizontais grandes (chão, lajes) são cortadas numa grade de 1,6 a 2 m para a AO ter onde morar. Depois do bake vêm uma média por vértice e degraus de 1/40: isso tira o ruído e comprime melhor no meshopt. Força de 0,38 nos prédios e 0,55 no chão;
  - UV só nos 4 materiais que recebem textura de canvas, o que deixa o arquivo menor.
- **`Iguatemi.tsx`:**
  - carrega as peças com `useLoader(GLTFLoader, "/blender/saida/iguatemi-shopping.glb")`;
  - clona a cena, liga as sombras (o chão não projeta) e põe as 4 texturas de canvas pelos nomes dos materiais;
  - instancia árvores, palmeiras, carros e postes a partir do JSON.
- **O `exportar` preserva tudo:** conferi no `saida/shopping-iguatemi.glb` final que 65 de 72 primitivas têm `COLOR_0` (as outras 7 são as instâncias do R3F), que as 4 texturas estão lá nos materiais certos e que nenhum nó ficou sem nome.
- **Para gerar de novo:**
  ```sh
  <python com bpy> marcos3d/blender/iguatemi.py          # ~45 s com o bake (--sem-bake para testar geometria)
  cd marcos3d && export CHROME=...
  npm run render   -- --ids iguatemi --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta 5362
  npm run exportar -- --ids iguatemi --porta 5362
  npm run checar   -- --ids iguatemi
  ```

## O que foi modelado nos 4 níveis

1. **Forma principal:**
   - contorno real do OSM (embasamento de 7,6 m);
   - espinha (13,5 m), bloco da lente (16,5 m), ala curva (19,4 m), rotunda em leque (15 m), bloco norte (11 m), bloco de vidro sudeste (21 m), cinema (26,2 m), edifício-garagem (4 níveis) e miolo sudeste (15–20 m);
   - a gota do Garden Court;
   - a proa triangular de vidro.
2. **Formas secundárias:**
   - platibandas chanfradas em todos os volumes;
   - friso na linha da laje do embasamento nos volumes altos;
   - anel metálico branco, clerestório de vidro contínuo e viga de borda em madeira no Garden Court;
   - degrau concêntrico no telhado da rotunda;
   - sheds paralelos à espinha no bloco norte;
   - plano de vidro inclinado com 9 aletas triangulares no bloco sudeste;
   - lajes e peitoris da garagem com o vão escuro;
   - entradas do OSM com vão de vidro e marquise.
3. **Detalhes:**
   - claraboia longa em duas águas com nervuras e cumeeira;
   - claraboia em lente;
   - pirâmide de vidro sobre pódio;
   - cúpula de vidro com meridianos sobre tambor octogonal;
   - claraboia em grelha e pente de sheds de vidro;
   - grelha de vigas brancas na cobertura da proa e montantes nas fachadas;
   - cone invertido de 12 tubos de aço com dois anéis, sob a marquise triangular;
   - condensadoras em fileiras e casas de máquinas (partes pequenas do OSM);
   - vagas pintadas, faixas tracejadas, canteiro central e postes;
   - casas vizinhas do OSM com telhado cerâmico ou laje.
4. **Microdetalhes:**
   - AO assada (contato das paredes com o chão, cantos de platibanda, pé das máquinas e das casas);
   - grelha de madeira desenhada no policarbonato, com brilho ao lado de cada arco;
   - gradiente e reflexo no vidro verde;
   - juntas de painel discretas nas fachadas;
   - tons variados por instância nas copas da mata e nas cores dos carros.

## Rodadas de render → crítica → correção

1. **Rodada 1** (sem bake):
   - a planta já lia como a vista aérea;
   - **problemas:**
     - caixinhas de máquina espalhadas por todo telhado (o defeito que o dono apontou);
     - fachadas lilás;
     - 61 mil triângulos (carros);
     - bordas do disco vazias;
     - cone pequeno;
   - **correções:**
     - máquinas em fileiras e quase só na laje técnica;
     - vizinhos reais do OSM ao sul e a oeste;
     - árvores de calçada;
     - praça do jardim com piso avermelhado e mais palmeiras;
     - friso;
     - cone e marquise maiores;
     - abóbada 25% mais alta.
2. **Rodada 2** (com bake):
   - **problemas:**
     - AO de raio 2,2 m manchava as bordas dos telhados;
     - 590 KB;
   - **correções:**
     - raio de 1,3 m e força menor;
     - carros de 24 triângulos e menos ocupação;
     - pilares, tracejados e máquinas enxugados;
     - grade de AO só em telhados grandes;
     - UV só onde há textura;
     - AO média por vértice e quantizada.
3. **Rodada 3:**
   - **problemas:**
     - fachadas ainda frias na luz hemisférica azul;
     - laje técnica clara virando "tapete";
   - **correções:**
     - fachada `#f8ead3`;
     - laje técnica `#aea697`, que fica mais recuada visualmente.
- **Pergunta de controle ("alguém de Fortaleza reconhece?"):** de cima e em perspectiva, sim. A gota de madeira, a proa verde para a praça das palmeiras, a rotunda em leque, a claraboia da espinha, o estacionamento colado à mata e a Washington Soares arborizada repetem a vista aérea real. De frente, ao nível da rua, a leitura depende de fachadas que não confirmei em foto (veja as dúvidas).

## Notas (item 25), antes → depois

| Critério | Antes (oficina) | Depois |
|---|---|---|
| Geometria | 7 | 8 |
| Topologia | 7 | 7 |
| Proporções | 6 | 9 (planta real do OSM) |
| Detalhamento | 7 | 9 |
| Materiais | 7 | 8 |
| Texturas | 6 | 8 |
| Shading | 7 | 9 (AO assada) |
| Realismo | 6 | 8 |
| Otimização | 8 | 6 (503 KB: passa no limite, fica acima da meta) |
| Apresentação | 7 | 9 |

## Números

| | Publicado | Oficina antes | Depois (`saida/shopping-iguatemi.glb`) |
|---|---|---|---|
| Tamanho (meshopt) | 150 KB | 113 KB | **503 KB** (limite de 600; meta de 300 não atingida) |
| Triângulos | 4.470 | 6.646 | **49.959** |
| Malhas | 34 | 33 | **72** |
| Materiais | 29 | 26 | **34** |
| Altura | 9,5 m | 9,6 m | **7,5 m** |

- **`checar`:** `OK iguatemi: 503 KB, 49959 triângulos, 72 malhas, 34 materiais, raio 34.0 m, altura 7.5 m` (o raio de 34 é o pedestal da oficina; o modelo para em 33,3 m).
- **Por que não chegou a 300 KB:** medi a contribuição de cada atributo depois do meshopt. Posições e índices dão ~250 KB, normais ~160, AO ~100 e UV ~30 (UV em metros fica fora de [0,1] e não é quantizada). Chegar a 300 exigiria tirar a AO ou cortar ~40% dos vértices (chão em grade, platibandas, vizinhos). Preferi manter.

## Checklist (item 27)

- [x] Proporção correta: planta do OSM; compressão só na borda.
- [x] Silhueta convincente.
- [x] Escala correta (contrato da oficina).
- [x] Geometria limpa: sem .blend, tudo gerado.
- [x] Normais corretas: orientação conferida por face nas peças inclinadas; os materiais finos são de dois lados.
- [x] Shading correto: liso nas curvas, quinas vivas acima de 32°.
- [x] Sem clipping indesejado: o bloco norte foi afastado 1,5 m da rotunda e o embasamento recuado 4 cm.
- [x] Sem geometria flutuando.
- [x] Sem faces duplicadas visíveis.
- [x] Bevels coerentes (7 cm).
- [x] Materiais coerentes (34 nomeados).
- [x] Texturas adequadas: 4 de canvas, até 128 px, sem fotos.
- [x] UV organizada: em metros, só onde há textura.
- [x] Nível de detalhe adequado.
- [~] Performance: 503 KB e ~50 mil triângulos, dentro do limite e acima da meta.
- [x] Arquivo organizado.
- [x] Nomenclatura organizada (PascalCase em português).
- [x] Exportação correta (`checar` OK).

## Altura nova da etiqueta

- O modelo tem **7,5 m** (o topo do cinema; a abóbada do Garden Court chega a ~6,9 m).
- **Sugestão: `altura: 8`** em `src/marcos/index.ts` e em `dashboard/historias.js` (hoje 9). Não editei nenhum dos dois.

## Dúvidas abertas

1. **Fachadas externas:** não há nenhuma foto do exterior no Commons nem na Wikipédia. Cor, acabamento e onde há vidro ao nível da rua ficaram neutros (branco quente com juntas de painel).
2. **Rotunda oeste:** uso e altura (15 m, inferida da sombra).
3. **Proa = entrada de 2015 ("vidro verde em estrutura metálica branca")?** É o candidato mais forte pela vista aérea, mas não tem confirmação em foto.
4. **Cone e marquise dos anos 1990:** pus no meio da face sudoeste do bloco de vidro sudeste, de frente para a via de serviço. A posição não está confirmada.
5. **Letreiro:** não modelei, porque o logotipo e a posição não foram verificados.
6. **Desenho real da grelha de madeira:** usei arcos transversais e terças longitudinais que convergem para a ponta, como as linhas da vista aérea.
7. **Fora da miniatura de propósito:** as torres residenciais vizinhas e o Iguatemi Empresarial (48 m), que tirariam a atenção do shopping.

## Problema da oficina para registrar

- O `exportar` usa `meshopt` nível "medium". Atributos de UV em metros (fora de [0,1]) não são quantizados, só avisam ("quantize: Skipping TEXCOORD_0"). Não é bug, mas custa ~30 KB aqui.
- Os renders `tsx-*` dependem do `blender/saida/iguatemi-shopping.glb`. Se o GLB for apagado, a prévia fica em branco.
