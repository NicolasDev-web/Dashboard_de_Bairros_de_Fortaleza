# Especialista Unifor — refação completa da miniatura

Status: **em andamento** (atualizado a cada etapa).

## Etapa 1 — Pesquisa (concluída, refeita com rede)
- Ficha completa em `pesquisa/unifor/ficha.md`. A primeira sessão não tinha rede; nesta, baixei 4 fotos do Commons
  (`ref-1..4.jpg`), li o artigo da Wikipédia e baixei a planta do OSM (API 0.6).
- O que as fotos mudaram: a Reitoria é **verde com arcos e pastilha bege** (não branca), tem planta **curva côncava para a
  avenida**; o jardim da frente tem **palmeiras imperiais, fonte com esculturas, estátuas brancas e gradil verde**; o Centro de
  Convivência tem **cúpula branca, duas torres de vidro azul bilobadas e o pórtico com a faixa azul "UNIVERSIDADE DE FORTALEZA"**.
- Fontes textuais da sessão anterior (continuam válidas): unifor.br (Espaço Cultural, sinalização por cores, estacionamento
  solar, parque desportivo), Diário do Nordeste (estádio), en.wikipedia.

## Antes (diagnóstico do modelo antigo, `renders/unifor/tsx-*.png`)
- CRÍTICO (leitura): ~20 caixas brancas iguais espalhadas num campus encolhido a K = 0,058; nada tem tamanho para ser lido.
- CRÍTICO (fidelidade): Reitoria bege-clara com janelas genéricas (é verde, com arcos); CC com torres cilíndricas simples.
- ALTO: sem protagonista; copas sem tronco; nenhuma palmeira imperial; jardim da Reitoria inexistente.
- MÉDIO: sem oclusão de ambiente; um único material de fachada para tudo; avenida sem carros.

## Composição
Ver ficha: recorte da frente do campus (Washington Soares → jardim → Reitoria → Biblioteca → Praça Central → CC), mata com
blocos só sugeridos em volta.

## Etapa 2 — Blender + oficina montados (concluída)
- `blender/unifor.py` gera `blender/saida/unifor-campus.glb` (peças estáticas, sem compressão, AO nas cores de vértice),
  `unifor-ao-chao.jpg` (AO do chão, 256 px, UV planar) e `unifor-layout.json` (árvores, palmeiras, carros, pessoas).
- `src/marcos/Unifor.tsx` carrega as peças com `useLoader(GLTFLoader)`, troca a água pela `fab.agua()`, põe o mapa de
  oclusão nos pisos, desenha os letreiros em canvas e instancia mata, palmeiras, carros e pessoas.
- Exportar + checar funcionam sem mudar a oficina. Problema achado e contornado: o GLTFExporter regrava como PNG toda textura
  carregada pelo TextureLoader (o JPEG de oclusão virou um PNG de 274 KB); resolvido com `texture.userData.mimeType = "image/jpeg"`.

## Rodadas de render → crítica → correção
1. **R1:** o CC já se reconhecia; a Reitoria não (fachada oeste escondida pelas palmeiras ao sul, que se projetam sobre os arcos
   vistas de SSO); silhueta chapada (copas na altura dos prédios); 8 barras brancas lembrando o "antes".
   → protagonistas maiores (CC R 7 m, torres 8,4 m; Reitoria 5,35 m), copas mais baixas, blocos reduzidos, faixa do pórtico fina.
2. **R2:** CC forte; ponta sul da ala curva era uma parede cega virada para a câmera; arcos com pouco contraste; canteiros de
   ixora pareciam "salsichas" vermelhas; 39 materiais (limite 40).
   → janelas e faixa verde nas pontas, vidro claro no 2º pavimento (como nas fotos), verde mais saturado, canteiros baixos e
   arredondados, menos palmeiras (só ao norte da fachada), pessoas, fusão de materiais (39 → 34).
3. **R3:** 738 KB (reprovado). → AO 256 px em JPEG, sem chanfro em peças < 0,35 m, gradil sem hastes: **387 KB, OK no checar**.
