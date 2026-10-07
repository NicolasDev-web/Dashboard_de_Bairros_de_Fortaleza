/* Bairros de Fortaleza — linhas de ônibus e metrô que passam em cada bairro, e as paradas
   (scripts/13_linhas_bairros.py). linhas.js (window.LINHAS) é leve e vem com a página; os
   traçados (linhas_tracados.js) e as paradas (paradas.js) carregam só quando alguém pede.
   Usado pelo painel (ficha do bairro, camada "Paradas" e "Quanto tempo de ônibus"). */
window.Linhas = (function () {
  "use strict";
  const D = window.LINHAS;
  if (!D) return null;

  const OPERADORA = { etufor: "ETUFOR", arce: "metropolitana (ARCE)", metrofor: "Metrofor" };
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const COR = { onibus: css("--cobalto"), arce: css("--metropolitana") || "#7a3fb8", metro: css("--metro") || "#e09a1b" };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const carregados = new Map();
  function carregar(src) {
    if (!carregados.has(src)) {
      carregados.set(src, new Promise((ok, erro) => {
        const s = document.createElement("script");
        s.src = src; s.onload = ok; s.onerror = () => { carregados.delete(src); erro(new Error(src)); };
        document.head.append(s);
      }));
    }
    return carregados.get(src);
  }

  const info = (i) => {
    const [chave, curto, longo, op, modo] = D.linhas[i];
    return { chave, curto, longo, op, modo, tipo: modo !== "onibus" ? "metro" : op === "arce" ? "arce" : "onibus" };
  };
  const classe = (t) => (t === "metro" ? "tj-metro" : t === "arce" ? "tj-metropolitana" : "tj-onibus");
  const titulo = (l) => `${l.curto}${l.longo && l.longo !== l.curto ? ` · ${l.longo}` : ""} (${OPERADORA[l.op] || l.op})`;

  /** selo da linha (o mesmo do passo a passo); com aoClicar, vira botão */
  function selo(i, aoClicar) {
    const l = info(i);
    const n = document.createElement(aoClicar ? "button" : "span");
    if (aoClicar) { n.type = "button"; n.addEventListener("click", () => aoClicar(i, n)); }
    n.className = `tj-badge ${classe(l.tipo)}`;
    n.title = titulo(l);
    n.textContent = l.tipo === "metro" ? l.curto.replace(/^Linha\s+/i, "").replace(/^VLT.*/i, "VLT") : l.curto;
    return n;
  }
  const htmlSelo = (i) => { const l = info(i); return `<span class="tj-badge ${classe(l.tipo)}" title="${esc(titulo(l))}">${esc(l.curto)}</span>`; };

  /** linhas que passam no bairro (id numérico) ou perto do destino ("b12" ou "p_centro") */
  const doBairro = (id) => (D.bairros[String(id)] || { linhas: [] }).linhas;
  const paradasNoBairro = (id) => (D.bairros[String(id)] || { paradas: 0 }).paradas;
  const doDestino = (id) => (id.startsWith("p_") ? D.polos[id] || [] : doBairro(+id.slice(1)));
  const emComum = (a, b) => { const s = new Set(b); return a.filter((i) => s.has(i)); };
  const contar = (idxs) => idxs.reduce((c, i) => { c[info(i).tipo]++; return c; }, { onibus: 0, arce: 0, metro: 0 });

  /** desenha os traçados das linhas num grupo do mapa (troca o conteúdo do grupo) */
  async function tracar(grupo, idxs, { pane, destaque } = {}) {
    await carregar("linhas_tracados.js");
    grupo.clearLayers();
    for (const i of idxs) {
      const l = info(i);
      for (const forma of (window.LINHAS_TRACADOS || {})[i] || []) {
        L.polyline(forma, {
          pane, color: COR[l.tipo], weight: destaque === i ? 5 : 3, opacity: destaque == null || destaque === i ? 0.9 : 0.35,
          interactive: true, lineCap: "round", lineJoin: "round",
        }).bindTooltip(`<b>${esc(l.curto)}</b> ${esc(l.longo)}<small>${esc(OPERADORA[l.op] || l.op)}</small>`, { sticky: true, className: "dica-mapa" })
          .addTo(grupo);
      }
    }
    return grupo;
  }

  /** camada de paradas (canvas, para as ~7 mil caberem): clique mostra as linhas da parada */
  function CamadaParadas(mapa) {
    const render = L.canvas({ padding: 0.3 });
    const grupo = L.layerGroup();
    let ligada = false, montada = false;
    const raio = () => (mapa.getZoom() >= 15 ? 4.5 : mapa.getZoom() >= 13.5 ? 3 : 1.8);
    async function montar() {
      await carregar("paradas.js");
      for (const [la, lo, nome, idxs] of window.PARADAS || []) {
        const metro = idxs.some((i) => info(i).tipo === "metro");
        L.circleMarker([la, lo], {
          renderer: render, radius: raio(), weight: 1, color: "#ffffff", fillColor: metro ? COR.metro : COR.onibus, fillOpacity: 0.95,
        }).bindPopup(() => `<div class="popup-parada"><b>${esc(nome || "Parada")}</b><small>${idxs.length} linha${idxs.length === 1 ? "" : "s"}</small>`
          + `<div class="selos">${idxs.map(htmlSelo).join("")}</div></div>`, { maxWidth: 300 }).addTo(grupo);
      }
      montada = true;
    }
    mapa.on("zoomend", () => { if (montada) grupo.eachLayer((m) => m.setRadius(raio())); });
    return {
      async ligar(sim) {
        ligada = sim;
        if (sim) { if (!montada) await montar(); grupo.addTo(mapa); } else mapa.removeLayer(grupo);
      },
      get ligada() { return ligada; },
      total: D.meta.paradas,
    };
  }

  return { D, info, selo, doBairro, doDestino, paradasNoBairro, emComum, contar, tracar, CamadaParadas, carregar, OPERADORA };
})();
