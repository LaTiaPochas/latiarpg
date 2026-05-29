"use client";

import Image from "next/image";
import { Montserrat } from "next/font/google";

import type { SoulGauntletGrantedRewardView } from "@/lib/soul-gauntlet-rewards";

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

type SoulGauntletRunResultDialogProps = {
  floor: number;
  rewardTierLabel: string;
  granted: SoulGauntletGrantedRewardView[];
  inventoryError: string | null;
  completed?: boolean;
  onClose: () => void;
};

export function SoulGauntletRunResultDialog({
  floor,
  rewardTierLabel,
  granted,
  inventoryError,
  completed = false,
  onClose,
}: SoulGauntletRunResultDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gauntlet-run-result-title"
        className={`${uiFont.className} w-full max-w-md rounded-xl border border-amber-700/80 bg-[#1a100c]/97 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.65)] sm:p-5`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="gauntlet-run-result-title"
          className="text-center text-sm font-bold uppercase tracking-wide text-amber-200 sm:text-base"
        >
          {completed ? "¡Felicitaciones!" : "Recompensas"}
        </h2>
        <p className="mt-2 text-center text-xs text-amber-100/90 sm:text-sm">
          {completed ? (
            <>
              Completaste el piso{" "}
              <span className="font-bold text-amber-50">{floor}</span> del Soul Pit Gauntlet.
            </>
          ) : (
            <>
              Caíste en el piso: <span className="font-bold text-amber-50">{floor}</span>
            </>
          )}
        </p>
        <p className="mt-1 text-center text-[11px] text-amber-200/80">{rewardTierLabel}</p>

        {inventoryError ? (
          <p className="mt-4 rounded-md border border-red-600/70 bg-red-950/40 px-3 py-2 text-center text-xs font-semibold text-red-100">
            {inventoryError}
          </p>
        ) : null}

        <ul className="mt-4 space-y-2">
          {granted.length > 0 ? (
            granted.map((item) => (
              <li
                key={`${item.itemId}-${item.quantity}`}
                className="flex items-center gap-3 rounded-lg border border-amber-800/50 bg-black/25 px-3 py-2"
              >
                <div className="relative h-10 w-10 shrink-0">
                  <Image
                    src={item.iconPath}
                    alt={item.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p
                    className="truncate text-xs font-semibold sm:text-sm"
                    style={item.rarityColor ? { color: item.rarityColor } : { color: "#fef3c7" }}
                  >
                    {item.name}
                  </p>
                  <p className="text-[11px] text-amber-200/80">x{item.quantity}</p>
                </div>
              </li>
            ))
          ) : (
            <li className="rounded-lg border border-amber-900/40 bg-black/20 px-3 py-3 text-center text-xs text-amber-200/75">
              No hay recompensas configuradas para este piso y tipo de partida.
            </li>
          )}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg border border-amber-600/80 bg-gradient-to-b from-amber-700 to-amber-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-amber-50 shadow-sm transition hover:from-amber-600 hover:to-amber-800"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
