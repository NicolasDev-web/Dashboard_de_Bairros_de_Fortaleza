# Especialista Farol do Mucuripe (Farol Velho) — criação do zero

Status: **concluído**. `exportar` e `checar` aprovados. Nada foi publicado em `dashboard/` e eu não fiz commit (os
commits "ponto de controle" no histórico vieram da sessão que me chamou).

## 1. Pesquisa e referências
Ficha completa em `pesquisa/farolMucuripe/ficha.md`, com história, forma, cores, entorno, dúvidas e URLs.

**Rede nesta sessão:**
- Wikimedia, Wikipédia, API do OSM e Esri devolveram 403.
- O `WebFetch` falhou.
- Só o `WebSearch` respondeu, então **não olhei nenhuma foto**.

**Confirmado em texto:**
- O farol foi construído entre 1840 e 1846 por pessoas escravizadas.
- Foi reformado em 1872 e desativado em 1957.
- Em 1981–82 virou o Museu do Jangadeiro (hoje Museu do Farol) e foi tombado pelo Estado em 1983.
- A cúpula desabou em 2021.
- A restauração foi entregue em 05/10/2025: fachada, **almeias**, **cúpula**, **nova escadaria, varanda e lampadário**.
- Forma:
  - "torre octogonal de alvenaria", com "oito paredes iguais";
  - **arcos plenos** e **janelas superiores de verga reta**;
  - uma torre metálica foi montada no centro da estrutura octogonal, que servia de moradia aos faroleiros;
  - a luz ficava a 9,30 m do solo e 33,46 m acima da maré, ou seja, o farol está num alto.
- **Cores:** "amarelo e branco", mas só numa legenda de foto (2025).

**Planta do OSM** (`osm.xml` já baixado):
- farol octogonal de ~10 m com uma parte central de 3,2 m (h 11,8 m);
- recinto gramado murado de ~66 m em volta;
- escadaria a oeste, vindo da Av. Vicente de Castro;
- costa a ~93 m na direção NNE, com pedras;
- porto (`landuse=industrial`, "Cais do Porto") a ~60 m a oeste;
- casario do Serviluz/Titanzinho com 1–2 pavimentos (h 2,8–6,6 m).

O **farol novo** (71 m, 2017) fica no Vicente Pinzón, fora do recorte.

## 2. Composição e por quê
- **Rumo real, sem giro.** O mar fica ao NNE e as câmeras da oficina vêm do sul. Assim o farol aparece de frente com o
  mar ao fundo, e a escadaria e a porta a oeste aparecem na perspectiva.
- **Protagonista ampliado.** O octógono do OSM passa de ~10 m para 12,4 m entre faces (× 1,25). As alturas crescem
  ~1,7×: o OSM dá 11,8 m e o farol tem ~20,9 m acima do platô. A ~200 px lê-se "torre amarela com lanterna e cúpula
  brancas sobre um corpo largo com ameias".
- **Entorno por compressão radial a partir do farol:**
  - `r' = 0,5·r` até 36 m: o recinto murado de ~33 m vira ~17 m;
  - `r' = 18 + 0,42·(r − 36)` depois disso: o casario até ~72 m.
- **Ruas e casas:**
  - As ruas do OSM (Amâncio Filomeno, Travessa Titã e Av. Vicente de Castro com 3 faixas) seguem a mesma compressão.
  - As casas do OSM viram retângulos orientados × 0,6.
  - Onde a compressão abriu vazios, as quadras são completadas com fileiras geminadas viradas para as ruas e para o
    muro, mais casas no miolo, como no bairro.
  - Resultado: 8 casas do OSM, 17 em fileiras e 19 no miolo.
- **Mar condensado** num segmento do disco, com a linha d'água a 24,5 m na normal da costa real:
  - areia, as pedras do Titanzinho a oés-noroeste e duas jangadas na areia;
  - coqueiros e espuma em três cristas;
  - água com `fab.agua()`.
- **Porto:** muro de concreto do cais e pilhas de contêineres do outro lado da avenida.
- **Platô:** o recinto fica 1,6 m acima da rua, com muro de arrimo, mureta caiada e pilares. A escadaria sobe junto ao
  muro oeste até o portão, e um caminho leva à porta do farol, com uma calçada octogonal em volta.

## 3. Como gerar de novo
```sh
cd marcos3d
<python-com-bpy> blender/farolMucuripe.py           # ~6 s: modela, assa a oclusão e exporta (--sem-bake: ~1 s)
export CHROME=<invólucro do chrome>
npm run render -- --ids farolMucuripe --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta 5378
npm run exportar -- --ids farolMucuripe --porta 5378
npm run checar -- --ids farolMucuripe
```
- `FAROL_DEPURAR=<arquivo.json>` grava as reservas, as casas e as frentes, para desenhar uma planta de conferência.

**O script** lê o `osm.xml` direto e trabalha em `bmesh`:
- prismas, troncos octogonais afunilados, anéis (cornijas, parapeito), tornos (cúpula de 8 gomos) e barras;
- um atlas de esquadrias de 256 px gerado em Python: porta e janela em arco pleno com venezianas vermelho-escuras e
  moldura branca, janela de verga reta com cornija, porta de aço e janela com grade das casas, chapa de contêiner;
