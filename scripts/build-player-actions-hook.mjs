import fs from "fs";

const extract = fs.readFileSync("src/components/combat/_player-actions-extract.txt", "utf8").replace(/^\uFEFF/, "");
const lines = extract.split(/\r?\n/).map((l) => (l.startsWith("  ") ? l.slice(2) : l));
const body = [...lines.slice(0, 267), ...lines.slice(331)].join("\n");

const depIds = [
  "playerSkillCooldownRemaining",
  "skipPlayerSkillCooldownTickIdRef",
  "setPlayerSkillCooldownRemaining",
  "onAfterPlayerActsRef",
  "selectedEnemy",
  "isPlayerTurn",
  "isTurnTransitioning",
  "playerCurrentHp",
  "displayPlayerMana",
  "isPlayerActionsLocked",
  "displayEnemies",
  "selectedEnemyId",
  "turn",
  "setActionMenu",
  "appendCombatLog",
  "scheduleAdvanceTurn",
  "setCombatConsumables",
  "onConsumeConsumable",
  "weaponAmmoKindNorm",
  "setWeaponAttackFamilyOverride",
  "setPlayerCurrentHp",
  "playerHpMax",
  "setDisplayPlayerMana",
  "playerManaMax",
  "recordPlayerHealing",
  "setDisplayEnemies",
  "setSelectedEnemyId",
  "recordPlayerDamageDealt",
  "playerDisplayName",
  "effectivePlayerArmor",
  "effectivePlayerMr",
  "getEnemyStatBonuses",
  "enemyTimedStatBuffsRef",
  "setEnemyTimedStatBuffs",
  "setActiveCombatConditions",
  "activeCombatConditionsRef",
  "setPlayerCombatArmorBonus",
  "setPlayerCombatMrBonus",
  "setPlayerCombatSpeedBonus",
  "setPlayerCombatWeaponDamageMinBonus",
  "setPlayerCombatWeaponDamageMaxBonus",
  "setPlayerCombatMagicDamageMinBonus",
  "setPlayerCombatMagicDamageMaxBonus",
  "setPlayerTimedSelfBuffs",
  "enemyPlayerTimedEffects",
  "setEnemyPlayerTimedEffects",
  "enemySelfTimedModifiers",
  "playerWeaponDamageMin",
  "playerWeaponDamageMax",
  "playerMagicDamageMin",
  "playerMagicDamageMax",
  "playerCombatWeaponDamageMinBonus",
  "playerCombatWeaponDamageMaxBonus",
  "playerCombatMagicDamageMinBonus",
  "playerCombatMagicDamageMaxBonus",
  "timedBuffBonusByStat",
  "effectivePlayerWeaponAttackFamily",
  "consumableWeaponMitigation",
  "requiresAmmo",
  "selectedAmmoItem",
  "weaponAttackFamilyOverride",
  "combatOutcome",
  "getCombatStatValueForSkills",
  "computePlayerSkillMitigatedDamageToEnemy",
  "mergedEnemyResistancesForPlayerAttack",
  "mergedEnemyWeaknessesForPlayerAttack",
  "playerSkillRequiresSingleEnemySelection",
  "playerSkillDamageHitsAllEnemies",
  "getPlayerSkillDamageEffectKind",
  "formatPlayerSkillCombatLogDescription",
  "coerceEffectNumber",
  "recordAmmoSpentInCombat",
  "getEffectDamageTypes",
  "getEffectAttackTypesForResistWeak",
  "getEffectStateIcons",
  "isPlayerEnemyTimedStatEffect",
  "isPlayerSelfBuffEffect",
  "parseEffectDurationTurns",
  "playerSelfBuffPartsToEnemyStatParts",
  "resolvePlayerSelfBuffParts",
  "splitSelfBuffPartsForTimedAndInstant",
  "collectWeaknessTagsFromDamageSkillScalings",
  "formatPlayerSelfBuffCombatLog",
];

