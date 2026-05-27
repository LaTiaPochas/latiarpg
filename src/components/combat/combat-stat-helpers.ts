import type {
  EnemyCombatStatBonuses,
  EnemySkillEffectTarget,
  EnemyStatBuffPart,
  ParsedEnemySkillEffect,
  PlayerSkillEffectSubtype,
} from "@/lib/enemy-skill-combat";
import {
  emptyEnemyCombatStatBonuses,
  rollEnemySkillRawDamage,
} from "@/lib/enemy-skill-combat";
import type { PlayerSkillEffectTarget } from "@/lib/player-skill-effect-combat";
import { canonicalizeCombatResistWeakTag } from "@/lib/combat-resist-weak-icons";
import type { CombatEncounterEnemyView } from "@/components/combat/types";

type PlayerTimedSelfBuffPart = {
  stat:
    | "armor"
    | "mr"
    | "speed"
    | "weapon_damage_min"
    | "weapon_damage_max"
    | "magic_damage_min"
    | "magic_damage_max";
  amount: number;
};

export function mitigateDamageByDefense(rawDamage: number, armor: number): number {
  const raw = Math.max(0, Math.trunc(rawDamage));
  const def = Math.max(0, Math.trunc(armor));
  return Math.max(0, raw - def);
}

export function mitigateDamageByMr(rawDamage: number, mr: number): number {
  const raw = Math.max(0, Math.trunc(rawDamage));
  const mrVal = Math.max(0, Math.trunc(mr));
  return Math.max(0, raw - mrVal * 2);
}

export function mitigateDamageBySubtype(
  rawDamage: number,
  defenseStat: number,
  subtype: PlayerSkillEffectSubtype,
): number {
  if (subtype === "magical") return mitigateDamageByMr(rawDamage, defenseStat);
  return mitigateDamageByDefense(rawDamage, defenseStat);
}

export function applyEnemyResistWeakTagsToMitigatedDamage(
  damageAfterDefense: number,
  attackTags: string[],
  resistances: string[],
  weaknesses: string[],
): number {
  const base = Math.max(0, Math.trunc(damageAfterDefense));
  const tags = attackTags
    .map((s) => canonicalizeCombatResistWeakTag(s))
    .filter((s): s is string => Boolean(s));
  if (tags.length === 0) return base;
  const res = new Set(
    resistances
      .map((s) => canonicalizeCombatResistWeakTag(s))
      .filter((s): s is string => Boolean(s)),
  );
  const weak = new Set(
    weaknesses
      .map((s) => canonicalizeCombatResistWeakTag(s))
      .filter((s): s is string => Boolean(s)),
  );

  let hasResistOnly = false;
  let hasWeakOnly = false;
  for (const t of tags) {
    const inRes = res.has(t);
    const inWeak = weak.has(t);
    if (inRes && inWeak) continue;
    if (inRes) hasResistOnly = true;
    else if (inWeak) hasWeakOnly = true;
  }

  if (hasResistOnly) return Math.max(0, Math.floor(base * 0.5));
  if (hasWeakOnly) return Math.max(0, Math.floor(base * 2));
  return base;
}

export function applyEnemyAttackFamilyToMitigatedDamage(
  damageAfterArmor: number,
  attackFamily: string | null | undefined,
  resistances: string[],
  weaknesses: string[],
): number {
  const fam =
    typeof attackFamily === "string" && attackFamily.trim().length > 0
      ? attackFamily.trim().toLowerCase()
      : "";
  return applyEnemyResistWeakTagsToMitigatedDamage(
    damageAfterArmor,
    fam ? [fam] : [],
    resistances,
    weaknesses,
  );
}

export function effectiveEnemyArmor(
  enemy: CombatEncounterEnemyView,
  bonuses: EnemyCombatStatBonuses,
): number {
  return Math.max(0, Math.trunc(enemy.armor + bonuses.armor));
}

export function effectiveEnemyMr(
  enemy: CombatEncounterEnemyView,
  bonuses: EnemyCombatStatBonuses,
): number {
  return Math.max(0, Math.trunc(enemy.mr + bonuses.mr));
}

export function effectiveEnemySpeed(
  enemy: CombatEncounterEnemyView,
  bonuses: EnemyCombatStatBonuses,
): number {
  return Math.max(0, Math.trunc(enemy.speed + bonuses.speed));
}

export function effectiveEnemyAttackRange(
  enemy: CombatEncounterEnemyView,
  bonuses: EnemyCombatStatBonuses,
): { min: number; max: number } {
  const min = Math.max(0, Math.trunc(enemy.attackMin + bonuses.attackMin));
  const max = Math.max(min, Math.trunc(enemy.attackMax + bonuses.attackMax));
  return { min, max };
}

export function effectiveEnemyHpMax(
  enemy: CombatEncounterEnemyView,
  bonuses: EnemyCombatStatBonuses,
): number {
  return Math.max(1, Math.trunc(enemy.hpMax + bonuses.hp));
}

