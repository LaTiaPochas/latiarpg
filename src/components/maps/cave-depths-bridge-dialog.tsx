"use client";

import Image from "next/image";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { useCallback, useEffect, useState, useTransition } from "react";

import { completeDepthsBridgeDialog } from "@/app/(main)/cave-depths/actions";

const BRIDGE_DIALOG_BG = "/img/resources/background/bg_cueva_inner_7.png";

const DIALOGUES = [
  "¡Hazramitor se volvió loco!",
  "¡Está atacando a los nuestros!",
  "A un lado habitante de la superficie, no vamos a quedarnos a ser aplastados.",
] as const;

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

type CaveDepthsBridgeDialogProps = {
  open: boolean;
  onComplete: () => void;
};

export function CaveDepthsBridgeDialog({ open, onComplete }: CaveDepthsBridgeDialogProps) {
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [isPending, startTransition] = useTransition();

  const isLastDialogue = dialogueIndex >= DIALOGUES.length - 1;
  const currentText = DIALOGUES[Math.min(dialogueIndex, DIALOGUES.length - 1)];

  const advanceDialogue = useCallback(() => {
    if (isPending || isLastDialogue) return;
    setDialogueIndex((value) => Math.min(value + 1, DIALOGUES.length - 1));
  }, [isLastDialogue, isPending]);

  const handleContinue = useCallback(() => {
    if (!isLastDialogue || isPending) return;
    startTransition(async () => {
      const result = await completeDepthsBridgeDialog();
      if (!result.ok) return;
      setDialogueIndex(0);
      onComplete();
    });
  }, [isLastDialogue, isPending, onComplete]);

  useEffect(() => {
    if (!open) {
      setDialogueIndex(0);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (isLastDialogue) {
        handleContinue();
      } else {
        advanceDialogue();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advanceDialogue, handleContinue, isLastDialogue, open]);

  const handleAdvanceClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (isPending || isLastDialogue) return;
      event.stopPropagation();
      advanceDialogue();
    },
    [advanceDialogue, isLastDialogue, isPending],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex touch-manipulation items-center justify-center bg-black/75 p-2 sm:p-4"
      role="presentation"
      onClick={handleAdvanceClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cave-depths-bridge-dialog-text"
        className={`relative flex h-[min(92vh,820px)] w-[min(96vw,1280px)] flex-col overflow-hidden rounded-xl border border-amber-700/80 bg-[#0a0604] shadow-[0_24px_60px_rgba(0,0,0,0.7)] ${!isLastDialogue ? "cursor-pointer" : ""} ${uiFont.className}`}
        onClick={handleAdvanceClick}
      >
        <div className="relative min-h-0 flex-1 bg-black">
          <Image
            src={BRIDGE_DIALOG_BG}
            alt="Puente rocoso en las profundidades de la cueva"
            fill
            priority
            sizes="96vw"
            className="object-cover object-center select-none"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/35" />
        </div>

        <div
          className={`${dialogueFont.className} relative z-10 shrink-0 border-t border-amber-800/60 bg-[#1a100c]/95 px-4 py-3 sm:px-8 sm:py-4`}
        >
          <p
            id="cave-depths-bridge-dialog-text"
            className="text-center text-sm leading-relaxed text-amber-50/95 sm:text-lg"
          >
            {currentText}
          </p>

          <div className="mt-4 flex justify-center">
            {isLastDialogue ? (
              <button
                type="button"
                autoFocus
                disabled={isPending}
                onClick={(event) => {
                  event.stopPropagation();
                  handleContinue();
                }}
                className="cursor-pointer rounded-md border border-emerald-600/90 bg-gradient-to-b from-emerald-700 to-emerald-900 px-10 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-50 shadow-[0_0_14px_rgba(16,185,129,0.25)] transition hover:from-emerald-600 hover:to-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Guardando..." : "CONTINUAR"}
              </button>
            ) : (
              <span className="text-center text-[9px] uppercase tracking-[0.16em] text-amber-100/85">
                Click o Enter para continuar
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
