"use client";

import Image from "next/image";
import { Libre_Baskerville } from "next/font/google";
import { useCallback, useEffect, useState, useTransition } from "react";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const DIALOGUES = [
  {
    faceSrc: "/img/resources/caracters_faces/pj_chane_rpg_face.png",
    text: "Bien, con esto terminamos de levantar la muralla, ahora vamos a poder planificar mejor los siguientes pasos.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_leo_rpg_face.png",
    text: "Me parece que habría que terminar de explorar el bosque.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_mati_rpg_face.png",
    text: "No quería alarmalos, pero los goblins iban a estar más adelante en la historia en realidad, nose que hacen acá.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_fede_rpg_face_tired.png",
    text: "Mati me estás jodiendo.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_leo_rpg_face.png",
    text: "Les digo que tenemos que seguir explorando el bosque.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_chane_rpg_face.png",
    text: "Puede ser que tenga razón Leo eh.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_mati_rpg_face.png",
    text: "Bueno, vamos a explorar un poco más a ver que encontramos.",
  },
] as const;

type GarrisonCompleteDialogueProps = {
  onGoToGarrison: () => Promise<void>;
};

export function GarrisonCompleteDialogue({ onGoToGarrison }: GarrisonCompleteDialogueProps) {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();

  const canAdvance = step <= DIALOGUES.length;
  const isLastDialogue = step === DIALOGUES.length;
  const currentDialogue = DIALOGUES[Math.max(0, step - 1)] ?? DIALOGUES[0];

  const advance = useCallback(() => {
    if (!canAdvance || isLastDialogue) return;
    setStep((value) => Math.min(value + 1, DIALOGUES.length));
  }, [canAdvance, isLastDialogue]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      advance();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance]);

  return (
    <div
      className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#120b08] text-amber-50"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.62)), url('/img/resources/background/bg_first_base.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {step === 0 ? (
        <button
          type="button"
          onClick={advance}
          className="absolute inset-0 z-20 flex cursor-pointer items-end justify-center px-6 pb-10 text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
        >
          <span className="rounded-lg bg-black/45 px-4 py-2 text-sm font-medium uppercase tracking-[0.22em] text-amber-200/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            Click o Enter para continuar
          </span>
        </button>
      ) : (
        <>
          {!isLastDialogue ? (
            <button
              type="button"
              onClick={advance}
              className="absolute inset-0 z-20 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
              aria-label="Siguiente dialogo"
            />
          ) : null}
          <div className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-30 p-2 sm:p-6`}>
            <div className="mx-auto flex w-full max-w-3xl gap-3 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-3">
              <div className="my-0 -ml-1 w-16 shrink-0 self-stretch overflow-hidden rounded-md border border-amber-700/70 bg-black/30 sm:-ml-3.5 sm:w-28">
                <Image
                  src={currentDialogue.faceSrc}
                  alt="Retrato del personaje"
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex flex-1 flex-col self-stretch">
                <p className="text-left text-[13px] leading-relaxed text-amber-50/95 sm:text-lg">{currentDialogue.text}</p>
                <div className="mt-auto flex justify-center pt-4">
                  {isLastDialogue ? (
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          await onGoToGarrison();
                        })
                      }
                      disabled={isPending}
                      className="pointer-events-auto cursor-pointer rounded border border-lime-700/90 bg-gradient-to-b from-lime-600 to-emerald-800 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-lime-100 shadow-[0_0_8px_rgba(34,197,94,0.35)] transition hover:from-lime-500 hover:to-emerald-700 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-300 disabled:shadow-none"
                    >
                      {isPending ? "Cargando..." : "ir al campamento"}
                    </button>
                  ) : (
                    <span className="text-center text-xs text-amber-100/90">Click o Enter para continuar</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