- a oclusão é assada no Cycles:
  - nas cores de vértice (0,55–1);
  - numa imagem de 256 px do chão, assada sobre uma superfície que segue o relevo, com a rua em Z0 e o platô em ZP
    (triangulação `delaunay_2d_cdt` com o recinto como restrição);
- as cores das casas, das portas, das lajes e dos contêineres vão por `tinta()` nas cores de vértice, com um material
  de base só.

**O `.tsx`:**
- carrega as peças;
- troca a água por `fab.agua()`;
- dá brilho quente à vidraça da lanterna;
- aplica as texturas de canvas (paralelepípedo, placas, mancha, telhas) e o aoMap no chão (JPEG com `mimeType`);
- instancia coqueiros (11 folhas cada), árvores, pessoas e carros.

## 4. O que foi modelado nos 4 níveis do MASTERCRAFT
**Nível 1 — forma principal:**
- corpo octogonal largo;
- torre octogonal afunilada (5,0 → 4,4 m);
- lanterna e cúpula;
- platô murado;
- casario, praia e mar, avenida e porto.

**Nível 2 — formas secundárias:**
- soco de pedra em talude;
- pilastras brancas nas 8 quinas do corpo e da torre;
- friso entre os pavimentos e cornija de duas etapas;
- parapeito com **24 ameias**;
- 3 cintas na torre e cornija da torre;
- **varanda** sobre 8 mãos-francesas, com guarda-corpo de ferro;
- base, vidraça com montantes e anel da lanterna;
- muro de arrimo com rodapé, mureta com pilares e **escadaria** com guarda-corpo;
- lajes com platibanda e telhados de duas águas.

**Nível 3 — detalhes:**
- porta oeste em arco com bandeira e degraus;
- 7 janelas em arco e 8 de verga reta no corpo;
- porta do terraço e 16 janelas em espiral na torre, que acompanham a escada helicoidal;
- para-raios com esfera;
- 7 postes com globo;
- caixas d'água azuis, portas e janelas das casas;
- faixas tracejadas da avenida;
- jangadas com vela, pedras;
- contêineres empilhados.

**Nível 4 — microdetalhes:**
- oclusão assada nos vértices e no chão;
- venezianas e almofadas no atlas;
- juntas de paralelepípedo e placas;
- mancha na grama, na areia e na terra;
- lajes em 5 tons;
- variação por instância nas folhas, copas, roupas e carros;
- rugosidades distintas:

  | Material | Rugosidade | Metalness |
  |---|---|---|
  | Reboco | 0,85 | — |
  | Frisos | 0,7 | — |
  | Ferro | 0,5 | 0,35 |
  | Vidro | 0,15 | — (com emissão) |
  | Areia molhada | 0,6 | — |
  | Água | 0,08 | — |

## 5. Rodadas de render → crítica → correção (luz do site)
1. **R1:** script e `.tsx` completos; 370 KB, 18.975 triângulos.
   - Já leu como farol à beira-mar.
   - Crítica:
     - **crítico:** o `checar` reprovou porque as pedras desciam abaixo de y = 0 (−0,28);
     - **alto:** amarelo ocre e terraço marrom;
     - **médio:** torre lisa, lajes todas iguais, grama saturada.
   - Antes do R1 houve três correções de planta, conferidas numa planta de depuração:
     - só 7 casas sobreviviam à compressão: preenchimento das quadras;
     - o lado do porto estava invertido: a normal da avenida apontava para oeste;
     - os coqueiros caíam na reserva da areia.
2. **R2:** pedras com fundo achatado; amarelo mais claro; terraço claro; torre 0,8 m mais alta com 16 janelas em
   espiral e 3 cintas; lajes em 5 tons.
   - `checar` OK.
   - Crítica:
     - **alto:** listras na grama, de briga de profundidade entre o topo do arrimo (ZP − 0,002) e a grama (ZP);
     - **médio:** amarelo ainda mostarda; gramado vazio; muitas lajes cinza no close.
3. **R3:**
   - topo do arrimo em ZP − 0,09, e as listras sumiram;
   - postes com globo (a iluminação externa é de 2025);
   - mais telhados de barro (50%);
   - mais carros;
   - amarelo saturado `#ffd23f`. O chão azul da luz de hemisfério do site puxa as faces verticais para oliva; agora
     lê como amarelo.
4. **R4 (final):** conferência de todas as vistas e da perspectiva reduzida a ~200 px.
   - Leem-se a torre amarela, a lanterna e a cúpula brancas, o corpo com ameias no platô verde, o mar e os coqueiros
     atrás, o casario colorido e o porto.

**"Alguém de Fortaleza reconhece?"** Pela silhueta (corpo octogonal com ameias, torre, lanterna e cúpula) e pelo
contexto (alto murado no Serviluz, mar e jangadas, porto), sim. A fidelidade fina depende de foto (veja as dúvidas).

## 6. Notas (0–10)
"Antes" é o placeholder que existia no `.tsx`: cilindros, um toro e uma casa com telhado em cone.