export function effectiveEnemyMana(
  enemy: CombatEncounterEnemyView,
  bonuses: EnemyCombatStatBonuses,
): number {
  return Math.max(0, Math.trunc(enemy.mana + bonuses.mana));
}

export function resolveEnemySkillEffectTargets(
  target: EnemySkillEffectTarget,
  casterEnemyId: string,
  livingEnemies: CombatEncounterEnemyView[],
): { hitPlayer: boolean; enemies: CombatEncounterEnemyView[] } {
  switch (target) {
    case "player":
      return { hitPlayer: true, enemies: [] };
    case "caster": {
      const caster = livingEnemies.find((e) => e.id === casterEnemyId);
      return { hitPlayer: false, enemies: caster ? [caster] : [] };
    }
    case "all_enemies":
      return { hitPlayer: false, enemies: livingEnemies };
    case "all":
      return { hitPlayer: true, enemies: livingEnemies };
    default:
      return { hitPlayer: false, enemies: [] };
  }
}

export function resolvePlayerSkillEffectTargetsForPlayer(
  target: PlayerSkillEffectTarget,
  selectedEnemy: CombatEncounterEnemyView | null,
  livingEnemies: CombatEncounterEnemyView[],
): { hitPlayer: boolean; enemies: CombatEncounterEnemyView[] } {
  switch (target) {
    case "self":
      return { hitPlayer: true, enemies: [] };
    case "enemy": {
      if (!selectedEnemy || selectedEnemy.hp <= 0) {
        return { hitPlayer: false, enemies: [] };
      }
      return { hitPlayer: false, enemies: [selectedEnemy] };
    }
    case "all_enemies":
      return { hitPlayer: false, enemies: livingEnemies.filter((e) => e.hp > 0) };
    case "all":
      return {
        hitPlayer: true,
        enemies: livingEnemies.filter((e) => e.hp > 0),
      };
    default:
      return { hitPlayer: false, enemies: [] };
  }
}

export function enemyStatPartsToPlayerTimedParts(parts: EnemyStatBuffPart[]): PlayerTimedSelfBuffPart[] {
  const out: PlayerTimedSelfBuffPart[] = [];
  for (const part of parts) {
    const a = Math.trunc(part.amount);
    if (a === 0) continue;
    switch (part.stat) {
      case "armor":
        out.push({ stat: "armor", amount: a });
        break;
      case "mr":
        out.push({ stat: "mr", amount: a });
        break;
      case "speed":
        out.push({ stat: "speed", amount: a });
        break;
      case "damage":
        out.push({ stat: "weapon_damage_min", amount: a });
        out.push({ stat: "weapon_damage_max", amount: a });
        break;
      case "magic_damage":
        out.push({ stat: "magic_damage_min", amount: a });
        out.push({ stat: "magic_damage_max", amount: a });
        break;
      default:
        break;
    }
  }
  return out;
}

type ParsedEnemyDamageLeaf = Extract<ParsedEnemySkillEffect, { mode: "damage" }>;

export function mitigatedEnemySkillDamageToEnemy(
  leaf: ParsedEnemyDamageLeaf,
  victim: CombatEncounterEnemyView,
  bonuses: EnemyCombatStatBonuses,
): number {
  const incomingSubtype = enemySkillIncomingSubtypeFromParsed(leaf);
  const rawDamageRoll = Math.max(
    0,
    rollEnemySkillRawDamage(
      leaf.min,
      leaf.max,
      leaf.damageBasis,
      victim.hp,
      victim.hpMax,
    ),
  );
  const defenseStat =
    incomingSubtype === "magical"
      ? effectiveEnemyMr(victim, bonuses)
      : effectiveEnemyArmor(victim, bonuses);
  return Math.max(0, Math.trunc(mitigateDamageBySubtype(rawDamageRoll, defenseStat, incomingSubtype)));
}

export function enemyDefenseStatForPlayerSkill(
  subtype: PlayerSkillEffectSubtype,
  enemy: CombatEncounterEnemyView,
  bonuses: EnemyCombatStatBonuses = emptyEnemyCombatStatBonuses(),
): number {
  if (subtype === "magical") return effectiveEnemyMr(enemy, bonuses);
  return effectiveEnemyArmor(enemy, bonuses);
}

export function playerDefenseStatVsIncoming(
  subtype: PlayerSkillEffectSubtype,
  playerArmor: number,
  playerMr: number,
): number {
  if (subtype === "magical") return Math.max(0, Math.trunc(playerMr));
  return Math.max(0, Math.trunc(playerArmor));
}

export function enemySkillIncomingSubtypeFromParsed(
  effect: ParsedEnemySkillEffect,
): PlayerSkillEffectSubtype {
  if (effect.mode !== "damage" && effect.mode !== "weapon_attack") return "physical";
  const raw = effect.subtype;
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "physical") return "physical";
  if (s === "magical") return "magical";
  if (s === "buff") return "buff";
  return "neutral";
}
