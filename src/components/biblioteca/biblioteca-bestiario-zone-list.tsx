"use client";

import type { BibliotecaBestiarioZoneGroup } from "@/lib/biblioteca-bestiario-zones";

const zoneButtonClassName =
  "w-full cursor-pointer rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b]";

type BibliotecaBestiarioZoneListProps = {
  zoneGroups: BibliotecaBestiarioZoneGroup[];
  onSelectZoneGroup?: (group: BibliotecaBestiarioZoneGroup) => void;
  uiFontClassName?: string;
};

export function BibliotecaBestiarioZoneList({
  zoneGroups,
  onSelectZoneGroup,
  uiFontClassName = "",
}: BibliotecaBestiarioZoneListProps) {
  if (zoneGroups.length === 0) {
    return (
      <p className={`mt-4 text-xs font-semibold text-slate-700 ${uiFontClassName}`}>
        Todavía no hay zonas descubiertas para el bestiario.
      </p>
    );
  }

  return (
    <div className={`mx-auto mt-4 flex w-full max-w-xs flex-col gap-3 ${uiFontClassName}`}>
      {zoneGroups.map((group) => (
        <button
          key={`zone-order-${group.zoneOrder}`}
          type="button"
          className={zoneButtonClassName}
          onClick={() => onSelectZoneGroup?.(group)}
        >
          {group.label}
        </button>
      ))}
    </div>
  );
}
