# Ficha — Shopping Iguatemi Bosque (Fortaleza)

Especialista Iguatemi, outubro de 2026. Pesquisa para refazer do zero a miniatura `iguatemi` (`src/marcos/Iguatemi.tsx`).

## Limitação da primeira sessão (já superada; ver "Atualização com rede liberada")

- **Rede:** o proxy desta sessão recusou todo acesso direto: `curl` para `api.openstreetmap.org`, `overpass-api.de`, `upload.wikimedia.org` e `pt.wikipedia.org` deu `403` no CONNECT, e o `WebFetch` não resolveu nenhum desses hosts (`ENOTFOUND`). **Só o `WebSearch` funcionou.**
- **Consequências:**
  - não consegui baixar a planta do OSM de novo. Usei o contorno que a sessão anterior traçou da planta do OSM (`MASSA` e `BLOCOS` no `Iguatemi.tsx` antigo, em pixels de uma imagem com norte para cima e 200 m = 285 px). Esse contorno dá o rumo e as proporções gerais, mas não detalhe;
  - **não há fotos de referência** (`ref-N.jpg`): o Wikimedia não foi alcançável. A aparência abaixo vem só de textos (matérias, sites de arquitetos e de engenharia). Os pontos que dependeriam de foto ficaram neutros e estão na lista de dúvidas.

## O que é

- Shopping aberto em 1982, um dos primeiros do Ceará, na Av. Washington Soares, 85, bairro Edson Queiroz, encostado no Parque Estadual do Cocó.
- Em 29/03/2022, nos 40 anos, passou a se chamar **Shopping Iguatemi Bosque**. O motivo declarado foi alinhar a marca com os outros shoppings do Grupo JCC (por exemplo, o Bosque dos Ipês, em Campo Grande). **O rebatismo não trouxe obra de arquitetura:** não achei nenhuma reforma de fachada ligada ao novo nome. O anúncio dos 40 anos fala em R$ 33 milhões para arquitetura e infraestrutura, sem detalhar as obras.
- ABL de cerca de 92–93 mil m² depois da 6ª expansão.

## Planta e rumo (do contorno OSM da sessão anterior)

- Escala da imagem: 200 m = 285 px, ou seja, 0,70 m/px. A massa ocupa ~600 × 630 px, cerca de **420 × 440 m** com os estacionamentos colados.
- **Eixo maior NO → SE, rumo ~133°**: é a direção da própria Av. Washington Soares, que começa no shopping e segue para o sudeste (rumo ~140° até a Unifor).
- **A avenida corre pelo lado sudoeste/sul**, onde fica a frente principal. **A mata do Cocó encosta no norte e no leste.** O texto do tour (`dashboard/historias.js`) diz o mesmo: "A mata do Parque do Cocó encosta no prédio ao norte e a leste".
- **A ponta oeste da massa é arredondada** no traçado do OSM.
- **Edifício-garagem no lado sudeste** e **estacionamentos de superfície a nordeste e a leste.**

## Arquitetura: os elementos confirmados

### 1. A 6ª expansão (abril de 2015) e o "Garden Court"

- **Projeto:** LaGuarda.Low (Dallas), com design concept de Pablo Laguarda. Ganhou o Prêmio Abrasce 2015 na categoria Expansão/Revitalização.
- **Programa:** 31 mil m² de ABL, cerca de 200 lojas em dois pisos novos e cerca de 2.600 vagas novas, com um segundo edifício-garagem de seis pavimentos.
- **Conceito (texto do próprio escritório):** um "loop" fecha as pontas da planta em L e forma um **pátio-jardim central (Garden Court)**. A cobertura dá ao pátio um ar de lugar externo, "como se estivesse sob uma grande pérgola". A luz entra por claraboias e por um **clerestório contínuo**. A praça de restaurantes fica colada ao Garden Court.
- **Cobertura de madeira laminada colada (MLC):**
  - **cerca de 4.500 m², chamada de "a maior cobertura de madeira do Brasil"**;
  - abeto austríaco GL28, pré-fabricado pela Moretti Interholz (Itália) e montado pela Carpinteria;
  - **vão livre de 48 m**, cobertura **curvilínea**, com peças de 20 × 140 cm e 20 m de comprimento **curvadas nas duas direções**;
  - cerca de 1.200–1.300 m³ de madeira e cerca de 6 meses de montagem (2013–2014);
  - por cima, **policarbonato alveolar** (e, segundo uma fonte, telhas metálicas);
  - revitalizada cerca de dez anos depois.
