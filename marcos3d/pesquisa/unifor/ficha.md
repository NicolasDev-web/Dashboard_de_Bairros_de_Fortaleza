# Ficha de pesquisa — Unifor (Universidade de Fortaleza)

Marco `unifor` → `src/marcos/Unifor.tsx` + peças geradas por `blender/unifor.py`. Centro do tour: lat −3,7687, lng −38,4777
(Av. Washington Soares, 1321, Edson Queiroz).

Marcação: **[foto]** visto nas fotos de referência, **[OSM]** medido na planta do OpenStreetMap baixada nesta sessão,
**[texto]** fonte escrita com URL, **[dúvida]** não achei e simplifiquei de forma neutra.

## Fontes desta sessão (rede liberada)
- Fotos (Wikimedia Commons, miniaturas baixadas para `pesquisa/unifor/ref-N.jpg`, fora do git):
  - `ref-1.jpg` — vista aérea do campus: https://commons.wikimedia.org/wiki/File:Campus_unifor.jpg
  - `ref-2.jpg` — Reitoria, jardim e fonte vistos da Washington Soares: https://commons.wikimedia.org/wiki/File:UNIFOR_06.jpg
  - `ref-3.jpg` — fachada do Centro de Convivência: https://commons.wikimedia.org/wiki/File:Unifor-campus-centro-convivencia-fachada-foto-ares-soares.jpg
  - `ref-4.jpg` — Reitoria, fachada com arcos e palmeiras: https://commons.wikimedia.org/wiki/File:UNIFOR_05.jpg
  - Também olhadas em miniatura: `UNIFOR_01/03/07.jpg`, `Bruno_giorgi_-_unifor.jpg`, `Prédios_vistos_do_laguinho_da_UNIFOR.jpg`
    (https://commons.wikimedia.org/wiki/Category:Universidade_de_Fortaleza).
- Texto: https://pt.wikipedia.org/wiki/Universidade_de_Fortaleza (campus de 720 mil m², Espaço Cultural de 1988 com 1.200 m²,
  escultura de Bruno Giorgi na parte externa do Espaço Cultural, Biblioteca Central, Centro de Convivência, lago, estádio de
  atletismo, ginásio, piscina semiolímpica).
- Planta: API 0.6 do OSM, bbox `-38.4840,-3.7740,-38.4710,-3.7640` (4.157 vias). Conversão em volta de (−3,7687; −38,4777):
  x = Δlng·cos(lat)·111320 (leste), y = Δlat·110540 (norte). As URLs de texto da ficha anterior (unifor.br, Diário do Nordeste)
  continuam valendo e estão no relatório.

## Planta medida no OSM (metros, x = leste, y = norte, origem no ponto do tour) [OSM]
| Elemento | Centro | Tamanho / forma | Altura no OSM |
|---|---|---|---|
| Av. Washington Soares | pista leste x ≈ −483, pista oeste x ≈ −524 (y = 0) | quase norte–sul, rumo ≈ 354° (6° para oeste) | — |
| Reitoria | (−440, −28) | **ala curva** de ~75 × 14 m paralela à avenida, **côncava para oeste** (raio ≈ 70 m), + ala leste–oeste de ~50 × 22 m saindo do meio | 4 pav., 12,3 m |
| Biblioteca Central | (−325, −12) | retângulo ~40 × 67 m, eixo maior a −23,5° (NNO) | 3 pav., 8,3 m |
| Centro de Convivência | (−216, −55) | redondo, Ø ≈ 55 m, com dois "lóbulos" de Ø ~4 m em (−242, −46) e (−228, −77): as torres; a frente olha para OSO (≈ 252°) | 3 pav., 10,4 m |
| Praça Central | em volta de (−253, −97) | parque entre Biblioteca, CC e blocos, com fontes | — |
| Blocos de aula | C (−393, −115), I (−217, −118), J (−186, −146), D (−312, −199, em H), H (−325, 95), T (−294, 133, em H), N/P/Q/R/S (−162…−238, 70…211) | barras de 75–80 m com eixo a 65°/155° | 2–4 pav., 7–12 m |
| Bloco M | (−103, −15) | em H duplo | 4 pav., 11,1 m |
| Ginásio | (34, −116) | ~76 × 80 m | — |
| Estádio de atletismo | (227, 10) | pista oval ~94 × 164 m, arquibancada a oeste (10 m) | — |
| Lago | (263, 297) | ~250 × 177 m | — |

