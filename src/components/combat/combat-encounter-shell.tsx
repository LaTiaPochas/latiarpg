"use client";

import Image from "next/image";
import Link from "next/link";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { sumAbilityEffectScalingTotals } from "@/lib/ability-effect-scaling";
import {
  abilityTooltipStatGetterFromCombat,
  formatAbilityTooltipStatExpressions,
  formatAbilityTooltipTotalDamageRange,
} from "@/lib/ability-tooltip-description";
import { normalizePublicAssetUrl } from "@/lib/normalize-asset-url";
import { formatInstanceStatRollTooltipLine, isInstanceStatWeakTooltipKey } from "@/components/character-profile/inventory-types";
import { WeaponPhysicalDamageTooltipLine } from "@/components/character-profile/weapon-physical-damage-tooltip-line";

const BG_INTRO_FOREST = "/img/resources/background/bg_intro_forest.png";
const PJ_FEDE_RPG_FIGHT_STICK =
  "/img/resources/characters/pj_fede_rpg_fight_stick.png";
const PJ_FEDE_FACE_COMBAT =
  "/img/resources/caracters_faces/pj_fede_rpg_face_fight.png";

const MAX_ENEMIES_ON_FIELD = 3;
const ACTION_DELAY_MS = 1000;
const FIRST_ACTION_DELAY_MS = 3000;
/** Igual que tutorial: deja terminar la animación de barra HP antes del modal de derrota. */
const DEFEAT_MODAL_DELAY_MS = 300;
/** Espera breve tras eliminar al último enemigo antes de abrir el modal de victoria. */
const VICTORY_MODAL_DELAY_MS = 1000;

/** Misma altura que la caja scroll del Combat Log en cada breakpoint (mobile vs sm). */
const ACTIONS_PANEL_BODY_MOBILE =
  "mt-2 flex min-h-28 max-h-28 flex-col overflow-hidden";
const ACTIONS_PANEL_BODY_DESKTOP =
  "mt-2 flex min-h-20 max-h-20 flex-col overflow-hidden sm:mt-3 sm:min-h-28 sm:max-h-28";
/** Scroll interno para lista de habilidades (estilo alineado al combat log). */
const ACTIONS_SKILLS_SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-color:rgba(217,119,6,0.75)_rgba(0,0,0,0.35)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-black/35 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-amber-800/60 [&::-webkit-scrollbar-thumb]:bg-amber-600/75 [&::-webkit-scrollbar-thumb:hover]:bg-amber-500/85";
/** MP / cooldown: mismo ancho en todas las filas (alinea el botón «?»). */
const SKILL_COST_BADGE_BOX =
  "inline-flex w-[4rem] shrink-0 items-center justify-center gap-1 tabular-nums";

function SkillCooldownClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function SkillDamageSwordIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="m13 19 6-6" />
      <path d="m16 16 5 5" />
      <path d="M19 21 21 19" />
    </svg>
  );
}

type CombatLogTone = "default" | "danger" | "success";
type CombatLogEntry = {
  id: string;
  text: string;
  tone?: CombatLogTone;
  /** Daño que inflige el PJ (número resaltado en verde en el log). */
  damageValue?: number;
  /** Daño que recibe el PJ (ataque común o habilidad con `{daño}`) — resaltado en rojo. */
  incomingDamageValue?: number;
};

function CombatLogLineBody({ entry }: { entry: CombatLogEntry }) {
  if (entry.damageValue != null) {
    const s = String(entry.damageValue);
    const chunks = entry.text.split(s);
    if (chunks.length < 2) return entry.text;
    return (
      <>
        {chunks[0]}
        <span className="font-semibold text-emerald-300">{entry.damageValue}</span>
        {chunks.slice(1).join(s)}
      </>
    );
  }
  if (entry.incomingDamageValue != null) {
    const s = String(entry.incomingDamageValue);
    const chunks = entry.text.split(s);
    if (chunks.length < 2) return entry.text;
    return (
      <>
        {chunks[0]}
        <span className="font-semibold text-red-600">{entry.incomingDamageValue}</span>
        {chunks.slice(1).join(s)}
      </>
    );
  }
  return entry.text;
}

type PlayerSkillEffectSubtype = "physical" | "magical" | "buff" | "neutral";
type PlayerSelfBuffAffectedStat =
  | "armor"
  | "mr"
  | "hp"
  | "mana"
  | "speed"
  | "weapon_damage_min"
  | "weapon_damage_max"
  | "magic_damage_min"
  | "magic_damage_max";

type PlayerTimedSelfBuffStat = Exclude<PlayerSelfBuffAffectedStat, "hp" | "mana">;

type PlayerTimedSelfBuffPart = {
  stat: PlayerTimedSelfBuffStat;
  amount: number;
};

type PlayerTimedSelfBuff = {
  id: string;
  parts: PlayerTimedSelfBuffPart[];
  remainingTurns: number;
  /** Último valor del contador de ronda `turn` en el que ya se descontó `duration_turns`. */
  lastTickTurn: number;
  skillName: string;
  /** Iconos del `effect_json` (pueden repetirse si el JSON lo indica). */
  stateIcons: string[];
};

/** Debuff / DoT del PJ sobre un enemigo (cliente). */
type PlayerEnemyTimedEffect = {
  id: string;
  enemyId: string;
  /** Duración del debilidad + iconos (cuenta de rondas `turn`). */
  debuffRemainingTurns: number;
  /** Tiradas de DoT **restantes** tras el golpe inicial (p. ej. duration 5 → 4 ticks). */
  dotTicksRemaining: number;
  lastTickTurn: number;
  skillName: string;
  stateIcons: string[];
  extraWeaknessTags: string[];
  dotEffectJson: Record<string, unknown> | null;
};

export type CombatEncounterEnemySkill = {
  id: string;
  name: string;
  description: string | null;
  cooldownTurns: number;
  manaCost: number;
  effect: {
    type: "damage";
    target: "player";
    min: number;
    max: number;
    /** Mitigación vs armor (physical/neutral/buff) o MR (magical) del PJ. */
    subtype: PlayerSkillEffectSubtype;
    /** `damage_type`/`damage_types` del JSON original, normalizado como etiquetas. */
    damageTypes?: string[];
    /** `state_icon` del JSON original, reservado para estados visuales futuros. */
    stateIcon?: string | null;
    /** Probabilidad [0..1] de lanzar la skill cuando está disponible. */
    chance: number;
  };
};

/** Skill del PJ aprendido (`user_character_skills`) + datos de `player_skills` para combate. */
export type CombatPlayerSkillView = {
  /** PK de `user_character_skills`. */
  userCharacterSkillId: string;
  learnedAt: string | null;
  skill: {
    id: string;
    code: string | null;
    name: string;
    description: string | null;
    manaCost: number;
    cooldownTurns: number;
    target: string;
    /** `effect_json` tal como viene de BD (parseado como objeto). */
    effect: Record<string, unknown>;
  };
};
type TurnActor = {
  id: string;
  type: "player" | "enemy";
  speed: number;
  enemyId?: string;
};

const helpCardFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400"],
});

const menuFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

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

/** Un solo tag normalizado desde `weapon_instance.attack_family` (misma convención que el ataque básico). */
function tagsFromWeaponAttackFamilyForResistWeak(family: string | null | undefined): string[] {
  const n = typeof family === "string" ? normalizeDamageTypeLabel(family) : null;
  return n ? [n] : [];
}

/**
 * Tags de daño para RES/WEAK enemigo (`attack_type` o `attack_types` en `effect_json`).
 * Puede ser string, array, string con JSON tipo `["fire","physical"]`, o lista separada por comas.
 * Si un tag es exactamente `weapon`, se sustituye por el `attack_family` del arma equipada (sin tag literal `weapon`).
 */
function getEffectAttackTypesForResistWeak(
  effect: Record<string, unknown>,
  equippedWeaponAttackFamily?: string | null,
): string[] {
  const raw = effect.attack_type ?? effect.attack_types;
  const pushNormalized = (value: unknown, seen: Set<string>, out: string[]) => {
    const asStr =
      typeof value === "string"
        ? value
        : typeof value === "number" && Number.isFinite(value)
          ? String(value)
          : null;
    if (asStr == null) return;
    const normalized = normalizeDamageTypeLabel(asStr);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  const seen = new Set<string>();
  const out: string[] = [];

  if (Array.isArray(raw)) {
    for (const value of raw) pushNormalized(value, seen, out);
  } else if (typeof raw === "string") {
    const t = raw.trim();
    if (t) {
      if (t.startsWith("[") && t.endsWith("]")) {
        try {
          const parsed = JSON.parse(t) as unknown;
          if (Array.isArray(parsed)) {
            for (const value of parsed) pushNormalized(value, seen, out);
          } else {
            pushNormalized(t, seen, out);
          }
        } catch {
          if (t.includes(",") || t.includes("|") || t.includes("/")) {
            for (const part of t.split(/[,|/]+/)) pushNormalized(part, seen, out);
          } else {
            pushNormalized(t, seen, out);
          }
        }
      } else if (t.includes(",") || t.includes("|") || t.includes("/")) {
        for (const part of t.split(/[,|/]+/)) pushNormalized(part, seen, out);
      } else {
        pushNormalized(t, seen, out);
      }
    }
  }

  const fromWeapon = tagsFromWeaponAttackFamilyForResistWeak(equippedWeaponAttackFamily);
  const expanded: string[] = [];
  const expandedSeen = new Set<string>();
  for (const t of out) {
    if (t === "weapon") {
      for (const wt of fromWeapon) {
        if (!expandedSeen.has(wt)) {
          expandedSeen.add(wt);
          expanded.push(wt);
        }
      }
    } else if (!expandedSeen.has(t)) {
      expandedSeen.add(t);
      expanded.push(t);
    }
  }
  if (expanded.length === 0) {
    for (const dt of getEffectDamageTypes(effect)) {
      if (!expandedSeen.has(dt)) {
        expandedSeen.add(dt);
        expanded.push(dt);
      }
    }
  }
  return expanded;
}

function getEffectStateIcons(effect: Record<string, unknown>): string[] {
  const arrRaw = effect.state_icons ?? effect.stateIcons;
  if (Array.isArray(arrRaw)) {
    const out: string[] = [];
    for (const item of arrRaw) {
      if (typeof item === "string" && item.trim().length > 0) out.push(item.trim());
    }
    return out;
  }
  const one = effect.state_icon ?? effect.stateIcon;
  if (typeof one === "string" && one.trim().length > 0) return [one.trim()];
  return [];
}

function getEffectStateIcon(effect: Record<string, unknown>): string | null {
  const xs = getEffectStateIcons(effect);
  return xs[0] ?? null;
}

function getPlayerSkillEffectSubtype(effect: Record<string, unknown>): PlayerSkillEffectSubtype {
  const raw = effect.subtype;
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "physical") return "physical";
  if (s === "magical") return "magical";
  if (s === "buff") return "buff";
  const typeRaw = typeof effect.type === "string" ? effect.type.trim().toLowerCase() : "";
  if (typeRaw === "buff") return "buff";
  return "neutral";
}

function getPlayerSkillTooltipDescription(skill: CombatPlayerSkillView["skill"]): string {
  const fromRow = skill.description?.trim();
  if (fromRow) return fromRow;
  const e = skill.effect.description;
  return typeof e === "string" && e.trim() ? e.trim() : "Sin descripción.";
}

function coerceEffectNumber(val: unknown, fallback: number): number {
  if (typeof val === "number" && Number.isFinite(val)) return Math.trunc(val);
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return fallback;
}

function parseEffectDurationTurns(effect: Record<string, unknown>): number | null {
  const parsed = coerceEffectNumber(
    effect.duration_turns ?? effect.durationTurns ?? effect.duration,
    0,
  );
  return parsed > 0 ? parsed : null;
}

/** Rolado inclusivo entre dos enteros (acepta min y max invertidos). */
function randomIntInclusive(minValue: number, maxValue: number): number {
  const lo = Math.trunc(minValue);
  const hi = Math.trunc(maxValue);
  const safeMin = Math.min(lo, hi);
  const safeMax = Math.max(lo, hi);
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

/**
 * ¿Exige objetivo vivo en campo (enemigo seleccionado)?
 * Usa principalmente `effect_json.target`, con recurso al `target` de fila cuando el JSON está vacío.
 */
function playerSkillRequiresSingleEnemySelection(skill: CombatPlayerSkillView): boolean {
  const effTargetRaw = skill.skill.effect.target;
  const raw =
    typeof effTargetRaw === "string" && effTargetRaw.trim().length > 0
      ? effTargetRaw.trim().toLowerCase()
      : "";

  if (["self", "player", "ally", "friendly"].includes(raw)) return false;
  if (["area", "aoe", "all", "enemies_all", "enemies"].includes(raw)) return false;

  const colRaw =
    typeof skill.skill.target === "string" ? skill.skill.target.trim().toLowerCase() : "";

  if (raw === "") {
    return (
      colRaw === "enemy_single" ||
      colRaw === "enemy-single" ||
      colRaw === "single" ||
      colRaw === "enemy"
    );
  }

  return (
    raw === "single" || raw === "enemy_single" || raw === "enemy-single" || raw === "enemy"
  );
}

/** Daño de área (todos los enemigos vivos según efecto JSON). */
function playerSkillDamageHitsAllEnemies(effect: Record<string, unknown>): boolean {
  const raw =
    typeof effect.target === "string" && effect.target.trim().length > 0
      ? effect.target.trim().toLowerCase()
      : "";
  return (
    raw === "area" ||
    raw === "aoe" ||
    raw === "all" ||
    raw === "enemies_all" ||
    raw === "enemies"
  );
}

/** Single / AoE / Self para el título del tooltip de habilidad. */
function getPlayerSkillTooltipTargetKind(effect: Record<string, unknown>): string {
  const raw = typeof effect.target === "string" ? effect.target.trim().toLowerCase() : "";
  if (["self", "player", "ally", "friendly"].includes(raw)) return "Self";
  if (playerSkillDamageHitsAllEnemies(effect)) return "AoE";
  return "Single";
}

/** Sustituye placeholders para el texto de combate desde `effect_json.description`. */
function formatPlayerSkillCombatLogDescription(
  template: string,
  damageDealt: number,
  enemyHitName?: string | null,
  damageTypes: string[] = [],
): string {
  const s = String(Math.max(0, Math.trunc(damageDealt)));
  const enemyLabel =
    typeof enemyHitName === "string" && enemyHitName.trim().length > 0 ? enemyHitName.trim() : "";
  const damageTypeLabel = damageTypes.join(", ");
  return template
    .replaceAll("{daño}", s)
    .replaceAll("{dano}", s)
    .replaceAll("{damage}", s)
    .replaceAll("{enemigo}", enemyLabel)
    .replaceAll("{damage_type}", damageTypeLabel)
    .replaceAll("{damage_types}", damageTypeLabel);
}

/** Placeholders de daño en `enemy_skills` / descripción de log (enemigo → PJ). */
function enemySkillCombatLogHadDamagePlaceholder(template: string): boolean {
  return (
    template.includes("{daño}") ||
    template.includes("{dano}") ||
    template.includes("{damage}")
  );
}

/**
 * Log de habilidad de enemigo: `{enemigo}` = nombre del atacante; daño = infligido al PJ.
 */
function formatEnemySkillCombatLogDescription(
  template: string,
  damageDealt: number,
  attackerEnemyName: string,
  damageTypes: string[] = [],
): string {
  const s = String(Math.max(0, Math.trunc(damageDealt)));
  const enemyLabel =
    typeof attackerEnemyName === "string" && attackerEnemyName.trim().length > 0
      ? attackerEnemyName.trim()
      : "";
  const damageTypeLabel = damageTypes.join(", ");
  return template
    .replaceAll("{daño}", s)
    .replaceAll("{dano}", s)
    .replaceAll("{damage}", s)
    .replaceAll("{enemigo}", enemyLabel)
    .replaceAll("{damage_type}", damageTypeLabel)
    .replaceAll("{damage_types}", damageTypeLabel);
}

function buffEffectTargetIsSelf(effect: Record<string, unknown>): boolean {
  const raw = typeof effect.target === "string" ? effect.target.trim().toLowerCase() : "";
  return raw === "self" || raw === "player";
}

/** Un término `{ stat, ratio }` → `floor(stat × ratio)` (ratio puede ser decimal). */
function playerSkillScalingEntryBonus(
  entry: unknown,
  getCombatStatValue: (statKeyUpper: string) => number,
): number {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return 0;
  const scaling = entry as Record<string, unknown>;
  const statLabel = typeof scaling.stat === "string" ? scaling.stat.trim().toUpperCase() : "";
  const ratioParsed =
    typeof scaling.ratio === "number"
      ? scaling.ratio
      : typeof scaling.ratio === "string"
        ? Number(scaling.ratio)
        : Number.NaN;
  if (statLabel === "" || !Number.isFinite(ratioParsed)) return 0;
  return Math.floor(Math.max(0, getCombatStatValue(statLabel)) * ratioParsed);
}

/**
 * Suma de escalados: `scaling` ausente, objeto único `{ stat, ratio }`, o array de esos objetos.
 */
function sumPlayerSkillScalingBonus(
  scalingRaw: unknown,
  getCombatStatValue: (statKeyUpper: string) => number,
): number {
  if (scalingRaw == null) return 0;
  if (Array.isArray(scalingRaw)) {
    let sum = 0;
    for (const item of scalingRaw) {
      sum += playerSkillScalingEntryBonus(item, getCombatStatValue);
    }
    return sum;
  }
  if (typeof scalingRaw === "object") {
    return playerSkillScalingEntryBonus(scalingRaw, getCombatStatValue);
  }
  return 0;
}

function isPlayerSelfBuffEffect(effect: Record<string, unknown>): boolean {
  const t = typeof effect.type === "string" ? effect.type.trim().toLowerCase() : "";
  return t === "buff" && buffEffectTargetIsSelf(effect);
}

function buffScalingRatioParsed(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

const AFFECTED_STAT_MAP = new Map<string, PlayerSelfBuffAffectedStat>([
  ["armor", "armor"],
  ["armadura", "armor"],
  ["mr", "mr"],
  ["magic_resist", "mr"],
  ["magicresist", "mr"],
  ["hp", "hp"],
  ["mana", "mana"],
  ["mp", "mana"],
  ["speed", "speed"],
  ["velocidad", "speed"],
  ["weapon_damage_min", "weapon_damage_min"],
  ["weapon-damage-min", "weapon_damage_min"],
  ["weapon_damage_max", "weapon_damage_max"],
  ["weapon-damage-max", "weapon_damage_max"],
  /** Alias: sube/baja min y max por el mismo valor (`mirrorWeaponAndMagicDamageBuffParts`). */
  ["weapon_damage", "weapon_damage_min"],
  ["weapon-damage", "weapon_damage_min"],
  ["magic_damage_min", "magic_damage_min"],
  ["magic-damage-min", "magic_damage_min"],
  ["magic_damage_max", "magic_damage_max"],
  ["magic-damage-max", "magic_damage_max"],
  ["magic_damage", "magic_damage_min"],
  ["magic-damage", "magic_damage_min"],
]);

function parseAffectedStatFromRaw(raw: unknown): PlayerSelfBuffAffectedStat | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!s) return null;
  const hit = s.replace(/\s+/g, "_");
  return AFFECTED_STAT_MAP.get(hit) ?? AFFECTED_STAT_MAP.get(s) ?? null;
}

function parsePlayerSelfAffectedStat(effect: Record<string, unknown>): PlayerSelfBuffAffectedStat | null {
  return parseAffectedStatFromRaw(effect["affected-stat"] ?? effect.affected_stat);
}

function isTimedBuffStat(stat: PlayerSelfBuffAffectedStat): stat is PlayerTimedSelfBuffStat {
  return stat !== "hp" && stat !== "mana";
}

function mergeBuffPartsByStat(
  parts: Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }>,
): Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }> {
  const m = new Map<PlayerSelfBuffAffectedStat, number>();
  for (const p of parts) {
    m.set(p.stat, (m.get(p.stat) ?? 0) + p.amount);
  }
  return Array.from(m.entries())
    .map(([stat, amount]) => ({ stat, amount: Math.trunc(amount) }))
    .filter((p) => p.amount !== 0);
}

function orderedScalingsValues(scalings: Record<string, unknown>): Record<string, unknown>[] {
  return Object.keys(scalings)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((k) => scalings[k])
    .filter((v): v is Record<string, unknown> => v != null && typeof v === "object" && !Array.isArray(v));
}

function parseScalingBuffDebuffType(raw: unknown): "buff" | "debuff" {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "debuff") return "debuff";
  return "buff";
}

/**
 * Un buff a daño de arma o mágico debe mover min y max el mismo entero (p. ej. solo `weapon_damage_min` → también `weapon_damage_max`).
 * Si en el JSON figuran ambos, se usa el promedio entero como valor único aplicado a min y max para no duplicar el efecto.
 */
function mirrorWeaponAndMagicDamageBuffParts(
  parts: Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }>,
): Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }> {
  const pairDelta = (a: number, b: number): number => {
    if (a === 0 && b === 0) return 0;
    if (a !== 0 && b === 0) return a;
    if (b !== 0 && a === 0) return b;
    return Math.trunc((a + b) / 2);
  };

  const rest = parts.filter(
    (p) =>
      p.stat !== "weapon_damage_min" &&
      p.stat !== "weapon_damage_max" &&
      p.stat !== "magic_damage_min" &&
      p.stat !== "magic_damage_max",
  );
  let wMin = 0;
  let wMax = 0;
  let mMin = 0;
  let mMax = 0;
  for (const p of parts) {
    if (p.stat === "weapon_damage_min") wMin += p.amount;
    else if (p.stat === "weapon_damage_max") wMax += p.amount;
    else if (p.stat === "magic_damage_min") mMin += p.amount;
    else if (p.stat === "magic_damage_max") mMax += p.amount;
  }
  const wDelta = pairDelta(wMin, wMax);
  const mDelta = pairDelta(mMin, mMax);
  const out: Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }> = [...rest];
  if (wDelta !== 0) {
    out.push({ stat: "weapon_damage_min", amount: wDelta });
    out.push({ stat: "weapon_damage_max", amount: wDelta });
  }
  if (mDelta !== 0) {
    out.push({ stat: "magic_damage_min", amount: mDelta });
    out.push({ stat: "magic_damage_max", amount: mDelta });
  }
  return mergeBuffPartsByStat(out);
}

/**
 * Nuevo formato: `scalings` objeto con entradas numeradas; cada una `scaling-type` buff/debuff,
 * `affected-stat` y `modifiers` (misma forma que el antiguo `scaling`).
 * Legacy: `affected-stat` + `scaling` en la raíz del efecto.
 */
