"use client";

import { useMemo } from "react";

import { ExplorationZoneMap, type ExplorationHotspot } from "@/components/maps/exploration-zone-map";

const MAP_SRC = "/img/resources/maps/map_mystic_cave_floor_2.png";

/** Hotspots de profundidades (`combat_encounters.code` = `id`). */
const HOTSPOTS: ExplorationHotspot[] = [
  {
    id: "cave-depth-1",
    step: 1,
    label: "Galería profunda",
    xPercent: 44,
    yPercent: 73,
    description:
      "El túnel te lleva a un lugar mucho más profundo de lo que ya estabas. Parece una especie de guarida subterránea por donde los trasgos extraían parte de los minerales que minaban, aunque parece que ese propósito está en desuso. Hay un puente natural que cruza el lago y te lleva a una plataforma grande.",
  },
  {
    id: "cave-depth-2",
    step: 2,
    label: "Puente Rocoso",
    xPercent: 56,
    yPercent: 50,
    description:
      "Los lizardmen que están escapando de algo. Averiguemos que es.",
  },
  {
    id: "cave-depth-3",
    step: 3,
    label: "Cámara oscura",
    xPercent: 53,
    yPercent: 35,
    description:
      "Parece que tu presencia no pasó para nada inadvertida y te estaban esperando. No es nada como lo que hayas visto antes. Pensas en todos los momentos vividos con La Tía, te aferrás a tu arma y te preparás para el combate.",
  },
  {
    id: "cave-depth-4",
    step: 4,
    label: "???",
    xPercent: 52,
    yPercent: 20,
    description:
      "Una personalidad extraña quiere hablarte.",
  },
  {
    id: "cave-depth-5",
    step: 5,
    label: "Pozo de las Almas",
    xPercent: 52,
    yPercent: 15,
    description:
      "Este es el mencionado pozo de las almas. Parece que este tipo extraño estaba usando la mano de obra y organización de los Trasgos para extraer este mineral, y la dureza y de los Lizardmen para protegerse de los peligros de la cueva. Sea como sea, hay que cerrar este pozo.",
  },
  {
    id: "cave-depth-6",
    step: 5,
    label: "Mina de Hierro",
    xPercent: 12,
    yPercent: 27,
    description:
      "Una mina como la que encontramos antes de Carbón, pero esta pareciera ser de hierro..",
  },
];

/** No se muestran en el mapa hasta alcanzar este `combat_step` en la zona. */
const REVEAL_AT_COMBAT_STEP: Partial<Record<string, number>> = {
  "cave-depth-4": 4,
  "cave-depth-5": 5,
  "cave-depth-6": 5,
};

function isCaveDepthHotspotRevealed(spot: ExplorationHotspot, currentCombatStep: number): boolean {
  const revealAt = REVEAL_AT_COMBAT_STEP[spot.id];
  if (revealAt == null) return true;
  return currentCombatStep >= revealAt;
}

type CaveDepthsMapProps = {
  currentCombatStep: number;
  zoneCode: string;
  initialHotspotId?: string | null;
};

export function CaveDepthsMap({
  currentCombatStep,
  zoneCode,
  initialHotspotId = null,
}: CaveDepthsMapProps) {
  const revealedHotspots = useMemo(
    () => HOTSPOTS.filter((spot) => isCaveDepthHotspotRevealed(spot, currentCombatStep)),
    [currentCombatStep],
  );

  return (
    <ExplorationZoneMap
      mapSrc={MAP_SRC}
      mapAlt="Mapa de las profundidades de la cueva"
      hotspots={revealedHotspots}
      currentCombatStep={currentCombatStep}
      zoneCode={zoneCode}
      initialHotspotId={initialHotspotId}
    />
  );
}
