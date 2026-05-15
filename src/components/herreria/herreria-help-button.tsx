"use client";

import { Libre_Baskerville, Montserrat } from "next/font/google";
import { useState } from "react";
import { createPortal } from "react-dom";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});
const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export function HerreriaHelpButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
        className={`${uiFont.className} absolute right-2 top-2 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-amber-300/80 bg-amber-950/80 text-sm font-black text-amber-100 shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition hover:bg-amber-800/90 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200`}
        aria-label="Cómo funciona la herrería"
      >
        ?
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed left-0 top-0 z-[1000] grid h-dvh w-dvw place-items-center overflow-y-auto bg-black/65 p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className={`${dialogueFont.className} relative my-auto w-full max-w-md rounded-xl border border-amber-600/80 bg-[#1f120e]/95 p-5 pr-10 text-amber-50 shadow-[0_16px_45px_rgba(0,0,0,0.55)]`}
                role="dialog"
                aria-modal="true"
                aria-label="Cómo funciona la herrería"
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsOpen(false);
                  }}
                  className={`${uiFont.className} absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-amber-500/80 bg-amber-950/80 text-xs font-black text-amber-100 transition hover:bg-amber-800/90`}
                  aria-label="Cerrar ayuda"
                >
                  X
                </button>
                <h2 className="text-sm font-bold text-amber-100 sm:text-base">
                  ¿Cómo funciona la herrería?
                </h2>
                <div className="mt-3 space-y-5 text-[12px] leading-relaxed text-amber-50/90">
                  <p>
                    Primero hay que construir la herrería aportando madera y piedra. Cuando ambos objetivos se completan,
                    Chane puede empezar a trabajar con recetas.
                  </p>
                  <p>
                    En <strong className="text-amber-600">Aprender</strong>, podés entregarle recetas a Chane. Cada receta aumenta su nivel hasta
                    el máximo permitido y se consume del inventario.
                  </p>
                  <p>
                    En <strong className="text-amber-600">Craftear</strong>, elegís una receta aprendida, revisás sus componentes y fabricás el
                    item si tenés materiales suficientes y espacio libre en el inventario.
                  </p>
                  <p>
                    Los items fabricados pueden generar stats adicionales al momento de craftear.
                  </p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
