/* Bairros de Fortaleza — "Quanto tempo de ônibus": tempo e rotas entre bairros e polos.
   Tempos em transporte.js (window.TRANSPORTE); rotas de cada bairro em transporte/o_<id>.js e traçado das linhas em
   transporte_linhas.js, carregados só quando a pessoa pede (os arquivos de rota somam vários MB). Tudo vem de
   scripts/12_transporte.py. Funciona direto do disco: os arquivos sob demanda entram por <script>, não por fetch(). */
(() => {
  "use strict";

  const D = window.DADOS;
  const T = window.TRANSPORTE || null;
  const REDUZIR = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const COR = { onibus: css("--cobalto"), metro: css("--metro") || "#e09a1b", pe: css("--tinta-3"), escuro: css("--cobalto-escuro"), branco: "#ffffff", papel: css("--papel-claro"), linha: css("--linha"), s1: css("--s1") };
  const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
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
  // "dia útil" ou "sábado": o script cai para o sábado quando o GTFS não tem viagem de dia útil
  const DIA = (T && T.meta.dia_rotulo) || "dia útil";
  // vigência da tabela da ETUFOR usada no cálculo ("nov/2023 a fev/2024"); vazio se o script não gravou
  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const mesAno = (iso) => `${MES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
  const ETUFOR = T && (T.meta.gtfs || []).find((g) => g.nome === "etufor");
  const TABELA = ETUFOR ? `${mesAno(ETUFOR.de)} a ${mesAno(ETUFOR.ate)}` : "";
  // tabela vencida há mais de um ano: a rede pode ter mudado desde então
  const TABELA_ANTIGA = ETUFOR && (Date.now() - Date.parse(ETUFOR.ate)) > 365 * 864e5;
  // "otimista no pico" só vale para a tabela de dia útil: a de sábado tem menos viagens
  const RESSALVA = DIA === "dia útil"
    ? "não considera trânsito nem atraso. No pico, conte com mais."
    : `não considera trânsito nem atraso, e é a tabela de ${DIA}, com menos viagens: num dia útil a espera costuma ser menor, mas o trânsito do pico pesa no sentido contrário.`;
  const tempo = (m) => (m < 60 ? `${nf0.format(m)} min` : `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, "0")}`);

  const secao = document.getElementById("trajeto");
  const metodoDia = document.getElementById("metodo-dia");
  if (metodoDia && T) {
    metodoDia.textContent = (DIA === "dia útil" ? "num dia útil" : `num ${DIA} (o GTFS da ETUFOR em uso não traz as viagens de dia útil)`)
      + (TABELA ? `, com a tabela de horários da ETUFOR de ${TABELA}` : "")
      + (!TABELA_ANTIGA ? "" : DIA === "dia útil"
        ? " (a mais recente publicada com as viagens de dia útil; linhas criadas ou alteradas depois dela não aparecem)"
        : " (linhas criadas ou alteradas depois dela não aparecem)");
    const pico = document.getElementById("metodo-pico");
    if (pico && DIA !== "dia útil") pico.textContent = `É tempo de tabela: ${RESSALVA}`;
  }
  const box = document.getElementById("tj-resultado");
  const selO = document.getElementById("tj-origem");
  const selD = document.getElementById("tj-destino");

  if (!T) {
    secao.classList.add("sem-dados");
    [selO, selD, document.getElementById("tj-trocar")].forEach((x) => { x.disabled = true; });
    box.replaceChildren(
      el("p", { class: "tj-vazio-titulo", texto: "Os tempos de ônibus ainda não foram calculados." }),
      el("p", { class: "tj-vazio" }, [
        "Rode ", el("code", { texto: "python scripts/12_transporte.py" }),
        " (precisa de Java 21 e do pacote r5py). Ele baixa o GTFS da ETUFOR e do Metrofor e as ruas do OpenStreetMap, calcula as rotas e gera os arquivos que esta seção lê.",
      ]),
    );
    return;
  }

  // ---------- nomes e índices ----------
  const BAIRROS = D.geojson.features.map((f) => f.properties).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const NOME = new Map(BAIRROS.map((p) => [`b${p.id}`, p.nome]));
  T.polos.forEach((p) => NOME.set(p.id, p.nome));
  const IDX = new Map(T.destinos.map((id, i) => [id, i]));
  const porNome = (n) => BAIRROS.find((p) => p.nome === n);

  const estado = {
    o: `b${(porNome("Jangurussu") || BAIRROS[0]).id}`,
    d: T.polos.some((p) => p.id === "p_aldeota") ? "p_aldeota" : T.polos[0].id,
    opcao: 0,
  };

  // ---------- formulário ----------
  selO.replaceChildren(...BAIRROS.map((p) => el("option", { value: `b${p.id}`, texto: p.nome })));
  selD.replaceChildren(
    el("optgroup", { label: "Polos da cidade" }, T.polos.map((p) => el("option", { value: p.id, texto: p.nome }))),
    el("optgroup", { label: "Bairros" }, BAIRROS.map((p) => el("option", { value: `b${p.id}`, texto: p.nome }))),
  );
  const polosEl = document.getElementById("tj-polos");
  polosEl.replaceChildren(...T.polos.map((p) => {
    const b = el("button", { type: "button", "data-d": p.id, "aria-pressed": "false", texto: p.nome.replace(/ \(.*\)$/, "") });
    b.addEventListener("click", () => { estado.d = p.id; estado.opcao = 0; atualizar(); });
    return b;
  }));
  selO.addEventListener("change", () => { estado.o = selO.value; estado.opcao = 0; atualizar(); });
  selD.addEventListener("change", () => { estado.d = selD.value; estado.opcao = 0; atualizar(); });
  document.getElementById("tj-trocar").addEventListener("click", () => {
    // destino polo não vira origem (as saídas são bairros): troca pelo bairro do polo
    const polo = T.polos.find((p) => p.id === estado.d);
    const novoO = polo ? `b${polo.bairro}` : estado.d;
    estado.d = estado.o; estado.o = novoO; estado.opcao = 0;
    atualizar();
  });
  // a ficha do bairro no mapa principal pode mandar "ver rotas a partir daqui"
  document.addEventListener("trajeto-origem", (e) => {
    estado.o = `b${e.detail}`; estado.opcao = 0; atualizar();
    secao.scrollIntoView({ behavior: REDUZIR ? "auto" : "smooth" });
  });

  // ---------- arquivos sob demanda ----------
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

  // ---------- mapa ----------
  const mapa = L.map("mapa-trajeto", { zoomSnap: 0.25, minZoom: 10.5, maxZoom: 16, scrollWheelZoom: false });
  document.getElementById("mapa-trajeto").addEventListener("click", () => mapa.scrollWheelZoom.enable(), { once: true });
  const fundo = L.geoJSON(D.geojson, {
    interactive: false,
    style: { fillColor: COR.papel, fillOpacity: 1, color: COR.linha, weight: 0.8 },
  }).addTo(mapa);
  mapa.fitBounds(fundo.getBounds(), { padding: [12, 12] });
  mapa.createPane("rota").style.zIndex = 450;
  const camadaRota = L.layerGroup().addTo(mapa);

  function pintarFundo() {
    const bo = +estado.o.slice(1);
    const polo = T.polos.find((p) => p.id === estado.d);
    const bd = polo ? polo.bairro : +estado.d.slice(1);
    fundo.setStyle((f) => ({
      fillColor: f.properties.id === bo || f.properties.id === bd ? COR.s1 : COR.papel,
      fillOpacity: f.properties.id === bo || f.properties.id === bd ? 0.55 : 1,
      color: COR.linha, weight: 0.8,
    }));
  }

  const pino = (txt, classe) => L.divIcon({ className: `tj-pin ${classe}`, html: `<span>${txt}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });

  // trecho da linha entre a parada de subida e a de descida, no sentido certo: projeta as duas
  // paradas no traçado e fica só com os vértices entre elas
  function trecho(chave, a, b) {
    const formas = (window.TRANSPORTE_LINHAS || {})[chave];
    if (!formas || !a || !b) return [a, b].filter(Boolean);
    const k = Math.cos((-3.75 * Math.PI) / 180);
    const xy = (p) => [p[1] * k, p[0]];
    function projetar(f, p) { // -> { pos: índice + fração, d: distância² }
      const [px, py] = xy(p);
      let melhor = { pos: 0, d: Infinity };
      for (let i = 0; i < f.length - 1; i++) {
        const [x1, y1] = xy(f[i]), [x2, y2] = xy(f[i + 1]);
        const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1e-12;
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
        const d = (x1 + t * dx - px) ** 2 + (y1 + t * dy - py) ** 2;
        if (d < melhor.d) melhor = { pos: i + t, d };
      }
      return melhor;
    }
    let melhor = null;
    for (const f of formas) {
      if (f.length < 2) continue;
      const pa = projetar(f, a), pb = projetar(f, b);
      if (pa.pos < pb.pos && (!melhor || pa.d + pb.d < melhor.custo)) {
        melhor = { custo: pa.d + pb.d, pts: f.filter((_, i) => i > pa.pos && i < pb.pos) };
      }
    }
    return melhor ? [a, ...melhor.pts, b] : [a, b];
  }

  function desenhar(op, paradas) {
    camadaRota.clearLayers();
    const pO = T.pontos[estado.o], pD = T.pontos[estado.d];
    if (!pO || !pD) return;
    const coord = (id) => (paradas && paradas[id] && paradas[id][1] != null ? [paradas[id][1], paradas[id][2]] : null);
    const segs = [];
    let cursor = pO;
    if (op) {
      op.p.forEach((p, i) => {
        if (p[0] === "a") {
          const prox = op.p.slice(i + 1).find((q) => q[0] === "l");
          const fim = prox ? coord(prox[4]) || pD : pD;
          segs.push({ tipo: "pe", pts: [cursor, fim] }); cursor = fim;
        } else {
          const a = coord(p[4]) || cursor, b = coord(p[5]) || pD;
          if (Math.abs(a[0] - cursor[0]) + Math.abs(a[1] - cursor[1]) > 1e-4) segs.push({ tipo: "pe", pts: [cursor, a] });
          const modo = (T.linhas[p[1]] || [])[2] || "onibus";
          segs.push({ tipo: modo === "onibus" ? "onibus" : "metro", pts: trecho(p[1], a, b), parada: b });
          cursor = b;
        }
      });
      if (Math.abs(cursor[0] - pD[0]) + Math.abs(cursor[1] - pD[1]) > 1e-4) segs.push({ tipo: "pe", pts: [cursor, pD] });
    } else {
      segs.push({ tipo: "pe", pts: [pO, pD], fantasma: true });
    }
    segs.forEach((s) => {
      if (s.tipo === "pe") {
        L.polyline(s.pts, { pane: "rota", color: COR.pe, weight: 3, dashArray: s.fantasma ? "1 8" : "2 7", lineCap: "round", className: "tj-linha" }).addTo(camadaRota);
      } else {
        L.polyline(s.pts, { pane: "rota", color: COR.branco, weight: 9, opacity: 0.9, lineCap: "round", lineJoin: "round", interactive: false }).addTo(camadaRota);
        L.polyline(s.pts, { pane: "rota", color: s.tipo === "metro" ? COR.metro : COR.onibus, weight: 4.5, lineCap: "round", lineJoin: "round", className: "tj-linha" }).addTo(camadaRota);
      }
    });
    // baldeações: onde desce de uma linha para pegar outra
    segs.filter((s, i) => s.parada && segs.slice(i + 1).some((q) => q.tipo !== "pe")).forEach((s) =>
      L.circleMarker(s.parada, { pane: "rota", radius: 5, color: COR.escuro, weight: 2, fillColor: COR.branco, fillOpacity: 1 }).addTo(camadaRota));
    L.marker(pO, { icon: pino("A", "tj-pin-a"), keyboard: false, zIndexOffset: 1000 }).addTo(camadaRota);
    L.marker(pD, { icon: pino("B", "tj-pin-b"), keyboard: false, zIndexOffset: 1000 }).addTo(camadaRota);
    const limites = L.latLngBounds(segs.flatMap((s) => s.pts));
    mapa.flyToBounds(limites, { padding: [48, 48], maxZoom: 15, duration: REDUZIR ? 0 : 0.7 });
    if (!REDUZIR) animar();
  }

  // a rota se desenha da saída à chegada, trecho por trecho
  function animar() {
    requestAnimationFrame(() => {
      let atraso = 350;
      document.querySelectorAll("#mapa-trajeto .leaflet-rota-pane path.tj-linha").forEach((p) => {
        const n = p.getTotalLength(), dur = Math.min(900, 250 + n * 1.2);
        const traco = p.getAttribute("stroke-dasharray");
        p.style.strokeDasharray = n; p.style.strokeDashoffset = n;
        p.getBoundingClientRect();
        p.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(.4,.1,.2,1) ${atraso}ms`;
        p.style.strokeDashoffset = 0;
        p.addEventListener("transitionend", () => { p.style.strokeDasharray = traco || ""; p.style.strokeDashoffset = ""; p.style.transition = ""; }, { once: true });
        atraso += dur * 0.85;
      });
    });
  }

  // ---------- resultado ----------
  const ICONE_PE = '<svg viewBox="0 0 7 9" aria-hidden="true"><rect x="3" y="0" width="2" height="2"/><rect x="2" y="2" width="3" height="3"/><rect x="1" y="3" width="1" height="2"/><rect x="5" y="3" width="1" height="1"/><rect x="2" y="5" width="1" height="4"/><rect x="4" y="5" width="1" height="2"/><rect x="5" y="7" width="1" height="2"/></svg>';

  function rolar(no, ate) {
    const de = +no.dataset.v || 0;
    no.dataset.v = ate;
    if (REDUZIR || !de) { no.textContent = tempo(ate); return; }
    const t0 = performance.now();
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / 600), e = 1 - Math.pow(1 - k, 3);
      no.textContent = tempo(de + (ate - de) * e);
      if (k < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  // `curto`: no passo a passo o selo fica numa coluna estreita; metrô e VLT, que não têm número,
  // aparecem como "Sul", "Oeste" e "VLT" (o nome inteiro vai no título do passo)
  function badge(chave, curto = false) {
    const [nome, , modo] = T.linhas[chave] || ["?", "", "onibus"];
    let txt = nome || (modo === "onibus" ? "ônibus" : modo);
    if (curto && modo !== "onibus") txt = /^VLT/i.test(txt) ? "VLT" : txt.replace(/^Linha\s+/i, "");
    return el("span", { class: `tj-badge tj-${modo === "onibus" ? "onibus" : "metro"}`, texto: txt, title: nome || null });
  }

  function resumoOpcao(op) {
    return op.p.flatMap((p, i) => [
      i ? el("span", { class: "tj-seta", "aria-hidden": "true", texto: "›" }) : null,
      p[0] === "a" ? el("span", { class: "tj-pe", "aria-label": `${p[1]} min a pé` }, [el("i", { "aria-hidden": "true" }), `${p[1]}`]) : badge(p[1]),
    ]);
  }

  function passos(op, paradas) {
    const nomeParada = (id) => (paradas && paradas[id] && paradas[id][0]) || "a parada";
    return el("ol", { class: "tj-passos" }, op.p.map((p, i) => {
      if (p[0] === "a") {
        const prox = op.p.slice(i + 1).find((q) => q[0] === "l");
        const alvo = prox ? `até ${nomeParada(prox[4])}` : `até ${NOME.get(estado.d)}`;
        return el("li", { class: "tj-passo-pe", style: `--i:${i}` }, [
          el("span", { class: "tj-passo-icone", "aria-hidden": "true", html: ICONE_PE }),
          el("div", {}, [el("b", { texto: `Caminhe ${tempo(p[1])}` }), el("span", { texto: alvo })]),
        ]);
      }
      const [curto, longo] = T.linhas[p[1]] || ["", ""];
      return el("li", { class: "tj-passo-linha", style: `--i:${i}` }, [
        badge(p[1], true),
        el("div", {}, [
          el("b", { texto: longo || `Linha ${curto}` }),
          el("span", { texto: `Suba em ${nomeParada(p[4])}${p[3] ? ` · espera de ~${tempo(p[3])}` : ""}` }),
          el("span", { texto: `${tempo(p[2])} de viagem · desça em ${nomeParada(p[5])}` }),
        ]),
      ]);
    }));
  }

  let pedido = 0;
  async function atualizar() {
    const meu = ++pedido;
    selO.value = estado.o; selD.value = estado.d;
    polosEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.d === estado.d)));
    pintarFundo();

    if (estado.o === estado.d) {
      box.replaceChildren(el("p", { class: "tj-vazio-titulo", texto: "Saída e chegada são o mesmo bairro." }), el("p", { class: "tj-vazio", texto: "Escolha outro destino." }));
      camadaRota.clearLayers();
      return;
    }
    const t = T.tempos[estado.o], i = IDX.get(estado.d);
    const p25 = t ? t[0][i] : null, p50 = t ? t[1][i] : null, p75 = t ? t[2][i] : null;

    let opcoes = [], paradas = null;
    if (T.meta.rotas && (!estado.d.startsWith("b") || T.meta.rotas_entre_bairros)) {
      try {
        await carregar(`transporte/o_${estado.o.slice(1)}.js`);
        const R = (window.ROTAS_TP || {})[estado.o];
        opcoes = (R && R.rotas[estado.d]) || [];
        paradas = R && R.paradas;
      } catch { opcoes = []; }
      if (opcoes.length) await carregar("transporte_linhas.js").catch(() => null);
    }
    if (meu !== pedido) return; // a pessoa já trocou de destino no meio do carregamento
    if (estado.opcao >= opcoes.length) estado.opcao = 0;

    // baldeação na mesma parada vira "caminhe 0 min": não é um passo
    opcoes = opcoes.map((op) => ({ ...op, p: op.p.filter((q) => q[0] !== "a" || q[1] >= 1) }));
    const cab = el("div", { class: "tj-cabeca" });
    if (p50 == null && opcoes.length) {
      // na maior parte da janela passa de 2h30, mas saindo às 7h há rota: mostra essa, com a ressalva
      const num = el("p", { class: "tj-tempo" });
      cab.append(
        el("p", { class: "tj-rotulo-res", texto: `${NOME.get(estado.o)} → ${NOME.get(estado.d)}` }),
        el("div", { class: "tj-tempo-linha" }, [el("span", { class: "tj-aprox", texto: "≈" }), num]),
        el("p", { class: "tj-faixa", texto: `saindo às ${T.meta.saida_rotas}. Em boa parte da manhã a viagem passa de ${tempo(T.meta.max_min)}.` }),
      );
      rolar(num, opcoes[0].t);
    } else if (p50 == null) {
      cab.append(el("p", { class: "tj-rotulo-res", texto: `${NOME.get(estado.o)} → ${NOME.get(estado.d)}` }),
        el("p", { class: "tj-vazio-titulo", texto: `Sem rota de transporte público em até ${tempo(T.meta.max_min)}.` }));
    } else {
      const num = el("p", { class: "tj-tempo", "data-v": box.querySelector(".tj-tempo")?.dataset.v || "" });
      cab.append(
        el("p", { class: "tj-rotulo-res", texto: `${NOME.get(estado.o)} → ${NOME.get(estado.d)}` }),
        el("div", { class: "tj-tempo-linha" }, [el("span", { class: "tj-aprox", texto: "≈" }), num]),
        el("p", { class: "tj-faixa", texto: p25 != null && p75 != null && p75 > p25
          ? `entre ${tempo(p25)} e ${tempo(p75)}, conforme o horário em que você sai (${T.meta.saida} às ${horaFim()}, ${DIA})`
          : `saindo entre ${T.meta.saida} e ${horaFim()}, num ${DIA}` }),
      );
      rolar(num, p50);
    }

    const lista = el("div", { class: "tj-opcoes" });
    if (opcoes.length) {
      lista.append(el("p", { class: "tj-sec", texto: `Como ir · saindo às ${T.meta.saida_rotas}` }));
      opcoes.forEach((op, k) => {
        const aberta = k === estado.opcao;
        const bt = el("button", { type: "button", class: "tj-opcao", "aria-expanded": String(aberta), style: `--i:${k}` }, [
          el("span", { class: "tj-opcao-topo" }, [
            el("span", { class: "tj-opcao-nome", texto: k === 0 ? "Mais rápida" : `Opção ${k + 1}` }),
            el("span", { class: "tj-opcao-tempo", texto: tempo(op.t) }),
          ]),
          el("span", { class: "tj-resumo" }, resumoOpcao(op)),
        ]);
        bt.addEventListener("click", () => { estado.opcao = k; atualizar(); });
        lista.append(el("div", { class: "tj-opcao-caixa" + (aberta ? " aberta" : "") }, [bt, aberta ? passos(op, paradas) : null]));
      });
    } else if (p50 != null) {
      const bairro = estado.d.startsWith("b");
      const msg = !T.meta.rotas ? "O passo a passo das linhas ainda não foi calculado: por enquanto aparece só o tempo estimado."
        : bairro && !T.meta.rotas_entre_bairros ? "Entre bairros aparece só o tempo. O passo a passo das linhas está calculado até os polos: escolha um deles acima para ver como ir."
        : "As linhas desta viagem não foram encontradas no arquivo de rotas.";
      lista.append(el("p", { class: "tj-vazio", texto: msg }));
    }
    box.replaceChildren(cab, lista, el("p", { class: "tj-nota", texto: `Tempo de tabela da ETUFOR${TABELA ? ` (${TABELA})` : ""} e do Metrofor: ${RESSALVA}` }));
    desenhar(opcoes[estado.opcao] || null, paradas);
    legenda(opcoes.length > 0);
  }

  function horaFim() {
    const [h, m] = T.meta.saida.split(":").map(Number);
    const t = h * 60 + m + T.meta.janela_min;
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }

  function legenda(comRota) {
    const temMetro = Object.values(T.linhas).some((l) => l[2] !== "onibus");
    document.getElementById("tj-legenda").replaceChildren(...[
      el("p", { class: "legenda-titulo", texto: "Rota" }),
      el("p", { class: "tj-leg" }, [el("i", { class: "tj-leg-onibus", "aria-hidden": "true" }), "ônibus"]),
      temMetro ? el("p", { class: "tj-leg" }, [el("i", { class: "tj-leg-metro", "aria-hidden": "true" }), "metrô / VLT"]) : null,
      el("p", { class: "tj-leg" }, [el("i", { class: "tj-leg-pe", "aria-hidden": "true" }), comRota ? "a pé" : "sem rota detalhada"]),
    ].filter(Boolean));
  }

  // link vindo do "Onde morar": #rota=<bairro>:<destino>
  const doLink = /^#rota=(\d+):([\w]+)$/.exec(location.hash);
  if (doLink && NOME.has(`b${doLink[1]}`) && IDX.has(doLink[2])) {
    estado.o = `b${doLink[1]}`; estado.d = doLink[2];
    requestAnimationFrame(() => secao.scrollIntoView());
  }
  atualizar();
})();
