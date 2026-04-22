"use client";

import Image from "next/image";
import { Libre_Baskerville } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";

const BG_INTRO_FOREST = "/img/resources/background/bg_intro_forest.png";
const BG_INTRO_FOREST_CAMP = "/img/resources/background/bg_intro_forest_camp.png";
const PJ_FEDE_RPG_TIRED = "/img/resources/characters/pj_fede_rpg_tired.png";
const PJ_FEDE_RPG_STANDING = "/img/resources/characters/pj_fede_rpg_standing.png";
const PJ_FEDE_RPG_FACE_TIRED =
  "/img/resources/caracters_faces/pj_fede_rpg_face_tired.png";
const PJ_MATI_RPG_STANDING_2 =
  "/img/resources/characters/pj_mati_rpg_standing_2.png";
const PJ_MATI_RPG_STANDING = "/img/resources/characters/pj_mati_rpg_standing.png";
const PJ_MATI_RPG_FACE_2 = "/img/resources/caracters_faces/pj_mati_rpg_face_2.png";
const PJ_MATI_RPG_FACE = "/img/resources/caracters_faces/pj_mati_rpg_face.png";
const SCENE_FADE_MS = 900;

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const STEP1_DIALOGUES = [
  {
    face: "pj_fede_rpg_face_tired",
    text: "No pensé que me iba a costar tanto juntar madera.",
  },
  {
    face: "pj_fede_rpg_face_tired",
    text: "Espero que los demás hayan encontrado también.",
  },
  {
    face: "pj_mati_rpg_face_2",
    text: "¡Fede!",
  },
  {
    face: "pj_mati_rpg_face_2",
    text: "Estás hecho verga.",
  },
  {
    face: "pj_fede_rpg_face_tired",
    text: "No me digas.",
  },
  {
    face: "pj_fede_rpg_face_tired",
    text: "Apareció alto lobo enojado boludo.",
  },
  {
    face: "pj_mati_rpg_face_2",
    text: "Uh... Sabía que era peligroso. Nacho y Delu también se cruzaron con algunos.",
  },
  {
    face: "pj_mati_rpg_face_2",
    text: "Vamos a avisarles a los demás.",
  },
] as const;

const STEP2_DIALOGUES = [
  {
    face: "pj_mati_rpg_face",
    text: "Acá es donde te decía que estabamos armando el campamento. Es el lugar más tranca que encontramos.",
  },
  {
    face: "pj_fede_rpg_face_tired",
    text: "¿Cuál es la idea?",
  },
  {
    face: "pj_mati_rpg_face",
    text: "Por el momento, sobrevivir. Estamos lejos de poder pasar el juego, así que hay que ir subiendo de nivel.",
  },
] as const;

