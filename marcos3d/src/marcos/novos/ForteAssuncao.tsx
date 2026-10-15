import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fabrica } from "../../Cena";
import { caixaChanfrada, placaDePlanta, prismaDePlanta } from "../../util/geometria";

/** Fortaleza de Nossa Senhora da Assunção: praça quadrada de 90 m com baluartes, escalada por K=0,50. */
export const ALTURA_ETIQUETA = 13;

type Item = [number, number, number, number?, number?, number?, number?];
function Instancias({ nome, geo, mat, itens }: { nome: string; geo: THREE.BufferGeometry; mat: THREE.Material; itens: Item[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => { const o = new THREE.Object3D(), m = ref.current!; itens.forEach(([x,y,z,sx=1,sy=1,sz=1,a=0],i)=>{o.position.set(x,y,z);o.rotation.set(0,a,0);o.scale.set(sx,sy,sz);o.updateMatrix();m.setMatrixAt(i,o.matrix);});m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere(); }, [itens]);
  return <instancedMesh ref={ref} name={nome} args={[geo, mat, itens.length]} castShadow receiveShadow />;
}

/** Canhão estilizado, com tubo de ferro, reparo de madeira e rodas. */
function Canhao({ x, z, a, fab }: { x: number; z: number; a: number; fab: Fabrica }) {
  return <group position={[x, 5.2, z]} rotation-y={a}>
    <mesh name="Canhao_Tubo" material={fab.cor("#252926",0.43)} castShadow rotation-z={Math.PI/2}><cylinderGeometry args={[0.18,0.28,2.4,10]} /></mesh>
    <mesh name="Canhao_Reparo" geometry={caixaChanfrada(1.1,0.35,0.65,0.06)} material={fab.cor("#715139",0.85)} position={[0,-0.45,0]} castShadow />
    {[-0.42,0.42].map((q)=><mesh key={q} name="Canhao_Roda" material={fab.cor("#4a3729",0.8)} position={[0,-0.48,q]} rotation-x={Math.PI/2} castShadow><cylinderGeometry args={[0.38,0.38,0.12,12]} /></mesh>)}
  </group>;
}

export function ForteAssuncao({ fab }: { fab: Fabrica }) {
  const geos = useMemo(() => {
    const disco=new THREE.CircleGeometry(32.6,64);disco.rotateX(-Math.PI/2);disco.translate(0,0.02,0);
    const bastiao=prismaDePlanta([[0,-6],[6,0],[0,6],[-6,0]],4.8,0,0.16);
    return { disco, bastiao, cortinaX:caixaChanfrada(34,4.8,4.6,0.18), cortinaZ:caixaChanfrada(4.6,4.8,34,0.18),
      parapeitoX:caixaChanfrada(34,1.0,1.2,0.09), parapeitoZ:caixaChanfrada(1.2,1.0,34,0.09), patio:placaDePlanta([[-17,-17],[17,-17],[17,17],[-17,17]],0.06),
      alaX:caixaChanfrada(31,5.5,6.2,0.14), alaZ:caixaChanfrada(6.2,5.5,25,0.14), telhadoX:new THREE.ConeGeometry(17.2,2.2,4), telhadoZ:new THREE.ConeGeometry(14,2.2,4),
      porta:caixaChanfrada(1.35,2.7,0.18,0.06), janela:caixaChanfrada(0.85,1.45,0.16,0.04), ameia:caixaChanfrada(0.8,0.7,0.7,0.06),
      guarita:new THREE.CylinderGeometry(1.2,1.05,2.8,8), cupula:new THREE.ConeGeometry(1.4,1.5,8), bandeira:new THREE.PlaneGeometry(2.4,1.25), mastro:new THREE.CylinderGeometry(0.08,0.1,8,8),
    };
  },[]);
  useEffect(()=>()=>Object.values(geos).forEach(g=>g.dispose()),[geos]);
  const cantos:[number,number][]= [[-21,-21],[21,-21],[21,21],[-21,21]];
  const ameias:Item[]=[];
  for(let x=-16;x<=16;x+=2.2){ameias.push([x,4.7,-21.5],[x,4.7,21.5]);}
  for(let z=-16;z<=16;z+=2.2){ameias.push([-21.5,4.7,z],[21.5,4.7,z]);}
  const portas:Item[]=[[-8,0,-17.12],[0,0,-17.12],[8,0,-17.12],[-17.12,0,-7,1,1,1,Math.PI/2],[-17.12,0,1,1,1,1,Math.PI/2],[-17.12,0,9,1,1,1,Math.PI/2]];
  const janelas:Item[]=[];for(let x=-13;x<=13;x+=4.3)janelas.push([x,3,-17.15]);for(let z=-8;z<=8;z+=4)janelas.push([-17.15,3,z,1,1,1,Math.PI/2]);
  return <group rotation-y={-THREE.MathUtils.degToRad(20)}>
    <mesh name="Terreno_Forte" geometry={geos.disco} material={fab.cor("#c7bda6",0.97)} receiveShadow />
    <mesh name="Patio_Interno" geometry={geos.patio} material={fab.cor("#ded5c3",0.93)} receiveShadow />
    {cantos.map(([x,z],i)=><mesh key={i} name={`Bastiao_${i+1}`} geometry={geos.bastiao} material={fab.cor("#cbb887",0.93)} position={[x,0,z]} castShadow receiveShadow />)}
    {[-21,21].map((z)=><mesh key={z} name={`Muralha_${z<0?"Norte":"Sul"}`} geometry={geos.cortinaX} material={fab.cor("#cfbd8d",0.93)} position={[0,0,z]} castShadow receiveShadow />)}
    {[-21,21].map((x)=><mesh key={x} name={`Muralha_${x<0?"Oeste":"Leste"}`} geometry={geos.cortinaZ} material={fab.cor("#cfbd8d",0.93)} position={[x,0,0]} castShadow receiveShadow />)}
    {[-21,21].map((z)=><mesh key={z} name="Parapeito_Cortina" geometry={geos.parapeitoX} material={fab.cor("#ead9ad",0.88)} position={[0,4.5,z]} castShadow />)}
    {[-21,21].map((x)=><mesh key={x} name="Parapeito_Lateral" geometry={geos.parapeitoZ} material={fab.cor("#ead9ad",0.88)} position={[x,4.5,0]} castShadow />)}
    <Instancias nome="Muralhas_Ameias" geo={geos.ameia} mat={fab.cor("#ead9ad",0.88)} itens={ameias} />
    <mesh name="Quartel_Ala_Norte" geometry={geos.alaX} material={fab.cor("#efd98e",0.9)} position={[0,0,-14]} castShadow receiveShadow />
    <mesh name="Quartel_Ala_Oeste" geometry={geos.alaZ} material={fab.cor("#efd98e",0.9)} position={[-14,0,0]} castShadow receiveShadow />
    <mesh name="Quartel_Telhado_Norte" geometry={geos.telhadoX} material={fab.cor("#ba573a",0.8)} position={[0,5.5,-14]} rotation-y={Math.PI/4} scale={[1,1,0.2]} castShadow />
    <mesh name="Quartel_Telhado_Oeste" geometry={geos.telhadoZ} material={fab.cor("#ba573a",0.8)} position={[-14,5.5,0]} rotation-y={Math.PI/4} scale={[1,1,0.23]} castShadow />
    <Instancias nome="Quartel_Portas_Verdes" geo={geos.porta} mat={fab.cor("#365d43",0.72)} itens={portas} />
    <Instancias nome="Quartel_Janelas" geo={geos.janela} mat={fab.cor("#33484a",0.42)} itens={janelas} />
    <mesh name="Guarita_Nordeste" geometry={geos.guarita} material={fab.cor("#dfcc9d",0.9)} position={[21,5.9,-21]} castShadow />
    <mesh name="Guarita_Cupula" geometry={geos.cupula} material={fab.cor("#b44d34",0.78)} position={[21,7.3,-21]} castShadow />
    <mesh name="Mastro_Bandeira" geometry={geos.mastro} material={fab.cor("#555047",0.45)} position={[0,8,-14]} castShadow />
    <mesh name="Bandeira_Ceara" geometry={geos.bandeira} material={fab.cor("#2f7748",0.55)} position={[1.2,10.8,-14]} castShadow />
    <Canhao x={-13} z={-21} a={0} fab={fab}/><Canhao x={13} z={-21} a={0} fab={fab}/><Canhao x={21} z={12} a={Math.PI/2} fab={fab}/><Canhao x={-21} z={12} a={Math.PI/2} fab={fab}/>
  </group>;
}
