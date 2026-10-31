# Especialista Marco Zero — criação do zero

Status: **concluído**. O `exportar` e o `checar` foram aprovados. Nada foi publicado em `dashboard/`.

## 1. Pesquisa e referências
A ficha está em `pesquisa/marcoZero/ficha.md`, com as URLs.

**Rede nesta sessão:** Wikimedia, Wikipédia, API do OSM, Esri e o `WebFetch` foram recusados pelo proxy. Só o `WebSearch`
respondeu, então **não há fotos**. A planta vem do `osm.xml` guardado numa sessão anterior, mais uma planta ampliada
(raio de 75 m em volta do monumento) que desenhei dele.

**O que as fontes confirmam:**
- **Cruzeiro de granito de 12 m**, com mais de 10 t, presente do governo da Espanha para os 400 anos do Fortim de
  Santiago (1604–2004). Traz as imagens de **Cristo**, **Santiago**, **Nossa Senhora da Assunção** e **São José**. Foi
  abençoado pelo bispo de Santiago de Compostela (Diário do Nordeste; Fortaleza Nobre).
- A **Praça do Santiago** fica na foz do Rio Ceará, na orla da Vila do Mar (2012), que tem calçadão de pedra cariri,
  quadras, quiosques e passeio de barco no rio.
- **No OSM:**
  - canteiro de grama de 11,5 m;
  - três quiosques hexagonais e a torre de salvamento entre a praça e o rio;
  - enrocamento ao longo da margem;
  - duas quadras iluminadas;
  - barracas a nordeste, a areia e o mar;
  - o Mercado Vila do Mar, o estacionamento e a Rua José Roberto Sales (intertravado) ao sul.

## 2. Composição e por quê
O que faz o lugar ser reconhecido é **o cruzeiro alto de pedra numa praça aberta, onde o rio encontra o mar**.

**Rumo real** (norte em −z): a miniatura concorda com o contorno do bairro no tour, com o mar ao norte e o rio a oeste.

**Escala:**
- O cruzeiro e o canteiro ficam no tamanho real, e o cruzeiro ainda cresce 25% (`ESC = 1,25`, topo a 16,3 m). As
  espessuras também foram exageradas ~1,8 vez, para o fuste e a cruz lerem a 200 px.
- As distâncias do OSM foram comprimidas: ~0,3 além de 8 m do cruzeiro (o rio a 62 m vira 24,5 m; a rua a 58 m vira
  ~26 m).
- Os prédios encolhem menos (~0,6): quiosques de 4,8 m, quadra de 11 × 17 m, mercado de 7,6 × 4,6 m.

**Arranjo:**
- a oeste, o enrocamento e o estuário, com dois barcos; os três quiosques e a torre ficam na faixa de calçadão;
- ao norte, a ponta da praça, a areia com uma jangada e o mar;
- a nordeste, duas barracas;
- a leste, a quadra (só uma das duas; a outra cairia fora do disco);
- ao sul, o mercado, o estacionamento e a rua.

**Ajustes de leitura:**
- o mercado e o estacionamento foram deslocados um pouco para oeste (como no real), para não esconderem a base do
  cruzeiro na vista "frente";
- nenhum coqueiro nem poste fica em volta do canteiro ou atrás da cruz, para a silhueta do cruzeiro ficar limpa contra
  o céu e o mar.

## 3. Como gerar de novo
```sh
cd marcos3d
<python-com-bpy> blender/marcoZero.py            # ~4 s: modela, assa a oclusão e exporta (--sem-bake: ~2 s)
export CHROME=<invólucro do chrome>
npm run render -- --ids marcoZero --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta 5381
npm run exportar -- --ids marcoZero --porta 5381
npm run checar -- --ids marcoZero
```

**O que o `blender/marcoZero.py` faz:**
- Modela em metros, com o cruzeiro na origem. Os utilitários e a classe `Figura` foram copiados do `iracemaMartim.py`.
- **Cruzeiro**, no tipo do cruceiro galego:
  - três degraus;
  - pedestal com plinto, dado com molduras e cornija;
  - fuste octogonal com colarinho e astrágalo;
  - capitel alargado com ábaco;
  - cruz com pomos nas pontas, título INRI e apoio dos pés.
