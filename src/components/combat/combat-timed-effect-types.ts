import type { EnemyStatBuffPart } from "@/lib/enemy-skill-combat";

export type EnemyAppliedPlayerTimedModifier = {
  id: string;
  remainingTurns: number;
  lastTickTurn: number;
  sourceSkillName: string;
  stateIcons: string[];
  extraWeaknessTags: string[];
  extraResistanceTags: string[];
};

export type EnemySelfTimedModifier = {
  id: string;
  enemyId: string;
  remainingTurns: number;
  lastTickTurn: number;
  skillName: string;
  stateIcons: string[];
  resistanceTags: string[];
  weaknessTags: string[];
};

export type EnemyTimedStatBuff = {
  id: string;
  enemyId: string;
  parts: EnemyStatBuffPart[];
  remainingTurns: number;
  lastTickTurn: number;
  skillName: string;
  stateIcons: string[];
};

export type PlayerTimedSelfBuffStat =
  | "armor"
  | "mr"
  | "speed"
  | "weapon_damage_min"
  | "weapon_damage_max"
  | "magic_damage_min"
  | "magic_damage_max";

export type PlayerTimedSelfBuffPart = {
  stat: PlayerTimedSelfBuffStat;
  amount: number;
};

export type PlayerEnemyTimedEffect = {
  id: string;
  enemyId: string;
  debuffRemainingTurns: number;
  dotTicksRemaining: number;
  lastTickTurn: number;
  skillName: string;
  stateIcons: string[];
  extraWeaknessTags: string[];
  dotEffectJson: Record<string, unknown> | null;
};

export type PlayerTimedSelfBuff = {
  id: string;
  parts: PlayerTimedSelfBuffPart[];
  remainingTurns: number;
  lastTickTurn: number;
  skillName: string;
  stateIcons: string[];
};
