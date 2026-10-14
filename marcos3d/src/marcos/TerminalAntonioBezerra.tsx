import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../Cena";
import { caixaChanfrada, placaDePlanta, posicionar, prismaDePlanta, texturaJanelas, texturaManchada } from "../util/geometria";

/**
 * Terminal de Integração Antônio Bezerra em miniatura. As medidas e posições vêm do OpenStreetMap
 * (pesquisa/marcos/terminal-antonio-bezerra/ficha.md), em metros reais com x = leste, y = norte e a
 * origem no centro do lote; `K` encolhe para caber na base e as alturas encolhem menos. A assinatura
 * é o "pente" de três coberturas longas a 174°. Metros, norte em −z.
 */
type Xy = [number, number];

const K = 0.23;
const emM = ([x, y]: Xy): Xy => [(x + 8) * K, -(y - 5) * K];
// as coberturas correm a 174° (quase norte–sul, levemente para leste no sul)
const GIRO = THREE.MathUtils.degToRad(6);
const ALTURA = 2.6;
/** inclinação de cada água da cobertura (rad) */
const CAIMENTO = 0.12;
/** altura da plataforma de embarque sob as coberturas */
const PLATAFORMA = 0.15;

const LOTE: Xy[] = [[70, -72], [59, 19], [46, 20], [49, 31], [42, 77], [30, 94], [11, 104], [5, 112], [-7, 113], [-66, 58], [-59, -42], [-51, -50], [-47, -81], [-43, -88], [-25, -97], [74, -84]];
const COBERTURAS: { nome: string; centro: Xy; c: number; l: number; solar?: boolean }[] = [
  { nome: "Oeste", centro: [-32, 11], c: 152, l: 20 },
  { nome: "Central", centro: [6, 14], c: 157, l: 28 },
  { nome: "Leste", centro: [46, -1], c: 95, l: 26, solar: true },
];
const VAPT_VUPT: Xy[] = [[-95, -55], [-50, -55], [-65, 56]];

/** Materiais feitos à mão (texturas, vidro, metal, ônibus), todos nomeados */
function criarMateriais() {
  const m = (nome: string, p: THREE.MeshStandardMaterialParameters) => Object.assign(new THREE.MeshStandardMaterial(p), { name: nome });
  // fita de janelas dos prédios de apoio: parede branca (o material tinge) e vidro escuro, módulo 1,4 × 1,0 m
  const janelas = texturaJanelas({ parede: "#ffffff", janela: "#33424f", moldura: "#dcdcd6", colunas: 2, linhas: 1, larguraJanela: 0.8, alturaJanela: 0.42 });
  janelas.repeat.set(1 / 2.8, 1);
  const piso = texturaManchada("#8e8d88", 0.05, 17, 64);
  piso.repeat.set(1 / 7, 1 / 7);
  return {
    vaptVupt: m("Mat_Fachada_Vapt_Vupt", { map: janelas, color: "#f2f2ef", roughness: 0.8 }),
    blocoNorte: m("Mat_Fachada_Bloco_Norte", { map: janelas, color: "#e2652f", roughness: 0.8 }),
    piso: m("Mat_Piso_Terminal", { map: piso, roughness: 0.95 }),
    telha: m("Mat_Telha_Metalica", { color: "#bcc5bf", roughness: 0.42, metalness: 0.3 }),
    solar: m("Mat_Painel_Solar", { color: "#26365a", roughness: 0.22, metalness: 0.3 }),
    rufo: m("Mat_Rufo_Metal", { color: "#e3e7e4", roughness: 0.4, metalness: 0.3 }),
    trelica: m("Mat_Trelica_Aco", { color: "#5e6461", roughness: 0.6, metalness: 0.3 }),
    onibus: m("Mat_Pintura_Onibus", { roughness: 0.38, metalness: 0.15 }),
    vidroOnibus: m("Mat_Vidro_Onibus", { color: "#2a3642", roughness: 0.1, metalness: 0.25 }),
  };
}
type Materiais = ReturnType<typeof criarMateriais>;

/**
 * Ônibus: carroceria com a fita de janelas escura e o para-brisa, numa geometria de dois grupos
 * (0 = pintura, que recebe a cor da instância; 1 = vidro). Frente em −z.
 */
