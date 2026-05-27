"use client";

import type { CombatEncounterConfig } from "@/components/combat/combat-encounter-config";
import {
  useCombatEncounterEngine,
  type CombatEncounterEngine,
  type UseCombatEncounterEngineInput,
} from "@/components/combat/use-combat-encounter-engine";
import {
  useCombatEncounterRuntime,
  type CombatEncounterRuntime,
} from "@/components/combat/use-combat-encounter-runtime";

export type UseCombatEncounterInput = UseCombatEncounterEngineInput & {
  config: CombatEncounterConfig;
};

export type CombatEncounterController = CombatEncounterEngine & CombatEncounterRuntime;

/**
 * Motor de encuentro: estado de campo (enemigos), ATB, turnos y reglas de navegación por modo.
 */
export function useCombatEncounter(input: UseCombatEncounterInput): CombatEncounterController {
  const { config, ...engineInput } = input;
  const engine = useCombatEncounterEngine(engineInput);
  const runtime = useCombatEncounterRuntime({
    config,
    displayEnemies: engine.displayEnemies,
  });

  return {
    ...engine,
    ...runtime,
  };
}

export type {
  CombatEncounterEngine,
  UseCombatEncounterEngineInput,
} from "@/components/combat/use-combat-encounter-engine";
export type { CombatEncounterRuntime } from "@/components/combat/use-combat-encounter-runtime";
export type { CombatOutcome, CombatTurnActor } from "@/components/combat/combat-turn-types";
