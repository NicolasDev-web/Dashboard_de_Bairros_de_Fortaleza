# Ficha — Estoril (Praia de Iracema, Fortaleza)

- **id:** `estoril`
- **Endereço:** Rua dos Tabajaras, 397, Praia de Iracema (OSM way 399555963; parecer CEPAM 059/2022).
- **Coordenadas:** −3,7190974, −38,516258.

## Rede nesta sessão
- Wikimedia, Wikipédia, API do OSM e Esri: 403 do proxy. `WebFetch`: falha de DNS (testado uma vez no Diário do
  Nordeste). Só o `WebSearch` respondeu, então **não há fotos**. Tudo abaixo vem de texto (WebSearch) e da planta do OSM
  já baixada (`osm.xml`, `osm-resumo.json`, `planta.png`).

## História (confirmada por texto)
- Construído entre **1920 e 1925** para o comerciante/coronel **José Magalhães Porto**, como residência de veraneio
  chamada **Vila Morena**, em homenagem à esposa, Francisca Frota Porto, a "Morena". A família diz que foi a primeira
  casa frente-mar e a primeira com piscina de Fortaleza (afirmação da família, sem confirmação independente).
- Construção original em **taipa**, com materiais europeus importados: portas com vidros franceses e **duas escadas
  helicoidais de ferro** feitas na Inglaterra (Wikipédia, via busca).
- **Segunda Guerra:** a família arrendou a casa aos norte-americanos (1944 ou 1945, as fontes divergem), que ali
  instalaram um **cassino/clube dos oficiais** (USO), com bailes, música e até peças da Broadway.
- **1948:** arrendada pelos portugueses Antônio Português e João Freire de Almeida, passa a se chamar **Estoril**:
  restaurante e bar, epicentro da boemia da Praia de Iracema.
- **Tombamento municipal:** Lei nº 6.199/1986 (projeto de lei 006/86); a poligonal de entorno foi atualizada em 2022.
- **Desabamento:** desapropriado pela Prefeitura (1992); em **abril de 1994**, depois de uma chuva forte, **a torre e
  parte da fachada desabaram**. A Prefeitura ergueu uma **réplica** "de mesmo estilo", em concreto armado e alvenaria,
  **com algumas modificações na planta**. Reaberto em **31/05/1995** como Centro Cultural da Praia de Iracema.
- Restaurações em 2008–2010 e reforma de ~R$ 983 mil (fachada, esquadrias, cobertura, piso, **impermeabilização das
  varandas**, escada nova, pintura acrílica externa).
- **Hoje:** desde 2017, sede da **Secretaria Municipal do Turismo de Fortaleza (Setfor)**; equipamento cultural da
  prefeitura com galeria e eventos.

## Arquitetura (confirmada)
- Estilo **eclético com predominância de elementos neocoloniais** (decreto/parecer municipal).
- **Dois pavimentos e uma torre**; **coberto por telha marselha** (Wikipédia, via busca).
- **Varandas** (citadas na reforma: impermeabilização das varandas).
- Implantação: **entre a Rua dos Tabajaras e o calçadão da Praia de Iracema** (legenda de foto da Alamy, via busca).

## Planta (OSM, `building:part` com alturas do cadastro da Sefin)
Eixo longo com rumo **105,5°** (o prédio corre de OESNO para LESSE). No referencial do prédio (u ao longo do eixo para
leste, v para o mar/norte; m):

| Parte | u | v | Altura OSM | Leitura |
|---|---|---|---|---|
| Corpo principal (L) | −1,2 a 8,6 (frente); ala norte 2,5 a 8,5 | −4,0 a 1,3; ala até 10,4 | 8,3 m, 3 níveis | sobrado de 2 pavimentos com telhado |
| **Torre** | 8,5 a 11,3 | −4,0 a −0,3 | **11,1 m**, 4 níveis | na quina sudeste do corpo, alinhada com a fachada sul |
| Bloco oeste | −7,6 a −3,9 | −3,2 a 3,3 | 8,3 m | segundo volume de 2 pavimentos, recuado 0,8 m |
| Térreos (2 partes) | −11,8 a 2,7; 8,5 a 10,3 | −4,0 a 9,9 | 3,7 m | volumes de 1 pavimento em volta dos sobrados (lidos como varandas com terraço) |
| Anexo leste | 11,2 a 22,0 | −4,0 a 3,6 | 4,0 m | pavilhão térreo |
| Anexo oeste | −18,8 a −8,7 | −8,4 a 2,3 | 2,9 m | volume baixo com uma parede em diagonal |

- Contorno total: ~41 × 15 m.
- **Fachada principal:** a sul, para a Rua dos Tabajaras (endereço), onde fica a torre. Normal da fachada a ~195°
  (SSO), ou seja, de frente para as câmeras da oficina, que vêm do sul. **Não é preciso girar a composição.**

