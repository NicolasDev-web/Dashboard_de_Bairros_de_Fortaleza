# Ficha — Fortaleza de Nossa Senhora da Assunção (forteAssuncao)

## O que é
- Forte que deu nome à cidade, no alto da colina junto à antiga foz do riacho Pajeú, no Centro de Fortaleza.
- O forte de pedra e cal foi projetado pelo engenheiro militar Antônio José da Silva Paulet; os alicerces foram lançados
  em **12 de outubro de 1812** (OSM `start_date=1812-10-12`), no lugar do forte de madeira arruinado (o Schoonenborch
  holandês, de 1649, rebatizado pelos portugueses em 1654).
- Desarmado em 1910 (IBGE). **Tombado pelo Iphan em 2008.** Hoje é a sede do **Comando da 10ª Região Militar** do
  Exército (OSM `landuse=military`, `name=Comando da 10ª Região Militar`, Av. Alberto Nepomuceno).
- Em 2021 desabou parte da **"bateria inferior do baluarte nordeste"** (relatório do Iphan citado pelo Diário do Nordeste);
  em 2024 o trecho estava em obras de recuperação.

## Como é hoje (das fotos)
O conjunto tem duas leituras que se completam:

1. **O quartel do Comando**, a parte mais vista da rua:
   - prédio em quadra fechada, de 2 pavimentos altos, com pátio interno arborizado;
   - telhado de **telha cerâmica** em quatro águas contínuas em volta do pátio;
   - paredes **rosa-antigo (malva)**, com pilastras, cimalha e cordão entre pavimentos **creme**;
   - janelas em **arco pleno**, com caixilho creme e folhas **verdes**; no pavimento de cima, **sacadas de ferro**;
   - embasamento **cinza** (pedra/reboco), que vira talude alto nas ruas do sul e do oeste.
2. **A fachada principal**, voltada para o leste-sudeste e para o pátio de estacionamento:
   - **corpo central** com duas pilastras creme que sobem acima da cimalha e um **frontão escalonado** com o brasão
     (as Armas Nacionais entre bandeiras verdes, com um canhão) e a palavra **"COMANDO"**;
   - porta em arco com bandeira em leque e, acima dela, **"10ª REGIÃO MILITAR"**;
   - pilastras de canto creme que também passam da cimalha;
   - escadaria de 3 a 4 degraus na frente da porta e um mastro branco de base redonda.
3. **O pátio de estacionamento** fica num platô murado:
   - piso de paralelepípedo com vagas pintadas de amarelo;
   - **muro branco em talude**, com **pilaretes brancos com remate** e **grade preta** entre eles;
   - **portão com duas guaritas brancas** (torrinhas quadradas, com nicho em arco e cimalha), de frente para a porta;
   - rampa externa que sobe do sul, ao longo do muro, até o portão;
   - mastro com a **bandeira do Brasil** junto ao portão.
4. **As muralhas do forte**, vistas da Av. Presidente Castelo Branco (Leste-Oeste), ao norte:
   - muros brancos, caiados e em talude, em dois níveis;
   - a **bateria inferior** do baluarte, com gramado e **coqueiros**;
   - o terrapleno de cima, com um **espelho d'água redondo** (OSM `natural=water`, Ø ≈ 9 m) e um monumento;
   - o baluarte nordeste aponta para a avenida.
5. **O entorno:**
   - a oeste, colado ao quartel, o **Passeio Público**: árvores grandes e o gradil da praça, separados pela Rua
     Floriano Peixoto, de paralelepípedo;
   - ao sul, a Rua Dr. João Moreira, com o casario baixo e a Praça da Sé (Catedral);
   - a sudeste, a praça com a escultura de **cones de aço inox** (as "velas"), cercada por gradil;
   - a leste, a Av. Alberto Nepomuceno;
   - ao norte, embaixo das muralhas, a Leste-Oeste. O mar fica além dela, fora do recorte.

## Medidas (OSM, API 0.6, `osm.xml`; metros em volta do ponto do tour, x = leste, y = norte)
| Elemento | Fonte | Medida |
|---|---|---|
| Quartel (quadra) | relação 15829081, `building:levels=3`, `height=10.2` | contorno (1,−79) (19,−30) (−47,−4) (−40,16) (−52,21) (−73,−46) (−71,−52); pátio (−57,−42) (−50,−19) (−0,5,−38) (−9,−60) |
| Rumo das fachadas | idem | longas a 110,8° / 290,8°; fachada principal a 20,6° (frente para 110°) |
| Profundidade das alas | idem | 14–16 m |
| Anexo ao norte do quartel | via 630998516 | 2 pav., 5,3 m |
| Estacionamento murado | relação 8778621 | muro leste (2,−80) (16,−85) (25,−60) (33,−41) (39,−24) (46,−16) |
| Portão (guaritas) | nó 5958040923 `entrance` | (25,−60); a porta do quartel é o nó 5958129785 em (11,−55) |
| Muralha norte (face de fora) | via 630998534 `city_wall` | (−97,66) (−96,84) (−47,49) (−50,41) (8,19) (15,33) (77,26) (73,19) |
| Muralha norte (face de dentro) | via 630998521 `city_wall` | (−97,66) (−58,45) (−52,31) (14,5) (22,22) (71,16) |
| Terraço com espelho d'água | relação 18658298 e via 630998508 | centro (27,7), Ø ≈ 9 m |
| Árvores | nós `natural=tree` | 2 fileiras de 7 no pátio; 4 ao norte do quartel; 9 na bateria |
| Ruas | vias | Dr. João Moreira (sul, 2 faixas, mão única), Floriano Peixoto (oeste, paralelepípedo), Alberto Nepomuceno (leste, 3 faixas), Pres. Castelo Branco (norte, 2 faixas) |

