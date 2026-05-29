"use client";

import Image from "next/image";
import { Libre_Baskerville } from "next/font/google";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { completeCaveDepthsStory } from "@/app/(main)/cave-depths/actions";

const STORY_BG = "/img/resources/background/bg_cueva_inner_6.png";

const ENEMY_FACE_SRC = {
  faceless: "/img/resources/enemigos_faces/enemy_face_faceless_enemy.png",
  hazramitor: "/img/resources/enemigos_faces/enemy_face_Hazramitor.png",
} as const;

const ENEMY_SPRITE_SRC = {
  faceless: "/img/resources/enemigos/faceless_enemy.png",
  angry: "/img/resources/enemigos/faceless_enemy_angry.png",
  puppet: "/img/resources/enemigos/faceless_enemy_puppet.png",
  smoke: "/img/resources/enemigos/faceless_enemy_smoke.png",
  hazramitor: "/img/resources/enemigos/enemy_sprite_hazramitor_standing.png",
} as const;

type EnemySpriteKey = keyof typeof ENEMY_SPRITE_SRC | null;
type EnemyPortraitKey = keyof typeof ENEMY_FACE_SRC;

type StoryScene = {
  speaker: "player" | "enemy" | "narration";
  text: string;
  enemySprite: EnemySpriteKey;
  /** Retrato enemigo en el cuadro de diálogo (por defecto: faceless). */
  enemyPortrait?: EnemyPortraitKey;
  /** Oculta el sprite enemigo en pantalla (el PJ sigue visible). */
  hideEnemySprite?: boolean;
};

