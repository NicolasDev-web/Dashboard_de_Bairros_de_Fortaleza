/* Bairros de Fortaleza — o bairro em 3D. Ao receber o evento "bairro-3d" (id do bairro), abre uma camada em
   tela cheia: o contorno do bairro sobe do chão, as miniaturas dos marcos (marcos/*.glb) pousam em cima e a
   câmera percorre os capítulos da história (historias.js). O three.js só é baixado na primeira abertura. */

const D = window.DADOS;
const H = window.HISTORIAS || {};
const M = window.MARCOS || {};
const POR_ID = new Map(D.geojson.features.map((f) => [f.properties.id, f]));
const REDUZIR = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const RAMPA = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6"].map(css);
const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const S = 200; // maior extensão do bairro, em unidades da cena
const ALT = 7; // altura da laje do bairro
const FUNDO = 0x2a31b8; // --cobalto-fundo

const el = (tag, attrs = {}, filhos = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "texto") n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const f of [].concat(filhos)) if (f != null) n.append(f);
  return n;
};

/** Curva da casa (--curva: cubic-bezier(.2, .7, .1, 1)) resolvida por Newton */
function bezier(x1, y1, x2, y2) {
  const b = (u, a, c) => 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * c + u * u * u;
  const db = (u, a, c) => 3 * (1 - u) * (1 - u) * a + 6 * (1 - u) * u * (c - a) + 3 * u * u * (1 - c);
  return (t) => {
    let u = t;
    for (let i = 0; i < 8; i++) {
      const x = b(u, x1, x2) - t, d = db(u, x1, x2);
      if (Math.abs(x) < 1e-5 || Math.abs(d) < 1e-6) break;
      u -= x / d;
    }
    return b(Math.min(1, Math.max(0, u)), y1, y2);
  };
}
const CURVA = bezier(0.2, 0.7, 0.1, 1);
const MOLA = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }; // easeOutBack

// ---------------------------------------------------------------------------------------------------------
// three.js sob demanda
// ---------------------------------------------------------------------------------------------------------
let T = null; // { THREE, OrbitControls, GLTFLoader, MeshoptDecoder, mesclar }
async function carregarThree() {
  if (T) return T;
  const [THREE, { OrbitControls }, { GLTFLoader }, { mergeGeometries }, { MeshoptDecoder }] = await Promise.all([
    import("three"),
    import("three/addons/controls/OrbitControls.js"),
    import("three/addons/loaders/GLTFLoader.js"),
    import("three/addons/utils/BufferGeometryUtils.js"),
    import("three/addons/libs/meshopt_decoder.module.js"), // os GLB da oficina (marcos3d/) saem comprimidos com meshopt
  ]);
  T = { THREE, OrbitControls, GLTFLoader, MeshoptDecoder, mesclar: mergeGeometries };
  return T;
}

const cacheGLB = new Map(); // arquivo -> Promise<Object3D>
function carregarMarco(arquivo) {
  if (!cacheGLB.has(arquivo)) {
    const loader = new T.GLTFLoader().setMeshoptDecoder(T.MeshoptDecoder);
    cacheGLB.set(arquivo, loader.loadAsync(`marcos/${arquivo}`).then((g) => {
      // marcadas para o descarte do bairro não apagar o cache (clone() copia o userData)
      g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.doMarco = true; } });
      return g.scene;
    }).catch((e) => { cacheGLB.delete(arquivo); throw e; }));
  }
  return cacheGLB.get(arquivo);
}

// ---------------------------------------------------------------------------------------------------------
// geografia: lon/lat -> unidades da cena (x = leste, z = sul; o norte fica em −z, como nas miniaturas)
// ---------------------------------------------------------------------------------------------------------
function projecao(f) {
  const anel = f.geometry.coordinates[0];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [lon, lat] of anel) { x0 = Math.min(x0, lon); x1 = Math.max(x1, lon); y0 = Math.min(y0, lat); y1 = Math.max(y1, lat); }
  const lon0 = (x0 + x1) / 2, lat0 = (y0 + y1) / 2;
  const kx = Math.cos((lat0 * Math.PI) / 180) * 111320, ky = 110540;
  const ext = Math.max((x1 - x0) * kx, (y1 - y0) * ky);
  const k = S / ext; // unidades por metro
  return {
    metrosPorUnidade: 1 / k,
    xz: (lon, lat) => [(lon - lon0) * kx * k, -(lat - lat0) * ky * k],
  };
}

