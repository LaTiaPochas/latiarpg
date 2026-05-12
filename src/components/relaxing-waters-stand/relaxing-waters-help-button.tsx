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

export function RelaxingWatersHelpButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`${uiFont.className} absolute right-2 top-2 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-cyan-300/80 bg-cyan-950/80 text-sm font-black text-cyan-100 shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition hover:bg-cyan-800/90 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200`}
        aria-label="Cómo funcionan las aguas termales"
      >
        ?
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed left-0 top-0 z-[1000] grid h-dvh w-dvw place-items-center overflow-y-auto bg-black/65 p-4">
          <div
            className={`${dialogueFont.className} relative my-auto w-full max-w-md rounded-xl border border-cyan-600/80 bg-[#0f1e2a]/95 p-5 pr-10 text-cyan-50 shadow-[0_16px_45px_rgba(0,0,0,0.55)]`}
            role="dialog"
            aria-modal="true"
            aria-label="Cómo funcionan las aguas termales"
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={`${uiFont.className} absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-cyan-500/80 bg-cyan-950/80 text-xs font-black text-cyan-100 transition hover:bg-cyan-800/90`}
              aria-label="Cerrar ayuda"
            >
              X
            </button>
            <h2 className="text-sm font-bold text-cyan-100 sm:text-base">
              ¿Cómo funcionan las aguas relajantes?
            </h2>
            <div className="mt-3 space-y-5 text-[12px] leading-relaxed text-cyan-50/90">
              <p>
                Las Aguas Relajantes sirven para recuperar por completo la vida y el maná de tu personaje. Cada vez que tomás una botella, se consume una unidad del stock disponible del puesto. Si tu vida y tu maná ya están completos, no vas a poder tomar una botella.
              </p>
              <p>
                El stock del puesto aumenta cuando se consiguen cargas de Aguas Relajantes durante las aventuras. <br />
                • Cada vez que alguien muere en combate, se suma una carga de Aguas Relajantes al Stock.<br />
                • Cada vez que alguien gana un combate, hay un 15% de chance de conseguir 1 Agua Relajante.
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
