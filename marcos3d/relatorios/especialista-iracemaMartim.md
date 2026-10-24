# Especialista Iracema e Martim: miniatura nova

Status: **concluído**. O `exportar` e o `checar` passaram. Nada foi publicado em `dashboard/` e eu não fiz commit (o
coordenador gravou um ponto de controle no meio do trabalho).

## 1. Pesquisa e referências
- Ficha em `pesquisa/iracemaMartim/ficha.md`, com as fontes e as URLs.
- Rede: Wikimedia, Wikipédia, API do OSM e Esri deram 403, e o `WebFetch` falha. Só o `WebSearch` respondeu, então
  **não vi nenhuma foto**.
- Confirmado por texto:
  - obra de **José Corbiniano Lins**, inaugurada em **24/6/1965**, no centenário de *Iracema*, e restaurada em 2012;
  - **concreto armado pintado**: as reportagens falam em "ferros expostos" e "tinta desgastada", e o Wikidata diz
    "gesso sobre concreto";
  - a cena é a **partida da família numa jangada**, com Iracema, Martim, Moacir e o cão Japi;
  - Iracema tinha uma **lança**, a obra tem um **remo**, e Moacir tem pernas;
  - o estilo é modernista, com "a desproporção das longas pernas".
- O que tirei do OSM (`osm.xml`, `planta.png`):
  - o nó da estátua fica num canteiro de grama de ~17 × 7,6 m, com eixo a 79°, dentro da praça do calçadão;
  - a Av. Beira-Mar passa ~18 m ao sul, com uma travessia em zebra a leste;
  - a Praia do Mucuripe começa ~40 m ao norte, e o quiosque "Thomas Bar" fica no calçadão.

Referências do nível aprovado que usei: `Estoril.tsx` e `estoril.py` (orla, oclusão, instâncias) e `FarolMucuripe.tsx`
(jangadas, `fab.agua()`).

## 2. Rodadas de render → crítica → correção (luz do site)

### Rodada 1
A leitura geral é boa: a jangada sobre o pedestal no canteiro, as quatro figuras, a lança, o remo e o cão, e a orla com
areia, jangadas e mar. Problemas:
- **Alto:** o branco das figuras sai cinza-lilás e se confunde com o calçadão, e o pedestal tem o mesmo cinza do piso.
- **Alto:** Moacir fica escondido atrás de Iracema, no lado norte.
- **Alto:** dois coqueiros logo atrás da escultura embaralham a silhueta na vista de frente.
- **Médio:** a pá do remo é estreita e lê como vara.
- **Médio:** a escultura pode crescer para ler a ~200 px.

Correções:
- tinta `#fdeccc`, que sai branco quente na luz do site;
- pedestal de concreto mais escuro (`#7d776d`), com frisos `#a8a195`;
- Moacir passa para o lado das câmeras, e a lança para a mão esquerda de Iracema;
- tirei os dois coqueiros;
- pá do remo larga, em folha;
- conjunto escultórico inteiro × 1,15.

### Rodada 2
As figuras leem bem no close e na frente:
- Martim no remo de governo;
- Iracema com a lança erguida e a mão no ombro do filho;
- Japi na proa.

O branco ficou quente e destacado do piso, e o pedestal escuro separa a escultura do chão. Problemas:
- **Alto:** na perspectiva (câmera a sudoeste), a vista fica quase ao longo da jangada e as figuras se empilham.
- **Médio:** a cerca-viva da calçada sul parece pedras verdes soltas.
- **Médio:** a praça fica vazia a oeste e a leste.

Correções:
- eixo da jangada e do canteiro a 4° (rumo 86°, entre os 79° do canteiro e os 84° da avenida no OSM);
- cerca-viva contínua;
- o quiosque do Thomas Bar (OSM) junto da areia, com mesas e guarda-sóis;
- mais dois coqueiros na frente da praça.

### Rodada 3
Na perspectiva, as figuras se abriram: o remo em diagonal, a lança e o cão aparecem separados. O quiosque dá vida ao
lado da praia. Problemas:
- **Crítico (contrato):** o `checar` passou, mas mediu raio de 34,4 m; o modelo tem que caber em 33,5 m. Medi malha por
  malha: as coroas dos coqueiros das pontas e a cerca-viva saíam do disco.

