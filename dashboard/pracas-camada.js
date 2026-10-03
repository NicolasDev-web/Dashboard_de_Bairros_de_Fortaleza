/* Bairros de Fortaleza — camada "Praças" (URBIFOR, 2019), usada pelo painel e pela página "Onde morar".
   Dados em pracas.js (window.PRACAS, scripts/11_pracas.py). A praça mediana tem uns 2 mil m², menos de um pixel
   no zoom da cidade: até o zoom 13 cada praça é um ponto com tamanho pela área; do 14 em diante, o polígono. */
window.CamadaPracas = function CamadaPracas(mapa, P, opcoes) {
  "use strict";
  opcoes = opcoes || {};
  const nomeBairro = opcoes.nomeBairro || (() => "");
  const COR = getComputedStyle(document.documentElement).getPropertyValue("--praca").trim() || "#138a5e";
  const ZOOM_POLIGONO = 14;
  const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const area = (m2) => (m2 >= 10000 ? nf1.format(m2 / 10000) + " ha" : nf0.format(m2) + " m²");
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  if (!mapa.getPane("pracas")) mapa.createPane("pracas").style.zIndex = 430; // acima dos bairros, abaixo das rotas

  function dica(p) {
    const nome = p.nome ? esc(p.nome) : "Sem denominação oficial";
    const linhas = [`<b>${nome}</b>`];
    if (p.popular) linhas.push(`<em>“${esc(p.popular)}”</em>`);
    if (p.nome && !p.oficial) linhas.push("<small>sem denominação oficial</small>");
    linhas.push(`<span>${area(p.area)} · ${esc(nomeBairro(p.bairro))}</span>`);
    linhas.push(`<small>URBIFOR, cadastro de ${P.ano}</small>`);
    return linhas.join("");
  }
  const opDica = { sticky: true, direction: "top", offset: [0, -6], className: "dica-mapa dica-praca" };

  const poligonos = L.geoJSON(P.geojson, {
    pane: "pracas",
    style: { color: "#ffffff", weight: 1, fillColor: COR, fillOpacity: 0.85, className: "praca-forma" },
    onEachFeature: (f, l) => l.bindTooltip(dica(f.properties), opDica),
  });
  const pontos = L.layerGroup(P.geojson.features.map((f) =>
    L.circleMarker(f.properties.ponto, {
      pane: "pracas", radius: Math.max(2.6, Math.min(10, 2.2 + Math.sqrt(f.properties.area) / 40)),
      color: "#ffffff", weight: 1, fillColor: COR, fillOpacity: 0.9, className: "praca-ponto",
    }).bindTooltip(dica(f.properties), opDica)));

  const grupo = L.layerGroup();
  let ligada = false;
  function trocar() {
    if (!ligada) return;
    const poligono = mapa.getZoom() >= ZOOM_POLIGONO;
    grupo.clearLayers();
    grupo.addLayer(poligono ? poligonos : pontos);
  }
  mapa.on("zoomend", trocar);

  return {
    ligar(sim) {
      ligada = sim;
      if (sim) { trocar(); grupo.addTo(mapa); } else mapa.removeLayer(grupo);
    },
    get ligada() { return ligada; },
    cor: COR,
  };
};
