/* Bairros de Fortaleza — a cidade desenhada em pixels, reaproveitável.
   Mesma técnica da abertura do painel (app.js): uma grade sobre o mapa, cada célula pertence a um bairro,
   o tamanho e o brilho do pixel seguem um valor de 0 a 1 por bairro. Aqui o valor pode mudar a qualquer
   momento (alvo), e os pixels migram até ele numa onda que parte de um ponto da cidade. */
window.CidadePixels = function CidadePixels(tela, feats, opcoes) {
  "use strict";
  opcoes = opcoes || {};
  const REDUZIR = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = tela.getContext("2d");
  const cor = opcoes.cor || "255,255,255";
  const LAT0 = -3.78, KX = Math.cos((LAT0 * Math.PI) / 180);

  // polígonos em coordenadas planas simples (lon·cos(lat), lat)
  const aneis = feats.map((f) => {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const rings = polys.map((pl) => pl.map((r) => r.map(([lo, la]) => [lo * KX, la])));
    let bb = [Infinity, Infinity, -Infinity, -Infinity];
    rings.flat(2).forEach(([x, y]) => { bb = [Math.min(bb[0], x), Math.min(bb[1], y), Math.max(bb[2], x), Math.max(bb[3], y)]; });
    return { id: f.properties.id, rings, bb };
  });
  const BB = aneis.reduce((a, r) => [Math.min(a[0], r.bb[0]), Math.min(a[1], r.bb[1]), Math.max(a[2], r.bb[2]), Math.max(a[3], r.bb[3])],
    [Infinity, Infinity, -Infinity, -Infinity]);

  function dentro(x, y, ring) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function bairroEm(x, y) {
    for (const a of aneis) {
      if (x < a.bb[0] || x > a.bb[2] || y < a.bb[1] || y > a.bb[3]) continue;
      for (const pl of a.rings) if (dentro(x, y, pl[0]) && !pl.slice(1).some((h) => dentro(x, y, h))) return a.id;
    }
    return null;
  }

  let celulas = [], grade = null, valores = new Map(), foco = null, visivel = true, rodando = false;
  let largura = 0, altura = 0, onda = true;
  const DUR = 620;

  function montar() {
    const r = tela.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    largura = r.width; altura = r.height;
    tela.width = Math.round(r.width * dpr); tela.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const lado = opcoes.lado ? opcoes.lado(r.width) : (r.width < 520 ? 6 : 8);
    const pad = 12, w = r.width - 2 * pad, h = r.height - 2 * pad;
    const esc = Math.min(w / (BB[2] - BB[0]), h / (BB[3] - BB[1]));
    const ox = pad + (w - (BB[2] - BB[0]) * esc) / 2, oy = pad + (h - (BB[3] - BB[1]) * esc) / 2;
    const cols = Math.floor(r.width / lado), lins = Math.floor(r.height / lado);
    const antigas = new Map(celulas.map((c) => [c.id, c.t]));
    grade = { lado, cols, lins, ids: new Int16Array(cols * lins).fill(-1), ox, oy, esc };
    celulas = [];
    for (let j = 0; j < lins; j++) {
      for (let i = 0; i < cols; i++) {
        const cx = i * lado + lado / 2, cy = j * lado + lado / 2;
        const id = bairroEm(BB[0] + (cx - ox) / esc, BB[3] - (cy - oy) / esc);
        if (id == null) continue;
        grade.ids[j * cols + i] = id;
        const t0 = antigas.has(id) ? antigas.get(id) : 0;
        celulas.push({ x: i * lado, y: j * lado, id, t: t0, de: t0, alvo: valores.get(id) ?? 0, inicio: 0, ruido: Math.random() });
      }
    }
    // primeira entrada: os pixels nascem do centro para fora
    alvo(valores, { origem: [0.5, 0.45], espalhar: 1300 });
  }

  // valores: Map(id -> 0..1). origem: ponto [0..1, 0..1] de onde a onda parte.
  function alvo(novos, { origem = [0.5, 0.5], espalhar = 700 } = {}) {
    valores = new Map(novos);
    const agora = performance.now();
    const ox = origem[0] * largura, oy = origem[1] * altura, diag = Math.hypot(largura, altura) || 1;
    for (const c of celulas) {
      c.de = c.t;
      c.alvo = valores.get(c.id) ?? 0;
      c.inicio = REDUZIR ? 0 : agora + (Math.hypot(c.x - ox, c.y - oy) / diag) * espalhar + c.ruido * 160;
    }
    iniciar();
  }

  const suave = (k) => 1 - Math.pow(1 - k, 3);

  function desenhar(agora) {
    ctx.clearRect(0, 0, largura, altura);
    if (!grade) return false;
    const lado = grade.lado;
    const varre = REDUZIR || !onda ? -1e9 : ((agora / 7000) % 1) * (largura + 240) - 120;
    let pendente = false;
    for (const c of celulas) {
      if (REDUZIR) c.t = c.alvo;
      else {
        const k = Math.min(1, Math.max(0, (agora - c.inicio) / DUR));
        if (k < 1) pendente = true;
        c.t = c.de + (c.alvo - c.de) * suave(k);
      }
      const emFoco = foco === c.id;
      const brilho = Math.exp(-(((c.x - varre) / 46) ** 2));
      const tam = emFoco ? lado - 1 : lado * (0.16 + 0.7 * c.t + 0.16 * brilho);
      const alfa = emFoco ? 1 : Math.min(1, 0.22 + 0.72 * c.t + 0.25 * brilho);
      if (tam < 0.6) continue;
      ctx.fillStyle = `rgba(${cor},${alfa})`;
      const off = (lado - tam) / 2;
      ctx.fillRect(c.x + off, c.y + off, tam, tam);
    }
    return pendente;
  }

  function laco(agora) {
    if (!visivel) { rodando = false; return; }
    const pendente = desenhar(agora);
    if (REDUZIR && !pendente) { rodando = false; return; }
    requestAnimationFrame(laco);
  }
  function iniciar() { if (!rodando) { rodando = true; requestAnimationFrame(laco); } }

  function idEm(clienteX, clienteY) {
    if (!grade) return null;
    const r = tela.getBoundingClientRect();
    const i = Math.floor((clienteX - r.left) / grade.lado), j = Math.floor((clienteY - r.top) / grade.lado);
    const id = i >= 0 && j >= 0 && i < grade.cols && j < grade.lins ? grade.ids[j * grade.cols + i] : -1;
    return id >= 0 ? id : null;
  }

  new IntersectionObserver((ents) => { visivel = ents[0].isIntersecting; if (visivel) iniciar(); }).observe(tela);

  return {
    montar,
    alvo,
    idEm,
    focar(id) { foco = id; if (REDUZIR) desenhar(performance.now()); },
    pausarOnda(sim) { onda = !sim; },
  };
};
