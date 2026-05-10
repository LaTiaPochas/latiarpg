/**
 * Placeholders estilo `{INT*0.1}` en descripciones de habilidades (tooltip).
 * Misma idea que el escalado de skills: floor(max(0, valorStat) × ratio).
 */
export type AbilityTooltipStatGetter = (statKeyUpper: string) => number;

const STAT_TIMES_RATIO_SOURCE =
  /\{\s*([A-Za-z_][A-Za-z0-9_]*)(?:\s*\*\s*([+-]?[\d.]+(?:[eE][+-]?\d+)?))?\s*\}/.source;

function statTimesRatioRe(): RegExp {
  return new RegExp(STAT_TIMES_RATIO_SOURCE, "g");
}

function statExpressionFloorBonus(
  statRaw: string,
  ratioRaw: string | undefined,
  getStat: AbilityTooltipStatGetter,
): number {
  const statLabel = String(statRaw).trim().toUpperCase();
  const ratio =
    ratioRaw !== undefined && String(ratioRaw).trim() !== ""
      ? Number(String(ratioRaw).trim())
      : 1;
  if (!Number.isFinite(ratio)) return 0;
  const base = Math.max(0, Math.trunc(getStat(statLabel)));
  return Math.floor(base * ratio);
}

export function formatAbilityTooltipStatExpressions(
  description: string,
  getStat: AbilityTooltipStatGetter,
): string {
  return description.replace(
    statTimesRatioRe(),
    (_whole, statRaw: string, ratioRaw: string | undefined) =>
      String(statExpressionFloorBonus(statRaw, ratioRaw, getStat)),
  );
}

/** Suma de todos los `{STAT*ratio}` en el texto (cada ocurrencia suma igual que el reemplazo en tooltip). */
export function sumAbilityDescriptionStatExpressionBonuses(
  description: string,
  getStat: AbilityTooltipStatGetter,
): number {
  let sum = 0;
  for (const m of description.matchAll(statTimesRatioRe())) {
    sum += statExpressionFloorBonus(m[1], m[2], getStat);
  }
  return sum;
}

/**
 * Rango «Daño» del tooltip: base (min/max ya con escalado JSON) + bonus acumulado de `{…}` en la descripción.
 * Muestra el resultado ya sumado (ej. `13–18`).
 */
export function formatAbilityTooltipTotalDamageRange(
  baseMin: number,
  baseMax: number,
  descriptionPlaceholdersBonus: number,
): string {
  const b = Math.trunc(descriptionPlaceholdersBonus);
  const loRaw = Math.trunc(baseMin) + b;
  const hiRaw = Math.trunc(baseMax) + b;
  const lo = Math.max(0, loRaw);
  const hi = Math.max(lo, hiRaw);
  return `${lo}–${hi}`;
}

/** Stats de ficha (perfil): sin buffs temporales de combate. */
export type AbilityTooltipSheetSnapshot = {
  str: number;
  dex: number;
  int: number;
  wis: number;
  weaponDamageMin: number;
  weaponDamageMax: number;
  magicDamageMin: number;
  magicDamageMax: number;
};

export function abilityTooltipStatGetterFromSheet(stats: AbilityTooltipSheetSnapshot): AbilityTooltipStatGetter {
  return (key: string): number => {
    const k = key.toUpperCase();
    switch (k) {
      case "STR":
        return Math.max(0, Math.floor(stats.str));
      case "DEX":
        return Math.max(0, Math.floor(stats.dex));
      case "INT":
        return Math.max(0, Math.floor(stats.int));
      case "WIS":
        return Math.max(0, Math.floor(stats.wis));
      case "ATTACK_DAMAGE":
      case "WEAPON_DAMAGE": {
        const wmin = Math.max(1, Math.floor(stats.weaponDamageMin));
        const wmax = Math.max(wmin, Math.floor(stats.weaponDamageMax));
        return Math.floor((wmin + wmax) / 2);
      }
      case "MAGIC_DAMAGE": {
        const mmin = Math.max(0, Math.floor(stats.magicDamageMin));
        const mmax = Math.max(mmin, Math.floor(stats.magicDamageMax));
        return Math.floor((mmin + mmax) / 2);
      }
      default:
        return 0;
    }
  };
}

/** Tooltip en combate: arma/magia ya incluyen buffs aplicables al cálculo de daño del PJ. */
export type AbilityTooltipCombatSnapshot = {
  str: number;
  dex: number;
  int: number;
  wis: number;
  /** Daño arma efectivo en combate (base + weapon_damage_* de buff). */
  weaponDamageMinEffective: number;
  weaponDamageMaxEffective: number;
  /** magic_damage_* de ficha antes del flat concatenado por tiro… */
  magicDamageMinSheet: number;
  magicDamageMaxSheet: number;
  /** Buffs temporales mágicos (mismo uso que MAGIC_DAMAGE en combate). */
  magicCombatMinBonus: number;
  magicCombatMaxBonus: number;
};

export function abilityTooltipStatGetterFromCombat(snapshot: AbilityTooltipCombatSnapshot): AbilityTooltipStatGetter {
  return (key: string): number => {
    const k = key.toUpperCase();
    switch (k) {
      case "STR":
        return Math.max(0, Math.floor(snapshot.str));
      case "DEX":
        return Math.max(0, Math.floor(snapshot.dex));
      case "INT":
        return Math.max(0, Math.floor(snapshot.int));
      case "WIS":
        return Math.max(0, Math.floor(snapshot.wis));
      case "ATTACK_DAMAGE":
      case "WEAPON_DAMAGE": {
        const wmin = Math.max(
          1,
          Math.floor(snapshot.weaponDamageMinEffective),
        );
        const wmax = Math.max(wmin, Math.floor(snapshot.weaponDamageMaxEffective));
        return Math.floor((wmin + wmax) / 2);
      }
      case "MAGIC_DAMAGE": {
        const mmin = Math.max(
          0,
          Math.floor(snapshot.magicDamageMinSheet + snapshot.magicCombatMinBonus),
        );
        const mmax = Math.max(
          mmin,
          Math.floor(snapshot.magicDamageMaxSheet + snapshot.magicCombatMaxBonus),
        );
        return Math.floor((mmin + mmax) / 2);
      }
      default:
        return 0;
    }
  };
}
