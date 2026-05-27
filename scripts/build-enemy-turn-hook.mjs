import fs from "fs";

const extract = fs.readFileSync("src/components/combat/_enemy-turn-extract.txt", "utf8").replace(/^\uFEFF/, "");
let body = extract
  .split(/\r?\n/)
  .map((l) => (l.startsWith("  ") ? l.slice(2) : l))
  .join("\n");

const depIds = [
  "combatOutcome",
  "isPlayerTurn",
  "isTurnTransitioning",
  "isInitialCombatDelay",
  "playerCurrentHp",
  "playerDisplayName",
  "atbActionSeq",
  "currentActor",
  "currentActorId",
  "turn",
  "displayEnemies",
  "debugEnemy",
  "resolvedEnemyTurnRef",
  "scheduleAdvanceTurn",
  "activeCombatConditionsRef",
  "setActiveCombatConditions",
  "appendCombatLog",
  "playerSkipTurnResolvedRef",
  "getEnemyStatBonuses",
  "enemySkillNextAvailableTurn",
  "setEnemyAttackLungeSeq",
  "setEnemySkillNextAvailableTurn",
  "setDisplayEnemies",
  "recordPlayerDamageTaken",
  "setPlayerCurrentHp",
  "effectivePlayerArmor",
  "effectivePlayerMr",
  "playerHpMax",
  "playerManaMax",
  "setDisplayPlayerMana",
  "setPlayerTimedSelfBuffs",
  "enemyAppliedPlayerTimedModifiersRef",
  "displayEnemiesRef",
  "enemyTimedStatBuffsRef",
  "setEnemyAppliedPlayerTimedModifiers",
  "setEnemySelfTimedModifiers",
  "setEnemyTimedStatBuffs",
  "recordPlayerHealing",
  "playerResistancesRef",
  "playerWeaknessesRef",
  "currentActorIdRef",
];

function prefixDeps(code) {
  let result = code;
  const sorted = [...depIds].sort((a, b) => b.length - a.length);
  for (const id of sorted) {
    const re = new RegExp(`(?<!deps\\.)\\b${id}\\b`, "g");
    result = result.replace(re, `deps.${id}`);
  }
  return result;
}

function injectDepsReader(code) {
  return code.replace(
    /^(function \w+\([^)]*\) \{|useEffect\(\(\) => \{)/gm,
    "$1\n    const deps = depsRef.current;",
  );
}

function fixEffectDependencyArrays(code) {
  return code.replace(/\[(deps\.\w+(?:,\s*deps\.\w+)*)\]/g, (match) => {
    const inner = match.slice(1, -1).replace(/deps\./g, "");
    return `[${inner}]`;
  });
}

let fullBody = body;
if (!fullBody.includes("watchdog-reenviar-avance")) {
  fullBody += `

  }, [
    atbActionSeq,
    combatOutcome,
    currentActor,
    currentActorId,
    displayEnemies,
    effectivePlayerArmor,
    effectivePlayerMr,
    debugEnemy,
    isInitialCombatDelay,
    playerCurrentHp,
    turn,
  ]);

  useEffect(() => {
    if (combatOutcome !== "active") return;
    if (!currentActor || currentActor.type !== "enemy") return;
    if (isInitialCombatDelay || isTurnTransitioning) return;
    if (playerCurrentHp <= 0) return;

    const resolvedKey = \`\${atbActionSeq}:\${currentActorId ?? ""}\`;
    if (resolvedEnemyTurnRef.current !== resolvedKey) return;

    const watchdogId = setTimeout(() => {
      if (resolvedEnemyTurnRef.current !== resolvedKey) return;
      if (currentActorIdRef.current !== currentActorId) return;
      debugEnemy("watchdog-reenviar-avance-tras-ataque-enemigo", { resolvedKey });
      scheduleAdvanceTurn();
    }, ACTION_DELAY_MS + 1200);

    return () => clearTimeout(watchdogId);
  }, [
    atbActionSeq,
    combatOutcome,
    currentActor,
    currentActorId,
    debugEnemy,
    isInitialCombatDelay,
    isTurnTransitioning,
    playerCurrentHp,
    turn,
  ]);
`;
}

const prefixedBody = fixEffectDependencyArrays(
  prefixDeps(injectDepsReader(fullBody)),
);
const watchdogBody = prefixedBody.replace(
  /ACTION_DELAY_MS \+ 1200/g,
  "COMBAT_ACTION_DELAY_MS + 1200",
);

const header = `"use client";

import { useEffect, type MutableRefObject } from "react";
import type { EnemyAppliedPlayerTimedModifier, ParsedEnemySkillEffect } from "@/lib/enemy-skill-combat";
import {
  enemySkillMatchesUseWhen,
  orderCompositeStepsForExecution,
  parsedEnemySkillChance,
  parsedEnemySkillUseWhen,
  resolveEnemySkillLogDescription,
  rollEnemySkillRawDamage,
  stackEnemyTimedStatBuffs,
  sumEnemyTimedStatBonuses,
} from "@/lib/enemy-skill-combat";
import {
  evaluateSkipTurnConditionsAtTurnStart,
  targetHasSkipTurnCondition,
} from "@/lib/combat-conditions";
import {
  stackEnemySelfTimedResistWeakModifiers,
  stackPlayerTimedResistWeakModifiers,
} from "@/lib/combat-timed-resist-weak-stack";
import type { CombatEncounterEnemyView } from "@/components/combat/types";
import type { CombatEnemyTurnDeps } from "@/components/combat/combat-enemy-turn-deps";
import type { EnemySkillDecision } from "@/components/combat/combat-enemy-turn-types";
import { COMBAT_ACTION_DELAY_MS } from "@/components/combat/use-combat-encounter-engine";
import {
  applyEnemyResistWeakTagsToMitigatedDamage,
  effectiveEnemyAttackRange,
  effectiveEnemyHpMax,
  effectiveEnemyMana,
  enemySkillIncomingSubtypeFromParsed,
  mitigatedEnemySkillDamageToEnemy,
  mitigateDamageByDefense,
  mitigateDamageBySubtype,
  playerDefenseStatVsIncoming,
  resolveEnemySkillEffectTargets,
  enemyStatPartsToPlayerTimedParts,
} from "@/components/combat/combat-stat-helpers";
import {
  enemySkillCombatLogHadDamagePlaceholder,
  formatEnemySkillCombatLogDescription,
  mergePlayerResistWeakForIncoming,
  randomIntInclusive,
} from "@/components/combat/combat-enemy-turn-utils";

export function useCombatEnemyTurn(depsRef: MutableRefObject<CombatEnemyTurnDeps>) {
`;

const footer = "\n}\n";

fs.writeFileSync(
  "src/components/combat/use-combat-enemy-turn.ts",
  header + watchdogBody + footer,
  "utf8",
);
console.log("Wrote use-combat-enemy-turn.ts");