export function FinTutorialStory() {
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Line, setStep1Line] = useState(0);
  const [isMatiStandingPose, setIsMatiStandingPose] = useState(false);
  const [sceneOverlayOpacity, setSceneOverlayOpacity] = useState(0);
  const [step2Phase, setStep2Phase] = useState<0 | 1 | 2>(0);
  const [step2Line, setStep2Line] = useState(0);

  const canAdvance =
    sceneOverlayOpacity === 0 &&
    (step === 1 || step2Phase < 2 || step2Line < STEP2_DIALOGUES.length - 1);
  const showStep1Mati = step1Line >= 2 || isMatiStandingPose;
  const showStep2Mati = step === 2 && step2Phase >= 1;
  const showStep2Fede = step === 2 && step2Phase >= 2;

  const advance = useCallback(() => {
    if (!canAdvance) return;
    if (step === 1) {
      if (step1Line < STEP1_DIALOGUES.length - 1) {
        setStep1Line((line) => line + 1);
        return;
      }
      setIsMatiStandingPose(true);
      setSceneOverlayOpacity(1);
      window.setTimeout(() => {
        setStep(2);
        setSceneOverlayOpacity(0);
      }, SCENE_FADE_MS);
      return;
    }
    if (step2Phase === 0) {
      setStep2Phase(1);
      return;
    }
    if (step2Phase === 1) {
      setStep2Phase(2);
      return;
    }
    if (step2Line < STEP2_DIALOGUES.length - 1) {
      setStep2Line((line) => line + 1);
    }
  }, [canAdvance, step, step1Line, step2Line, step2Phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (!canAdvance) return;
      event.preventDefault();
      advance();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, canAdvance]);

  const currentDialogue = useMemo(() => {
    if (step === 1) return STEP1_DIALOGUES[step1Line];
    return STEP2_DIALOGUES[step2Line];
  }, [step, step1Line, step2Line]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#120b08] text-amber-50">
      <Image
        src={step === 1 ? BG_INTRO_FOREST : BG_INTRO_FOREST_CAMP}
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40"
        aria-hidden
      />
      <div
        className="absolute inset-0 z-40 bg-black transition-opacity"
        style={{
          opacity: sceneOverlayOpacity,
          transitionDuration: `${SCENE_FADE_MS}ms`,
        }}
        aria-hidden
      />

      {canAdvance && (
        <button
          type="button"
          onClick={advance}
          className="absolute inset-0 z-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
          aria-label="Siguiente"
        />
      )}

      {step === 1 && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[7] flex w-full items-end justify-start pb-0 pl-3 sm:pl-6 md:pl-10">
          <div className="intro-character-slide-in flex max-h-[min(64vh,520px)] max-w-[min(92vw,700px)] items-end">
            <Image
              src={PJ_FEDE_RPG_TIRED}
              alt="Fede cansado"
              width={620}
              height={930}
              className="h-[min(62vh,430px)] w-auto object-contain object-bottom drop-shadow-[0_8px_22px_rgba(0,0,0,0.45)]"
            />
          </div>
        </div>
      )}
      {step === 1 && showStep1Mati && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[7] flex w-full items-end justify-end pb-0 pr-3 sm:pr-6 md:pr-10">
          <div className="intro-character-slide-in-right flex max-h-[min(64vh,520px)] max-w-[min(92vw,700px)] items-end">
            <Image
              src={isMatiStandingPose ? PJ_MATI_RPG_STANDING : PJ_MATI_RPG_STANDING_2}
              alt="Mati"
              width={620}
              height={930}
              className="h-[min(62vh,430px)] w-auto object-contain object-bottom drop-shadow-[0_8px_22px_rgba(0,0,0,0.45)]"
            />
          </div>
        </div>
      )}
      {showStep2Mati && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[7] flex w-full items-end justify-start pb-0 pl-40 sm:pl-48 md:pl-56">
          <div className="intro-character-slide-in flex max-h-[min(64vh,520px)] max-w-[min(92vw,700px)] items-end">
            <Image
              src={PJ_MATI_RPG_STANDING}
              alt="Mati"
              width={620}
              height={930}
              className="h-[min(62vh,430px)] w-auto object-contain object-bottom drop-shadow-[0_8px_22px_rgba(0,0,0,0.45)]"
            />
          </div>
        </div>
      )}
      {showStep2Fede && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[8] flex w-full items-end justify-start pb-0 pl-8 sm:pl-14 md:pl-20">
          <div className="intro-character-slide-in flex max-h-[min(64vh,520px)] max-w-[min(92vw,700px)] items-end">
            <Image
              src={PJ_FEDE_RPG_STANDING}
              alt="Fede"
              width={620}
              height={930}
              className="h-[min(62vh,430px)] w-auto object-contain object-bottom drop-shadow-[0_8px_22px_rgba(0,0,0,0.45)]"
            />
          </div>
        </div>
      )}

      {(step === 1 || step2Phase >= 2) && (
        <div
          className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-stretch p-4 sm:p-6`}
        >
          <div className="mx-auto flex w-full max-w-3xl gap-3 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-2.5">
            <div className="my-0 -ml-2.5 w-24 shrink-0 self-stretch overflow-hidden rounded-md border border-amber-700/70 bg-black/30 sm:my-0 sm:-ml-3.5 sm:w-28">
              <Image
                src={
                  currentDialogue.face === "pj_fede_rpg_face_tired"
                    ? PJ_FEDE_RPG_FACE_TIRED
                    : currentDialogue.face === "pj_mati_rpg_face_2"
                      ? PJ_MATI_RPG_FACE_2
                      : PJ_MATI_RPG_FACE
                }
                alt={
                  currentDialogue.face === "pj_fede_rpg_face_tired"
                    ? "Retrato de Fede cansado"
                    : "Retrato de Mati"
                }
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-left text-base leading-relaxed text-amber-50/95 sm:text-lg">
                {currentDialogue.text}
              </p>
              {canAdvance && (
                <div className="mt-4 flex justify-end">
                  <span className="rounded-md border border-amber-700/70 bg-amber-950/50 px-4 py-2 text-sm font-semibold text-amber-100">
                    Clic o Enter para continuar
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