Correções:
- os coqueiros só entram se o tronco + 3,8 m de coroa couber no disco;
- os coqueiros das pontas vieram para dentro;
- a cerca-viva começa e termina 2,4 m antes da borda.

### Rodada 4
Tudo dentro do disco (o `checar` agora mede 34,0 m, que é o pedestal da oficina). Na frente, a silhueta lê de longe:
remo, lança, mãe e filho, cão na proa. Problemas:
- **Médio:** três coqueiros se amontoam em cada canto norte.
- **Baixo:** a cerca-viva sul fica pesada em primeiro plano na vista de frente.

Correções:
- tirei os coqueiros de (±26,5; ~8);
- a cerca-viva baixou para 0,7–0,86 m.

### Rodada 5 (final)
Renders finais nas cinco vistas.

**"Alguém de Fortaleza reconhece?"** Pelo que é confirmado, sim:
- **a ~200 px:** um grupo de figuras brancas e altas numa jangada sobre um pedestal escuro, no meio do calçadão, entre a
  Beira-Mar e a areia com jangadas;
- **no close:** o homem no remo, a mulher de cabelo longo com a lança, o menino ao lado e o cão na proa.

A pose e a cor de cada figura não puderam ser conferidas em foto (ver as dúvidas).

## 3. Composição e por quê
- **Norte real** (−z). As câmeras da oficina olham do sul, ou seja, da avenida para o mar, que é como se chega ao
  monumento.
- **De sul para norte:**
  1. calçada do lado dos prédios, com mureta e cerca-viva dos jardins (OSM `landuse=residential`);
  2. Av. Beira-Mar com 4 faixas, a travessia em zebra (OSM `crossing:markings=zebra`) e carros;
  3. praça do calçadão, com faixas de piso, postes, bancos e coqueiros;
  4. canteiro de grama com o monumento;
  5. quiosque com guarda-sóis;
  6. degrau para a areia;
  7. areia com quatro jangadas;
  8. mar com uma jangada de vela aberta.
- **Compressão:** a avenida fica a ~15 m (real ~18 m). A areia começa a 13 m (real ~40 m), para a praia caber no disco.
- **Rumo da jangada:** ao longo do canteiro (rumo 86°), com a proa para leste. O rumo real da proa não foi confirmado.
  Com esse eixo, as figuras ficam de perfil para as vistas da frente e do close.
- **Escala da escultura** (pedido: "maior que a real para ler a ~200 px"). As figuras são:

  | Figura | Altura no modelo |
  |---|---|
  | Martim | **10,8 m** |
  | Iracema | 9,7 m |
  | Moacir | 5,6 m |
  | Japi | ~2,5 m |

  - O conjunto fica sobre um pedestal de 1,8 m e uma jangada de ~15 m. A ponta da lança chega a 17,4 m.
  - Em relação às pessoas da cena (1,6 m), Martim tem **~6,8 vezes** a altura de um visitante.
  - As medidas reais não foram achadas. Se as figuras reais tiverem a altura de uma pessoa grande (~2 a 2,5 m), o
    exagero é de **~4 a 5 vezes**.
  - O resto da cena (pessoas de 1,6 m, carros de 3,7 m, postes de 5,9 m) está em escala de maquete normal.
- **Ficou de fora:**
  - os prédios altos da Beira-Mar (de 62 a 73 m, ao sul): mesmo cortados, ficariam entre a câmera e a escultura;
  - a feirinha e o Mercado dos Peixes: fora do raio de 90 m do OSM baixado;
  - o Riacho Maceió, que passa em galeria sob a praça.

## 4. Como gerar de novo
```sh
cd marcos3d
<python-com-bpy> blender/iracemaMartim.py            # ~10 s: modela, assa a oclusão e exporta (--sem-bake: ~1 s)
export CHROME=<invólucro do chrome>
npm run render -- --ids iracemaMartim --fonte tsx --vistas perspectiva,frente,close,topo,lado --porta 5380
npm run exportar -- --ids iracemaMartim --porta 5380
npm run checar -- --ids iracemaMartim
```
`<python-com-bpy>` é o venv do scratchpad, com Blender 5.2.3.

**O que o `blender/iracemaMartim.py` faz:**
- Usa a base de `bmesh` do Estoril (prismas chanfrados, tornos, recorte no disco, oclusão), copiada para dentro do
  arquivo.
