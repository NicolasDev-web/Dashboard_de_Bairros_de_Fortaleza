import * as THREE from "three";

/**
 * Ferramentas comuns dos marcos (os dois agentes usam; quem precisar de algo novo cria no próprio arquivo do
 * marco). Tudo em metros, y para cima, norte em −z. Planta em [x, z]: x = leste, z = sul.
 */

/** Gerador determinístico (mulberry32): o mesmo marco sai igual em toda exportação */
export function aleatorio(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Caixa com as arestas chanfradas (largura em x, altura em y, profundidade em z), base em y = 0 e centrada em x/z.
 * O chanfro pega a luz nas quinas; 0,05 a 0,25 m funciona bem na escala das miniaturas.
 */
export function caixaChanfrada(largura: number, altura: number, profundidade: number, chanfro = 0.12, segmentos = 1) {
  const b = Math.min(chanfro, largura / 4, profundidade / 4, altura / 4);
  const forma = new THREE.Shape();
  const x = largura / 2 - b, z = profundidade / 2 - b;
  forma.moveTo(-x, -z); forma.lineTo(x, -z); forma.lineTo(x, z); forma.lineTo(-x, z); forma.closePath();
  const g = new THREE.ExtrudeGeometry(forma, { depth: Math.max(0.001, altura - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: segmentos, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); // a extrusão (z) vira altura (y)
  g.translate(0, b, 0);
  g.computeVertexNormals();
  return g;
}

/**
 * Prisma vertical com a forma da planta (pontos [x, z] em metros, em qualquer sentido), da altura y0 até y0 + altura.
 * Com chanfro > 0, a borda de cima e a de baixo ficam chanfradas.
 */
export function prismaDePlanta(pontos: [number, number][], altura: number, y0 = 0, chanfro = 0) {
  const forma = new THREE.Shape(pontos.map(([x, z]) => new THREE.Vector2(x, -z)));
  const b = Math.min(chanfro, altura / 4);
  const g = new THREE.ExtrudeGeometry(forma, { depth: Math.max(0.001, altura - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.6, bevelOffset: -b * 0.6, bevelSegments: 1, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + b, 0);
  return g;
}

/** Forma deitada no chão (pontos [x, z]), um pouco acima de y para não brigar com o piso */
export function placaDePlanta(pontos: [number, number][], y = 0.02) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pontos.map(([x, z]) => new THREE.Vector2(x, -z))));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Converte planta real (metros, x = leste, y = norte, origem no centro) para a miniatura: escala K e giro */
export function plantaParaMiniatura(pontos: [number, number][], K: number, giroGraus = 0): [number, number][] {
  const a = THREE.MathUtils.degToRad(giroGraus), c = Math.cos(a), s = Math.sin(a);
  return pontos.map(([x, y]) => [(x * c - y * s) * K, -(x * s + y * c) * K]);
}

function textura(cv: HTMLCanvasElement, repetir: [number, number] = [1, 1]) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repetir);
  t.anisotropy = 4;
  return t;
}

/**
 * Fachada com janelas em grade (um módulo por repetição). Use com UV em metros (ExtrudeGeometry já é) e
 * repeat = 1 / tamanho do módulo. Cores em hex; `pilastra` desenha a faixa vertical entre janelas.
 */
export function texturaJanelas({ parede = "#e7e1d3", janela = "#3d4a5c", moldura = "#f4f1ea", pilastra, colunas = 1, linhas = 1, larguraJanela = 0.5, alturaJanela = 0.55, tamanho = 128 }: {
  parede?: string; janela?: string; moldura?: string; pilastra?: string; colunas?: number; linhas?: number; larguraJanela?: number; alturaJanela?: number; tamanho?: number;
} = {}) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = tamanho;
  const g = cv.getContext("2d")!;
  g.fillStyle = parede; g.fillRect(0, 0, tamanho, tamanho);
  const cw = tamanho / colunas, lh = tamanho / linhas;
  for (let c = 0; c < colunas; c++) for (let l = 0; l < linhas; l++) {
    const w = cw * larguraJanela, h = lh * alturaJanela, x = c * cw + (cw - w) / 2, y = l * lh + (lh - h) / 2;
    g.fillStyle = moldura; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = janela; g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(x, y, w, h * 0.3); // reflexo no alto do vidro
  }
  if (pilastra) { g.fillStyle = pilastra; for (let c = 0; c <= colunas; c++) g.fillRect(c * cw - cw * 0.06, 0, cw * 0.12, tamanho); }
  return textura(cv);
}

/** Telha cerâmica em fiadas (capa e canal), para telhados de duas ou quatro águas */
export function texturaTelhas(cor = "#b5562f", tamanho = 128) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = tamanho;
  const g = cv.getContext("2d")!;
  g.fillStyle = cor; g.fillRect(0, 0, tamanho, tamanho);
  const n = 8, f = tamanho / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, i * f + f * 0.8, tamanho, f * 0.2); // sombra da fiada
    for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"; g.fillRect(j * f + (i % 2) * f * 0.5, i * f, f * 0.5, f * 0.8); }
  }
  return textura(cv);
}

/** Variação suave de cor e rugosidade para pisos e paredes grandes não ficarem chapados (ruído em blocos) */
export function texturaManchada(cor = "#d9d4c8", variacao = 0.06, semente = 1, tamanho = 64) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = tamanho;
  const g = cv.getContext("2d")!;
  g.fillStyle = cor; g.fillRect(0, 0, tamanho, tamanho);
  const r = aleatorio(semente);
  for (let i = 0; i < 220; i++) {
    const v = (r() - 0.5) * 2 * variacao;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    g.fillRect(r() * tamanho, r() * tamanho, 2 + r() * 8, 2 + r() * 8);
  }
  return textura(cv);
}

/** Posiciona as instâncias de um InstancedMesh: [x, y, z, escala?, giroY?] por item */
export function posicionar(malha: THREE.InstancedMesh, itens: [number, number, number, number?, number?][], cores?: string[]) {
  const o = new THREE.Object3D(), c = new THREE.Color();
  itens.forEach(([x, y, z, e = 1, giro = 0], i) => {
    o.position.set(x, y, z); o.rotation.set(0, giro, 0); o.scale.setScalar(e); o.updateMatrix();
    malha.setMatrixAt(i, o.matrix);
    if (cores) malha.setColorAt(i, c.set(cores[i % cores.length]));
  });
  malha.instanceMatrix.needsUpdate = true;
  if (malha.instanceColor) malha.instanceColor.needsUpdate = true;
  malha.computeBoundingSphere();
}
