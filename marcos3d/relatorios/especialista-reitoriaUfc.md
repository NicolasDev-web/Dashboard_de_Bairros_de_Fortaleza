# Especialista Reitoria da UFC — refação do zero

Status: **concluído**. O `exportar` e o `checar` foram aprovados. Nada foi publicado em `dashboard/` e não fiz nenhum
commit. Um commit de ponto de controle (`334e5da`) foi feito por outra sessão no meio do trabalho.

## 1. Pesquisa e referências
A ficha está em `pesquisa/reitoriaUfc/ficha.md`, com a seção nova "Rodada do especialista".

**Rede nesta sessão:**
- Wikimedia, Wikipédia, OSM e Esri devolveram 403 do proxy.
- O `WebFetch` não resolveu `www.ufc.br`.
- Só o `WebSearch` respondeu.

Trabalhei com:
- a ficha da rodada anterior (fotos "Reitoria da UFC 02/03/05" do Commons, olhadas naquela sessão);
- a seção da Reitoria em `relatorios/criador-2.md` (OSM way/371206594 e as partes 1161342376/7/9);
- a planta já convertida no `.tsx` antigo.

**O que o `WebSearch` confirmou** (as URLs estão na ficha):
- o palacete da família Gentil é de 1918 e foi comprado pela UFC em 1956 (imobiliária Frota Gentil);
- a Reitoria continua lá, na Av. da Universidade, 2853, no quarteirão que vai até a Av. Treze de Maio;
- o Salão Dourado foi restaurado em 2023, com pinturas de flor-de-lis do ecletismo (daí a flor-de-lis no frontão);
- a Concha Acústica faz parte do conjunto ("pavilhão auricular" e arquibancada nas obras de 2023);
- os anexos modernistas (Liberal de Castro e Neudson Braga, 1967) estão em estudo de tombamento e ficaram fora do
  recorte.

Nenhum texto descreve a cor nem o torreão. Isso vem só das fotos da rodada anterior.

**Planta (OSM, pela ficha):**
- H de 77 × 44 m, com alas de 17,6 m;
- pátio da frente de 42,7 × 13,5 m, aberto para a avenida;
- corpo central de 17,7 m e pátio de trás de 12,8 m;
- varandas de ~3 m em volta dos pátios e no lado externo da ala nordeste;
- o palacete original é a ponta da ala nordeste, com o torreão no canto norte.

## 2. Diagnóstico da versão anterior e composição nova
**Diagnóstico da versão anterior:**
- **Crítico:** rumo real (pátio para 311°). As câmeras vêm do sul, então o palacete com o torreão ficava ao fundo e
  pequeno, atrás da fachada lateral comprida e lisa da ala sudoeste.
- **Alto:**
  - sem oclusão assada;
  - lajes cinza chapadas dominando a vista de cima;
  - árvores todas iguais (um icosaedro com tronco);
  - sem avenida, gente nem carros.
- **Médio:**
  - balaustradas em textura com alphaTest;
  - torreão e pórtico pequenos demais para ler.

**Recorte:** a Reitoria inteira com o seu entorno imediato:
1. o H completo, com o palacete e o torreão (protagonistas), o pátio da frente e as varandas;
2. o jardim da frente, a via interna e o gradil;
3. a **Av. da Universidade** com 4 faixas e carros;
4. atrás, o pátio de trás e a **Concha Acústica** entre mangueiras grandes, que é o campus.

**Decisão: girar a composição (`GIRO = 62°` no script).** Este é o único desvio do contrato e está documentado no
código.
- Com o pátio da frente olhando para as câmeras (R1, GIRO −8°), o `close` cortava o palacete. O close enquadra só
  ±18 m em volta do centro, e o H tem 51 m de largura. O primeiro plano virava a ponta lisa da ala sudoeste.
- Calculei o giro que traz o torreão para dentro do close (deslocamento lateral de r·cos(θ − 24°) < ~15 m). Com 62°:
  - o **lado nordeste** (a varanda externa com a colunata e o torreão) fica de frente para a `perspectiva` e a `frente`;
  - o `close` pega em três quartos o **pórtico, o frontão e o torreão** em primeiro plano, com o pátio, as bandeiras e
    a avenida atrás;
  - a vista `lado` (do leste) é a vista "da avenida", com o H inteiro, o gradil e os carros.

  É o ângulo da foto 05 da ficha, tirada a nordeste do prédio.
- O giro é rígido, sem espelho: quem olha o pátio da avenida continua vendo o palacete à esquerda.
- **Para voltar ao rumo real** (norte em −z), basta pôr `GIRO = -131` e rodar o script de novo.

