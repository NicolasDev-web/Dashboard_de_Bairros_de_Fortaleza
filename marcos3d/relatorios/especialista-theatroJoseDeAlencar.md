# Especialista Theatro José de Alencar — refação do zero

Status: **em andamento** (etapa 1: pesquisa e plano). Nada publicado em `dashboard/`, nenhum commit.

## 1. Pesquisa e referências
- Ficha: `pesquisa/theatroJoseDeAlencar/ficha.md` (planta do OSM, medidas da foto frontal, cores).
- Rede nesta sessão: Wikimedia, Wikipédia, OSM e Esri bloqueados (403 do proxy). O `WebFetch` também não resolve os
  jornais. Só o `WebSearch` respondeu. Sem fotos novas: trabalhei com a ficha, o `osm.xml` e a `planta.png`.
- O `WebSearch` confirmou:
  - a fachada de ferro art nouveau com vitrais coloridos da sala fica voltada para o pátio central;
  - as cores dos vitrais são verde, vermelho e azul, que "se destacam à noite com as luzes acesas";
  - o monumento a José de Alencar fica na praça: bronze sentado com livro, sobre base de granito branco, de 1929;
  - a praça ganhou uma fonte iluminada na revitalização de 2020.

## 2. Diagnóstico da versão anterior
- **Crítico:** o prédio estava no rumo real, com a fachada para o norte. Todas as vistas da oficina olham do sul
  (perspectiva −32°, close +24°, frente 0°), então o dono só via os **fundos**: a sala cinza com janelas em arco e o
  jardim. A fachada, as estátuas e o pátio de ferro ficavam do outro lado.
- **Crítico:** as cores eram cinza-esverdeadas, e na sombra (a luz vem do noroeste) viravam cinza.
- **Alto:** não havia vitrais nem fachada de ferro legíveis, e não havia praça de verdade nem gente.

## 3. Andamento (registro por etapa)
- **Etapa 2:** script `blender/theatroJoseDeAlencar.py` e componente novo `src/marcos/novos/TheatroJoseDeAlencar.tsx`.
  - Composição girada (`GIRO = -6`) para a fachada olhar para as câmeras.
  - Bake de oclusão em ~5 s.
- **R1:**
  - Leu como o Theatro já de longe.
  - Problemas: leque do coroamento de ferro com a face virada para trás (invisível); reboco acinzentado; estátuas
    pequenas e de costas; teto chato do bloco da fachada; praça vazia; lote à direita cinza e vazio.
- **R2:**
  - Correções: leque, reboco `#dce8a0`, estátuas 1,3× e de frente, telhado de chapa atrás da platibanda, 8 covas de
    árvore na praça, casa vizinha (volume do IPHAN) e gramado no fundo do lote.
  - Resultado: `exportar` deu 564 KB, perto demais do limite.
- **R3 (peso):**
  - As ~420 barras de ferro dos gradis e dos balcões viraram uma InstancedMesh (`Gradis_Barras`).
  - Também: anéis do piso só com a face de cima, cabeças das estátuas mais leves, covas com 12 lados, casa vizinha
    menor e mais afastada, monumento de frente para a praça.
  - Resultado: 482 KB, `checar` OK.
