# Convenções da oficina dos marcos 3D

Contrato que os dois agentes 3D (Criador e Aprimorador) seguem. O prompt de base é `MASTERCRAFT.md`; este arquivo diz como ele se aplica aqui.

## Para que serve o modelo (ETAPA 1 — ENTENDER)
- **Objeto:** miniatura de um lugar real de Fortaleza, sobre um pedestal redondo, no tour 3D do painel Bairros de Fortaleza (`dashboard/bairro3d.js`). O tour mostra o contorno do bairro extrudado e, em cima, as miniaturas dos marcos.
- **Classificação:** arquitetura, **estilizado / maquete detalhada** (low-poly limpo, não fotorrealista), asset para **WebGL (three.js 0.170 no site)**.
- **Câmera:**
  - na vista geral do bairro, a miniatura ocupa ~150–300 px de largura;
  - no capítulo do marco, a câmera chega perto e ela ocupa ~60% da tela (~700–900 px);
  - detalhes abaixo de ~0,3 m (na escala da miniatura) quase não aparecem; entre 0,5 e 2 m é onde o detalhe rende.
- **Luz do site:** HemisphereLight (céu `#ffffff`, chão `#3a42c8`, 1,5) + DirectionalLight 2,4 vinda do noroeste, com sombra, sem tone mapping, fundo cobalto `#2a31b8`. Os renders da oficina usam a mesma luz.
- **Formato final:** GLB com meshopt (o `npm run exportar` faz).

## Sistema de coordenadas e escala
- Metros. y para cima. **Norte em −z, leste em +x.** Use o rumo real do prédio (pegue da planta do OSM).
- O componente é montado com a **base em y = 0**, centrado na origem. A oficina põe o pedestal (raio 34 m, 0,5 m de altura) por baixo e sobe o modelo 0,5 m. **Não modele o pedestal.**
- Tudo, inclusive árvores, carros e letreiros, fica **dentro do raio de 33,5 m**. Pegada útil típica: 45–58 m.
- **Miniatura, não escala real:**
  - a planta real é encolhida para caber (fator `K`, como nos modelos existentes);
  - as **alturas encolhem menos** que a planta, para o prédio continuar reconhecível (os existentes exageram as verticais de 1,5 a 3 vezes em relação a `K`);
  - um entorno discreto (calçada, praça, árvores, um trecho de rua) ajuda a situar, mas o marco é o protagonista.
- Referência de alturas nos existentes: torres da Catedral ~18 m, cobertura do Castelão ~10 m, RioMar ~20 m, Terminal ~4 m.

## Estilo "maquete detalhada" (decisão do usuário)
- Mesma linguagem das 13 miniaturas existentes (veja `renders/<id>/glb-*.png` e os `.tsx` em `src/marcos/`), mas com mais qualidade:
  - **formas secundárias** (marquises, platibandas, pilastras, frisos, beirais, guarda-corpos);
  - **chanfros** nas quinas (`caixaChanfrada`, `prismaDePlanta(..., chanfro)`), entre 0,05 e 0,3 m;
  - **materiais com intenção:**
    - variação de rugosidade entre concreto, reboco, vidro, metal, telha e água;
    - vidro escuro com rugosidade baixa;
    - metal com metalness 0,3–0,7;
    - cores tiradas das fotos de referência, não genéricas;
  - **texturas geradas em canvas** (janelas, telhas, piso, letreiros) com UV em metros e `RepeatWrapping`: no máximo 4 texturas por modelo, até 256 px;
  - variação de cor sutil em superfícies grandes (`texturaManchada`, ou cores por instância), sem sujeira;
  - a oclusão de ambiente vem da sombra da luz direcional: garanta `castShadow` nas massas e `receiveShadow` no chão e nas fachadas.
- **Nada de texturas baixadas da internet nem fotos no modelo.** Tudo é geometria + canvas.

