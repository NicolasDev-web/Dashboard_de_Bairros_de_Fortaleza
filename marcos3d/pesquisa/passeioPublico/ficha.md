# Ficha — Passeio Público (Praça dos Mártires) — passeioPublico

Refeita do zero em out/2026 (a versão anterior, um disco de grama com uma cruz de caminhos, foi descartada). Rede nesta
sessão: Wikimedia, Wikipédia, API do OSM e Esri bloqueados (403); `WebFetch` sem DNS. Tudo o que está abaixo vem do
`osm.xml` já salvo nesta pasta, da ficha e das fotos do Forte (`pesquisa/forteAssuncao/ref-1.jpg` e `ref-2.jpg`, que
mostram a copa do Passeio vista do alto) e de resumos de `WebSearch` (URLs no fim).

## O que é (confirmado por texto)
- **A praça mais antiga de Fortaleza.** Obras iniciadas em **1864**; nome oficial **Praça dos Mártires** desde 1879, pelos
  líderes da Confederação do Equador fuzilados ali em 1825 (entre eles o Padre Mororó); inaugurada como Passeio Público em
  1880 (OSM `rel 8778624`: "tornou-se passeio Público em 1877 … inaugurada em 5 de junho de 1880"). **Tombada pelo Iphan**
  (1964/65) e pelo município.
- **Três planos descendo para o mar** (urbanização de 1864): a elite no plano mais alto, a **Avenida Caio Prado**, "de frente
  para o mar"; a classe média na **Avenida Carapinima** (plano do meio); o povo na **Avenida Padre Mororó** (plano de baixo,
  com um lago artificial). Uma avenida aberta em 1880 separava o 1º e o 2º plano.
- **O que restou hoje:** "o primeiro plano é o único que restou do velho Passeio Público" (Fortaleza em Fotos, 2014). O
  **2º plano foi cedido ao Exército em 1963** e está ocupado por edificações da 10ª Região Militar; o **3º plano já
  aparecia desaparecido** num mapa do Exército de 1945 (ocupado por uma usina da Light). Hoje ali passa a Leste-Oeste
  (Av. Pres. Castelo Branco). Em 2024 o Exército pôs arame no muro da praça (O Povo).
