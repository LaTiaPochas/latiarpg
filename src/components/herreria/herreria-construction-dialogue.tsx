"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Libre_Baskerville } from "next/font/google";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const DIALOGUES = [
  "Hola {nombre_del_PJ}, ¿Qué hacés?",
  "Estuve pensando mientras me bañaba...",
  "Los chicos encontraron una recetas de unas armaduras. Me pregunto si habrá muchas así.",
  "Voy a ver de armarme un lugarcito para ver si puedo crear esas cosas.",
  "Pero vamos a necesitar otro tipo de materiales, dame una mano.",
] as const;

const CHANE_SELLER_SPRITE = "/img/resources/characters/pj_chane_seller.png";
const CHANE_STANDING_SPRITE = "/img/resources/characters/pj_chane_rpg_standing.png";

type HerreriaConstructionDialogueProps = {
  playerName: string;
  onComplete: () => Promise<{ ok: boolean }>;
};

export function HerreriaConstructionDialogue({
  playerName,
  onComplete,
}: HerreriaConstructionDialogueProps) {
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const isLastDialogue = dialogueIndex >= DIALOGUES.length - 1;
  const currentText = useMemo(
    () =>
      DIALOGUES[Math.min(dialogueIndex, DIALOGUES.length - 1)].replaceAll(
        "{nombre_del_PJ}",
        playerName,
      ),
    [dialogueIndex, playerName],
  );
  const spriteSrc =
    dialogueIndex === 1 || dialogueIndex === 2 ? CHANE_SELLER_SPRITE : CHANE_STANDING_SPRITE;

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
    <div className="absolute inset-0 z-20 cursor-pointer bg-black/60" onClick={advance}>
      <div className="relative h-full w-full">
        <div className="pointer-events-none absolute bottom-[86px] left-[max(8px,calc(50%-34rem))] z-30 sm:bottom-[108px]">
          <Image
            src={spriteSrc}
            alt="Chane"
            width={1000}
            height={1000}
            className="h-[500px] translate-x-8 translate-y-24 w-auto object-contain drop-shadow-[0_12px_26px_rgba(0,0,0,0.65)] sm:h-[850px] sm:translate-x-125 sm:translate-y-50"
            priority
          />
        </div>

        <div
          className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-30 p-2 sm:p-6`}
        >
          <div className="mx-auto flex w-full max-w-3xl gap-3 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-3">
            <div className="flex min-w-0 flex-1 flex-col self-stretch">
              <p className="text-left text-[13px] leading-relaxed text-amber-50/95 sm:text-lg">
                {currentText}
              </p>
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
