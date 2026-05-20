/**
 * Parseo y tipos de `enemy_skills.effect_json` para combate (enemigo → PJ / sí mismo).
 * El PJ sigue usando otro esquema; esto es solo skills de enemigo.
 */

export type PlayerSkillEffectSubtype = "physical" | "magical" | "buff" | "neutral";

export type EnemySkillUseWhen = {
  /** Solo si (hp / hpMax) <= este valor [0..1]. */
  enemyHpPctMax?: number | null;
  /** Solo si (hp / hpMax) >= este valor [0..1]. */
  enemyHpPctMin?: number | null;
};

/**
 * Cómo interpretar `min` / `max` en `type: "damage"`.
 * - `flat` (default): entero de daño.
 * - `target_hp_max_pct`: % de HP máximo del objetivo (`0.1` o `10` = 10%).
 * - `target_hp_current_pct`: % de HP actual del objetivo.
 */
export type EnemySkillDamageBasis =
  | "flat"
  | "target_hp_max_pct"
  | "target_hp_current_pct";

export function parseEnemySkillDamageBasis(raw: unknown): EnemySkillDamageBasis {
  if (typeof raw !== "string") return "flat";
  const t = raw.trim().toLowerCase().replace(/-/g, "_");
  if (
    t === "target_hp_max_pct" ||
    t === "target_hp_max_percent" ||
    t === "player_hp_max_pct" ||
    t === "player_max_hp_pct"
  ) {
    return "target_hp_max_pct";
  }
  if (
    t === "target_hp_current_pct" ||
    t === "target_hp_pct" ||
    t === "player_hp_current_pct" ||
    t === "player_current_hp_pct"
  ) {
    return "target_hp_current_pct";
  }
  return "flat";
}

/** `min`/`max` en fracción (0.1) o puntos (10 → 10%). */
export function normalizeEnemySkillPctFraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const v = Math.max(0, value);
  return v > 1 ? Math.min(1, v / 100) : v;
}

/** Daño bruto antes de armadura/MR (inclusive en modo `flat`). */
export function rollEnemySkillRawDamage(
  min: number,
  max: number,
  basis: EnemySkillDamageBasis,
  targetHp: number,
  targetHpMax: number,
): number {
  if (basis === "target_hp_max_pct") {
    const hpMax = Math.max(1, Math.trunc(targetHpMax));
    const pctMin = normalizeEnemySkillPctFraction(min);
    const pctMax = normalizeEnemySkillPctFraction(Math.max(min, max));
    const pct =
      pctMin === pctMax ? pctMin : pctMin + Math.random() * (pctMax - pctMin);
    return Math.max(0, Math.floor(hpMax * pct));
  }
  if (basis === "target_hp_current_pct") {
    const hp = Math.max(0, Math.trunc(targetHp));
    const pctMin = normalizeEnemySkillPctFraction(min);
    const pctMax = normalizeEnemySkillPctFraction(Math.max(min, max));
    const pct =
      pctMin === pctMax ? pctMin : pctMin + Math.random() * (pctMax - pctMin);
    return Math.max(0, Math.floor(hp * pct));
  }
  const minV = Math.max(0, Math.trunc(min));
  const maxV = Math.max(minV, Math.trunc(max));
  if (maxV === minV) return minV;
  return minV + Math.floor(Math.random() * (maxV - minV + 1));
}

/** Destino de un efecto de skill enemiga (`target` en `effect_json`). */
export type EnemySkillEffectTarget = "player" | "caster" | "all_enemies" | "all";

export function parseEnemySkillTarget(
  raw: unknown,
  fallback: EnemySkillEffectTarget,
): EnemySkillEffectTarget {
  if (typeof raw !== "string") return fallback;
  const t = raw.trim().toLowerCase().replace(/-/g, "_");
  if (t === "player") return "player";
  if (t === "caster" || t === "self" || t === "enemy") return "caster";
  if (t === "all_enemies" || t === "all_enemy" || t === "enemies") return "all_enemies";
  if (t === "all") return "all";
  return fallback;
}

export type EnemyStatBuffAffectedStat =
  | "hp"
  | "mana"
  | "armor"
  | "mr"
  | "speed"
  | "damage"
  | "magic_damage";

export type EnemyStatBuffPart = {
  stat: EnemyStatBuffAffectedStat;
  amount: number;
};

