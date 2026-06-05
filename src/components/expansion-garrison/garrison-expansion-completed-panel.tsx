"use client";

import { Montserrat } from "next/font/google";

import { GarrisonBackLink } from "@/components/camp/garrison-back-link";

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type GarrisonExpansionCompletedPanelProps = {
  uiFontClassName?: string;
};

export function GarrisonExpansionCompletedPanel({
  uiFontClassName = uiFont.className,
}: GarrisonExpansionCompletedPanelProps) {
  return (
    <main
      className={`relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden bg-[#120b08] px-4 py-8 text-amber-50 ${uiFontClassName}`}
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.62)), url('/img/resources/background/bg_first_base.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
        <p className="text-lg font-bold uppercase tracking-wide text-emerald-900">Completado</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-800">
          La expansión del campamento ya está terminada.
        </p>
        <div className="mt-6 flex justify-center">
          <GarrisonBackLink className={uiFontClassName} />
        </div>
      </div>
    </main>
  );
}
