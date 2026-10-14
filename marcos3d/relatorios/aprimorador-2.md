# Aprimorador — lote 2 (porta 5331)

Marcos: Unifor, Shopping Iguatemi Bosque, North Shopping Fortaleza, RioMar Fortaleza, RioMar Kennedy e Terminal Antônio Bezerra.
Arquivos editados: `src/marcos/Unifor.tsx`, `Iguatemi.tsx`, `NorthShopping.tsx`, `RioMar.tsx` e `TerminalAntonioBezerra.tsx`. Não mexi em nenhum outro arquivo.

## Como foi feito

- **Antes:** renders `glb-*` do GLB publicado (`dashboard/marcos/`) e `npm run checar -- --de publicados`. Os `.tsx` de origem geravam o mesmo modelo que o GLB publicado (mesmos triângulos), então o `glb-*` é o "antes" de referência.
- **Depois:** `npm run exportar` → `saida/<arquivo>.glb` → `npm run checar` aprovado → renders `tsx-*`. Pelo menos duas rodadas de render, crítica e correção por marco.
- **Raio:** o `checar` sempre mostra 34,0 m porque o pedestal entra no GLB. Para ver o raio do conteúdo, usei um script descartável (`node_modules/.raio-lote2.mjs`, fora do git) que mede cada nó sem o `Base_Pedestal`. Esse é o "raio do conteúdo" das tabelas.
- **Notas sobre a oficina:**
  - Com quatro agentes renderizando ao mesmo tempo (SwiftShader), o `render.mjs` às vezes estoura o tempo de navegação (30 s) ou o `Target.createTarget`, porque não tenta de novo. Contornei rodando uma vista por chamada, com até três tentativas. Sugestão para o script: tentar de novo dentro de `abrir()`.
  - Sem env map no site, `metalness` alto escurece muito vidro e metal. Mantive metal entre 0,3 e 0,4 e vidro entre 0,2 e 0,3, com a cor-base mais clara.

### Recursos usados em todos os marcos do lote

- **Nomes:** toda malha tem `name` e todo material criado à mão tem `name` (`Mat_...`). As cores chapadas vêm de `fab.cor()`, que já nomeia.
- **Texturas em canvas:** com UV em metros e `RepeatWrapping`, até 4 por modelo, de 32 a 512 px.
- **Repetições em InstancedMesh:** árvores, carros, máquinas de cobertura, pilares, lajes de torre, faixas de rua e ônibus. Peças fixas iguais foram fundidas numa só malha, com grupos por material.
- **Árvores:**
  - giro aleatório por instância e 4 ou 5 tons;
  - a copa encosta no chão em vez de flutuar;
  - as palmeiras têm a coroa achatada, para não parecerem bolas.
- **Carros:** carroceria e cabine numa geometria só (antes eram uma caixa).

---

## 1. Unifor (`unifor` → `Unifor.tsx`)

### ANTES — problemas por gravidade

**CRÍTICO**
- A Av. Washington Soares (plano de 2 × 30 m inclinado 6°) saía do pedestal: raio de 35,6 m, com 34 de limite. Por isso o `checar` reprovava.
- A abóbada do ginásio estava com o meio-cilindro errado. Com `thetaStart = π/2` e a rotação em z, a casca ficava em pé, cortada por um plano vertical, e descia 1,45 m abaixo do chão: y mínimo de −0,95 m no GLB. Por isso o ginásio aparecia como uma "parede curva" ao lado da caixa.

**ALTO**
- 188 malhas e 24 materiais sem nome.
- Os blocos eram caixas brancas sem janelas nem chanfro (InstancedMesh de cubo esticado), sem leitura de "prédio de aulas".

**MÉDIO**
- Nenhum chanfro: quinas vivas em todo o modelo.
- Materiais genéricos: vidro das torres sem brilho, abóbada fosca e copas com material sem nome.
- O gramado era um adesivo plano, sem borda: o campus terminava sem aresta sobre o pedestal.
- As copas flutuavam de 0,15 a 0,26 m sobre o chão.

**BAIXO**
- A pista não tinha faixa, e a arquibancada era uma caixa.
- O estacionamento solar não tinha estrutura (os painéis flutuavam).
- O lago não tinha margem.

### DEPOIS — alterações

1. **Avenida no pedestal.** Virou uma faixa recortada pelo círculo da base (`faixaNoDisco`): cada canto vai até o raio útil de 33,2 m, então a ponta acompanha a curva. Também ganhou um canteiro central claro.
2. **Ginásio.** A abóbada foi corrigida (θ de 0 a π: a casca fica toda acima de y = 1,6) e ganhou cinco nervuras de aço (meio-toros fundidos). A base tem chanfro e a fita de janelas.
3. **Blocos de aula.** São 15 barras chanfradas (0,12 m), fundidas numa malha só (`Blocos_Aula`) com três grupos:
   - topo;
   - paredes com a textura de fita de janelas e brises (UV em metros, módulo de 1,2 × 1,0 m);
   - laje de cobertura recuada, mais cinza, que desenha a platibanda.
