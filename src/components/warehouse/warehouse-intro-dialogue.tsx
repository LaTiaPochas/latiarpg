"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Libre_Baskerville } from "next/font/google";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const DIALOGUES = [
  "Che se me ocurrió que podemos armar unos cofres para guardar cosas.",
  "Yo me puedo encargar de hacerlos y mantenerlos ordenados.",
  "Pero voy a necesitar algo de madera, no mucha.",
  "¿Me das una mano?",
] as const;

type WarehouseIntroDialogueProps = {
  onComplete: () => Promise<{ ok: boolean }>;
};

export function WarehouseIntroDialogue({ onComplete }: WarehouseIntroDialogueProps) {
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const isLastDialogue = dialogueIndex >= DIALOGUES.length - 1;
  const currentText = useMemo(
    () => DIALOGUES[Math.min(dialogueIndex, DIALOGUES.length - 1)],
    [dialogueIndex],
  );

  const advance = useCallback(() => {
    if (isPending) return;
    if (!isLastDialogue) {
      setDialogueIndex((value) => Math.min(value + 1, DIALOGUES.length - 1));
      return;
    }
    startTransition(async () => {
      const result = await onComplete();
      if (result.ok) {
        window.location.reload();
      }
    });
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
    <div className="absolute inset-0 z-20 bg-black/60" onClick={advance}>
      <div className="relative h-full w-full">
        <div className="pointer-events-none absolute bottom-[86px] left-[max(8px,calc(50%-34rem))] z-30 sm:bottom-[108px]">
          <Image
            src="/img/resources/characters/pj_mati_seller.png"
            alt="Mati"
            width={1000}
            height={1000}
            className="h-[500px] translate-x-25 translate-y-25 w-auto object-contain drop-shadow-[0_12px_26px_rgba(0,0,0,0.65)] sm:h-[850px] sm:translate-x-150 sm:translate-y-50"
            priority
          />
        </div>

        <div className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-30 p-2 sm:p-6`}>
          <div className="mx-auto flex w-full max-w-3xl gap-3 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-3">
            <div className="flex min-w-0 flex-1 flex-col self-stretch">
              <p className="text-left text-[13px] leading-relaxed text-amber-50/95 sm:text-lg">{currentText}</p>
              <div className="mt-auto flex justify-center pt-4">
                <span className="text-center text-xs text-amber-100/90">
                  {isPending ? "Guardando..." : "Click o Enter para continuar"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
