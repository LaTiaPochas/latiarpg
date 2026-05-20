import { rollWeightedCombatCode } from "@/lib/roll-weighted-combat-code";

export type MagicForestEnemyCombatEntry = {
  combatCode: string;
  /** Probabilidad (idealmente suman 1) o peso relativo. */
  chance: number;
};

/** Encuentro al salir `enemy` en Bosque Mágico. */
export const MAGIC_FOREST_ENEMY_COMBAT_WEIGHTS: MagicForestEnemyCombatEntry[] = [
  { combatCode: "magic-forest", chance: 0.30 },
  { combatCode: "magic-forest2", chance: 0.18 },
  { combatCode: "magic-forest3", chance: 0.07 },
  { combatCode: "magic-forest4", chance: 0.15 },
  { combatCode: "magic-forest5", chance: 0.15 },
  { combatCode: "magic-forest6", chance: 0.15 },
];

export function rollMagicForestEnemyCombatCode(): string {
  return rollWeightedCombatCode(MAGIC_FOREST_ENEMY_COMBAT_WEIGHTS, "magic-forest");
}
