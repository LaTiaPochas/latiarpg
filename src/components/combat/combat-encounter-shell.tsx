"use client";

import Image from "next/image";
import Link from "next/link";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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

function getPlayerSkillEffectSubtype(effect: Record<string, unknown>): PlayerSkillEffectSubtype {
  const raw = effect.subtype;
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "physical") return "physical";
  if (s === "magical") return "magical";
  if (s === "buff") return "buff";
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
): string {
  const s = String(Math.max(0, Math.trunc(damageDealt)));
  const enemyLabel =
    typeof enemyHitName === "string" && enemyHitName.trim().length > 0 ? enemyHitName.trim() : "";
  return template
    .replaceAll("{daño}", s)
    .replaceAll("{dano}", s)
    .replaceAll("{damage}", s)
    .replaceAll("{enemigo}", enemyLabel);
}

/** Placeholders de daño en `enemy_skills` / descripción de log (enemigo → PJ). */
function enemySkillCombatLogHadDamagePlaceholder(template: string): boolean {
  return (
    template.includes("{daño}") ||
    template.includes("{dano}") ||
    template.includes("{damage}")
  );
}

function formatEnemySkillCombatLogDescription(template: string, damageDealt: number): string {
  const s = String(Math.max(0, Math.trunc(damageDealt)));
  return template.replaceAll("{daño}", s).replaceAll("{dano}", s).replaceAll("{damage}", s);
}

function rollDamageFromPlayerSkillEffect(
  effect: Record<string, unknown>,
  getCombatStatValue: (statKeyUpper: string) => number,
): number {
  const minV = Math.max(0, coerceEffectNumber(effect.min, 0));
  const maxV = Math.max(minV, coerceEffectNumber(effect.max, minV));
  let total = randomIntInclusive(minV, maxV);
  const scalingRaw = effect.scaling;
  if (scalingRaw !== null && typeof scalingRaw === "object" && !Array.isArray(scalingRaw)) {
    const scaling = scalingRaw as Record<string, unknown>;
    const statLabel = typeof scaling.stat === "string" ? scaling.stat.trim().toUpperCase() : "";
    const ratioParsed =
      typeof scaling.ratio === "number"
        ? scaling.ratio
        : typeof scaling.ratio === "string"
          ? Number(scaling.ratio)
          : Number.NaN;
    if (statLabel !== "" && Number.isFinite(ratioParsed)) {
      total += Math.floor(Math.max(0, getCombatStatValue(statLabel)) * ratioParsed);
    }
  }
  return Math.max(0, total);
}

/**
 * Rango teórico de daño con escalado de stats (min/max del efecto + bonus fijo).
 * No resta armadura ni MR del enemigo (solo lo que aplica en el tiro antes de mitigar).
 */
function computePlayerSkillDamageRangeBeforeArmor(
  effect: Record<string, unknown>,
  getCombatStatValue: (statKeyUpper: string) => number,
): { min: number; max: number } | null {
  const typeRaw = typeof effect.type === "string" ? effect.type.trim().toLowerCase() : "";
  if (typeRaw !== "damage") return null;
  const minV = Math.max(0, coerceEffectNumber(effect.min, 0));
  const maxV = Math.max(minV, coerceEffectNumber(effect.max, minV));
  let bonus = 0;
  const scalingRaw = effect.scaling;
  if (scalingRaw !== null && typeof scalingRaw === "object" && !Array.isArray(scalingRaw)) {
    const scaling = scalingRaw as Record<string, unknown>;
    const statLabel = typeof scaling.stat === "string" ? scaling.stat.trim().toUpperCase() : "";
    const ratioParsed =
      typeof scaling.ratio === "number"
        ? scaling.ratio
        : typeof scaling.ratio === "string"
          ? Number(scaling.ratio)
          : Number.NaN;
    if (statLabel !== "" && Number.isFinite(ratioParsed)) {
      bonus = Math.floor(Math.max(0, getCombatStatValue(statLabel)) * ratioParsed);
    }
  }
  return {
    min: Math.max(0, minV + bonus),
    max: Math.max(0, maxV + bonus),
  };
}

