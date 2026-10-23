# Especialista 3D com Blender: método aprovado

Este é o método que refez a **Unifor** e o **Iguatemi Bosque**, aprovados pelo dono do projeto como "exatamente o nível de detalhe esperado". Ele vale para os marcos novos e para qualquer refação.
- O padrão de qualidade está em `MASTERCRAFT.md`.
- O contrato técnico está em `CONVENCOES.md`.
- Este arquivo diz **como** chegar lá com o Blender.

Use como referência viva:
- código: `src/marcos/Unifor.tsx` e `src/marcos/Iguatemi.tsx`, com `blender/unifor.py` e `blender/iguatemi.py`;
- relatórios: `relatorios/especialista-unifor.md` e `relatorios/especialista-iguatemi.md`.

## O que faz o nível aprovado
- **Reconhecível antes de tudo.** O tour pergunta "alguém de Fortaleza reconhece este lugar?". Os protagonistas, que são o prédio e os 2 ou 3 elementos icônicos, ficam grandes e detalhados. O resto só é sugerido (mata, quadras, entorno). Nada de caixas iguais espalhadas.
- **Recorte com intenção.** O lugar real não cabe num disco de 67 m.
  - Escolha o recorte que conta a história, por exemplo "a frente vista da avenida".
  - Ou condense a planta com uma compressão radial suave, como no Iguatemi.
  - Explique a escolha no relatório.
- **Contexto que situa:** a rua ou avenida com carros e faixas, calçada, gradil, palmeiras e árvores com tons variados, pessoas na praça, as casas vizinhas.
- **Oclusão de ambiente assada no Blender** (Cycles):
  - nas cores de vértice dos prédios, e/ou numa imagem pequena do chão;
  - é o que dá a profundidade que os modelos antigos não tinham.
- **Cores e materiais tirados das fotos**, nunca genéricos. Exemplo: a Reitoria da Unifor é verde-oliva, e é isso que a torna reconhecível.

## Pesquisa (rede testada)
| Fonte | Como usar |
|---|---|
| **Planta e rumo** | API 0.6 do OSM: `https://api.openstreetmap.org/api/0.6/map?bbox=<oeste>,<sul>,<leste>,<norte>`. Partes `building:part` e `height` ajudam. **O Overpass está fora.** Conversão: x = Δlng·cos(lat)·111320; z = −Δlat·110540 (norte em −z). |
| **Fotos** | `upload.wikimedia.org` com User-Agent de navegador (`curl -A "Mozilla/5.0 (X11; Linux x86_64) DashboardBairrosFortaleza/1.0"`), em miniatura de 1280 px: `…/commons/thumb/<a>/<ab>/<Arquivo>.jpg/1280px-<Arquivo>.jpg`. |
| **Lista de fotos** | Páginas **HTML** de `commons.wikimedia.org/wiki/Category:<Nome>` e dos artigos `pt.wikipedia.org/wiki/<Nome>` (extraia `File:` e links de `upload.wikimedia.org`). **A API `/w/api.php` devolve 429.** Faça poucas requisições, sem rajadas. |
| **Vista aérea** (só para olhar) | Esri World Imagery, `server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` (z17–19), alinhada com o OSM. Revela coberturas e formas que o OSM não tem. |
| **Texto** | `WebSearch` e `WebFetch` em páginas públicas (prefeitura, IPHAN, jornais, site oficial). |

- Guarde até 5 referências por marco em `pesquisa/<id>/ref-N.*`. Elas ficam fora do git.
- **Nenhuma foto ou imagem baixada entra no modelo.** Elas servem só para olhar.
- Não invente: o que não der para confirmar fica neutro e vai para as "dúvidas abertas".

## Blender
- **Instalação** (Blender 5.2.3 como módulo Python, no Python 3.13 do contêiner):
  1. Crie um venv.
  2. Baixe o wheel `bpy-5.2.3-cp313-cp313-manylinux_2_28_x86_64.whl` do PyPI. São ~400 MB; em partes paralelas com `curl -r` é muito mais rápido que o `pip`.
  3. Rode `pip install <wheel>`.
  4. `download.blender.org` é bloqueado pela rede.
- **Uso:**
  - headless: `<venv>/bin/python blender/<id>.py`;
  - renderiza em Cycles na CPU (o EEVEE pode não funcionar sem GPU);
  - importa GLB **sem** meshopt. Para inspecionar um GLB da oficina, use `saida/bruto/`.
- **Fonte versionada:**
  - `blender/<id>.py` gera tudo e exporta, sem compressão, `blender/saida/<id>-*.glb`;
  - dados auxiliares (posições de árvores, carros etc.) vão em `blender/saida/<id>-*.json`;
  - nada de `.blend` solto: o modelo tem que sair de novo rodando o script.
- **O `.tsx` carrega as peças:**
  - use `useLoader(GLTFLoader, "/blender/saida/<id>-….glb")`; o Vite serve a raiz `marcos3d/`;
  - aplique as texturas de canvas e instancie o que se repete (árvores, palmeiras, carros, postes, pessoas) com InstancedMesh;
  - assim `render`, `exportar` e `checar` funcionam sem mudança, e o GLB final sai com tudo junto e comprimido.
- **Armadilha:** o GLTFExporter regrava como PNG qualquer textura carregada. Para manter JPEG, marque a textura com `textura.userData.mimeType = "image/jpeg"`. Foi isso que derrubou uma exportação da Unifor de 738 KB para 384 KB.
- **Luz do site:** não há env map, então metal muito metálico fica preto. Use metalness ≤ 0,4 e vidro com cor-base clara.

## Oficina
Rode tudo em `marcos3d/`, cada especialista na **sua** porta:
```sh
export CHROME=<invólucro que chama o Chromium com --no-sandbox>   # rodando como root
npm run render -- --ids <id> --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta <P>
npm run exportar -- --ids <id> --porta <P>
npm run checar -- --ids <id>
```
- O render da oficina usa a luz do site: **é ele que conta**.
- Renders extras no Blender, como o close de uma fachada que as vistas padrão só pegam de viés, servem para conferir.
- Faça **no mínimo três rodadas** de render → crítica honesta → correção, sempre olhando os PNGs com Read e comparando com as fotos.

## Orçamento
- Os aprovados ficaram com **384 KB** (Unifor) e **503 KB** (Iguatemi), entre 37 mil e 50 mil triângulos, 55 a 72 malhas e 34 materiais.
- O peso extra vem sobretudo da oclusão assada e das normais, e vale a pena.
- O limite continua sendo **≤ 600 KB**, e o `checar` tem que passar.

## Relatório
Use `relatorios/especialista-<id>.md`, **atualizado a cada etapa** (já perdemos trabalho por limite de uso). Ele deve ter:
- referências com URL;
- composição e por quê;
- como gerar de novo;
- os 4 níveis do MASTERCRAFT;
- notas 0–10 nos 10 critérios;
- KB, triângulos, malhas e materiais;
- o resultado do `checar`;
- o checklist do item 27;
- a altura sugerida da etiqueta;
- as dúvidas abertas.
