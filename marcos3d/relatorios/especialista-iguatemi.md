# Especialista Iguatemi — Shopping Iguatemi Bosque refeito do zero

Status: **em andamento**. Este arquivo é atualizado a cada etapa.

## Etapa 1 — Entender (concluída)

- **"Antes"** (publicado em `dashboard/marcos/shopping-iguatemi.glb`): 150 KB, 4.470 triângulos, 34 malhas (185 nós sem nome), 29 materiais sem nome, altura 9,5 m.
- **Versão da oficina antes deste trabalho:** 113 KB, 6.646 triângulos, 33 malhas, 26 materiais, altura 9,6 m.
- **Diagnóstico do antigo:**
  - **CRÍTICO (leitura):** um tapete de lajes brancas sem hierarquia; nada diz "Iguatemi".
  - **ALTO:**
    - cones de vidro e pirâmides soltos sobre o telhado;
    - gramado em hexágono deslocado da praça;
    - "torre de caixa d'água" sem fonte;
    - letreiro genérico cortado;
    - copas em icosaedro sem tronco.
  - **MÉDIO:** fachadas em textura chapada; nenhuma sombra de contato.
- **Barra de qualidade** (renders de Castelão, Aeroporto, Messejana e Praia do Futuro, na luz do site): leitura imediata do ícone; árvores com tronco e copa; ruas com faixa e carros; chão coberto; formas secundárias com sombra.

## Etapa 2 — Pesquisa (concluída, com limitação de rede)

- Ver `pesquisa/iguatemi/ficha.md`.
- O proxy bloqueou OSM, Wikimedia e Wikipédia; só o WebSearch funcionou. **Não há fotos de referência.**
- Ícones confirmados por fonte:
  - **cobertura de madeira MLC curvilínea de ~4.500 m² (vão de 48 m)** sobre o Garden Court da expansão de 2015 (LaGuarda.Low);
  - **fachada de vidro verde em estrutura metálica branca**, com pé-direito triplo na entrada e alumínio composto perfurado;
  - **marquise sobre um cone de tubos de aço de 10 m** (anos 1990);
  - **claraboia de vidro sobre o corredor** (1992);
  - **edifício-garagem**;
  - **mata do Cocó ao norte e a leste**;
  - **frente na Av. Washington Soares** (rumo 135°).

## Etapa 2b — Passada de referências com rede (concluída)

- **OSM (API 0.6):** a planta real do shopping está mapeada em detalhe, com o contorno inteiro e ~40 partes com altura do cadastro da Prefeitura. Isso substituiu o contorno aproximado da sessão anterior.
- **Vista aérea Esri** (só para olhar, alinhada com o OSM): revelou a **forma em gota** da cobertura do Garden Court, que tem ~4.500 m², a área declarada da cobertura de madeira. Revelou também a **proa de vidro em grelha branca**, a **rotunda em leque**, a **claraboia em lente**, a **pirâmide** e a **cúpula octogonal**, o **plano de vidro inclinado com aletas** e a claraboia longa da espinha.
- **Commons e Wikipédia:** nenhuma foto do exterior. Só interiores (`Iguatemi_3.JPG`: abóbada de vidro com nervuras brancas) e um feirão no estacionamento. As dúvidas de fachada continuam e estão na ficha.
- Referências salvas em `pesquisa/iguatemi/ref-1..5` (fora do git). A ficha foi atualizada, com a seção "Atualização com rede liberada".

## Composição (nova, a partir da planta real)

- **Planta real, sem giro (norte em −z),** encolhida em torno do ponto real (0, 35):
  - **K = 0,135** até 170 m do centro;
  - **daí para fora, compressão radial suave** (o excesso de raio entra a 55%);
  - assim o miolo icônico (gota, proa, rotunda, lente, pirâmide, cúpula) fica grande, e as pontas (cinema, bloco norte, extremos da espinha) cabem até ~30 m.
- **Alturas:**
  - h' = 0,297·h até 16 m reais; acima disso, 0,2 m por metro;
  - os blocos altos da borda (cinema, 26 m) não roubam a cena do Garden Court, que fica como o ponto mais alto do miolo (~7 m).
- **Hierarquia de leitura:**
  1. a gota bege com grelha de madeira e anel branco;
  2. a proa de vidro verde em grelha branca e a rotunda;
  3. a espinha com a claraboia;
  4. o resto: embasamento cinza-quente com máquinas, garagem em lajes, estacionamentos, a mata do Cocó em faixa ao norte e a leste, e a Washington Soares ao sul.