function geometriaOnibus() {
  const corpo = caixaChanfrada(0.62, 0.7, 2.8, 0.06);
  const janelas = new THREE.BoxGeometry(0.64, 0.2, 2.5).translate(0, 0.5, 0.08);
  const parabrisa = new THREE.BoxGeometry(0.56, 0.26, 0.04).translate(0, 0.46, -1.41);
  const pecas = [corpo, janelas, parabrisa].map((g) => (g.index ? g.toNonIndexed() : g));
  const grupos: [THREE.BufferGeometry, number][] = [[pecas[0], 0], [pecas[1], 1], [pecas[2], 1]];
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  const saida = new THREE.BufferGeometry();
  for (const m of [0, 1]) {
    const ini = pos.length / 3;
    for (const [g, mi] of grupos) {
      if (mi !== m) continue;
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++) {
        pos.push(P.getX(i), P.getY(i), P.getZ(i));
        nor.push(N.getX(i), N.getY(i), N.getZ(i));
        uv.push(U.getX(i), U.getY(i));
      }
    }
    saida.addGroup(ini, pos.length / 3 - ini, m);
  }
  saida.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  saida.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  saida.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  [corpo, janelas, parabrisa, ...pecas].forEach((g) => g.dispose());
  return saida;
}

/** Cobertura de duas águas bem baixa sobre pilares cilíndricos com anéis azuis, plataforma de embarque e lojas */
function Cobertura({ nome, centro, c, l, solar, fab, mat }: { nome: string; centro: Xy; c: number; l: number; solar?: boolean; fab: Fabrica; mat: Materiais }) {
  const [x, z] = emM(centro);
  const comprimento = c * K;
  const largura = l * K;
  const pilares = useRef<THREE.InstancedMesh>(null);
  const aneis = useRef<THREE.InstancedMesh>(null);
  const lojas = useRef<THREE.InstancedMesh>(null);
  const pontos = useMemo(() => {
    const p: Xy[] = [];
    for (let s = -comprimento / 2 + 1; s <= comprimento / 2 - 1; s += 3) for (const lado of [-1, 1]) p.push([lado * (largura / 2 - 0.4), s]);
    return p;
  }, [comprimento, largura]);
  const geo = useMemo(
    () => ({
      plataforma: caixaChanfrada(largura - 0.3, PLATAFORMA, comprimento - 0.2, 0.05),
      loja: caixaChanfrada(largura * 0.45, 1.4, 2.2, 0.08),
    }),
    [comprimento, largura],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  useLayoutEffect(() => {
    posicionar(pilares.current!, pontos.map(([px, pz]): [number, number, number] => [px, ALTURA / 2, pz]));
    posicionar(aneis.current!, pontos.map(([px, pz]): [number, number, number] => [px, ALTURA - 0.45, pz]));
    posicionar(lojas.current!, [-0.3, 0.05, 0.35].map((t): [number, number, number] => [0, PLATAFORMA, t * comprimento]));
  }, [pontos, comprimento]);
  // a borda de fora de cada água fica mais baixa: é ali que corre o rufo (calha)
  const meia = largura / 4;
  const beiral = ALTURA + 0.42 - Math.tan(CAIMENTO) * meia - 0.02;
  const cumeeira = ALTURA + 0.42 + Math.tan(CAIMENTO) * meia + 0.04;
  return (
    <group name={`Cobertura_${nome}`} position={[x, 0, z]} rotation-y={GIRO}>
      <mesh name={`Plataforma_Embarque_${nome}`} geometry={geo.plataforma} material={fab.cor("#c9c5bb", 0.9)} receiveShadow castShadow />
      <instancedMesh name={`Pilares_${nome}`} ref={pilares} args={[undefined, undefined, pontos.length]} material={fab.cor("#c9cbc6", 0.85)} castShadow>
        <cylinderGeometry args={[0.16, 0.16, ALTURA, 8]} />
      </instancedMesh>
      <instancedMesh name={`Pilares_Aneis_Azuis_${nome}`} ref={aneis} args={[undefined, undefined, pontos.length]} material={fab.cor("#4fa3d1", 0.5)}>
        <cylinderGeometry args={[0.19, 0.19, 0.22, 8]} />
      </instancedMesh>
      {/* treliça espacial por baixo, em sombra, e as duas águas da telha metálica */}
      <mesh name={`Trelica_${nome}`} position-y={ALTURA + 0.12} material={mat.trelica} castShadow>
        <boxGeometry args={[largura - 0.1, 0.25, comprimento]} />
      </mesh>
      {[-1, 1].map((lado) => (
        <mesh key={lado} name={`Telhado_${nome}_${lado < 0 ? "Agua_Oeste" : "Agua_Leste"}`} position={[lado * meia, ALTURA + 0.42, 0]} rotation-z={-lado * CAIMENTO} material={solar && lado > 0 ? mat.solar : mat.telha} castShadow receiveShadow>
          <boxGeometry args={[largura / 2 + 0.1, 0.1, comprimento + 0.4]} />
        </mesh>
      ))}
      {/* rufos nas bordas de fora e a cumeeira: as linhas claras que desenham o "pente" de longe */}
      {[-1, 1].map((lado) => (
        <mesh key={lado} name={`Rufo_${nome}_${lado < 0 ? "Oeste" : "Leste"}`} position={[lado * (largura / 2 + 0.06), beiral, 0]} material={mat.rufo} castShadow>
          <boxGeometry args={[0.1, 0.22, comprimento + 0.44]} />
        </mesh>
      ))}
      <mesh name={`Cumeeira_${nome}`} position-y={cumeeira} material={mat.rufo} castShadow>
        <boxGeometry args={[0.3, 0.06, comprimento + 0.44]} />
      </mesh>
      {/* blocos de lojas e bilheterias em pastilha laranja, sobre a plataforma */}
      <instancedMesh name={`Lojas_Bilheterias_${nome}`} ref={lojas} args={[geo.loja, undefined, 3]} material={fab.cor("#e2652f", 0.8)} castShadow receiveShadow />
    </group>
  );
}

/** Baias entre as coberturas: ônibus brancos e azul-claros, as faixas das vagas e a fileira de palmeiras no canteiro */
function Baias({ fab, mat }: { fab: Fabrica; mat: Materiais }) {
  const { onibus, palmeiras, faixas, geoOnibus } = useMemo(() => {
    const o: [number, number, number, number, number][] = [];
    const p: [number, number, number][] = [];
    const f: [number, number, number, number, number][] = [];
    // baias entre A e B (x real ≈ -13) e entre B e a cobertura leste (x real ≈ 26)
    for (const [bx, de, ate] of [[-13, -55, 80], [26, -40, 45]] as [number, number, number][]) {
      for (let y = de; y < ate; y += 17) {
        const [x, z] = emM([bx - 3, y]);
        o.push([x, 0, z, 1, GIRO]);
      }
      for (let y = de + 6; y < ate; y += 14) {
        const [x, z] = emM([bx + 4, y]);
        p.push([x, 1.1, z]);
      }
      // linha contínua que separa a pista de manobra das vagas
      for (let y = de; y < ate; y += 6) {
        const [x, z] = emM([bx + 1, y + 3]);
        f.push([x, 0.06, z, 1, GIRO]);
      }
    }
    return { onibus: o, palmeiras: p, faixas: f, geoOnibus: geometriaOnibus() };
  }, []);
  useEffect(() => () => geoOnibus.dispose(), [geoOnibus]);
  const carrocerias = useRef<THREE.InstancedMesh>(null);
  const troncos = useRef<THREE.InstancedMesh>(null);
  const folhas = useRef<THREE.InstancedMesh>(null);
  const tracos = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    posicionar(carrocerias.current!, onibus, ["#e9f1f6", "#7ec3e6", "#f0f0ec"]);
    posicionar(troncos.current!, palmeiras);
    // coroa da palmeira: icosaedro achatado e girado, para não parecer uma bola
    posicionar(folhas.current!, palmeiras.map(([x, , z], i): [number, number, number, number, number] => [x, 2.3, z, 1, i * 0.8]));
    const o = new THREE.Matrix4(), e = new THREE.Matrix4().makeScale(1.15, 0.5, 1.15);
    for (let i = 0; i < folhas.current!.count; i++) {
      folhas.current!.getMatrixAt(i, o);
      folhas.current!.setMatrixAt(i, o.multiply(e));
    }
    folhas.current!.instanceMatrix.needsUpdate = true;
    posicionar(tracos.current!, faixas);
  }, [onibus, palmeiras, faixas]);
  return (
    <>
      <instancedMesh name="Onibus" ref={carrocerias} args={[geoOnibus, undefined, onibus.length]} material={[mat.onibus, mat.vidroOnibus]} castShadow receiveShadow />
      <instancedMesh name="Faixas_Baias" ref={tracos} args={[undefined, undefined, faixas.length]} material={fab.cor("#f1d54a", 0.7)}>
        <boxGeometry args={[0.12, 0.02, 1.0]} />
      </instancedMesh>
      <instancedMesh name="Palmeiras_Troncos" ref={troncos} args={[undefined, undefined, palmeiras.length]} material={fab.cor("#8b7355")} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 2.2, 6]} />
      </instancedMesh>
      <instancedMesh name="Palmeiras_Copas" ref={folhas} args={[undefined, undefined, palmeiras.length]} material={fab.cor("#4f7a3a")} castShadow>
        <icosahedronGeometry args={[0.75, 0]} />
      </instancedMesh>
    </>
  );
}

