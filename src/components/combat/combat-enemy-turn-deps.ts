import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { ActiveCombatCondition } from "@/lib/combat-conditions";
import type { CombatDebugLogger } from "@/lib/combat-debug";
import type { EnemyCombatStatBonuses } from "@/lib/enemy-skill-combat";
import type {
  EnemyAppliedPlayerTimedModifier,
  EnemySelfTimedModifier,
  EnemyTimedStatBuff,
  PlayerTimedSelfBuff,
} from "@/components/combat/combat-timed-effect-types";
import type { CombatEncounterEnemyView } from "@/components/combat/types";
import type { CombatOutcome, CombatTurnActor } from "@/components/combat/combat-turn-types";

export type CombatLogTone = "default" | "success" | "danger";

export type CombatEnemyTurnDeps = {
  combatOutcome: CombatOutcome;
  isPlayerTurn: boolean;
  isTurnTransitioning: boolean;
  isInitialCombatDelay: boolean;
  playerCurrentHp: number;
  playerDisplayName: string;
  atbActionSeq: number;
  currentActor: CombatTurnActor | null;
  currentActorId: string | null;
  turn: number;
  displayEnemies: CombatEncounterEnemyView[];
  debugEnemy: CombatDebugLogger;
  resolvedEnemyTurnRef: MutableRefObject<string | null>;
  scheduleAdvanceTurn: () => void;
  activeCombatConditionsRef: MutableRefObject<ActiveCombatCondition[]>;
  setActiveCombatConditions: Dispatch<SetStateAction<ActiveCombatCondition[]>>;
  appendCombatLog: (
    message: string,
    tone?: CombatLogTone,
    highlightAmount?: number,
    damageForHighlight?: number,
  ) => void;
  playerSkipTurnResolvedRef: MutableRefObject<string | null>;
  getEnemyStatBonuses: (enemyId: string) => EnemyCombatStatBonuses;
  enemySkillNextAvailableTurn: Record<string, Record<string, number>>;
  setEnemyAttackLungeSeq: Dispatch<SetStateAction<Record<string, number>>>;
  setEnemySkillNextAvailableTurn: Dispatch<
    SetStateAction<Record<string, Record<string, number>>>
  >;
  setDisplayEnemies: Dispatch<SetStateAction<CombatEncounterEnemyView[]>>;
  recordPlayerDamageTaken: (amount: number) => void;
  setPlayerCurrentHp: Dispatch<SetStateAction<number>>;
  effectivePlayerArmor: number;
  effectivePlayerMr: number;
  playerHpMax: number;
  playerManaMax: number;
  setDisplayPlayerMana: Dispatch<SetStateAction<number>>;
  setPlayerTimedSelfBuffs: Dispatch<SetStateAction<PlayerTimedSelfBuff[]>>;
  enemyAppliedPlayerTimedModifiersRef: MutableRefObject<EnemyAppliedPlayerTimedModifier[]>;
  displayEnemiesRef: MutableRefObject<CombatEncounterEnemyView[]>;
  enemyTimedStatBuffsRef: MutableRefObject<EnemyTimedStatBuff[]>;
  setEnemyAppliedPlayerTimedModifiers: Dispatch<
    SetStateAction<EnemyAppliedPlayerTimedModifier[]>
  >;
  setEnemySelfTimedModifiers: Dispatch<SetStateAction<EnemySelfTimedModifier[]>>;
  setEnemyTimedStatBuffs: Dispatch<SetStateAction<EnemyTimedStatBuff[]>>;
  recordPlayerHealing: (amount: number) => void;
  playerResistancesRef: MutableRefObject<string[]>;
  playerWeaknessesRef: MutableRefObject<string[]>;
  currentActorIdRef: MutableRefObject<string | null>;
};