function resolvePlayerSelfBuffParts(
  effect: Record<string, unknown>,
  getCombatStatValue: (statKeyUpper: string) => number,
): Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }> {
  const scalingsRaw = effect.scalings;
  if (
    scalingsRaw != null &&
    typeof scalingsRaw === "object" &&
    !Array.isArray(scalingsRaw) &&
    Object.keys(scalingsRaw as object).length > 0
  ) {
    const scalings = scalingsRaw as Record<string, unknown>;
    const parts: Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }> = [];
    for (const entry of orderedScalingsValues(scalings)) {
      const kind = parseScalingBuffDebuffType(entry["scaling-type"] ?? entry.scaling_type);
      const stat = parseAffectedStatFromRaw(entry["affected-stat"] ?? entry.affected_stat);
      const modifiersRaw = entry.modifiers ?? entry.modifier ?? entry.scaling;
      const sum = Math.trunc(sumAbilityEffectScalingTotals(modifiersRaw, getCombatStatValue));
      const magnitude = Math.abs(sum);
      if (!stat || magnitude === 0) continue;
      const signed = kind === "debuff" ? -magnitude : magnitude;
      parts.push({ stat, amount: signed });
    }
    return mirrorWeaponAndMagicDamageBuffParts(mergeBuffPartsByStat(parts));
  }

  const stat = parsePlayerSelfAffectedStat(effect);
  if (!stat) return [];
  const sum = Math.trunc(sumAbilityEffectScalingTotals(effect.scaling, getCombatStatValue));
  const gain = Math.max(0, sum);
  if (gain === 0) return [];
  return mirrorWeaponAndMagicDamageBuffParts([{ stat, amount: gain }]);
}

function splitSelfBuffPartsForTimedAndInstant(
  parts: Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }>,
  durationTurns: number | null,
): {
  timedParts: PlayerTimedSelfBuffPart[];
  instantParts: Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }>;
} {
  const timedDraft: PlayerTimedSelfBuffPart[] = [];
  const instantParts: Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }> = [];
  for (const p of parts) {
    if (durationTurns != null && isTimedBuffStat(p.stat)) {
      timedDraft.push({ stat: p.stat, amount: p.amount });
    } else {
      instantParts.push(p);
    }
  }
  const mergedTimed = mergeBuffPartsByStat(
    timedDraft.map((t) => ({ stat: t.stat as PlayerSelfBuffAffectedStat, amount: t.amount })),
  ).filter((x): x is { stat: PlayerTimedSelfBuffStat; amount: number } => isTimedBuffStat(x.stat));
  return {
    timedParts: mergedTimed.map((x) => ({ stat: x.stat, amount: x.amount })),
    instantParts,
  };
}

type CombatBuffStatDebugNumbers = {
  armor: number;
  mr: number;
  speed: number;
  weaponMin: number;
  weaponMax: number;
  magicMin: number;
  magicMax: number;
  /** Mismo criterio que `MAGIC_DAMAGE` en scaling de skills. */
  magicAvgForScaling: number;
  hp: number;
  mana: number;
};

function addTimedBuffPartsToStatTotals(
  base: Record<PlayerTimedSelfBuffStat, number>,
  parts: PlayerTimedSelfBuffPart[],
): Record<PlayerTimedSelfBuffStat, number> {
  const out: Record<PlayerTimedSelfBuffStat, number> = { ...base };
  for (const p of parts) {
    out[p.stat] = out[p.stat] + Math.trunc(p.amount);
  }
  return out;
}

function sumInstantSelfBuffCombatDeltas(
  instantParts: Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }>,
): {
  armor: number;
  mr: number;
  speed: number;
  weaponMin: number;
  weaponMax: number;
  magicMin: number;
  magicMax: number;
  hpHeal: number;
  manaDelta: number;
} {
  const d = {
    armor: 0,
    mr: 0,
    speed: 0,
    weaponMin: 0,
    weaponMax: 0,
    magicMin: 0,
    magicMax: 0,
    hpHeal: 0,
    manaDelta: 0,
  };
  for (const p of instantParts) {
    const a = Math.trunc(p.amount);
    switch (p.stat) {
      case "armor":
        d.armor += a;
        break;
      case "mr":
        d.mr += a;
        break;
      case "speed":
        d.speed += a;
        break;
      case "weapon_damage_min":
        d.weaponMin += a;
        break;
      case "weapon_damage_max":
        d.weaponMax += a;
        break;
      case "magic_damage_min":
        d.magicMin += a;
        break;
      case "magic_damage_max":
        d.magicMax += a;
        break;
      case "hp":
        if (a > 0) d.hpHeal += a;
        break;
      case "mana":
        d.manaDelta += a;
        break;
      default:
        break;
    }
  }
  return d;
}

function computeCombatBuffStatNumbers(args: {
  playerArmor: number;
  playerCombatArmorBonus: number;
  timed: Record<PlayerTimedSelfBuffStat, number>;
  playerMr: number;
  playerCombatMrBonus: number;
  playerSpeed: number;
  playerCombatSpeedBonus: number;
  playerWeaponDamageMin: number;
  playerWeaponDamageMax: number;
  playerCombatWeaponDamageMinBonus: number;
  playerCombatWeaponDamageMaxBonus: number;
  playerMagicDamageMin: number;
  playerMagicDamageMax: number;
  playerCombatMagicDamageMinBonus: number;
  playerCombatMagicDamageMaxBonus: number;
  playerCurrentHp: number;
  displayPlayerMana: number;
  playerHpMax: number;
  playerManaMax: number;
}): CombatBuffStatDebugNumbers {
  const t = args.timed;
  const armor = Math.max(
    0,
    Math.trunc(args.playerArmor + args.playerCombatArmorBonus + t.armor),
  );
  const mr = Math.max(0, Math.trunc(args.playerMr + args.playerCombatMrBonus + t.mr));
  const speed = Math.max(
    0,
    Math.trunc(args.playerSpeed + args.playerCombatSpeedBonus + t.speed),
  );
  const weaponMin = Math.max(
    1,
    Math.floor(
      args.playerWeaponDamageMin +
        args.playerCombatWeaponDamageMinBonus +
        t.weapon_damage_min,
    ),
  );
  const weaponMax = Math.max(
    weaponMin,
    Math.floor(
      args.playerWeaponDamageMax +
        args.playerCombatWeaponDamageMaxBonus +
        t.weapon_damage_max,
    ),
  );
  const magicMin = Math.max(
    0,
    Math.floor(
      args.playerMagicDamageMin +
        args.playerCombatMagicDamageMinBonus +
        t.magic_damage_min,
    ),
  );
  const magicMax = Math.max(
    magicMin,
    Math.floor(
      args.playerMagicDamageMax +
        args.playerCombatMagicDamageMaxBonus +
        t.magic_damage_max,
    ),
  );
  const magicAvgForScaling = Math.floor((magicMin + magicMax) / 2);
  return {
    armor,
    mr,
    speed,
    weaponMin,
    weaponMax,
    magicMin,
    magicMax,
    magicAvgForScaling,
    hp: args.playerCurrentHp,
    mana: args.displayPlayerMana,
  };
}

function logCombatBuffStatDebug(payload: {
  skillName: string;
  turn: number;
  durationTurns: number | null;
  parts: Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }>;
  timedParts: PlayerTimedSelfBuffPart[];
  instantParts: Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }>;
  antes: CombatBuffStatDebugNumbers;
  despues: CombatBuffStatDebugNumbers;
  timedTotalsAntes: Record<PlayerTimedSelfBuffStat, number>;
  timedTotalsDespues: Record<PlayerTimedSelfBuffStat, number>;
  instantDeltas: ReturnType<typeof sumInstantSelfBuffCombatDeltas>;
}): void {
  console.log("[combate][buff][stats] antes → después (previsto mismo tick)", {
    skill: payload.skillName,
    turn: payload.turn,
    duration_turns: payload.durationTurns,
    efectivo: { antes: payload.antes, despues: payload.despues },
    partes_resueltas: payload.parts,
    timed_parts_nuevos: payload.timedParts,
    instant_parts: payload.instantParts,
    timed_totals: { antes: payload.timedTotalsAntes, despues: payload.timedTotalsDespues },
    bonos_instantaneos_sumados: payload.instantDeltas,
  });
}

function getPlayerSkillDamageEffectKind(
  effect: Record<string, unknown>,
): "none" | "damage" | "damage_dot" {
  const t = typeof effect.type === "string" ? effect.type.trim().toLowerCase() : "";
  if (t === "damage") return "damage";
  if (t === "damage-dot" || t === "damage_dot") return "damage_dot";
  return "none";
}

/** Tags extra de debilidad desde una línea de `scalings` en skills de daño / DoT. */
function parseDamageDebuffWeaknessTagsFromScalingEntry(entry: Record<string, unknown>): string[] {
  const kind = parseScalingBuffDebuffType(entry["scaling-type"] ?? entry.scaling_type);
  if (kind !== "debuff") return [];
  const affRaw = entry["affected-stat"] ?? entry.affected_stat;
  const affStr = typeof affRaw === "string" ? affRaw.trim().toLowerCase() : "";
  const weaknessField = entry.weakness ?? entry.Weakness;
  const wFromField =
    typeof weaknessField === "string" ? normalizeDamageTypeLabel(weaknessField) : null;
  if (affStr === "weakness") {
    return wFromField ? [wFromField] : [];
  }
  const parsedStat = parseAffectedStatFromRaw(affRaw);
  if (parsedStat != null) return [];
  const fromAff = normalizeDamageTypeLabel(affRaw);
  return fromAff ? [fromAff] : [];
}

function collectWeaknessTagsFromDamageSkillScalings(effect: Record<string, unknown>): string[] {
  const raw = effect.scalings;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const scalings = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of orderedScalingsValues(scalings)) {
    for (const tag of parseDamageDebuffWeaknessTagsFromScalingEntry(entry)) {
      if (!seen.has(tag)) {
        seen.add(tag);
        out.push(tag);
      }
    }
  }
  return out;
}

function mergeEnemyWeaknessesForPlayerAttackFromEffects(
  enemy: CombatEncounterEnemyView,
  effects: PlayerEnemyTimedEffect[],
): string[] {
  const extra: string[] = [];
  for (const e of effects) {
    if (e.enemyId !== enemy.id) continue;
    for (const t of e.extraWeaknessTags) {
      const n = normalizeDamageTypeLabel(t);
      if (n) extra.push(n);
    }
  }
  const base = enemy.weaknesses
    .map((w) => normalizeDamageTypeLabel(String(w)))
    .filter((w): w is string => Boolean(w));
  const seen = new Set<string>(base);
  const out = [...base];
  for (const t of extra) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function mergeEnemyWeaknessesWithExtraTags(
  enemy: CombatEncounterEnemyView,
  effects: PlayerEnemyTimedEffect[],
  additionalTags: string[],
): string[] {
  const merged = mergeEnemyWeaknessesForPlayerAttackFromEffects(enemy, effects);
  const seen = new Set(merged);
  const out = [...merged];
  for (const t of additionalTags) {
    const n = normalizeDamageTypeLabel(t);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function computePlayerSkillMitigatedDamageToEnemy(
  effect: Record<string, unknown>,
  enemy: CombatEncounterEnemyView,
  opts: {
    getCombatStatValue: (key: string) => number;
    skillDamageBases: PlayerSkillDamageBaseBounds;
    magicalCombatDamageFlat: number;
    resistWeakTags: string[];
    /** Lista completa de debilidades (base + temporales) para RES/WEAK. */
    weaknessesResolved: string[];
  },
): number {
  const subtype = getPlayerSkillEffectSubtype(effect);
  const defenseStat = enemyDefenseStatForPlayerSkill(subtype, enemy);
  let rawDamage = rollDamageFromPlayerSkillEffect(effect, opts.getCombatStatValue, opts.skillDamageBases);
  rawDamage =
    subtype === "magical"
      ? Math.max(0, Math.trunc(rawDamage + opts.magicalCombatDamageFlat))
      : rawDamage;
  const mitigated = mitigateDamageByDefense(rawDamage, defenseStat);
  return applyEnemyResistWeakTagsToMitigatedDamage(
    mitigated,
    opts.resistWeakTags,
    enemy.resistances,
    opts.weaknessesResolved,
  );
}

function formatPlayerSelfBuffCombatLog(
  template: string,
  parts: Array<{ stat: PlayerSelfBuffAffectedStat; amount: number }>,
  durationTurns: number | null,
): string {
  const duration = durationTurns != null ? String(Math.max(0, Math.trunc(durationTurns))) : "";
  const amtFor = (s: PlayerSelfBuffAffectedStat) =>
    String(Math.trunc(parts.find((p) => p.stat === s)?.amount ?? 0));
  const z = () => "0";
  const amountSummary =
    parts.length === 0
      ? "0"
      : parts.length === 1
        ? String(Math.abs(parts[0].amount))
        : parts.map((p) => String(Math.abs(p.amount))).join(" · ");
  return template
    .replaceAll("{amount}", amountSummary)
    .replaceAll("{armor}", parts.some((p) => p.stat === "armor") ? amtFor("armor") : z())
    .replaceAll("{mr}", parts.some((p) => p.stat === "mr") ? amtFor("mr") : z())
    .replaceAll("{hp}", parts.some((p) => p.stat === "hp") ? amtFor("hp") : z())
    .replaceAll("{mana}", parts.some((p) => p.stat === "mana") ? amtFor("mana") : z())
    .replaceAll("{speed}", parts.some((p) => p.stat === "speed") ? amtFor("speed") : z())
    .replaceAll("{duration_turns}", duration)
    .replaceAll("{duration}", duration);
}

/** Bases cuando el effect_json trae `min`/`max` en 0 según `subtype`. */
type PlayerSkillDamageBaseBounds = {
  /** `weapon_damage_*` del PJ + buffs temporales de combate (misma lógica que el ataque físico). */
  weaponMin: number;
  weaponMax: number;
  /** `magic_damage_*` del PJ (sin el flat post-tiro de buffs mágicos de combate). */
  magicMin: number;
  magicMax: number;
};

/**
 * Si `min` y `max` del JSON son 0: `magical` usa daño mágico base; `physical` usa daño de arma.
 */
function resolvePlayerSkillDamageRollBounds(
  effect: Record<string, unknown>,
  bases: PlayerSkillDamageBaseBounds,
): { minV: number; maxV: number } {
  const minV = Math.max(0, coerceEffectNumber(effect.min, 0));
  const maxV = Math.max(minV, coerceEffectNumber(effect.max, minV));
  if (minV !== 0 || maxV !== 0) return { minV, maxV };

  const sub = getPlayerSkillEffectSubtype(effect);
  if (sub === "magical") {
    const mmin = Math.max(0, Math.trunc(bases.magicMin));
    const mmax = Math.max(mmin, Math.trunc(bases.magicMax));
    return { minV: mmin, maxV: mmax };
  }
  if (sub === "physical") {
    const wmin = Math.max(0, Math.trunc(bases.weaponMin));
    const wmax = Math.max(wmin, Math.trunc(bases.weaponMax));
    return { minV: wmin, maxV: wmax };
  }
  return { minV, maxV };
}

function rollDamageFromPlayerSkillEffect(
  effect: Record<string, unknown>,
  getCombatStatValue: (statKeyUpper: string) => number,
  bases: PlayerSkillDamageBaseBounds,
): number {
  const { minV, maxV } = resolvePlayerSkillDamageRollBounds(effect, bases);
  let total = randomIntInclusive(minV, maxV);
  total += sumPlayerSkillScalingBonus(effect.scaling, getCombatStatValue);
  return Math.max(0, total);
}

/**
 * Rango teórico de daño con escalado de stats (min/max del efecto + bonus fijo).
 * No resta armadura ni MR del enemigo (solo lo que aplica en el tiro antes de mitigar).
 */
function computePlayerSkillDamageRangeBeforeArmor(
  effect: Record<string, unknown>,
  getCombatStatValue: (statKeyUpper: string) => number,
  /** Bonos temporales mágicos de combate (buff `magic_damage_*`), solo si subtype es mágico. */
  magicalCombatBonusFlat = 0,
  bases: PlayerSkillDamageBaseBounds = {
    weaponMin: 0,
    weaponMax: 0,
    magicMin: 0,
    magicMax: 0,
  },
): { min: number; max: number } | null {
  const typeRaw = typeof effect.type === "string" ? effect.type.trim().toLowerCase() : "";
  const isDamageLike =
    typeRaw === "damage" || typeRaw === "damage-dot" || typeRaw === "damage_dot";
  if (!isDamageLike) return null;
  const { minV, maxV } = resolvePlayerSkillDamageRollBounds(effect, bases);
  const bonus = sumPlayerSkillScalingBonus(effect.scaling, getCombatStatValue);
  const extra =
    getPlayerSkillEffectSubtype(effect) === "magical"
      ? Math.max(0, Math.trunc(magicalCombatBonusFlat))
      : 0;
  return {
    min: Math.max(0, minV + bonus + extra),
    max: Math.max(0, maxV + bonus + extra),
  };
}

/** Daño bruto menos armadura/MR (resultado no negativo). */
function mitigateDamageByDefense(rawDamage: number, defense: number): number {
  const raw = Math.max(0, Math.trunc(rawDamage));
  const def = Math.max(0, Math.trunc(defense));
  return Math.max(0, raw - def);
}

/**
 * Tras (daño - armadura/MR): si algún tag está en resistencias del enemigo ×0.5;
 * si no, si algún tag está en debilidades ×2; si no coincide ninguno, sin cambio.
 * Resistencia tiene prioridad si un mismo tag figurara en ambas listas (no debería).
 */
function applyEnemyResistWeakTagsToMitigatedDamage(
  damageAfterDefense: number,
  attackTags: string[],
  resistances: string[],
  weaknesses: string[],
): number {
  const base = Math.max(0, Math.trunc(damageAfterDefense));
  const tags = attackTags.map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
  if (tags.length === 0) return base;
  const norm = (arr: string[]) =>
    arr.map((s) => String(s).trim().toLowerCase()).filter((s) => s.length > 0);
  const res = norm(resistances);
  const weak = norm(weaknesses);
  if (tags.some((t) => res.includes(t))) return Math.max(0, Math.floor(base * 0.5));
  if (tags.some((t) => weak.includes(t))) return Math.max(0, Math.floor(base * 2));
  return base;
}

/**
 * Tras (daño - armadura): un solo `attack_family` de arma (misma regla que varios tags).
 */
function applyEnemyAttackFamilyToMitigatedDamage(
  damageAfterArmor: number,
  attackFamily: string | null | undefined,
  resistances: string[],
  weaknesses: string[],
): number {
  const fam =
    typeof attackFamily === "string" && attackFamily.trim().length > 0
      ? attackFamily.trim().toLowerCase()
      : "";
  return applyEnemyResistWeakTagsToMitigatedDamage(
    damageAfterArmor,
    fam ? [fam] : [],
    resistances,
    weaknesses,
  );
}

/** Daño del PJ al enemigo: físico/neutral/buff usa armor del monstruo; mágico usa MR. */
function enemyDefenseStatForPlayerSkill(
  subtype: PlayerSkillEffectSubtype,
  enemy: CombatEncounterEnemyView,
): number {
  if (subtype === "magical") return Math.max(0, Math.trunc(enemy.mr));
  return Math.max(0, Math.trunc(enemy.armor));
}

/** Daño que recibe el PJ: físico/neutral/buff usa armor del PJ; mágico usa MR. */
function playerDefenseStatVsIncoming(
  subtype: PlayerSkillEffectSubtype,
  playerArmor: number,
  playerMr: number,
): number {
  if (subtype === "magical") return Math.max(0, Math.trunc(playerMr));
  return Math.max(0, Math.trunc(playerArmor));
}

/** Normaliza subtype de skills enemigas para decidir mitigación (armor vs MR). */
function enemySkillIncomingSubtype(effect: CombatEncounterEnemySkill["effect"]): PlayerSkillEffectSubtype {
  const raw = effect.subtype;
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "physical") return "physical";
  if (s === "magical") return "magical";
  if (s === "buff") return "buff";
  return "neutral";
}

type EnemySkillDecision = {
  chosenSkill: CombatEncounterEnemySkill | null;
  evaluatedSkill: CombatEncounterEnemySkill;
  roll: number;
  chance: number;
  nextAvailableTurn: number;
};

type PlayerSkillSubtypeStyles = {
  rowButtonActive: string;
  rowButtonDisabled: string;
  mpBadge: string;
  infoButton: string;
  tooltipPanel: string;
  tooltipCloseBtn: string;
  tooltipTitle: string;
  tooltipDivider: string;
  tooltipBody: string;
  tooltipTargetLine: string;
};

function getPlayerSkillSubtypeStyles(subtype: PlayerSkillEffectSubtype): PlayerSkillSubtypeStyles {
  switch (subtype) {
    case "physical":
      return {
        rowButtonActive:
          "cursor-pointer border-red-600/75 bg-red-950/50 text-red-100 hover:border-red-500/85 hover:bg-red-900/55",
        rowButtonDisabled:
          "cursor-not-allowed border-red-900/45 bg-red-950/25 text-red-200/50 opacity-70",
        mpBadge: "border-red-600/70 bg-red-950/55 text-red-200",
        infoButton:
          "border-red-500/80 bg-red-900/60 text-red-100 hover:bg-red-800/75",
        tooltipPanel:
          "border-red-700/75 bg-[#1c1010]/96 text-red-100 shadow-[0_12px_30px_rgba(0,0,0,0.55)]",
        tooltipCloseBtn:
          "border-red-500/80 bg-red-950/70 text-red-100 hover:bg-red-800/80",
        tooltipTitle: "text-red-50",
        tooltipDivider: "bg-red-500/45",
        tooltipBody: "text-red-50/95",
        tooltipTargetLine: "text-red-200/95",
      };
    case "buff":
      return {
        rowButtonActive:
          "cursor-pointer border-emerald-600/75 bg-emerald-950/45 text-emerald-100 hover:border-emerald-500/85 hover:bg-emerald-900/50",
        rowButtonDisabled:
          "cursor-not-allowed border-emerald-900/40 bg-emerald-950/22 text-emerald-200/45 opacity-70",
        mpBadge: "border-emerald-600/70 bg-emerald-950/55 text-emerald-200",
        infoButton:
          "border-emerald-500/80 bg-emerald-900/60 text-emerald-100 hover:bg-emerald-800/75",
        tooltipPanel:
          "border-emerald-700/75 bg-[#0f1a14]/96 text-emerald-100 shadow-[0_12px_30px_rgba(0,0,0,0.55)]",
        tooltipCloseBtn:
          "border-emerald-500/80 bg-emerald-950/70 text-emerald-100 hover:bg-emerald-800/80",
        tooltipTitle: "text-emerald-50",
        tooltipDivider: "bg-emerald-500/45",
        tooltipBody: "text-emerald-50/95",
        tooltipTargetLine: "text-emerald-200/95",
      };
    case "magical":
      return {
        rowButtonActive:
          "cursor-pointer border-sky-600/75 bg-sky-950/50 text-sky-100 hover:border-sky-500/85 hover:bg-sky-900/55",
        rowButtonDisabled:
          "cursor-not-allowed border-sky-900/45 bg-sky-950/25 text-sky-200/50 opacity-70",
        mpBadge: "border-sky-600/70 bg-sky-950/55 text-sky-200",
        infoButton:
          "border-sky-500/80 bg-sky-900/60 text-sky-100 hover:bg-sky-800/75",
        tooltipPanel:
          "border-sky-700/75 bg-[#0f1827]/96 text-sky-100 shadow-[0_12px_30px_rgba(0,0,0,0.55)]",
        tooltipCloseBtn:
          "border-sky-500/80 bg-sky-950/70 text-sky-100 hover:bg-sky-800/80",
        tooltipTitle: "text-sky-50",
        tooltipDivider: "bg-sky-500/45",
        tooltipBody: "text-sky-50/95",
        tooltipTargetLine: "text-sky-200/95",
      };
    default:
      return {
        rowButtonActive:
          "cursor-pointer border-slate-500/75 bg-slate-800/50 text-slate-100 hover:border-slate-400/70 hover:bg-slate-700/55",
        rowButtonDisabled:
          "cursor-not-allowed border-slate-600/60 bg-slate-900/35 text-slate-400 opacity-65",
        mpBadge: "border-slate-500/70 bg-slate-900/55 text-slate-200",
        infoButton:
          "border-slate-500/80 bg-slate-800/60 text-slate-100 hover:bg-slate-700/75",
        tooltipPanel:
          "border-slate-600/75 bg-[#141820]/96 text-slate-100 shadow-[0_12px_30px_rgba(0,0,0,0.55)]",
        tooltipCloseBtn:
          "border-slate-500/80 bg-slate-900/70 text-slate-100 hover:bg-slate-800/80",
        tooltipTitle: "text-slate-50",
        tooltipDivider: "bg-slate-500/45",
        tooltipBody: "text-slate-50/95",
        tooltipTargetLine: "text-slate-300/95",
      };
  }
}

/** Datos del enemigo para UI + lógica de combate en cliente (HP visible en panel por enemigo). */
export type CombatEncounterEnemyView = {
  id: string;
  templateId: string | null;
  spawnIndex: number;
  name: string;
  enemyLevel: number | null;
  portraitSrc: string | null;
  spriteSrc: string | null;
  /** Ajustes visuales opcionales del sprite en el escenario. */
  spriteOffsetX: number;
  spriteOffsetY: number;
  /** Offsets exclusivos para mobile (`combat_encounter_enemies.mobile_offset_x/y`). */
  mobileSpriteOffsetX: number;
  mobileSpriteOffsetY: number;
  spriteScale: number;
  spriteZIndex: number;
  xpReward: number;
  goldRewards: number;
  hp: number;
  hpMax: number;
  mana: number;
  armor: number;
  mr: number;
  speed: number;
  attackMin: number;
  attackMax: number;
  magicMin: number;
  magicMax: number;
  skills: CombatEncounterEnemySkill[];
  levelOverride: number | null;
  aiProfile: string | null;
  /** Desde `enemy_template.resistances` (misma forma que `user_character.resistances`). */
  resistances: string[];
  weaknesses: string[];
};

export type CombatVictoryLootItem = {
  lootKey: string;
  itemId: string;
  name: string;
  iconPath: string | null;
  quantity: number;
  description: string | null;
  quoteText: string | null;
  sellValue: number;
  itemTypeId: number | null;
  itemTypeCode: string | null;
  rarityColor: string | null;
  weaponInstance?: {
    rarity: string | null;
    rarityColor: string | null;
    attackFamily: string | null;
    attackDamageMin: number | null;
    attackDamageMax: number | null;
    magicDamageMin: number | null;
    magicDamageMax: number | null;
    statKey1: string | null;
    valueFlat1: number | null;
    valuePct1: number | null;
    statKey2: string | null;
    valueFlat2: number | null;
    valuePct2: number | null;
    statKey3: string | null;
    valueFlat3: number | null;
    valuePct3: number | null;
    statKey4: string | null;
    valueFlat4: string | number | null;
    valuePct4: number | null;
    statKey5: string | null;
    valueFlat5: string | number | null;
    valuePct5: number | null;
  } | null;
  equipmentInstance?: {
    rarity: string | null;
    rarityColor: string | null;
    statKey1: string | null;
    valueFlat1: number | null;
    valuePct1: number | null;
    statKey2: string | null;
    valueFlat2: number | null;
    valuePct2: number | null;
    statKey3: string | null;
    valueFlat3: number | null;
    valuePct3: number | null;
    statKey4: string | null;
    valueFlat4: string | number | null;
    valuePct4: number | null;
    statKey5: string | null;
    valueFlat5: string | number | null;
    valuePct5: number | null;
  } | null;
};
export type CombatDefeatLostItem = {
  inventoryId: number;
  name: string;
  iconPath: string | null;
  quantityLost: number;
};

function capitalizeFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function weaponDamageRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  const a = min != null && Number.isFinite(Number(min)) ? Number(min) : 0;
  const b = max != null && Number.isFinite(Number(max)) ? Number(max) : 0;
  return `${a} - ${b}`;
}

export type CombatPlayerConsumableView = {
  inventoryId: number;
  itemId: string;
  name: string;
  description: string | null;
  effect: Record<string, unknown> | null;
  quantity: number;
};

export type CombatConsumeResult = {
  ok: boolean;
  remainingQuantity?: number;
  error?: string;
};

export type CombatEncounterStatsPayload = {
  didWin: boolean;
  enemiesDefeated: number;
  bossesDefeated: number;
  totalDamageDealt: number;
  highestHitDealt: number;
  totalDamageTaken: number;
  totalHealing: number;
  highestHitReceived: number;
  finalHp: number;
  finalMana: number;
};

export type CombatEncounterDebugPayload = {
  encounterCode: string;
  /** `zones.code` usado en la URL (?zone=), o null si no se filtró por zona. */
  zoneFilter: string | null;
  encounterId: string;
  rowsError: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  } | null;
  rawRowCount: number;
  mappedEnemyCount: number;
  enemies: CombatEncounterEnemyView[];
  /** Resistencias / debilidades del PJ al iniciar el encuentro (desde `user_character`). */
  playerResistances?: string[];
  playerWeaknesses?: string[];
  /** `weapon_instance.attack_family` del arma equipada en slot `weapon` al iniciar el encuentro. */
  playerWeaponAttackFamily?: string | null;
  rawRows: Array<{
    index: number;
    spawn_index: number | null;
    hp_override: number | null;
    mana_override: number | null;
    ai_profile: string | null;
    enemyTemplate: Record<string, unknown> | null;
  }>;
  lootDebug?: Record<string, unknown>;
};

