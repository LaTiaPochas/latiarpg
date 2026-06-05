"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Libre_Baskerville } from "next/font/google";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const FACES_BASE = "/img/resources/caracters_faces";
const CHARACTERS_BASE = "/img/resources/characters";

type GarrisonLevel2DialogueLine = {
  faceFile: string;
  faceAlt: string;
  text: string;
};

const GARRISON_LEVEL2_DIALOGUE_LINES: GarrisonLevel2DialogueLine[] = [
  {
    faceFile: "pj_mati_rpg_face.png",
    faceAlt: "Mati",
    text: "Bueno las cosas se complicaron más de lo que me imaginaba.",
  },
  {
    faceFile: "pj_mati_rpg_face.png",
    faceAlt: "Mati",
    text: "No me gustaría tener que decir esto pero...",
  },
  {
    faceFile: "pj_mati_rpg_face.png",
    faceAlt: "Mati",
    text: "Muchas de las cosas que estamos viendo no las programé yo.",
  },
  {
    faceFile: "pj_silva_rpg_face_2.png",
    faceAlt: "Silva",
    text: "¿Cómo que no?¿Entonces?",
  },
  {
    faceFile: "pj_mati_rpg_face.png",
    faceAlt: "Mati",
    text: "Osea, los Goblins tenían que aparecer más adelante.",
  },
  {
    faceFile: "pj_mati_rpg_face.png",
    faceAlt: "Mati",
    text: "Se supone que el primer nivel era en una granja de Nacho contra ovejas.",
  },
  {
    faceFile: "pj_mati_rpg_face.png",
    faceAlt: "Mati",
    text: "Es como si el juego hubiera tomado vida propia, y se hubiera desarrollado.",
  },
  {
    faceFile: "pj_becho_rpg_face_2.png",
    faceAlt: "Becho",
    text: "¿Osea que no tenés idea para donde ir?¿O quién puede ser el tipo ese que apareció en la cueva?",
  },
  {
    faceFile: "pj_mati_rpg_face.png",
    faceAlt: "Mati",
    text: "Lamentablemente, no lo puse en el juego yo.",
  },
  {
    faceFile: "pj_mati_rpg_face.png",
    faceAlt: "Mati",
    text: "Con este contexto, ya no se que cosas pueden aparecer, tenemos que tener mucho cuidado.",
  },
  {
    faceFile: "pj_checho_rpg_face_2.png",
    faceAlt: "Checho",
    text: "Lo bueno es que estamos bastante organizados.",
  },
  {
    faceFile: "pj_checho_rpg_face_2.png",
    faceAlt: "Checho",
    text: "Ahora tenemos piedra y otros materiales para seguir expandiendonos.",
  },
  {
    faceFile: "pj_fede_rpg_face.png",
    faceAlt: "Fede",
    text: "Hay que hacer más grandes esos cofres porque me estoy llenando de mierda.",
  },
  {
    faceFile: "pj_nacho_rpg_face.png",
    faceAlt: "Nacho",
    text: "Tengo unas ideas para mis aguas relajantes que los van a volver locos.",
  },
  {
    faceFile: "pj_leo_rpg_face_2.png",
    faceAlt: "Leo",
    text: "Uh Nachito ¿se viene el resort?.",
  },
  {
    faceFile: "pj_nacho_rpg_face.png",
    faceAlt: "Nacho",
    text: "¿Sos boludo?",
  },
  {
    faceFile: "pj_chane_rpg_face.png",
    faceAlt: "Chane",
    text: "Yo estuve testeando unas cositas para crear, pero necesito hacer más pruebas.",
  },
  {
    faceFile: "pj_delu_rpg_face_2.png",
    faceAlt: "Delu",
    text: "¿Cómo está Meloni?",
  },
  {
    faceFile: "pj_chane_rpg_face.png",
    faceAlt: "Chane",
    text: "Extasiado, no dejan de traerle galletitas.",
  },
  {
    faceFile: "pj_silva_rpg_face_2.png",
    faceAlt: "Silva",
    text: "GAAAAAAAH.",
  },
  {
    faceFile: "pj_leo_rpg_face_2.png",
    faceAlt: "Leo",
    text: "¿Se hace la expansión?",
  },
  {
    faceFile: "pj_checho_rpg_face_2.png",
    faceAlt: "Checho",
    text: "MIBOOOOOOMBOOOOOOOOOOO",
  },
  {
    faceFile: "pj_silva_rpg_face_2.png",
    faceAlt: "Silva",
    text: "Bueno bueno vamos a organizarnos un poco entonces.",
  },
  {
    faceFile: "pj_mati_rpg_face.png",
    faceAlt: "Mati",
    text: "Dale, pero una cosa más.",
  },
  {
    faceFile: "pj_mati_rpg_face.png",
    faceAlt: "Mati",
    text: "Para que se den una idea de que tanto creció esto por su cuenta...",
  },
  {
    faceFile: "pj_mati_rpg_face.png",
    faceAlt: "Mati",
    text: "Ni siquiera le había puesto nombre al continente yo.",
  },
  {
    faceFile: "pj_mati_rpg_face.png",
    faceAlt: "Mati",
    text: "Pero concuerdo en que tenemos que tratar de estar lo más OP posible.",
  },
  {
    faceFile: "pj_checho_rpg_face_2.png",
    faceAlt: "Checho",
    text: "PIROKAAAAAAAA.",
  },
  {
    faceFile: "pj_silva_rpg_face_2.png",
    faceAlt: "Silva",
    text: "¡Pará un poco enfermo!",
  },
  {
    faceFile: "pj_silva_rpg_face_2.png",
    faceAlt: "Silva",
    text: "Vamos a reforzar la base entonces, y seguir construyendo desde ahí.",
  },
  {
    faceFile: "pj_becho_rpg_face_2.png",
    faceAlt: "Becho",
    text: "¿Qué es gueforzar?",
  },
  {
    faceFile: "pj_delu_rpg_face_2.png",
    faceAlt: "Delu",
    text: "jajaja buena Bece",
  },
  {
    faceFile: "pj_delu_rpg_face_2.png",
    faceAlt: "Delu",
    text: "Perdiste negra.",
  },
  {
    faceFile: "pj_silva_rpg_face_enojado_2.png",
    faceAlt: "Silva",
    text: "...",
  },
  {
    faceFile: "pj_mati_rpg_face.png",
    faceAlt: "Mati",
    text: "Bueno, empecemos antes que se vaya todo a la mierda.",
  },
];