export function TerminalAntonioBezerra({ fab }: { fab: Fabrica }) {
  const mat = useMemo(criarMateriais, []);
  const geo = useMemo(
    () => ({
      // o lote é uma laje de 5 cm com a borda chanfrada (meio-fio), não um adesivo no pedestal
      chao: prismaDePlanta(LOTE.map(emM), 0.06, 0, 0.02),
      vapt: prismaDePlanta(VAPT_VUPT.map(emM), 2.8, 0, 0.12),
      vaptPlatibanda: prismaDePlanta(VAPT_VUPT.map(emM), 0.2, 2.8, 0.04),
      blocoNorte: caixaChanfrada(46 * K, 1.8, 16 * K, 0.1),
      canteiro: placaDePlanta([[-16, -0.5], [16, -0.5], [16, 0.5], [-16, 0.5]], 0.1),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      for (const m of Object.values(mat)) {
        m.map?.dispose();
        m.dispose();
      }
    },
    [geo, mat],
  );
  const tracos = useRef<THREE.InstancedMesh>(null);
  const troncos = useRef<THREE.InstancedMesh>(null);
  const copas = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    // árvores do canteiro: tronco curto e copa apoiada nele (antes a copa flutuava 0,3 m sobre o chão)
    const xs = [-12, -6, 0, 6, 12];
    posicionar(troncos.current!, xs.map((x): [number, number, number] => [x, 0.55, 0]));
    posicionar(copas.current!, xs.map((x, i): [number, number, number, number, number] => [x, 1.55, 0, 1, i * 0.9]));
    // tracejado das duas pistas de cada lado do canteiro
    posicionar(tracos.current!, [-1.9, 1.9].flatMap((w) => Array.from({ length: 15 }, (_, i): [number, number, number] => [-14 + i * 2, 0.05, w])));
  }, []);
  const [nx, nz] = emM([-13, 92]);
  const [ax, az] = emM([0, -100]);
  return (
    <group name="Terminal_Antonio_Bezerra">
      <mesh name="Lote_Piso" geometry={geo.chao} material={[mat.piso, fab.cor("#b9b6ad", 0.9)]} receiveShadow />
      {COBERTURAS.map((c) => (
        <Cobertura key={c.nome} {...c} fab={fab} mat={mat} />
      ))}
      <Baias fab={fab} mat={mat} />
      {/* bloco norte de dois pavimentos */}
      <mesh name="Bloco_Norte" geometry={geo.blocoNorte} position={[nx, 0, nz]} rotation-y={-THREE.MathUtils.degToRad(84 - 90)} material={[fab.cor("#d8d4cc", 0.85), mat.blocoNorte]} castShadow receiveShadow />
      {/* prédio triangular do Vapt Vupt, colado no lado oeste, com a platibanda clara */}
      <mesh name="Vapt_Vupt" geometry={geo.vapt} material={[fab.cor("#dedbd3", 0.85), mat.vaptVupt]} castShadow receiveShadow />
      <mesh name="Vapt_Vupt_Platibanda" geometry={geo.vaptPlatibanda} material={fab.cor("#f7f7f4", 0.7)} castShadow receiveShadow />
      {/* Av. Mister Hull ao sul, a ~82°, com o canteiro central arborizado */}
      <group name="Av_Mister_Hull" position={[ax, 0, az]} rotation-y={THREE.MathUtils.degToRad(8)}>
        <mesh name="Av_Mister_Hull_Asfalto" position-y={0.04} rotation-x={-Math.PI / 2} material={fab.cor("#5f605d", 0.95)} receiveShadow>
          <planeGeometry args={[32, 6.5]} />
        </mesh>
        <mesh name="Av_Mister_Hull_Canteiro" geometry={geo.canteiro} material={fab.cor("#7fa35a", 0.95)} receiveShadow />
        <instancedMesh name="Av_Mister_Hull_Faixas" ref={tracos} args={[undefined, undefined, 30]} material={fab.cor("#f1efe6", 0.6)}>
          <boxGeometry args={[1.0, 0.02, 0.1]} />
        </instancedMesh>
        <instancedMesh name="Arvores_Canteiro_Troncos" ref={troncos} args={[undefined, undefined, 5]} material={fab.cor("#8b7355")} castShadow>
          <cylinderGeometry args={[0.08, 0.11, 0.9, 6]} />
        </instancedMesh>
        <instancedMesh name="Arvores_Canteiro_Copas" ref={copas} args={[undefined, undefined, 5]} material={fab.cor("#4e7a36", 0.9)} castShadow receiveShadow>
          <icosahedronGeometry args={[0.9, 0]} />
        </instancedMesh>
      </group>
    </group>
  );
}
