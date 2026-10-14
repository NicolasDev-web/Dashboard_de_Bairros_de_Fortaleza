import * as THREE from "three";

/**
 * O que os marcos usam da cena: a fábrica de materiais, o pedestal redondo e as medidas comuns.
 * Reconstruído a partir dos GLB publicados (o Cena.tsx original não veio no pacote): o pedestal é um cilindro
 * de 68 m de diâmetro e 0,5 m de altura (48 lados, #e8e5de), e cada modelo fica em cima dele, em y = 0,5.
 * Metros, y para cima, norte em −z.
 */
export const RAIO_BASE = 34;
export const ALTURA_PEDESTAL = 0.5;

export interface Fabrica {
  /** Material fosco de cor chapada (metalness 0). Fica em cache por cor e rugosidade e já sai nomeado. */
  cor(hex: string, rugosidade?: number): THREE.MeshStandardMaterial;
  /** Espelho d'água: azul com reflexo baixo e um leve brilho próprio, igual em todos os marcos. */
  agua(): THREE.MeshStandardMaterial;
}

export function criarFabrica(): Fabrica {
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  return {
    cor(hex, rugosidade = 0.9) {
      const chave = `${hex.toLowerCase()}|${rugosidade}`;
      let m = cache.get(chave);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ color: hex, roughness: rugosidade, metalness: 0 });
        m.name = `Mat_${hex.replace("#", "").toLowerCase()}_r${Math.round(rugosidade * 100)}`;
        cache.set(chave, m);
      }
      return m;
    },
    agua() {
      let m = cache.get("agua");
      if (!m) {
        m = new THREE.MeshStandardMaterial({ color: "#41b1dc", roughness: 0.08, metalness: 0.05, emissive: "#00506c", emissiveIntensity: 0.18 });
        m.name = "Mat_Agua";
        cache.set("agua", m);
      }
      return m;
    },
  };
}

/** Pedestal claro de todas as miniaturas */
export function Pedestal() {
  return (
    <mesh name="Base_Pedestal" position-y={ALTURA_PEDESTAL / 2} receiveShadow>
      <cylinderGeometry args={[RAIO_BASE, RAIO_BASE, ALTURA_PEDESTAL, 48]} />
      <meshStandardMaterial name="Mat_Pedestal" color="#e8e5de" roughness={0.95} />
    </mesh>
  );
}
