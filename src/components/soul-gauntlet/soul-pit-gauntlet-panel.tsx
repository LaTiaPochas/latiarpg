"use client";

import Image from "next/image";
import Link from "next/link";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { useTransition } from "react";

import { startSoulGauntletRun } from "@/app/(main)/gauntlet-pozo-de-las-almas/actions";
import { SoulPitGauntletHelpButton } from "@/components/soul-gauntlet/soul-pit-gauntlet-help-button";
import { SOUL_GAUNTLET_ENTRY_FRAGMENT_COST } from "@/lib/soul-gauntlet";

export { SOUL_GAUNTLET_ENTRY_FRAGMENT_COST };

const SOUL_FRAGMENT_FALLBACK_ICON = "/img/resources/items/resource_soul_fragment.png";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const entendidoActionClassName =
  "inline-flex items-center justify-center rounded-lg border border-slate-500/80 bg-gradient-to-b from-slate-600 to-slate-800 px-6 py-2 text-[13px] font-semibold uppercase tracking-wide text-slate-200 shadow-[0_0_2px_rgba(25,25,25,0.8)] transition hover:from-slate-500 hover:to-slate-700 active:from-slate-700 active:to-slate-900 disabled:cursor-not-allowed disabled:border-slate-600/70 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-400 disabled:opacity-60 disabled:shadow-none disabled:hover:from-slate-700 disabled:hover:to-slate-800";

const backActionClassName =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b]";

type SoulPitGauntletPanelProps = {
  soulFragmentOwned: number;
  soulFragmentIconSrc?: string;
};

function SoulFragmentEntryCostIcon({
  iconSrc,
  cost,
  locked,
}: {
  iconSrc: string;
  cost: number;
  locked: boolean;
}) {
  return (
    <div className="relative h-[4.25rem] w-[4.25rem] sm:h-[4.75rem] sm:w-[4.75rem]">
      <div
        className={`relative flex h-full w-full items-center justify-center overflow-visible rounded-md border-2 p-1 shadow-inner sm:p-1.5 ${
          locked
            ? "border-slate-500/80 bg-[#2a2a2a]/90 shadow-black/20"
            : "border-amber-900/70 bg-[#1f120e]/85 shadow-black/40"
        }`}
      >
        <Image
          src={iconSrc}
          alt="Fragmento de Alma"
          width={72}
          height={72}
          className={`h-auto max-h-full w-auto max-w-full object-contain ${
            locked ? "opacity-50 grayscale" : ""
          }`}
        />
        <span
          className={`${uiFont.className} absolute bottom-0 right-0 z-10 rounded-tl-md px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums shadow-sm sm:text-[11px] ${
            locked ? "bg-slate-800/95 text-slate-300" : "bg-black/90 text-amber-50"
          }`}
        >
          x{cost}
        </span>
      </div>
    </div>
  );
}

export function SoulPitGauntletPanel({
  soulFragmentOwned,
  soulFragmentIconSrc = SOUL_FRAGMENT_FALLBACK_ICON,
}: SoulPitGauntletPanelProps) {
  const [isPending, startTransition] = useTransition();
  const canAffordEntry = soulFragmentOwned >= SOUL_GAUNTLET_ENTRY_FRAGMENT_COST;

  const handleStartRun = () => {
    if (!canAffordEntry || isPending) return;
    startTransition(async () => {
      await startSoulGauntletRun();
    });
  };

  return (
    <div
      className={`${dialogueFont.className} relative w-full max-w-lg rounded-xl border border-amber-700/80 bg-[#1a100c]/97 px-4 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.65)] sm:px-6 sm:py-5`}
    >
      <SoulPitGauntletHelpButton />
      <h1 className="text-center text-base font-bold uppercase tracking-wide text-amber-200 sm:text-lg">
        Soul Pit Gauntlet
      </h1>
      <div className="mt-2 space-y-5 text-center text-[13px] leading-relaxed text-amber-50/95 sm:text-sm">
        <p>La entrada al Pozo de las Almas está abierta nuevamente.</p>
        <p>
          Adentrate en los sepulcros de los Lizardmen, para sacar a los invasores que aun siguen
          extrayendo fragmentos de alma de las cuevas.
        </p>
        <p>
          Aprovechá este modo para competir con la comunidad y demostrar que tan profundo podés
          llegar antes de tener que volver a tomar aire a la superficie, y obtené recompensas
          basadas en tu esfuerzo.
        </p>
      </div>
      <div className={`${uiFont.className} mt-8`}>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-amber-200/95 sm:text-xs">
          COSTE DE ENTRADA:
        </p>
        <div className="mt-3 flex flex-col items-center justify-center gap-2">
          <SoulFragmentEntryCostIcon
            iconSrc={soulFragmentIconSrc}
            cost={SOUL_GAUNTLET_ENTRY_FRAGMENT_COST}
            locked={!canAffordEntry}
          />
          {!canAffordEntry ? (
            <p className="text-center text-[11px] font-semibold text-slate-400 sm:text-xs">
              Necesitás más Fragmentos de Alma para poder ingresar
            </p>
          ) : null}
        </div>
      </div>
      <div className={`${uiFont.className} mt-8 flex flex-col items-center justify-center gap-3`}>
        <button
          type="button"
          disabled={!canAffordEntry || isPending}
          onClick={handleStartRun}
          className={`${entendidoActionClassName} cursor-pointer`}
        >
          {isPending ? "Ingresando..." : "Entendido"}
        </button>
        <Link href="/cave-depths?hotspot=cave-depth-5" className={backActionClassName}>
          <span className="text-base leading-none" aria-hidden>
            ←
          </span>
          volver a las profundidades
        </Link>
      </div>
    </div>
  );
}
