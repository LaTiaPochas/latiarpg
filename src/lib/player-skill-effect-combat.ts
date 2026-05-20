/**
 * Parseo de `player_skills.effect_json` para condiciones (debuff) y pasos composite.
 */

function buffScalingRatioParsed(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function coerceScalingAmount(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/**
 * Una línea de `scaling` en buffs self:
 * - `Fixed` → `amount`
 * - `STR|DEX|INT|WIS|LEVEL` → `floor(amount + stat × ratio)`
 */
export function selfBuffScalingLineValue(
  entry: unknown,
  getCombatStatValue: (statKeyUpper: string) => number,
): number {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return 0;
  const o = entry as Record<string, unknown>;
  const statRaw = typeof o.stat === "string" ? o.stat.trim() : "";
  if (statRaw === "") return 0;
  const upper = statRaw.toUpperCase();
  const amount = coerceScalingAmount(o.amount, 0);
  const ratio = buffScalingRatioParsed(o.ratio);

  if (upper === "FIXED") {
    return Math.max(0, Math.floor(amount));
  }
  if (
    upper === "STR" ||
    upper === "DEX" ||
    upper === "INT" ||
    upper === "WIS" ||
    upper === "LEVEL" ||
    upper === "LV" ||
    upper === "NIVEL"
  ) {
    const fromStat = Math.max(0, getCombatStatValue(upper)) * ratio;
    return Math.max(0, Math.floor(amount + fromStat));
  }
  return 0;
}

export function sumSelfBuffScalingTotals(
  scalingRaw: unknown,
  getCombatStatValue: (statKeyUpper: string) => number,
): number {
  if (scalingRaw == null) return 0;
  if (Array.isArray(scalingRaw)) {
    return scalingRaw.reduce(
      (sum, item) => sum + selfBuffScalingLineValue(item, getCombatStatValue),
      0,
    );
  }
  if (typeof scalingRaw === "object") {
    return selfBuffScalingLineValue(scalingRaw, getCombatStatValue);
  }
  return 0;
}

/** `cooldown_turns` en BD: 0 = sin cooldown en combate. */
export function parsePlayerSkillCooldownTurns(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  }
  return Math.max(0, Math.trunc(fallback));
}

export function formatPlayerSkillCooldownText(turns: number): string {
  const n = Math.max(0, Math.trunc(turns));
  if (n <= 0) return "Sin cooldown";
  return n === 1 ? "1 turno" : `${n} turnos`;
}

/** Etiqueta corta para listas / perfiles (ej. «Sin CD», «CD 3»). */
export function formatPlayerSkillCooldownLabel(turns: number): string {
  const n = Math.max(0, Math.trunc(turns));
  if (n <= 0) return "Sin CD";
  return `CD ${n}`;
}

export type PlayerSkillEffectTarget =
  | "self"
  | "enemy"
  | "all_enemies"
  | "all";

export type ConditionResistSpec = {
  flat: number;
  stat: string;
  derivedStat: number;
};

export type ParsedPlayerConditionDebuff = {
  mode: "apply_condition";
  target: PlayerSkillEffectTarget;
  conditionId: string;
  durationTurns: number | null;
  resist: ConditionResistSpec | null;
};

export type ParsedPlayerSkillStep =
  | { mode: "raw"; effect: Record<string, unknown> }
  | ParsedPlayerConditionDebuff;

function num(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Destino del efecto según convención del proyecto. */
export function parsePlayerSkillEffectTarget(
  raw: unknown,
  fallback: PlayerSkillEffectTarget = "enemy",
): PlayerSkillEffectTarget {
  if (typeof raw !== "string") return fallback;
  const t = raw.trim().toLowerCase().replace(/-/g, "_");
  if (t === "self" || t === "player" || t === "ally" || t === "friendly") return "self";
  if (
    t === "enemy" ||
    t === "single" ||
    t === "enemy_single" ||
    t === "enemy_single_target"
  ) {
    return "enemy";
  }
  if (
    t === "all_enemies" ||
    t === "all_enemy" ||
    t === "enemies" ||
    t === "area" ||
    t === "aoe"
  ) {
    return "all_enemies";
  }
  if (t === "all") return "all";
  return fallback;
}

function parseConditionResist(mod: Record<string, unknown>): ConditionResistSpec | null {
  const raw = mod.resist;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const flat = num(o.flat, 0);
  const derivedStat = num(o["derived-stat"] ?? o.derived_stat ?? o.derivedStat, 0);
  const statRaw = o.stat;
  const stat = typeof statRaw === "string" ? statRaw.trim().toLowerCase() : "mr";
  if (flat === 0 && derivedStat === 0) return null;
  return { flat, stat, derivedStat };
}

function parseDurationTurns(mod: Record<string, unknown>): number | null {
  const raw = mod.duration_turns ?? mod.durationTurns ?? mod.duration;
  if (raw == null || raw === "") return 3;
  const n = Math.trunc(num(raw, 0));
  if (n <= 0) return null;
  return n;
}

function parseConditionDebuffStep(
  effect: Record<string, unknown>,
): ParsedPlayerConditionDebuff | null {
  const modRaw = effect.modifier;
  if (!modRaw || typeof modRaw !== "object" || Array.isArray(modRaw)) return null;
  const mod = modRaw as Record<string, unknown>;
  const kindRaw = mod.kind ?? mod.modifier_kind;
  const kind =
    typeof kindRaw === "string" ? kindRaw.trim().toLowerCase().replace(/-/g, "_") : "";
  if (kind !== "condition") return null;

  const conditionRaw = mod.condition ?? mod.condition_id ?? mod.conditionId;
  const conditionId =
    typeof conditionRaw === "string" ? conditionRaw.trim().toLowerCase() : "";
  if (!conditionId) return null;

  const target = parsePlayerSkillEffectTarget(effect.target, "enemy");
  return {
    mode: "apply_condition",
    target,
    conditionId,
    durationTurns: parseDurationTurns(mod),
    resist: parseConditionResist(mod),
  };
}

function parseOnePlayerSkillStep(
  effect: Record<string, unknown>,
): ParsedPlayerSkillStep | null {
  const typeRaw = typeof effect.type === "string" ? effect.type.trim().toLowerCase() : "";
  const typeNorm = typeRaw.replace(/-/g, "_");
  if (typeNorm === "debuff") {
    const cond = parseConditionDebuffStep(effect);
    if (cond) return cond;
  }
  return { mode: "raw", effect };
}

/** Expande `composite` o raíz con `effects[]` en pasos ejecutables. */
export function expandPlayerSkillEffectSteps(
  effect: Record<string, unknown>,
): ParsedPlayerSkillStep[] {
  const typeRaw = typeof effect.type === "string" ? effect.type.trim().toLowerCase() : "";
  const typeNorm = typeRaw.replace(/-/g, "_");
  const rawEffects = effect.effects;
  const steps: ParsedPlayerSkillStep[] = [];

  if ((typeNorm === "composite" || Array.isArray(rawEffects)) && Array.isArray(rawEffects)) {
    for (const step of rawEffects) {
      if (!step || typeof step !== "object" || Array.isArray(step)) continue;
      const parsed = parseOnePlayerSkillStep(step as Record<string, unknown>);
      if (parsed) steps.push(parsed);
    }
    return steps;
  }

  const single = parseOnePlayerSkillStep(effect);
  return single ? [single] : [];
}

export function playerSkillStepsNeedCompositeHandler(
  steps: ParsedPlayerSkillStep[],
): boolean {
  if (steps.length > 1) return true;
  return steps.some((s) => s.mode === "apply_condition");
}

/**
 * Probabilidad de **resistir** la condición [0..1].
 * `flat` + `statValue * derivedStat`, acotado.
 */
export function computeConditionResistChance(
  resist: ConditionResistSpec | null,
  getStatValue: (statKey: string) => number,
): number {
  if (!resist) return 0;
  const statVal = Math.max(0, getStatValue(resist.stat));
  return Math.max(0, Math.min(1, resist.flat + statVal * resist.derivedStat));
}

/** `true` si la condición **no** se aplica (resistió). */
export function rollConditionResisted(
  resist: ConditionResistSpec | null,
  getStatValue: (statKey: string) => number,
): boolean {
  const chance = computeConditionResistChance(resist, getStatValue);
  if (chance <= 0) return false;
  return Math.random() < chance;
}

export function getStatValueForConditionResist(
  statKey: string,
  ctx: { enemyMr: number; enemyArmor: number },
): number {
  const k = statKey.trim().toLowerCase().replace(/-/g, "_");
  if (k === "mr" || k === "magic_resist" || k === "magicresist") return ctx.enemyMr;
  if (k === "armor" || k === "armadura") return ctx.enemyArmor;
  return 0;
}

export function getPlayerStatValueForConditionResist(
  statKey: string,
  ctx: { playerMr: number; playerArmor: number },
): number {
  const k = statKey.trim().toLowerCase().replace(/-/g, "_");
  if (k === "mr" || k === "magic_resist" || k === "magicresist") return ctx.playerMr;
  if (k === "armor" || k === "armadura") return ctx.playerArmor;
  return 0;
}