export type EnemyCombatStatBonuses = {
  hp: number;
  mana: number;
  armor: number;
  mr: number;
  speed: number;
  attackMin: number;
  attackMax: number;
  magicMin: number;
  magicMax: number;
};

export function emptyEnemyCombatStatBonuses(): EnemyCombatStatBonuses {
  return {
    hp: 0,
    mana: 0,
    armor: 0,
    mr: 0,
    speed: 0,
    attackMin: 0,
    attackMax: 0,
    magicMin: 0,
    magicMax: 0,
  };
}

/** Suma cantidades por stat (para apilar buffs de la misma skill en un solo registro). */
export function mergeEnemyStatBuffParts(
  existing: EnemyStatBuffPart[],
  added: EnemyStatBuffPart[],
): EnemyStatBuffPart[] {
  const byStat = new Map<EnemyStatBuffAffectedStat, number>();
  for (const part of existing) {
    const amount = Math.trunc(part.amount);
    if (amount === 0) continue;
    byStat.set(part.stat, (byStat.get(part.stat) ?? 0) + amount);
  }
  for (const part of added) {
    const amount = Math.trunc(part.amount);
    if (amount === 0) continue;
    byStat.set(part.stat, (byStat.get(part.stat) ?? 0) + amount);
  }
  return Array.from(byStat.entries()).map(([stat, amount]) => ({ stat, amount }));
}

export type EnemyTimedStatBuffRow = {
  id: string;
  enemyId: string;
  parts: EnemyStatBuffPart[];
  remainingTurns: number;
  lastTickTurn: number;
  skillName: string;
  stateIcons: string[];
};

/**
 * Apila buffs de la misma skill en el mismo enemigo (+4 → +8 → +12).
 * Renueva duración al máximo entre el buff viejo y el nuevo.
 */
export function stackEnemyTimedStatBuffs<T extends EnemyTimedStatBuffRow>(
  prev: T[],
  incoming: T[],
  roundTurn: number,
): T[] {
  const next = [...prev];
  for (const row of incoming) {
    const idx = next.findIndex(
      (r) => r.enemyId === row.enemyId && r.skillName === row.skillName,
    );
    if (idx < 0) {
      next.push({ ...row, lastTickTurn: roundTurn });
      continue;
    }
    const existing = next[idx];
    next[idx] = {
      ...existing,
      parts: mergeEnemyStatBuffParts(existing.parts, row.parts),
      remainingTurns: Math.max(existing.remainingTurns, row.remainingTurns),
      lastTickTurn: roundTurn,
      stateIcons: row.stateIcons.length > 0 ? row.stateIcons : existing.stateIcons,
    };
  }
  return next;
}

export function sumEnemyTimedStatBonuses(
  rows: Array<{ enemyId: string; parts: EnemyStatBuffPart[]; remainingTurns: number }>,
  enemyId: string,
): EnemyCombatStatBonuses {
  const totals = emptyEnemyCombatStatBonuses();
  for (const row of rows) {
    if (row.enemyId !== enemyId || row.remainingTurns <= 0) continue;
    for (const part of row.parts) {
      const a = Math.trunc(part.amount);
      if (a === 0) continue;
      switch (part.stat) {
        case "hp":
          totals.hp += a;
          break;
        case "mana":
          totals.mana += a;
          break;
        case "armor":
          totals.armor += a;
          break;
        case "mr":
          totals.mr += a;
          break;
        case "speed":
          totals.speed += a;
          break;
        case "damage":
          totals.attackMin += a;
          totals.attackMax += a;
          break;
        case "magic_damage":
          totals.magicMin += a;
          totals.magicMax += a;
          break;
        default:
          break;
      }
    }
  }
  return totals;
}