- **Figuras:**
  - a classe `Figura` monta cada corpo com **cápsulas cônicas** (`membro`/`osso`): tronco de revolução achatado (ancas,
    cintura, peito, ombros, pescoço), cabeça com bico de nariz, cabelo longo em Iracema e pés;
  - as pernas e os braços são resolvidos por **IK de dois ossos** (`ik`). Por isso as mãos pegam o remo e a lança de
    verdade, e a mão de Iracema pousa no ombro de Moacir;
  - as proporções são modernistas, com pernas longas e grossas.
- **Jangada:** seis paus roliços com a proa levantada, tornos, banco de vela e banco do mestre. Ela é pintada num tom
  mais escuro que as figuras, para as duas coisas se separarem.
- **Remo de governo:** cabo em diagonal e pá larga apoiada no pedestal, atrás da popa.
- Todo o conjunto escultórico passa por `ESC = 1,15`.
- **Oclusão** assada no Cycles: nas cores de vértice (faixa 0,6–1) e numa imagem de 256 px do chão.
- **Suavização** por ângulo: 62° nas figuras (cápsulas lisas) e 32° no resto.
- **Saídas** em `blender/saida/`:
  - `iracemaMartim-pecas.glb`;
  - `iracemaMartim-ao-chao.jpg`;
  - `iracemaMartim-layout.json`, com 8 coqueiros, 40 pessoas e 4 carros.

**O que o `src/marcos/novos/IracemaMartim.tsx` faz:**
- Carrega as peças, liga as sombras e renomeia cada primitiva como `<Peça>_<Material>`.
- Troca `Mat_Agua_Mar` por `fab.agua()`.
- No chão, aplica o aoMap e as texturas de canvas: placas do calçadão, calçada miúda e manchas no asfalto, na areia e
  na grama. O JPEG da oclusão leva `userData.mimeType`.
- Instancia os coqueiros (inclinados), as pessoas e os carros.

## 5. Os 4 níveis do MASTERCRAFT
**Nível 1 — forma principal:**
- pedestal, jangada e quatro figuras em silhueta legível (dois adultos de pé, um menino, um cão);
- a lança vertical e o remo em diagonal;
- avenida, praça, areia e mar.

**Nível 2 — formas secundárias:**
- **membros articulados com pose:**
  - joelhos e cotovelos dobrados;
  - Martim de pernas abertas no remo;
  - Iracema com o braço erguido segurando a lança e o outro no ombro do filho;
- tronco com ancas, cintura e ombros; busto em Iracema;
- paus da jangada com a proa levantada;
- pedestal em três camadas (soco, corpo e capa);
- canteiro com meio-fio, degrau para a areia, quiosque.

**Nível 3 — detalhes:**
- cabelo longo de Iracema, ponta da lança em folha, pá do remo;
- tornos e bancos da jangada;
- orelhas, focinho, rabo erguido e patas de Japi;
- zebra, faixas tracejadas, postes de globo, bancos virados para o monumento;
- mesas com guarda-sóis;
- jangadas da praia, de vela aberta ou com a vela enrolada;
- espuma da arrebentação, gente, carros, coqueiros.

**Nível 4 — microdetalhes:**
- oclusão assada nas figuras (entre as pernas, sob os braços, na base) e no chão;
- juntas do piso; manchas na areia, no asfalto e na grama;
- variação por instância nas roupas, nos carros e nas folhas;
- coqueiros com inclinação própria;
- rugosidades distintas:

  | Material | Rugosidade | Metalness |
  |---|---|---|
  | Tinta das figuras | 0,62 | — |
  | Tinta da jangada | 0,7 | — |
  | Concreto | 0,88 | — |
  | Mar | `fab.agua()` | — |
  | Postes | 0,45 | 0,4 |
  | Cobertura do quiosque | 0,6 | 0,2 |

## 6. Notas (0–10)
É um marco novo. O "antes" é o placeholder de cilindros que estava no `.tsx`.

| Critério | Antes (placeholder) | Depois |
|---|---|---|
| Geometria | 2 | 8 |
| Topologia | 5 | 7 |
| Proporções | 3 | 7 |
| Detalhamento | 1 | 8 |
| Materiais | 3 | 7 |
| Texturas | 0 | 7 |
| Shading | 4 | 8 |
| Realismo (fidelidade e leitura do lugar) | 1 | 6 |
| Otimização | 7 | 9 |
| Apresentação | 1 | 8 |

