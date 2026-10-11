// Linha do tempo da demo (60 fps): os planos da gravação, na ordem, com o trecho de cada clipe,
// a velocidade, a câmera, as legendas e os sons. As marcas vêm de marcas.json, que a gravação
// escreve (scripts/demo/gravar.mjs -> codificar.mjs): se um plano for regravado com outro ritmo,
// a edição acompanha sozinha.
//
// Este arquivo não importa nada além de tipos, para rodar também no Node
// (scripts/demo/secoes.mjs lê daqui o começo de cada seção para a trilha).
import type { Camera, Lugar } from "./componentes";

// velocidade do plano: constante, ou [[frame local, velocidade], ...] para um speed ramp suave
export type Velocidade = number | [number, number][];

export type Marcas = Record<string, { quadros: number; cliques?: number[] } & Record<string, number | number[]>>;
export type Plano = {
  nome: string; secao?: string; clip: string; de: number; dur: number; vel?: Velocidade;
  chaves?: [number, Camera][]; funde?: number; inicio: number;
};
export type Texto = { em: number; dur: number; texto: string; sub?: string; lugar?: Lugar; tamanho?: number; clara?: boolean };
export type Efeito = { nome: string; arquivo: string; frame: number; volume: number };

const cam = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom });
// enquadramentos (pontos em CSS px da página 1920x1080). Até 1,05 a página inteira cabe: as margens
// do painel (56 px) absorvem o corte. Acima disso, o quadro fecha numa região sem cortar títulos.
const LARGO = cam(960, 540, 1.0);
const MAPA_PERTO = cam(1120, 655, 1.27); // mapa + ficha, abaixo do título e dos controles
const RES = cam(960, 556, 1.04); // resultado: o título grande fica inteiro; quem aproxima é o próprio mapa
const QUIZ = cam(940, 556, 1.05); // pergunta + cidade em pixels
const QUIZ2 = cam(930, 556, 1.065);

// Quadros do clipe andados até o quadro local `f`: a integral da velocidade, então a rampa não dá
// saltos. A edição (Gravacao) e as contas daqui usam a mesma função.
export function quadroFonte(f: number, v: Velocidade) {
  if (typeof v === "number") return f * v;
  const em = (t: number) => {
    if (t <= v[0][0]) return v[0][1];
    for (let k = 1; k < v.length; k++) {
      if (t <= v[k][0]) {
        const u = (t - v[k - 1][0]) / (v[k][0] - v[k - 1][0]);
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        return v[k - 1][1] + (v[k][1] - v[k - 1][1]) * e;
      }
    }
    return v[v.length - 1][1];
  };
  let s = 0;
  for (let t = 0; t < f; t++) s += em(t + 0.5);
  return s;
}
const fonte = (p: Plano, f: number) => p.de + quadroFonte(f, p.vel ?? 1);