const STORY_SCENES: StoryScene[] = [
  { speaker: "player", text: "...", enemySprite: null },
  {
    speaker: "enemy",
    text: "¿Como es que este lagarto no fue suficiente para detenerlos?",
    enemySprite: "faceless",
  },
  { speaker: "player", text: "¿Quién sos?", enemySprite: "faceless" },
  {
    speaker: "enemy",
    text: "Veo que no se cansan de meterse en lo que no les importa.",
    enemySprite: "angry",
  },
  {
    speaker: "enemy",
    text: "¡Y si no lo hubieran hecho, hubiera terminado la extracción!",
    enemySprite: "angry",
  },
  { speaker: "player", text: "¿Extracción?", enemySprite: "faceless" },
  {
    speaker: "enemy",
    text: "De todas formas ya es demasiado tarde, ya conseguí lo que quería de esta cueva.",
    enemySprite: "faceless",
  },
  {
    speaker: "enemy",
    text: "Sigan investigando y van a arrepentirse, porque no voy a detenerme.",
    enemySprite: "faceless",
  },
  {
    speaker: "enemy",
    text: "Hasta que el mundo sea mio.",
    enemySprite: "puppet",
  },
  {
    speaker: "narration",
    text: "*PUFFF*",
    enemySprite: "smoke",
  },
  {
    speaker: "player",
    text: "Se fue...",
    enemySprite: null,
  },
  {
    speaker: "narration",
    text: "*Quejidos*",
    enemySprite: null,
    hideEnemySprite: true,
  },
  {
    speaker: "enemy",
    text: "Va a parecer raro lo que voy a decir, pero... gracias.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "player",
    text: "Si, tenés razón, me parece rarisimo.",
    enemySprite: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Nos tenía controlados. Nos prometió gloria y se ganó mi confianza para acceder a las profundidades de esta cueva.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Cuando empecé a cuestionarlo, lanzó un hechizo sobre mí para mantenerme a un lado, y comandaba a los míos para hacer el trabajo sucio.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Gracias nuevamente, por liberarme de su control.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "player",
    text: "De nada, supongo.",
    enemySprite: "hazramitor",
  },
  {
    speaker: "player",
    text: "¿Qué es lo que estaba buscando? ¿Quién es?",
    enemySprite: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "¿Quién es? No lo sé, pero si se lo que buscaba.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "En cuanto a lo que estaba buscando.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Él hablaba de haber encontrado una fuente de energía como nunca se había visto en Veloria.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "player",
    text: "¿Veloria?",
    enemySprite: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Realmente son una incognita. Se siente como si no fueran de este mundo.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "De todas formas, me salvaron, así que no me corresponde juzgarlos.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Veloria es todo. Desde los Páramos de Zaleria hasta las tierras más allá del Mar Tormentoso, donde ningún hombre lagarto ha puesto sus escamas jamás. ",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Es el aire que respiramos, el agua que bebemos, el suelo que pisamos. ",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Veloria es el mundo en que habitamos. ",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "player",
    text: "Ya veo. Y esta persona que los atacó, ¿Es de Veloria?",
    enemySprite: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "No sabemos quien es la persona esta.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Sinceramente, al conocerlo, sentí la misma energía que con ustedes.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Tampoco parecía de este mundo.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "player",
    text: "Mmmmm. Y denuevo, ¿Qué es lo que quería?",
    enemySprite: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Él llegó buscando una fuente de energía como nunca se había visto en Veloria.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Nos dijo que en estas cuevas podría encontrarla, y a cambio me daría el poder necesario para unificar las tribus Lizardmen.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Pero solo fueron promesas. Y las consecuencias fueron altisimas.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "player",
    text: "¿Manipuló a tu gente para hacerlos excavar esta nueva fuente de energía?",
    enemySprite: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Si, pero no todo terminó ahí. El problema es de donde lo estaba obteniendo.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Esta fuente de energía, es llamada Fragmento de Alma. Por lo que veo estás aprovechando esa magia también.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Lo que pude aprender de esta persona, es que toda la forma de vida en Veloria, está hecha de energía.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Y al morir, esa energía queda libre en el ambiente, y con el tiempo se cristaliza.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "player",
    text: "¿Ah y eso es lo que estaba extrayendo? ¿Esos fragmentos de cristal?",
    enemySprite: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Si. Mirá... Esa sala que está detrás nuestro, son nuestras cámaras sepulcrales. Donde llevamos a nuestros compañeros caidos en batalla.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Él estaba extrayendo fragmentos del alma de todos nuestros antepasados, y llevandoselós para usarlo en quien sabe que.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "player",
    text: "Es terrible, menos mal que llegamos. Por suerte pudimos frenarlo antes que fuera tarde.",
    enemySprite: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Si, estaré eternamente agradecido por eso.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
  {
    speaker: "enemy",
    text: "Ahora solo queda expulsar a los que queden dentro y volver a recuperar nuestra paz.",
    enemySprite: "hazramitor",
    enemyPortrait: "hazramitor",
  },
];

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

type CaveDepthsStoryProps = {
  playerName: string;
  playerSpriteSrc: string;
  playerFaceSrc: string;
};

export function CaveDepthsStory({
  playerName,
  playerSpriteSrc,
  playerFaceSrc,
}: CaveDepthsStoryProps) {
  const router = useRouter();
  const [isFinishing, startFinishTransition] = useTransition();
  const [finishError, setFinishError] = useState<string | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);

  const isLastScene = sceneIndex >= STORY_SCENES.length - 1;
  const currentScene = STORY_SCENES[Math.min(sceneIndex, STORY_SCENES.length - 1)];
  const showPortrait = currentScene.speaker !== "narration";
  const portraitSrc =
    currentScene.speaker === "player"
      ? playerFaceSrc
      : ENEMY_FACE_SRC[currentScene.enemyPortrait ?? "faceless"];
  const enemySpriteSrc = currentScene.enemySprite
    ? ENEMY_SPRITE_SRC[currentScene.enemySprite]
    : null;
  const enemySpriteAlt =
    currentScene.enemySprite === "hazramitor" ? "Hazramitor" : "Enemigo sin rostro";
  const enemyPortraitAlt =
    currentScene.enemyPortrait === "hazramitor" ? "Hazramitor" : "Enemigo sin rostro";

  const showEnemySprite =
    currentScene.hideEnemySprite !== true && enemySpriteSrc != null;
  const isHazramitorSprite = currentScene.enemySprite === "hazramitor";
  const enemySpriteSizeClass = isHazramitorSprite
    ? "h-[min(52vh,320px)] w-auto max-w-[min(88vw,400px)] max-sm:-mr-16 object-contain object-bottom drop-shadow-[0_10px_28px_rgba(0,0,0,0.6)] sm:mr-0 sm:h-[min(80vh,1050px)] sm:max-w-[min(60vw,1050px)]"
    : "h-[min(42vh,260px)] w-auto max-w-[min(78vw,170px)] object-contain object-bottom drop-shadow-[0_10px_28px_rgba(0,0,0,0.6)] sm:h-[min(72vh,460px)] sm:max-w-[min(52vw,600px)]";
  const enemySpriteWrapClass = isHazramitorSprite
    ? "cave-depths-enemy-enter pointer-events-none absolute inset-x-0 bottom-0 z-[8] flex justify-end pb-[7.5rem] pr-0 sm:z-10 sm:pb-[6rem] sm:pr-4 md:pr-10 sm:inset-x-75"
    : "cave-depths-enemy-enter pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-end pb-[7.5rem] pr-0 sm:pb-[6rem] sm:pr-4 md:pr-10 sm:inset-x-75";

  const advance = useCallback(() => {
    if (isLastScene) return;
    setSceneIndex((value) => Math.min(value + 1, STORY_SCENES.length - 1));
  }, [isLastScene]);

  const handleFinish = useCallback(() => {
    setFinishError(null);
    startFinishTransition(async () => {
      const result = await completeCaveDepthsStory();
      if (!result.ok) {
        setFinishError(result.error);
        return;
      }
      router.replace("/cave-depths?hotspot=cave-depth-5");
    });
  }, [router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (isLastScene) {
        handleFinish();
      } else {
        advance();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, handleFinish, isLastScene]);

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#0a0604] text-amber-50 touch-manipulation">
      <style jsx>{`
        @keyframes cave-depths-enemy-enter {
          0% {
            opacity: 0;
            transform: translateX(36px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .cave-depths-enemy-enter {
          animation: cave-depths-enemy-enter 0.45s ease-out forwards;
        }
      `}</style>

      <Image src={STORY_BG} alt="" fill priority className="object-cover" sizes="100vw" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/45" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-start pb-[7.5rem] pl-0 sm:pb-[6rem] sm:pl-4 md:pl-10 sm:inset-x-75">
        <Image
          src={playerSpriteSrc}
          alt={`Sprite de ${playerName}`}
          width={720}
          height={1080}
          className="h-[min(38vh,170px)] w-auto max-w-[min(72vw,280px)] object-contain object-bottom drop-shadow-[0_10px_28px_rgba(0,0,0,0.6)] sm:h-[min(68vh,420px)] sm:max-w-[min(48vw,560px)]"
          priority
        />
      </div>

      {showEnemySprite ? (
        <div key={enemySpriteSrc} className={enemySpriteWrapClass}>
          <Image
            src={enemySpriteSrc}
            alt={enemySpriteAlt}
            width={720}
            height={1080}
            className={enemySpriteSizeClass}
          />
        </div>
      ) : null}

      {!isLastScene ? (
        <button
          type="button"
          onClick={advance}
          className="absolute inset-0 z-20 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
          aria-label="Siguiente diálogo"
        />
      ) : null}

      <div
        className={`${dialogueFont.className} absolute inset-x-0 bottom-0 z-30 p-2 sm:p-6`}
      >
        <div
          className={`mx-auto flex w-full max-w-3xl rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-6 sm:py-3 ${
            showPortrait ? "gap-3 sm:gap-4" : ""
          }`}
        >
          {showPortrait ? (
            <div className="my-0 -ml-1 w-16 shrink-0 self-stretch overflow-hidden rounded-md border border-amber-700/70 bg-black/30 sm:-ml-3.5 sm:w-28">
              <Image
                src={portraitSrc}
                alt={
                  currentScene.speaker === "player"
                    ? `Retrato de ${playerName}`
                    : `Retrato de ${enemyPortraitAlt}`
                }
                width={112}
                height={112}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col self-stretch">
            <p
              className={`text-[13px] leading-relaxed text-amber-50/95 sm:text-lg ${
                showPortrait ? "text-left" : "text-center italic"
              }`}
            >
              {currentScene.text}
            </p>
            <div className="mt-auto flex flex-col items-center pt-4">
              {isLastScene && finishError ? (
                <p className="mb-2 text-center text-[11px] font-semibold text-red-300 sm:text-xs">
                  {finishError}
                </p>
              ) : null}
              {isLastScene ? (
                <button
                  type="button"
                  disabled={isFinishing}
                  onClick={handleFinish}
                  className="cursor-pointer rounded-md border border-emerald-600/90 bg-gradient-to-b from-emerald-700 to-emerald-900 px-8 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-50 shadow-[0_0_14px_rgba(16,185,129,0.25)] transition hover:from-emerald-600 hover:to-emerald-800 disabled:cursor-wait disabled:opacity-70"
                >
                  {isFinishing ? "Guardando…" : "CONTINUAR"}
                </button>
              ) : (
                <span className="text-center text-xs text-amber-100/90">
                  Click o Enter para continuar
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