- **Baobá:** *Adansonia digitata* plantado em **1910** por Thomaz Pompeu de Sousa Brasil Filho (o "baobá do senador
  Pompeu"), imune ao corte (Decreto 12.227/97, com outras 9 árvores do Passeio). OSM nó 8685783598
  (`species=Adansonia digitata`, `start_date=1910`).
- **Estatuária:** réplicas de estátuas greco-romanas (cópias de peças de museus europeus); um plano de 1879 previa 8
  estátuas em tamanho natural (as quatro estações e quatro alegorias, entre elas Vênus e Diana). Os títulos do Commons
  citam **Apolo, Prometeu e Vênus com Cupido**; uma foto da Wikipédia mostra "réplica de estátua greco-romana no corredor
  principal". Em 2022, **14 esculturas** do Passeio voltavam restauradas.
- **Gradil:** o gradil de ferro em volta da praça foi retirado em 1932 e refeito nos anos 1990 "no mesmo estilo, com as
  colunas, mas com proporções alteradas" (Fortaleza Nobre).
- **Fontes/chafarizes** (O Povo: "chafarizes com peixes"), **bustos**, **bancos**, **postes** (alguns quebrados, Wikipédia),
  **muretas** e **caixa d'água** (restauradas em 2020, Diário do Nordeste), **palmeiras carnaúbas e placas** em homenagem aos
  revolucionários (obra de 2020).
- **Café Passeio:** restaurante num antigo **quiosque** adaptado (O Povo+, 2018), com almoço ao ar livre sob as árvores.
  OSM: nó `amenity=restaurant` (41,7; −2,6) dentro do prédio 630998504.
- **Vizinhos:** a oeste, a **Santa Casa de Misericórdia** (Rua Barão do Rio Branco); a leste, colado, o **quartel da 10ª
  Região Militar / Forte de N. S. da Assunção**, do outro lado da Rua Floriano Peixoto (paralelepípedo); ao sul, a Rua
  Dr. João Moreira com o casario; ao norte, embaixo, a Leste-Oeste.

## Planta (OSM, `osm.xml`; metros em volta do ponto do tour, x = leste, y = norte)
| Elemento | Fonte | Medida |
|---|---|---|
| Praça (gradil O-S-L) | via 24439917 `barrier=fence` | (−56,9; 54,0) (−68,7; 15,2) (−76,7; −10,5) (−4,4; −36,8) (53,8; −58,9) (63,6; −29,8) (76,9; 10,5) |
| Borda norte (muro) | vias 630998537 `city_wall` e 630998535 | (76,9; 10,5) → (43,5; 22,2) → (−56,9; 54,0) |
| Rumo | idem | lado maior a **108°** (≈ 140 m); lado menor a 18° (≈ 70 m); a borda norte olha para o NNE (o mar) |
| Portões | nós `barrier=gate` | oeste (−68,7; 15,2), sul (−4,4; −36,8), leste (63,6; −29,8) |
| Corredor principal | via 630998495 | do portão oeste ao leste, passando ao norte da fonte |
| Alameda norte | via 630998487 | paralela, ~15 m ao norte |
| **Avenida Caio Prado** | via 937444724 (`name`, "há uma placa no local") | o caminho junto à borda norte |
| Caminhos de contorno | vias 630998489, 937444723 | sul, oeste e leste |
| Transversais | vias 630998485, 630998491, 630998493, 630998500, 630998481, 630998483 | rumo 18° |
| Fonte | via 630998502 `natural=water`, `water=source` | redonda, Ø ≈ 6,9 m, centro (3; −17), com um caminho em anel (via 630998497) |
| Baobá | nó 8685783598 (com espécie e data) | (−0,2; −26,3); há outros dois nós "Baobá" a ≤ 15 m: (−7,0; −16,1) e (−21,3; −27,9) |
| Café Passeio | prédio 630998504 (≈ 8,6 × 5,4 m, cantos arredondados) | centro (39,5; −1,5); ao lado, um redondo de Ø 5,8 m (630998506) |
| Piso do café | área 630998479 | (36,7; 5,5) (46,5; 2,2) (39,8; −17,2) (30,1; −13,9) |
| Árvores tombadas | nós `denotation=natural_monument` | Benjamin (61,8; −1,3), Jucazeiro (29,5; −38,6), Macaúba (−47,9; −15,8), Mungubeiras (−28,5; 24,7) e (7,0; 9,3), Oiticica (−38,0; −5,4), Oitizeiro (58,3; −22,8), Pau d'Arco Roxo (16,6; −27,5), Timbaúba (35,9; −47,5) |
| Outras árvores | 29 nós `natural=tree` | dentro da praça |
| 2º plano (Exército) | relação 8778622, prédios 630998527 (2 pav., 4,7 m), 630998529 (3,4 m), 630998523 (em U, 4,0 m), quadra 630998531 | entre a borda norte e a Leste-Oeste |
| Leste-Oeste | vias 913965692 (ligação, 2 faixas), 913637498 e 243231233 (2 faixas cada), canteiros 903439434, 1482879452/53 | v ≈ 88, 104 e 118 m ao NNE |
| Santa Casa | relação 15829054 (`hospital`, 14,4 m) | fachada leste a ~15 m do gradil oeste |
| Quartel (Forte) | relação 15829081 | fachada oeste de (67,7; −59,7) a (89,5; 6,7), a ~10 m do gradil leste |
| Ruas | vias | Dr. João Moreira (sul, 2 faixas, mão única), Barão do Rio Branco (oeste, paralelepípedo, desce até a avenida), Floriano Peixoto (leste, paralelepípedo) |

Conversão: x = Δlng·cos(lat)·111320; y = Δlat·110540. O ponto do Forte fica em (141,1; −13,9) deste referencial.

## Cores e materiais
- Copas: verdes escuros e densos (ref-1 e ref-2 do Forte mostram o Passeio como uma massa verde-escura de copas redondas).
- Caminhos: piso claro (OSM `surface=paving_stones` e `concrete`) → bege claro `#d9d0bd`, com textura de blocos.
- Gramados e canteiros: `#6f9a47` (mesmo verde do Forte).
- Estátuas: réplicas claras → branco-mármore `#efebe1`; pedestais em pedra clara `#cfc8b8`.
- Gradil: ferro escuro `#24282a` (o mesmo do Forte, que desenhou "a beira do Passeio" com ele) entre colunas claras.
- Quartel: rosa-antigo `#b07f80`, frisos creme `#ebdfc4`, telha `#b8634a` (os mesmos do Forte).
- Muros caiados: `#efeee8`.

## Dúvidas abertas (o que ficou neutro)
1. **Posição exata do baobá:** há três nós a ≤ 15 m; usei o que tem espécie e data (−0,2; −26,3), ao sul da fonte.
2. **Forma das estátuas:** só sei que são réplicas greco-romanas claras (Apolo, Prometeu, Vênus com Cupido nos títulos do
   Commons). As figuras são genéricas (de pé, com drapeado e braço erguido); o material (mármore ou pedra artificial) e a
   posição de cada uma não foram confirmados. Ficaram ao longo do corredor principal.
3. **Bustos:** a existência foi citada por guias; a posição, o material e quem são, não. Três bustos neutros (bronze sobre
   estela de pedra) na alameda norte.
4. **Gradil:** as colunas são citadas, mas não a cor, o espaçamento nem a altura. Colunas claras e ferro escuro.
5. **Café Passeio:** a planta vem do OSM; a cobertura e as cores, não. Telhado cinza neutro, paredes claras. O prédio
   redondo ao lado (630998506) pode ser a "caixa d'água" restaurada em 2020 — não confirmado; virou um quiosque redondo
   neutro.
6. **Fonte:** só sei que é redonda (Ø ≈ 6,9 m) e que os chafarizes têm peixes; o repuxo central é genérico.
7. **Carnaúbas e placas:** a existência foi confirmada (obra de 2020), a posição não. Pus uma fileira curta junto ao portão
   sul.
8. **Desnível dos planos:** estimado (≈ 1 m entre o 1º e o 2º plano e entre o 2º e a avenida, na miniatura). O modelo do
   Forte supôs o terreno ao norte da praça mais alto (platô do forte); aqui, pelos textos, o 2º plano é **mais baixo**
   que a praça.
9. **Prédios do Exército no 2º plano:** só a planta e a altura do cadastro; paredes brancas e laje cinza neutras.
10. **Santa Casa:** sem foto; volume claro neutro de dois pavimentos com janelas.
11. **Mar:** fica além da Leste-Oeste e de uma quadra de prédios, fora do recorte.

## Fontes
- OpenStreetMap: `osm.xml`, `osm-resumo.json`, `planta.png` (nesta pasta).
- O Povo, 2025 — "Passeio Público é também a Praça dos Mártires": https://www.opovo.com.br/noticias/fortaleza/2025/02/24/passeio-publico-e-tambem-a-praca-dos-martires-voce-sabe-por-que.html
- O Povo, 2026 — "Baobá do Passeio Público completa 115 anos": https://www.opovo.com.br/noticias/fortaleza/2026/06/18/baoba-do-passeio-publico-completa-115-anos-e-resiste-como-simbolo-de-memoria-em-fortaleza.html
- O Povo+, Sérgio Falcão, 2021 — três planos: https://mais.opovo.com.br/colunistas/sergio-falcao/2021/08/10/praca-dos-martires-conhece.html
- Fortaleza em Fotos — "Um jardim chamado Passeio Público" (2014) e "A Praça dos Mártires e suas histórias" (2024): https://www.fortalezaemfotos.com.br/2014/03/um-jardim-chamado-passeio-publico.html e http://www.fortalezaemfotos.com.br/2024/11/a-praca-dos-martires-passeio-publico-e.html
- Instituto do Ceará, 2009 — "Passeio Público: espaços, estatuária e lazer": https://www.institutodoceara.org.br/revista/Rev-apresentacao/RevPorAno/2009/03_Art_PasseioPublico_corrigido.pdf
- Diário do Nordeste, 2020 — requalificação (estátuas, muretas, caixa d'água): https://diariodonordeste.verdesmares.com.br/metro/passeio-publico-e-entregue-com-renovacao-do-paisagismo-e-restauro-de-elementos-historicos-1.3005885
- Fortaleza Nobre — gradil retirado em 1932 e refeito: http://www.fortalezanobre.com.br/2011/09/praca-dos-martires-passeio-publico.html
- Wikipédia — Praça dos Mártires: https://pt.wikipedia.org/wiki/Pra%C3%A7a_dos_M%C3%A1rtires
- Commons — Category:Statues in Passeio Público (Fortaleza): https://commons.wikimedia.org/wiki/Category:Statues_in_Passeio_P%C3%BAblico_(Fortaleza)
- O Povo, 2024 — cerca de arame do Exército: https://www.opovo.com.br/noticias/fortaleza/2024/01/24/passeio-publico-de-fortaleza-cerca-de-arame-colocada-pelo-exercito-nao-foi-autorizada-pelo-iphan.html
- O Povo+, 2018 — "Na sombra do baobá" (Café Passeio): https://mais.opovo.com.br/jornal/vida_e_arte/2018/10/16128-na-sombra-do-baoba.html
- O Povo, 2022 — chafarizes com peixes: https://www.opovo.com.br/noticias/fortaleza/2022/02/13/passeio-publico-um-dos-pontos-da-ciclofaixa-de-lazer-e-opcao-no-fim-de-semana.html
- Visit Fortaleza: https://visit-fortaleza.com/experiencias/passeio-publico/
