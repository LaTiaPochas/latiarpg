"use client";

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
import {
  getCombatConditionDefinition,
  type ActiveCombatCondition,
} from "@/lib/combat-conditions";
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
import type {
  EnemyTimedStatBuff,
  PlayerEnemyTimedEffect,
  PlayerTimedSelfBuff,
} from "@/components/combat/combat-timed-effect-types";

export function useCombatPlayerActions(depsRef: MutableRefObject<CombatPlayerActionsDeps>) {
  function playerSkillCooldownTurnsRemaining(skill: CombatPlayerSkillView): number {
    const deps = depsRef.current;
  return Math.max(0, Math.trunc(deps.playerSkillCooldownRemaining[skill.userCharacterSkillId] ?? 0));
}

  function applyPlayerSkillCooldown(skillEntry: CombatPlayerSkillView) {
    const deps = depsRef.current;
  const cd = parsePlayerSkillCooldownTurns(skillEntry.skill.cooldownTurns, 0);
  if (cd <= 0) return;
  deps.skipPlayerSkillCooldownTickIdRef.current = skillEntry.userCharacterSkillId;
  deps.setPlayerSkillCooldownRemaining((prev) => ({
    ...prev,
    [skillEntry.userCharacterSkillId]: cd,
  }));
}

  function tickPlayerSkillCooldownsAfterPlayerAction(exceptUserCharacterSkillId?: string | null) {
    const deps = depsRef.current;
  const exceptId =
    typeof exceptUserCharacterSkillId === "string" && exceptUserCharacterSkillId.length > 0
      ? exceptUserCharacterSkillId
      : null;
  deps.setPlayerSkillCooldownRemaining((prev) => {
    if (Object.keys(prev).length === 0) return prev;
    let changed = false;
    const next: Record<string, number> = { ...prev };
    for (const key of Object.keys(next)) {
      if (exceptId != null && key === exceptId) continue;
      const left = Math.trunc(next[key] ?? 0);
      if (left <= 0) continue;
      next[key] = left - 1;
      changed = true;
    }
    return changed ? next : prev;
  });
}



  function canUsePlayerSkill(skill: CombatPlayerSkillView) {
    const deps = depsRef.current;
  const needsSingleEnemy = deps.playerSkillRequiresSingleEnemySelection(skill);
  const hasValidFocus =
    deps.selectedEnemy != null && deps.selectedEnemy.hp > 0;
  return (
    deps.isPlayerTurn &&
    !deps.isTurnTransitioning &&
    deps.playerCurrentHp > 0 &&
    deps.displayPlayerMana >= skill.skill.manaCost &&
    playerSkillCooldownTurnsRemaining(skill) === 0 &&
    (!needsSingleEnemy || hasValidFocus)
  );
}

  function consumableObjective(effect: Record<string, unknown> | null): "self" | "enemy" {
    const deps = depsRef.current;
  const raw =
    typeof effect?.objetive === "string"
      ? effect.objetive.trim().toLowerCase()
      : typeof effect?.objective === "string"
        ? effect.objective.trim().toLowerCase()
        : "";
  return raw === "enemy" ? "enemy" : "self";
}

  function consumableTarget(effect: Record<string, unknown> | null): "single" | "area" {
    const deps = depsRef.current;
  const raw = typeof effect?.target === "string" ? effect.target.trim().toLowerCase() : "";
  return raw === "area" ? "area" : "single";
}

  function consumableStat(effect: Record<string, unknown> | null): string {
    const deps = depsRef.current;
  return typeof effect?.stat === "string" ? effect.stat.trim().toLowerCase() : "";
}

  function consumableAmount(effect: Record<string, unknown> | null): number {
    const deps = depsRef.current;
  const min = deps.coerceEffectNumber(effect?.["amount-min"], 0);
  const max = deps.coerceEffectNumber(effect?.["amount-max"], min);
  return Math.max(0, randomIntInclusive(min, max));
}

  function consumableLogText(
  item: CombatPlayerConsumableView,
  amountApplied: number,
  enemyName?: string | null,
  damageTypeOverride?: string | null,
): string {
    const deps = depsRef.current;
  const fromEffect = item.effect?.text;
  const damageTypeLabel =
    typeof damageTypeOverride === "string" && damageTypeOverride.trim().length > 0
      ? damageTypeOverride.trim()
      : "";
  if (typeof fromEffect === "string" && fromEffect.trim().length > 0) {
    let text = fromEffect.trim().replaceAll("{daño}", String(Math.max(0, Math.trunc(amountApplied))));
    if (damageTypeLabel.length > 0) {
      text = text
        .replaceAll("{damage_type}", damageTypeLabel)
        .replaceAll("{damage_types}", damageTypeLabel);
    }
    if (enemyName && enemyName.trim().length > 0) {
      text = text.replaceAll("{enemigo}", enemyName.trim());
    }
    return text;
  }
  if (damageTypeLabel.length > 0) {
    return `Usaste ${item.name}. Tu arma ahora inflige daño ${damageTypeLabel}.`;
  }
  return `Usaste ${item.name}.`;
}

  function canUseConsumable(item: CombatPlayerConsumableView): boolean {
    const deps = depsRef.current;
  if (isAmmoConsumableEffect(item.effect)) return false;
  if (deps.isPlayerActionsLocked) return false;
  if (item.quantity <= 0) return false;
  if (!item.effect) return false;
  if (isWeaponAttackFamilyConsumableEffect(item.effect)) {
    if (!parseWeaponAttackFamilyConsumableEffect(item.effect)) return false;
    return validateWeaponAttackFamilyConsumableForWeapon(deps.weaponAmmoKindNorm) == null;
  }
  const objective = consumableObjective(item.effect);
  if (objective !== "enemy") return true;
  const target = consumableTarget(item.effect);
  if (target === "area") return deps.displayEnemies.some((enemy) => enemy.hp > 0);
  return deps.selectedEnemy != null && deps.selectedEnemy.hp > 0;
}

  function applyEffectToEnemy(
  enemy: CombatEncounterEnemyView,
  stat: string,
  amount: number,
): CombatEncounterEnemyView {
    const deps = depsRef.current;
  if (stat === "hp") return { ...enemy, hp: Math.max(0, enemy.hp - amount) };
  if (stat === "mana" || stat === "mp") return { ...enemy, mana: Math.max(0, enemy.mana - amount) };
  if (stat === "armor") return { ...enemy, armor: Math.max(0, enemy.armor - amount) };
  if (stat === "mr") return { ...enemy, mr: Math.max(0, enemy.mr - amount) };
  if (stat === "speed") return { ...enemy, speed: Math.max(0, enemy.speed - amount) };
  return enemy;
}

  async function handleConsumableUse(item: CombatPlayerConsumableView) {
    const deps = depsRef.current;
    if (!canUseConsumable(item)) return;

  if (isWeaponAttackFamilyConsumableEffect(item.effect)) {
    const parsed = parseWeaponAttackFamilyConsumableEffect(item.effect);
    const weaponError = validateWeaponAttackFamilyConsumableForWeapon(deps.weaponAmmoKindNorm);
    if (!parsed || weaponError) {
      deps.appendCombatLog(weaponError ?? "Este consumible no tiene un efecto válido.", "danger");
      return;
    }
  }

  // Gasto optimista para evitar doble click mientras responde el server action.
  deps.setCombatConsumables((prev) =>
    prev
      .map((entry) =>
        entry.inventoryId === item.inventoryId
          ? { ...entry, quantity: Math.max(0, entry.quantity - 1) }
          : entry,
      )
      .filter((entry) => entry.quantity > 0),
  );

  if (deps.onConsumeConsumable) {
    const result = await deps.onConsumeConsumable(item.inventoryId);
    if (!result.ok) {
      deps.setCombatConsumables((prev) => {
        const existing = prev.find((entry) => entry.inventoryId === item.inventoryId);
        if (existing) {
          return prev.map((entry) =>
            entry.inventoryId === item.inventoryId
              ? { ...entry, quantity: existing.quantity + 1 }
              : entry,
          );
        }
        return [...prev, item];
      });
      deps.appendCombatLog(result.error?.trim() || "No se pudo consumir el objeto.", "danger");
      return;
    }
    if (typeof result.remainingQuantity === "number") {
      const qty = Math.max(0, Math.trunc(result.remainingQuantity));
      deps.setCombatConsumables((prev) => {
        const exists = prev.some((entry) => entry.inventoryId === item.inventoryId);
        if (qty <= 0) {
          return prev.filter((entry) => entry.inventoryId !== item.inventoryId);
        }
        if (!exists) return [...prev, { ...item, quantity: qty }];
        return prev.map((entry) =>
          entry.inventoryId === item.inventoryId ? { ...entry, quantity: qty } : entry,
        );
      });
    }
  }

  if (isWeaponAttackFamilyConsumableEffect(item.effect)) {
    const parsed = parseWeaponAttackFamilyConsumableEffect(item.effect)!;
    deps.setWeaponAttackFamilyOverride({
      attackFamily: parsed.attackFamily,
      attackType: parsed.attackType,
      remainingTurns: parsed.durationTurns,
      lastTickTurn: deps.turn,
      effectIcon: normalizePublicAssetUrl(parsed.effectIcon),
    });
    const durationNote =
      parsed.durationTurns != null
        ? ` (${parsed.durationTurns} turno${parsed.durationTurns === 1 ? "" : "s"})`
        : "";
    deps.appendCombatLog(
      consumableLogText(item, 0, null, parsed.attackFamily) + durationNote,
      "success",
    );
    deps.setActionMenu("main");
    deps.scheduleAdvanceTurn();
    return;
  }

  const objective = consumableObjective(item.effect);
  const target = consumableTarget(item.effect);
  const stat = consumableStat(item.effect);
  const amount = consumableAmount(item.effect);
  if (objective === "self") {
    if (stat === "hp") {
      deps.setPlayerCurrentHp((prev) => {
        const next = Math.min(deps.playerHpMax, Math.max(0, prev + amount));
        deps.recordPlayerHealing(next - prev);
        return next;
      });
    } else if (stat === "mana" || stat === "mp") {
      deps.setDisplayPlayerMana((prev) => Math.min(deps.playerManaMax, Math.max(0, prev + amount)));
    }
    deps.appendCombatLog(consumableLogText(item, amount), "default", amount);
    deps.setActionMenu("main");
    deps.scheduleAdvanceTurn();
    return;
  }

  if (target === "single") {
    const enemy = deps.selectedEnemy;
    if (!enemy || enemy.hp <= 0) {
      deps.appendCombatLog("Seleccioná un enemigo para usar este consumible.", "default");
      return;
    }
    let targetDied = false;
    deps.setDisplayEnemies((prev) =>
      prev.map((entry) => {
        if (entry.id !== enemy.id) return entry;
        const next = applyEffectToEnemy(entry, stat, amount);
        targetDied = entry.hp > 0 && next.hp <= 0;
        return next;
      }),
    );
    deps.appendCombatLog(consumableLogText(item, amount, enemy.name), "default", amount);
    if (targetDied) {
      deps.appendCombatLog(`Has matado a ${enemy.name}.`, "success");
      deps.setSelectedEnemyId(null);
    }
    deps.setActionMenu("main");
    deps.scheduleAdvanceTurn();
    return;
  }

  deps.setDisplayEnemies((prev) =>
    prev.map((entry) => (entry.hp > 0 ? applyEffectToEnemy(entry, stat, amount) : entry)),
  );
  deps.appendCombatLog(consumableLogText(item, amount), "default", amount);

  deps.setActionMenu("main");
  deps.scheduleAdvanceTurn();
}
  function applyPlayerConditionDebuff(
    step: ParsedPlayerConditionDebuff,
    skillName: string,
    livingEnemies: CombatEncounterEnemyView[],
    effectForIcons: Record<string, unknown> = {},
  ) {
    const deps = depsRef.current;
    const def = getCombatConditionDefinition(step.conditionId);
  if (!def) {
    deps.appendCombatLog(`Condición desconocida: ${step.conditionId}.`, "default");
    return;
  }

  const targets = resolvePlayerSkillEffectTargetsForPlayer(
    step.target,
    deps.selectedEnemy,
    livingEnemies,
  );
  const rowsToAdd: ActiveCombatCondition[] = [];
  let resistedCount = 0;
  let appliedCount = 0;
  const conditionStateIcons = deps.getEffectStateIcons(effectForIcons);
  const isSleepCondition = step.conditionId === "sleep";
  const sleepTargetLogs: Array<{ message: string; tone: "default" | "success" }> = [];

  const targetDisplayName = (
    targetKind: "player" | "enemy",
    enemyForResist: CombatEncounterEnemyView | null,
  ) => (targetKind === "player" ? deps.playerDisplayName : (enemyForResist?.name ?? "Enemigo"));

  const tryApply = (
    targetKind: "player" | "enemy",
    targetId: string,
    enemyForResist: CombatEncounterEnemyView | null,
  ) => {
    const displayName = targetDisplayName(targetKind, enemyForResist);
    const resisted = rollConditionResisted(step.resist, (statKey) => {
      if (targetKind === "player") {
        return getPlayerStatValueForConditionResist(statKey, {
          playerMr: deps.effectivePlayerMr,
          playerArmor: deps.effectivePlayerArmor,
        });
      }
      if (!enemyForResist) return 0;
      const bonuses = deps.getEnemyStatBonuses(enemyForResist.id);
      return getStatValueForConditionResist(statKey, {
        enemyMr: effectiveEnemyMr(enemyForResist, bonuses),
        enemyArmor: effectiveEnemyArmor(enemyForResist, bonuses),
      });
    });
    if (resisted) {
      resistedCount += 1;
      if (isSleepCondition) {
        sleepTargetLogs.push({
          message: `${displayName} resistió el encantamiento.`,
          tone: "default",
        });
      }
      return;
    }
    appliedCount += 1;
    if (isSleepCondition) {
      sleepTargetLogs.push({
        message: `${displayName} está dormido.`,
        tone: "success",
      });
    }
    rowsToAdd.push({
      id: `${targetKind}:${targetId}:${step.conditionId}:${deps.turn}:${Math.random().toString(36).slice(2, 9)}`,
      conditionId: step.conditionId,
      targetKind,
      targetId,
      remainingTurns: step.durationTurns,
      lastTickTurn: deps.turn,
      sourceSkillName: skillName,
      ...(conditionStateIcons.length > 0 ? { stateIcons: conditionStateIcons } : {}),
    });
  };

  if (targets.hitPlayer) {
    tryApply("player", "player", null);
  }
  for (const enemy of targets.enemies) {
    tryApply("enemy", enemy.id, enemy);
  }

  if (rowsToAdd.length > 0) {
    deps.setActiveCombatConditions((prev) => {
      const withoutDupes = prev.filter(
        (r) =>
          !rowsToAdd.some(
            (n) =>
              n.targetKind === r.targetKind &&
              n.targetId === r.targetId &&
              n.conditionId === r.conditionId,
          ),
      );
      return [...withoutDupes, ...rowsToAdd];
    });
  }

  if (isSleepCondition) {
    for (const log of sleepTargetLogs) {
      deps.appendCombatLog(log.message, log.tone);
    }
  } else if (appliedCount > 0 && resistedCount === 0) {
    deps.appendCombatLog(`${def.name} aplicado (${skillName}).`, "success");
  } else if (appliedCount > 0) {
    deps.appendCombatLog(
      `${def.name} aplicado a ${appliedCount} objetivo(s); ${resistedCount} resistió.`,
      "success",
    );
  } else if (resistedCount > 0) {
    deps.appendCombatLog(`El objetivo resistió ${def.name}.`, "default");
  }
}

  function applyPlayerEnemyTimedStatDebuff(
  effect: Record<string, unknown>,
  skillName: string,
  livingEnemies: CombatEncounterEnemyView[],
) {
    const deps = depsRef.current;
  const durationTurns = deps.parseEffectDurationTurns(effect);
  const enemyParts = deps.playerSelfBuffPartsToEnemyStatParts(
    deps.resolvePlayerSelfBuffParts(effect, deps.getCombatStatValueForSkills),
  );
  if (durationTurns == null || enemyParts.length === 0) {
    deps.appendCombatLog(`No se pudo aplicar el efecto de ${skillName}.`, "default");
    return;
  }

  const targets = resolvePlayerSkillEffectTargetsForPlayer(
    parsePlayerSkillEffectTarget(effect.target, "enemy"),
    deps.selectedEnemy,
    livingEnemies,
  );
  if (targets.enemies.length === 0) {
    deps.appendCombatLog("No hay enemigos válidos para el efecto.", "default");
    return;
  }

  const stateIcons = deps.getEffectStateIcons(effect);
  const newRows: EnemyTimedStatBuff[] = targets.enemies.map((enemy, index) => ({
    id: `player:${skillName}:${enemy.id}:${deps.turn}:${index}:${Math.random().toString(36).slice(2, 9)}`,
    enemyId: enemy.id,
    parts: enemyParts,
    remainingTurns: durationTurns,
    lastTickTurn: deps.turn,
    skillName,
    stateIcons,
  }));

  const stacked = stackEnemyTimedStatBuffs(deps.enemyTimedStatBuffsRef.current, newRows, deps.turn);
  deps.enemyTimedStatBuffsRef.current = stacked;
  deps.setEnemyTimedStatBuffs(stacked);

  const affectedNames = targets.enemies.map((e) => e.name).join(", ");
  const hasSpeedDebuff = enemyParts.some((p) => p.stat === "speed" && p.amount < 0);
  deps.appendCombatLog(
    targets.enemies.length === 1
      ? hasSpeedDebuff
        ? `${affectedNames} está ralentizado.`
        : `${affectedNames} recibe el efecto de ${skillName}.`
      : hasSpeedDebuff
        ? `${affectedNames} están ralentizados.`
        : `${affectedNames} reciben el efecto de ${skillName}.`,
    "success",
  );
}

  function runPlayerSkillDamageEffectOnly(
  skillEntry: CombatPlayerSkillView,
  damageEffect: Record<string, unknown>,
  appendSpellLog: (damageDealtForHighlight: number, enemyHitName?: string | null) => void,
): number {
    const deps = depsRef.current;
  const damageTypes = deps.getEffectDamageTypes(damageEffect);
  const resistWeakTags = deps.getEffectAttackTypesForResistWeak(
    damageEffect,
    deps.effectivePlayerWeaponAttackFamily,
  );
  const magicalCombatDamageFlat = Math.max(
    0,
    Math.trunc(
      deps.playerCombatMagicDamageMinBonus +
        deps.playerCombatMagicDamageMaxBonus +
        deps.timedBuffBonusByStat.magic_damage_min +
        deps.timedBuffBonusByStat.magic_damage_max,
    ),
  );
  const effectiveWeaponDamageMin = Math.max(
    1,
    Math.floor(
      deps.playerWeaponDamageMin +
        deps.playerCombatWeaponDamageMinBonus +
        deps.timedBuffBonusByStat.weapon_damage_min,
    ),
  );
  const effectiveWeaponDamageMax = Math.max(
    effectiveWeaponDamageMin,
    Math.floor(
      deps.playerWeaponDamageMax +
        deps.playerCombatWeaponDamageMaxBonus +
        deps.timedBuffBonusByStat.weapon_damage_max,
    ),
  );
  const skillDamageBases: PlayerSkillDamageBaseBounds = {
    weaponMin: effectiveWeaponDamageMin,
    weaponMax: effectiveWeaponDamageMax,
    magicMin: deps.playerMagicDamageMin,
    magicMax: deps.playerMagicDamageMax,
  };

  const needsSingle =
    parsePlayerSkillEffectTarget(damageEffect.target, "enemy") === "enemy";
  const isArea = deps.playerSkillDamageHitsAllEnemies(damageEffect);

  if (needsSingle && !isArea) {
    const target = deps.selectedEnemy;
    if (!target || target.hp <= 0) return 0;
    const mitigatedFinal = deps.computePlayerSkillMitigatedDamageToEnemy(damageEffect, target, {
      getCombatStatValue: deps.getCombatStatValueForSkills,
      skillDamageBases,
      magicalCombatDamageFlat,
      resistWeakTags,
      consumableWeaponMitigation: deps.consumableWeaponMitigation,
      enemyResistancesResolved: deps.mergedEnemyResistancesForPlayerAttack(
        target,
        deps.enemySelfTimedModifiers,
      ),
      weaknessesResolved: deps.mergedEnemyWeaknessesForPlayerAttack(
        target,
        deps.enemyPlayerTimedEffects,
        deps.enemySelfTimedModifiers,
        deps.collectWeaknessTagsFromDamageSkillScalings(damageEffect),
      ),
      enemyStatBonuses: deps.getEnemyStatBonuses(target.id),
    });
    const damageDone = Math.min(mitigatedFinal, target.hp);
    deps.setDisplayEnemies((prev) =>
      prev.map((enemy) =>
        enemy.id === target.id ? { ...enemy, hp: enemy.hp - damageDone } : enemy,
      ),
    );
    deps.recordPlayerDamageDealt(damageDone);
    if (damageDone > 0 && target.hp - damageDone <= 0) {
      deps.appendCombatLog(`Has matado a ${target.name}.`, "success");
      deps.setSelectedEnemyId(null);
    }
    return damageDone;
  }

  let total = 0;
  for (const enemy of deps.displayEnemies) {
    if (enemy.hp <= 0) continue;
    const mitigatedFinal = deps.computePlayerSkillMitigatedDamageToEnemy(damageEffect, enemy, {
      getCombatStatValue: deps.getCombatStatValueForSkills,
      skillDamageBases,
      magicalCombatDamageFlat,
      resistWeakTags,
      consumableWeaponMitigation: deps.consumableWeaponMitigation,
      enemyResistancesResolved: deps.mergedEnemyResistancesForPlayerAttack(
        enemy,
        deps.enemySelfTimedModifiers,
      ),
      weaknessesResolved: deps.mergedEnemyWeaknessesForPlayerAttack(
        enemy,
        deps.enemyPlayerTimedEffects,
        deps.enemySelfTimedModifiers,
        deps.collectWeaknessTagsFromDamageSkillScalings(damageEffect),
      ),
      enemyStatBonuses: deps.getEnemyStatBonuses(enemy.id),
    });
    const damageDone = Math.min(mitigatedFinal, enemy.hp);
    total += damageDone;
    deps.setDisplayEnemies((prev) =>
      prev.map((e) => (e.id === enemy.id ? { ...e, hp: e.hp - damageDone } : e)),
    );
    deps.recordPlayerDamageDealt(damageDone);
  }
  return total;
}

/** Elige una habilidad (efectos de combate: próximo paso). */
  function handlePlayerSkillChosen(skillEntry: CombatPlayerSkillView) {
    const deps = depsRef.current;
  if (!canUsePlayerSkill(skillEntry)) return;

  const effect = skillEntry.skill.effect;
  const steps = expandPlayerSkillEffectSteps(effect);

  const effectTypeRaw = typeof effect.type === "string" ? effect.type.trim().toLowerCase() : "";
  const damageKind = deps.getPlayerSkillDamageEffectKind(effect);
  const damageTypes = deps.getEffectDamageTypes(effect);
  const resistWeakTags = deps.getEffectAttackTypesForResistWeak(
    effect,
    deps.effectivePlayerWeaponAttackFamily,
  );

  const descTemplateRaw = effect.description;
  const descTemplate =
    typeof descTemplateRaw === "string" && descTemplateRaw.trim().length > 0
      ? descTemplateRaw.trim()
      : null;

  deps.setDisplayPlayerMana((m) => Math.max(0, m - Math.max(0, skillEntry.skill.manaCost)));
  applyPlayerSkillCooldown(skillEntry);

  const appendSpellLog = (damageDealtForHighlight: number, enemyHitName?: string | null) => {
    const text =
      descTemplate != null
        ? deps.formatPlayerSkillCombatLogDescription(
            descTemplate,
            damageDealtForHighlight,
            enemyHitName,
            damageTypes,
          )
        : damageDealtForHighlight > 0
          ? `Usás ${skillEntry.skill.name} e infligís ${damageDealtForHighlight} de daño.`
          : `Usás ${skillEntry.skill.name}.`;
    deps.appendCombatLog(
      text,
      "default",
      damageDealtForHighlight > 0 ? damageDealtForHighlight : undefined,
    );
  };

  if (playerSkillStepsNeedCompositeHandler(steps)) {
    const livingEnemies = deps.displayEnemies.filter((e) => e.hp > 0);
    for (const step of steps) {
      if (step.mode === "apply_condition") {
        applyPlayerConditionDebuff(step, skillEntry.skill.name, livingEnemies, effect);
      } else if (step.mode === "raw" && deps.isPlayerEnemyTimedStatEffect(step.effect)) {
        applyPlayerEnemyTimedStatDebuff(step.effect, skillEntry.skill.name, livingEnemies);
      }
    }
    const damageStep = steps.find(
      (s): s is { mode: "raw"; effect: Record<string, unknown> } =>
        s.mode === "raw" && deps.getPlayerSkillDamageEffectKind(s.effect) !== "none",
    );
    const totalDamage =
      damageStep != null
        ? runPlayerSkillDamageEffectOnly(skillEntry, damageStep.effect, appendSpellLog)
        : 0;
    if (damageStep == null) {
      appendSpellLog(0);
    } else {
      appendSpellLog(totalDamage, deps.selectedEnemy?.name ?? null);
    }
    deps.scheduleAdvanceTurn();
    return;
  }

  if (deps.isPlayerEnemyTimedStatEffect(effect)) {
    const livingEnemies = deps.displayEnemies.filter((e) => e.hp > 0);
    applyPlayerEnemyTimedStatDebuff(effect, skillEntry.skill.name, livingEnemies);
    if (descTemplate != null) {
      deps.appendCombatLog(
        deps.formatPlayerSkillCombatLogDescription(descTemplate, 0, null, damageTypes),
        "default",
      );
    }
    deps.scheduleAdvanceTurn();
    return;
  }

  if (effectTypeRaw === "buff" && deps.isPlayerSelfBuffEffect(effect)) {
    const durationTurns = deps.parseEffectDurationTurns(effect);
    const parts = deps.resolvePlayerSelfBuffParts(effect, deps.getCombatStatValueForSkills);
    const stateIconsList = deps.getEffectStateIcons(effect);
    const { timedParts, instantParts } = deps.splitSelfBuffPartsForTimedAndInstant(parts, durationTurns);

    if (timedParts.length > 0 && durationTurns != null) {
      deps.setPlayerTimedSelfBuffs((prev) => [
        ...prev,
        {
          id: `${skillEntry.userCharacterSkillId}:${deps.turn}:${prev.length}`,
          parts: timedParts as PlayerTimedSelfBuff["parts"],
          remainingTurns: durationTurns,
          lastTickTurn: deps.turn,
          skillName: skillEntry.skill.name,
          stateIcons: stateIconsList,
        },
      ]);
    }

    for (const p of instantParts) {
      const a = Math.trunc(p.amount);
      if (a === 0) continue;
      switch (p.stat) {
        case "armor":
          deps.setPlayerCombatArmorBonus((v) => v + a);
          break;
        case "mr":
          deps.setPlayerCombatMrBonus((v) => v + a);
          break;
        case "hp":
          if (a > 0) {
            const cap = Math.max(1, deps.playerHpMax);
            const prevHp = deps.playerCurrentHp;
            const nextHp = Math.min(cap, prevHp + a);
            deps.setPlayerCurrentHp(nextHp);
            deps.recordPlayerHealing(Math.max(0, nextHp - prevHp));
          }
          break;
        case "mana":
          deps.setDisplayPlayerMana((m) =>
            Math.min(Math.max(0, deps.playerManaMax), Math.max(0, m + a)),
          );
          break;
        case "speed":
          deps.setPlayerCombatSpeedBonus((v) => v + a);
          break;
        case "weapon_damage_min":
          deps.setPlayerCombatWeaponDamageMinBonus((v) => v + a);
          break;
        case "weapon_damage_max":
          deps.setPlayerCombatWeaponDamageMaxBonus((v) => v + a);
          break;
        case "magic_damage_min":
          deps.setPlayerCombatMagicDamageMinBonus((v) => v + a);
          break;
        case "magic_damage_max":
          deps.setPlayerCombatMagicDamageMaxBonus((v) => v + a);
          break;
        default:
          break;
      }
    }

    const buffText =
      descTemplate != null
        ? deps.formatPlayerSelfBuffCombatLog(descTemplate, parts, durationTurns)
        : `Usás ${skillEntry.skill.name}.`;
    deps.appendCombatLog(buffText, "default");
    deps.scheduleAdvanceTurn();
    return;
  }

  if (damageKind === "none") {
    appendSpellLog(0);
    deps.scheduleAdvanceTurn();
    return;
  }

  const magicalCombatDamageFlat = Math.max(
    0,
    Math.trunc(
      deps.playerCombatMagicDamageMinBonus +
        deps.playerCombatMagicDamageMaxBonus +
        deps.timedBuffBonusByStat.magic_damage_min +
        deps.timedBuffBonusByStat.magic_damage_max,
    ),
  );
  const effectiveWeaponDamageMin = Math.max(
    1,
    Math.floor(
      deps.playerWeaponDamageMin +
        deps.playerCombatWeaponDamageMinBonus +
        deps.timedBuffBonusByStat.weapon_damage_min,
    ),
  );
  const effectiveWeaponDamageMax = Math.max(
    effectiveWeaponDamageMin,
    Math.floor(
      deps.playerWeaponDamageMax +
        deps.playerCombatWeaponDamageMaxBonus +
        deps.timedBuffBonusByStat.weapon_damage_max,
    ),
  );
  const skillDamageBases: PlayerSkillDamageBaseBounds = {
    weaponMin: effectiveWeaponDamageMin,
    weaponMax: effectiveWeaponDamageMax,
    magicMin: deps.playerMagicDamageMin,
    magicMax: deps.playerMagicDamageMax,
  };

  const pushTimedEnemyFromDamageSkill = (enemyId: string, eff: Record<string, unknown>) => {
    const durationTurns = deps.parseEffectDurationTurns(eff);
    const weakTags = deps.collectWeaknessTagsFromDamageSkillScalings(eff);
    const stateIcons = deps.getEffectStateIcons(eff);
    const dk = deps.getPlayerSkillDamageEffectKind(eff);
    if (durationTurns == null || durationTurns <= 0) return;
    if (weakTags.length === 0 && dk !== "damage_dot" && stateIcons.length === 0) return;
    const dotTicksRemaining = dk === "damage_dot" ? Math.max(0, durationTurns - 1) : 0;
    deps.setEnemyPlayerTimedEffects((prev) => [
      ...prev,
      {
        id: `${skillEntry.userCharacterSkillId}:${enemyId}:${deps.turn}:${prev.length}`,
        enemyId,
        debuffRemainingTurns: durationTurns,
        dotTicksRemaining,
        lastTickTurn: deps.turn,
        skillName: skillEntry.skill.name,
        stateIcons,
        extraWeaknessTags: weakTags,
        dotEffectJson: dk === "damage_dot" ? { ...eff } : null,
      },
    ]);
  };

  const needsSingleEnemy = deps.playerSkillRequiresSingleEnemySelection(skillEntry);
  const isArea = deps.playerSkillDamageHitsAllEnemies(effect);

  if (needsSingleEnemy && !isArea) {
    const target = deps.selectedEnemy;
    if (!target || target.hp <= 0) return;

    const weakThis = deps.collectWeaknessTagsFromDamageSkillScalings(effect);
    const weaknessesResolved = deps.mergedEnemyWeaknessesForPlayerAttack(
      target,
      deps.enemyPlayerTimedEffects,
      deps.enemySelfTimedModifiers,
      weakThis,
    );
    const enemyResistancesResolved = deps.mergedEnemyResistancesForPlayerAttack(
      target,
      deps.enemySelfTimedModifiers,
    );
    const mitigatedFinal = deps.computePlayerSkillMitigatedDamageToEnemy(effect, target, {
      getCombatStatValue: deps.getCombatStatValueForSkills,
      skillDamageBases,
      magicalCombatDamageFlat,
      resistWeakTags,
      consumableWeaponMitigation: deps.consumableWeaponMitigation,
      enemyResistancesResolved,
      weaknessesResolved,
      enemyStatBonuses: deps.getEnemyStatBonuses(target.id),
    });
    const damageDone = Math.min(mitigatedFinal, target.hp);
    const updatedHp = target.hp - damageDone;
    deps.recordPlayerDamageDealt(damageDone);

    deps.setDisplayEnemies((prev) =>
      prev.map((enemy) =>
        enemy.id === target.id ? { ...enemy, hp: updatedHp } : enemy,
      ),
    );
    pushTimedEnemyFromDamageSkill(target.id, effect);
    appendSpellLog(damageDone, target.name);
    if (updatedHp === 0) {
      deps.appendCombatLog(`Has matado a ${target.name}.`, "success");
      deps.setSelectedEnemyId(null);
    }
    deps.scheduleAdvanceTurn();
    return;
  }

  const aliveTargets = deps.displayEnemies.filter((enemy) => enemy.hp > 0);
  if (aliveTargets.length === 0) {
    appendSpellLog(0);
    deps.scheduleAdvanceTurn();
    return;
  }

  let clearedSelection = false;
  const combatRows: Array<{ enemyId: string; hpNext: number; text: string; dmg: number }> = [];
  const timedEnemyRows: PlayerEnemyTimedEffect[] = [];

  for (const enemy of deps.displayEnemies) {
    if (enemy.hp <= 0) continue;
    const weakThis = deps.collectWeaknessTagsFromDamageSkillScalings(effect);
    const weaknessesResolved = deps.mergedEnemyWeaknessesForPlayerAttack(
      enemy,
      deps.enemyPlayerTimedEffects,
      deps.enemySelfTimedModifiers,
      weakThis,
    );
    const enemyResistancesResolved = deps.mergedEnemyResistancesForPlayerAttack(
      enemy,
      deps.enemySelfTimedModifiers,
    );
    const mitigatedFinal = deps.computePlayerSkillMitigatedDamageToEnemy(effect, enemy, {
      getCombatStatValue: deps.getCombatStatValueForSkills,
      skillDamageBases,
      magicalCombatDamageFlat,
      resistWeakTags,
      consumableWeaponMitigation: deps.consumableWeaponMitigation,
      enemyResistancesResolved,
      weaknessesResolved,
      enemyStatBonuses: deps.getEnemyStatBonuses(enemy.id),
    });
    const damageDone = Math.min(mitigatedFinal, enemy.hp);
    const hpNext = enemy.hp - damageDone;
    deps.recordPlayerDamageDealt(damageDone);
    if (enemy.id === deps.selectedEnemyId && hpNext <= 0) clearedSelection = true;
    const text =
      descTemplate != null
        ? deps.formatPlayerSkillCombatLogDescription(descTemplate, damageDone, enemy.name, damageTypes)
        : `Usás ${skillEntry.skill.name} e infligís ${damageDone} de daño a ${enemy.name}.`;
    combatRows.push({ enemyId: enemy.id, hpNext, text, dmg: damageDone });

    const durationTurns = deps.parseEffectDurationTurns(effect);
    const weakTags = deps.collectWeaknessTagsFromDamageSkillScalings(effect);
    const stateIcons = deps.getEffectStateIcons(effect);
    const dk = deps.getPlayerSkillDamageEffectKind(effect);
    if (durationTurns != null && durationTurns > 0) {
      if (weakTags.length > 0 || dk === "damage_dot" || stateIcons.length > 0) {
        const dotTicksRemaining = dk === "damage_dot" ? Math.max(0, durationTurns - 1) : 0;
        timedEnemyRows.push({
          id: `${skillEntry.userCharacterSkillId}:${enemy.id}:${deps.turn}:${timedEnemyRows.length}`,
          enemyId: enemy.id,
          debuffRemainingTurns: durationTurns,
          dotTicksRemaining,
          lastTickTurn: deps.turn,
          skillName: skillEntry.skill.name,
          stateIcons,
          extraWeaknessTags: weakTags,
          dotEffectJson: dk === "damage_dot" ? { ...effect } : null,
        });
      }
    }
  }

  deps.setDisplayEnemies((prev) =>
    prev.map((enemy) => {
      const hit = combatRows.find((row) => row.enemyId === enemy.id);
      return hit ? { ...enemy, hp: hit.hpNext } : enemy;
    }),
  );
  if (timedEnemyRows.length > 0) {
    deps.setEnemyPlayerTimedEffects((prev) => [...prev, ...timedEnemyRows]);
  }
  for (const row of combatRows) {
    deps.appendCombatLog(row.text, "default", row.dmg);
    if (row.hpNext === 0) {
      const name =
        deps.displayEnemies.find((e) => e.id === row.enemyId)?.name ?? "Enemigo";
      deps.appendCombatLog(`Has matado a ${name}.`, "success");
    }
  }
  if (clearedSelection) deps.setSelectedEnemyId(null);

  deps.scheduleAdvanceTurn();
}
  function handleAttack() {
    const deps = depsRef.current;
  if (deps.isTurnTransitioning) return;
  if (!deps.isPlayerTurn) {
    deps.appendCombatLog("Todavia no es tu turno.");
    return;
  }
  const target = deps.selectedEnemy;
  if (!target) {
    deps.appendCombatLog("Seleccioná un enemigo para atacar.");
    return;
  }
  if (target.hp <= 0) {
    deps.appendCombatLog(`${target.name} ya está derrotado.`);
    return;
  }
  if (deps.requiresAmmo && !deps.selectedAmmoItem) {
    deps.appendCombatLog("Seleccioná munición compatible para atacar.");
    return;
  }

  const damageMin = Math.max(
    1,
    Math.floor(
      deps.playerWeaponDamageMin +
        deps.playerCombatWeaponDamageMinBonus +
        deps.timedBuffBonusByStat.weapon_damage_min,
    ),
  );
  const damageMax = Math.max(
    damageMin,
    Math.floor(
      deps.playerWeaponDamageMax +
        deps.playerCombatWeaponDamageMaxBonus +
        deps.timedBuffBonusByStat.weapon_damage_max,
    ),
  );
  let rawDamage = randomIntInclusive(damageMin, damageMax);
  let attackFamilyForHit = deps.effectivePlayerWeaponAttackFamily;

  let ammoItemForAttack: CombatAmmoMenuEntry | null = null;
  let ammoAttackType: AmmoAttackType | null = null;
  if (deps.requiresAmmo && deps.selectedAmmoItem) {
    const selectedAmmo = deps.selectedAmmoItem;
    const parsedAmmo = parseAmmoEffect(selectedAmmo.effect);
    if (!parsedAmmo) {
      deps.appendCombatLog("La munición seleccionada no es válida.", "danger");
      return;
    }
    ammoItemForAttack = selectedAmmo;
    rawDamage += rollAmmoDamage(parsedAmmo);
    attackFamilyForHit = resolveAmmoAttackFamilyForHit(parsedAmmo);
    ammoAttackType = resolveAmmoAttackTypeForHit(parsedAmmo);

    if (!selectedAmmo.isDefaultAmmo) {
      deps.setCombatConsumables((prev) =>
        prev
          .map((entry) =>
            entry.inventoryId === selectedAmmo.inventoryId
              ? { ...entry, quantity: Math.max(0, entry.quantity - 1) }
              : entry,
          )
          .filter((entry) => entry.quantity > 0),
      );
      deps.recordAmmoSpentInCombat(selectedAmmo.inventoryId, 1);
    }
  }

  const mitigationAttackType: AmmoAttackType =
    ammoAttackType ??
    (deps.weaponAttackFamilyOverride?.attackType === "magical" ? "magical" : "physical");

  const targetBonuses = deps.getEnemyStatBonuses(target.id);
  const enemyDefenseForHit =
    mitigationAttackType === "magical"
      ? effectiveEnemyMr(target, targetBonuses)
      : effectiveEnemyArmor(target, targetBonuses);
  const afterArmor =
    mitigationAttackType === "magical"
      ? mitigateDamageByMr(rawDamage, enemyDefenseForHit)
      : mitigateDamageByDefense(rawDamage, enemyDefenseForHit);
  const resistMerged = deps.mergedEnemyResistancesForPlayerAttack(target, deps.enemySelfTimedModifiers);
  const weakMerged = deps.mergedEnemyWeaknessesForPlayerAttack(
    target,
    deps.enemyPlayerTimedEffects,
    deps.enemySelfTimedModifiers,
    [],
  );
  const mitigated = applyEnemyAttackFamilyToMitigatedDamage(
    afterArmor,
    attackFamilyForHit,
    resistMerged,
    weakMerged,
  );
  const updatedHp = Math.max(0, target.hp - mitigated);
  const damageDone = target.hp - updatedHp;
  deps.recordPlayerDamageDealt(damageDone);
  deps.setDisplayEnemies((prev) =>
    prev.map((enemy) => (enemy.id === target.id ? { ...enemy, hp: updatedHp } : enemy)),
  );
  const ammoSuffix =
    ammoItemForAttack != null ? ` (con ${ammoItemForAttack.name})` : "";
  deps.appendCombatLog(
    `Atacaste a ${target.name}${ammoSuffix} y le infligiste ${damageDone} de daño.`,
    "default",
    damageDone,
  );
  if (updatedHp === 0) {
    deps.appendCombatLog(`Has matado a ${target.name}.`, "success");
    deps.setSelectedEnemyId(null);
  }
  deps.scheduleAdvanceTurn();
}

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