// ---------------------------------------------------------------------------------------------------------
// camada (diálogo)
// ---------------------------------------------------------------------------------------------------------
const dlg = document.getElementById("b3d");
let ui = null;
function montarUI() {
  if (ui) return ui;
  const palco = el("div", { class: "b3d-palco" });
  const etiquetas = el("div", { class: "b3d-etiquetas", "aria-hidden": "true" });
  const fechar = el("button", { type: "button", class: "b3d-fechar", "aria-label": "Fechar e voltar ao mapa", texto: "×" });
  const nome = el("h2", { id: "b3d-nome" });
  const progresso = el("div", { class: "b3d-progresso", role: "group", "aria-label": "Capítulos" });
  const passo = el("p", { class: "b3d-passo" });
  const destaque = el("figure", { class: "b3d-destaque" });
  const titulo = el("h3", { class: "b3d-titulo" });
  const texto = el("div", { class: "b3d-corpo" });
  const fonte = el("details", { class: "b3d-fontes" });
  const ant = el("button", { type: "button", class: "botao botao-contorno-claro b3d-ant" }, [el("span", { class: "botao-icone", "aria-hidden": "true", texto: "←" }), "Anterior"]);
  const prox = el("button", { type: "button", class: "botao botao-claro b3d-prox", autofocus: "" }, [el("span", { class: "botao-icone", "aria-hidden": "true", texto: "→" }), el("span", { texto: "Próximo" })]);
  const conteudo = el("div", { class: "b3d-conteudo", "aria-live": "polite" }, [passo, destaque, titulo, texto, fonte]);
  const painel = el("article", { class: "b3d-painel" }, [
    el("div", { class: "b3d-cabeca" }, [nome, progresso]),
    conteudo,
    el("div", { class: "b3d-nav" }, [ant, prox]),
  ]);
  const aviso = el("p", { class: "b3d-aviso", texto: "Carregando a maquete…" });
  const dica = el("p", { class: "b3d-dica", texto: "Arraste para girar a maquete. As setas mudam de capítulo; Esc fecha." });
  dlg.replaceChildren(palco, etiquetas, el("header", { class: "b3d-topo" }, [fechar]), painel, aviso, dica);

  fechar.addEventListener("click", () => dlg.close());
  ant.addEventListener("click", () => irPara(estado.cap - 1));
  prox.addEventListener("click", () => (estado.cap < estado.caps.length - 1 ? irPara(estado.cap + 1) : dlg.close()));
  dlg.addEventListener("close", aoFechar);
  dlg.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, select, textarea")) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); irPara(estado.cap + 1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); irPara(estado.cap - 1); }
  });
  // a rodinha sobre a maquete muda de capítulo (com folga, para um giro só não pular vários)
  let acumulado = 0, travado = 0;
  palco.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (performance.now() < travado) return;
    acumulado += e.deltaY;
    if (Math.abs(acumulado) > 60) {
      irPara(estado.cap + Math.sign(acumulado));
      acumulado = 0;
      travado = performance.now() + 900;
    }
  }, { passive: false });

  ui = { palco, etiquetas, nome, progresso, passo, destaque, titulo, texto, fonte, ant, prox, painel, aviso, conteudo };
  return ui;
}

// Dígitos em matriz de 5 × 7, como os pixels da cidade na abertura do site
const PIXELS = {
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
};
const NS = "http://www.w3.org/2000/svg";