O realismo fica em 6 porque a pose, a cor e o pedestal da escultura não puderam ser conferidos em foto.

## 7. Números (`saida/iracema-e-martim-mucuripe.glb`)
| Item | Valor |
|---|---|
| Tamanho | **303 KB** (bruto 817 KB; limite 600) |
| Triângulos | **22.070** |
| Malhas | **37** |
| Materiais | **33** (limite 40) |
| Texturas | 4, todas geradas (ver abaixo) |
| `checar` | **OK**: raio 34,0 m com o pedestal da oficina (o modelo cabe em 33,5 m), altura 17,9 m com o pedestal |

As 4 texturas:
- oclusão do chão, 256 px em JPEG;
- piso, 128 px, em duas variações (calçadão e calçada);
- mancha, 64 px.

## 8. Checklist (item 27)
- [x] Proporção correta: corpos estilizados coerentes entre si. O exagero da escultura e a compressão da orla estão
  documentados.
- [x] Silhueta convincente: remo em diagonal, lança vertical, mãe e filho, cão na proa.
- [x] Escala coerente: pessoas de 1,6 m, carros de 3,7 m; a escultura foi exagerada de propósito (seção 3).
- [x] Geometria limpa: vértices soldados (`remove_doubles`).
- [x] Normais corretas: o `checar` não acusa normais inválidas.
- [x] Shading correto: figuras lisas (62°), arquitetura com quinas (32°).
- [x] Sem clipping indesejado relevante. As cápsulas se sobrepõem nas juntas, como num boneco articulado.
- [x] Sem geometria flutuando: pés no convés, jangada no pedestal, pedestal no piso, pá do remo apoiada.
- [x] Sem faces duplicadas.
- [x] Bevels coerentes: chanfros no pedestal, nos bancos, no quiosque e na cerca-viva.
- [x] Materiais coerentes e nomeados: 33.
- [x] Texturas adequadas: todas geradas em canvas ou assadas.
- [x] UV organizada: chão em UV planar de 67 m; o resto sem textura.
- [x] Nível de detalhe adequado à vista geral e ao close.
- [x] Performance adequada: 303 KB, 22 mil triângulos, 37 malhas.
- [x] Arquivo organizado: script versionado; saídas em `blender/saida/iracemaMartim-*`.
- [x] Nomenclatura em português.
- [x] Exportação correta: `exportar` e `checar` OK.

## 9. Altura da etiqueta
- O ponto mais alto é a ponta da lança de Iracema, a ~17,4 m (17,9 m com o pedestal).
- **`ALTURA_ETIQUETA = 19`** no `.tsx`. Se o `dashboard/historias.js` ganhar altura própria para este marco, sugiro 19
  lá também. Não editei esse arquivo.

## 10. Dúvidas abertas
1. **Cor:** nenhum texto diz a cor da pintura. Usei branco-gelo quente, igual nas quatro figuras, e um tom mais escuro
   na jangada. **É a primeira coisa a conferir numa foto.**
2. **Poses:** onde cada figura está e como está.
   - Que há uma lança (de Iracema) e um remo está confirmado.
   - Que Martim segura o remo na popa, Moacir está de pé ao lado da mãe e Japi está na proa é interpretação.
3. **Jangada da escultura:** não sei se tem vela ou mastro (no modelo, não tem), nem para onde aponta a proa.
4. **Pedestal:** forma, altura e revestimento não confirmados. No modelo é um bloco neutro de concreto em três camadas.
5. **Medidas** reais do conjunto, das quais depende o exagero exato (seção 3).
6. **Entorno:**
   - o quiosque do Thomas Bar só tem a posição do OSM; forma e cores são neutras;
   - coqueiros, postes e bancos são genéricos da orla;
   - a faixa central da avenida está branca (pela regra seria amarela, em via de mão dupla);
   - as jangadas da praia são ambientação, sem posição real;
   - os prédios altos ficaram de fora.
7. **Autoria:** um site de turismo atribui a obra a "Marinho de Souza Júnior", mas os jornais e o Commons dizem
   Corbiniano Lins.

## Renders finais
- `renders/iracemaMartim/tsx-perspectiva.png`
- `renders/iracemaMartim/tsx-close.png`
- `renders/iracemaMartim/tsx-frente.png`
- `renders/iracemaMartim/tsx-lado.png`
- `renders/iracemaMartim/tsx-topo.png`
