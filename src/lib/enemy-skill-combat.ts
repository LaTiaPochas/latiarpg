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
      subtype: PlayerSkillEffectSubtype;
      damageTypes: string[];
      stateIcon: string | null;
      chance: number;
      useWhen: EnemySkillUseWhen | null;
    }
  | {
      mode: "heal";
      target: EnemySkillEffectTarget;
      min: number;
      max: number;
      chance: number;
      useWhen: EnemySkillUseWhen | null;
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
    }
  | {
      mode: "stat_buff";
      target: EnemySkillEffectTarget;
      parts: EnemyStatBuffPart[];
      durationTurns: number;
      stateIcons: string[];
      chance: number;
      useWhen: EnemySkillUseWhen | null;
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
  const stateIcons = getEffectStateIcons(mod);

  return {
    parts: [{ stat, amount }],
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

  return {
    mode: "stat_buff",
    target,
    parts: parsed.parts,
    durationTurns: parsed.durationTurns,
    stateIcons: parsed.stateIcons,
    chance,
    useWhen,
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
    return {
      mode: "composite",
      steps,
      chance,
      useWhen,
      logDescription: extractLogDescription(effect),
    };
  }

  if (typeNorm === "heal") {
    const target = parseEnemySkillTarget(effect.target, "caster");
    const min = Math.max(0, num(effect.min, 0));
    const max = Math.max(min, num(effect.max, min));
    return { mode: "heal", target, min, max, chance, useWhen };
  }

  if (typeNorm === "buff") {
    return parseStatBuff(effect, chance, useWhen);
  }

  if (typeNorm === "apply_modifier") {
    return parseApplyModifier(effect, chance, useWhen);
  }

  if (typeNorm !== "damage") return null;
  const target = parseEnemySkillTarget(effect.target, "player");
  const min = Math.max(0, num(effect.min, 0));
  const max = Math.max(min, num(effect.max, min));
  return {
    mode: "damage",
    target,
    min,
    max,
    subtype: enemySkillDamageSubtype(effect),
    damageTypes: getEffectDamageTypes(effect),
    stateIcon: getEffectStateIcon(effect),
    chance,
    useWhen,
  };
}

/** `effect_json` de `enemy_skills` → efecto de combate o null si no soportado. */
export function parseEnemySkillEffectJson(effectRaw: unknown): ParsedEnemySkillEffect | null {
  if (!effectRaw || typeof effectRaw !== "object" || Array.isArray(effectRaw)) return null;
  return parseOne(effectRaw as Record<string, unknown>);
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
    case "composite":
      return effect.chance;
    default:
      return 1;
  }
}