- **Fachada da expansão:** "nova fachada de **vidro verde fixado em estrutura metálica branca**", com "**pé-direito alto dos três pavimentos na entrada principal**" e "revestimento em vidro e **alumínio composto perfurado**". A fachada é atribuída aos arquitetos locais Nelson Serra e Paulo Arraes.

### 2. A ampliação anterior (anos 1990)

- **Fachada de vidro** de cerca de 800 m², protegida por uma **marquise** de cerca de 346 m².
- A marquise se apoia num **único elemento estrutural de ~10 m em perfis tubulares de aço** (o "cone"), que leva as cargas de vento e de peso até a fundação. Uma fonte diz que essa fachada é voltada para o sul.
- Em 1992, a 1ª expansão trouxe uma **"coberta de vidro em área de passeio interno"**, ou seja, uma claraboia longa sobre o corredor.

### 3. Entorno

- Parque do Cocó (mata densa) colado ao norte e ao leste.
- Av. Washington Soares na frente, com canteiro central.
- Estacionamentos de superfície e edifícios-garagem ("Estacionamento L5 – deck próximo aos cinemas").
- **Torres:**
  - não achei torre comercial que faça parte da imagem do shopping;
  - os "superprédios" residenciais anunciados para o estacionamento estão com obras previstas para 2026: **não entram** na miniatura.


## Atualização com rede liberada (passada de referências, 23/10/2026)

### Fontes novas
- **Planta real (OSM, API 0.6):** `https://api.openstreetmap.org/api/0.6/map?bbox=-38.4925,-3.7590,-38.4850,-3.7520` (© colaboradores do OSM, ODbL). O shopping está mapeado em detalhe, com o contorno inteiro (relação 15800212) e ~40 `building:part` com altura vinda do cadastro da Prefeitura (`pmfsefin:idedif`).
- **Vista aérea (só para olhar, nunca entra no modelo):** mosaico Esri World Imagery (`server.arcgisonline.com/.../World_Imagery/MapServer/tile/{z}/{y}/{x}`, z17–19), alinhado com o OSM (conferido com sobreposição). Recortes salvos como `ref-3/4/5-*.png`.
- **Wikimedia Commons:** a categoria `Iguatemi_Fortaleza` e as vizinhas (`Interior_of_Iguatemi_Fortaleza`, `UCI_Kinoplex_Iguatemi_Fortaleza`, `Avenida_Washington_Soares`, `Edson_Queiroz_(Fortaleza)`, `Parque_do_Cocó`) **não têm nenhuma foto do exterior**. Só interiores (corredores, cinema) e um feirão de carros no estacionamento. A Wikipédia (pt) do Iguatemi não tem imagem. Observação técnica: miniaturas de 640 px dão erro 400 (tamanho fora da lista padrão); 330, 500 e 960 px funcionam, com pausas de vários segundos entre pedidos para não levar 429.
- `ref-1.jpg`: `File:Iguatemi_3.JPG` (interior: abóbada de vidro com nervuras brancas sobre um átrio de dois pisos). `ref-2.png`: `File:Feirão_Iguatemi.png` (estacionamento de superfície com árvores).

