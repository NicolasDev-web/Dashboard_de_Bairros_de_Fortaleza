# Auditoria técnica e de produto — Dashboard de Bairros de Fortaleza

Data da auditoria: 05/10/2026

Escopo: repositório completo, aplicação pública, pipeline de dados e vídeo de lançamento. Esta auditoria não alterou a aplicação.

## 1. Resumo da aplicação

### Evidências encontradas

O projeto é uma aplicação estática e pública para explorar e comparar os 121 bairros de Fortaleza. Reúne renda, saneamento, segurança, evolução entre 2010 e 2022, preços imobiliários, transporte, praças, equipamentos públicos e rotas. Também contém o fluxo “Onde morar”, que cruza orçamento, deslocamento e preferências para recomendar bairros.

### Interpretação de produto

O público provável inclui moradores, pessoas planejando uma mudança, pesquisadores e profissionais interessados no território. O problema resolvido é a fragmentação das informações: a aplicação transforma fontes distintas em uma visão comparável. O resultado esperado é que o usuário termine a jornada mais informado e confiante — sem tratar o índice ou a recomendação como verdade absoluta.

O produto está funcional e visualmente maduro para demonstração, mas ainda não está pronto para uma operação pública robusta sem reforços de disponibilidade, atualização de dados, privacidade, acessibilidade e automação de qualidade.

## 2. Arquitetura encontrada

- Front-end: HTML, CSS e JavaScript puro, sem framework no runtime.
- Mapas: Leaflet carregado pelo cdnjs, com camadas e tiles externos.
- Dados: arquivos JavaScript gerados que expõem estruturas globais (`window.DADOS` e correlatas).
- Pipeline: 12 etapas em Python para coleta, normalização, geoprocessamento, cálculo dos indicadores e geração dos arquivos publicados.
- Persistência/runtime: não há banco, autenticação ou backend; a aplicação é inteiramente client-side.
- Vídeo: projeto React/Remotion separado em `video/`, com composição de 55 segundos.
- Fluxo de dados: fontes públicas e coleta imobiliária → CSV/GeoJSON processados → bundles JavaScript → páginas do dashboard.
- Deploy: não foi encontrada configuração de hospedagem, CI/CD, validação automática de dados ou monitoramento.

Os maiores centros de responsabilidade são `dashboard/app.js` e `dashboard/morar.js`. Eles ainda são compreensíveis, mas concentram renderização, estado, regras e interação em arquivos de 42 KB e 58 KB.

## 3. Jornada principal do usuário

### Exploração

1. O usuário entende a proposta na abertura.
2. Navega até o mapa e o ranking dos 121 bairros.
3. Pesquisa ou seleciona um bairro.
4. Alterna indicadores, pesos e camadas.
5. Examina renda, saneamento, segurança, evolução, preços, equipamentos e transporte.
6. Consulta metodologia, fontes e limitações.

### Onde morar

1. Informa orçamento/renda e entrada.
2. Define deslocamento desejado.
3. Responde a critérios de preferência e essencialidade.
4. Escolhe o ritmo de vida.
5. Recebe uma lista ranqueada de compatibilidade.
6. Pode ajustar respostas e compartilhar o resultado.

O fluxo real possui 10 etapas, embora o README ainda informe 9 perguntas.

## 4. Funcionalidades existentes

| Funcionalidade | Estado | Observação |
|---|---:|---|
| Mapa e ranking dos 121 bairros | ✅ | Busca, seleção e detalhes funcionaram nos testes. |
| Índice composto e pesos | ✅ | Renda, saneamento e segurança; regras documentadas. |
| Evolução 2010–2022 | ✅ | Séries e troca de indicador funcionais. |
| Preços imobiliários | ✅ | 2.867 anúncios coletados em 02/10/2026; há fallback por regional. |
| Praças, equipamentos, hospitais e rotas | ✅ | Camadas e controles implementados. |
| Tempos de transporte | 🟡 | Matriz de tempos existe; itinerários detalhados prometidos na documentação não existem no conjunto atual. |
| Metodologia, fontes e limitações | ✅ | Acima da média em transparência e explicação. |
| Recomendação “Onde morar” | ✅ | Jornada completa, ranking, ajustes e compartilhamento. |
| Compartilhamento da recomendação | 🟡 | Funciona, mas inclui valores financeiros exatos no fragmento da URL. |
| Responsividade | 🟡 | Sem overflow em 390 px; navegação, densidade e alvos de toque ainda precisam de ajuste. |
| Acessibilidade | 🟡 | Há foco, skip link, ARIA e `prefers-reduced-motion`; persistem contraste, rotulagem e tamanho de controles. |
| Pipeline reproduzível | 🟡 | Bem documentado e íntegro, mas sem execução/validação automatizada. |
| Vídeo de lançamento | 🔴 | A composição existe, porém falta `trilha.wav` e as capturas estão desatualizadas. |
| `scripts/baixar_fotos_mrv.py` | ⚫ | Não há referência documental ou uso encontrado; aparenta ser script avulso. |
| Comparação e explicabilidade avançada | 🔵 | Dados já permitem evolução do produto. |

