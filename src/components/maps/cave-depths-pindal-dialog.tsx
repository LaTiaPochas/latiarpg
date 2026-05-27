"use client";

import Image from "next/image";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { useCallback, useEffect, useTransition } from "react";

import { completePindalFound } from "@/app/(main)/cave-depths/actions";

const PINDAL_DIALOG_BG = "/img/resources/background/bg_quest_deeps_1.png";

const DIALOGUE_LINES = [
  "¡Oh, me encontraste!",
  "Me estaba escondiendo de esa bestia",
  "Por suerte todo está más calmado ahora. Voy a aprovechar para irme de acá.",
  "Tal vez nos veamos por ahí luego.",
] as const;

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

type CaveDepthsPindalDialogProps = {
  open: boolean;
  onComplete: () => void;
};

export function CaveDepthsPindalDialog({ open, onComplete }: CaveDepthsPindalDialogProps) {
  const [isPending, startTransition] = useTransition();

  const handleContinue = useCallback(() => {
    if (isPending) return;
    startTransition(async () => {
      const result = await completePindalFound();
      if (!result.ok) return;
      onComplete();
    });
  }, [isPending, onComplete]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleContinue();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleContinue, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex touch-manipulation items-center justify-center bg-black/75 p-2 sm:p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cave-depths-pindal-dialog-title"
        className={`relative flex h-[min(92vh,620px)] w-[min(96vw,500px)] flex-col overflow-hidden rounded-xl border border-amber-700/80 bg-[#0a0604] shadow-[0_24px_60px_rgba(0,0,0,0.7)] ${uiFont.className}`}
      >
        <div className="relative min-h-0 flex-1 bg-black">
          <Image
            src={PINDAL_DIALOG_BG}
            alt="Pindal en las profundidades de la cueva"
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
          <div className="space-y-2 text-center text-xs leading-relaxed text-amber-50/95 sm:text-sm">
            <p id="cave-depths-pindal-dialog-title" className="font-semibold">
              {DIALOGUE_LINES[0]}
            </p>
            <p className="text-amber-100/90">{DIALOGUE_LINES[1]}</p>
            <p className="text-amber-100/90">{DIALOGUE_LINES[2]}</p>
            <p className="text-amber-100/90">{DIALOGUE_LINES[3]}</p>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              autoFocus
              disabled={isPending}
              onClick={handleContinue}
              className="cursor-pointer rounded-md border border-emerald-600/90 bg-gradient-to-b from-emerald-700 to-emerald-900 px-10 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-50 shadow-[0_0_14px_rgba(16,185,129,0.25)] transition hover:from-emerald-600 hover:to-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Guardando..." : "Continuar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
