# Especialista Theatro José de Alencar — refação do zero

Status: **concluído**. O `exportar` e o `checar` foram aprovados. Nada foi publicado em `dashboard/` e não fiz nenhum
commit.

## 1. Pesquisa e referências
A ficha está em `pesquisa/theatroJoseDeAlencar/ficha.md` (planta do OSM, medidas da foto frontal, cores, dúvidas).

**Rede nesta sessão:**
- Wikimedia, Wikipédia, OSM e Esri devolveram 403 do proxy.
- O `WebFetch` não resolveu o DNS dos jornais.
- Só o `WebSearch` respondeu, então não há fotos novas. Trabalhei com a ficha, o `osm.xml` e a `planta.png`.

**O que o `WebSearch` confirmou** (as URLs estão na ficha):
- a fachada da sala é de ferro fundido art nouveau com vitrais coloridos, voltada para o pátio central;
- os elementos art nouveau são verdes, vermelhos e azuis e "se destacam à noite";
- o monumento a José de Alencar fica na praça: bronze sentado com livro, sobre base de granito branco, de 1929;
- os vitrais da fachada principal são citados nos planos de manutenção.

**Planta:** OSM `building:part`, com o eixo a 18°:
- bloco da fachada com 25,5 m de frente e h 14,1/6,6 m;
- galerias do pátio com h 8,1 m;
- sala com 38,6 × 25,7 m e h 12,4 m;
- caixa cênica com h 17,5 m e fundo do palco com h 12,8 m;
- o jardim de Burle Marx a leste;
- a Rua Liberato Barroso (paralelepípedo) a ~17 m da fachada, com a praça logo depois.

## 2. Diagnóstico da versão anterior e composição nova
**Diagnóstico da versão anterior:**
- **Crítico:** o prédio estava no rumo real, com a fachada para o norte. Todas as vistas da oficina olham do sul
  (perspectiva −32°, frente 0°, close +24°), então o dono só via os **fundos**: a sala cinza com janelas em arco, o
  jardim e o gradil. A fachada, as estátuas e o pátio de ferro ficavam do outro lado.
- **Crítico:** as cores eram cinza-esverdeadas e ficavam cinza na sombra.
- **Alto:** não havia vitrais legíveis nem uma praça de verdade.

**Decisão: girar a composição (`GIRO = -6°` no script).** Este é o único desvio do contrato e está documentado no código:
- A fachada olha para as câmeras. A perspectiva pega a fachada e o jardim (à esquerda); o close pega a fachada e o
  flanco direito.
- O giro é rígido, sem espelho. Quem está na praça olhando para a fachada continua vendo o jardim à esquerda, como na
  realidade.
- No tour o ângulo da câmera já é arbitrário: a vista geral gira sozinha (`autoRotate`) e o usuário arrasta. Só as
  imagens da aprovação são fixas, vindas do sul.
- **Para voltar ao rumo real** (norte em −z, fachada a 18°), basta pôr `GIRO = 162` e rodar o script de novo. Aí as
  vistas da oficina voltam a mostrar os fundos.

**Composição** (de frente para trás):
1. Praça José de Alencar: monumento, círculos entrelaçados no piso, covas de oitis, bancos, postes, gente.
2. Rua Liberato Barroso em paralelepípedo, com carros e faixa de pedestres.
3. Calçada da entrada com balizadores pretos e brancos.
4. **Fachada eclética** (protagonista 1).
5. **Pátio com a fachada de ferro e os vitrais** (protagonista 2).
6. Sala e **caixa cênica** alta.

Do lado esquerdo fica o **jardim de Burle Marx**. Do direito, o lote vizinho com o volume neutro do IPHAN.

**Escala:**
- largura × 0,86; bloco da fachada × 0,85; pátio × 0,73;
- sala e palco comprimidos (~0,5), para caber a praça e o jardim;
- alturas × 0,8: térreo 5,3 m, cornija 10,2 m, sala 9,9 m, caixa cênica 14 m;
- pessoas com ~1,4 m e carros com 3,7 m, na escala do prédio.

