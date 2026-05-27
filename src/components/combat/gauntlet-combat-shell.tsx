"use client";

import { CombatEncounterShell } from "@/components/combat/combat-encounter-shell";
import type { GauntletCombatShellProps } from "@/components/combat/combat-shell-props";

/**
 * UI de combate para gauntlets (Soul Pit y futuros por mapa).
 * Reglas de gauntlet vía props legacy hasta migrar el shell a `CombatEncounterConfig`.
 */
export function GauntletCombatShell({
  gauntletRunId,
  gauntletFloor,
  gauntletVictoryHref,
  gauntletDefeatHref,
  defaultNavigationHref,
  escapeHref,
  escapeDisabled: _escapeDisabled,
  disableEscapeByEnemyHp: _disableEscapeByEnemyHp,
  victoryLootItems: victoryLootItemsProp,
  defeatLostItems: defeatLostItemsProp,
  ...rest
}: GauntletCombatShellProps) {
  const navigationHref = defaultNavigationHref ?? escapeHref ?? gauntletVictoryHref;

  return (
    <CombatEncounterShell
      {...rest}
      isGauntletCombat
      gauntletRunId={gauntletRunId}
      gauntletFloor={gauntletFloor}
      gauntletVictoryHref={gauntletVictoryHref}
      gauntletDefeatHref={gauntletDefeatHref}
      escapeHref={navigationHref}
      escapeDisabled
      victoryLootItems={victoryLootItemsProp ?? []}
      defeatLostItems={defeatLostItemsProp ?? []}
    />
  );
}
