/* Bairros de Fortaleza — a história de cada bairro, contada no tour 3D (bairro3d.js).
   MARCOS: as miniaturas em marcos/*.glb (unidade metro, base de 68 m, norte em −z), com o ponto onde pousam e a
   altura da etiqueta. HISTORIAS[id do bairro].capitulos: tipo "bairro" (vista geral), "marco" (voa até a
   miniatura) ou "ponto" (pino em lat/lng). Os pontos foram geocodificados no OpenStreetMap (Nominatim) e
   conferidos contra a malha de bairros da Seuma. A base de todos os bairros é a ficha "História e curiosidades"
   da plataforma Fortaleza em Bairros (Iplanfor); datas e números dos marcos vêm das fontes citadas em cada capítulo.
   Onde as fontes divergem, o texto diz. */
(() => {
  // a numeração dos PDFs do Fortaleza em Bairros é a mesma dos ids da malha, com estas exceções
  const PDF = { 95: 125, 115: 116, 116: 115, 117: 118, 118: 119, 119: 122, 120: 123, 122: 124 };
  const IP = (id) => ({ nome: "Fortaleza em Bairros (Iplanfor, Prefeitura de Fortaleza)", url: `https://fortalezaembairros.fortaleza.ce.gov.br/assets/files/pdf/${PDF[id] || id}.pdf` });
  const F = (nome, url) => ({ nome, url });
  const bairro = (titulo, texto, fonte) => ({ tipo: "bairro", titulo, texto, fonte: [].concat(fonte) });
  const marco = (id, titulo, texto, fonte, extra) => ({ tipo: "marco", marco: id, titulo, texto, fonte: [].concat(fonte), ...extra });
  const ponto = (rotulo, lat, lng, titulo, texto, fonte) => ({ tipo: "ponto", rotulo, lat, lng, titulo, texto, fonte: [].concat(fonte) });
  const so = (id, titulo, texto) => ({ capitulos: [bairro(titulo, texto, IP(id))] });

  const OSM = F("OpenStreetMap (localização)", "https://www.openstreetmap.org/");
  const ATLAS = F("Atlas of Mutual Heritage: Forte Schoonenborch", "https://www.atlasofmutualheritage.nl/page/7132/schoonenburg-fort-fortaleza");
  const OPOVO_PASSEIO = F("O Povo, 2025: Passeio Público é também a Praça dos Mártires", "https://www.opovo.com.br/noticias/fortaleza/2025/02/24/passeio-publico-e-tambem-a-praca-dos-martires-voce-sabe-por-que.html");
  const OPOVO_TJA = F("O Povo, 2025: Theatro José de Alencar celebra 115 anos", "https://mais.opovo.com.br/jornal/vidaearte/2025/06/17/theatro-jose-de-alencar-palco-mais-iconico-do-ceara-celebra-115-anos.html");
  const OPOVO_CATEDRAL = F("O Povo, 2019: o estilo da Catedral de Fortaleza", "https://www.opovo.com.br/noticias/fortaleza/2019/04/18/qual-a-influencia-do-estilo-gotico-da-catedral-de-notre-dame-na-de-fortaleza.html");
  const DN_FERREIRA = F("Diário do Nordeste: Praça do Ferreira, 30 anos da estrutura atual", "https://diariodonordeste.verdesmares.com.br/metro/praca-do-ferreira-completa-30-anos-com-atual-estrutura-arquitetonica-relembre-mudancas-na-historia-1.3171134");
  const OPOVO_MERCADOS = F("O Povo, 2022: mercados públicos de Fortaleza", "https://www.opovo.com.br/noticias/fortaleza/2022/08/03/mercados-publicos-de-fortaleza-proporcionam-vivencia-cultural-na-cidade.html");
  const WIKI_DRAGAO = F("Wikipédia: Centro Dragão do Mar de Arte e Cultura", "https://en.wikipedia.org/wiki/Drag%C3%A3o_do_Mar_Center_of_Art_and_Culture");
  const WIKI_AERO = F("Wikipédia: Aeroporto de Fortaleza", "https://en.wikipedia.org/wiki/Fortaleza_Airport");
  const DN_AERO = F("Diário do Nordeste: 25 anos do terminal do Aeroporto de Fortaleza", "https://diariodonordeste.verdesmares.com.br/opiniao/colunistas/igor-pires/invasao-de-muricocas-e-jumentos-obra-parada-e-modernizacao-25-anos-do-aeroporto-de-fortaleza-1.3333912");
  const DN_CASTELAO = F("Diário do Nordeste: Castelão 50 anos", "https://diariodonordeste.verdesmares.com.br/jogada/castelao-50-anos-palco-de-lembrancas-e-evolucao-do-futebol-cearense-1.3441847");
  const VATICANO = F("Vaticano: discurso de João Paulo II no Castelão, 9/7/1980", "https://www.vatican.va/content/john-paul-ii/pt/speeches/1980/july/documents/hf_jp-ii_spe_19800709_stadio-fortaleza.html");
  const OPOVO_CAMBEBA = F("O Povo, 2022: Virgílio Távora e o Cambeba", "https://mais.opovo.com.br/jornal/opiniao/2022/11/07/vladimir-spinelli-chagas-virgilio-tavora-e-o-cambeba.html");
  const OPOVO_ABOLICAO = F("O Povo, 2023: o Palácio da Abolição", "https://www.opovo.com.br/noticias/fortaleza/2023/09/04/entidades-cearenses-apoiam-a-retirada-do-mausoleu-de-castelo-branco-do-palacio-da-abolicao.html");
  const DN_IRACEMA_MESS = F("Diário do Nordeste: a estátua de Iracema da Lagoa de Messejana", "https://diariodonordeste.verdesmares.com.br/ceara/com-quase-20-anos-estatua-de-iracema-da-lagoa-de-messejana-deve-ser-restaurada-1.3403523");
  const OPOVO_PI100 = F("O Povo, 2025: Praia de Iracema, 100 anos", "https://www.opovo.com.br/noticias/fortaleza/2025/05/17/praia-de-iracema-100-anos-de-historia-memoria-e-resistencia-a-beira-mar.html");
  const OPOVO_GUARDIA = F("O Povo, 2022: a origem da Iracema Guardiã", "https://www.opovo.com.br/vidaearte/2022/05/03/iracema-guardia-conheca-origem-da-estatua-que-tombou-na-praia-de-iracema.html");
  const DN_SHOPPINGS = F("Diário do Nordeste: os shoppings do Ceará", "https://diariodonordeste.verdesmares.com.br/opiniao/colunistas/victor-ximenes/no-ceara-apenas-8-cidades-possuem-shoppings-veja-lista-1.3618830");
  const DN_RMK = F("Diário do Nordeste, 2016: RioMar Kennedy será inaugurado", "https://diariodonordeste.verdesmares.com.br/negocios/riomar-kennedy-sera-inaugurado-nesta-quarta-feira-26-1.1639999");
  const UNIFOR = F("Unifor: Fortaleza 300 anos e a Universidade", "https://unifor.br/-/fortaleza-300-anos-como-a-unifor-contribuiu-para-o-desenvolvimento-da-capital-alencarina");
  const IGUATEMI40 = F("Nosso Meio, 2022: Iguatemi Fortaleza chega aos 40 anos", "https://nossomeio.com.br/pioneiro-no-mercado-cearense-iguatemi-fortaleza-chega-aos-40-anos-de-atuacao-e-anuncia-novidades/");
  const OPOVO_PF = F("O Povo, 2023: a Praia do Futuro", "https://mais.opovo.com.br/reportagens-especiais/2023/12/26/a-praia-do-futuro-que-absorve-a-cidade-e-que-se-espalha-por-ela.html");
  const OPOVO_PF_PATR = F("O Povo, 2026: barracas da Praia do Futuro viram patrimônio de Fortaleza", "https://www.opovo.com.br/noticias/fortaleza/2026/07/31/praia-do-futuro-e-reconhecida-como-patrimonio-historico-cultural.html");
  const ME_PF_BR = F("Movimento Econômico, 2025: barracas da Praia do Futuro são Patrimônio Cultural do Brasil", "https://movimentoeconomico.com.br/turismo-3/2025/01/09/barracas-da-praia-do-futuro-em-fortaleza-sao-patrimonio-cultural-do-brasil/");
  const OPOVO_10RM = F("O Povo, 2025: Exército celebra 299 anos de Fortaleza no berço da cidade", "https://mais.opovo.com.br/colunistas/vertical/2025/04/08/exercito-celebra-299-anos-de-fortaleza-em-local-que-foi-berco-da-cidade.html");
  const FUTDADOS = F("Futdados: Arena Castelão", "https://futdados.com/arena-castelao-estadio-governador-placido-castelo/");
  const OPOVO_PINTO = F("O Povo, 2024: Pinto Martins, cores e Sampaio Correia", "https://mais.opovo.com.br/colunistas/mailson-furtado/2024/09/18/pinto-martins-cores-e-sampaio-correa.html");
  const UFU_MESSEJANA = F("Cadernos de História (UFU): a Câmara da Vila de Índios de Messejana", "https://seer.ufu.br/index.php/cdhis/article/view/52158");

  window.MARCOS = {
    centro: { arquivo: "centro-catedral-praca-do-ferreira-mercado.glb", nome: "Catedral, Praça do Ferreira e Mercado Central", rotulo: "Catedral · Praça do Ferreira · Mercado", lat: -3.7252, lng: -38.5255, altura: 21 },
    aeroporto: { arquivo: "aeroporto-pinto-martins.glb", nome: "Aeroporto Internacional Pinto Martins", rotulo: "Aeroporto Pinto Martins", lat: -3.7761, lng: -38.5355, altura: 16 },
    castelao: { arquivo: "arena-castelao.glb", nome: "Arena Castelão", lat: -3.8067, lng: -38.5217, altura: 12 },
    cambeba: { arquivo: "centro-administrativo-do-cambeba.glb", nome: "Centro Administrativo do Cambeba", rotulo: "Centro Administrativo", lat: -3.8122, lng: -38.4875, altura: 7 },
    messejana: { arquivo: "lagoa-e-centro-de-messejana.glb", nome: "Lagoa de Messejana e Igreja Matriz", rotulo: "Lagoa e Matriz", lat: -3.8295, lng: -38.4945, altura: 14 },
    northShopping: { arquivo: "north-shopping-fortaleza.glb", nome: "North Shopping Fortaleza", rotulo: "North Shopping", lat: -3.7349, lng: -38.566, altura: 13 },
    riomarFortaleza: { arquivo: "riomar-fortaleza.glb", nome: "Shopping RioMar Fortaleza", rotulo: "RioMar Fortaleza", lat: -3.7411, lng: -38.4726, altura: 22 },
    riomarKennedy: { arquivo: "riomar-kennedy.glb", nome: "RioMar Kennedy", lat: -3.7266, lng: -38.5679, altura: 15 },
    unifor: { arquivo: "unifor.glb", nome: "Universidade de Fortaleza (Unifor)", rotulo: "Unifor", lat: -3.7687, lng: -38.4777, altura: 9 },
    iguatemi: { arquivo: "shopping-iguatemi.glb", nome: "Shopping Iguatemi Bosque", rotulo: "Iguatemi Bosque", lat: -3.7554, lng: -38.4888, altura: 8 },
    praiaIracema: { arquivo: "praia-de-iracema.glb", nome: "Ponte dos Ingleses e Iracema Guardiã", rotulo: "Ponte dos Ingleses", lat: -3.7181, lng: -38.5168, altura: 7 },
    praiaFuturo: { arquivo: "praia-do-futuro.glb", nome: "Praia do Futuro", lat: -3.732, lng: -38.4572, altura: 6 },
    terminalAntonioBezerra: { arquivo: "terminal-antonio-bezerra.glb", nome: "Terminal de Integração Antônio Bezerra", rotulo: "Terminal Antônio Bezerra", lat: -3.7376, lng: -38.5839, altura: 5 },
    forteAssuncao: { arquivo: "fortaleza-nossa-senhora-da-assuncao.glb", nome: "Fortaleza de Nossa Senhora da Assunção (10ª Região Militar)", rotulo: "Fortaleza da Assunção", lat: -3.7227618, lng: -38.525034, altura: 12 },
    dragaoDoMar: { arquivo: "centro-dragao-do-mar.glb", nome: "Centro Dragão do Mar de Arte e Cultura", rotulo: "Dragão do Mar", lat: -3.7216677, lng: -38.5201742, altura: 16 },
    passeioPublico: { arquivo: "passeio-publico.glb", nome: "Passeio Público (Praça dos Mártires)", rotulo: "Passeio Público", lat: -3.7226365, lng: -38.5263038, altura: 11 },
    theatroJoseDeAlencar: { arquivo: "theatro-jose-de-alencar.glb", nome: "Theatro José de Alencar", rotulo: "Theatro José de Alencar", lat: -3.727786, lng: -38.5317064, altura: 18 },
  };

  window.HISTORIAS = {
    // ---------------------------------------------------------------- bairros com marco em miniatura
    10: { capitulos: [
      bairro("Onde a cidade começou", [
        "Fortaleza nasceu aqui, em volta de um forte. Em 1649, o holandês Matias Beck ergueu o Forte Schoonenborch numa colina perto do riacho Pajeú. Em 1654, com a saída dos holandeses, os portugueses o rebatizaram de Fortaleza de Nossa Senhora da Assunção, e a vila cresceu ao redor dele.",
        "O Centro concentrou o governo, as igrejas, o comércio e as diversões da cidade por séculos. Foi também onde Fortaleza começou a subir: o prédio dos Correios (1934), o Edifício Parente (1936) e o Cine Diogo (1940) estão entre os primeiros mais altos.",
      ], [IP(10), ATLAS]),
      marco("centro", "Catedral, Praça do Ferreira e Mercado", [
        "A miniatura junta três símbolos do Centro, mais próximos do que na realidade. A Catedral Metropolitana levou 40 anos para ficar pronta: as obras começaram em 1938 e ela foi inaugurada em 1978, com lugar para cerca de 5 mil pessoas. É chamada de neogótica, embora arquitetos lembrem que é de concreto, não de pedra.",
        "A Praça do Ferreira homenageia o boticário Antônio Rodrigues Ferreira e é o coração do Centro desde o século XIX; a Coluna da Hora atual é de 1991, refeita no lugar da original. O Mercado Central, que remonta a um mercado de 1809, ganhou o prédio de hoje, na Avenida Alberto Nepomuceno, em 1998.",
      ], [OPOVO_CATEDRAL, DN_FERREIRA, OPOVO_MERCADOS]),
      marco("forteAssuncao", "O forte que deu nome à cidade", [
        "No lugar do antigo Forte Schoonenborch fica hoje a Fortaleza de Nossa Senhora da Assunção, sede da 10ª Região Militar, ao lado da Catedral. É o ponto de partida da cidade: foi em volta dela que a vila se formou e, em 13 de abril de 1726, foi elevada à categoria de vila.",
      ], [IP(10), ATLAS, OPOVO_10RM, OSM]),
      marco("passeioPublico", "Passeio Público, a Praça dos Mártires", [
        "É a praça mais antiga de Fortaleza. Em 1825, ali foram fuzilados líderes cearenses da Confederação do Equador, o movimento contra o autoritarismo de D. Pedro I, entre eles o Padre Mororó. Por isso, desde 1879, ela também se chama oficialmente Praça dos Mártires.",
      ], [OPOVO_PASSEIO, OSM]),
      marco("theatroJoseDeAlencar", "Theatro José de Alencar", [
        "Inaugurado em 17 de junho de 1910, tem a estrutura de ferro fundido feita em Glasgow, na Escócia, e trazida peça por peça. É tombado pelo patrimônio federal e ganhou um jardim de Burle Marx em 1974.",
      ], [OPOVO_TJA, OSM]),
      marco("dragaoDoMar", "Centro Dragão do Mar de Arte e Cultura", [
        "Aberto em 1999, já na beira da Praia de Iracema (pela malha oficial, ainda no Centro), reúne museus, planetário, teatro e cinema. O nome homenageia Francisco José do Nascimento, o Chico da Matilde, jangadeiro que liderou a recusa de levar escravizados aos navios no porto de Fortaleza. O Ceará aboliu a escravidão em 1884, quatro anos antes do Brasil.",
      ], [WIKI_DRAGAO, OSM]),
    ] },
    92: { capitulos: [
      bairro("O bairro que nasceu do aeroporto", [
        "A história do bairro se confunde com a do aeroporto que lhe dá nome. Antes, a área era conhecida como Vila União. A pista original, a do Alto da Balança, foi aberta nos anos 1930 e usada pelo Aeroclube do Ceará; na Segunda Guerra Mundial, serviu de apoio às forças aliadas no Atlântico Sul.",
      ], [IP(92), WIKI_AERO]),
      marco("aeroporto", "Aeroporto Internacional Pinto Martins", [
        "Em 1952, o antigo Aeroporto do Cocorote passou a homenagear Euclides Pinto Martins (1892–1924), aviador cearense de Camocim que participou do voo pioneiro de Nova York ao Rio de Janeiro em 1922.",
        "O terminal de passageiros atual foi inaugurado em fevereiro de 1998, do lado oposto da pista; o antigo virou o Terminal de Aviação Geral. Desde 2018, o aeroporto é administrado pela alemã Fraport, e a pista tem 2,7 km (na miniatura, 56 m).",
      ], [WIKI_AERO, OPOVO_PINTO, DN_AERO]),
    ] },
    95: { capitulos: [
      bairro("De Mata Galinha a Castelão", [
        "Antes do estádio, o lugar se chamava Boa Vista e, antes disso, Mata Galinha. Muita gente achou o estádio longe demais do Centro, mas as avenidas abertas para chegar até ele fizeram o entorno crescer rápido, e daí nasceu o bairro.",
        "O nome vem do estádio, que homenageia Plácido Aderaldo Castelo, ex-prefeito de Fortaleza e ex-governador do Ceará. No bairro também ficam o Centro de Formação Olímpica e a sede do Condomínio Espiritual Uirapuru.",
      ], IP(95)),
      marco("castelao", "Arena Castelão", [
        "O Castelão foi inaugurado em 11 de novembro de 1973, com um 0 a 0 entre Ceará e Fortaleza. Para a Copa de 2014, o anel inferior foi demolido e refeito e o estádio ganhou a cobertura branca com o vazio oval que a miniatura mostra; reaberto como Arena Castelão entre dezembro de 2012 e janeiro de 2013, para cerca de 63 mil pessoas.",
        "Em 9 de julho de 1980, o papa João Paulo II falou no estádio, na abertura do Congresso Eucarístico Nacional: a única visita de um papa ao Ceará.",
      ], [DN_CASTELAO, FUTDADOS, VATICANO]),
    ] },
    53: { capitulos: [
      bairro("Cabeça chata", [
        "“Cambeba” quer dizer “cabeça chata”, de acanga (cabeça) e peba (chata). Era também o nome de um peixe e o apelido dado pelos portugueses aos indígenas Omágua, no Amazonas, que achatavam o crânio com tábuas.",
        "O bairro surgiu nos anos 1980 em volta da sede do governo. Ao lado fica a Área de Relevante Interesse Ecológico do Cambeba, uma mata que os moradores usam como uma grande praça.",
      ], IP(53)),
      marco("cambeba", "Centro Administrativo Virgílio Távora", [
        "O governador Virgílio Távora (1979–1982) planejou o conjunto no Sítio São José do Cambeba, com projeto de escritórios de arquitetura cearenses, e a Secretaria de Planejamento foi a primeira a se mudar para lá. Em 1987, a sede do governo foi transferida para o Cambeba; só em 2011 o Palácio da Abolição voltou a ser a sede.",
        "Hoje funcionam ali secretarias estaduais, o Tribunal de Justiça e o Ministério Público do Ceará.",
      ], [OPOVO_CAMBEBA, OPOVO_ABOLICAO, IP(53)]),
    ] },
    65: { capitulos: [
      bairro("Uma vila que virou bairro", [
        "Messejana começou como aldeamento indígena, batizado pelos jesuítas em 1663 de São Sebastião de Paupina. Em 1759, sob o Diretório pombalino, virou a Vila Nova Real de Messejana da América, uma vila de índios com câmara própria, onde lideranças indígenas tinham cargos. Em 1921, deixou de ser município e foi anexada a Fortaleza.",
        "Cresceu como passagem do gado e do algodão rumo à capital. O nome vem de um termo de origem árabe que significa “cárcere”; os moradores chamam o bairro de “Miss Jane”.",
      ], [IP(65), UFU_MESSEJANA]),
      marco("messejana", "A lagoa, Iracema e a Matriz", [
        "A Lagoa de Messejana é o cartão-postal do bairro. Na água fica o “Banho de Iracema”, estátua de 12 metros feita por Alexandre Rodrigues e inaugurada em 2004, nos 175 anos de José de Alencar, que nasceu na antiga vila. A sudeste, a Igreja Matriz de Nossa Senhora da Conceição marca o velho centro de Messejana.",
      ], [DN_IRACEMA_MESS, IP(65)]),
      ponto("Cemitério de Messejana", -3.8361858, -38.490342, "O cemitério mais antigo da cidade", [
        "O cemitério público de Messejana, de 1836, é o mais antigo de Fortaleza: mais velho que o próprio bairro como parte da capital.",
      ], [IP(65), OSM]),
    ] },
    32: { capitulos: [
      bairro("Da Praia do Peixe à Praia de Iracema", [
        "Quando só havia pescadores, este trecho do litoral era a Praia do Peixe. Um concurso popular trocou o nome para Praia de Iracema, a personagem de José de Alencar. O centenário foi comemorado em 2025 (a ficha da Prefeitura data a troca de 1930). Até 1947, foi o porto da cidade.",
        "Nos anos 1940, virou o reduto boêmio de Fortaleza. Várias ruas têm nomes de povos indígenas, como Tabajaras, Potiguaras e Tremembés, e o bairro é hoje um Bem de Relevante Interesse Cultural da cidade.",
      ], [IP(32), OPOVO_PI100]),
      marco("praiaIracema", "Ponte dos Ingleses e Iracema Guardiã", [
        "A Ponte dos Ingleses começou a ser construída em 1921 e nunca foi concluída como porto; virou mirante e passeio. O piso de madeira foi refeito em concreto numa obra iniciada em 2023.",
        "A Iracema Guardiã, de Zenon Barreto, foi pensada nos anos 1960 e instalada em 1996, nos 25 anos do bairro. Ganhou o nome atual em 2002, após a morte do artista.",
      ], [OPOVO_PI100, OPOVO_GUARDIA]),
      ponto("Estoril", -3.7190974, -38.516258, "O Estoril", [
        "O palacete do Estoril foi o símbolo da boemia dos anos 1940, quando abrigava um cassino. É um dos casarões mais antigos que restam no bairro.",
      ], [IP(32), OSM]),
    ] },
    113: { capitulos: [
      bairro("Uma praia sem nome", [
        "O nome vem de uma reportagem do jornal Correio do Ceará, em 1949, que chamou a região de “Praia do Futuro” justamente porque ela ainda não tinha nome: era um lugar quase sem frequentadores. A urbanização só começou nos anos 1960.",
        "A principal praça, hoje Praça da Paz Dom Hélder Câmara, já se chamou Praça 31 de Março, a véspera do golpe de 1964.",
      ], [IP(113), OPOVO_PF]),
      marco("praiaFuturo", "As barracas da Praia do Futuro", [
        "Hoje é a praia mais frequentada da cidade, por moradores e turistas, com barracas que viraram complexos de lazer. Uma lei federal de 2025 reconheceu essas barracas como Patrimônio Cultural Brasileiro, e uma lei municipal de 2026, como patrimônio histórico-cultural de Fortaleza.",
      ], [IP(113), ME_PF_BR, OPOVO_PF_PATR]),
    ] },
    114: { capitulos: [
      bairro("A continuação da Praia do Futuro", [
        "A Praia do Futuro II continua a I rumo ao sul, com um jeito mais despojado e uma faixa de areia mais larga. O vento constante é um patrimônio para quem pratica esportes náuticos.",
        "Um dos trechos mais bonitos fica no fim da praia, junto ao rio Coaçu e ao antigo Clube Caça e Pesca.",
      ], IP(114)),
      marco("praiaFuturo", "As barracas da Praia do Futuro", [
        "O nome “Praia do Futuro” saiu de uma reportagem de 1949 sobre uma praia que ainda não tinha nome. As barracas, que hoje parecem pequenos clubes, são patrimônio cultural do Brasil (2025) e de Fortaleza (2026).",
      ], [IP(113), ME_PF_BR, OPOVO_PF_PATR], { lat: -3.7622, lng: -38.4449 }),
    ] },
    27: { capitulos: [
      bairro("Lagoa comprida", [
        "“Papicu” vem do tupi e quer dizer “lagoa comprida”: foi o nome que os antigos moradores deram à lagoa de água doce que viam do alto das dunas. Até os anos 1960, a região era uma sequência de dunas cortada pelo rio Cocó e pelas lagoas do Papicu e do Gengibre.",
        "Em 1970, o conjunto Cidade 2000 foi construído sobre as dunas e aterrou várias dessas lagoas.",
      ], IP(27)),
      ponto("Hospital Geral de Fortaleza", -3.7399167, -38.4763336, "Hospital Geral de Fortaleza", [
        "Construído em 1969, o HGF foi o primeiro grande equipamento do bairro. Depois dele vieram a Cervejaria Astra e as obras de luz e infraestrutura que abriram o Papicu para a cidade.",
      ], [IP(27), OSM]),
      marco("riomarFortaleza", "Shopping RioMar Fortaleza", [
        "Inaugurado em outubro de 2014, entre a Praia do Futuro e o Meireles. A miniatura mostra a fachada principal, com o logo das três ondas, e o estacionamento com palmeiras.",
      ], DN_SHOPPINGS),
      ponto("Lagoa do Papicu", -3.7416025, -38.467975, "Lagoa do Papicu", [
        "É a lagoa que deu nome ao bairro: “lagoa comprida”, em tupi. É uma das lagoas interdunares que sobraram da paisagem de dunas de antes dos anos 1970.",
      ], [IP(27), OSM]),
    ] },
    33: { capitulos: [
      bairro("De Monte Picuí a Presidente Kennedy", [
        "O bairro surgiu nos anos 1950, com famílias vindas do Interior. Era conhecido como Monte Picuí e ganhou o nome do presidente americano John Kennedy.",
        "É um bairro comercial, de fácil acesso ao Centro. Do lado ambiental, o destaque é o Parque Rachel de Queiroz, uma área degradada que foi recuperada e hoje é a segunda maior área verde de Fortaleza.",
      ], IP(33)),
      marco("northShopping", "North Shopping Fortaleza", [
        "Inaugurado em outubro de 1991 na Avenida Bezerra de Menezes, o corredor que liga o Centro a Caucaia. A caixa quase cega da miniatura esconde um estacionamento de seis níveis; as faixas escuras da fachada são as lajes abertas.",
      ], DN_SHOPPINGS),
      marco("riomarKennedy", "RioMar Kennedy", [
        "O segundo RioMar da cidade abriu em 26 de outubro de 2016, no bairro. Com ele, o Presidente Kennedy passou a ter dois grandes shoppings a menos de um quilômetro um do outro.",
      ], [DN_RMK, IP(33)]),
    ] },
    57: { capitulos: [
      bairro("De Água Fria a Edson Queiroz", [
        "O primeiro nome do bairro foi Água Fria, por causa de uma fazenda. Também foi conhecido como Toca do Coelho, por um restaurante que servia o prato. O nome atual homenageia o empresário Edson Queiroz, fundador da Unifor, que morreu num acidente aéreo em 1982.",
        "A Avenida Washington Soares corta o bairro inteiro e reúne o Fórum Clóvis Beviláqua, a sede da OAB-CE, o Iguatemi Bosque e o Centro de Eventos do Ceará.",
      ], [IP(57), UNIFOR]),
      marco("iguatemi", "Shopping Iguatemi Bosque", [
        "Aberto em 1982, foi um dos primeiros shoppings do Ceará, num terreno que até então era conhecido como “deserto de sal” das antigas salinas da foz do Cocó. Em 2022, nos 40 anos, passou a se chamar Iguatemi Bosque. A mata do Parque do Cocó encosta no prédio ao norte e a leste.",
      ], [IGUATEMI40, IP(11)]),
      marco("unifor", "Universidade de Fortaleza", [
        "A Unifor foi inaugurada em 21 de março de 1973, com aula inaugural de Edson Queiroz, mantida pela fundação que leva o nome dele. O bairro cresceu em volta do campus, entre moradias populares, condomínios e áreas de preservação.",
      ], UNIFOR),
      ponto("Centro de Eventos", -3.764532, -38.4804211, "Centro de Eventos do Ceará", [
        "Na mesma avenida, o Centro de Eventos do Ceará recebe as grandes feiras e congressos da cidade.",
      ], [IP(57), OSM]),
    ] },
    40: { capitulos: [
      bairro("Do Bairro Vermelho a Antônio Bezerra", [
        "O bairro se chamava Bairro Vermelho, pela cor da terra da estrada para Caucaia. Em 1965, já na ditadura, o nome foi trocado porque os militares associavam “vermelho” ao comunismo.",
        "O novo nome homenageia Antônio Bezerra, poeta, naturalista e historiador de Quixeramobim que atuou no movimento abolicionista do Ceará. Das chácaras e sítios de antes, sobrou a Chácara Salubre, de 1802, hoje do outro lado da divisa, no Padre Andrade.",
      ], IP(40)),
      marco("terminalAntonioBezerra", "Terminal de Integração Antônio Bezerra", [
        "O terminal fica bem na divisa e, pela malha oficial, está no Padre Andrade, mas leva o nome do bairro vizinho. A miniatura mostra o “pente” de três coberturas longas sobre as baias dos ônibus.",
      ], [IP(47), IP(40)], { lat: -3.737, lng: -38.5855 }),
    ] },
    47: { capitulos: [
      bairro("Um padre querido", [
        "A área se chamava Parque Santo Antônio da Floresta e, até 1951, ficou conhecida como Cachoeirinha. A própria população pediu à Câmara que o bairro recebesse o nome do padre Francisco Juvêncio Andrade Filho, muito querido na região, que morreu afogado aos 28 anos.",
      ], IP(47)),
      marco("terminalAntonioBezerra", "Terminal de Integração Antônio Bezerra", [
        "O terminal mais conhecido do lado oeste da cidade fica aqui, na Avenida Mister Hull, mas leva o nome do bairro vizinho, o Antônio Bezerra.",
      ], IP(47)),
      ponto("Chácara Salubre", -3.7377674, -38.5817248, "Chácara Salubre", [
        "Construída em 1802, é a última das grandes chácaras da antiga estrada para Caucaia e ainda guarda árvores enormes. A Prefeitura a cita na ficha do Antônio Bezerra, mas pela malha oficial ela fica no Padre Andrade.",
      ], [IP(40), OSM]),
    ] },

    // ---------------------------------------------------------------- os demais bairros (ficha do Fortaleza em Bairros)
    1: so(1, "Do Alagadiço Grande a São Gerardo", [
      "O bairro se chamava Alagadiço Grande. Em 1930, ganhou o nome do santo da igreja local, São Geraldo Magela, que os moradores preferiram chamar de São Gerardo.",
      "Hoje é valorizado e comercial, sobretudo ao longo da Avenida Bezerra de Menezes, o corredor que liga o Centro a Caucaia.",
    ]),
    2: so(2, "A pequena aldeia", [
      "“Aldeota” é diminutivo de “aldeia”: lembra um aldeamento de indígenas que saíram das margens do rio Ceará para perto da nascente do riacho Pajeú.",
      "Até os anos 1980 era só residencial, e por muito tempo morar na Aldeota foi o sonho de muita gente na cidade, a ponto de inspirar músicas e poesias. Hoje é também um grande centro de comércio e lazer.",
    ]),
    3: so(3, "O prefeito das flores", [
      "Os primeiros colonizadores encontraram ali uma floresta às margens do rio Ceará, e por isso o primeiro nome foi Floresta.",
      "O nome atual homenageia Álvaro Weyne, comerciante e ex-prefeito lembrado como o “prefeito das flores”, que transformava as praças em jardins. Foi ele quem comprou a Casa de José de Alencar quando dirigia a Santa Casa.",
    ]),
    4: so(4, "O médico dos pobres", [
      "O nome homenageia Amadeu Furtado, médico nascido em Ipu em 1888, que dedicou a vida a atender principalmente os pacientes mais pobres.",
      "É no Amadeu Furtado, e não na Parquelândia, que fica a igreja redonda conhecida como Igreja da Parquelândia. O bairro também tem a biblioteca comunitária Chico Parafuso.",
    ]),
    5: so(5, "Do curral da seca à Leste-Oeste", [
      "Na seca de 1932, milhares de sertanejos chegaram a Fortaleza e foram presos em “campos de concentração”, os Currais, vigiados por soldados. O primeiro deles foi o Arraial Moura Brasil.",
      "A área só virou o bairro Moura Brasil com a urbanização e a abertura da Avenida Leste-Oeste, em 1975. A igreja de Santa Terezinha, erguida em 1926 por pescadores e moradores, é patrimônio municipal.",
    ]),
    6: { capitulos: [
      bairro("O bairro mais antigo de Fortaleza", [
        "Foi na Barra do Ceará, na foz do rio, que Pero Coelho fundou o Forte de São Tiago, em 1604, e onde funcionou a primeira Câmara Municipal. Por isso o bairro é considerado o mais antigo da cidade. Há quem diga que o espanhol Vicente Pinzón desembarcou por aqui antes de Cabral chegar à Bahia.",
        "Nos anos 1930, o bairro teve um porto de hidroaviões. Um dos passageiros que desceram ali foi Antoine de Saint-Exupéry, autor de “O Pequeno Príncipe”.",
      ], IP(6)),
      ponto("Marco Zero", -3.694469, -38.5860534, "O Marco Zero da cidade", [
        "Onde ficava o forte está a Praça de Santiago, com o Marco Zero de Fortaleza: um cruzeiro com imagens de São Tiago, do Cristo Crucificado, de Nossa Senhora da Assunção e de São José, presente do governo da Espanha em lembrança de Pinzón.",
      ], [IP(6), OSM]),
    ] },
    7: { capitulos: [
      bairro("Um lugar para bem ficar", [
        "Segundo o historiador João Nogueira, a elite de Fortaleza queria um lugar para “bem ficar”, e daí veio o nome Benfica. As chácaras cresceram em torno da igreja de Nossa Senhora dos Remédios, onde ficava o ponto final da linha de bondes.",
        "A época de ouro veio com o palacete da família Gentil, de 1918, que deu nome à Gentilândia. Hoje é o bairro universitário e boêmio da cidade, com a feira e o Carnaval da Praça da Gentilândia.",
      ], IP(7)),
      ponto("Reitoria da UFC", -3.7414294, -38.5393982, "A Reitoria da UFC", [
        "O antigo palacete da família Gentil abriga hoje a Reitoria da Universidade Federal do Ceará, que tem no Benfica um dos seus campi.",
      ], [IP(7), OSM]),
      ponto("Estádio Presidente Vargas", -3.7459909, -38.5368948, "Estádio Presidente Vargas", [
        "O PV foi o primeiro grande estádio de futebol do Ceará, décadas antes do Castelão.",
      ], [IP(7), OSM]),
    ] },
    8: so(8, "Um sítio e uma igreja holandesa", [
      "Segundo menor bairro de Fortaleza, tem limites que se confundem com os do Montese. O nome vem do sítio da família de Sindulfo Serafim e Dulcinéia Gondim Chaves, que em 1939 doou o terreno para a Igreja de Nossa Senhora de Nazaré.",
      "A planta da igreja copia uma igreja da Holanda a partir de um cartão-postal enviado aos padres.",
    ]),
    9: so(9, "O primeiro bairro operário", [
      "O nome homenageia Carlito Pamplona (1898–1947), diretor da fábrica de óleo Brasil Oiticica, na Avenida Francisco Sá. A fábrica, a ferrovia e a zona fabril fizeram dele o primeiro bairro operário da cidade.",
      "Carlito Pamplona incentivou o plantio e a compra de castanha de caju no litoral e fechou os primeiros negócios do Ceará nesse mercado.",
    ]),
    11: { capitulos: [
      bairro("Do deserto de sal ao parque", [
        "Nos anos 1960, onde hoje é o bairro funcionava o Sítio Diogo, com salinas na foz do rio Cocó. Até o início dos anos 1980, a área onde ficam o Iguatemi Bosque e o Parque do Cocó era chamada de “deserto de sal”.",
        "Hoje o bairro é residencial e comercial, colado à maior área verde da cidade.",
      ], IP(11)),
      ponto("Parque do Cocó", -3.752, -38.484, "Parque Estadual do Cocó", [
        "Criado depois de uma longa luta de ambientalistas, o parque tem cerca de 1.575 hectares. O desenho em meia-lua funciona como um corredor de ventilação: os ventos do mar entram na cidade pelo Cocó e dali se espalham.",
      ], [IP(11), OSM]),
    ] },
    12: so(12, "O padre do Pirambu", [
      "O fundador do bairro é considerado o padre Caetano Minette de Tillesse, que nos anos 1960 decidiu morar no Grande Pirambu, então uma das favelas mais pobres da América Latina.",
      "Ele ajudou a criar 100 crianças, 46 delas registradas com o seu sobrenome. O bairro continua conhecido pelos projetos sociais.",
    ]),
    13: { capitulos: [
      bairro("As damas e a lagoa", [
        "O nome lembra as damas da aristocracia que, entre os anos 1930 e 1950, se refugiavam do agito do Centro nas chácaras daqui. Outra versão fala de uma lagoa onde quatro damas tomavam banho todo dia: a Lagoa das Damas.",
        "O bairro nasceu do caminho entre o Centro e a antiga sede de Parangaba, que hoje é a Avenida João Pessoa.",
      ], IP(13)),
      ponto("Casa do Português", -3.7561294, -38.5532844, "Casa do Português", [
        "Na Avenida João Pessoa, a Casa do Português é uma das referências de memória do bairro, ao lado do prédio do Imparh, da Prefeitura.",
      ], [IP(13), OSM]),
    ] },
    14: so(14, "Três mil coqueiros", [
      "Em 1920, o farmacêutico Dionísio Torres comprou 75 hectares de terra árida e plantou três mil coqueiros em fileiras, o primeiro coqueiral planejado do Ceará. Ali criou a granja leiteira Estância Castelo, com gado holandês trazido do Uruguai; o loteamento veio em 1939.",
      "Por ser alto, o terreno foi escolhido para a TV Ceará no fim dos anos 1950, e até hoje a maioria das emissoras fica no bairro.",
    ]),
    15: so(15, "Farias Brito ou Otávio Bonfim", [
      "Em 1922, a Rede de Viação Cearense abriu aqui a Estação do Matadouro, perto de um abatedouro de gado, depois rebatizada de Otávio Bonfim, em homenagem a um engenheiro da ferrovia.",
      "O nome oficial homenageia o filósofo cearense Raimundo de Farias Brito, mas muitos moradores ainda chamam o bairro de Otávio Bonfim.",
    ]),
    16: { capitulos: [
      bairro("De Redenção a Fátima", [
        "O bairro foi fundado em 1956 com o nome de Redenção. A avenida principal se chama Treze de Maio, a data da abolição da escravatura.",
        "Em 1952, a imagem peregrina de Nossa Senhora de Fátima chegou à cidade com uma recepção nunca vista. Comovido, Pergentino Ferreira doou o terreno da igreja e de um colégio, e o bairro passou a se chamar Fátima.",
      ], IP(16)),
      ponto("Igreja de Fátima", -3.7524955, -38.5266562, "A igreja de Fátima", [
        "O bairro cresceu em volta desta igreja, na Avenida Treze de Maio, que continua sendo o seu símbolo.",
      ], [IP(16), OSM]),
    ] },
    17: so(17, "Floresta", [
      "O bairro nasceu de ocupações e hoje tem limites reconhecidos oficialmente. O nome lembra a mata que havia antes das casas, e que ainda aparece nas várias praças.",
    ]),
    18: so(18, "Cabeça de jacaré", [
      "Jacarecanga quer dizer “cabeça de jacaré” em tupi. O riacho, que os holandeses registraram em 1649 como Timbó, passou a ter esse nome. As terras férteis atraíram chácaras, mansões e a linha de bonde.",
      "Com a seca de 1915, a ferrovia e as fábricas, o bairro se adensou: os mais pobres ficaram por aqui e a elite foi para a Aldeota.",
    ]),
    19: so(19, "Uma homenagem aos Estados Unidos", [
      "O Jardim América foi planejado: as praças e os equipamentos públicos vieram antes das casas. A primeira foi a Praça Presidente Roosevelt, e o nome do bairro homenageia os EUA.",
      "Antes, chamava-se Laguna, pelas cheias constantes, até que canais drenaram as lagoas nos anos 1950.",
    ]),
    20: so(20, "Um nome carioca", [
      "Conhecida antes como Parque Vila Velha, a localidade trocou de nome por proposta dos próprios moradores: Jardim Guanabara, como o bairro do Rio de Janeiro.",
    ]),
    21: so(21, "Paulistinha, Santo Amaro, Jardim Iracema", [
      "A localidade se chamou Paulistinha e depois Sítio Santo Amaro. Por influência do professor e indigenista Osvaldo Risato, passou a homenagear Iracema, a personagem de José de Alencar.",
      "Era uma área de riachos e hortas que abasteciam o Mercado São Sebastião.",
    ]),
    22: { capitulos: [
      bairro("O primeiro bonde", [
        "Em 1880, passou por aqui a primeira linha de bonde da Companhia Ferro Carril do Ceará, de 4 km, entre a estrada de Messejana e o Centro. A estação ficava onde hoje está o mercado do bairro.",
        "O nome, dos anos 1930, homenageia Joaquim Távora, engenheiro e militar de uma família tradicional da política cearense, que participou das revoltas tenentistas dos anos 1920.",
      ], IP(22)),
      ponto("Parque Rio Branco", -3.7517271, -38.5189216, "Parque Rio Branco", [
        "Com 7 hectares de verde, o Parque Rio Branco é símbolo das lutas ambientais na capital.",
      ], [IP(22), OSM]),
    ] },
    23: so(23, "O patriarca da Independência", [
      "O nome homenageia José Bonifácio, que teria aconselhado D. Pedro I a ficar no Brasil e a romper com Portugal em 1822.",
      "A praça do bairro se chamava Praça dos Coelhos, pelos muitos coelhos (ou por uma família antiga). Ganhou o nome de José Bonifácio em 1931, com a construção do quartel da polícia.",
    ]),
    24: { capitulos: [
      bairro("Das jangadas à Beira-Mar", [
        "O Meireles era terra de jangadeiros; a partir dos anos 1960, vieram as casas de veraneio. O nome já aparece na carta da Capitania do Ceará de 1818, mas ninguém sabe ao certo de onde vem: Meireles é um sobrenome português.",
        "A Avenida Beira-Mar empurrou os pescadores para perto do farol do Mucuripe. O Campo do América resistiu à especulação imobiliária e segue sendo o lazer dos moradores mais pobres.",
      ], IP(24)),
      ponto("Palácio da Abolição", -3.7281783, -38.5038238, "Palácio da Abolição", [
        "A sede do governo do Ceará foi projetada por Sérgio Bernardes e inaugurada em 1970. O governo se mudou para o Cambeba em 1987 e voltou para cá em 2011.",
      ], [OPOVO_ABOLICAO, OSM]),
    ] },
    25: so(25, "As tertúlias da lâmpada vermelha", [
      "O nome lembra a batalha de Monte Castello, na Itália, onde lutaram soldados brasileiros. Antes, o bairro se chamava João Lopes, como o açude que o abastecia.",
      "O Monte Castelo era famoso pelas tertúlias, festas em casa: uma lâmpada vermelha acesa na porta avisava que a festa já tinha começado.",
    ]),
    26: { capitulos: [
      bairro("Fazer alguém alegre", [
        "Em tupi, Mucuripe quer dizer “fazer alguém alegre”. A ponta do Mucuripe já aparece nos mapas do Ceará de 1629, e há quem diga que Vicente Pinzón desembarcou por aqui antes de Cabral.",
        "O bairro ainda vive da pesca: a igrejinha tem São Pedro como padroeiro. Nos anos 1940, foi escolhido para o porto da cidade. O cemitério de São Vicente de Paula, de 1912, é o menor de Fortaleza.",
      ], IP(26)),
      ponto("Iracema e Martim", -3.7230553, -38.4843485, "Iracema, Martim, Moacir e Japi", [
        "No calçadão, o monumento homenageia Iracema, “a virgem dos lábios de mel”, com Martim Soares Moreno, o filho Moacir e o cão Japi, personagens de José de Alencar.",
      ], [IP(26), OSM]),
    ] },
    28: so(28, "A água que curava", [
      "Nos anos 1950, um poço de água tão limpa que diziam curar quem a bebesse fez uma imobiliária batizar o loteamento de Araxá, como a cidade mineira das águas termais.",
      "Em tupi, “araxá” quer dizer “terreno elevado”.",
    ]),
    29: so(29, "Terra de parques", [
      "O nome nasceu de um loteamento dos anos 1950: “Parquelândia”, a terra dos parques, num jogo com o “land” do inglês que lembrava a Disneylândia. Antes, pelos coqueiros, o lugar se chamava Coqueirinho.",
      "Curiosidade: a igreja redonda conhecida como Igreja da Parquelândia fica, na verdade, no Amadeu Furtado.",
    ]),
    30: so(30, "O leite no lombo do burro", [
      "Nos anos 1940, a família Parreão tinha uma vacaria aqui e levava o leite para a vizinhança no lombo de burros. O riacho Parreão dava água ao gado.",
      "Onde ficava a vacaria está hoje o Parque Linear do Parreão, criado em 2014.",
    ]),
    31: so(31, "A Grande Marcha do Pirambu", [
      "“Pirambu” quer dizer “peixe roncador” em tupi. O bairro cresceu com os retirantes da seca de 1932.",
      "Quando duas famílias reivindicaram a terra onde já moravam mais de cinco mil pessoas, os moradores se organizaram com o padre Hélio Campos na Grande Marcha do Pirambu: cerca de 20 mil pessoas caminharam até o Centro, e a terra passou à União e à Igreja.",
    ]),
    34: { capitulos: [
      bairro("O homem que vacinou a cidade", [
        "Nos anos 1960, o Porangabuçu passou a homenagear Rodolfo Teófilo, sanitarista e escritor que, sem apoio do governo, fabricou a vacina contra a varíola e vacinou a população de graça, de casa em casa, entre 1901 e 1904.",
        "O maior patrimônio natural do bairro é a Lagoa do Porangabuçu.",
      ], IP(34)),
      ponto("Hospital Universitário", -3.7492902, -38.551573, "O polo de saúde", [
        "O bairro é sinônimo de saúde: reúne o Hospital Universitário Walter Cantídio, o Hemoce, a Maternidade Escola Assis Chateaubriand e o Instituto do Câncer do Ceará.",
      ], [IP(34), OSM]),
    ] },
    35: so(35, "Lugar de barro amarelo", [
      "Tauape quer dizer “lugar de barro amarelo” (tauá + pe). Por volta de 1910, os comboios do Interior paravam para descansar e vender mercadorias onde hoje se cruzam as avenidas Visconde do Rio Branco e Pontes Vieira.",
      "O riacho Tauape é o atual Canal do Lagamar. As quermesses de São João Batista e de Nossa Senhora da Piedade mantêm o bairro festeiro.",
    ]),
    36: so(36, "Cinco casas de palha", [
      "“Varjota” é o diminutivo de várzea. A história começa em 1912, com cinco casas de palha de pescadores e estivadores. As mulheres vendiam a comida que preparavam, e daí nasceu a tradição.",
      "Os primeiros restaurantes, como o Agulha Frita e o Garoto da Varjota, fizeram do bairro um polo gastronômico.",
    ]),
    37: { capitulos: [
      bairro("Antes de Cabral", [
        "O nome homenageia o espanhol Vicente Yáñez Pinzón, da frota de Colombo, que teria ancorado na Ponta do Mucuripe em 26 de janeiro de 1500, antes de Cabral, e batizado o lugar de Santa María de la Consolación.",
        "O bairro sempre foi de pescadores, com comunidades como Santa Terezinha, São Pedro, Serviluz e Castelo Encantado.",
      ], IP(37)),
      ponto("Morro de Santa Terezinha", -3.7250856, -38.4758994, "O mirante de Santa Terezinha", [
        "Aqui fica o ponto mais alto de Fortaleza, com o Mirante de Santa Terezinha e uma das vistas mais bonitas da cidade.",
      ], [IP(37), OSM]),
    ] },
    38: so(38, "A Vila Ellery", [
      "Os primeiros moradores contam que havia uma pequena lagoa, aterrada aos poucos para abrir casas e ruas. Ali nasceu a Vila Ellery, com o nome de uma família de referência no lugar, que o bairro herdou.",
    ]),
    39: so(39, "A vila que envelheceu", [
      "O coronel Antônio Joaquim de Carvalho construiu uma vila para os seus funcionários. Ele morreu, a vila ficou, envelheceu e virou a Vila Velha.",
      "O bairro se debruça sobre o rio Ceará e hoje tem quatro etapas, com a Feira do Conjunto Polar e várias praças.",
    ]),
    41: so(41, "Alto do Bode, Caocá, Autran Nunes", [
      "Já foi Alto do Bode e Caocá. O nome atual homenageia Autran Nunes, juiz do Trabalho e professor do Liceu do Ceará, lembrado pelas ações sociais em favor dos moradores.",
      "Fica mais perto de Caucaia que do Centro, rodeado pelo rio Maranguapinho, com calçadão à beira do rio.",
    ]),
    42: so(42, "Um conjunto de vanguarda", [
      "O Conjunto Ceará foi construído em 1977, no governo de Adauto Bezerra, com 996 casas padronizadas, em terras da antiga Estiva. Foi desenhado em 12 unidades de vizinhança, cada uma com 100 casas e uma escola.",
      "Em 1980, os moradores pediram a separação do Granja Portugal. As 12 unidades foram depois reunidas em dois bairros: Conjunto Ceará I e II.",
    ]),
    43: so(43, "O bispo dos vitrais", [
      "O bairro cresceu nas terras da família Pompeu, loteadas nos anos 1960. O nome homenageia Dom Antônio de Almeida Lustosa, arcebispo de Fortaleza a partir de 1941.",
      "Dom Lustosa foi o autor dos vitrais da Catedral e deixou 30 paróquias, 45 escolas e 14 postos de saúde na periferia da cidade.",
    ]),
    44: so(44, "Genibaú", [
      "O bairro se formou nos anos 1980 às margens do rio Maranguapinho. Depois de anos de luta, os moradores conquistaram o reconhecimento do bairro e as primeiras escolas e postos de saúde.",
      "É um dos bairros mais adensados de Fortaleza.",
    ]),
    45: so(45, "A primeira casa popular", [
      "Em 1920, o pai da escritora Rachel de Queiroz comprou o Sítio Pici para veraneio. Em 1952, a Prefeitura doou terreno para o primeiro conjunto habitacional da cidade, a Casa Popular, com 456 casas, que deu o primeiro nome ao bairro.",
      "Em 1960, o bairro passou a homenagear o maestro Henrique Jorge, fundador do Conservatório Alberto Nepomuceno.",
    ]),
    46: so(46, "O primeiro São João", [
      "Chamava-se Santa Sé, e os moradores não gostavam das brincadeiras com os “índios da Santa Sé”. Em 1963, quando morreu o papa João XXIII, pediram o nome dele.",
      "Um show de Luiz Gonzaga na praça, em 1977, deu origem às festas que o bairro chama de primeiro São João de Fortaleza.",
    ]),
    48: so(48, "O advogado irreverente", [
      "O nome homenageia Quintino Cunha, advogado, poeta e escritor nascido em Itapajé, famoso pelas tiradas nas audiências, símbolo do humor cearense.",
      "É um bairro grande, separado de Caucaia pelo rio Maranguapinho.",
    ]),
    49: { capitulos: [
      bairro("Onde nasceu José de Alencar", [
        "O bairro se chamava Alagadiço Novo, como o sítio do antigo município de Messejana onde nasceu José de Alencar, autor de “O Guarani”, “Iracema” e “Senhora”.",
      ], IP(49)),
      ponto("Casa de José de Alencar", -3.8124, -38.4774, "Casa de José de Alencar", [
        "A casa onde o escritor nasceu pertence hoje à Universidade Federal do Ceará e é aberta à visitação.",
      ], [IP(49), OSM]),
    ] },
    50: so(50, "Uma palmeira da caatinga", [
      "O nome vem de “aricori”, uma palmeira da caatinga. Para Thomaz Pompeu Sobrinho, pode vir de anga (alma) e cori (apressado), uma referência a superstições locais.",
      "O frei Wilson Fernandes criou a Escola de Música do Ancuri, o “Castelo de Música”, para ensinar instrumentos aos jovens do bairro.",
    ]),
    51: so(51, "Barro para as casas", [
      "O nome vem do barro abundante, usado para construir as casas. Latifúndios e terrenos sem uso foram ocupados pela população aos poucos.",
      "A Escola Otávio de Farias, construída em terreno doado pela família Farias, é uma das referências do bairro.",
    ]),
    52: so(52, "Cajazeiras", [
      "Desde os anos 1940, o lugar se chamava Cajazeiras, pela quantidade dessas árvores frutíferas.",
      "As referências são o Parque Urbano da Lagoa da Maria Vieira, a igreja de São Diogo e a sede da Polícia Rodoviária Federal.",
    ]),
    54: { capitulos: [
      bairro("Lotes para servidores", [
        "Há mais de 50 anos, o Governo do Estado comprou a área para lotear e vender aos servidores públicos, daí o nome. É um bairro de casas, procurado por famílias com crianças.",
      ], IP(54)),
      ponto("Lago Jacarey", -3.8005912, -38.4908002, "Lago Jacarey", [
        "O cartão-postal do bairro, com restaurantes, feirinhas e lazer para todas as idades.",
      ], [IP(54), OSM]),
    ] },
    55: so(55, "Folha larga", [
      "Coaçu quer dizer “folha grande”, de caá (mato) e açu (grande): é o nome de uma planta, o cauaçu ou pau-de-vassoura.",
      "Na divisa com o Eusébio e na saída da CE-010, o bairro tem o Centro das Tapioqueiras.",
    ]),
    56: so(56, "Amigo do homem", [
      "Em tupi, “curió” significa “amigo do homem”, o nome de um passarinho que gostava de viver perto das aldeias.",
      "A Floresta do Curió, Área de Relevante Interesse Ecológico, guarda exemplares da Mata Atlântica, e o bairro tem até empresas de água mineral.",
    ]),
    58: so(58, "O engenheiro que recusou a Nasa", [
      "A área era o Salineiro do Cocó, de pequenos sítios. O engenheiro Luciano Cavalcante instalou ali uma fábrica de canos de PVC e trouxe a primeira obra de infraestrutura.",
      "Formado em aeronáutica nos Estados Unidos, onde foi premiado como melhor aluno, recusou trabalhar na Nasa para voltar a Fortaleza.",
    ]),
    59: so(59, "Boca pintada", [
      "Guajeru é um arbusto rasteiro das areias cujo fruto tinge os lábios: o nome vem de gua (pintado) e juru (boca).",
      "A praça do bairro faz parte do projeto Praça Amiga da Criança.",
    ]),
    60: so(60, "Estrondo de tambores", [
      "A região era parte da mata do Cocó. Depois de separada, ganhou o nome Guararapes, que em tupi significa “estrondo de tambores”.",
    ]),
    61: so(61, "Onça grande", [
      "Jangurussu quer dizer “onça grande”, de ya’wara (onça) e uçu (grande). O bairro surgiu no início dos anos 1990 com programas federais de habitação e é conhecido pelos conjuntos e mutirões.",
      "Tem a Biblioteca Comunitária da Filó e o Cuca Jangurussu, voltados aos jovens.",
    ]),
    62: so(62, "Santa Luzia do Cocó", [
      "A ocupação começou por volta de 1910, quando o lugar se chamava Santa Luzia do Cocó, por causa da igreja de Santa Luzia, de 1915.",
      "Nos anos 1950, um dos loteamentos se chamou Jardim das Oliveiras, como o jardim de Jerusalém onde Jesus rezou antes da crucificação. O nome agradou aos moradores e ficou.",
    ]),
    63: so(63, "Lagoa Redonda", [
      "No meio do bairro havia uma lagoa redonda, chamada de poço, usada para pescar, dar água aos animais, lavar roupa e fazer tijolos.",
      "É cercado pelas lagoas da Precabura, de Miritipá e Redonda, além de mangue e Mata Atlântica.",
    ]),
    64: so(64, "Olhos vermelhos", [
      "Sapiranga quer dizer “olhos vermelhos”, e o bairro corresponde ao antigo Coité. Nos anos 1990, condomínios fechados de médio e alto padrão chegaram ao lado de casas simples.",
      "A expansão destruiu parte dos manguezais e fez nascer a Reserva Ecológica Particular da Sapiranga.",
    ]),
    66: so(66, "Mais uma Iracema", [
      "Mais um bairro que homenageia José de Alencar, com o nome da índia Iracema, do seu romance mais conhecido.",
      "Ali fica o Parque Del Sol, área de condomínios verticais com bastante verde.",
    ]),
    67: so(67, "Verde no sudeste", [
      "Vizinho do Luciano Cavalcante, da Cidade dos Funcionários e do Cambeba, o Parque Manibura ainda tem ruas abertas e muito verde.",
      "É sede da Associação Caatinga, que trabalha pela conservação desse bioma.",
    ]),
    68: so(68, "Lagoa limpa ou Padre Pinto", [
      "A origem do nome é incerta: pode ser indígena, “lagoa limpa” ou “lagoa descoberta”, ou uma corruptela de “Padre Pinto”, o religioso que catequizou o aldeamento.",
      "A Paupina é o nome do antigo aldeamento jesuíta de onde nasceu Messejana.",
    ]),
    69: so(69, "As pedreiras", [
      "Pedras passou a fazer parte de Fortaleza em 2017, por um acordo entre as prefeituras de Fortaleza e Itaitinga. O nome lembra as antigas pedreiras da região.",
    ]),
    70: so(70, "Comida de sabiá", [
      "Sabiaguaba vem do tupi e quer dizer “comida de sabiá”. O bairro era isolado até a construção da ponte e da via da Sabiaguaba.",
      "Tem mangue, praia, rios, lagoas entre dunas e duas áreas protegidas: a APA e o Parque Natural das Dunas da Sabiaguaba, cujas dunas guardam a água da chuva e recarregam o aquífero.",
    ]),
    71: so(71, "As salinas do Cocó", [
      "Nos anos 1960, o Sítio Antônio Diogo, perto da foz do Cocó, explorava sal nas Salinas Diogo. Depois que a salina fechou, a área foi ocupada e virou o bairro.",
      "O manguezal do Parque do Cocó toma boa parte do território.",
    ]),
    72: so(72, "Bom Jardim", [
      "A área era uma grande fazenda, loteada pela família Gentil com o nome de Bom Jardim. Outra versão fala de uma casa de diversões cujas moças eram chamadas de rosas e flores.",
      "A Rua Oscar Araripe foi a primeira via aberta e segue sendo o corredor do bairro.",
    ]),
    73: so(73, "Pici das Pedreiras", [
      "O lugar se chamava Pici das Pedreiras, por causa de um morador que tirava pedra para fazer brita. Nos anos 1950, a família Gentil comprou e loteou a área com o nome de Bonsucesso.",
      "O cantor e compositor Messias Holanda (1942–2018) morou no bairro por muitos anos.",
    ]),
    74: so(74, "O pequeno Canindé", [
      "Em 1918, à beira da estrada entre o Siqueira e Parangaba, foi erguida a capela de São Francisco de Assis, o centro do bairro.",
      "Como o padroeiro era o mesmo de Canindé e o lugar era pequeno, ficou Canindezinho. Canindé é uma arara azul e amarela e também um povo indígena cearense, os Kanindé.",
    ]),
    75: so(75, "Um conjunto de vanguarda", [
      "O Conjunto Ceará foi construído em 1977, com 996 casas padronizadas em 12 unidades de vizinhança, cada uma com 100 casas e uma escola.",
      "Depois que os moradores conseguiram separar o conjunto do Granja Portugal, as unidades foram divididas em dois bairros: Conjunto Ceará I e II.",
    ]),
    76: so(76, "Conjunto Esperança", [
      "Pequeno em área, o Conjunto Esperança fica na Regional 10, cercado pelo Canindezinho, Novo Mondubim, Mondubim, Aracapé e Parque Santa Rosa.",
    ]),
    77: so(77, "Do Dendê a Rachel de Queiroz", [
      "Até março de 2023, o bairro se chamava Dendê. O nome mudou para homenagear a escritora cearense Rachel de Queiroz (1910–2003).",
      "Ainda tem bastante verde, e parte do campus da Uece avança sobre ele.",
    ]),
    78: { capitulos: [
      bairro("A terra dos Cariocas", [
        "Em 1963, a viúva Maria Alves Carioca e os filhos lotearam parte da fazenda da família, vendendo terrenos financiados a quem chegava à cidade. O loteamento ficou conhecido como Terras dos Cariocas.",
        "A população construiu junta a igreja de Santa Cecília.",
      ], IP(78)),
      ponto("Centro Cultural Bom Jardim", -3.7859455, -38.6097667, "Centro Cultural Bom Jardim", [
        "O CCBJ, do Governo do Estado, é um centro cultural de base comunitária e uma referência na formação artística e digital dos jovens do Grande Bom Jardim.",
      ], [IP(78), OSM]),
    ] },
    79: so(79, "Granja Portugal", [
      "Em 1962, a família Gentil comprou a fazenda Bom Jardim de José Augusto Torres Portugal e, dois anos depois, a loteou em quase 2,9 mil lotes.",
      "Até 1970, havia ali três olarias e uma pedreira às margens do Maranguapinho.",
    ]),
    80: so(80, "Colado à Maraponga", [
      "Pequeno, com cerca de 1 km², o Jardim Cearense é tão colado à Maraponga que muitos moradores não sabem em qual dos dois moram.",
      "A Avenida Godofredo Maciel concentra o comércio e o lazer.",
    ]),
    81: so(81, "Manoel Sátiro", [
      "O advogado e político Manoel Sátiro comprou vários lotes da região, inclusive o sítio que virou o bairro. A casa da família é hoje a sede do Floresta Esporte Clube.",
      "A estação de metrô Manoel Sátiro foi inaugurada em 2015.",
    ]),
    82: { capitulos: [
      bairro("Mar agitado", [
        "Maraponga quer dizer “mar agitado”, uma referência à grande lagoa do bairro. Nascido de sítios e vacarias, ainda tem jeito de cidade do Interior.",
        "As confecções trouxeram desenvolvimento: aqui aconteceu o I Festival da Moda de Fortaleza, em 1980. As ruas têm nomes de países, como Mônaco, Itália e Noruega.",
      ], IP(82)),
      ponto("Lagoa da Maraponga", -3.7892994, -38.5688563, "Lagoa da Maraponga", [
        "A lagoa que deu nome ao bairro é protegida pelo Parque Ecológico da Maraponga.",
      ], [IP(82), OSM]),
    ] },
    83: so(83, "Amendoim de montão", [
      "O nome já aparece no mapa da expedição holandesa de Matias Beck a Maranguape. Vem de “mudubim”, amendoim: “amendoim de montão”.",
      "Em 1875, ganhou uma estação da Estrada de Ferro de Baturité, que movimentou a economia. A lagoa do Mondubim, onde os indígenas pescavam e caçavam, ainda é o maior lazer dos moradores.",
    ]),
    84: so(84, "Parque Dois Irmãos", [
      "Resultado de um loteamento dos anos 1970, é um bairro residencial cortado por dois corredores: as avenidas Bernardo Manuel e Presidente Costa e Silva.",
    ]),
    85: so(85, "Parque Presidente Vargas", [
      "O nome homenageia o ex-presidente Getúlio Vargas. A Escola Presidente Vargas, de 1988, foi demolida e reconstruída em 2022.",
    ]),
    86: so(86, "Parque São José", [
      "O bairro homenageia São José, o pai adotivo de Jesus. O Conselho Comunitário e a Associação Beneficente ao Menor Carente são as referências locais.",
    ]),
    87: so(87, "Parque Santa Rosa", [
      "O bairro se desenvolveu com a chegada das irmãs da Congregação do Bom Pastor, nos anos 1980, e depois dos jesuítas. O nome veio de um loteamento.",
      "O riacho Maranguapinho corta todo o bairro, e os antigos moradores lembram das lavadeiras e vacarias às suas margens.",
    ]),
    88: so(88, "Lagoa do atalho", [
      "Passaré quer dizer “lagoa do atalho”: era o caminho mais curto entre as vilas de Messejana e Parangaba. O bairro nasceu da sesmaria da Lagoa do Passaré, de 1810; o sítio central foi comprado em 1942 pelo historiador e ex-prefeito Raimundo Girão.",
      "Nos anos 1960, parte da área virou o zoológico Sargento Prata e o Horto Falconete Fialho, hoje o Parque Zoobotânico.",
    ]),
    89: so(89, "O maior conjunto da América Latina", [
      "A Prefeitura comprou as terras em 1960 para atender à falta de moradia. O Conjunto José Walter, desenhado por Marrocos Aragão como uma cidade planejada, ficou pronto em 1970 e foi considerado o maior conjunto habitacional da América Latina.",
      "O nome homenageia o ex-prefeito José Walter Cavalcante. As festas juninas do bairro já reuniram mais de 600 mil pessoas.",
    ]),
    90: so(90, "Grande Siqueira", [
      "Na divisa com Maracanaú, o Siqueira dá nome a uma região inteira, o Grande Siqueira. É um dos poucos bairros com aeródromo, sonho do piloto Gerardo Feijó, que morreu antes da inauguração.",
      "No bairro fica o Parque Urbano Lagoa da Viúva.",
    ]),
    91: so(91, "O campo de aviação", [
      "O nome vem da base aérea dos anos 1930: os pedreiros, carpinteiros e pintores da obra foram os primeiros moradores do então Campo de Aviação. Vinte e cinco ruas homenageiam militares mortos em acidentes aéreos ou heróis da Segunda Guerra.",
      "O Mercado da Aerolândia, coberto com ferro fundido francês, é metade do antigo Mercado da Carne; a outra metade é o Mercado dos Pinhões, no Centro. Pela malha oficial, ele fica do outro lado da divisa, no Alto da Balança.",
    ]),
    93: { capitulos: [
      bairro("A balança da BR-116", [
        "O bairro nasceu com os trabalhadores da obra do campo de aviação do Alto da Balança, que foram morar perto. O nome, reconhecido em 1961, vem de uma grande balança da BR-116 que pesava as cargas vindas do Interior.",
        "Parte dos moradores gostaria que o bairro fosse incorporado à Aerolândia.",
      ], IP(93)),
      ponto("Mercado da Aerolândia", -3.7685259, -38.5170066, "Mercado da Aerolândia", [
        "Construído nos anos 1940 com metade da estrutura de ferro do antigo Mercado da Carne, importada da França. Leva o nome do bairro vizinho, mas pela malha oficial fica aqui.",
      ], [IP(91), OSM]),
    ] },
    94: so(94, "Bela Vista", [
      "O bairro surgiu em 1937 em volta da Capela de Nossa Senhora de Salete, dos padres holandeses. Cresceu depois dos anos 1950 e sobretudo com o Mercado Público, nos anos 1960.",
      "As avenidas José Bastos e João Pessoa levam rápido ao Centro.",
    ]),
    96: so(96, "A estação do Km 8", [
      "O bairro se formou em volta da estação ferroviária do Km 8, onde hoje há uma estação do VLT com o mesmo nome. A homenagem é ao engenheiro Henrique Couto Fernandes, que dirigiu a Rede de Viação Cearense de 1915 a 1922.",
    ]),
    97: so(97, "De Marupiara a Demócrito Rocha", [
      "Chamado de Marupiara, o bairro recebeu em 1967 o nome de Demócrito Rocha, jornalista, poeta, dentista e deputado nascido na Bahia e adotado pelo Ceará.",
    ]),
    98: so(98, "As terras dos Macedo", [
      "O nome lembra a família Macedo, dona de grandes terras ali. A BR-116 ajudou o bairro a crescer, e a rua principal homenageia Pedro Dantas, um dos fundadores.",
    ]),
    99: so(99, "Casa de pedra", [
      "Até os anos 1940, o lugar se chamava Santa Teresa e fazia parte da Pirocaia, o Grande Montese de hoje. Itaoca quer dizer “casa de pedra” em tupi.",
      "Daqui saía água potável para toda a cidade, em tonéis de madeira puxados a burro, do antigo beco da Itaoca.",
    ]),
    100: so(100, "Pequena aldeia na floresta", [
      "Itaperi é palavra indígena para “pequena aldeia no meio da grande floresta” (ou “água de tapera”).",
      "As ruas têm nomes de países, como Alemanha, Austrália e Suécia, em volta da praça Parque das Nações.",
    ]),
    101: so(101, "O primeiro jóquei do Nordeste", [
      "Nos anos 1930, um alemão comprou um sítio e o chamou de Glück-auf (“feliz regresso”). Ali foi construído, em 1947, o Jockey Club Cearense, o primeiro do Nordeste, com projeto do arquiteto húngaro Emílio Hinko.",
      "Por volta de 1800, havia ali o cemitério indígena Marupiara; as botijas com armas encontradas na obra do jóquei fizeram muita gente sair caçando tesouro.",
    ]),
    103: so(103, "Da Pirocaia a Montese", [
      "O lugar se chamava Pirocaia e tinha a água potável mais disputada da cidade. O nome atual homenageia a vitória brasileira em Montese, na Itália: foi dado por Raimundo Nonato Ximenes, um soldado cearense que, com a notícia, não precisou mais ir à guerra.",
      "Desde a estrada do gado, o bairro tem vocação para o comércio, hoje nas avenidas Alberto Magno e Gomes de Matos.",
    ]),
    104: so(104, "Pan-Americano", [
      "A área era de sítios, depois loteados pela família Gentil. O nome veio depois da Segunda Guerra, pela vizinhança com a base militar americana do Pici.",
      "Parte das ruas tem nomes de estados brasileiros, e a praça da igreja de São Pio X é o ponto de encontro.",
    ]),
    105: { capitulos: [
      bairro("Beleza", [
        "Parangaba quer dizer “beleza” em tupi. Foi aldeia indígena, vila, distrito e, em 1921, virou bairro de Fortaleza; no caminho, chamou-se também Arronches e Porangaba.",
        "Ainda tem jeito de cidade do Interior, e há quem diga que é “irmã” de Messejana.",
      ], IP(105)),
      ponto("Lagoa de Parangaba", -3.7692407, -38.5664461, "Lagoa de Parangaba", [
        "É a lagoa com mais água de Fortaleza, com cerca de 36 hectares. Os antigos contam que ela secou na “Guerra dos Americanos”, quando os caminhões da base do Pici vinham buscar água em plena estiagem.",
      ], [IP(105), OSM]),
    ] },
    106: { capitulos: [
      bairro("Peri e Ceci", [
        "Há duas versões para o nome. Uma diz que vem do “PC” (Post Command) da base americana da Segunda Guerra. O memorialista Nirez diz que é bem mais antigo: por volta de 1870, o dono de um sítio leu José de Alencar e juntou Peri e Ceci, os protagonistas de “O Guarani”, em “Peci”.",
        "A presença americana deixou lendas de aviões enterrados e de um tesouro escondido no subsolo.",
      ], IP(106)),
      ponto("Campus do Pici", -3.7471688, -38.57703, "Campus do Pici", [
        "Um dos campi da Universidade Federal do Ceará ocupa boa parte do bairro.",
      ], [IP(106), OSM]),
    ] },
    107: so(107, "O serrote e a lagoa", [
      "O povoamento começou por volta de 1920, em volta da Lagoa da Rosinha. O nome vem de um serrote, uma pequena elevação, que, como a lagoa, foi alterado pela construção do aeroporto.",
      "Nos anos 1980, a passeata das latas vazias e da lamparina, contra a falta de água e de luz, repercutiu em toda a cidade.",
    ]),
    108: so(108, "Vila Peri", [
      "A Avenida General Osório de Paiva, que liga vários bairros a Maracanaú, concentra o comércio e os serviços do bairro.",
    ]),
    109: so(109, "Do Barro Preto à Vila União", [
      "O lugar se chamava Barro Preto. A dona das terras, Maria Conceição Jacinto, era de União (hoje Jaguaruana) e batizou o loteamento com o nome da sua cidade.",
      "O antigo terminal do aeroporto ficava aqui, e as famílias iam à Praça do Vaqueiro ver os aviões. A sede da Prefeitura de Fortaleza já funcionou no bairro.",
    ]),
    110: { capitulos: [
      bairro("Serviluz", [
        "Cercado pelo mar, o Cais do Porto também é chamado de Serviluz, por causa da antiga Companhia de Serviço de Força e Luz instalada ali.",
        "Do bairro saíram campeões de surfe, como Tita Tavares e Fábio Silva.",
      ], IP(110)),
      ponto("Farol do Mucuripe", -3.7078217, -38.4704039, "Farol do Mucuripe", [
        "Construído entre 1840 e 1846, guiou os barcos até os anos 1950 e virou o Museu do Jangadeiro. Está no brasão do Ceará e é tido como a segunda construção mais antiga da cidade.",
      ], [IP(110), IP(26), OSM]),
    ] },
    111: so(111, "O futuro era o ano 2000", [
      "Construído em 1970 como bairro-dormitório para quem trabalhava no Centro e na Aldeota, ganhou o nome do ano que então simbolizava a modernidade.",
      "Foi erguido sob protesto de ecologistas, só com casas baixas, mas a vegetação das dunas foi toda removida. As 46 quadras têm alamedas com nomes de flores.",
    ]),
    112: so(112, "Das Dunas a Manuel Dias Branco", [
      "O bairro era conhecido como Dunas. O nome homenageia o fundador da Padaria Imperial, que virou a M. Dias Branco, uma das maiores empresas de alimentos do país.",
      "Tem casarões, condomínios e uma das vistas mais bonitas da cidade, sobre as dunas e a Praia do Futuro.",
    ]),
    115: so(115, "Do Pantanal a Ayrton Senna", [
      "Em julho de 1990, cerca de quatro mil famílias, lideradas por Liege Costa, ocuparam um terreno ao lado do Conjunto José Walter. A ocupação foi chamada de Pantanal, como a novela da época.",
      "Em 2021, uma votação dos moradores mudou o nome para Planalto Ayrton Senna. A feira da Rua Quixadá é o orgulho do bairro.",
    ]),
    116: so(116, "As dunas de Lourdes", [
      "Criado em 2005, com a divisão da Praia do Futuro, é chamado pelos moradores de Dunas, pela vista do alto. O nome vem da paróquia de Nossa Senhora de Lourdes.",
      "Até os anos 2000 era quase vazio; a ocupação começou com o marco zero do bairro, a Cruz do Cruzeiro.",
    ]),
    117: so(117, "O bairro que tem banco e moeda", [
      "Famílias removidas de outras partes da cidade começaram a construir barracos em mutirão; nos anos 1970, conquistaram os primeiros lotes. As folhas das palmeiras serviam de telhado, e daí veio o nome.",
      "O bairro criou o próprio banco comunitário e a própria moeda, o Banco Palmas e as palmas.",
    ]),
    118: { capitulos: [
      bairro("O mosteiro no alto", [
        "O bairro leva o nome do Mosteiro de São Bento, que chegou a Fortaleza em 1993, vindo de Olinda.",
      ], IP(118)),
      ponto("Mosteiro de São Bento", -3.8510433, -38.480721, "Mosteiro de São Bento", [
        "No alto do terreno, os monges beneditinos celebram a única missa com canto gregoriano e orações em latim da capital. No Ano-Novo, os moradores sobem até lá para ver os fogos da cidade inteira.",
      ], [IP(118), OSM]),
    ] },
    119: so(119, "Olavo Oliveira", [
      "Antes chamado Parque de Boatan, o bairro homenageia Olavo Oliveira, advogado, jornalista, escritor e político nascido em Granja, em 1893.",
      "É residencial, com muitas vilas; a mais conhecida, a Vila Marcolino, tem uma imagem sacra à frente onde se rezam missas aos domingos.",
    ]),
    120: so(120, "Parque Santa Maria", [
      "O nome homenageia a Virgem Maria. O bairro fica no sul da cidade, entre Barroso, Cajazeiras, Conjunto Palmeiras, Jangurussu, Ancuri e Pedras.",
    ]),
    121: { capitulos: [
      bairro("O novo Mondubim", [
        "Criado em 2010, com parte do Manoel Sátiro. Como o vizinho, o nome vem de “mudubim”, amendoim: “amendoim de montão”.",
      ], IP(121)),
      ponto("Lagoa do Mondubim", -3.8042242, -38.5794212, "Lagoa do Mondubim", [
        "A lagoa que é o principal lazer dos moradores da região, onde os indígenas pescavam e caçavam, fica, pela malha oficial, no Novo Mondubim.",
      ], [IP(83), OSM]),
    ] },
    122: so(122, "Aracapé", [
      "Até o Censo de 2010, o Aracapé era parte do Mondubim; ganhou o próprio bairro na nova divisão da cidade. A estação de metrô Aracapé, apesar do nome, fica no Parque Santa Rosa.",
    ]),
  };

  // O ano em destaque de cada capítulo, desenhado em pixels no tour: "id|título do capítulo": [ano, legenda].
  // O ano precisa estar no texto do próprio capítulo (scripts/validar_historias.js confere).
  const DESTAQUES = {
    "10|Onde a cidade começou": ["1649", "Matias Beck ergue o Forte Schoonenborch"],
    "10|Catedral, Praça do Ferreira e Mercado": ["1978", "a Catedral fica pronta, 40 anos depois do início da obra"],
    "10|O forte que deu nome à cidade": ["1726", "a povoação em volta do forte vira vila"],
    "10|Passeio Público, a Praça dos Mártires": ["1825", "o fuzilamento dos líderes da Confederação do Equador"],
    "10|Theatro José de Alencar": ["1910", "a inauguração, em 17 de junho"],
    "10|Centro Dragão do Mar de Arte e Cultura": ["1999", "a abertura do centro cultural"],
    "92|Aeroporto Internacional Pinto Martins": ["1952", "o aeroporto passa a homenagear Pinto Martins"],
    "95|Arena Castelão": ["1973", "a inauguração, com um 0 a 0 entre Ceará e Fortaleza"],
    "53|Centro Administrativo Virgílio Távora": ["1987", "a sede do governo vai para o Cambeba"],
    "65|Uma vila que virou bairro": ["1759", "nasce a Vila Nova Real de Messejana da América"],
    "65|A lagoa, Iracema e a Matriz": ["2004", "a estátua de Iracema chega à lagoa"],
    "65|O cemitério mais antigo da cidade": ["1836", "abre o cemitério público"],
    "32|Da Praia do Peixe à Praia de Iracema": ["1947", "até este ano, o porto da cidade ficava aqui"],
    "32|Ponte dos Ingleses e Iracema Guardiã": ["1921", "começa a construção da ponte"],
    "113|Uma praia sem nome": ["1949", "a reportagem que inventou o nome"],
    "113|As barracas da Praia do Futuro": ["2025", "as barracas viram Patrimônio Cultural Brasileiro"],
    "114|As barracas da Praia do Futuro": ["1949", "a reportagem que deu nome à praia"],
    "27|Lagoa comprida": ["1970", "o Cidade 2000 é erguido sobre as dunas e as lagoas"],
    "27|Hospital Geral de Fortaleza": ["1969", "a construção do HGF"],
    "27|Shopping RioMar Fortaleza": ["2014", "a inauguração, em outubro"],
    "33|North Shopping Fortaleza": ["1991", "a inauguração, em outubro"],
    "33|RioMar Kennedy": ["2016", "a inauguração, em 26 de outubro"],
    "57|Shopping Iguatemi Bosque": ["1982", "a abertura, num antigo deserto de sal"],
    "57|Universidade de Fortaleza": ["1973", "a aula inaugural, em 21 de março"],
    "40|Do Bairro Vermelho a Antônio Bezerra": ["1965", "o Bairro Vermelho muda de nome"],
    "47|Chácara Salubre": ["1802", "a construção da chácara"],
    "1|Do Alagadiço Grande a São Gerardo": ["1930", "o Alagadiço Grande vira São Gerardo"],
    "5|Do curral da seca à Leste-Oeste": ["1932", "a seca e o Arraial Moura Brasil"],
    "6|O bairro mais antigo de Fortaleza": ["1604", "Pero Coelho funda o Forte de São Tiago"],
    "7|Um lugar para bem ficar": ["1918", "o palacete da família Gentil"],
    "14|Três mil coqueiros": ["1920", "Dionísio Torres compra as terras"],
    "15|Farias Brito ou Otávio Bonfim": ["1922", "abre a Estação do Matadouro"],
    "16|De Redenção a Fátima": ["1952", "a imagem peregrina de Fátima chega à cidade"],
    "22|O primeiro bonde": ["1880", "a primeira linha de bonde de Fortaleza"],
    "24|Palácio da Abolição": ["1970", "a inauguração do palácio"],
    "26|Fazer alguém alegre": ["1629", "a ponta do Mucuripe já aparece nos mapas"],
    "34|O homem que vacinou a cidade": ["1901", "começa a vacinação de casa em casa"],
    "36|Cinco casas de palha": ["1912", "as cinco casas de palha dos pescadores"],
    "37|Antes de Cabral": ["1500", "Pinzón ancora na Ponta do Mucuripe"],
    "42|Um conjunto de vanguarda": ["1977", "a entrega do Conjunto Ceará"],
    "75|Um conjunto de vanguarda": ["1977", "a entrega do Conjunto Ceará"],
    "45|A primeira casa popular": ["1952", "a doação do terreno da Casa Popular"],
    "46|O primeiro São João": ["1963", "a morte do papa que deu nome ao bairro"],
    "69|As pedreiras": ["2017", "Pedras passa a ser de Fortaleza"],
    "77|Do Dendê a Rachel de Queiroz": ["2023", "o Dendê ganha o nome da escritora"],
    "83|Amendoim de montão": ["1875", "chega a estação da Estrada de Ferro de Baturité"],
    "88|Lagoa do atalho": ["1810", "a sesmaria da Lagoa do Passaré"],
    "89|O maior conjunto da América Latina": ["1970", "o Conjunto José Walter fica pronto"],
    "93|A balança da BR-116": ["1961", "o nome do bairro é reconhecido"],
    "94|Bela Vista": ["1937", "a capela de Nossa Senhora de Salete"],
    "97|De Marupiara a Demócrito Rocha": ["1967", "Marupiara vira Demócrito Rocha"],
    "101|O primeiro jóquei do Nordeste": ["1947", "a construção do Jockey Club Cearense"],
    "105|Beleza": ["1921", "Parangaba vira bairro de Fortaleza"],
    "110|Farol do Mucuripe": ["1846", "o farol fica pronto"],
    "111|O futuro era o ano 2000": ["1970", "a construção do bairro"],
    "115|Do Pantanal a Ayrton Senna": ["1990", "começa a ocupação"],
    "116|As dunas de Lourdes": ["2005", "a criação do bairro"],
    "118|O mosteiro no alto": ["1993", "o mosteiro chega de Olinda"],
    "121|O novo Mondubim": ["2010", "a criação do bairro"],
  };
  for (const [chave, [valor, legenda]] of Object.entries(DESTAQUES)) {
    const [id, titulo] = chave.split("|");
    const c = window.HISTORIAS[id] && window.HISTORIAS[id].capitulos.find((x) => x.titulo === titulo);
    if (c) c.destaque = { valor, legenda };
    else console.warn(`historias.js: destaque sem capítulo (${chave})`);
  }
})();
