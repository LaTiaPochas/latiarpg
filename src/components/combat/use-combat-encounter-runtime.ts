"use client";

import { useMemo } from "react";

import type { CombatEncounterConfig } from "@/components/combat/combat-encounter-config";
import type { CombatEncounterEnemyView } from "@/components/combat/types";

const ENEMY_LOW_HP_ESCAPE_RATIO = 0.6;

export type UseCombatEncounterRuntimeInput = {
  config: CombatEncounterConfig;
  displayEnemies: CombatEncounterEnemyView[];
};

export type CombatEncounterRuntime = {
  config: CombatEncounterConfig;
  isGauntletMode: boolean;
  isMapMode: boolean;
  victoryFinishHref: string;
  defeatFinishHref: string;
  escapeHref: string;
  isEscapeDisabled: boolean;
  escapeBlockedByEnemyHp: boolean;
  skipVictoryLootScreen: boolean;
  showVictoryXpInOverlay: boolean;
  applyDefeatItemPenalty: boolean;
  shouldLogDefeatToWorld: boolean;
};

export function useCombatEncounterRuntime(
  input: UseCombatEncounterRuntimeInput,
): CombatEncounterRuntime {
  const { config, displayEnemies } = input;

  return useMemo(() => {
    const totalEnemyHpMax = displayEnemies.reduce(
      (sum, enemy) => sum + Math.max(1, Math.trunc(enemy.hpMax)),
      0,
    );
    const totalEnemyHp = displayEnemies.reduce(
      (sum, enemy) => sum + Math.max(0, Math.trunc(enemy.hp)),
      0,
    );
    const isEscapeDisabledByEnemyHp =
      !config.escape.ignoreEnemyLowHpLock &&
      totalEnemyHpMax > 0 &&
      totalEnemyHp / totalEnemyHpMax <= ENEMY_LOW_HP_ESCAPE_RATIO;

    const isEscapeDisabled = config.escape.disabled || isEscapeDisabledByEnemyHp;

    return {
      config,
      isGauntletMode: config.mode === "gauntlet",
      isMapMode: config.mode === "map",
      victoryFinishHref: config.victoryFinishHref,
      defeatFinishHref: config.defeatFinishHref,
      escapeHref: config.defaultNavigationHref,
      isEscapeDisabled,
      escapeBlockedByEnemyHp: isEscapeDisabledByEnemyHp,
      skipVictoryLootScreen: !config.rewards.showVictoryLootScreen,
      showVictoryXpInOverlay: config.rewards.showVictoryXpInOverlay,
      applyDefeatItemPenalty: config.rewards.applyDefeatItemPenalty,
      shouldLogDefeatToWorld: config.social.logDefeatToWorld,
    };
  }, [config, displayEnemies]);
}
