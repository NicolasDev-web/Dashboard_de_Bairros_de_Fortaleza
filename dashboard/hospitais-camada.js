/* Bairros de Fortaleza — camada "Hospitais" (OpenStreetMap), usada pelo painel e pela página "Onde morar".
   Dados em equipamentos.js (window.EQUIP.hospitais = [[lat, lon, nome], ...], scripts/10_equipamentos_osm.py). */
window.CamadaHospitais = function CamadaHospitais(mapa, lista) {
  "use strict";
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const icone = L.divIcon({ className: "hosp-pin", html: "<i></i>", iconSize: [16, 16], iconAnchor: [8, 8] });
  const grupo = L.layerGroup(lista.map(([la, lo, nome]) =>
    L.marker([la, lo], { icon: icone, keyboard: false, riseOnHover: true })
      .bindTooltip(`<b>${nome ? esc(nome) : "Hospital"}</b><small>hospital · OpenStreetMap</small>`,
        { direction: "top", offset: [0, -8], className: "dica-mapa dica-praca" })));
  let ligada = false;
  return {
    ligar(sim) { ligada = sim; if (sim) grupo.addTo(mapa); else mapa.removeLayer(grupo); },
    get ligada() { return ligada; },
    total: lista.length,
  };
};
