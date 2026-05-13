"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Libre_Baskerville } from "next/font/google";
import { Montserrat } from "next/font/google";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});
const buttonFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const DIALOGUES = [
  "...",
  "¡¡{nombre}!!",
  "Veni... Veni que te cuento algo",
  ".",
  "..",
  "...",
  "....",
  ".....",
  "......",
  "¡BUU!",
  "Ahora enserio.",
  "Descubrí algo en el juego de Mati.",
  "Pero no te voy a contar sin cobrarte...",
] as const;

type SoulAltarDialogueProps = {
  playerName: string;
  onDialogueIndexChange?: (index: number) => void;
  onComplete: () => Promise<{ ok: boolean }>;
};

export function SoulAltarDialogue({
  playerName,
  onDialogueIndexChange,
  onComplete,
}: SoulAltarDialogueProps) {
  const router = useRouter();
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [hasFinishedDialogues, setHasFinishedDialogues] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const currentText = useMemo(
    () =>
      DIALOGUES[Math.min(dialogueIndex, DIALOGUES.length - 1)].replaceAll(
        "{nombre}",
        playerName,
      ),
    [dialogueIndex, playerName],
  );
  const isLastDialogue = dialogueIndex >= DIALOGUES.length - 1;

  useEffect(() => {
    onDialogueIndexChange?.(dialogueIndex);
  }, [dialogueIndex, onDialogueIndexChange]);

  const advance = useCallback(() => {
    if (hasFinishedDialogues) return;
    if (isLastDialogue) {
      setHasFinishedDialogues(true);
      return;
    }
    setDialogueIndex((value) => Math.min(value + 1, DIALOGUES.length - 1));
  }, [hasFinishedDialogues, isLastDialogue]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (hasFinishedDialogues) return;
      event.preventDefault();
      advance();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, hasFinishedDialogues]);

  const completeDialog = useCallback(async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    const result = await onComplete();
    if (result.ok) {
      router.refresh();
      return;
    }
    setIsCompleting(false);
  }, [isCompleting, onComplete, router]);

  return (
    <>
      <div className="absolute inset-0 z-20 bg-black/65" aria-hidden />
      <div
        className="absolute inset-0 z-40 cursor-pointer"
        role="dialog"
        aria-modal="true"
        aria-label="Diálogo del altar de almas"
        onClick={advance}
      >
        <div className="relative h-full w-full">
          <div
            className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 p-2 sm:p-6`}
          >
            <div className="mx-auto flex w-full max-w-3xl rounded-lg border border-amber-800/60 bg-[#1a100c]/94 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:px-6 sm:py-4">
              <div className="flex min-w-0 flex-1 flex-col self-stretch">
                {hasFinishedDialogues ? (
                  <div className="flex justify-center py-2">
                    <button
                      type="button"
                      className={`${buttonFont.className} pointer-events-auto rounded-md border border-amber-600/80 bg-amber-900/35 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.18)] transition hover:bg-amber-800/50 disabled:cursor-wait disabled:opacity-70 sm:text-sm`}
                      disabled={isCompleting}
                      onClick={(event) => {
                        event.stopPropagation();
                        void completeDialog();
                      }}
                    >
                      {isCompleting ? "Cargando..." : "Ver que quiere Leo"}
                    </button>
                  </div>
                ) : (
                  <p className="text-left text-[13px] leading-relaxed text-amber-50/95 sm:text-lg">
                    {currentText}
                  </p>
                )}
                <div className="mt-auto flex justify-center pt-4">
                  <span className="text-center text-xs text-amber-100/90">
                    {hasFinishedDialogues ? "" : "Click o Enter para continuar"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