- **Imagens:**
  - o Cristo (`Figura`, braços abertos, cabeça pendida, perizônio) na face sul;
  - a Virgem de mãos postas e véu na face norte;
  - Santiago (chapéu de aba larga e bordão) e São José (Menino e vara florida) nas faces oeste e leste do capitel.
- **UV do granito:** projeção de caixa (`metros / 40 + 0,5`, dentro de [0, 1], para o meshopt quantizar).
- **Chão:** praça, faixa dos quiosques, canteiro com meio-fio de granito e caminho, quadra com as linhas, estacionamento
  com vagas, rua com tracejado, areia seca e molhada, rio e mar, e a espuma.
- **Enrocamento:** ~300 blocos facetados em três tons (cores de vértice), com a base achatada em y = 0.
- Quiosques hexagonais, torre de salvamento, barracas, mercado, postes, bancos, traves e refletores.
- Assa a **oclusão no Cycles** nas cores de vértice (faixa 0,58–1) e numa imagem de 256 px do chão; coqueiros e carros
  entram como proxies.
- Exporta:
  - `blender/saida/marcoZero-pecas.glb`;
  - `-ao-chao.jpg`;
  - `-layout.json`, com 8 coqueiros, 57 pessoas e 6 carros.

**O que o `src/marcos/novos/MarcoZero.tsx` faz:**
- carrega as peças, liga as sombras e renomeia as malhas como `<Peça>_<Material>`;
- troca a água por `fab.agua()`;
- põe no chão o aoMap e os pisos em canvas (praça em placas, calçadão, intertravado desencontrado, manchas na
  grama, na areia e na quadra);
- aplica o grão do granito no cruzeiro;
- instancia os coqueiros, a gente e os carros.

## 4. Os 4 níveis do MASTERCRAFT
1. **Forma:** o cruzeiro sobre o canteiro circular, a praça aberta, a margem do rio, a areia e o mar, a quadra, a rua.
2. **Formas secundárias:**
   - degraus, pedestal, fuste, capitel e braços da cruz com pomos;
   - meio-fio do canteiro;
   - enrocamento;
   - quiosques com telhado piramidal, torre sobre pernas, barracas de duas águas com varanda, mercado com beiral.
3. **Detalhes:**
   - as quatro imagens, o título INRI e as molduras do pedestal;
   - balcões dos quiosques, escada e janelas da torre;
   - traves, linhas e refletores da quadra;
   - vagas, tracejado, barcos, jangada, bancos e postes;
   - gente olhando o cruzeiro, jogando na quadra e na areia.
4. **Microdetalhes:**
   - oclusão assada;
   - grão do granito;
   - placas do piso, intertravado e manchas;
   - três tons de pedra no enrocamento;
   - variação nas cores das roupas e dos carros;
   - rugosidades distintas: granito 0,72, água 0,08, metal 0,45–0,55, parede 0,85.

## 5. Rodadas de render → crítica → correção (luz do site)
1. **R1:**
   - Crítica:
     - **crítico:** o cruzeiro (12,6 m) ficou fino e baixo, sem mandar na cena;
     - **alto:** o canteiro saiu cinza (o disco do meio-fio cobria a grama);
     - **médio:** coqueiros e 4 postes em volta do canteiro competiam com a cruz, e dois coqueiros tapavam a câmera do
       close.
   - Correção:
     - `ESC = 1,25` e fuste mais grosso;
     - grama por cima do meio-fio;
     - fora os postes do canteiro e os coqueiros do centro.
2. **R2:**
   - Crítica:
     - na "frente", o mercado ficava no eixo e escondia a base;
     - no close, um coqueiro da areia ficava bem atrás dos braços da cruz.
   - Correção: mercado e estacionamento para oeste; coqueiro para a ponta noroeste.
3. **R3:**
   - Crítica: o `checar` reprovou por pedras do enrocamento abaixo de y = 0 (−0,16 m), e o meshopt pulava o UV do
     granito (fora de [0, 1]).
   - Correção:
     - pedras achatadas em y = 0;
     - UV do granito em `metros / 40 + 0,5` com a textura repetida 25 vezes (532 → 482 KB).

