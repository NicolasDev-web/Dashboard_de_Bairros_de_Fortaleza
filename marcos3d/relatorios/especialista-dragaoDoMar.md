# Especialista Dragão do Mar — miniatura nova

Status: **em andamento** (etapa 1: pesquisa concluída; modelagem a seguir).

## 1. Pesquisa e referências
Ficha completa em `pesquisa/dragaoDoMar/ficha.md`, com as referências `ref-1..5` (fora do git):
- planta do OSM;
- categoria do Commons e subcategorias (planetário, passarela vermelha, anfiteatro, praça, aéreas);
- Wikipédia pt.

Elementos que tornam o lugar reconhecível:
- cúpula geodésica espelhada do Planetário sobre tambor branco em pilotis;
- passarelas de treliça vermelha entre torres brancas de telhado piramidal, cruzando o calçadão da Rua Dragão do Mar;
- cubos brancos do museu com pirâmides rosa e murais;
- rampa curva branca em volta do Planetário;
- casarões coloridos e a Praça Almirante Saldanha.

## Progresso (salvo a cada etapa)
- **Etapa 2, modelagem:** `blender/dragaoDoMar.py` + `src/marcos/novos/DragaoDoMar.tsx` prontos.
- **R1:**
  - telhas quase brancas: o exportador do Blender ignora a cor-base quando há imagem; corrigido no `.tsx`;
  - corpos de fundos em caixotes brancos enormes;
  - rampa escura: o material do chão recebia o aoMap sem UV planar;
  - lona do anfiteatro parecendo um disco voador.
- **R2:** fundos com telhado de quatro águas sobre o retângulo mínimo do lote; piso elevado com material próprio;
  guarda-corpo mais claro; lona em abóbada. O mar de telhados ficou como na ref-2.
- **R3:**
  - Planetário 8% maior e cúpula mais clara;
  - vãos e triângulos nas fachadas oeste do museu e mosaico azul no muro do anfiteatro;
  - pavilhão noroeste encolhido, porque saía do disco (raio 35,5 → 34,0).
- **Primeiro `checar`:** OK, com 486 KB, 31.045 triângulos, 65 malhas e 35 materiais.
