# Especialista Iracema e Martim: miniatura nova

Status: **em andamento** (rodada 3). Nada publicado em `dashboard/`, nenhum commit.

## 1. Pesquisa e referências
- Ficha em `pesquisa/iracemaMartim/ficha.md`.
- Rede: Wikimedia, Wikipédia, API do OSM e Esri com 403; `WebFetch` falha. Só o `WebSearch` respondeu: **sem fotos**.
- Confirmado por texto: obra de **José Corbiniano Lins**, inaugurada em **24/6/1965** (centenário de *Iracema*);
  **concreto armado pintado** ("ferros expostos", "tinta desgastada"; Wikidata: gesso sobre concreto); cena da
  **partida da família numa jangada**; Iracema tinha uma **lança**; a obra tem um **remo**; Moacir tem pernas; estilo
  modernista de **pernas longas**.
- Planta: OSM baixado (`osm.xml`): canteiro de grama ~17 × 7,6 m a 79°, praça do calçadão, Av. Beira-Mar ~18 m ao
  sul, zebra a leste, Praia do Mucuripe a ~40 m ao norte.

## 2. Rodadas de render → crítica → correção (luz do site)

### Rodada 1
Leitura geral boa: jangada sobre pedestal no canteiro, quatro figuras, lança, remo, cão, orla com areia, jangadas e mar.
- **Alto:** o branco das figuras sai cinza-lilás e se confunde com o calçadão; o pedestal tem o mesmo cinza do piso.
- **Alto:** Moacir fica escondido atrás de Iracema (lado norte).
- **Alto:** dois coqueiros logo atrás da escultura embaralham a silhueta na vista de frente.
- **Médio:** a pá do remo é estreita e lê como vara; a escultura pode crescer para ler a ~200 px.
- **Correções:** tinta `#fdeccc` (sai branco quente na luz do site); pedestal de concreto mais escuro (`#7d776d`) com
  frisos `#a8a195`; Moacir passa para o lado das câmeras, e a lança para a mão esquerda de Iracema; tirei os dois
  coqueiros; pá larga em folha; conjunto inteiro × 1,15.

### Rodada 2
As figuras leem bem no close e na frente: Martim no remo, Iracema com a lança erguida e a mão no ombro do filho, Japi
na proa. O branco ficou quente e destacado do piso, e o pedestal escuro separa a escultura do chão.
- **Alto:** na perspectiva (câmera a sudoeste) a vista fica quase ao longo da jangada e as figuras se empilham.
- **Médio:** a cerca-viva da calçada sul parece pedras verdes soltas; a praça a oeste e a leste está vazia.
- **Correções:** eixo a 4° (rumo 86°, entre o canteiro, 79°, e a avenida, 84°); cerca-viva contínua; quiosque do Thomas
  Bar (OSM, `amenity=bar` no calçadão) junto da areia; mais dois coqueiros na frente da praça.

## 3. Composição (resumo provisório)
- Norte real (−z). De sul para norte: calçada com mureta e cerca-viva dos prédios; Av. Beira-Mar (4 faixas, zebra);
  praça do calçadão com o canteiro e o monumento; degrau; areia com jangadas; mar.
- Distâncias comprimidas: avenida a ~15 m (real ~18 m), areia a 13 m (real ~40 m).
- Escultura: Martim 10,8 m, Iracema 9,7 m, Moacir 5,6 m, Japi ~2,5 m de altura, sobre pedestal de 1,8 m.
