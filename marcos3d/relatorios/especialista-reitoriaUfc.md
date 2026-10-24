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
