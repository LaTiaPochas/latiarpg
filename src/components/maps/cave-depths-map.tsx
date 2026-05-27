"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { CaveDepthsBridgeDialog } from "@/components/maps/cave-depths-bridge-dialog";
import { CaveDepthsPindalDialog } from "@/components/maps/cave-depths-pindal-dialog";
import { ExplorationZoneMap, type ExplorationHotspot } from "@/components/maps/exploration-zone-map";
import {
  CAVE_DEPTHS_DAILY_BOSS_ENCOUNTER_CODE,
  DAILY_BOSS_ALREADY_DEFEATED_MESSAGE,
} from "@/lib/daily-boss-combat";

const MAP_SRC = "/img/resources/maps/map_mystic_cave_floor_2.png";

/** Sin combate asociado: solo diálogo narrativo antes del paso 3. */
const CAVE_DEPTH_BRIDGE_HOTSPOT_ID = "cave-depth-2";
/** Escena narrativa con el enemigo sin rostro (`/cave-depths-story`). */
const CAVE_DEPTH_STORY_HOTSPOT_ID = "cave-depth-4";
const CAVE_DEPTHS_STORY_PATH = "/cave-depths-story";
/** Pozo de las Almas — reconstrucción comunitaria (`/gauntlet-pozo-de-las-almas`). */
const CAVE_DEPTH_SOUL_WELL_HOTSPOT_ID = "cave-depth-5";
const SOUL_WELL_GAUNTLET_PATH = "/gauntlet-pozo-de-las-almas";
/** Área invisible en el mapa (evento Pindal). */
const CAVE_DEPTH_PINDAL_HOTSPOT_ID = "cave-depths-pindal";
const CAVE_DEPTH_3_HOTSPOT_ID = "cave-depth-3";

const CAVE_DEPTH_3_HAZRAMITOR_TRAINING_DESCRIPTION =
  "Ya lograste liberar a Hazramitor, pero nunca rechaza un buen desafio. Le gusta usarlo como entrenamiento.";

/** Hotspots de profundidades (`combat_encounters.code` = `id`, salvo el puente). */
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
    id: CAVE_DEPTH_BRIDGE_HOTSPOT_ID,
    step: 2,
    label: "Puente Rocoso",
    xPercent: 56,
    yPercent: 50,
    description:
      "Los lizardmen que están escapando de algo. Averiguemos que es.",
  },
  {
    id: CAVE_DEPTH_3_HOTSPOT_ID,
    step: 3,
    label: "Cámara oscura",
    xPercent: 53,
    yPercent: 35,
    isBoss: true,
    description:
      "Parece que tu presencia no pasó para nada inadvertida y te estaban esperando. No es nada como lo que hayas visto antes. Pensas en todos los momentos vividos con La Tía, te aferrás a tu arma y te preparás para el combate.",
  },
  {
    id: "cave-depth-4",
    step: 4,
    label: "???",
    xPercent: 52,
    yPercent: 20,
    description: "Una personalidad extraña quiere hablarte.",
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
    id: CAVE_DEPTH_PINDAL_HOTSPOT_ID,
    step: 5,
    label: "Evento Pindal",
    xPercent: 80,
    yPercent: 53,
    description: "",
    hidden: true,
  },
  /*
  {
    id: "cave-depth-6",
    step: 5,
    label: "Mina de Hierro",
    xPercent: 12,
    yPercent: 27,
    description:
      "Una mina como la que encontramos antes de Carbón, pero esta pareciera ser de hierro..",
  },*/
];

/** No se muestran en el mapa hasta alcanzar este `combat_step` en la zona. */
const REVEAL_AT_COMBAT_STEP: Partial<Record<string, number>> = {
  "cave-depth-4": 4,
  "cave-depth-5": 5,
  "cave-depth-6": 5,
  [CAVE_DEPTH_PINDAL_HOTSPOT_ID]: 5,
};

/** Se ocultan cuando `combat_step` supera este valor (p. ej. historia de `cave-depth-4` ya completada). */
const HIDE_WHEN_COMBAT_STEP_ABOVE: Partial<Record<string, number>> = {
  [CAVE_DEPTH_STORY_HOTSPOT_ID]: 4,
};

function resolveCaveDepthHotspotDescription(
  spot: ExplorationHotspot,
  currentCombatStep: number,
): string {
  if (spot.id === CAVE_DEPTH_3_HOTSPOT_ID && currentCombatStep >= 4) {
    return CAVE_DEPTH_3_HAZRAMITOR_TRAINING_DESCRIPTION;
  }
  return spot.description;
}

