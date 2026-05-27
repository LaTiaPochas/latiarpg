"use client";

import Image from "next/image";
import { Libre_Baskerville } from "next/font/google";
import { useCallback, useEffect, useState, useTransition } from "react";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const INTRO_BG = "/img/resources/background/bg_cueva_inner_6.png";
const HAZRAMITOR_SPEAR_SPRITE =
  "/img/resources/enemigos/enemy_sprite_hazramitor_standing_spear.png";
const HAZRAMITOR_FACE = "/img/resources/enemigos_faces/enemy_face_Hazramitor.png";

const DIALOGUES = [
  "Este es el pozo de las almas que te comentaba.",
  "Pareciera que nuestro amigo misterioso lo dejó bloqueado antes de irse.",
  "Ayudame a reconstruir la entrada porfavor, para poder liberarlo de los intrusos que hayan quedado dentro y recuperar la paz en estas cuevas.",
] as const;

type SoulGauntletIntroDialogueProps = {
  onComplete: () => Promise<{ ok: boolean }>;
};

export function SoulGauntletIntroDialogue({ onComplete }: SoulGauntletIntroDialogueProps) {
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const isLastDialogue = dialogueIndex >= DIALOGUES.length - 1;
  const currentText = DIALOGUES[Math.min(dialogueIndex, DIALOGUES.length - 1)];

  const advance = useCallback(() => {
    if (isPending) return;
    if (isLastDialogue) {
      startTransition(async () => {
        const result = await onComplete();
        if (result.ok) {
          window.location.reload();
        }
      });
      return;
    }
    setDialogueIndex((value) => Math.min(value + 1, DIALOGUES.length - 1));
  }, [isLastDialogue, isPending, onComplete, startTransition]);

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
      className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#120b08]"
      style={{
        backgroundImage: `url('${INTRO_BG}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden />
      <div className="absolute inset-0 z-20 cursor-pointer" onClick={advance}>
        <div className="relative h-full w-full">
          <div className="pointer-events-none absolute bottom-[86px] left-[max(8px,calc(50%-34rem))] z-30 sm:bottom-[108px]">
            <Image
              src={HAZRAMITOR_SPEAR_SPRITE}
              alt="Hazramitor"
              width={1000}
              height={1000}
              className="h-[420px] w-auto translate-x-14 translate-y-20 object-contain drop-shadow-[0_12px_26px_rgba(0,0,0,0.65)] sm:h-[780px] sm:translate-x-64 sm:translate-y-32"
              priority
            />
          </div>

          <div
            className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-30 p-2 sm:p-6`}
          >
            <div className="mx-auto flex w-full max-w-3xl gap-3 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-amber-700/50 bg-black/40 sm:h-20 sm:w-20">
                <Image
                  src={HAZRAMITOR_FACE}
                  alt="Hazramitor"
                  fill
                  sizes="80px"
                  className="object-cover object-top"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col self-stretch">
                <p className="text-left text-[13px] leading-relaxed text-amber-50/95 sm:text-lg">
                  {currentText}
                </p>
                <div className="mt-auto flex justify-center pt-4">
                  <span className="text-center text-xs text-amber-100/90">
                    {isPending
                      ? "Guardando..."
                      : isLastDialogue
                        ? "Click o Enter para continuar"
                        : "Click o Enter para continuar"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
