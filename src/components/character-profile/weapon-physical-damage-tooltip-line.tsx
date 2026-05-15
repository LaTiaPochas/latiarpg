"use client";

import { capitalizeFirstLetterOnly } from "@/components/character-profile/inventory-types";

/**
 * Tooltip de daño físico de arma: `4 - 10 Daño` y opcional ` · Fire` en cursiva y un poco más chico.
 */
export function WeaponPhysicalDamageTooltipLine({
  damageRangeText,
  attackFamily,
}: {
  damageRangeText: string;
  attackFamily?: string | null;
}) {
  const fam = attackFamily?.trim() ?? "";
  const displayFam = fam ? capitalizeFirstLetterOnly(fam) : "";
  return (
    <>
      {damageRangeText} Daño
      {displayFam ? (
        <span className="text-[0.85em] italic leading-snug text-inherit">{` · ${displayFam}`}</span>
      ) : null}
    </>
  );
}