**Escala** (referencial do prédio):
- largura × 0,66 (alas × 0,72, para o palacete ganhar fachada);
- fundo × 0,55 (pátio da frente × 0,63);
- alturas × 0,85:
  - embasamento 0,55 m, térreo 4,0 m, cornija 7,5 m, platibanda 8,5 m;
  - torreão 13,4 m no mirante e 14,2 m nos pináculos;
  - o torreão ganhou ~0,5 m extra na R4, para vencer as palmeiras na silhueta.
- Pessoas com ~1,4 m e carros com 3,7 m, como no Theatro.

## 3. Como gerar de novo
```sh
cd marcos3d
<python-com-bpy> blender/reitoriaUfc.py            # ~5 s: modela, assa a oclusão e exporta (--sem-bake: ~2 s, sem o JPEG)
export CHROME=<invólucro do chrome>
npm run render -- --ids reitoriaUfc --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta 5375
npm run exportar -- --ids reitoriaUfc --porta 5375
npm run checar -- --ids reitoriaUfc
```
`<python-com-bpy>` é o venv do scratchpad, com Blender 5.2.3.

**O que o `blender/reitoriaUfc.py` faz** (herda os utilitários do Theatro):
- Modela num referencial do prédio e gira tudo no fim (`MUNDO`).
- Usa `bmesh`:
  - prismas chanfrados e octógonos (torreão);
  - cintas de cornija com projeção por lado (os volumes do H se encostam sem sobrepor);
  - tornos (pináculos);
  - placas extrudadas (frontão curvo, flor-de-lis, arco da loggia);
  - casca dupla da Concha;
  - telhados de quatro águas cortados em faixas de telha.
- Gera um **atlas de esquadrias de 256 px**:
  - porta alta de venezianas de madeira clara com bandeira de vidro;
  - janela com peitoril;
  - janela em arco com leque de vidro (torreão);
  - porta principal almofadada com leque;
  - arcada em sombra;
  - telha de barro em canal;
  - janela pequena.

  Cada vão ganha peitoril e cimalha brancos em relevo.
- Registra no layout as posições do que o `.tsx` instancia: colunas, balaústres, barras do gradil, árvores,
  carnaúbas, pessoas e carros.
- Projeta UV em metros no reboco, nas pedras e na arquibancada, para a mancha sutil do `.tsx`.
- Assa a **oclusão no Cycles**:
  - nas cores de vértice das peças (0,55–1);
  - numa imagem de 256 px do chão.

  Copas, carnaúbas, carros e colunas entram como volumes provisórios.
- Exporta `blender/saida/reitoriaUfc-pecas.glb`, `-ao-chao.jpg` e `-layout.json`.

**O que o `src/marcos/novos/ReitoriaUfc.tsx` faz:**
- Carrega as peças, liga as sombras e renomeia as primitivas como `<Peça>_<Material>`.
- Põe a cor das telhas (o exportador do Blender não leva a cor-base de material com textura).
- Desenha as **bandeiras em canvas**: Brasil, Ceará e UFC.
- No chão: aoMap, piso, pedra, asfalto e gramado.
- Põe a mancha sutil no reboco.
- Instancia:
  - **colunas jônicas**: fuste torneado esticado e capitel de tamanho fixo com volutas;
  - **482 balaústres torneados**;
  - barras do gradil;
  - **mangueiras** (tronco grosso, dois galhos, copa larga em 5 massas verde-escuras) e **oitis** (copa redonda em 3
    massas, verde mais claro);
  - **carnaúbas** (estipe fino com a base escura e copa redonda de leques pregueados verde-acinzentados);
  - gente e carros.
- O JPEG da oclusão leva `userData.mimeType`.

## 4. O que foi modelado nos 4 níveis do MASTERCRAFT
**Nível 1 — forma principal:**
- H com alas, corpo central e os dois pátios;
- embasamento;
- torreão octogonal em dois estágios;
- pórtico avançado do palacete;
- telhados de quatro águas;
- Concha Acústica e arquibancada;
- avenida, via interna e gradil.

**Nível 2 — formas secundárias:**
- varandas de colunas nos dois pátios e no lado externo da ala nordeste, com a laje que vira sacada;
- cornija branca, friso entre pavimentos, rodapé, platibanda com remate e pilastras;
- Pórtico do palacete:
  - dois pares de colunas no térreo;
  - sacada com balaustrada;
  - loggia de 4 colunas com o arco no vão do meio;
  - entablamento e cornija salientes.
- Frontão (ático) com cimalha, coroamento curvo e volutas.
- Torreão:
  - cornijas;
  - balaustrada na cornija geral;
  - estágio de cima mais estreito;
  - mirante com balaustrada.