function faceSrcFromFile(faceFile: string) {
  return `${FACES_BASE}/${faceFile}`;
}

/** Pantallas con ancho ≤ 639px usan `layoutMobile` (mismo corte que Tailwind `sm`). */
export const GARRISON_INTRO_MOBILE_MAX_WIDTH_PX = 639;

export type GarrisonIntroSpriteLayout = {
  left?: string;
  right?: string;
  bottom?: string;
  /** Ancho del sprite (cada personaje puede tener uno distinto). */
  width?: string;
  /** Alto fijo; si no lo ponés, se calcula según el ancho y la proporción de la imagen. */
  height?: string;
  /** Tope de alto solo para este sprite (ej. "min(55vh, 480px)"). */
  maxHeight?: string;
  zIndex?: number;
  transform?: string;
};

export type GarrisonLevel2IntroSprite = {
  id: string;
  src: string;
  alt: string;
  /** Desktop / tablet (≥ 640px). */
  layout: GarrisonIntroSpriteLayout;
  /** Mobile (≤ 639px). Solo definí los campos que quieras cambiar; el resto hereda de `layout`. */
  layoutMobile?: Partial<GarrisonIntroSpriteLayout>;
};

export function resolveGarrisonIntroSpriteLayout(
  sprite: GarrisonLevel2IntroSprite,
  isMobile: boolean,
): GarrisonIntroSpriteLayout {
  if (!isMobile || !sprite.layoutMobile) {
    return sprite.layout;
  }
  return { ...sprite.layout, ...sprite.layoutMobile };
}

function useIsGarrisonIntroMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(
      `(max-width: ${GARRISON_INTRO_MOBILE_MAX_WIDTH_PX}px)`,
    );
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

/**
 * Sprites del diálogo intro — acá ajustás posición y tamaño de cada personaje.
 *
 * `layout` → desktop (pantalla ≥ 640px).
 * `layoutMobile` → solo mobile; mismas propiedades, solo las que quieras distintas.
 *
 * layout.left / layout.right → distancia al borde (ej. "8%", "120px"). Usá left O right, no ambos.
 * layout.bottom → altura desde abajo (subí el % si quedan tapados por la caja de diálogo).
 * layout.width → ancho de ESTE personaje (ej. "90px", "min(14vw, 160px)").
 * layout.height → alto fijo de ESTE personaje (ej. "220px"); omitilo para mantener proporción.
 * layout.maxHeight → tope de alto solo para este sprite (ej. "min(50vh, 400px)").
 * layout.zIndex → capa (mayor número = más adelante).
 * layout.transform → centrado fino (ej. "translateX(-50%)" con left: "50%").
 *
 * Ejemplo mobile:
 *   layout: { left: "18%", bottom: "16%", width: "150px" },
 *   layoutMobile: { left: "6%", bottom: "22%", width: "72px" },
 */
export const GARRISON_LEVEL2_INTRO_SPRITES: GarrisonLevel2IntroSprite[] = [
  {
    id: "fede",
    src: `${CHARACTERS_BASE}/pj_fede_rpg_standing.png`,
    alt: "Fede",
    layout: {
      left: "18%",
      bottom: "16%",
      width: "min(11vw, 150px)",
      zIndex: 11,
    },
    layoutMobile: {
      left: "12%",
      bottom: "15%",      
      width: "78px",      
      maxHeight: "38vh",  
    },
  },
  {
    id: "chane",
    src: `${CHARACTERS_BASE}/pj_chane_seller.png`,
    alt: "Chane",
    layout: {
      left: "22%",
      bottom: "14%",
      width: "min(11vw, 180px)",
      zIndex: 18,
    },
    layoutMobile: {
      left: "2%",
      bottom: "15%",      
      width: "90px",      
      maxHeight: "38vh",  
    },
  },
  {
    id: "nacho",
    src: `${CHARACTERS_BASE}/pj_nacho_rpg_standing.png`,
    alt: "Nacho",
    layout: {
      left: "12%",
      bottom: "14%",
      width: "min(11vw, 190px)",
      zIndex: 3,
    },
    layoutMobile: {
      left: "15%",
      bottom: "25%",      
      width: "90px",      
      maxHeight: "38vh",  
    },
  },
  {
    id: "mati",
    src: `${CHARACTERS_BASE}/pj_mati_rpg_standing.png`,
    alt: "Mati",
    layout: {
      left: "32%",
      bottom: "14%",
      width: "min(11vw, 180px)",
      zIndex: 12,
    },
    layoutMobile: {
      left: "25%",
      bottom: "15%",      
      width: "90px",      
      maxHeight: "38vh",  
    },
  },
  {
    id: "silva",
    src: `${CHARACTERS_BASE}/pj_silva_rpg_standing_2.png`,
    alt: "Silva",
    layout: {
      left: "55%",
      bottom: "14%",
      width: "min(11vw, 170px)",
      zIndex: 14,
    },
    layoutMobile: {
      left: "50%",
      bottom: "15%",      
      width: "90px",      
      maxHeight: "38vh",  
    },
  },
  {
    id: "leo",
    src: `${CHARACTERS_BASE}/pj_leo_rpg_standing_2.png`,
    alt: "Leo",
    layout: {
      left: "60%",
      bottom: "30%",
      width: "min(11vw, 140px)",
      zIndex: 15,
    },
    layoutMobile: {
      left: "55%",
      bottom: "35%",      
      width: "75px",      
      maxHeight: "38vh",  
    },
  },
  {
    id: "delu",
    src: `${CHARACTERS_BASE}/pj_delu_rpg_standing_2.png`,
    alt: "Delu",
    layout: {
      left: "62%",
      bottom: "14%",
      width: "min(11vw, 140px)",
      zIndex: 16,
    },
    layoutMobile: {
      left: "60%",
      bottom: "15%",      
      width: "90px",      
      maxHeight: "38vh",  
    },
  },
  {
    id: "checho",
    src: `${CHARACTERS_BASE}/pj_checho_rpg_standing_2.png`,
    alt: "Checho",
    layout: {
      left: "65%",
      bottom: "14%",
      width: "min(11vw, 190px)",
      zIndex: 10,
    },
    layoutMobile: {
      left: "65%",
      bottom: "18%",      
      width: "110px",      
      maxHeight: "38vh",  
    },
  },
  {
    id: "becho",
    src: `${CHARACTERS_BASE}/pj_becho_rpg_standing_2.png`,
    alt: "Becho",
    layout: {
      left: "70%",
      bottom: "12%",
      width: "min(11vw, 200px)",
      zIndex: 18,
    },
    layoutMobile: {
      left: "75%",
      bottom: "15%",      
      width: "100px",      
      maxHeight: "38vh",  
    },
  },
];