export type CombatEncounterShellProps = {
  encounterName: string;
  encounterCode: string;
  combatStep: string | null;
  isBoss: boolean;
  recommendedLevel: number | null;
  backgroundSrc: string | null;
  enemies: CombatEncounterEnemyView[];
  combatDebug?: CombatEncounterDebugPayload | null;
  combatStartMessage?: string | null;
  /** Overrides opcionales del PJ (más adelante desde `user_character`). */
  playerDisplayName?: string;
  /** Retrato en panel de estado (combate); por defecto cara de combate del PJ. */
  playerPortraitSrc?: string | null;
  playerSpriteSrc?: string;
  playerHp?: number;
  playerHpMax?: number;
  playerMana?: number;
  playerManaMax?: number;
  playerSpeed?: number;
  playerWeaponDamageMin?: number;
  playerWeaponDamageMax?: number;
  /** Daño mágico base del PJ (ej. `user_character.magic_damage_*`); hechizos con min/max 0 en JSON usan esto. */
  playerMagicDamageMin?: number;
  playerMagicDamageMax?: number;
  playerStatStr?: number;
  playerStatDex?: number;
  playerStatInt?: number;
  playerStatWis?: number;
  playerArmor?: number;
  playerMr?: number;
  /** Copia en memoria para lógica de combate (`user_character.resistances`). */
  playerResistances?: string[];
  playerWeaknesses?: string[];
  /** `weapon_instance.attack_family` del arma equipada (ataque normal). */
  playerWeaponAttackFamily?: string | null;
  /** Con `?debug=1`: `console.log` en cliente con resistencias PJ + enemigos al montar / al cambiar props. */
  combatResistWeakDebug?: boolean;
  /** Con `?debug=1`: al usar un buff self, `console.log` con stats efectivas antes / después (previsto mismo tick). */
  combatBuffStatDebug?: boolean;
  playerExperienceToNext?: number;
  playerLevelCurrent?: number;
  playerLevelAfterVictory?: number;
  /** Skills aprendidos del PJ (`user_character_skills` + `player_skills`). */
  playerSkills?: CombatPlayerSkillView[];
  /** Consumibles visibles en combate (`user_inventory` + `items`, item_type_id=consumable). */
  playerConsumables?: CombatPlayerConsumableView[];
  /** Loot ya rolado al iniciar el combate (`enemy_drop_tables.combat_encounter_id` = `combat_encounters.code`). */
  victoryLootItems?: CombatVictoryLootItem[];
  /** Items que se perderán al ser derrotado (penalidad de combate). */
  defeatLostItems?: CombatDefeatLostItem[];
  /** Oro calculado desde los drops rolados (no desde enemy_templates.gold_rewards). */
  victoryGoldFromLoot?: number;
  /** Acción servidor para consumir 1 unidad en inventario. */
  onConsumeConsumable?: (inventoryId: number) => Promise<CombatConsumeResult>;
  /** Persiste estado actual (HP/Mana) cuando el usuario escapa. */
  onEscapePersistState?: (payload: { finalHp: number; finalMana: number }) => Promise<void>;
  /** Registra en el log global cuando el PJ cae en combate. */
  onPlayerDefeatedGlobalLog?: () => Promise<void>;
  /** Registra en el log global cuando el PJ sube de nivel. */
  onPlayerLevelUpGlobalLog?: (newLevel: number) => Promise<void>;
  /** Persiste estadísticas acumuladas del combate al finalizar (victoria/derrota). */
  onCombatFinishedStats?: (payload: CombatEncounterStatsPayload) => Promise<void>;
  /** Destino para "Escapar" (normalmente el mapa de la zona origen). */
  escapeHref?: string;
};

function EncounterRasterMedia({
  src,
  alt,
  className,
  mode,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  mode: "cover" | "contain";
  sizes?: string;
}) {
  const remote = /^https?:\/\//i.test(src);

  if (remote) {
    const remoteClass =
      mode === "cover"
        ? `absolute inset-0 h-full w-full ${className ?? ""}`.trim()
        : (className ?? "");
    return (
      // eslint-disable-next-line @next/next/no-img-element -- storage / URLs absolutas
      <img
        src={src}
        alt={alt}
        className={remoteClass}
        decoding="async"
        sizes={sizes}
      />
    );
  }

  if (mode === "cover") {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        sizes={sizes ?? "96px"}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={200}
      height={200}
      className={className}
      sizes={sizes}
    />
  );
}

function BattleBackground({ src }: { src: string }) {
  const isRemote = /^https?:\/\//i.test(src);

  if (isRemote) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        decoding="async"
        fetchPriority="high"
      />
    );
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      priority
      className="object-cover object-center"
      sizes="100vw"
    />
  );
}

function enemyHpPercent(enemy: CombatEncounterEnemyView) {
  return Math.round((enemy.hp / Math.max(1, enemy.hpMax)) * 100);
}

function enemyNameLevelColorClass(recommendedLevel: number | null, playerLevel: number) {
  if (recommendedLevel == null) return "text-white";

  const levelDiff = Math.trunc(recommendedLevel) - Math.max(1, Math.trunc(playerLevel));

  if (levelDiff >= 3) return "text-red-400";
  if (levelDiff >= 1) return "text-yellow-200/85";
  if (levelDiff == -3) return "text-blue-300";
  if (levelDiff <= -4) return "text-blue-500";
  if (levelDiff <= -1) return "text-green-300/90";
  return "text-white";
}

function PlayerBuffStateIconStrip({ srcs }: { srcs: string[] }) {
  if (srcs.length === 0) return null;
  return (
    <div
      className="flex flex-wrap justify-start gap-0.5 px-2 sm:px-2"
      aria-label="Estados activos"
    >
      {srcs.map((src, idx) => (
        <div
          key={`${idx}:${src}`}
          className="relative h-6 w-6 shrink-0 overflow-hidden rounded border border-amber-300/75 bg-black/50 sm:h-7 sm:w-7"
        >
          <Image src={src} alt="" fill className="object-contain p-px" sizes="16px" />
        </div>
      ))}
    </div>
  );
}

