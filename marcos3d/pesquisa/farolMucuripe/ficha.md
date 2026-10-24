# Ficha — Farol do Mucuripe (Farol Velho)

- **id:** `farolMucuripe`; **local:** lat −3,7078217, lng −38,4704039 (bairro Cais do Porto / Serviluz, junto ao Titanzinho).
- **Rede nesta sessão:** Wikimedia, Wikipédia, API do OSM e Esri bloqueados (403 do proxy); `WebFetch` falha. Só o
  `WebSearch` respondeu, então **não há foto olhada**: a forma vem do OSM já baixado (`osm.xml`, `planta.png`) e de
  descrições em texto. Tudo o que não está confirmado abaixo está marcado e repetido nas dúvidas.

## História (confirmado em texto)
| Fato | Fonte |
|---|---|
| Planta aprovada em 1826 (outra fonte: 1829); construído entre **1840 e 1846** | Diário do Nordeste; tag `description` do OSM |
| Construído **por pessoas escravizadas** | Diário do Nordeste (2022), O Povo (2024) |
| Inaugurado em 1846 (as fontes divergem: 21/02 ou 17/11/1846) | faroisbrasileiros.com.br; Fortaleza Nobre |
| Luz fixa branca, aparelho catóptrico **a 9,30 m do solo e 33,46 m acima da maré máxima** (o terreno fica ~24 m acima do mar, num alto) | faroisbrasileiros.com.br |
| Reforma em 1872; mais tarde uma torre metálica de seção circular montada **no centro da estrutura octogonal** de alvenaria, que servia de moradia aos faroleiros | faroisbrasileiros.com.br; OSM `name:de` "(1872)" |
| **Desativado em 1957** (obsoleto); substituído por um farol de concreto de 22 m (1958), a quase 3 km | Diário do Nordeste; Fortaleza Nobre |
| Restaurado em 1981–82, abrigou o **Museu do Jangadeiro** (hoje chamado Museu do Farol); **tombado pelo Estado em 1983** (decreto 16.237) | Secult-CE; Diário do Nordeste; `dashboard/historias.js` |
| Interditado pela Defesa Civil (2019); **a cúpula desabou em 20/07/2021** | O Povo (2021) |
| Estudos arqueológicos (2023) acharam a estrutura militar por baixo (acredita-se que foi erguido sobre o antigo Forte de São Luís) | O Povo (2023) |
| **Restauração entregue em 05/10/2025** (R$ 2,6–2,9 mi): fachada, **almeias**, **cúpula**, adornos, pisos, **nova escadaria de acesso, varanda e lampadário**, iluminação; parquinho e academia ao ar livre na frente | Setur-CE; gcmais; A Notícia do Ceará |
| Está no brasão/bandeira do Ceará | Setur-CE; `historias.js` |

## Forma e medidas
- **OSM** way/709260459 (`man_made=lighthouse`, `height=11.8`, `building:levels=4`): planta **octogonal de ~10 m**
  (9,9 × 9,7 m). Parte central way/1161472440 (`building:part`, h 11,8): **círculo de ~3,2 m** — a torre do meio.
- Texto: "torre octogonal de alvenaria"; "fachada composta por oito paredes de tamanhos iguais"; "elevação das paredes
  sobre a estrutura octogonal do Fortim com **arcos plenos** e **janelas superiores de verga reta**" (neoclássico) e
  partes metálicas de influência neogótica; "almeias" (ameias) no coroamento; cúpula; varanda; lampadário; escada
  helicoidal central de ferro.
- Estilo citado como "barroco" por duas fontes e eclético por outra (divergência; não muda a massa).
- **Interpretação usada no modelo** (sem foto): corpo octogonal largo de alvenaria (o "volume em volta", a antiga casa
  dos faroleiros) com arcos plenos e coroamento de ameias, e a torre estreita saindo do meio, com janelas de verga reta,
  varanda com guarda-corpo, lanterna envidraçada de ferro e cúpula. Ou seja, **torre com a base mais larga**.

## Cores atuais (pós-2025)
- **Amarelo com frisos brancos** — só numa legenda de foto do Diário do Nordeste (05/10/2025). Cúpula clara e esquadrias
  avermelhadas aparecem na descrição da galeria, **não confirmadas** em texto.
- Usado: reboco amarelo `#eec25a`, frisos/ameias/cúpula brancos `#f6f3ea`, esquadrias de madeira vermelho-escura
  `#8a3a2c` (neutro entre "vermelho" e madeira), ferro da lanterna e do guarda-corpo grafite `#2e3437`.

