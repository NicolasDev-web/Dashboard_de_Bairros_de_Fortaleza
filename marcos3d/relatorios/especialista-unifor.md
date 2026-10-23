# Especialista Unifor — refação completa da miniatura

Status: **concluído** (export e `checar` aprovados; nada publicado em `dashboard/`, nada commitado por mim).

## 1. Pesquisa e referências
Ficha completa em `pesquisa/unifor/ficha.md`. A primeira sessão não tinha rede; esta refez a passada com:
- **Fotos** (Wikimedia Commons, em `pesquisa/unifor/ref-1..4.jpg`, fora do git):
  - ref-1, aérea: https://commons.wikimedia.org/wiki/File:Campus_unifor.jpg
  - ref-2, Reitoria vista da Washington Soares: https://commons.wikimedia.org/wiki/File:UNIFOR_06.jpg
  - ref-3, fachada do Centro de Convivência: https://commons.wikimedia.org/wiki/File:Unifor-campus-centro-convivencia-fachada-foto-ares-soares.jpg
  - ref-4, arcos e palmeiras da Reitoria: https://commons.wikimedia.org/wiki/File:UNIFOR_05.jpg
  - Também olhadas em miniatura: UNIFOR_01/03/07, Bruno_giorgi_-_unifor e Prédios_vistos_do_laguinho (categoria
    https://commons.wikimedia.org/wiki/Category:Universidade_de_Fortaleza).
- **Texto:** https://pt.wikipedia.org/wiki/Universidade_de_Fortaleza, mais as fontes da sessão anterior (unifor.br: Espaço
  Cultural, sinalização por cores, estacionamento solar, parque desportivo; Diário do Nordeste: estádio).
- **Planta:** API 0.6 do OSM, bbox `-38.4840,-3.7740,-38.4710,-3.7640`, convertida para metros em volta do ponto do tour.
  Medidas na tabela da ficha: a Reitoria tem uma ala curva côncava para a avenida (raio ≈ 70 m); a Biblioteca tem eixo a
  −23,5°; o CC tem Ø 55 m com as torres no perímetro e a frente a 252°; os blocos seguem a malha 65°/155°.
- **O que as fotos corrigiram** em relação à ficha anterior, que estava sem fotos:
  - Reitoria **verde-oliva com arcos abatidos e pastilha bege** (não branca), com volumes de ponta inteiramente verdes (ref-2);
  - jardim com **palmeiras imperiais, fonte com grupo escultórico, estátuas brancas, gradil verde, totem azul**;
  - CC com **cúpula branca, torres de vidro azul bilobadas, faixa azul "UNIVERSIDADE DE FORTALEZA", parede petróleo e mural**.

## 2. Composição e por quê
O campus tem ~1 km e não cabe legível num disco de 67 m. Escolhi o recorte da **frente do campus**, que é o que o fortalezense
vê da Washington Soares e reconhece. De oeste para leste:
- Av. Washington Soares (duas pistas, canteiro, postes e carros) → calçada e gradil verde;
- jardim (fonte, estátuas, totem, letreiro da Fundação, imperiais) → **Reitoria** (protagonista 1);
- **Biblioteca** → **Praça Central** (fonte, floreiras, coqueiros, gente) → **Centro de Convivência** (protagonista 2).

Em volta fica a mata, com só três grupos de blocos sugeridos (C em barra dupla, D e T em H, posições do OSM) e um
estacionamento sob as árvores. Escala de planta K ≈ 0,15; os protagonistas crescem 1,4–1,55× e as alturas são exageradas
como nos aprovados. O norte real foi mantido (contrato), porque o tour gira a câmera.

Ficaram de fora, por estarem centenas de metros a leste: ginásio, estádio, estacionamento solar, Bloco M e lago.