function PlayerStatusModal({
  displayName,
  level,
  portraitSrc,
  hp,
  hpMax,
  mana,
  manaMax,
  hpPercent,
  manaPercent,
}: {
  displayName: string;
  level: number;
  portraitSrc: string | null;
  hp: number;
  hpMax: number;
  mana: number;
  manaMax: number;
  hpPercent: number;
  manaPercent: number;
}) {
  return (
    <div
      className={`${menuFont.className} w-[min(100%,11.5rem)] shrink-0 rounded-xl border border-amber-600/50 bg-[#1a100c]/92 mx-1 p-2 shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:w-52 sm:p-2.5`}
      role="group"
      aria-label={`Estado de ${displayName}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex w-12 shrink-0 flex-col items-center gap-2 sm:w-[3.25rem]">
          <div className="relative h-11 w-11 overflow-hidden rounded-lg border border-amber-600/50 bg-black/45 sm:h-[3.25rem] sm:w-[3.25rem]">
            {portraitSrc ? (
              <EncounterRasterMedia
                src={portraitSrc}
                alt=""
                mode="cover"
                className="object-cover"
                sizes="52px"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-base font-bold text-emerald-400/90 sm:text-lg">
                {displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <p className="w-full text-center text-[10px] leading-tight sm:text-[11px]">
            <span className="block truncate font-semibold text-emerald-50">{displayName}</span>
            <span className="block truncate font-normal text-amber-100/85">
              Lv. {Math.max(1, Math.trunc(level))}
            </span>
          </p>
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/50 sm:h-2.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
          <p className="mt-1 text-[9px] tabular-nums text-emerald-100/95 sm:text-[10px]">
            HP {hp} / {hpMax}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/50 sm:h-2.5">
            <div
              className="h-full bg-gradient-to-r from-sky-600 to-cyan-400 transition-all duration-300"
              style={{ width: `${manaPercent}%` }}
            />
          </div>
          <p className="mt-1 text-[9px] tabular-nums text-sky-100/95 sm:text-[10px]">
            Mana {mana} / {manaMax}
          </p>
        </div>
      </div>
    </div>
  );
}

function EnemyStatusModal({
  enemy,
  isSelected,
  onSelect,
  isDefeated,
  nameColorClass,
  stateIconSrcs = [],
}: {
  enemy: CombatEncounterEnemyView;
  isSelected: boolean;
  onSelect: () => void;
  isDefeated: boolean;
  nameColorClass: string;
  stateIconSrcs?: string[];
}) {
  const pct = enemyHpPercent(enemy);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isDefeated}
      className={`${menuFont.className} min-w-0 flex-1 basis-0 rounded-xl border bg-[#1a100c]/92 p-1.5 text-left shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-sm transition sm:w-52 sm:flex-none sm:basis-auto sm:p-2.5 ${
        isDefeated
          ? "cursor-not-allowed border-slate-700/70 opacity-55"
          : isSelected
          ? "border-amber-400/90 ring-1 ring-amber-300/70"
          : "border-amber-900/65 hover:border-amber-700/80"
      }`}
      role="group"
      aria-label={`Estado de ${enemy.name}`}
      aria-pressed={isSelected}
    >
      <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-2.5">
        <div className="relative hidden h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-amber-800/55 bg-black/45 sm:block sm:h-[3.25rem] sm:w-[3.25rem]">
          {enemy.portraitSrc ? (
            <EncounterRasterMedia
              src={enemy.portraitSrc}
              alt=""
              mode="cover"
              className="object-cover"
              sizes="52px"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-base font-bold text-amber-500/85 sm:text-lg">
              {enemy.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 w-full flex-1 sm:w-auto">
          <p className="truncate text-center text-[10px] leading-tight sm:text-left sm:text-xs">
            {enemy.enemyLevel != null ? (
              <span className="font-normal text-amber-100/85">
                Lv. {Math.max(1, Math.trunc(enemy.enemyLevel))}{" "}
              </span>
            ) : null}
            <span className={`font-semibold ${nameColorClass}`}>{enemy.name}</span>
          </p>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/50 sm:h-2.5">
            <div
              className="h-full bg-gradient-to-r from-red-700 to-red-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[9px] tabular-nums text-red-100/90 sm:text-[10px]">
            HP {enemy.hp} / {enemy.hpMax}
          </p>
          {stateIconSrcs.length > 0 ? (
            <div className="mt-1 flex justify-center sm:justify-start">
              <PlayerBuffStateIconStrip srcs={stateIconSrcs} />
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function enemySpriteHeightClass(count: number) {
  if (count >= 3) {
    return "h-[min(18vh,110px)] w-auto sm:h-[min(24vh,150px)]";
  }
  if (count === 2) {
    return "h-[min(24vh,150px)] w-auto sm:h-[min(34vh,220px)]";
  }
  return "h-[min(29vh,178px)] w-auto sm:h-[min(44vh,300px)]";
}

export function CombatEncounterShell({
  encounterName,
  encounterCode,
  combatStep,
  isBoss,
  recommendedLevel,
  backgroundSrc,
  enemies,
  combatDebug,
  combatStartMessage = null,
  playerDisplayName = "Fede",
  playerPortraitSrc = PJ_FEDE_FACE_COMBAT,
  playerSpriteSrc = PJ_FEDE_RPG_FIGHT_STICK,
  playerHp = 100,
  playerHpMax = 100,
  playerMana = 20,
  playerManaMax = 20,
  playerSpeed = 0,
  playerWeaponDamageMin = 1,
  playerWeaponDamageMax = 1,
  playerMagicDamageMin = 0,
  playerMagicDamageMax = 0,
  playerStatStr = 0,
  playerStatDex = 0,
  playerStatInt = 0,
  playerStatWis = 0,
  playerArmor = 0,
  playerMr = 0,
  playerResistances = [],
  playerWeaknesses = [],
  playerWeaponAttackFamily = null,
  combatResistWeakDebug = false,
  combatBuffStatDebug = false,
  playerExperienceToNext = 0,
  playerLevelCurrent = 1,
  playerLevelAfterVictory = 1,
  playerSkills = [],
  playerConsumables = [],
  victoryLootItems = [],
  defeatLostItems = [],
  victoryGoldFromLoot = 0,
  onConsumeConsumable,
  onEscapePersistState,
  onPlayerDefeatedGlobalLog,
  onPlayerLevelUpGlobalLog,
  onCombatFinishedStats,
  escapeHref = "/",
}: CombatEncounterShellProps) {
  const router = useRouter();
  const backgroundResolved = backgroundSrc?.trim() || BG_INTRO_FOREST;

  const playerResistancesRef = useRef<string[]>([...playerResistances]);
  const playerWeaknessesRef = useRef<string[]>([...playerWeaknesses]);
  useEffect(() => {
    playerResistancesRef.current = [...playerResistances];
    playerWeaknessesRef.current = [...playerWeaknesses];
  }, [playerResistances, playerWeaknesses]);

  useEffect(() => {
    if (!combatResistWeakDebug) return;
    console.log("[combate][resist-weak][cliente] PJ (props + ref)", {
      resistances: [...playerResistances],
      weaknesses: [...playerWeaknesses],
      weaponAttackFamily: playerWeaponAttackFamily,
      refResistances: [...playerResistancesRef.current],
      refWeaknesses: [...playerWeaknessesRef.current],
    });
    enemies.slice(0, MAX_ENEMIES_ON_FIELD).forEach((e, i) => {
      console.log(`[combate][resist-weak][cliente] enemigo[${i}]`, e.name, {
        templateId: e.templateId,
        resistances: e.resistances,
        weaknesses: e.weaknesses,
      });
    });
  }, [combatResistWeakDebug, playerResistances, playerWeaknesses, playerWeaponAttackFamily, enemies]);

  /** Copia en memoria del combate para uso al activar habilidades del PJ. */
  const playerCombatSkills = useMemo(() => [...playerSkills], [playerSkills]);
  const playerCombatSkillsRef = useRef(playerCombatSkills);
  useEffect(() => {
    playerCombatSkillsRef.current = playerCombatSkills;
  }, [playerCombatSkills]);
  const [combatConsumables, setCombatConsumables] = useState<CombatPlayerConsumableView[]>([
    ...playerConsumables,
  ]);
  useEffect(() => {
    setCombatConsumables([...playerConsumables]);
  }, [playerConsumables]);

  const initialEnemies = useMemo(
    () => enemies.slice(0, MAX_ENEMIES_ON_FIELD),
    [enemies],
  );
  const [displayEnemies, setDisplayEnemies] = useState<CombatEncounterEnemyView[]>(initialEnemies);
  /** Evita que un re-render del servidor (p. ej. tras guardar stats) reviva enemigos y cancele victoria. */
  const [combatOutcome, setCombatOutcome] = useState<"active" | "won" | "lost">("active");
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  /** Si el objetivo seleccionado muere (p. ej. área), limpiar para poder elegir otro sin estado colgado. */
  useEffect(() => {
    if (!selectedEnemyId) return;
    const sel = displayEnemies.find((e) => e.id === selectedEnemyId);
    if (!sel || sel.hp <= 0) setSelectedEnemyId(null);
  }, [displayEnemies, selectedEnemyId]);
  const enemyCount = displayEnemies.length;
  const spriteClass = enemySpriteHeightClass(enemyCount);
  const enemyNameColorClass = enemyNameLevelColorClass(recommendedLevel, playerLevelCurrent);

  const [isActionsPanelOpen, setIsActionsPanelOpen] = useState(false);
  const [isCombatLogPanelOpen, setIsCombatLogPanelOpen] = useState(false);
  const [isEscaping, setIsEscaping] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [actionMenu, setActionMenu] = useState<"main" | "skills" | "inventory">("main");
  const [isTurnTransitioning, setIsTurnTransitioning] = useState(true);
  const combatLogMobileRef = useRef<HTMLDivElement | null>(null);
  const combatLogDesktopRef = useRef<HTMLDivElement | null>(null);
  const combatLogIdRef = useRef(0);
  const advanceTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialActionDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defeatModalDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const victoryModalDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didReportDefeatRef = useRef(false);
  const [attackHint, setAttackHint] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });
  const [skillInfoTooltip, setSkillInfoTooltip] = useState<{
    open: boolean;
    x: number;
    y: number;
    pinned: boolean;
    skillId: string | null;
  }>({ open: false, x: 0, y: 0, pinned: false, skillId: null });
  const [consumableInfoTooltip, setConsumableInfoTooltip] = useState<{
    open: boolean;
    x: number;
    y: number;
    pinned: boolean;
    inventoryId: number | null;
  }>({ open: false, x: 0, y: 0, pinned: false, inventoryId: null });
  const [victoryLootTooltip, setVictoryLootTooltip] = useState<{
    open: boolean;
    lootKey: string | null;
  }>({ open: false, lootKey: null });
  const [isDefeatOverlayVisible, setIsDefeatOverlayVisible] = useState(false);
  const [isDefeatPenaltyOpen, setIsDefeatPenaltyOpen] = useState(false);
  const [isVictoryOverlayVisible, setIsVictoryOverlayVisible] = useState(false);
  const [isVictoryLootOpen, setIsVictoryLootOpen] = useState(false);
  const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(false);
  const didOpenLevelUpModalRef = useRef(false);
  const didReportLevelUpRef = useRef(false);
  const combatStatsRef = useRef({
    totalDamageDealt: 0,
    highestHitDealt: 0,
    totalDamageTaken: 0,
    totalHealing: 0,
    highestHitReceived: 0,
  });
  const didPersistCombatStatsRef = useRef(false);

  const [turn, setTurn] = useState(1);

  const initialLog = useMemo<CombatLogEntry[]>(() => {
    const startMessage =
      typeof combatStartMessage === "string" ? combatStartMessage.trim() : "";
    if (startMessage.length > 0) {
      return [{ id: "initial-start-message", text: startMessage }];
    }
    if (initialEnemies.length === 0) {
      return [{ id: "initial-empty", text: "No hay enemigos en el campo." }];
    }
    const names = initialEnemies.map((e) => e.name).join(", ");
    return [
      {
        id: "initial-encounter",
        text: `${names} ${initialEnemies.length > 1 ? "te cortan" : "te corta"} el paso.`,
        tone: "danger",
      },
    ];
  }, [combatStartMessage, initialEnemies]);

  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>(initialLog);
  useEffect(() => {
    setCombatLog(initialLog);
  }, [initialLog]);

  const [playerCurrentHp, setPlayerCurrentHp] = useState(playerHp);
  const [displayPlayerMana, setDisplayPlayerMana] = useState(playerMana);
  /** Bonificaciones durante el encuentro (`type:buff` + `target:self` + `scalings` o `scaling` legacy). */
  const [playerCombatArmorBonus, setPlayerCombatArmorBonus] = useState(0);
  const [playerCombatMrBonus, setPlayerCombatMrBonus] = useState(0);
  const [playerCombatSpeedBonus, setPlayerCombatSpeedBonus] = useState(0);
  const [playerCombatWeaponDamageMinBonus, setPlayerCombatWeaponDamageMinBonus] = useState(0);
  const [playerCombatWeaponDamageMaxBonus, setPlayerCombatWeaponDamageMaxBonus] = useState(0);
  const [playerCombatMagicDamageMinBonus, setPlayerCombatMagicDamageMinBonus] = useState(0);
  const [playerCombatMagicDamageMaxBonus, setPlayerCombatMagicDamageMaxBonus] = useState(0);
  const [playerTimedSelfBuffs, setPlayerTimedSelfBuffs] = useState<PlayerTimedSelfBuff[]>([]);
  const timedBuffBonusByStat = useMemo(() => {
    const totals: Record<PlayerTimedSelfBuffStat, number> = {
      armor: 0,
      mr: 0,
      speed: 0,
      weapon_damage_min: 0,
      weapon_damage_max: 0,
      magic_damage_min: 0,
      magic_damage_max: 0,
    };
    for (const buff of playerTimedSelfBuffs) {
      for (const part of buff.parts) {
        totals[part.stat] += Math.trunc(part.amount);
      }
    }
    return totals;
  }, [playerTimedSelfBuffs]);
  const effectivePlayerArmor = useMemo(
    () =>
      Math.max(
        0,
        Math.trunc(playerArmor + playerCombatArmorBonus + timedBuffBonusByStat.armor),
      ),
    [playerArmor, playerCombatArmorBonus, timedBuffBonusByStat],
  );
  const effectivePlayerMr = useMemo(
    () =>
      Math.max(0, Math.trunc(playerMr + playerCombatMrBonus + timedBuffBonusByStat.mr)),
    [playerMr, playerCombatMrBonus, timedBuffBonusByStat],
  );

  const [enemyPlayerTimedEffects, setEnemyPlayerTimedEffects] = useState<PlayerEnemyTimedEffect[]>([]);
  const displayEnemiesRef = useRef(displayEnemies);
  useEffect(() => {
    displayEnemiesRef.current = displayEnemies;
  }, [displayEnemies]);
  const enemyPlayerTimedEffectsRef = useRef(enemyPlayerTimedEffects);
  useEffect(() => {
    enemyPlayerTimedEffectsRef.current = enemyPlayerTimedEffects;
  }, [enemyPlayerTimedEffects]);

  const getCombatStatValueForSkills = useCallback(
    (key: string): number => {
      const k = key.toUpperCase();
      switch (k) {
        case "STR":
          return Math.max(0, Math.floor(playerStatStr));
        case "DEX":
          return Math.max(0, Math.floor(playerStatDex));
        case "INT":
          return Math.max(0, Math.floor(playerStatInt));
        case "WIS":
          return Math.max(0, Math.floor(playerStatWis));
        case "LEVEL":
          return Math.max(1, Math.trunc(playerLevelCurrent));
        case "ATTACK_DAMAGE":
        case "WEAPON_DAMAGE": {
          const wmin = Math.max(
            1,
            Math.floor(
              playerWeaponDamageMin +
                playerCombatWeaponDamageMinBonus +
                timedBuffBonusByStat.weapon_damage_min,
            ),
          );
          const wmax = Math.max(
            wmin,
            Math.floor(
              playerWeaponDamageMax +
                playerCombatWeaponDamageMaxBonus +
                timedBuffBonusByStat.weapon_damage_max,
            ),
          );
          return Math.floor((wmin + wmax) / 2);
        }
        case "MAGIC_DAMAGE": {
          const mmin = Math.max(
            0,
            Math.floor(
              playerMagicDamageMin +
                playerCombatMagicDamageMinBonus +
                timedBuffBonusByStat.magic_damage_min,
            ),
          );
          const mmax = Math.max(
            mmin,
            Math.floor(
              playerMagicDamageMax +
                playerCombatMagicDamageMaxBonus +
                timedBuffBonusByStat.magic_damage_max,
            ),
          );
          return Math.floor((mmin + mmax) / 2);
        }
        default:
          return 0;
      }
    },
    [
      playerStatStr,
      playerStatDex,
      playerStatInt,
      playerStatWis,
      playerWeaponDamageMin,
      playerWeaponDamageMax,
      playerCombatWeaponDamageMinBonus,
      playerCombatWeaponDamageMaxBonus,
      timedBuffBonusByStat.weapon_damage_min,
      timedBuffBonusByStat.weapon_damage_max,
      playerMagicDamageMin,
      playerMagicDamageMax,
      playerCombatMagicDamageMinBonus,
      playerCombatMagicDamageMaxBonus,
      timedBuffBonusByStat.magic_damage_min,
      timedBuffBonusByStat.magic_damage_max,
      playerLevelCurrent,
    ],
  );

  const skillDamageTickContextRef = useRef<{
    getCombatStatValue: (key: string) => number;
    magicalCombatDamageFlat: number;
    skillDamageBases: PlayerSkillDamageBaseBounds;
    playerWeaponAttackFamily: string | null;
  }>({
    getCombatStatValue: () => 0,
    magicalCombatDamageFlat: 0,
    skillDamageBases: { weaponMin: 1, weaponMax: 1, magicMin: 0, magicMax: 0 },
    playerWeaponAttackFamily: null,
  });
  {
    const wmin = Math.max(
      1,
      Math.floor(
        playerWeaponDamageMin +
          playerCombatWeaponDamageMinBonus +
          timedBuffBonusByStat.weapon_damage_min,
      ),
    );
    const wmax = Math.max(
      wmin,
      Math.floor(
        playerWeaponDamageMax +
          playerCombatWeaponDamageMaxBonus +
          timedBuffBonusByStat.weapon_damage_max,
      ),
    );
    skillDamageTickContextRef.current = {
      getCombatStatValue: getCombatStatValueForSkills,
      magicalCombatDamageFlat: Math.max(
        0,
        Math.trunc(
          playerCombatMagicDamageMinBonus +
            playerCombatMagicDamageMaxBonus +
            timedBuffBonusByStat.magic_damage_min +
            timedBuffBonusByStat.magic_damage_max,
        ),
      ),
      skillDamageBases: {
        weaponMin: wmin,
        weaponMax: wmax,
        magicMin: playerMagicDamageMin,
        magicMax: playerMagicDamageMax,
      },
      playerWeaponAttackFamily: playerWeaponAttackFamily ?? null,
    };
  }

  const [enemySkillNextAvailableTurn, setEnemySkillNextAvailableTurn] = useState<
    Record<string, Record<string, number>>
  >({});
  /** `user_character_skills.id` → primer turno en el que la habilidad vuelve a estar disponible. */
  const [playerSkillNextAvailableTurn, setPlayerSkillNextAvailableTurn] = useState<
    Record<string, number>
  >({});
  useEffect(() => {
    setPlayerCurrentHp(Math.min(Math.max(0, playerHp), Math.max(1, playerHpMax)));
  }, [playerHp, playerHpMax]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639.98px)");
    const update = () => setIsMobileViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setCombatOutcome("active");
    setDisplayEnemies(initialEnemies);
    setSelectedEnemyId(null);
    setIsDefeatOverlayVisible(false);
    setIsDefeatPenaltyOpen(false);
    setIsVictoryOverlayVisible(false);
    setIsVictoryLootOpen(false);
    setVictoryLootTooltip({ open: false, lootKey: null });
    setIsLevelUpModalOpen(false);
    didOpenLevelUpModalRef.current = false;
    didReportLevelUpRef.current = false;
    didReportDefeatRef.current = false;
    didPersistCombatStatsRef.current = false;
    combatStatsRef.current = {
      totalDamageDealt: 0,
      highestHitDealt: 0,
      totalDamageTaken: 0,
      totalHealing: 0,
      highestHitReceived: 0,
    };
    setPlayerCombatArmorBonus(0);
    setPlayerCombatMrBonus(0);
    setPlayerCombatSpeedBonus(0);
    setPlayerCombatWeaponDamageMinBonus(0);
    setPlayerCombatWeaponDamageMaxBonus(0);
    setPlayerCombatMagicDamageMinBonus(0);
    setPlayerCombatMagicDamageMaxBonus(0);
    setPlayerTimedSelfBuffs([]);
    setEnemyPlayerTimedEffects([]);
    setTurn(1);
    if (defeatModalDelayRef.current) {
      clearTimeout(defeatModalDelayRef.current);
      defeatModalDelayRef.current = null;
    }
    if (victoryModalDelayRef.current) {
      clearTimeout(victoryModalDelayRef.current);
      victoryModalDelayRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar encuentro, no si el padre re-pasa `enemies`
  }, [encounterCode]);

  useEffect(() => {
    if (playerCurrentHp > 0) {
      setIsDefeatOverlayVisible(false);
      setIsDefeatPenaltyOpen(false);
      if (defeatModalDelayRef.current) {
        clearTimeout(defeatModalDelayRef.current);
        defeatModalDelayRef.current = null;
      }
      return;
    }

    defeatModalDelayRef.current = setTimeout(() => {
      setIsDefeatOverlayVisible(true);
      defeatModalDelayRef.current = null;
    }, DEFEAT_MODAL_DELAY_MS);

    return () => {
      if (defeatModalDelayRef.current) {
        clearTimeout(defeatModalDelayRef.current);
        defeatModalDelayRef.current = null;
      }
    };
  }, [playerCurrentHp]);
  useEffect(() => {
    if (playerCurrentHp > 0) return;
    if (didReportDefeatRef.current) return;
    didReportDefeatRef.current = true;
    if (!onPlayerDefeatedGlobalLog) return;
    void onPlayerDefeatedGlobalLog().catch(() => {
      // Si falla el log global no debe bloquear el flujo de combate.
    });
  }, [playerCurrentHp, onPlayerDefeatedGlobalLog]);
  const hasAnyEnemy = displayEnemies.length > 0;
  const hasAliveEnemies = displayEnemies.some((enemy) => enemy.hp > 0);
  const totalEnemyHpMax = displayEnemies.reduce(
    (sum, enemy) => sum + Math.max(1, Math.trunc(enemy.hpMax)),
    0,
  );
  const totalEnemyHp = displayEnemies.reduce(
    (sum, enemy) => sum + Math.max(0, Math.trunc(enemy.hp)),
    0,
  );
  const isEscapeDisabledByEnemyHp =
    totalEnemyHpMax > 0 && totalEnemyHp / totalEnemyHpMax <= 0.6;
  const recordPlayerDamageDealt = (amount: number) => {
    const safe = Math.max(0, Math.trunc(amount));
    if (safe <= 0) return;
    combatStatsRef.current.totalDamageDealt += safe;
    combatStatsRef.current.highestHitDealt = Math.max(combatStatsRef.current.highestHitDealt, safe);
  };
  const recordPlayerDamageTaken = (amount: number) => {
    const safe = Math.max(0, Math.trunc(amount));
    if (safe <= 0) return;
    combatStatsRef.current.totalDamageTaken += safe;
    combatStatsRef.current.highestHitReceived = Math.max(combatStatsRef.current.highestHitReceived, safe);
  };
  const recordPlayerHealing = (amount: number) => {
    const safe = Math.max(0, Math.trunc(amount));
    if (safe <= 0) return;
    combatStatsRef.current.totalHealing += safe;
  };
  const victoryTotalXp = useMemo(
    () => initialEnemies.reduce((sum, enemy) => sum + Math.max(0, Math.trunc(enemy.xpReward)), 0),
    [initialEnemies],
  );
  const playerExperienceToNextSafe = Math.max(0, Math.trunc(playerExperienceToNext));
  const shouldTriggerLevelUpModal =
    playerExperienceToNextSafe > 0 && victoryTotalXp >= playerExperienceToNextSafe;
  const levelAfterVictorySafe = Math.max(
    Math.max(1, Math.trunc(playerLevelCurrent)),
    Math.max(1, Math.trunc(playerLevelAfterVictory)),
  );
  const victoryTotalGold = Math.max(0, Math.trunc(victoryGoldFromLoot));
  useEffect(() => {
    if (combatOutcome !== "active") return;
    if (hasAnyEnemy && !hasAliveEnemies && playerCurrentHp > 0) {
      setCombatOutcome("won");
    }
  }, [combatOutcome, hasAnyEnemy, hasAliveEnemies, playerCurrentHp]);
  useEffect(() => {
    if (combatOutcome !== "active") return;
    if (playerCurrentHp <= 0 && hasAnyEnemy) {
      setCombatOutcome("lost");
    }
  }, [combatOutcome, hasAnyEnemy, playerCurrentHp]);
  useEffect(() => {
    if (combatOutcome === "won") {
      if (isVictoryOverlayVisible) return;
      if (victoryModalDelayRef.current) return;
      victoryModalDelayRef.current = setTimeout(() => {
        setIsVictoryOverlayVisible(true);
        victoryModalDelayRef.current = null;
      }, VICTORY_MODAL_DELAY_MS);
      return () => {
        if (victoryModalDelayRef.current) {
          clearTimeout(victoryModalDelayRef.current);
          victoryModalDelayRef.current = null;
        }
      };
    }
    if (!hasAnyEnemy || hasAliveEnemies || playerCurrentHp <= 0) {
      setIsVictoryOverlayVisible(false);
      setIsVictoryLootOpen(false);
      if (victoryModalDelayRef.current) {
        clearTimeout(victoryModalDelayRef.current);
        victoryModalDelayRef.current = null;
      }
    }
  }, [combatOutcome, hasAnyEnemy, hasAliveEnemies, playerCurrentHp, isVictoryOverlayVisible]);
  useEffect(() => {
    if (!isVictoryOverlayVisible || !isVictoryLootOpen || !shouldTriggerLevelUpModal) return;
    if (didOpenLevelUpModalRef.current) return;
    didOpenLevelUpModalRef.current = true;
    setIsLevelUpModalOpen(true);
  }, [isVictoryOverlayVisible, isVictoryLootOpen, shouldTriggerLevelUpModal]);
  useEffect(() => {
    if (!isLevelUpModalOpen) return;
    if (didReportLevelUpRef.current) return;
    didReportLevelUpRef.current = true;
    if (!onPlayerLevelUpGlobalLog) return;
    void onPlayerLevelUpGlobalLog(levelAfterVictorySafe).catch(() => {
      // Si falla el log global de level up no debe bloquear el flujo del combate.
    });
  }, [isLevelUpModalOpen, levelAfterVictorySafe, onPlayerLevelUpGlobalLog]);
  useEffect(() => {
    if (didPersistCombatStatsRef.current) return;
    const didLose = playerCurrentHp <= 0;
    const didWin = hasAnyEnemy && !hasAliveEnemies && playerCurrentHp > 0;
    if (!didLose && !didWin) return;
    const enemiesDefeatedCount = displayEnemies.reduce(
      (sum, enemy) => sum + (enemy.hp <= 0 ? 1 : 0),
      0,
    );
    didPersistCombatStatsRef.current = true;
    if (!onCombatFinishedStats) return;
    void onCombatFinishedStats({
      didWin,
      enemiesDefeated: enemiesDefeatedCount,
      bossesDefeated: isBoss ? 1 : 0,
      totalDamageDealt: combatStatsRef.current.totalDamageDealt,
      highestHitDealt: combatStatsRef.current.highestHitDealt,
      totalDamageTaken: combatStatsRef.current.totalDamageTaken,
      totalHealing: combatStatsRef.current.totalHealing,
      highestHitReceived: combatStatsRef.current.highestHitReceived,
      finalHp: Math.max(0, Math.trunc(playerCurrentHp)),
      finalMana: Math.max(0, Math.trunc(displayPlayerMana)),
    }).catch(() => {
      // Si falla el guardado de stats no se bloquea la resolución visual del combate.
    });
  }, [displayEnemies, hasAliveEnemies, hasAnyEnemy, isBoss, onCombatFinishedStats, playerCurrentHp]);
  useEffect(() => {
    setDisplayPlayerMana(Math.min(Math.max(0, playerMana), Math.max(0, playerManaMax)));
  }, [playerMana, playerManaMax]);
  useEffect(() => {
    setEnemySkillNextAvailableTurn({});
  }, [encounterCode]);
  useEffect(() => {
    setPlayerSkillNextAvailableTurn({});
  }, [encounterCode]);
  const turnOrder = useMemo<TurnActor[]>(() => {
    const actors: TurnActor[] = [
      {
        id: "player",
        type: "player",
        speed: Math.max(
          0,
          Math.trunc(playerSpeed + playerCombatSpeedBonus + timedBuffBonusByStat.speed),
        ),
      },
      ...displayEnemies
        .filter((enemy) => enemy.hp > 0)
        .map((enemy) => ({
          id: `enemy:${enemy.id}`,
          type: "enemy" as const,
          speed: Math.max(0, Math.trunc(enemy.speed)),
          enemyId: enemy.id,
        })),
    ];
    return actors.sort((a, b) => b.speed - a.speed);
  }, [displayEnemies, playerCombatSpeedBonus, playerSpeed, timedBuffBonusByStat]);
  const turnOrderRef = useRef(turnOrder);
  useEffect(() => {
    turnOrderRef.current = turnOrder;
  }, [turnOrder]);
  /** Firma estable del orden de iniciativa (quién actúa). Cambia al morir un enemigo o variar velocidades. */
  const initiativeOrderSig = useMemo(
    () => turnOrder.map((a) => a.id).join(">"),
    [turnOrder],
  );
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const previousTurnIndexRef = useRef(0);
  const prevInitiativeSigRef = useRef<string | null>(null);
  const prevTurnOrderSnapshotRef = useRef<TurnActor[]>([]);
  const resolvedEnemyTurnRef = useRef<string | null>(null);
  const prevEncounterCodeForInitiativeRef = useRef(encounterCode);
  /**
   * Al morir un enemigo solo hacer `min(índice, length-1)` rompe la iniciativa:
   * el mismo número de índice puede pasar a otro actor (p. ej. de PJ a enemigo).
   * Re-mapeamos por `TurnActor.id` y limpiamos la deduplicación del turno enemigo.
   */
  useLayoutEffect(() => {
    if (prevEncounterCodeForInitiativeRef.current !== encounterCode) {
      prevEncounterCodeForInitiativeRef.current = encounterCode;
      prevInitiativeSigRef.current = null;
      prevTurnOrderSnapshotRef.current = [];
      resolvedEnemyTurnRef.current = null;
    }

    if (turnOrder.length === 0) {
      setCurrentTurnIndex(0);
      previousTurnIndexRef.current = 0;
      prevInitiativeSigRef.current = initiativeOrderSig;
      prevTurnOrderSnapshotRef.current = [];
      resolvedEnemyTurnRef.current = null;
      return;
    }

    const prevSig = prevInitiativeSigRef.current;
    const prevOrder = prevTurnOrderSnapshotRef.current;

    if (prevSig !== null && prevSig !== initiativeOrderSig) {
      resolvedEnemyTurnRef.current = null;
      setCurrentTurnIndex((prevIndex) => {
        const prevEffective = Math.min(prevIndex, Math.max(0, prevOrder.length - 1));
        const actorAtTurn = prevOrder[prevEffective];
        if (!actorAtTurn) {
          return Math.min(prevIndex, turnOrder.length - 1);
        }
        const newIdx = turnOrder.findIndex((a) => a.id === actorAtTurn.id);
        if (newIdx >= 0) return newIdx;
        return Math.min(prevIndex, turnOrder.length - 1);
      });
    } else {
      setCurrentTurnIndex((prev) => Math.min(prev, turnOrder.length - 1));
    }

    prevInitiativeSigRef.current = initiativeOrderSig;
    prevTurnOrderSnapshotRef.current = turnOrder;
  }, [encounterCode, turnOrder, initiativeOrderSig]);
  const effectiveTurnIndex =
    turnOrder.length === 0 ? 0 : Math.min(currentTurnIndex, turnOrder.length - 1);
  const currentActor = turnOrder[effectiveTurnIndex] ?? null;
  const runtimeInitiativeDebug = useMemo(
    () => ({
      playerSpeed: Math.max(
        0,
        Math.trunc(playerSpeed + playerCombatSpeedBonus + timedBuffBonusByStat.speed),
      ),
      enemies: displayEnemies.map((enemy) => ({
        id: enemy.id,
        name: enemy.name,
        speed: Math.max(0, Math.trunc(enemy.speed)),
        hp: enemy.hp,
        alive: enemy.hp > 0,
      })),
      turnOrder: turnOrder.map((actor, idx) => ({
        idx,
        actorId: actor.id,
        actorType: actor.type,
        speed: actor.speed,
        isCurrent: idx === effectiveTurnIndex,
      })),
      currentTurnIndex: effectiveTurnIndex,
      currentActorId: currentActor?.id ?? null,
      currentActorType: currentActor?.type ?? null,
      turn,
    }),
    [
      playerCombatSpeedBonus,
      playerSpeed,
      timedBuffBonusByStat,
      displayEnemies,
      turnOrder,
      effectiveTurnIndex,
      currentActor,
      turn,
    ],
  );
  useEffect(() => {
    if (turnOrder.length === 0) return;
    const previous = previousTurnIndexRef.current;
    const wrapped =
      turnOrder.length > 1 &&
      previous === turnOrder.length - 1 &&
      currentTurnIndex === 0;
    if (wrapped) {
      setTurn((current) => current + 1);
    }
    previousTurnIndexRef.current = currentTurnIndex;
  }, [currentTurnIndex, turnOrder.length]);
  const turnOwner = currentActor?.type ?? "enemy";
  /** Por enemigo: sube en cada ataque para reiniciar la animación de embestida hacia el PJ. */
  const [enemyAttackLungeSeq, setEnemyAttackLungeSeq] = useState<Record<string, number>>({});
  useEffect(
    () => () => {
      if (advanceTurnTimeoutRef.current) {
        clearTimeout(advanceTurnTimeoutRef.current);
        advanceTurnTimeoutRef.current = null;
      }
      if (initialActionDelayTimeoutRef.current) {
        clearTimeout(initialActionDelayTimeoutRef.current);
        initialActionDelayTimeoutRef.current = null;
      }
      if (defeatModalDelayRef.current) {
        clearTimeout(defeatModalDelayRef.current);
        defeatModalDelayRef.current = null;
      }
      if (victoryModalDelayRef.current) {
        clearTimeout(victoryModalDelayRef.current);
        victoryModalDelayRef.current = null;
      }
    },
    [],
  );
  /**
   * Espera inicial solo al cargar un encuentro (por código), no cuando cambia la referencia de `enemies`:
   * si dependiera de `initialEnemies`, cualquier re-render del padre con un array nuevo cancelaba el
   * timeout de `scheduleAdvanceTurn` y volvía a bloquear la UI 3s — turno atascado / sin poder atacar.
   */
  useEffect(() => {
    if (advanceTurnTimeoutRef.current) {
      clearTimeout(advanceTurnTimeoutRef.current);
      advanceTurnTimeoutRef.current = null;
    }
    if (initialActionDelayTimeoutRef.current) {
      clearTimeout(initialActionDelayTimeoutRef.current);
      initialActionDelayTimeoutRef.current = null;
    }
    /** Si se canceló un avance de turno pendiente, no dejar la UI bloqueada ni el turno enemigo sin reintentar. */
    resolvedEnemyTurnRef.current = null;

    setIsTurnTransitioning(true);
    initialActionDelayTimeoutRef.current = setTimeout(() => {
      setIsTurnTransitioning(false);
      initialActionDelayTimeoutRef.current = null;
    }, FIRST_ACTION_DELAY_MS);
  }, [encounterCode, combatStartMessage]);

  function appendCombatLog(
    text: string,
    tone: CombatLogTone = "default",
    damageValue?: number,
    incomingDamageValue?: number,
  ) {
    combatLogIdRef.current += 1;
    const entryId = `log-${combatLogIdRef.current}`;
    setCombatLog((prev) => [
      ...prev,
      {
        id: entryId,
        text,
        tone,
        damageValue,
        incomingDamageValue,
      },
    ]);
  }

  useEffect(() => {
    if (combatLogMobileRef.current) {
      combatLogMobileRef.current.scrollTop = combatLogMobileRef.current.scrollHeight;
    }
    if (combatLogDesktopRef.current) {
      combatLogDesktopRef.current.scrollTop = combatLogDesktopRef.current.scrollHeight;
    }
  }, [combatLog]);

  useEffect(() => {
    if (!isCombatLogPanelOpen || !combatLogMobileRef.current) return;
    window.requestAnimationFrame(() => {
      if (!combatLogMobileRef.current) return;
      combatLogMobileRef.current.scrollTop = combatLogMobileRef.current.scrollHeight;
    });
  }, [isCombatLogPanelOpen]);

  const playerHpPercent = Math.round((playerCurrentHp / Math.max(1, playerHpMax)) * 100);
  const playerManaPercent = Math.round(
    (displayPlayerMana / Math.max(1, playerManaMax)) * 100,
  );
  const playerActiveBuffStateIconSrcs = useMemo(() => {
    const out: string[] = [];
    for (const buff of playerTimedSelfBuffs) {
      for (const raw of buff.stateIcons) {
        if (typeof raw !== "string" || raw.trim().length === 0) continue;
        const url = normalizePublicAssetUrl(raw);
        if (url) out.push(url);
      }
    }
    return out;
  }, [playerTimedSelfBuffs]);

  const enemyHudStateIconSrcsById = useMemo(() => {
    const byEnemy = new Map<string, Set<string>>();
    for (const eff of enemyPlayerTimedEffects) {
      if (eff.debuffRemainingTurns <= 0 && eff.dotTicksRemaining <= 0) continue;
      let bucket = byEnemy.get(eff.enemyId);
      if (!bucket) {
        bucket = new Set();
        byEnemy.set(eff.enemyId, bucket);
      }
      for (const raw of eff.stateIcons) {
        if (typeof raw !== "string" || raw.trim().length === 0) continue;
        const url = normalizePublicAssetUrl(raw);
        if (url) bucket.add(url);
      }
    }
    const out = new Map<string, string[]>();
    for (const [enemyId, set] of byEnemy) {
      out.set(enemyId, Array.from(set));
    }
    return out;
  }, [enemyPlayerTimedEffects]);

  /** Panel de acciones mobile (ancha) queda bajo la tarjeta HP/Mana para que siga visible. */
  const floatPlayerStatusOverActionsMobile = isActionsPanelOpen && isMobileViewport;

  const portraitResolved =
    typeof playerPortraitSrc === "string" && playerPortraitSrc.trim().length > 0
      ? playerPortraitSrc.trim()
      : null;
  const selectedEnemy =
    (selectedEnemyId ? displayEnemies.find((enemy) => enemy.id === selectedEnemyId) : null) ??
    null;
  const isPlayerTurn = currentActor?.type === "player";
  const attackBlockReason =
    playerCurrentHp <= 0
      ? null
      : isTurnTransitioning
        ? "Esperá a que termine la acción en curso."
        : !isPlayerTurn
          ? "Todavía no es tu turno."
          : selectedEnemy == null || selectedEnemy.hp <= 0
            ? "Tenés que seleccionar un enemigo vivo para atacar."
            : null;
  const canAttack =
    combatOutcome === "active" && attackBlockReason === null && playerCurrentHp > 0;

  function playerSkillCooldownTurnsRemaining(skill: CombatPlayerSkillView): number {
    const nextAvailable = playerSkillNextAvailableTurn[skill.userCharacterSkillId] ?? 1;
    if (turn >= nextAvailable) return 0;
    return nextAvailable - turn;
  }

  function canUsePlayerSkill(skill: CombatPlayerSkillView) {
    const needsSingleEnemy = playerSkillRequiresSingleEnemySelection(skill);
    const hasValidFocus =
      selectedEnemy != null && selectedEnemy.hp > 0;
    return (
      isPlayerTurn &&
      !isTurnTransitioning &&
      playerCurrentHp > 0 &&
      displayPlayerMana >= skill.skill.manaCost &&
      playerSkillCooldownTurnsRemaining(skill) === 0 &&
      (!needsSingleEnemy || hasValidFocus)
    );
  }

  function consumableObjective(effect: Record<string, unknown> | null): "self" | "enemy" {
    const raw =
      typeof effect?.objetive === "string"
        ? effect.objetive.trim().toLowerCase()
        : typeof effect?.objective === "string"
          ? effect.objective.trim().toLowerCase()
          : "";
    return raw === "enemy" ? "enemy" : "self";
  }

  function consumableTarget(effect: Record<string, unknown> | null): "single" | "area" {
    const raw = typeof effect?.target === "string" ? effect.target.trim().toLowerCase() : "";
    return raw === "area" ? "area" : "single";
  }

  function consumableStat(effect: Record<string, unknown> | null): string {
    return typeof effect?.stat === "string" ? effect.stat.trim().toLowerCase() : "";
  }

  function consumableAmount(effect: Record<string, unknown> | null): number {
    const min = coerceEffectNumber(effect?.["amount-min"], 0);
    const max = coerceEffectNumber(effect?.["amount-max"], min);
    return Math.max(0, randomIntInclusive(min, max));
  }

  function consumableLogText(
    item: CombatPlayerConsumableView,
    amountApplied: number,
    enemyName?: string | null,
  ): string {
    const fromEffect = item.effect?.text;
    if (typeof fromEffect === "string" && fromEffect.trim().length > 0) {
      let text = fromEffect.trim().replaceAll("{daño}", String(Math.max(0, Math.trunc(amountApplied))));
      if (enemyName && enemyName.trim().length > 0) {
        text = text.replaceAll("{enemigo}", enemyName.trim());
      }
      return text;
    }
    return `Usaste ${item.name}.`;
  }

  function canUseConsumable(item: CombatPlayerConsumableView): boolean {
    if (isPlayerActionsLocked) return false;
    if (item.quantity <= 0) return false;
    if (!item.effect) return false;
    const objective = consumableObjective(item.effect);
    if (objective !== "enemy") return true;
    const target = consumableTarget(item.effect);
    if (target === "area") return displayEnemies.some((enemy) => enemy.hp > 0);
    return selectedEnemy != null && selectedEnemy.hp > 0;
  }

  function applyEffectToEnemy(
    enemy: CombatEncounterEnemyView,
    stat: string,
    amount: number,
  ): CombatEncounterEnemyView {
    if (stat === "hp") return { ...enemy, hp: Math.max(0, enemy.hp - amount) };
    if (stat === "mana" || stat === "mp") return { ...enemy, mana: Math.max(0, enemy.mana - amount) };
    if (stat === "armor") return { ...enemy, armor: Math.max(0, enemy.armor - amount) };
    if (stat === "mr") return { ...enemy, mr: Math.max(0, enemy.mr - amount) };
    if (stat === "speed") return { ...enemy, speed: Math.max(0, enemy.speed - amount) };
    return enemy;
  }

  async function handleConsumableUse(item: CombatPlayerConsumableView) {
    if (!canUseConsumable(item)) return;

    // Gasto optimista para evitar doble click mientras responde el server action.
    setCombatConsumables((prev) =>
      prev
        .map((entry) =>
          entry.inventoryId === item.inventoryId
            ? { ...entry, quantity: Math.max(0, entry.quantity - 1) }
            : entry,
        )
        .filter((entry) => entry.quantity > 0),
    );

    if (onConsumeConsumable) {
      const result = await onConsumeConsumable(item.inventoryId);
      if (!result.ok) {
        setCombatConsumables((prev) => {
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
        appendCombatLog(result.error?.trim() || "No se pudo consumir el objeto.", "danger");
        return;
      }
      if (typeof result.remainingQuantity === "number") {
        const qty = Math.max(0, Math.trunc(result.remainingQuantity));
        setCombatConsumables((prev) => {
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

    const objective = consumableObjective(item.effect);
    const target = consumableTarget(item.effect);
    const stat = consumableStat(item.effect);
    const amount = consumableAmount(item.effect);
    if (objective === "self") {
      if (stat === "hp") {
        setPlayerCurrentHp((prev) => {
          const next = Math.min(playerHpMax, Math.max(0, prev + amount));
          recordPlayerHealing(next - prev);
          return next;
        });
      } else if (stat === "mana" || stat === "mp") {
        setDisplayPlayerMana((prev) => Math.min(playerManaMax, Math.max(0, prev + amount)));
      }
      appendCombatLog(consumableLogText(item, amount), "default", amount);
      setActionMenu("main");
      scheduleAdvanceTurn();
      return;
    }

    if (target === "single") {
      const enemy = selectedEnemy;
      if (!enemy || enemy.hp <= 0) {
        appendCombatLog("Seleccioná un enemigo para usar este consumible.", "default");
        return;
      }
      let targetDied = false;
      setDisplayEnemies((prev) =>
        prev.map((entry) => {
          if (entry.id !== enemy.id) return entry;
          const next = applyEffectToEnemy(entry, stat, amount);
          targetDied = entry.hp > 0 && next.hp <= 0;
          return next;
        }),
      );
      appendCombatLog(consumableLogText(item, amount, enemy.name), "default", amount);
      if (targetDied) {
        appendCombatLog(`Has matado a ${enemy.name}.`, "success");
        setSelectedEnemyId(null);
      }
      setActionMenu("main");
      scheduleAdvanceTurn();
      return;
    }

    setDisplayEnemies((prev) =>
      prev.map((entry) => (entry.hp > 0 ? applyEffectToEnemy(entry, stat, amount) : entry)),
    );
    appendCombatLog(consumableLogText(item, amount), "default", amount);

    setActionMenu("main");
    scheduleAdvanceTurn();
  }

  const isPlayerActionsLocked =
    combatOutcome !== "active" || !isPlayerTurn || isTurnTransitioning || playerCurrentHp <= 0;

  function openSkillInfoTooltip(skillId: string, x: number, y: number, pinned: boolean) {
    setSkillInfoTooltip({
      open: true,
      x: Math.min(x + 12, window.innerWidth - 360),
      y: Math.min(y + 12, window.innerHeight - 170),
      pinned,
      skillId,
    });
  }

  function hideSkillInfoTooltip() {
    setSkillInfoTooltip((prev) =>
      prev.pinned ? prev : { open: false, x: 0, y: 0, pinned: false, skillId: null },
    );
  }

  function toggleSkillInfoTooltipPinned(skillId: string, x: number, y: number) {
    setSkillInfoTooltip((prev) =>
      prev.open && prev.pinned
        ? { open: false, x: 0, y: 0, pinned: false, skillId: null }
        : {
            open: true,
            x: Math.min(x + 12, window.innerWidth - 360),
            y: Math.min(y + 12, window.innerHeight - 170),
            pinned: true,
            skillId,
          },
    );
  }

  function openConsumableInfoTooltip(inventoryId: number, x: number, y: number, pinned: boolean) {
    setConsumableInfoTooltip({
      open: true,
      x: Math.min(x + 12, window.innerWidth - 360),
      y: Math.min(y + 12, window.innerHeight - 170),
      pinned,
      inventoryId,
    });
  }

  function hideConsumableInfoTooltip() {
    setConsumableInfoTooltip((prev) =>
      prev.pinned ? prev : { open: false, x: 0, y: 0, pinned: false, inventoryId: null },
    );
  }

  function toggleConsumableInfoTooltipPinned(inventoryId: number, x: number, y: number) {
    setConsumableInfoTooltip((prev) =>
      prev.open && prev.pinned && prev.inventoryId === inventoryId
        ? { open: false, x: 0, y: 0, pinned: false, inventoryId: null }
        : {
            open: true,
            x: Math.min(x + 12, window.innerWidth - 360),
            y: Math.min(y + 12, window.innerHeight - 170),
            pinned: true,
            inventoryId,
          },
    );
  }

  /** Elige una habilidad (efectos de combate: próximo paso). */
  function handlePlayerSkillChosen(skillEntry: CombatPlayerSkillView) {
    if (!canUsePlayerSkill(skillEntry)) return;

    const effect = skillEntry.skill.effect;
    const effectTypeRaw = typeof effect.type === "string" ? effect.type.trim().toLowerCase() : "";
    const damageKind = getPlayerSkillDamageEffectKind(effect);
    const damageTypes = getEffectDamageTypes(effect);
    const resistWeakTags = getEffectAttackTypesForResistWeak(effect, playerWeaponAttackFamily);

    const descTemplateRaw = effect.description;
    const descTemplate =
      typeof descTemplateRaw === "string" && descTemplateRaw.trim().length > 0
        ? descTemplateRaw.trim()
        : null;

    setDisplayPlayerMana((m) => Math.max(0, m - Math.max(0, skillEntry.skill.manaCost)));
    const nextTurnForSkill = turn + Math.max(1, skillEntry.skill.cooldownTurns);
    setPlayerSkillNextAvailableTurn((prev) => ({
      ...prev,
      [skillEntry.userCharacterSkillId]: nextTurnForSkill,
    }));

    const appendSpellLog = (damageDealtForHighlight: number, enemyHitName?: string | null) => {
      const text =
        descTemplate != null
          ? formatPlayerSkillCombatLogDescription(
              descTemplate,
              damageDealtForHighlight,
              enemyHitName,
              damageTypes,
            )
          : damageDealtForHighlight > 0
            ? `Usás ${skillEntry.skill.name} e infligís ${damageDealtForHighlight} de daño.`
            : `Usás ${skillEntry.skill.name}.`;
      appendCombatLog(
        text,
        "default",
        damageDealtForHighlight > 0 ? damageDealtForHighlight : undefined,
      );
    };

    if (effectTypeRaw === "buff" && isPlayerSelfBuffEffect(effect)) {
      const durationTurns = parseEffectDurationTurns(effect);
      const parts = resolvePlayerSelfBuffParts(effect, getCombatStatValueForSkills);
      const stateIconsList = getEffectStateIcons(effect);
      const { timedParts, instantParts } = splitSelfBuffPartsForTimedAndInstant(parts, durationTurns);

      if (combatBuffStatDebug) {
        const timedTotalsAntes: Record<PlayerTimedSelfBuffStat, number> = { ...timedBuffBonusByStat };
        const timedTotalsDespues = addTimedBuffPartsToStatTotals(timedTotalsAntes, timedParts);
        const instantDeltas = sumInstantSelfBuffCombatDeltas(instantParts);
        const antes = computeCombatBuffStatNumbers({
          playerArmor,
          playerCombatArmorBonus,
          timed: timedTotalsAntes,
          playerMr,
          playerCombatMrBonus,
          playerSpeed,
          playerCombatSpeedBonus,
          playerWeaponDamageMin,
          playerWeaponDamageMax,
          playerCombatWeaponDamageMinBonus,
          playerCombatWeaponDamageMaxBonus,
          playerMagicDamageMin,
          playerMagicDamageMax,
          playerCombatMagicDamageMinBonus,
          playerCombatMagicDamageMaxBonus,
          playerCurrentHp,
          displayPlayerMana,
          playerHpMax,
          playerManaMax,
        });
        const despues = computeCombatBuffStatNumbers({
          playerArmor,
          playerCombatArmorBonus: playerCombatArmorBonus + instantDeltas.armor,
          timed: timedTotalsDespues,
          playerMr,
          playerCombatMrBonus: playerCombatMrBonus + instantDeltas.mr,
          playerSpeed,
          playerCombatSpeedBonus: playerCombatSpeedBonus + instantDeltas.speed,
          playerWeaponDamageMin,
          playerWeaponDamageMax,
          playerCombatWeaponDamageMinBonus:
            playerCombatWeaponDamageMinBonus + instantDeltas.weaponMin,
          playerCombatWeaponDamageMaxBonus:
            playerCombatWeaponDamageMaxBonus + instantDeltas.weaponMax,
          playerMagicDamageMin,
          playerMagicDamageMax,
          playerCombatMagicDamageMinBonus:
            playerCombatMagicDamageMinBonus + instantDeltas.magicMin,
          playerCombatMagicDamageMaxBonus:
            playerCombatMagicDamageMaxBonus + instantDeltas.magicMax,
          playerCurrentHp: Math.min(
            Math.max(1, playerHpMax),
            playerCurrentHp + instantDeltas.hpHeal,
          ),
          displayPlayerMana: Math.min(
            Math.max(0, playerManaMax),
            Math.max(0, displayPlayerMana + instantDeltas.manaDelta),
          ),
          playerHpMax,
          playerManaMax,
        });
        logCombatBuffStatDebug({
          skillName: skillEntry.skill.name,
          turn,
          durationTurns,
          parts,
          timedParts,
          instantParts,
          antes,
          despues,
          timedTotalsAntes,
          timedTotalsDespues,
          instantDeltas,
        });
      }

      if (timedParts.length > 0 && durationTurns != null) {
        setPlayerTimedSelfBuffs((prev) => [
          ...prev,
          {
            id: `${skillEntry.userCharacterSkillId}:${turn}:${prev.length}`,
            parts: timedParts,
            remainingTurns: durationTurns,
            lastTickTurn: turn,
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
            setPlayerCombatArmorBonus((v) => v + a);
            break;
          case "mr":
            setPlayerCombatMrBonus((v) => v + a);
            break;
          case "hp":
            if (a > 0) {
              const cap = Math.max(1, playerHpMax);
              const prevHp = playerCurrentHp;
              const nextHp = Math.min(cap, prevHp + a);
              setPlayerCurrentHp(nextHp);
              recordPlayerHealing(Math.max(0, nextHp - prevHp));
            }
            break;
          case "mana":
            setDisplayPlayerMana((m) =>
              Math.min(Math.max(0, playerManaMax), Math.max(0, m + a)),
            );
            break;
          case "speed":
            setPlayerCombatSpeedBonus((v) => v + a);
            break;
          case "weapon_damage_min":
            setPlayerCombatWeaponDamageMinBonus((v) => v + a);
            break;
          case "weapon_damage_max":
            setPlayerCombatWeaponDamageMaxBonus((v) => v + a);
            break;
          case "magic_damage_min":
            setPlayerCombatMagicDamageMinBonus((v) => v + a);
            break;
          case "magic_damage_max":
            setPlayerCombatMagicDamageMaxBonus((v) => v + a);
            break;
          default:
            break;
        }
      }

      const buffText =
        descTemplate != null
          ? formatPlayerSelfBuffCombatLog(descTemplate, parts, durationTurns)
          : `Usás ${skillEntry.skill.name}.`;
      appendCombatLog(buffText, "default");
      scheduleAdvanceTurn();
      return;
    }

    if (damageKind === "none") {
      appendSpellLog(0);
      scheduleAdvanceTurn();
      return;
    }

    const magicalCombatDamageFlat = Math.max(
      0,
      Math.trunc(
        playerCombatMagicDamageMinBonus +
          playerCombatMagicDamageMaxBonus +
          timedBuffBonusByStat.magic_damage_min +
          timedBuffBonusByStat.magic_damage_max,
      ),
    );
    const applyMagicalCombatFlatToRawDamage = (
      subtype: PlayerSkillEffectSubtype,
      rolled: number,
    ) =>
      subtype === "magical"
        ? Math.max(0, Math.trunc(rolled + magicalCombatDamageFlat))
        : rolled;

    const effectiveWeaponDamageMin = Math.max(
      1,
      Math.floor(
        playerWeaponDamageMin +
          playerCombatWeaponDamageMinBonus +
          timedBuffBonusByStat.weapon_damage_min,
      ),
    );
    const effectiveWeaponDamageMax = Math.max(
      effectiveWeaponDamageMin,
      Math.floor(
        playerWeaponDamageMax +
          playerCombatWeaponDamageMaxBonus +
          timedBuffBonusByStat.weapon_damage_max,
      ),
    );
    const skillDamageBases: PlayerSkillDamageBaseBounds = {
      weaponMin: effectiveWeaponDamageMin,
      weaponMax: effectiveWeaponDamageMax,
      magicMin: playerMagicDamageMin,
      magicMax: playerMagicDamageMax,
    };

    const pushTimedEnemyFromDamageSkill = (enemyId: string, eff: Record<string, unknown>) => {
      const durationTurns = parseEffectDurationTurns(eff);
      const weakTags = collectWeaknessTagsFromDamageSkillScalings(eff);
      const stateIcons = getEffectStateIcons(eff);
      const dk = getPlayerSkillDamageEffectKind(eff);
      if (durationTurns == null || durationTurns <= 0) return;
      if (weakTags.length === 0 && dk !== "damage_dot" && stateIcons.length === 0) return;
      const dotTicksRemaining = dk === "damage_dot" ? Math.max(0, durationTurns - 1) : 0;
      setEnemyPlayerTimedEffects((prev) => [
        ...prev,
        {
          id: `${skillEntry.userCharacterSkillId}:${enemyId}:${turn}:${prev.length}`,
          enemyId,
          debuffRemainingTurns: durationTurns,
          dotTicksRemaining,
          lastTickTurn: turn,
          skillName: skillEntry.skill.name,
          stateIcons,
          extraWeaknessTags: weakTags,
          dotEffectJson: dk === "damage_dot" ? { ...eff } : null,
        },
      ]);
    };

    const needsSingleEnemy = playerSkillRequiresSingleEnemySelection(skillEntry);
    const isArea = playerSkillDamageHitsAllEnemies(effect);

    if (needsSingleEnemy && !isArea) {
      const target = selectedEnemy;
      if (!target || target.hp <= 0) return;

      const weakThis = collectWeaknessTagsFromDamageSkillScalings(effect);
      const weaknessesResolved = mergeEnemyWeaknessesWithExtraTags(
        target,
        enemyPlayerTimedEffects,
        weakThis,
      );
      const mitigatedFinal = computePlayerSkillMitigatedDamageToEnemy(effect, target, {
        getCombatStatValue: getCombatStatValueForSkills,
        skillDamageBases,
        magicalCombatDamageFlat,
        resistWeakTags,
        weaknessesResolved,
      });
      const damageDone = Math.min(mitigatedFinal, target.hp);
      const updatedHp = target.hp - damageDone;
      recordPlayerDamageDealt(damageDone);

      setDisplayEnemies((prev) =>
        prev.map((enemy) =>
          enemy.id === target.id ? { ...enemy, hp: updatedHp } : enemy,
        ),
      );
      pushTimedEnemyFromDamageSkill(target.id, effect);
      appendSpellLog(damageDone, target.name);
      if (updatedHp === 0) {
        appendCombatLog(`Has matado a ${target.name}.`, "success");
        setSelectedEnemyId(null);
      }
      scheduleAdvanceTurn();
      return;
    }

    const aliveTargets = displayEnemies.filter((enemy) => enemy.hp > 0);
    if (aliveTargets.length === 0) {
      appendSpellLog(0);
      scheduleAdvanceTurn();
      return;
    }

    let clearedSelection = false;
    const combatRows: Array<{ enemyId: string; hpNext: number; text: string; dmg: number }> = [];
    const timedEnemyRows: PlayerEnemyTimedEffect[] = [];

    for (const enemy of displayEnemies) {
      if (enemy.hp <= 0) continue;
      const weakThis = collectWeaknessTagsFromDamageSkillScalings(effect);
      const weaknessesResolved = mergeEnemyWeaknessesWithExtraTags(
        enemy,
        enemyPlayerTimedEffects,
        weakThis,
      );
      const mitigatedFinal = computePlayerSkillMitigatedDamageToEnemy(effect, enemy, {
        getCombatStatValue: getCombatStatValueForSkills,
        skillDamageBases,
        magicalCombatDamageFlat,
        resistWeakTags,
        weaknessesResolved,
      });
      const damageDone = Math.min(mitigatedFinal, enemy.hp);
      const hpNext = enemy.hp - damageDone;
      recordPlayerDamageDealt(damageDone);
      if (enemy.id === selectedEnemyId && hpNext <= 0) clearedSelection = true;
      const text =
        descTemplate != null
          ? formatPlayerSkillCombatLogDescription(descTemplate, damageDone, enemy.name, damageTypes)
          : `Usás ${skillEntry.skill.name} e infligís ${damageDone} de daño a ${enemy.name}.`;
      combatRows.push({ enemyId: enemy.id, hpNext, text, dmg: damageDone });

      const durationTurns = parseEffectDurationTurns(effect);
      const weakTags = collectWeaknessTagsFromDamageSkillScalings(effect);
      const stateIcons = getEffectStateIcons(effect);
      const dk = getPlayerSkillDamageEffectKind(effect);
      if (durationTurns != null && durationTurns > 0) {
        if (weakTags.length > 0 || dk === "damage_dot" || stateIcons.length > 0) {
          const dotTicksRemaining = dk === "damage_dot" ? Math.max(0, durationTurns - 1) : 0;
          timedEnemyRows.push({
            id: `${skillEntry.userCharacterSkillId}:${enemy.id}:${turn}:${timedEnemyRows.length}`,
            enemyId: enemy.id,
            debuffRemainingTurns: durationTurns,
            dotTicksRemaining,
            lastTickTurn: turn,
            skillName: skillEntry.skill.name,
            stateIcons,
            extraWeaknessTags: weakTags,
            dotEffectJson: dk === "damage_dot" ? { ...effect } : null,
          });
        }
      }
    }

    setDisplayEnemies((prev) =>
      prev.map((enemy) => {
        const hit = combatRows.find((row) => row.enemyId === enemy.id);
        return hit ? { ...enemy, hp: hit.hpNext } : enemy;
      }),
    );
    if (timedEnemyRows.length > 0) {
      setEnemyPlayerTimedEffects((prev) => [...prev, ...timedEnemyRows]);
    }
    for (const row of combatRows) {
      appendCombatLog(row.text, "default", row.dmg);
      if (row.hpNext === 0) {
        const name =
          displayEnemies.find((e) => e.id === row.enemyId)?.name ?? "Enemigo";
        appendCombatLog(`Has matado a ${name}.`, "success");
      }
    }
    if (clearedSelection) setSelectedEnemyId(null);

    scheduleAdvanceTurn();
  }

  const skillTooltipEntry =
    skillInfoTooltip.skillId === null
      ? undefined
      : playerCombatSkills.find((s) => s.userCharacterSkillId === skillInfoTooltip.skillId);
  const consumableTooltipEntry =
    consumableInfoTooltip.inventoryId == null
      ? undefined
      : combatConsumables.find((c) => c.inventoryId === consumableInfoTooltip.inventoryId);

  const skillTooltipStyles =
    skillTooltipEntry != null
      ? getPlayerSkillSubtypeStyles(getPlayerSkillEffectSubtype(skillTooltipEntry.skill.effect))
      : null;

  function tickPlayerTimedBuffs(roundTurn: number) {
    setPlayerTimedSelfBuffs((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.flatMap((buff) => {
        if (buff.lastTickTurn >= roundTurn) return [buff];
        const remainingTurns = buff.remainingTurns - 1;
        changed = true;
        if (remainingTurns <= 0) return [];
        return [{ ...buff, remainingTurns, lastTickTurn: roundTurn }];
      });
      return changed ? next : prev;
    });
  }

  function advanceTurn() {
    setCurrentTurnIndex((prev) => {
      const order = turnOrderRef.current;
      if (order.length === 0) return 0;
      const effective = Math.min(prev, order.length - 1);
      return (effective + 1) % order.length;
    });
  }

  useEffect(() => {
    tickPlayerTimedBuffs(turn);

    const prevEffects = enemyPlayerTimedEffectsRef.current;
    if (prevEffects.length === 0) return;

    const ctx = skillDamageTickContextRef.current;
    const enemiesNow = displayEnemiesRef.current;

    const dmgRows: Array<{ enemyId: string; newHp: number; dmg: number; name: string }> = [];
    const nextEffects = prevEffects.flatMap((eff) => {
      if (eff.lastTickTurn >= turn) return [eff];
      const enemy = enemiesNow.find((e) => e.id === eff.enemyId);
      let debuffR = eff.debuffRemainingTurns - 1;
      let dotR = eff.dotTicksRemaining;
      if (eff.dotEffectJson && dotR > 0 && enemy && enemy.hp > 0) {
        const resistTags = getEffectAttackTypesForResistWeak(
          eff.dotEffectJson,
          ctx.playerWeaponAttackFamily,
        );
        const extraWeak = mergeEnemyWeaknessesForPlayerAttackFromEffects(enemy, prevEffects);
        const mitigatedFinal = computePlayerSkillMitigatedDamageToEnemy(eff.dotEffectJson, enemy, {
          getCombatStatValue: ctx.getCombatStatValue,
          skillDamageBases: ctx.skillDamageBases,
          magicalCombatDamageFlat: ctx.magicalCombatDamageFlat,
          resistWeakTags: resistTags,
          weaknessesResolved: extraWeak,
        });
        const damageDone = Math.min(mitigatedFinal, enemy.hp);
        if (damageDone > 0) {
          dmgRows.push({
            enemyId: eff.enemyId,
            newHp: enemy.hp - damageDone,
            dmg: damageDone,
            name: enemy.name,
          });
        }
        dotR -= 1;
      }
      if (debuffR <= 0) return [];
      return [
        {
          ...eff,
          debuffRemainingTurns: debuffR,
          dotTicksRemaining: dotR,
          lastTickTurn: turn,
        },
      ];
    });

    if (dmgRows.length > 0) {
      setDisplayEnemies((prev) =>
        prev.map((e) => {
          const hit = dmgRows.find((r) => r.enemyId === e.id);
          return hit ? { ...e, hp: hit.newHp } : e;
        }),
      );
      for (const r of dmgRows) {
        appendCombatLog(`${r.name} sufre ${r.dmg} de daño (DoT).`, "default", r.dmg);
        recordPlayerDamageDealt(r.dmg);
      }
    }

    const effectsChanged =
      nextEffects.length !== prevEffects.length ||
      nextEffects.some((e, i) => e !== prevEffects[i]);
    if (effectsChanged) {
      setEnemyPlayerTimedEffects(nextEffects);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick alineado a `turn`; logs/stats leen cierre actual
  }, [turn]);

  function scheduleAdvanceTurn() {
    if (advanceTurnTimeoutRef.current) {
      clearTimeout(advanceTurnTimeoutRef.current);
      advanceTurnTimeoutRef.current = null;
      resolvedEnemyTurnRef.current = null;
    }
    setIsTurnTransitioning(true);
    advanceTurnTimeoutRef.current = setTimeout(() => {
      resolvedEnemyTurnRef.current = null;
      advanceTurn();
      setIsTurnTransitioning(false);
      advanceTurnTimeoutRef.current = null;
    }, ACTION_DELAY_MS);
  }

  /** Evita quedar con `isTurnTransitioning` o turno enemigo colgado si un timeout se cancela sin avanzar. */
  useEffect(() => {
    if (!isTurnTransitioning) return;
    const safetyMs = ACTION_DELAY_MS + 2500;
    const safetyId = setTimeout(() => {
      if (advanceTurnTimeoutRef.current) {
        clearTimeout(advanceTurnTimeoutRef.current);
        advanceTurnTimeoutRef.current = null;
      }
      resolvedEnemyTurnRef.current = null;
      setIsTurnTransitioning(false);
    }, safetyMs);
    return () => clearTimeout(safetyId);
  }, [isTurnTransitioning]);

  function handleAttack() {
    if (isTurnTransitioning) return;
    if (!isPlayerTurn) {
      appendCombatLog("Todavia no es tu turno.");
      return;
    }
    const target = selectedEnemy;
    if (!target) {
      appendCombatLog("Seleccioná un enemigo para atacar.");
      return;
    }
    if (target.hp <= 0) {
      appendCombatLog(`${target.name} ya está derrotado.`);
      return;
    }

    const damageMin = Math.max(
      1,
      Math.floor(
        playerWeaponDamageMin +
          playerCombatWeaponDamageMinBonus +
          timedBuffBonusByStat.weapon_damage_min,
      ),
    );
    const damageMax = Math.max(
      damageMin,
      Math.floor(
        playerWeaponDamageMax +
          playerCombatWeaponDamageMaxBonus +
          timedBuffBonusByStat.weapon_damage_max,
      ),
    );
    const rawDamage = randomIntInclusive(damageMin, damageMax);
    const afterArmor = mitigateDamageByDefense(rawDamage, target.armor);
    const mitigated = applyEnemyAttackFamilyToMitigatedDamage(
      afterArmor,
      playerWeaponAttackFamily,
      target.resistances,
      target.weaknesses,
    );
    const updatedHp = Math.max(0, target.hp - mitigated);
    const damageDone = target.hp - updatedHp;
    recordPlayerDamageDealt(damageDone);
    setDisplayEnemies((prev) =>
      prev.map((enemy) => (enemy.id === target.id ? { ...enemy, hp: updatedHp } : enemy)),
    );
    appendCombatLog(
      `Atacaste a ${target.name} y le infligiste ${damageDone} de daño.`,
      "default",
      damageDone,
    );
    if (updatedHp === 0) {
      appendCombatLog(`Has matado a ${target.name}.`, "success");
      setSelectedEnemyId(null);
    }
    scheduleAdvanceTurn();
  }

  function showAttackHintAt(x: number, y: number) {
    if (canAttack) return;
    setAttackHint({ visible: true, x, y });
  }

  function hideAttackHint() {
    setAttackHint((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }

  function handleEscapeClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (isEscapeDisabledByEnemyHp) {
      event.preventDefault();
      return;
    }
    if (!onEscapePersistState) return;
    event.preventDefault();
    if (isEscaping) return;
    setIsEscaping(true);
    void onEscapePersistState({
      finalHp: Math.max(0, Math.trunc(playerCurrentHp)),
      finalMana: Math.max(0, Math.trunc(displayPlayerMana)),
    })
      .catch(() => {
        // Si falla el guardado no bloquea escape.
      })
      .finally(() => {
        router.push(escapeHref);
      });
  }

  function pickAvailableEnemySkill(enemy: CombatEncounterEnemyView): EnemySkillDecision | null {
    const skillState = enemySkillNextAvailableTurn[enemy.id] ?? {};
    for (const skill of enemy.skills) {
      const nextAvailableTurn = skillState[skill.id] ?? 1;
      if (turn < nextAvailableTurn) continue;
      if (enemy.mana < skill.manaCost) continue;
      const chance = Math.max(0, Math.min(1, skill.effect.chance));
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

  useEffect(() => {
    if (combatOutcome !== "active") return;
    if (!currentActor || currentActor.type !== "enemy") return;
    if (isTurnTransitioning) return;
    if (playerCurrentHp <= 0) return;

    const resolvedKey = `${turn}:${effectiveTurnIndex}:${currentActor.id}`;
    if (resolvedEnemyTurnRef.current === resolvedKey) return;
    resolvedEnemyTurnRef.current = resolvedKey;

    const enemy = displayEnemies.find((entry) => entry.id === currentActor.enemyId);
    if (!enemy || enemy.hp <= 0) {
      scheduleAdvanceTurn();
      return;
    }

    setEnemyAttackLungeSeq((prev) => ({
      ...prev,
      [enemy.id]: (prev[enemy.id] ?? 0) + 1,
    }));

    const skillDecision = pickAvailableEnemySkill(enemy);
    const skill = skillDecision?.chosenSkill ?? null;
    let incomingSubtype: PlayerSkillEffectSubtype = "physical";
    let rawDamage = 0;
    if (skill) {
      incomingSubtype = enemySkillIncomingSubtype(skill.effect);
      rawDamage = Math.max(0, randomIntInclusive(skill.effect.min, skill.effect.max));
      const nextTurnForSkill = turn + Math.max(1, skill.cooldownTurns);
      setEnemySkillNextAvailableTurn((prev) => ({
        ...prev,
        [enemy.id]: {
          ...(prev[enemy.id] ?? {}),
          [skill.id]: nextTurnForSkill,
        },
      }));
      setDisplayEnemies((prev) =>
        prev.map((entry) =>
          entry.id === enemy.id
            ? { ...entry, mana: Math.max(0, entry.mana - Math.max(0, skill.manaCost)) }
            : entry,
        ),
      );
    } else {
      incomingSubtype = "physical";
      rawDamage = Math.max(0, randomIntInclusive(enemy.attackMin, enemy.attackMax));
    }
    const defenseStat = playerDefenseStatVsIncoming(
      incomingSubtype,
      effectivePlayerArmor,
      effectivePlayerMr,
    );
    const damage = mitigateDamageByDefense(rawDamage, defenseStat);
    recordPlayerDamageTaken(damage);
    const nextPlayerHp = Math.max(0, playerCurrentHp - damage);
    setPlayerCurrentHp(nextPlayerHp);
    if (skill) {
      const descRaw = skill.description?.trim();
      const fallback = `${enemy.name} usa ${skill.name}.`;
      const template = descRaw && descRaw.length > 0 ? descRaw : fallback;
      const hadDamagePh = enemySkillCombatLogHadDamagePlaceholder(template);
      const logText = formatEnemySkillCombatLogDescription(
        template,
        damage,
        enemy.name,
        skill.effect.damageTypes ?? [],
      );
      appendCombatLog(
        logText,
        "danger",
        undefined,
        hadDamagePh ? Math.max(0, Math.trunc(damage)) : undefined,
      );
    } else {
      appendCombatLog(
        `${enemy.name} te ataca y te inflige ${damage} de daño.`,
        "danger",
        undefined,
        Math.max(0, Math.trunc(damage)),
      );
    }
    if (nextPlayerHp === 0) {
      appendCombatLog(`${enemy.name} te ha derrotado.`, "danger");
      return;
    }
    scheduleAdvanceTurn();
  }, [
    combatOutcome,
    currentActor,
    effectiveTurnIndex,
    displayEnemies,
    effectivePlayerArmor,
    effectivePlayerMr,
    isTurnTransitioning,
    playerCurrentHp,
    turn,
  ]);

  return (
    <div
      className={`${menuFont.className} relative h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-[#120b08] text-amber-50 sm:h-auto sm:min-h-[100dvh]`}
    >
      <div className="absolute inset-0">
        <BattleBackground src={backgroundResolved} />
      </div>
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col p-2 sm:min-h-[100dvh] sm:p-6">
        {combatDebug ? (
          <details className="mb-2 rounded-lg border border-amber-600/50 bg-black/75 p-2 text-left text-[11px] text-amber-100/95 shadow-lg backdrop-blur-sm">
            <summary className="cursor-pointer select-none font-semibold text-amber-300">
              Debug combate (?debug=1)
            </summary>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-emerald-100/90">
              {JSON.stringify(
                {
                  server: combatDebug,
                  runtime: {
                    initiative: runtimeInitiativeDebug,
                  },
                },
                null,
                2,
              )}
            </pre>
          </details>
        ) : null}

        <header
          className={`${menuFont.className} rounded-xl border border-amber-800/70 bg-[#1a100c]/88 p-2 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:py-2 sm:px-4`}
        >
          <div className="flex w-full items-center gap-2 sm:gap-4">
            <div className="min-w-0 flex-1 basis-0">
              <p className="truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-400/90 sm:text-[11px]">
                {encounterName}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap border-x border-amber-800/40 px-2 sm:gap-2 sm:px-4">
              <span
                className={`text-xs font-bold transition-transform duration-200 sm:text-sm ${
                  turnOwner === "player"
                    ? "scale-110 text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]"
                    : "text-amber-700/70"
                }`}
                aria-hidden
              >
                &lt;
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-amber-300/90 sm:text-xs sm:tracking-[0.2em]">
                Turno
              </span>
              <span className="min-w-[1.1rem] text-center text-base font-bold tabular-nums text-amber-100 sm:text-2xl">
                {turn}
              </span>
              <span
                className={`text-xs font-bold transition-transform duration-200 sm:text-sm ${
                  turnOwner === "enemy"
                    ? "scale-110 text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]"
                    : "text-amber-700/70"
                }`}
                aria-hidden
              >
                &gt;
              </span>
            </div>

            <Link
              href={escapeHref}
              onClick={handleEscapeClick}
              aria-disabled={isEscapeDisabledByEnemyHp || isEscaping}
              title={
                isEscapeDisabledByEnemyHp
                  ? "No podés huir cuando la vida total de los enemigos es 60% o menos."
                  : undefined
              }
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition sm:px-3 ${
                isEscapeDisabledByEnemyHp
                  ? "cursor-not-allowed border-slate-700/70 bg-slate-900/35 text-slate-500"
                  : "border-red-700/60 bg-red-900/15 text-amber-200/90 hover:border-red-700/70 hover:bg-red-900/45 hover:text-amber-50"
              }`}
            >
              {isEscaping ? "Escapando..." : "Escapar"}
            </Link>
          </div>
        </header>

        <main className="relative mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-amber-900/70 bg-black/15 p-2 shadow-[inset_0_-30px_60px_rgba(0,0,0,0.5)] max-sm:pb-[calc(17rem+env(safe-area-inset-bottom,0px))] sm:mt-2 sm:p-6">
          {/* HUD: enemigos arriba a la derecha, PJ abajo a la izquierda (sobre el escenario) */}
          <div className="pointer-events-none absolute inset-0 z-[8] flex flex-col justify-between gap-1 px-0 pb-1 pt-1 sm:gap-2 sm:p-2">
            <div className="pointer-events-auto flex min-h-0 min-w-0 w-full flex-row items-stretch gap-1.5 self-start px-1 sm:w-auto sm:flex-wrap sm:justify-end sm:gap-2 sm:self-auto sm:px-0">
              {displayEnemies.length > 0
                ? displayEnemies.map((enemy) => (
                    <EnemyStatusModal
                      key={enemy.id}
                      enemy={enemy}
                      isSelected={enemy.id === selectedEnemyId && enemy.hp > 0}
                      onSelect={() => setSelectedEnemyId(enemy.id)}
                      isDefeated={enemy.hp <= 0}
                      nameColorClass={enemyNameColorClass}
                      stateIconSrcs={enemyHudStateIconSrcsById.get(enemy.id) ?? []}
                    />
                  ))
                : null}
            </div>
            {!floatPlayerStatusOverActionsMobile && !isMobileViewport ? (
              <div className="pointer-events-auto flex w-full justify-start">
                <div className="flex flex-col items-start gap-1">
                  <PlayerBuffStateIconStrip srcs={playerActiveBuffStateIconSrcs} />
                  <PlayerStatusModal
                    displayName={playerDisplayName}
                    level={playerLevelCurrent}
                    portraitSrc={portraitResolved}
                    hp={playerCurrentHp}
                    hpMax={playerHpMax}
                    mana={displayPlayerMana}
                    manaMax={playerManaMax}
                    hpPercent={playerHpPercent}
                    manaPercent={playerManaPercent}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-row items-end justify-between">
            <div className="intro-character-slide-in pointer-events-none flex w-[42%] items-end justify-start py-6 max-sm:py-4 sm:py-10">
              <div className="max-sm:translate-y-30 sm:-translate-y-0">
                <Image
                  src={playerSpriteSrc}
                  alt={`${playerDisplayName} en combate`}
                  width={620}
                  height={930}
                  className="h-[min(32vh,200px)] w-auto object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.6)] sm:h-[min(52vh,300px)]"
                />
              </div>
            </div>

            <div className="intro-character-slide-in-right pointer-events-none flex w-[42%] flex-col items-end justify-end gap-1 self-start sm:gap-2 sm:self-auto">
              {displayEnemies
                .filter((enemy) => enemy.spriteSrc)
                .sort((a, b) => a.spawnIndex - b.spawnIndex)
                .map((enemy) => (
                  <div
                    key={enemy.id}
                    className="flex w-full shrink-0 justify-end"
                    style={{ zIndex: enemy.spriteZIndex }}
                  >
                    {enemy.hp > 0 ? (
                      <div
                        style={{
                          transform: `translate(${
                            isMobileViewport ? enemy.mobileSpriteOffsetX : enemy.spriteOffsetX
                          }px, ${
                            isMobileViewport ? enemy.mobileSpriteOffsetY : enemy.spriteOffsetY
                          }px) scale(${enemy.spriteScale})`,
                          transformOrigin: "bottom right",
                        }}
                      >
                        <div
                          key={`${enemy.id}-${enemyAttackLungeSeq[enemy.id] ?? 0}`}
                          className={`origin-bottom-right ${
                            (enemyAttackLungeSeq[enemy.id] ?? 0) > 0
                              ? "combat-enemy-lunge-at-player"
                              : ""
                          }`}
                        >
                          <EncounterRasterMedia
                            src={enemy.spriteSrc!}
                            alt={enemy.name}
                            mode="contain"
                            className={`${spriteClass} object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.6)]`}
                            sizes="(max-width: 640px) 42vw, 300px"
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`${spriteClass} w-0 max-w-full shrink-0 overflow-hidden opacity-0`}
                        aria-hidden
                      />
                    )}
                  </div>
                ))}
            </div>
          </div>
        </main>

        <section
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[38] flex justify-center px-2 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] pt-1 sm:hidden"
          aria-label="Acciones de combate (mobile)"
        >
          <div className="pointer-events-auto flex w-full max-w-6xl flex-col gap-2">
            {!isActionsPanelOpen && isMobileViewport ? (
              <div className="pointer-events-none flex w-full justify-start">
                <div className="pointer-events-auto flex flex-col items-start gap-1">
                  <PlayerBuffStateIconStrip srcs={playerActiveBuffStateIconSrcs} />
                  <PlayerStatusModal
                    displayName={playerDisplayName}
                    level={playerLevelCurrent}
                    portraitSrc={portraitResolved}
                    hp={playerCurrentHp}
                    hpMax={playerHpMax}
                    mana={displayPlayerMana}
                    manaMax={playerManaMax}
                    hpPercent={playerHpPercent}
                    manaPercent={playerManaPercent}
                  />
                </div>
              </div>
            ) : null}
            {isActionsPanelOpen ? (
              <div className="relative z-20 flex w-full flex-col-reverse gap-2">
                <div
                  className={`${menuFont.className} w-full overflow-hidden rounded-xl border border-amber-800/70 bg-[#1a100c]/95 p-2 shadow-[0_14px_32px_rgba(0,0,0,0.5)] backdrop-blur-sm`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsPanelOpen(false);
                      setActionMenu("main");
                    }}
                    className="mb-2 flex w-full cursor-pointer items-center justify-between rounded-lg border border-amber-800/60 bg-[#1a100c]/80 px-2 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90"
                    aria-label="Colapsar panel de acciones"
                  >
                    <span>Acciones</span>
                    <span aria-hidden>▼</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {actionMenu !== "main" && (
                      <button
                        type="button"
                        onClick={() => setActionMenu("main")}
                        className="cursor-pointer rounded-md border border-amber-700/70 bg-amber-950/40 px-2 py-0.5 text-sm font-bold text-amber-200 transition hover:bg-amber-900/60"
                        aria-label="Volver a acciones"
                      >
                        ←
                      </button>
                    )}
                  </div>

                  <div className={actionMenu === "main" ? "mt-2" : ACTIONS_PANEL_BODY_MOBILE}>
                {actionMenu === "main" ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <div
                      onMouseEnter={(e) => showAttackHintAt(e.clientX, e.clientY)}
                      onMouseMove={(e) => showAttackHintAt(e.clientX, e.clientY)}
                      onMouseLeave={hideAttackHint}
                    >
                      <button
                        type="button"
                        disabled={!canAttack}
                        title={attackBlockReason ?? undefined}
                        onClick={handleAttack}
                        className={`w-full rounded-md border px-2 py-1 text-left text-xs font-semibold transition ${
                          canAttack
                            ? "cursor-pointer border-amber-600/80 bg-amber-900/40 text-amber-100 hover:bg-amber-800/55"
                            : "cursor-not-allowed border-slate-500/70 bg-slate-700/45 text-slate-100 opacity-55"
                        }`}
                      >
                        Atacar
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={isPlayerActionsLocked}
                      onClick={() => setActionMenu("skills")}
                      className={`w-full rounded-md border px-2 py-1 text-left text-xs font-semibold transition ${
                        isPlayerActionsLocked
                          ? "cursor-not-allowed border-slate-600/70 bg-slate-800/40 text-slate-300 opacity-55"
                          : "cursor-pointer border-sky-600/70 bg-sky-900/45 text-sky-100 hover:bg-sky-800/65"
                      }`}
                    >
                      Habilidades
                    </button>
                    <button
                      type="button"
                      disabled={isPlayerActionsLocked}
                      onClick={() => setActionMenu("inventory")}
                      className={`w-full rounded-md border px-2 py-1 text-left text-xs font-semibold transition ${
                        isPlayerActionsLocked
                          ? "cursor-not-allowed border-slate-600/70 bg-slate-800/40 text-slate-300 opacity-55"
                          : "cursor-pointer border-yellow-600/70 bg-yellow-900/45 text-yellow-100 hover:bg-yellow-700/65"
                      }`}
                    >
                      Inventario
                    </button>
                  </div>
                ) : actionMenu === "skills" ? (
                  playerCombatSkills.length === 0 ? (
                    <p
                      className={`${helpCardFont.className} flex flex-1 items-center justify-center text-center text-[11px] text-amber-200/75`}
                    >
                      No tenés habilidades aprendidas.
                    </p>
                  ) : (
                    <div className={ACTIONS_SKILLS_SCROLL_CLASS}>
                    <div className="grid gap-1">
                      {playerCombatSkills.map((entry) => {
                        const sk = getPlayerSkillSubtypeStyles(getPlayerSkillEffectSubtype(entry.skill.effect));
                        const usable = canUsePlayerSkill(entry);
                        const cdLeft = playerSkillCooldownTurnsRemaining(entry);
                        return (
                          <div key={entry.userCharacterSkillId} className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePlayerSkillChosen(entry)}
                              disabled={!usable}
                              className={`w-full rounded-md border px-1.5 py-0.5 text-left text-[11px] font-semibold leading-snug transition disabled:opacity-95 ${
                                usable ? sk.rowButtonActive : sk.rowButtonDisabled
                              }`}
                            >
                              {entry.skill.name}
                            </button>
                            <span
                              className={`${SKILL_COST_BADGE_BOX} rounded-md border px-1 py-0.5 text-[10px] font-bold leading-none ${
                                cdLeft > 0
                                  ? "border-amber-700/60 bg-amber-950/50 text-amber-200/90"
                                  : sk.mpBadge
                              }`}
                            >
                              {cdLeft > 0 ? (
                                <>
                                  <SkillCooldownClockIcon className="h-3 w-3 shrink-0 opacity-90" />
                                  <span>{cdLeft}</span>
                                </>
                              ) : (
                                `${entry.skill.manaCost} MP`
                              )}
                            </span>
                            <button
                              type="button"
                              onMouseEnter={(e) =>
                                openSkillInfoTooltip(
                                  entry.userCharacterSkillId,
                                  e.clientX,
                                  e.clientY,
                                  false,
                                )
                              }
                              onMouseMove={(e) =>
                                openSkillInfoTooltip(
                                  entry.userCharacterSkillId,
                                  e.clientX,
                                  e.clientY,
                                  false,
                                )
                              }
                              onMouseLeave={hideSkillInfoTooltip}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleSkillInfoTooltipPinned(
                                  entry.userCharacterSkillId,
                                  e.clientX,
                                  e.clientY,
                                );
                              }}
                              className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border text-[10px] font-black leading-none transition ${sk.infoButton}`}
                              aria-label={`Información de ${entry.skill.name}`}
                            >
                              ?
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    </div>
                  )
                ) : combatConsumables.length === 0 ? (
                  <p
                    className={`${helpCardFont.className} flex flex-1 items-center justify-center text-center text-[11px] text-amber-200/75`}
                  >
                    No tenés consumibles disponibles.
                  </p>
                ) : (
                  <div className={ACTIONS_SKILLS_SCROLL_CLASS}>
                  <div className="grid gap-1">
                    {combatConsumables.map((item) => {
                      const usable = canUseConsumable(item);
                      return (
                        <div key={item.inventoryId} className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!usable}
                            onClick={() => void handleConsumableUse(item)}
                            className={`w-full rounded-md border px-1.5 py-0.5 text-left text-[11px] font-semibold leading-snug ${
                              !usable
                                ? "cursor-not-allowed border-yellow-700/65 bg-yellow-950/35 text-yellow-100/90 opacity-70"
                                : "cursor-pointer border-yellow-600/70 bg-yellow-900/45 text-yellow-100 hover:bg-yellow-700/65"
                            }`}
                          >
                            {item.name}
                          </button>
                        <button
                          type="button"
                          onMouseEnter={(e) =>
                            openConsumableInfoTooltip(item.inventoryId, e.clientX, e.clientY, false)
                          }
                          onMouseMove={(e) =>
                            openConsumableInfoTooltip(item.inventoryId, e.clientX, e.clientY, false)
                          }
                          onMouseLeave={hideConsumableInfoTooltip}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleConsumableInfoTooltipPinned(item.inventoryId, e.clientX, e.clientY);
                          }}
                          className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-yellow-700/70 bg-yellow-950/55 text-[10px] font-black leading-none text-yellow-100 transition hover:bg-yellow-900/70"
                          aria-label={`Información de ${item.name}`}
                        >
                          ?
                        </button>
                          <span className={`${SKILL_COST_BADGE_BOX} rounded-md border border-yellow-700/65 bg-yellow-950/55 px-1 py-0.5 text-[10px] font-bold leading-none text-yellow-100`}>
                            x{item.quantity}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                )}
                </div>
              </div>
                {floatPlayerStatusOverActionsMobile ? (
                  <div
                    className="pointer-events-none w-[min(100vw,12rem)] max-w-[min(92vw,11.5rem)] shrink-0 self-start px-1 drop-shadow-[0_6px_16px_rgba(0,0,0,0.55)]"
                    role="presentation"
                  >
                    <div className="pointer-events-auto flex flex-col items-start gap-1">
                      <PlayerBuffStateIconStrip srcs={playerActiveBuffStateIconSrcs} />
                      <PlayerStatusModal
                        displayName={playerDisplayName}
                        level={playerLevelCurrent}
                        portraitSrc={portraitResolved}
                        hp={playerCurrentHp}
                        hpMax={playerHpMax}
                        mana={displayPlayerMana}
                        manaMax={playerManaMax}
                        hpPercent={playerHpPercent}
                        manaPercent={playerManaPercent}
                      />
                    </div>
                  </div>
                ) : null}
            </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setIsActionsPanelOpen((prev) => {
                    const next = !prev;
                    if (next) setIsCombatLogPanelOpen(false);
                    return next;
                  })
                }
                className={`${menuFont.className} flex w-full cursor-pointer items-center justify-between rounded-xl border border-amber-800/70 bg-[#1a100c]/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm`}
                aria-expanded={isActionsPanelOpen}
              >
                <span>Acciones</span>
                <span aria-hidden>▲</span>
              </button>
            )}

          {!isActionsPanelOpen ? (
            isCombatLogPanelOpen ? (
              <div className="relative z-20 w-full rounded-xl border border-amber-800/70 bg-[#1a100c]/95 p-2 shadow-[0_14px_32px_rgba(0,0,0,0.5)] backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => {
                    setIsCombatLogPanelOpen(false);
                  }}
                  className={`${menuFont.className} mb-2 flex w-full cursor-pointer items-center justify-between rounded-lg border border-amber-800/60 bg-[#1a100c]/80 px-2 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90`}
                  aria-label="Colapsar combat log"
                >
                  <span>Combat Log</span>
                  <span aria-hidden>▼</span>
                </button>
                <div
                  ref={combatLogMobileRef}
                  className={`${helpCardFont.className} mt-2 min-h-28 max-h-28 space-y-1 overflow-y-auto pr-1 text-[10px] leading-relaxed text-amber-50/92 [scrollbar-color:rgba(217,119,6,0.75)_rgba(0,0,0,0.35)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-black/35 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-amber-800/60 [&::-webkit-scrollbar-thumb]:bg-amber-600/75 [&::-webkit-scrollbar-thumb:hover]:bg-amber-500/85`}
                >
                  {combatLog.map((entry) => (
                    <p
                      key={entry.id}
                      className={`rounded-md bg-black/25 px-2 py-1 ${
                        entry.tone === "success"
                          ? "text-emerald-300"
                          : entry.tone === "danger"
                            ? "text-red-300"
                            : ""
                      }`}
                    >
                      <CombatLogLineBody entry={entry} />
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setIsCombatLogPanelOpen((prev) => {
                    const next = !prev;
                    if (next) {
                      setIsActionsPanelOpen(false);
                      setActionMenu("main");
                    }
                    return next;
                  })
                }
                className={`${menuFont.className} flex w-full cursor-pointer items-center justify-between rounded-xl border border-amber-800/70 bg-[#1a100c]/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm`}
                aria-expanded={isCombatLogPanelOpen}
              >
                <div className="min-w-0 text-left">
                  <p>Combat Log</p>
                  <p
                    className={`${helpCardFont.className} mt-1 rounded-md bg-black/25 px-2 py-1 text-[10px] normal-case leading-relaxed tracking-normal text-amber-50/92`}
                  >
                    {combatLog.length > 0 ? (
                      <CombatLogLineBody entry={combatLog[combatLog.length - 1]} />
                    ) : (
                      ""
                    )}
                  </p>
                </div>
                <span className="ml-2 shrink-0" aria-hidden>
                  ▲
                </span>
              </button>
            )
          ) : null}
          </div>
        </section>

        <section className="mt-4 hidden min-h-0 flex-none grid-cols-[0.9fr_1.5fr] gap-3 pb-1 sm:grid">
          <div
            className={`${menuFont.className} rounded-xl border border-amber-800/70 bg-[#1a100c]/90 p-2 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-3`}
          >
            <div className="flex items-center gap-2">
              {actionMenu !== "main" && (
                <button
                  type="button"
                  onClick={() => setActionMenu("main")}
                  className="cursor-pointer rounded-md border border-amber-700/70 bg-amber-950/40 px-2 py-0.5 text-sm font-bold text-amber-200 transition hover:bg-amber-900/60"
                  aria-label="Volver a acciones"
                >
                  ←
                </button>
              )}
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90">
                {actionMenu === "main"
                  ? "Acciones"
                  : actionMenu === "skills"
                    ? "Habilidades"
                    : "Inventario"}
              </p>
            </div>

            <div className={ACTIONS_PANEL_BODY_DESKTOP}>
            {actionMenu === "main" ? (
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <div
                  onMouseEnter={(e) => showAttackHintAt(e.clientX, e.clientY)}
                  onMouseMove={(e) => showAttackHintAt(e.clientX, e.clientY)}
                  onMouseLeave={hideAttackHint}
                >
                  <button
                    type="button"
                    disabled={!canAttack}
                    title={attackBlockReason ?? undefined}
                    onClick={handleAttack}
                    className={`w-full rounded-md border px-2 py-1 text-left text-xs font-semibold transition sm:px-3 sm:py-1.5 sm:text-sm ${
                      canAttack
                        ? "cursor-pointer border-amber-600/80 bg-amber-900/40 text-amber-100 hover:bg-amber-800/55"
                        : "cursor-not-allowed border-slate-500/70 bg-slate-700/45 text-slate-100 opacity-55"
                    }`}
                  >
                    Atacar
                  </button>
                </div>
                <button
                  type="button"
                  disabled={isPlayerActionsLocked}
                  onClick={() => setActionMenu("skills")}
                  className={`w-full rounded-md border px-2 py-1 text-left text-xs font-semibold transition sm:px-3 sm:py-1.5 sm:text-sm ${
                    isPlayerActionsLocked
                      ? "cursor-not-allowed border-slate-500/70 bg-slate-700/45 text-slate-300 opacity-55"
                      : "cursor-pointer border-sky-600/70 bg-sky-900/45 text-sky-100 hover:bg-sky-800/65"
                  }`}
                >
                  Habilidades
                </button>
                <button
                  type="button"
                  disabled={isPlayerActionsLocked}
                  onClick={() => setActionMenu("inventory")}
                  className={`w-full rounded-md border px-2 py-1 text-left text-xs font-semibold transition sm:px-3 sm:py-1.5 sm:text-sm ${
                    isPlayerActionsLocked
                      ? "cursor-not-allowed border-slate-500/70 bg-slate-700/45 text-slate-300 opacity-55"
                      : "cursor-pointer border-yellow-600/70 bg-yellow-900/45 text-yellow-100 hover:bg-yellow-700/65"
                  }`}
                >
                  Inventario
                </button>
              </div>
            ) : actionMenu === "skills" ? (
              playerCombatSkills.length === 0 ? (
                <p
                  className={`${helpCardFont.className} flex flex-1 items-center justify-center text-center text-sm text-amber-200/75`}
                >
                  No tenés habilidades aprendidas.
                </p>
              ) : (
                <div className={ACTIONS_SKILLS_SCROLL_CLASS}>
                <div className="grid gap-1 sm:gap-1.5">
                  {playerCombatSkills.map((entry) => {
                    const sk = getPlayerSkillSubtypeStyles(getPlayerSkillEffectSubtype(entry.skill.effect));
                    const usable = canUsePlayerSkill(entry);
                    const cdLeft = playerSkillCooldownTurnsRemaining(entry);
                    return (
                      <div key={entry.userCharacterSkillId} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePlayerSkillChosen(entry)}
                          disabled={!usable}
                          className={`w-full rounded-md border px-1.5 py-0.5 text-left text-[11px] font-semibold leading-snug transition disabled:opacity-95 sm:px-2 sm:py-1 sm:text-xs ${
                            usable ? sk.rowButtonActive : sk.rowButtonDisabled
                          }`}
                        >
                          {entry.skill.name}
                        </button>
                        <span
                          className={`${SKILL_COST_BADGE_BOX} rounded-md border px-1 py-0.5 text-[10px] font-bold leading-none sm:text-[11px] ${
                            cdLeft > 0
                              ? "border-amber-700/60 bg-amber-950/50 text-amber-200/90"
                              : sk.mpBadge
                          }`}
                        >
                          {cdLeft > 0 ? (
                            <>
                              <SkillCooldownClockIcon className="h-3 w-3 shrink-0 opacity-90 sm:h-3.5 sm:w-3.5" />
                              <span>{cdLeft}</span>
                            </>
                          ) : (
                            `${entry.skill.manaCost} MP`
                          )}
                        </span>
                        <button
                          type="button"
                          onMouseEnter={(e) =>
                            openSkillInfoTooltip(entry.userCharacterSkillId, e.clientX, e.clientY, false)
                          }
                          onMouseMove={(e) =>
                            openSkillInfoTooltip(entry.userCharacterSkillId, e.clientX, e.clientY, false)
                          }
                          onMouseLeave={hideSkillInfoTooltip}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleSkillInfoTooltipPinned(entry.userCharacterSkillId, e.clientX, e.clientY);
                          }}
                          className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border text-[10px] font-black leading-none transition sm:text-xs ${sk.infoButton}`}
                          aria-label={`Información de ${entry.skill.name}`}
                        >
                          ?
                        </button>
                      </div>
                    );
                  })}
                </div>
                </div>
              )
            ) : combatConsumables.length === 0 ? (
              <p
                className={`${helpCardFont.className} flex flex-1 items-center justify-center text-center text-sm text-amber-200/75`}
              >
                No tenés consumibles disponibles.
              </p>
            ) : (
              <div className={ACTIONS_SKILLS_SCROLL_CLASS}>
              <div className="grid gap-1 sm:gap-1.5">
                {combatConsumables.map((item) => {
                  const usable = canUseConsumable(item);
                  return (
                    <div key={item.inventoryId} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!usable}
                        onClick={() => void handleConsumableUse(item)}
                        className={`w-full rounded-md border px-1.5 py-0.5 text-left text-[11px] font-semibold leading-snug sm:px-2 sm:py-1 sm:text-xs ${
                          !usable
                            ? "cursor-not-allowed border-yellow-700/65 bg-yellow-950/35 text-yellow-100/90 opacity-70"
                            : "cursor-pointer border-yellow-600/70 bg-yellow-900/45 text-yellow-100 hover:bg-yellow-700/65"
                        }`}
                      >
                        {item.name}
                      </button>
                      <button
                        type="button"
                        onMouseEnter={(e) =>
                          openConsumableInfoTooltip(item.inventoryId, e.clientX, e.clientY, false)
                        }
                        onMouseMove={(e) =>
                          openConsumableInfoTooltip(item.inventoryId, e.clientX, e.clientY, false)
                        }
                        onMouseLeave={hideConsumableInfoTooltip}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleConsumableInfoTooltipPinned(item.inventoryId, e.clientX, e.clientY);
                        }}
                        className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-yellow-700/70 bg-yellow-950/55 text-[10px] font-black leading-none text-yellow-100 transition hover:bg-yellow-900/70"
                        aria-label={`Información de ${item.name}`}
                      >
                        ?
                      </button>
                      <span className={`${SKILL_COST_BADGE_BOX} rounded-md border border-yellow-700/65 bg-yellow-950/55 px-1 py-0.5 text-[10px] font-bold leading-none text-yellow-100 sm:text-[11px]`}>
                        x{item.quantity}
                      </span>
                    </div>
                  );
                })}
              </div>
              </div>
            )}
            </div>
          </div>

          <div className="rounded-xl border border-amber-800/70 bg-[#1a100c]/90 p-2 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-4">
            <p
              className={`${menuFont.className} text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90`}
            >
              Combat Log
            </p>
            <div
              ref={combatLogDesktopRef}
              className={`${helpCardFont.className} mt-2 min-h-20 max-h-20 space-y-1 overflow-y-auto pr-1 text-[10px] leading-relaxed text-amber-50/92 [scrollbar-color:rgba(217,119,6,0.75)_rgba(0,0,0,0.35)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-black/35 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-amber-800/60 [&::-webkit-scrollbar-thumb]:bg-amber-600/75 [&::-webkit-scrollbar-thumb:hover]:bg-amber-500/85 sm:mt-3 sm:min-h-28 sm:max-h-28 sm:text-[11px]`}
            >
              {combatLog.map((entry) => (
                <p
                  key={entry.id}
                  className={`rounded-md bg-black/25 px-2 py-1 ${
                    entry.tone === "success"
                      ? "text-emerald-300"
                      : entry.tone === "danger"
                        ? "text-red-300"
                        : ""
                  }`}
                >
                  <CombatLogLineBody entry={entry} />
                </p>
              ))}
            </div>
          </div>
        </section>
      </div>
      {skillInfoTooltip.open && skillTooltipEntry && skillTooltipStyles ? (
        <div
          className={`${helpCardFont.className} fixed z-[60] max-w-sm rounded-lg border px-3 py-2 pr-8 text-sm leading-relaxed ${skillTooltipStyles.tooltipPanel}`}
          style={{ left: skillInfoTooltip.x, top: skillInfoTooltip.y }}
        >
          <button
            type="button"
            onClick={() =>
              setSkillInfoTooltip({ open: false, x: 0, y: 0, pinned: false, skillId: null })
            }
            className={`absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border text-[10px] font-black leading-none transition ${skillTooltipStyles.tooltipCloseBtn}`}
            aria-label="Cerrar tooltip de habilidad"
          >
            X
          </button>
          <p
            className={`${menuFont.className} text-sm font-semibold leading-snug ${skillTooltipStyles.tooltipTitle}`}
          >
            {skillTooltipEntry.skill.name} ({skillTooltipEntry.skill.manaCost} MP) -{" "}
            {getPlayerSkillTooltipTargetKind(skillTooltipEntry.skill.effect)}
          </p>
          <div className={`my-1 h-px w-full ${skillTooltipStyles.tooltipDivider}`} aria-hidden />
          {(() => {
            const cdRem = playerSkillCooldownTurnsRemaining(skillTooltipEntry);
            const magicalBonusFlatTooltip = Math.max(
              0,
              Math.trunc(
                playerCombatMagicDamageMinBonus +
                  playerCombatMagicDamageMaxBonus +
                  timedBuffBonusByStat.magic_damage_min +
                  timedBuffBonusByStat.magic_damage_max,
              ),
            );
            const tooltipWeaponMin = Math.max(
              1,
              Math.floor(
                playerWeaponDamageMin +
                  playerCombatWeaponDamageMinBonus +
                  timedBuffBonusByStat.weapon_damage_min,
              ),
            );
            const tooltipWeaponMax = Math.max(
              tooltipWeaponMin,
              Math.floor(
                playerWeaponDamageMax +
                  playerCombatWeaponDamageMaxBonus +
                  timedBuffBonusByStat.weapon_damage_max,
              ),
            );
            const getStat = abilityTooltipStatGetterFromCombat({
              level: playerLevelCurrent,
              str: playerStatStr,
              dex: playerStatDex,
              int: playerStatInt,
              wis: playerStatWis,
              weaponDamageMinEffective: tooltipWeaponMin,
              weaponDamageMaxEffective: tooltipWeaponMax,
              magicDamageMinSheet: playerMagicDamageMin,
              magicDamageMaxSheet: playerMagicDamageMax,
              magicCombatMinBonus:
                playerCombatMagicDamageMinBonus + timedBuffBonusByStat.magic_damage_min,
              magicCombatMaxBonus:
                playerCombatMagicDamageMaxBonus + timedBuffBonusByStat.magic_damage_max,
            });
            const dmgRange = computePlayerSkillDamageRangeBeforeArmor(
              skillTooltipEntry.skill.effect,
              getStat,
              magicalBonusFlatTooltip,
              {
                weaponMin: tooltipWeaponMin,
                weaponMax: tooltipWeaponMax,
                magicMin: playerMagicDamageMin,
                magicMax: playerMagicDamageMax,
              },
            );
            const damageTypes = getEffectDamageTypes(skillTooltipEntry.skill.effect);
            const damageTypesLabel = damageTypes.join(", ");
            const skillDescRaw = getPlayerSkillTooltipDescription(skillTooltipEntry.skill);
            const descFormatted = formatAbilityTooltipStatExpressions(
              skillDescRaw
                .replaceAll("{damage_type}", damageTypesLabel)
                .replaceAll("{damage_types}", damageTypesLabel),
              getStat,
            );
            return (
              <>
                {dmgRange != null ? (
                  <div
                    className={`mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-snug ${skillTooltipStyles.tooltipBody}`}
                  >
                    <SkillDamageSwordIcon className="h-3.5 w-3.5 shrink-0 opacity-95" />
                    <span>
                      <span className="font-semibold">Daño</span>{" "}
                      <span className="font-semibold tabular-nums">
                        {formatAbilityTooltipTotalDamageRange(
                          dmgRange.min,
                          dmgRange.max,
                          0,
                        )}
                      </span>
                    </span>
                  </div>
                ) : null}
                {damageTypes.length > 0 ? (
                  <div
                    className={`mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-snug ${skillTooltipStyles.tooltipBody}`}
                  >
                    <span>
                      <span className="font-semibold">Tipo</span>{" "}
                      <span className="tabular-nums">{damageTypesLabel}</span>
                    </span>
                  </div>
                ) : null}
                <div
                  className={`mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-snug ${skillTooltipStyles.tooltipBody}`}
                >
                  <SkillCooldownClockIcon className="h-3.5 w-3.5 shrink-0 opacity-95" />
                  <span>
                    <span className="font-semibold">CD</span>{" "}
                    {skillTooltipEntry.skill.cooldownTurns} turno(s)
                    {cdRem > 0 ? (
                      <span className="opacity-95"> · Disponible en {cdRem}</span>
                    ) : null}
                  </span>
                </div>
                <div className={`my-2 h-px w-full ${skillTooltipStyles.tooltipDivider}`} aria-hidden />
                <p className={skillTooltipStyles.tooltipBody}>{descFormatted}</p>
              </>
            );
          })()}
        </div>
      ) : null}
      {consumableInfoTooltip.open && consumableTooltipEntry ? (
        <div
          className={`${helpCardFont.className} fixed z-[62] max-w-sm rounded-lg border border-yellow-700/80 bg-[#1b1408]/96 px-3 py-2 pr-8 text-sm leading-relaxed text-yellow-100 shadow-[0_12px_30px_rgba(0,0,0,0.55)]`}
          style={{ left: consumableInfoTooltip.x, top: consumableInfoTooltip.y }}
        >
          <button
            type="button"
            onClick={() =>
              setConsumableInfoTooltip({ open: false, x: 0, y: 0, pinned: false, inventoryId: null })
            }
            className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-yellow-600/85 bg-yellow-900/70 text-[10px] font-black leading-none text-yellow-100 transition hover:bg-yellow-800/80"
            aria-label="Cerrar tooltip de consumible"
          >
            X
          </button>
          <p className={`${menuFont.className} text-sm font-semibold leading-snug text-yellow-100`}>
            {consumableTooltipEntry.name}
          </p>
          <div className="my-1 h-px w-full bg-gradient-to-r from-transparent via-yellow-500/45 to-transparent" aria-hidden />
          <p className="text-xs text-yellow-100/95">
            {consumableTooltipEntry.description?.trim() || "Sin descripción."}
          </p>
        </div>
      ) : null}
      {attackHint.visible ? (
        <div
          className="pointer-events-none fixed z-[999] max-w-[240px] rounded-md border border-amber-700/80 bg-[#1a100c]/95 px-2 py-1 text-[11px] font-semibold text-amber-100 shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
          style={{
            left: attackHint.x + 12,
            top: attackHint.y + 12,
          }}
          role="status"
          aria-live="polite"
        >
          {attackBlockReason ?? "No podés atacar en este momento."}
        </div>
      ) : null}

      {playerCurrentHp <= 0 && isDefeatOverlayVisible ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4"
          role="presentation"
        >
          {!isDefeatPenaltyOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="combat-defeat-title"
              className="pointer-events-auto w-full max-w-xl"
            >
              <div
                className={`${menuFont.className} relative overflow-hidden rounded-xl border border-red-400/80 bg-gradient-to-b from-red-700/95 via-red-900/95 to-red-950/95 px-6 py-6 text-center shadow-[0_18px_50px_rgba(0,0,0,0.65),0_0_24px_rgba(239,68,68,0.22),inset_0_1px_0_rgba(254,226,226,0.25)]`}
              >
                <span
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(254,226,226,0.2),transparent_58%)]"
                  aria-hidden
                />
                <div className="relative mx-auto mb-2 h-px w-2/3 bg-gradient-to-r from-transparent via-red-200/65 to-transparent" />
                <p
                  id="combat-defeat-title"
                  className="relative text-3xl font-black uppercase tracking-[0.2em] text-red-50 drop-shadow-[0_0_12px_rgba(254,202,202,0.55)] sm:text-4xl"
                >
                  DERROTA
                </p>
                <p className="relative mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-red-100/90">
                  Momento de recobrar fuerzas
                </p>
                <div className="relative mx-auto mt-3 h-px w-2/3 bg-gradient-to-r from-transparent via-red-200/65 to-transparent" />
              </div>
              <button
                type="button"
                onClick={() => setIsDefeatPenaltyOpen(true)}
                className={`${menuFont.className} mx-auto mt-5 block w-full max-w-sm cursor-pointer rounded-md border border-red-600/90 bg-red-800/90 px-5 py-2.5 text-center text-sm font-semibold uppercase tracking-[0.12em] text-red-50 shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition hover:bg-red-700/95 sm:mt-6`}
              >
                Continuar
              </button>
            </div>
          ) : (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="combat-defeat-loss-title"
              className="pointer-events-auto w-full max-w-xl"
            >
              <div
                className={`${menuFont.className} rounded-xl border border-red-500/80 bg-[#2a120f]/95 p-5 shadow-[0_14px_50px_rgba(0,0,0,0.6)] sm:p-6`}
              >
                <p
                  id="combat-defeat-loss-title"
                  className="text-center text-base font-black uppercase tracking-[0.16em] text-red-100"
                >
                  Lograste salir corriendo, pero te olvidaste esto:
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {defeatLostItems.map((lost) => (
                    <div
                      key={`${lost.inventoryId}-${lost.name}`}
                      className="rounded-md border border-red-600/70 bg-red-950/35 p-2 text-center"
                    >
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-red-500/60 bg-red-950/45">
                        {lost.iconPath ? (
                          <Image
                            src={lost.iconPath}
                            alt={lost.name}
                            width={32}
                            height={32}
                            className="h-8 w-8 object-contain"
                          />
                        ) : (
                          <span className="text-[10px] font-black text-red-100">?</span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[10px] font-semibold uppercase text-red-100/95">
                        {lost.name}
                      </p>
                      <p className="text-xs font-black text-red-200">x{lost.quantityLost}</p>
                    </div>
                  ))}
                  {defeatLostItems.length === 0 ? (
                    <p className="col-span-2 text-center text-xs font-semibold text-red-100/80">
                      No había ítems válidos para perder.
                    </p>
                  ) : null}
                </div>
              </div>
              <Link
                href="/"
                className={`${menuFont.className} mx-auto mt-5 block w-full max-w-sm cursor-pointer rounded-md border border-red-600/90 bg-red-800/90 px-5 py-2.5 text-center text-sm font-semibold uppercase tracking-[0.12em] text-red-50 shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition hover:bg-red-700/95 sm:mt-6`}
              >
                Volver al Campamento
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {playerCurrentHp > 0 && isVictoryOverlayVisible ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4"
          role="presentation"
        >
          {!isVictoryLootOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="combat-victory-title"
              className="pointer-events-auto w-full max-w-xl"
            >
              <div
                className={`${menuFont.className} relative overflow-hidden rounded-xl border border-emerald-400/85 bg-gradient-to-b from-emerald-700/95 via-emerald-850/95 to-emerald-950/95 px-6 py-6 text-center shadow-[0_18px_50px_rgba(0,0,0,0.6),0_0_24px_rgba(16,185,129,0.28),inset_0_1px_0_rgba(209,250,229,0.35)]`}
              >
                <span
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(209,250,229,0.28),transparent_58%)]"
                  aria-hidden
                />
                <div className="relative mx-auto mb-2 h-px w-2/3 bg-gradient-to-r from-transparent via-emerald-200/70 to-transparent" />
                <p
                  id="combat-victory-title"
                  className="relative text-3xl font-black uppercase tracking-[0.2em] text-emerald-50 drop-shadow-[0_0_12px_rgba(167,243,208,0.6)] sm:text-4xl"
                >
                  VICTORIA
                </p>
                <p className="relative mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/90">
                  El enemigo ha sido derrotado
                </p>
                <div className="relative mx-auto mt-3 h-px w-2/3 bg-gradient-to-r from-transparent via-emerald-200/70 to-transparent" />
              </div>
              <button
                type="button"
                onClick={() => setIsVictoryLootOpen(true)}
                className={`${menuFont.className} mx-auto mt-5 block w-full max-w-sm cursor-pointer rounded-md border border-emerald-600/90 bg-emerald-800/90 px-5 py-2.5 text-center text-sm font-semibold uppercase tracking-[0.12em] text-emerald-50 shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition hover:bg-emerald-700/95 sm:mt-6`}
              >
                Continuar
              </button>
            </div>
          ) : (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="combat-rewards-title"
              className="pointer-events-auto w-full max-w-xl"
            >
              <div
                className={`${menuFont.className} rounded-xl border border-amber-700/70 bg-[#1c120e]/95 p-5 shadow-[0_14px_50px_rgba(0,0,0,0.55)] sm:p-6`}
              >
                <p
                  id="combat-rewards-title"
                  className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/95"
                >
                  Recompensas del combate
                </p>
                <div className="mt-3 rounded-lg border border-amber-700/55 bg-black/20 p-3">
                  <div className="mx-auto mt-2 flex max-w-full flex-wrap items-start justify-center gap-2 gap-y-3">
                    <div className="w-full max-w-[7rem] rounded-md border border-violet-600/60 bg-violet-900/20 p-2 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-violet-500/70 bg-violet-950/40">
                        <Image
                          src="/img/resources/iconos/icon_xp.png"
                          alt="Experiencia"
                          width={32}
                          height={32}
                          className="h-8 w-8 object-contain"
                        />
                      </div>
                      <p className="mt-1 truncate text-[10px] font-semibold uppercase text-emerald-100/90">
                        Experiencia
                      </p>
                      <p className="text-xs font-black text-emerald-100">+{victoryTotalXp}</p>
                    </div>
                    {victoryLootItems.map((loot) => {
                      const rarityBorderStyle =
                        typeof loot.rarityColor === "string" && loot.rarityColor.trim().length > 0
                          ? { borderColor: loot.rarityColor.trim() }
                          : undefined;
                      return (
                      <div
                        key={loot.lootKey}
                        className="group relative w-full max-w-[7rem] rounded-md border border-amber-700/55 bg-amber-900/20 p-2 text-center"
                        style={rarityBorderStyle}
                      >
                        <button
                          type="button"
                          className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-amber-600/60 bg-amber-950/40 transition hover:bg-amber-900/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                          style={rarityBorderStyle}
                          aria-label={`Ver detalles de ${loot.name}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setVictoryLootTooltip((prev) =>
                              prev.open && prev.lootKey === loot.lootKey
                                ? { open: false, lootKey: null }
                                : { open: true, lootKey: loot.lootKey },
                            );
                          }}
                        >
                          {loot.iconPath ? (
                            <Image
                              src={loot.iconPath}
                              alt={loot.name}
                              width={32}
                              height={32}
                              className="h-8 w-8 object-contain"
                            />
                          ) : (
                            <span className="text-[10px] font-black text-amber-100">?</span>
                          )}
                        </button>
                        <p className="mt-1 truncate text-[10px] font-semibold uppercase text-amber-100/90" title={loot.name}>
                          {loot.name}
                        </p>
                        <p className="text-xs font-black text-amber-100">x{loot.quantity}</p>
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border border-amber-700/75 bg-[#1c120e]/95 px-3 py-2 text-left text-sm text-amber-100 shadow-[0_12px_30px_rgba(0,0,0,0.55)] sm:group-hover:block">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`${menuFont.className} text-sm font-bold leading-tight text-amber-200`}>
                              {loot.name}
                            </p>
                            {loot.itemTypeId !== 2 ? (
                              <div className="flex items-center gap-1 text-xs font-semibold text-amber-200">
                                <Image
                                  src="/img/resources/iconos/icon_gold.png"
                                  alt="Oro"
                                  width={12}
                                  height={12}
                                  className="h-3 w-3 object-contain"
                                />
                                <span>{loot.sellValue}</span>
                              </div>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[10px] uppercase text-amber-200/80">
                            {capitalizeFirst(loot.itemTypeCode ?? "item")}
                          </p>
                          {loot.description ? (
                            <p className={`${helpCardFont.className} mt-1 text-[11px] italic leading-relaxed text-amber-50/90`}>
                              {loot.description}
                            </p>
                          ) : null}
                          {loot.quoteText ? (
                            <p
                              className={`${helpCardFont.className} mt-1 text-[10px] italic leading-relaxed text-amber-200/85`}
                              style={{ fontStyle: "italic" }}
                            >
                              - <em>"{loot.quoteText}"</em>
                            </p>
                          ) : null}
                          {(() => {
                            const roll = loot.weaponInstance ?? loot.equipmentInstance ?? null;
                            if (!roll) return null;
                            const showDamage = Boolean(loot.weaponInstance);
                            const statLineEntries = (
                              [
                                [roll.statKey1, formatInstanceStatRollTooltipLine(roll.statKey1, roll.valueFlat1, roll.valuePct1)],
                                [roll.statKey2, formatInstanceStatRollTooltipLine(roll.statKey2, roll.valueFlat2, roll.valuePct2)],
                                [roll.statKey3, formatInstanceStatRollTooltipLine(roll.statKey3, roll.valueFlat3, roll.valuePct3)],
                                [roll.statKey4, formatInstanceStatRollTooltipLine(roll.statKey4, roll.valueFlat4, roll.valuePct4)],
                                [roll.statKey5, formatInstanceStatRollTooltipLine(roll.statKey5, roll.valueFlat5, roll.valuePct5)],
                              ] as const
                            ).filter((entry): entry is [typeof roll.statKey1, string] => Boolean(entry[1]));
                            return (
                              <div className="mt-1.5 border-t border-amber-700/50 pt-1 text-[11px] leading-tight text-amber-100">
                                {roll.rarity ? (
                                  <p className="font-semibold" style={{ color: roll.rarityColor ?? undefined }}>
                                    {roll.rarity}
                                  </p>
                                ) : null}
                                {showDamage ? (
                                  <>
                                    <p>
                                      <WeaponPhysicalDamageTooltipLine
                                        damageRangeText={weaponDamageRange(
                                          loot.weaponInstance?.attackDamageMin,
                                          loot.weaponInstance?.attackDamageMax,
                                        )}
                                        attackFamily={loot.weaponInstance?.attackFamily}
                                      />
                                    </p>
                                    <p>
                                      {weaponDamageRange(
                                        loot.weaponInstance?.magicDamageMin,
                                        loot.weaponInstance?.magicDamageMax,
                                      )}{" "}
                                      Daño Mágico
                                    </p>
                                  </>
                                ) : null}
                                {statLineEntries.map(([statKey, line], idx) => (
                                  <p
                                    key={`${line}-${idx}`}
                                    className={isInstanceStatWeakTooltipKey(statKey) ? "font-medium text-red-400" : undefined}
                                  >
                                    {line}
                                  </p>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )})}
                    {victoryLootItems.length === 0 ? (
                      <p className="w-full text-center text-xs font-semibold text-amber-100/80">
                        No obtuviste ítems en este combate.
                      </p>
                    ) : null}
                  </div>
                </div>

                {victoryLootTooltip.open ? (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-[210] cursor-default bg-transparent"
                      aria-label="Cerrar tooltip de loot"
                      onClick={() => setVictoryLootTooltip({ open: false, lootKey: null })}
                    />
                    {(() => {
                      const entry =
                        victoryLootTooltip.lootKey == null
                          ? null
                          : victoryLootItems.find((l) => l.lootKey === victoryLootTooltip.lootKey) ?? null;
                      if (!entry) return null;
                      const rarityBorderStyle =
                        typeof entry.rarityColor === "string" && entry.rarityColor.trim().length > 0
                          ? { borderColor: entry.rarityColor.trim() }
                          : undefined;
                      return (
                        <div
                          className="fixed left-1/2 top-24 z-[220] w-[min(92vw,26rem)] -translate-x-1/2 rounded-lg border border-amber-700/75 bg-[#1c120e]/95 px-3 py-2 text-left text-sm text-amber-100 shadow-[0_12px_30px_rgba(0,0,0,0.65)]"
                          style={rarityBorderStyle}
                          role="dialog"
                          aria-modal="true"
                          aria-label={`Detalles de ${entry.name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-amber-600/80 bg-amber-950/60 text-[10px] font-black text-amber-100 transition hover:bg-amber-900/75"
                            aria-label="Cerrar"
                            onClick={() => setVictoryLootTooltip({ open: false, lootKey: null })}
                          >
                            X
                          </button>
                          <div className="flex items-start justify-between gap-2 pr-7">
                            <p className={`${menuFont.className} text-sm font-bold leading-tight text-amber-200`}>
                              {entry.name}
                            </p>
                            {entry.itemTypeId !== 2 ? (
                              <div className="flex items-center gap-1 text-xs font-semibold text-amber-200">
                                <Image
                                  src="/img/resources/iconos/icon_gold.png"
                                  alt="Oro"
                                  width={12}
                                  height={12}
                                  className="h-3 w-3 object-contain"
                                />
                                <span>{entry.sellValue}</span>
                              </div>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[10px] uppercase text-amber-200/80">
                            {capitalizeFirst(entry.itemTypeCode ?? "item")}
                          </p>
                          {entry.description ? (
                            <p className={`${helpCardFont.className} mt-1 text-[11px] italic leading-relaxed text-amber-50/90`}>
                              {entry.description}
                            </p>
                          ) : null}
                          {entry.quoteText ? (
                            <p
                              className={`${helpCardFont.className} mt-1 text-[10px] italic leading-relaxed text-amber-200/85`}
                              style={{ fontStyle: "italic" }}
                            >
                              - <em>"{entry.quoteText}"</em>
                            </p>
                          ) : null}
                          {(() => {
                            const roll = entry.weaponInstance ?? entry.equipmentInstance ?? null;
                            if (!roll) return null;
                            const showDamage = Boolean(entry.weaponInstance);
                            const statLineEntries = (
                              [
                                [roll.statKey1, formatInstanceStatRollTooltipLine(roll.statKey1, roll.valueFlat1, roll.valuePct1)],
                                [roll.statKey2, formatInstanceStatRollTooltipLine(roll.statKey2, roll.valueFlat2, roll.valuePct2)],
                                [roll.statKey3, formatInstanceStatRollTooltipLine(roll.statKey3, roll.valueFlat3, roll.valuePct3)],
                                [roll.statKey4, formatInstanceStatRollTooltipLine(roll.statKey4, roll.valueFlat4, roll.valuePct4)],
                                [roll.statKey5, formatInstanceStatRollTooltipLine(roll.statKey5, roll.valueFlat5, roll.valuePct5)],
                              ] as const
                            ).filter((entry): entry is [typeof roll.statKey1, string] => Boolean(entry[1]));
                            return (
                              <div className="mt-1.5 border-t border-amber-700/50 pt-1 text-[11px] leading-tight text-amber-100">
                                {roll.rarity ? (
                                  <p className="font-semibold" style={{ color: roll.rarityColor ?? undefined }}>
                                    {roll.rarity}
                                  </p>
                                ) : null}
                                {showDamage ? (
                                  <>
                                    <p>
                                      <WeaponPhysicalDamageTooltipLine
                                        damageRangeText={weaponDamageRange(
                                          entry.weaponInstance?.attackDamageMin,
                                          entry.weaponInstance?.attackDamageMax,
                                        )}
                                        attackFamily={entry.weaponInstance?.attackFamily}
                                      />
                                    </p>
                                    <p>
                                      {weaponDamageRange(
                                        entry.weaponInstance?.magicDamageMin,
                                        entry.weaponInstance?.magicDamageMax,
                                      )}{" "}
                                      Daño Mágico
                                    </p>
                                  </>
                                ) : null}
                                {statLineEntries.map(([statKey, line], idx) => (
                                  <p
                                    key={`${line}-${idx}`}
                                    className={isInstanceStatWeakTooltipKey(statKey) ? "font-medium text-red-400" : undefined}
                                  >
                                    {line}
                                  </p>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </>
                ) : null}
              </div>
              <Link
                href={escapeHref}
                className={`${menuFont.className} mx-auto mt-5 block w-full max-w-sm cursor-pointer rounded-md border border-amber-600/90 bg-amber-800/90 px-5 py-2.5 text-center text-sm font-semibold uppercase tracking-[0.12em] text-amber-50 shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition hover:bg-amber-700/95 sm:mt-6`}
              >
                Volver al mapa
              </Link>
            </div>
          )}
          {isLevelUpModalOpen ? (
            <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/70 p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="combat-levelup-title"
                className="pointer-events-auto w-full max-w-md"
              >
                <div
                  className={`${menuFont.className} rounded-xl border border-violet-400/85 bg-gradient-to-b from-violet-700/95 via-violet-900/95 to-violet-950/95 px-6 py-6 text-center shadow-[0_18px_50px_rgba(0,0,0,0.6),0_0_24px_rgba(139,92,246,0.28),inset_0_1px_0_rgba(237,233,254,0.25)]`}
                >
                  <p
                    id="combat-levelup-title"
                    className="text-1xl font-black uppercase tracking-[0.18em] text-violet-50 sm:text-2xl"
                  >
                    Has subido a nivel <span className="text-amber-300">{levelAfterVictorySafe}</span>
                  </p>
                  <p className="mt-3 text-xs font-semibold text-violet-100/90">
                    Podés asignar tus puntos de característica en la página de perfil de tu personaje
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsLevelUpModalOpen(false)}
                    className="mx-auto mt-5 block w-full max-w-xs rounded-md border border-violet-300/80 bg-violet-800/80 px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-violet-50 transition hover:bg-violet-700/90"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
