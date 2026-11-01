/* A violência em Fortaleza. Lê window.SEGURANCA (scripts/16_seguranca.py). */
(() => {
  "use strict";
  const S = window.SEGURANCA;
  const REDUZIR = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";
  const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const $ = (id) => document.getElementById(id);
  const pct = (a, b) => Math.round((a / b) * 100);

  function el(tag, attrs = {}, filhos = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "texto") e.textContent = v; else if (k === "html") e.innerHTML = v; else e.setAttribute(k, v);
    }
    for (const f of [].concat(filhos)) if (f != null) e.append(f);
    return e;
  }
  function s(tag, attrs = {}, filhos = []) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === "texto") e.textContent = v; else e.setAttribute(k, v); }
    for (const f of [].concat(filhos)) if (f != null) e.append(f);
    return e;
  }
  function dica(fig, caixa) {
    return {
      mostrar(ev, html) {
        caixa.innerHTML = html; caixa.hidden = false;
        const r = fig.getBoundingClientRect();
        let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
        if (x + caixa.offsetWidth > r.width - 8) x = ev.clientX - r.left - caixa.offsetWidth - 14;
        if (y + caixa.offsetHeight > r.height - 8) y = ev.clientY - r.top - caixa.offsetHeight - 14;
        caixa.style.left = Math.max(6, x) + "px"; caixa.style.top = Math.max(6, y) + "px";
      },
      esconder() { caixa.hidden = true; },
    };
  }
  function aoAparecer(alvo, fn) {
    if (REDUZIR || !("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { fn(); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(alvo);
  }
  function segmentado(id, aoMudar) {
    const g = $(id);
    g.addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-v]");
      if (!b) return;
      g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      aoMudar(b.dataset.v);
    });
  }

  const VINHO = ["--v1", "--v2", "--v3", "--v4", "--v5", "--v6"].map(css);
  const COBALTO = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6"].map(css);
  const A = S.areas;
  const C = S.cidade;
  const IND = {
    cvli: { nome: "mortes violentas", taxa: "cvli_taxa", rampa: VINHO, unid: "mortes por 100 mil", media: C.cvli_taxa, fmt: nf1 },
    cvp: { nome: "roubos", taxa: "cvp_taxa", rampa: COBALTO, unid: "roubos por 100 mil", media: C.cvp_taxa, fmt: nf0 },
  };
  function escala(ind) {
    const vals = A.map((a) => a[IND[ind].taxa]);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return { lo, hi, cor: (v) => IND[ind].rampa[Math.min(5, Math.floor(((v - lo) / (hi - lo || 1)) * 6))] };
  }
  const nomeArea = (a) => `AIS ${a.num}`;
  const resumoBairros = (a, n = 3) => a.bairros.slice(0, n).join(", ") + (a.bairros.length > n ? ` e mais ${a.bairros.length - n}` : "");

  // ----------------------------------------------------------- abertura
  (function abertura() {
    const svg = $("hero-mapa");
    svg.setAttribute("viewBox", S.viewBox.join(" "));
    const vals = A.map((a) => a.cvli_taxa), lo = Math.min(...vals), hi = Math.max(...vals);
    const ordem = [...A].sort((x, y) => x.cvli_taxa - y.cvli_taxa);
    ordem.forEach((a, i) => {
      const op = 0.16 + ((a.cvli_taxa - lo) / (hi - lo)) * 0.8;
      const p = s("path", { d: a.d, class: "area", fill: `rgba(255,255,255,${op.toFixed(2)})` });
      p.style.transitionDelay = (REDUZIR ? 0 : 250 + i * 110) + "ms";
      svg.append(p);
    });
    const gb = s("g");
    for (const b of S.bairros) gb.append(s("path", { d: b.d, class: "bairro-h" }));
    svg.append(gb);
    for (const a of A) svg.append(s("text", { x: a.centro[0], y: a.centro[1] + 4, class: "num-area", texto: a.num }));
    $("hero-rotulo").textContent = `Dados oficiais da SSPDS · ${nf0.format(S.n_cvli)} mortes violentas e ${nf0.format(S.n_cvp)} roubos de ${S.anos_media[0]} a ${S.anos_media[2]}`;
    requestAnimationFrame(() => setTimeout(() => document.querySelector(".s-hero").classList.add("pronto"), 60));
  })();

  // ----------------------------------------------------------- frase
  (function frase() {
    const serie = C.serie.cvli;
    const anos = Object.keys(serie).map(Number);
    const ult = Math.max(...anos);
    const pior = anos.reduce((m, y) => (serie[y] > serie[m] ? y : m), anos[0]);
    const maisAlta = A[0], maisBaixa = A[A.length - 1];
    const razao = maisAlta.cvli_taxa / maisBaixa.cvli_taxa;
    const texto = `Em ${ult}, Fortaleza teve ${nf0.format(serie[ult])} mortes violentas, ${pct(serie[pior] - serie[ult], serie[pior])}% menos que em ${pior}, o pior ano da série. ` +
      `Mas a violência não pesa igual: na área mais atingida, a taxa é ${nf1.format(razao)} vezes a da menos atingida.`;
    const p = $("frase-texto");
    p.setAttribute("aria-label", texto);
    const palavras = texto.split(/\s+/);
    p.replaceChildren(...palavras.flatMap((w, i) => [el("span", { class: "p", "aria-hidden": "true", texto: w }), i < palavras.length - 1 ? " " : ""]));
    const spans = [...p.querySelectorAll(".p")];
    const P = S.perfil;
    const totG = Object.values(P.genero).reduce((a, b) => a + b, 0);
    const totM = Object.values(P.meio).reduce((a, b) => a + b, 0);
    $("numeros").replaceChildren(...[
      [nf1.format(C.cvli_taxa), `mortes violentas por 100 mil moradores ao ano, média de ${S.anos_media[0]} a ${S.anos_media[2]}.`],
      [pct(P.genero.Masculino || 0, totG) + "%", "das vítimas eram homens. A metade tinha até " + nf0.format(P.idade_mediana) + " anos."],
      [pct(P.meio["Arma de fogo"] || 0, totM) + "%", "das mortes foram com arma de fogo."],
    ].map(([v, t]) => el("div", {}, [el("dt", { texto: t }), el("dd", { texto: v })])));
    const sec = p.closest(".frase");
    const nav = document.querySelector(".nav");
    const hero = document.querySelector(".s-hero");
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

  // ----------------------------------------------------------- 1. onde
  (function onde() {
    const svg = $("mapa-onde"), fig = $("mapa-onde-fig");
    const tip = dica(fig, $("dica-onde"));
    svg.setAttribute("viewBox", S.viewBox.join(" "));
    const areas = new Map();
    const gA = s("g"), gB = s("g"), gR = s("g");
    for (const a of A) {
      const p = s("path", { d: a.d, class: "area" });
      p.addEventListener("pointermove", (ev) => tip.mostrar(ev, ficha(a)));
      p.addEventListener("pointerleave", () => tip.esconder());
      p.addEventListener("click", () => focar(a.ais));
      gA.append(p);
      areas.set(a.ais, p);
    }
    for (const b of S.bairros) gB.append(s("path", { d: b.d, class: "bairro-l" }));
    svg.append(gA, gB, gR);

    let ind = "cvli", atual = null;
    const lista = $("ranking-onde");
    const botoes = new Map();

    function ficha(a) {
      const I = IND[ind], serie = a[ind];
      const v25 = serie[2025] ?? 0;
      return `<b>${nomeArea(a)}</b><small>${resumoBairros(a, 4)}</small><span class="num">${I.fmt.format(a[I.taxa])}</span>` +
        `<small>${I.unid} ao ano · cidade: ${I.fmt.format(I.media)}<br>${nf0.format(v25)} ${I.nome} em 2025 · ${nf0.format(a.pop)} moradores</small>`;
    }

    function desenhar() {
      const I = IND[ind], e = escala(ind);
      for (const a of A) areas.get(a.ais).setAttribute("fill", e.cor(a[I.taxa]));
      gR.replaceChildren();
      for (const a of A) {
        const escuro = Math.floor(((a[I.taxa] - e.lo) / (e.hi - e.lo || 1)) * 6) >= 3;
        gR.append(s("text", { x: a.centro[0], y: a.centro[1], class: "rot-area", fill: escuro ? "#fff" : css("--tinta"), stroke: escuro ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.6)" },
          [s("tspan", { x: a.centro[0], dy: 0, texto: I.fmt.format(a[I.taxa]) }), s("tspan", { x: a.centro[0], dy: 16, class: "n", texto: nomeArea(a) })]));
      }
      $("rampa-onde").replaceChildren(...I.rampa.map((c) => { const i = el("i"); i.style.background = c; return i; }));
      $("rampa-onde-rotulos").replaceChildren(el("span", { texto: I.fmt.format(e.lo) }), el("span", { texto: "→" }), el("span", { texto: I.fmt.format(e.hi) }));
      $("leg-onde-titulo").textContent = I.unid;
      // ranking
      const ord = [...A].sort((x, y) => y[I.taxa] - x[I.taxa]);
      const max = ord[0][I.taxa];
      lista.classList.toggle("cvp", ind === "cvp");
      lista.replaceChildren();
      botoes.clear();
      ord.forEach((a) => {
        const barra = el("i");
        const bt = el("button", { type: "button", "aria-pressed": String(a.ais === atual) }, [
          el("span", { class: "nome", html: `${nomeArea(a)}<small>${resumoBairros(a)}</small>` }),
          el("span", { class: "valor", texto: I.fmt.format(a[I.taxa]) }),
          el("span", { class: "barra", "aria-hidden": "true" }, [barra, el("span", { class: "media", style: `left:${(I.media / max) * 100}%` })]),
        ]);
        bt.addEventListener("click", () => focar(a.ais));
        botoes.set(a.ais, bt);
        lista.append(el("li", {}, [bt]));
        requestAnimationFrame(() => requestAnimationFrame(() => (barra.style.width = (a[I.taxa] / max) * 100 + "%")));
      });
      $("ranking-onde-nota").textContent = `A linha fina em cada barra é a média da cidade: ${I.fmt.format(I.media)} ${I.unid}.`;
      $("onde-nota").textContent = ind === "cvli"
        ? `Mortes violentas por 100 mil moradores por ano, média de ${S.anos_media[0]} a ${S.anos_media[2]}. Passe o mouse numa área ou escolha na lista.`
        : `Roubos registrados por 100 mil moradores por ano, média de ${S.anos_media[0]} a ${S.anos_media[2]}. O roubo pesa onde há comércio e movimento, não só onde se mora.`;
    }
    function focar(ais) {
      atual = atual === ais ? null : ais;
      fig.classList.toggle("foco", !!atual);
      for (const [k, p] of areas) p.classList.toggle("ativo", k === atual);
      for (const [k, b] of botoes) b.setAttribute("aria-pressed", String(k === atual));
      $("limpar-onde").hidden = !atual;
    }
    $("limpar-onde").addEventListener("click", () => focar(atual));
    segmentado("ctl-indicador", (v) => { ind = v; desenhar(); });
    desenhar();
  })();

  // ----------------------------------------------------------- 2. tendência
  (function tendencia() {
    // série da cidade
    const serie = C.serie.cvli;
    const anos = Object.keys(serie).map(Number);
    const svg = $("serie-cidade");
    const W = Math.max(360, Math.min(760, svg.clientWidth || 760)), H = 230, P = { t: 24, b: 24, l: 4, r: 4 };
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const max = Math.max(...anos.map((y) => serie[y]));
    const pior = anos.reduce((m, y) => (serie[y] > serie[m] ? y : m), anos[0]);
    const bw = (W - P.l - P.r) / anos.length;
    const curto = W < 520;
    anos.forEach((y, i) => {
      const h = (serie[y] / max) * (H - P.t - P.b);
      const x = P.l + i * bw;
      const cls = y === pior ? "bar destaque" : i === anos.length - 1 ? "bar ultimo" : "bar";
      svg.append(s("rect", { x: x + bw * 0.12, y: H - P.b - h, width: bw * 0.76, height: h, rx: 2, class: cls }));
      if (!curto || y === pior || i === 0 || i === anos.length - 1 || y === 2020)
        svg.append(s("text", { x: x + bw / 2, y: H - P.b - h - 6, "text-anchor": "middle", class: "val", texto: nf0.format(serie[y]) }));
      if (!curto || i % 2 === 0) svg.append(s("text", { x: x + bw / 2, y: H - 6, "text-anchor": "middle", texto: curto ? "’" + String(y).slice(2) : y }));
    });
    const ult = anos[anos.length - 1];
    $("serie-cidade-nota").textContent = `Mortes violentas por ano. O pior ano foi ${pior}, com ${nf0.format(serie[pior])}. O salto de 2020 coincide com o motim de policiais militares de fevereiro daquele ano. Em ${ult}, foram ${nf0.format(serie[ult])}.`;

    // pequenos múltiplos por área, 2019–2025
    const box = $("multiplos");
    const ANOS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
    const maxG = Math.max(...A.flatMap((a) => ANOS.map((y) => a.cvli[y] || 0)));
    let quedas = 0;
    for (const a of A) {
      const v = ANOS.map((y) => a.cvli[y] || 0);
      const base = a.cvli[2022] || 0, fim = a.cvli[2025] || 0;
      const varp = fim - base;   // diferença absoluta: com números pequenos, a porcentagem engana
      if (varp < 0) quedas++;
      const cor = varp <= 0 ? css("--cobalto") : css("--v5");
      const w = 200, h = 70;
      const x = (i) => 4 + (i * (w - 8)) / (ANOS.length - 1);
      const y = (val) => h - 12 - (val / maxG) * (h - 22);
      const d = v.map((val, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(val).toFixed(1)}`).join("");
      const g = s("svg", { viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": `${nomeArea(a)}: de ${base} mortes em 2022 para ${fim} em 2025` }, [
        s("path", { d: d + `L${x(ANOS.length - 1)} ${h - 12}L${x(0)} ${h - 12}Z`, class: "area-s", fill: cor }),
        s("path", { d, class: "linha", stroke: cor, pathLength: 1 }),
        s("circle", { cx: x(3), cy: y(v[3]), r: 2.5, fill: cor }),
        s("circle", { cx: x(6), cy: y(v[6]), r: 3.5, fill: cor }),
        s("text", { x: 2, y: h - 1, texto: "2019" }), s("text", { x: w - 2, y: h - 1, "text-anchor": "end", texto: "2025" }),
        s("text", { x: x(6), y: y(v[6]) - 7, "text-anchor": "end", texto: fim }),
      ]);
      box.append(el("div", { class: "s-mult" }, [
        el("h4", { texto: nomeArea(a) }),
        el("p", { class: "bairros", texto: resumoBairros(a, 2) }),
        el("p", { class: "var " + (varp <= 0 ? "queda" : "alta"), html: `${varp > 0 ? "+" : varp < 0 ? "−" : ""}${Math.abs(varp)}<small>${Math.abs(varp) === 1 ? "morte" : "mortes"}</small><span class="de-para">${base} em 2022 → ${fim} em 2025</span>` }),
        g,
      ]));
    }
    aoAparecer(box, () => box.classList.add("visivel"));
    $("tend-nota").textContent = `Cada cartão mostra as mortes violentas por ano numa área, de 2019 a 2025, e quantas mortes a mais ou a menos houve em 2025 do que em 2022. ${quedas} das 10 áreas terminaram 2025 abaixo de 2022. Em azul, queda; em vinho, alta.`;
  })();

  // ----------------------------------------------------------- 3. horário
  (function horas() {
    const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const box = $("calor"), fig = box.closest(".t-calor-fig");
    const tip = dica(fig, $("dica-calor"));
    function desenhar(ind) {
      const m = S["calor_" + ind];
      const rampa = ind === "cvli" ? VINHO : COBALTO;
      const todos = m.flat().slice().sort((a, b) => a - b);
      const q = (p) => todos[Math.floor(p * (todos.length - 1))];
      const cortes = [q(0.2), q(0.4), q(0.6), q(0.8), q(0.95)];
      const cor = (v) => rampa[cortes.filter((c) => v >= c).length];
      box.replaceChildren();
      let pico = { v: -1 };
      m.forEach((linha, d) => {
        box.append(el("span", { class: "dia", texto: DIAS[d] }));
        linha.forEach((v, h) => {
          const c = el("span", { class: "cel" });
          c.style.background = cor(v);
          c.style.transitionDelay = (REDUZIR ? 0 : (h + d * 2) * 12) + "ms";
          const html = `<b>${S.dias[d]}, ${h}h</b><span class="num">${nf0.format(v)}</span><small>${ind === "cvli" ? "mortes violentas" : "roubos"} de ${S.anos_media[0]} a ${S.anos_media[2]}</small>`;
          c.addEventListener("pointermove", (ev) => tip.mostrar(ev, html));
          c.addEventListener("pointerleave", () => tip.esconder());
          box.append(c);
          if (v > pico.v) pico = { v, d, h };
        });
      });
      box.append(el("span"));
      for (let h = 0; h < 24; h++) box.append(el("span", { class: "hora", texto: String(h) }));
      $("calor-leg").replaceChildren(el("span", { texto: "menos" }),
        ...rampa.map((c) => { const i = el("span"); i.style.cssText = `width:16px;height:12px;border-radius:2px;background:${c}`; return i; }),
        el("span", { texto: ind === "cvli" ? "mais mortes" : "mais roubos" }));
      const total = todos.reduce((a, b) => a + b, 0);
      const noite = m.reduce((a, l) => a + l.slice(18).reduce((x, y) => x + y, 0), 0);
      const fds = m[5].reduce((a, b) => a + b, 0) + m[6].reduce((a, b) => a + b, 0);
      $("horas-nota").textContent = ind === "cvli"
        ? `Mortes violentas de ${S.anos_media[0]} a ${S.anos_media[2]} por hora e dia da semana. ${pct(noite, total)}% aconteceram entre 18h e meia-noite, e ${pct(fds, total)}% no sábado ou no domingo. O horário com mais casos foi ${S.dias[pico.d].toLowerCase()} às ${pico.h}h.`
        : `Roubos de ${S.anos_media[0]} a ${S.anos_media[2]} por hora e dia da semana. O roubo acompanha o movimento da cidade: pesa no fim da tarde e no começo da noite dos dias úteis. O horário com mais registros foi ${S.dias[pico.d].toLowerCase()} às ${pico.h}h.`;
      requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("visivel")));
    }
    let primeira = true;
    segmentado("ctl-calor", (v) => { box.classList.remove("visivel"); desenhar(v); });
    aoAparecer(box, () => { if (primeira) { primeira = false; desenhar("cvli"); } });
    if (!box.children.length) { box.classList.remove("visivel"); }
  })();

  // ----------------------------------------------------------- 4. vítimas
  (function vitimas() {
    const P = S.perfil;
    const totG = Object.values(P.genero).reduce((a, b) => a + b, 0);
    const homens = Math.round(((P.genero.Masculino || 0) / totG) * 100);
    const picto = $("picto");
    picto.setAttribute("aria-label", `De cada 100 vítimas, ${homens} eram homens e ${100 - homens} mulheres`);
    for (let i = 0; i < 100; i++) {
      const cls = i < homens ? "h" : "m";
      const p = s("svg", { viewBox: "0 0 20 32", "aria-hidden": "true" }, [
        s("circle", { cx: 10, cy: 6, r: 5, class: cls }),
        s("path", { d: "M3 31V18a7 7 0 0 1 14 0v13z", class: cls }),
      ]);
      p.style.transitionDelay = (REDUZIR ? 0 : i * 12) + "ms";
      picto.append(p);
    }
    $("picto-leg").innerHTML = `<span><i style="background:var(--noite)"></i>${homens} homens</span><span><i style="background:var(--v4)"></i>${100 - homens} mulheres</span><span>de cada 100 vítimas</span>`;
    aoAparecer(picto, () => picto.classList.add("visivel"));

    function barras(alvo, dados, cinza = []) {
      const tot = Object.values(dados).reduce((a, b) => a + b, 0);
      const max = Math.max(...Object.values(dados));
      const box = $(alvo);
      for (const [k, v] of Object.entries(dados)) {
        const i = el("i");
        box.append(el("div", { class: "s-barra" + (cinza.includes(k) ? " cinza" : "") }, [
          el("span", { class: "rot", texto: k }), el("span", { class: "trilho" }, [i]), el("span", { class: "pct", texto: pct(v, tot) + "%" }),
        ]));
        aoAparecer(box, () => (i.style.width = (v / max) * 100 + "%"));
      }
    }
    barras("b-idade", P.idade, ["não informada"]);
    const meio = { "Arma de fogo": P.meio["Arma de fogo"] || 0, "Arma branca": P.meio["Arma branca"] || 0, "Outros meios": P.meio["Outros meios"] || 0 };
    barras("b-meio", meio, ["Outros meios"]);
    barras("b-escola", P.escolaridade, ["Não informada"]);
    const NAT = { "Homicidio doloso": "Homicídio", "Feminicídio": "Feminicídio", "Roubo seguido de morte (latrocinio)": "Latrocínio", "Lesao corporal seguida de morte": "Lesão seguida de morte" };
    barras("b-natureza", Object.fromEntries(Object.entries(P.natureza).map(([k, v]) => [NAT[k] || k, v])));
    const jovens = (P.idade["18 a 24"] || 0) + (P.idade["25 a 29"] || 0);
    const totI = Object.values(P.idade).reduce((a, b) => a + b, 0);
    $("vit-nota").textContent = `Vítimas de mortes violentas em Fortaleza de ${S.anos_media[0]} a ${S.anos_media[2]}. ${pct(jovens, totI)}% tinham de 18 a 29 anos, e ${pct(P.escolaridade["Até o fundamental"], Object.values(P.escolaridade).reduce((a, b) => a + b, 0))}% estudaram no máximo até o ensino fundamental. Na planilha da SSPDS, a raça não foi informada em ${P.raca_nao_informada_pct}% dos casos; por isso a cor da pele, logo abaixo, vem do SIM, do Ministério da Saúde.`;
    raca();
  })();

  function raca() {
    const R = S.raca;
    if (!R) return;
    $("raca").hidden = false;
    const [a0, , a2] = R.anos;
    const nn = 100 - R.vitimas_negras_pct, nnp = 100 - R.pop_negra_pct;
    const vezes = R.taxa_negros / R.taxa_nao_negros;
    $("raca-lede").textContent = `De ${a0} a ${a2}, ${nf1.format(R.vitimas_negras_pct)}% das ${nf0.format(R.n)} vítimas de homicídio em Fortaleza eram negras. Os negros são ${nf1.format(R.pop_negra_pct)}% de quem mora na cidade.`;
    $("raca-num").replaceChildren(...[
      [nf1.format(R.taxa_negros), "homicídios por 100 mil negros ao ano"],
      [nf1.format(R.taxa_nao_negros), "homicídios por 100 mil não negros ao ano"],
    ].map(([v, t]) => el("div", {}, [el("dt", { texto: t }), el("dd", { texto: v })])));
    const ign = Object.values(R.serie).filter((x) => !x.parcial).map((x) => x.ignorada_pct);
    $("raca-nota").textContent = `A conta dá ${nf0.format(vezes)} vezes, mas leia com cuidado: no SIM, quem preenche a declaração de óbito costuma atribuir a cor (no Ceará, quase sempre "parda"), enquanto no Censo cada pessoa declara a sua. Isso exagera a diferença. O certo é dizer que o risco é muitas vezes maior para negros. A cor fica sem registro em menos de ${nf1.format(Math.max(...ign) + 0.1)}% dos casos. Fontes: SIM/DATASUS, mortes por agressão ocorridas em Fortaleza (2025 ainda é preliminar: entram também as mortes por arma de fogo que esperam laudo para ter a intenção definida; somadas, dão quase o mesmo total da SSPDS); IBGE, Censo 2022.`;
    function barra(alvo, titulo, sub, neg) {
      const iN = el("i", { class: "neg", texto: nf1.format(neg) + "%" }), iB = el("i", { class: "nn", texto: nf1.format(100 - neg) + "%" });
      $(alvo).replaceChildren(el("div", { class: "rot" }, [el("b", { texto: titulo }), el("span", { texto: sub })]), el("div", { class: "trilho" }, [iN, iB]));
      aoAparecer($(alvo), () => { iN.style.width = neg + "%"; iB.style.width = 100 - neg + "%"; });
    }
    barra("raca-vitimas", "Vítimas de homicídio", `SIM, ${a0} a ${a2}`, R.vitimas_negras_pct);
    barra("raca-pop", "População de Fortaleza", "Censo 2022", R.pop_negra_pct);
    void nn; void nnp;
  }

  // ----------------------------------------------------------- 5. contexto (linguagem simples)
  (function contexto() {
    const F = {
      renda: { nome: "renda", menor: "menor renda", maior: "maior renda", fmt: (v) => "R$ " + nf0.format(v) + "/mês",
               ajuda: "renda média de quem sustenta a casa (Censo 2022)" },
      idh: { nome: "desenvolvimento", menor: "menor desenvolvimento (IDH)", maior: "maior desenvolvimento (IDH)", fmt: (v) => "IDH " + nf2.format(v),
             ajuda: "IDH junta renda, escolaridade e expectativa de vida; vai de 0 a 1 (Prefeitura, 2010)" },
      saneamento: { nome: "esgoto", menor: "menos casas com esgoto", maior: "mais casas com esgoto", fmt: (v) => nf0.format(v) + "% com esgoto",
                    ajuda: "parte das casas ligadas à rede de esgoto (Censo 2022)" },
      negros: { nome: "moradores negros", menor: "menos moradores negros", maior: "mais moradores negros", fmt: (v) => nf0.format(v) + "% negros",
                ajuda: "parte dos moradores que se declaram pretos ou pardos (Censo 2022)" },
    };
    const casos = (a) => (a.cvli_taxa * a.pop) / 1e5;
    const taxaGrupo = (g) => (g.reduce((x, a) => x + casos(a), 0) / g.reduce((x, a) => x + a.pop, 0)) * 1e5;
    const escada = $("escada");
    function desenhar(f) {
      const ord = [...A].filter((a) => a[f] != null).sort((x, y) => x[f] - y[f]);
      const metade = Math.floor(ord.length / 2);
      const baixo = ord.slice(0, metade), alto = ord.slice(metade);
      const tb = taxaGrupo(baixo), ta = taxaGrupo(alto);
      const maiorNoBaixo = tb >= ta;
      const razao = maiorNoBaixo ? tb / ta : ta / tb;
      const lista = (g) => g.map((a) => a.regiao).join(" · ");
      $("comparacao").replaceChildren(
        el("div", { class: "s-comp-card baixo" }, [
          el("span", { class: "quem", texto: `As ${baixo.length} áreas com ${F[f].menor}` }),
          el("span", { class: "valor", texto: nf0.format(tb) }),
          el("span", { class: "unid", texto: "mortes violentas por 100 mil moradores, por ano" }),
          el("span", { class: "lista", texto: lista(baixo) }),
        ]),
        el("div", { class: "s-comp-meio" }, [
          el("span", { class: "x", texto: nf1.format(razao) + "×" }),
          el("small", { texto: `mais mortes onde há ${maiorNoBaixo ? F[f].menor : F[f].maior}` }),
        ]),
        el("div", { class: "s-comp-card alto" }, [
          el("span", { class: "quem", texto: `As ${alto.length} áreas com ${F[f].maior}` }),
          el("span", { class: "valor", texto: nf0.format(ta) }),
          el("span", { class: "unid", texto: "mortes violentas por 100 mil moradores, por ano" }),
          el("span", { class: "lista", texto: lista(alto) }),
        ]),
      );
      const fraseFator = {
        renda: maiorNoBaixo ? "Onde a renda é menor, morre-se mais" : "Onde a renda é maior, morre-se mais",
        idh: maiorNoBaixo ? "Onde o desenvolvimento é menor, morre-se mais" : "Onde o desenvolvimento é maior, morre-se mais",
        saneamento: maiorNoBaixo ? "Onde falta esgoto, morre-se mais" : "Onde há mais esgoto, morre-se mais",
        negros: maiorNoBaixo ? "Onde há menos moradores negros, morre-se mais" : "Onde há mais moradores negros, morre-se mais",
      }[f];
      $("comp-frase").innerHTML = `${fraseFator}: <b>${nf0.format(Math.max(tb, ta))}</b> contra <b>${nf0.format(Math.min(tb, ta))}</b> mortes violentas por 100 mil moradores por ano, ${nf1.format(razao)} vez${razao >= 2 ? "es" : ""} mais.`;
      $("escada-titulo").textContent = `As 10 áreas, da que tem ${F[f].menor} para a que tem ${F[f].maior}`;
      const max = Math.max(...A.map((a) => a.cvli_taxa));
      escada.replaceChildren();
      ord.forEach((a, k) => {
        const i = el("i");
        const li = el("li", { class: a.cvli_taxa > C.cvli_taxa ? "alta" : "" }, [
          el("span", { class: "reg", html: `<b>${a.regiao}</b><small>AIS ${a.num} · ${a.bairros.length} bairros</small>` }),
          el("span", { class: "fat", texto: F[f].fmt(a[f]) }),
          el("span", { class: "bar" }, [el("span", { class: "t" }, [i, el("em", { style: `left:${(C.cvli_taxa / max) * 100}%`, title: "média da cidade" })]), el("b", { texto: nf0.format(a.cvli_taxa) })]),
        ]);
        if (k === 0) escada.append(el("li", { class: "sep", texto: `As ${baixo.length} áreas com ${F[f].menor}` }));
        if (k === metade) escada.append(el("li", { class: "sep", texto: `As ${alto.length} áreas com ${F[f].maior}` }));
        escada.append(li);
        requestAnimationFrame(() => requestAnimationFrame(() => (i.style.width = (a.cvli_taxa / max) * 100 + "%")));
      });
      // a área que mais foge do padrão, dita em português
      const fogeAlta = (maiorNoBaixo ? alto : baixo).sort((x, y) => y.cvli_taxa - x.cvli_taxa)[0];
      $("junto-nota").textContent = `Como ler: ${F[f].ajuda}. A linha preta em cada barra é a média da cidade (${nf0.format(C.cvli_taxa)}). Nem toda área segue o padrão: ${fogeAlta.regiao} está no grupo de ${maiorNoBaixo ? F[f].maior : F[f].menor} e ainda assim tem ${nf0.format(fogeAlta.cvli_taxa)} mortes por 100 mil. Aparecer junto não prova que uma coisa causa a outra: mostra onde os problemas se acumulam.`;
    }
    segmentado("ctl-fator", desenhar);
    desenhar("renda");
  })();
})();
