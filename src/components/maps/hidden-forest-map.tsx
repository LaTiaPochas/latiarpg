"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { CaveEntranceDialogue } from "@/components/maps/cave-entrance-dialogue";
import { ExplorationZoneMap, type ExplorationHotspot } from "@/components/maps/exploration-zone-map";
import {
  BOSQUE_INEXPLORADO_DAILY_BOSS_ENCOUNTER_CODE,
  DAILY_BOSS_ALREADY_DEFEATED_MESSAGE,
} from "@/lib/daily-boss-combat";

const MAP_SRC = "/img/resources/maps/map_hiddenforest_start.png";

const HOTSPOTS: ExplorationHotspot[] = [
  {
    id: "trail-head",
    step: 1,
    label: "Entrada al bosque",
    xPercent: 29,
    yPercent: 87,
    description:
      "Se deja ver un camino entre los árboles como si alguien o algo se hubiera abierto paso hace tiempo para poder transitar con más tranquilidad. Si bien no parece haber sido usado recientemente, es posible que haya peligros cerca.",
  },
  {
    id: "leafy-forest",
    step: 2,
    label: "Bosque frondoso",
    xPercent: 50,
    yPercent: 80,
    description:
      "A medida que te adentrás en el bosque empezás a sentir el peligro más presente que nunca. El bosque es cada vez más frondoso y ya no podés ver la salida, aunque sabrías por donde volver si lo necesitás. De todas formas, aun no hay señales de mayores impedimentos.",
  },
  {
    id: "forest-exit",
    step: 3,
    label: "Salida del bosque",
    xPercent: 82,
    yPercent: 66,
    description:
      "Después de una larga caminata, finalmente podés ver la salida del bosque. Sin embargo, por algún motive sentís que puede ser más peligroso ir aun más allá.",
  },
  {
    id: "occupied-ruins",
    step: 4,
    label: "Ruinas de Utul-Dum",
    xPercent: 90,
    yPercent: 30,
    description:
      "Es el primer momento de tu aventura donde sentís miedo. Viste demasiadas películas y jugaste demasiados juegos para saber que este tipo de ruinas están tomadas por enemigos, sin embargo, te proponés a continuar.",
  },
  {
    id: "forest-advance",
    step: 5,
    label: "Puesto de control Trasgo",
    xPercent: 46,
    yPercent: 27,
    description:
      "Dejando atras las ruinas, continuás tu camino hacia el norte. Ya desde el horizonte ves una atalaya que se levanta entre arbustos y árboles bajos, que no te gusta nada. Sabés que este va a ser el desafio más difícil hasta el momento.",
  },
  {
    id: "cave-entrance",
    step: 6,
    label: "Entrada a la cueva",
    xPercent: 10,
    yPercent: 14,
    description:
      "Evidentemente esta cueva era importante para los trasgos. ¿Porqué se tomarían tantas molestias para defenderla? Al acercarte, ves carros de extracción llenos de piedra. Parece no haber enemigos en la entrada.",
  },
];

type HiddenForestMapProps = {
  currentCombatStep: number;
  zoneCode: string;
  initialHotspotId?: string | null;
  caveEntranceDialogCompleted: boolean;
  onCompleteCaveEntranceDialog: () => Promise<void>;
  dailyBossDefeatedToday?: boolean;
  initialDailyBossBlockedMessage?: string | null;
};

export function HiddenForestMap({
  currentCombatStep,
  zoneCode,
  initialHotspotId = null,
  caveEntranceDialogCompleted,
  onCompleteCaveEntranceDialog,
  dailyBossDefeatedToday = false,
  initialDailyBossBlockedMessage = null,
}: HiddenForestMapProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [caveDialogueOpen, setCaveDialogueOpen] = useState(false);

  return (
    <>
      <ExplorationZoneMap
        mapSrc={MAP_SRC}
        mapAlt="Mapa del bosque inexplorado"
        hotspots={HOTSPOTS}
        currentCombatStep={currentCombatStep}
        zoneCode={zoneCode}
        initialHotspotId={initialHotspotId}
        onIrAlla={(hotspot) => {
          if (hotspot.id !== "cave-entrance") {
            return false;
          }
          if (caveEntranceDialogCompleted) {
            router.push("/mystic-cave");
            return true;
          }
          setCaveDialogueOpen(true);
          return true;
        }}
        getIrAllaBlockedMessage={(hotspot) => {
          if (
            hotspot.id === BOSQUE_INEXPLORADO_DAILY_BOSS_ENCOUNTER_CODE &&
            dailyBossDefeatedToday
          ) {
            return DAILY_BOSS_ALREADY_DEFEATED_MESSAGE;
          }
          return null;
        }}
        initialDailyBossBlockedMessage={initialDailyBossBlockedMessage}
      />
      {caveDialogueOpen ? (
        <CaveEntranceDialogue
          onEnterCave={async () => {
            await onCompleteCaveEntranceDialog();
            startTransition(() => {
              router.push("/mystic-cave");
            });
          }}
        />
      ) : null}
    </>
  );
}
