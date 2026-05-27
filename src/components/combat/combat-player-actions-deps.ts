import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { AmmoAttackType, CombatAmmoMenuEntry } from "@/lib/combat-ammo";
import type { ActiveCombatCondition } from "@/lib/combat-conditions";
import type { EnemyCombatStatBonuses } from "@/lib/enemy-skill-combat";
import type {
  CombatEncounterEnemyView,
  CombatPlayerConsumableView,
  CombatPlayerSkillView,
} from "@/components/combat/types";
import type {
  EnemySelfTimedModifier,
  EnemyTimedStatBuff,
  PlayerEnemyTimedEffect,
  PlayerTimedSelfBuff,
} from "@/components/combat/combat-timed-effect-types";
import type { CombatOutcome } from "@/components/combat/combat-turn-types";
import type { CombatLogTone } from "@/components/combat/combat-enemy-turn-deps";

export type PlayerSkillDamageBaseBounds = {
  weaponMin: number;
  weaponMax: number;
  magicMin: number;
  magicMax: number;
};

export type ConsumableWeaponMitigationOverride = {
  attackType: AmmoAttackType;
} | null;

export type CombatPlayerActionsDeps = {
  playerSkillCooldownRemaining: Record<string, number>;
  skipPlayerSkillCooldownTickIdRef: MutableRefObject<string | null>;
  setPlayerSkillCooldownRemaining: Dispatch<SetStateAction<Record<string, number>>>;
  onAfterPlayerActsRef: MutableRefObject<() => void>;
  selectedEnemy: CombatEncounterEnemyView | null;
  isPlayerTurn: boolean;
  isTurnTransitioning: boolean;
  playerCurrentHp: number;
  displayPlayerMana: number;
  isPlayerActionsLocked: boolean;
  displayEnemies: CombatEncounterEnemyView[];
  selectedEnemyId: string | null;
  turn: number;
  setActionMenu: Dispatch<SetStateAction<"main" | "skills" | "inventory" | "ammo">>;
  appendCombatLog: (
    message: string,
    tone?: CombatLogTone,
    highlightAmount?: number,
    damageForHighlight?: number,
  ) => void;
  scheduleAdvanceTurn: () => void;
  setCombatConsumables: Dispatch<SetStateAction<CombatPlayerConsumableView[]>>;
  onConsumeConsumable?: (inventoryId: number) => Promise<{ ok: boolean; error?: string; remainingQuantity?: number }>;
  weaponAmmoKindNorm: string | null;
  setWeaponAttackFamilyOverride: Dispatch<
    SetStateAction<{
      attackFamily: string;
      attackType: AmmoAttackType;
      remainingTurns: number | null;
      lastTickTurn: number;
      effectIcon: string | null;
    } | null>
  >;
  setPlayerCurrentHp: Dispatch<SetStateAction<number>>;
  playerHpMax: number;
  setDisplayPlayerMana: Dispatch<SetStateAction<number>>;
  playerManaMax: number;
  recordPlayerHealing: (amount: number) => void;
  setDisplayEnemies: Dispatch<SetStateAction<CombatEncounterEnemyView[]>>;
  setSelectedEnemyId: Dispatch<SetStateAction<string | null>>;
  recordPlayerDamageDealt: (amount: number) => void;
  playerDisplayName: string;
  effectivePlayerArmor: number;
  effectivePlayerMr: number;
  getEnemyStatBonuses: (enemyId: string) => EnemyCombatStatBonuses;
  enemyTimedStatBuffsRef: MutableRefObject<EnemyTimedStatBuff[]>;
  setEnemyTimedStatBuffs: Dispatch<SetStateAction<EnemyTimedStatBuff[]>>;
  setActiveCombatConditions: Dispatch<SetStateAction<ActiveCombatCondition[]>>;
  activeCombatConditionsRef: MutableRefObject<ActiveCombatCondition[]>;
  setPlayerCombatArmorBonus: Dispatch<SetStateAction<number>>;
  setPlayerCombatMrBonus: Dispatch<SetStateAction<number>>;
  setPlayerCombatSpeedBonus: Dispatch<SetStateAction<number>>;
  setPlayerCombatWeaponDamageMinBonus: Dispatch<SetStateAction<number>>;
  setPlayerCombatWeaponDamageMaxBonus: Dispatch<SetStateAction<number>>;
  setPlayerCombatMagicDamageMinBonus: Dispatch<SetStateAction<number>>;
  setPlayerCombatMagicDamageMaxBonus: Dispatch<SetStateAction<number>>;
  setPlayerTimedSelfBuffs: Dispatch<SetStateAction<PlayerTimedSelfBuff[]>>;
  enemyPlayerTimedEffects: PlayerEnemyTimedEffect[];
  setEnemyPlayerTimedEffects: Dispatch<SetStateAction<PlayerEnemyTimedEffect[]>>;
  enemySelfTimedModifiers: EnemySelfTimedModifier[];
  playerWeaponDamageMin: number;
  playerWeaponDamageMax: number;
  playerMagicDamageMin: number;
  playerMagicDamageMax: number;
  playerCombatWeaponDamageMinBonus: number;
  playerCombatWeaponDamageMaxBonus: number;
  playerCombatMagicDamageMinBonus: number;
  playerCombatMagicDamageMaxBonus: number;
  timedBuffBonusByStat: Record<
    | "armor"
    | "mr"
    | "speed"
    | "weapon_damage_min"
    | "weapon_damage_max"
    | "magic_damage_min"
    | "magic_damage_max",
    number
  >;
  effectivePlayerWeaponAttackFamily: string | null;
  consumableWeaponMitigation: ConsumableWeaponMitigationOverride;
  requiresAmmo: boolean;
  selectedAmmoItem: CombatAmmoMenuEntry | null;
  weaponAttackFamilyOverride: {
    attackFamily: string;
    attackType: AmmoAttackType;
    remainingTurns: number | null;
    lastTickTurn: number;
    effectIcon: string | null;
  } | null;
  combatOutcome: CombatOutcome;
  getCombatStatValueForSkills: (key: string) => number;
  computePlayerSkillMitigatedDamageToEnemy: (
    effect: Record<string, unknown>,
    enemy: CombatEncounterEnemyView,
    opts: {
      getCombatStatValue: (key: string) => number;
      skillDamageBases: PlayerSkillDamageBaseBounds;
      magicalCombatDamageFlat: number;
      resistWeakTags: string[];
      enemyResistancesResolved: string[];
      weaknessesResolved: string[];
      enemyStatBonuses: EnemyCombatStatBonuses;
      consumableWeaponMitigation?: ConsumableWeaponMitigationOverride;
    },
  ) => number;
  mergedEnemyResistancesForPlayerAttack: (
    enemy: CombatEncounterEnemyView,
    selfMods: EnemySelfTimedModifier[],
  ) => string[];
  mergedEnemyWeaknessesForPlayerAttack: (
    enemy: CombatEncounterEnemyView,
    effects: PlayerEnemyTimedEffect[],
    selfMods: EnemySelfTimedModifier[],
    additionalTags: string[],
  ) => string[];
  playerSkillRequiresSingleEnemySelection: (skill: CombatPlayerSkillView) => boolean;
  playerSkillDamageHitsAllEnemies: (effect: Record<string, unknown>) => boolean;
  getPlayerSkillDamageEffectKind: (effect: Record<string, unknown>) => string;
  formatPlayerSkillCombatLogDescription: (
    template: string,
    damageDealt: number,
    enemyHitName?: string | null,
    damageTypes?: string[],
  ) => string;
  coerceEffectNumber: (value: unknown, fallback: number) => number;
  recordAmmoSpentInCombat: (inventoryId: number, amount?: number) => void;
  getEffectDamageTypes: (effect: Record<string, unknown>) => string[];
  getEffectAttackTypesForResistWeak: (
    effect: Record<string, unknown>,
    weaponAttackFamily: string | null,
  ) => string[];
  getEffectStateIcons: (effect: Record<string, unknown>) => string[];
  isPlayerEnemyTimedStatEffect: (effect: Record<string, unknown>) => boolean;
  isPlayerSelfBuffEffect: (effect: Record<string, unknown>) => boolean;
  parseEffectDurationTurns: (effect: Record<string, unknown>) => number | null;
  playerSelfBuffPartsToEnemyStatParts: (
    parts: Array<{ stat: string; amount: number }>,
  ) => import("@/lib/enemy-skill-combat").EnemyStatBuffPart[];
  resolvePlayerSelfBuffParts: (
    effect: Record<string, unknown>,
    getCombatStatValue: (key: string) => number,
  ) => Array<{ stat: string; amount: number }>;
  splitSelfBuffPartsForTimedAndInstant: (
    parts: Array<{ stat: string; amount: number }>,
    durationTurns: number | null,
  ) => {
    timedParts: Array<{ stat: string; amount: number }>;
    instantParts: Array<{ stat: string; amount: number }>;
  };
  collectWeaknessTagsFromDamageSkillScalings: (effect: Record<string, unknown>) => string[];
  formatPlayerSelfBuffCombatLog: (
    template: string,
    parts: Array<{ stat: string; amount: number }>,
    durationTurns: number | null,
  ) => string;
  stackEnemyTimedStatBuffs: (
    current: EnemyTimedStatBuff[],
    rows: EnemyTimedStatBuff[],
    turn: number,
  ) => EnemyTimedStatBuff[];
};