### O que a planta real mudou (substitui a seção "Planta e rumo" acima)
Coordenadas em metros em volta de (−3,7554; −38,4888), x = leste, z = sul.
- **Não é um "L" com ponta arredondada.** O complexo tem ~430 × 450 m e estas peças, todas confirmadas na planta e na vista aérea:
  1. **Espinha** (galeria original, OSM 13,5 m): barra longa no rumo ~124° (NO → SE), de (−57, −107) a (210, 62). No telhado corre uma **faixa central com nervuras transversais**: a claraboia do corredor (1992).
  2. **Garden Court (2015):** a cobertura é uma **gota (lágrima)** de ~125 × 55 m, com a ponta para o NNO em (−89, −1) e a parte redonda para o SSE em (−20, 90). Área ≈ 4.500 m², **igual à área declarada da cobertura de madeira**. Vista de cima: um **anel branco opaco** (telha metálica) de ~10 m e, dentro, um **campo bege translúcido** (policarbonato) onde aparecem as linhas da grelha de madeira. A largura interna (~45–50 m) bate com o **vão de 48 m**.
  3. **Ala curva** (OSM 19,4 m, 6 níveis): faixa curva de ~20 m de largura e ~170 m de comprimento colada no lado oeste da gota, telhado cinza.
  4. **Proa de vidro:** na ponta sul da ala curva, um **triângulo de ~40 × 60 m com grelha metálica branca** sobre vidro, apontado para o sul (para a praça-jardim e a Washington Soares). É o candidato mais forte para a "fachada de vidro verde em estrutura metálica branca, pé-direito triplo" de 2015.
  5. **Rotunda oeste:** bloco em **leque (quase um quarto de círculo) de raio ~95 m**, telhado branco liso com um degrau concêntrico ~12 m para dentro da borda. Altura não está no OSM (a sombra indica um bloco alto); usei 15 m. **Uso desconhecido.**
  6. **Bloco da lente** (OSM 16,5 m): retângulo de 70 × 45 m com uma **claraboia de vidro em forma de lente** (~34 × 13 m) no telhado.
  7. **Bloco de vidro sudeste** (OSM 21 m): a face sudoeste é um **grande plano de vidro escuro inclinado**, com **aletas brancas triangulares** ao longo da borda e um arco branco na ponta sudeste. Voltado para a Washington Soares, é o candidato para a "fachada de vidro dos anos 1990 voltada para o sul" com a marquise sobre o cone.
  8. **Bloco do cinema** (OSM 26,2 m, o mais alto; o UCI Kinoplex fica no nível 3).
  9. **Edifício-garagem** (OSM `parking=multi-storey`, 4 níveis, 12,1 m) a leste do cinema.
  10. **Miolo sudeste:** blocos de 15–17 m com uma **pirâmide de vidro** (~14 m), uma **cúpula de vidro sobre base octogonal** (~22 m) e claraboias em grelha.
  11. **Bloco norte** (OSM 8,8–12,3 m): telhados brancos longos com nervuras, entre a espinha e a mata.
  12. **Embasamento** de 7,6 m (relação 15800223) ligando tudo, com áreas técnicas escuras entre os volumes.
- **Entorno real:** a **Washington Soares corre a sul**, no rumo ~100° (quase leste–oeste), com duas pistas de 3 faixas. Uma via de serviço contorna a frente sul. Uma **via anelar contorna o norte**, colada à mata. O **grande estacionamento de superfície fica a nordeste**, entre a espinha e a mata, e há outros a leste. A **mata do Cocó cobre o norte e o leste.** Há um **jardim com caminhos curvos e palmeiras** a sudoeste, entre a rotunda e a proa.
- **Correções da ficha anterior:**
  - a avenida não corre a 135° pelo sudoeste, e sim ~100° pelo sul;
  - a "ponta oeste arredondada" é o leque da rotunda;
  - o Garden Court não fica no meio de um "L", e sim entre a ala curva, o bloco da lente e o miolo sudeste.

