"use client";

import { useRouter } from "next/navigation";

import { ExplorationZoneMap, type ExplorationHotspot } from "@/components/maps/exploration-zone-map";

const ABANDONED_MINE_HOTSPOT_ID = "cave-node-5";

const MAP_SRC = "/img/resources/maps/map_mystic_cave_floor_1.png";

/**
 * 9 hotspots de placeholder — ajustá `xPercent`, `yPercent`, labels y descripciones.
 * `step` controla el desbloqueo según `user_combat_progress.combat_step` en `mystic-cave`.
 */
const HOTSPOTS: ExplorationHotspot[] = [
  {
    id: "cave-node-1",
    step: 1,
    label: "Entrada a la Cueva",
    xPercent: 81,
    yPercent: 18,
    description: "Nos adentramos en la cueva, se nota que el trasgo no es el único que la habita.",
  },
  {
    id: "cave-node-2",
    step: 2,
    label: "Avanzada Rocosa",
    xPercent: 71,
    yPercent: 37,
    description: "Salteamos el primer obstaculo, pero hay que estar atentos a lo que se viene.",
  },
  {
    id: "cave-node-3",
    step: 3,
    label: "Descenso a la Mina",
    xPercent: 55,
    yPercent: 55,
    description: "Confirmamos las sospechas, esto era mucho más complejo que unos simples túneles trasgos.",
  },
  {
    id: "cave-node-4",
    step: 4,
    label: "Bifurcación Oscura",
    xPercent: 45,
    yPercent: 76,
    description: "El camino se bifurca, uno de los lados es oscuro y parece abandonado, para el otro se ve un puente a lo lejos.",
  },
  {
    id: "cave-node-5",
    step: 5,
    label: "Mina Abandonada",
    xPercent: 73,
    yPercent: 88,
    description: "Parece que esta parte de la mina no se usa hace bastante tiempo.",
  },
  {
    id: "cave-node-6",
    step: 5,
    label: "Risco Custodiado",
    xPercent: 27,
    yPercent: 75,
    description: "El camino se ensancha y es dificil pasar sin mirar hacia abajo. Lo único peor que este risco, es el puente que se ve adelante.",
  },
  {
    id: "cave-node-7",
    step: 7,
    label: "Puente Colgante",
    xPercent: 26,
    yPercent: 50,
    description: "Si pudiera evitar cruzar por este puente, lo haría. Pero hay que llegar al fondo de esto, ¿Porqué están tan organizados?.",
  },
  {
    id: "cave-node-8",
    step: 8,
    label: "Final del Camino",
    xPercent: 30,
    yPercent: 30,
    description: "Llegar hasta acá no fue nada fácil. No podemos darnos por vencidos ahora. El camino se bifurca nuevamente, uno de los lados, parece ser un punto importante, el otro... solo nos lleva más adentro en la mina.",
  },
  {
    id: "cave-node-9",
    step: 9,
    label: "Punto de Control Tomado",
    xPercent: 48,
    yPercent: 28,
    description: "Los lizardmen tomaron este punto de control Trasgo. Se nota que no se llevan para nada bien, al final... no estaban trabajando juntos.",
  },
  {
    id: "cave-node-10",
    step: 9,
    label: "Las Profundidades",
    xPercent: 19,
    yPercent: 16,
    description: "No se ve nada para adentro. Podría ser eterno este camino, lo unico que se nota, es que va hacia abajo.",
  },
  {
    id: "cave-node-0",
    step: 5,
    label: "Hidden Step",
    xPercent: 42,
    yPercent: 88,
    description: "[Placeholder] Descripción del punto 9 en la cueva.",
  },
];

type MysticCaveMapProps = {
  currentCombatStep: number;
  zoneCode: string;
  initialHotspotId?: string | null;
};

export function MysticCaveMap({ currentCombatStep, zoneCode, initialHotspotId = null }: MysticCaveMapProps) {
  const router = useRouter();

  return (
    <ExplorationZoneMap
      mapSrc={MAP_SRC}
      mapAlt="Mapa de la cueva mística — piso 1"
      hotspots={HOTSPOTS}
      currentCombatStep={currentCombatStep}
      zoneCode={zoneCode}
      initialHotspotId={initialHotspotId}
      onIrAlla={(hotspot) => {
        if (hotspot.id !== ABANDONED_MINE_HOTSPOT_ID) {
          return false;
        }
        router.push("/abandoned-coal-mine");
        return true;
      }}
    />
  );
}