## 5. O que ainda precisa ser feito

- Tornar a aplicação resiliente à indisponibilidade do CDN do Leaflet.
- Alinhar a documentação de transporte ao que os dados atuais realmente entregam.
- Exibir claramente a data/base temporal de cada fonte, sobretudo transporte.
- Remover ou tornar opcional o compartilhamento de renda e entrada exatas.
- Criar testes automatizados para pipeline, regras críticas e fluxos principais.
- Criar uma estratégia de CI/CD, publicação, cache, compressão e monitoramento.
- Corrigir contraste, rotulagem acessível, alvos de toque e navegação móvel.
- Atualizar README de 9 para 10 perguntas e documentar o limite dos 10 resultados exibidos.
- Gerar a trilha ausente e refazer as capturas do vídeo com os dados atuais.
- Decidir se `baixar_fotos_mrv.py` deve ser documentado, integrado ou removido.

## 6. Problemas encontrados

Não foi identificado problema P0. Os riscos mais importantes são P1 de disponibilidade, confiança nos dados, privacidade e experiência móvel.

| Prioridade | Problema | Impacto | Local |
|---|---|---|---|
| P1 | Leaflet é dependência externa sem fallback local; quando o CDN falha, ocorre `L is not defined` e a experiência principal não inicia. | Indisponibilidade do fluxo principal e risco de cadeia de suprimentos. | `dashboard/index.html`, `dashboard/morar.html` |
| P1 | Transporte usa base temporal de 2023 e deslocamento de calendário Metrofor; a interface comunica apenas “dia útil”. | Usuário pode interpretar tempos históricos/modelados como atuais. | `data/processed/transporte_meta.json`, `dashboard/transporte.js` |
| P1 | Documentação promete até três itinerários, mas os dados atuais têm `rotas=false` e nenhum detalhe de rota. | Quebra de expectativa e perda de confiança. | `README.md`, `dashboard/transporte.js` |
| P1 | Link compartilhável carrega renda e entrada exatas no hash. | Exposição involuntária ao copiar link e persistência no histórico local. | `dashboard/morar.js` |
| P1 | Menu de seções desaparece no mobile e o CTA também some abaixo de 480 px. | Descoberta e navegação ficam piores numa página muito longa. | `dashboard/styles.css` |
| P1 | Texto secundário pequeno usa contraste aproximado de 3,94:1; outras cores gráficas ficam abaixo disso. | Falha WCAG AA e leitura difícil, especialmente no celular. | `dashboard/styles.css`, `dashboard/morar.css` |
| P1 | Não há testes, CI nem gates de integridade/frescor para regras e dados complexos. | Regressões silenciosas e publicação de dados inconsistentes. | Repositório/pipeline |
| P2 | Os dois JS principais concentram estado, UI e regras de negócio. | Manutenção e testes ficam mais caros à medida que o produto cresce. | `dashboard/app.js`, `dashboard/morar.js` |
| P2 | Aproximadamente 878 KB são carregados inicialmente; o projeto publicado soma cerca de 1,4 MB bruto. | Custo de rede e parse, principalmente em conexões móveis. | `dashboard/*.js` |
| P2 | Premissas financeiras de 10,5% a.a., 360 meses e 30% da renda estão hardcoded. | Recomendação perde atualidade e não permite simular cenários. | `dashboard/morar.js` |
| P2 | Controles de 34–36 px e texto de 12 px são frequentes. | Toque e leitura menos confortáveis. | CSS do dashboard |
| P2 | Busca não tem rótulo acessível explícito; progresso do questionário não anuncia bem posição/estado. | Experiência incompleta para leitor de tela. | `dashboard/index.html`, `dashboard/morar.html/js` |
| P2 | Resultado mostra apenas os 10 primeiros sem deixar o recorte suficientemente explícito. | Usuário pode confundir “compatíveis” com “exibidos”. | `dashboard/morar.js` |
| P2 | Vídeo referencia áudio inexistente e usa telas/valores antigos. | Build/render não é autocontido e comunicação diverge do produto. | `video/` |
| P3 | Faltam Open Graph, Twitter Card, canonical e manifesto. | Compartilhamento e presença web abaixo do potencial. | HTML das páginas |

