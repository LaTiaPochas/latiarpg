"use client";

import Image from "next/image";
import { Libre_Baskerville } from "next/font/google";
import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const BG_SRC = "/img/resources/background/bg_cave_entrance.png";
const PJ_CHECHO_STANDING = "/img/resources/characters/pj_checho_rpg_standing.png";
const PJ_CHECHO_FACE = "/img/resources/caracters_faces/pj_checho_rpg_face.png";
const PJ_DELU_STANDING = "/img/resources/characters/pj_delu_rpg_standing_2.png";
const PJ_DELU_FACE = "/img/resources/caracters_faces/pj_delu_rpg_face_2.png";

type DialogueFace = "checho" | "delu" | null;

type DialogueLine = {
  face: DialogueFace;
  text: string;
  showDeluSprite?: boolean;
};

const DIALOGUE_LINES: DialogueLine[] = [
  {
    face: "checho",
    text: "Estamos todos de acuerdo en que hay que avanzar por la cueva",
  },
  {
    face: "checho",
    text: "Ya estamos bastante seguros en el bosque, por suerte jugamos muchos RPG como para saber que cosas podrían pasar.",
  },
  {
    face: "checho",
    text: "Habiamos quedado con Delu de encontrarnos acá, nadie sabe más que él de cuevas.",
  },
  {
    face: "checho",
    text: "¿Lo viste?",
  },
  {
    face: null,
    text: "...",
  },
  {
    face: null,
    text: "*Ruidos de taladro*",
  },
  {
    face: "delu",
    text: "¡Holaaa!",
    showDeluSprite: true,
  },
  {
    face: "delu",
    text: "Estaba revisando la zona. La roca de esta zona parece ser gruesa, no la puedo atravesar.",
    showDeluSprite: true,
  },
  {
    face: "delu",
    text: "Deben tener montado todo un sistema de extracción.",
    showDeluSprite: true,
  },
  {
    face: "checho",
    text: "Chane y Leo dicen que les sirve esta piedra.",
    showDeluSprite: true,
  },
  {
    face: "checho",
    text: "Bueno, vamos con cuidado.",
    showDeluSprite: true,
  },
  {
    face: null,
    text: "",
    showDeluSprite: true,
  },
];

type CaveEntranceDialogueProps = {
  onEnterCave: () => Promise<void>;
};

export function CaveEntranceDialogue({ onEnterCave }: CaveEntranceDialogueProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  const line = DIALOGUE_LINES[step] ?? DIALOGUE_LINES[DIALOGUE_LINES.length - 1];
  const isLastStep = step === DIALOGUE_LINES.length - 1;
  const showDeluSprite = line.showDeluSprite === true;

  const advance = useCallback(() => {
    if (isLastStep || isPending) return;
    setStep((value) => Math.min(value + 1, DIALOGUE_LINES.length - 1));
  }, [isLastStep, isPending]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || isLastStep || isPending) return;
      event.preventDefault();
      advance();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, isLastStep, isPending]);

  const faceSrc =
    line.face === "checho" ? PJ_CHECHO_FACE : line.face === "delu" ? PJ_DELU_FACE : null;

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-[#120b08] pt-14"
      role="dialog"
      aria-modal="true"
      aria-label="Diálogo en la entrada a la cueva"
    >
      <div className="relative h-full w-full">
      <style jsx>{`
        @keyframes cave-dialogue-slide-in-right {
          0% {
            opacity: 0;
            transform: translateX(38px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .cave-dialogue-slide-in-right {
          animation: cave-dialogue-slide-in-right 0.45s ease-out forwards;
        }
      `}</style>

      <Image
        src={BG_SRC}
        alt="Entrada a la cueva"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/55" aria-hidden />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-start pb-[7.5rem] pl-1 sm:pb-0 sm:pl-6 md:pl-80">
        <Image
          src={PJ_CHECHO_STANDING}
          alt="Checho"
          width={720}
          height={1080}
          className="h-[min(32vh,184px)] w-auto max-w-full object-contain object-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] sm:h-[min(68vh,700px)]"
        />
      </div>

      {showDeluSprite ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-end pb-[10.5rem] pr-10 sm:pb-20 sm:pr-6 md:pr-70">
          <div key="delu-enter" className="cave-dialogue-slide-in-right">
            <Image
              src={PJ_DELU_STANDING}
              alt="Delu"
              width={720}
              height={1080}
              className="h-[min(43vh,248px)] w-auto max-w-[min(70vw,140px)] object-contain object-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] sm:h-[min(70vh,680px)] sm:max-w-[min(70vw,340px)]"
            />
          </div>
        </div>
      ) : null}

      {!isLastStep ? (
        <button
          type="button"
          onClick={advance}
          className="absolute inset-0 z-20 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
          aria-label="Siguiente diálogo"
        />
      ) : null}

      <div className={`${dialogueFont.className} absolute inset-x-0 bottom-0 z-30 p-2 sm:p-6`}>
        <div
          className={`mx-auto flex w-full max-w-3xl rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-6 sm:py-3 ${
            faceSrc ? "gap-3 sm:gap-4" : ""
          }`}
        >
          {faceSrc ? (
            <div className="my-0 -ml-1 h-16 w-16 shrink-0 self-start overflow-hidden rounded-md border border-amber-700/70 bg-black/30 sm:-ml-3.5 sm:h-28 sm:w-28">
              <Image
                src={faceSrc}
                alt={line.face === "delu" ? "Retrato de Delu" : "Retrato de Checho"}
                width={112}
                height={112}
                className="h-16 w-16 object-cover sm:h-28 sm:w-28"
              />
            </div>
          ) : null}
          <div className="min-w-0 flex flex-1 flex-col self-stretch">
            {line.text ? (
              <p className="text-left text-[13px] leading-relaxed text-amber-50/95 sm:text-lg">{line.text}</p>
            ) : null}
            <div className="mt-auto flex justify-center pt-4">
              {isLastStep ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await onEnterCave();
                    })
                  }
                  className="pointer-events-auto cursor-pointer rounded border border-slate-700/90 bg-gradient-to-b from-slate-600 to-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 shadow-[0_0_8px_rgba(25,25,25,0.8)] transition hover:from-slate-500 hover:to-slate-700 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-300"
                >
                  {isPending ? "Entrando..." : "Entrar a la cueva"}
                </button>
              ) : (
                <span className="text-center text-xs text-amber-100/90">Click o Enter para continuar</span>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}