## Cores (das fotos, ajustadas para a luz do site)
| Elemento | Cor |
|---|---|
| parede do quartel (rosa-antigo) | `#b07f80` |
| pilastras, cimalha, cordão, molduras | `#ebdfc4` |
| folhas das janelas | `#2f5e45` |
| telhado de telha cerâmica | `#b8634a` |
| muralhas e muros caiados | `#efeee8` |
| embasamento cinza | `#9c9a94` |
| piso de paralelepípedo do pátio | `#8f8a82` |
| guaritas | branco |

## Recorte da miniatura
- Planta real, sem giro (norte em −z), encolhida em volta de (−2, −22): K = 0,37 até 70 m.
- Daí para fora entra só 55% do excesso de raio (compressão radial suave). Só os vértices são transformados, então as
  fachadas continuam retas.
- Entra: o quartel inteiro, o pátio murado com o portão, a bateria e o baluarte nordeste com o espelho d'água, a
  Castelo Branco ao norte, a beira do Passeio Público, o casario da Dr. João Moreira, a praça das velas e a Alberto
  Nepomuceno.

## Fontes
- Fotos (Wikimedia Commons, categoria https://commons.wikimedia.org/wiki/Category:Fortaleza_de_Nossa_Senhora_da_Assun%C3%A7%C3%A3o):
  - ref-1, vista aérea do quartel com o pátio e o mar ao fundo: https://commons.wikimedia.org/wiki/File:Atual_Quartel_da_10%C2%AA_Regi%C3%A3o_Militar_-_Vis%C3%A3o_a%C3%A9rea.jpg
  - ref-2, vista aérea da entrada, do estacionamento e das guaritas: https://commons.wikimedia.org/wiki/File:Entrada_do_atual_Quartel_da_10%C2%AA_Regi%C3%A3o_Militar_-_Vis%C3%A3o_a%C3%A9rea.jpg
  - ref-3, muralhas vistas do norte, com bateria, coqueiros e espelho d'água: https://commons.wikimedia.org/wiki/File:Forte_de_Nossa_Senhora_de_Assun%C3%A7%C3%A3o.jpg
  - ref-4, fachada principal, muro com pilaretes e rampa: https://commons.wikimedia.org/wiki/File:Fortaleza_Nossa_Senhora_da_Assun%C3%A7%C3%A3o_02.jpg
  - ref-5, portão com as guaritas e o frontão "COMANDO" (fachada ainda vermelha, foto antiga): https://commons.wikimedia.org/wiki/File:ASCENCAO_FORTRESS,_FORTZLEZA,_BRAZIL.jpg
  - também olhadas: `Cmdo_10ª_Região_Militar.jpg`, `Fortaleza_de_Nossa_Senhora_da_Assunção_01…14.jpg`, `10th_Military_Region_in_Fortaleza.jpg`.
- Texto:
  - Diário do Nordeste, sobre o desabamento de 2021 e a reforma de 2024: https://diariodonordeste.verdesmares.com.br/metro/parte-da-muralha-da-fortaleza-de-nossa-senhora-da-assuncao-aguarda-reforma-apos-desabamento-1.3092076 e https://diariodonordeste.verdesmares.com.br/ceara/tres-anos-apos-desabar-muralha-da-fortaleza-de-nossa-senhora-da-assuncao-passa-por-reforma-1.3540778
  - Wikipédia (en), Fortaleza de Nossa Senhora da Assunção: https://en.wikipedia.org/wiki/Fortaleza_de_Nossa_Senhora_da_Assun%C3%A7%C3%A3o
  - IBGE, histórico de Fortaleza: https://biblioteca.ibge.gov.br/visualizacao/dtb/ceara/fortaleza.pdf
- Planta: `osm.xml` (API 0.6 do OSM, bbox −38.5261,−3.7238,−38.5240,−3.7217), já nesta pasta.
- Limites de rede nesta sessão: a vista aérea da Esri, a API do OSM e a Wikipédia foram bloqueadas pelo proxy. A aérea
  foi substituída pelas duas fotos aéreas do Commons.

## Dúvidas abertas
1. **Cor das fachadas que não são a principal.** As fotos recentes mostram o rosa-antigo na fachada principal e em
   trechos das laterais; outras partes aparecem creme ou cinza-malva, como se a pintura estivesse em andamento. A
   miniatura usa o rosa-antigo em tudo.
2. **Pátio interno:** só a aérea o mostra (piso, árvores em duas fileiras e torre treliçada vermelha e branca). As
   fachadas internas ficaram neutras: janelas em arco, sem as varandas que a aérea sugere.
3. **Monumento do espelho d'água e estátua do terraço** (OSM `historic=monument` e `tourism=artwork`): não achei foto de
   perto. Viraram um pedestal neutro e uma figura neutra.
4. **Canhões:** o Commons tem a categoria "Cannons in Fortaleza de Nossa Senhora da Assunção", mas não sei onde eles
   ficam. Foram postos no terrapleno, apontando para o mar.
5. **Escultura das velas (SE):** não confirmei o nome. Foi feita como três cones de aço num canteiro redondo com gradil.
6. **Desníveis** (platô do forte, bateria e avenida): foram estimados pelas fotos, não medidos.
7. **Ponta do baluarte nordeste:** fica a ~95 m do centro e entra comprimida na borda do disco.