## 3. Como gerar de novo
```sh
cd marcos3d
<python-com-bpy> blender/theatroJoseDeAlencar.py            # ~5 s: modela, assa a oclusão e exporta (--sem-bake: ~2 s)
export CHROME=<invólucro do chrome>
npm run render -- --ids theatroJoseDeAlencar --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta 5373
npm run exportar -- --ids theatroJoseDeAlencar --porta 5373
npm run checar -- --ids theatroJoseDeAlencar
```
`<python-com-bpy>` é o venv do scratchpad, com Blender 5.2.3.

**O que o `blender/theatroJoseDeAlencar.py` faz:**
- Modela num referencial do prédio e gira tudo no fim (`MUNDO`).
- Usa `bmesh`: prismas chanfrados, cintas de cornija, tornos (colunas, capitéis, pinhas), placas extrudadas (frontões
  curvos, frontispício, leque) e águas de telhado cortadas em faixas de chapa com junta.
- Gera um **atlas de esquadrias de 256 px** em Python:
  - porta verde com bandeira de vitral em leque;
  - janela de venezianas, janela do pavimento superior e janela alta da sala;
  - porta com grade, arcada, balaustrada, chapa metálica e janela pequena.

  Os arcos do atlas saem redondos porque cada região leva em conta a proporção do quadro em que é usada.
- Assa a **oclusão no Cycles**:
  - nas cores de vértice das peças, na faixa 0,55–1;
  - numa imagem de 256 px do chão.
- Pinta os canteiros do jardim pelas cores de vértice (`tinta()`): 6 cores com 1 material.
- Exporta:
  - `blender/saida/theatroJoseDeAlencar-pecas.glb`;
  - `-ao-chao.jpg`;
  - `-layout.json`, com 25 árvores, 8 palmeiras, 25 pessoas, 7 carros e 360 barras de ferro.

**O que o `src/marcos/novos/TheatroJoseDeAlencar.tsx` faz:**
- Carrega as peças e liga as sombras.
- Renomeia cada primitiva como `<Peça>_<Material>`.
- Desenha os **vitrais em canvas** (512 × 256), em três regiões:
  - a elevação da fachada de ferro, com 5 vãos e 3 níveis: portas com bandeira em leque, vitrais em grade, janelas
    altas em arco, frisos dourados e volutas;
  - o leque do coroamento;
  - o brasão.

  O material dos vitrais tem um leve `emissive`, para continuar colorido na sombra do pátio, como à noite.
- Põe a cor das telhas de chapa e de barro: o exportador do Blender não leva a cor-base de material com textura.
- No chão, aplica o aoMap, o piso de placas e o paralelepípedo (o mesmo canvas, bem miúdo).
- Instancia árvores, palmeiras, pessoas, carros e as barras dos gradis e dos guarda-corpos.
- O JPEG da oclusão leva `userData.mimeType`.

## 4. O que foi modelado nos 4 níveis do MASTERCRAFT
**Nível 1 — forma principal:**
- bloco da fachada com o corpo central de 2 pavimentos e as alas térreas;
- galerias do pátio;
- sala;
- caixa cênica de 14 m;
- fundo do palco;
- jardim, rua, praça e a casa vizinha.

**Nível 2 — formas secundárias:**
- Fachada principal:
  - quatro colunas brancas com base e capitel;
  - entablamento e balcão com balaustrada;
  - pilastras, soco e frisos;
  - cornija de duas etapas;
  - terraços das alas com balaustrada.
- Coroamento: platibanda de balaústres, frontispício em arco abatido e telhado de chapa atrás.
- Galerias: arcadas no térreo do pátio.
- Fachada de ferro: colunas, vigas, dois balcões corridos com mãos-francesas e o aro do leque.
- Sala: pilastras e 6 vãos por lateral.
- Coberturas de quatro águas com cumeeira.
- Gradis com mureta e pilares.