### Dúvidas que continuam (sem foto do exterior)
1. Cor e acabamento das fachadas externas: ficaram neutras (branco quente, juntas de painel discretas).
2. Uso e altura da rotunda oeste.
3. Se a proa é a entrada de 2015 e onde exatamente fica o cone dos anos 1990: pus a marquise no meio da face sudoeste do bloco de vidro sudeste, de frente para a via de serviço.
4. O letreiro: posição e logotipo não verificados, então **não modelei letreiro**.
5. Desenho exato da grelha de madeira: modelei uma malha de arcos transversais e terças longitudinais, desenhada na própria superfície (vista através do policarbonato).

## Composição escolhida na primeira passada (sem planta real; substituída, ver relatório)

- O complexo real tem ~420 m e não cabe com detalhe num disco de 67 m. Em K ≈ 0,075, tudo vira um tapete de lajes brancas, e esse era o defeito do modelo antigo.
- **Escolhi condensar:** manter a topologia real (anel de galerias em "L + loop" em volta do Garden Court) e o rumo real, encolhendo a planta (~420 → 58 m) mais do que as alturas (galerias de 7 m, abóbada de 11,5 m).
- **Os ícones ficam grandes e detalhados:**
  1. **a cobertura de madeira curvilínea do Garden Court**, peça central e a mais reconhecível vista de cima: arcos de MLC sobre policarbonato leitoso, apoiados num clerestório de vidro;
  2. **a fachada principal de 2015**, um pórtico branco de três pavimentos com vidro verde em grelha metálica branca, painéis de alumínio composto e o letreiro IGUATEMI / BOSQUE, de frente para a Washington Soares;
  3. **a esquina de vidro dos anos 1990**, com a marquise triangular sobre o cone de tubos de aço, voltada para o sul;
  4. **a claraboia longa de vidro sobre o corredor** (1992), alinhada com o Garden Court, para formar o "eixo de luz" visto de cima.
- **O resto fica sugerido:**
  - o edifício-garagem de 5 níveis (1,15 m cada) no lado leste/sudeste;
  - o estacionamento de superfície da frente;
  - um trecho da Washington Soares com canteiro central e carros;
  - a mata do Cocó em faixa densa no norte e no leste.
- **Rumo:** a avenida corre a 135° (NO → SE) no lado sudoeste. A frente do shopping olha para o sudoeste. A esquina de vidro olha para o sul. A mata fica a nordeste.

## Cores e materiais (escolhidos a partir dos textos)

| Elemento | Cor / material na miniatura | Base |
|---|---|---|
| Galerias (reboco) | branco quente `#ebe6dc`, fosco | fachadas claras (sem foto: neutro) |
| Alumínio composto perfurado | cinza-prata claro `#d3d5d2`, metal 0,25 | texto da fachada 2015 |
| Estrutura metálica da fachada | branco `#f4f5f2` | "estrutura metálica branca" |
| Vidro da fachada 2015 | verde `#5f9c8d`, rugosidade 0,08 | "vidro verde" laminado |
| Madeira MLC | mel `#c4925a` | abeto laminado colado |
| Cobertura do Garden Court | policarbonato leitoso `#eef2ee` | "policarbonato alveolar" |
| Aço tubular do cone | cinza-claro, metal 0,4 | perfis tubulares |
| Letreiro | letras grafite `#3a4047` | **sem fonte**: neutro |

## Dúvidas abertas (não confirmadas; simplificadas de forma neutra)

