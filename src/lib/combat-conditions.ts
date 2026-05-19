/**
 * Definiciones de condiciones de combate en memoria (sueño, parálisis, etc.).
 * Las skills referencian `modifier.condition` contra estos ids.
 */

import { normalizeCombatStateIconUrl } from "@/lib/combat-resist-weak-icons";

export type CombatConditionId =
  | "sleep"
  | "paralysis"
  | "stun"
  | "poison"
  | "burn"
  | (string & {});

export type CombatConditionSkipTurnEffect = {
  kind: "skip_turn";
  /**
   * Al inicio del turno del afectado: probabilidad de remover la condición y actuar.
   * Ej. sueño: 0.4 = 40 % despertar, 60 % perder el turno.
   */
  wakeChance?: number;
};

export type CombatConditionEffect =
  | CombatConditionSkipTurnEffect
  | {
      kind: "damage_over_time";
      min: number;
      max: number;
      subtype: "physical" | "magical";
    };

export type CombatConditionDefinition = {
  id: CombatConditionId;
  name: string;
  /** Ruta o nombre de archivo; se resuelve con `normalizeCombatStateIconUrl`. */
  icon: string;
  effects: CombatConditionEffect[];
};

const COMBAT_CONDITIONS: Record<string, CombatConditionDefinition> = {
  sleep: {
    id: "sleep",
    name: "Sueño",
    icon: "icon_sleep.png",
    effects: [{ kind: "skip_turn", wakeChance: 0.4 }],
  },
  paralysis: {
    id: "paralysis",
    name: "Parálisis",
    icon: "icon_paralysis.png",
    effects: [{ kind: "skip_turn" }],
  },
  stun: {
    id: "stun",
    name: "Aturdimiento",
    icon: "icon_stun.png",
    effects: [{ kind: "skip_turn" }],
  },
  poison: {
    id: "poison",
    name: "Veneno",
    icon: "icon_poison.png",
    effects: [{ kind: "damage_over_time", min: 4, max: 8, subtype: "physical" }],
  },
  burn: {
    id: "burn",
    name: "Quemadura",
    icon: "icon_burn.png",
    effects: [{ kind: "damage_over_time", min: 5, max: 10, subtype: "magical" }],
  },
};

export function getCombatConditionDefinition(
  id: string,
): CombatConditionDefinition | null {
  const key = id.trim().toLowerCase().replace(/-/g, "_");
  return COMBAT_CONDITIONS[key] ?? null;
}

export function getCombatConditionIconSrc(id: string): string | null {
  const def = getCombatConditionDefinition(id);
  if (!def) return null;
  return normalizeCombatStateIconUrl(def.icon);
}

export function conditionDefinitionGrantsSkipTurn(
  def: CombatConditionDefinition,
): boolean {
  return def.effects.some((e) => e.kind === "skip_turn");
}

export function conditionDefinitionHasDamageOverTime(
  def: CombatConditionDefinition,
): boolean {
  return def.effects.some((e) => e.kind === "damage_over_time");
}

/** Instancia activa en combate (PJ o enemigo). */
export type ActiveCombatCondition = {
  id: string;
  conditionId: CombatConditionId;
  targetKind: "player" | "enemy";
  targetId: string;
  /** `null` = duración infinita (`duration_turns: 0`). */
  remainingTurns: number | null;
  lastTickTurn: number;
  sourceSkillName: string;
};

export function activeConditionGrantsSkipTurn(
  row: ActiveCombatCondition,
): boolean {
  const def = getCombatConditionDefinition(row.conditionId);
  return def != null && conditionDefinitionGrantsSkipTurn(def);
}

export function listActiveConditionsForTarget(
  rows: ActiveCombatCondition[],
  targetKind: "player" | "enemy",
  targetId: string,
): ActiveCombatCondition[] {
  return rows.filter((r) => r.targetKind === targetKind && r.targetId === targetId);
}

export function targetHasSkipTurnCondition(
  rows: ActiveCombatCondition[],
  targetKind: "player" | "enemy",
  targetId: string,
): boolean {
  return listActiveConditionsForTarget(rows, targetKind, targetId).some(
    activeConditionGrantsSkipTurn,
  );
}

export type SkipTurnTurnStartResult = {
  shouldSkipTurn: boolean;
  removeConditionIds: string[];
  logs: Array<{ message: string; tone: "default" | "success" }>;
};

function getSkipTurnEffect(
  def: CombatConditionDefinition,
): CombatConditionSkipTurnEffect | null {
  const eff = def.effects.find((e) => e.kind === "skip_turn");
  return eff?.kind === "skip_turn" ? eff : null;
}

/**
 * Resuelve condiciones que bloquean el turno al empezar la acción del afectado.
 * Sueño: tira `wakeChance` antes de forzar skip; si despierta, quita la condición.
 */
export function evaluateSkipTurnConditionsAtTurnStart(
  rows: ActiveCombatCondition[],
  targetKind: "player" | "enemy",
  targetId: string,
  affectedName: string,
): SkipTurnTurnStartResult {
  const active = listActiveConditionsForTarget(rows, targetKind, targetId);
  const removeConditionIds: string[] = [];
  const logs: Array<{ message: string; tone: "default" | "success" }> = [];

  let sleepStillBlocking = false;
  let otherSkipBlocking = false;

  for (const row of active) {
    const def = getCombatConditionDefinition(row.conditionId);
    if (!def) continue;
    const skipEff = getSkipTurnEffect(def);
    if (!skipEff) continue;

    const wakeChance =
      skipEff.wakeChance != null && Number.isFinite(skipEff.wakeChance)
        ? Math.max(0, Math.min(1, skipEff.wakeChance))
        : null;

    if (wakeChance != null && wakeChance > 0) {
      if (Math.random() < wakeChance) {
        removeConditionIds.push(row.id);
        logs.push({
          message: `¡${affectedName} logró despertarse!`,
          tone: "success",
        });
      } else {
        sleepStillBlocking = true;
      }
    } else {
      otherSkipBlocking = true;
    }
  }

  const shouldSkipTurn = sleepStillBlocking || otherSkipBlocking;

  if (sleepStillBlocking) {
    logs.push({
      message: `${affectedName} está dormido, no puede actuar este turno.`,
      tone: "default",
    });
  } else if (otherSkipBlocking) {
    const blockingRow = active.find((row) => {
      if (removeConditionIds.includes(row.id)) return false;
      const def = getCombatConditionDefinition(row.conditionId);
      if (!def) return false;
      const se = getSkipTurnEffect(def);
      return se != null && (se.wakeChance == null || se.wakeChance <= 0);
    });
    const def = blockingRow
      ? getCombatConditionDefinition(blockingRow.conditionId)
      : null;
    logs.push({
      message: `${affectedName} no puede actuar${def?.name ? ` (${def.name})` : ""}.`,
      tone: "default",
    });
  }

  return { shouldSkipTurn, removeConditionIds, logs };
}