## Entorno (OSM e texto)
- **Recinto:** o farol fica no meio de um terreno gramado murado (way/361267803, `landuse=grass` + `barrier=wall`),
  octogonal irregular de ~66 m. **Escadaria em zigue-zague** no lado oeste (way/1083912334, `highway=steps`) chegando do
  acesso da Av. Vicente de Castro, e caminho reto até a face oeste do farol → o farol está num **platô mais alto** que a
  rua (coerente com os 24 m acima do mar).
- **Serviluz/Titanzinho:** casario denso de 1 e 2 pavimentos (h 2,8–6,6 m no OSM) cercando o recinto a leste, sul e
  norte (`landuse=residential`, "Titanzinho"); ruas Amâncio Filomeno, Titã (travessa de pedestre), Zezé Diogo.
- **Mar:** linha de costa (way/394990752) a ~85–110 m ao **norte/nor-nordeste**; faixa de **rocha** (`natural=bare_rock`,
  way/1086690986) na costa a NNO — as pedras do Titanzinho.
- **Porto do Mucuripe:** `landuse=industrial`, "Cais do Porto", a partir de ~50–70 m a **oeste**, depois da Av. Vicente
  de Castro (3 faixas).
- **Farol novo** (71,1 m, inaugurado em set/2017) fica no **Vicente Pinzón**, longe do recorte; o de concreto de 1958
  (22 m, faixas pretas e brancas) fica a ~3 km. **Nenhum dos dois cabe no disco**: ficam de fora.

## Dúvidas abertas
1. Sem foto: a divisão em "corpo octogonal + torre central" e as proporções de altura de cada parte são interpretação do
   OSM (10 m e 3,2 m; h 11,8 m) e do texto.
2. Cores: amarelo e branco vêm de legenda de foto; a cor das esquadrias e da cúpula não foi confirmada.
3. Número e posição das portas e janelas por face, desenho das ameias e do guarda-corpo da varanda.
4. Altura do platô sobre a rua e o desenho da escadaria nova de 2025 (o OSM mostra a escadaria antiga em zigue-zague).
5. Parquinho e academia de 2025: "em frente ao farol", sem posição exata (não modelados com detalhe).
6. Casario: cores e coberturas de cada casa são genéricas do Serviluz (lajes com caixa d'água, telha de barro), não
   levantadas casa a casa.

## Fontes (URL)
- https://diariodonordeste.verdesmares.com.br/ceara/degradado-e-interditado-ha-5-anos-farol-do-mucuripe-tem-r-26-mi-para-reforma-sem-data-de-inicio-1.3488468
- https://diariodonordeste.verdesmares.com.br/verso/farol-do-mucuripe-um-dos-simbolos-do-ceara-sera-reaberto-neste-domingo-5-veja-imagens-1.3696861
- https://diariodonordeste.verdesmares.com.br/ceara/farol-do-mucuripe-a-historia-de-um-dos-simbolos-do-ceara-1.3702488
- https://mais.opovo.com.br/reportagens-especiais/2021/07/20/decadencia-e-abandono--cupula-do-farol-velho-do-mucuripe-desaba.html
- https://mais.opovo.com.br/reportagens-especiais/2025/10/10/farol-do-mucuripe-a-luz-que-faz-brilhar-os-olhos-do-ceara.html
- https://www.opovo.com.br/noticias/fortaleza/2023/08/16/estudos-arqueologicos-desvendam-estrutura-militar-sob-o-farol-do-mucuripe.html
- https://www.setur.ce.gov.br/2025/10/06/simbolo-do-ceara-governo-do-estado-entrega-farol-do-mucuripe-restaurado-a-populacao-cearense/
- https://www.secult.ce.gov.br/farol-do-mucuripe/
- http://faroisbrasileiros.com.br/farois/farol%20mucuripe.html
- http://www.fortalezanobre.com.br/2013/01/farol-do-mucuripe-o-velho-e-o-novo.html
- https://gcmais.com.br/noticias/2025/10/05/farol-do-mucuripe-e-reaberto-apos-reforma-e-volta-a-ser-atrativo-turistico-e-cultural-em-fortaleza
- https://anoticiadoceara.com.br/farol-do-mucuripe-e-reaberto-apos-obras-de-restauracao-em-fortaleza/
- https://www.portalin.com.br/coberturas/capitania-dos-portos-do-ceara-e-grupo-j-macedo-inauguram-novo-farol-do-mucuripe/
- OSM (arquivo local `osm.xml`): ways 709260459, 1161472440, 361267803, 1083912334, 394990752, 1086690986, 305985559, 449468499.
