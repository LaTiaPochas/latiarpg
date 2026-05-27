import type { CombatDebugLogger } from "@/lib/combat-debug";
import type { CombatEncounterEnemyView } from "@/components/combat/types";
import type { CombatOutcome, CombatTurnActor } from "@/components/combat/combat-turn-types";

export type CombatEnemyTurnWatch = {
  atbActionSeq: number;
  combatOutcome: CombatOutcome;
  isInitialCombatDelay: boolean;
  isPlayerTurn: boolean;
  isTurnTransitioning: boolean;
  playerCurrentHp: number;
  playerDisplayName: string;
  currentActor: CombatTurnActor | null;
  currentActorId: string | null;
  displayEnemies: CombatEncounterEnemyView[];
  effectivePlayerArmor: number;
  effectivePlayerMr: number;
  debugEnemy: CombatDebugLogger;
  turn: number;
};