1. **Forma exata da cobertura de madeira** (desenho da grelha, se é onda ou abóbada, onde ficam os apoios). Modelei uma abóbada de dupla curvatura com arcos transversais e terças longitudinais curvas, com base em "curvilínea", "vão de 48 m" e "peças curvadas nas duas direções". Sem foto, o desenho exato da malha é hipótese.
2. **Posição exata da entrada principal de 2015 e do letreiro.** Pus no meio da frente da Washington Soares. A logomarca real (fonte e cor) não foi verificada: usei letras de bastão grafite.
3. **Rotunda / ponta oeste arredondada:** vem do traçado do OSM; não sei o que é por dentro. Fica como volume liso, com pilastras.
4. **A orientação "voltada para o sul" da fachada dos anos 1990** vem de uma fonte só.
5. **Número e posição dos edifícios-garagem:** representei um, de 5 níveis.
6. **Fotos de referência:** nenhuma foi baixada (rede bloqueada). Recomendo, numa próxima sessão com acesso, conferir com fotos do Commons a fachada principal e a vista aérea da cobertura de madeira.

## Fontes (consultadas via WebSearch)

- LaGuarda.Low, *Iguatemi Fortaleza Expansion*: https://www.laguardalow.com/iguatemi-fortaleza-expansion/
- Revista PROJETO, *La Guarda Low, Carpinteria e Moretti Interholz: Cobertura do Shopping Iguatemi, Fortaleza*: https://revistaprojeto.com.br/noticias/guarda-low-carpinteria-moretti-interholz-cobertura-shopping-iguatemi-fortaleza/
- Estruturas de Madeira (blog), *Shopping Iguatemi de Fortaleza – a maior estrutura de madeira do Brasil em MLC*: http://estruturasdemadeira.blogspot.com/2014/04/shopping-iguatemi-fortalezaa-maior.html
- Madeira e Construção: https://madeiraeconstrucao.com.br/estrutura-de-madeira-no-shopping-iguatemi-de-fortaleza-e-destaque-nacional/
- Timbau Estruturas: https://timbauestruturas.com.br/project/shopping-iguatemi-fortaleza/
- Mega Moveleiros, revitalização: https://megamoveleiros.com.br/publicacoes/shopping-iconico-de-construcao-em-madeira-e-revitalizado-em-fortaleza
- Tecnologia e Vidro, *Shopping Iguatemi de Fortaleza aposta em fachada de vidro*: https://vidros.inf.br/shopping-iguatemi-de-fortaleza-aposta-em-fachada-de-vidro/
- Unicamp/FEC, *Ampliação Shopping Iguatemi – estruturas tubulares*: https://www.fec.unicamp.br/~estruturastubulares/iguatemifortaleza.htm
- Agência Fortaleza de Notícias, *Expansão Iguatemi* (2015): https://agenciafortalezadenoticias.blogspot.com/2015/03/expansao-iguatemi.html
- Engexpor, *Iguatemi Fortaleza Shopping*: https://engexpor.com/en/project/iguatemi-fortaleza-shopping/
- Diário do Nordeste, *Iguatemi prevê superar 2 mi de pessoas por mês*: https://diariodonordeste.verdesmares.com.br/negocios/iguatemi-preve-superar-2-mi-de-pessoas-por-mes-1.1224254
- Diário do Nordeste, *Superprédios de luxo do Iguatemi iniciam obras no começo de 2026*: https://diariodonordeste.verdesmares.com.br/opiniao/colunistas/victor-ximenes/superpredios-de-luxo-do-iguatemi-iniciam-obras-no-comeco-de-2026-1.3719101
- Nosso Meio, *Iguatemi Fortaleza chega aos 40 anos* (rebatismo): https://nossomeio.com.br/pioneiro-no-mercado-cearense-iguatemi-fortaleza-chega-aos-40-anos-de-atuacao-e-anuncia-novidades/
- Buser, *Go Bigger Park Iguatemi Bosque* (deck L5, perto dos cinemas): https://www.buser.com.br/destinos/pontos-turisticos/ce/fortaleza/go-bigger-park-iguatemi-bosque
- Contorno da planta: OpenStreetMap (© colaboradores do OSM, ODbL), traçado pela sessão anterior no `Iguatemi.tsx` antigo (`git show HEAD:marcos3d/src/marcos/Iguatemi.tsx`).
