/* Bairros de Fortaleza — "Onde morar": questionário e recomendação de bairros.
   Dados: data.js (DADOS), rotas.js (ROTAS, Strava), precos.js (PRECOS, PriceRadar) e equipamentos.js (EQUIP, OpenStreetMap).
   Os três últimos são opcionais: o que faltar sai da conta e a página avisa. */
(() => {
  "use strict";

  const D = window.DADOS;
  const R = window.ROTAS || null;
  const P = window.PRECOS || null;
  const E = window.EQUIP || null;
  const Q = window.PRACAS || null; // praças da URBIFOR (2019): contexto nos cards e no mapa, fora da nota
  const T = window.TRANSPORTE || null; // tempo de ônibus entre bairros e polos (scripts/12_transporte.py)
  const REDUZIR = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const FEATS = D.geojson.features;
  const BAIRROS = FEATS.map((f) => f.properties);
  const POR_ID = new Map(BAIRROS.map((p) => [p.id, p]));

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const RAMPA = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6"].map(css);
  const COR = { escuro: css("--cobalto-escuro"), neutro: css("--neutro"), papel: css("--papel-claro"), branco: "#ffffff" };

  const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const reais = (v) => "R$ " + nf0.format(v);
  const tempoTxt = (m) => (m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, "0")}`);
  const milhares = (v) => (v >= 1e6 ? "R$ " + nf1.format(v / 1e6) + " mi" : "R$ " + nf0.format(Math.round(v / 1e3)) + " mil");
  const el = (tag, attrs = {}, filhos = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "texto") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const f of [].concat(filhos)) if (f != null && f !== false) n.append(f);
    return n;
  };
  const svgEl = (tag, a = {}) => { const n = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const k in a) n.setAttribute(k, a[k]); return n; };

  // =====================================================================
  // ORÇAMENTO: parcela de até 30% da renda, 30 anos, tabela Price
  // =====================================================================
  const JUROS_ANO = 0.105, MESES = 360, COMPROMETE = 0.30;
  function teto(renda, entrada) {
    const i = Math.pow(1 + JUROS_ANO, 1 / 12) - 1;
    const parcela = renda * COMPROMETE;
    return { parcela, financiado: (parcela * (1 - Math.pow(1 + i, -MESES))) / i, total: (parcela * (1 - Math.pow(1 + i, -MESES))) / i + entrada };
  }

  // =====================================================================
  // CRITÉRIOS: toda nota vira a posição do bairro entre os 121 (0 a 100)
  // =====================================================================
  function percentis(fn) {
    const pares = BAIRROS.map((p) => [p.id, fn(p)]).filter(([, v]) => v != null && Number.isFinite(v)).sort((a, b) => a[1] - b[1]);
    const m = new Map(), n = pares.length;
    for (let i = 0; i < n;) {
      let j = i;
      while (j + 1 < n && pares[j + 1][1] === pares[i][1]) j++;
      const pos = ((i + j) / 2 + 1) / n * 100; // empate recebe a posição média
      for (let k = i; k <= j; k++) m.set(pares[k][0], pos);
      i = j + 1;
    }
    return m;
  }
  const eq = (p, k) => (E && E.bairros[p.id] ? E.bairros[p.id][k] : null);
  const strava = (p) => (R && R.bairros[p.id] ? (R.bairros[p.id][0] + R.bairros[p.id][1]) / 2 : null);

  // ícones em pixel, 7×7
  const ICONES = {
    escudo: ["..###..", ".#####.", "#######", "#######", ".#####.", "..###..", "...#..."],
    cruz: ["..###..", "..###..", "#######", "#######", "#######", "..###..", "..###.."],
    arvore: ["..###..", ".#####.", "#######", ".#####.", "...#...", "...#...", ".#####."],
    gota: ["...#...", "..###..", ".#####.", "#######", "#######", ".#####.", "..###.."],
    onibus: [".#####.", "#.....#", "#######", "#.....#", "#######", "##...##", ".#...#."],
    livro: ["##...##", "###.###", "###.###", "###.###", "###.###", "###.###", "#######"],
    sacola: ["..###..", ".#...#.", "#######", "#######", "#######", "#######", ".#####."],
    lua: ["..###..", ".##....", "##.....", "##.....", "##.....", ".##....", "..###.."],
    moeda: ["..###..", ".#...#.", "#..#..#", "#.###.#", "#..#..#", ".#...#.", "..###.."],
    casa: ["...#...", "..###..", ".#####.", "#######", ".##.##.", ".##.##.", ".#####."],
    pino: ["..###..", ".#####.", "##...##", "##...##", ".#####.", "..###..", "...#..."],
  };
  function icone(nome, classe = "px-icone") {
    const s = svgEl("svg", { class: classe, viewBox: "0 0 7 7", "aria-hidden": "true" });
    let k = 0;
    ICONES[nome].forEach((linha, y) => [...linha].forEach((ch, x) => {
      if (ch !== "#") return;
      const r = svgEl("rect", { x: x + 0.08, y: y + 0.08, width: 0.84, height: 0.84 });
      r.style.setProperty("--k", k++);
      s.append(r);
    }));
    return s;
  }

  // lazer: 60% OpenStreetMap, 20% m² de praça por morador (URBIFOR), 20% Strava. Bairro sem praça no
  // cadastro fica sem essa parte (não leva zero: pode ser só falta de cadastro) e os pesos se redistribuem.
  const PRACAS_PCT = Q ? percentis((p) => (Q.bairros[p.id] && Q.bairros[p.id].n ? Q.bairros[p.id].m2_hab : null)) : new Map();
  function lazer(p) {
    const partes = [];
    if (eq(p, "lazer") != null) partes.push([eq(p, "lazer"), 0.6]);
    if (PRACAS_PCT.has(p.id)) partes.push([PRACAS_PCT.get(p.id), 0.2]);
    if (strava(p) != null) partes.push([strava(p), 0.2]);
    if (!partes.length) return null;
    return partes.reduce((s, [v, w]) => s + v * w, 0) / partes.reduce((s, [, w]) => s + w, 0);
  }
  const N_AIS = BAIRROS.reduce((m, p) => m.set(p.ais, (m.get(p.ais) || 0) + 1), new Map());

  const CRITERIOS = [
    {
      id: "seguranca", nome: "Segurança", icone: "escudo", ok: true,
      pergunta: "Quanto pesa a segurança na sua escolha?",
      detalhe: "Mortes violentas por habitante na área de segurança (AIS) do bairro, da SSPDS: 2019 a 2025, com peso maior nos anos recentes. O valor é o mesmo para todos os bairros de uma AIS.",
      legenda: "Acendem os bairros mais seguros",
      valor: (p) => p.score_seguranca,
    },
    {
      id: "saude", nome: "Saúde", icone: "cruz", ok: !!E,
      pergunta: "E ter hospital e posto de saúde por perto?",
      detalhe: "Distância até o hospital mais próximo e clínicas e postos no bairro e a 500 m dele (OpenStreetMap).",
      legenda: "Acendem os bairros com mais saúde por perto",
      valor: (p) => eq(p, "saude"),
    },
    {
      id: "lazer", nome: "Lazer", icone: "arvore", ok: !!E || !!R || !!Q,
      pergunta: "Parques, praças, praia e cultura importam?",
      detalhe: E
        ? "Parques, quadras, academias, teatros, cinemas, shoppings e praia por perto (OpenStreetMap), área de praças por morador (URBIFOR, 2019) e o movimento de corrida e pedal do Strava."
        : "Por enquanto, só o movimento de corrida e pedal nas ruas do bairro (Strava). Parques e cultura entram quando o OpenStreetMap for baixado.",
      legenda: "Acendem os bairros com mais lazer",
      valor: (p) => lazer(p),
    },
    {
      id: "infra", nome: "Infraestrutura", icone: "gota", ok: true,
      pergunta: "Saneamento e serviços básicos são prioridade?",
      detalhe: "Esgoto em rede, água encanada e coleta de lixo nos domicílios (Censo 2022).",
      legenda: "Acendem os bairros com melhor infraestrutura",
      valor: (p) => (p.score_saneamento_2022 + p.agua_2022 + p.lixo_2022) / 3,
    },
    {
      id: "mobilidade", nome: "Mobilidade", icone: "onibus", ok: !!E,
      pergunta: "Quanto importa se locomover sem carro?",
      detalhe: "Paradas de ônibus, estações de metrô e VLT e quilômetros de ciclovia por perto (OpenStreetMap).",
      legenda: "Acendem os bairros com mais transporte",
      valor: (p) => eq(p, "mobilidade"),
    },
    {
      id: "escolas", nome: "Escolas", icone: "livro", ok: !!E,
      pergunta: "Escola, creche ou faculdade perto de casa?",
      detalhe: "Escolas, creches, faculdades e universidades no bairro e a 500 m dele (OpenStreetMap).",
      legenda: "Acendem os bairros com mais escolas",
      valor: (p) => eq(p, "escolas"),
    },
    {
      id: "comercio", nome: "Comércio", icone: "sacola", ok: !!E,
      pergunta: "E o comércio do dia a dia?",
      detalhe: "Supermercados, mercadinhos, padarias e farmácias por perto (OpenStreetMap).",
      legenda: "Acendem os bairros com mais comércio",
      valor: (p) => eq(p, "comercio"),
    },
  ];
  CRITERIOS.forEach((c) => { c.pct = c.ok ? percentis(c.valor) : new Map(); if (c.ok && !c.pct.size) c.ok = false; });
  const DENS = percentis((p) => p.densidade_2022);

  // ---------- trajeto: tempo de ônibus até onde a pessoa vai todo dia ----------
  const NOME_DEST = new Map();
  if (T) {
    BAIRROS.forEach((p) => NOME_DEST.set(`b${p.id}`, p.nome));
    T.polos.forEach((q) => NOME_DEST.set(q.id, q.nome.replace(/ \(.*\)$/, "")));
  }
  const DESLOC = { id: "desloc", nome: "Trajeto", icone: "pino", ok: !!T, pct: new Map() };
  function minutos(p, destino) {
    if (!T || !destino) return null;
    const t = T.tempos[`b${p.id}`], i = T.destinos.indexOf(destino);
    return t && i >= 0 ? t[1][i] : null;
  }
  function recalcularDesloc() {
    // sem rota em até 2h30 conta como o pior tempo, não some da conta
    DESLOC.pct = estado.destino ? percentis((p) => -(minutos(p, estado.destino) ?? 999)) : new Map();
  }
  const INDICE = percentis((p) => p.indice);

  const NIVEIS = [
    { rotulo: "Não importa", peso: 0, nota: "fica fora da conta" },
    { rotulo: "Pouco", peso: 1, nota: "conta um pouco" },
    { rotulo: "Importa", peso: 2, nota: "pesa bastante" },
    { rotulo: "Essencial", peso: 4, nota: "não abro mão" },
  ];
  const RITMO = [
    { rotulo: "Bem tranquilo", v: -1, nota: "menos gente por quarteirão" },
    { rotulo: "Tanto faz", v: 0, nota: "não entra na conta" },
    { rotulo: "Movimentado", v: 1, nota: "vida na rua, mais densidade" },
  ];

  // =====================================================================
  // ESTADO
  // =====================================================================
  const PASSOS = ["intro", "renda", "trajeto", ...CRITERIOS.map((c) => c.id), "ritmo"];
  const estado = {
    passo: 0, renda: 6000, entrada: 30000, quartos: "2",
    niveis: Object.fromEntries(CRITERIOS.map((c) => [c.id, null])),
    ritmo: null, fora: false, sel: null, noResultado: false,
    destino: null, deslocNivel: null,
  };
  const nivelDe = (c) => (c === DESLOC ? estado.deslocNivel : estado.niveis[c.id]);
  const peso = (c) => (c.ok && nivelDe(c) != null && (c !== DESLOC || estado.destino) ? NIVEIS[nivelDe(c)].peso : 0);
  const criteriosAtivos = () => [DESLOC, ...CRITERIOS].filter((c) => peso(c) > 0);

  // ---------- preço do bairro (PriceRadar) e situação no orçamento ----------
  function precoBairro(p) {
    if (!P) return null;
    // amostra mínima do próprio precos.js (5 anúncios no bairro, 15 na regional); abaixo disso a mediana é ruído
    const q = estado.quartos, b = P.bairros[p.id], r = P.regionais[p.regional];
    const minB = (P.min_amostra && P.min_amostra.bairro) || 5, minR = (P.min_amostra && P.min_amostra.regional) || 15;
    const qt = `${q} quarto${q === "1" ? "" : "s"}`;
    const de = (x) => `mediana de ${nf0.format(x.n)} anúncio${x.n === 1 ? "" : "s"}`;
    if (b && b[q] && b[q].n >= minB) return { valor: b[q].preco_mediano, fonte: `${de(b[q])} do bairro, ${qt}` };
    if (r && r[q] && r[q].n >= minR) return { valor: r[q].preco_mediano, fonte: `${de(r[q])} da Regional ${p.regional}, ${qt}` };
    if (b && b.todos && b.todos.n >= minB) return { valor: b.todos.preco_mediano, fonte: `${de(b.todos)} do bairro, todos os tamanhos` };
    if (r && r.todos && r.todos.n >= minR) return { valor: r.todos.preco_mediano, fonte: `${de(r.todos)} da Regional ${p.regional}, todos os tamanhos` };
    return null;
  }
  function orcamento(p, tetoTotal) {
    if (P) {
      const pr = precoBairro(p);
      if (!pr) return { sit: "sem_preco", preco: null };
      const razao = tetoTotal / pr.valor;
      return { sit: razao >= 1 ? "cabe" : razao >= 0.85 ? "limite" : "fora", preco: pr, razao };
    }
    // sem preços coletados: aproximação pela renda dos moradores do bairro (IBGE)
    const k = p.renda_real_2022 / estado.renda;
    return { sit: k <= 1.3 ? "cabe" : k <= 1.8 ? "limite" : "fora", preco: null, razao: 1 / k };
  }
  const SIT = {
    cabe: { rotulo: "Cabe no orçamento", classe: "cabe" },
    limite: { rotulo: "No limite do orçamento", classe: "limite" },
    fora: { rotulo: "Fora do orçamento", classe: "fora" },
    sem_preco: { rotulo: "Sem preço coletado", classe: "sem" },
  };

  // ---------- compatibilidade ----------
  function pontuar() {
    const t = teto(estado.renda, estado.entrada).total;
    const ativos = criteriosAtivos();
    const disp = CRITERIOS.filter((c) => c.ok);
    const ritmo = estado.ritmo != null ? RITMO[estado.ritmo].v : 0;
    return BAIRROS.map((p) => {
      let soma = 0, pesos = 0, pen = 1;
      const fracos = [], partes = [];
      for (const c of ativos) {
        const v = c.pct.get(p.id) ?? 50, w = peso(c);
        soma += w * v; pesos += w;
        partes.push({ c, v, w });
        if (nivelDe(c) === 3 && v < 30) { pen *= 0.7; fracos.push(c); }
      }
      if (ritmo) {
        const v = ritmo > 0 ? DENS.get(p.id) : 100 - DENS.get(p.id);
        soma += 2 * v; pesos += 2;
      }
      const base = pesos ? soma / pesos : disp.reduce((s, c) => s + (c.pct.get(p.id) ?? 50), 0) / (disp.length || 1);
      const orc = orcamento(p, t);
      if (orc.sit === "limite") pen *= 0.92;
      return { p, match: base * pen, orc, partes, fracos };
    }).sort((a, b) => b.match - a.match);
  }

  // =====================================================================
  // CIDADE EM PIXELS (fundo do questionário)
  // =====================================================================
  const tela = document.getElementById("cidade-quiz");
  const cidade = window.CidadePixels(tela, FEATS, { lado: (w) => (w < 520 ? 5 : 7) });
  const legendaEl = document.getElementById("quiz-legenda");
  const tagEl = document.getElementById("quiz-tag");
  const ORIGENS = [[0.5, 0.45], [0.15, 0.2], [0.85, 0.25], [0.3, 0.85], [0.8, 0.8], [0.1, 0.6], [0.6, 0.1], [0.9, 0.55], [0.4, 0.4], [0.5, 0.9]];

  function brilho(id) {
    const vals = new Map();
    if (id === "intro") {
      BAIRROS.forEach((p) => vals.set(p.id, 0.15 + 0.85 * (INDICE.get(p.id) / 100) ** 1.4));
    } else if (id === "renda") {
      const t = teto(estado.renda, estado.entrada).total;
      const nivel = { cabe: 1, limite: 0.5, sem_preco: 0.4, fora: 0.04 };
      BAIRROS.forEach((p) => vals.set(p.id, nivel[orcamento(p, t).sit]));
    } else if (id === "trajeto") {
      if (!T || !estado.destino) BAIRROS.forEach((p) => vals.set(p.id, 0.22));
      else {
        const k = [0.15, 0.6, 0.9, 1][estado.deslocNivel ?? 2];
        BAIRROS.forEach((p) => vals.set(p.id, (1 - k) * 0.3 + k * ((DESLOC.pct.get(p.id) ?? 0) / 100) ** 1.6));
      }
    } else if (id === "ritmo") {
      const v = estado.ritmo == null ? 1 : RITMO[estado.ritmo].v;
      BAIRROS.forEach((p) => vals.set(p.id, v === 0 ? 0.42 : 0.08 + 0.92 * ((v > 0 ? DENS.get(p.id) : 100 - DENS.get(p.id)) / 100) ** 1.6));
    } else if (id === "resultado") {
      const rk = pontuar();
      const max = rk[0].match, min = rk[rk.length - 1].match;
      rk.forEach((r) => vals.set(r.p.id, r.orc.sit === "fora" ? 0.03 : 0.08 + 0.92 * ((r.match - min) / (max - min || 1)) ** 1.5));
    } else {
      const c = CRITERIOS.find((x) => x.id === id);
      if (!c.ok) BAIRROS.forEach((p) => vals.set(p.id, 0.2));
      else {
        // quanto mais importa, mais contraste: em "não importa" a cidade fica quase uniforme
        const nivel = estado.niveis[c.id] ?? 2;
        const k = [0.12, 0.5, 0.85, 1][nivel];
        BAIRROS.forEach((p) => vals.set(p.id, (1 - k) * 0.3 + k * (c.pct.get(p.id) / 100) ** 1.6));
      }
    }
    return vals;
  }

  function legendaCidade(id) {
    let txt;
    if (id === "intro") txt = "Fortaleza, 121 bairros · acesos: melhor índice de renda, saneamento e segurança";
    else if (id === "renda") txt = P ? "Acesos: bairros onde o preço mediano cabe no seu teto" : "Acesos: bairros ao alcance da sua renda (estimativa pela renda dos moradores)";
    else if (id === "trajeto") txt = !T ? "Trajeto: tempos de ônibus ainda não calculados" : estado.destino ? `Acendem os bairros mais perto de ${NOME_DEST.get(estado.destino)} de ônibus` : "Escolha para onde você vai";
    else if (id === "ritmo") txt = estado.ritmo != null && RITMO[estado.ritmo].v === 0 ? "Tanto faz: a densidade não entra na conta" : "Acesos: " + (estado.ritmo != null && RITMO[estado.ritmo].v < 0 ? "os bairros mais tranquilos" : "os bairros mais movimentados");
    else {
      const c = CRITERIOS.find((x) => x.id === id);
      txt = c.ok ? c.legenda : `${c.nome}: ainda sem dados`;
    }
    if (legendaEl.textContent === txt) return;
    legendaEl.classList.remove("trocando"); void legendaEl.offsetWidth; legendaEl.classList.add("trocando");
    legendaEl.textContent = txt;
  }

  function rotuloPixel(p) {
    const id = PASSOS[estado.passo];
    if (id === "renda") {
      const o = orcamento(p, teto(estado.renda, estado.entrada).total);
      return (o.preco ? `≈ ${milhares(o.preco.valor)} · ` : "") + SIT[o.sit].rotulo.toLowerCase();
    }
    if (id === "ritmo") return `${nf0.format(p.densidade_2022)} moradores por km²`;
    if (id === "trajeto") {
      const m = minutos(p, estado.destino);
      return estado.destino ? (m == null ? "sem rota em até 2h30" : `≈ ${tempoTxt(m)} de ônibus até ${NOME_DEST.get(estado.destino)}`) : `Regional ${p.regional}`;
    }
    const c = CRITERIOS.find((x) => x.id === id);
    if (c && c.ok) return `${c.nome.toLowerCase()}: melhor que ${nf0.format(c.pct.get(p.id))}% dos bairros`;
    return `Regional ${p.regional}`;
  }

  tela.addEventListener("pointermove", (e) => {
    const id = cidade.idEm(e.clientX, e.clientY);
    cidade.focar(id);
    if (id == null) { tagEl.hidden = true; return; }
    const p = POR_ID.get(id), r = tela.getBoundingClientRect();
    tagEl.replaceChildren(el("b", { texto: p.nome }), rotuloPixel(p));
    tagEl.hidden = false;
    tagEl.style.left = (e.clientX - r.left) + "px";
    tagEl.style.top = (e.clientY - r.top) + "px";
  });
  tela.addEventListener("pointerleave", () => { cidade.focar(null); tagEl.hidden = true; });

  // =====================================================================
  // QUESTIONÁRIO
  // =====================================================================
  const passosEl = document.getElementById("passos");
  const progressoEl = document.getElementById("progresso");
  const voltarBt = document.getElementById("voltar");
  const avancarBt = document.getElementById("avancar");
  const avancarTxt = document.getElementById("avancar-texto");
  const dicaEl = document.getElementById("quiz-dica");
  const TOTAL = PASSOS.length - 1;

  progressoEl.replaceChildren(...PASSOS.slice(1).map((id) => {
    const c = CRITERIOS.find((x) => x.id === id);
    const titulo = { renda: "Orçamento", trajeto: "Trajeto", ritmo: "Ritmo do bairro" }[id] || c.nome;
    return el("li", { title: titulo }, el("span", {}));
  }));

  const linhas = (txts) => txts.map((t, i) => el("span", { class: "linha", style: `--i:${i}` }, el("span", { texto: t })));
  const kicker = (n, nome) => el("p", { class: "passo-kicker" }, [el("span", { class: "passo-num", texto: `${n} de ${TOTAL}` }), nome]);

  function construir(id, n) {
    if (id === "intro") {
      return el("div", { class: "passo passo-intro" }, [
        el("p", { class: "rotulo" }, [el("span", { class: "rotulo-marca", "aria-hidden": "true" }), "Para quem procura casa"]),
        el("h1", { class: "passo-titulo grande", tabindex: "-1" }, linhas(["Onde você vai", "morar em", "Fortaleza?"])),
        el("p", { class: "passo-lede", texto: `${TOTAL} perguntas rápidas: quanto você pode pagar e o que pesa na escolha. No fim, o mapa mostra os bairros que mais combinam com você.` }),
        el("ul", { class: "passo-selos" }, [
          el("li", { texto: "≈ 1 minuto" }), el("li", { texto: "121 bairros" }),
          el("li", { texto: P ? "preços do PriceRadar" : "Censo, SSPDS e OpenStreetMap" }),
        ]),
      ]);
    }
    if (id === "renda") return construirRenda(n);
    if (id === "trajeto") return construirTrajeto(n);
    if (id === "ritmo") {
      return construirOpcoes({
        n, nome: "Ritmo do bairro", ic: "lua",
        pergunta: "Você prefere um bairro tranquilo ou movimentado?",
        detalhe: "Pela densidade de moradores de cada bairro (Censo 2022).",
        opcoes: RITMO, atual: estado.ritmo, nivelPx: [0, 1, 3],
        escolher: (i) => { estado.ritmo = i; },
      });
    }
    const c = CRITERIOS.find((x) => x.id === id);
    return construirOpcoes({
      n, nome: c.nome, ic: c.icone, pergunta: c.pergunta, detalhe: c.detalhe,
      opcoes: NIVEIS, atual: estado.niveis[c.id], nivelPx: [0, 1, 2, 3], desligado: !c.ok,
      escolher: (i) => { estado.niveis[c.id] = i; },
    });
  }

  function construirOpcoes({ n, nome, ic, pergunta, detalhe, opcoes, atual, nivelPx, desligado, escolher }) {
    const grupo = el("div", { class: "opcoes", role: "radiogroup", "aria-label": pergunta });
    const botoes = opcoes.map((o, i) => {
      const b = el("button", {
        type: "button", class: "opcao", role: "radio", "aria-checked": String(atual === i), disabled: desligado,
        style: `--i:${i}`, "data-i": String(i),
      }, [
        el("span", { class: "opcao-tecla", "aria-hidden": "true", texto: String(i + 1) }),
        el("span", { class: "opcao-niveis", "aria-hidden": "true" }, [0, 1, 2].map((k) => el("i", { class: k < nivelPx[i] ? "on" : "" }))),
        el("span", { class: "opcao-texto" }, [el("b", { texto: o.rotulo }), el("small", { texto: o.nota })]),
      ]);
      b.addEventListener("click", () => {
        const novo = atual !== i;
        atual = i;
        escolher(i);
        botoes.forEach((x, k) => x.setAttribute("aria-checked", String(k === i)));
        b.classList.remove("pulsa"); void b.offsetWidth; b.classList.add("pulsa");
        cidade.alvo(brilho(PASSOS[estado.passo]), { origem: [0.55 + 0.1 * (i - 1.5), 0.5], espalhar: 650 });
        legendaCidade(PASSOS[estado.passo]);
        atualizarNav();
        // avança sozinho na primeira escolha, como um formulário de uma pergunta por vez
        if (novo) { clearTimeout(construirOpcoes.t); construirOpcoes.t = setTimeout(() => { if (PASSOS[estado.passo] !== "intro") avancar(); }, REDUZIR ? 150 : 560); }
      });
      return b;
    });
    grupo.append(...botoes);
    return el("div", { class: "passo" + (desligado ? " desligado" : "") }, [
      kicker(n, nome),
      el("div", { class: "passo-icone" }, icone(ic)),
      el("h2", { class: "passo-titulo", tabindex: "-1" }, linhas([pergunta])),
      el("p", { class: "passo-detalhe", texto: detalhe }),
      desligado ? el("p", { class: "passo-aviso" }, [
        el("b", { texto: "Ainda sem dados. " }),
        "Esta pergunta fica de fora até rodar ", el("code", { texto: "scripts/10_equipamentos_osm.py" }), " (OpenStreetMap).",
      ]) : null,
      grupo,
    ]);
  }

  // ---------- passo do trajeto: destino + peso ----------
  function construirTrajeto(n) {
    const passo = construirOpcoes({
      n, nome: "Trajeto", ic: "pino",
      pergunta: "Para onde você vai quase todo dia?",
      detalhe: `Trabalho, faculdade, escola dos filhos. O tempo de ônibus até lá entra na conta: estimativa de tabela, saindo de manhã num ${(T && T.meta.dia_rotulo) || "dia útil"}.`,
      opcoes: NIVEIS.map((x, i) => (i === 0 ? { rotulo: "Não vou todo dia", nota: "o trajeto fica fora da conta" } : x)),
      atual: estado.deslocNivel, nivelPx: [0, 1, 2, 3], desligado: !T,
      escolher: (i) => { estado.deslocNivel = i; },
    });
    if (!T) {
      passo.querySelector(".passo-aviso")?.remove();
      passo.querySelector(".opcoes").before(el("p", { class: "passo-aviso" }, [
        el("b", { texto: "Ainda sem dados. " }), "Esta pergunta fica de fora até rodar ", el("code", { texto: "scripts/12_transporte.py" }), ".",
      ]));
      return passo;
    }
    const chips = el("div", { class: "destinos", role: "group", "aria-label": "Polos da cidade" });
    const sel = el("select", { class: "destino-sel", "aria-label": "Ou escolha um bairro" }, [
      el("option", { value: "", texto: "ou escolha um bairro…" }),
      ...[...BAIRROS].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((p) => el("option", { value: `b${p.id}`, texto: p.nome })),
    ]);
    const escolherDestino = (id) => {
      estado.destino = id || null;
      recalcularDesloc();
      chips.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.d === estado.destino)));
      sel.value = estado.destino && estado.destino.startsWith("b") ? estado.destino : "";
      cidade.alvo(brilho("trajeto"), { origem: [0.6, 0.4], espalhar: 650 });
      legendaCidade("trajeto");
      atualizarNav();
      // destino escolhido depois do peso: avança como as outras perguntas
      if (estado.deslocNivel != null && respondido("trajeto")) { clearTimeout(construirOpcoes.t); construirOpcoes.t = setTimeout(avancar, REDUZIR ? 150 : 560); }
    };
    chips.append(...T.polos.map((q) => {
      const b = el("button", { type: "button", class: "destino", "data-d": q.id, "aria-pressed": String(estado.destino === q.id), texto: NOME_DEST.get(q.id) });
      b.addEventListener("click", () => escolherDestino(q.id));
      return b;
    }));
    sel.addEventListener("change", () => escolherDestino(sel.value));
    if (estado.destino && estado.destino.startsWith("b")) sel.value = estado.destino;
    passo.querySelector(".opcoes").before(el("div", { class: "destino-caixa" }, [chips, sel]));
    return passo;
  }

  // ---------- passo da renda ----------
  let tetoMostrado = 0;
  function construirRenda(n) {
    const campo = el("input", { class: "renda-campo", id: "renda-campo", type: "text", inputmode: "numeric", autocomplete: "off", "aria-label": "Renda familiar por mês, em reais", value: nf0.format(estado.renda) });
    const slider = el("input", { type: "range", class: "renda-slider", min: "1000", max: "40000", step: "250", value: String(Math.min(40000, estado.renda)), "aria-label": "Renda familiar por mês" });
    const entrada = el("input", { type: "range", class: "renda-slider", min: "0", max: "400000", step: "5000", value: String(estado.entrada), "aria-label": "Entrada disponível" });
    const entradaTxt = el("output", { class: "entrada-valor", texto: reais(estado.entrada) });
    const quartos = el("div", { class: "segmentado segmentado-claro", role: "group", "aria-label": "Quartos" },
      [el("span", { class: "seg-rotulo", "aria-hidden": "true", texto: "Quartos" }),
        ...["1", "2", "3", "4+"].map((q) => el("button", { type: "button", "data-v": q, "aria-pressed": String(estado.quartos === q), texto: q }))]);
    const tetoNum = el("p", { class: "teto-num", "aria-live": "polite" });
    const tetoSub = el("p", { class: "teto-sub" });
    const cabem = el("p", { class: "teto-cabem" });

    const atualizar = (origem) => {
      const t = teto(estado.renda, estado.entrada);
      rolar(tetoNum, tetoMostrado, t.total, milhares);
      tetoMostrado = t.total;
      tetoSub.textContent = `parcela de até ${reais(t.parcela)} por mês (30% da renda), 30 anos a 10,5% ao ano, mais ${reais(estado.entrada)} de entrada`;
      const tt = t.total, contagem = BAIRROS.filter((p) => orcamento(p, tt).sit === "cabe").length;
      cabem.replaceChildren(el("b", { texto: String(contagem) }), ` de 121 bairros cabem${P ? "" : " (estimativa pela renda dos moradores, sem preços coletados)"}`);
      cidade.alvo(brilho("renda"), { origem, espalhar: 420 });
    };
    const lerCampo = () => {
      const v = +campo.value.replace(/\D/g, "");
      if (v >= 500) { estado.renda = Math.min(v, 200000); slider.value = String(Math.min(40000, estado.renda)); atualizar([0.5, 0.5]); }
    };
    campo.addEventListener("input", lerCampo);
    campo.addEventListener("blur", () => { campo.value = nf0.format(estado.renda); });
    slider.addEventListener("input", () => { estado.renda = +slider.value; campo.value = nf0.format(estado.renda); atualizar([+slider.value / 40000, 0.5]); });
    entrada.addEventListener("input", () => { estado.entrada = +entrada.value; entradaTxt.textContent = reais(estado.entrada); atualizar([0.5, 0.2]); });
    quartos.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      quartos.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      estado.quartos = b.dataset.v; atualizar([0.5, 0.8]);
    });
    requestAnimationFrame(() => atualizar([0.5, 0.5]));

    return el("div", { class: "passo passo-renda" }, [
      kicker(n, "Orçamento"),
      el("div", { class: "passo-icone" }, icone("moeda")),
      el("h2", { class: "passo-titulo", tabindex: "-1" }, linhas(["Quanto entra por mês na sua casa?"])),
      el("div", { class: "renda-linha" }, [el("span", { class: "renda-rs", "aria-hidden": "true", texto: "R$" }), campo]),
      slider,
      el("div", { class: "renda-extras" }, [
        el("label", { class: "entrada" }, [el("span", { texto: "Entrada disponível" }), entrada, entradaTxt]),
        quartos,
      ]),
      el("div", { class: "teto" }, [el("p", { class: "teto-rotulo", texto: "Você consegue um imóvel de até" }), tetoNum, tetoSub, cabem]),
    ]);
  }

  // número que rola até o valor novo
  function rolar(no, de, ate, fmt, dur = 650) {
    if (REDUZIR || de === ate) { no.textContent = fmt(ate); return; }
    const t0 = performance.now();
    cancelAnimationFrame(no._raf);
    const passo = (agora) => {
      const k = Math.min(1, (agora - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      no.textContent = fmt(de + (ate - de) * e);
      if (k < 1) no._raf = requestAnimationFrame(passo);
    };
    no._raf = requestAnimationFrame(passo);
  }

  function respondido(id) {
    if (id === "intro" || id === "renda") return true;
    if (id === "ritmo") return estado.ritmo != null;
    if (id === "trajeto") return !T || estado.deslocNivel === 0 || (estado.deslocNivel != null && !!estado.destino);
    const c = CRITERIOS.find((x) => x.id === id);
    return !c.ok || estado.niveis[c.id] != null;
  }

  function atualizarNav() {
    const id = PASSOS[estado.passo];
    voltarBt.hidden = estado.passo === 0;
    avancarTxt.textContent = id === "intro" ? "Começar" : estado.passo === PASSOS.length - 1 ? "Ver meus bairros" : "Continuar";
    avancarBt.disabled = !respondido(id);
    dicaEl.hidden = id === "intro" || id === "renda";
    [...progressoEl.children].forEach((li, i) => {
      li.classList.toggle("feito", i + 1 < estado.passo);
      li.classList.toggle("atual", i + 1 === estado.passo);
    });
  }

  function mostrarPasso(i, dir = 1) {
    clearTimeout(construirOpcoes.t);
    estado.passo = i;
    const id = PASSOS[i];
    const antigo = passosEl.firstElementChild;
    const novo = construir(id, i);
    if (antigo) {
      antigo.classList.add(dir > 0 ? "sai" : "sai-volta");
      antigo.setAttribute("aria-hidden", "true");
      setTimeout(() => antigo.remove(), REDUZIR ? 0 : 380);
    }
    novo.classList.add(dir > 0 ? "chega" : "chega-volta");
    passosEl.append(novo);
    requestAnimationFrame(() => requestAnimationFrame(() => novo.classList.add("visivel")));
    atualizarNav();
    legendaCidade(id);
    if (id !== "renda") cidade.alvo(brilho(id), { origem: ORIGENS[i % ORIGENS.length], espalhar: 900 });
    if (innerWidth <= 1080 && scrollY > 0) window.scrollTo({ top: 0, behavior: REDUZIR ? "auto" : "smooth" });
    const foco = novo.querySelector(".opcao[aria-checked='true']") || (id === "renda" ? novo.querySelector("#renda-campo") : novo.querySelector(".passo-titulo"));
    setTimeout(() => foco && foco.focus({ preventScroll: true }), REDUZIR ? 0 : 420);
  }

  function avancar() {
    if (!respondido(PASSOS[estado.passo])) return;
    if (estado.passo < PASSOS.length - 1) mostrarPasso(estado.passo + 1, 1);
    else irParaResultado(true);
  }
  function voltar() { if (estado.passo > 0) mostrarPasso(estado.passo - 1, -1); }
  avancarBt.addEventListener("click", avancar);
  voltarBt.addEventListener("click", voltar);

  document.addEventListener("keydown", (e) => {
    if (estado.noResultado || e.altKey || e.ctrlKey || e.metaKey) return;
    const emCampo = e.target.matches("input[type=text]");
    if (e.key === "Enter" && !e.target.matches("button, a")) { e.preventDefault(); avancar(); return; }
    if (emCampo) return;
    if (/^[1-4]$/.test(e.key)) {
      const b = passosEl.firstElementChild && passosEl.lastElementChild.querySelector(`.opcao[data-i="${+e.key - 1}"]`);
      if (b && !b.disabled) { e.preventDefault(); b.click(); }
    } else if (e.key === "ArrowLeft" && !e.target.matches("input[type=range]")) { voltar(); }
  });

  // =====================================================================
  // RESULTADO
  // =====================================================================
  const quizEl = document.getElementById("quiz");
  const resEl = document.getElementById("resultado");
  const cardsEl = document.getElementById("cards");
  let mapa = null, camada = null, pinos = L.layerGroup(), pontos = {}, ranking = [];

  function irParaResultado(animar) {
    estado.noResultado = true;
    gravarHash();
    cidade.alvo(brilho("resultado"), { origem: [0.5, 0.5], espalhar: 700 });
    const abrir = () => {
      quizEl.hidden = true;
      resEl.hidden = false;
      document.querySelector(".nav").classList.add("clara");
      window.scrollTo(0, 0);
      montarMapa();
      render(true);
      requestAnimationFrame(() => resEl.classList.add("pronto"));
      document.getElementById("res-titulo").setAttribute("tabindex", "-1");
      document.getElementById("res-titulo").focus({ preventScroll: true });
    };
    if (animar && !REDUZIR) { quizEl.classList.add("encerrando"); setTimeout(abrir, 1100); } else abrir();
  }

  function montarMapa() {
    if (mapa) { mapa.invalidateSize(); return; }
    const mapaEl = document.getElementById("mapa-morar");
    mapa = L.map(mapaEl, { zoomSnap: 0.25, minZoom: 10.5, maxZoom: 16, scrollWheelZoom: false });
    mapaEl.addEventListener("click", () => mapa.scrollWheelZoom.enable(), { once: true });
    camada = L.geoJSON(D.geojson, {
      style: () => ({ className: "bairro-forma", fillColor: COR.papel, fillOpacity: 1, color: COR.branco, weight: 0.8 }),
      onEachFeature(f, layer) {
        layer.bindTooltip(() => {
          const r = ranking.find((x) => x.p.id === f.properties.id);
          return `<b>${f.properties.nome}</b><span>${r ? nf0.format(r.match) + "% · " + SIT[r.orc.sit].rotulo.toLowerCase() : ""}</span>`;
        }, { sticky: true, direction: "top", offset: [0, -8], className: "dica-mapa" });
        layer.on({
          mouseover: () => realcar(f.properties.id),
          mouseout: () => realcar(estado.sel),
          click: () => selecionar(f.properties.id, false),
        });
      },
    }).addTo(mapa);
    mapa.fitBounds(camada.getBounds(), { padding: [12, 12] });
    pinos.addTo(mapa);

    // hospitais e estações (OpenStreetMap) e praças (URBIFOR), discretos e desligáveis
    const camadasEl = document.getElementById("camadas");
    const chaves = [];
    if (Q && window.CamadaPracas) {
      const pracas = window.CamadaPracas(mapa, Q, { nomeBairro: (id) => POR_ID.get(id)?.nome || "" });
      const inp = el("input", { type: "checkbox" });
      inp.addEventListener("change", () => pracas.ligar(inp.checked));
      chaves.push(el("label", { class: "chave chave-mini" }, [inp, el("span", { class: "chave-trilho chave-praca", "aria-hidden": "true" }), `Praças (${Q.cidade.n})`]));
    }
    if (E) {
      const grupo = (lista, classe, rot) => L.layerGroup(lista.map(([la, lo, nome]) =>
        L.circleMarker([la, lo], { radius: 4, weight: 1.5, color: COR.escuro, fillColor: classe === "hosp" ? COR.branco : COR.escuro, fillOpacity: 1, className: "ponto-" + classe })
          .bindTooltip(`<b>${nome || rot}</b>`, { direction: "top", className: "dica-mapa" })));
      const est = grupo(E.estacoes, "est", "Estação");
      const hosp = window.CamadaHospitais ? window.CamadaHospitais(mapa, E.hospitais) : null;
      pontos = {
        hosp: (on) => (hosp ? hosp.ligar(on) : null),
        est: (on) => (on ? est.addTo(mapa) : mapa.removeLayer(est)),
      };
      const chave = (k, txt, n) => {
        const inp = el("input", { type: "checkbox" });
        inp.addEventListener("change", () => pontos[k](inp.checked));
        return el("label", { class: "chave chave-mini" }, [inp, el("span", { class: "chave-trilho", "aria-hidden": "true" }), `${txt} (${n})`]);
      };
      chaves.push(chave("hosp", "Hospitais", E.hospitais.length), chave("est", "Metrô e VLT", E.estacoes.length));
    }
    if (chaves.length) camadasEl.replaceChildren(...chaves); else camadasEl.remove();
  }

  const visiveis = () => ranking.filter((r) => estado.fora || r.orc.sit !== "fora");

  function corDe(r, dom) {
    if (r.orc.sit === "fora") return COR.neutro;
    const t = (r.match - dom[0]) / (dom[1] - dom[0] || 1);
    return RAMPA[Math.max(0, Math.min(5, Math.floor(t * 6)))];
  }
  let DOM = [0, 100];
  function estilo(r) {
    const sel = estado.sel === r.p.id;
    const fora = r.orc.sit === "fora";
    return {
      fillColor: corDe(r, DOM), fillOpacity: fora ? (estado.fora ? 0.5 : 0.28) : 0.92,
      color: sel ? COR.escuro : COR.branco, weight: sel ? 3 : 0.8, dashArray: fora ? "3 3" : null,
    };
  }

  function pintarMapa(animar) {
    const dentro = ranking.filter((r) => r.orc.sit !== "fora");
    const base = dentro.length ? dentro : ranking;
    DOM = [Math.min(...base.map((r) => r.match)), Math.max(...base.map((r) => r.match))];
    const porId = new Map(ranking.map((r, i) => [r.p.id, [r, i]]));
    camada.getLayers().forEach((l) => {
      const [r, i] = porId.get(l.feature.properties.id);
      if (animar && !REDUZIR) setTimeout(() => l.setStyle(estilo(r)), 250 + i * 9);
      else l.setStyle(estilo(r));
    });
    // os 5 melhores ganham um pino numerado que cai no lugar
    pinos.clearLayers();
    visiveis().slice(0, 5).forEach((r, i) => {
      const f = FEATS.find((x) => x.properties.id === r.p.id);
      const c = L.geoJSON(f).getBounds().getCenter();
      const pt = pontoDentro(f) || [c.lat, c.lng];
      L.marker(pt, {
        keyboard: false, zIndexOffset: 1000 - i,
        icon: L.divIcon({ className: "pino-morar", html: `<span style="--i:${i};--d:${animar ? 900 : 60}ms">${i + 1}</span>`, iconSize: [30, 30], iconAnchor: [15, 30] }),
      }).on("click", () => selecionar(r.p.id, true)).addTo(pinos);
    });
  }

  // ponto dentro do polígono (o centro do retângulo cai fora em bairro em forma de "C")
  function pontoDentro(f) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const maior = polys.reduce((a, b) => (b[0].length > a[0].length ? b : a))[0];
    const xs = maior.map((c) => c[0]), ys = maior.map((c) => c[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const dentro = (x, y) => { let c = false; for (let i = 0, j = maior.length - 1; i < maior.length; j = i++) { const [xi, yi] = maior[i], [xj, yj] = maior[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
    let melhor = null, dist = -1;
    for (let a = 1; a < 12; a++) for (let b = 1; b < 12; b++) {
      const x = x0 + (x1 - x0) * a / 12, y = y0 + (y1 - y0) * b / 12;
      if (!dentro(x, y)) continue;
      const d = Math.min(...maior.map(([px, py]) => (px - x) ** 2 + (py - y) ** 2));
      if (d > dist) { dist = d; melhor = [y, x]; }
    }
    return melhor;
  }

  function realcar(id) {
    if (!camada) return;
    camada.getLayers().forEach((l) => {
      const r = ranking.find((x) => x.p.id === l.feature.properties.id);
      const st = estilo(r);
      if (l.feature.properties.id === id) { st.color = COR.escuro; st.weight = 3; l.bringToFront(); }
      l.setStyle(st);
    });
    cardsEl.querySelectorAll(".card").forEach((c) => c.classList.toggle("foco", +c.dataset.id === id));
  }

  function selecionar(id, centralizar) {
    estado.sel = estado.sel === id && !centralizar ? null : id;
    realcar(estado.sel);
    cardsEl.querySelectorAll(".card").forEach((c) => c.setAttribute("aria-current", String(+c.dataset.id === estado.sel)));
    if (estado.sel != null && centralizar) {
      const l = camada.getLayers().find((x) => x.feature.properties.id === id);
      if (l) mapa.flyToBounds(l.getBounds(), { padding: [60, 60], maxZoom: 14, duration: REDUZIR ? 0 : 0.8 });
      if (innerWidth <= 1080) document.getElementById("mapa-morar").scrollIntoView({ behavior: REDUZIR ? "auto" : "smooth", block: "center" });
    }
    if (estado.sel != null && !centralizar) {
      const card = cardsEl.querySelector(`.card[data-id="${id}"]`);
      if (card) card.scrollIntoView({ behavior: REDUZIR ? "auto" : "smooth", block: "nearest" });
    }
  }

  function render(animar) {
    // FLIP: guarda onde cada card estava para animar a troca de posição
    const antes = new Map([...cardsEl.querySelectorAll(".card")].map((c) => [c.dataset.id, c.getBoundingClientRect().top]));
    const matchAntes = new Map([...cardsEl.querySelectorAll(".card")].map((c) => [c.dataset.id, +c.dataset.match]));
    ranking = pontuar();
    pintarMapa(animar);
    resumo();
    legenda();
    avisos();

    const lista = visiveis().slice(0, 10);
    const ativos = criteriosAtivos().sort((a, b) => peso(b) - peso(a));
    cardsEl.replaceChildren(...lista.map((r, i) => card(r, i, ativos)));
    if (!lista.length) cardsEl.append(el("li", { class: "card-vazio" }, [el("b", { texto: "Nenhum bairro cabe nesse orçamento." }), " Ajuste a renda ou a entrada, ou ligue “Mostrar fora do orçamento”."]));

    cardsEl.querySelectorAll(".card").forEach((c, i) => {
      const num = c.querySelector(".card-match b");
      const de = matchAntes.has(c.dataset.id) ? matchAntes.get(c.dataset.id) : 0;
      if (animar && !REDUZIR) setTimeout(() => rolar(num, de, +c.dataset.match, (v) => nf0.format(v), 900), 500 + i * 90);
      else rolar(num, de, +c.dataset.match, (v) => nf0.format(v), 500);
      if (REDUZIR) return;
      if (animar) { c.classList.add("entra"); c.style.setProperty("--i", i); return; }
      const top0 = antes.get(c.dataset.id);
      if (top0 == null) { c.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.2,.7,.1,1)" }); return; }
      const dy = top0 - c.getBoundingClientRect().top;
      if (dy) c.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 560, easing: "cubic-bezier(.2,.7,.1,1)" });
    });
    gravarHash();
  }

  function card(r, i, ativos) {
    const p = r.p, sit = SIT[r.orc.sit];
    const fortes = [...r.partes].sort((a, b) => b.v * b.w - a.v * a.w).filter((x) => x.v >= 60).slice(0, 2).map((x) => x.c.nome.toLowerCase());
    const fracos = [...r.partes].filter((x) => x.v < 40).sort((a, b) => b.w - a.w || a.v - b.v).slice(0, 1).map((x) => x.c.nome.toLowerCase());
    const leitura = [fortes.length ? `Forte em ${fortes.join(" e ")}` : null, fracos.length ? `atenção a ${fracos[0]}` : null].filter(Boolean).join(" · ");
    const preco = r.orc.preco
      ? el("span", { class: "card-preco" }, [`≈ ${milhares(r.orc.preco.valor)}`, el("small", { texto: ` ${r.orc.preco.fonte}` })])
      : el("span", { class: "card-preco" }, el("small", { texto: P ? "sem anúncios suficientes" : `renda média dos moradores ${reais(p.renda_real_2022)}` }));
    const barras = ativos.slice(0, 5).map((c, k) => {
      const v = c.pct.get(p.id) ?? 50;
      const fraco = r.fracos.includes(c);
      return el("li", { class: fraco ? "fraco" : "" }, [
        el("span", { class: "barra-nome" }, [c.nome, nivelDe(c) === 3 ? el("i", { class: "essencial", title: "essencial", texto: "!" }) : null]),
        el("span", { class: "barra-trilho" }, el("i", { style: `--v:${v / 100};--k:${k}` })),
        el("span", { class: "barra-valor", texto: nf0.format(v) }),
      ]);
    });
    const abrir = el("a", { class: "link-botao", href: `index.html#b=${p.id}`, texto: "Abrir no painel ↗" });
    const li = el("li", { class: "card", "data-id": String(p.id), "data-match": String(Math.round(r.match)), "aria-current": String(estado.sel === p.id), tabindex: "0" }, [
      el("div", { class: "card-topo" }, [
        el("span", { class: "card-pos", texto: String(i + 1).padStart(2, "0") }),
        el("div", { class: "card-nome" }, [el("h3", { texto: p.nome }), el("p", { texto: `Regional ${p.regional} · ${nf0.format(p.pop_2022)} moradores` })]),
        el("p", { class: "card-match" }, [el("b", { texto: "0" }), el("small", { texto: "% compatível" })]),
      ]),
      el("div", { class: "card-orc" }, [el("span", { class: `selo selo-${sit.classe}`, texto: sit.rotulo }), preco]),
      barras.length ? el("ul", { class: "card-barras" }, barras) : null,
      linhaTrajeto(p),
      peso(CRITERIOS[0]) > 0 ? el("p", { class: "card-ais" }, `Segurança medida pela ${p.ais}, igual para os ${N_AIS.get(p.ais)} bairros dela`) : null,
      linhaPracas(p),
      el("div", { class: "card-pe" }, [el("p", { texto: leitura || "Equilibrado nos critérios escolhidos" }), abrir]),
    ]);
    li.addEventListener("click", (e) => { if (!e.target.closest("a")) selecionar(p.id, true); });
    li.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.target.closest("a")) selecionar(p.id, true); });
    li.addEventListener("mouseenter", () => realcar(p.id));
    li.addEventListener("mouseleave", () => realcar(estado.sel));
    return li;
  }

  function linhaTrajeto(p) {
    if (!T || !estado.destino) return null;
    const m = minutos(p, estado.destino);
    return el("p", { class: "card-trajeto" }, [
      el("i", { "aria-hidden": "true" }),
      m == null ? `Sem rota de ônibus até ${NOME_DEST.get(estado.destino)} em até 2h30`
        : `≈ ${tempoTxt(m)} de ônibus até ${NOME_DEST.get(estado.destino)}`,
      el("a", { class: "link-botao", href: `index.html#rota=${p.id}:${estado.destino}`, texto: "ver rota" }),
    ]);
  }

  // praças do bairro (URBIFOR, 2019): só informação, não entra na compatibilidade
  function linhaPracas(p) {
    const q = Q && Q.bairros[p.id];
    if (!q) return null;
    const m2 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
    const area = q.area_m2 >= 10000 ? nf1.format(q.area_m2 / 10000) + " ha" : nf0.format(q.area_m2) + " m²";
    return el("p", { class: "card-pracas" + (q.n ? "" : " sem") }, [
      el("i", { "aria-hidden": "true" }),
      q.n ? `${q.n} praça${q.n === 1 ? "" : "s"} cadastrada${q.n === 1 ? "" : "s"} · ${area} · ${m2.format(q.m2_hab)} m² por morador`
        : `Nenhuma praça no cadastro de ${Q.ano}`,
    ]);
  }

  function resumo() {
    const t = teto(estado.renda, estado.entrada);
    const prioridades = criteriosAtivos().sort((a, b) => peso(b) - peso(a));
    const cabem = ranking.filter((r) => r.orc.sit === "cabe").length;
    document.getElementById("res-resumo").replaceChildren(
      el("dl", { class: "resumo-numeros" }, [
        el("div", {}, [el("dt", { texto: "teto do imóvel" }), el("dd", { texto: milhares(t.total) })]),
        el("div", {}, [el("dt", { texto: `cabem no orçamento · renda de ${reais(estado.renda)}/mês, ${estado.quartos} quarto${estado.quartos === "1" ? "" : "s"}` }), el("dd", { texto: `${cabem} bairro${cabem === 1 ? "" : "s"}` })]),
      ]),
      el("ul", { class: "resumo-chips", "aria-label": "Suas prioridades" }, prioridades.length
        ? prioridades.map((c) => el("li", { class: nivelDe(c) === 3 ? "forte" : "" }, [icone(c.icone, "px-mini"),
          `${c === DESLOC ? `Trajeto até ${NOME_DEST.get(estado.destino)}` : c.nome} · ${NIVEIS[nivelDe(c)].rotulo.toLowerCase()}`]))
        : [el("li", { texto: "Sem prioridades: todos os critérios com o mesmo peso" })]),
    );
  }

  function legenda() {
    document.getElementById("legenda-morar").replaceChildren(
      el("p", { class: "legenda-titulo", texto: "Compatibilidade com você" }),
      el("div", { class: "legenda-escala", "aria-hidden": "true" }, RAMPA.map((c) => el("span", { style: `background:${c}` }))),
      el("div", { class: "legenda-rotulos" }, [el("span", { texto: nf0.format(DOM[0]) + "%" }), el("span", { texto: nf0.format(DOM[1]) + "%" })]),
      el("p", { class: "legenda-sem" }, [el("i", { "aria-hidden": "true" }), "fora do orçamento"]),
    );
  }

  function avisos() {
    const itens = [];
    const cabem = ranking.filter((r) => r.orc.sit === "cabe").length;
    if (cabem < 3) {
      const t = teto(estado.renda, estado.entrada).total;
      const perto = ranking.filter((r) => r.orc.razao).sort((a, b) => b.orc.razao - a.orc.razao)[0];
      itens.push(el("p", { class: "aviso-orc" }, [
        el("b", { texto: cabem ? `Só ${cabem} bairro${cabem === 1 ? "" : "s"} cabe${cabem === 1 ? "" : "m"} num teto de ${milhares(t)}. ` : `Nenhum bairro cabe num teto de ${milhares(t)}. ` }),
        perto && perto.orc.preco ? `O mais perto é ${perto.p.nome}, com mediana de ${milhares(perto.orc.preco.valor)}. ` : "",
        "Aumente a entrada, mude o número de quartos em “Ajustar respostas” ou ligue “Mostrar fora do orçamento” para ver os bairros que combinam mesmo acima do teto.",
      ]));
    }
    if (!P) itens.push(el("p", {}, [el("b", { texto: "Preços dos imóveis ainda não coletados. " }), "O orçamento usa a renda média dos moradores de cada bairro como aproximação. Rode ", el("code", { texto: "scripts/09_precos_priceradar.py" }), " para comparar com o preço dos anúncios do PriceRadar."]));
    const semDado = CRITERIOS.filter((c) => !c.ok).map((c) => c.nome.toLowerCase());
    if (semDado.length) itens.push(el("p", {}, [el("b", { texto: `Fora da conta por falta de dados: ${semDado.join(", ")}. ` }), "Rode ", el("code", { texto: "scripts/10_equipamentos_osm.py" }), " para baixar hospitais, transporte, escolas e comércio do OpenStreetMap."]));
    if (!T) itens.push(el("p", {}, [el("b", { texto: "Tempo de ônibus fora da conta. " }), "Rode ", el("code", { texto: "scripts/12_transporte.py" }), " para calcular o trajeto até onde você vai todo dia."]));
    document.getElementById("res-aviso").replaceChildren(...itens);
  }

  // ---------- ajustes ao vivo ----------
  const ajustesEl = document.getElementById("ajustes");
  const ajustarBt = document.getElementById("ajustar");
  function montarAjustes() {
    const seg = (rotulo, opcoes, atual, aoMudar, desligado) => {
      const g = el("div", { class: "segmentado", role: "group", "aria-label": rotulo.nome },
        opcoes.map((o, i) => el("button", { type: "button", "data-v": String(i), "aria-pressed": String(atual === i), disabled: desligado, texto: o })));
      g.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b || b.disabled) return;
        g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        aoMudar(+b.dataset.v); render(false);
      });
      return el("div", { class: "ajuste" + (desligado ? " desligado" : "") }, [el("span", { class: "ajuste-nome" }, [icone(rotulo.icone, "px-mini"), rotulo.nome]), g]);
    };
    const renda = el("input", { type: "text", inputmode: "numeric", class: "ajuste-campo", value: nf0.format(estado.renda), "aria-label": "Renda familiar por mês" });
    renda.addEventListener("change", () => { const v = +renda.value.replace(/\D/g, ""); if (v >= 500) estado.renda = v; renda.value = nf0.format(estado.renda); render(false); });
    const entrada = el("input", { type: "text", inputmode: "numeric", class: "ajuste-campo", value: nf0.format(estado.entrada), "aria-label": "Entrada" });
    entrada.addEventListener("change", () => { estado.entrada = +entrada.value.replace(/\D/g, "") || 0; entrada.value = nf0.format(estado.entrada); render(false); });
    const qs = ["1", "2", "3", "4+"];
    ajustesEl.replaceChildren(
      el("div", { class: "ajustes-orc" }, [
        el("label", {}, [el("span", { texto: "Renda por mês (R$)" }), renda]),
        el("label", {}, [el("span", { texto: "Entrada (R$)" }), entrada]),
        seg({ nome: "Quartos", icone: "casa" }, qs, qs.indexOf(estado.quartos), (i) => { estado.quartos = qs[i]; }),
      ]),
      el("div", { class: "ajustes-grade" }, [
        ...CRITERIOS.map((c) => seg({ nome: c.nome, icone: c.icone }, NIVEIS.map((n) => n.rotulo), estado.niveis[c.id], (i) => { estado.niveis[c.id] = i; }, !c.ok)),
        seg({ nome: "Ritmo", icone: "lua" }, RITMO.map((r) => r.rotulo), estado.ritmo, (i) => { estado.ritmo = i; }),
      ]),
      T ? ajusteTrajeto(seg) : null,
    );
  }
  function ajusteTrajeto(seg) {
    const sel = el("select", { class: "ajuste-campo ajuste-destino", "aria-label": "Para onde você vai todo dia" }, [
      el("option", { value: "", texto: "não vou todo dia" }),
      el("optgroup", { label: "Polos" }, T.polos.map((q) => el("option", { value: q.id, texto: NOME_DEST.get(q.id) }))),
      el("optgroup", { label: "Bairros" }, [...BAIRROS].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((p) => el("option", { value: `b${p.id}`, texto: p.nome }))),
    ]);
    sel.value = estado.destino || "";
    sel.addEventListener("change", () => {
      estado.destino = sel.value || null;
      if (estado.destino && !estado.deslocNivel) estado.deslocNivel = 2;
      recalcularDesloc(); montarAjustes(); render(false);
    });
    return el("div", { class: "ajustes-trajeto" }, [
      el("label", {}, [el("span", { class: "ajuste-nome" }, [icone("pino", "px-mini"), "Trajeto: para onde vai todo dia"]), sel]),
      estado.destino ? seg({ nome: "Peso do trajeto", icone: "onibus" }, NIVEIS.map((n) => n.rotulo), estado.deslocNivel, (i) => { estado.deslocNivel = i; }) : null,
    ]);
  }
  ajustarBt.addEventListener("click", () => {
    const abrir = ajustesEl.hidden;
    if (abrir) montarAjustes();
    ajustesEl.hidden = !abrir;
    ajustarBt.setAttribute("aria-expanded", String(abrir));
    if (abrir && !REDUZIR) ajustesEl.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.7,.1,1)" });
  });
  document.getElementById("ctl-fora").addEventListener("change", (e) => { estado.fora = e.target.checked; render(false); });
  document.getElementById("refazer").addEventListener("click", () => {
    estado.noResultado = false;
    resEl.hidden = true; resEl.classList.remove("pronto");
    quizEl.hidden = false; quizEl.classList.remove("encerrando");
    document.querySelector(".nav").classList.remove("clara");
    ajustesEl.hidden = true; ajustarBt.setAttribute("aria-expanded", "false");
    history.replaceState(null, "", location.pathname);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => { cidade.montar(); mostrarPasso(1, -1); });
  });
  document.getElementById("copiar").addEventListener("click", async () => {
    gravarHash();
    const txt = document.getElementById("copiar-texto");
    try { await navigator.clipboard.writeText(location.href); txt.textContent = "Link copiado"; } catch { txt.textContent = "Copie o endereço da barra"; }
    setTimeout(() => { txt.textContent = "Copiar link do resultado"; }, 2200);
  });

  // ---------- estado no endereço (link compartilhável) ----------
  function gravarHash() {
    if (!estado.noResultado) return;
    const n = CRITERIOS.map((c) => (estado.niveis[c.id] == null ? "x" : estado.niveis[c.id])).join("");
    const h = `#r=${estado.renda}&e=${estado.entrada}&q=${encodeURIComponent(estado.quartos)}&n=${n}&m=${estado.ritmo ?? "x"}` +
      (estado.destino ? `&d=${estado.destino}` : "") + (estado.deslocNivel != null ? `&dn=${estado.deslocNivel}` : "");
    if (location.hash !== h) history.replaceState(null, "", h);
  }
  function lerHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (!h.has("n")) return false;
    estado.renda = Math.max(500, +h.get("r") || estado.renda);
    estado.entrada = Math.max(0, +h.get("e") || 0);
    if (["1", "2", "3", "4+"].includes(h.get("q"))) estado.quartos = h.get("q");
    [...h.get("n")].forEach((ch, i) => { if (CRITERIOS[i] && /[0-3]/.test(ch)) estado.niveis[CRITERIOS[i].id] = +ch; });
    if (/^[0-2]$/.test(h.get("m") || "")) estado.ritmo = +h.get("m");
    if (T && h.get("d") && (T.destinos.includes(h.get("d")))) estado.destino = h.get("d");
    if (/^[0-3]$/.test(h.get("dn") || "")) estado.deslocNivel = +h.get("dn");
    recalcularDesloc();
    return true;
  }

  // =====================================================================
  // INÍCIO
  // =====================================================================
  let tRedim;
  window.addEventListener("resize", () => {
    clearTimeout(tRedim);
    tRedim = setTimeout(() => { if (!quizEl.hidden) cidade.montar(); if (mapa) mapa.invalidateSize(); }, 200);
  });

  cidade.montar();
  if (lerHash()) {
    estado.passo = PASSOS.length - 1;
    irParaResultado(false);
  } else {
    mostrarPasso(0, 1);
    requestAnimationFrame(() => quizEl.classList.add("pronto"));
  }
})();
