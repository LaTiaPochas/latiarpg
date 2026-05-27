/**
 * Reglas de presentación y persistencia por tipo de encuentro.
 * El motor ATB/daño sigue en `combat-encounter-shell` hasta migrar a `useCombatEncounter`.
 */

export type CombatEncounterMode = "map" | "gauntlet";

export type CombatEncounterConfig = {
  mode: CombatEncounterMode;
  /** Href por defecto (mapa, prep de gauntlet, etc.). */
  defaultNavigationHref: string;
  victoryFinishHref: string;
  defeatFinishHref: string;
  escape: {
    disabled: boolean;
    /** Si true, no se bloquea escapar cuando el enemigo tiene poca vida. */
    ignoreEnemyLowHpLock: boolean;
  };
  rewards: {
    showVictoryLootScreen: boolean;
    showVictoryXpInOverlay: boolean;
    applyDefeatItemPenalty: boolean;
  };
  social: {
    logDefeatToWorld: boolean;
    logLevelUpToWorld: boolean;
  };
  labels: {
    victoryFinishLink: string;
    defeatFinishLink: string;
  };
};

export type CreateMapCombatConfigInput = {
  escapeHref: string;
  escapeDisabled: boolean;
};

export function createMapCombatConfig(input: CreateMapCombatConfigInput): CombatEncounterConfig {
  return {
    mode: "map",
    defaultNavigationHref: input.escapeHref,
    victoryFinishHref: input.escapeHref,
    defeatFinishHref: "/",
    escape: {
      disabled: input.escapeDisabled,
      ignoreEnemyLowHpLock: false,
    },
    rewards: {
      showVictoryLootScreen: true,
      showVictoryXpInOverlay: true,
      applyDefeatItemPenalty: true,
    },
    social: {
      logDefeatToWorld: true,
      logLevelUpToWorld: true,
    },
    labels: {
      victoryFinishLink: "Volver al mapa",
      defeatFinishLink: "Volver al Campamento",
    },
  };
}

export type CreateGauntletCombatConfigInput = {
  /** Tras victoria (siguiente piso o prep). */
  victoryHref: string;
  /** Tras derrota (lobby con resultado). */
  defeatHref: string;
  /** Mismo que victory si no hay pantalla prep intermedia. */
  defaultNavigationHref?: string;
};

export function createGauntletCombatConfig(
  input: CreateGauntletCombatConfigInput,
): CombatEncounterConfig {
  const defaultHref = input.defaultNavigationHref ?? input.victoryHref;
  return {
    mode: "gauntlet",
    defaultNavigationHref: defaultHref,
    victoryFinishHref: input.victoryHref,
    defeatFinishHref: input.defeatHref,
    escape: {
      disabled: true,
      ignoreEnemyLowHpLock: true,
    },
    rewards: {
      showVictoryLootScreen: false,
      showVictoryXpInOverlay: false,
      applyDefeatItemPenalty: false,
    },
    social: {
      logDefeatToWorld: false,
      logLevelUpToWorld: true,
    },
    labels: {
      victoryFinishLink: "Siguiente piso",
      defeatFinishLink: "Volver al pozo",
    },
  };
}

/** Props legacy del shell (`isGauntletCombat`, etc.) → config unificada. */
export type LegacyGauntletShellFlags = {
  isGauntletCombat?: boolean;
  gauntletVictoryHref?: string;
  gauntletDefeatHref?: string;
  escapeHref?: string;
  escapeDisabled?: boolean;
  disableEscapeByEnemyHp?: boolean;
};

export function resolveCombatEncounterConfig(
  explicit: CombatEncounterConfig | undefined,
  legacy: LegacyGauntletShellFlags,
): CombatEncounterConfig {
  if (explicit) return explicit;

  const escapeHref = legacy.escapeHref ?? "/";
  if (legacy.isGauntletCombat) {
    return createGauntletCombatConfig({
      victoryHref: legacy.gauntletVictoryHref ?? escapeHref,
      defeatHref: legacy.gauntletDefeatHref ?? "/",
      defaultNavigationHref: escapeHref,
    });
  }

  return createMapCombatConfig({
    escapeHref,
    escapeDisabled: legacy.escapeDisabled === true,
  });
}
