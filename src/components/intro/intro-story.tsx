"use client";

import Image from "next/image";
import { Libre_Baskerville } from "next/font/google";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const BG_INTRO_CITY = "/img/resources/background/bg_intro_city.png";
const BG_INTRO_CASA_FEDE = "/img/resources/background/bg_intro_casafede.png";
const BG_INTRO_CASA_FEDE_2 =
  "/img/resources/background/bg_intro_casafede_2_revisited.png";
const BG_INTRO_FOREST = "/img/resources/background/bg_intro_forest.png";
const PJ_FEDE_BLURP = "/img/resources/characters/pj_fede_city_blurp.png";
const PJ_FEDE_STANDING = "/img/resources/characters/pj_fede_city_standing.png";
const PJ_FEDE_STANDING_2 = "/img/resources/characters/pj_fede_city_standing_2.png";
const PJ_FEDE_RPG_STANDING = "/img/resources/characters/pj_fede_rpg_standing.png";
const PJ_FEDE_RPG_FACE = "/img/resources/caracters_faces/pj_fede_rpg_face.png";
const PJ_BECHO_RPG_STANDING_2 =
  "/img/resources/characters/pj_becho_rpg_standing_2.png";
const PJ_BECHO_RPG_STANDING = "/img/resources/characters/pj_becho_rpg_standing.png";
const PJ_BECHO_RPG_FACE_2 = "/img/resources/caracters_faces/pj_becho_rpg_face_2.png";
const PJ_BECHO_RPG_FACE = "/img/resources/caracters_faces/pj_becho_rpg_face.png";
const PJ_CHANE_RPG_STANDING_2 =
  "/img/resources/characters/pj_chane_rpg_standing_2.png";
const PJ_CHANE_RPG_STANDING = "/img/resources/characters/pj_chane_rpg_standing.png";
const PJ_CHANE_RPG_FACE_2 = "/img/resources/caracters_faces/pj_chane_rpg_face_2.png";
const PJ_CHANE_RPG_FACE = "/img/resources/caracters_faces/pj_chane_rpg_face.png";
const PJ_SILVA_RPG_STANDING_2 =
  "/img/resources/characters/pj_silva_rpg_standing_2.png";
const PJ_SILVA_RPG_FACE_2 = "/img/resources/caracters_faces/pj_silva_rpg_face_2.png";
const PJ_SILVA_RPG_FACE_ENOJADO_2 =
  "/img/resources/caracters_faces/pj_silva_rpg_face_enojado_2.png";
const PJ_FEDE_RPG_STANDING_2 = "/img/resources/characters/pj_fede_rpg_standing_2.png";
const PJ_FEDE_RPG_FACE_2 = "/img/resources/caracters_faces/pj_fede_rpg_face_2.png";
const PJ_FEDE_RPG_SCARED_2 = "/img/resources/characters/pj_fede_rpg_scared_2.png";
const PJ_FEDE_RPG_FACE_SCARED_2 =
  "/img/resources/caracters_faces/pj_fede_rpg_face_scared_2.png";
const PJ_FEDE_RPG_FIGHT_STICK_2 =
  "/img/resources/characters/pj_fede_rpg_fight_stick_2.png";
const PJ_FEDE_RPG_FACE_FIGHT =
  "/img/resources/caracters_faces/pj_fede_rpg_face_fight.png";
const OBJETO_RANDOM_RAMA_1 =
  "/img/resources/objetos_mapa/objeto_random_rama_1.png";
const ITEM_MADERA = "/img/resources/items/item_madera.png";
const ENEMY_BLACKWOLF_1 = "/img/resources/enemigos/enemy_sprite_blackwolf_1.png";

const SCENE_FADE_MS = 600;

const DIALOGUE_CASA_DISCORD =
  "Estos pelotuditos del orto dijeron que iban a estar todos en Discord y no hay nadie...";

const DIALOGUE_CASA_TRY_GAME =
  "Bueno, ya fue. Voy a probar yo el juego este.";
const DIALOGUE_CASA_LOOKING =
  "A ver como es esto...";
const DIALOGUE_RPG_WHAT = "¿Qué?";
const DIALOGUE_RPG_WHERE = "¿Qué? ¿Dónde estoy?";
const DIALOGUE_BECHO_HEY = "¡Feche!";
const DIALOGUE_BECHO_FULL =
  "¡Feche! Por fin llegaste. Con los pibes pensamos que por ahí tardabas días en probar el juego.";
const DIALOGUE_FEDE_BECHO_OUTFIT = "¿Qué hacés vestido así Becho?";
const DIALOGUE_BECHO_LOOK_YOURSELF = "¿No te viste vos Feche?";
const DIALOGUE_FEDE_DOTS = "...";
const DIALOGUE_FEDE_WHAT_THE_HELL = "¿Qué carajo?";
const DIALOGUE_BECHO_SUMMARY = "Te resumo lo que averiguamos.";
const DIALOGUE_BECHO_INSIDE_GAME = "Estamos adentro del juego.";
const DIALOGUE_FEDE_ALREADY_HAPPENED = "¿Esto no había pasado ya?";
const DIALOGUE_BECHO_NEW_PROJECT =
  "Si pero ese proyecto quedó en la nada, este parece más completo.";
const DIALOGUE_BECHO_FOLLOW_ME = "Vení, seguime.";
const DIALOGUE_BECHO_FOUND_ALL =
  "De a poco nos fuimos encontrando entre todos, faltabas vos nada más.";
const DIALOGUE_BECHO_NO_EXIT =
  "No sabemos como salir, pero tenemos la idea de tratar de asentarnos, porque no sabemos que bichos puede haber.";
const DIALOGUE_CHANE_HEY = "¡Chicos!";
const DIALOGUE_CHANE_FOUND_BECHO = "¡Chicos! Ah acá estabas Becho.";
const DIALOGUE_CHANE_FOUND_FEDE =
  "¡Chicos! Ah acá estabas Becho. Bien ahí que encontraste a Fede.";