/** O valor do destaque (só dígitos) em pixels; cada pixel aceso leva --i para a varredura da esquerda para a direita */
function pixels(valor) {
  const svg = document.createElementNS(NS, "svg");
  const digitos = String(valor).split("").filter((d) => PIXELS[d]);
  const passo = 8, lado = 6.4;
  svg.setAttribute("viewBox", `0 0 ${digitos.length * 6 * passo - passo} ${7 * passo}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", String(valor));
  digitos.forEach((d, k) => PIXELS[d].forEach((linha, y) => [...linha].forEach((on, x) => {
    const r = document.createElementNS(NS, "rect");
    const col = k * 6 + x;
    r.setAttribute("x", col * passo); r.setAttribute("y", y * passo);
    r.setAttribute("width", lado); r.setAttribute("height", lado);
    if (on === "1") r.style.setProperty("--i", col + y * 0.35);
    else r.setAttribute("class", "apagado");
    svg.append(r);
  })));
  return svg;
}

// ---------------------------------------------------------------------------------------------------------
// cena
// ---------------------------------------------------------------------------------------------------------
let R = null; // { renderer, scene, camera, controls, luz }
function montarCena() {
  if (R) return R;
  const { THREE, OrbitControls } = T;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(FUNDO, 1);
  ui.palco.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FUNDO, S * 2.6, S * 6);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a42c8, 1.5));
  const luz = new THREE.DirectionalLight(0xffffff, 2.4);
  luz.position.set(-S * 0.6, S * 1.1, -S * 0.35);
  luz.castShadow = true;
  luz.shadow.mapSize.set(2048, 2048);
  Object.assign(luz.shadow.camera, { left: -S * 0.8, right: S * 0.8, top: S * 0.8, bottom: -S * 0.8, near: 1, far: S * 4 });
  luz.shadow.bias = -0.0004;
  luz.shadow.normalBias = 0.6;
  scene.add(luz, luz.target);

  // grão de pixels no chão, como no fundo da abertura
  const cv = document.createElement("canvas");
  cv.width = cv.height = 32;
  const g = cv.getContext("2d");
  g.fillStyle = "rgba(255,255,255,.22)";
  g.fillRect(15, 15, 3, 3);
  const grao = new THREE.CanvasTexture(cv);
  grao.wrapS = grao.wrapT = THREE.RepeatWrapping;
  grao.repeat.set(140, 140);
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(S * 10, S * 10), new THREE.MeshBasicMaterial({ map: grao, transparent: true, depthWrite: false }));
  chao.rotation.x = -Math.PI / 2;
  chao.position.y = -0.05;
  scene.add(chao);
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(S * 4, S * 4), new THREE.ShadowMaterial({ opacity: 0.28 }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.receiveShadow = true;
  scene.add(sombra);

  const camera = new THREE.PerspectiveCamera(32, 1, 1, S * 12);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.08, enablePan: false, enableZoom: false,
    minPolarAngle: 0.25, maxPolarAngle: 1.32, autoRotateSpeed: 0.5, rotateSpeed: 0.6,
  });
  controls.addEventListener("start", () => { estado.tween = null; controls.autoRotate = false; });

  R = { renderer, scene, camera, controls, luz };
  new ResizeObserver(redimensionar).observe(ui.palco);
  return R;
}

function redimensionar() {
  if (!R) return;
  const w = ui.palco.clientWidth, h = ui.palco.clientHeight;
  if (!w || !h) return;
  R.renderer.setSize(w, h, false);
  R.camera.aspect = w / h;
  // o painel de texto cobre parte da tela: desloca o centro da imagem para o espaço livre
  const p = ui.painel.getBoundingClientRect();
  const lado = w > 820; // painel à esquerda; abaixo disso, folha embaixo
  R.camera.setViewOffset(w, h, lado ? -p.right / 2 : 0, lado ? 0 : (h - p.top) / 2, w, h);
  R.camera.updateProjectionMatrix();
  // largura livre sobre a altura toda (o campo de visão vertical vale para a tela inteira)
  estado.aspecto = (lado ? w - p.right : w) / h;
  // a névoa começa depois do bairro, qualquer que seja a distância da vista geral
  R.scene.fog.near = raioGeral() * 1.45;
  R.scene.fog.far = raioGeral() * 3.4;
}

// ---------------------------------------------------------------------------------------------------------
// o bairro: laje, vizinhos, marcos e pinos
// ---------------------------------------------------------------------------------------------------------
const estado = { id: null, caps: [], cap: 0, grupo: null, alvos: [], tween: null, entrada: [], aspecto: 1.6, rodando: false, origem: null };

function corDoBairro(p) {
  const i = Math.min(5, Math.max(0, Math.floor((p.indice / 100) * 6)));
  return RAMPA[i];
}

// a forma é desenhada no plano (x, −z) e deitada com rotateX(−90°), que leva o y da forma para −z
function anelParaForma(THREE, anel, xz) {
  return anel.map(([lon, lat]) => { const [x, z] = xz(lon, lat); return new THREE.Vector2(x, -z); });
}

function montarBairro(f) {
  const { THREE, mesclar } = T;
  const pr = projecao(f);
  const grupo = new THREE.Group();

  // laje: o contorno extrudado, com a tampa mais clara que as paredes
  const [externo, ...buracos] = f.geometry.coordinates;
  const forma = new THREE.Shape(anelParaForma(THREE, externo, pr.xz));
  for (const b of buracos) forma.holes.push(new THREE.Path(anelParaForma(THREE, b, pr.xz)));
  const geo = new THREE.ExtrudeGeometry(forma, { depth: ALT, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  const base = new THREE.Color(corDoBairro(f.properties));
  const branco = new THREE.Color(0xffffff);
  const tampa = new THREE.MeshStandardMaterial({ color: base.clone().lerp(branco, 0.6), roughness: 0.92 });
  const parede = new THREE.MeshStandardMaterial({ color: base.clone().lerp(branco, 0.15), roughness: 0.85 });
  const laje = new THREE.Mesh(geo, [tampa, parede]);
  laje.castShadow = laje.receiveShadow = true;
  const contorno = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(externo.map(([lon, lat]) => { const [x, z] = pr.xz(lon, lat); return new THREE.Vector3(x, ALT + 0.08, z); })),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  );
  const subir = new THREE.Group();
  subir.add(laje, contorno);
  grupo.add(subir);

  // os outros bairros: só o traço e um véu claro, para situar o bairro na cidade
  const linhas = [], veus = [];
  for (const g of D.geojson.features) {
    if (g === f) continue;
    const anel = g.geometry.coordinates[0];
    const pts = anel.map(([lon, lat]) => pr.xz(lon, lat));
    if (pts.every(([x, z]) => Math.hypot(x, z) > S * 3)) continue;
    for (let i = 0; i < pts.length - 1; i++) linhas.push(pts[i][0], 0.06, pts[i][1], pts[i + 1][0], 0.06, pts[i + 1][1]);
    const s = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))));
    s.rotateX(-Math.PI / 2);
    veus.push(s);
  }
  const vizGeo = new THREE.BufferGeometry();
  vizGeo.setAttribute("position", new THREE.Float32BufferAttribute(linhas, 3));
  const vizinhos = new THREE.LineSegments(vizGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32 }));
  const veu = new THREE.Mesh(mesclar(veus), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, depthWrite: false }));
  veus.forEach((v) => v.dispose());
  veu.position.y = 0.02;
  grupo.add(vizinhos, veu);

  return { grupo, subir, pr, vizinhos, veu };
}

/** O marco real costuma ficar na beira do bairro (avenida de divisa): procura, para cada um, o ponto mais perto do
    real onde a base redonda de raio r cabe sobre a laje sem encostar nas outras. Testa as ordens possíveis (são no
    máximo dois ou três marcos) e fica com a de menor deslocamento total, para os marcos não trocarem de lado. */
function assentar(reais, anel, r) {
  if (!reais.length) return [];
  const dentro = (x, z) => {
    let c = false;
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const [xi, zi] = anel[i], [xj, zj] = anel[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  };
  const folga = (x, z) => {
    let d = Infinity;
    for (let i = 0; i < anel.length - 1; i++) {
      const [ax, az] = anel[i], [bx, bz] = anel[i + 1];
      const vx = bx - ax, vz = bz - az, l = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l));
      d = Math.min(d, Math.hypot(x - ax - t * vx, z - az - t * vz));
    }
    return d;
  };
  const celulas = [];
  const passo = S / 50;
  for (let x = -S * 0.6; x <= S * 0.6; x += passo) {
    for (let z = -S * 0.6; z <= S * 0.6; z += passo) {
      if (dentro(x, z)) celulas.push({ x, z, falta: Math.max(0, r * 0.92 - folga(x, z)) });
    }
  }
  if (!celulas.length) return reais;
  const ordens = (n) => (n <= 1 ? [[0]] : ordens(n - 1).flatMap((o) => o.map((_, i) => [...o.slice(0, i), n - 1, ...o.slice(i)]).concat([[...o, n - 1]])));
  let melhor = null, menor = Infinity;
  // até 5 marcos testa todas as ordens (120); acima disso, encaixa na ordem dada
  for (const ordem of reais.length <= 5 ? ordens(reais.length) : [reais.map((_, i) => i)]) {
    const postos = [], saida = [];
    let total = 0;
    for (const k of ordem) {
      const [x0, z0] = reais[k];
      let esc = celulas[0], nota = Infinity;
      for (const c of celulas) {
        const encosta = postos.reduce((s, o) => s + Math.max(0, 2.1 * r - Math.hypot(o[0] - c.x, o[1] - c.z)), 0);
        const n = Math.hypot(c.x - x0, c.z - z0) + 12 * c.falta + 12 * encosta;
        if (n < nota) { nota = n; esc = c; }
      }
      postos.push([esc.x, esc.z]);
      saida[k] = [esc.x, esc.z];
      total += nota;
    }
    // um par de marcos que troca de lado entre si (o de oeste indo para leste) custa caro
    for (let i = 0; i < reais.length; i++) for (let j = i + 1; j < reais.length; j++) {
      const dx = reais[j][0] - reais[i][0], dz = reais[j][1] - reais[i][1];
      if (dx * (saida[j][0] - saida[i][0]) + dz * (saida[j][1] - saida[i][1]) < 0) total += S;
    }
    if (total < menor) { menor = total; melhor = saida; }
  }
  return melhor;
}

function pino(THREE) {
  const g = new THREE.Group();
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 11, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
  haste.position.y = 5.5;
  const cabeca = new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 14), new THREE.MeshStandardMaterial({ color: 0xe8631e, roughness: 0.45, emissive: 0xe8631e, emissiveIntensity: 0.15 }));
  cabeca.position.y = 11.5;
  const aro = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.5, 32), new THREE.MeshBasicMaterial({ color: 0xe8631e, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  aro.rotation.x = -Math.PI / 2;
  aro.position.y = 0.1;
  haste.castShadow = cabeca.castShadow = true;
  g.add(haste, cabeca, aro);
  g.userData = { cabeca, aro, topo: 13.5 };
  return g;
}

// capítulos: os da história e, no fim, o bairro hoje pelos números do painel
function capitulosDe(p) {
  const h = H[p.id];
  const caps = h && h.capitulos && h.capitulos.length ? h.capitulos.map((c) => ({ ...c })) : [{
    tipo: "bairro", titulo: p.nome, texto: ["A história deste bairro ainda não foi escrita aqui. Os números de hoje estão no próximo capítulo."], fonte: [],
  }];
  const pos = [...D.geojson.features].sort((a, b) => b.properties.indice - a.properties.indice).findIndex((g) => g.properties.id === p.id) + 1;
  const vr = p.var_renda_real_pct;
  caps.push({
    tipo: "hoje", titulo: "O bairro hoje",
    destaque: { valor: String(Math.round(p.indice)), legenda: `de 100 no índice do painel: ${pos}º de 121 bairros` },
    texto: [
      `${nf0.format(p.pop_2022)} moradores no Censo de 2022, em ${String(p.area_km2).replace(".", ",")} km². No índice do painel, com pesos iguais para renda, saneamento e segurança, ${nf0.format(p.indice)} de 100: ${pos}º de 121.`,
      `Renda média de quem sustenta a casa: R$ ${nf0.format(p.renda_real_2022)} por mês, ${nf0.format(Math.abs(vr))}% ${vr >= 0 ? "acima" : "abaixo"} da de 2010, já descontada a inflação. Esgoto em rede: ${nf0.format(p.saneamento_2022)}% das casas.`,
    ],
    fonte: [{ nome: "IBGE, Censos 2010 e 2022; SSPDS (ver “De onde vêm os números”)", url: "#metodo" }],
  });
  return caps;
}

function marcosDoBairro(caps) {
  const vistos = new Map();
  for (const c of caps) if (c.tipo === "marco" && M[c.marco] && !vistos.has(c.marco)) vistos.set(c.marco, c);
  return [...vistos.values()];
}

async function abrir(id) {
  const f = POR_ID.get(id);
  if (!f) return;
  const p = f.properties;
  montarUI();
  if (!dlg.open) {
    estado.origem = document.activeElement;
    dlg.showModal();
    document.documentElement.classList.add("b3d-aberto");
  }
  limparBairro();
  dlg.classList.remove("b3d-so-texto");
  estado.id = id;
  estado.caps = capitulosDe(p);
  estado.cap = 0;
  ui.nome.replaceChildren(p.nome, " ", el("small", { texto: `Regional ${p.regional}` }));
  dlg.setAttribute("aria-labelledby", "b3d-nome");
  ui.progresso.replaceChildren(...estado.caps.map((c, i) => {
    const b = el("button", { type: "button", "aria-label": `Capítulo ${i + 1}: ${c.titulo}`, title: c.titulo });
    b.addEventListener("click", () => irPara(i));
    return b;
  }));
  history.replaceState(null, "", `#b3d=${id}`);
  mostrarTexto();

  try {
    ui.aviso.hidden = false;
    await carregarThree();
    if (estado.id !== id) return;
    if (!montarCena()) throw new Error("sem WebGL");
  } catch (e) {
    dlg.classList.add("b3d-so-texto");
    ui.aviso.textContent = "Não deu para abrir a maquete 3D neste navegador. A história continua aqui.";
    return;
  }
  ui.aviso.hidden = true;
  redimensionar();
  montarMaquete(f);
  ligarLaco();
}

function montarMaquete(f) {
  const { THREE } = T;
  const id = f.properties.id;
  const b = montarBairro(f);
  estado.grupo = b.grupo;
  R.scene.add(b.grupo);
  const agora = performance.now();
  const dur = REDUZIR ? 0 : 1;

  // a laje sobe do chão
  b.subir.scale.y = REDUZIR ? 1 : 0.001;
  estado.entrada.push({ t0: agora, d: 1100 * dur, f: (t) => { b.subir.scale.y = Math.max(0.001, CURVA(t)); } });
  b.vizinhos.material.opacity = 0;
  b.veu.material.opacity = 0;
  estado.entrada.push({ t0: agora, d: 900 * dur, f: (t) => { b.vizinhos.material.opacity = 0.32 * t; b.veu.material.opacity = 0.06 * t; } });

  // alvos de câmera e etiquetas: um por capítulo
  const marcos = marcosDoBairro(estado.caps);
  // diâmetro da base de cada miniatura, em fração do bairro: encolhe com a quantidade (o Centro tem 5)
  const frac = Math.max(0.15, 0.33 / Math.sqrt(Math.max(1, marcos.length)) * (marcos.length > 1 ? 1.15 : 1));
  const posMarco = new Map();
  const anel = f.geometry.coordinates[0].map(([lon, lat]) => b.pr.xz(lon, lat));
  const reais = marcos.map((c) => b.pr.xz(c.lng ?? M[c.marco].lng, c.lat ?? M[c.marco].lat));
  assentar(reais, anel, (frac * S) / 2).forEach(([x, z], k) => posMarco.set(marcos[k].marco, new THREE.Vector3(x, ALT, z)));
  const pinos = new Map();
  let ordem = 0;
  estado.caps.forEach((c, i) => {
    if (c.tipo === "ponto" && c.lat != null) {
      const g = pino(THREE);
      const [x, z] = b.pr.xz(c.lng, c.lat);
      g.position.set(x, ALT, z);
      b.grupo.add(g);
      pinos.set(i, g);
      const atraso = 1000 + ordem++ * 140;
      if (!REDUZIR) {
        g.visible = false;
        estado.entrada.push({ t0: agora + atraso, d: 650, f: (t) => { g.visible = true; g.position.y = ALT + 40 * (1 - CURVA(t)); } });
      }
      const et = el("span", { class: "b3d-etiqueta", texto: c.rotulo || c.titulo });
      ui.etiquetas.append(et);
      estado.alvos.push({ cap: i, obj: g, alto: g.userData.topo + 2, et });
    }
  });
  estado.pinos = pinos;

  for (const c of marcos) {
    const m = M[c.marco];
    const pos = posMarco.get(c.marco);
    const slot = new THREE.Group();
    slot.position.copy(pos);
    b.grupo.add(slot);
    const et = el("span", { class: "b3d-etiqueta b3d-etiqueta-marco", texto: m.rotulo || m.nome });
    ui.etiquetas.append(et);
    const alvo = { marco: c.marco, obj: slot, alto: m.altura * 1.15, et, pronto: false };
    estado.alvos.push(alvo);
    carregarMarco(m.arquivo).then((cena) => {
      if (estado.id !== id) return;
      const modelo = cena.clone();
      const caixa = new THREE.Box3().setFromObject(modelo);
      const diam = Math.max(caixa.max.x - caixa.min.x, caixa.max.z - caixa.min.z);
      const esc = (frac * S) / diam;
      alvo.alto = (m.altura + 4) * esc;
      alvo.pronto = true;
      slot.add(modelo);
      const t0 = Math.max(performance.now(), agora + 550 * dur);
      if (REDUZIR) slot.scale.setScalar(esc);
      else {
        slot.scale.setScalar(0.0001);
        estado.entrada.push({ t0, d: 900, f: (t) => { slot.scale.setScalar(Math.max(0.0001, esc * MOLA(t))); slot.position.y = pos.y + 18 * (1 - CURVA(t)); } });
      }
      if (estado.caps[estado.cap].marco === c.marco) voar(false);
    }).catch(() => { et.textContent = `${m.nome} (não carregou)`; });
  }
  estado.posMarco = posMarco;
  estado.frac = frac;

  // câmera começa alta e longe e desce para a vista geral
  const { camera, controls } = R;
  controls.target.set(0, ALT * 0.5, 0);
  const r0 = raioGeral() * (REDUZIR ? 1 : 1.6);
  camera.position.set(Math.sin(-0.5) * Math.sin(0.5) * r0, Math.cos(0.5) * r0, Math.cos(-0.5) * Math.sin(0.5) * r0);
  controls.update();
  irPara(0, true);
}

function raioGeral() {
  // a vista geral enquadra o bairro inteiro; em tela estreita, afasta até caber na largura
  return S * Math.max(1.75, 0.62 / (Math.tan((16 * Math.PI) / 180) * estado.aspecto));
}

function vistaDoCapitulo(c) {
  const { THREE } = T;
  if (c.tipo === "marco" && estado.posMarco && estado.posMarco.has(c.marco)) {
    const p = estado.posMarco.get(c.marco);
    const r = estado.frac * S * 1.9 * Math.max(1, 1.2 / estado.aspecto);
    const a = estado.alvos.find((x) => x.marco === c.marco);
    return { alvo: new THREE.Vector3(p.x, ALT + (a ? a.alto * 0.3 : 4), p.z), raio: r, polar: 0.98, giro: false };
  }
  if (c.tipo === "ponto" && estado.pinos && estado.pinos.has(estado.cap)) {
    const g = estado.pinos.get(estado.cap);
    return { alvo: new THREE.Vector3(g.position.x, ALT + 6, g.position.z), raio: S * 0.8 * Math.max(1, 1.2 / estado.aspecto), polar: 0.92, giro: false };
  }
  return { alvo: new THREE.Vector3(0, ALT * 0.5, 0), raio: raioGeral(), polar: 0.9, giro: true };
}

/** Leva a câmera ao alvo do capítulo atual, interpolando em coordenadas esféricas em volta do alvo */
function voar(instantaneo) {
  if (!R || !estado.grupo) return;
  const { THREE } = T;
  const { camera, controls } = R;
  const v = vistaDoCapitulo(estado.caps[estado.cap]);
  const de = { alvo: controls.target.clone(), esf: new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)) };
  // mantém o lado de onde se olha, com um pequeno giro para dar movimento
  let theta = de.esf.theta + (instantaneo || REDUZIR ? 0 : 0.35);
  const para = { alvo: v.alvo, esf: new THREE.Spherical(v.raio, v.polar, theta) };
  controls.autoRotate = v.giro && !REDUZIR;
  if (instantaneo === true && REDUZIR) {
    controls.target.copy(para.alvo);
    camera.position.setFromSpherical(para.esf).add(para.alvo);
    controls.update();
    estado.tween = null;
    return;
  }
  estado.tween = { t0: performance.now(), d: REDUZIR ? 1 : 1300, de, para };
}