**"Alguém de Fortaleza reconhece?"**
- A ~200 px: a cruz de pedra alta e isolada no canteiro verde, numa praça aberta entre o rio e o mar.
- No close: o Cristo na cruz, o pedestal em degraus, os quiosques hexagonais e a torre de salvamento.
- **Ressalva honesta:** sem fotos, o desenho do cruzeiro segue o tipo galego, e as cores são neutras.

## 6. Notas (0–10)
O modelo anterior era um rascunho de caixas.

| Critério | Antes (rascunho) | Depois |
|---|---|---|
| Geometria | 3 | 8 |
| Topologia | 5 | 7 |
| Proporções | 3 | 7 |
| Detalhamento | 2 | 8 |
| Materiais | 2 | 7 |
| Texturas | 0 | 7 |
| Shading | 4 | 8 |
| Realismo (fidelidade e leitura do lugar) | 2 | 7 |
| Otimização | 7 | 8 |
| Apresentação | 2 | 8 |

## 7. Números (`saida/marco-zero-barra-do-ceara.glb`)
| Item | Valor |
|---|---|
| Tamanho | **482 KB** (bruto 1.355 KB; limite 600) |
| Triângulos | **27.416** |
| Malhas | **57** |
| Materiais | **32** (limite 40) |
| Texturas | 6, todas geradas (oclusão do chão, piso da praça, calçadão, intertravado, mancha, granito) |
| `checar` | **OK**: raio 34,0 m com o pedestal, altura 16,7 m |

## 8. Checklist (item 27)
- [x] Proporção correta: medidas do OSM; compressão e o exagero do cruzeiro documentados.
- [x] Silhueta convincente: a cruz isolada contra o céu e o mar.
- [x] Escala coerente: pessoas de 1,6 m, carros de 3,7 m, traves de 2,4 m.
- [x] Geometria limpa: vértices soldados (`remove_doubles`).
- [x] Normais corretas: o `checar` não acusa nada.
- [x] Shading correto: 32° nas massas, 62° nas imagens, 20° nas pedras (facetadas).
- [x] Sem clipping relevante.
- [x] Sem geometria flutuando: tudo pousa em y = Z0, e a base do modelo fica em y = 0.
- [x] Sem faces duplicadas relevantes.
- [x] Bevels coerentes: 0,03–0,07 m.
- [x] Materiais coerentes e nomeados: 32.
- [x] Texturas adequadas: todas geradas, nenhuma foto.
- [x] UV organizada: planar no chão; caixa no granito, dentro de [0, 1].
- [x] Nível de detalhe adequado.
- [x] Performance adequada: 482 KB, 27 mil triângulos, 57 malhas.
- [x] Arquivo organizado: script versionado; saídas em `blender/saida/marcoZero-*`.
- [x] Nomenclatura em português.
- [x] Exportação correta.

## 9. Altura da etiqueta
O pomo do alto da cruz fica a ~16,3 m (16,7 m com o pedestal). **`ALTURA_ETIQUETA = 18`** no `.tsx`, e 18 também em
`dashboard/historias.js` quando o marco for publicado.

## 10. Dúvidas abertas
1. **Desenho do cruzeiro:** degraus, pedestal, fuste, capitel e braços seguem o tipo do cruceiro galego (interpretação).
   Falta confirmar onde ficam as quatro imagens; aqui são Cristo e Virgem na cruz, e Santiago e São José no capitel.
2. **Cores:** o granito (cinza-claro), o piso da praça e as cores dos quiosques, barracas, torre e mercado são neutros.
3. **Canteiro:** o caminho de piso até os degraus e os quatro bancos de granito são suposições plausíveis, não vistas.
4. **Para que lado o Cristo olha:** aqui, para o sul (a praça).
5. **Fora do disco:** a segunda quadra e a ponte sobre o Rio Ceará.

## Renders finais
- `renders/marcoZero/tsx-perspectiva.png`
- `renders/marcoZero/tsx-frente.png`
- `renders/marcoZero/tsx-close.png`
- `renders/marcoZero/tsx-lado.png`
- `renders/marcoZero/tsx-topo.png`
