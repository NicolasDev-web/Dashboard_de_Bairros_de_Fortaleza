# Próximos passos: miniaturas 3D dos marcos

Este é o resumo de passagem para a próxima sessão. Leia junto com `ESPECIALISTA-BLENDER.md` (o método aprovado), `CONVENCOES.md` e `MASTERCRAFT.md`.

- **Branch de trabalho:** `claude/stoic-darwin-yj7lad`.
- **Site:** a Vercel publica a `main` (pasta `dashboard/`).

## Onde paramos (31/10/2026)

### Já publicados no site (`main`)
- **13 existentes** (melhorados): Castelão, Aeroporto, Messejana, Praia do Futuro, Praia de Iracema, Centro, Cambeba, North Shopping, RioMar Fortaleza, RioMar Kennedy e Terminal Antônio Bezerra. **Unifor** e **Iguatemi** foram refeitos do zero com Blender.
- **Novos, com Blender:** Forte da Assunção, Dragão do Mar, Theatro José de Alencar e Passeio Público. O Centro tem 5 miniaturas.

### Prontos no branch, aguardando aprovação do dono para publicar
O `checar` passa em todos, e os renders estão em `renders/<id>/tsx-*.png`.

| id | GLB (`saida/`) | etiqueta | bairro (id) | lat, lng |
|---|---|---|---|---|
| estadioPv | estadio-presidente-vargas.glb | 22 | Benfica (7) | −3.7459909, −38.5368948 |
| reitoriaUfc | reitoria-ufc.glb | 16 | Benfica (7) | −3.7414294, −38.5393982 |
| estoril | estoril.glb | 19 | Praia de Iracema (32) | −3.7190974, −38.516258 |
| farolMucuripe | farol-do-mucuripe.glb | 25 | Cais do Porto (110) | −3.7078217, −38.4704039 |
| palacioAbolicao | palacio-da-abolicao.glb | 14 | Meireles (24) | −3.7281783, −38.5038238 |
| iracemaMartim | iracema-e-martim-mucuripe.glb | 19 | Mucuripe (26) | −3.7230553, −38.4843485 |

### Faltam fazer (7)
Fazer com o método do `ESPECIALISTA-BLENDER.md`, **2 especialistas por vez**:

| id | componente | GLB | lat, lng | pesquisa |
|---|---|---|---|---|
| marcoZero | novos/MarcoZero.tsx | marco-zero-barra-do-ceara.glb | −3.694469, −38.5860534 | `pesquisa/marcoZero/` (OSM) |
| igrejaFatima | novos/IgrejaFatima.tsx | igreja-de-fatima.glb | −3.7524955, −38.5266562 | sem pasta |
| mosteiroSaoBento | novos/MosteiroSaoBento.tsx | mosteiro-de-sao-bento.glb | −3.8510433, −38.480721 | sem pasta |
| casaAlencar | novos/CasaAlencar.tsx | casa-de-jose-de-alencar.glb | −3.8124, −38.4774 | sem pasta |
| mercadoAerolandia | novos/MercadoAerolandia.tsx | mercado-da-aerolandia.glb | −3.7685259, −38.5170066 | sem pasta |
| centroEventos | novos/CentroEventos.tsx | centro-de-eventos-do-ceara.glb | −3.764532, −38.4804211 | sem pasta |
| ccbj | novos/CentroCulturalBomJardim.tsx | centro-cultural-bom-jardim.glb | −3.7859455, −38.6097667 | sem pasta |

Hoje esses `.tsx` têm versões simples (do commit "Modelos 3D" do dono), que serão substituídas.

Depois deles vem a **2ª rodada (14 pontos)**, que o dono pediu "depois dos 17": são os pinos restantes de lagoas, parques, hospitais etc. em `dashboard/historias.js`. Confirmar com o dono antes de começar.

## Como publicar um marco novo (receita usada e testada)
Faça tudo numa **worktree da `main`**, para não atrapalhar os especialistas no branch:

1. **Criar a worktree:**
   ```sh
   git fetch origin main
   git worktree add -B publicar-marcos <scratch>/publicar origin/main
   ```
2. **Copiar o GLB:** `marcos3d/saida/<arquivo>.glb` → `<worktree>/dashboard/marcos/`.
3. **Editar o `dashboard/historias.js`:**
   - trocar `ponto("<rótulo>", lat, lng, "<título>", [...]` por `marco("<id>", "<título>", [...]`, mantendo o mesmo texto e as mesmas fontes;
   - acrescentar a entrada em `window.MARCOS`, no formato `<id>: { arquivo, nome, rotulo, lat, lng, altura }` (altura = etiqueta da tabela acima).