export type ParsedEnemySkillEffect =
  | {
      mode: "damage";
      target: EnemySkillEffectTarget;
      min: number;
      max: number;
      damageBasis: EnemySkillDamageBasis;
      subtype: PlayerSkillEffectSubtype;
      damageTypes: string[];
      stateIcon: string | null;
      chance: number;
      useWhen: EnemySkillUseWhen | null;
      /** `description` en `effect_json` (`{enemigo}`, `{daño}`, etc.). */
      logDescription: string | null;
    }
  | {
      mode: "heal";
      target: EnemySkillEffectTarget;
      min: number;
      max: number;
      chance: number;
      useWhen: EnemySkillUseWhen | null;
      logDescription: string | null;
    }
  | {
      mode: "apply_modifier";
      target: EnemySkillEffectTarget;
      weaknessTags: string[];
      resistanceTags: string[];
      durationTurns: number;
      stateIcons: string[];
      chance: number;
      useWhen: EnemySkillUseWhen | null;
      logDescription: string | null;
    }
  | {
      mode: "stat_buff";
      target: EnemySkillEffectTarget;
      parts: EnemyStatBuffPart[];
      durationTurns: number;
      stateIcons: string[];
      chance: number;
      useWhen: EnemySkillUseWhen | null;
      logDescription: string | null;
    }
  /** Ataque con daño de arma del enemigo; `damage_type` aplica RES/WEAK como en `damage`. */
  | {
      mode: "weapon_attack";
      target: EnemySkillEffectTarget;
      subtype: PlayerSkillEffectSubtype;
      damageTypes: string[];
      chance: number;
      useWhen: EnemySkillUseWhen | null;
      logDescription: string | null;
    }
  | {
      mode: "composite";
      steps: ParsedEnemySkillEffect[];
      chance: number;
      useWhen: EnemySkillUseWhen | null;
      /** Texto del log de combate (`{enemigo}`, `{daño}` / `{dano}` / `{damage}`). */
      logDescription: string | null;
    };

const ENEMY_STAT_BUFF_MAP = new Map<string, EnemyStatBuffAffectedStat>([
  ["hp", "hp"],
  ["mana", "mana"],
  ["mp", "mana"],
  ["armor", "armor"],
  ["armadura", "armor"],
  ["mr", "mr"],
  ["magic_resist", "mr"],
  ["magicresist", "mr"],
  ["speed", "speed"],
  ["velocidad", "speed"],
  ["damage", "damage"],
  ["attack_damage", "damage"],
  ["attack-damage", "damage"],
  ["magic_damage", "magic_damage"],
  ["magic-damage", "magic_damage"],
]);

function num(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function normalizeDamageTypeLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return normalized.length > 0 ? normalized : null;
}

function getEffectDamageTypes(effect: Record<string, unknown>): string[] {
  const raw = effect.damage_type ?? effect.damage_types;
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,|/]+/)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = normalizeDamageTypeLabel(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function getEffectStateIcon(effect: Record<string, unknown>): string | null {
  const raw = effect.state_icon ?? effect.stateIcon;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function getEffectStateIcons(effect: Record<string, unknown>): string[] {
  const raw = effect.state_icons ?? effect.stateIcons;
  if (!Array.isArray(raw)) {
    const one = getEffectStateIcon(effect);
    return one ? [one] : [];
  }
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (t) out.push(t);
  }
  return out;
}

function mergeStateIconLists(...lists: readonly string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const t = raw.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

const DEFAULT_ENEMY_STAT_BUFF_STATE_ICONS: Partial<
  Record<EnemyStatBuffAffectedStat, string>
> = {
  damage: "icon_atkdamage_up.png",
  magic_damage: "icon_mdamage_up.png",
  speed: "icon_speed_up.png",
  armor: "icon_armor_up.png",
  mr: "icon_mr_up.png",
};

function defaultStateIconsForStatBuffParts(parts: EnemyStatBuffPart[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (part.amount <= 0) continue;
    const icon = DEFAULT_ENEMY_STAT_BUFF_STATE_ICONS[part.stat];
    if (!icon || seen.has(icon)) continue;
    seen.add(icon);
    out.push(icon);
  }
  return out;
}

function applyInheritedStateIconsToSteps(
  steps: ParsedEnemySkillEffect[],
  inherited: string[],
): ParsedEnemySkillEffect[] {
  if (inherited.length === 0) return steps;
  return steps.map((step) => {
    if (step.mode === "stat_buff") {
      return {
        ...step,
        stateIcons: mergeStateIconLists(inherited, step.stateIcons),
      };
    }
    if (step.mode === "composite") {
      return {
        ...step,
        steps: applyInheritedStateIconsToSteps(step.steps, inherited),
      };
    }
    return step;
  });
}

function enemySkillDamageSubtype(effect: Record<string, unknown>): PlayerSkillEffectSubtype {
  const raw = effect.subtype;
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "physical") return "physical";
  if (s === "magical") return "magical";
  if (s === "buff") return "buff";
  return "neutral";
}

function parseUseWhen(raw: unknown): EnemySkillUseWhen | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const maxRaw = o.enemy_hp_pct_max ?? o.enemyHpPctMax;
  const minRaw = o.enemy_hp_pct_min ?? o.enemyHpPctMin;
  const enemyHpPctMax =
    maxRaw != null && maxRaw !== ""
      ? Math.max(0, Math.min(1, num(maxRaw, Number.NaN)))
      : null;
  const enemyHpPctMin =
    minRaw != null && minRaw !== ""
      ? Math.max(0, Math.min(1, num(minRaw, Number.NaN)))
      : null;
  const maxOk = enemyHpPctMax != null && Number.isFinite(enemyHpPctMax);
  const minOk = enemyHpPctMin != null && Number.isFinite(enemyHpPctMin);
  if (!maxOk && !minOk) return null;
  return {
    enemyHpPctMax: maxOk ? enemyHpPctMax : null,
    enemyHpPctMin: minOk ? enemyHpPctMin : null,
  };
}