| Critério | Antes | Depois |
|---|---|---|
| Geometria | 3 | 8 |
| Topologia | 5 | 7 |
| Proporções | 4 | 7 |
| Detalhamento | 2 | 8 |
| Materiais | 3 | 8 |
| Texturas | 1 | 7 |
| Shading | 4 | 8 |
| Realismo (fidelidade e leitura do lugar) | 2 | 7 |
| Otimização | 8 | 8 |
| Apresentação | 2 | 8 |

## 7. Números (`saida/farol-do-mucuripe.glb`)
| Item | Valor |
|---|---|
| Tamanho | **382 KB** (bruto 1.151 KB; limite 600) |
| Triângulos | **19.759** |
| Malhas | **44** |
| Materiais | **37** (limite 40; inclui o pedestal) |
| `checar` | **OK**: raio 34,0 m, altura 23,1 m (ambos com o pedestal) |

As texturas são todas geradas:
- atlas de esquadrias, 256 px;
- oclusão do chão, 256 px em JPEG;
- paralelepípedo e placas, 128 px;
- mancha, 64 px;
- telhas, 64 px.

## 8. Checklist (item 27)
- [x] Proporção correta: dentro da interpretação documentada (OSM 10 m / 3,2 m / 11,8 m, ampliado × 1,25 / ~1,7).
- [x] Silhueta convincente: corpo largo com ameias, torre afunilada, varanda, lanterna e cúpula.
- [x] Escala coerente: casario, pessoas (~1,3 m) e carros (3 m) numa escala; o farol é ampliado de propósito.
- [x] Geometria limpa: vértices soldados por peça, pedras com fundo achatado.
- [x] Normais corretas: o `checar` não acusa normais inválidas.
- [x] Shading correto: suavização por ângulo de 32°; a cúpula fica facetada em 8 gomos.
- [x] Sem clipping indesejado: a briga de profundidade da grama foi corrigida na R3.
- [x] Sem geometria flutuando: tudo pousa em Z0 ou ZP; a varanda tem mãos-francesas.
- [x] Sem faces duplicadas: a vela tem as duas faces afastadas 3 cm.
- [x] Bevels coerentes: 0,03 m nas ameias e nos pilares; as massas octogonais leem pelas pilastras e cornijas.
- [x] Materiais coerentes e nomeados: 37.
- [x] Texturas adequadas: todas geradas, ≤ 256 px.
- [x] UV organizada: atlas por regiões; chão com UV planar; telhas em metros.
- [x] Nível de detalhe adequado ao close e à vista geral.
- [x] Performance adequada: 382 KB, 19,8 mil triângulos, 44 malhas.
- [x] Arquivo organizado: script versionado; saídas em `blender/saida/farolMucuripe-*`.
- [x] Nomenclatura em português.
- [x] Exportação correta: `exportar` e `checar` OK.

## 9. Altura da etiqueta
- O ponto mais alto é o para-raios da cúpula, a ~22,6 m (23,1 m com o pedestal).
- A cúpula termina a ~21,4 m.
- **`ALTURA_ETIQUETA = 25`** no `.tsx`. Se o `dashboard/historias.js` ganhar altura própria para este marco, sugiro 25
  lá também. Não editei esse arquivo.

## 10. Dúvidas abertas
1. **Forma sem foto:** a divisão "corpo octogonal largo + torre central" e as alturas relativas são interpretação do OSM
   e do texto. O número de pavimentos do corpo, a altura da torre e o desenho das ameias precisam de foto.
2. **Cores:** "amarelo e branco" vem só de uma legenda de foto de 2025. As esquadrias vermelho-escuras e a cúpula
   branca não estão confirmadas.
3. **Portas e janelas:** a porta principal a oeste (onde chega a escadaria do OSM), as janelas em espiral da torre e o
   guarda-corpo da varanda são interpretação.
4. **Platô de 1,6 m e escadaria:** o OSM mostra a escadaria antiga em zigue-zague por dentro do muro. A "nova escadaria"
   de 2025 não tem desenho confirmado; a do modelo sobe junto ao muro oeste.
5. **Entorno de 2025:** parquinho e academia ao ar livre "em frente ao farol", sem posição: não foram modelados. Os
   postes com globo são genéricos.
6. **Casario:** cores, coberturas e casas do miolo das quadras são genéricas do bairro (não foram levantadas casa a
   casa). A compressão encurta os ~50 m de casas do Titanzinho entre o farol e o mar.
7. **Porto:** muro e contêineres são ambientação; o pátio real ao lado da avenida não foi levantado.
8. **Jangadas e coqueiros:** ambientação típica do Mucuripe, sem posição real.
9. **Farol novo (71 m, 2017):** fica no Vicente Pinzón, fora do recorte de 67 m.

## Renders finais
- `renders/farolMucuripe/tsx-perspectiva.png`
- `renders/farolMucuripe/tsx-close.png`
- `renders/farolMucuripe/tsx-frente.png`
- `renders/farolMucuripe/tsx-lado.png`
- `renders/farolMucuripe/tsx-topo.png`