## 7. Melhorias recomendadas

| Melhoria | Motivo | Impacto | Esforço | Prioridade |
|---|---|---:|---:|---:|
| Hospedar Leaflet localmente ou adicionar fallback, SRI e tratamento de falha | Preservar o fluxo principal e reduzir dependência externa | Alto | 🟢 | P1 |
| Mostrar data, natureza e limitações de cada fonte junto ao dado | Evitar interpretação incorreta de dados históricos/modelados | Alto | 🟢 | P1 |
| Tornar compartilhamento financeiro seguro por padrão | Evitar vazamento acidental de informação pessoal | Alto | 🟢 | P1 |
| Adicionar menu móvel compacto | Devolver navegação numa página de mais de 12 mil px | Alto | 🟢 | P1 |
| Corrigir tokens de contraste e elevar alvos para 44 px | Melhorar acesso e uso móvel | Alto | 🟢 | P1 |
| Criar testes de regras, contratos de dados e smoke tests | Reduzir regressões no índice e nas recomendações | Alto | 🟡 | P1 |
| Automatizar pipeline/CI e publicação com validações | Garantir repetibilidade, frescor e rastreabilidade | Alto | 🟡 | P1 |
| Modularizar por responsabilidade, sem reescrita | Isolar regras, estado, mapas e renderização | Médio | 🟡 | P2 |
| Carregar datasets sob demanda e comprimir/minificar | Melhorar primeira visita em rede móvel | Médio/alto | 🟡 | P2 |
| Tornar premissas financeiras visíveis e configuráveis | Aumentar transparência e longevidade do simulador | Alto | 🟡 | P2 |
| Regenerar áudio e capturas do vídeo | Entregar artefato coerente e reproduzível | Médio | 🟢 | P2 |
| Adicionar metadados sociais e manifesto | Melhorar distribuição e instalação | Baixo/médio | 🟢 | P3 |

## 8. Melhorias de UX/UI

- Manter a excelente identidade visual, mas aumentar contraste e corpo dos textos secundários.
- Mostrar “Top 10 de N bairros compatíveis” e oferecer “ver mais”.
- Fixar ou compactar a navegação no mobile para reduzir a perda de contexto.
- Deixar datas e confiabilidade junto aos números, não apenas na metodologia.
- Transformar a explicação da recomendação em “por que entrou / quais concessões exige”.
- Dar feedback claro quando um recurso externo de mapa não puder ser carregado.
- Preservar as animações atuais: são moderadas, funcionais e respeitam redução de movimento.

## 9. Melhorias de performance

- Prioridade alta: eliminar o ponto único de falha do Leaflet externo.
- Prioridade média: carregar preços, equipamentos, praças e transporte apenas quando a seção/camada for usada.
- Prioridade média: minificar, comprimir e configurar cache imutável para bundles gerados.
- Prioridade média: avaliar divisão do `data.js` por necessidade de página.
- Prioridade baixa: hospedar a fonte localmente ou usar fonte de sistema como caminho de contingência.

Não foram encontrados loops visuais irresponsáveis: animações contínuas usam `requestAnimationFrame`, IntersectionObserver e respeitam `prefers-reduced-motion`.

## 10. Melhorias mobile

- Criar menu de seções e manter um caminho visível para “Onde morar”.
- Aumentar controles interativos para pelo menos 44 × 44 px.
- Reduzir a densidade dos cards do resultado, hoje com muito texto de 10–12 px.
- Oferecer expansão progressiva para detalhes, em vez de exibir tudo em cada card.
- Manter os mapas em altura responsiva; eles funcionaram sem overflow em 390 × 844.
- Testar também 320 px, orientação horizontal, zoom de 200% e dispositivos com WebView antigo.

## 11. Melhorias técnicas

- Extrair regras puras do índice e do recomendador para módulos testáveis.
- Definir contratos/esquemas para os bundles gerados e validar contagens, domínios e nulidade.
- Versionar a metodologia e gravar no build a data de cada fonte.
- Adicionar testes unitários para financiamento, compatibilidade, penalidades e fallback de preços.
- Adicionar smoke tests Playwright para busca, seleção, camadas e questionário.
- Criar pipeline CI com Python AST/lint, JavaScript lint, TypeScript, testes e auditoria de dependências.
- Documentar deploy, headers de segurança, cache e processo de rollback.
- Não reescrever em framework por preferência: a arquitetura estática é adequada ao produto atual.