function extractUseWhen(effect: Record<string, unknown>): EnemySkillUseWhen | null {
  const uw = effect.use_when ?? effect.useWhen;
  return parseUseWhen(uw);
}

function extractLogDescription(effect: Record<string, unknown>): string | null {
  const raw = effect.description;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function parseAffectedStatFromRaw(raw: unknown): EnemyStatBuffAffectedStat | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!s) return null;
  const hit = s.replace(/\s+/g, "_").replace(/-/g, "_");
  return ENEMY_STAT_BUFF_MAP.get(hit) ?? ENEMY_STAT_BUFF_MAP.get(s) ?? null;
}

function parseModifierScalingFlat(mod: Record<string, unknown>): number {
  const scaling = mod.scaling;
  if (scaling != null && typeof scaling === "object" && !Array.isArray(scaling)) {
    const flat = (scaling as Record<string, unknown>).flat;
    const fromScaling = num(flat, Number.NaN);
    if (Number.isFinite(fromScaling)) return Math.trunc(fromScaling);
  }
  const direct = num(mod.amount ?? mod.flat, Number.NaN);
  if (Number.isFinite(direct)) return Math.trunc(direct);
  return 0;
}

function parseModifierTags(mod: Record<string, unknown>): {
  weaknessTags: string[];
  resistanceTags: string[];
  durationTurns: number;
  stateIcons: string[];
} {
  const kindRaw = mod.kind ?? mod.modifier_kind;
  const kind = typeof kindRaw === "string" ? kindRaw.trim().toLowerCase().replace(/-/g, "_") : "";
  const element =
    normalizeDamageTypeLabel(mod.element) ??
    normalizeDamageTypeLabel(mod.stat) ??
    normalizeDamageTypeLabel(mod.damage_type);
  const durationTurns = Math.max(
    1,
    Math.trunc(
      num(mod.duration_turns ?? mod.durationTurns ?? mod.duration, 3),
    ),
  );
  const stateIcons = getEffectStateIcons(mod);

  const weaknessTags: string[] = [];
  const resistanceTags: string[] = [];

  if (
    kind === "debuff_weakness" ||
    kind === "add_weakness" ||
    kind === "weakness" ||
    kind === "player_weakness"
  ) {
    if (element) weaknessTags.push(element);
  } else if (
    kind === "buff_resistance" ||
    kind === "add_resistance" ||
    kind === "resistance" ||
    kind === "enemy_resistance"
  ) {
    if (element) resistanceTags.push(element);
  } else if (kind === "debuff_resistance" || kind === "remove_resistance") {
    /** Tratado como debilidad al recibir daño de ese elemento (simplificación). */
    if (element) weaknessTags.push(element);
  } else if (kind === "debuff_weakness_on_enemy" || kind === "add_enemy_weakness") {
    if (element) weaknessTags.push(element);
  } else if (kind === "buff_weakness_on_enemy") {
    if (element) weaknessTags.push(element);
  }

  return { weaknessTags, resistanceTags, durationTurns, stateIcons };
}