function irPara(i, primeiro = false) {
  if (i < 0 || i >= estado.caps.length) return;
  estado.cap = i;
  mostrarTexto();
  voar(primeiro);
}

function mostrarTexto() {
  const c = estado.caps[estado.cap];
  const n = estado.caps.length;
  ui.passo.textContent = `Capítulo ${estado.cap + 1} de ${n}`;
  ui.destaque.hidden = !c.destaque;
  ui.destaque.replaceChildren(...(c.destaque ? [pixels(c.destaque.valor), el("figcaption", { texto: c.destaque.legenda })] : []));
  ui.titulo.textContent = c.titulo;
  ui.texto.replaceChildren(...[].concat(c.texto).map((t) => el("p", { texto: t })));
  const fontes = [].concat(c.fonte || []);
  ui.fonte.hidden = !fontes.length;
  ui.fonte.open = false;
  ui.fonte.replaceChildren(
    el("summary", { texto: fontes.length === 1 ? "Fonte" : `Fontes (${fontes.length})` }),
    el("ul", {}, fontes.map((x) => el("li", {}, x.url ? el("a", { href: x.url, ...(x.url.startsWith("#") ? {} : { target: "_blank", rel: "noopener" }), texto: x.nome }) : x.nome))),
  );
  // link para uma seção da página: fecha a camada antes de rolar até ela
  for (const a of ui.fonte.querySelectorAll('a[href^="#"]')) a.addEventListener("click", () => dlg.close());
  ui.ant.disabled = estado.cap === 0;
  ui.prox.lastChild.textContent = estado.cap === n - 1 ? "Voltar ao mapa" : "Próximo";
  [...ui.progresso.children].forEach((b, k) => { b.setAttribute("aria-current", String(k === estado.cap)); b.classList.toggle("lido", k < estado.cap); });
  ui.conteudo.classList.remove("entrando"); void ui.conteudo.offsetWidth; ui.conteudo.classList.add("entrando");
  ui.conteudo.scrollTop = 0;
}

