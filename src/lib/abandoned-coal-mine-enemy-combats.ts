import { rollWeightedCombatCode } from "@/lib/roll-weighted-combat-code";

export type AbandonedCoalMineEnemyCombatEntry = {
  combatCode: string;
  chance: number;
};

/** Encuentro al salir `enemy` al minar en Minas Abandonadas. Suman 1. */
export const ABANDONED_COAL_MINE_ENEMY_COMBAT_WEIGHTS: AbandonedCoalMineEnemyCombatEntry[] = [
  { combatCode: "abandoned-coal-mine-1", chance: 0.35 },
  { combatCode: "abandoned-coal-mine-2", chance: 0.25 },
  { combatCode: "abandoned-coal-mine-3", chance: 0.2 },
  { combatCode: "abandoned-coal-mine-4", chance: 0.13 },
  { combatCode: "abandoned-coal-mine-5", chance: 0.07 },
];

export function rollAbandonedCoalMineEnemyCombatCode(): string {
  return rollWeightedCombatCode(ABANDONED_COAL_MINE_ENEMY_COMBAT_WEIGHTS, "abandoned-coal-mine-1");
}