function parseStatBuffModifier(mod: Record<string, unknown>): {
  parts: EnemyStatBuffPart[];
  durationTurns: number;
  stateIcons: string[];
} | null {
  const kindRaw = mod.kind ?? mod.modifier_kind;
  const kind = typeof kindRaw === "string" ? kindRaw.trim().toLowerCase().replace(/-/g, "_") : "";
  if (kind !== "buff") return null;

  const stat = parseAffectedStatFromRaw(mod["affected-stat"] ?? mod.affected_stat);
  const amount = parseModifierScalingFlat(mod);
  if (!stat || amount === 0) return null;

  const durationTurns = Math.max(
    1,
    Math.trunc(
      num(mod.duration_turns ?? mod.durationTurns ?? mod.duration, 3),
    ),
  );
  let stateIcons = getEffectStateIcons(mod);
  const parts: EnemyStatBuffPart[] = [{ stat, amount }];
  if (stateIcons.length === 0) {
    stateIcons = defaultStateIconsForStatBuffParts(parts);
  }

  return {
    parts,
    durationTurns,
    stateIcons,
  };
}

function parseApplyModifier(
  effect: Record<string, unknown>,
  chance: number,
  useWhen: EnemySkillUseWhen | null,
): ParsedEnemySkillEffect | null {
  const target = parseEnemySkillTarget(effect.target, "caster");
  const modRaw = effect.modifier;
  if (!modRaw || typeof modRaw !== "object" || Array.isArray(modRaw)) return null;
  const { weaknessTags, resistanceTags, durationTurns, stateIcons } = parseModifierTags(
    modRaw as Record<string, unknown>,
  );
  if (weaknessTags.length === 0 && resistanceTags.length === 0) return null;
  return {
    mode: "apply_modifier",
    target,
    weaknessTags,
    resistanceTags,
    durationTurns,
    stateIcons,
    chance,
    useWhen,
    logDescription: extractLogDescription(effect),
  };
}

function parseStatBuff(
  effect: Record<string, unknown>,
  chance: number,
  useWhen: EnemySkillUseWhen | null,
): ParsedEnemySkillEffect | null {
  const target = parseEnemySkillTarget(effect.target, "caster");
  const modRaw = effect.modifier;
  if (!modRaw || typeof modRaw !== "object" || Array.isArray(modRaw)) return null;
  const parsed = parseStatBuffModifier(modRaw as Record<string, unknown>);
  if (!parsed) return null;

  const effectIcons = getEffectStateIcons(effect);
  let stateIcons = mergeStateIconLists(effectIcons, parsed.stateIcons);

  return {
    mode: "stat_buff",
    target,
    parts: parsed.parts,
    durationTurns: parsed.durationTurns,
    stateIcons,
    chance,
    useWhen,
    logDescription: extractLogDescription(effect),
  };
}

function parseOne(effect: Record<string, unknown>): ParsedEnemySkillEffect | null {
  const typeRaw = typeof effect.type === "string" ? effect.type.trim().toLowerCase() : "";
  const typeNorm = typeRaw.replace(/-/g, "_");
  const chance = Math.max(0, Math.min(1, num(effect.chance, 1)));
  const useWhen = extractUseWhen(effect);

  if (typeNorm === "composite") {
    const rawEffects = effect.effects;
    if (!Array.isArray(rawEffects)) return null;
    const steps: ParsedEnemySkillEffect[] = [];
    for (const step of rawEffects) {
      if (!step || typeof step !== "object" || Array.isArray(step)) continue;
      const parsed = parseOne(step as Record<string, unknown>);
      if (parsed) steps.push(parsed);
    }
    if (steps.length === 0) return null;
    const inheritedIcons = getEffectStateIcons(effect);
    const stepsWithIcons = applyInheritedStateIconsToSteps(steps, inheritedIcons);
    return {
      mode: "composite",
      steps: stepsWithIcons,
      chance,
      useWhen,
      logDescription: extractLogDescription(effect),
    };
  }

  if (typeNorm === "heal") {
    const target = parseEnemySkillTarget(effect.target, "caster");
    const min = Math.max(0, num(effect.min, 0));
    const max = Math.max(min, num(effect.max, min));
    return {
      mode: "heal",
      target,
      min,
      max,
      chance,
      useWhen,
      logDescription: extractLogDescription(effect),
    };
  }

  if (typeNorm === "weapon_attack") {
    const target = parseEnemySkillTarget(effect.target, "player");
    let subtype = enemySkillDamageSubtype(effect);
    if (subtype === "neutral" || subtype === "buff") subtype = "physical";
    return {
      mode: "weapon_attack",
      target,
      subtype,
      damageTypes: getEffectDamageTypes(effect),
      chance,
      useWhen,
      logDescription: extractLogDescription(effect),
    };
  }

  if (typeNorm === "buff") {
    return parseStatBuff(effect, chance, useWhen);
  }

  if (typeNorm === "apply_modifier") {
    return parseApplyModifier(effect, chance, useWhen);
  }

  if (typeNorm !== "damage") return null;
  const target = parseEnemySkillTarget(effect.target, "player");
  const damageBasis = parseEnemySkillDamageBasis(
    effect.damage_basis ?? effect.damageBasis,
  );
  const min = num(effect.min, 0);
  const max = num(effect.max, min);
  return {
    mode: "damage",
    target,
    min,
    max: Math.max(min, max),
    damageBasis,
    subtype: enemySkillDamageSubtype(effect),
    damageTypes: getEffectDamageTypes(effect),
    stateIcon: getEffectStateIcon(effect),
    chance,
    useWhen,
    logDescription: extractLogDescription(effect),
  };
}