**Nível 3 — detalhes:**
- três portas verdes em arco com bandeira de vitral;
- janelas pareadas com frontão curvo;
- portas com grade nas alas;
- brasão;
- **duas estátuas douradas** e oito **pinhas douradas**;
- capitéis dourados e crista de ferro na fachada de ferro;
- monumento de bronze sobre granito;
- círculos entrelaçados no piso, faixa de pedestres e balizadores pretos e brancos;
- postes de globo, bancos;
- canteiros de Burle Marx com caminho sinuoso;
- carros e gente.

**Nível 4 — microdetalhes:**
- oclusão assada nos vértices e no chão;
- juntas das chapas do telhado;
- juntas do piso e paralelepípedo;
- gramado manchado;
- variação por instância nas copas, carros e roupas;
- brilho próprio leve nos vitrais;
- rugosidades distintas:

  | Material | Rugosidade | Metalness |
  |---|---|---|
  | Reboco | 0,85 | — |
  | Frisos | 0,7 | — |
  | Ouro | 0,38 | 0,3 |
  | Ferro | 0,5 | 0,3 |
  | Vitrais | 0,35 | — |
  | Bronze | 0,5 | 0,4 |

## 5. Rodadas de render → crítica → correção (luz do site)
1. **R1:**
   - Leu como o Theatro já de longe.
   - Crítica:
     - o leque do coroamento de ferro estava com a face para trás (invisível);
     - o reboco ficava acinzentado na sombra;
     - as estátuas estavam pequenas e de costas;
     - o teto chato do bloco da fachada parecia inacabado;
     - a praça tinha poucas árvores;
     - o lote à direita era um vazio cinza.
   - Correção:
     - leque virado;
     - reboco `#dce8a0`;
     - estátuas 1,3× e de frente;
     - telhado atrás da platibanda;
     - 8 covas de árvore;
     - casa vizinha e gramado no fundo do lote.
2. **R2:**
   - Crítica: o arquivo chegou a 564 KB, quase no limite.
   - Correção:
     - as 360 barras de ferro viraram uma InstancedMesh;
     - anéis do piso só com a face de cima;
     - cabeças das estátuas e covas mais leves.

     Resultado: 482 KB.
3. **R3:**
   - Crítica: a casa vizinha, com o telhado laranja, ainda roubava atenção no primeiro plano do close.
   - Correção: casa menor e recuada para o lado das galerias, telhado `#a35d43`.
4. **R4 (final):**
   - No close, a fachada e o pátio de ferro dominam.
   - Na perspectiva, todos os elementos pedidos aparecem.

**"Alguém de Fortaleza reconhece?"** Sim.
- A ~200 px: a fachada verde-clara e branca com os arcos, o coroamento dourado, o retângulo colorido dos vitrais no
  pátio com o leque e a caixa cênica atrás.
- No close: as colunas, o balcão, as janelas com frontão, o brasão, as estátuas, as pinhas e os balcões de ferro.

## 6. Notas (0–10)
| Critério | Antes (versão anterior) | Depois |
|---|---|---|
| Geometria | 5 | 8 |
| Topologia | 6 | 7 |
| Proporções | 6 | 7 |
| Detalhamento | 4 | 8 |
| Materiais | 3 | 8 |
| Texturas | 4 | 8 |
| Shading | 5 | 8 |
| Realismo (fidelidade e leitura do lugar) | 2 | 8 |
| Otimização | 7 | 8 |
| Apresentação | 2 | 8 |

## 7. Números (`saida/theatro-jose-de-alencar.glb`)
| Item | Valor |
|---|---|
| Tamanho | **481 KB** (bruto 1.291 KB; limite 600) |
| Triângulos | **28.221** |
| Malhas | **69** |
| Materiais | **37** (limite 40) |
| Texturas | 6 (ver abaixo) |
| `checar` | **OK**: raio 34,0 m com o pedestal, altura 16,3 m com o pedestal |

