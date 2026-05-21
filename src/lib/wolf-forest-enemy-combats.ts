import { WOLF_FOREST_ZONE_CODE } from "@/lib/game-zones";
import { rollWeightedCombatCode } from "@/lib/roll-weighted-combat-code";

export { WOLF_FOREST_ZONE_CODE };

/** Hotspot del mapa de bosque inexplorado (no es un `combat_encounters.code`). */
export const WOLF_FOREST_HOTSPOT_ID = "wolf-forest";

export type WolfForestEnemyCombatEntry = {
  combatCode: string;
  chance: number;
};

/** Encuentro aleatorio al pulsar «Ir allá» en Bosques de lobos. Suman 1. */
export const WOLF_FOREST_ENEMY_COMBAT_WEIGHTS: WolfForestEnemyCombatEntry[] = [
  { combatCode: "wolf-forest-1", chance: 1 / 3 },
  { combatCode: "wolf-forest-2", chance: 1 / 3 },
  { combatCode: "wolf-forest-3", chance: 1 / 3 },
];

export function rollWolfForestEnemyCombatCode(): string {
  return rollWeightedCombatCode(WOLF_FOREST_ENEMY_COMBAT_WEIGHTS, "wolf-forest-1");
}
