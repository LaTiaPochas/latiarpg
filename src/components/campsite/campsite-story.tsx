"use client";

import Image from "next/image";
import { Libre_Baskerville } from "next/font/google";
import { useCallback, useEffect, useState, useTransition } from "react";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const PJ_SILVA_RPG_STANDING_2 = "/img/resources/characters/pj_silva_rpg_standing_2.png";
const PJ_SILVA_RPG_FACE_2 = "/img/resources/caracters_faces/pj_silva_rpg_face_2.png";

const CAMP_DIALOGUES = [
  "¡{Name}!, los muchachos ya empezaron con la construcción.",
  "GAAAAH",
  "Quedamos en que vamos a juntar madera entre todos para aportar.",
  "¿Trajiste algo?",
] as const;

type CampsiteStoryProps = {
  playerName: string;
  playerSpriteSrc: string;
  onViewContributions: () => Promise<void>;
};

export function CampsiteStory({ playerName, playerSpriteSrc, onViewContributions }: CampsiteStoryProps) {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const playerNameCapitalized =
    playerName.length > 0 ? `${playerName.charAt(0).toUpperCase()}${playerName.slice(1)}` : playerName;

  const canAdvance = step <= CAMP_DIALOGUES.length;
  const isLastDialogue = step === CAMP_DIALOGUES.length;
  const currentDialogue = CAMP_DIALOGUES[Math.max(0, step - 1)]?.replace("{Name}", playerNameCapitalized);

  const advance = useCallback(() => {
    if (!canAdvance || isLastDialogue) return;
    setStep((value) => Math.min(value + 1, CAMP_DIALOGUES.length));
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
    <div className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#120b08] text-amber-50">
      <style jsx>{`
        @keyframes campsite-slide-in-right {
          0% {
            opacity: 0;
            transform: translateX(38px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .campsite-slide-in-right {
          animation: campsite-slide-in-right 0.45s ease-out forwards;
        }
      `}</style>

      <Image
        src="/img/resources/background/bg_intro_forest.png"
        alt=""
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/40" />

      <div className="pointer-events-none absolute inset-y-10 left-80 z-10 flex items-end pb-6 pl-2 sm:pl-6 md:pl-10">
        <Image
          src={playerSpriteSrc}
          alt={`Sprite de ${playerName}`}
          width={720}
          height={1080}
          className="h-[min(60vh,420px)] w-auto max-w-[min(70vw,320px)] object-contain object-bottom drop-shadow-[0_10px_26px_rgba(0,0,0,0.6)]"
        />
      </div>

      {step >= 1 ? (
        <div className="pointer-events-none absolute inset-y-10 right-80 z-10 flex items-end pb-6 pr-2 sm:pr-6 md:pr-10">
          <div key={step >= 1 ? "silva-enter" : "silva-idle"} className="campsite-slide-in-right">
            <Image
              src={PJ_SILVA_RPG_STANDING_2}
              alt="Silva"
              width={720}
              height={1080}
              className="h-[min(60vh,420px)] w-auto max-w-[min(70vw,340px)] object-contain object-bottom drop-shadow-[0_10px_26px_rgba(0,0,0,0.6)]"
            />
          </div>
        </div>
      ) : null}

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
              aria-label="Siguiente diálogo"
            />
          ) : null}
          <div className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-30 p-2 sm:p-6`}>
            <div className="mx-auto flex w-full max-w-3xl gap-3 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-3">
              <div className="my-0 -ml-1 w-16 shrink-0 self-stretch overflow-hidden rounded-md border border-amber-700/70 bg-black/30 sm:-ml-3.5 sm:w-28">
                <Image
                  src={PJ_SILVA_RPG_FACE_2}
                  alt="Retrato de Silva"
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex flex-1 flex-col self-stretch">
                <p className="text-left text-[13px] leading-relaxed text-amber-50/95 sm:text-lg">{currentDialogue}</p>
                <div className="mt-auto flex justify-center pt-4">
                  {isLastDialogue ? (
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          await onViewContributions();
                        })
                      }
                      disabled={isPending}
                      className="pointer-events-auto cursor-pointer rounded border border-lime-700/90 bg-gradient-to-b from-lime-600 to-emerald-800 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-lime-100 shadow-[0_0_8px_rgba(34,197,94,0.35)] transition hover:from-lime-500 hover:to-emerald-700 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-300 disabled:shadow-none"
                    >
                      {isPending ? "Guardando..." : "Ver aportes"}
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
