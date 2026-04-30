"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

type MilestoneCompletePanelProps = {
  completedAtIso?: string | null;
};

function formatRemainingTime(totalMs: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function MilestoneCompletePanel({ completedAtIso }: MilestoneCompletePanelProps) {
  const countdownStartMs = useMemo(() => {
    const parsed = completedAtIso ? Date.parse(completedAtIso) : NaN;
    return Number.isFinite(parsed) ? parsed : Date.now();
  }, [completedAtIso]);
  const [remainingMs, setRemainingMs] = useState(() => {
    const endMs = countdownStartMs + SIX_HOURS_MS;
    return Math.max(0, endMs - Date.now());
  });

  useEffect(() => {
    const tick = () => {
      const endMs = countdownStartMs + SIX_HOURS_MS;
      setRemainingMs(Math.max(0, endMs - Date.now()));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [countdownStartMs]);

  return (
    <>
      <p className="text-center text-sm leading-relaxed text-slate-800 lg:text-base">
        ¡Ya conseguimos la madera que necesitabamos! <br /> Ahora a construir.
      </p>
      <div className="mt-8 text-center">
        <p className="text-sm font-semibold text-slate-700 lg:text-base">La construcción finalizará en:</p>
        <p className="mt-2 text-2xl font-bold tracking-wider text-slate-900">{formatRemainingTime(remainingMs)}</p>
      </div>
      <div className="mt-8 flex justify-center">
        <Link
          href="/"
          className="rounded-lg border border-[#5f4f33]/80 bg-[#7a6642] px-6 py-2 text-sm font-bold tracking-wide text-[#f8f4eb] shadow-sm transition-colors hover:bg-[#6a5838] active:bg-[#5a4b31] lg:text-base"
        >
          Volver al Inicio
        </Link>
      </div>
    </>
  );
}