/** `effect_json` de `enemy_skills` → efecto de combate o null si no soportado. */
export function parseEnemySkillEffectJson(effectRaw: unknown): ParsedEnemySkillEffect | null {
  if (!effectRaw || typeof effectRaw !== "object" || Array.isArray(effectRaw)) return null;
  return parseOne(effectRaw as Record<string, unknown>);
}

function logDescriptionFromParsedEffect(
  parsedEffect: ParsedEnemySkillEffect,
): string | null {
  if (parsedEffect.mode === "composite") {
    return parsedEffect.logDescription;
  }
  const fromEffect = parsedEffect.logDescription?.trim() ?? "";
  return fromEffect.length > 0 ? fromEffect : null;
}

/**
 * Texto de log: prioridad `enemy_skills.description` (columna), luego `description` en `effect_json`.
 */
export function resolveEnemySkillLogDescription(
  skillDescription: string | null | undefined,
  parsedEffect: ParsedEnemySkillEffect,
): string | null {
  const fromColumn =
    typeof skillDescription === "string" ? skillDescription.trim() : "";
  if (fromColumn.length > 0) return fromColumn;
  return logDescriptionFromParsedEffect(parsedEffect);
}

/** Buffs/modificadores antes que daño para que el ataque del mismo skill use el buff. */
export function orderCompositeStepsForExecution(
  steps: ParsedEnemySkillEffect[],
): ParsedEnemySkillEffect[] {
  const prep: ParsedEnemySkillEffect[] = [];
  const rest: ParsedEnemySkillEffect[] = [];
  for (const step of steps) {
    if (step.mode === "stat_buff" || step.mode === "apply_modifier") {
      prep.push(step);
    } else {
      rest.push(step);
    }
  }
  return [...prep, ...rest];
}

export function enemyHpRatio(hp: number, hpMax: number): number {
  const max = Math.max(1, Math.trunc(hpMax));
  const h = Math.max(0, Math.trunc(hp));
  return h / max;
}

export function enemySkillMatchesUseWhen(
  hp: number,
  hpMax: number,
  useWhen: EnemySkillUseWhen | null,
): boolean {
  if (!useWhen) return true;
  const ratio = enemyHpRatio(hp, hpMax);
  if (useWhen.enemyHpPctMax != null && Number.isFinite(useWhen.enemyHpPctMax)) {
    if (ratio > useWhen.enemyHpPctMax) return false;
  }
  if (useWhen.enemyHpPctMin != null && Number.isFinite(useWhen.enemyHpPctMin)) {
    if (ratio < useWhen.enemyHpPctMin) return false;
  }
  return true;
}

export function parsedEnemySkillUseWhen(
  effect: ParsedEnemySkillEffect,
): EnemySkillUseWhen | null {
  switch (effect.mode) {
    case "damage":
    case "heal":
    case "apply_modifier":
    case "stat_buff":
    case "weapon_attack":
      return effect.useWhen;
    case "composite":
      return effect.useWhen;
    default:
      return null;
  }
}

export function parsedEnemySkillChance(effect: ParsedEnemySkillEffect): number {
  switch (effect.mode) {
    case "damage":
      return effect.chance;
    case "heal":
      return effect.chance;
    case "apply_modifier":
      return effect.chance;
    case "stat_buff":
      return effect.chance;
    case "weapon_attack":
      return effect.chance;
    case "composite":
      return effect.chance;
    default:
      return 1;
  }
}
