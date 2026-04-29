"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type StatItem = {
  label: "STR" | "DEX" | "INT" | "WIS";
  value: number;
};

type TooltipState = {
  label: StatItem["label"];
  x: number;
  y: number;
} | null;

const statDescriptions: Record<StatItem["label"], string> = {
  STR: "Fuerza. Aumenta la vida maxima y el daño con armas físicas.",
  DEX: "Destreza. Mejora la velocidad, la armadura y el daño con armas de fineza.",
  INT: "Inteligencia. Incrementa el maná máximo y el daño con hechizos.",
  WIS: "Sabiduria. Aumenta la resistencia magica, el poder de hechizos y el aprendizaje arcano.",
};

export function StatsPanel({
  stats,
  statPointsRemaining,
  onConfirm,
}: {
  stats: StatItem[];
  statPointsRemaining: number;
  onConfirm: (payload: {
    str: number;
    dex: number;
    int: number;
    wis: number;
  }) => Promise<void>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [internalPointsCounter, setInternalPointsCounter] =
    useState(statPointsRemaining);
  const [pendingAllocations, setPendingAllocations] = useState<
    Record<StatItem["label"], number>
  >({
    STR: 0,
    DEX: 0,
    INT: 0,
    WIS: 0,
  });

  function openTooltip(
    event: React.MouseEvent<HTMLButtonElement>,
    label: StatItem["label"],
  ) {
    setTooltip({
      label,
      x: event.clientX + 12,
      y: event.clientY + 12,
    });
  }

  function addPoint(label: StatItem["label"]) {
    if (internalPointsCounter <= 0) {
      return;
    }

    setInternalPointsCounter((previous) => previous - 1);
    setPendingAllocations((previous) => ({
      ...previous,
      [label]: previous[label] + 1,
    }));
  }

  function removePoint(label: StatItem["label"]) {
    if (pendingAllocations[label] <= 0) {
      return;
    }

    setInternalPointsCounter((previous) => previous + 1);
    setPendingAllocations((previous) => ({
      ...previous,
      [label]: previous[label] - 1,
    }));
  }

  const hasPendingChanges =
    statPointsRemaining > 0 && internalPointsCounter !== statPointsRemaining;

  const pointsToSpend =
    pendingAllocations.STR +
    pendingAllocations.DEX +
    pendingAllocations.INT +
    pendingAllocations.WIS;

  function handleConfirm() {
    if (!hasPendingChanges || pointsToSpend <= 0) {
      return;
    }

    startTransition(() => {
      onConfirm({
        str: pendingAllocations.STR,
        dex: pendingAllocations.DEX,
        int: pendingAllocations.INT,
        wis: pendingAllocations.WIS,
      }).then(() => {
        router.refresh();
      });
    });
  }

  return (
    <>
      {statPointsRemaining > 0 ? (
        <div className="mt-3 rounded-md border border-emerald-600/60 bg-emerald-900/30 px-3 py-2 text-sm font-regular text-emerald-200">
          ¡Tenés {internalPointsCounter} puntos disponibles para utilizar!
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between rounded-md border border-amber-900/60 bg-[#1f120e]/90 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/70">
                {stat.label}
              </p>
              <button
                type="button"
                onClick={(event) => openTooltip(event, stat.label)}
                className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-amber-300/70 text-[10px] font-bold text-amber-200 transition hover:bg-amber-400/20"
                aria-label={`Info de ${stat.label}`}
              >
                ?
              </button>
            </div>
            <div className="flex items-center gap-2">
              <p className="w-8 text-center text-lg font-bold leading-none text-amber-200">
                {stat.value + pendingAllocations[stat.label]}
              </p>
              <button
                type="button"
                onClick={() => removePoint(stat.label)}
                disabled={pendingAllocations[stat.label] <= 0}
                aria-disabled={pendingAllocations[stat.label] <= 0}
                className={`flex h-5 w-5 items-center justify-center rounded border text-xs font-bold ${
                  pendingAllocations[stat.label] > 0
                    ? "cursor-pointer border-amber-500/70 bg-amber-900/40 text-amber-100 hover:bg-amber-800/60"
                    : "cursor-not-allowed border-amber-900/80 bg-[#120a08] text-amber-200/35"
                }`}
              >
                -
              </button>
              <button
                type="button"
                onClick={() => addPoint(stat.label)}
                disabled={internalPointsCounter <= 0}
                aria-disabled={internalPointsCounter <= 0}
                className={`flex h-5 w-5 items-center justify-center rounded border text-xs font-bold ${
                  internalPointsCounter > 0
                    ? "cursor-pointer border-amber-500/70 bg-amber-900/40 text-amber-100 hover:bg-amber-800/60"
                    : "cursor-not-allowed border-amber-900/80 bg-[#120a08] text-amber-200/35"
                }`}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {hasPendingChanges ? (
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          className={`mt-4 w-full rounded-md border border-emerald-700/80 bg-emerald-800 px-3 py-2 text-sm font-bold text-emerald-100 transition ${
            isPending
              ? "cursor-wait opacity-80"
              : "cursor-pointer hover:bg-emerald-700"
          }`}
        >
          {isPending ? "Guardando..." : "Confirmar subida de nivel"}
        </button>
      ) : null}

      {tooltip ? (
        <div
          className="fixed z-50 w-64 rounded-lg border border-amber-700/70 bg-[#25140f] p-3 text-sm text-amber-50 shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              {tooltip.label}
            </p>
            <button
              type="button"
              onClick={() => setTooltip(null)}
              className="cursor-pointer text-xs text-amber-200/80 hover:text-amber-100"
            >
              Cerrar
            </button>
          </div>
          <p className="mt-2 leading-relaxed text-amber-50/90">
            {statDescriptions[tooltip.label]}
          </p>
        </div>
      ) : null}
    </>
  );
}
