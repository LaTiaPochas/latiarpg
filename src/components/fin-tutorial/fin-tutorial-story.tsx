"use client";

import Image from "next/image";
import { Libre_Baskerville } from "next/font/google";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { markTutorialCompleted } from "@/app/fin-tutorial/actions";

const BG_INTRO_FOREST = "/img/resources/background/bg_intro_forest.png";
const BG_INTRO_FOREST_CAMP = "/img/resources/background/bg_intro_forest_camp.png";
const PJ_FEDE_RPG_TIRED = "/img/resources/characters/pj_fede_rpg_tired.png";
const PJ_FEDE_RPG_STANDING = "/img/resources/characters/pj_fede_rpg_standing.png";
const PJ_FEDE_RPG_FACE_TIRED =
  "/img/resources/caracters_faces/pj_fede_rpg_face_tired.png";
const PJ_MATI_RPG_STANDING_2 =
  "/img/resources/characters/pj_mati_rpg_standing_2.png";
const PJ_MATI_RPG_STANDING = "/img/resources/characters/pj_mati_rpg_standing.png";
const PJ_LEO_RPG_STANDING = "/img/resources/characters/pj_leo_rpg_standing.png";
const PJ_MATI_RPG_FACE_2 = "/img/resources/caracters_faces/pj_mati_rpg_face_2.png";
const PJ_MATI_RPG_FACE = "/img/resources/caracters_faces/pj_mati_rpg_face.png";
const SCENE_FADE_MS = 900;
const LEO_FLY_DURATION_MS = 1800;

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
  {
    face: "pj_mati_rpg_face_2",
    text: "Llegó el momento de elegir tu clase Fede. Ahora empieza lo bueno.",
  },
] as const;

