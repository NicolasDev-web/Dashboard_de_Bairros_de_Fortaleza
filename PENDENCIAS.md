# Pendências

O que ficou de fora da revisão de outubro de 2026, com o motivo e o que fazer para fechar cada item.

**O que já foi feito** (na branch `claude/modest-bohr-vrnmau`):
- linhas diretas respeitando o sentido da viagem;
- camada "Linhas de ônibus" no lugar dos pontos das paradas;
- `requirements.txt` completo e README para qualquer sistema;
- testes de navegador e GitHub Actions.

## Transporte

### 1. Tempos de ônibus na rede de 2026
**Situação.** Os tempos e o passo a passo usam a rede de 2023/24 da ETUFOR, o Metrofor de 2024 e a ARCE de 2025 com o calendário deslocado. O GTFS de 2026 da ETUFOR (mdb-2934, de 03/04/2026 a 03/07/2026) só tem viagens de sábado e domingo. Por isso ele alimenta só as linhas por bairro, as paradas e as linhas diretas. O painel avisa isso no texto, mas o passo a passo pode citar uma linha que mudou ou foi extinta.

**O que destrava.** Um GTFS da ETUFOR com viagens de dia útil. Ele pode vir do portal da Prefeitura, do [Mobility Database](https://mobilitydatabase.org) (feed mdb-2934) ou de um pedido direto à ETUFOR.

**Como fazer quando chegar:**
```sh
# 1) confere se tem dia útil: o script escreve "Dia de referência: ... (dia útil)" ou cai para o sábado
python scripts/12_transporte.py --gtfs data/cache/transporte/etufor_NOVO.zip data/cache/transporte/metrofor_2025.zip \
  data/cache/transporte/arce_2025.zip --osm data/cache/transporte/fortaleza_ruas.osm.pbf --sem-rotas
# 2) se for dia útil, roda completo (umas 1h30) e refaz as linhas
python scripts/12_transporte.py --gtfs ...os mesmos... --osm data/cache/transporte/fortaleza_ruas.osm.pbf
python scripts/13_linhas_bairros.py --gtfs data/cache/transporte/etufor_NOVO.zip data/cache/transporte/arce_2025.zip \
  data/cache/transporte/metrofor_2025.zip
```
Se a vigência da ARCE não cruzar com a da ETUFOR, acrescente `--deslocar-calendario arce`, como na tabela publicada hoje.

### 2. As 5 linhas sem dados
**Situação.** As linhas 669, 1074, 1201, 1203 e 1330 aparecem no `routes.txt` da ETUFOR de 2026, mas não têm viagens nem paradas. Também não existem no GTFS de 2023/24, que completa as outras 40 linhas nessa situação. Por isso não entram em nenhum bairro.

**O que destrava.** O mesmo GTFS novo do item 1. Outra saída é o itinerário no site da ETUFOR (linha por linha, à mão). A etapa 13 já lista as linhas que faltam no fim da execução.

### 3. Validar os tempos com o Google Maps (tarefa sua)
**Situação.** `data/processed/transporte_validacao.csv` tem 12 pares escolhidos para cobrir a cidade (periferia → Centro, bairro → bairro, metrô, metropolitanas). Cada um vem com o tempo do R5 e um link do Google Maps já montado. As colunas do Google estão vazias.

**Como fazer** (uns 20 min):
1. Abra o link `google_maps` de cada linha.
2. Escolha "Partida às 07:00" num dia útil.
3. Preencha:
   - `tempo_google_min`: a opção mais rápida;
   - `linhas_google`: os números das linhas;
   - `observacao`: o que achar estranho.

Uma diferença de até uns 10 min é esperada, porque o Google considera trânsito e o R5 não. Diferenças maiores apontam onde investigar.

### 4. Horário nas linhas diretas
**Situação.** As linhas diretas agora respeitam o sentido (`dashboard/linhas_sentido.js`), mas não dizem se a linha roda em dia útil nem de quanto em quanto tempo passa.

**O que destrava.** O item 1. Com um GTFS de dia útil, a etapa 13 pode contar as viagens de cada linha entre 6h e 9h e guardar o intervalo médio, para o painel mostrar "passa a cada ~15 min".

### 5. Passo a passo de bairro → bairro
**Situação.** O passo a passo existe só até os 12 polos. De bairro para bairro, o painel mostra o tempo e as linhas diretas, sem as opções de viagem. O script e o painel já suportam isso: falta rodar.

**Custo.** A cerca de 20 min por bairro de saída, são umas 40 h numa máquina de 4 núcleos com um processo só. Os arquivos de rota (`dashboard/transporte/o_*.js`) passam de 1,2 MB para cerca de 12 MB no total. O painel só carrega o do bairro de saída (~100 KB).

**Como fazer:**
```sh
python scripts/12_transporte.py --gtfs ...os mesmos da tabela publicada... --deslocar-calendario arce \
  --osm data/cache/transporte/fortaleza_ruas.osm.pbf --rotas-entre-bairros --continuar
```
O `--continuar` retoma de onde parou, então dá para rodar em várias noites. Para paralelizar (4 processos, umas 10 h), falta uma opção `--parte k/n` no `12_transporte.py` que divida os bairros de saída entre os processos. É uma mudança pequena no laço das rotas detalhadas.

O painel já mostra o passo a passo quando a tabela vem com `rotas_entre_bairros: true`, que o próprio script grava em `transporte_meta.json` e em `dashboard/transporte.js`.

## Publicação e repositório

### 6. Release com o vídeo e os dados brutos
**Situação.** O link de Releases do README e do `video/README.md` aponta para uma página vazia. Não consigo criar Releases a partir da sessão.

**O que publicar:**
- o vídeo `bairros-de-fortaleza-web.mp4` (24 MB), que você já recebeu;
- a capa `capa.png`;
- os dados de entrada, que só existem no `data/cache/` (fora do git) e nas fontes, que mudam todo mês:
  - `etufor_2023.zip`, `etufor_2026.zip`, `metrofor_2024.zip`, `metrofor_2025.zip` e `arce_2025.zip` (cerca de 30 MB);
  - `fortaleza_ruas.osm.pbf` (3 MB).

Com isso, qualquer pessoa reproduz os números publicados.

**Como fazer:**
1. No GitHub, abra o repositório, clique em **Releases** e depois em **Draft a new release**.
2. Crie a tag `v1.0`, com o título "Bairros de Fortaleza: outubro de 2026".
3. Arraste os arquivos.
4. Clique em **Publish**.

O vídeo em qualidade máxima (109 MB) existia só no ambiente da sessão. Para refazer: `cd video && npx remotion render Lancamento out/bairros-de-fortaleza.mp4 --codec=h264 --crf=16` (veja `video/README.md`).

### 7. Vídeo com mais rotas
Ficou para depois: mostrar mais o "Quanto tempo de ônibus", as linhas diretas e a camada nova de linhas. Os pontos de partida são a cena `video/src/cenas/Onibus.tsx` e as capturas de `video/scripts/capturar_telas.mjs`.

### 8. Apagar as branches velhas
O acesso da sessão ao GitHub só permite mexer na própria branch, então o push de exclusão foi recusado (HTTP 403).

**Situação das branches:**
- `claude/hopeful-carson-5948yj`: não tem nada que a main não tenha;
- `revisao-stash`: tem 2 commits da primeira versão do vídeo, que já foi refeita na main.

**Como apagar**, por qualquer um destes caminhos:
- no GitHub: **Branches**, depois a lixeira ao lado de cada uma;
- no terminal: `git push origin --delete revisao-stash claude/hopeful-carson-5948yj`.

### 9. Fazer o teste bloquear o merge
O workflow `.github/workflows/testes.yml` roda em cada PR, mas por enquanto só informa o resultado.

**Para ele impedir um merge com teste vermelho:**
1. No GitHub, vá em **Settings → Rules → Rulesets** (ou **Branches → Add branch protection rule**).
2. Escolha a branch `main`.
3. Marque **Require status checks to pass**.
4. Selecione o check **Testes / painel**.

A Vercel continua publicando a main a cada merge, como hoje.

## Para depois

**Painel:**
- **Peso dos arquivos sob demanda:**
  - `linhas_tracados.js` (622 KB), `transporte_linhas.js` (532 KB) e `paradas.js` (507 KB);
  - arredondar as coordenadas para 4 casas e simplificar mais os traçados corta cerca de 40%.
- **Camada do Strava:** depende de tiles externos, que podem mudar de acesso sem aviso.
- **Acessibilidade e desempenho no celular:** contraste, navegação por teclado no mapa e Lighthouse.
- **Data de atualização em cada camada:** os preços são uma coleta única (02/10/2026) e a segurança vai até 2025, por AIS.

**Repositório:** o histórico do git tem 109 MB por causa dos vídeos antigos. Dá para limpar com `git filter-repo`, mas isso reescreve o histórico de todo mundo, então só por decisão sua.

**Atualização automática:** um Action mensal que baixa o GTFS novo do Mobility Database e abre uma issue quando a ETUFOR voltar a publicar viagens de dia útil (destrava os itens 1, 2 e 4).

**Dados novos, na ordem sugerida:**
1. **Educação e saúde:** escolas e IDEB (INEP/QEdu) e unidades de saúde (CNES/DataSUS), com coordenadas.
2. **Risco de alagamento e áreas de risco:** Defesa Civil de Fortaleza e SGB/CPRM.
3. **Mais do Censo 2022:** idade, densidade e alfabetização, no mesmo pipeline do IBGE.
4. **Verde e calor:** NDVI e temperatura de superfície (Sentinel-2/Landsat, MapBiomas).
5. **Mobilidade ativa:** ciclofaixas e estações do Bicicletar.
6. **Aluguel:** ampliar a coleta do PriceRadar, que hoje só pega venda.
7. **Outros:**
   - IPTU/ITBI;
   - zoneamento e ZEIS (LPUOS);
   - acidentes de trânsito (AMC);
   - empregos formais (RAIS/CAGED);
   - segurança por bairro (SSPDS).