As 6 texturas, todas geradas:
- atlas de esquadrias, 256 px;
- vitrais, 512 × 256;
- oclusão do chão, 256 px em JPEG;
- piso, 128 px (usado duas vezes, com repetições diferentes);
- mancha do gramado, 64 px.

O canvas dos vitrais passa dos 256 px da convenção, como os letreiros da Unifor e do Dragão: em 256 px a fachada de
ferro, que é o elemento mais famoso, vira borrão no close.

## 8. Checklist (item 27)
- [x] Proporção correta: medidas do OSM e da foto frontal; compressão e giro documentados.
- [x] Silhueta convincente: coroamento com estátuas, leque de ferro, caixa cênica.
- [x] Escala coerente: pessoas de ~1,4 m e carros de 3,7 m, na escala do prédio.
- [x] Geometria limpa: vértices soldados, sem chanfro em peças finas.
- [x] Normais corretas: o `checar` não acusa normais inválidas; o leque foi corrigido na R1.
- [x] Shading correto: suavização por ângulo de 32°.
- [x] Sem clipping indesejado relevante.
- [x] Sem geometria flutuando: tudo pousa em z = 0,10; balcões apoiados em mãos-francesas.
- [x] Sem faces duplicadas: `remove_doubles`; o `checar` não acusa degenerados.
- [x] Bevels coerentes: 0,03–0,04 m nas massas.
- [x] Materiais coerentes e nomeados: 37.
- [x] Texturas adequadas: todas geradas.
- [x] UV organizada: atlas por regiões; chão com UV planar; telhado em faixas.
- [x] Nível de detalhe adequado ao close e à vista geral.
- [x] Performance adequada: 481 KB, 28 mil triângulos, 69 malhas.
- [x] Arquivo organizado: script versionado; saídas em `blender/saida/theatroJoseDeAlencar-*`.
- [x] Nomenclatura em português.
- [x] Exportação correta: `exportar` e `checar` OK.

## 9. Altura da etiqueta
- O ponto mais alto é a cumeeira da caixa cênica, a ~15,8 m (16,3 m com o pedestal).
- O leque de ferro chega a ~12,2 m e as estátuas a ~13,4 m.
- **`ALTURA_ETIQUETA = 18`** no `.tsx`. Se o `dashboard/historias.js` ganhar altura própria para este marco, sugiro 18
  lá também. Não editei esse arquivo.

## 10. Dúvidas abertas
1. **Giro da composição** (`GIRO = -6`, contra o rumo real de 18° com a fachada ao norte). É uma decisão do dono:
   com `GIRO = 162` volta o norte real, mas as imagens da aprovação passam a mostrar os fundos.
2. **Vitrais e coroamento da fachada de ferro:** o desenho e as cores são uma interpretação (5 vãos, 3 níveis, leque),
   sem foto nesta sessão.
3. **Coberturas** da sala, da caixa cênica e do bloco da fachada: simplificadas em quatro águas de chapa.
4. **Brasão:** desenho neutro. **Estátuas:** o atributo é interpretação. O **letreiro** com o nome não foi confirmado e
   ficou de fora.
5. **Jardim de Burle Marx:** canteiros orgânicos genéricos. O desenho atual não foi confirmado.
6. **Monumento a José de Alencar:** a posição e a orientação na praça não foram confirmadas. A **fonte iluminada**
   de 2020 não foi modelada.
7. **Gradis** do jardim e do lote vizinho: cor e desenho a confirmar.
8. **Casa vizinha (IPHAN) e o lote a oeste:** volume neutro, piso e gramado com árvores.
9. **Galerias do pátio:** cobertas como terraço com balaustrada. A cobertura real não foi confirmada.

## Renders finais
- `renders/theatroJoseDeAlencar/tsx-perspectiva.png`
- `renders/theatroJoseDeAlencar/tsx-close.png`
- `renders/theatroJoseDeAlencar/tsx-frente.png`
- `renders/theatroJoseDeAlencar/tsx-lado.png`
- `renders/theatroJoseDeAlencar/tsx-topo.png`
