"use client";

import Image from "next/image";

export type CombatAtbTimelineEntry = {
  id: string;
  label: string;
  portraitSrc: string | null;
  isPlayer: boolean;
  isCurrent: boolean;
  gauge: number;
};

type CombatAtbTimelineProps = {
  entries: CombatAtbTimelineEntry[];
  className?: string;
};

function TimelinePortrait({
  entry,
  positionIndex,
}: {
  entry: CombatAtbTimelineEntry;
  positionIndex: number;
}) {
  const slotOffset = `${positionIndex * 2.85}rem`;

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-500 ease-out"
      style={{ left: slotOffset }}
      title={entry.label}
    >
      <div
        className={`relative h-9 w-9 overflow-hidden rounded-full border-2 bg-black/60 shadow-md sm:h-10 sm:w-10 ${
          entry.isPlayer
            ? `border-emerald-400/95 ${entry.isCurrent ? "shadow-[0_0_12px_rgba(52,211,153,0.65)]" : ""}`
            : `border-red-500/95 ${entry.isCurrent ? "shadow-[0_0_12px_rgba(239,68,68,0.55)]" : ""}`
        }`}
      >
        {entry.portraitSrc ? (
          <Image src={entry.portraitSrc} alt="" fill className="object-cover" sizes="40px" />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center text-xs font-bold ${
              entry.isPlayer ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {entry.label.slice(0, 1).toUpperCase()}
          </span>
        )}
        {entry.isCurrent ? (
          <span
            className={`pointer-events-none absolute -bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.85)] ${
              entry.isPlayer ? "bg-emerald-300" : "bg-red-400"
            }`}
          />
        ) : null}
      </div>
    </div>
  );
}

export function CombatAtbTimeline({ entries, className = "" }: CombatAtbTimelineProps) {
  const trackContentRem = Math.max(1, entries.length) * 2.85 + 2.5;
  const trackWidthRem = trackContentRem + 1; // px-2 en la barra
  const trackWidth = `${trackContentRem}rem`;
  const componentWidth = `${trackWidthRem}rem`;

  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 ${className}`}
      style={{ width: "100%", maxWidth: `min(100%, ${componentWidth})` }}
      aria-label="Orden de turno"
    >
      <span className="text-center text-[8px] font-semibold uppercase leading-none tracking-[0.14em] text-amber-400/85 sm:text-[9px] sm:tracking-[0.18em]">
        Orden de turno
      </span>
      <div
        className="relative h-10 w-full overflow-hidden rounded-lg border border-amber-800/55 bg-[#120a08]/85 px-2 sm:h-11"
      >
        <div className="relative h-full" style={{ minWidth: trackWidth }}>
          <div
            className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-amber-600/50 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute left-1 top-1/2 z-10 h-2 w-2 -translate-y-1/2 rounded-full border border-amber-400/70 bg-amber-500/40"
            aria-hidden
            title="Siguiente"
          />
          {entries.map((entry, index) => (
            <TimelinePortrait key={`${entry.id}:${index}`} entry={entry} positionIndex={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