## 12. Oportunidades de produto

Estas são evoluções, não correções:

1. **Comparar 2–4 bairros:** usa métricas já disponíveis e resolve a decisão lado a lado.
2. **Explicar a recomendação:** mostrar quais critérios elevaram ou reduziram cada bairro e o efeito de mudar um peso.
3. **Salvar uma shortlist local:** ajuda quem volta ao produto sem exigir conta ou backend.
4. **Painel de frescor/confiança:** consolidar data, amostra e limitações por fonte.
5. **Compartilhamento por faixas:** preservar a utilidade do link sem expor renda/entrada exatas.
6. **Exportar um retrato do bairro:** gerar cartão/PDF curto com fonte, data e métricas para comparação externa.

## 13. Quick Wins

1. Incluir fallback/guard de carregamento para Leaflet.
2. Adicionar menu móvel compacto e manter o CTA visível.
3. Corrigir `--tinta-3`, cores de gráficos e altura mínima dos botões.
4. Adicionar rótulo acessível à busca e estado atual ao progresso.
5. Exibir “Top 10 de N” e opção de expandir.
6. Omitir valores financeiros exatos do link por padrão.
7. Exibir a data/base temporal do transporte no próprio componente.
8. Corrigir README: 10 perguntas e situação atual dos itinerários.
9. Regenerar trilha e capturas do vídeo.
10. Criar smoke tests para contagem de bairros e regras críticas.

## 14. Roadmap recomendado

### Fase 1 — Correções essenciais

- Resiliência do Leaflet e feedback de falha.
- Privacidade do link compartilhável.
- Verdade documental e temporal do transporte.
- Testes das regras críticas e contratos de dados.
- Correção do vídeo para um build reproduzível.

### Fase 2 — Experiência

- Navegação móvel.
- Contraste, alvos de toque, rótulos e progresso acessível.
- Clareza do top 10 e simplificação progressiva dos cards.

### Fase 3 — Performance

- Lazy loading de dados por seção.
- Minificação, compressão, cache e assets locais.
- Orçamento de performance medido em rede/dispositivo móvel.

### Fase 4 — Evolução

- Comparador de bairros.
- Shortlist local.
- Explicabilidade da recomendação e painel de frescor.

### Fase 5 — Refinamento

- Metadados sociais, manifesto e polimento visual.
- Documentação de produção, monitoramento e rotina de atualização.
- Revisão de scripts avulsos e redução gradual do acoplamento.

## Evidências de validação

- 85 arquivos analisados; grafo com 607 nós, 984 arestas e 61 comunidades.
- Sintaxe validada em todos os JavaScript do dashboard e em 14 scripts Python.
- `eslint` e `tsc` do vídeo aprovados.
- `pip check` sem dependências quebradas.
- `npm audit --omit=dev` sem vulnerabilidades conhecidas nas 404 dependências resolvidas.
- Nenhum secret encontrado nos arquivos rastreados; nenhum caminho evidente de XSS controlado pelo usuário identificado.
- Dados principais: 121 bairros sem duplicidade/nulos nos conjuntos de índice, indicadores e equipamentos.
- Transporte: 16.093 combinações (121 × 133), com nulidades limitadas ao teto de 150 minutos e tratadas pela interface.
- Jornadas verificadas em 1440 × 900 e 390 × 844; sem overflow horizontal.
- Teste de indisponibilidade externa confirmou que a ausência do Leaflet impede a inicialização.

## Mapa de conhecimento

- God nodes: `main()`, `trilha()`, `clamp`, `compilerOptions`, `render()`, `tempo()`, `EASE`, `brilho()`, `construirTrajeto()` e `atualizar()`.
- Relações úteis: renda alimenta diretamente o índice; o pipeline geoespacial alimenta a experiência do mapa; a construção de trajetos e os pixels do questionário compartilham dependências indiretas de UI.
- Pergunta arquitetural mais relevante: o módulo de recomendação “Onde morar” deve ser separado em regras puras, estado da jornada e renderização para permitir testes e evolução sem reescrita?

Artefatos do grafo: `graphify-out/graph.html`, `graphify-out/graph.json` e `graphify-out/GRAPH_REPORT.md`.