## 3. Como o Blender foi usado e como gerar de novo
Opção 1 (Blender como fonte de peças), sem nenhum .blend: o modelo sai sempre do script.
```sh
cd marcos3d
<python-com-bpy> blender/unifor.py            # ~8 s: modela, assa a oclusão e exporta (--sem-bake: ~2 s, só forma)
export CHROME=<invólucro do chrome>
npm run render -- --ids unifor --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta 5361
npm run exportar -- --ids unifor --porta 5361
npm run checar -- --ids unifor
```
(`<python-com-bpy>` nesta máquina: `/tmp/claude-0/.../scratchpad/blender-venv/bin/python`, com Blender 5.2.3.)

**O que o `blender/unifor.py` faz:**
- Modela com `bmesh`: prismas e caixas chanfradas, setores anulares (ala curva), tornos (bacias, pedestais, cornijas,
  cúpula) e placas extrudadas (a faixa verde com os arcos).
- Solda os vértices e suaviza por ângulo (32°): curvas lisas, quinas vivas.
- Gera um **atlas de esquadrias de 256 px** em Python, com quatro quadrantes: janela em arco da Reitoria, fita do térreo
  com painéis vinho, pele de vidro azul das torres e fita genérica.
- **Bake de oclusão de ambiente no Cycles (CPU)**:
  - nas **cores de vértice** dos prédios e do jardim, remapeadas para 0,5–1;
  - numa **imagem de 256 px do chão** vista de cima, com UV planar.

  Nos dois casos a vegetação e os carros entram como volumes provisórios, que são apagados antes da exportação.
- Exporta `blender/saida/unifor-campus.glb` (exportador glTF do Blender, sem compressão), `unifor-ao-chao.jpg` e
  `unifor-layout.json` (árvores, imperiais, coqueiros, carros e pessoas, em coordenadas do three).

**O que o `src/marcos/Unifor.tsx` faz:**
- Carrega as peças com `useLoader(GLTFLoader)` e liga sombras.
- Renomeia cada primitiva como `<Peça>_<Material>`.
- Troca a água por `fab.agua()`.
- Põe o mapa de oclusão (aoMap) e uma textura manchada no gramado.
- Desenha o atlas de letreiros em canvas (512 × 256): "UNIVERSIDADE DE FORTALEZA", placa da Fundação, totem "Reitoria"
  e mural.
- Instancia a mata (155 árvores com tronco), as imperiais, os coqueiros, os carros e as pessoas.

**Conferido no export:** o GLTFExporter preserva nomes, materiais, cores de vértice (COLOR_0), atlas, aoMap e instâncias
(EXT_mesh_gpu_instancing).

**Problema da oficina** (não é bug do script, mas pega quem usar TextureLoader): o GLTFExporter regrava como PNG qualquer
textura sem `userData.mimeType`. O JPEG de oclusão virou um PNG de 274 KB. Resolvi no `.tsx` com
`texture.userData.mimeType = "image/jpeg"`.

Também usei o Blender para **inspeção**: o script descartável `scratchpad/inspecionar.py` renderiza o GLB bruto de pontos de
vista que a oficina não tem.
- Da avenida (oeste), a Reitoria lê como na ref-2/ref-4.
- De frente para o pórtico, o CC lê como na ref-3.

## 4. O que foi modelado nos 4 níveis do MASTERCRAFT
**Nível 1 — forma principal:**
- Reitoria em ala curva côncava (setor anular de raios 12,7/16,3 m) + ala leste–oeste de 3 pavimentos.
- Biblioteca: caixa no rumo −23,5°.
- CC: tambor de R 7 m, cúpula baixa e duas torres bilobadas de 8,4 m.
- Avenida de duas pistas, disco de gramado e blocos em barra e em H.

**Nível 2 — formas secundárias:**
- Reitoria:
  - pilastras verdes nos 10 limites de vão (frente e fundos);
  - faixa verde com um arco abatido por vão;
  - platibanda verde em anel;
  - vãos e pontas inteiramente verdes;
  - marquise da entrada.
