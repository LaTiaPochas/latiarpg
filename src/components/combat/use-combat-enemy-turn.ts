"use client";

import { useEffect, type MutableRefObject } from "react";
import type { ParsedEnemySkillEffect, PlayerSkillEffectSubtype } from "@/lib/enemy-skill-combat";
import type {
  EnemyAppliedPlayerTimedModifier,
  EnemySelfTimedModifier,
  EnemyTimedStatBuff,
} from "@/components/combat/combat-timed-effect-types";
import type { CombatEncounterEnemySkill } from "@/components/combat/types";
import type { CombatEnemyTurnWatch } from "@/components/combat/combat-enemy-turn-watch";
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

export function useCombatEnemyTurn(
  depsRef: MutableRefObject<CombatEnemyTurnDeps>,
  watch: CombatEnemyTurnWatch,
) {
  const {
    atbActionSeq,
    combatOutcome,
    isInitialCombatDelay,
    isPlayerTurn,
    isTurnTransitioning,
    playerCurrentHp,
    playerDisplayName,
    currentActor,
    currentActorId,
    displayEnemies,
    effectivePlayerArmor,
    effectivePlayerMr,
    debugEnemy,
    turn,
  } = watch;
  function pickAvailableEnemySkill(enemy: CombatEncounterEnemyView): EnemySkillDecision | null {
    const deps = depsRef.current;
    const skillState = deps.enemySkillNextAvailableTurn[enemy.id] ?? {};
  for (const skill of enemy.skills) {
    const nextAvailableTurn = skillState[skill.id] ?? 1;
    if (deps.turn < nextAvailableTurn) continue;
    if (effectiveEnemyMana(enemy, deps.getEnemyStatBonuses(enemy.id)) < skill.manaCost) continue;
    const root = skill.parsedEffect;
    if (!enemySkillMatchesUseWhen(enemy.hp, enemy.hpMax, parsedEnemySkillUseWhen(root))) continue;
    const chance = parsedEnemySkillChance(root);
    const roll = Math.random();
    return {
      chosenSkill: roll <= chance ? skill : null,
      evaluatedSkill: skill,
      roll,
      chance,
      nextAvailableTurn,
    };
  }
  return null;
}

/** Sueño / parálisis / stun: tira despertar si aplica; logs y opcional skip de turno. */
  function resolveSkipTurnConditionsForActor(
    targetKind: "player" | "enemy",
    targetId: string,
    affectedName: string,
  ): boolean {
    const deps = depsRef.current;
    const result = evaluateSkipTurnConditionsAtTurnStart(
    deps.activeCombatConditionsRef.current,
    targetKind,
    targetId,
    affectedName,
  );

  if (result.removeConditionIds.length > 0) {
    deps.setActiveCombatConditions((prev) =>
      prev.filter((c) => !result.removeConditionIds.includes(c.id)),
    );
  }

  for (const log of result.logs) {
    deps.appendCombatLog(log.message, log.tone);
  }

  if (result.shouldSkipTurn) {
    deps.scheduleAdvanceTurn();
    return true;
  }
  return false;
}

useEffect(() => {
    const deps = depsRef.current;
  if (deps.combatOutcome !== "active") return;
  if (!deps.isPlayerTurn || deps.isTurnTransitioning || deps.isInitialCombatDelay) return;
  if (deps.playerCurrentHp <= 0) return;
  if (!targetHasSkipTurnCondition(deps.activeCombatConditionsRef.current, "player", "player")) {
    return;
  }
  const skipKey = `player-skip:${deps.atbActionSeq}`;
  if (deps.playerSkipTurnResolvedRef.current === skipKey) return;
  deps.playerSkipTurnResolvedRef.current = skipKey;

  resolveSkipTurnConditionsForActor("player", "player", deps.playerDisplayName);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- por acción ATB del PJ
}, [atbActionSeq, combatOutcome, isInitialCombatDelay, isPlayerTurn, isTurnTransitioning, playerCurrentHp, playerDisplayName]);

useEffect(() => {
    const deps = depsRef.current;
  if (deps.combatOutcome !== "active") return;
  if (!deps.currentActor || deps.currentActor.type !== "enemy") return;
  if (deps.isInitialCombatDelay) {
    deps.debugEnemy("turno-enemigo-esperando-intro", {
      turn: deps.turn,
      actorId: deps.currentActorId,
      enemyId: deps.currentActor.enemyId,
      isTurnTransitioning: deps.isTurnTransitioning,
    });
    return;
  }
  if (deps.playerCurrentHp <= 0) return;

  const resolvedKey = `${deps.atbActionSeq}:${deps.currentActorId ?? ""}`;
  if (deps.resolvedEnemyTurnRef.current === resolvedKey) return;
  deps.resolvedEnemyTurnRef.current = resolvedKey;

  deps.debugEnemy("turno-enemigo-ejecutando", {
    turn: deps.turn,
    atbActionSeq: deps.atbActionSeq,
    actorId: deps.currentActorId,
    enemyId: deps.currentActor.enemyId,
    isTurnTransitioning: deps.isTurnTransitioning,
  });

  const enemy = deps.displayEnemies.find((entry) => entry.id === deps.currentActor!.enemyId);
  if (!enemy || enemy.hp <= 0) {
    deps.scheduleAdvanceTurn();
    return;
  }

  if (targetHasSkipTurnCondition(deps.activeCombatConditionsRef.current, "enemy", enemy.id)) {
    if (resolveSkipTurnConditionsForActor("enemy", enemy.id, enemy.name)) {
      return;
    }
  }

  deps.setEnemyAttackLungeSeq((prev) => ({
    ...prev,
    [enemy.id]: (prev[enemy.id] ?? 0) + 1,
  }));

  const skillDecision = pickAvailableEnemySkill(enemy);
  const skill = skillDecision?.chosenSkill ?? null;

  const spendSkillResources = (sk: CombatEncounterEnemySkill) => {
    const nextTurnForSkill = deps.turn + Math.max(1, sk.cooldownTurns);
    deps.setEnemySkillNextAvailableTurn((prev) => ({
      ...prev,
      [enemy.id]: {
        ...(prev[enemy.id] ?? {}),
        [sk.id]: nextTurnForSkill,
      },
    }));
    deps.setDisplayEnemies((prev) =>
      prev.map((entry) =>
        entry.id === enemy.id
          ? { ...entry, mana: Math.max(0, entry.mana - Math.max(0, sk.manaCost)) }
          : entry,
      ),
    );
  };

  let simPlayerHp = deps.playerCurrentHp;
  const applyPlayerDamageTaken = (amount: number) => {
    const d = Math.max(0, Math.trunc(amount));
    if (d <= 0) return;
    deps.recordPlayerDamageTaken(d);
    simPlayerHp = Math.max(0, simPlayerHp - d);
    deps.setPlayerCurrentHp(simPlayerHp);
  };

  if (skill) {
    spendSkillResources(skill);
    const root = skill.parsedEffect;
    let livePlayerMods = [...deps.enemyAppliedPlayerTimedModifiersRef.current];
    let simEnemyHp = enemy.hp;
    const enemyHpMaxSafe = Math.max(1, Math.trunc(enemy.hpMax));

    const appendEnemySkillLog = (
      template: string,
      damageAmt: number,
      dmgTypes: string[] = [],
    ) => {
      const t = template.trim();
      if (!t) return;
      const hadDamagePh = enemySkillCombatLogHadDamagePlaceholder(t);
      const logText = formatEnemySkillCombatLogDescription(
        t,
        damageAmt,
        enemy.name,
        dmgTypes,
        deps.playerDisplayName,
      );
      deps.appendCombatLog(
        logText,
        "danger",
        undefined,
        hadDamagePh ? Math.max(0, Math.trunc(damageAmt)) : undefined,
      );
    };

    let enemySkillDescriptionLogged = false;
    const skillLogDescription = resolveEnemySkillLogDescription(
      skill.description,
      root,
    );
    const tryLogEnemySkillDescription = (
      damageAmt: number,
      dmgTypes: string[] = [],
    ) => {
      if (enemySkillDescriptionLogged) return;
      const descRaw = skillLogDescription?.trim();
      if (!descRaw) {
        deps.debugEnemy("skill-sin-descripcion-log", {
          enemy: enemy.name,
          skill: skill.name,
          skillId: skill.id,
          columnDescription: skill.description,
          effectLogDescription:
            root.mode === "composite" ? root.logDescription : null,
        });
        return;
      }
      enemySkillDescriptionLogged = true;
      appendEnemySkillLog(descRaw, damageAmt, dmgTypes);
    };

    const getEnemyStatBonusesDuringSkill = (enemyId: string) =>
      sumEnemyTimedStatBonuses(deps.enemyTimedStatBuffsRef.current, enemyId);

    /** Daño al PJ en este cast (para `heal_basis: damage_dealt_to_player` en composite). */
    const enemySkillCastCtx = { playerDamageDealt: 0 };

    const resolveEnemyHealAmount = (leaf: Extract<ParsedEnemySkillEffect, { mode: "heal" }>) => {
      if (leaf.healBasis === "damage_dealt_to_player") {
        return Math.max(0, Math.trunc(enemySkillCastCtx.playerDamageDealt));
      }
      return Math.max(0, randomIntInclusive(leaf.min, leaf.max));
    };

    const runLeaf = (
      leaf: ParsedEnemySkillEffect,
      rollLeafChance: boolean,
      opts?: { suppressPlayerDamageLog?: boolean },
    ): number => {
      if (leaf.mode === "composite") {
        if (rollLeafChance && Math.random() > leaf.chance) return 0;
        const skillDesc = skillLogDescription?.trim() ?? "";
        const suppressHits =
          skillDesc.length > 0 || Boolean(opts?.suppressPlayerDamageLog);
        let totalPlayerDamage = 0;
        const orderedSteps = orderCompositeStepsForExecution(leaf.steps);
        enemySkillCastCtx.playerDamageDealt = 0;
        deps.debugEnemy("composite-inicio", {
          enemy: enemy.name,
          skill: skill.name,
          stepOrder: orderedSteps.map((s) => s.mode),
          buffsActivosAntes: getEnemyStatBonusesDuringSkill(enemy.id),
        });
        for (const step of orderedSteps) {
          totalPlayerDamage += runLeaf(step, true, {
            suppressPlayerDamageLog: suppressHits,
          });
        }
        if (!opts?.suppressPlayerDamageLog) {
          tryLogEnemySkillDescription(totalPlayerDamage);
        }
        deps.debugEnemy("composite-fin", {
          enemy: enemy.name,
          skill: skill.name,
          totalPlayerDamage,
          buffsActivosDespues: getEnemyStatBonusesDuringSkill(enemy.id),
          logEscrito: enemySkillDescriptionLogged,
        });
        return totalPlayerDamage;
      }
      if (!enemySkillMatchesUseWhen(simEnemyHp, enemyHpMaxSafe, parsedEnemySkillUseWhen(leaf))) {
        return 0;
      }
      if (rollLeafChance && Math.random() > parsedEnemySkillChance(leaf)) return 0;

      const livingEnemyTargets = deps.displayEnemiesRef.current.filter((e) => e.hp > 0);

      switch (leaf.mode) {
        case "damage": {
          let playerDamage = 0;
          const dmgTargets = resolveEnemySkillEffectTargets(
            leaf.target,
            enemy.id,
            livingEnemyTargets,
          );
          if (dmgTargets.hitPlayer) {
            const incomingSubtype = enemySkillIncomingSubtypeFromParsed(leaf);
            const rawDamageRoll = Math.max(
              0,
              rollEnemySkillRawDamage(
                leaf.min,
                leaf.max,
                leaf.damageBasis,
                deps.playerCurrentHp,
                deps.playerHpMax,
              ),
            );
            const defenseStat = playerDefenseStatVsIncoming(
              incomingSubtype,
              deps.effectivePlayerArmor,
              deps.effectivePlayerMr,
            );
            const afterDef = mitigateDamageBySubtype(rawDamageRoll, defenseStat, incomingSubtype);
            const rw = mergePlayerResistWeakForIncoming(
              deps.playerResistancesRef.current,
              deps.playerWeaknessesRef.current,
              livePlayerMods,
            );
            const damage = applyEnemyResistWeakTagsToMitigatedDamage(
              afterDef,
              leaf.damageTypes,
              rw.resistances,
              rw.weaknesses,
            );
            const d = Math.max(0, Math.trunc(damage));
            playerDamage += d;
            enemySkillCastCtx.playerDamageDealt += d;
            applyPlayerDamageTaken(d);
            if (!opts?.suppressPlayerDamageLog) {
              tryLogEnemySkillDescription(d, leaf.damageTypes);
            }
          }
          if (dmgTargets.enemies.length > 0) {
            const hpById = new Map<string, number>();
            for (const victim of dmgTargets.enemies) {
              const bonuses = deps.getEnemyStatBonuses(victim.id);
              const d = mitigatedEnemySkillDamageToEnemy(leaf, victim, bonuses);
              if (d <= 0) continue;
              const nextHp = Math.max(0, victim.hp - d);
              hpById.set(victim.id, nextHp);
              deps.appendCombatLog(
                `${enemy.name} inflige ${d} de daño a ${victim.name} (${skill.name}).`,
                "default",
              );
              if (victim.id === enemy.id) simEnemyHp = nextHp;
            }
            if (hpById.size > 0) {
              deps.setDisplayEnemies((prev) =>
                prev.map((e) => {
                  const nextHp = hpById.get(e.id);
                  return nextHp != null ? { ...e, hp: nextHp } : e;
                }),
              );
            }
          }
          return playerDamage;
        }
        case "weapon_attack": {
          let playerDamage = 0;
          const dmgTargets = resolveEnemySkillEffectTargets(
            leaf.target,
            enemy.id,
            livingEnemyTargets,
          );
          if (dmgTargets.hitPlayer) {
            const timedBonuses = getEnemyStatBonusesDuringSkill(enemy.id);
            const attackRange = effectiveEnemyAttackRange(enemy, timedBonuses);
            const rawDamageRoll = Math.max(
              0,
              randomIntInclusive(attackRange.min, attackRange.max),
            );

            const incomingSubtype = enemySkillIncomingSubtypeFromParsed(leaf);
            const defenseStat = playerDefenseStatVsIncoming(
              incomingSubtype,
              deps.effectivePlayerArmor,
              deps.effectivePlayerMr,
            );
            const afterDef = mitigateDamageBySubtype(rawDamageRoll, defenseStat, incomingSubtype);
            const rw = mergePlayerResistWeakForIncoming(
              deps.playerResistancesRef.current,
              deps.playerWeaknessesRef.current,
              livePlayerMods,
            );
            const damage = applyEnemyResistWeakTagsToMitigatedDamage(
              afterDef,
              leaf.damageTypes,
              rw.resistances,
              rw.weaknesses,
            );
            const d = Math.max(0, Math.trunc(damage));
            playerDamage += d;
            enemySkillCastCtx.playerDamageDealt += d;
            deps.debugEnemy("weapon_attack", {
              enemy: enemy.name,
              skill: skill.name,
              baseMin: enemy.attackMin,
              baseMax: enemy.attackMax,
              bonusAttackMin: timedBonuses.attackMin,
              bonusAttackMax: timedBonuses.attackMax,
              rangoFinal: attackRange,
              tiradaBruta: rawDamageRoll,
              trasDefensa: afterDef,
              danoFinal: d,
              damageTypes: leaf.damageTypes,
              filasBuffRef: deps.enemyTimedStatBuffsRef.current
                .filter((r) => r.enemyId === enemy.id)
                .map((r) => ({ skillName: r.skillName, parts: r.parts })),
            });
            applyPlayerDamageTaken(d);
            if (!opts?.suppressPlayerDamageLog) {
              tryLogEnemySkillDescription(d, leaf.damageTypes);
            }
          }
          return playerDamage;
        }
        case "heal": {
          const healTargets = resolveEnemySkillEffectTargets(
            leaf.target,
            enemy.id,
            livingEnemyTargets,
          );
          if (healTargets.hitPlayer) {
            const rolled = resolveEnemyHealAmount(leaf);
            deps.setPlayerCurrentHp((prev) => {
              const cap = Math.max(1, deps.playerHpMax);
              const next = Math.min(cap, prev + rolled);
              deps.recordPlayerHealing(Math.max(0, next - prev));
              return next;
            });
            if (!opts?.suppressPlayerDamageLog) {
              tryLogEnemySkillDescription(0);
            }
          }
          if (healTargets.enemies.length > 0) {
            const hpById = new Map<string, number>();
            let totalGained = 0;
            for (const recipient of healTargets.enemies) {
              const rolled = resolveEnemyHealAmount(leaf);
              const hpMax = Math.max(
                1,
                effectiveEnemyHpMax(recipient, deps.getEnemyStatBonuses(recipient.id)),
              );
              const nextHp = Math.min(hpMax, recipient.hp + rolled);
              const gained = Math.max(0, nextHp - recipient.hp);
              totalGained += gained;
              hpById.set(recipient.id, nextHp);
              if (recipient.id === enemy.id) simEnemyHp = nextHp;
            }
            if (hpById.size > 0) {
              deps.setDisplayEnemies((prev) =>
                prev.map((e) => {
                  const nextHp = hpById.get(e.id);
                  return nextHp != null ? { ...e, hp: nextHp } : e;
                }),
              );
            }
            deps.appendCombatLog(
              healTargets.enemies.length === 1
                ? `${enemy.name} recupera ${totalGained} PV (${skill.name}).`
                : `${enemy.name} recupera ${totalGained} PV en total (${skill.name}).`,
              totalGained > 0 ? "success" : "default",
            );
          }
          return 0;
        }
        case "apply_modifier": {
          const modTargets = resolveEnemySkillEffectTargets(
            leaf.target,
            enemy.id,
            livingEnemyTargets,
          );
          const idSuffix = `${skill.id}:${deps.turn}:${Math.random().toString(36).slice(2, 9)}`;
          if (modTargets.hitPlayer) {
            const row: EnemyAppliedPlayerTimedModifier = {
              id: `${enemy.id}:player:${idSuffix}`,
              remainingTurns: leaf.durationTurns,
              lastTickTurn: deps.turn,
              sourceSkillName: skill.name,
              stateIcons: leaf.stateIcons,
              extraWeaknessTags: leaf.weaknessTags,
              extraResistanceTags: leaf.resistanceTags,
            };
            livePlayerMods = stackPlayerTimedResistWeakModifiers(
              livePlayerMods,
              [row],
              deps.turn,
            );
            deps.setEnemyAppliedPlayerTimedModifiers((prev) =>
              stackPlayerTimedResistWeakModifiers(prev, [row], deps.turn),
            );
          }
          if (modTargets.enemies.length > 0) {
            const rows: EnemySelfTimedModifier[] = modTargets.enemies.map((recipient) => ({
              id: `${enemy.id}:${recipient.id}:${idSuffix}`,
              enemyId: recipient.id,
              remainingTurns: leaf.durationTurns,
              lastTickTurn: deps.turn,
              skillName: skill.name,
              stateIcons: leaf.stateIcons,
              resistanceTags: leaf.resistanceTags,
              weaknessTags: leaf.weaknessTags,
            }));
            deps.setEnemySelfTimedModifiers((prev) =>
              stackEnemySelfTimedResistWeakModifiers(prev, rows, deps.turn),
            );
          }
          if (!opts?.suppressPlayerDamageLog) {
            tryLogEnemySkillDescription(0);
          }
          return 0;
        }
        case "stat_buff": {
          const buffTargets = resolveEnemySkillEffectTargets(
            leaf.target,
            enemy.id,
            livingEnemyTargets,
          );
          const idSuffix = `${skill.id}:${deps.turn}:${Math.random().toString(36).slice(2, 9)}`;

          if (buffTargets.hitPlayer) {
            const playerTimedParts = enemyStatPartsToPlayerTimedParts(leaf.parts);
            if (playerTimedParts.length > 0) {
              deps.setPlayerTimedSelfBuffs((prev) => [
                ...prev,
                {
                  id: `${enemy.id}:player:${idSuffix}`,
                  parts: playerTimedParts,
                  remainingTurns: leaf.durationTurns,
                  lastTickTurn: deps.turn,
                  skillName: skill.name,
                  stateIcons: leaf.stateIcons,
                },
              ]);
            }
            for (const part of leaf.parts) {
              const amount = Math.trunc(part.amount);
              if (amount <= 0) continue;
              if (part.stat === "hp") {
                deps.setPlayerCurrentHp((prev) => {
                  const cap = Math.max(1, deps.playerHpMax);
                  const next = Math.min(cap, prev + amount);
                  deps.recordPlayerHealing(Math.max(0, next - prev));
                  return next;
                });
              } else if (part.stat === "mana") {
                deps.setDisplayPlayerMana((m) =>
                  Math.min(Math.max(0, deps.playerManaMax), Math.max(0, m + amount)),
                );
              }
            }
          }

          if (buffTargets.enemies.length > 0) {
            const newRows: EnemyTimedStatBuff[] = buffTargets.enemies.map((recipient) => ({
              id: `${enemy.id}:${recipient.id}:${idSuffix}`,
              enemyId: recipient.id,
              parts: leaf.parts,
              remainingTurns: leaf.durationTurns,
              lastTickTurn: deps.turn,
              skillName: skill.name,
              stateIcons: leaf.stateIcons,
            }));
            const stackedBuffs = stackEnemyTimedStatBuffs(
              deps.enemyTimedStatBuffsRef.current,
              newRows,
              deps.turn,
            );
            deps.enemyTimedStatBuffsRef.current = stackedBuffs;
            deps.setEnemyTimedStatBuffs(stackedBuffs);
            deps.debugEnemy("stat_buff", {
              enemy: enemy.name,
              skill: skill.name,
              targets: newRows.map((r) => r.enemyId),
              partsAgregados: leaf.parts,
              durationTurns: leaf.durationTurns,
              filasActivas: stackedBuffs
                .filter((r) => buffTargets.enemies.some((e) => e.id === r.enemyId))
                .map((r) => ({
                  skillName: r.skillName,
                  parts: r.parts,
                  remainingTurns: r.remainingTurns,
                })),
              bonusesTrasBuff: Object.fromEntries(
                buffTargets.enemies.map((recipient) => [
                  recipient.id,
                  getEnemyStatBonusesDuringSkill(recipient.id),
                ]),
              ),
            });

            const hpById = new Map<string, number>();
            const manaById = new Map<string, number>();
            for (const recipient of buffTargets.enemies) {
              const bonusesAfter = sumEnemyTimedStatBonuses(
                deps.enemyTimedStatBuffsRef.current,
                recipient.id,
              );
              let nextHp = recipient.id === enemy.id ? simEnemyHp : recipient.hp;
              let nextMana = recipient.mana;
              let hpChanged = false;
              let manaChanged = false;
              for (const part of leaf.parts) {
                const amount = Math.trunc(part.amount);
                if (amount <= 0) continue;
                if (part.stat === "hp") {
                  const cap = effectiveEnemyHpMax(recipient, bonusesAfter);
                  const healed = Math.min(cap, nextHp + amount) - nextHp;
                  if (healed > 0) {
                    nextHp += healed;
                    hpChanged = true;
                  }
                } else if (part.stat === "mana") {
                  nextMana += amount;
                  manaChanged = true;
                }
              }
              if (hpChanged) {
                hpById.set(recipient.id, nextHp);
                if (recipient.id === enemy.id) simEnemyHp = nextHp;
              }
              if (manaChanged) manaById.set(recipient.id, Math.max(0, nextMana));
            }
            if (hpById.size > 0 || manaById.size > 0) {
              deps.setDisplayEnemies((prev) =>
                prev.map((e) => {
                  const hpNext = hpById.get(e.id);
                  const manaNext = manaById.get(e.id);
                  if (hpNext == null && manaNext == null) return e;
                  return {
                    ...e,
                    hp: hpNext != null ? hpNext : e.hp,
                    mana: manaNext != null ? manaNext : e.mana,
                  };
                }),
              );
            }
          }

          if (!opts?.suppressPlayerDamageLog) {
            tryLogEnemySkillDescription(0);
          }
          return 0;
        }
        default:
          return 0;
      }
    };

    runLeaf(root, false);
  } else {
    const incomingSubtype: PlayerSkillEffectSubtype = "physical";
    const enemyBonuses = deps.getEnemyStatBonuses(enemy.id);
    const attackRange = effectiveEnemyAttackRange(enemy, enemyBonuses);
    const rawDamage = Math.max(0, randomIntInclusive(attackRange.min, attackRange.max));
    const defenseStat = playerDefenseStatVsIncoming(
      incomingSubtype,
      deps.effectivePlayerArmor,
      deps.effectivePlayerMr,
    );
    const damage = mitigateDamageByDefense(rawDamage, defenseStat);
    const d = Math.max(0, Math.trunc(damage));
    applyPlayerDamageTaken(d);
    deps.appendCombatLog(
      `${enemy.name} te ataca y te inflige ${d} de daño.`,
      "danger",
      undefined,
      d,
    );
  }

  if (simPlayerHp === 0) {
    deps.appendCombatLog(`${enemy.name} te ha derrotado.`, "danger");
    deps.resolvedEnemyTurnRef.current = null;
    return;
  }
  deps.scheduleAdvanceTurn();


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
    const deps = depsRef.current;
    if (deps.combatOutcome !== "active") return;
    if (!deps.currentActor || deps.currentActor.type !== "enemy") return;
    if (deps.isInitialCombatDelay || deps.isTurnTransitioning) return;
    if (deps.playerCurrentHp <= 0) return;

    const resolvedKey = `${deps.atbActionSeq}:${deps.currentActorId ?? ""}`;
    if (deps.resolvedEnemyTurnRef.current !== resolvedKey) return;

    const watchdogId = setTimeout(() => {
      if (deps.resolvedEnemyTurnRef.current !== resolvedKey) return;
      if (deps.currentActorIdRef.current !== deps.currentActorId) return;
      deps.debugEnemy("watchdog-reenviar-avance-tras-ataque-enemigo", { resolvedKey });
      deps.scheduleAdvanceTurn();
    }, COMBAT_ACTION_DELAY_MS + 1200);

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
}
