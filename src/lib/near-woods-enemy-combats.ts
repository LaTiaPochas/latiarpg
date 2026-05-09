export type NearWoodsEnemyCombatEntry = {
  /** Coincide con `combat_encounters.code` y segmento `/combate/[code]`. */
  combatCode: string;
  chance: number;
};

/** Ponderaciones al rodar encuentro tras resultado `enemy` (cercanías del bosque). Suman 1. */
export const NEAR_WOODS_ENEMY_COMBAT_WEIGHTS: NearWoodsEnemyCombatEntry[] = [
  { combatCode: "near-woods", chance: 0.35 },
  { combatCode: "near-woods2", chance: 0.35 },
  { combatCode: "near-woods3", chance: 0.2 },
  { combatCode: "near-woods4", chance: 0.1 },
];

/** Tirada según `chance` de cada entrada (suma debe ser 1). */
export function rollNearWoodsEnemyCombatCode(): string {
  const r = Math.random();
  let cumulative = 0;
  for (const row of NEAR_WOODS_ENEMY_COMBAT_WEIGHTS) {
    cumulative += row.chance;
    if (r < cumulative) return row.combatCode;
  }
  const list = NEAR_WOODS_ENEMY_COMBAT_WEIGHTS;
  const last = list[list.length - 1];
  return last?.combatCode ?? "near-woods";
}