- Balaustradas no alto do palacete no lugar da platibanda.
- Sacada sobre mísulas na ponta da ala sudoeste.
- Canteiros com bordadura de sebe, gradil com pilares e portões.

**Nível 3 — detalhes:**
- ~150 vãos com venezianas, bandeiras de vidro, peitoris e cimalhas;
- porta principal almofadada com leque;
- arcada do pé do torreão;
- janelas em arco do torreão;
- **flor-de-lis**, cartela oval e pináculos no frontão;
- pinhas nos cantos do mirante e dos portões;
- 62 colunas jônicas e 482 balaústres torneados;
- mastros com as bandeiras do Brasil, do Ceará e da UFC;
- postes de globo e de braço;
- faixas, faixa dupla amarela e faixa de pedestres;
- bancos e topiarias;
- gente e carros.

**Nível 4 — microdetalhes:**
- oclusão assada nos vértices e no chão;
- mancha sutil no reboco e nas pedras;
- canais e fiadas da telha;
- juntas dos pisos;
- gramado e asfalto manchados;
- variação por instância nas copas (5 tons de mangueira, 3 de oiti), nos leques, carros e roupas;
- rugosidades distintas:

  | Material | Rugosidade | Metalness |
  |---|---|---|
  | Reboco | 0,88 | — |
  | Estuque | 0,62 | — |
  | Pedra | 0,9 | — |
  | Telha | 0,82 | — |
  | Metal | 0,45 | 0,4 |
  | Mastros | 0,35 | 0,4 |

## 5. Rodadas de render → crítica → correção (luz do site)
1. **R1** (GIRO −8°):
   - A perspectiva e a frente já liam o H, o pátio, as carnaúbas, o gradil e a avenida.
   - **Crítico:** no close, o palacete e o torreão saíam cortados.
   - Também:
     - duas casas do outro lado da avenida pareciam caixotes e tapavam a `frente`;
     - carnaúbas demais diante da fachada;
     - telhado saturado;
     - gramado em quadrados.
2. **R2** (GIRO +62°, conta da seção 2):
   - O close passou a mostrar torreão, pórtico, frontão, pátio, bandeiras e avenida.
   - Tirei as casas e reduzi as carnaúbas.
   - Crítica: no export, 482 KB, mas 133 mil triângulos (com instâncias) e 7.804 degenerados (polos dos tornos).
   - Crítica: as árvores diante do lado nordeste escondiam a colunata.
3. **R3:**
   - Tornos sem polo e balaústre de 5 lados, com passo de 0,34 m → 69 mil triângulos e 0 degenerados.
   - As copas passavam da borda (34,3 m com o pedestal): árvores reposicionadas, com o raio limitado pela distância à
     borda → 34,0 m.
   - **Flor-de-lis redesenhada**: as pétalas laterais saíam como chifres. Conferida num close do Blender
     (`scratchpad/inspecionar.py`).
   - Os discos de flores "de brinquedo" viraram topiarias.
4. **R4:**
   - Crítica: na `frente`, as carnaúbas (até 12 m) disputavam a silhueta com o torreão.
   - Correção:
     - torreão +0,45 m, com janelas em arco mais altas;
     - carnaúbas de 8,2 a 9,4 m, com a copa redonda em 5 andares de leques;
     - arbustos, bancos e gente no gramado do lado nordeste.
5. **R5 (final):**
   - Tirei as carnaúbas do pátio de trás: uma aparecia "em cima" do torreão na `frente`. Viraram topiarias.
   - Mancha sutil no reboco e nas pedras (+38 KB).
   - A mancha na casca da Concha deixava o concreto com cara de sujo e foi retirada.

**"Alguém de Fortaleza reconhece?"**
- A ~200 px: o prédio rosa-salmão e branco em H com o torreão de mirante na quina, os telhados de barro, o pátio com
  as palmeiras e as bandeiras, e a Concha branca atrás.
- No close: o pórtico de colunas pareadas com a sacada, a loggia com o arco, o frontão com a flor-de-lis, o torreão com
  as balaustradas e as varandas de colunas.

## 6. Notas (0–10)
| Critério | Antes (versão anterior) | Depois |
|---|---|---|
| Geometria | 6 | 8 |
| Topologia | 7 | 8 |
| Proporções | 6 | 8 |
| Detalhamento | 5 | 8 |
| Materiais | 5 | 8 |
| Texturas | 5 | 7 |
| Shading | 5 | 8 |
| Realismo (fidelidade e leitura do lugar) | 3 | 8 |
| Otimização | 9 | 8 |
| Apresentação | 3 | 8 |