const DIALOGUE_CHANE_ALL_HERE =
  "Ya estamos todos entonces, podemos decidir bien que hacer.";
const DIALOGUE_FEDE_GOLDEN_BOY = "¿Qué hacés Golden Boy?";
const DIALOGUE_BECHO_FOOD = "¿Ya encontraron algo de comer?";
const DIALOGUE_CHANE_SILVA_IDEA = "No, pero Silva tiene una idea... Vengan.";
const DIALOGUE_SILVA_MUCHACHOS = "¡¡MUCHACHOS!!";
const DIALOGUE_SILVA_PLAN = "Ya tenemos un plan.";
const DIALOGUE_CHANE_TOLD_YOU = "Les dije que Silva tenía una idea.";
const DIALOGUE_SILVA_COUGH = "GAAAAH *tos* *tos*";
const DIALOGUE_SILVA_BASE =
  "Encontramos un lugar bastante abierto donde podemos levantar una base.";
const DIALOGUE_SILVA_WORLD =
  "Suponemos que es lo mejor hasta que sepamos bien como es este mundo.";
const DIALOGUE_FEDE_PIZZA =
  "Yo vengo de clavarme 2 porciones de fugazzeta rellena en Imperio.";
const DIALOGUE_BECHO_FAINA = "Uhhhh ¿Con faina?";
const DIALOGUE_SILVA_RESGUARDARNOS =
  "Para Bece, después hablamos, ahora tenemos que resguardarnos.";
const DIALOGUE_BECHO_GUESGUARDARNOS = "¿Qué es guesguardarnos?";
const DIALOGUE_SILVA_PUNCH = "Te voy a cagar a piñas pelotudo.";
const DIALOGUE_CHANE_CALM = "Bueno, bueno, concentremosnos y después peleamos.";
const DIALOGUE_CHANE_WOOD =
  "Vamos a buscar algo de madera para prender un fuego en un principio.";
const DIALOGUE_CHANE_MEET =
  "¿Nos juntamos acá en 10 minutos les parece?";
const DIALOGUE_FEDE_STEP8_RAMAS =
  "Un par de ramas más y ya vuelvo, supongo que el resto va a encontrar más.";
const DIALOGUE_BLACKWOLF_GRR = "*GRRRRR*";
const DIALOGUE_FEDE_STEP9_SCARED_1 = "AAAHHHHHHH";
const DIALOGUE_FEDE_STEP9_SCARED_2 = "La concha de mi hermana";
const DIALOGUE_FEDE_STEP9_SCARED_3 =
  "La concha de mi hermana. Yo sabía que esto iba a pasar en algún momento.";
const DIALOGUE_FEDE_STEP9_FIGHT = "Momento de pelear";

const FOREST_DIALOGUES = [
  { face: "fede", text: DIALOGUE_RPG_WHAT },
  { face: "fede", text: DIALOGUE_RPG_WHERE },
  { face: "becho2", text: DIALOGUE_BECHO_HEY },
  { face: "becho2", text: DIALOGUE_BECHO_FULL },
  { face: "fede", text: DIALOGUE_FEDE_BECHO_OUTFIT },
  { face: "becho2", text: DIALOGUE_BECHO_LOOK_YOURSELF },
  { face: "fede", text: DIALOGUE_FEDE_DOTS },
  { face: "fede", text: DIALOGUE_FEDE_WHAT_THE_HELL },
  { face: "becho2", text: DIALOGUE_BECHO_SUMMARY },
  { face: "becho2", text: DIALOGUE_BECHO_INSIDE_GAME },
  { face: "fede", text: DIALOGUE_FEDE_ALREADY_HAPPENED },
  { face: "becho2", text: DIALOGUE_BECHO_NEW_PROJECT },
  { face: "becho", text: DIALOGUE_BECHO_FOLLOW_ME },
] as const;

const STEP6_DIALOGUES = [
  { face: "becho", text: DIALOGUE_BECHO_FOUND_ALL },
  { face: "becho", text: DIALOGUE_BECHO_NO_EXIT },
  { face: "chane", text: DIALOGUE_CHANE_HEY },
  { face: "chane", text: DIALOGUE_CHANE_FOUND_BECHO },
  { face: "chane", text: DIALOGUE_CHANE_FOUND_FEDE },
  { face: "chane", text: DIALOGUE_CHANE_ALL_HERE },
  { face: "fede", text: DIALOGUE_FEDE_GOLDEN_BOY },
  { face: "becho", text: DIALOGUE_BECHO_FOOD },
  { face: "chane", text: DIALOGUE_CHANE_SILVA_IDEA },
] as const;

const STEP7_DIALOGUES = [
  { face: "silva2", text: DIALOGUE_SILVA_MUCHACHOS },
  { face: "silva2", text: DIALOGUE_SILVA_PLAN },
  { face: "chane", text: DIALOGUE_CHANE_TOLD_YOU },
  { face: "silva2", text: DIALOGUE_SILVA_COUGH },
  { face: "silva2", text: DIALOGUE_SILVA_BASE },
  { face: "silva2", text: DIALOGUE_SILVA_WORLD },
  { face: "becho", text: DIALOGUE_BECHO_FOOD },
  { face: "fede", text: DIALOGUE_FEDE_PIZZA },
  { face: "becho", text: DIALOGUE_BECHO_FAINA },
  { face: "silva2", text: DIALOGUE_SILVA_RESGUARDARNOS },
  { face: "becho", text: DIALOGUE_BECHO_GUESGUARDARNOS },
  { face: "silva_enojado", text: DIALOGUE_SILVA_PUNCH },
  { face: "chane", text: DIALOGUE_CHANE_CALM },
  { face: "chane", text: DIALOGUE_CHANE_WOOD },
  { face: "chane", text: DIALOGUE_CHANE_MEET },
] as const;