- CC:
  - térreo envidraçado recuado com 22 pilares;
  - laje e cornija;
  - anel de janelas sob a cúpula;
  - pórtico com pilares, mezanino e forro;
  - faixa azul;
  - parede petróleo com relevo e parede do mural.
- Biblioteca: brises, platibanda e lanternim envidraçado.
- Blocos: telhado de duas águas com beiral.
- Avenida: canteiro e calçada com meio-fio.

**Nível 3 — detalhes:**
- Janelas do atlas: caixilhos brancos, topo em arco, painéis vinho, pele de vidro azul.
- Peitoris, caixa d'água, antenas com parabólica, aparelhos na cobertura.
- Mastros no topo da cúpula; guarda-corpo do mezanino.
- Fonte com grupo escultórico, três estátuas brancas e a escultura de bronze (Bruno Giorgi) junto à entrada.
- Totem "Reitoria" e letreiro da Fundação.
- Canteiros de ixora, gradil com portões, postes de braço duplo.
- Faixas de rolamento tracejadas e linhas de bordo; vagas do estacionamento.
- Floreiras e bancos da Praça; carros; pessoas.

**Nível 4 — microdetalhes:**
- Oclusão assada nos vértices (contato no pé das paredes, sob marquises e cornijas) e no chão (sob copas, prédios e carros).
- Gramado com mancha sutil.
- Variação de cor por instância em copas, folhas, carros, camisas e tons de pele.
- Vidro com reflexo claro no alto.
- Rugosidades distintas: vidro 0,35, cúpula 0,45, metal 0,45/metalness 0,4, reboco 0,85, água 0,08.

## 5. Rodadas de render → crítica → correção (luz do site)
1. **R1:**
   - Crítica: o CC já se reconhecia, a Reitoria não (as palmeiras ao sul se projetavam sobre os arcos, vistas de SSO);
     silhueta chapada; 8 barras brancas lembravam o "antes".
   - Correção: protagonistas maiores e mais altos, copas mais baixas, blocos reduzidos, faixa do pórtico fina.
2. **R2:**
   - Crítica: a ponta sul da ala era uma parede cega; os arcos tinham pouco contraste; os canteiros pareciam "salsichas";
     39 materiais.
   - Correção: janelas nas pontas, vidro claro, canteiros arredondados, imperiais só ao norte da fachada, pessoas,
     fusão de materiais.
3. **R3:**
   - Crítica: 738 KB (reprovado).
   - Correção: AO de 256 px em JPEG, sem chanfro em peças finas, gradil sem hastes → 387 KB.
4. **R4:**
   - Crítica: no close, os blocos do primeiro plano chamavam mais atenção que os protagonistas.
   - Correção: tirei o Bloco I, deixei a mata encostar nos blocos e usei um branco mais quente.
5. **R5:**
   - Crítica: na escala do tour (~200 px) a Reitoria lia pela cobertura cinza; o coordenador apontou o mesmo.
   - Conferido na foto: o volume da ponta em UNIFOR_06 é todo verde-oliva; no meio, pastilha entre pilastras verdes.
   - Correção: vãos e pontas verdes, platibanda verde larga (anel verde visto de cima), pilastras mais largas, verde oliva
     `#7c9c45`, cobertura um tom mais escura, clareiras na Praça e entre a Biblioteca e o CC.

**"Alguém de Fortaleza reconhece?"**
- Na perspectiva: o CC (cúpula branca entre as torres azuis) e o prédio curvo verde de frente para a Washington Soares,
  com as imperiais, se leem já a ~200 px.
- No close: pórtico, torres, mural e Praça.

## 6. Notas (0–10), antes → depois
| Critério | Antes | Depois |
|---|---|---|
| Geometria | 3 | 8 |
| Topologia | 5 | 7 |
| Proporções | 3 | 7 |
| Detalhamento | 2 | 8 |
| Materiais | 3 | 8 |
| Texturas | 3 | 7 |
| Shading | 4 | 8 |
| Realismo (fidelidade ao lugar) | 2 | 8 |
| Otimização | 6 | 8 |
| Apresentação | 3 | 8 |