## Organização (item 28)
- **Toda malha tem `name`.** Nomes em português, PascalCase com `_`: `Nave_Principal`, `Torre_Sino_Esquerda`, `Marquise_Entrada`, `Arvores_Praca` (InstancedMesh), `Letreiro_Fachada`.
- **Todo material tem nome.** `fab.cor()` e `fab.agua()` já nomeiam. Material criado à mão recebe `name: "Mat_Vidro_Escuro"` etc.
- Aleatoriedade só com `aleatorio(semente)` (determinística).
- Itens repetidos (árvores, janelas em volume, postes, carros, pilares) vão em **InstancedMesh** (`posicionar()` em `src/util/geometria.ts`).
- Comentários no estilo dos arquivos existentes: uma linha de doc por função, dizendo o que o pedaço representa e de onde vem a medida.

## Orçamento (item 17)
- **≤ 600 KB** depois do meshopt (meta: ≤ 300 KB), **≤ 40 materiais**, ~≤ 60 mil triângulos, ~≤ 80 malhas (draw calls).
- Prefira InstancedMesh e geometria compartilhada (`useMemo`) a dezenas de malhas iguais.
- Segmentos de curva com bom senso: 16–32 em cilindros grandes, 6–8 em pequenos.

## Ferramentas (só estas; não há Blender)
Rodar sempre dentro de `marcos3d/`, cada agente na **sua porta** (`--porta`):
```sh
npm run render -- --ids <id1,id2> --vistas perspectiva,frente,close,topo,lado --fonte tsx --porta <P>
npm run render -- --ids <id> --fonte glb --porta <P>   # "antes": o GLB publicado hoje (só para os existentes)
npm run exportar -- --ids <id> --porta <P>             # gera saida/<arquivo>.glb (meshopt) e mostra KB, triângulos, materiais
npm run checar -- --ids <id>                           # controle de qualidade automático do saida/<arquivo>.glb
```
- **Renders** ficam em `renders/<id>/<fonte>-<vista>.png` (1200×900). **Abra os PNGs com a ferramenta Read e olhe de verdade**: é a sua forma de ver o modelo. Faça pelo menos duas rodadas de render → crítica → correção por modelo.
- **O que você pode editar:**
  - só os arquivos do seu lote;
  - helpers novos ficam dentro do próprio arquivo do marco;
  - `src/util/geometria.ts` é só para leitura: se precisar de algo de uso geral, copie para o seu arquivo e diga no relatório.
- **Não edite:**
  - `src/Cena.tsx`, `src/main.tsx`, `scripts/`, os dois `index.ts` de registro, `dashboard/` nem arquivos de outro lote;
  - se um script tiver bug, descreva o problema no relatório.
- **Não publique.** Nada vai para `dashboard/marcos/`: a publicação só acontece depois da aprovação do usuário.

## Referências e fidelidade
- Comece pela pesquisa e registre tudo em `pesquisa/<id>/ficha.md`: o que é, medidas, materiais, cores, elementos característicos, rumo da fachada e as fontes (URL).
- Fontes de referência:
  - **Planta e rumo:** OpenStreetMap via Overpass. Exemplo:
    ```sh
    curl -s --data-urlencode 'data=[out:json];way(around:120,LAT,LNG)["building"];out geom;' https://overpass-api.de/api/interpreter
    ```
    Converta lat/lng para metros em volta do centro (x = Δlng·cos(lat)·111320; y = Δlat·110540) e use `plantaParaMiniatura`.
  - **Aparência:** `WebSearch` e `WebFetch` em páginas públicas (Wikipédia, Wikimedia Commons, prefeitura, IPHAN, jornais).
  - **Fotos para olhar:** baixe **só de `upload.wikimedia.org`**, até 3 por marco, para `pesquisa/<id>/ref-1.jpg` (essas imagens ficam fora do git), e abra com Read.
- **Não invente.** Se não achar como é um elemento, simplifique de forma neutra e anote a dúvida na ficha.

## Entregáveis
1. Os `.tsx` do lote, prontos.
2. `renders/<id>/tsx-{perspectiva,frente,close,topo}.png` finais e, nos existentes, também `glb-*` (o antes).
3. `saida/<arquivo>.glb` exportado e **aprovado no `npm run checar`**.
4. `pesquisa/<id>/ficha.md` (Criador) e o relatório do lote em `relatorios/<agente>-<lote>.md`. O relatório é atualizado **a cada modelo terminado**, não só no fim, para não perder progresso. O formato está no arquivo do agente.