4. **Reitoria e Biblioteca.** Usam `prismaDePlanta` com chanfro e a mesma textura de janelas, tingida: cáqui na Reitoria, branca na Biblioteca.
5. **Centro de Convivência.**
   - O tambor agora é um torno com a cornija chanfrada, sobre uma faixa de vidro escuro recuada, que lê como pilotis.
   - As torres de vidro azul ganharam anel de laje no topo.
   - A parede azul-petróleo e o pórtico têm chanfro.
   - O letreiro passou para uma textura de 512 px (era de 1024).
6. **Bloco M.** Volume chanfrado com janelas. O "UNIFOR" no telhado foi mantido, numa textura de 256 px (era de 512).
7. **Pista.** Ganhou a faixa branca interna e uma arquibancada de verdade: degraus extrudados, muro de fundo e laje de cobertura.
8. **Estacionamento solar.** Os painéis são uma InstancedMesh com material de painel (rugosidade baixa) e ficam sobre 18 pilares de aço.
9. **Gramado.** Virou uma laje de 10 cm com a borda chanfrada e a textura `texturaManchada`, com variação suave. O lago ganhou margem de areia.
10. **Materiais com intenção:**
    - vidro azul e vidro escuro com rugosidade baixa;
    - metal da cobertura e aço com metalness de 0,35 a 0,4;
    - painel solar.
11. **Nomes.** Tudo nomeado. Também juntei tons de branco quase iguais em menos materiais.

### IMPACTO

- **Funcionalidade:**
  - o GLB agora passa no `checar` (antes reprovava em raio e base);
  - nada sai do pedestal (raio do conteúdo de 33,19 m) e nada fica abaixo do chão.
- **Leitura:**
  - o ginásio voltou a ser um hangar abobadado;
  - os blocos leem como prédios de aula de dois pavimentos;
  - o campus tem borda;
  - a avenida acompanha a base.
- **Qualidade visual:** os chanfros pegam a luz nas quinas; o vidro e o metal se diferenciam do reboco.
- **Performance:**
  - as malhas caíram de 188 nós para 30;
  - o arquivo caiu de 150 para 128 KB, mesmo com 3 texturas a mais e o dobro de triângulos (ainda pouco).
- **Consistência:** a mesma linguagem (chanfro, fita de janelas, copas giradas) dos outros marcos do lote.

### Notas (0–10)

| Critério | Antes | Depois |
|---|---|---|
| Geometria | 3 | 7 |
| Topologia | 6 | 7 |
| Proporções | 6 | 7 |
| Detalhamento | 4 | 7 |
| Materiais | 3 | 7 |
| Texturas | 3 | 7 |
| Shading | 5 | 7 |
| Realismo | 4 | 6 |
| Otimização | 5 | 8 |
| Apresentação | 4 | 7 |

### Números

| | Antes (publicado) | Depois (`saida/unifor.glb`) |
|---|---|---|
| Tamanho | 150 KB | 128 KB |
| Triângulos | 4.716 | 7.710 |
| Malhas (nós com malha) | 188 sem nome | 30, todas nomeadas |
| Materiais | 24, sem nome | 28 (com o pedestal), todos nomeados |
| Raio do conteúdo | 35,6 m (reprovado) | 33,19 m |
| y mínimo | −0,95 m (reprovado) | 0,00 m |
| Altura máxima | 5,7 m | 5,8 m |

### Checklist do item 27

- [x] Proporção correta
- [x] Silhueta convincente
- [x] Escala correta
- [x] Geometria limpa
- [x] Normais corretas
- [x] Shading correto
- [x] Sem clipping indesejado
- [x] Sem geometria flutuando: as copas encostam no chão e os painéis solares têm pilares
- [x] Sem faces duplicadas
- [x] Bevels coerentes
- [x] Materiais coerentes
- [x] Texturas adequadas
- [x] UV organizada (em metros)
- [x] Nível de detalhe adequado
- [x] Performance adequada
- [x] Arquivo organizado
- [x] Nomenclatura organizada
- [x] Exportação correta (`checar` OK)

**Etiqueta:** a altura não mudou; os 7 m continuam bons, com o topo em 5,8 m.

**Pendências:**
- O arquivo de pesquisa citado (`pesquisa/marcos/unifor/ficha.md`) não existe no repositório. As cores e a fita de janelas dos blocos são uma simplificação neutra, sem foto de referência.
- O letreiro "UNIVERSIDADE DE FORTALEZA" fica virado para o oeste e não aparece nas vistas padrão; isso foi mantido como estava no original.

---

## 2. Shopping Iguatemi Bosque (`iguatemi` → `Iguatemi.tsx`)

### ANTES — problemas por gravidade

**CRÍTICO**
- Nenhum. O GLB passava no `checar`.

**ALTO**
- 185 malhas e 29 materiais sem nome.
- O letreiro IGUATEMI estava meio enterrado na parede: uma caixa de 9 m sem giro, a 0,25 m da linha da fachada inclinada. Na vista próxima lia "IGUATEM".
- As fachadas eram planos chapados sem nenhuma modulação; de perto, o shopping parecia feito de blocos de espuma.

