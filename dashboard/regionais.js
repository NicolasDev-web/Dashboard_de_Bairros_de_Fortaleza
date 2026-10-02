/* Bairros de Fortaleza — seção "Preços": o m² por regional.
   Regionais em data.js (scripts/06 e 08); preços em precos.js (window.PRECOS, scripts/09_precos_priceradar.py),
   coletados com o PriceRadar. Sem precos.js a seção mostra só as regionais e como gerar os preços. */
(() => {
  "use strict";

  const D = window.DADOS;
  const P = window.PRECOS || null;
  const REDUZIR = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const RAMPA = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6"].map(css);
  const COR = { escuro: css("--cobalto-escuro"), neutro: css("--neutro"), branco: "#ffffff" };

  const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const reais = (v) => "R$ " + nf0.format(v);
  const milhares = (v) => (v >= 1e6 ? "R$ " + nf1.format(v / 1e6) + " mi" : "R$ " + nf0.format(Math.round(v / 1e3)) + " mil");
  const el = (tag, attrs = {}, filhos = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "texto") n.textContent = v;
      else n.setAttribute(k, v);
    }
    for (const f of [].concat(filhos)) if (f != null) n.append(f);
    return n;
  };

  const BAIRROS = D.geojson.features.map((f) => f.properties);
  const REGS = D.regionais.features.map((f) => f.properties).sort((a, b) => a.regional - b.regional);
  const DA_REG = new Map(REGS.map((r) => [r.regional, BAIRROS.filter((b) => b.regional === r.regional)]));
  const MEDIDA = { mediana: "mediana", media: "média" };

  const estado = { medida: "mediana", quartos: "todos", sel: null, foco: null };

  const dado = (r) => (P && P.regionais[r] && P.regionais[r][estado.quartos]) || null;
  const dadoBairro = (id) => (P && P.bairros[id] && P.bairros[id][estado.quartos]) || null;
  const val = (x) => x[estado.medida];

  // 6 classes de intervalos iguais entre a regional mais barata e a mais cara (a mesma rampa do mapa principal)
  let DOM = [0, 1];
  function dominio() {
    const v = REGS.map((r) => dado(r.regional)).filter(Boolean).map(val);
    DOM = v.length ? [Math.min(...v), Math.max(...v)] : [0, 1];
  }
  const cor = (v) => RAMPA[Math.max(0, Math.min(5, Math.floor(((v - DOM[0]) / (DOM[1] - DOM[0] || 1)) * 6)))];

  function ordem() {
    return [...REGS].sort((a, b) => {
      const x = dado(a.regional), y = dado(b.regional);
      if (!x || !y) return (y ? 1 : 0) - (x ? 1 : 0) || a.regional - b.regional;
      return val(y) - val(x);
    });
  }

  // =====================================================================
  // MAPA DAS REGIONAIS
  // =====================================================================
  const mapaEl = document.getElementById("mapa-precos");
  const mapa = L.map(mapaEl, { zoomSnap: 0.25, minZoom: 10.5, maxZoom: 15, scrollWheelZoom: false, attributionControl: false });
  mapaEl.addEventListener("click", () => mapa.scrollWheelZoom.enable(), { once: true });

  function estilo(f) {
    const r = f.properties.regional, x = dado(r);
    const ativo = estado.sel === r || estado.foco === r;
    return {
      fillColor: x ? cor(val(x)) : COR.neutro,
      fillOpacity: x && x.pouco_confiavel ? 0.45 : 0.92,
      color: ativo ? COR.escuro : COR.branco,
      weight: ativo ? 3 : 1.4,
      dashArray: x && x.pouco_confiavel && !ativo ? "4 3" : null,
    };
  }

  const camada = L.geoJSON(D.regionais, {
    style: estilo,
    onEachFeature(f, layer) {
      const r = f.properties.regional;
      layer.bindTooltip(() => {
        const x = dado(r);
        const v = x ? `${reais(val(x))}/m²` : "sem anúncios";
        return `<b>Regional ${r}</b><span>${v}</span>`;
      }, { sticky: true, direction: "top", offset: [0, -8], className: "dica-mapa" });
      layer.on({
        mouseover: () => focar(r),
        mouseout: () => focar(null),
        click: () => selecionar(r, false),
      });
    },
  }).addTo(mapa);
  mapa.fitBounds(camada.getBounds(), { padding: [12, 12] });

  const numeros = new Map(D.regionais.features.map((f) => {
    const r = f.properties.regional;
    const m = L.marker(f.properties.rotulo, {
      keyboard: false,
      icon: L.divIcon({ className: "reg-num", html: String(r), iconSize: [24, 24] }),
    }).on({ click: () => selecionar(r, false), mouseover: () => focar(r), mouseout: () => focar(null) }).addTo(mapa);
    return [r, m];
  }));

  function pintar() {
    camada.setStyle(estilo);
    camada.getLayers().forEach((l) => { if (l.feature.properties.regional === (estado.foco ?? estado.sel)) l.bringToFront(); });
    numeros.forEach((m, r) => m.getElement()?.classList.toggle("ativa", r === estado.sel));
  }

  function legenda() {
    const box = document.getElementById("legenda-precos");
    if (!P) {
      box.replaceChildren(el("p", { class: "legenda-titulo", texto: "12 regionais da prefeitura" }),
        el("p", { class: "legenda-sem", texto: "Preços ainda não coletados" }));
      return;
    }
    const q = estado.quartos === "todos" ? "" : `, ${estado.quartos} quarto${estado.quartos === "1" ? "" : "s"}`;
    const faltam = REGS.some((r) => !dado(r.regional));
    box.replaceChildren(...[
      el("p", { class: "legenda-titulo", texto: `Preço do m², ${MEDIDA[estado.medida]}${q}` }),
      el("div", { class: "legenda-escala", "aria-hidden": "true" }, RAMPA.map((c) => el("span", { style: `background:${c}` }))),
      el("div", { class: "legenda-rotulos" }, [el("span", { texto: reais(DOM[0]) }), el("span", { texto: reais(DOM[1]) })]),
      faltam ? el("p", { class: "legenda-sem" }, [el("i", { "aria-hidden": "true" }), "sem anúncios"]) : null,
    ].filter(Boolean));
  }

  // =====================================================================
  // LISTA DAS REGIONAIS
  // =====================================================================
  const listaEl = document.getElementById("regionais-lista");

  function lista() {
    if (!P) return vazio();
    const regs = ordem();
    const comDado = regs.map((r) => dado(r.regional)).filter(Boolean);
    // régua comum para as faixas: da menor ponta de baixo à maior ponta de cima
    const lo = Math.min(...comDado.map((x) => x.p25)), hi = Math.max(...comDado.map((x) => x.p75));
    const pct = (v) => ((v - lo) / (hi - lo || 1)) * 100;
    let pos = 0;
    listaEl.replaceChildren(...regs.map((r) => {
      const x = dado(r.regional), bs = DA_REG.get(r.regional);
      const nomes = [...bs].sort((a, b) => b.pop_2022 - a.pop_2022).slice(0, 3).map((b) => b.nome).join(", ");
      const filhos = [
        el("span", { class: "rk-pos", texto: x ? String(++pos) : "–" }),
        el("span", { class: "rota-nome" }, [el("span", { class: "rk-nome", texto: `Regional ${r.regional}` }), el("small", { texto: nomes })]),
      ];
      if (x) {
        filhos.push(
          el("span", { class: "faixa", title: `Metade dos anúncios entre ${reais(x.p25)} e ${reais(x.p75)} por m²` }, [
            el("i", { class: "faixa-iqr", style: `left:${pct(x.p25)}%;width:${Math.max(1, pct(x.p75) - pct(x.p25))}%` }),
            el("b", { class: "faixa-valor", style: `left:${Math.max(0, Math.min(100, pct(val(x))))}%` }),
          ]),
          el("span", { class: "reg-valor" }, [
            el("span", { texto: reais(val(x)) }),
            el("small", { texto: `${nf0.format(x.n)} anúncio${x.n === 1 ? "" : "s"}${x.pouco_confiavel ? " · poucos" : ""}` }),
          ]),
        );
      } else {
        filhos.push(el("span", { class: "faixa faixa-vazia", "aria-hidden": "true" }), el("span", { class: "reg-valor" }, el("small", { texto: "sem anúncios" })));
      }
      const b = el("button", { type: "button", "data-r": String(r.regional), "aria-current": String(estado.sel === r.regional) }, filhos);
      b.addEventListener("click", () => selecionar(r.regional, true));
      b.addEventListener("mouseenter", () => focar(r.regional));
      b.addEventListener("mouseleave", () => focar(null));
      return el("li", {}, b);
    }));
    const c = P.cidade_resumo;
    document.getElementById("regionais-pe").textContent =
      `Cidade inteira: ${reais(c.mediana)}/m² de mediana e ${reais(c.media)}/m² de média. ` +
      "A barra mostra onde fica a metade do meio dos anúncios; o traço é o valor da regional.";
  }

  function vazio() {
    document.getElementById("regionais").classList.add("sem-dados");
    document.querySelector("#regionais h3").textContent = "As 12 regionais";
    listaEl.replaceChildren(...REGS.map((r) => {
      const nomes = [...DA_REG.get(r.regional)].sort((a, b) => b.pop_2022 - a.pop_2022).slice(0, 3).map((b) => b.nome).join(", ");
      const b = el("button", { type: "button", "data-r": String(r.regional), "aria-current": String(estado.sel === r.regional) }, [
        el("span", { class: "rk-pos", texto: String(r.regional) }),
        el("span", { class: "rota-nome" }, [el("span", { class: "rk-nome", texto: `Regional ${r.regional}` }), el("small", { texto: nomes })]),
        el("span", { class: "reg-valor" }, el("small", { texto: `${r.n_bairros} bairros` })),
      ]);
      b.addEventListener("click", () => selecionar(r.regional, true));
      b.addEventListener("mouseenter", () => focar(r.regional));
      b.addEventListener("mouseleave", () => focar(null));
      return el("li", {}, b);
    }));
    const pe = document.getElementById("regionais-pe");
    pe.replaceChildren(
      el("b", { texto: "Os preços ainda não foram coletados. " }),
      "Com o PriceRadar clonado ao lado deste repositório, rode ",
      el("code", { texto: "python scripts/09_precos_priceradar.py" }),
      " (coleta nova) ou ",
      el("code", { texto: "--fonte historico" }),
      " (usa as buscas já feitas no app). O script gera dashboard/precos.js e esta seção se preenche sozinha.",
    );
  }

  // =====================================================================
  // DETALHE DA REGIONAL
  // =====================================================================
  function detalhe() {
    const box = document.getElementById("regional-detalhe");
    const r = REGS.find((x) => x.regional === estado.sel);
    if (!r) { box.replaceChildren(); return; }
    const x = dado(r.regional);
    const bs = DA_REG.get(r.regional);

    const cabeca = el("div", { class: "detalhe-cabeca" }, [
      el("h3", { texto: `Regional ${r.regional}` }),
      el("p", { texto: `${r.n_bairros} bairros · ${nf0.format(r.pop_2022)} moradores · ${nf1.format(r.area_km2)} km²` }),
    ]);

    const kpis = x ? el("dl", { class: "detalhe-numeros" }, [
      [reais(val(x)), `por m², ${MEDIDA[estado.medida]}` + (estado.medida === "mediana" ? ` (média ${reais(x.media)})` : ` (mediana ${reais(x.mediana)})`)],
      [`${reais(x.p25)} a ${reais(x.p75)}`, "por m², a metade do meio dos anúncios"],
      [milhares(x.preco_mediano), `preço mediano do imóvel, ${nf0.format(x.area_mediana)} m² de área mediana`],
      [nf0.format(x.n), x.pouco_confiavel ? "anúncios: amostra pequena, leia com cuidado" : "anúncios usados"],
    ].map(([v, t]) => el("div", {}, [el("dt", { texto: t }), el("dd", { texto: v })]))) : null;

    // quartos: sempre as quatro classes, para comparar tipologias na mesma regional
    const porQ = P && P.regionais[r.regional] ? el("div", { class: "detalhe-quartos" }, [
      el("h4", { texto: `Por número de quartos (${MEDIDA[estado.medida]} do m²)` }),
      el("ul", {}, ["1", "2", "3", "4+"].map((q) => {
        const y = P.regionais[r.regional][q];
        return el("li", { class: q === estado.quartos ? "atual" : "" }, [
          el("span", { texto: `${q} quarto${q === "1" ? "" : "s"}` }),
          el("b", { texto: y ? reais(y[estado.medida]) : "–" }),
          el("small", { texto: y ? `${nf0.format(y.n)} anúncio${y.n === 1 ? "" : "s"}` : "sem anúncios" }),
        ]);
      })),
    ]) : null;

    // bairros da regional: com preço, do mais caro ao mais barato; os sem anúncio numa linha no fim
    const comPreco = bs.filter((b) => dadoBairro(b.id)).sort((a, b) => val(dadoBairro(b.id)) - val(dadoBairro(a.id)));
    const semPreco = bs.filter((b) => !dadoBairro(b.id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const max = Math.max(1, ...comPreco.map((b) => val(dadoBairro(b.id))));
    const botaoBairro = (b, filhos) => {
      const bt = el("button", { type: "button", title: `Ver ${b.nome} no mapa dos bairros` }, filhos);
      bt.addEventListener("click", () => document.dispatchEvent(new CustomEvent("selecionar-bairro", { detail: b.id })));
      return bt;
    };
    const listaBairros = el("div", { class: "detalhe-bairros" }, [
      el("h4", { texto: P ? "Bairros da regional" : "Bairros da regional (clique para ver no mapa)" }),
      comPreco.length ? el("ol", {}, comPreco.map((b) => {
        const y = dadoBairro(b.id);
        return el("li", { class: y.pouco_confiavel ? "pouco" : "" }, botaoBairro(b, [
          el("span", { class: "rk-nome", texto: b.nome }),
          el("span", { class: "rk-barra", "aria-hidden": "true" }, el("i", { style: `width:${(val(y) / max) * 100}%` })),
          el("span", { class: "rk-valor", texto: reais(val(y)) }),
          el("small", { texto: `${nf0.format(y.n)}${y.pouco_confiavel ? " · poucos" : ""}` }),
        ]));
      })) : null,
      semPreco.length ? el("p", { class: "detalhe-sem" }, [
        el("span", { texto: P ? "Sem anúncios suficientes: " : "" }),
        ...semPreco.flatMap((b, i) => [i ? ", " : "", botaoBairro(b, b.nome)]),
      ]) : null,
    ]);

    box.replaceChildren(cabeca, kpis || porQ
      ? el("div", { class: "detalhe-grade" }, [el("div", {}, [kpis, porQ]), listaBairros])
      : listaBairros);
    box.classList.remove("entrando"); void box.offsetWidth; box.classList.add("entrando");
  }

  // =====================================================================
  // ESTADO
  // =====================================================================
  function focar(r) {
    estado.foco = r;
    pintar();
    listaEl.querySelectorAll("button").forEach((b) => b.classList.toggle("foco", +b.dataset.r === r));
  }

  function selecionar(r, centralizar) {
    estado.sel = r;
    pintar();
    listaEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", String(+b.dataset.r === r)));
    detalhe();
    const l = camada.getLayers().find((x) => x.feature.properties.regional === r);
    if (centralizar && l) mapa.flyToBounds(l.getBounds(), { padding: [40, 40], maxZoom: 13, duration: REDUZIR ? 0 : 0.8 });
  }

  function atualizar() {
    dominio();
    pintar();
    legenda();
    lista();
    detalhe();
  }

  function segmentado(id, aoMudar) {
    const g = document.getElementById(id);
    g.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      aoMudar(b.dataset.v);
    });
    if (!P) g.querySelectorAll("button").forEach((b) => { b.disabled = true; });
  }
  segmentado("ctl-medida", (v) => { estado.medida = v; atualizar(); });
  segmentado("ctl-quartos", (v) => { estado.quartos = v; atualizar(); });

  if (P) {
    const portais = Object.keys(P.portais).length;
    const periodo = P.coleta_inicio === P.coleta_fim ? `em ${data(P.coleta_fim)}` : `entre ${data(P.coleta_inicio)} e ${data(P.coleta_fim)}`;
    document.getElementById("precos-nota").textContent =
      `${nf0.format(P.total)} anúncios de venda de apartamentos em ${portais} portais, coletados pelo PriceRadar ${periodo}. ` +
      "A mediana não se move com anúncio fora da curva; a média é a conta simples.";
  }
  function data(iso) {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  }

  estado.sel = P ? (ordem().find((r) => dado(r.regional)) || REGS[0]).regional : null;
  atualizar();
})();