## 7. Números (`saida/reitoria-ufc.glb`)
| Item | Valor |
|---|---|
| Tamanho | **516 KB** (bruto 1.513 KB; limite 600) |
| Triângulos | **69.298** com as instâncias (peças do Blender: ~17 mil) |
| Malhas | **45** |
| Materiais | **30** (limite 40) |
| `checar` | **OK**: raio 34,0 m e altura 14,7 m, ambos com o pedestal; sem avisos |

**Texturas** (todas geradas):
- atlas de esquadrias, 256 px;
- bandeiras, 256 × 64;
- oclusão do chão, 256 px em JPEG;
- piso, 128 px (duas variações);
- mancha, 64 px (três usos: gramado, asfalto e reboco/pedra).

Os triângulos passam um pouco dos ~60 mil da convenção. Quase metade são os 482 balaústres torneados (24 mil), que são
o detalhe pedido ("varandas e balaústres") e custam pouco em KB por serem instâncias.

## 8. Checklist (item 27)
- [x] Proporção correta: planta e medidas do OSM, com compressão e giro documentados.
- [x] Silhueta convincente: torreão com mirante, frontão com flor-de-lis, telhados, Concha.
- [x] Escala coerente: pessoas de ~1,4 m e carros de 3,7 m, como no Theatro.
- [x] Geometria limpa: vértices soldados, tornos sem polo, polo único na casca da Concha.
- [x] Normais corretas: o `checar` não acusa normais inválidas.
- [x] Shading correto: suavização por ângulo de 32°; colunas e balaústres lisos.
- [x] Sem clipping indesejado relevante: as lajes das varandas se encontram sem sobrepor; as cornijas do corpo
  central não entram nas alas.
- [x] Sem geometria flutuando: tudo pousa em z = 0,10; a sacada da ala sudoeste está sobre mísulas.
- [x] Sem faces duplicadas: `remove_doubles`; 0 degenerados.
- [x] Bevels coerentes: 0,03 m nas massas; peças finas sem chanfro.
- [x] Materiais coerentes e nomeados: 30.
- [x] Texturas adequadas: todas geradas, sem foto.
- [x] UV organizada: atlas por regiões; UV em metros no reboco; chão com UV planar.
- [x] Nível de detalhe adequado ao close e à vista geral.
- [x] Performance adequada: 516 KB, 45 malhas.
- [x] Arquivo organizado: script versionado; saídas em `blender/saida/reitoriaUfc-*`.
- [x] Nomenclatura em português.
- [x] Exportação correta: `exportar` e `checar` OK.

## 9. Altura da etiqueta
- O ponto mais alto são os pináculos do mirante do torreão, a ~14,2 m (14,7 m com o pedestal).
- O mirante chega a ~13,4 m, as carnaúbas a ~10,5 m e a platibanda a 8,5 m.
- **`ALTURA_ETIQUETA = 16`** no `.tsx`. Se o `dashboard/historias.js` ganhar altura própria para este marco, sugiro 16
  lá também. Não editei esse arquivo.

## 10. Dúvidas abertas
1. **Giro da composição** (`GIRO = 62` contra o rumo real `-131`). É decisão do dono. No rumo real, as vistas da
   aprovação pegam os fundos e a ala sudoeste.
2. **Pórtico do palacete:** ficou na face da frente, para a avenida, como na versão anterior. A foto 05, tirada a
   nordeste, mostra as duas faces, e não dá para descartar que ele fique no lado nordeste.
3. **Frontão** (volutas, flor-de-lis, cartela oval) e **pináculos:** o desenho é interpretação. A flor-de-lis vem das
   pinturas do Salão Dourado.
4. **Telhados de barro em quatro águas:** não aparecem nas fotos, ficam atrás das platibandas.
5. **Cor:** o rosa-salmão `#f2a283` está um tom mais laranja que a ficha (`#e8ac98`), para não virar lilás na sombra
   azulada da luz do site. As venezianas em madeira clara também vêm só das fotos.
6. **Concha Acústica:** forma, tamanho, posição e orientação são interpretação.
7. **Gradil, portões e via interna** diante do prédio: desenho e cores a confirmar.
8. **Bandeira da UFC:** desenho simplificado (branca com escudo azul).
9. **Av. da Universidade:** 4 faixas com faixa dupla amarela; o número de faixas não foi confirmado.
10. **Fachada externa da ala sudoeste e as pontas dos fundos:** neutras, com janelas e pilastras.

## Renders finais
- `renders/reitoriaUfc/tsx-perspectiva.png`
- `renders/reitoriaUfc/tsx-close.png`
- `renders/reitoriaUfc/tsx-frente.png`
- `renders/reitoriaUfc/tsx-lado.png`
- `renders/reitoriaUfc/tsx-topo.png`