function prefixDeps(code) {
  let result = code;
  for (const id of [...depIds].sort((a, b) => b.length - a.length)) {
    result = result.replace(new RegExp(`(?<!deps\\.)\\b${id}\\b`, "g"), `deps.${id}`);
  }
  return result;
}

function injectDepsReader(code) {
  return code.replace(/^( {2}function \w+)/gm, "$1").replace(/^function /gm, "  function ").replace(
    /(  function \w+[^{]*\{)\n/g,
    "$1\n    const deps = depsRef.current;\n",
  );
}

let transformed = injectDepsReader(prefixDeps(body));
transformed = transformed.replace(
  /deps\.onAfterPlayerActsRef\.current = \(\) => \{[\s\S]*?tickPlayerSkillCooldownsAfterPlayerAction\(exceptSkillId\);\s*\};/,
  "",
);

const header = `"use client";

import { type MutableRefObject } from "react";
import type { ParsedPlayerConditionDebuff } from "@/lib/player-skill-effect-combat";
import {
  expandPlayerSkillEffectSteps,
  getPlayerStatValueForConditionResist,
  getStatValueForConditionResist,
  parsePlayerSkillCooldownTurns,
  parsePlayerSkillEffectTarget,
  playerSkillStepsNeedCompositeHandler,
  rollConditionResisted,
} from "@/lib/player-skill-effect-combat";
import {
  isAmmoConsumableEffect,
  parseAmmoEffect,
  resolveAmmoAttackFamilyForHit,
  resolveAmmoAttackTypeForHit,
  rollAmmoDamage,
  type AmmoAttackType,
  type CombatAmmoMenuEntry,
} from "@/lib/combat-ammo";
import {
  isWeaponAttackFamilyConsumableEffect,
  parseWeaponAttackFamilyConsumableEffect,
  validateWeaponAttackFamilyConsumableForWeapon,
} from "@/lib/combat-weapon-attack-family-consumable";
import { getCombatConditionDefinition } from "@/lib/combat-conditions";
import { normalizePublicAssetUrl } from "@/lib/normalize-asset-url";
import { stackEnemyTimedStatBuffs } from "@/lib/enemy-skill-combat";
import type {
  CombatEncounterEnemyView,
  CombatPlayerConsumableView,
  CombatPlayerSkillView,
} from "@/components/combat/types";
import type {
  CombatPlayerActionsDeps,
  PlayerSkillDamageBaseBounds,
} from "@/components/combat/combat-player-actions-deps";
import {
  applyEnemyAttackFamilyToMitigatedDamage,
  effectiveEnemyArmor,
  effectiveEnemyMr,
  mitigateDamageByDefense,
  mitigateDamageByMr,
  resolvePlayerSkillEffectTargetsForPlayer,
} from "@/components/combat/combat-stat-helpers";
import { randomIntInclusive } from "@/components/combat/combat-enemy-turn-utils";
import type { EnemyTimedStatBuff } from "@/components/combat/combat-timed-effect-types";

export function useCombatPlayerActions(depsRef: MutableRefObject<CombatPlayerActionsDeps>) {
`;

const footer = `
  function afterPlayerActs() {
    const deps = depsRef.current;
    const exceptSkillId = deps.skipPlayerSkillCooldownTickIdRef.current;
    deps.skipPlayerSkillCooldownTickIdRef.current = null;
    tickPlayerSkillCooldownsAfterPlayerAction(exceptSkillId);
  }

  return {
    playerSkillCooldownTurnsRemaining,
    canUsePlayerSkill,
    canUseConsumable,
    handleConsumableUse,
    handlePlayerSkillChosen,
    handleAttack,
    afterPlayerActs,
  };
}
`;

fs.writeFileSync(
  "src/components/combat/use-combat-player-actions.ts",
  header + transformed + footer,
  "utf8",
);
console.log("Wrote use-combat-player-actions.ts");
