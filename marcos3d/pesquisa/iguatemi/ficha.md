# Ficha — Shopping Iguatemi Bosque (Fortaleza)

Especialista Iguatemi, outubro de 2026. Pesquisa para refazer do zero a miniatura `iguatemi` (`src/marcos/Iguatemi.tsx`).

## Limitação desta sessão (importante)

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

## Composição escolhida para a miniatura

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