4. **Validar:** `node scripts/validar_historias.js`, que tem que passar.
5. **Testar o tour no navegador.** A rede do ambiente bloqueia as CDNs, então monte uma cópia de teste:
   - copie `dashboard/` para o scratch;
   - baixe `npm pack three@0.170.0 leaflet@1.9.4`;
   - troque no `index.html` as URLs `cdn.jsdelivr.net/npm/three@0.170.0/` e `cdnjs…/leaflet/1.9.4/` por caminhos locais;
   - suba `python3 -m http.server 8765` e rode, em `marcos3d/`:
     ```sh
     CHROME=<invólucro> node scripts/foto-tour.mjs --url http://127.0.0.1:8765/index.html --ids <bairro> --caps 0,1,2 --saida <scratch>/tour
     ```
     Tem que sair com 0. Olhe os PNGs.
   - **Não use `pkill -f http.server`**: isso mata o próprio shell. Guarde o PID e use `kill`.
6. **Subir e limpar:**
   ```sh
   git commit
   git push origin publicar-marcos:main
   git worktree remove ...
   git branch -D publicar-marcos
   ```
   Depois rode `git merge origin/main` no branch de trabalho. Em caso de conflito em `novos/*.tsx` ou `saida/*.glb`, fique com a versão do branch (a do Blender).

## Ambiente (container na nuvem)
- **Blender 5.2.3 como módulo Python:** `/tmp/claude-0/-home-user-Dashboard-de-Bairros-de-Fortaleza/4b30ae7d-c759-5797-8748-71257a343420/scratchpad/blender-venv/bin/python`. Ele fica na pasta temporária da sessão antiga. **Numa sessão nova, reinstale:**
  1. `python3 -m venv <scratch>/blender-venv`;
  2. baixe o wheel `bpy-5.2.3-cp313-cp313-manylinux_2_28_x86_64.whl` (~400 MB) de `files.pythonhosted.org` em 16 partes paralelas com `curl -r` (o `pip` sozinho leva ~30 min). A URL sai de `https://pypi.org/pypi/bpy/5.2.3/json`;
  3. `pip install <wheel>`.
- **Chrome:** o Chromium fica em `/opt/pw-browsers/chromium`. Como root, ele precisa de `--no-sandbox`. Crie o invólucro `<scratch>/chrome-nosandbox.sh` com:
  ```sh
  #!/bin/sh
  exec /opt/pw-browsers/chromium --no-sandbox "$@"
  ```
  e use `export CHROME=<invólucro>` nos scripts da oficina.
- **Dependências:** `npm install` em `marcos3d/` (o `node_modules` não vai para o git).
- **Rede:** hoje só o `WebSearch` funciona. Wikimedia, Wikipédia, OSM API e Esri estão bloqueados (403 do proxy). Para os especialistas terem fotos, o dono precisa liberar esses domínios em *Network access* do ambiente: `upload.wikimedia.org`, `commons.wikimedia.org`, `pt.wikipedia.org`, `api.openstreetmap.org` e `server.arcgisonline.com`.
- **Permissões:** a publicação em `dashboard/` e o push na `main` foram barrados no modo Auto. Funcionou no modo padrão, aprovando os prompts.

## Como rodar cada especialista
- Use `Agent` com o tipo `general-purpose`, em segundo plano, **um marco por especialista e dois por vez**.
- O prompt usado está nos relatórios anteriores. Basta copiar o de `relatorios/especialista-palacioAbolicao.md` e o modelo do pedido, trocando o id, o componente, o GLB, a lat/lng e a **porta**.
- As portas 5361–5380 já foram usadas; use as de 5381 em diante.
- Cada especialista escreve:
  - `blender/<id>.py`
  - `blender/saida/<id>-*`
  - `src/marcos/novos/<Comp>.tsx`
  - `saida/<arquivo>.glb`
  - `pesquisa/<id>/ficha.md`
  - `relatorios/especialista-<id>.md`
- **Lições que valem para todos:**
  - o exportador do Blender não leva a cor-base de material com textura, então aplique-a no `.tsx`;
  - use InstancedMesh para peças repetidas;
  - **nunca** copie nada para `scripts/`;
  - se a fachada ficar escondida nas vistas (as câmeras vêm do sul), gire com a constante `GIRO` e explique no relatório;
  - a água usa `fab.agua()`.
- **Depois de cada especialista:**
  1. `npm run checar -- --ids <id>`;
  2. abrir com Read `renders/<id>/tsx-perspectiva.png` e `tsx-close.png`;
  3. commit e push no branch;
  4. mandar os dois PNGs ao dono e pedir aprovação.
- **Uso:** cada marco gasta de 300 mil a 460 mil tokens. Antes de lançar outro, veja `rate_limit_info.status` no `get_session`. **Se estiver `allowed_warning`, não lance** e avise o dono. Se um especialista cair por limite, faça commit do que ele deixou e, quando o limite voltar, retome-o com `SendMessage`, que funciona se for na mesma sessão. Numa sessão nova, lance outro especialista dizendo que existe trabalho parcial commitado.
- **Pontos de controle:** o stop hook exige a árvore limpa. Faça commit dos arquivos dos especialistas em andamento como "ponto de controle".
