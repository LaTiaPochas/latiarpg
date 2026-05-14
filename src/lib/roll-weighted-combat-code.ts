/**
 * Elige un código de combate según `chance` en cada entrada.
 * - Si las `chance` suman ~1, son probabilidades.
 * - Si no suman 1, se tratan como pesos relativos (se normalizan por la suma).
 * Ignora `chance` no finitos o ≤ 0.
 */
export function rollWeightedCombatCode<T extends { combatCode: string; chance: number }>(
  entries: readonly T[],
  fallback: string,
): string {
  if (entries.length === 0) return fallback;

  let sum = 0;
  const sanitized: { row: T; w: number }[] = [];
  for (const row of entries) {
    const w =
      typeof row.chance === "number" && Number.isFinite(row.chance) && row.chance > 0 ? row.chance : 0;
    sanitized.push({ row, w });
    sum += w;
  }

  if (!(sum > 0)) {
    const last = entries[entries.length - 1];
    return last?.combatCode ?? fallback;
  }

  let u = Math.random() * sum;
  for (const { row, w } of sanitized) {
    if (w <= 0) continue;
    u -= w;
    if (u < 0) return row.combatCode;
  }

  return entries[entries.length - 1]?.combatCode ?? fallback;
}
