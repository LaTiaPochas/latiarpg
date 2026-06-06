"use client";

import { useState } from "react";

import { BibliotecaMemberFaceIcon } from "@/components/biblioteca/biblioteca-member-face-icon";
import {
  COMBAT_STAT_COLUMNS,
  getCombatStatTopMembers,
  type BibliotecaCombatMemberRow,
  type BibliotecaCombatStatKey,
  type BibliotecaCombatStatTopEntry,
} from "@/lib/biblioteca-user-stats";

type BibliotecaCombatStatsGridProps = {
  members: BibliotecaCombatMemberRow[];
  uiFontClassName?: string;
};

type CombatStatFlipCardProps = {
  label: string;
  statKey: BibliotecaCombatStatKey;
  members: BibliotecaCombatMemberRow[];
  isFlipped: boolean;
  onToggle: () => void;
  uiFontClassName: string;
};

function CombatStatFaceContent({
  label,
  leader,
  uiFontClassName,
}: {
  label: string;
  leader: BibliotecaCombatStatTopEntry | undefined;
  uiFontClassName: string;
}) {
  return (
    <>
      <p
        className={`text-center text-[9px] font-bold leading-tight text-slate-900 sm:text-[10px] ${uiFontClassName}`}
      >
        {label}
      </p>
      {leader ? (
        <>
          <BibliotecaMemberFaceIcon
            miembro={leader.memberName}
            faceSrc={leader.memberFaceSrc}
          />
          <p
            className={`biblioteca-stat-column-max text-center text-base tabular-nums sm:text-lg ${uiFontClassName}`}
          >
            {leader.value}
          </p>
        </>
      ) : (
        <p className={`text-center text-sm font-semibold text-slate-600 ${uiFontClassName}`}>—</p>
      )}
    </>
  );
}

function CombatStatBackContent({
  label,
  entries,
  uiFontClassName,
}: {
  label: string;
  entries: BibliotecaCombatStatTopEntry[];
  uiFontClassName: string;
}) {
  return (
    <>
      <p
        className={`w-full text-center text-[8px] font-bold leading-tight text-slate-900 sm:text-[9px] ${uiFontClassName}`}
      >
        {label}
      </p>
      {entries.length === 0 ? (
        <p className={`text-center text-[10px] font-semibold text-slate-700 ${uiFontClassName}`}>
          Sin datos
        </p>
      ) : (
        <ul className={`flex w-full flex-col gap-1 ${uiFontClassName}`}>
          {entries.map((entry) => (
            <li
              key={entry.userId}
              className="flex items-center justify-center gap-1.5 rounded border border-[#9f8352]/40 bg-[#f0e6cf]/80 px-1 py-0.5"
            >
              <BibliotecaMemberFaceIcon
                miembro={entry.memberName}
                faceSrc={entry.memberFaceSrc}
                className="h-6 w-6 shrink-0 rounded-full border border-[#7a5c31]/50 object-cover shadow-sm"
              />
              <span
                className={`min-w-0 flex-1 truncate text-left text-[10px] font-semibold text-slate-800 ${uiFontClassName}`}
              >
                {entry.memberName}
              </span>
              <span
                className={`shrink-0 text-xs font-bold tabular-nums ${
                  entry.rank === 1 ? "biblioteca-stat-column-max" : "text-slate-800"
                } ${uiFontClassName}`}
              >
                {entry.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CombatStatFlipCard({
  label,
  statKey,
  members,
  isFlipped,
  onToggle,
  uiFontClassName,
}: CombatStatFlipCardProps) {
  const topEntries = getCombatStatTopMembers(members, statKey);
  const leader = topEntries[0];

  return (
    <button
      type="button"
      className="biblioteca-flip-card"
      aria-pressed={isFlipped}
      aria-label={`${label}. ${isFlipped ? "Mostrar líder" : "Ver top 5"}`}
      onClick={onToggle}
    >
      <div className={`biblioteca-flip-card-inner ${isFlipped ? "is-flipped" : ""}`}>
        <div className="biblioteca-flip-face">
          <CombatStatFaceContent
            label={label}
            leader={leader}
            uiFontClassName={uiFontClassName}
          />
        </div>
        <div className="biblioteca-flip-face biblioteca-flip-back biblioteca-parchment-scrollbar">
          <CombatStatBackContent
            label={label}
            entries={topEntries}
            uiFontClassName={uiFontClassName}
          />
        </div>
      </div>
    </button>
  );
}

export function BibliotecaCombatStatsGrid({
  members,
  uiFontClassName = "",
}: BibliotecaCombatStatsGridProps) {
  const [flippedStatKey, setFlippedStatKey] = useState<BibliotecaCombatStatKey | null>(null);

  if (members.length === 0) {
    return (
      <p className={`mt-4 text-xs font-semibold text-slate-700 ${uiFontClassName}`}>
        Todavía no hay estadísticas de combate registradas.
      </p>
    );
  }

  const visibleColumns = COMBAT_STAT_COLUMNS.filter(
    (column) => getCombatStatTopMembers(members, column.key).length > 0,
  );

  if (visibleColumns.length === 0) {
    return (
      <p className={`mt-4 text-xs font-semibold text-slate-700 ${uiFontClassName}`}>
        Todavía no hay récords de combate para mostrar.
      </p>
    );
  }

  return (
    <div className="biblioteca-parchment-scrollbar mt-4 max-h-[min(52vh,420px)] overflow-auto pr-1">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {visibleColumns.map((column) => (
          <CombatStatFlipCard
            key={column.key}
            statKey={column.key}
            label={column.label}
            members={members}
            isFlipped={flippedStatKey === column.key}
            onToggle={() =>
              setFlippedStatKey((current) => (current === column.key ? null : column.key))
            }
            uiFontClassName={uiFontClassName}
          />
        ))}
      </div>
    </div>
  );
}
