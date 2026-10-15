# Relatório — Criador lote 1 (Centro e orla)

Porta exclusiva: **5320**. Modelos para WebGL/three.js, em metros, y para cima, norte em −z, sem pedestal incorporado.

## Theatro José de Alencar (`theatroJoseDeAlencar`)

### Referências e escala
- Pesquisa já consolidada em `pesquisa/theatroJoseDeAlencar/ficha.md`, planta e building:parts do OSM, três fotos Wikimedia, páginas histórica/arquitetônicas citadas na ficha.
- **K = 0,60**, alturas **V = 0,84** (**1,4× K**). O corpo histórico de ~68 × 25,7 m vira uma miniatura alongada; a caixa cênica chega a 16,3 m no GLB e a etiqueta permanece em 17,5 m.

### Quatro níveis modelados
1. **Forma principal:** fachada eclética, galerias, sala de espetáculos, telhados e caixa cênica.
2. **Formas secundárias:** pátio interno, fachada de ferro/vitrais, platibandas, cornijas, varanda das galerias, jardim e entorno urbano.
3. **Detalhes:** portas e janelas em arco, colunetas, balaustrada, coroamento, balizadores, gradil, casario, árvores e palmeiras.
4. **Microdetalhes:** quatro atlas canvas (fachada, vitral, laterais e piso), variação determinística da vegetação, rugosidades de reboco/ferro/metal/vidro e chanfros de 0,05–0,15 m.

### Crítica visual
- **Rodada 1:** perspectiva, frente e topo confirmaram a pegada, o pátio, a sucessão dos volumes e a separação entre o teatro e o jardim. O enquadramento frontal padrão mostra a face sul porque a fachada histórica olha para norte (−z); isso está coerente com o sistema geográfico, não é giro incorreto.
- **Rodada 2:** close e quatro vistas finais confirmaram sombras limpas, ausência de clipping, leitura das janelas e boa hierarquia entre fachada, sala e caixa cênica. O arquivo existente foi preservado sem alterações destrutivas.

### Notas (0–10)
| Critério | Nota |
|---|---:|
| Geometria | 9.0 |
| Topologia | 9.0 |
| Proporções | 9.0 |
| Detalhamento | 9.0 |
| Materiais | 9.0 |
| Texturas | 9.0 |
| Shading | 8.8 |
| Realismo estilizado | 9.0 |
| Otimização | 8.8 |
| Apresentação | 8.7 |

### Métricas e validação
- Exportação final meshopt: **177 KB** (298 KB bruto), **13.052 triângulos**, **62 malhas**, **31 materiais**.
- `npm run checar -- --ids theatroJoseDeAlencar`: **OK**, raio 34,0 m, altura 16,3 m.

### Checklist do item 27
- [x] Proporção, silhueta e escala corretas
- [x] Geometria limpa, normais e shading corretos
- [x] Sem clipping, faces duplicadas ou peças flutuantes perceptíveis
- [x] Chanfros, materiais, texturas e UV coerentes
- [x] Nível de detalhes e performance adequados
- [x] Arquivo e nomenclatura organizados
- [x] Exportação correta

### Dúvidas abertas
- Permanecem as registradas na ficha: forma exata de partes da cobertura, cores precisas dos vitrais e desenho atual completo do jardim.

## Passeio Público (`passeioPublico`)

### Referências e escala
- OSM local (`pesquisa/passeioPublico/osm.xml`, `osm-resumo.json`, `planta.png`) e ficha da pesquisa.
- Mapa Cultural do Ceará, Câmara Municipal, Wikipédia e duas fotografias do Wikimedia Commons.
- **K ≈ 0,43** para condensar o quarteirão no disco; vegetação e mobiliário são amostra representativa. A fonte chega a 6,5 m e o baobá a 11,9 m: alturas deliberadamente exageradas em ~1,7× sobre K para leitura no tour.

### Quatro níveis modelados
1. **Forma principal:** disco ajardinado, eixos diagonais/radiais, fonte central e pavilhão do café.
2. **Formas secundárias:** bacias da fonte, varanda e telhado do café, linha de gradil, agrupamentos de vegetação e pedestal dos monumentos.
3. **Detalhes:** bustos, bancos com pés, postes com globos, portas do café, pratos da fonte e baobá de tronco largo.
4. **Microdetalhes:** quatro variações determinísticas de verde nas copas, rugosidades separadas para pedra, água, folhagem, madeira e metal; chanfros de 0,04–0,15 m.

### Crítica visual
- **Rodada 1:** perspectiva/frente/topo revelaram caminhos diagonais e gradil ultrapassando o pedestal. Encurtei os eixos de 58 para 42 m e limitei o gradil ao trecho efetivamente inscrito no disco.
- **Rodada 2:** perspectiva, frente, close e topo confirmaram silhueta de parque histórico, fonte legível, café sem competir com o bosque e nenhum elemento fora do raio.

### Notas (0–10)
| Critério | Nota |
|---|---:|
| Geometria | 8.5 |
| Topologia | 9.0 |
| Proporções | 8.0 |
| Detalhamento | 8.5 |
| Materiais | 8.0 |
| Texturas | 7.0 |
| Shading | 8.5 |
| Realismo estilizado | 8.5 |
| Otimização | 9.5 |
| Apresentação | 8.5 |

### Métricas e validação
- Exportação final meshopt: **67 KB** (112 KB bruto), **8.926 triângulos**, **24 malhas**, **22 materiais**.
- `npm run checar -- --ids passeioPublico`: **OK**, raio 34,0 m, altura 12,4 m.

### Checklist do item 27
- [x] Proporção e escala coerentes
- [x] Silhueta convincente
- [x] Geometria limpa e normais corretas
- [x] Shading correto
- [x] Sem clipping, faces duplicadas ou peças flutuantes perceptíveis
- [x] Chanfros e materiais coerentes
- [x] Texturas/variações adequadas à linguagem de maquete
- [x] UV adequada (materiais chapados; sem textura externa)
- [x] Nível de detalhe e performance adequados
- [x] Arquivo e nomenclatura organizados
- [x] Exportação correta

### Dúvidas abertas
- A distribuição de bustos e árvores é representativa; falta inventário métrico completo do mobiliário atual.
- O pavilhão do Café Passeio foi simplificado de modo neutro.
