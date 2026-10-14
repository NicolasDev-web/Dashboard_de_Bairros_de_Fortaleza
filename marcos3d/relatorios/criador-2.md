# Relatório do Criador, lote 2 (porta 5321)

Marcos: reitoriaUfc, estadioPv, igrejaFatima, mosteiroSaoBento, casaAlencar, mercadoAerolandia, centroEventos, ccbj.

## Método comum
- **Planta:** a Overpass respondeu 504 quase sempre. Usei a API 0.6 do OSM (`/api/0.6/map?bbox=`), com o mesmo resultado (ways com tags e nós). Converti para metros em volta do ponto do marco.
- **Fotos:**
  - busquei no Wikimedia Commons pela API;
  - baixei até 3 por marco de `upload.wikimedia.org` (miniatura de 1280 px; o servidor recusa larguras fora da lista, como 1024 px) para `pesquisa/<id>/ref-N.jpg`.
- **Construção:**
  - cada arquivo tem um pequeno `Construtor` que junta faces por material, com UV em metros e normais planas. As massas viram uma malha por material (poucas draw calls).
  - `prisma` para plantas quaisquer, `retangulo` com chanfro.
  - Peças repetidas (colunas, vãos, árvores, sebes) vão em InstancedMesh.
  - Os helpers são copiados em cada arquivo, como pede a convenção (nada novo em `util/`).
- **Aviso sobre o scratchpad:** o scratchpad da sessão é compartilhado com o outro Criador (o `osm.mjs` dele sobrescreveu o meu). Passei a usar `scratchpad/lote2/`.

---

## 1. reitoriaUfc — Reitoria da UFC (antigo palacete Gentil)

**Referências:**
- OSM: way/371206594 e as partes 1161342376/7/9;
- fotos do Commons "Reitoria da UFC 02, 03 e 05" (2023);
- Diário do Nordeste (pinturas parietais, ecletismo);
- repositório da UFC (compra do palacete de José Gentil em 1956).

Detalhes em `pesquisa/reitoriaUfc/ficha.md`.

**Escala:**
- **K = 0,6** na planta: o H de 77 × 44 m vira 46,2 × 26,4 m. Com jardins e via interna, ocupa o pedestal até r = 33,2.
- **Alturas reais**, exagero vertical ≈ 1,7× sobre K:
  - embasamento 0,6;
  - térreo até 4,6;
  - cornija 8,4;
  - platibanda 9,25;
  - torreão até 14,8 com a balaustrada.
- O torreão foi engordado ~15% (4 m de lado na miniatura) para ler como marco.
- O rumo é o real: pátio da frente para 311° (noroeste), grupo girado −131°. Nas vistas da oficina (do sul e do sudoeste), o palacete com o torreão aparece ao fundo, à direita.

**Os 4 níveis:**
1. **Forma:**
   - planta em H do OSM com os dois pátios (frente e fundo);
   - embasamento;
   - massas das alas e do corpo central;
   - torreão de cantos chanfrados em dois estágios;
   - frontão do palacete.
2. **Secundárias:**
   - varandas com colunata nos dois pátios e no lado nordeste, com a laje-sacada;
   - cornija saliente, friso entre pavimentos, rodapé e remate da platibanda;
   - pórtico do palacete (pares de colunas, sacada, loggia com arco, entablamento);
   - frontão com voluta e pináculos;
   - degraus;
   - cornijas e balaustradas do torreão.
3. **Detalhes:**
   - ~250 vãos com moldura, peitoril e cimalha em relevo e folha de veneziana com bandeira de vidro;
   - janelas em arco pleno no alto do torreão;
   - arcada aberta no pé do torreão;
   - pilastras brancas nos cantos, nos chanfros do torreão e a cada dois vãos nas fachadas lisas;
   - balaustradas vazadas (alphaTest);
   - sebes dos canteiros, palmeiras, mangueiras;
   - mastros com bandeiras;
   - via interna com meio-fio, calçadas.
4. **Micro:**
   - variação sutil de cor no reboco e na laje (`texturaManchada`);
   - rugosidades distintas: reboco 0,88, estuque 0,62, laje 0,95, metal 0,35 com metalness 0,6;
   - cores por instância nas copas.

**Notas (0–10):**

| Geometria | Topologia | Proporções | Detalhamento | Materiais | Texturas | Shading | Realismo | Otimização | Apresentação |
|---|---|---|---|---|---|---|---|---|---|
| 8 | 8 | 8 | 8 | 7 | 7 | 8 | 7 | 9 | 7 |

**Números:** 126 KB, 27.898 triângulos, 30 malhas, 19 materiais, 4 texturas (veneziana, balaustrada, duas manchadas). O `checar` aprovou: raio 34,0 (o pedestal), altura 15,3.

**Checklist (item 27):**
- [x] proporção, silhueta e escala;
- [x] geometria limpa, sem degenerados: tirei os polos do torno das colunas;
- [x] normais e shading planos e corretos;
- [x] sem flutuação: árvores, mastros e sebes no chão;
- [x] bevels: chanfro de 0,04–0,12 nas massas e pilastras;
- [x] materiais nomeados, UV em metros, nomenclatura, exportação.
- Clipping: as lajes das varandas não se sobrepõem. As colunas repetidas nos cantos dos pátios foram removidas.

**Renders:** `renders/reitoriaUfc/tsx-{perspectiva,frente,close,topo}.png`.

**Críticas e correções:**
- **Rodada 1:**
  - reboco escuro demais, cor de tijolo: clareei para salmão #f2ae99;
  - o pátio de trás estava pavimentado: virou jardim (leisure=park no OSM);
  - torreão pequeno: aumentei;
  - palmeiras "guarda-chuva": viraram leque de lâminas;
  - fachada sudoeste monótona: ganhou pilastras.
- **Rodada 2:**
  - árvores altas demais escondiam o prédio: mangueiras mais baixas e largas, 26 em vez de 34;
  - 1.320 triângulos degenerados dos polos das colunas: removidos.

**Dúvidas abertas:**
- o telhado não aparece nas fotos; usei laje cinza neutra;
- a fachada externa da ala sudoeste não foi vista;
- não há confirmação de outro torreão ou pórtico na ponta da ala sudoeste.
