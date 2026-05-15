"use client";

import { useState, useTransition } from "react";

type WoodAmountSelectorProps = {
  maxAmount: number;
  onContribute: (amount: number) => Promise<void>;
  materialName?: string;
};

export function WoodAmountSelector({
  maxAmount,
  onContribute,
  materialName = "madera",
}: WoodAmountSelectorProps) {
  const safeMaxAmount = Math.max(0, Math.trunc(maxAmount));
  const [amount, setAmount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const canDecrease = amount > 0;
  const canIncrease = amount < safeMaxAmount;
  const canSubmit = amount > 0 && !isPending;
  const setClampedAmount = (value: number) => {
    const next = Number.isFinite(value) ? Math.trunc(value) : 0;
    setAmount(Math.min(safeMaxAmount, Math.max(0, next)));
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setAmount((value) => Math.max(0, value - 1))}
          disabled={!canDecrease || isPending}
          className="cursor-pointer h-9 w-9 rounded-md border border-slate-500/80 bg-slate-700 text-lg font-bold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:border-slate-400/60 disabled:bg-slate-500/50 disabled:text-slate-300/70"
          aria-label={`Restar ${materialName} a aportar`}
        >
          -
        </button>
        <input
          type="number"
          min={0}
          max={safeMaxAmount}
          inputMode="numeric"
          value={amount}
          onChange={(event) => setClampedAmount(Number(event.target.value))}
          disabled={isPending || safeMaxAmount <= 0}
          className="h-9 w-20 rounded-md border border-slate-500/80 bg-[#f4ead2] text-center text-lg font-bold text-slate-900 shadow-inner outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-500/35 disabled:cursor-not-allowed disabled:bg-slate-300/60 disabled:text-slate-500"
          aria-label={`Cantidad de ${materialName} a aportar`}
        />
        <button
          type="button"
          onClick={() => setAmount((value) => Math.min(safeMaxAmount, value + 1))}
          disabled={!canIncrease || isPending}
          className="cursor-pointer h-9 w-9 rounded-md border border-slate-500/80 bg-slate-700 text-lg font-bold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:border-slate-400/60 disabled:bg-slate-500/50 disabled:text-slate-300/70"
          aria-label={`Sumar ${materialName} a aportar`}
        >
          +
        </button>
      </div>
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await onContribute(Math.min(amount, safeMaxAmount));
            })
          }
          disabled={!canSubmit}
          className="cursor-pointer rounded-lg border border-slate-500/80 bg-slate-700 px-8 py-2.5 text-sm font-bold tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-slate-600 active:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-500/70 disabled:bg-slate-500/60 disabled:text-slate-200/80 lg:text-base"
        >
          {isPending ? "APORTANDO..." : "APORTAR"}
        </button>
      </div>
    </div>
  );
}