/** Daño bruto menos armadura/MR (resultado no negativo). */
function mitigateDamageByDefense(rawDamage: number, defense: number): number {
  const raw = Math.max(0, Math.trunc(rawDamage));
  const def = Math.max(0, Math.trunc(defense));
  return Math.max(0, raw - def);
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
  spawnIndex: number;
  name: string;
  portraitSrc: string | null;
  spriteSrc: string | null;
  /** Ajustes visuales opcionales del sprite en el escenario. */
  spriteOffsetX: number;
  spriteOffsetY: number;
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
  rawRows: Array<{
    index: number;
    spawn_index: number | null;
    hp_override: number | null;
    mana_override: number | null;
    ai_profile: string | null;
    enemyTemplate: Record<string, unknown> | null;
  }>;
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
  playerStatStr?: number;
  playerStatDex?: number;
  playerStatInt?: number;
  playerStatWis?: number;
  playerArmor?: number;
  playerMr?: number;
  /** Skills aprendidos del PJ (`user_character_skills` + `player_skills`). */
  playerSkills?: CombatPlayerSkillView[];
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

function PlayerStatusModal({
  displayName,
  portraitSrc,
  hp,
  hpMax,
  mana,
  manaMax,
  hpPercent,
  manaPercent,
}: {
  displayName: string;
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
      className={`${menuFont.className} w-[min(100%,11.5rem)] shrink-0 rounded-xl border border-amber-600/50 bg-[#1a100c]/92 p-2 shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:w-52 sm:p-2.5`}
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
          <p className="w-full truncate text-center text-[10px] font-semibold leading-tight text-emerald-50 sm:text-[11px]">
            {displayName}
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
}: {
  enemy: CombatEncounterEnemyView;
  isSelected: boolean;
  onSelect: () => void;
  isDefeated: boolean;
}) {
  const pct = enemyHpPercent(enemy);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isDefeated}
      className={`${menuFont.className} w-[min(100%,11.5rem)] shrink-0 rounded-xl border bg-[#1a100c]/92 p-2 text-left shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-sm transition sm:w-52 sm:p-2.5 ${
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
      <div className="flex items-center gap-2.5">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-amber-800/55 bg-black/45 sm:h-[3.25rem] sm:w-[3.25rem]">
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
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold leading-tight text-amber-100 sm:text-xs">
            {enemy.name}
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
  playerStatStr = 0,
  playerStatDex = 0,
  playerStatInt = 0,
  playerStatWis = 0,
  playerArmor = 0,
  playerMr = 0,
  playerSkills = [],
  escapeHref = "/",
}: CombatEncounterShellProps) {
  const backgroundResolved = backgroundSrc?.trim() || BG_INTRO_FOREST;
  /** Copia en memoria del combate para uso al activar habilidades del PJ. */
  const playerCombatSkills = useMemo(() => [...playerSkills], [playerSkills]);
  const playerCombatSkillsRef = useRef(playerCombatSkills);
  useEffect(() => {
    playerCombatSkillsRef.current = playerCombatSkills;
  }, [playerCombatSkills]);

  const initialEnemies = useMemo(
    () => enemies.slice(0, MAX_ENEMIES_ON_FIELD),
    [enemies],
  );
  const [displayEnemies, setDisplayEnemies] = useState<CombatEncounterEnemyView[]>(initialEnemies);
  useEffect(() => {
    setDisplayEnemies(initialEnemies);
  }, [initialEnemies]);
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  useEffect(() => {
    setSelectedEnemyId((prev) => {
      if (prev && initialEnemies.some((enemy) => enemy.id === prev)) return prev;
      return null;
    });
  }, [initialEnemies]);
  /** Si el objetivo seleccionado muere (p. ej. área), limpiar para poder elegir otro sin estado colgado. */
  useEffect(() => {
    if (!selectedEnemyId) return;
    const sel = displayEnemies.find((e) => e.id === selectedEnemyId);
    if (!sel || sel.hp <= 0) setSelectedEnemyId(null);
  }, [displayEnemies, selectedEnemyId]);
  const enemyCount = displayEnemies.length;
  const spriteClass = enemySpriteHeightClass(enemyCount);

  const [isActionsPanelOpen, setIsActionsPanelOpen] = useState(false);
  const [isCombatLogPanelOpen, setIsCombatLogPanelOpen] = useState(false);
  const [actionMenu, setActionMenu] = useState<"main" | "skills">("main");
  const [isTurnTransitioning, setIsTurnTransitioning] = useState(true);
  const combatLogMobileRef = useRef<HTMLDivElement | null>(null);
  const combatLogDesktopRef = useRef<HTMLDivElement | null>(null);
  const combatLogIdRef = useRef(0);
  const advanceTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialActionDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defeatModalDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [isDefeatOverlayVisible, setIsDefeatOverlayVisible] = useState(false);

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
    setIsDefeatOverlayVisible(false);
    if (defeatModalDelayRef.current) {
      clearTimeout(defeatModalDelayRef.current);
      defeatModalDelayRef.current = null;
    }
  }, [encounterCode]);

  useEffect(() => {
    if (playerCurrentHp > 0) {
      setIsDefeatOverlayVisible(false);
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
    setDisplayPlayerMana(Math.min(Math.max(0, playerMana), Math.max(0, playerManaMax)));
  }, [playerMana, playerManaMax]);
  useEffect(() => {
    setEnemySkillNextAvailableTurn({});
  }, [initialEnemies]);
  useEffect(() => {
    setPlayerSkillNextAvailableTurn({});
  }, [initialEnemies]);
  const turnOrder = useMemo<TurnActor[]>(() => {
    const actors: TurnActor[] = [
      { id: "player", type: "player", speed: Math.max(0, Math.trunc(playerSpeed)) },
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
  }, [displayEnemies, playerSpeed]);
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

  const portraitResolved =
    typeof playerPortraitSrc === "string" && playerPortraitSrc.trim().length > 0
      ? playerPortraitSrc.trim()
      : null;
  const selectedEnemy =
    (selectedEnemyId ? displayEnemies.find((enemy) => enemy.id === selectedEnemyId) : null) ??
    null;
  const isPlayerTurn = currentActor?.type === "player";
  const canAttack =
    isPlayerTurn &&
    !isTurnTransitioning &&
    selectedEnemy != null &&
    selectedEnemy.hp > 0 &&
    playerCurrentHp > 0;

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

  const isPlayerActionsLocked = !isPlayerTurn || isTurnTransitioning || playerCurrentHp <= 0;

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

  /** Elige una habilidad (efectos de combate: próximo paso). */
  function handlePlayerSkillChosen(skillEntry: CombatPlayerSkillView) {
    if (!canUsePlayerSkill(skillEntry)) return;

    const effect = skillEntry.skill.effect;
    const effectTypeRaw = typeof effect.type === "string" ? effect.type.trim().toLowerCase() : "";

    const getCombatStatValue = (key: string): number => {
      switch (key.toUpperCase()) {
        case "STR":
          return Math.max(0, Math.floor(playerStatStr));
        case "DEX":
          return Math.max(0, Math.floor(playerStatDex));
        case "INT":
          return Math.max(0, Math.floor(playerStatInt));
        case "WIS":
          return Math.max(0, Math.floor(playerStatWis));
        default:
          return 0;
      }
    };

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
          ? formatPlayerSkillCombatLogDescription(descTemplate, damageDealtForHighlight, enemyHitName)
          : damageDealtForHighlight > 0
            ? `Usás ${skillEntry.skill.name} e infligís ${damageDealtForHighlight} de daño.`
            : `Usás ${skillEntry.skill.name}.`;
      appendCombatLog(
        text,
        "default",
        damageDealtForHighlight > 0 ? damageDealtForHighlight : undefined,
      );
    };

    if (effectTypeRaw !== "damage") {
      appendSpellLog(0);
      scheduleAdvanceTurn();
      return;
    }

    const needsSingleEnemy = playerSkillRequiresSingleEnemySelection(skillEntry);
    const isArea = playerSkillDamageHitsAllEnemies(effect);

    if (needsSingleEnemy && !isArea) {
      const target = selectedEnemy;
      if (!target || target.hp <= 0) return;

      const subtype = getPlayerSkillEffectSubtype(effect);
      const defenseStat = enemyDefenseStatForPlayerSkill(subtype, target);
      const rawDamage = rollDamageFromPlayerSkillEffect(effect, getCombatStatValue);
      const mitigated = mitigateDamageByDefense(rawDamage, defenseStat);
      const damageDone = Math.min(mitigated, target.hp);
      const updatedHp = target.hp - damageDone;

      setDisplayEnemies((prev) =>
        prev.map((enemy) =>
          enemy.id === target.id ? { ...enemy, hp: updatedHp } : enemy,
        ),
      );
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

    const skillSubtype = getPlayerSkillEffectSubtype(effect);

    for (const enemy of displayEnemies) {
      if (enemy.hp <= 0) continue;
      const defenseStat = enemyDefenseStatForPlayerSkill(skillSubtype, enemy);
      const rawDamage = rollDamageFromPlayerSkillEffect(effect, getCombatStatValue);
      const mitigated = mitigateDamageByDefense(rawDamage, defenseStat);
      const damageDone = Math.min(mitigated, enemy.hp);
      const hpNext = enemy.hp - damageDone;
      if (enemy.id === selectedEnemyId && hpNext <= 0) clearedSelection = true;
      const text =
        descTemplate != null
          ? formatPlayerSkillCombatLogDescription(descTemplate, damageDone, enemy.name)
          : `Usás ${skillEntry.skill.name} e infligís ${damageDone} de daño a ${enemy.name}.`;
      combatRows.push({ enemyId: enemy.id, hpNext, text, dmg: damageDone });
    }

    setDisplayEnemies((prev) =>
      prev.map((enemy) => {
        const hit = combatRows.find((row) => row.enemyId === enemy.id);
        return hit ? { ...enemy, hp: hit.hpNext } : enemy;
      }),
    );
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

  const skillTooltipStyles =
    skillTooltipEntry != null
      ? getPlayerSkillSubtypeStyles(getPlayerSkillEffectSubtype(skillTooltipEntry.skill.effect))
      : null;

  function advanceTurn() {
    if (turnOrder.length === 0) return;
    setCurrentTurnIndex((prev) => (prev + 1) % turnOrder.length);
  }

  function scheduleAdvanceTurn() {
    if (advanceTurnTimeoutRef.current) {
      clearTimeout(advanceTurnTimeoutRef.current);
    }
    setIsTurnTransitioning(true);
    advanceTurnTimeoutRef.current = setTimeout(() => {
      advanceTurn();
      setIsTurnTransitioning(false);
      advanceTurnTimeoutRef.current = null;
    }, ACTION_DELAY_MS);
  }

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

    const damageMin = Math.max(1, Math.floor(playerWeaponDamageMin));
    const damageMax = Math.max(damageMin, Math.floor(playerWeaponDamageMax));
    const rawDamage = randomIntInclusive(damageMin, damageMax);
    const mitigated = mitigateDamageByDefense(rawDamage, target.armor);
    const updatedHp = Math.max(0, target.hp - mitigated);
    const damageDone = target.hp - updatedHp;
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
    const defenseStat = playerDefenseStatVsIncoming(incomingSubtype, playerArmor, playerMr);
    const damage = mitigateDamageByDefense(rawDamage, defenseStat);
    const nextPlayerHp = Math.max(0, playerCurrentHp - damage);
    setPlayerCurrentHp(nextPlayerHp);
    if (skill) {
      const descRaw = skill.description?.trim();
      const fallback = `${enemy.name} usa ${skill.name}.`;
      const template = descRaw && descRaw.length > 0 ? descRaw : fallback;
      const hadDamagePh = enemySkillCombatLogHadDamagePlaceholder(template);
      const logText = hadDamagePh ? formatEnemySkillCombatLogDescription(template, damage) : template;
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
    currentActor,
    effectiveTurnIndex,
    displayEnemies,
    isTurnTransitioning,
    playerArmor,
    playerCurrentHp,
    playerMr,
    turn,
  ]);

  return (
    <div
      className={`${menuFont.className} relative h-[calc(100dvh-3.5rem)] w-full overflow-hidden bg-[#120b08] text-amber-50 sm:min-h-[calc(100dvh-3.5rem)] sm:h-auto`}
    >
      <div className="absolute inset-0">
        <BattleBackground src={backgroundResolved} />
      </div>
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col p-2 sm:min-h-[calc(100dvh-3.5rem)] sm:p-6">
        {combatDebug ? (
          <details className="mb-2 rounded-lg border border-amber-600/50 bg-black/75 p-2 text-left text-[11px] text-amber-100/95 shadow-lg backdrop-blur-sm">
            <summary className="cursor-pointer select-none font-semibold text-amber-300">
              Debug combate (?debug=1)
            </summary>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-emerald-100/90">
              {JSON.stringify(combatDebug, null, 2)}
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
              className="shrink-0 rounded-full border border-red-700/60 bg-red-900/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90 transition hover:border-red-700/70 hover:bg-red-900/45 hover:text-amber-50 sm:px-3"
            >
              Escapar
            </Link>
          </div>
        </header>

        <main className="relative mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-amber-900/70 bg-black/15 p-2 shadow-[inset_0_-30px_60px_rgba(0,0,0,0.5)] sm:mt-2 sm:p-6">
          {/* HUD: enemigos arriba a la derecha, PJ abajo a la izquierda (sobre el escenario) */}
          <div className="pointer-events-none absolute inset-0 z-[8] flex flex-col justify-between p-1 sm:p-2">
            <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
              {displayEnemies.length > 0
                ? displayEnemies.map((enemy) => (
                    <EnemyStatusModal
                      key={enemy.id}
                      enemy={enemy}
                      isSelected={enemy.id === selectedEnemyId && enemy.hp > 0}
                      onSelect={() => setSelectedEnemyId(enemy.id)}
                      isDefeated={enemy.hp <= 0}
                    />
                  ))
                : null}
            </div>
            <div className="pointer-events-auto flex w-full justify-start">
              <PlayerStatusModal
                displayName={playerDisplayName}
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

          <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-row items-end justify-between">
            <div className="intro-character-slide-in pointer-events-none flex w-[42%] translate-y-3 items-end justify-start sm:translate-y-0">
              <Image
                src={playerSpriteSrc}
                alt={`${playerDisplayName} en combate`}
                width={620}
                height={930}
                className="h-[min(32vh,200px)] w-auto object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.6)] sm:h-[min(52vh,360px)]"
              />
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
                          transform: `translate(${enemy.spriteOffsetX}px, ${enemy.spriteOffsetY}px) scale(${enemy.spriteScale})`,
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

        <section className="mt-2 grid min-h-0 flex-none grid-cols-1 gap-2 pb-0 sm:hidden">
          <div className="relative">
            {!isActionsPanelOpen && (
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

            {isActionsPanelOpen && (
              <div
                className={`${menuFont.className} absolute bottom-full left-0 z-20 mb-2 w-full rounded-xl border border-amber-800/70 bg-[#1a100c]/95 p-2 shadow-[0_14px_32px_rgba(0,0,0,0.5)] backdrop-blur-sm`}
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
                  {actionMenu === "skills" && (
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

                <div className={ACTIONS_PANEL_BODY_MOBILE}>
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
                      disabled
                      className="w-full cursor-not-allowed rounded-md border border-slate-500/70 bg-slate-700/45 px-2 py-1 text-left text-xs font-semibold text-slate-200/75 opacity-60"
                      aria-disabled="true"
                    >
                      Inventario
                    </button>
                  </div>
                ) : playerCombatSkills.length === 0 ? (
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
                )}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            {!isCombatLogPanelOpen && (
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
            )}

            {isCombatLogPanelOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-full rounded-xl border border-amber-800/70 bg-[#1a100c]/95 p-2 shadow-[0_14px_32px_rgba(0,0,0,0.5)] backdrop-blur-sm">
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
            )}
          </div>
        </section>

        <section className="mt-4 hidden min-h-0 flex-none grid-cols-[0.9fr_1.5fr] gap-3 pb-1 sm:grid">
          <div
            className={`${menuFont.className} rounded-xl border border-amber-800/70 bg-[#1a100c]/90 p-2 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-3`}
          >
            <div className="flex items-center gap-2">
              {actionMenu === "skills" && (
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
                {actionMenu === "main" ? "Acciones" : "Habilidades"}
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
                  disabled
                  className="w-full cursor-not-allowed rounded-md border border-slate-500/70 bg-slate-700/45 px-2 py-1 text-left text-xs font-semibold text-slate-200/75 opacity-60 sm:px-3 sm:py-1.5 sm:text-sm"
                  aria-disabled="true"
                >
                  Inventario
                </button>
              </div>
            ) : playerCombatSkills.length === 0 ? (
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
            const getStat = (key: string) => {
              switch (key.toUpperCase()) {
                case "STR":
                  return Math.max(0, Math.floor(playerStatStr));
                case "DEX":
                  return Math.max(0, Math.floor(playerStatDex));
                case "INT":
                  return Math.max(0, Math.floor(playerStatInt));
                case "WIS":
                  return Math.max(0, Math.floor(playerStatWis));
                default:
                  return 0;
              }
            };
            const dmgRange = computePlayerSkillDamageRangeBeforeArmor(
              skillTooltipEntry.skill.effect,
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
                        {dmgRange.min}–{dmgRange.max}
                      </span>
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
              </>
            );
          })()}
          <div className={`my-2 h-px w-full ${skillTooltipStyles.tooltipDivider}`} aria-hidden />
          <p className={skillTooltipStyles.tooltipBody}>
            {getPlayerSkillTooltipDescription(skillTooltipEntry.skill)}
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
          Tenés que seleccionar un enemigo para poder atacar.
        </div>
      ) : null}

      {playerCurrentHp <= 0 && isDefeatOverlayVisible ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4"
          role="presentation"
        >
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
            <Link
              href={escapeHref}
              className={`${menuFont.className} mx-auto mt-5 block w-full max-w-sm cursor-pointer rounded-md border border-red-600/90 bg-red-800/90 px-5 py-2.5 text-center text-sm font-semibold uppercase tracking-[0.12em] text-red-50 shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition hover:bg-red-700/95 sm:mt-6`}
            >
              Volver al campamento
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