## 7. Números
| | Antes (GLB publicado) | Depois (`saida/unifor.glb`) |
|---|---|---|
| Tamanho | 150 KB | **384 KB** (limite 600; a meta de 300 KB não foi atingida) |
| Triângulos | 4.716 | **36.974** |
| Malhas | 32 | **55** |
| Materiais | 24 | **34** |
| Texturas | 2 | 4 (atlas de esquadrias 256, letreiros 512 × 256, AO 256, mancha 64) |
| `checar` | **REPROVADO** (raio 35,6 m; base em −0,95; 188 malhas e 24 materiais sem nome) | **OK** (raio 34,0 m com o pedestal, altura 10,3 m) |

A meta de 300 KB não foi atingida porque a geometria facetada (normais por face) e as cores de vértice comprimem pouco no
meshopt. Para chegar lá seria preciso tirar detalhe visível.

O atlas de letreiros tem 512 px de largura, acima dos 256 da convenção: em 256 px o "UNIVERSIDADE DE FORTALEZA" fica
ilegível no close.

## 8. Checklist (item 27)
- [x] Proporção correta (planta e rumos do OSM; exageros documentados)
- [x] Silhueta convincente (cúpula, torres, imperiais)
- [x] Escala coerente com os outros marcos (carros ~1,9 m; pessoas 0,8 m)
- [x] Geometria limpa (vértices soldados, sem bevel em peças finas)
- [x] Normais corretas (perfis de revolução e faces orientados para fora; `checar` sem normais inválidas)
- [x] Shading correto (suavização por ângulo de 32°)
- [x] Sem clipping indesejado relevante (pisos em alturas distintas; a ala leste encaixa nos fundos da ala curva de propósito)
- [x] Sem geometria flutuando (tudo pousa em z = 0,10)
- [x] Sem faces duplicadas (remove_doubles; o `checar` não acusa triângulos degenerados)
- [x] Bevels coerentes (0,03–0,08 m nas massas)
- [x] Materiais coerentes e nomeados (34)
- [x] Texturas adequadas (4, todas geradas: Python, canvas e bake)
- [x] UV organizada (atlas por quadrantes; chão em UV planar)
- [x] Nível de detalhe adequado ao close e à vista geral
- [x] Performance adequada (384 KB, 37 mil triângulos, 55 malhas)
- [x] Arquivo organizado (script fonte versionado, saídas em `blender/saida/`)
- [x] Nomenclatura em português
- [x] Exportação correta (`exportar` + `checar` OK)

## 9. Altura da etiqueta
O ponto mais alto do modelo são as copas das imperiais (~9,5 m); as torres do CC chegam a 8,5 m e a cúpula a ~7,4 m.
**Sugiro `altura: 9`** em `src/marcos/index.ts` e em `dashboard/historias.js` (hoje está 7). Não editei esses arquivos.

## 10. Dúvidas abertas
1. Fachadas da Biblioteca e da ala leste–oeste da Reitoria não aparecem nas fotos: ficaram neutras (branca com fitas e
   brises; concreto com pilastras verdes).
2. Segunda cúpula do CC (a aérea sugere duas): ficou uma cúpula só, com anel de janelas.
3. Térreo do tambor do CC e canteiro central da Washington Soares: simplificados.
4. A passarela sobre a Washington Soares existe (texto), mas não achei foto: não foi modelada.
5. O mural do CC foi feito como composição abstrata colorida; o banner "Edson Queiroz 100 anos" (temporário) ficou de fora.
6. Ginásio, estádio, estacionamento solar e lago ficaram fora do recorte. Se o dono quiser o "Parque Desportivo", teria que
   ser outra composição.

## Renders finais
`renders/unifor/tsx-perspectiva.png`, `tsx-close.png`, `tsx-frente.png`, `tsx-lado.png`, `tsx-topo.png`.
O "antes" continua em `renders/unifor/glb-*.png`.
