"use client";

import Image from "next/image";
import Link from "next/link";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import {
  REBIRTH_SOUL_FRAGMENT_COST,
  REBIRTH_SOUL_GOLD_COST,
  RECONSTRUCT_SOUL_FRAGMENT_COST,
} from "@/lib/soul-altar-costs";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

const GOLD_ICON_SRC = "/img/resources/items/resource_gold.png";
const SOUL_FRAGMENT_ICON_SRC = "/img/resources/items/resource_soul_fragment.png";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});
const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

type CompletedView = "menu" | "reconstruction" | "rebirth";

type SoulAltarGloballyCompletedPanelProps = {
  goldOwned: number;
  soulFragmentOwned: number;
  hasInventorySpaceForReconstruct: boolean;
  reconstructSoulAtAltar: () => Promise<void>;
  rebirthAtAltar: () => Promise<void>;
};

export function SoulAltarGloballyCompletedPanel({
  goldOwned,
  soulFragmentOwned,
  hasInventorySpaceForReconstruct,
  reconstructSoulAtAltar,
  rebirthAtAltar,
}: SoulAltarGloballyCompletedPanelProps) {
  const router = useRouter();
  const [isReconstructPending, startReconstructTransition] = useTransition();
  const [isRebirthPending, startRebirthTransition] = useTransition();
  const [view, setView] = useState<CompletedView>("menu");
  const [actionError, setActionError] = useState<string | null>(null);

  const soulEnough = soulFragmentOwned >= RECONSTRUCT_SOUL_FRAGMENT_COST;
  const goldEnoughForRebirth = goldOwned >= REBIRTH_SOUL_GOLD_COST;
  const soulEnoughForRebirth = soulFragmentOwned >= REBIRTH_SOUL_FRAGMENT_COST;
  const canReconstructSoul =
    soulEnough && hasInventorySpaceForReconstruct && !isReconstructPending;
  const canRenacer =
    goldEnoughForRebirth &&
    soulEnoughForRebirth &&
    hasInventorySpaceForReconstruct &&
    !isRebirthPending;

  function handleReconstructSoul() {
    setActionError(null);
    startReconstructTransition(async () => {
      try {
        await reconstructSoulAtAltar();
        router.refresh();
      } catch (error) {
        if (isNextRedirectError(error)) throw error;
        setActionError(error instanceof Error ? error.message : "No se pudo reconstruir el alma.");
      }
    });
  }

  function handleRebirth() {
    setActionError(null);
    startRebirthTransition(async () => {
      try {
        await rebirthAtAltar();
        router.refresh();
      } catch (error) {
        if (isNextRedirectError(error)) throw error;
        setActionError(error instanceof Error ? error.message : "No se pudo completar el Renacimiento.");
      }
    });
  }

  return (
    <section className="w-full max-w-lg rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm lg:p-3">
      <div className="rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-5 text-center lg:p-6">
        {view === "menu" ? (
          <>
            <p className="text-sm font-semibold leading-relaxed text-slate-800/90 sm:text-base">
              El Altar de Almas
            </p>
            <p className={`${dialogueFont.className} mt-1 text-[12px] leading-relaxed text-slate-700 sm:text-[13px]`}>
              Leo descubrió que una parte de tu alma puede ser reconstruida, canalizando fragmentos de enemigos derrotados.
            </p>
            <br />
            <p className={`${dialogueFont.className} mt-1 text-[11px] leading-relaxed text-amber-950 sm:text-xs`}>
              <i>"Ya vas a empezar a hablar de nuevo de todo lo que soñaste ayer."</i>
            </p>
            <div
              className={`${uiFont.className} mt-8 flex w-full flex-col items-stretch gap-3 sm:flex-row sm:justify-center sm:gap-4`}
            >
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setView("reconstruction");
                }}
                className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-lg border border-slate-900/50 bg-gradient-to-b from-slate-700/95 to-slate-900/95 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-50 shadow-md transition hover:from-slate-600/95 hover:to-slate-800/95 sm:max-w-[220px] sm:text-xs"
              >
                Reconstrucción del Alma
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setView("rebirth");
                }}
                className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-lg border border-amber-900/50 bg-gradient-to-b from-amber-700/95 to-amber-900/95 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-amber-50 shadow-md transition hover:from-amber-600/95 hover:to-amber-800/95 sm:max-w-[220px] sm:text-xs"
              >
                Renacimiento
              </button>
            </div>
            <div className="mt-6 flex justify-center">
              <Link
                href="/garrison"
                className={`${uiFont.className} inline-flex items-center gap-1.5 rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b]`}
              >
                <span className="text-base leading-none" aria-hidden>
                  ←
                </span>
                Volver al Campamento
              </Link>
            </div>
          </>
        ) : view === "reconstruction" ? (
          <>
            <h2 className="text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
              Reconstrucción del alma
            </h2>
            <div className={`${dialogueFont.className} mt-2 space-y-3 text-center text-[12px] leading-relaxed text-slate-700 sm:text-[13px] sm:text-center`}>
              <p>
                Mediante este nuevo material descubierto por Leo, podés reconstruir parte de tu alma.
              </p>
              <p>
                Este procedimiento, te devuelve todos los Skill Points gastados para que puedas asignarlos a gusto
                nuevamente.
              </p>
            </div>
            <p
              className={`${dialogueFont.className} mt-12 text-center text-[12px] font-semibold leading-relaxed text-slate-800 sm:text-[13px]`}
            >
              Coste para reconstruir una parte de tu alma:
            </p>
            <div className="mt-4 flex flex-wrap items-start justify-center gap-10 sm:gap-14">
              <div className="flex flex-col items-center gap-2">
                <Image
                  src={SOUL_FRAGMENT_ICON_SRC}
                  alt="Fragmento de alma"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain drop-shadow-sm"
                />
                <span
                  className={`${uiFont.className} text-sm font-bold tabular-nums sm:text-base ${
                    soulEnough ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {soulFragmentOwned}/{RECONSTRUCT_SOUL_FRAGMENT_COST}
                </span>
              </div>
            </div>
            {!hasInventorySpaceForReconstruct ? (
              <p
                className={`${dialogueFont.className} mt-4 text-center text-[11px] leading-relaxed text-red-900 sm:text-[11px]`}
              >
                (Tenés que tener espacio en tu inventario para depositar tus items equipados)
              </p>
            ) : null}
            {actionError && view === "reconstruction" ? (
              <p
                className={`${dialogueFont.className} mt-3 text-center text-[11px] leading-relaxed text-red-800 sm:text-xs`}
              >
                {actionError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                disabled={!canReconstructSoul}
                onClick={() => handleReconstructSoul()}
                className={`${uiFont.className} rounded-lg border px-6 py-2.5 text-xs font-bold uppercase tracking-wide shadow-sm transition-colors ${
                  canReconstructSoul
                    ? "cursor-pointer border-[#7a5c31]/80 bg-[#7d6138] text-[#fdfbf7] hover:bg-[#6e5532] active:bg-[#5f482b]"
                    : "cursor-not-allowed border-slate-500/70 bg-slate-500/60 text-slate-200/80"
                }`}
              >
                {isReconstructPending ? "Procesando..." : "Reconstruir Alma"}
              </button>
            </div>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setView("menu");
                }}
                className={`${uiFont.className} inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900 transition hover:text-amber-800`}
              >
                <span className="text-base leading-none" aria-hidden>
                  ←
                </span>
                Volver
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
              Renacimiento
            </h2>
            <div
              className={`${dialogueFont.className} mt-2 space-y-3 text-center text-[12px] leading-relaxed text-slate-700 sm:text-[13px]`}
            >
              <p>
                El proceso de Renacimiento es más complicado y peligroso. Leo aún lo está perfeccionando, por lo tanto,
                requiere muchos Fragmentos de Alma para asegurarse de no comprometer al individuo en el ritual.
              </p>
              <p>
                Este procedimiento remueve tu clase de la fábrica de la realidad, permitiéndote especializarte en otra
                rama de habilidades.
              </p>
            <p className={`${dialogueFont.className} mt-1 text-[11px] leading-relaxed text-amber-950 sm:text-xs`}>
              <i>"Vivir solo cuesta vida."</i>
            </p>
            </div>
            <p
              className={`${dialogueFont.className} mt-8 text-center text-[12px] font-semibold leading-relaxed text-slate-800 sm:text-[13px]`}
            >
              Coste de Renacimiento:
            </p>
            <div className="mt-4 flex flex-wrap items-start justify-center gap-10 sm:gap-14">
              <div className="flex flex-col items-center gap-2">
                <Image
                  src={SOUL_FRAGMENT_ICON_SRC}
                  alt="Fragmento de alma"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain drop-shadow-sm"
                />
                <span
                  className={`${uiFont.className} text-sm font-bold tabular-nums sm:text-base ${
                    soulEnoughForRebirth ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {soulFragmentOwned}/{REBIRTH_SOUL_FRAGMENT_COST}
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Image
                  src={GOLD_ICON_SRC}
                  alt="Oro"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain drop-shadow-sm"
                />
                <span
                  className={`${uiFont.className} text-sm font-bold tabular-nums sm:text-base ${
                    goldEnoughForRebirth ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {goldOwned}/{REBIRTH_SOUL_GOLD_COST}
                </span>
              </div>
            </div>
            {!hasInventorySpaceForReconstruct ? (
              <p
                className={`${dialogueFont.className} mt-4 text-center text-[11px] leading-relaxed text-red-900 sm:text-[11px]`}
              >
                (Tenés que tener espacio en tu inventario para depositar tus items equipados)
              </p>
            ) : null}
            {actionError && view === "rebirth" ? (
              <p
                className={`${dialogueFont.className} mt-3 text-center text-[11px] leading-relaxed text-red-800 sm:text-xs`}
              >
                {actionError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                disabled={!canRenacer}
                onClick={() => handleRebirth()}
                className={`${uiFont.className} rounded-lg border px-6 py-2.5 text-xs font-bold uppercase tracking-wide shadow-sm transition-colors ${
                  canRenacer
                    ? "cursor-pointer border-[#7a5c31]/80 bg-[#7d6138] text-[#fdfbf7] hover:bg-[#6e5532] active:bg-[#5f482b]"
                    : "cursor-not-allowed border-slate-500/70 bg-slate-500/60 text-slate-200/80"
                }`}
              >
                {isRebirthPending ? "Procesando..." : "Renacer"}
              </button>
            </div>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setView("menu");
                }}
                className={`${uiFont.className} inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900 transition hover:text-amber-800`}
              >
                <span className="text-base leading-none" aria-hidden>
                  ←
                </span>
                Volver
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