const STEP9_DIALOGUES = [
  { face: "enemy", text: DIALOGUE_BLACKWOLF_GRR },
  { face: "fede_scared", text: DIALOGUE_FEDE_STEP9_SCARED_1 },
  { face: "fede_scared", text: DIALOGUE_FEDE_STEP9_SCARED_2 },
  { face: "fede_scared", text: DIALOGUE_FEDE_STEP9_SCARED_3 },
  { face: "fede_fight", text: DIALOGUE_FEDE_STEP9_FIGHT },
] as const;

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

type IntroStoryProps = {
  completeIntro: () => Promise<void>;
};

export function IntroStory({ completeIntro }: IntroStoryProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sceneOverlayOpacity, setSceneOverlayOpacity] = useState(0);
  const [fadeTargetStep, setFadeTargetStep] = useState<number | null>(null);
  /** 0 = solo fondo; 1 = personaje + Discord; 2 = mismo personaje + probar el juego */
  const [casaLine, setCasaLine] = useState(0);
  /** index de la linea activa dentro de FOREST_DIALOGUES */
  const [forestLine, setForestLine] = useState(0);
  const [step6Line, setStep6Line] = useState(0);
  const [step7Line, setStep7Line] = useState(0);
  const [isBechoExiting, setIsBechoExiting] = useState(false);
  const [isBechoExited, setIsBechoExited] = useState(false);
  const [isStep6Exiting, setIsStep6Exiting] = useState(false);
  const [isStep7Exiting, setIsStep7Exiting] = useState(false);
  /** 0 = solo rama; 1 = Fede entra y se acerca; 2 = diálogo */
  const [step8Phase, setStep8Phase] = useState(0);
  const [step8FedeNearBranch, setStep8FedeNearBranch] = useState(false);
  const [isStep8LootOpen, setIsStep8LootOpen] = useState(false);
  const [didCloseStep8Loot, setDidCloseStep8Loot] = useState(false);
  const [step8LootInfo, setStep8LootInfo] = useState<{
    open: boolean;
    x: number;
    y: number;
    pinned: boolean;
  }>({ open: false, x: 0, y: 0, pinned: false });
  const [step9Line, setStep9Line] = useState(0);

  const canAdvanceStory =
    step < 10 &&
    sceneOverlayOpacity === 0 &&
    !isBechoExiting &&
    !isStep6Exiting &&
    !isStep7Exiting &&
    !(step === 8 && step8Phase === 1) &&
    !(step === 9 && step9Line >= STEP9_DIALOGUES.length) &&
    !isStep8LootOpen;

  const advance = useCallback(() => {
    if (step === 2 && sceneOverlayOpacity === 0) {
      setFadeTargetStep(3);
      setSceneOverlayOpacity(1);
      return;
    }
    if (step === 4 && sceneOverlayOpacity === 0) {
      setFadeTargetStep(5);
      setSceneOverlayOpacity(1);
      return;
    }
    if (sceneOverlayOpacity > 0) return;
    if (step === 3) {
      if (casaLine === 0) {
        setCasaLine(1);
        return;
      }
      if (casaLine === 1) {
        setCasaLine(2);
        return;
      }
      setStep(4);
      return;
    }
    if (step === 5) {
      if (forestLine < FOREST_DIALOGUES.length - 1) {
        setForestLine((line) => line + 1);
        return;
      }
      if (!isBechoExited && !isBechoExiting) {
        setIsBechoExiting(true);
        return;
      }
      if (isBechoExited) {
        setFadeTargetStep(6);
        setSceneOverlayOpacity(1);
      }
      return;
    }
    if (step === 6) {
      if (step6Line < STEP6_DIALOGUES.length - 1) {
        setStep6Line((line) => line + 1);
        return;
      }
      if (!isStep6Exiting) {
        setIsStep6Exiting(true);
      }
      return;
    }
    if (step === 7) {
      if (step7Line < STEP7_DIALOGUES.length - 1) {
        setStep7Line((line) => line + 1);
        return;
      }
      if (!isStep7Exiting) {
        setIsStep7Exiting(true);
      }
      return;
    }
    if (step === 8) {
      if (step8Phase === 0) {
        setStep8Phase(1);
        return;
      }
      if (step8Phase === 2) {
        if (!didCloseStep8Loot) {
          setIsStep8LootOpen(true);
          return;
        }
        setStep9Line(0);
        setStep(9);
        return;
      }
      return;
    }
    if (step === 9) {
      if (step9Line < STEP9_DIALOGUES.length - 1) {
        setStep9Line((line) => line + 1);
        return;
      }
      if (step9Line === STEP9_DIALOGUES.length - 1) {
        setStep9Line(STEP9_DIALOGUES.length);
        return;
      }
      return;
    }
    if (step < 10) setStep((s) => s + 1);
  }, [
    step,
    sceneOverlayOpacity,
    casaLine,
    forestLine,
    isBechoExiting,
    isBechoExited,
    step6Line,
    isStep6Exiting,
    step7Line,
    isStep7Exiting,
    step8Phase,
    didCloseStep8Loot,
    step9Line,
  ]);

  const goToBattleTutorial = useCallback(() => {
    router.push("/batalla-tutorial");
  }, [router]);

  const closeStep8Loot = useCallback(() => {
    setIsStep8LootOpen(false);
    setStep8LootInfo({ open: false, x: 0, y: 0, pinned: false });
    setDidCloseStep8Loot(true);
  }, []);

  const openStep8LootInfo = useCallback(
    (x: number, y: number, pinned: boolean) => {
      setStep8LootInfo({
        open: true,
        x: Math.min(x + 12, window.innerWidth - 320),
        y: Math.min(y + 12, window.innerHeight - 140),
        pinned,
      });
    },
    [],
  );

  const hideStep8LootInfo = useCallback(() => {
    setStep8LootInfo((prev) =>
      prev.pinned ? prev : { open: false, x: 0, y: 0, pinned: false },
    );
  }, []);

  const toggleStep8LootInfoPinned = useCallback(
    (x: number, y: number) => {
      setStep8LootInfo((prev) =>
        prev.open && prev.pinned
          ? { open: false, x: 0, y: 0, pinned: false }
          : {
              open: true,
              x: Math.min(x + 12, window.innerWidth - 320),
              y: Math.min(y + 12, window.innerHeight - 140),
              pinned: true,
            },
      );
    },
    [],
  );

  useEffect(() => {
    if (sceneOverlayOpacity !== 1 || fadeTargetStep === null) return;
    let raf1: number | null = null;
    let raf2: number | null = null;
    const t = window.setTimeout(() => {
      setStep(fadeTargetStep);
      if (fadeTargetStep === 3) {
        setCasaLine(0);
      }
      if (fadeTargetStep === 5) {
        setForestLine(0);
        setIsBechoExiting(false);
        setIsBechoExited(false);
      }
      if (fadeTargetStep === 6) {
        setStep6Line(0);
        setIsStep6Exiting(false);
      }
      if (fadeTargetStep === 8) {
        setStep8Phase(0);
        setStep8FedeNearBranch(false);
        setIsStep8LootOpen(false);
        setStep8LootInfo({ open: false, x: 0, y: 0, pinned: false });
        setDidCloseStep8Loot(false);
      }
      // Asegura que el nuevo fondo quede renderizado mientras la pantalla sigue negra.
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setSceneOverlayOpacity(0);
          setFadeTargetStep(null);
        });
      });
    }, SCENE_FADE_MS);
    return () => {
      window.clearTimeout(t);
      if (raf1 !== null) cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [sceneOverlayOpacity, fadeTargetStep]);

  useEffect(() => {
    if (!(step === 5 && isBechoExiting)) return;
    const exitTimer = window.setTimeout(() => {
      setIsBechoExiting(false);
      setIsBechoExited(true);
    }, 700);
    return () => window.clearTimeout(exitTimer);
  }, [step, isBechoExiting]);

  useEffect(() => {
    if (!(step === 6 && isStep6Exiting)) return;
    const exitTimer = window.setTimeout(() => {
      setIsStep6Exiting(false);
      setStep(7);
    }, 700);
    return () => window.clearTimeout(exitTimer);
  }, [step, isStep6Exiting]);

  useEffect(() => {
    if (!(step === 7 && isStep7Exiting)) return;
    const exitTimer = window.setTimeout(() => {
      setIsStep7Exiting(false);
      setFadeTargetStep(8);
      setSceneOverlayOpacity(1);
    }, 700);
    return () => window.clearTimeout(exitTimer);
  }, [step, isStep7Exiting]);

  useEffect(() => {
    if (step !== 8 || step8Phase !== 1) return;
    setStep8FedeNearBranch(false);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setStep8FedeNearBranch(true));
    });
    const t = window.setTimeout(() => {
      setStep8Phase(2);
    }, 900);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [step, step8Phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      advance();
    };
    if (canAdvanceStory) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [advance, canAdvanceStory]);

  const showFedeCity = step === 1 || step === 2;
  const showFedeCasa = step === 3 && casaLine >= 1;
  const showFedeForest = step === 5;
  const showBechoForest = step === 5 && forestLine >= 2;
  const showForestGroupStep6 = step === 6;
  const showChaneStep6 = step === 6 && step6Line >= 2;
  const showTrioStep7 = step === 7;
  const showSilvaStep7 = step === 7;
  const showFedeStep8 =
    (step === 8 && step8Phase >= 1) || (step === 9 && step9Line === 0);
  const showStep8Branch = step === 8;
  const showFedeScaredStep9 = step === 9 && step9Line >= 1 && step9Line < 4;
  const showFedeFightStep9 = step === 9 && step9Line >= 4;
  const showBlackwolfStep9 = step === 9;
  const chaneUsesFinalPose = step6Line >= STEP6_DIALOGUES.length - 1;
  const bechoUsesFinalPose = forestLine >= FOREST_DIALOGUES.length - 1;
  const currentForestDialogue = FOREST_DIALOGUES[forestLine];
  const currentStep6Dialogue = STEP6_DIALOGUES[step6Line];
  const currentStep7Dialogue = STEP7_DIALOGUES[step7Line];
  const currentStep9Dialogue = STEP9_DIALOGUES[step9Line];
  const bgSrc =
    step >= 5
      ? BG_INTRO_FOREST
      : step >= 4
      ? BG_INTRO_CASA_FEDE_2
      : step >= 3
        ? BG_INTRO_CASA_FEDE
        : BG_INTRO_CITY;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#120b08] text-amber-50">
      <Image
        src={bgSrc}
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

      {showFedeCity && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start pb-0 pl-3 sm:pl-6 md:pl-10">
          <div
            key={step === 1 ? "blurp" : "standing"}
            className={
              step === 1
                ? "intro-character-slide-in translate-x-3 sm:translate-x-5 flex max-h-[min(68vh,640px)] max-w-[min(92vw,520px)] items-end"
                : "translate-x-3 sm:translate-x-5 flex max-h-[min(68vh,640px)] max-w-[min(92vw,520px)] items-end"
            }
          >
            <Image
              src={step === 1 ? PJ_FEDE_BLURP : PJ_FEDE_STANDING}
              alt="Fede"
              width={720}
              height={1080}
              className="h-[min(68vh,500px)] w-auto max-w-full object-contain object-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
              priority={step === 1}
            />
          </div>
        </div>
      )}

      {showFedeCasa && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end pb-0 pr-3 sm:pr-6 md:pr-10">
          <div className="intro-character-slide-in-right flex max-h-[min(68vh,640px)] max-w-[min(92vw,520px)] items-end">
            <Image
              src={PJ_FEDE_STANDING_2}
              alt="Fede"
              width={720}
              height={1080}
              className="h-[min(68vh,500px)] w-auto max-w-full object-contain object-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
            />
          </div>
        </div>
      )}

      {showFedeForest && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start pb-0 pl-3 sm:pl-6 md:pl-10">
          <div className="intro-character-slide-in flex max-h-[min(68vh,640px)] max-w-[min(92vw,520px)] items-end">
            <Image
              src={PJ_FEDE_RPG_STANDING}
              alt="Fede"
              width={720}
              height={1080}
              className="h-[min(68vh,500px)] w-auto max-w-full object-contain object-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
            />
          </div>
        </div>
      )}

      {showBechoForest && !isBechoExited && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end pb-0 pr-3 sm:pr-6 md:pr-10">
          <div
            className={`${
              isBechoExiting
                ? "intro-character-slide-out-right"
                : "intro-character-slide-in-right"
            } flex max-h-[min(68vh,600px)] max-w-[min(92vw,500px)] items-end`}
          >
            <Image
              src={bechoUsesFinalPose ? PJ_BECHO_RPG_STANDING : PJ_BECHO_RPG_STANDING_2}
              alt="Becho"
              width={720}
              height={1080}
              className="h-[min(68vh,640px)] w-auto max-w-full object-contain object-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
            />
          </div>
        </div>
      )}

      {showForestGroupStep6 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start pb-0 pl-3 sm:pl-6 md:pl-10">
          <div
            className={`${
              isStep6Exiting ? "intro-character-slide-out-right" : "intro-character-slide-in"
            } relative flex max-h-[min(68vh,500px)] max-w-[min(92vw,720px)] items-end`}
          >
            <Image
              src={PJ_FEDE_RPG_STANDING}
              alt="Fede"
              width={720}
              height={1080}
              className="relative z-20 h-[min(66vh,500px)] w-auto max-w-full object-contain object-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
            />
            <Image
              src={PJ_BECHO_RPG_STANDING}
              alt="Becho"
              width={720}
              height={1080}
              className="relative z-0 -ml-10 h-[min(64vh,600px)] w-auto max-w-full object-contain object-bottom opacity-95 drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)] sm:-ml-14 md:-ml-20"
            />
          </div>
        </div>
      )}

      {showChaneStep6 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end pb-0 pr-3 sm:pr-6 md:pr-10">
          <div
            className={`${
              isStep6Exiting ? "intro-character-slide-out-right" : "intro-character-slide-in-right"
            } flex max-h-[min(68vh,500px)] max-w-[min(92vw,520px)] items-end`}
          >
            <Image
              src={chaneUsesFinalPose ? PJ_CHANE_RPG_STANDING : PJ_CHANE_RPG_STANDING_2}
              alt="Chane"
              width={720}
              height={1080}
              className="h-[min(66vh,500px)] w-auto max-w-full object-contain object-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
            />
          </div>
        </div>
      )}

      {showTrioStep7 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start pb-0 pl-3 sm:pl-6 md:pl-10">
          <div
            className={`${
              isStep7Exiting ? "intro-character-slide-out-right" : "intro-character-slide-in"
            } relative flex max-h-[min(60vh,520px)] max-w-[min(92vw,700px)] items-end`}
          >
            <Image
              src={PJ_FEDE_RPG_STANDING}
              alt="Fede"
              width={620}
              height={930}
              className="relative z-20 h-[min(60vh,400px)] w-auto object-contain object-bottom drop-shadow-[0_8px_22px_rgba(0,0,0,0.45)]"
            />
            <Image
              src={PJ_BECHO_RPG_STANDING}
              alt="Becho"
              width={620}
              height={930}
              className="relative z-10 -ml-14 h-[min(58vh,450px)] w-auto object-contain object-bottom opacity-95 drop-shadow-[0_8px_20px_rgba(0,0,0,0.4)] sm:-ml-18 md:-ml-22"
            />
            <Image
              src={PJ_CHANE_RPG_STANDING}
              alt="Chane"
              width={620}
              height={930}
              className="relative z-[15] -ml-16 h-[min(56vh,400px)] w-auto object-contain object-bottom opacity-90 drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)] sm:-ml-20 md:-ml-24"
            />
          </div>
        </div>
      )}

      {showSilvaStep7 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end pb-0 pr-3 sm:pr-6 md:pr-10">
          <div
            className={`${
              isStep7Exiting ? "intro-character-slide-out-right" : "intro-character-slide-in-right"
            } flex max-h-[min(60vh,450px)] max-w-[min(92vw,450px)] items-end`}
          >
            <Image
              src={PJ_SILVA_RPG_STANDING_2}
              alt="Silva"
              width={620}
              height={930}
              className="h-[min(60vh,450px)] w-auto object-contain object-bottom drop-shadow-[0_8px_22px_rgba(0,0,0,0.45)]"
            />
          </div>
        </div>
      )}

      {showStep8Branch && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[6] -translate-x-1/2 -translate-y-1/2">
          <Image
            src={OBJETO_RANDOM_RAMA_1}
            alt="Ramas"
            width={200}
            height={200}
            className="h-auto w-[min(42vw,180px)] object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]"
          />
        </div>
      )}

      {showFedeStep8 && (
        <div className="pointer-events-none absolute inset-0 z-[7] flex items-center justify-center">
          <div
            className={`flex max-h-[min(62vh,450px)] max-w-[min(92vw,520px)] items-end transition-transform duration-[800ms] ease-out ${
              step8Phase === 1
                ? step8FedeNearBranch
                  ? "translate-x-[14vw] sm:translate-x-[12vw]"
                  : "translate-x-[38vw] sm:translate-x-[32vw]"
                : "translate-x-[14vw] sm:translate-x-[12vw]"
            }`}
          >
            <Image
              src={PJ_FEDE_RPG_STANDING_2}
              alt="Fede"
              width={620}
              height={930}
              className="h-[min(62vh,400px)] w-auto object-contain object-bottom drop-shadow-[0_8px_22px_rgba(0,0,0,0.5)]"
            />
          </div>
        </div>
      )}

      {showFedeScaredStep9 && (
        <div className="pointer-events-none absolute inset-0 z-[7] flex items-center justify-center">
          <div className="flex max-h-[min(62vh,420px)] max-w-[min(92vw,520px)] items-end translate-x-[10vw] sm:translate-x-[8vw]">
            <Image
              src={PJ_FEDE_RPG_SCARED_2}
              alt="Fede asustado"
              width={620}
              height={930}
              className="h-[min(62vh,380px)] w-auto object-contain object-bottom drop-shadow-[0_8px_22px_rgba(0,0,0,0.5)]"
            />
          </div>
        </div>
      )}

      {showFedeFightStep9 && (
        <div className="pointer-events-none absolute inset-0 z-[7] flex items-center justify-center">
          <div className="flex max-h-[min(62vh,420px)] max-w-[min(92vw,520px)] items-end translate-x-[10vw] sm:translate-x-[8vw]">
            <Image
              src={PJ_FEDE_RPG_FIGHT_STICK_2}
              alt="Fede listo para pelear"
              width={620}
              height={930}
              className="h-[min(62vh,380px)] w-auto object-contain object-bottom drop-shadow-[0_8px_22px_rgba(0,0,0,0.5)]"
            />
          </div>
        </div>
      )}

      {showBlackwolfStep9 && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[8] flex items-center pl-4 sm:pl-8 md:pl-12">
          <div
            className={`${
              step9Line === 0 ? "intro-character-slide-in" : ""
            } flex max-h-[min(54vh,340px)] max-w-[min(60vw,340px)] items-end`}
          >
            <Image
              src={ENEMY_BLACKWOLF_1}
              alt="Blackwolf"
              width={420}
              height={420}
              className="h-[min(54vh,320px)] w-auto object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.55)]"
            />
          </div>
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-0 z-[40] bg-black transition-[opacity] duration-[600ms] ease-in-out"
        style={{
          opacity: sceneOverlayOpacity,
          pointerEvents: sceneOverlayOpacity > 0.02 ? "auto" : "none",
        }}
        aria-hidden
      />

      {step === 0 && (
        <button
          type="button"
          onClick={advance}
          className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-start px-6 pt-6 text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 sm:pt-8"
        >
          <p className="max-w-xl rounded-lg bg-black/40 px-4 py-2 text-balance font-serif text-lg leading-relaxed tracking-wide text-amber-100/95 drop-shadow-[0_3px_14px_rgba(0,0,0,0.9)] sm:px-5 sm:py-3 sm:text-2xl md:text-3xl">
            Capital Federal, Argentina, 25 de Abril de 2026
          </p>
          <span className="pointer-events-none mt-10 rounded-lg bg-black/40 px-4 py-2 text-sm font-medium uppercase tracking-[0.25em] text-amber-200/90 drop-shadow-[0_3px_14px_rgba(0,0,0,0.9)]">
            Click o Enter para continuar
          </span>
        </button>
      )}

      {(step === 1 || step === 2) && (
        <>
          <button
            type="button"
            onClick={advance}
            className="absolute inset-0 z-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
            aria-label="Siguiente"
          />
          <div
            className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-stretch p-4 sm:p-6`}
          >
            <div className="mx-auto w-full max-w-3xl rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-6 sm:py-5">
              {step === 1 && (
                <p className="text-left text-base leading-relaxed text-amber-50/95 sm:text-lg">
                  *BRRRR* ~ Eructa ~
                </p>
              )}
              {step === 2 && (
                <p className="text-left text-base leading-relaxed text-amber-50/95 sm:text-lg">
                  Uff que buen almuerzo. Por suerte hoy salí de laburar temprano.
                  <br />
                  Voy a poder ir a casa y ver ese juego que hizo Mati con el que están
                  rompiendo las bolas en La Tía.
                </p>
              )}
              <div className="mt-4 flex justify-center">
                <span className="text-center text-xs text-amber-100/90">
                  Click o Enter para continuar
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 3 && casaLine === 0 && (
        <button
          type="button"
          onClick={advance}
          className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-end px-6 pb-12 text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
        >
          <span className="pointer-events-none text-sm font-medium uppercase tracking-[0.25em] text-amber-200/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            Click o Enter para continuar
          </span>
        </button>
      )}

      {step === 3 && casaLine >= 1 && (
        <>
          <button
            type="button"
            onClick={advance}
            className="absolute inset-0 z-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
            aria-label="Siguiente"
          />
          <div
            className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-stretch p-4 sm:p-6`}
          >
            <div className="mx-auto w-full max-w-3xl rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-6 sm:py-5">
              <p className="text-left text-base leading-relaxed text-amber-50/95 sm:text-lg">
                {casaLine === 1 ? DIALOGUE_CASA_DISCORD : DIALOGUE_CASA_TRY_GAME}
              </p>
              <div className="mt-4 flex justify-center">
                <span className="text-center text-xs text-amber-100/90">
                  Click o Enter para continuar
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <button
            type="button"
            onClick={advance}
            className="absolute inset-0 z-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
            aria-label="Siguiente"
          />
          <div
            className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-stretch p-4 sm:p-6`}
          >
            <div className="mx-auto w-full max-w-3xl rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-6 sm:py-5">
              <p className="text-left text-base leading-relaxed text-amber-50/95 sm:text-lg">
                {DIALOGUE_CASA_LOOKING}
              </p>
              <div className="mt-4 flex justify-center">
                <span className="text-center text-xs text-amber-100/90">
                  Click o Enter para continuar
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <button
            type="button"
            onClick={advance}
            className="absolute inset-0 z-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
            aria-label="Siguiente"
          />
          <div
            className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-stretch p-4 sm:p-6`}
          >
            <div className="mx-auto flex w-full max-w-3xl gap-3 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-2.5">
              <div className="my-0 -ml-2.5 w-24 shrink-0 self-stretch overflow-hidden rounded-md border border-amber-700/70 bg-black/30 sm:my-0 sm:-ml-3.5 sm:w-28">
                <Image
                  src={
                    currentForestDialogue.face === "fede"
                      ? PJ_FEDE_RPG_FACE
                      : currentForestDialogue.face === "becho2"
                        ? PJ_BECHO_RPG_FACE_2
                        : PJ_BECHO_RPG_FACE
                  }
                  alt={
                    currentForestDialogue.face === "fede"
                      ? "Retrato de Fede"
                      : currentForestDialogue.face === "becho2"
                        ? "Retrato de Becho"
                        : "Retrato de Becho"
                  }
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex flex-1 flex-col self-stretch">
                <p className="text-left text-base leading-relaxed text-amber-50/95 sm:text-lg">
                  {currentForestDialogue.text}
                </p>
                <div className="mt-auto flex justify-center pt-4">
                  <span className="text-center text-xs text-amber-100/90">
                    Click o Enter para continuar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 6 && (
        <>
          <button
            type="button"
            onClick={advance}
            className="absolute inset-0 z-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
            aria-label="Siguiente"
          />
          <div
            className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-stretch p-4 sm:p-6`}
          >
            <div className="mx-auto flex w-full max-w-3xl gap-3 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-2.5">
              <div className="my-0 -ml-2.5 w-24 shrink-0 self-stretch overflow-hidden rounded-md border border-amber-700/70 bg-black/30 sm:my-0 sm:-ml-3.5 sm:w-28">
                <Image
                  src={
                    currentStep6Dialogue.face === "fede"
                      ? PJ_FEDE_RPG_FACE
                      : currentStep6Dialogue.face === "becho"
                        ? PJ_BECHO_RPG_FACE
                        : PJ_CHANE_RPG_FACE
                  }
                  alt={
                    currentStep6Dialogue.face === "fede"
                      ? "Retrato de Fede"
                      : currentStep6Dialogue.face === "becho"
                        ? "Retrato de Becho"
                        : "Retrato de Chane"
                  }
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex flex-1 flex-col self-stretch">
                <p className="text-left text-base leading-relaxed text-amber-50/95 sm:text-lg">
                  {currentStep6Dialogue.text}
                </p>
                <div className="mt-auto flex justify-center pt-4">
                  <span className="text-center text-xs text-amber-100/90">
                    Click o Enter para continuar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 7 && (
        <>
          <button
            type="button"
            onClick={advance}
            className="absolute inset-0 z-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
            aria-label="Siguiente"
          />
          <div
            className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-stretch p-4 sm:p-6`}
          >
            <div className="mx-auto flex w-full max-w-3xl gap-3 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-2.5">
              <div className="my-0 -ml-2.5 w-24 shrink-0 self-stretch overflow-hidden rounded-md border border-amber-700/70 bg-black/30 sm:my-0 sm:-ml-3.5 sm:w-28">
                <Image
                  src={
                    currentStep7Dialogue.face === "fede"
                      ? PJ_FEDE_RPG_FACE
                      : currentStep7Dialogue.face === "becho"
                        ? PJ_BECHO_RPG_FACE
                        : currentStep7Dialogue.face === "chane"
                          ? PJ_CHANE_RPG_FACE
                          : currentStep7Dialogue.face === "silva_enojado"
                            ? PJ_SILVA_RPG_FACE_ENOJADO_2
                            : PJ_SILVA_RPG_FACE_2
                  }
                  alt={
                    currentStep7Dialogue.face === "fede"
                      ? "Retrato de Fede"
                      : currentStep7Dialogue.face === "becho"
                        ? "Retrato de Becho"
                        : currentStep7Dialogue.face === "chane"
                          ? "Retrato de Chane"
                          : "Retrato de Silva"
                  }
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex flex-1 flex-col self-stretch">
                <p className="text-left text-base leading-relaxed text-amber-50/95 sm:text-lg">
                  {currentStep7Dialogue.text}
                </p>
                <div className="mt-auto flex justify-center pt-4">
                  <span className="text-center text-xs text-amber-100/90">
                    Click o Enter para continuar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 8 && step8Phase === 0 && (
        <button
          type="button"
          onClick={advance}
          className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-end px-6 pb-12 text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
        >
          <span className="pointer-events-none text-sm font-medium uppercase tracking-[0.25em] text-amber-200/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            Clic o Enter para continuar
          </span>
        </button>
      )}

      {step === 8 && step8Phase === 2 && (
        <>
          <button
            type="button"
            onClick={advance}
            className="absolute inset-0 z-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
            aria-label="Siguiente"
          />
          <div
            className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-stretch p-4 sm:p-6`}
          >
            <div className="mx-auto flex w-full max-w-3xl gap-3 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-2.5">
              <div className="my-0 -ml-2.5 w-24 shrink-0 self-stretch overflow-hidden rounded-md border border-amber-700/70 bg-black/30 sm:my-0 sm:-ml-3.5 sm:w-28">
                <Image
                  src={PJ_FEDE_RPG_FACE_2}
                  alt="Retrato de Fede"
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex flex-1 flex-col self-stretch">
                <p className="text-left text-base leading-relaxed text-amber-50/95 sm:text-lg">
                  {DIALOGUE_FEDE_STEP8_RAMAS}
                </p>
                <div className="mt-auto flex justify-center pt-4">
                  <span className="text-center text-xs text-amber-100/90">
                    Click o Enter para continuar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 8 && isStep8LootOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
          <div className="relative w-full max-w-md rounded-xl border border-amber-700/70 bg-[#1c120e]/95 p-5 shadow-[0_14px_50px_rgba(0,0,0,0.55)] sm:p-6">
            <button
              type="button"
              onClick={closeStep8Loot}
              className="absolute right-3 top-3 h-8 w-8 cursor-pointer rounded-md border border-amber-700/70 bg-amber-950/40 text-lg font-bold leading-none text-amber-100 transition hover:bg-amber-900/70"
              aria-label="Cerrar modal de loot"
            >
              X
            </button>
            <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/95">
              Objeto encontrado
            </p>
            <div className="mx-auto w-[8.5rem]">
              <div className="relative flex h-[8.5rem] w-[8.5rem] items-center justify-center rounded-2xl border-2 border-[#5f6d85] bg-gradient-to-b from-[#8fa1bd] via-[#5d6f8d] to-[#3e4e68] p-[6px] shadow-[inset_0_1px_0_rgba(218,230,255,0.35),inset_0_-1px_0_rgba(16,26,45,0.55),0_10px_18px_rgba(0,0,0,0.35)]">
                <button
                  type="button"
                  onMouseEnter={(e) =>
                    openStep8LootInfo(e.clientX, e.clientY, false)
                  }
                  onMouseMove={(e) =>
                    openStep8LootInfo(e.clientX, e.clientY, false)
                  }
                  onMouseLeave={hideStep8LootInfo}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleStep8LootInfoPinned(e.clientX, e.clientY);
                  }}
                  className="absolute right-1 top-1 z-[2] flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[#d5deee]/75 bg-[#25354f]/95 text-xs font-black text-[#eef4ff] shadow-[0_1px_4px_rgba(0,0,0,0.45)] transition hover:bg-[#304665]"
                  aria-label="Ver información de Madera"
                >
                  ?
                </button>
                <div className="flex h-full w-full items-center justify-center rounded-xl border border-[#1a2539]/80 bg-[#101a2b]/92 p-2">
                  <Image
                    src={ITEM_MADERA}
                    alt="Item madera"
                    width={112}
                    height={112}
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="absolute -bottom-1 -right-1 rounded-full border border-[#1f2d44] bg-[#0f1828]/95 px-2 py-0.5 text-xs font-black leading-none text-white shadow-[0_2px_5px_rgba(0,0,0,0.5)]">
                  x5
                </span>
              </div>
            </div>
            {step8LootInfo.open && (
              <div
                className="fixed z-[60] max-w-xs rounded-lg border border-amber-700/70 bg-[#1c120e]/95 px-3 py-2 text-sm leading-relaxed text-amber-100 shadow-[0_12px_30px_rgba(0,0,0,0.55)]"
                style={{ left: step8LootInfo.x, top: step8LootInfo.y }}
              >
                <span className="font-bold">Madera:</span> Recurso natural
                utilizado para diversos fines en este mundo.
              </div>
            )}
            <button
              type="button"
              onClick={closeStep8Loot}
              className="mx-auto mt-6 block cursor-pointer rounded-md border border-amber-600/80 bg-amber-700/80 px-6 py-2 font-semibold text-amber-50 transition hover:bg-amber-600"
            >
              CONTINUAR
            </button>
          </div>
        </div>
      )}

      {step === 9 && step9Line < STEP9_DIALOGUES.length && (
        <>
          {step9Line < STEP9_DIALOGUES.length - 1 && (
            <button
              type="button"
              onClick={advance}
              className="absolute inset-0 z-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
              aria-label="Siguiente"
            />
          )}
          <div
            className={`${dialogueFont.className} pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-stretch p-4 sm:p-6`}
          >
            <div className="mx-auto flex w-full max-w-3xl gap-3 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-2.5">
              <div className="my-0 -ml-2.5 w-24 shrink-0 self-stretch overflow-hidden rounded-md border border-amber-700/70 bg-black/30 sm:my-0 sm:-ml-3.5 sm:w-28">
                <Image
                  src={
                    currentStep9Dialogue.face === "fede_scared"
                      ? PJ_FEDE_RPG_FACE_SCARED_2
                      : currentStep9Dialogue.face === "fede_fight"
                        ? PJ_FEDE_RPG_FACE_FIGHT
                      : ENEMY_BLACKWOLF_1
                  }
                  alt={
                    currentStep9Dialogue.face === "fede_scared"
                      ? "Retrato de Fede asustado"
                      : currentStep9Dialogue.face === "fede_fight"
                        ? "Retrato de Fede en combate"
                      : "Retrato de Blackwolf"
                  }
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex flex-1 flex-col self-stretch">
                <p className="text-left text-base leading-relaxed text-amber-50/95 sm:text-lg">
                  {currentStep9Dialogue.text}
                </p>
                <div className="mt-auto flex justify-center pt-4">
                  {step9Line < STEP9_DIALOGUES.length - 1 ? (
                    <span className="text-center text-xs text-amber-100/90">
                      Click o Enter para continuar
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {step === 9 && step9Line === STEP9_DIALOGUES.length - 1 && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={goToBattleTutorial}
            className="pointer-events-auto relative cursor-pointer overflow-hidden rounded-lg border border-red-600/80 bg-gradient-to-b from-[#c14040] via-[#9a2929] to-[#661818] px-6 py-2 text-sm font-bold uppercase tracking-[0.1em] text-red-50 shadow-[0_10px_24px_rgba(120,22,22,0.45),inset_0_1px_0_rgba(255,196,196,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:from-[#ce4d4d] hover:via-[#aa3232] hover:to-[#751c1c] hover:shadow-[0_14px_30px_rgba(120,22,22,0.6),inset_0_1px_0_rgba(255,214,214,0.38)] active:translate-y-0 active:scale-[0.99]"
          >
            <span
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,205,205,0.22),transparent_58%)]"
              aria-hidden
            />
            <span className="relative">Ir a la batalla</span>
          </button>
        </div>
      )}

      {step === 9 && step9Line >= STEP9_DIALOGUES.length && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={goToBattleTutorial}
            className="pointer-events-auto relative w-full max-w-md cursor-pointer overflow-hidden rounded-xl border border-red-600/80 bg-gradient-to-b from-[#c14040] via-[#9a2929] to-[#661818] px-8 py-4 text-lg font-bold uppercase tracking-[0.12em] text-red-50 shadow-[0_12px_30px_rgba(120,22,22,0.5),inset_0_1px_0_rgba(255,196,196,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:from-[#ce4d4d] hover:via-[#aa3232] hover:to-[#751c1c] hover:shadow-[0_16px_36px_rgba(120,22,22,0.62),inset_0_1px_0_rgba(255,214,214,0.38)] active:translate-y-0 active:scale-[0.99] sm:text-xl"
          >
            <span
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,205,205,0.22),transparent_58%)]"
              aria-hidden
            />
            <span className="relative">Ir a la batalla</span>
          </button>
        </div>
      )}
    </div>
  );
}
