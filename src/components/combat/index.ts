export { CombatEncounterShell } from "@/components/combat/combat-encounter-shell";
export { GauntletCombatShell } from "@/components/combat/gauntlet-combat-shell";
export {
  createGauntletCombatConfig,
  createMapCombatConfig,
  resolveCombatEncounterConfig,
  type CombatEncounterConfig,
  type CombatEncounterMode,
} from "@/components/combat/combat-encounter-config";
export type { CombatEncounterShellProps, GauntletCombatShellProps } from "@/components/combat/combat-shell-props";
export {
  useCombatEncounter,
  type CombatEncounterController,
  type UseCombatEncounterInput,
  type CombatEncounterEngine,
  type CombatOutcome,
  type CombatTurnActor,
} from "@/components/combat/use-combat-encounter";
export { useCombatEncounterRuntime, type CombatEncounterRuntime } from "@/components/combat/use-combat-encounter-runtime";
export {
  COMBAT_ACTION_DELAY_MS,
  COMBAT_FIRST_ACTION_DELAY_MS,
  COMBAT_MAX_ENEMIES_ON_FIELD,
  useCombatEncounterEngine,
} from "@/components/combat/use-combat-encounter-engine";
export { useCombatEnemyTurn } from "@/components/combat/use-combat-enemy-turn";
export { useCombatPlayerActions } from "@/components/combat/use-combat-player-actions";
export type {
  CombatConsumeResult,
  CombatDefeatLostItem,
  CombatEncounterEnemySkill,
  CombatEncounterEnemyView,
  CombatEncounterStatsPayload,
  CombatPlayerConsumableView,
  CombatPlayerSkillView,
  CombatVictoryLootItem,
  CombatAmmoSpentEntry,
} from "@/components/combat/types";