type GarrisonLevel2IntroDialogueProps = {
  onComplete: () => Promise<{ ok: boolean }>;
};

export function GarrisonLevel2IntroDialogue({ onComplete }: GarrisonLevel2IntroDialogueProps) {
  const isMobileLayout = useIsGarrisonIntroMobile();
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const currentLine = useMemo(
    () =>
      GARRISON_LEVEL2_DIALOGUE_LINES[
        Math.min(dialogueIndex, GARRISON_LEVEL2_DIALOGUE_LINES.length - 1)
      ],
    [dialogueIndex],
  );
  const isLastDialogue = dialogueIndex >= GARRISON_LEVEL2_DIALOGUE_LINES.length - 1;

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
    setDialogueIndex((value) =>
      Math.min(value + 1, GARRISON_LEVEL2_DIALOGUE_LINES.length - 1),
    );
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
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.62)), url('/img/resources/background/bg_first_base.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 z-20 cursor-pointer" onClick={advance}>
        <div className="relative h-full w-full">
          {GARRISON_LEVEL2_INTRO_SPRITES.map((sprite) => {
            const layout = resolveGarrisonIntroSpriteLayout(sprite, isMobileLayout);

            return (
              <div
                key={sprite.id}
                className="pointer-events-none absolute"
                style={{
                  left: layout.left,
                  right: layout.right,
                  bottom: layout.bottom,
                  zIndex: layout.zIndex ?? 10,
                  transform: layout.transform,
                }}
              >
                <Image
                  src={sprite.src}
                  alt={sprite.alt}
                  width={520}
                  height={780}
                  className="block object-contain object-bottom drop-shadow-[0_10px_28px_rgba(0,0,0,0.55)]"
                  style={{
                    width: layout.width ?? "110px",
                    height: layout.height ?? "auto",
                    maxHeight: layout.maxHeight,
                  }}
                  priority
                />
              </div>
            );
          })}

          <div
            className={`absolute inset-x-0 bottom-0 z-30 p-2 sm:p-5 ${dialogueFont.className}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto flex w-full max-w-3xl gap-3 rounded-lg border border-amber-800/60 bg-[#1a100c]/92 px-4 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-3">
              <div className="my-0 -ml-1 h-16 w-16 shrink-0 self-start overflow-hidden rounded-md border border-amber-700/70 bg-black/30 sm:-ml-3.5 sm:h-28 sm:w-28">
                <Image
                  src={faceSrcFromFile(currentLine.faceFile)}
                  alt={`Retrato de ${currentLine.faceAlt}`}
                  width={112}
                  height={112}
                  className="h-16 w-16 object-cover sm:h-28 sm:w-28"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col self-stretch">
                <p className="text-left text-[13px] leading-relaxed text-amber-50/95 sm:text-lg">
                  {currentLine.text}
                </p>
                <div className="mt-auto flex justify-center pt-4">
                  <span className="text-center text-xs text-amber-100/90">
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
