"use client";

import Image from "next/image";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { completeMeloniFoundCave } from "@/app/(main)/mystic-cave/actions";
import { ExplorationZoneMap, type ExplorationHotspot } from "@/components/maps/exploration-zone-map";

const ABANDONED_MINE_HOTSPOT_ID = "cave-node-5";
const HIDDEN_HOTSPOT_ID = "cave-node-0";

const MAP_SRC = "/img/resources/maps/map_mystic_cave_floor_1.png";
const HIDDEN_PIT_MODAL_BG = "/img/resources/background/bg_quest_1.png";
const MELONI_PORTRAIT_SRC = "/img/resources/characters/pj_meloni.png";

type HiddenPitModalStep = "pit" | "meloni";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const HIDDEN_PIT_MODAL_PARAGRAPHS = [
  "Te llama la atención un pozo profundo a lo lejos.",
  "Al acercarte notas que hay alguien colgando, sosteniéndose para no caer.",
] as const;

const MELONI_RESCUE_MODAL_PARAGRAPHS = [
  "Rescataste a una p... ¿Un oso de peluche?",
  "Sin emitir palabra, comenzó a correr hacia la entrada de la cueva, y lo perdiste de vista.",
] as const;

const HIDDEN_PIT_EMPTY_MESSAGE = "No hay nada mas que ver por acá";

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
  meloniFoundCave?: boolean;
};

export function MysticCaveMap({
  currentCombatStep,
  zoneCode,
  initialHotspotId = null,
  meloniFoundCave = false,
}: MysticCaveMapProps) {
  const router = useRouter();
  const [hiddenModalOpen, setHiddenModalOpen] = useState(false);
  const [hiddenModalStep, setHiddenModalStep] = useState<HiddenPitModalStep>("pit");
  const [meloniRescued, setMeloniRescued] = useState(meloniFoundCave);
  const [isSavingMeloni, startMeloniSave] = useTransition();

  useEffect(() => {
    setMeloniRescued(meloniFoundCave);
  }, [meloniFoundCave]);

  const closeHiddenModal = () => {
    setHiddenModalOpen(false);
    setHiddenModalStep("pit");
  };

  useEffect(() => {
    if (!hiddenModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHiddenModal();
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
          setHiddenModalStep("pit");
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={
              meloniRescued
                ? "mystic-cave-hidden-pit-empty"
                : hiddenModalStep === "pit"
                  ? "mystic-cave-hidden-pit-title"
                  : "mystic-cave-hidden-pit-meloni"
            }
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-amber-700/80 bg-[#1a100c]/97 shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
          >
            {meloniRescued ? (
              <>
                <div className="relative aspect-[16/10] w-full shrink-0 border-b border-amber-800/50 bg-black/40">
                  <Image
                    src={HIDDEN_PIT_MODAL_BG}
                    alt="Un pozo profundo en la cueva"
                    fill
                    priority
                    sizes="(max-width: 512px) 100vw, 512px"
                    className="object-contain object-center select-none p-1"
                  />
                </div>

                <div className="flex flex-col px-5 py-6 sm:px-8 sm:py-7">
                  <p
                    id="mystic-cave-hidden-pit-empty"
                    className={`${dialogueFont.className} text-center text-sm leading-relaxed text-amber-50/95 sm:text-sm`}
                  >
                    {HIDDEN_PIT_EMPTY_MESSAGE}
                  </p>

                  <div className={`${uiFont.className} mt-6 flex justify-center sm:mt-8`}>
                    <button
                      type="button"
                      autoFocus
                      className="cursor-pointer rounded-md border border-emerald-600/90 bg-gradient-to-b from-emerald-700 to-emerald-900 px-8 py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-50 shadow-[0_0_14px_rgba(16,185,129,0.25)] transition hover:from-emerald-600 hover:to-emerald-800"
                      onClick={closeHiddenModal}
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              </>
            ) : hiddenModalStep === "pit" ? (
              <>
                <div className="relative aspect-[16/10] w-full shrink-0 border-b border-amber-800/50 bg-black/40">
                  <Image
                    src={HIDDEN_PIT_MODAL_BG}
                    alt="Un pozo profundo en la cueva"
                    fill
                    priority
                    sizes="(max-width: 512px) 100vw, 512px"
                    className="object-contain object-center select-none p-1"
                  />
                </div>

                <div className="flex flex-col px-5 py-6 sm:px-8 sm:py-7">
                  <div
                    id="mystic-cave-hidden-pit-title"
                    className={`${dialogueFont.className} space-y-4 text-center text-sm leading-relaxed text-amber-50/95 sm:text-sm`}
                  >
                    {HIDDEN_PIT_MODAL_PARAGRAPHS.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>

                  <div
                    className={`${uiFont.className} mt-6 flex flex-col items-stretch gap-3 sm:mt-8 sm:flex-row sm:justify-center`}
                  >
                    <button
                      type="button"
                      autoFocus
                      className="cursor-pointer rounded-md border border-emerald-600/90 bg-gradient-to-b from-emerald-700 to-emerald-900 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-50 shadow-[0_0_14px_rgba(16,185,129,0.25)] transition hover:from-emerald-600 hover:to-emerald-800"
                      onClick={() => setHiddenModalStep("meloni")}
                    >
                      Ayudar
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded-md border border-amber-600/85 bg-gradient-to-b from-amber-800/90 to-[#1a100c]/95 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-amber-100/90 transition hover:from-amber-700/90 hover:to-amber-900/95"
                      onClick={closeHiddenModal}
                    >
                      Alejarte
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col px-5 py-6 sm:px-8 sm:py-8">
                <div
                  id="mystic-cave-hidden-pit-meloni"
                  className="relative mx-auto aspect-[3/4] w-full max-w-[220px] shrink-0 overflow-hidden rounded-lg border border-amber-800/60 bg-black/40"
                >
                  <Image
                    src={MELONI_PORTRAIT_SRC}
                    alt="Meloni"
                    fill
                    priority
                    sizes="220px"
                    className="object-contain object-center select-none p-1"
                  />
                </div>

                <div
                  className={`${dialogueFont.className} mt-6 space-y-4 text-center text-sm leading-relaxed text-amber-50/95 sm:text-sm`}
                >
                  {MELONI_RESCUE_MODAL_PARAGRAPHS.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>

                <div className={`${uiFont.className} mt-6 flex justify-center sm:mt-8`}>
                  <button
                    type="button"
                    autoFocus
                    disabled={isSavingMeloni}
                    className="cursor-pointer rounded-md border border-emerald-600/90 bg-gradient-to-b from-emerald-700 to-emerald-900 px-8 py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-50 shadow-[0_0_14px_rgba(16,185,129,0.25)] transition hover:from-emerald-600 hover:to-emerald-800 disabled:cursor-wait disabled:opacity-70"
                    onClick={() => {
                      startMeloniSave(async () => {
                        await completeMeloniFoundCave();
                        setMeloniRescued(true);
                        closeHiddenModal();
                      });
                    }}
                  >
                    {isSavingMeloni ? "Guardando…" : "Continuar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
