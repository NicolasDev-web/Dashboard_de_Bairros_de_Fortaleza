/* Bairros de Fortaleza — dashboard. Dados em data.js (window.DADOS), gerados por scripts/06_dados_dashboard.py */
(() => {
  "use strict";

  const D = window.DADOS;
  const R = window.ROTAS || null; // rotas.js (scripts/07_rotas_strava.py); opcional
  const P = window.PRECOS || null; // precos.js (scripts/09_precos_priceradar.py); opcional
  const Q = window.PRACAS || null; // pracas.js (scripts/11_pracas.py); opcional
  const E = window.EQUIP || null; // equipamentos.js (scripts/10_equipamentos_osm.py); opcional
  const T = window.TRANSPORTE || null; // transporte.js (scripts/12_transporte.py); opcional
  const LN = window.Linhas || null; // linhas.js + linhas-camada.js (scripts/13_linhas_bairros.py); opcional
  const FEATS = D.geojson.features;
  const BAIRROS = FEATS.map((f) => f.properties);
  const POR_ID = new Map(BAIRROS.map((p) => [p.id, p]));
  const REDUZIR = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const RAMPA = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6"].map(css);
  const COR = { cobalto: css("--cobalto"), escuro: css("--cobalto-escuro"), perda: css("--perda"), neutro: css("--neutro"), branco: "#ffffff" };

  const estado = {
    ind: "indice",
    ano: "2022",
    pesos: { renda: 5, saneamento: 5, seguranca: 5 },
    sel: null,
    desc: true,
    busca: "",
    evo: "var_indice_socio",
    rota: "nenhuma",
    rotaSel: null,
  };

  // ---------- formatação ----------
  const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const reais = (v) => "R$ " + nf0.format(v);
  const sinal = (v, f) => {
    const t = f(Math.abs(v));
    return (/^0([,.]0+)?$/.test(t) ? "" : v > 0 ? "+" : v < 0 ? "−" : "") + t;
  };
  const el = (tag, attrs = {}, filhos = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "texto") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    for (const f of [].concat(filhos)) if (f != null) n.append(f);
    return n;
  };

  // ---------- índice com pesos ----------
  function indice(p) {
    const w = estado.pesos;
    const soma = w.renda + w.saneamento + w.seguranca;
    if (!soma) return (p.score_renda_2022 + p.score_saneamento_2022 + p.score_seguranca) / 3;
    return (w.renda * p.score_renda_2022 + w.saneamento * p.score_saneamento_2022 + w.seguranca * p.score_seguranca) / soma;
  }

  // ---------- indicadores ----------
  // nota: 0–100, maior = melhor (ou variação, no caso da evolução). texto: valor na unidade original.
  const IND = {
    indice: {
      nome: "Índice", anual: false,
      nota: (p) => indice(p),
      texto: (p) => nf0.format(indice(p)),
      legenda: "Índice (0 a 100)",
    },
    renda: {
      nome: "Renda", anual: true,
      nota: (p, a) => p["score_renda_" + a],
      texto: (p, a) => reais(p["renda_real_" + a]),
      legenda: (a) => `Renda média do responsável, ${a} (R$ de 2022)`,
    },
    saneamento: {
      nome: "Saneamento", anual: true,
      nota: (p, a) => p["saneamento_" + a],
      texto: (p, a) => nf0.format(p["saneamento_" + a]) + "%",
      legenda: (a) => `Domicílios com esgoto em rede, ${a}`,
    },
    seguranca: {
      nome: "Segurança", anual: false,
      nota: (p) => p.score_seguranca,
      texto: (p) => nf1.format(p.cvli_pond) + " mortes",
      legenda: "Segurança da AIS (mortes violentas por 100 mil, 2019–2025)",
    },
    evolucao: {
      nome: "Evolução", anual: false, divergente: true,
      nota: (p) => p.var_indice_socio,
      texto: (p) => sinal(p.var_indice_socio, nf1.format) + " pts",
      legenda: "Mudança em renda e saneamento, 2010 → 2022 (pontos)",
    },
  };
  const ind = () => IND[estado.ind];
  const nota = (p) => ind().nota(p, estado.ano);

  // cores: 6 classes de intervalos iguais entre o menor e o maior valor do indicador.
  // Em renda e saneamento o intervalo cobre 2010 e 2022 juntos, para os dois anos usarem a mesma régua.
  // Evolução usa escala divergente (laranja = perda, cinza = estável, azul = ganho).
  const CORTES_EVO = [-2, 2, 10, 20];
  const CORES_EVO = () => [COR.perda, COR.neutro, RAMPA[1], RAMPA[3], RAMPA[5]];
  function dominio() {
    const i = ind();
    const vals = i.anual ? BAIRROS.flatMap((p) => [i.nota(p, "2010"), i.nota(p, "2022")]) : BAIRROS.map((p) => i.nota(p));
    return [Math.min(...vals), Math.max(...vals)];
  }
  let DOM = [0, 100];
  function cor(v) {
    if (ind().divergente) {
      const i = CORTES_EVO.findIndex((c) => v < c);
      return CORES_EVO()[i === -1 ? CORTES_EVO.length : i];
    }
    const t = (v - DOM[0]) / (DOM[1] - DOM[0] || 1);
    return RAMPA[Math.max(0, Math.min(5, Math.floor(t * 6)))];
  }

  // inverso da nota de renda (log min-max) para rotular a legenda em reais
  const [LMIN, LMAX] = D.meta.renda_log_min_max;
  const rendaDaNota = (s) => Math.exp(LMIN + (s / 100) * (LMAX - LMIN));

  // =====================================================================
  // MAPA
  // =====================================================================
  const mapaEl = document.getElementById("mapa-leaflet");
  const mapa = L.map(mapaEl, { zoomSnap: 0.25, minZoom: 10.5, maxZoom: 16, scrollWheelZoom: false });
  mapaEl.addEventListener("click", () => mapa.scrollWheelZoom.enable(), { once: true });

  // Strava Global Heatmap: tiles públicos até z12; acima disso o Leaflet amplia o z12.
  const strava = L.tileLayer("https://heatmap-external-{s}.strava.com/tiles/all/blue/{z}/{x}/{y}.png?px=256", {
    subdomains: "abc", maxNativeZoom: 12, maxZoom: 16, opacity: 0.95,
    attribution: '<a href="https://www.strava.com/maps/global-heatmap">Strava Global Heatmap</a>',
  });

  function estilo(f) {
    const p = f.properties;
    const sel = estado.sel === p.id;
    const comStrava = mapa.hasLayer(strava);
    return {
      className: "bairro-forma",
      fillColor: cor(nota(p)),
      fillOpacity: comStrava ? 0.22 : 0.9,
      color: sel ? (comStrava ? COR.branco : COR.escuro) : COR.branco,
      weight: sel ? 3 : 0.8,
      opacity: comStrava && !sel ? 0.45 : 1,
    };
  }

  const camada = L.geoJSON(D.geojson, {
    style: estilo,
    onEachFeature(f, layer) {
      layer.bindTooltip(() => `<b>${f.properties.nome}</b><span>${ind().texto(f.properties, estado.ano)}</span>`, {
        sticky: true, direction: "top", offset: [0, -8], className: "dica-mapa",
      });
      layer.on({
        // sem bringToFront() aqui: reordenar o DOM no meio do clique faz o navegador cancelar o "click"
        mouseover: () => { if (estado.sel !== f.properties.id) layer.setStyle({ weight: 2.2, color: COR.escuro }); },
        mouseout: () => camada.resetStyle(layer),
        click: () => selecionar(f.properties.id, { centralizar: false }),
      });
    },
  }).addTo(mapa);
  mapa.fitBounds(camada.getBounds(), { padding: [12, 12] });
  const camadaSel = () => camada.getLayers().find((l) => l.feature.properties.id === estado.sel);

  function pintar() {
    DOM = dominio();
    camada.setStyle(estilo);
    camadaSel()?.bringToFront();
  }

  document.getElementById("ctl-strava").addEventListener("change", (e) => {
    if (e.target.checked) strava.addTo(mapa); else mapa.removeLayer(strava);
    mapaEl.classList.toggle("com-strava", e.target.checked);
    const aviso = document.getElementById("mapa-aviso");
    aviso.hidden = !e.target.checked;
    aviso.textContent = "Linhas claras: ruas onde mais gente corre e pedala no Strava. Detalhe máximo no zoom da cidade inteira.";
    pintar();
    contarCamadas();
  });

  // ---------- praças (URBIFOR, 2019): camada de contexto, fora do índice ----------
  const pracas = Q && window.CamadaPracas ? window.CamadaPracas(mapa, Q, { nomeBairro: (id) => POR_ID.get(id)?.nome || "" }) : null;
  if (pracas) {
    document.getElementById("ctl-pracas").addEventListener("change", (e) => { pracas.ligar(e.target.checked); legenda(); contarCamadas(); });
    document.getElementById("pracas-sub").textContent = `${Q.cidade.n} espaços · URBIFOR, ${Q.ano}`;
  } else {
    document.getElementById("chave-pracas").hidden = true;
  }
  // ---------- hospitais (OpenStreetMap) ----------
  const hospitais = E && E.hospitais && window.CamadaHospitais ? window.CamadaHospitais(mapa, E.hospitais) : null;
  if (hospitais) {
    document.getElementById("ctl-hospitais").addEventListener("change", (e) => { hospitais.ligar(e.target.checked); legenda(); contarCamadas(); });
    document.getElementById("hospitais-sub").textContent = `${hospitais.total} · OpenStreetMap`;
  } else {
    document.getElementById("chave-hospitais").hidden = true;
  }

  // ---------- linhas de ônibus e metrô, com as paradas no zoom (rede atual, scripts/13_linhas_bairros.py) ----------
  const rede = LN ? LN.CamadaLinhas(mapa, { aoMudar: () => legenda() }) : null;
  if (rede) {
    document.getElementById("ctl-linhas").addEventListener("change", async (e) => { await rede.ligar(e.target.checked); legenda(); contarCamadas(); });
    document.getElementById("linhas-sub").textContent = `${nf0.format(rede.total)} linhas · ${nf0.format(rede.totalParadas)} paradas ao aproximar`;
  } else {
    document.getElementById("chave-linhas").hidden = true;
  }
  // linhas do bairro selecionado, desenhadas a pedido da ficha
  mapa.createPane("linhasBairro").style.zIndex = 440;
  const camadaLinhas = L.layerGroup().addTo(mapa);
  let linhasDe = null; // bairro cujas linhas estão no mapa

  // ---------- painel "Camadas": fechado por padrão, abre sobre o mapa ----------
  const camadasBt = document.getElementById("camadas-botao");
  const camadasPainel = document.getElementById("camadas-painel");
  function abrirCamadas(abrir) {
    camadasPainel.hidden = !abrir;
    camadasBt.setAttribute("aria-expanded", String(abrir));
    if (abrir && !REDUZIR) camadasPainel.animate(
      [{ opacity: 0, transform: "translateY(-6px) scale(.98)" }, { opacity: 1, transform: "none" }],
      { duration: 240, easing: "cubic-bezier(.2,.7,.1,1)" });
  }
  camadasBt.addEventListener("click", () => abrirCamadas(camadasPainel.hidden));
  document.addEventListener("click", (e) => { if (!camadasPainel.hidden && !e.target.closest("#camadas-mapa")) abrirCamadas(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !camadasPainel.hidden) { abrirCamadas(false); camadasBt.focus(); } });
  L.DomEvent.disableClickPropagation(document.getElementById("camadas-mapa"));
  L.DomEvent.disableScrollPropagation(document.getElementById("camadas-mapa"));
  // quantas camadas estão ligadas aparece no botão, para não esquecer nada aceso com o painel fechado
  function contarCamadas() {
    const n = ["ctl-linhas", "ctl-pracas", "ctl-hospitais", "ctl-strava"].filter((id) => document.getElementById(id).checked).length
      + (estado.rota !== "nenhuma" ? 1 : 0);
    const c = document.getElementById("camadas-conta");
    c.hidden = !n; c.textContent = String(n);
    camadasBt.classList.toggle("ativo", n > 0);
  }

  // =====================================================================
  // ROTAS MAIS FEITAS (estimadas do heatmap do Strava)
  // =====================================================================
  const NOME_ATIV = { run: "corrida", ride: "pedal" };
  mapa.createPane("rotas").style.zIndex = 450; // acima dos bairros, abaixo das dicas
  const grupoRotas = L.layerGroup().addTo(mapa);
  let linhasRota = [];

  function pontoMeio(f) {
    // ponto no meio da parte mais longa da rota, para o número
    const partes = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const maior = partes.reduce((a, b) => (b.length > a.length ? b : a));
    const [lo, la] = maior[Math.floor(maior.length / 2)];
    return [la, lo];
  }

  function estiloRota(ativo, nada) {
    return {
      halo: { color: COR.escuro, weight: ativo ? 9 : 7, opacity: nada || ativo ? 0.55 : 0.15, lineCap: "round", lineJoin: "round" },
      traco: { color: COR.branco, weight: ativo ? 4.5 : 3, opacity: nada || ativo ? 1 : 0.35, lineCap: "round", lineJoin: "round" },
    };
  }

  function desenharRotas() {
    grupoRotas.clearLayers();
    linhasRota = [];
    const box = document.getElementById("rotas");
    if (!R || estado.rota === "nenhuma") { box.hidden = true; return; }
    for (const f of R[estado.rota].top.features) {
      const pos = f.properties.posicao, est = estiloRota(false, true);
      const halo = L.geoJSON(f, { pane: "rotas", interactive: false, style: est.halo });
      const traco = L.geoJSON(f, { pane: "rotas", style: { ...est.traco, className: "rota-linha" } });
      traco.bindTooltip(`<b>${pos}. ${f.properties.nome}</b><span>${nf1.format(f.properties.comp_km)} km</span>`,
        { sticky: true, direction: "top", offset: [0, -8], className: "dica-mapa" });
      traco.on({
        mouseover: () => realcarRota(pos),
        mouseout: () => realcarRota(estado.rotaSel),
        click: (e) => { L.DomEvent.stopPropagation(e); escolherRota(pos, false); },
      });
      const num = L.marker(pontoMeio(f), {
        pane: "rotas", keyboard: false,
        icon: L.divIcon({ className: "rota-num", html: String(pos), iconSize: [22, 22] }),
      }).on("click", () => escolherRota(pos, false));
      grupoRotas.addLayer(halo).addLayer(traco).addLayer(num);
      linhasRota.push({ pos, halo, traco, num });
    }
    if (!REDUZIR) animarTraco();
    listaRotas();
  }

  function animarTraco() {
    // desenha cada rota do início ao fim; depois limpa o tracejado (o Leaflet redesenha no zoom)
    requestAnimationFrame(() => {
      document.querySelectorAll(".leaflet-rotas-pane path.rota-linha").forEach((p, i) => {
        const n = p.getTotalLength();
        p.style.strokeDasharray = n;
        p.style.strokeDashoffset = n;
        p.getBoundingClientRect();
        p.style.transition = `stroke-dashoffset 1100ms cubic-bezier(.2,.7,.1,1) ${i * 70}ms`;
        p.style.strokeDashoffset = 0;
        p.addEventListener("transitionend", () => { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; p.style.transition = ""; }, { once: true });
      });
    });
  }

  function realcarRota(pos) {
    const nada = pos == null;
    for (const l of linhasRota) {
      const ativo = l.pos === pos, est = estiloRota(ativo, nada);
      l.halo.setStyle(est.halo);
      l.traco.setStyle(est.traco);
      l.num.getElement()?.classList.toggle("ativa", ativo);
    }
    document.querySelectorAll("#rotas-lista button").forEach((b) => b.classList.toggle("ativa", +b.dataset.pos === pos));
  }

  function escolherRota(pos, centralizar) {
    estado.rotaSel = estado.rotaSel === pos && !centralizar ? null : pos;
    realcarRota(estado.rotaSel);
    document.querySelectorAll("#rotas-lista button").forEach((b) => b.setAttribute("aria-current", String(+b.dataset.pos === estado.rotaSel)));
    const l = linhasRota.find((x) => x.pos === pos);
    if (centralizar && l) {
      mostrarMapa();
      mapa.flyToBounds(l.traco.getBounds(), { padding: [50, 50], maxZoom: 15, duration: REDUZIR ? 0 : 0.8 });
    }
  }

  // no celular as listas ficam abaixo do mapa: ao escolher um item, volta a tela para o mapa
  function mostrarMapa() {
    if (innerWidth <= 1080) mapaEl.scrollIntoView({ behavior: REDUZIR ? "auto" : "smooth", block: "center" });
  }

  function listaRotas() {
    const box = document.getElementById("rotas");
    const a = estado.rota;
    box.hidden = false;
    const itens = R[a].top.features.map((f) => {
      const p = f.properties;
      const b = el("button", { type: "button", "data-pos": String(p.posicao), "aria-current": String(estado.rotaSel === p.posicao) }, [
        el("span", { class: "rk-pos", texto: String(p.posicao) }),
        el("span", { class: "rota-nome" }, [
          el("span", { class: "rk-nome", texto: p.nome }),
          el("small", { texto: p.bairros.slice(0, 3).join(", ") }),
        ]),
        el("span", { class: "rk-valor", texto: nf1.format(p.comp_km) + " km" }),
      ]);
      b.addEventListener("click", () => escolherRota(p.posicao, true));
      b.addEventListener("mouseenter", () => realcarRota(p.posicao));
      b.addEventListener("mouseleave", () => realcarRota(estado.rotaSel));
      return el("li", {}, b);
    });
    box.replaceChildren(
      el("div", { class: "ranking-cabeca" }, [el("h3", { texto: `Rotas de ${NOME_ATIV[a]} mais feitas` })]),
      el("p", { class: "rotas-nota", texto: "Estimadas pelo mapa de calor público do Strava: trechos com mais extensão no nível máximo de uso." }),
      el("ol", { class: "ranking-lista", id: "rotas-lista" }, itens),
    );
  }

  if (R) {
    segmentado("ctl-rotas", (v) => { estado.rota = v; estado.rotaSel = null; desenharRotas(); contarCamadas(); });
  } else {
    document.getElementById("camadas-rotas").hidden = true;
  }

  // ---------- legenda ----------
  function legenda() {
    const box = document.getElementById("legenda");
    const i = ind();
    const titulo = typeof i.legenda === "function" ? i.legenda(estado.ano) : i.legenda;
    let cores, rotulos;
    if (i.divergente) {
      cores = CORES_EVO();
      rotulos = ["perdeu", "estável", "ganhou muito"];
    } else {
      cores = RAMPA;
      const fmt = estado.ind === "renda" ? (s) => reais(Math.round(rendaDaNota(s) / 100) * 100)
        : estado.ind === "saneamento" ? (s) => nf0.format(s) + "%"
        : estado.ind === "seguranca" ? (s) => (s < 50 ? "pior" : "melhor") + " AIS"
        : (s) => nf0.format(s);
      rotulos = [fmt(DOM[0]), fmt(DOM[1])];
    }
    box.replaceChildren(...[
      el("p", { class: "legenda-titulo", texto: titulo }),
      el("div", { class: "legenda-escala", "aria-hidden": "true" }, cores.map((c) => el("span", { style: `background:${c}` }))),
      el("div", { class: "legenda-rotulos" }, rotulos.map((r) => el("span", { texto: r }))),
      pracas && pracas.ligada ? el("p", { class: "legenda-praca" }, [el("i", { "aria-hidden": "true" }), `praça ou espaço público (URBIFOR, ${Q.ano})`]) : null,
      hospitais && hospitais.ligada ? el("p", { class: "legenda-praca" }, [el("i", { class: "hosp", "aria-hidden": "true" }), "hospital (OpenStreetMap)"]) : null,
      ...(rede && rede.ligada ? [
        el("p", { class: "legenda-praca" }, [el("i", { class: "traco onibus", "aria-hidden": "true" }), "ônibus (ETUFOR)"]),
        el("p", { class: "legenda-praca" }, [el("i", { class: "traco arce", "aria-hidden": "true" }), "metropolitano (ARCE)"]),
        el("p", { class: "legenda-praca" }, [el("i", { class: "traco metro", "aria-hidden": "true" }), "metrô e VLT"]),
        rede.paradasVisiveis
          ? el("p", { class: "legenda-praca" }, [el("i", { class: "parada", "aria-hidden": "true" }), "parada (clique para ver as linhas)"])
          : el("p", { class: "legenda-praca legenda-dica", texto: "clique numa linha para destacá-la; aproxime para ver as paradas" }),
      ] : []),
    ].filter(Boolean));
  }

  // =====================================================================
  // FICHA E RANKING
  // =====================================================================
  function ranking() {
    const ord = [...BAIRROS].sort((a, b) => nota(b) - nota(a));
    return new Map(ord.map((p, i) => [p.id, i + 1]));
  }

  function ficha() {
    const box = document.getElementById("ficha");
    const p = POR_ID.get(estado.sel);
    if (!p) {
      box.replaceChildren(
        el("p", { class: "ficha-ais", texto: "Nenhum bairro selecionado" }),
        el("h3", { texto: "Escolha um bairro" }),
        el("p", { class: "ficha-vazia", texto: "Clique num bairro no mapa ou na lista abaixo para ver a renda, o saneamento, a segurança e quanto ele mudou desde 2010." }),
      );
      return;
    }
    const rIdx = new Map([...BAIRROS].sort((a, b) => indice(b) - indice(a)).map((q, i) => [q.id, i + 1]));
    const eixo = (nome, valor, nota) => el("li", {}, [
      el("div", { class: "eixo-linha" }, [el("span", { texto: nome }), el("span", { texto: valor })]),
      el("div", { class: "barra", role: "img", "aria-label": `${nome}: nota ${nf0.format(nota)} de 100` }, el("i", { style: `width:${Math.max(1, nota)}%` })),
    ]);
    const vr = p.var_renda_real_pct, vs = p.var_saneamento_pp;
    const preco = P && P.bairros[p.id] && P.bairros[p.id].todos;
    box.replaceChildren(...[
      el("p", { class: "ficha-ais", texto: `Regional ${p.regional} · ${p.ais}, ${nf0.format(p.pop_2022)} moradores` }),
      el("h3", { texto: p.nome }),
      el("div", { class: "ficha-topo" }, [
        el("p", { class: "ficha-indice", html: `${nf0.format(indice(p))}<small>de 100</small>` }),
        el("p", { class: "ficha-pos", texto: `${rIdx.get(p.id)}º de 121 no índice` }),
      ]),
      el("ul", { class: "eixos" }, [
        eixo("Renda", reais(p.renda_real_2022) + " por mês", p.score_renda_2022),
        eixo("Saneamento", nf0.format(p.saneamento_2022) + "% com esgoto em rede", p.score_saneamento_2022),
        eixo("Segurança", `${nf1.format(p.cvli_pond)} mortes violentas por 100 mil`, p.score_seguranca),
      ]),
      el("p", { class: "ficha-nota" }, `Segurança medida pela ${p.ais}: o mesmo valor para os ${p.n_bairros_ais} bairros dela. Roubos registrados: ${nf0.format(p.cvp)} por 100 mil, fora da nota.`),
      el("div", { class: "ficha-mudanca" }, [
        el("div", {}, [el("b", { class: vr < 0 ? "menos" : "", texto: sinal(vr, nf0.format) + "%" }), "renda real desde 2010"]),
        el("div", {}, [el("b", { class: vs < 0 ? "menos" : "", texto: sinal(vs, nf0.format) + " p.p." }), "esgoto em rede desde 2010"]),
      ]),
      R && R.bairros[p.id] ? el("p", { class: "ficha-strava" }, [
        "Movimento no Strava, de 0 a 100: ",
        el("b", { texto: `corrida ${nf0.format(R.bairros[p.id][0])}` }), ", ",
        el("b", { texto: `pedal ${nf0.format(R.bairros[p.id][1])}` }),
      ]) : null,
      fichaOnibus(p),
      fichaLinhas(p),
      fichaPracas(p),
      E && E.bairros[p.id] && E.bairros[p.id].dist_hospital_km != null ? el("p", { class: "ficha-strava" }, [
        "Hospital mais próximo: ", el("b", { texto: `${nf1.format(E.bairros[p.id].dist_hospital_km)} km` }), " do centro do bairro",
      ]) : null,
      preco && preco.n >= ((P.min_amostra && P.min_amostra.bairro) || 5) ? el("p", { class: "ficha-strava" }, [
        "Preço do m² nos anúncios: ",
        el("b", { texto: `${reais(preco.mediana)} (mediana)` }),
        `, ${nf0.format(preco.n)} anúncios`,
      ]) : preco ? el("p", { class: "ficha-strava" },
        `Preço do m²: só ${preco.n} anúncio${preco.n === 1 ? "" : "s"} no bairro, pouco para estimar (veja a regional em Preços).`) : null,
    ].filter(Boolean));
    box.classList.remove("entrando"); void box.offsetWidth; box.classList.add("entrando");
  }

  // tempo de ônibus até três polos de referência e atalho para a seção de rotas
  function fichaOnibus(p) {
    if (!T || !T.tempos[`b${p.id}`]) return null;
    const p50 = T.tempos[`b${p.id}`][1];
    const fmt = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`);
    const polos = ["p_centro", "p_aldeota", "p_beira_mar"].map((id) => T.polos.find((q) => q.id === id)).filter(Boolean);
    const bt = el("button", { type: "button", class: "link-botao", texto: "Ver rotas de ônibus a partir daqui →" });
    bt.addEventListener("click", () => document.dispatchEvent(new CustomEvent("trajeto-origem", { detail: p.id })));
    return el("div", { class: "ficha-onibus" }, [
      el("p", { texto: "De ônibus, saindo de manhã (estimativa):" }),
      el("ul", {}, polos.map((q) => {
        const m = p50[T.destinos.indexOf(q.id)];
        return el("li", {}, [el("b", { texto: m == null ? "–" : fmt(m) }), q.nome.replace(/ \(.*\)$/, "")]);
      })),
      bt,
    ]);
  }

  // linhas que passam no bairro (rede atual), com o botão para desenhá-las no mapa
  function fichaLinhas(p) {
    if (!LN) return null;
    const idxs = LN.doBairro(p.id);
    if (!idxs.length) return el("p", { class: "ficha-strava" }, "Nenhuma linha de ônibus com parada no bairro ou a até 300 m dele.");
    const c = LN.contar(idxs);
    const partes = [c.onibus && `${c.onibus} ETUFOR`, c.arce && `${c.arce} metropolitana${c.arce === 1 ? "" : "s"}`, c.metro && `${c.metro} de metrô/VLT`].filter(Boolean);
    const MOSTRA = 16;
    const nParadas = LN.paradasNoBairro(p.id);
    const bt = el("button", { type: "button", class: "link-botao", texto: linhasDe === p.id ? "Tirar as linhas do mapa" : "Ver essas linhas no mapa →" });
    bt.addEventListener("click", async () => {
      if (linhasDe === p.id) { camadaLinhas.clearLayers(); linhasDe = null; }
      else { await LN.tracar(camadaLinhas, idxs, { pane: "linhasBairro" }); linhasDe = p.id; }
      bt.textContent = linhasDe === p.id ? "Tirar as linhas do mapa" : "Ver essas linhas no mapa →";
    });
    return el("div", { class: "ficha-linhas" }, [
      el("p", {}, [el("b", { texto: `${idxs.length} linhas` }), ` passam no bairro ou a até ${LN.D.meta.raio_m} m dele (${partes.join(", ")})`,
        nParadas ? `; ${nParadas} parada${nParadas === 1 ? "" : "s"} dentro do bairro.` : "."]),
      el("div", { class: "selos" }, [...idxs.slice(0, MOSTRA).map((i) => LN.selo(i)),
        idxs.length > MOSTRA ? el("span", { class: "selos-mais", texto: `+${idxs.length - MOSTRA}` }) : null]),
      bt,
    ]);
  }

  function fichaPracas(p) {
    const q = Q && Q.bairros[p.id];
    if (!q) return null;
    if (!q.n) return el("p", { class: "ficha-strava" }, `Nenhuma praça no cadastro da URBIFOR (${Q.ano}): pode faltar praça ou só o cadastro.`);
    const area = q.area_m2 >= 10000 ? nf1.format(q.area_m2 / 10000) + " ha" : nf0.format(q.area_m2) + " m²";
    const m2 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
    return el("p", { class: "ficha-strava" }, [
      "Praças cadastradas: ",
      el("b", { texto: `${q.n} ${q.n === 1 ? "espaço" : "espaços"}, ${area}` }),
      ` · ${m2.format(q.m2_hab)} m² por morador (cidade: ${m2.format(Q.cidade.m2_por_morador)})`,
    ]);
  }

  function lista() {
    const ol = document.getElementById("ranking-lista");
    const pos = ranking();
    const notas = BAIRROS.map(nota);
    const max = Math.max(...notas.map(Math.abs));
    const termo = estado.busca.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    let ord = [...BAIRROS].sort((a, b) => (estado.desc ? nota(b) - nota(a) : nota(a) - nota(b)));
    if (termo) ord = ord.filter((p) => p.nome.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().includes(termo));
    ol.replaceChildren(...ord.map((p) => {
      const v = nota(p);
      const larg = ind().divergente ? (Math.abs(v) / max) * 100 : v;
      const b = el("button", { type: "button", "aria-current": String(estado.sel === p.id) }, [
        el("span", { class: "rk-pos", texto: String(pos.get(p.id)) }),
        el("span", { class: "rk-nome", texto: p.nome }),
        el("span", { class: "rk-barra", "aria-hidden": "true" }, el("i", { class: v < 0 ? "menos" : "", style: `width:${Math.max(1, larg)}%` })),
        el("span", { class: "rk-valor", texto: ind().texto(p, estado.ano) }),
      ]);
      b.addEventListener("click", () => selecionar(p.id, { centralizar: true }));
      return el("li", {}, b);
    }));
    if (!ord.length) ol.append(el("li", { class: "ficha-vazia", style: "padding:8px 14px", texto: "Nenhum bairro com esse nome." }));
  }

  function selecionar(id, { centralizar }) {
    estado.sel = id;
    if (linhasDe !== null && linhasDe !== id) { camadaLinhas.clearLayers(); linhasDe = null; }
    pintar();
    ficha();
    lista();
    if (centralizar) {
      const l = camadaSel();
      if (l) { mostrarMapa(); mapa.flyToBounds(l.getBounds(), { padding: [60, 60], maxZoom: 14, duration: REDUZIR ? 0 : 0.8 }); }
    }
  }

  // ---------- controles ----------
  function segmentado(id, aoMudar) {
    const g = document.getElementById(id);
    g.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      aoMudar(b.dataset.v);
    });
    return g;
  }

  const ctlAno = segmentado("ctl-ano", (v) => { estado.ano = v; atualizar(); });
  segmentado("ctl-indicador", (v) => { estado.ind = v; atualizar(); });

  const pesosEl = document.getElementById("pesos");
  pesosEl.addEventListener("input", (e) => {
    if (!e.target.dataset.eixo) return;
    estado.pesos[e.target.dataset.eixo] = +e.target.value;
    atualizar();
  });
  document.getElementById("pesos-reset").addEventListener("click", () => {
    pesosEl.querySelectorAll("input").forEach((i) => { i.value = 5; estado.pesos[i.dataset.eixo] = 5; });
    atualizar();
  });
  function rotularPesos() {
    const w = estado.pesos, s = w.renda + w.saneamento + w.seguranca;
    pesosEl.querySelectorAll("label").forEach((lb) => {
      const i = lb.querySelector("input");
      lb.querySelector("output").textContent = (s ? Math.round((w[i.dataset.eixo] / s) * 100) : 33) + "%";
    });
  }

  document.getElementById("busca").addEventListener("input", (e) => { estado.busca = e.target.value; lista(); });
  const ordemBtn = document.getElementById("ranking-ordem");
  ordemBtn.addEventListener("click", () => {
    estado.desc = !estado.desc;
    ordemBtn.textContent = estado.desc ? "Melhores primeiro" : "Piores primeiro";
    lista();
  });

  function atualizar() {
    const anual = ind().anual;
    ctlAno.querySelectorAll("button").forEach((b) => { b.disabled = !anual; });
    ctlAno.title = anual ? "" : "Este indicador só existe para o período atual";
    pesosEl.hidden = estado.ind !== "indice";
    rotularPesos();
    pintar();
    legenda();
    lista();
    ficha();
  }

  // =====================================================================
  // EVOLUÇÃO: uma linha vertical por bairro
  // =====================================================================
  const EVO = {
    var_indice_socio: { fmt: (v) => sinal(v, nf1.format) + " pts", eixo: (v) => nf0.format(v) },
    var_renda_real_pct: { fmt: (v) => sinal(v, nf0.format) + "%", eixo: (v) => nf0.format(v) + "%" },
    var_saneamento_pp: { fmt: (v) => sinal(v, nf0.format) + " p.p.", eixo: (v) => nf0.format(v) },
  };
  const svg = document.getElementById("linhas");
  const dicaEvo = document.getElementById("linhas-dica");
  let evoBarras = [], evoOrdem = [], evoGeo = null, evoVisto = false;

  function evolucao() {
    const m = estado.evo, cfg = EVO[m];
    // desenhado na largura real do contêiner, para o texto não encolher no celular
    const W = Math.max(320, Math.round(svg.parentElement.clientWidth || 1200));
    const estreito = W < 640;
    const H = estreito ? 300 : 400, T = 34, B = 30, E = estreito ? 36 : 46, Dd = 6;
    evoOrdem = [...BAIRROS].sort((a, b) => a[m] - b[m]);
    const vals = evoOrdem.map((p) => p[m]);
    const passo = (v) => (v > 60 ? 20 : v > 25 ? 10 : 5);
    const st = passo(Math.max(...vals.map(Math.abs)));
    const y0 = Math.min(0, Math.floor(Math.min(...vals) / st) * st);
    const y1 = Math.max(0, Math.ceil(Math.max(...vals) / st) * st);
    const y = (v) => T + ((y1 - v) / (y1 - y0)) * (H - T - B);
    const larg = (W - E - Dd) / evoOrdem.length;
    const xb = (i) => E + i * larg + larg / 2;
    evoGeo = { E, larg, W, H, y };

    const ns = "http://www.w3.org/2000/svg";
    const s = (tag, a) => { const n = document.createElementNS(ns, tag); for (const k in a) n.setAttribute(k, a[k]); return n; };
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.replaceChildren();
    svg.append(s("title", {}));
    svg.lastChild.textContent = "Mudança por bairro entre 2010 e 2022";

    for (let v = y0; v <= y1; v += st) {
      if (v === 0) continue;
      svg.append(s("line", { class: "grade", x1: E, x2: W - Dd, y1: y(v), y2: y(v) }));
      const t = s("text", { x: E - 8, y: y(v) + 4, "text-anchor": "end" }); t.textContent = cfg.eixo(v); svg.append(t);
    }
    const t0 = s("text", { x: E - 8, y: y(0) + 4, "text-anchor": "end" }); t0.textContent = "0"; svg.append(t0);

    const bw = Math.max(2, larg * 0.5);
    evoBarras = evoOrdem.map((p, i) => {
      const v = p[m], a = y(Math.max(v, 0)), b = y(Math.min(v, 0));
      const r = s("rect", {
        class: "barra-evo", x: xb(i) - bw / 2, y: a, width: bw, height: Math.max(1, b - a), rx: 1,
        fill: v < 0 ? COR.perda : COR.cobalto,
        style: `transform-box:fill-box;transform-origin:center ${v < 0 ? "top" : "bottom"};` +
          (REDUZIR ? "" : `transform:scaleY(${evoVisto ? 1 : 0});transition:transform 700ms cubic-bezier(.2,.7,.1,1) ${i * 5}ms`),
      });
      svg.append(r);
      return r;
    });
    svg.append(s("line", { class: "zero", x1: E, x2: W - Dd, y1: y(0), y2: y(0) }));

    // rótulos diretos só nos extremos
    const rotular = (i, acima) => {
      const p = evoOrdem[i], v = p[m], yy = acima ? y(Math.max(v, 0)) - 8 : y(Math.min(v, 0)) + 16;
      const anc = i < evoOrdem.length / 2 ? "start" : "end";
      const t = s("text", { class: "rotulo-barra", x: xb(i) + (anc === "start" ? -2 : 2), y: yy, "text-anchor": anc });
      t.textContent = `${p.nome} ${cfg.fmt(v)}`;
      svg.append(t);
    };
    rotular(evoOrdem.length - 1, true);
    if (vals[0] < 0) rotular(0, false); else rotular(0, true);

    // listas dos extremos
    const item = (p) => el("li", {}, [el("span", { texto: p.nome }), el("span", { texto: cfg.fmt(p[m]) })]);
    const ganhos = [...evoOrdem].reverse().slice(0, 5);
    const perdas = evoOrdem.slice(0, 5);
    document.getElementById("extremos").replaceChildren(
      el("div", { class: "ganho" }, [el("h3", { texto: "Mais avançaram" }), el("ol", {}, ganhos.map(item))]),
      el("div", { class: "perda" }, [el("h3", { texto: perdas[0][m] < 0 ? "Mais recuaram" : "Avançaram menos" }), el("ol", {}, perdas.map(item))]),
    );
  }

  function crescer() {
    if (REDUZIR) return;
    requestAnimationFrame(() => evoBarras.forEach((r) => { r.style.transform = "scaleY(1)"; }));
  }

  segmentado("ctl-evo", (v) => { estado.evo = v; evolucao(); crescer(); });

  svg.addEventListener("pointermove", (e) => {
    if (!evoGeo) return;
    const box = svg.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * evoGeo.W;
    const i = Math.floor((x - evoGeo.E) / evoGeo.larg);
    if (i < 0 || i >= evoOrdem.length) return esconderDica();
    const p = evoOrdem[i], m = estado.evo;
    svg.classList.add("focando");
    evoBarras.forEach((r, k) => r.classList.toggle("ativa", k === i));
    const extra = m === "var_renda_real_pct" ? `${reais(p.renda_real_2010)} → ${reais(p.renda_real_2022)}`
      : m === "var_saneamento_pp" ? `${nf0.format(p.saneamento_2010)}% → ${nf0.format(p.saneamento_2022)}%`
      : `nota ${nf0.format(p.indice_socio_2010)} → ${nf0.format(p.indice_socio_2022)}`;
    dicaEvo.replaceChildren(el("b", { texto: `${p.nome} ${EVO[m].fmt(p[m])}` }), el("span", { texto: extra }));
    dicaEvo.hidden = false;
    const r = evoBarras[i].getBoundingClientRect(), caixa = svg.parentElement.getBoundingClientRect();
    const dx = Math.min(Math.max(r.left + r.width / 2 - caixa.left, 90), caixa.width - 90);
    dicaEvo.style.left = dx + "px";
    dicaEvo.style.top = (Math.min(r.top, evoGeo.y(0) / evoGeo.H * box.height + box.top) - caixa.top) + "px";
  });
  function esconderDica() { svg.classList.remove("focando"); evoBarras.forEach((r) => r.classList.remove("ativa")); dicaEvo.hidden = true; }
  svg.addEventListener("pointerleave", esconderDica);
  svg.addEventListener("click", () => {
    const ativo = evoBarras.findIndex((r) => r.classList.contains("ativa"));
    if (ativo >= 0) { selecionar(evoOrdem[ativo].id, { centralizar: true }); document.getElementById("mapa").scrollIntoView(); }
  });

  new IntersectionObserver((ents, obs) => {
    if (ents.some((e) => e.isIntersecting)) { evoVisto = true; crescer(); obs.disconnect(); }
  }, { threshold: 0.3 }).observe(svg);

  // =====================================================================
  // ABERTURA: Fortaleza em pixels
  // =====================================================================
  const tela = document.getElementById("cidade");
  const ctx = tela.getContext("2d");
  const tag = document.getElementById("cidade-tag");
  let celulas = [], grade = null, inicio = 0, rodando = false, emFoco = null, visivel = true;

  // polígonos em coordenadas planas simples (lon·cos(lat), lat)
  const LAT0 = -3.78, KX = Math.cos((LAT0 * Math.PI) / 180);
  const aneis = FEATS.map((f) => {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const rings = polys.map((pl) => pl.map((r) => r.map(([lo, la]) => [lo * KX, la])));
    let bb = [Infinity, Infinity, -Infinity, -Infinity];
    rings.flat(2).forEach(([x, yy]) => { bb = [Math.min(bb[0], x), Math.min(bb[1], yy), Math.max(bb[2], x), Math.max(bb[3], yy)]; });
    return { id: f.properties.id, rings, bb };
  });
  const BB = aneis.reduce((a, r) => [Math.min(a[0], r.bb[0]), Math.min(a[1], r.bb[1]), Math.max(a[2], r.bb[2]), Math.max(a[3], r.bb[3])], [Infinity, Infinity, -Infinity, -Infinity]);

  function dentro(x, yy, ring) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > yy) !== (yj > yy) && x < ((xj - xi) * (yy - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function bairroEm(x, yy) {
    for (const a of aneis) {
      if (x < a.bb[0] || x > a.bb[2] || yy < a.bb[1] || yy > a.bb[3]) continue;
      for (const pl of a.rings) if (dentro(x, yy, pl[0]) && !pl.slice(1).some((h) => dentro(x, yy, h))) return a.id;
    }
    return null;
  }

  function montarCidade() {
    const r = tela.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    tela.width = Math.round(r.width * dpr); tela.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const lado = r.width < 520 ? 6 : 8;
    const pad = 12, w = r.width - 2 * pad, h = r.height - 2 * pad - 24;
    const esc = Math.min(w / (BB[2] - BB[0]), h / (BB[3] - BB[1]));
    const ox = pad + (w - (BB[2] - BB[0]) * esc) / 2, oy = pad + (h - (BB[3] - BB[1]) * esc) / 2;
    const notas = BAIRROS.map(indice), nmin = Math.min(...notas), nmax = Math.max(...notas);
    const centro = { x: r.width * 0.42, y: r.height * 0.3 };
    const cols = Math.floor(r.width / lado), lins = Math.floor(r.height / lado);
    grade = { lado, cols, lins, ids: new Int16Array(cols * lins).fill(-1) };
    celulas = [];
    for (let j = 0; j < lins; j++) {
      for (let i = 0; i < cols; i++) {
        const cx = i * lado + lado / 2, cy = j * lado + lado / 2;
        const id = bairroEm(BB[0] + (cx - ox) / esc, BB[3] - (cy - oy) / esc);
        if (id == null) continue;
        grade.ids[j * cols + i] = id;
        const t = (indice(POR_ID.get(id)) - nmin) / (nmax - nmin);
        const dist = Math.hypot(cx - centro.x, cy - centro.y) / Math.hypot(r.width, r.height);
        celulas.push({ x: i * lado, y: j * lado, id, t, atraso: dist * 1500 + Math.random() * 380 });
      }
    }
  }

  function desenharCidade(agora) {
    const r = tela.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    const lado = grade.lado, dt = agora - inicio;
    const varre = REDUZIR ? -1e9 : ((agora / 6500) % 1) * (r.width + 240) - 120;
    let pendente = false;
    for (const c of celulas) {
      let k = 1;
      if (!REDUZIR) {
        k = Math.min(1, Math.max(0, (dt - c.atraso) / 520));
        if (k < 1) pendente = true;
        if (k === 0) continue;
        k = 1 - Math.pow(1 - k, 3);
      }
      const foco = emFoco === c.id;
      const onda = Math.exp(-(((c.x - varre) / 46) ** 2));
      const tam = foco ? lado - 1 : lado * (0.2 + 0.62 * c.t + 0.22 * onda) * k;
      const alfa = foco ? 1 : Math.min(1, 0.32 + 0.6 * c.t + 0.3 * onda);
      ctx.fillStyle = `rgba(255,255,255,${alfa})`;
      const off = (lado - tam) / 2;
      ctx.fillRect(c.x + off, c.y + off, tam, tam);
    }
    return pendente;
  }

  function laco(agora) {
    if (!visivel) { rodando = false; return; }
    desenharCidade(agora);
    if (REDUZIR) { rodando = false; return; }
    requestAnimationFrame(laco);
  }
  function iniciarLaco() { if (!rodando) { rodando = true; requestAnimationFrame(laco); } }

  tela.addEventListener("pointermove", (e) => {
    if (!grade) return;
    const r = tela.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left) / grade.lado), j = Math.floor((e.clientY - r.top) / grade.lado);
    const id = i >= 0 && j >= 0 && i < grade.cols && j < grade.lins ? grade.ids[j * grade.cols + i] : -1;
    emFoco = id >= 0 ? id : null;
    if (emFoco == null) { tag.hidden = true; tela.style.cursor = "default"; }
    else {
      const p = POR_ID.get(emFoco);
      tag.replaceChildren(el("b", { texto: p.nome }), `índice ${nf0.format(indice(p))}`);
      tag.hidden = false;
      tag.style.left = (e.clientX - r.left) + "px";
      tag.style.top = (e.clientY - r.top) + "px";
      tela.style.cursor = "pointer";
    }
    if (REDUZIR) desenharCidade(performance.now());
  });
  tela.addEventListener("pointerleave", () => { emFoco = null; tag.hidden = true; if (REDUZIR) desenharCidade(performance.now()); });
  tela.addEventListener("click", () => {
    if (emFoco == null) return;
    selecionar(emFoco, { centralizar: true });
    document.getElementById("mapa").scrollIntoView();
  });

  new IntersectionObserver((ents) => {
    visivel = ents[0].isIntersecting;
    if (visivel) iniciarLaco();
  }).observe(tela);

  let tRedim, larguraAnt = innerWidth;
  window.addEventListener("resize", () => {
    clearTimeout(tRedim);
    tRedim = setTimeout(() => {
      montarCidade(); inicio = performance.now() - 5000; iniciarLaco();
      if (innerWidth !== larguraAnt) { larguraAnt = innerWidth; evolucao(); }
    }, 200);
  });

  // =====================================================================
  // FRASE E NÚMEROS
  // =====================================================================
  const frase = document.getElementById("frase-texto");
  const palavras = frase.textContent.split(/\s+/);
  frase.setAttribute("aria-label", frase.textContent);
  frase.replaceChildren(...palavras.flatMap((w, i) => [el("span", { class: "p", "aria-hidden": "true", texto: w }), i < palavras.length - 1 ? " " : ""]));
  const spans = [...frase.querySelectorAll(".p")];
  const secFrase = frase.closest(".frase");
  function revelar() {
    const r = secFrase.getBoundingClientRect();
    const prog = REDUZIR ? 1 : Math.min(1, Math.max(0, (-r.top + innerHeight * 0.35) / (r.height - innerHeight * 0.6)));
    const n = Math.round(prog * spans.length);
    spans.forEach((s, i) => s.classList.toggle("on", i < n));
  }

  const C = D.cidade;
  document.getElementById("numeros").replaceChildren(
    ...[
      [nf0.format(C.saneamento_2022) + "%", `dos domicílios com esgoto em rede em 2022. Eram ${nf0.format(C.saneamento_2010)}% em 2010.`],
      [reais(C.renda_2022_oficial), "de renda média mensal de quem sustenta a casa, em 2022."],
      [nf1.format(C.cvli_cidade), "mortes violentas por 100 mil habitantes ao ano, média de 2023 a 2025."],
    ].map(([v, t]) => el("div", {}, [el("dt", { texto: t }), el("dd", { texto: v })])),
  );

  // nav muda de cor ao sair do azul da abertura
  const nav = document.querySelector(".nav");
  const hero = document.querySelector(".hero");
  function rolagem() {
    nav.classList.toggle("clara", hero.getBoundingClientRect().bottom < 64);
    revelar();
  }
  addEventListener("scroll", rolagem, { passive: true });

  // a seção de preços (regionais.js) pede para abrir um bairro no mapa principal
  document.addEventListener("selecionar-bairro", (e) => {
    selecionar(e.detail, { centralizar: true });
    document.getElementById("mapa").scrollIntoView();
  });

  // =====================================================================
  // INÍCIO
  // =====================================================================
  atualizar();
  evolucao();
  rolagem();
  // #b=ID abre o bairro direto (link vindo da página "Onde morar")
  const doLink = /^#b=(\d+)$/.exec(location.hash);
  if (doLink && POR_ID.has(+doLink[1])) {
    selecionar(+doLink[1], { centralizar: true });
    requestAnimationFrame(() => document.getElementById("mapa").scrollIntoView());
  }
  montarCidade();
  inicio = performance.now();
  iniciarLaco();
  requestAnimationFrame(() => hero.classList.add("pronto"));
})();