// ---------------------------------------------------------------------------------------------------------
// laço de render (só com a camada aberta)
// ---------------------------------------------------------------------------------------------------------
const tmp = { v: null };
function quadro(agora) {
  if (!estado.rodando) return;
  requestAnimationFrame(quadro);
  const { THREE } = T;
  const { renderer, scene, camera, controls } = R;

  estado.entrada = estado.entrada.filter((a) => {
    if (agora < a.t0) return true;
    const t = a.d ? Math.min(1, (agora - a.t0) / a.d) : 1;
    a.f(t);
    return t < 1;
  });

  const tw = estado.tween;
  if (tw) {
    const t = Math.min(1, (agora - tw.t0) / tw.d);
    const e = CURVA(t);
    controls.target.lerpVectors(tw.de.alvo, tw.para.alvo, e);
    const s = new THREE.Spherical(
      tw.de.esf.radius + (tw.para.esf.radius - tw.de.esf.radius) * e,
      tw.de.esf.phi + (tw.para.esf.phi - tw.de.esf.phi) * e,
      tw.de.esf.theta + (tw.para.esf.theta - tw.de.esf.theta) * e,
    );
    camera.position.setFromSpherical(s).add(controls.target);
    if (t >= 1) estado.tween = null;
  }
  controls.update();

  // pino do capítulo atual pulsa; os outros ficam discretos
  if (estado.pinos) for (const [i, g] of estado.pinos) {
    const ativo = i === estado.cap;
    const k = ativo && !REDUZIR ? 1 + 0.25 * Math.sin(agora / 260) : 1;
    g.userData.aro.scale.setScalar(ativo ? k * 1.4 : 1);
    g.userData.cabeca.scale.setScalar(ativo ? 1.25 : 0.85);
    g.userData.aro.material.opacity = ativo ? 0.95 : 0.45;
  }

  renderer.render(scene, camera);

  // etiquetas HTML presas aos marcos e pinos
  const w = ui.palco.clientWidth, h = ui.palco.clientHeight;
  tmp.v = tmp.v || new THREE.Vector3();
  const c = estado.caps[estado.cap];
  for (const a of estado.alvos) {
    a.obj.getWorldPosition(tmp.v);
    tmp.v.y += a.alto;
    tmp.v.project(camera);
    const atras = tmp.v.z > 1;
    const ativo = a.marco ? c.marco === a.marco : a.cap === estado.cap;
    const visivel = !atras && (a.marco ? a.pronto : a.obj.visible);
    a.x = ((tmp.v.x + 1) / 2) * w; a.y = ((1 - tmp.v.y) / 2) * h;
    a.et.style.transform = `translate(${a.x}px, ${a.y}px) translate(-50%, -100%)`;
    a.et.classList.toggle("ativa", ativo);
    a.ativo = ativo; a.visivel = visivel;
  }
  // etiquetas que se encavalam: fica a do capítulo atual e, depois, as mais perto da câmera (mais abaixo na tela)
  const postas = [];
  for (const a of [...estado.alvos].sort((p, q) => (q.ativo - p.ativo) || (q.y - p.y))) {
    if (!a.visivel) { a.et.hidden = true; continue; }
    const lw = (a.lw ||= a.et.offsetWidth || 120) / 2 + 4, lh = 24;
    const bate = postas.some((b) => Math.abs(b.x - a.x) < lw + b.lw && Math.abs(b.y - a.y) < lh);
    a.et.hidden = bate && !a.ativo;
    if (!a.et.hidden) postas.push({ x: a.x, y: a.y, lw });
  }
}

