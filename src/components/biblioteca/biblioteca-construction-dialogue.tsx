"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Libre_Baskerville } from "next/font/google";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const PAGE_BG = "/img/resources/background/bg_garrisonlvl2.png";
const LIBRARY_CONSTRUCTION_SPRITE = "/img/resources/maps/garrison_library_construction.png";
const SILVA_FACE = "/img/resources/caracters_faces/pj_silva_rpg_face_2.png";

const DIALOGUE_LINES = [
  "Mati dice que esto no es lo que el planeó. Que no es el lore que el diseño.",
  "Más razón para llevar un registro perfectamente detallado.",
  "¿Quién va a contar la historia sino el Loremaster?.",
  "Voy a anotar hasta cuantos pelos tienen en el culo los trasgos.",
  "Necesito armar una base firme, como rulo de estatua, y llenarla de lore viva de este mundo. Dame una mano.",
] as const;

type BibliotecaConstructionDialogueProps = {
  onComplete: () => Promise<{ ok: boolean }>;
};

export function BibliotecaConstructionDialogue({ onComplete }: BibliotecaConstructionDialogueProps) {
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const isLastDialogue = dialogueIndex >= DIALOGUE_LINES.length - 1;
  const currentText = useMemo(
    () => DIALOGUE_LINES[Math.min(dialogueIndex, DIALOGUE_LINES.length - 1)],
    [dialogueIndex],
  );

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
    setDialogueIndex((value) => Math.min(value + 1, DIALOGUE_LINES.length - 1));
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
        backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.62)), url('${PAGE_BG}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 z-20 cursor-pointer" onClick={advance}>
        <div className="relative h-full w-full">
          <div className="pointer-events-none absolute bottom-[92px] left-1/2 z-10 -translate-x-1/2 sm:bottom-[108px]">
            <Image
              src={LIBRARY_CONSTRUCTION_SPRITE}
              alt="Biblioteca en construcción"
              width={720}
              height={720}
              className="h-[min(38vh,320px)] w-auto object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.55)] sm:h-[min(52vh,480px)]"
              priority
            />
          </div>

          <div
            className={`absolute inset-x-0 bottom-0 z-30 p-2 sm:p-5 ${dialogueFont.className}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto flex w-full max-w-3xl gap-3 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-5 sm:py-3">
              <div className="my-0 h-14 w-14 shrink-0 self-start overflow-hidden rounded-md border border-amber-700/70 bg-black/30 sm:h-24 sm:w-24">
                <Image
                  src={SILVA_FACE}
                  alt="Retrato de Silva"
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col self-stretch">
                <p className="text-left text-xs leading-relaxed text-amber-50/95 sm:text-sm">
                  {currentText}
                </p>
                <div className="mt-auto flex justify-center pt-4">
                  <span className="text-center text-[9px] text-amber-100/90 sm:text-xs">
                    {isPending
                      ? "Guardando..."
                      : isLastDialogue
                        ? "Enter o clic para continuar"
                        : "Enter o clic para seguir"}
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
