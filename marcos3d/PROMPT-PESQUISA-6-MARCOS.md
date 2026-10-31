# Pesquisa de referências: 6 marcos de Fortaleza para miniaturas 3D

## Contexto
- O painel "Bairros de Fortaleza" (repositório `NicolasDev-web/Dashboard_de_Bairros_de_Fortaleza`) tem um tour 3D.
  Em cada bairro, a câmera voa até miniaturas dos lugares mais conhecidos.
- Cada miniatura é uma maquete num disco de **67 m de diâmetro**, modelada no Blender: o prédio principal, os 2 ou 3
  elementos que o tornam reconhecível e ~60–70 m do entorno (rua, praça, árvores).
- A pergunta que guia tudo é: **"alguém de Fortaleza reconhece este lugar?"**
- Quem vai modelar é outro agente, **sem acesso a OpenStreetMap, Wikimedia, Wikipédia ou imagem de satélite**. Ele só
  terá o que você entregar. Por isso, além dos arquivos, a **descrição em texto precisa ser concreta**: medidas,
  contagens, formas e cores.

## Os 6 lugares
| id | Lugar | Bairro | lat, lng do pino |
|---|---|---|---|
| `igrejaFatima` | Igreja (Santuário) de Nossa Senhora de Fátima, Av. Treze de Maio, 200 | Fátima | −3.7524955, −38.5266562 |
| `mosteiroSaoBento` | Mosteiro de São Bento (beneditinos) | São Bento | −3.8510433, −38.4807210 |
| `casaAlencar` | Casa de José de Alencar (UFC) | José de Alencar | −3.8124000, −38.4774000 |
| `mercadoAerolandia` | Mercado da Aerolândia | Alto da Balança | −3.7685259, −38.5170066 |
| `centroEventos` | Centro de Eventos do Ceará, Av. Washington Soares | Edson Queiroz | −3.7645320, −38.4804211 |
| `ccbj` | Centro Cultural Bom Jardim (CCBJ) | Granja Lisboa (Grande Bom Jardim) | −3.7859455, −38.6097667 |

Confira se o pino cai mesmo no lugar. Se o prédio estiver deslocado, dê a coordenada certa do prédio principal.

### O que já se sabe e o que mais importa descobrir
1. **Igreja de Fátima.**
   - Já se sabe:
     - obra de 1954–1955, paróquia em 1955, planta **em cruz**;
     - nave com **12 janelas** de vitrais simples (verde, branco e vermelho) e **fachada com 15 vitrais** das
       aparições;
     - na **torre principal**, um **terço com as contas de vidro colorido**;
     - em frente, do outro lado da avenida, a **Praça Pio IX** com a **estátua de ~15 m** de N. Sra. de Fátima
       (Franciné, 2008, restaurada em 2025).
   - Descubra:
     - forma e altura da torre e onde fica (no eixo da fachada?), e onde está o terço;
     - composição da fachada, telhado, cores;
     - forma, cores e pedestal da estátua;
     - desenho da praça e da avenida entre as duas.
2. **Mosteiro de São Bento.**
   - Já se sabe: "no alto do terreno"; missa com canto gregoriano e em latim; no Ano-Novo os moradores sobem até lá
     para ver os fogos; os monges vieram de Olinda em 1993.
   - Descubra:
     - o conjunto (igreja, campanário, claustro, alas dos monges);
     - o relevo (morro? ladeira? escadaria?);
     - materiais e cores, vegetação, acesso.
3. **Casa de José de Alencar.**
   - Já se sabe: a casa onde o escritor nasceu; pertence à UFC; aberta à visitação.
   - Descubra:
     - a casa (tipo, telhado, alpendre, portas e janelas, cores);
     - o que mais existe no sítio (ruínas, museu, anexos, lagoa ou riacho, árvores), com as distâncias entre eles.
4. **Mercado da Aerolândia.**
   - Já se sabe: dos anos 1940, feito com **metade da estrutura de ferro** do antigo Mercado da Carne, importada da
     França; a outra metade é o Mercado dos Pinhões, no Centro.
   - Descubra:
     - a estrutura de ferro: número de vãos, colunas, tesouras, forma da cobertura, lanternim;
     - cores (compare com o Mercado dos Pinhões);
     - medidas, fechamentos, o que tem em volta (rua, feira, estacionamento).
5. **Centro de Eventos do Ceará.**
   - Já se sabe: recebe as grandes feiras e congressos, na Av. Washington Soares.
   - Descubra:
     - o complexo é muito maior que o disco: qual recorte conta a história (a fachada principal vista da avenida?);
     - forma das coberturas, entradas, cores, letreiros, estacionamentos;
     - medidas dos pavilhões.
6. **CCBJ.**
   - Já se sabe: centro cultural de base comunitária do Governo do Estado; formação artística e digital dos jovens do
     Grande Bom Jardim.
   - Descubra:
     - os prédios (teatro, salas, praça), fachadas, **cores, murais e grafites**;
     - letreiro, quadra, árvores, a rua.