export function FinTutorialStory() {
  const router = useRouter();
  const [isChoosingClass, startChoosingClassTransition] = useTransition();
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Line, setStep1Line] = useState(0);
  const [isMatiStandingPose, setIsMatiStandingPose] = useState(false);
  const [sceneOverlayOpacity, setSceneOverlayOpacity] = useState(0);
  const [step2Phase, setStep2Phase] = useState<0 | 1 | 2>(0);
  const [step2Line, setStep2Line] = useState(0);
  const [isChooseClassButtonVisible, setIsChooseClassButtonVisible] = useState(false);
  const [isLeoFlyVisible, setIsLeoFlyVisible] = useState(false);
  const [isLeoFlyMoving, setIsLeoFlyMoving] = useState(false);
  const [didLeoFlyBy, setDidLeoFlyBy] = useState(false);

  const canAdvance =
    sceneOverlayOpacity === 0 &&
    (step === 1 ||
      step2Phase < 2 ||
      step2Line < STEP2_DIALOGUES.length - 1 ||
      (step === 2 &&
        step2Phase >= 2 &&
        step2Line === STEP2_DIALOGUES.length - 1 &&
        !isChooseClassButtonVisible));
  const showStep1Mati = step1Line >= 2 || isMatiStandingPose;
  const showStep2Mati = step === 2 && step2Phase >= 1;
  const showStep2Fede = step === 2 && step2Phase >= 2;
  const isStep2ClassChoiceMoment = step === 2 && step2Phase >= 2 && step2Line >= 3;

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
        // Dejamos un frame en negro con el nuevo fondo antes de salir del fade.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setSceneOverlayOpacity(0);
          });
        });
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
      if (step2Line === 0 && !didLeoFlyBy) {
        // Dispara el fly-by justo después del primer diálogo de STEP 2.
        setDidLeoFlyBy(true);
        setIsLeoFlyVisible(true);
      }
      setStep2Line((line) => line + 1);
      return;
    }
    if (step2Line === STEP2_DIALOGUES.length - 1 && !isChooseClassButtonVisible) {
      setIsChooseClassButtonVisible(true);
    }
  }, [
    canAdvance,
    didLeoFlyBy,
    isChooseClassButtonVisible,
    step,
    step1Line,
    step2Line,
    step2Phase,
  ]);

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

  useEffect(() => {
    if (!isLeoFlyVisible) return;

    const raf = requestAnimationFrame(() => {
      setIsLeoFlyMoving(true);
    });
    const t = window.setTimeout(() => {
      setIsLeoFlyVisible(false);
      setIsLeoFlyMoving(false);
    }, LEO_FLY_DURATION_MS);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [isLeoFlyVisible]);

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
          pointerEvents: sceneOverlayOpacity > 0.02 ? "auto" : "none",
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[7] flex justify-start pb-[4.5rem] pl-0 sm:pb-0 sm:pl-6 md:pl-10">
          <div className="intro-character-slide-in flex max-h-[min(50vh,280px)] max-w-[min(64vw,240px)] items-end sm:max-h-[min(68vh,640px)] sm:max-w-[min(92vw,520px)]">
            <Image
              src={PJ_FEDE_RPG_TIRED}
              alt="Fede cansado"
              width={620}
              height={930}
              className="h-[min(32vh,184px)] w-auto object-contain object-bottom drop-shadow-[0_8px_22px_rgba(0,0,0,0.45)] sm:h-[min(68vh,500px)]"
            />
          </div>
        </div>
      )}
      {step === 1 && showStep1Mati && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[7] flex justify-end pb-[4.5rem] pr-3 sm:pb-0 sm:pr-8 md:pr-12">
          <div className="intro-character-slide-in-right flex max-h-[min(54vh,320px)] max-w-[min(72vw,280px)] items-end sm:max-h-[min(68vh,640px)] sm:max-w-[min(92vw,520px)]">
            <Image
              src={isMatiStandingPose ? PJ_MATI_RPG_STANDING : PJ_MATI_RPG_STANDING_2}
              alt="Mati"
              width={620}
              height={930}
              className="h-[min(40vh,230px)] w-auto object-contain object-bottom drop-shadow-[0_8px_22px_rgba(0,0,0,0.45)] sm:h-[min(68vh,640px)]"
            />
          </div>
        </div>
      )}
      {showStep2Mati && (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-[7] flex justify-start pb-[4.5rem] ml-24 pl-0 transition-transform duration-500 sm:pb-0 sm:pl-4 md:pl-8 ${
            isStep2ClassChoiceMoment
              ? "translate-x-6 sm:translate-x-8 md:translate-x-12"
              : ""
          }`}
        >
          <div className="intro-character-slide-in flex max-h-[min(54vh,320px)] max-w-[min(72vw,280px)] items-end sm:max-h-[min(68vh,640px)] sm:max-w-[min(92vw,520px)]">
            <Image
              src={isStep2ClassChoiceMoment ? PJ_MATI_RPG_STANDING_2 : PJ_MATI_RPG_STANDING}
              alt="Mati"
              width={620}
              height={930}
              className="h-[min(40vh,230px)] w-auto object-contain object-bottom drop-shadow-[0_8px_22px_rgba(0,0,0,0.45)] sm:h-[min(68vh,640px)]"
            />
          </div>
        </div>
      )}
      {showStep2Fede && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] flex justify-start pb-[4.5rem] pl-1 sm:pb-0 sm:pl-6 md:pl-10">
          <div className="intro-character-slide-in flex max-h-[min(50vh,280px)] max-w-[min(64vw,240px)] items-end sm:max-h-[min(60vh,400px)] sm:max-w-[min(92vw,520px)]">
            <Image
              src={PJ_FEDE_RPG_STANDING}
              alt="Fede"
              width={620}
              height={930}
              className="h-[min(32vh,184px)] w-auto object-contain object-bottom drop-shadow-[0_8px_22px_rgba(0,0,0,0.45)] sm:h-[min(60vh,400px)]"
            />
          </div>
        </div>
      )}
      {isLeoFlyVisible && (
        <div className="pointer-events-none absolute inset-0 z-[6] flex items-center overflow-hidden">
          <div
            className="will-change-transform"
            style={{
              transition: `transform ${LEO_FLY_DURATION_MS}ms linear`,
              transform: isLeoFlyMoving
                ? "translateX(130vw) rotate(30deg)"
                : "translateX(-40vw) rotate(30deg)",
            }}
          >
            <Image
              src={PJ_LEO_RPG_STANDING}
              alt="Leo volando"
              width={420}
              height={630}
              className="h-[min(23vh,160px)] w-auto object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.55)]"
            />
          </div>
        </div>
      )}

      {(step === 1 || step2Phase >= 2) && (
        <div
          className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-stretch p-2 sm:p-6`}
        >
          <div className="mx-auto flex w-full max-w-3xl gap-2 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-5">
            <div className="my-0 -ml-1 w-20 shrink-0 self-stretch overflow-hidden rounded-md border border-amber-700/70 bg-black/30 sm:-ml-3.5 sm:w-28">
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
            <div className="min-w-0 flex flex-1 flex-col self-stretch">
              <p className="text-left text-[13px] leading-relaxed text-amber-50/95 sm:text-lg">
                {currentDialogue.text}
              </p>
              {canAdvance && (
                <div className="mt-auto flex justify-center pt-4">
                  <span className="text-center text-xs text-amber-100/90">
                    Click o Enter para continuar
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {isChooseClassButtonVisible && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/25">
          <button
            type="button"
            onClick={() => {
              if (isChoosingClass) return;
              startChoosingClassTransition(async () => {
                const result = await markTutorialCompleted();
                if (!result.ok) return;
                router.push("/class-selection");
              });
            }}
            disabled={isChoosingClass}
            className="relative cursor-pointer overflow-hidden rounded-lg border border-amber-600/80 bg-gradient-to-b from-[#c47b2a] via-[#9f5a20] to-[#6f3617] px-10 py-4 text-xl font-bold uppercase tracking-[0.14em] text-amber-50 shadow-[0_14px_34px_rgba(120,58,22,0.52),inset_0_1px_0_rgba(255,224,185,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:from-[#d08a33] hover:via-[#ad6526] hover:to-[#7b3f1b] hover:shadow-[0_18px_40px_rgba(120,58,22,0.64),inset_0_1px_0_rgba(255,232,199,0.42)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-75"
          >
            <span
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,224,185,0.25),transparent_58%)]"
              aria-hidden
            />
            <span className="relative">{isChoosingClass ? "Cargando..." : "Elegir Clase"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