function isCaveDepthHotspotRevealed(spot: ExplorationHotspot, currentCombatStep: number): boolean {
  const hideAbove = HIDE_WHEN_COMBAT_STEP_ABOVE[spot.id];
  if (hideAbove != null && currentCombatStep > hideAbove) {
    return false;
  }

  const revealAt = REVEAL_AT_COMBAT_STEP[spot.id];
  if (revealAt == null) return true;
  return currentCombatStep >= revealAt;
}

type CaveDepthsMapProps = {
  currentCombatStep: number;
  zoneCode: string;
  initialHotspotId?: string | null;
  depthsBridgeDialogCompleted: boolean;
  pindalFound: boolean;
  storyBossEncounterCodes?: readonly string[];
  dailyBossDefeatedToday?: boolean;
  initialDailyBossBlockedMessage?: string | null;
};

export function CaveDepthsMap({
  currentCombatStep,
  zoneCode,
  initialHotspotId = null,
  depthsBridgeDialogCompleted,
  pindalFound,
  storyBossEncounterCodes = [],
  dailyBossDefeatedToday = false,
  initialDailyBossBlockedMessage = null,
}: CaveDepthsMapProps) {
  const router = useRouter();
  const [bridgeDialogOpen, setBridgeDialogOpen] = useState(false);
  const [pindalDialogOpen, setPindalDialogOpen] = useState(false);
  const [pindalResolved, setPindalResolved] = useState(pindalFound);
  const pindalCompleted = pindalFound || pindalResolved;

  useEffect(() => {
    setPindalResolved(pindalFound);
  }, [pindalFound]);

  const revealedHotspots = useMemo(
    () =>
      HOTSPOTS.filter((spot) => {
        if (depthsBridgeDialogCompleted && spot.id === CAVE_DEPTH_BRIDGE_HOTSPOT_ID) {
          return false;
        }
        return isCaveDepthHotspotRevealed(spot, currentCombatStep);
      }).map((spot) => ({
        ...spot,
        description: resolveCaveDepthHotspotDescription(spot, currentCombatStep),
        nonClickable:
          pindalCompleted && spot.id === CAVE_DEPTH_PINDAL_HOTSPOT_ID ? true : undefined,
      })),
    [currentCombatStep, depthsBridgeDialogCompleted, pindalCompleted],
  );

  const handleBridgeDialogComplete = () => {
    setBridgeDialogOpen(false);
    router.refresh();
  };

  const handlePindalDialogComplete = () => {
    setPindalDialogOpen(false);
    setPindalResolved(true);
    router.refresh();
  };

  return (
    <>
      <ExplorationZoneMap
        mapSrc={MAP_SRC}
        mapAlt="Mapa de las profundidades de la cueva"
        hotspots={revealedHotspots}
        currentCombatStep={currentCombatStep}
        zoneCode={zoneCode}
        initialHotspotId={initialHotspotId}
        storyBossEncounterCodes={storyBossEncounterCodes}
        initialDailyBossBlockedMessage={initialDailyBossBlockedMessage}
        getIrAllaBlockedMessage={(hotspot) => {
          if (
            hotspot.id === CAVE_DEPTHS_DAILY_BOSS_ENCOUNTER_CODE &&
            dailyBossDefeatedToday
          ) {
            return DAILY_BOSS_ALREADY_DEFEATED_MESSAGE;
          }
          return null;
        }}
        onHotspotClick={(hotspot) => {
          if (hotspot.id === CAVE_DEPTH_PINDAL_HOTSPOT_ID) {
            if (pindalCompleted) return true;
            setPindalDialogOpen(true);
            return true;
          }
          return false;
        }}
        onIrAlla={(hotspot) => {
          if (hotspot.id === CAVE_DEPTH_STORY_HOTSPOT_ID) {
            router.push(CAVE_DEPTHS_STORY_PATH);
            return true;
          }
          if (hotspot.id === CAVE_DEPTH_BRIDGE_HOTSPOT_ID) {
            setBridgeDialogOpen(true);
            return true;
          }
          if (hotspot.id === CAVE_DEPTH_SOUL_WELL_HOTSPOT_ID) {
            router.push(SOUL_WELL_GAUNTLET_PATH);
            return true;
          }
          return false;
        }}
      />

      <CaveDepthsBridgeDialog
        open={bridgeDialogOpen}
        onComplete={handleBridgeDialogComplete}
      />

      <CaveDepthsPindalDialog open={pindalDialogOpen} onComplete={handlePindalDialogComplete} />
    </>
  );
}