## O que entregar para cada lugar (pasta `marcos3d/pesquisa/<id>/`)
1. **`osm.xml`: a planta do OpenStreetMap**
   - API 0.6, numa caixa de ~±0,0012° em volta do ponto:
     `https://api.openstreetmap.org/api/0.6/map?bbox=<lng−0.0012>,<lat−0.0012>,<lng+0.0012>,<lat+0.0012>`.
   - Se a API falhar, use o Overpass ou a exportação do site do OSM, e diga qual usou.
2. **Fotos, 3 a 5**, de preferência do **Wikimedia Commons** (licença livre).
   - Ângulos diferentes: fachada principal de frente, perspectiva ou lateral, detalhe do elemento icônico e, se
     houver, uma vista aérea.
   - Salve em 1280 px como `ref-1.jpg` … `ref-5.jpg`.
   - Fotos de outros sites: só o link, sem baixar.
3. **`ref-aerea.jpg`**: um recorte de imagem de satélite (Esri World Imagery ou Google), zoom ~18–19, centrado no
   ponto, com o norte para cima. Diga a escala, por exemplo "a imagem tem ~150 m de largura".
4. **`ficha.md`**, no formato abaixo.

As fotos e a imagem aérea **não entram no modelo**: servem só para quem modela olhar.

## Formato da `ficha.md`
```markdown
# Ficha: <nome do lugar>

## Localização
Coordenada do prédio principal; se o pino estiver errado, diga quanto e para onde.

## O que as fontes confirmam
História curta (datas, autor do projeto, reformas) com o link de cada fonte.

## Planta (OSM e satélite)
Metros a partir do ponto: x = Δlng · cos(lat) · 111320 (leste); y = Δlat · 110540 (norte).
- Prédio principal: way do OSM, dimensões (comprimento × largura), rumo da fachada principal em graus a partir do norte,
  `height` / `building:levels` / `building:part` se houver.
- Outros volumes do conjunto, com posição e medidas.
- Entorno até ~70 m: ruas (nome, largura, mão, piso), praças, calçadas, estacionamentos, água, árvores e muros.
- Se o prédio não estiver no OSM, estime pela imagem aérea e diga que é estimativa.

## Descrição visual (para quem não vê as fotos)
- Forma geral e proporções: comprimento × largura × altura (estimadas), número de pavimentos.
- Cada fachada visível: quantos vãos, janelas, arcos e portas, e como se repetem; marquises, beirais, colunas,
  frontões.
- Cobertura: tipo (duas águas, laje, abóbada, metálica…), cor e material.
- Torre, cúpula, campanário ou estrutura especial: forma, seção, altura estimada, remate.
- Materiais e cores, com o **hex aproximado** de cada cor principal (paredes, telhado, esquadrias, detalhes).
- Os 2 ou 3 elementos que fazem alguém de Fortaleza reconhecer o lugar, em ordem de importância.
- O que fica na frente e em volta: praça, piso, bancos, postes, árvores (espécie, se souber: coqueiro, oitizeiro,
  mangueira, palmeira-imperial…), carros, letreiros.
- De que lado o prédio costuma ser fotografado (a "vista clássica").

## Referências
| arquivo | URL direta | autor / licença | de onde foi tirada (direção) | o que mostra |

## Dúvidas abertas
O que não deu para confirmar.
```

Marque a origem de cada informação: (OSM), (foto ref-N), (satélite), (texto: link) ou (estimativa).

## Regras
- **Não invente.** O que não der para confirmar vai para "Dúvidas abertas". Uma estimativa tem que vir marcada como
  estimativa.
- Toda informação de texto tem fonte com URL: Wikipédia, Wikimedia Commons, Prefeitura, Governo do Estado, IPHAN,
  Secult, UFC, jornais (O Povo, Diário do Nordeste) e sites oficiais.
- Faça poucas requisições aos sites da Wikimedia, sem rajadas. Use User-Agent de navegador; a API `/w/api.php` costuma
  devolver 429, e as páginas HTML de `commons.wikimedia.org/wiki/Category:<Nome>` funcionam melhor.
- Se algum site estiver bloqueado na sua rede, diga qual e siga com o que der.

## Como entregar
- **Se você tem acesso ao repositório:**
  - crie o branch `pesquisa/marcos-faltantes` a partir da `main`;
  - faça commit de `marcos3d/pesquisa/<id>/osm.xml` e `ficha.md` dos 6 e de um `marcos3d/pesquisa/RESUMO.md` (uma
    linha por lugar: o que achou e o que faltou);
  - dê push e informe o nome do branch.
- **As imagens não vão para o git:** o `.gitignore` ignora `pesquisa/*/ref-*`. Junte todas as `ref-*.jpg` num
  **`fotos-marcos.zip`** com a mesma estrutura de pastas (`marcos3d/pesquisa/<id>/ref-N.jpg`) e entregue ao dono.
- **Se não tem acesso ao repositório:** entregue tudo num único .zip com essa mesma estrutura de pastas.
