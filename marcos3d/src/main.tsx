import { StrictMode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { ALTURA_PEDESTAL, Pedestal, RAIO_BASE, criarFabrica } from "./Cena";
import { marcos } from "./marcos";
import { novos } from "./marcos/novos";

/**
 * Prévia de um marco: ?id=<id>&vista=perspectiva|frente|lado|topo|close&fonte=tsx|glb
 * - fonte=tsx monta o componente (o "depois"); fonte=glb carrega o arquivo publicado em dashboard/marcos (o "antes")
 * - window.__pronto fica true quando a imagem está estável; window.__exportarGLB() devolve o GLB em base64
 * A luz e o fundo imitam o tour do site (bairro3d.js). Sem ?id, mostra a lista de marcos.
 */
const todos = { ...marcos, ...novos };
const q = new URLSearchParams(location.search);
const id = q.get("id") || "";
const vista = q.get("vista") || "perspectiva";
const fonte = q.get("fonte") === "glb" ? "glb" : "tsx";
const FUNDO = "#2a31b8";

declare global {
  interface Window { __pronto?: boolean; __erro?: string; __exportarGLB?: () => Promise<string>; __estatisticas?: () => object }
}
window.addEventListener("error", (e) => { window.__erro = String(e.message); });

/** Ângulos de cada vista: azimute a partir do sul (+z), elevação e quanto da esfera envolvente enquadrar */
const VISTAS: Record<string, { az: number; el: number; zoom: number }> = {
  perspectiva: { az: -32, el: 34, zoom: 0.7 },
  frente: { az: 0, el: 9, zoom: 0.72 },
  lado: { az: 90, el: 9, zoom: 0.72 },
  topo: { az: 0, el: 89, zoom: 0.78 },
  close: { az: 24, el: 22, zoom: 0.38 },
};

function Enquadrar({ alvo, carregado }: { alvo: React.RefObject<THREE.Group | null>; carregado: boolean }) {
  const { camera, gl, scene } = useThree();
  useLayoutEffect(() => {
    if (!carregado || !alvo.current) return;
    const v = VISTAS[vista] || VISTAS.perspectiva;
    const caixa = new THREE.Box3().setFromObject(alvo.current);
    const esfera = caixa.getBoundingSphere(new THREE.Sphere());
    const cam = camera as THREE.PerspectiveCamera;
    const dist = (esfera.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * 1.02 * v.zoom;
    const az = THREE.MathUtils.degToRad(v.az), el = THREE.MathUtils.degToRad(v.el);
    // no close, mira o terço de cima do modelo, onde ficam os detalhes que identificam o lugar
    const centro = vista === "close" ? new THREE.Vector3(esfera.center.x, caixa.min.y + (caixa.max.y - caixa.min.y) * 0.45, esfera.center.z) : esfera.center;
    cam.position.set(centro.x + Math.sin(az) * Math.cos(el) * dist, centro.y + Math.sin(el) * dist, centro.z + Math.cos(az) * Math.cos(el) * dist);
    cam.near = Math.max(0.1, dist / 200);
    cam.far = dist * 10;
    cam.lookAt(centro);
    cam.updateProjectionMatrix();
    // alguns quadros para sombras e texturas assentarem antes da captura
    let n = 0;
    const passo = () => { gl.render(scene, cam); if (++n < 8) requestAnimationFrame(passo); else window.__pronto = true; };
    requestAnimationFrame(passo);
  }, [carregado]);
  return null;
}

function Luzes() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#3a42c8", 1.5]} />
      <directionalLight
        position={[-RAIO_BASE * 1.2, RAIO_BASE * 2.2, -RAIO_BASE * 0.7]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  );
}

function Peca() {
  const m = todos[id];
  const raiz = useRef<THREE.Group>(null);
  const fab = useMemo(criarFabrica, []);
  const [glb, setGlb] = useState<THREE.Object3D | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    if (!m) { window.__erro = `marco "${id}" não existe`; return; }
    if (fonte === "glb") {
      new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`/${m.arquivo}`).then((g) => {
        // o GLB exportado perde as marcações de sombra
        g.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        setGlb(g.scene);
      }).catch((e) => { window.__erro = `não carregou ${m.arquivo}: ${e}`; });
    } else {
      // dá um quadro para os useLayoutEffect dos instanced meshes rodarem
      requestAnimationFrame(() => setMontado(true));
    }
  }, []);

  useEffect(() => {
    window.__exportarGLB = async () => {
      const exp = new GLTFExporter();
      const buf = (await exp.parseAsync(raiz.current!, { binary: true, onlyVisible: true })) as ArrayBuffer;
      const bytes = new Uint8Array(buf);
      let s = "";
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    };
    window.__estatisticas = () => {
      let malhas = 0, triangulos = 0, semNome = 0;
      const mats = new Set<THREE.Material>();
      raiz.current!.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        malhas++;
        if (!o.name) semNome++;
        const g = mesh.geometry;
        const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
        triangulos += n * ((mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1);
        [].concat(mesh.material as never).forEach((x) => mats.add(x));
      });
      return { malhas, triangulos: Math.round(triangulos), materiais: mats.size, semNome };
    };
  }, []);

  if (!m) return null;
  return (
    <group ref={raiz} name={`Marco_${id}`}>
      {fonte === "glb" ? (glb && <primitive object={glb} />) : (
        <>
          <Pedestal />
          <group name="Modelo" position-y={ALTURA_PEDESTAL}>
            <m.Modelo fab={fab} />
          </group>
        </>
      )}
      <Enquadrar alvo={raiz} carregado={fonte === "glb" ? !!glb : montado} />
    </group>
  );
}

function Lista() {
  const grupos: [string, Record<string, { nome: string; arquivo: string }>][] = [["Marcos existentes", marcos], ["Marcos novos", novos]];
  return (
    <div style={{ padding: 24, fontFamily: "system-ui", color: "#fff" }}>
      <h1 style={{ fontWeight: 500 }}>Oficina dos marcos</h1>
      {grupos.map(([titulo, g]) => (
        <section key={titulo}>
          <h2 style={{ fontWeight: 500, opacity: 0.8 }}>{titulo}</h2>
          <ul>
            {Object.entries(g).map(([k, v]) => (
              <li key={k} style={{ margin: "6px 0" }}>
                {v.nome} <code style={{ opacity: 0.7 }}>{k}</code>{" "}
                {["perspectiva", "frente", "close"].map((vv) => <a key={vv} style={{ color: "#c9cdf7", marginLeft: 8 }} href={`?id=${k}&vista=${vv}`}>{vv}</a>)}
                <a style={{ color: "#c9cdf7", marginLeft: 8 }} href={`?id=${k}&fonte=glb`}>publicado</a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    {id ? (
      <Canvas shadows flat dpr={1} gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ fov: 32 }} style={{ width: "100vw", height: "100vh" }}>
        <color attach="background" args={[FUNDO]} />
        <Luzes />
        <Peca />
      </Canvas>
    ) : <Lista />}
  </StrictMode>,
);
