import type { CombatEncounterEnemySkill } from "@/components/combat/types";

export type EnemySkillDecision = {
  chosenSkill: CombatEncounterEnemySkill | null;
  evaluatedSkill: CombatEncounterEnemySkill;
  roll: number;
  chance: number;
  nextAvailableTurn: number;
};
