"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ExplorationZoneMap, type ExplorationHotspot } from "@/components/maps/exploration-zone-map";

const ABANDONED_MINE_HOTSPOT_ID = "cave-node-5";
const HIDDEN_HOTSPOT_ID = "cave-node-0";

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
    description: "Te adentrás en la cueva, algo te dice que el trasgo no es el único que la habita, sin embargo, parece lo suficientemente seguro como para empezar a avanzar.",
  },
  {
    id: "cave-node-2",
    step: 2,
    label: "Avanzada Rocosa",
    xPercent: 71,
    yPercent: 37,
    description: "Cuanto más avanzas, más evidentes se hacen los ruidos a explosivos y el eco de las voces de trasgos comandando pelotones para extraer material. ¿Qué es lo qué estarán buscando acá?",
  },
  {
    id: "cave-node-3",
    step: 3,
    label: "Descenso a la Mina",
    xPercent: 55,
    yPercent: 55,
    description: "Cuánto más avanzás, más cantidad de trasgos hay, y más organización. Va a tener que tener mucho cuidado de acá en adelante.",
  },
  {
    id: "cave-node-4",
    step: 4,
    label: "Bifurcación Oscura",
    xPercent: 45,
    yPercent: 76,
    description: "El camino se bifurca, uno de los lados es oscuro y parece abandonado, para el otro se ve un puente a lo lejos. En este punto, volteás y ya no ves la luz de la entrada, solamente está iluminado por unas precarias antorchas trasgas.",
  },
  {
    id: "cave-node-5",
    step: 5,
    label: "Mina Abandonada",
    xPercent: 73,
    yPercent: 88,
    description: "Parece que esta parte de la mina no se usa hace bastante tiempo. Cuando te acercás, notás los cadaveres trasgos en el suelo, y un sitio de minería abandonado. Podés entrar a examinar.",
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
    step: 6,
    label: "Puente Colgante",
    xPercent: 26,
    yPercent: 50,
    description: "Estos hombres lagarto son mucho mejores combatientes que los Trasgos. Incluso Ka'Tur se sentía improvisado al lado de las tácticas de combate de los Lizardmen.",
  },
  {
    id: "cave-node-8",
    step: 7,
    label: "Final del Camino",
    xPercent: 30,
    yPercent: 30,
    description: "Llegar hasta acá no fue nada fácil, estás cansado pero no es el momento de retroceder ahora. El camino se bifurca nuevamente, uno de los lados, parece ser un punto importante, el otro... solo nos lleva más adentro en la mina.",
  },
  {
    id: "cave-node-9",
    step: 8,
    label: "Punto de Control Tomado",
    xPercent: 48,
    yPercent: 28,
    description: "Los lizardmen tomaron este punto de control Trasgo. Se nota que no se llevan para nada bien, al final... no estaban trabajando juntos.",
  },
  {
    id: "cave-node-10",
    step: 8,
    label: "Las Profundidades",
    xPercent: 19,
    yPercent: 16,
    description: "No se ve nada para adentro. Podría ser eterno este camino, lo unico que se nota, es que va hacia abajo.",
  },
  {
    id: HIDDEN_HOTSPOT_ID,
    step: 5,
    label: "Punto oculto",
    xPercent: 42,
    yPercent: 88,
    description: "",
    hidden: true,
  },
];

type MysticCaveMapProps = {
  currentCombatStep: number;
  zoneCode: string;
  initialHotspotId?: string | null;
};

export function MysticCaveMap({ currentCombatStep, zoneCode, initialHotspotId = null }: MysticCaveMapProps) {
  const router = useRouter();
  const [hiddenModalOpen, setHiddenModalOpen] = useState(false);

  useEffect(() => {
    if (!hiddenModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHiddenModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hiddenModalOpen]);

  return (
    <>
      <ExplorationZoneMap
        mapSrc={MAP_SRC}
        mapAlt="Mapa de la cueva mística — piso 1"
        hotspots={HOTSPOTS}
        currentCombatStep={currentCombatStep}
        zoneCode={zoneCode}
        initialHotspotId={initialHotspotId}
        onHotspotClick={(hotspot) => {
          if (hotspot.id !== HIDDEN_HOTSPOT_ID) return false;
          setHiddenModalOpen(true);
          return true;
        }}
        onIrAlla={(hotspot) => {
          if (hotspot.id !== ABANDONED_MINE_HOTSPOT_ID) {
            return false;
          }
          router.push("/abandoned-coal-mine");
          return true;
        }}
      />

      {hiddenModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setHiddenModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mystic-cave-hidden-modal-title"
            className="w-full max-w-sm rounded-xl border border-amber-600/80 bg-[#1a100c]/95 p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
          >
            <p id="mystic-cave-hidden-modal-title" className="text-lg font-semibold text-amber-100">
              HOLA
            </p>
            <button
              type="button"
              autoFocus
              className="mt-6 cursor-pointer rounded-md border border-amber-500/80 bg-gradient-to-b from-amber-600 to-amber-800 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-50 transition hover:from-amber-500 hover:to-amber-700"
              onClick={() => setHiddenModalOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
