/* Avexado — o trânsito de Fortaleza. Lê window.TRANSITO (scripts/14_transito.py) e desenha tudo em SVG. */
(() => {
  "use strict";
  const T = window.TRANSITO;
  const REDUZIR = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";
  const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const mil = (v) => (v >= 1000 ? nf0.format(Math.round(v / 1000)) + " mil" : nf0.format(v));
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const $ = (id) => document.getElementById(id);

  function el(tag, attrs = {}, filhos = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "texto") e.textContent = v;
      else if (k === "html") e.innerHTML = v;
      else e.setAttribute(k, v);
    }
    for (const f of [].concat(filhos)) if (f != null) e.append(f);
    return e;
  }
  function s(tag, attrs = {}, filhos = []) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "texto") e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const f of [].concat(filhos)) if (f != null) e.append(f);
    return e;
  }
  const curto = (via) => via.replace(/^Av\.\s+/, "").replace(/\s*\(.*\)$/, "");

  // ----------------------------------------------------------- escalas
  const CORTES = [20000, 30000, 40000, 50000, 60000];
  const RAMPA = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6"].map(css);
  const corVolume = (v) => RAMPA[CORTES.filter((c) => v >= c).length];
  const larguraVolume = (v) => Math.max(1.1, Math.min(6, 1 + (v / 75000) * 5));
  const LARANJA = ["--l1", "--l2", "--l3", "--l4", "--l5", "--l6"].map(css);

  // um ponto de cada via: o radar mais movimentado
  const melhorPorVia = new Map();
  for (const r of T.radares) if (!melhorPorVia.has(r.via) || melhorPorVia.get(r.via).vmd < r.vmd) melhorPorVia.set(r.via, r);

  function baseMapa(svg, { classesRua = ["Coletora", "Arterial II", "Arterial I", "Expressa"], bairros = true } = {}) {
    svg.setAttribute("viewBox", T.viewBox.join(" "));
    const g = s("g");
    if (bairros) {
      const gb = s("g");
      for (const b of T.bairros) gb.append(s("path", { d: b.d, class: "bairro" }, [s("title", { texto: b.nome })]));
      g.append(gb);
    }
    g.append(s("path", { d: T.contorno, class: "contorno" }));
    for (const c of classesRua) g.append(s("path", { d: T.base[c], class: "rua " + c.replace(" ", "-") }));
    svg.append(g);
    return g;
  }

  // dica flutuante, presa à figura
  function dica(fig, caixa) {
    return {
      mostrar(ev, html) {
        caixa.innerHTML = html;
        caixa.hidden = false;
        const r = fig.getBoundingClientRect();
        let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
        const w = caixa.offsetWidth, h = caixa.offsetHeight;
        if (x + w > r.width - 8) x = ev.clientX - r.left - w - 14;
        if (y + h > r.height - 8) y = ev.clientY - r.top - h - 14;
        caixa.style.left = Math.max(6, x) + "px";
        caixa.style.top = Math.max(6, y) + "px";
      },
      esconder() { caixa.hidden = true; },
    };
  }

  // ----------------------------------------------------------- abertura
  (function abertura() {
    const svg = $("hero-mapa");
    svg.setAttribute("viewBox", T.viewBox.join(" "));
    const gb = s("g");
    for (const b of T.bairros) gb.append(s("path", { d: b.d, class: "bairro" }));
    svg.append(s("path", { d: T.contorno, class: "contorno" }), gb,
      s("path", { d: T.base["Arterial I"], class: "rua" }), s("path", { d: T.base["Expressa"], class: "rua" }));
    const gc = s("g");
    T.corredores.forEach((c, i) => {
      const p = s("path", { d: c.d, class: "corredor", pathLength: 1, "stroke-width": larguraVolume(c.vmd) });
      p.style.transitionDelay = (REDUZIR ? 0 : 300 + i * 9) + "ms";
      gc.append(p);
    });
    svg.append(gc);
    T.ranking.slice(0, 3).forEach((r, i) => {
      const pt = melhorPorVia.get(r.via);
      if (!pt) return;
      const [x, y] = pt.xy;
      const anel = s("circle", { cx: x, cy: y, r: 6, class: "pulso-anel" });
      anel.style.animationDelay = 1.6 + i * 0.5 + "s";
      const esq = x > T.viewBox[2] * 0.62;
      svg.append(anel, s("circle", { cx: x, cy: y, r: 3.2, class: "pulso" }),
        s("text", { x: x + (esq ? -9 : 9), y: y + 4, class: "pulso-rotulo", "text-anchor": esq ? "end" : "start",
          texto: `${curto(r.via)} · ${mil(r.vmd)}` }));
    });
    $("hero-rotulo").textContent = `${nf0.format(T.resumo.radares)} radares da AMC · ${nf0.format(T.anual.reduce((a, b) => a + b.sinistros, 0))} sinistros de 2015 a 2024`;
    requestAnimationFrame(() => setTimeout(() => document.querySelector(".t-hero").classList.add("pronto"), 60));
  })();

  // ----------------------------------------------------------- frase
  (function frase() {
    const top = T.ranking[0];
    const texto = `Num dia comum, ${mil(top.vmd)} veículos passam pela ${curto(top.via)} na altura do ${top.bairro}. ` +
      `É mais carro do que gente morando no Jangurussu, o bairro mais populoso da cidade.`;
    const p = $("frase-texto");
    p.setAttribute("aria-label", texto);
    const palavras = texto.split(/\s+/);
    p.replaceChildren(...palavras.flatMap((w, i) => [el("span", { class: "p", "aria-hidden": "true", texto: w }), i < palavras.length - 1 ? " " : ""]));
    const spans = [...p.querySelectorAll(".p")];
    const sec = p.closest(".frase");
    const vias40 = [...melhorPorVia.values()].filter((r) => r.vmd >= 40000).length;
    $("numeros").replaceChildren(...[
      [nf0.format(T.resumo.radares), "radares com contagem de veículos, em " + nf0.format(T.resumo.pontos) + " pontos da cidade."],
      [nf0.format(T.resumo.vias), "avenidas e ruas medidas, de jul/2024 a jun/2025."],
      [nf0.format(vias40), "vias com mais de 40 mil veículos por dia no ponto mais movimentado."],
    ].map(([v, t]) => el("div", {}, [el("dt", { texto: t }), el("dd", { texto: v })])));

    const nav = document.querySelector(".nav");
    const hero = document.querySelector(".t-hero");
    function rolar() {
      nav.classList.toggle("clara", hero.getBoundingClientRect().bottom < 64);
      const r = sec.getBoundingClientRect();
      const prog = REDUZIR ? 1 : Math.min(1, Math.max(0, (-r.top + innerHeight * 0.35) / (r.height - innerHeight * 0.6)));
      const n = Math.round(prog * spans.length);
      spans.forEach((sp, i) => sp.classList.toggle("on", i < n));
    }
    addEventListener("scroll", rolar, { passive: true });
    rolar();
  })();

  // ----------------------------------------------------------- 1. volume
  (function volume() {
    const svg = $("mapa-volume");
    const fig = $("mapa-volume-fig");
    const tip = dica(fig, $("dica-volume"));
    baseMapa(svg);
    const gC = s("g"), gF = s("g", { class: "fluxos" }), gT = s("g"), gR = s("g", { class: "radares" }), gL = s("g");
    const porVia = new Map();
    const fluxoPorVia = new Map();
    const linhas = [];
    for (const c of T.corredores) {
      const linha = s("path", { d: c.d, class: "corredor", stroke: corVolume(c.vmd), "stroke-width": larguraVolume(c.vmd), pathLength: 1 });
      linhas.push([linha, c.vmd]);
      // "carros andando": tracinhos que correm sobre a via; mais carro, tracinhos mais juntos e mais rápidos
      const f = Math.min(1, c.vmd / 70000);
      const fluxo = s("path", { d: c.d, class: "fluxo", "stroke-width": Math.max(0.9, larguraVolume(c.vmd) * 0.5).toFixed(1), "stroke-dasharray": `${(1.6 + f * 1.4).toFixed(1)} ${(16 - f * 11).toFixed(1)}` });
      fluxo.style.animationDuration = (3.2 - f * 2).toFixed(2) + "s";
      fluxo.style.animationDelay = -(Math.random() * 3).toFixed(2) + "s";
      gF.append(fluxo);
      if (!fluxoPorVia.has(c.via)) fluxoPorVia.set(c.via, []);
      fluxoPorVia.get(c.via).push(fluxo);
      const toque = s("path", { d: c.d, class: "corredor-toque" });
      const html = `<b>${c.via}</b><span class="num">${nf0.format(c.vmd)}</span><small>veículos por dia neste trecho</small>`;
      toque.addEventListener("pointermove", (ev) => { tip.mostrar(ev, html); linha.style.strokeWidth = larguraVolume(c.vmd) + 2; });
      toque.addEventListener("pointerleave", () => { tip.esconder(); linha.style.strokeWidth = ""; });
      toque.addEventListener("click", () => focar(c.via));
      gC.append(linha); gT.append(toque);
      if (!porVia.has(c.via)) porVia.set(c.via, []);
      porVia.get(c.via).push(linha);
    }
    const radarEl = T.radares.map((r) => {
      const c = s("circle", { cx: r.xy[0], cy: r.xy[1], r: 1.8, class: "radar" });
      c.dataset.via = r.via;
      gR.append(c);
      return c;
    });
    svg.append(gC, gF, gR, gT, gL);

    // animação de entrada: as vias se desenham das mais carregadas para as menos, e aí o fluxo começa
    const ordem = [...linhas].sort((x, y) => y[1] - x[1]);
    function animarEntrada() {
      if (REDUZIR) { fig.classList.add("desenhado", "fluindo"); return; }
      ordem.forEach(([l], i) => {
        l.style.transition = `stroke-dashoffset 1100ms var(--curva) ${120 + i * 14}ms, opacity 180ms, stroke 180ms`;
        l.style.strokeDashoffset = "0";
      });
      const fim = 120 + ordem.length * 14 + 1100;
      setTimeout(() => {
        ordem.forEach(([l]) => { l.style.transition = ""; l.style.strokeDasharray = "none"; });
        fig.classList.add("desenhado");
        if (!pausado) fig.classList.add("fluindo");
      }, fim);
    }
    if (!REDUZIR) ordem.forEach(([l]) => { l.style.strokeDasharray = "1"; l.style.strokeDashoffset = "1"; });
    aoAparecer(fig, animarEntrada);

    // botão de pausa do movimento (acessibilidade: nada se mexe sem parar)
    let pausado = REDUZIR;
    const pausa = $("pausar-fluxo");
    pausa.hidden = REDUZIR;
    pausa.addEventListener("click", () => {
      pausado = !pausado;
      fig.classList.toggle("fluindo", !pausado && fig.classList.contains("desenhado"));
      pausa.setAttribute("aria-pressed", String(pausado));
      pausa.textContent = pausado ? "▶ Ver o movimento" : "❚❚ Pausar o movimento";
    });

    // legenda
    $("rampa-volume").replaceChildren(...RAMPA.map((c) => { const i = el("i"); i.style.background = c; return i; }));
    $("rampa-volume-rotulos").replaceChildren(el("span", { texto: "< 20 mil" }), el("span", { texto: "· 40 mil ·" }), el("span", { texto: "> 60 mil" }));
    const [a, b] = T.janela;
    const mes = (m) => ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][+m.slice(5) - 1] + "/" + m.slice(0, 4);
    $("janela-txt").textContent = `${mes(a)} a ${mes(b)}`;

    // ranking
    const lista = $("ranking-volume");
    const maxV = T.ranking[0].vmd;
    const botoes = new Map();
    T.ranking.forEach((r) => {
      const barra = el("i");
      const bt = el("button", { type: "button", "aria-pressed": "false" }, [
        el("span", { class: "nome", html: `${r.via}${r.bairro ? `<small>${r.bairro}</small>` : ""}` }),
        el("span", { class: "valor", texto: nf0.format(r.vmd) }),
        el("span", { class: "barra", "aria-hidden": "true" }, [barra]),
      ]);
      bt.addEventListener("click", () => focar(r.via));
      botoes.set(r.via, bt);
      lista.append(el("li", {}, [bt]));
      barra.dataset.w = (r.vmd / maxV) * 100 + "%";
    });
    aoAparecer(lista, () => lista.querySelectorAll(".barra i").forEach((i, k) => setTimeout(() => (i.style.width = i.dataset.w), REDUZIR ? 0 : k * 40)));

    let atual = null;
    const limpar = $("limpar-volume");
    function focar(via) {
      atual = atual === via ? null : via;
      fig.classList.toggle("foco", !!atual);
      for (const [v, ls] of porVia) ls.forEach((l) => l.classList.toggle("ativo", v === atual));
      for (const [v, fs] of fluxoPorVia) fs.forEach((f) => f.classList.toggle("ativo", v === atual));
      radarEl.forEach((c) => c.classList.toggle("ativo", c.dataset.via === atual));
      for (const [v, bt] of botoes) bt.setAttribute("aria-pressed", String(v === atual));
      limpar.hidden = !atual;
      gL.replaceChildren();
      if (atual && melhorPorVia.has(atual)) {
        const p = melhorPorVia.get(atual);
        const esq = p.xy[0] > T.viewBox[2] * 0.6;
        gL.append(s("text", { x: p.xy[0] + (esq ? -10 : 10), y: p.xy[1] - 8, class: "rotulo-via", "text-anchor": esq ? "end" : "start",
          texto: `${curto(atual)} · ${nf0.format(p.vmd)}/dia` }));
      }
    }
    limpar.addEventListener("click", () => focar(atual));
  })();


  // ----------------------------------------------------------- 2. lentidão (Mapbox, trânsito típico)
  (function lentidao() {
    const L = window.LENTIDAO;
    const sec = $("lentidao");
    if (!L || !L.trechos.length) { sec.hidden = true; return; }
    const CORES = ["#b9bce0", "#f2c14e", "#ee8e53", "#e8631e", "#c2331b", "#86202a"];
    const CORTES = [1.15, 1.3, 1.5, 1.75, 2.0];
    const cor = (f) => CORES[CORTES.filter((c) => f >= c).length];
    const largura = (f) => Math.max(1.4, Math.min(6, 1.2 + (f - 1) * 4.2));
    const ROT = { manha: "7h30", almoco: "12h", tarde: "18h" };
    const svg = $("mapa-lento"), fig = $("mapa-lento-fig");
    const tip = dica(fig, $("dica-lento"));
    baseMapa(svg);
    const gL = s("g"), gC = s("g"), gA = s("g"), gT = s("g"), gR = s("g");
    svg.append(gL, gC, gA, gT, gR);
    let hora = "tarde", atual = null, pausado = REDUZIR;
    const els = L.trechos.map((t) => {
      const linha = s("path", { d: t.d, class: "lento", pathLength: 1 });
      const carro = s("path", { d: t.d, class: "carro" });
      carro.style.animationDelay = -(Math.random() * 3).toFixed(2) + "s";
      const toque = s("path", { d: t.d, class: "lento-toque" });
      toque.addEventListener("pointermove", (ev) => {
        const p = t.p[hora];
        if (!p) return;
        tip.mostrar(ev, `<b>${t.rua}</b><small>${p.de && p.para && p.de !== p.para ? `de ${p.de} para ${p.para}` : p.de || ""}</small>` +
          `<span class="num">${nf1.format(p.f)}×</span><small>o tempo da madrugada às ${ROT[hora]}<br>${nf1.format(p.min)} min contra ${nf1.format(p.minl)} min em ${nf1.format(t.km)} km · ${p.kmh} km/h (livre: ${p.kmhl} km/h)</small>`);
      });
      toque.addEventListener("pointerleave", () => tip.esconder());
      toque.addEventListener("click", () => focar(t.id));
      gL.append(linha); gC.append(carro); gT.append(toque);
      return { t, linha, carro };
    });
    $("rampa-lento").replaceChildren(...CORES.map((c) => { const i = el("i"); i.style.background = c; return i; }));

    function pintar() {
      for (const { t, linha, carro } of els) {
        const p = t.p[hora];
        const f = p ? p.f : 1;
        linha.setAttribute("stroke", p ? cor(f) : "transparent");
        linha.setAttribute("stroke-width", largura(f));
        carro.setAttribute("stroke-width", Math.max(0.9, largura(f) * 0.45).toFixed(1));
        // quanto mais devagar o trânsito, mais devagar os "carros" andam
        carro.style.animationDuration = (p ? Math.max(1.2, Math.min(9, 90 / p.kmh)) : 3).toFixed(2) + "s";
        carro.style.visibility = p ? "visible" : "hidden";
      }
      // pulso nos 5 mais lentos
      const top = els.filter((e) => e.t.p[hora]).sort((a, b) => b.t.p[hora].f - a.t.p[hora].f);
      gA.replaceChildren();
      top.slice(0, 5).forEach(({ linha }, i) => {
        const len = linha.getTotalLength ? linha.getTotalLength() : 0;
        const m = linha.getPointAtLength ? linha.getPointAtLength(len / 2) : { x: 0, y: 0 };
        const c = s("circle", { cx: m.x, cy: m.y, r: 7, class: "alerta" });
        c.style.animationDelay = i * 0.35 + "s";
        gA.append(c);
      });
      // números
      const c = L.cidade[hora];
      $("numeros-lento").replaceChildren(...[
        [nf1.format(c.fator) + "×", `é quanto tempo a mais leva, em média, atravessar as avenidas às ${ROT[hora]} do que de madrugada.`],
        [nf0.format(c.kmh) + " km/h", `é a velocidade média nas avenidas às ${ROT[hora]}. De madrugada, ${nf0.format(c.kmh_livre)} km/h.`],
        [nf1.format(top[0].t.p[hora].f) + "×", `no trecho mais lento: ${top[0].t.rua}, de ${top[0].t.p[hora].de} para ${top[0].t.p[hora].para}.`],
        [nf0.format(top.filter((e) => e.t.p[hora].f >= 1.5).length), `trechos de ~2 km levam pelo menos 1,5 vez o tempo da madrugada às ${ROT[hora]}.`],
      ].map(([v, t]) => el("div", {}, [el("dt", { texto: t }), el("dd", { texto: v })])));
      // ranking
      const lista = $("ranking-lento");
      lista.replaceChildren();
      const maxF = top[0].t.p[hora].f;
      top.slice(0, 12).forEach(({ t }) => {
        const p = t.p[hora];
        const barra = el("i");
        const bt = el("button", { type: "button", "aria-pressed": String(t.id === atual) }, [
          el("span", { class: "nome", html: `${t.rua}<small>${p.de}${p.para && p.para !== p.de ? " → " + p.para : ""}</small>` }),
          el("span", { class: "fator", texto: nf1.format(p.f) + "×" }),
          el("span", { class: "barra", "aria-hidden": "true" }, [barra]),
        ]);
        bt.dataset.id = t.id;
        bt.addEventListener("click", () => focar(t.id));
        lista.append(el("li", {}, [bt]));
        requestAnimationFrame(() => requestAnimationFrame(() => (barra.style.width = ((p.f - 1) / (maxF - 1)) * 100 + "%")));
      });
    }
    function focar(id) {
      atual = atual === id ? null : id;
      fig.classList.toggle("foco", atual !== null);
      for (const { t, linha, carro } of els) { linha.classList.toggle("ativo", t.id === atual); carro.classList.toggle("ativo", t.id === atual); }
      $("ranking-lento").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.id === atual)));
      $("limpar-lento").hidden = atual === null;
      gR.replaceChildren();
      const e = els.find((x) => x.t.id === atual);
      if (e) {
        const m = e.linha.getPointAtLength(e.linha.getTotalLength() / 2);
        const esq = m.x > T.viewBox[2] * 0.6;
        gR.append(s("text", { x: m.x + (esq ? -12 : 12), y: m.y - 10, class: "rotulo-via", "text-anchor": esq ? "end" : "start", texto: `${curto(e.t.rua)} · ${nf1.format(e.t.p[hora].f)}×` }));
      }
    }
    $("limpar-lento").addEventListener("click", () => focar(atual));

    // entrada: as vias se pintam das mais lentas para as mais livres
    const ordem = () => [...els].sort((a, b) => (b.t.p[hora]?.f || 0) - (a.t.p[hora]?.f || 0));
    if (!REDUZIR) els.forEach(({ linha }) => { linha.style.strokeDasharray = "1"; linha.style.strokeDashoffset = "1"; });
    pintar();
    aoAparecer(fig, () => {
      if (REDUZIR) { fig.classList.add("fluindo"); return; }
      const o = ordem();
      o.forEach(({ linha }, i) => { linha.style.transition = `stroke-dashoffset 900ms var(--curva) ${100 + i * 8}ms, stroke 600ms, stroke-width 600ms, opacity 180ms`; linha.style.strokeDashoffset = "0"; });
      setTimeout(() => {
        o.forEach(({ linha }) => { linha.style.transition = ""; linha.style.strokeDasharray = "none"; });
        if (!pausado) fig.classList.add("fluindo");
      }, 100 + o.length * 8 + 900);
    });
    const pausa = $("pausar-lento");
    pausa.hidden = REDUZIR;
    pausa.addEventListener("click", () => {
      pausado = !pausado;
      fig.classList.toggle("fluindo", !pausado);
      pausa.setAttribute("aria-pressed", String(pausado));
      pausa.textContent = pausado ? "▶ Ver o movimento" : "❚❚ Pausar o movimento";
    });
    $("ctl-hora").addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-v]");
      if (!b) return;
      $("ctl-hora").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      hora = b.dataset.v;
      pintar();
      if (atual !== null) { const a = atual; atual = null; focar(a); }
    });
    const [d1, d2] = L.dias.map((d) => d.split("-").reverse().slice(0, 2).join("/"));
    $("lent-nota").textContent = `Quanto tempo a mais a mesma viagem leva no horário escolhido, comparado com a madrugada, no trânsito típico de um dia útil (Mapbox, ${d1} e ${d2}). ${nf0.format(L.km)} km de avenidas, em pedaços de ~2 km. Os "carros" andam mais devagar onde o trânsito é mais lento.`;
  })();

  // ----------------------------------------------------------- 2. sinistros
  (function sinistros() {
    const [a0, , a1] = T.anos_sinistros;
    document.querySelectorAll(".anos-sin").forEach((e) => (e.textContent = e.textContent.includes(" e ") ? `${a0} e ${a1}` : `${a0} a ${a1}`));
    const R = T.resumo;
    const primeiro = T.anual[0], ultimo = T.anual[T.anual.length - 1];
    const dias = T.anos_sinistros.length * 365;
    $("numeros-sinistros").replaceChildren(...[
      [nf0.format(R.sinistros_periodo), `sinistros registrados de ${a0} a ${a1}, uns ${nf0.format(R.sinistros_periodo / dias)} por dia.`],
      [nf0.format(R.mortos_periodo), `mortes no trânsito no mesmo período.`],
      [nf0.format(R.moto_pct) + "%", "dos sinistros tiveram pelo menos uma moto envolvida."],
      [nf0.format(Math.round((1 - ultimo.mortos / primeiro.mortos) * 100)) + "% menos", `mortes em ${ultimo.ANO} do que em ${primeiro.ANO} (${primeiro.mortos} → ${ultimo.mortos}).`],
    ].map(([v, t]) => el("div", {}, [el("dt", { texto: t }), el("dd", { texto: v })])));

    const svg = $("mapa-sinistros");
    const fig = svg.closest(".t-mapa");
    const tip = dica(fig, $("dica-sinistros"));
    baseMapa(svg, { classesRua: ["Coletora", "Arterial II", "Arterial I", "Expressa"] });
    const g = s("g");
    const ordem = [...T.criticos].sort((x, y) => y.n - x.n);
    ordem.forEach((c, i) => {
      const bola = s("circle", { cx: c.xy[0], cy: c.xy[1], r: 0.78 * Math.sqrt(c.n), class: "critico" + (c.mortos ? " morte" : "") });
      bola.style.transitionDelay = (REDUZIR ? 0 : 200 + i * 6) + "ms";
      const html = `<b>${c.local}</b><span class="num">${nf0.format(c.n)}</span><small>sinistros em 3 anos · ${nf0.format((c.moto / c.n) * 100)}% com moto${c.mortos ? ` · ${c.mortos} ${c.mortos > 1 ? "mortes" : "morte"}` : ""}</small>`;
      bola.addEventListener("pointermove", (ev) => { tip.mostrar(ev, html); bola.classList.add("ativo"); });
      bola.addEventListener("pointerleave", () => { tip.esconder(); bola.classList.remove("ativo"); });
      g.append(bola);
    });
    // os maiores atrás, para não esconder os pequenos
    svg.append(g);
    aoAparecer(fig, () => fig.classList.add("visivel"));

    const lista = $("ranking-sinistros");
    const maxN = T.sinistros_vias[0].n;
    T.sinistros_vias.slice(0, 10).forEach((v) => {
      const barra = el("i");
      barra.dataset.w = (v.n / maxN) * 100 + "%";
      lista.append(el("li", {}, [el("button", { type: "button", tabindex: "-1" }, [
        el("span", { class: "nome", html: `${v.via}${v.mortos ? `<small>${v.mortos} mortes</small>` : ""}` }),
        el("span", { class: "valor", texto: nf0.format(v.n) }),
        el("span", { class: "barra", "aria-hidden": "true" }, [barra]),
      ])]));
    });
    aoAparecer(lista, () => lista.querySelectorAll(".barra i").forEach((i, k) => setTimeout(() => (i.style.width = i.dataset.w), REDUZIR ? 0 : k * 40)));
  })();

  // ----------------------------------------------------------- 3. quando
  (function quando() {
    const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const DIAS_LONGO = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    const sem = T.calor.semanas;
    const m = T.calor.matriz.map((linha) => linha.map((v) => v / sem));
    const todos = m.flat().sort((x, y) => x - y);
    const q = (p) => todos[Math.floor(p * (todos.length - 1))];
    const cortes = [q(0.2), q(0.4), q(0.6), q(0.8), q(0.95)];
    const cor = (v) => LARANJA[cortes.filter((c) => v >= c).length];
    const box = $("calor");
    const fig = box.closest(".t-calor-fig");
    const tip = dica(fig, $("dica-calor"));
    let pico = { v: -1 };
    m.forEach((linha, d) => {
      box.append(el("span", { class: "dia", texto: DIAS[d] }));
      linha.forEach((v, h) => {
        const c = el("span", { class: "cel" });
        c.style.background = cor(v);
        c.style.transitionDelay = (REDUZIR ? 0 : (h + d * 2) * 14) + "ms";
        const html = `<b>${DIAS_LONGO[d]}, ${h}h</b><span class="num">${nf1.format(v)}</span><small>sinistros por semana, em média</small>`;
        c.addEventListener("pointermove", (ev) => tip.mostrar(ev, html));
        c.addEventListener("pointerleave", () => tip.esconder());
        box.append(c);
        if (v > pico.v) pico = { v, d, h };
      });
    });
    box.append(el("span"));
    for (let h = 0; h < 24; h++) box.append(el("span", { class: "hora", texto: String(h) }));
    const leg = el("div", { class: "t-calor-leg" }, [el("span", { texto: "menos" }),
      ...LARANJA.map((c) => { const i = el("span"); i.style.cssText = `width:16px;height:12px;border-radius:2px;background:${c}`; return i; }),
      el("span", { texto: "mais sinistros" })]);
    fig.append(leg);
    aoAparecer(box, () => box.classList.add("visivel"));

    // fins de semana de madrugada x dias úteis
    const madrugadaFds = (m[5].slice(0, 5).reduce((a, b) => a + b) + m[6].slice(0, 5).reduce((a, b) => a + b)) / 10;
    const madrugadaUtil = m.slice(0, 5).reduce((a, l) => a + l.slice(0, 5).reduce((x, y) => x + y), 0) / 25;
    $("quando-nota").textContent = `Cada quadradinho é a média de sinistros por semana naquele horário, de ${T.anos_sinistros[0]} a ${T.anos_sinistros[2]}. ` +
      `O pior horário é ${DIAS_LONGO[pico.d].toLowerCase()} às ${pico.h}h. Na madrugada do fim de semana há ${nf1.format(madrugadaFds / madrugadaUtil)} vezes mais registros que na dos dias úteis.`;

    // série anual
    const svg = $("serie");
    const W = Math.max(360, Math.min(720, svg.clientWidth || 720)), H = W < 500 ? 260 : 240, P = { t: 26, r: 8, b: 26, l: 8 };
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const A = T.anual;
    const maxS = Math.max(...A.map((x) => x.sinistros)), maxM = Math.max(...A.map((x) => x.mortos));
    const bw = (W - P.l - P.r) / A.length;
    const yS = (v) => H - P.b - (v / maxS) * (H - P.t - P.b);
    const yM = (v) => H - P.b - (v / maxM) * (H - P.t - P.b) * 0.55;
    const pts = [];
    A.forEach((x, i) => {
      const cx = P.l + bw * i + bw / 2;
      svg.append(s("rect", { x: P.l + bw * i + bw * 0.14, y: yS(x.sinistros), width: bw * 0.72, height: H - P.b - yS(x.sinistros), rx: 2, class: "bar" + (i === A.length - 1 ? " ultimo" : "") }),
        s("text", { x: cx, y: yS(x.sinistros) - 6, "text-anchor": "middle", class: "val", texto: W < 500 ? nf0.format(Math.round(x.sinistros / 1000)) + "k" : mil(x.sinistros) }),
        s("text", { x: cx, y: H - 8, "text-anchor": "middle", texto: W < 500 ? "’" + String(x.ANO).slice(2) : x.ANO }));
      pts.push([cx, yM(x.mortos), x.mortos]);
    });
    svg.append(s("path", { d: "M" + pts.map((p) => p[0] + " " + p[1]).join("L"), class: "linha-mortes" }));
    pts.forEach(([x, y, v], i) => {
      svg.append(s("circle", { cx: x, cy: y, r: 3.5, class: "pt" }));
      if (i === 0 || i === pts.length - 1 || i === 5) svg.append(s("text", { x, y: i === 5 ? y + 18 : y - 10, "text-anchor": "middle", class: "val-m", texto: v + (W < 500 ? "" : " mortes") }));
    });
    const p20 = A.find((x) => x.ANO === 2020);
    $("serie-nota").innerHTML = `Barras: sinistros por ano. Linha: mortes. Os registros caíram até ${p20 ? "2020, ano da pandemia (" + mil(p20.sinistros) + ")" : "2020"}, e voltaram a subir; as mortes seguiram caindo, de ${A[0].mortos} em ${A[0].ANO} para ${A[A.length - 1].mortos} em ${A[A.length - 1].ANO}.`;
  })();

  function aoAparecer(alvo, fn) {
    if (REDUZIR || !("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { fn(); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(alvo);
  }
})();