function ligarLaco() {
  if (estado.rodando) return;
  estado.rodando = true;
  requestAnimationFrame(quadro);
}

function limparBairro() {
  estado.tween = null;
  estado.entrada = [];
  estado.alvos = [];
  estado.pinos = null;
  estado.posMarco = null;
  if (ui) ui.etiquetas.replaceChildren();
  if (estado.grupo && R) {
    R.scene.remove(estado.grupo);
    // descarta o que foi criado para este bairro; as miniaturas ficam no cache (os clones dividem geometria e material)
    estado.grupo.traverse((o) => {
      if (!o.geometry || o.userData.doMarco) return;
      o.geometry.dispose();
      for (const m of [].concat(o.material || [])) m.dispose();
    });
  }
  estado.grupo = null;
}

function aoFechar() {
  estado.rodando = false;
  if (R) R.controls.autoRotate = false;
  limparBairro();
  estado.id = null;
  document.documentElement.classList.remove("b3d-aberto");
  if (/^#b3d=/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
  if (estado.origem && estado.origem.isConnected) estado.origem.focus();
}

document.addEventListener("bairro-3d", (e) => abrir(+e.detail));

// #b3d=ID abre o tour direto (o link fica no endereço enquanto a camada está aberta)
const doLink = /^#b3d=(\d+)$/.exec(location.hash);
if (doLink && POR_ID.has(+doLink[1])) abrir(+doLink[1]);
