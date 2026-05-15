export type AbilityScalingStatGetter = (statKeyUpper: string) => number;

function coerceScalingNumber(val: unknown, fallback: number): number {
  if (typeof val === "number" && Number.isFinite(val)) return Math.trunc(val);
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return fallback;
}

function scalingRatioParsed(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

const SCALING_STAT_KEYS = ["STR", "DEX", "INT", "WIS", "LEVEL"] as const;

/**
 * Una línea de `scaling` / `modifiers`:
 * - `Fixed` → `floor(amount)`
 * - `STR|DEX|INT|WIS|LEVEL` → `floor(amount + stat × ratio)`
 */
export function abilityEffectScalingLineValue(
  entry: unknown,
  getCombatStatValue: AbilityScalingStatGetter,
): number {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return 0;
  const o = entry as Record<string, unknown>;
  const statRaw = typeof o.stat === "string" ? o.stat.trim() : "";
  if (statRaw === "") return 0;
  const upper = statRaw.toUpperCase();
  const amount = coerceScalingNumber(o.amount, 0);
  const ratio = scalingRatioParsed(o.ratio);

  if (upper === "FIXED") {
    return Math.max(0, Math.floor(amount));
  }
  if ((SCALING_STAT_KEYS as readonly string[]).includes(upper)) {
    const fromStat = Math.max(0, getCombatStatValue(upper)) * ratio;
    return Math.max(0, Math.floor(amount + fromStat));
  }
  return 0;
}

/** Suma líneas de `scaling` (array, objeto único o null). */
export function sumAbilityEffectScalingTotals(
  scalingRaw: unknown,
  getCombatStatValue: AbilityScalingStatGetter,
): number {
  if (scalingRaw == null) return 0;
  if (Array.isArray(scalingRaw)) {
    return scalingRaw.reduce(
      (sum, item) => sum + abilityEffectScalingLineValue(item, getCombatStatValue),
      0,
    );
  }
  if (typeof scalingRaw === "object") {
    return abilityEffectScalingLineValue(scalingRaw, getCombatStatValue);
  }
  return 0;
}

/** Total de escalado para `{amount}` en buffs (raíz `scaling` o `modifiers` en `scalings`). */
export function sumPlayerSelfBuffScalingFromEffect(
  effect: Record<string, unknown>,
  getCombatStatValue: AbilityScalingStatGetter,
): number {
  const scalingsRaw = effect.scalings;
  if (
    scalingsRaw != null &&
    typeof scalingsRaw === "object" &&
    !Array.isArray(scalingsRaw) &&
    Object.keys(scalingsRaw as object).length > 0
  ) {
    const scalings = scalingsRaw as Record<string, unknown>;
    let total = 0;
    const keys = Object.keys(scalings).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const key of keys) {
      const entry = scalings[key];
      if (entry == null || typeof entry !== "object" || Array.isArray(entry)) continue;
      const rec = entry as Record<string, unknown>;
      const modifiersRaw = rec.modifiers ?? rec.modifier ?? rec.scaling;
      total += sumAbilityEffectScalingTotals(modifiersRaw, getCombatStatValue);
    }
    return Math.trunc(total);
  }
  return Math.trunc(sumAbilityEffectScalingTotals(effect.scaling, getCombatStatValue));
}
