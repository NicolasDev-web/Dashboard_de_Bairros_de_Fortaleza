# Especialista Reitoria da UFC — refação do zero

Status: **em andamento** (etapa 1: pesquisa e plano). Nada publicado em `dashboard/`, nenhum commit.

## 1. Pesquisa e referências
A ficha está em `pesquisa/reitoriaUfc/ficha.md`.

**Rede nesta sessão:** Wikimedia, Wikipédia, OSM e Esri bloqueados (403 do proxy); o `WebFetch` não resolve
`www.ufc.br`. Só o `WebSearch` respondeu. Trabalhei com a ficha da rodada anterior (fotos "Reitoria da UFC 02/03/05"
olhadas naquela sessão), a seção da Reitoria em `relatorios/criador-2.md` e a planta já convertida no `.tsx` antigo.

**O que o `WebSearch` confirmou em texto:**
- palacete da família Gentil, de 1918, comprado pela UFC em 1956 (pela imobiliária Frota Gentil) e adaptado para a
  Reitoria, que continua lá; fica no quadrilátero da Av. da Universidade com a Av. Treze de Maio;
- endereço: Av. da Universidade, 2853, Benfica;
- no restauro do Salão Dourado (2023) apareceram pinturas parietais com flor-de-lis, ligadas ao ecletismo;
- a Concha Acústica fica no conjunto do prédio histórico da Reitoria (obras no "pavilhão auricular" e na arquibancada);
- os **anexos** da Reitoria são modernistas (José Liberal de Castro e Neudson Braga, 1967) e estão em estudo de
  tombamento (O Povo, jul. 2026). Ficaram fora do recorte.

Nenhuma fonte de texto descreve a cor da fachada nem o torreão: isso vem só das fotos olhadas na rodada anterior.

## 2. Diagnóstico da versão anterior
- **Crítico:** rumo real (pátio da frente para 311°). As câmeras da oficina vêm do sul, então o palacete com o torreão
  aparecia **ao fundo**, pequeno; o primeiro plano era a fachada lateral comprida da ala sudoeste.
- **Alto:** sem oclusão assada; as lajes cinza chapadas dominam a vista de cima; árvores todas iguais (icosaedros);
  sem avenida, sem gente, sem carros: nada situa o lugar no Benfica.
- **Médio:** balaustradas em textura com alphaTest; o torreão e o pórtico pequenos demais para ler.

## 3. Plano (composição)
Recorte "a Reitoria vista da Av. da Universidade":
1. a avenida (4 faixas, carros) e a calçada com o gradil no primeiro plano;
2. o jardim da frente com as carnaúbas e a via interna asfaltada com meio-fio branco;
3. **o H inteiro**, com o pátio da frente aberto para a câmera: à esquerda o **palacete com o torreão** (protagonista),
   à direita a ponta da ala sudoeste; no fundo do pátio, o corpo central com a varanda de colunas e a sacada;
4. atrás, o pátio de trás e a **Concha Acústica** com a arquibancada, entre mangueiras grandes (o campus).

Composição girada para o pátio da frente olhar para as câmeras (ver `GIRO` no script).

## 4. Rodadas (registro parcial, atualizado a cada etapa)
1. **R1** (GIRO −8°, o pátio da frente olhando para as câmeras):
   - Perspectiva e frente boas: o H inteiro com o pátio, as carnaúbas, o gradil e a avenida.
   - **Crítico:** no `close` o palacete e o torreão saíam cortados na borda esquerda. Com zoom 0,38, o close só
     enquadra ±18 m em volta do centro, e o H tem 51 m de largura. O primeiro plano era a ponta lisa da ala sudoeste.
   - Também: duas casas do outro lado da avenida pareciam caixotes e tapavam a `frente`; carnaúbas demais diante da
     fachada; telhado saturado; gramado em quadrados.
2. **R2** (GIRO +62°):
   - Calculei o giro que põe o torreão dentro do close: com o pátio virado ~62° para leste, o lado nordeste (varanda
     externa e torreão) fica de frente para a perspectiva e a `frente`, e o close (az +24°) pega o pórtico e o pátio a
     ~40°. É a vista da foto 05 da ficha, tirada a nordeste do prédio.
   - Tirei as casas, reduzi as carnaúbas, baixei a saturação do telhado e o contraste do gramado.
   - Export: 482 KB, mas 133 mil triângulos (com instâncias) e 7.804 degenerados (polos dos tornos).
3. **R3:**
   - Tornos sem polo (balaústres e fustes), balaústre de 5 lados, passo de 0,34 m → 69 mil triângulos, 0 degenerados.
   - As copas das mangueiras passavam da borda (raio 34,3 m com o pedestal): reposicionei as árvores e limitei o raio
     da copa pela distância à borda → raio 34,0 m.
   - Flor-de-lis redesenhada: as pétalas laterais saíam como chifres. Conferida num close do Blender.
   - Árvores na frente do lado nordeste encobriam a colunata: viraram oitis menores nas pontas.
   - Canteiros de flores (discos coloridos de brinquedo) viraram topiarias de sebe.
