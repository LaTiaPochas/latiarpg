"use client";

import { useState, useTransition } from "react";

type WoodAmountSelectorProps = {
  maxAmount: number;
  onContribute: (amount: number) => Promise<void>;
};

export function WoodAmountSelector({ maxAmount, onContribute }: WoodAmountSelectorProps) {
  const [amount, setAmount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const canDecrease = amount > 0;
  const canIncrease = amount < maxAmount;
  const canSubmit = amount > 0 && !isPending;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setAmount((value) => Math.max(0, value - 1))}
          disabled={!canDecrease || isPending}
          className="h-9 w-9 rounded-md border border-slate-500/80 bg-slate-700 text-lg font-bold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:border-slate-400/60 disabled:bg-slate-500/50 disabled:text-slate-300/70"
          aria-label="Restar madera a aportar"
        >
          -
        </button>
        <div className="min-w-10 text-center text-lg font-bold text-slate-900">{amount}</div>
        <button
          type="button"
          onClick={() => setAmount((value) => Math.min(maxAmount, value + 1))}
          disabled={!canIncrease || isPending}
          className="h-9 w-9 rounded-md border border-slate-500/80 bg-slate-700 text-lg font-bold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:border-slate-400/60 disabled:bg-slate-500/50 disabled:text-slate-300/70"
          aria-label="Sumar madera a aportar"
        >
          +
        </button>
      </div>
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await onContribute(amount);
            })
          }
          disabled={!canSubmit}
          className="rounded-lg border border-[#7a5c31]/80 bg-[#9b7a46] px-8 py-2.5 text-sm font-bold tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#886a3d] active:bg-[#735932] disabled:cursor-not-allowed disabled:border-slate-500/70 disabled:bg-slate-500/60 disabled:text-slate-200/80 lg:text-base"
        >
          {isPending ? "APORTANDO..." : "APORTAR"}
        </button>
      </div>
    </div>
  );
}