export function montar(M: Marcas) {
  const m = (clip: string, rotulo: string) => {
    const v = M[clip]?.[rotulo];
    if (typeof v !== "number") throw new Error(`marca ausente: ${clip}.${rotulo}`);
    return v;
  };
  const clique = (clip: string, i: number) => {
    const c = M[clip]?.cliques;
    if (!c || c[i] === undefined) throw new Error(`clique ausente: ${clip}[${i}]`);
    return c[i];
  };

  const planos: Plano[] = [];
  const secoes: Record<string, number> = {};
  let t = 0;
  // `ate`: em vez da duração, o quadro do clipe onde o plano termina (com a velocidade aplicada)
  const plano = (p: Omit<Plano, "inicio" | "dur"> & { dur?: number; ate?: number }) => {
    if (p.ate !== undefined) {
      let d = 0;
      while (fonte({ ...p, dur: 0, inicio: 0 }, d + 1) < p.ate) d++;
      p = { ...p, dur: d };
    }
    if (p.dur === undefined) throw new Error(`${p.nome}: sem duração`);
    if (p.secao) secoes[p.secao] = t;
    // nunca pede quadro além do fim do clipe
    const { ate: _ate, ...resto } = p;
    void _ate;
    const q: Plano = { ...resto, dur: p.dur, inicio: t };
    const ultimo = fonte(q, q.dur);
    if (ultimo > M[q.clip].quadros) throw new Error(`${q.nome}: pede o quadro ${Math.round(ultimo)} de ${M[q.clip].quadros} (${q.clip})`);
    planos.push(q);
    t += q.dur;
    return q;
  };
  const legendas: Texto[] = [];
  const legenda = (p: Plano, em: number, dur: number, l: Omit<Texto, "em" | "dur">) => legendas.push({ em: p.inicio + em, dur, ...l });
  // quadro local do plano em que acontece o quadro `f` do clipe
  const local = (p: Plano, f: number) => {
    for (let k = 0; k <= p.dur; k++) if (fonte(p, k) >= f) return k;
    return p.dur;
  };

  // ---------- 01 abertura: o hero e a cidade em pixels ----------
  const abertura = plano({
    nome: "Abertura", secao: "abertura", clip: "abertura", de: 14, dur: m("abertura", "vai_botao") + 12 - 14,
    chaves: [[0, LARGO], [290, cam(960, 540, 1.04)]],
  });
  legenda(abertura, 40, abertura.dur - 40, { texto: "121 bairros. Uma cidade vista através dos dados.", lugar: "cima-esq", clara: true, tamanho: 36 });

  // ---------- 02 mapa: "Explorar o mapa", rolagem com speed ramp, indicadores e a ficha ----------
  const cl0 = clique("abertura", 0) - (m("abertura", "vai_botao") + 12);
  const explorar = plano({
    nome: "Explorar o mapa", secao: "mapa", clip: "abertura", de: m("abertura", "vai_botao") + 12, dur: cl0 + 96,
    vel: [[0, 1], [cl0 + 10, 1], [cl0 + 26, 2.4], [cl0 + 62, 2.4], [cl0 + 80, 1]],
    chaves: [[0, cam(960, 540, 1.04)], [cl0 + 10, LARGO]],
  });
  // do primeiro clique até a ficha aberta; o caminho até o bairro vai 1,3x
  {
    const fimInd = clique("mapa", 2) + 70;
    const cb = clique("mapa", 3);
    const ind = plano({
      nome: "Indicadores", clip: "mapa", de: 36, ate: Math.min(M.mapa.quadros - 2, cb + 110),
      vel: [[0, 1.15], [fimInd - 8, 1.15], [fimInd + 8, 1.35], [cb - 16, 1.35], [cb - 8, 1]],
    });
    const d = ind.dur;
    ind.chaves = [[0, LARGO], [local(ind, cb) - 40, cam(960, 540, 1.03)], [local(ind, cb) + 30, MAPA_PERTO], [d, cam(1125, 660, 1.29)]];
    legenda(ind, local(ind, clique("mapa", 0)) + 6, local(ind, fimInd) - local(ind, clique("mapa", 0)), { texto: "Renda. Saneamento. Segurança.", lugar: { x: 1440, base: 1040, ancora: "dir" } });
    legenda(ind, local(ind, cb) + 20, d - local(ind, cb) - 20, { texto: "Cada bairro conta uma história diferente.", lugar: { x: 1390, base: 1040, ancora: "dir" } });
  }

  // ---------- 03 camadas e Strava ----------
  {
    const c = (i: number) => clique("camadas", i);
    // praças, hospitais e paradas um pouco mais rápido; o "desliga tudo" sai num corte (com uma
    // fusão curta); as rotas de corrida e de pedal no ritmo gravado, a mão indo à rota 1,3x
    const desl = m("camadas", "desliga"), corr = m("camadas", "corrida"), dica = m("camadas", "dica"), pedal = m("camadas", "pedal");
    const liga = plano({
      nome: "Camadas: praças, hospitais, paradas", secao: "camadas", clip: "camadas", de: 40, ate: desl + 4, vel: 1.25,
      chaves: [[0, cam(1125, 660, 1.29)], [400, cam(1105, 655, 1.27)]],
    });
    legenda(liga, local(liga, c(1)) - 10, liga.dur - local(liga, c(1)) + 10, { texto: "Praças, hospitais e paradas de ônibus.", lugar: { x: 1390, base: 1040, ancora: "dir" } });
    const corrida = plano({
      nome: "Camadas: rotas de corrida", clip: "camadas", de: corr - 8, ate: pedal, funde: 10,
      vel: [[0, 1], [c(7) - corr + 70, 1], [c(7) - corr + 90, 1.3], [dica - corr + 80, 1.3], [dica - corr + 96, 1]],
      chaves: [[0, MAPA_PERTO], [c(7) - corr + 70, MAPA_PERTO], [260, cam(1060, 600, 1.34)]],
    });
    const pedalP = plano({
      nome: "Camadas: rotas de pedal", clip: "camadas", de: pedal, ate: c(8) + 110,
      chaves: [[0, cam(1060, 600, 1.34)], [70, MAPA_PERTO], [200, cam(1105, 660, 1.28)]],
    });
    legenda(corrida, 40, corrida.dur - 40 + pedalP.dur, {
      texto: "Onde Fortaleza corre e pedala.", sub: "rotas mais feitas, estimadas do heatmap de usuários do Strava", lugar: { x: 1390, base: 1040, ancora: "dir" },
    });
    void desl;
  }

  // ---------- 04 ônibus ----------
  {
    const cp = clique("onibus", 0);
    const onibus = plano({
      nome: "Ônibus", secao: "onibus", clip: "onibus", de: 30, ate: M.onibus.quadros - 2,
      vel: [[0, 1.9], [cp - 40, 1.9], [cp - 20, 1]],
    });
    const d = onibus.dur;
    const l = local(onibus, cp);
    onibus.chaves = [[0, LARGO], [l, cam(960, 540, 1.03)], [l + 60, cam(700, 590, 1.42)], [d, cam(690, 585, 1.45)]];
    legenda(onibus, 20, l + 40, { texto: "E se o tempo até o trabalho também fizer parte da escolha?", lugar: "baixo-dir", tamanho: 36 });
  }

  // ---------- 05 evolução 2010 → 2022 ----------
  {
    const ch = m("evolucao", "chegou");
    const evo = plano({ nome: "Evolução", secao: "evolucao", clip: "evolucao", de: 0, ate: m("evolucao", "dica") + 110, vel: [[0, 2], [ch - 20, 2], [ch, 1.4]] });
    const d = evo.dur;
    const l = local(evo, ch);
    const ld = local(evo, m("evolucao", "dica"));
    evo.chaves = [[0, LARGO], [ld - 20, cam(960, 540, 1.03)], [ld + 40, cam(1300, 575, 1.32)], [d, cam(1300, 575, 1.35)]];
    legenda(evo, l - 10, local(evo, m("evolucao", "esgoto")) - l + 10, { texto: "2010 → 2022", lugar: "baixo-dir", tamanho: 44 });
    legenda(evo, local(evo, m("evolucao", "esgoto")) + 12, d - local(evo, m("evolucao", "esgoto")) - 12, { texto: "A cidade também pode ser lida no tempo.", lugar: "baixo-esq" });
  }

  // ---------- 06 preços, e o clique em "Onde morar" ----------
  {
    const precos = plano({ nome: "Preços", secao: "precos", clip: "precos", de: 0, vel: [[0, 1.7], [60, 1.7], [90, 1]], ate: M.precos.quadros - 2 });
    const d = precos.dur;
    precos.chaves = [[0, LARGO], [d, cam(960, 540, 1.04)]];
    legenda(precos, 30, d - 80, { texto: "E quanto custa morar em cada região?", lugar: { x: 1380, base: 1040, ancora: "dir" } });
    const vai = plano({ nome: "Vai para o Onde morar", clip: "vai_morar", de: 0, dur: M.vai_morar.quadros - 2, chaves: [[0, cam(960, 540, 1.04)], [60, cam(1120, 300, 1.12)]] });
    legenda(vai, -40, vai.dur + 90, { texto: "Mas e se os dados respondessem uma pergunta pessoal?", lugar: "baixo-esq", clara: true });
  }

  // ---------- 07–08 o "Onde morar": abertura do quiz e "Começar" ----------
  const intro = plano({
    nome: "Quiz: abertura", secao: "morar", clip: "quiz_intro", de: 0, dur: M.quiz_intro.quadros - 2, funde: 14,
    chaves: [[0, LARGO], [260, QUIZ]],
  });
  void intro;

  // ---------- 09 orçamento: o mapa em pixels reage ao slider ----------
  {
    const orc = plano({
      nome: "Orçamento", secao: "orcamento", clip: "orcamento", de: 30, ate: M.orcamento.quadros - 2, vel: [[0, 1.15], [300, 1.15], [330, 1.3]],
      chaves: [[0, QUIZ], [500, QUIZ2]],
    });
    legenda(orc, local(orc, m("orcamento", "renda")) + 20, local(orc, m("orcamento", "continuar")) - local(orc, m("orcamento", "renda")) - 10, {
      texto: "O mapa responde às suas escolhas em tempo real.", lugar: "cima-dir", clara: true,
    });
  }

  // ---------- 10 trajeto ----------
  {
    const tj = plano({
      nome: "Trajeto", secao: "trajeto", clip: "trajeto", de: 6, dur: M.trajeto.quadros - 2 - 6,
      chaves: [[0, QUIZ2], [tjFim(M), QUIZ]],
    });
    legenda(tj, 20, tj.dur - 10, { texto: "Até o seu deslocamento entra na conta.", lugar: "cima-dir", clara: true });
  }

  // ---------- 11 preferências: montagem de quatro perguntas ----------
  {
    const P = "preferencias";
    const ordem = ["seguranca", "saude", "lazer", "infra", "mobilidade", "escolas", "comercio", "ritmo"];
    const mostrar = ["seguranca", "lazer", "infra", "mobilidade", "ritmo"];
    let primeira = true;
    for (const q of mostrar) {
      const k = ordem.indexOf(q);
      const de = m(P, q) - (primeira ? 6 : 2);
      const ate = k + 1 < ordem.length ? m(P, ordem[k + 1]) + 4 : M[P].quadros - 2;
      const p = plano({
        nome: `Pergunta: ${q}`, secao: primeira ? "preferencias" : undefined, clip: P, de, dur: ate - de,
        chaves: [[0, QUIZ], [ate - de, QUIZ2]],
      });
      if (primeira) legenda(p, 16, 9999, { texto: "O que importa para você?", sub: "segurança · lazer · infraestrutura · mobilidade", lugar: "cima-dir", clara: true });
      primeira = false;
    }
    // a legenda dura a montagem inteira
    const l = legendas[legendas.length - 1];
    l.dur = t - l.em;
  }

  // ---------- 12 resultado ----------
  {
    const res = plano({
      nome: "Resultado", secao: "resultado", clip: "resultado", de: 0, dur: M.resultado.quadros - 2,
      chaves: [[0, LARGO], [m("resultado", "abre") + 120, cam(960, 540, 1.03)], [M.resultado.quadros, RES]],
    });
    secoes.revelacao = res.inicio + m("resultado", "abre");
    const ab = m("resultado", "abre");
    legenda(res, ab + 60, 150, { texto: "Não existe apenas o “melhor bairro”.", lugar: { x: 1300, base: 1040, ancora: "dir" } });
    legenda(res, ab + 220, res.dur - ab - 220, { texto: "Existe o bairro que combina com você.", lugar: { x: 1300, base: 1040, ancora: "dir" } });
  }

  // ---------- 13 profundidade: camadas no mapa do resultado ----------
  plano({
    nome: "Profundidade", secao: "profundidade", clip: "profundidade", de: 0, dur: M.profundidade.quadros - 2,
    chaves: [[0, RES], [M.profundidade.quadros, cam(960, 560, 1.05)]],
  });

  // ---------- 14 encerramento ----------
  const fecho = plano({
    nome: "Encerramento", secao: "encerramento", clip: "encerramento", de: 0, dur: 330, funde: 20,
    chaves: [[0, cam(1300, 560, 1.12)], [330, cam(1330, 540, 1.18)]],
  });
  secoes.fim = t;

  // ---------- sons ----------
  const efeitos: Efeito[] = [];
  for (const p of planos) {
    for (const c of M[p.clip].cliques ?? []) {
      if (c < p.de || fonte(p, p.dur) <= c) continue;
      efeitos.push({ nome: `Clique (${p.nome})`, arquivo: "audio/clique.wav", frame: p.inicio + local(p, c), volume: 0.22 });
    }
  }
  efeitos.push({ nome: "Whoosh: rolagem até o mapa", arquivo: "audio/whoosh.wav", frame: explorar.inicio + cl0 + 14, volume: 0.32 });
  efeitos.push({ nome: "Whoosh: entra no Onde morar", arquivo: "audio/whoosh.wav", frame: secoes.morar - 18, volume: 0.35 });
  efeitos.push({ nome: "Impacto: resultado", arquivo: "audio/impacto.wav", frame: secoes.revelacao, volume: 0.45 });
  efeitos.push({ nome: "Impacto: fecho", arquivo: "audio/impacto.wav", frame: fecho.inicio, volume: 0.3 });

  return { planos, legendas, efeitos, secoes, duracao: t };
}

// o trajeto: a câmera chega ao fim do plano
const tjFim = (M: Marcas) => M.trajeto.quadros - 8;
