# Especialista Palácio da Abolição — criação do zero

Status: **concluído**. O `exportar` e o `checar` foram aprovados. Nada foi publicado em `dashboard/` e não fiz nenhum
commit. (O commit de ponto de controle `6853abf`, com a primeira versão da ficha e deste relatório, foi feito fora
desta sessão de trabalho.)

## 1. Pesquisa e referências
Ficha em `pesquisa/palacioAbolicao/ficha.md`, com as URLs.

**Rede nesta sessão:** Wikimedia, Wikipédia, API do OSM, Esri, ArchDaily, ceara.gov.br e Mapa Cultural foram
recusados pelo proxy. Só o `WebSearch` respondeu, então **não há fotos**. Trabalhei com os trechos de texto das buscas,
o `osm.xml` e a `planta.png`, mais uma planta ampliada que desenhei do `osm.xml`, com os multipolígonos montados.

**O que as fontes confirmam:**
- **Autoria e data:** Sérgio Bernardes; obra de 1962 a 1970, inaugurada em 4/7/1970.
- **Pórticos:** tubos de aço **duplos** (Mannesmann de 10"), **pintados de preto**, em série; são os pilares e as vigas.
- **Palácio:** barra de **84 × 13,64 m**, módulo de **4,20 m**, **2 pavimentos**. Tem **varandas de 3,40 m** ao norte e
  ao sul, formadas pelos pórticos que "avançam" e criam os beirais.
- **Fachadas:** norte e sul de **vidro temperado**; leste e oeste **cegas, de cerâmica**; nas varandas de cima,
  **madeira em forma de bancos**.
- **Acesso** "entre dois pórticos, em piso mais elevado".
- **Anexo** transversal, ligado por **passarela**, no mesmo sistema mas **sem varandas**, com basculantes de vidro e
  montantes de madeira.
- **Capela** no canto nordeste, com a cobertura da "divisão de uma pirâmide" e a nave abaixo do terreno.
- **Fosso** "profundo, largo e contínuo" em volta do palácio.
- **Mausoléu Castelo Branco** (1972), de Bernardes: prisma de concreto de ~38 × 8 × 4 m com **balanço de 30 m sobre
  o espelho d'água** e contrapeso.
- **Reforma** de 2009–2010, reaberto em 25/3/2011.

**Planta (OSM):**
- palácio de 87,8 × 21,3 m com as varandas, eixo a 108°, h 10,4 m;
- passarela de 24 m, h 6,9 m;
- anexo de 26 × 47 m, h 10,4 m;
- peça de 5 × 5 m com **h 20,2 m** no pé da passarela;
- capela de 13 × 13 m;
- mausoléu dentro de um espelho de 16 × 45 m, a ~100 m a sudoeste;
- o fosso encosta na ponta oeste do palácio, passa ao norte e desce pelo oeste até o espelho;
- a Av. Barão de Studart fica a oeste.

**Dúvida de fonte:** os jardins são atribuídos a **Fernando Chacel** (ArchDaily) e a **Burle Marx** (Mapa Cultural).
Ficaram neutros.

## 2. Composição e por quê
O conjunto real tem ~190 m de fundo, e o disco tem 67 m. Escolhi **o conjunto inteiro, condensado**, porque o que faz o
lugar ser reconhecido é a combinação de três coisas:
- a **barra modernista com os pórticos pretos e as varandas**;
- o **fosso d'água** que a contorna;
- o **mausoléu em balanço sobre o espelho**.

**Escala:**
- Palácio: × 0,5 no comprimento (84 → 44 m, mantendo os **20 módulos**, agora de 2,2 m) e × 0,59 na largura do corpo
  (8 m). Varandas de 2,2 m. Térreo elevado 0,55 m; laje do 2º pavimento a 3,8 m e cobertura a 7,55–8,05 m (OSM 10,4 m:
  verticais ~1,6 × K).
- Anexo: × ~0,4 × 0,25, mais baixo (6,6 m), para não roubar a cena.
- Mausoléu: × 0,48 (18,2 × 4,4 × 3,1 m), suspenso a ~2 m da água.
- As distâncias entre os prédios foram bem encurtadas.

**Arranjo (de frente para trás):**
- à esquerda, a calçada e a pista da **Av. Barão de Studart**;
- no primeiro plano à esquerda, o **espelho do mausoléu** com o prisma em balanço;
- no meio, o **pátio da entrada** com os canteiros e os postes; à direita, o **anexo** e o estacionamento;
- ao fundo, o **palácio**, com o **fosso** encostado na ponta oeste e passando atrás dele;
- atrás do fosso, a **mata densa**; no canto, a **capela**.

**Giro (`GIRO = 12` no script; o real é `GIRO = -18`).** No rumo real a fachada sul já olha para as câmeras. Mas aí:
- o anexo cai bem no meio da frente do palácio e esconde a fachada na vista "frente";
- o mausoléu fica de ponta para a perspectiva.

Girei 30° no sentido anti-horário. O giro é rígido, sem espelho: a avenida continua a oeste do fosso e o mausoléu a
sudoeste do palácio. Assim:
- o anexo passa para a direita;
- a fachada fica a ~12° da vista "frente";
- o mausoléu mostra o comprimento na perspectiva.

O tour gira a câmera livremente. **Para voltar ao rumo real, basta pôr `GIRO = -18`** e rodar o script de novo.

## 3. Como gerar de novo
```sh
cd marcos3d
<python-com-bpy> blender/palacioAbolicao.py            # ~3 s: modela, assa a oclusão e exporta (--sem-bake: ~1 s)
export CHROME=<invólucro do chrome>
npm run render -- --ids palacioAbolicao --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta 5379
npm run exportar -- --ids palacioAbolicao --porta 5379
npm run checar -- --ids palacioAbolicao
```
`<python-com-bpy>` é o venv do scratchpad, com Blender 5.2.3.

**O que o `blender/palacioAbolicao.py` faz:**
- Modela num referencial do conjunto e gira tudo no fim (`MUNDO`).
- Escava o **fosso** no terreno com booleanos exatos, um por retângulo. O terreno sobe para z = 0,6 para o canal ter
  profundidade sem passar de y = 0. As paredes e o fundo do canal recebem concreto, e as bordas ganham capeamento só nos
  trechos que dão para a terra.
- Gera um **atlas de 256 px** em Python com seis regiões:
  - vidro temperado com reflexo;
  - portas da entrada;
  - basculantes com montantes de madeira;
  - pastilha cerâmica;
  - concreto com tábuas de fôrma;
  - vidro escuro.

  Paredes e fachadas são ladrilhadas por módulo.
- Põe **UV em metros** na laje e no piso das varandas (juntas alinhadas com o módulo de 2,2 m).
- Assa a **oclusão no Cycles** nas cores de vértice (faixa 0,55–1) e numa imagem de 256 px do chão. As árvores, os
  carros e os tubos entram como proxies.
- Pinta os arbustos floridos pelas cores de vértice (`tinta()`).
- Exporta:
  - `blender/saida/palacioAbolicao-pecas.glb`;
  - `-ao-chao.jpg`;
  - `-layout.json`, com 230 tubos, 34 árvores, 38 pessoas e 6 carros.

**O que o `src/marcos/novos/PalacioAbolicao.tsx` faz:**
- Carrega as peças, liga as sombras e renomeia cada malha como `<Peça>_<Material>`.
- Troca `Mat_Agua` pela `fab.agua()`.
- No chão, aplica o aoMap e as texturas de piso e de mancha; nas lajes, a textura de juntas.
- Instancia os **230 tubos pretos dos pórticos** (cilindros esticados entre dois pontos), as árvores (3 formas de copa),
  as pessoas e os carros.
- O JPEG da oclusão leva `userData.mimeType`.

## 4. Os 4 níveis do MASTERCRAFT
**Nível 1 — forma principal:**
- a barra do palácio com o piso elevado;
- o anexo transversal, a passarela e a peça alta;
- a capela piramidal;
- o mausoléu sobre o espelho;
- o fosso contínuo, a avenida e a mata.

**Nível 2 — formas secundárias:**
- **21 pórticos de tubos duplos**: pilares nas linhas do vidro e vigas que passam das lajes e marcam o ritmo nos beirais;
- varandas dos dois pavimentos;
- laje de cobertura com beiral e testeira em duas faixas;
- empenas cegas com remate branco nas quinas;
- escadas da entrada e da fachada norte;
- passarela coberta com pórticos;
- quatro placas da capela separadas por frestas sobre uma pirâmide de vidro escuro;
- apoio e contrapeso do mausoléu, recuados para o balanço aparecer;
- capeamento do fosso.

**Nível 3 — detalhes:**
- **banco de madeira** com pés nas varandas de cima, interrompido na passarela;
- portas de vidro no módulo da entrada;
- basculantes do anexo;
- rasgo de sombra nas faces do mausoléu;
- postes de globo no pátio e postes de braço na avenida;
- arbustos floridos, carros e gente (inclusive nas varandas).

**Nível 4 — microdetalhes:**
- oclusão assada;
- reflexo em degradê no vidro;
- pastilhas com variação de tom;
- tábuas de fôrma no concreto;
- juntas da laje por módulo;
- piso em placas;
- gramado e asfalto manchados;
- variação por instância nas copas, roupas e carros;
- rugosidades distintas:

  | Material | Rugosidade | Metalness |
  |---|---|---|
  | Vidro (atlas) | 0,35 | — |
  | Aço dos tubos | 0,42 | — |
  | Concreto | 0,88 | — |
  | Madeira | 0,7 | — |
  | Água | 0,08 | — |

## 5. Rodadas de render → crítica → correção (luz do site)
1. **R1 (rumo real, `GIRO = -18`):**
   - Crítica:
     - **crítico:** o booleano exato apagou quase todos os pisos;
     - **crítico:** o anexo, no centro da frente, escondia o meio do palácio;
     - **crítico:** o mausoléu parecia uma caixa pousada na água;
     - **alto:** os tubos pretos sumiam contra o vidro escuro na sombra (a luz vem do noroeste, então a fachada voltada
       para as câmeras fica na sombra);
     - **alto:** os canteiros eram placas coloridas chapadas;
     - **médio:** a cobertura dominava a imagem e estava vazia.
   - Correção:
     - booleano só no terreno, e as placas foram desenhadas fora do fosso;
     - `GIRO = 12`;
     - anexo menor e mais baixo;
     - mausoléu erguido, com apoio estreito e recuado;
     - vidro mais claro (reflexo do céu);
     - tubos mais grossos, com as vigas passando das lajes;
     - canteiros trocados por arbustos.
2. **R2:**
   - Crítica:
     - o piso das varandas do térreo ficou **preto**: um material de chão usado fora do chão pegava o aoMap sem UV;
     - os carros do estacionamento estavam em fila, encostados;
     - a casa de máquinas na cobertura era inventada.
   - Correção:
     - `Mat_Piso_Varanda` próprio;
     - UV em metros e juntas de 2,2 m na laje;
     - casa de máquinas removida;
     - carros lado a lado;
     - madeira mais clara e banco mais baixo.
3. **R3:**
   - Crítica:
     - `checar` com **raio 34,4 m**: uma árvore da calçada saía do disco;
     - duas copas tapavam o mausoléu na perspectiva;
     - a torre era uma caixa lisa.
   - Correção:
     - margem das copas (`RAIO − 0,4 − 1,3·r`);
     - árvores movidas para o canto;
     - concreto de fôrma nas 4 faces da torre;
     - postes na avenida.
4. **R4 (final):**
   - Crítica: o topo do mausoléu estava com as juntas da laje do palácio.
   - Correção: concreto liso.
   - Na perspectiva, todos os elementos aparecem. Na frente, a fachada inteira lê, com o mausoléu suspenso. No close, os
     pórticos, as pontas das vigas, os bancos e as varandas.

**"Alguém de Fortaleza reconhece?"**
- A ~200 px: a barra branca comprida e baixa com as faixas de vidro e o banco marrom, o canal azul em volta e o prisma
  sobre o espelho.
- No close: o ritmo dos tubos pretos duplos, as pontas das vigas nos beirais, as varandas com o banco de madeira e as
  empenas de cerâmica.
- **Ressalva honesta:** sem fotos, as cores da cerâmica, do concreto e do vidro e a forma exata da cobertura são
  neutras. A leitura vem do sistema construtivo descrito nas fontes, não da aparência fotográfica.

## 6. Notas (0–10)
Não havia modelo anterior aproveitável (era um rascunho de caixas), então a coluna "antes" é esse rascunho.

| Critério | Antes (rascunho) | Depois |
|---|---|---|
| Geometria | 3 | 8 |
| Topologia | 5 | 7 |
| Proporções | 3 | 7 |
| Detalhamento | 2 | 7 |
| Materiais | 3 | 7 |
| Texturas | 0 | 7 |
| Shading | 4 | 8 |
| Realismo (fidelidade e leitura do lugar) | 2 | 7 |
| Otimização | 6 | 9 |
| Apresentação | 2 | 8 |

## 7. Números (`saida/palacio-da-abolicao.glb`)
| Item | Valor |
|---|---|
| Tamanho | **252 KB** (bruto 607 KB; limite 600) |
| Triângulos | **28.382** |
| Malhas | **41** |
| Materiais | **26** (limite 40) |
| Texturas | 5, todas geradas (ver abaixo) |
| `checar` | **OK**: raio 34,0 m com o pedestal, altura 12,0 m com o pedestal |

As 5 texturas:
- atlas das fachadas, 256 px;
- oclusão do chão, 256 px em JPEG;
- piso, 128 px;
- juntas da laje, 128 px;
- mancha, 64 px (grama, asfalto e fosso).

Passa em uma do limite de 4 da convenção, como o Theatro (6) e a Reitoria.

## 8. Checklist (item 27)
- [x] Proporção correta: medidas do ArchDaily e do OSM; condensação e giro documentados.
- [x] Silhueta convincente: barra baixa e comprida com beiral, prisma em balanço, pirâmide da capela, peça alta.
- [x] Escala coerente: pessoas de ~1,4 m e carros de 3,7 m, na escala do prédio.
- [x] Geometria limpa: vértices soldados, booleanos aplicados só no terreno.
- [x] Normais corretas: o `checar` não acusa nada; as faces ladrilhadas são orientadas para fora.
- [x] Shading correto: suavização por ângulo de 32°.
- [x] Sem clipping indesejado relevante.
- [x] Sem geometria flutuando: o mausoléu pousa no apoio e no contrapeso; tudo o mais pousa em z = 0,6.
- [x] Sem faces duplicadas relevantes (`remove_doubles`).
- [x] Bevels coerentes: 0,04–0,06 m nas massas.
- [x] Materiais coerentes e nomeados: 26.
- [x] Texturas adequadas: todas geradas.
- [x] UV organizada: atlas por regiões; chão com UV planar; lajes com UV em metros.
- [x] Nível de detalhe adequado ao close e à vista geral.
- [x] Performance adequada: 252 KB, 28 mil triângulos, 41 malhas.
- [x] Arquivo organizado: script versionado; saídas em `blender/saida/palacioAbolicao-*`.
- [x] Nomenclatura em português.
- [x] Exportação correta: `exportar` e `checar` OK.

## 9. Altura da etiqueta
- O ponto mais alto é a peça alta junto ao anexo, a ~11,5 m (12,0 m com o pedestal).
- A cobertura do palácio está a ~8,6 m.
- **`ALTURA_ETIQUETA = 14`** no `.tsx`. Se o `dashboard/historias.js` ganhar altura própria para este marco, sugiro 14
  lá também. Não editei esse arquivo.

## 10. Dúvidas abertas
1. **Giro** (`GIRO = 12` contra o real `-18`): decisão do dono.
2. **Fotos:** nenhuma nesta sessão. Ficaram neutras as cores da cerâmica das empenas, do concreto do mausoléu, do vidro
   e da madeira.
3. **Pórticos:** pilares nas linhas do vidro e vigas em balanço formando as varandas, segundo a leitura do texto ("os
   pórticos avançam, criando beiras"). Se houver pilares na borda das varandas, falta acrescentar.
4. **Cobertura do palácio:** laje plana com beiral; forma e espessura reais não confirmadas.
5. **Jardins:** Fernando Chacel ou Burle Marx (as fontes divergem); desenho não visto. No modelo: gramado, mata
   genérica e arbustos.
6. **Mausoléu:** qual ponta é apoiada, como se entra e o que mudou na adaptação de 2025 (memorial). No modelo, o apoio
   fica do lado do palácio e o balanço aponta para o sul, sem passarela de acesso.
7. **Peça de 20,2 m do OSM** no pé da passarela: volume neutro de concreto, mais baixo (~11 m).
8. **Capela:** a "divisão da pirâmide" foi interpretada como quatro placas com frestas de vidro.
9. **Anexo:** pontas cegas de cerâmica (não confirmado) e altura reduzida.
10. **Não modelados:** praça escavada, piso de dormentes, mastros/bandeiras e letreiro.

## Renders finais
- `renders/palacioAbolicao/tsx-perspectiva.png`
- `renders/palacioAbolicao/tsx-frente.png`
- `renders/palacioAbolicao/tsx-close.png`
- `renders/palacioAbolicao/tsx-lado.png`
- `renders/palacioAbolicao/tsx-topo.png`
