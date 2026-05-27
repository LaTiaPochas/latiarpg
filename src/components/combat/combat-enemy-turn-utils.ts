import type { EnemyAppliedPlayerTimedModifier } from "@/components/combat/combat-timed-effect-types";

/** Rolado inclusivo entre dos enteros (acepta min y max invertidos). */
export function randomIntInclusive(minValue: number, maxValue: number): number {
  const lo = Math.trunc(minValue);
  const hi = Math.trunc(maxValue);
  const safeMin = Math.min(lo, hi);
  const safeMax = Math.max(lo, hi);
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

export function enemySkillCombatLogHadDamagePlaceholder(template: string): boolean {
  return (
    template.includes("{daño}") ||
    template.includes("{dano}") ||
    template.includes("{damage}")
  );
}

export function formatEnemySkillCombatLogDescription(
  template: string,
  damageDealt: number,
  attackerEnemyName: string,
  damageTypes: string[] = [],
  targetName = "",
): string {
  const s = String(Math.max(0, Math.trunc(damageDealt)));
  const enemyLabel =
    typeof attackerEnemyName === "string" && attackerEnemyName.trim().length > 0
      ? attackerEnemyName.trim()
      : "";
  const targetLabel =
    typeof targetName === "string" && targetName.trim().length > 0 ? targetName.trim() : enemyLabel;
  const damageTypeLabel = damageTypes.join(", ");
  return template
    .replaceAll("{daño}", s)
    .replaceAll("{dano}", s)
    .replaceAll("{damage}", s)
    .replaceAll("{enemigo}", enemyLabel)
    .replaceAll("{objetivo}", targetLabel)
    .replaceAll("{target}", targetLabel)
    .replaceAll("{damage_type}", damageTypeLabel)
    .replaceAll("{damage_types}", damageTypeLabel);
}

function dedupeNormalizedTagStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const n = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function mergePlayerResistWeakForIncoming(
  baseRes: string[],
  baseWeak: string[],
  timedMods: EnemyAppliedPlayerTimedModifier[],
): { resistances: string[]; weaknesses: string[] } {
  const resistances = dedupeNormalizedTagStrings([
    ...baseRes,
    ...timedMods.flatMap((m) => m.extraResistanceTags),
  ]);
  const weaknesses = dedupeNormalizedTagStrings([
    ...baseWeak,
    ...timedMods.flatMap((m) => m.extraWeaknessTags),
  ]);
  return { resistances, weaknesses };
}