**MÉDIO**
- Nenhum chanfro.
- O telhado era uma grande área branca vazia: sem escala, sem máquinas.
- As pirâmides de vidro apareciam como "bolhas" azuis foscas, sem base.
- A rotunda oeste era um cilindro liso com um disco em cima.
- A praça era um adesivo verde chapado.

**BAIXO**
- Carros em caixa simples.
- Árvores todas com o mesmo giro.
- A torre de exaustão não tinha arremate.

### DEPOIS — alterações

1. **Volumes com chanfro.** Todos usam `prismaDePlanta` com chanfro de 0,12 a 0,15 m.
2. **Textura de fachada das galerias.** Mostra as juntas dos painéis a cada 2 m, a linha da laje e a sombra da platibanda (UV em metros), em duas tintas: bege `#d8cbb4` e clara.
3. **Edifício-garagem.** Ganhou a textura dos pavimentos abertos: um nível a cada 1,15 m, com pilares.
4. **Letreiro.** Foi alinhado à aresta da fachada sul (giro calculado da planta) e afastado 0,32 m para fora, com a face de letras só na frente. Agora lê "IGUATEMI" inteiro.
5. **Máquinas de ar-condicionado e casas de máquinas.**
   - Há 26 máquinas na laje das galerias e de 2 a 3 em cada bloco alto.
   - São uma InstancedMesh com caixa chanfrada, que dá escala ao telhado, a vista mais vista no tour.
6. **Rotunda oeste.**
   - O tambor agora é um torno com a quina chanfrada.
   - Ganhou uma fita de vidro escuro a 4 m de altura.
   - A cobertura branca tem aba e degrau.
   - Os perfis não têm ponto no eixo, para evitar triângulos degenerados; o topo é um disco fundido.
7. **Pirâmides de vidro.** Têm material de vidro (rugosidade 0,1) e base quadrada de metal. A claraboia em lente ganhou um aro de metal.
8. **Praça.** Virou uma laje de 10 cm com a borda chanfrada e a grama manchada, com árvores esparsas longe das paredes.
9. **Mata do Cocó.** As árvores têm giro e tom variados por instância e encostam no chão.
10. **Detalhes menores.** Os carros ganharam cabine, o pilar da marquise é de aço e a torre de exaustão tem arremate.

### IMPACTO

- **Leitura:**
  - o letreiro lê inteiro;
  - a rotunda e as pirâmides viraram peças de arquitetura, não primitivas;
  - o telhado tem escala.
- **Realismo e qualidade visual:**
  - juntas e lajes nas fachadas;
  - chanfros que desenham o contorno contra o fundo;
  - vidro que reflete diferente do reboco.
- **Performance:** as malhas caíram de 185 nós para 33, e o arquivo de 150 para 113 KB.
- **Consistência:** a mesma linguagem do lote.

### Notas (0–10)

| Critério | Antes | Depois |
|---|---|---|
| Geometria | 5 | 7 |
| Topologia | 6 | 7 |
| Proporções | 6 | 6 |
| Detalhamento | 4 | 7 |
| Materiais | 3 | 7 |
| Texturas | 2 | 6 |
| Shading | 5 | 7 |
| Realismo | 4 | 6 |
| Otimização | 5 | 8 |
| Apresentação | 5 | 7 |

### Números

| | Antes (publicado) | Depois (`saida/shopping-iguatemi.glb`) |
|---|---|---|
| Tamanho | 150 KB | 113 KB |
| Triângulos | 4.470 | 6.646 |
| Malhas (nós com malha) | 185 sem nome | 33, todas nomeadas |
| Materiais | 29, sem nome | 26 (com o pedestal), todos nomeados |
| Raio do conteúdo | ≤ 34 | 31,7 m |
| Altura máxima | 9,5 m | 9,6 m |

### Checklist do item 27

- [x] Proporção correta (planta do OSM mantida)
- [x] Silhueta convincente
- [x] Escala correta
- [x] Geometria limpa
- [x] Normais corretas
- [x] Shading correto
- [x] Sem clipping indesejado: o letreiro saiu de dentro da parede
- [x] Sem geometria flutuando
- [x] Sem faces duplicadas
- [x] Sem triângulos degenerados
- [x] Bevels coerentes
- [x] Materiais coerentes
- [x] Texturas adequadas (4: fachada, garagem, letreiro, grama)
- [x] UV organizada (em metros)
- [x] Nível de detalhe adequado
- [x] Performance adequada
- [x] Arquivo organizado
- [x] Nomenclatura organizada
- [x] Exportação correta (`checar` OK)

**Etiqueta:** a altura não mudou; os 9 m continuam bons, com o topo da torre em 9,6 m.

**Pendências:**
- Não há foto de referência no repositório. A textura das fachadas é uma modulação neutra de painéis, não a fachada real.
- Muito do pedestal ao sul e a sudoeste continua vazio: é o espaço da avenida, que o modelo original não desenhava, e não inventei.