## O que as fotos mostram (e muda em relação à ficha anterior)
- **Reitoria [foto ref-2, ref-4]:** dois pavimentos visíveis da avenida. **Pilastras verdes** (verde-sálvia/oliva, ~#8fab5a) de
  alto a baixo, **faixa verde no alto com arcos abatidos**: cada vão entre pilastras tem um arco, e sob o arco fica a janela
  do 2º pavimento, com caixilhos brancos e topo acompanhando o arco. Painéis de parede em **pastilha bege-acinzentada**
  (~#cdc3a8). No térreo, fita de janelas com caixilho branco e alguns painéis vinho. Atrás aparece um volume mais alto e cinza
  com antenas (deve ser a ala leste–oeste de 4 pavimentos do OSM). Cobertura clara (vista na aérea).
  A ficha anterior supunha "reboco branco com fitas de vidro" — **errado**.
- **Jardim da Reitoria [foto ref-2, ref-4]:** **palmeiras imperiais** altíssimas (bem mais altas que o prédio) e coqueiros;
  **fonte circular** baixa de granito com **grupo escultórico** no meio; **estátuas brancas** de mármore em pedestais;
  **gradil verde** (tela soldada) ao longo da calçada; canteiros de **ixora vermelha**; totem azul "Reitoria / Main Building"
  com base verde-água; letreiro baixo "Fundação Edson Queiroz / Universidade de Fortaleza"; calçada em ladrilho cinza.
  O banner "Edson Queiroz 100 anos" é temporário e ficou de fora.
- **Centro de Convivência [foto ref-3, aérea ref-1]:** prédio redondo branco com **cúpula branca baixa** (na aérea, uma cúpula
  maior com anel de janelas e uma segunda cúpula menor ao lado) e pequenos mastros no topo. Na frente, **pórtico branco** com
  **faixa azul "UNIVERSIDADE DE FORTALEZA"** em letras brancas, mezanino com guarda-corpo e térreo aberto. Ladeando o pórtico,
  **duas torres de vidro azul em planta bilobada** (dois cilindros colados), mais altas que a cúpula. À esquerda de quem olha,
  parede **azul-petróleo com relevo**; à direita, **mural colorido** grande. Na frente, praça pavimentada com árvores.
- **Biblioteca [aérea ref-1]:** caixa branca grande, cobertura clara com **lanternim** (claraboia elevada) no meio. Fachadas
  não aparecem nas fotos → **[dúvida]**, simplificadas.
- **Blocos [aérea ref-1]:** barras compridas brancas com **telhado metálico cinza-claro**, quase escondidas na **mata densa**;
  é essa a "cara" do campus vista de cima. Ginásio com **abóbada branca** e estacionamento solar azul ficam longe (centenas de
  metros a leste).

## Composição escolhida
Recorte da **frente do campus**, de oeste para leste, que é o que o fortalezense vê e reconhece:
Av. Washington Soares (duas pistas e canteiro) → calçada e gradil verde → jardim com fonte, estátuas e palmeiras imperiais →
**Reitoria verde, curva, com os arcos** → **Biblioteca** → **Praça Central** → **Centro de Convivência** (cúpula, torres azuis,
pórtico "UNIVERSIDADE DE FORTALEZA"). Em volta, a **mata** com algumas barras de blocos de aula (C, D, H, T, I, J, N) e um
estacionamento sob as árvores, só sugeridos. Escala de planta K ≈ 0,15 (os protagonistas crescem 1,4–1,55×); o jardim e a
avenida foram esticados para caber a fonte e as palmeiras. **Ficaram de fora** (longe demais, centenas de metros a leste):
ginásio, estádio, estacionamento solar, Bloco M e lago — ver dúvidas no relatório.

## Dúvidas abertas
1. Fachadas da Biblioteca e da ala leste–oeste da Reitoria (não aparecem nas fotos): brancas/cinza com fitas de janela, neutras.
2. Forma exata da segunda cúpula do CC e do térreo do tambor (só a aérea de longe).
3. O canteiro central da Washington Soares em frente à Reitoria (as pistas ficam ~40 m afastadas no OSM): feito como faixa de grama.
4. A passarela sobre a Washington Soares existe (texto), mas não achei foto: não modelada.
5. O conteúdo do mural do CC (só se vê que é colorido, com uma figura): feito como composição abstrata colorida.