## Entorno (OSM)
- **Rua dos Tabajaras:** `highway=living_street`, `surface=paving_stones` (rua compartilhada, revitalizada em 2020),
  ~21 m ao sul da fachada, a ~6° do eixo do prédio (aproxima-se do prédio para leste).
- **Ponto de táxi** na Tabajaras, a oeste (8 vagas).
- **Calçadão da Beira Mar** (`highway=pedestrian`, área): começa logo ao norte do prédio.
- **Praia** (Praia dos Crush / Aterrinho da Praia de Iracema / Praia do Lido) ~45 m ao norte; linha d'água a ~60 m.
- **Largo dos Tremembés** (praça com gramados) a leste (u > 35 m).
- **Ponte dos Ingleses:** a base fica a ~70–100 m a noroeste (OSM: x −102 a −44 m, y 50 a 178 m). Fora do disco; ela
  já faz parte do marco `praiaDeIracema` (`src/marcos/Praias.tsx`), então não entra aqui.
- Vizinhos do outro lado da Tabajaras: bares e casarões baixos (h 3–9 m: Pirata Bar, Lupus Bier, Laje da Praia, Casa
  Teresa & Jorge), fora do disco ou atrás das câmeras.

## Dúvidas (não confirmadas: ficaram neutras no modelo)
1. **Cores:** nenhuma fonte de texto cita a cor das paredes, frisos ou esquadrias. Paredes em **branco quente**
   neutro (`#fdebc4`, que na sombra azulada do site sai branco), frisos brancos, esquadrias em madeira escura. O placeholder antigo dizia "amarelo", também sem fonte.
2. **Forma da torre:** só se sabe que existe e tem 11,1 m (OSM). Mirante com vãos em arco e telhado piramidal de
   telha marselha é uma interpretação neocolonial.
3. **Varandas:** onde ficam e como são (arcadas, colunas, guarda-corpo de balaústres ou de ferro) não foi confirmado.
   As partes térreas do OSM viraram varandas em arcada com terraço por cima.
4. **Telhados:** "telha marselha" está confirmado; a forma (quatro águas) é interpretação.
5. **Anexos leste e oeste:** só o volume e a altura; cobertura e fachadas neutras.
6. **Frente do prédio até a Tabajaras** (~21 m): o que há ali (jardim, estacionamento, piso) não foi confirmado: piso
   neutro.
7. **Letreiro:** havia "Vila Morena" na fachada original (foto de 1989 citada pelo Diário do Nordeste); o letreiro
   atual não foi confirmado e ficou de fora.
8. **Coqueiros do calçadão:** comuns na orla, mas as posições não estão no OSM.

## Fontes
- Diário do Nordeste, "Com 100 anos, Estoril foi primeira casa com piscina, abrigo de soldados e bar boêmio em
  Fortaleza": https://diariodonordeste.verdesmares.com.br/ceara/com-100-anos-estoril-foi-primeira-casa-com-piscina-abrigo-de-soldados-e-bar-boemio-em-fortaleza-1.3644176
- Diário do Nordeste, tombamento atualizado (2022): https://diariodonordeste.verdesmares.com.br/ceara/predio-historico-do-estoril-tem-tombamento-atualizado-para-proteger-entorno-veja-o-que-muda-1.3392240
- Prefeitura/Secultfor, Parecer de Poligonal PT-CEPAM 059/2022: https://cultura.fortaleza.ce.gov.br/images/Parecer_de_Poligonal_PT-CEPAM_059-2022_compressed.pdf
- Wikipédia, "Estoril (Fortaleza)": https://pt.wikipedia.org/wiki/Estoril_(Fortaleza)
- Prefeitura, obras de reforma e restauro: https://fortaleza.ce.gov.br/noticias/obras-de-reforma-e-restauro-do-estoril-devem-ser-concluidas-em-novembro-deste-ano
- O Povo, "A arquitetura literomusical do Estoril": https://mais.opovo.com.br/colunistas/marilia-lovatel/2024/10/12/a-arquitetura-literomusical-do-estoril-cronica-convite.html
- Visit Fortaleza: https://visit-fortaleza.com/experiencias/estoril/
- Alamy (legenda da foto): https://www.alamy.com/estoril-is-a-building-that-houses-the-fortaleza-municipal-tourism-secretariat-located-between-the-streets-of-tabajaras-and-the-iracema-beach-promenad-image684247583.html
- ipatrimonio: https://www.ipatrimonio.org/fortaleza-restaurante-estoril/
- OpenStreetMap: way 399555963 e `building:part` 1080405681, 1080405979, 1080405866, 1080405728, 1080405804,
  1080405839, 1080406036; Rua dos Tabajaras (way 658953314); Calçadão da Beira Mar (relação 12470576).
