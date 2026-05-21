import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  CombatEncounterShell,
  type CombatEncounterStatsPayload,
  type CombatConsumeResult,
  type CombatEncounterEnemyView,
  type CombatEncounterEnemySkill,
  type CombatVictoryLootItem,
  type CombatPlayerConsumableView,
  type CombatPlayerSkillView,
  type CombatDefeatLostItem,
} from "@/components/combat/combat-encounter-shell";
import {
  isCombatEscapeDisabledZone,
  mapPathByZoneCode,
  normalizeZoneCodeKey,
  zoneLookupCodeCandidates,
} from "@/lib/game-zones";
import { normalizeEnemyTemplateAssetUrl, normalizePublicAssetUrl } from "@/lib/normalize-asset-url";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { insertWorldEventLog } from "@/lib/world-event-log";
import { parseEnemySkillEffectJson } from "@/lib/enemy-skill-combat";
import { parsePlayerSkillCooldownTurns } from "@/lib/player-skill-effect-combat";
import { isAmmoConsumableEffect } from "@/lib/combat-ammo";
import { persistCombatAmmoSpent, type CombatAmmoSpentEntry } from "@/lib/combat-persist-ammo";
import {
  hasUserDefeatedDailyBossToday,
  isDailyBossLimitedEncounterCode,
  recordUserDailyBossDefeat,
} from "@/lib/daily-boss-combat";

const LEVEL_UP_WORLD_EVENT_ICON_SRC = "/img/resources/iconos/icon_lvlup.png";

type CombatEncounterPageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ zone?: string; hotspot?: string; debug?: string }>;
};

type EnemyTemplateRow = Record<string, unknown>;

type EncounterEnemyRow = {
  spawn_index: number | null;
  hp_override: number | null;
  mana_override: number | null;
  ai_profile: string | null;
  sprite_offset_x: number | null;
  sprite_offset_y: number | null;
  mobile_offset_x: number | null;
  mobile_offset_y: number | null;
  sprite_scale: number | null;
  sprite_z_index: number | null;
  enemy_templates: EnemyTemplateRow | EnemyTemplateRow[] | null;
};

type UserCharacterRow = {
  /** Puede ser `user_profiles.id` u otro UUID; no siempre es igual a `auth.uid()`. */
  profile_id?: string | null;
  character_name: string | null;
  level: number | null;
  class_name: string | null;
  experience_to_next: number | null;
  experience_current: number | null;
  hp_total: number | null;
  hp_actual: number | null;
  mana_total: number | null;
  mana_actual: number | null;
  speed_total: number | null;
  weapon_damage_min: number | null;
  weapon_damage_max: number | null;
  magic_damage_min: number | null;
  magic_damage_max: number | null;
  str: number | null;
  dex: number | null;
  int: number | null;
  wis: number | null;
  armor_total: number | null;
  mr_total: number | null;
  active_combat_sprite: string | null;
  resistances?: unknown;
  weaknesses?: unknown;
};

type CombatConsumableInventoryRow = {
  id: number;
  quantity: number | null;
  item_id: string | null;
  items:
    | {
        id: string;
        name: string | null;
        description: string | null;
        item_type_id: string | null;
        json_consumable_effect: unknown;
      }
    | Array<{
        id: string;
        name: string | null;
        description: string | null;
        item_type_id: string | null;
        json_consumable_effect: unknown;
      }>
    | null;
};
type DefeatPenaltyInventoryRow = {
  id: number;
  profile_id: string | null;
  quantity: number | null;
  weapon_instance_id: number | null;
  equipment_instance_id: number | null;
  items:
    | {
        name: string | null;
        icon_path: string | null;
        is_stackable: boolean | null;
      }
    | Array<{
        name: string | null;
        icon_path: string | null;
        is_stackable: boolean | null;
      }>
    | null;
};

type EnemyDropTableRow = {
  /** `combat_encounters.code`: loot por encuentro (no por template). */
  combat_encounter_id: string | null;
  enemy_template_id: string | null;
  item_id: string | null;
  weapon_instance_id: number | null;
  equipment_instance_id: number | null;
  drop_chance: number | null;
  drop_group: string | null;
  min_qty: number | null;
  max_qty: number | null;
  items:
    | {
        id: string;
        name: string | null;
        description: string | null;
        quote_text: string | null;
        icon_path: string | null;
        sell_value: number | null;
        item_type_id: number | null;
        equip_slot: string | null;
        rarity: string | null;
        rarity_color: string | null;
        item_types:
          | {
              code: string | null;
            }
          | Array<{
              code: string | null;
            }>
          | null;
      }
    | Array<{
        id: string;
        name: string | null;
        description: string | null;
        quote_text: string | null;
        icon_path: string | null;
        sell_value: number | null;
        item_type_id: number | null;
        equip_slot: string | null;
        rarity: string | null;
        rarity_color: string | null;
        item_types:
          | {
              code: string | null;
            }
          | Array<{
              code: string | null;
            }>
          | null;
      }>
    | null;
  weapon_instance:
    | {
        id: number;
        item_id: string | null;
        rarity_color: string | null;
        rarity: string | null;
        attack_family: string | null;
        attack_damage_min: number | null;
        attack_damage_max: number | null;
        magic_damage_min: number | null;
        magic_damage_max: number | null;
        stat_key_1: string | null;
        value_flat_1: number | null;
        value_pct_1: number | null;
        stat_key_2: string | null;
        value_flat_2: number | null;
        value_pct_2: number | null;
        stat_key_3: string | null;
        value_flat_3: number | null;
        value_pct_3: number | null;
        stat_key_4: string | null;
        value_flat_4: number | null;
        stat_key_5: string | null;
        value_flat_5: number | null;
      }
    | Array<{
        id: number;
        item_id: string | null;
        rarity_color: string | null;
        rarity: string | null;
        attack_family: string | null;
        attack_damage_min: number | null;
        attack_damage_max: number | null;
        magic_damage_min: number | null;
        magic_damage_max: number | null;
        stat_key_1: string | null;
        value_flat_1: number | null;
        value_pct_1: number | null;
        stat_key_2: string | null;
        value_flat_2: number | null;
        value_pct_2: number | null;
        stat_key_3: string | null;
        value_flat_3: number | null;
        value_pct_3: number | null;
        stat_key_4: string | null;
        value_flat_4: number | null;
        stat_key_5: string | null;
        value_flat_5: number | null;
      }>
    | null;
  equipment_instances:
    | {
        id: number;
        item_id: string | null;
        rarity_color: string | null;
        rarity: string | null;
        stat_key_1: string | null;
        value_flat_1: number | null;
        value_pct_1: number | null;
        stat_key_2: string | null;
        value_flat_2: number | null;
        value_pct_2: number | null;
        stat_key_3: string | null;
        value_flat_3: number | null;
        value_pct_3: number | null;
        stat_key_4: string | null;
        value_flat_4: number | null;
        stat_key_5: string | null;
        value_flat_5: number | null;
      }
    | Array<{
        id: number;
        item_id: string | null;
        rarity_color: string | null;
        rarity: string | null;
        stat_key_1: string | null;
        value_flat_1: number | null;
        value_pct_1: number | null;
        stat_key_2: string | null;
        value_flat_2: number | null;
        value_pct_2: number | null;
        stat_key_3: string | null;
        value_flat_3: number | null;
        value_pct_3: number | null;
        stat_key_4: string | null;
        value_flat_4: number | null;
        stat_key_5: string | null;
        value_flat_5: number | null;
      }>
    | null;
};

type WeaponInstancePoolRow = {
  id: number;
  item_id: string | null;
  rarity: string | null;
  rarity_color: string | null;
  attack_family: string | null;
  attack_damage_min: number | null;
  attack_damage_max: number | null;
  magic_damage_min: number | null;
  magic_damage_max: number | null;
  stat_key_1: string | null;
  value_flat_1: number | null;
  value_pct_1: number | null;
  stat_key_2: string | null;
  value_flat_2: number | null;
  value_pct_2: number | null;
  stat_key_3: string | null;
  value_flat_3: number | null;
  value_pct_3: number | null;
  stat_key_4: string | null;
  value_flat_4: number | null;
  stat_key_5: string | null;
  value_flat_5: number | null;
};

type EquipmentInstancePoolRow = {
  id: number;
  item_id: string | null;
  rarity: string | null;
  rarity_color: string | null;
  stat_key_1: string | null;
  value_flat_1: number | null;
  value_pct_1: number | null;
  stat_key_2: string | null;
  value_flat_2: number | null;
  value_pct_2: number | null;
  stat_key_3: string | null;
  value_flat_3: number | null;
  value_pct_3: number | null;
  stat_key_4: string | null;
  value_flat_4: number | null;
  stat_key_5: string | null;
  value_flat_5: number | null;
};

function pickTemplate(raw: EncounterEnemyRow["enemy_templates"]): EnemyTemplateRow | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function firstNonEmptyString(...vals: unknown[]): string | null {
  for (const val of vals) {
    if (typeof val === "string") {
      const s = val.trim();
      if (s) return s;
    }
  }
  return null;
}

function templateName(t: EnemyTemplateRow): string | null {
  return firstNonEmptyString(t.name);
}

function templateSpriteRaw(t: EnemyTemplateRow): string | null {
  return firstNonEmptyString(
    t.sprite_path,
    t.sprite,
    t.sprite_file,
    t.sprite_url,
    t.battle_sprite_path,
    t.combat_sprite_path,
  );
}

function templatePortraitRaw(t: EnemyTemplateRow): string | null {
  return firstNonEmptyString(
    t.portrait_path,
    t.portrait,
    t.portrait_file,
    t.face_path,
    t.portrait_url,
  );
}

function parseEnemySkills(t: EnemyTemplateRow): CombatEncounterEnemySkill[] {
  const relationRaw = t.enemy_template_skills;
  if (!Array.isArray(relationRaw)) return [];

  const result: CombatEncounterEnemySkill[] = [];
  for (const relation of relationRaw) {
    if (!relation || typeof relation !== "object") continue;
    const skillRow = (relation as Record<string, unknown>).enemy_skills;
    if (!skillRow || typeof skillRow !== "object") continue;
    const skill = skillRow as Record<string, unknown>;
    const skillIdRaw = skill.id;
    const skillId =
      typeof skillIdRaw === "string" || typeof skillIdRaw === "number" ? String(skillIdRaw) : "";
    if (!skillId) continue;

    const effectRaw = skill.effect_json;
    const parsedEffect = parseEnemySkillEffectJson(effectRaw);
    if (!parsedEffect) continue;

    result.push({
      id: skillId,
      name: firstNonEmptyString(skill.name) ?? "Habilidad",
      description: firstNonEmptyString(skill.description),
      cooldownTurns: Math.max(
        1,
        num(
          skill.cooldown_turnos ??
            skill.cooldown_turns ??
            skill.cooldown ??
            (relation as Record<string, unknown>).cooldown_turnos ??
            (relation as Record<string, unknown>).cooldown_turns,
          1,
        ),
      ),
      manaCost: Math.max(0, num(skill.mana_cost, 0)),
      parsedEffect,
    });
  }
  return result;
}

function spriteOffsetNum(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function spriteScaleNum(value: unknown, fallback = 1): number {
  const n = spriteOffsetNum(value, fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function num(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** `value_flat_4` / `value_flat_5` para tooltip: conserva texto (ej. fire) o número. */
function lootInstanceStatFlatForTooltip(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/** `text[]` / JSON desde PostgREST → lista de strings para combate. */
function normalizeCombatResistWeakArray(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (x == null ? "" : String(x).trim()))
      .filter((s) => s.length > 0);
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t) as unknown;
      if (Array.isArray(parsed)) return normalizeCombatResistWeakArray(parsed);
    } catch {
      return [t];
    }
    return [t];
  }
  return [];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function capitalizeFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function optionalNum(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function randomIntInclusive(minValue: number, maxValue: number): number {
  const lo = Math.trunc(minValue);
  const hi = Math.trunc(maxValue);
  const safeMin = Math.min(lo, hi);
  const safeMax = Math.max(lo, hi);
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

type PlayerSkillRow = Record<string, unknown>;

function pickPlayerSkillJoin(raw: unknown): PlayerSkillRow | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] as PlayerSkillRow) ?? null;
  return raw as PlayerSkillRow;
}

function mapUserCharacterSkillsRow(row: Record<string, unknown>): CombatPlayerSkillView | null {
  const ucsIdRaw = row.id;
  const ucsId =
    typeof ucsIdRaw === "string" || typeof ucsIdRaw === "number" ? String(ucsIdRaw) : "";
  if (!ucsId) return null;

  const ps = pickPlayerSkillJoin(row.player_skills);
  if (!ps) return null;

  const active = ps.is_active;
  if (active === false) return null;

  const skillIdRaw = ps.id;
  const skillId =
    typeof skillIdRaw === "string" || typeof skillIdRaw === "number"
      ? String(skillIdRaw)
      : "";
  if (!skillId) return null;

  const effectRaw = ps.effect_json;
  const effect: Record<string, unknown> =
    effectRaw != null && typeof effectRaw === "object" && !Array.isArray(effectRaw)
      ? (effectRaw as Record<string, unknown>)
      : {};

  return {
    userCharacterSkillId: ucsId,
    /** No existe `learned_at` en `user_character_skills`; se deja `null`. */
    learnedAt: null,
    skill: {
      id: skillId,
      code: firstNonEmptyString(ps.code),
      name: firstNonEmptyString(ps.name) ?? "Habilidad",
      description: firstNonEmptyString(ps.description),
      manaCost: Math.max(0, num(ps.mana_cost, 0)),
      cooldownTurns: parsePlayerSkillCooldownTurns(ps.cooldown_turns, 0),
      target: typeof ps.target === "string" && ps.target.trim().length > 0 ? ps.target.trim() : "enemy_single",
      effect,
    },
  };
}

/** Solo desarrollo: motivo por el que una fila no produce `CombatPlayerSkillView`. */
function explainPlayerSkillSkip(row: Record<string, unknown>): string {
  const ucsIdRaw = row.id;
  const ucsIdOk =
    typeof ucsIdRaw === "string" || typeof ucsIdRaw === "number" ? String(ucsIdRaw) : "";
  if (!ucsIdOk) return "fila sin id en user_character_skills";

  const embedded = row.player_skills;
  const ps = pickPlayerSkillJoin(embedded);
  if (!ps) {
    if (embedded === undefined || embedded === null) {
      return "embed player_skills null/undefined (revisá FK nombre en Supabase o select)";
    }
    if (Array.isArray(embedded)) {
      return `player_skills es array vacío o sin objeto (length=${embedded.length})`;
    }
    return `player_skills formato inesperado (${typeof embedded})`;
  }

  if (ps.is_active === false) return "player_skills.is_active === false";

  const skillIdRaw = ps.id;
  const skillOk =
    typeof skillIdRaw === "string" || typeof skillIdRaw === "number" ? String(skillIdRaw) : "";
  if (!skillOk) return "player_skills sin id válido";

  return "filtro map desconocido";
}

type CombatCharacterLoadStep = {
  label: string;
  ok: boolean;
  errorMessage?: string;
  code?: string;
  rowCount?: number;
};

type CombatPageSupabase = Awaited<ReturnType<typeof createClient>>;

async function resolveEncounterZoneId(
  supabase: CombatPageSupabase,
  zoneQuery: string,
): Promise<string | null> {
  const trimmed = zoneQuery.trim();
  if (!trimmed) return null;
  const candidates = zoneLookupCodeCandidates(trimmed);
  if (candidates.length === 0) return null;
  const { data: rows, error } = await supabase
    .from("zones")
    .select("id")
    .in("code", candidates)
    .limit(1);
  if (error || !rows?.length) return null;
  const id = rows[0]?.id;
  return id != null ? String(id) : null;
}

/**
 * Resuelve `user_character` probando varias claves reales en distintas instalaciones de Supabase:
 * - `profile_id` = `auth.uid()` (lo que usa `class-selection`)
 * - `profile_id` = `user_profiles.id` cuando el perfil se enlaza por otra columna (`user_id`, `auth_user_id`, …)
 * - `user_character.user_id` = `auth.uid()`
 */
async function loadCombatUserCharacter(
  supabase: CombatPageSupabase,
  authUserId: string,
  userCharacterSelect: string,
): Promise<{
  character: UserCharacterRow | null;
  steps: CombatCharacterLoadStep[];
  profileCandidates: string[];
}> {
  const steps: CombatCharacterLoadStep[] = [];
  const profileCandidates = new Set<string>([authUserId]);

  const addProfileRow = (row: { id?: unknown } | null) => {
    if (row?.id != null) {
      const s = String(row.id).trim();
      if (s.length > 0) profileCandidates.add(s);
    }
  };

  const probeUserProfiles = async (column: string) => {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id")
      .eq(column, authUserId)
      .maybeSingle<{ id: string }>();
    steps.push({
      label: `user_profiles where ${column}=auth.uid`,
      ok: !error && !!data?.id,
      errorMessage: error?.message,
      code: error?.code,
      rowCount: data?.id ? 1 : 0,
    });
    if (!error) addProfileRow(data);
  };

  await probeUserProfiles("id");
  await probeUserProfiles("user_id");
  await probeUserProfiles("auth_user_id");

  let character: UserCharacterRow | null = null;

  for (const pid of profileCandidates) {
    const { data, error } = await supabase
      .from("user_character")
      .select(userCharacterSelect)
      .eq("profile_id", pid)
      .maybeSingle<UserCharacterRow>();
    steps.push({
      label: `user_character.profile_id=${pid}`,
      ok: !!data && !error,
      errorMessage: error?.message,
      code: error?.code,
      rowCount: data ? 1 : 0,
    });
    if (error) continue;
    if (data) {
      character = data;
      break;
    }
  }

  if (!character) {
    const { data, error } = await supabase
      .from("user_character")
      .select(userCharacterSelect)
      .eq("user_id", authUserId)
      .maybeSingle<UserCharacterRow>();
    steps.push({
      label: "user_character.user_id=auth.uid",
      ok: !!data && !error,
      errorMessage: error?.message,
      code: error?.code,
      rowCount: data ? 1 : 0,
    });
    if (!error && data) character = data;
  }

  return { character, steps, profileCandidates: [...profileCandidates] };
}

/**
 * `gap = playerLevel - enemyLevel` (positivo = enemigo más débil).
 * Misma exp base (`enemy_templates.xp_reward`): 100% si el enemigo es de tu nivel o superior.
 */
function xpRewardMultiplierByEnemyVsPlayer(enemyLevel: number, playerLevel: number): number {
  const e = Math.trunc(enemyLevel);
  const p = Math.max(1, Math.trunc(playerLevel));
  const gap = p - e;
  if (gap <= 0) return 1;
  if (gap === 1) return 0.9;
  if (gap === 2) return 0.8;
  if (gap === 3) return 0.5;
  if (gap === 4) return 0.25;
  return 0.05;
}

function dropChanceMultiplierByEncounterVsPlayer(recommendedLevel: number, playerLevel: number): number {
  const encounterLevel = Math.max(1, Math.trunc(recommendedLevel));
  const p = Math.max(1, Math.trunc(playerLevel));
  const gap = p - encounterLevel;

  if (gap <= 1) return 1;
  if (gap <= 3) return 0.4;
  if (gap === 4) return 0.2;
  return 0.01;
}

function mapRowToEnemyView(
  encounterId: string,
  row: EncounterEnemyRow,
  index: number,
  playerLevel: number,
): CombatEncounterEnemyView | null {
  const t = pickTemplate(row.enemy_templates);
  const name = t ? templateName(t) : null;
  if (!t || !name) return null;

  const hpMax = Math.max(1, num(t.hp, 1));
  const hp =
    row.hp_override != null
      ? Math.min(hpMax, Math.max(0, num(row.hp_override, hpMax)))
      : hpMax;
  const mana = row.mana_override != null ? num(row.mana_override, 0) : num(t.mana, 0);
  const spawn = num(row.spawn_index, index + 1);
  const enemyLevel = optionalNum(t.enemy_level) ?? optionalNum(t.level);
  const enemyLevelForXp = enemyLevel ?? playerLevel;

  return {
    id: `${encounterId}-${spawn}-${index}`,
    templateId:
      t.id != null && (typeof t.id === "string" || typeof t.id === "number")
        ? String(t.id)
        : null,
    spawnIndex: spawn,
    name,
    enemyLevel,
    portraitSrc: normalizeEnemyTemplateAssetUrl(templatePortraitRaw(t), "portrait"),
    spriteSrc: normalizeEnemyTemplateAssetUrl(templateSpriteRaw(t), "sprite"),
    spriteOffsetX: spriteOffsetNum(
      row.sprite_offset_x ??
        t.sprite_offset_x ??
        t.combat_sprite_offset_x ??
        t.offset_x ??
        t.pos_x,
      0,
    ),
    spriteOffsetY: spriteOffsetNum(
      row.sprite_offset_y ??
        t.sprite_offset_y ??
        t.combat_sprite_offset_y ??
        t.offset_y ??
        t.pos_y,
      0,
    ),
    mobileSpriteOffsetX: spriteOffsetNum(
      row.mobile_offset_x ??
        row.sprite_offset_x ??
        t.sprite_offset_x ??
        t.combat_sprite_offset_x ??
        t.offset_x ??
        t.pos_x,
      0,
    ),
    mobileSpriteOffsetY: spriteOffsetNum(
      row.mobile_offset_y ??
        row.sprite_offset_y ??
        t.sprite_offset_y ??
        t.combat_sprite_offset_y ??
        t.offset_y ??
        t.pos_y,
      0,
    ),
    spriteScale: spriteScaleNum(
      row.sprite_scale ?? t.sprite_scale ?? t.combat_sprite_scale ?? t.scale,
      1,
    ),
    spriteZIndex: Math.trunc(
      spriteOffsetNum(
        row.sprite_z_index ?? t.sprite_z_index ?? t.combat_sprite_z_index ?? t.z_index,
        index + 1,
      ),
    ),
    xpReward: (() => {
      const baseXp = Math.max(0, num(t.xp_reward, 0));
      const mult = xpRewardMultiplierByEnemyVsPlayer(enemyLevelForXp, playerLevel);
      return Math.max(0, Math.round(baseXp * mult));
    })(),
    goldRewards: Math.max(0, num(t.gold_rewards, 0)),
    hp,
    hpMax,
    mana,
    armor: num(t.armor, 0),
    mr: num(t.mr, 0),
    speed: num(t.speed, 0),
    attackMin: num(t.attack_min, 0),
    attackMax: num(t.attack_max, 0),
    magicMin: num(t.magic_min, 0),
    magicMax: num(t.magic_max, 0),
    skills: parseEnemySkills(t),
    levelOverride: optionalNum(t.level),
    aiProfile: row.ai_profile,
    resistances: normalizeCombatResistWeakArray(t.resistances),
    weaknesses: normalizeCombatResistWeakArray(t.weaknesses),
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: CombatEncounterPageProps): Promise<Metadata> {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);
  const { zone: zoneQuery } = await searchParams;
  const zoneCode =
    typeof zoneQuery === "string" && zoneQuery.trim().length > 0
      ? zoneQuery.trim()
      : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { title: `Combate - ${code}` };
  }

  let encounterZoneId: string | null = null;
  if (zoneCode) {
    encounterZoneId = await resolveEncounterZoneId(supabase, zoneCode);
    if (!encounterZoneId) {
      notFound();
    }
  }

  let encounterQuery = supabase
    .from("combat_encounters")
    .select("name")
    .eq("code", code)
    .eq("is_active", true);

  if (encounterZoneId) {
    encounterQuery = encounterQuery.eq("zone_id", encounterZoneId);
  }

  const { data: encounter, error: encounterError } = await encounterQuery.maybeSingle();

  if (encounterError || !encounter) {
    notFound();
  }

  const name =
    encounter.name != null && String(encounter.name).trim().length > 0
      ? String(encounter.name).trim()
      : code;

  return {
    title: `Combate - ${name}`,
  };
}

export default async function CombatEncounterPage({
  params,
  searchParams,
}: CombatEncounterPageProps) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);
  const { zone: zoneQuery, hotspot: hotspotQuery, debug: debugQuery } = await searchParams;
  const combatDebugEnabled = debugQuery === "1";
  const zoneCode =
    typeof zoneQuery === "string" && zoneQuery.trim().length > 0
      ? zoneQuery.trim()
      : "";
  const hotspotId =
    typeof hotspotQuery === "string" && hotspotQuery.trim().length > 0
      ? hotspotQuery.trim()
      : "";

  const supabase = await createClient();
  /** Plantillas de instancia suelen estar bloqueadas por RLS para el rol `authenticated`. */
  const lootInstancePoolClient = createServiceRoleClient() ?? supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("intro_completed, tutorial_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!milestones?.intro_completed) {
    redirect("/introduccion");
  }

  if (!milestones?.tutorial_completed) {
    redirect("/fin-tutorial");
  }

  /** Sin `id`: en tu esquema `user_character` puede no tener PK `id` y PostgREST devuelve 42703 si se pide. */
  const userCharacterSelect =
    "profile_id, character_name, level, class_name, experience_to_next, experience_current, hp_total, hp_actual, mana_total, mana_actual, speed_total, weapon_damage_min, weapon_damage_max, magic_damage_min, magic_damage_max, str, dex, int, wis, armor_total, mr_total, active_combat_sprite, resistances, weaknesses";
  const {
    character: userCharacter,
    steps: combatCharacterLoadSteps,
    profileCandidates: combatCharacterProfileCandidates,
  } = await loadCombatUserCharacter(supabase, user.id, userCharacterSelect);
  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("color")
    .eq("id", user.id)
    .maybeSingle();

  if (!userCharacter) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[combate] user_character sin fila tras todas las rutas conocidas:", {
        authUserId: user.id,
        profileCandidatesConsidered: combatCharacterProfileCandidates,
        steps: combatCharacterLoadSteps,
        hint:
          "Si el SELECT pide columnas que no existen (ej. id), PostgREST devuelve 42703 aunque exista la fila por profile_id. Revisá RLS y el listado de columnas en user_character.",
      });
    }
    redirect("/character_profile");
  }

  const playerLevel = Math.max(1, Math.trunc(num(userCharacter.level, 1)));
  const playerResistances = normalizeCombatResistWeakArray(userCharacter.resistances);
  const playerWeaknesses = normalizeCombatResistWeakArray(userCharacter.weaknesses);

  let encounterZoneId: string | null = null;
  if (zoneCode) {
    encounterZoneId = await resolveEncounterZoneId(supabase, zoneCode);
    if (!encounterZoneId) {
      notFound();
    }
  }

  let encounterQuery = supabase
    .from("combat_encounters")
    .select(
      "id, code, name, combat_step, is_boss, recommended_level, background, zone_id, combat_start_message",
    )
    .eq("code", code)
    .eq("is_active", true);

  if (encounterZoneId) {
    encounterQuery = encounterQuery.eq("zone_id", encounterZoneId);
  }

  const { data: encounter, error: encounterError } = await encounterQuery.maybeSingle();

  if (encounterError || !encounter) {
    notFound();
  }

  const encounterRecommendedLevel = Math.max(
    1,
    Math.trunc(
      encounter.recommended_level != null ? num(encounter.recommended_level, playerLevel) : playerLevel,
    ),
  );
  const dropChanceMultiplier = dropChanceMultiplierByEncounterVsPlayer(
    encounterRecommendedLevel,
    playerLevel,
  );
  const encounterZoneRefId =
    typeof encounter.zone_id === "string" && encounter.zone_id.trim().length > 0
      ? encounter.zone_id.trim()
      : null;
  let combatProgressZoneCode = zoneCode || null;
  if (!combatProgressZoneCode && encounterZoneRefId) {
    const { data: encounterZoneRow } = await supabase
      .from("zones")
      .select("code")
      .eq("id", encounterZoneRefId)
      .maybeSingle();
    if (
      encounterZoneRow &&
      typeof encounterZoneRow.code === "string" &&
      encounterZoneRow.code.trim().length > 0
    ) {
      combatProgressZoneCode = encounterZoneRow.code.trim();
    }
  }

  if (
    isDailyBossLimitedEncounterCode(code) &&
    (await hasUserDefeatedDailyBossToday(supabase, user.id, code))
  ) {
    const returnHotspot = hotspotId || code;
    const mapReturnPath =
      mapPathByZoneCode(combatProgressZoneCode ?? zoneCode) ?? "/mystic-cave";
    const separator = mapReturnPath.includes("?") ? "&" : "?";
    redirect(
      `${mapReturnPath}${separator}hotspot=${encodeURIComponent(returnHotspot)}&boss_daily=blocked`,
    );
  }

  const encounterCombatStepForProgress =
    typeof encounter.combat_step === "number" && Number.isFinite(encounter.combat_step)
      ? Math.max(0, Math.trunc(encounter.combat_step))
      : 0;

  const baseEnemySelect = `
      spawn_index,
      hp_override,
      mana_override,
      ai_profile,
      sprite_offset_x,
      sprite_offset_y,
      mobile_offset_x,
      mobile_offset_y,
      sprite_scale,
      sprite_z_index,
      enemy_templates (
        *,
        enemy_template_skills (
          enemy_skill_id,
          enemy_skills (
            id,
            name,
            description,
            mana_cost,
            effect_json
          )
        )
      )
    `;
  const enemySelectWithCooldownTurnos = `
      spawn_index,
      hp_override,
      mana_override,
      ai_profile,
      sprite_offset_x,
      sprite_offset_y,
      mobile_offset_x,
      mobile_offset_y,
      sprite_scale,
      sprite_z_index,
      enemy_templates (
        *,
        enemy_template_skills (
          enemy_skill_id,
          enemy_skills (
            id,
            name,
            description,
            cooldown_turnos,
            mana_cost,
            effect_json
          )
        )
      )
    `;
  const enemySelectWithCooldownTurns = `
      spawn_index,
      hp_override,
      mana_override,
      ai_profile,
      sprite_offset_x,
      sprite_offset_y,
      mobile_offset_x,
      mobile_offset_y,
      sprite_scale,
      sprite_z_index,
      enemy_templates (
        *,
        enemy_template_skills (
          enemy_skill_id,
          enemy_skills (
            id,
            name,
            description,
            cooldown_turns,
            mana_cost,
            effect_json
          )
        )
      )
    `;

  const enemySelectCandidates = [
    enemySelectWithCooldownTurnos,
    enemySelectWithCooldownTurns,
    baseEnemySelect,
  ];

  let rows: unknown[] | null = null;
  let rowsError: { message: string; code?: string; details?: string; hint?: string } | null = null;
  for (const selectExpr of enemySelectCandidates) {
    const { data, error } = await supabase
      .from("combat_encounter_enemies")
      .select(selectExpr)
      .eq("encounter_id", encounter.id)
      .order("spawn_index", { ascending: true });

    if (!error) {
      rows = data as unknown[] | null;
      rowsError = null;
      break;
    }
    rowsError = {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    };
  }

  const enemyRows: EncounterEnemyRow[] = rowsError ? [] : ((rows ?? []) as EncounterEnemyRow[]);

  const enemies: CombatEncounterEnemyView[] = enemyRows
    .map((row, i) => mapRowToEnemyView(String(encounter.id), row, i, playerLevel))
    .filter((e): e is CombatEncounterEnemyView => e !== null);

  if (combatDebugEnabled) {
    console.log("[combat-debug][server] encuentro cargado", {
      code,
      enemies: enemies.map((e) => ({
        id: e.id,
        name: e.name,
        attackMin: e.attackMin,
        attackMax: e.attackMax,
        skills: e.skills.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          parsedMode: s.parsedEffect.mode,
        })),
      })),
    });
  }

  const { data: enemyDropRows } = await supabase
    .from("enemy_drop_tables")
    .select(
      "combat_encounter_id, enemy_template_id, item_id, weapon_instance_id, equipment_instance_id, drop_chance, drop_group, min_qty, max_qty, items(id, name, description, quote_text, icon_path, sell_value, item_type_id, equip_slot, rarity, rarity_color, item_types(code)), weapon_instance(id, item_id, rarity, rarity_color, attack_family, attack_damage_min, attack_damage_max, magic_damage_min, magic_damage_max, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3, stat_key_4, value_flat_4, stat_key_5, value_flat_5), equipment_instances(id, item_id, rarity, rarity_color, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3, stat_key_4, value_flat_4, stat_key_5, value_flat_5)",
    )
    .eq("combat_encounter_id", code);

  const dropRowsSafe = (enemyDropRows ?? []) as EnemyDropTableRow[];
  const dropResolvedItemIds = Array.from(
    new Set(
      dropRowsSafe
        .map((row) => {
          const direct = typeof row.item_id === "string" ? row.item_id.trim() : "";
          if (direct) return direct;
          const weaponJoin = Array.isArray(row.weapon_instance)
            ? (row.weapon_instance[0] ?? null)
            : row.weapon_instance;
          const fromWeapon =
            weaponJoin && typeof weaponJoin.item_id === "string" ? weaponJoin.item_id.trim() : "";
          if (fromWeapon) return fromWeapon;
          const equipmentJoin = Array.isArray(row.equipment_instances)
            ? (row.equipment_instances[0] ?? null)
            : row.equipment_instances;
          const fromEquipment =
            equipmentJoin && typeof equipmentJoin.item_id === "string"
              ? equipmentJoin.item_id.trim()
              : "";
          return fromEquipment || null;
        })
        .filter((v): v is string => v !== null && v.length > 0),
    ),
  );
  const { data: dropItems } =
    dropResolvedItemIds.length > 0
      ? await supabase
          .from("items")
          .select("id, name, description, quote_text, icon_path, sell_value, item_type_id, equip_slot, rarity, rarity_color, item_types(code)")
          .in("id", dropResolvedItemIds)
      : { data: [] };
  const dropItemsMap = new Map(
    (dropItems ?? []).map((item) => [String(item.id), item as Record<string, unknown>]),
  );
  const { data: weaponInstancePoolRows } =
    dropResolvedItemIds.length > 0
      ? await lootInstancePoolClient
          .from("weapon_instance")
          .select(
            "id, item_id, rarity, rarity_color, attack_family, attack_damage_min, attack_damage_max, magic_damage_min, magic_damage_max, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3, stat_key_4, value_flat_4, stat_key_5, value_flat_5",
          )
          .in("item_id", dropResolvedItemIds)
      : { data: [] };
  const { data: equipmentInstancePoolRows } =
    dropResolvedItemIds.length > 0
      ? await lootInstancePoolClient
          .from("equipment_instances")
          .select(
            "id, item_id, rarity, rarity_color, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3, stat_key_4, value_flat_4, stat_key_5, value_flat_5",
          )
          .in("item_id", dropResolvedItemIds)
      : { data: [] };

  /**
   * Misma rareza en `items` y en instancias a veces no matchea por acentos o wording
   * (ej. items "Poco Común" vs instancia "poco comun" o "Uncommon").
   */
  const normalizeRarityKey = (raw: unknown): string => {
    if (typeof raw !== "string") return "";
    let t = raw
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (!t) return "";
    const hasPoco = t.includes("poco");
    const looksComun = /\b(comun|common)\b/.test(t) || t.includes("comun") || t.includes("common");
    const looksRaro = /\b(raro|rare)\b/.test(t);
    const looksEpic =
      /\b(epic|epico|épico)\b/.test(t) || t.includes("epico") || t.includes("epic");
    /** "pococomun", "poco comun", "uncommon", etc. */
    if (t === "uncommon" || (hasPoco && looksComun)) return "poco_comun";
    if ((looksComun || t === "common") && !hasPoco) return "comun";
    if (looksRaro) return "raro";
    if (looksEpic) return "epico";
    return t.replace(/\s+/g, "_");
  };

  const normalizeEquipSlot = (raw: unknown): string => {
    if (typeof raw !== "string") return "";
    return raw
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  };
  const instancePoolKey = (itemId: string, rarity: string): string => `${itemId}::${rarity}`;
  const pickRandom = <T,>(list: T[]): T | null => {
    if (list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)] ?? null;
  };
  const weaponPoolByItemRarity = new Map<string, WeaponInstancePoolRow[]>();
  const weaponPoolByItemId = new Map<string, WeaponInstancePoolRow[]>();
  for (const row of (weaponInstancePoolRows ?? []) as WeaponInstancePoolRow[]) {
    const itemId = typeof row.item_id === "string" ? row.item_id.trim() : "";
    const rarity = normalizeRarityKey(row.rarity);
    if (!itemId) continue;
    const byItem = weaponPoolByItemId.get(itemId) ?? [];
    byItem.push(row);
    weaponPoolByItemId.set(itemId, byItem);
    if (rarity) {
      const key = instancePoolKey(itemId, rarity);
      const list = weaponPoolByItemRarity.get(key) ?? [];
      list.push(row);
      weaponPoolByItemRarity.set(key, list);
    }
  }
  const equipmentPoolByItemRarity = new Map<string, EquipmentInstancePoolRow[]>();
  const equipmentPoolByItemId = new Map<string, EquipmentInstancePoolRow[]>();
  for (const row of (equipmentInstancePoolRows ?? []) as EquipmentInstancePoolRow[]) {
    const itemId = typeof row.item_id === "string" ? row.item_id.trim() : "";
    const rarity = normalizeRarityKey(row.rarity);
    if (!itemId) continue;
    const byItem = equipmentPoolByItemId.get(itemId) ?? [];
    byItem.push(row);
    equipmentPoolByItemId.set(itemId, byItem);
    if (rarity) {
      const key = instancePoolKey(itemId, rarity);
      const list = equipmentPoolByItemRarity.get(key) ?? [];
      list.push(row);
      equipmentPoolByItemRarity.set(key, list);
    }
  }

  const lootAgg = new Map<
    string,
    {
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
    }
  >();
  const lootRollTrace: Array<Record<string, unknown>> = [];

  const resolveDropItemId = (row: EnemyDropTableRow): string => {
    const direct = typeof row.item_id === "string" ? row.item_id.trim() : "";
    if (direct) return direct;
    const weaponJoin = Array.isArray(row.weapon_instance)
      ? (row.weapon_instance[0] ?? null)
      : row.weapon_instance;
    const fromWeapon =
      weaponJoin && typeof weaponJoin.item_id === "string" ? weaponJoin.item_id.trim() : "";
    if (fromWeapon) return fromWeapon;
    const equipmentJoin = Array.isArray(row.equipment_instances)
      ? (row.equipment_instances[0] ?? null)
      : row.equipment_instances;
    const fromEquipment =
      equipmentJoin && typeof equipmentJoin.item_id === "string" ? equipmentJoin.item_id.trim() : "";
    return fromEquipment;
  };
  const resolveDropItemJoin = (row: EnemyDropTableRow): Record<string, unknown> | null => {
    const inline = Array.isArray(row.items) ? (row.items[0] ?? null) : row.items;
    if (inline) return inline as unknown as Record<string, unknown>;
    const resolvedId = resolveDropItemId(row);
    if (!resolvedId) return null;
    return (dropItemsMap.get(resolvedId) as Record<string, unknown> | undefined) ?? null;
  };
  const resolveDropLootKey = (
    row: EnemyDropTableRow,
    selectedWeaponInstanceId: number | null,
    selectedEquipmentInstanceId: number | null,
  ): string => {
    if (typeof selectedWeaponInstanceId === "number") return `weapon:${selectedWeaponInstanceId}`;
    if (typeof selectedEquipmentInstanceId === "number") return `equipment:${selectedEquipmentInstanceId}`;
    if (typeof row.weapon_instance_id === "number") return `weapon:${row.weapon_instance_id}`;
    if (typeof row.equipment_instance_id === "number") return `equipment:${row.equipment_instance_id}`;
    const itemId = resolveDropItemId(row);
    if (itemId) return `item:${itemId}`;
    return `fallback:${Math.random().toString(36).slice(2)}`;
  };

  const addLoot = (row: EnemyDropTableRow, quantity: number) => {
    if (quantity <= 0) return;
    const itemJoin = resolveDropItemJoin(row);
    if (!itemJoin) return;
    const itemId = resolveDropItemId(row);
    if (!itemId) return;
    const rawTypes = itemJoin.item_types as unknown;
    const typeJoin = Array.isArray(rawTypes) ? (rawTypes[0] ?? null) : rawTypes;
    const rowWeaponJoin = Array.isArray(row.weapon_instance)
      ? (row.weapon_instance[0] ?? null)
      : row.weapon_instance;
    const rowEquipmentJoin = Array.isArray(row.equipment_instances)
      ? (row.equipment_instances[0] ?? null)
      : row.equipment_instances;
    const dropGroup =
      typeof row.drop_group === "string" && row.drop_group.trim().length > 0
        ? row.drop_group.trim().toLowerCase()
        : "";
    const itemRarity = normalizeRarityKey(itemJoin.rarity);
    const rarityPoolKeyWeapon = itemRarity ? instancePoolKey(itemId, itemRarity) : "";
    const rarityPoolWeapon = itemRarity ? (weaponPoolByItemRarity.get(rarityPoolKeyWeapon) ?? []) : [];
    const allWeaponForItem = weaponPoolByItemId.get(itemId) ?? [];

    const rarityPoolKeyEquip = itemRarity ? instancePoolKey(itemId, itemRarity) : "";
    const rarityPoolEquip = itemRarity
      ? (equipmentPoolByItemRarity.get(rarityPoolKeyEquip) ?? [])
      : [];
    const allEquipForItem = equipmentPoolByItemId.get(itemId) ?? [];

    const equipSlotNorm = normalizeEquipSlot(itemJoin.equip_slot);

    let selectedWeaponFromPool: WeaponInstancePoolRow | null = null;
    let selectedEquipmentFromPool: EquipmentInstancePoolRow | null = null;

    if (dropGroup === "weapon") {
      selectedWeaponFromPool = pickRandom(
        (itemRarity && rarityPoolWeapon.length > 0
          ? rarityPoolWeapon
          : null) ??
          (allWeaponForItem.length > 0 ? allWeaponForItem : []),
      );
    } else if (dropGroup === "equipment") {
      if (equipSlotNorm === "weapon") {
        selectedWeaponFromPool = pickRandom(
          (itemRarity && rarityPoolWeapon.length > 0
            ? rarityPoolWeapon
            : null) ??
            (allWeaponForItem.length > 0 ? allWeaponForItem : []),
        );
      } else {
        selectedEquipmentFromPool = pickRandom(
          (itemRarity && rarityPoolEquip.length > 0
            ? rarityPoolEquip
            : null) ??
            (allEquipForItem.length > 0 ? allEquipForItem : []),
        );
      }
    } else {
      // Fallback: si `drop_group` no viene seteado, igual intentar randomizar por pool.
      // Prioriza weapon cuando el equip_slot del item es weapon; caso contrario usa equipment.
      if (equipSlotNorm === "weapon" && allWeaponForItem.length > 0) {
        selectedWeaponFromPool = pickRandom(
          (itemRarity && rarityPoolWeapon.length > 0
            ? rarityPoolWeapon
            : null) ??
            allWeaponForItem,
        );
      } else if (allEquipForItem.length > 0) {
        selectedEquipmentFromPool = pickRandom(
          (itemRarity && rarityPoolEquip.length > 0
            ? rarityPoolEquip
            : null) ??
            allEquipForItem,
        );
      }
    }

    const weaponJoin = selectedWeaponFromPool ?? rowWeaponJoin;
    const equipmentJoin = selectedEquipmentFromPool ?? rowEquipmentJoin;
      const rarityFromItem =
      typeof itemJoin.rarity_color === "string" && itemJoin.rarity_color.trim().length > 0
        ? itemJoin.rarity_color.trim()
        : null;
    const rarityFromWeapon =
      weaponJoin && typeof weaponJoin.rarity_color === "string" && weaponJoin.rarity_color.trim().length > 0
        ? weaponJoin.rarity_color.trim()
        : null;
    const rarityFromEquipment =
      equipmentJoin &&
      typeof equipmentJoin.rarity_color === "string" &&
      equipmentJoin.rarity_color.trim().length > 0
        ? equipmentJoin.rarity_color.trim()
        : null;
    const rarityColor = rarityFromWeapon ?? rarityFromEquipment ?? rarityFromItem;    
    const itemTypeCode =
      typeof typeJoin?.code === "string" && typeJoin.code.trim().length > 0
        ? typeJoin.code.trim().toLowerCase()
        : null;
    const lootKey = resolveDropLootKey(
      row,
      selectedWeaponFromPool?.id ?? null,
      selectedEquipmentFromPool?.id ?? null,
    );
    const current = lootAgg.get(lootKey);
    if (current) {
      current.quantity += quantity;
      return;
    }
    lootAgg.set(lootKey, {
      lootKey,
      itemId,
      name:
        typeof itemJoin.name === "string" && itemJoin.name.trim().length > 0
          ? itemJoin.name.trim()
          : "Item",
      iconPath: normalizePublicAssetUrl(
        typeof itemJoin.icon_path === "string" ? itemJoin.icon_path : null,
      ),
      quantity,
      description:
        typeof itemJoin.description === "string" && itemJoin.description.trim().length > 0
          ? itemJoin.description.trim()
          : null,
      quoteText:
        typeof itemJoin.quote_text === "string" && itemJoin.quote_text.trim().length > 0
          ? itemJoin.quote_text.trim()
          : null,
      sellValue: Math.max(0, Math.trunc(num(itemJoin.sell_value, 0))),
      itemTypeId:
      itemJoin.item_type_id != null && Number.isFinite(Number(itemJoin.item_type_id))
        ? Math.trunc(Number(itemJoin.item_type_id))
        : null,
      itemTypeCode,
      rarityColor,
      weaponInstance: weaponJoin
        ? {
            rarity: typeof weaponJoin.rarity === "string" ? weaponJoin.rarity : null,
            rarityColor: typeof weaponJoin.rarity_color === "string" ? weaponJoin.rarity_color : null,
            attackFamily:
              typeof weaponJoin.attack_family === "string" && weaponJoin.attack_family.trim().length > 0
                ? weaponJoin.attack_family.trim()
                : null,
            attackDamageMin:
              weaponJoin.attack_damage_min != null ? Number(weaponJoin.attack_damage_min) : null,
            attackDamageMax:
              weaponJoin.attack_damage_max != null ? Number(weaponJoin.attack_damage_max) : null,
            magicDamageMin:
              weaponJoin.magic_damage_min != null ? Number(weaponJoin.magic_damage_min) : null,
            magicDamageMax:
              weaponJoin.magic_damage_max != null ? Number(weaponJoin.magic_damage_max) : null,
            statKey1: typeof weaponJoin.stat_key_1 === "string" ? weaponJoin.stat_key_1 : null,
            valueFlat1: weaponJoin.value_flat_1 != null ? Number(weaponJoin.value_flat_1) : null,
            valuePct1: weaponJoin.value_pct_1 != null ? Number(weaponJoin.value_pct_1) : null,
            statKey2: typeof weaponJoin.stat_key_2 === "string" ? weaponJoin.stat_key_2 : null,
            valueFlat2: weaponJoin.value_flat_2 != null ? Number(weaponJoin.value_flat_2) : null,
            valuePct2: weaponJoin.value_pct_2 != null ? Number(weaponJoin.value_pct_2) : null,
            statKey3: typeof weaponJoin.stat_key_3 === "string" ? weaponJoin.stat_key_3 : null,
            valueFlat3: weaponJoin.value_flat_3 != null ? Number(weaponJoin.value_flat_3) : null,
            valuePct3: weaponJoin.value_pct_3 != null ? Number(weaponJoin.value_pct_3) : null,
            statKey4: typeof weaponJoin.stat_key_4 === "string" ? weaponJoin.stat_key_4 : null,
            valueFlat4: lootInstanceStatFlatForTooltip(weaponJoin.value_flat_4),
            valuePct4: null,
            statKey5: typeof weaponJoin.stat_key_5 === "string" ? weaponJoin.stat_key_5 : null,
            valueFlat5: lootInstanceStatFlatForTooltip(weaponJoin.value_flat_5),
            valuePct5: null,
          }
        : null,
      equipmentInstance: equipmentJoin
        ? {
            rarity: typeof equipmentJoin.rarity === "string" ? equipmentJoin.rarity : null,
            rarityColor:
              typeof equipmentJoin.rarity_color === "string" ? equipmentJoin.rarity_color : null,
            statKey1:
              typeof equipmentJoin.stat_key_1 === "string" ? equipmentJoin.stat_key_1 : null,
            valueFlat1:
              equipmentJoin.value_flat_1 != null ? Number(equipmentJoin.value_flat_1) : null,
            valuePct1: equipmentJoin.value_pct_1 != null ? Number(equipmentJoin.value_pct_1) : null,
            statKey2:
              typeof equipmentJoin.stat_key_2 === "string" ? equipmentJoin.stat_key_2 : null,
            valueFlat2:
              equipmentJoin.value_flat_2 != null ? Number(equipmentJoin.value_flat_2) : null,
            valuePct2: equipmentJoin.value_pct_2 != null ? Number(equipmentJoin.value_pct_2) : null,
            statKey3:
              typeof equipmentJoin.stat_key_3 === "string" ? equipmentJoin.stat_key_3 : null,
            valueFlat3:
              equipmentJoin.value_flat_3 != null ? Number(equipmentJoin.value_flat_3) : null,
            valuePct3: equipmentJoin.value_pct_3 != null ? Number(equipmentJoin.value_pct_3) : null,
            statKey4:
              typeof equipmentJoin.stat_key_4 === "string" ? equipmentJoin.stat_key_4 : null,
            valueFlat4: lootInstanceStatFlatForTooltip(equipmentJoin.value_flat_4),
            valuePct4: null,
            statKey5:
              typeof equipmentJoin.stat_key_5 === "string" ? equipmentJoin.stat_key_5 : null,
            valueFlat5: lootInstanceStatFlatForTooltip(equipmentJoin.value_flat_5),
            valuePct5: null,
          }
        : null,
    });
  };

  const rowItemName = (row: EnemyDropTableRow): string => {
    const itemJoin = resolveDropItemJoin(row);
    return typeof itemJoin?.name === "string" && itemJoin.name.trim().length > 0
      ? itemJoin.name.trim()
      : "Item";
  };

  const rowItemId = (row: EnemyDropTableRow): string => {
    return resolveDropItemId(row);
  };

  const lootRollContextId = code;
  const adjustedDropChance = (row: EnemyDropTableRow): number => {
    const baseChance = Math.max(0, Math.min(1, num(row.drop_chance, 0)));
    return Math.max(0, Math.min(1, baseChance * dropChanceMultiplier));
  };

  const rollRow = (row: EnemyDropTableRow, traceId: string, source: "ungrouped" | "grouped") => {
    const chance = adjustedDropChance(row);
    const roll = Math.random();
    if (roll > chance) {
      lootRollTrace.push({
        enemyId: traceId,
        source,
        itemId: rowItemId(row),
        itemName: rowItemName(row),
        dropGroup: row.drop_group,
        chance,
        roll,
        passed: false,
        droppedQty: 0,
      });
      return;
    }
    const minQty = Math.max(0, Math.trunc(num(row.min_qty, 0)));
    const maxQty = Math.max(minQty, Math.trunc(num(row.max_qty, minQty)));
    const qty = randomIntInclusive(minQty, maxQty);
    addLoot(row, qty);
    lootRollTrace.push({
      enemyId: traceId,
      source,
      itemId: rowItemId(row),
      itemName: rowItemName(row),
      dropGroup: row.drop_group,
      chance,
      roll,
      passed: true,
      droppedQty: qty,
    });
  };

  {
    const grouped = new Map<string, EnemyDropTableRow[]>();
    const ungrouped: EnemyDropTableRow[] = [];
    for (const row of dropRowsSafe) {
      const group =
        typeof row.drop_group === "string" && row.drop_group.trim().length > 0
          ? row.drop_group.trim()
          : "";
      if (!group) {
        ungrouped.push(row);
        continue;
      }
      const list = grouped.get(group) ?? [];
      list.push(row);
      grouped.set(group, list);
    }

    for (const row of ungrouped) rollRow(row, lootRollContextId, "ungrouped");

    for (const [groupKey, groupRows] of grouped) {
      const passed = groupRows.filter((row) => {
        const chance = adjustedDropChance(row);
        const roll = Math.random();
        const ok = roll <= chance;
        lootRollTrace.push({
          enemyId: lootRollContextId,
          source: "grouped-check",
          group: groupKey,
          itemId: rowItemId(row),
          itemName: rowItemName(row),
          chance,
          roll,
          passed: ok,
        });
        return ok;
      });
      if (passed.length === 0) continue;
      const chosen = passed[Math.floor(Math.random() * passed.length)] ?? null;
      if (!chosen) continue;
      const minQty = Math.max(0, Math.trunc(num(chosen.min_qty, 0)));
      const maxQty = Math.max(minQty, Math.trunc(num(chosen.max_qty, minQty)));
      const qty = randomIntInclusive(minQty, maxQty);
      addLoot(chosen, qty);
      lootRollTrace.push({
        enemyId: lootRollContextId,
        source: "grouped-picked",
        group: groupKey,
        chosenItemId: rowItemId(chosen),
        chosenItemName: rowItemName(chosen),
        droppedQty: qty,
      });
    }
  }

  const victoryLootItems: CombatVictoryLootItem[] = Array.from(lootAgg.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const victoryGoldFromLoot = victoryLootItems.reduce((sum, item) => {
    const isGoldType =
      item.itemTypeCode === "gold" ||
      item.itemTypeCode === "oro" ||
      item.itemTypeCode === "currency" ||
      item.itemTypeCode === "coin";
    const isGoldName = item.name.toLowerCase().includes("oro") || item.name.toLowerCase().includes("gold");
    return isGoldType || isGoldName ? sum + Math.max(0, Math.trunc(item.quantity)) : sum;
  }, 0);

  const rowsErrorPayload =
    rowsError != null
      ? {
          message: rowsError.message,
          code: rowsError.code,
          details: rowsError.details,
          hint: rowsError.hint,
        }
      : null;

  /**
   * `user_character_skills.profile_id` y equipamiento referencian el personaje igual que `user_character.profile_id`.
   * Solo si la fila no trae ese campo usamos auth.uid() (compatibilidad).
   */
  const characterSkillsProfileId =
    typeof userCharacter.profile_id === "string" && userCharacter.profile_id.trim().length > 0
      ? userCharacter.profile_id.trim()
      : user.id;

  let playerWeaponAttackFamily: string | null = null;
  let playerWeaponAmmoKind: string | null = null;
  {
    const { data: weaponSlotEquip } = await supabase
      .from("user_equipment")
      .select("inventory_id")
      .eq("profile_id", characterSkillsProfileId)
      .eq("slot", "weapon")
      .maybeSingle();

    const invRaw = weaponSlotEquip?.inventory_id;
    const invId = typeof invRaw === "number" ? invRaw : Math.trunc(Number(invRaw));
    if (Number.isFinite(invId) && invId > 0) {
      const { data: invRow } = await supabase
        .from("user_inventory")
        .select("weapon_instance_id")
        .eq("id", invId)
        .eq("profile_id", characterSkillsProfileId)
        .maybeSingle();

      const widRaw = invRow?.weapon_instance_id;
      const wiId = typeof widRaw === "number" ? widRaw : Math.trunc(Number(widRaw));
      if (Number.isFinite(wiId) && wiId > 0) {
        const { data: wiRow } = await supabase
          .from("weapon_instance")
          .select("attack_family, ammo_kind")
          .eq("id", wiId)
          .maybeSingle();

        const af = wiRow?.attack_family;
        if (typeof af === "string" && af.trim().length > 0) {
          playerWeaponAttackFamily = af.trim();
        }
        const ak = wiRow?.ammo_kind;
        if (typeof ak === "string" && ak.trim().length > 0) {
          playerWeaponAmmoKind = ak.trim();
        }
      }
    }
  }

  const backgroundRaw = encounter.background;
  const backgroundSrc =
    typeof backgroundRaw === "string" && backgroundRaw.trim().length > 0
      ? backgroundRaw.trim()
      : null;
  const zoneForMapHref = zoneCode || combatProgressZoneCode || null;
  const mapBaseHref = mapPathByZoneCode(zoneForMapHref) ?? "/";
  const zoneKeyForMapUi = normalizeZoneCodeKey(zoneForMapHref);
  const mapDisplayName =
    zoneKeyForMapUi === "hidden_forest" || zoneKeyForMapUi === "wolf_forest"
      ? "Bosque Inexplorado"
      : zoneKeyForMapUi === "near_woods" || zoneKeyForMapUi === "nearwoods"
        ? "Cercanías del bosque"
        : zoneKeyForMapUi === "magic_forest" || zoneKeyForMapUi === "magicforest"
          ? "Bosque mágico"
          : zoneKeyForMapUi === "mystic_cave"
            ? "Cueva mística"
            : zoneKeyForMapUi === "abandoned_coal_mine"
              ? "Minas abandonadas"
              : encounter.name != null && String(encounter.name).trim().length > 0
            ? String(encounter.name).trim()
            : "Mapa desconocido";
  const combatDisplayName =
    encounter.name != null && String(encounter.name).trim().length > 0
      ? String(encounter.name).trim()
      : String(encounter.code ?? code);
  const escapeToMapHref =
    hotspotId && mapBaseHref.startsWith("/")
      ? `${mapBaseHref}?hotspot=${encodeURIComponent(hotspotId)}`
      : mapBaseHref;
  const escapeDisabled = isCombatEscapeDisabledZone(zoneForMapHref);
  const playerDisplayName =
    typeof userCharacter.character_name === "string" && userCharacter.character_name.trim().length > 0
      ? userCharacter.character_name.trim().toUpperCase()
      : "AVENTURERO";
  const playerLogName =
    typeof userCharacter.character_name === "string" && userCharacter.character_name.trim().length > 0
      ? capitalizeFirst(userCharacter.character_name)
      : "Aventurero";
  const playerLogColor =
    typeof userProfile?.color === "string" && userProfile.color.trim().length > 0
      ? userProfile.color.trim()
      : "#f8fafc";
  /** Mismo criterio que perfil: nombre en minúsculas y espacios → `_`. */
  const characterNameToken = playerDisplayName.toLowerCase().replace(/\s+/g, "_");
  const playerPortraitSrc = `/img/resources/caracters_faces/pj_${characterNameToken}_rpg_face.png`;
  const playerSpriteFromDb = normalizePublicAssetUrl(userCharacter.active_combat_sprite);
  const playerSpriteSrc =
    playerSpriteFromDb ??
    `/img/resources/characters/pj_${characterNameToken}_rpg_fight_stick.png`;
  const playerHpMax = Math.max(1, num(userCharacter.hp_total, 100));
  const playerHp = Math.min(playerHpMax, Math.max(0, num(userCharacter.hp_actual, playerHpMax)));
  const playerManaMax = Math.max(1, num(userCharacter.mana_total, 20));
  const playerMana = Math.min(
    playerManaMax,
    Math.max(0, num(userCharacter.mana_actual, playerManaMax)),
  );
  const playerSpeed = Math.max(0, num(userCharacter.speed_total, 0));
  const playerWeaponDamageMin = Math.max(1, num(userCharacter.weapon_damage_min, 1));
  const playerWeaponDamageMax = Math.max(
    playerWeaponDamageMin,
    num(userCharacter.weapon_damage_max, playerWeaponDamageMin),
  );
  const playerMagicDamageRawMin = num(userCharacter.magic_damage_min, 0);
  const playerMagicDamageRawMax = num(userCharacter.magic_damage_max, playerMagicDamageRawMin);
  const playerMagicDamageMin = Math.max(0, Math.trunc(playerMagicDamageRawMin));
  const playerMagicDamageMax = Math.max(
    playerMagicDamageMin,
    Math.trunc(playerMagicDamageRawMax),
  );
  const playerStatStr = Math.max(0, num(userCharacter.str, 0));
  const playerStatDex = Math.max(0, num(userCharacter.dex, 0));
  const playerStatInt = Math.max(0, num(userCharacter.int, 0));
  const playerStatWis = Math.max(0, num(userCharacter.wis, 0));
  const playerArmor = Math.max(0, num(userCharacter.armor_total, 0));
  const playerMr = Math.max(0, num(userCharacter.mr_total, 0));
  const playerExperienceToNext = Math.max(0, Math.trunc(num(userCharacter.experience_to_next, 0)));
  const rawPlayerClassName =
    typeof userCharacter.class_name === "string" && userCharacter.class_name.trim().length > 0
      ? userCharacter.class_name.trim()
      : "";
  let playerClassId: string | null = null;
  let playerClassName: string | null = null;
  if (rawPlayerClassName) {
    const { data: classById } = await supabase
      .from("classes")
      .select("id, name")
      .eq("id", rawPlayerClassName)
      .maybeSingle<{ id: string; name: string | null }>();
    if (classById) {
      playerClassId = classById.id;
      playerClassName =
        typeof classById.name === "string" && classById.name.trim().length > 0
          ? classById.name.trim()
          : null;
    } else {
      const { data: classByName } = await supabase
        .from("classes")
        .select("id, name")
        .eq("name", rawPlayerClassName)
        .maybeSingle<{ id: string; name: string | null }>();
      if (classByName) {
        playerClassId = classByName.id;
        playerClassName =
          typeof classByName.name === "string" && classByName.name.trim().length > 0
            ? classByName.name.trim()
            : null;
      }
    }
  }
  const playerClassKeys = new Set(
    [rawPlayerClassName, playerClassId ?? "", playerClassName ?? ""]
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v.length > 0),
  );
  const victoryXpGain = enemies.reduce(
    (sum, enemy) => sum + Math.max(0, Math.trunc(num(enemy.xpReward, 0))),
    0,
  );
  const playerExperienceCurrent = Math.max(0, Math.trunc(num(userCharacter.experience_current, 0)));
  const projectedExperienceAfterVictory = playerExperienceCurrent + Math.max(0, Math.trunc(victoryXpGain));
  const { data: projectedLevelProgress } = await supabase
    .from("level_progression")
    .select("level")
    .lte("xp_required_total", projectedExperienceAfterVictory)
    .order("level", { ascending: false })
    .limit(1)
    .maybeSingle<{ level: number }>();
  const projectedLevelAfterVictory = Math.max(
    playerLevel,
    Math.max(1, Math.trunc(Number(projectedLevelProgress?.level ?? playerLevel))),
  );

  /**
   * `user_character_skills`: id, profile_id, player_skill_id.
   * `player_skills`: columnas según tu esquema público (solo `cooldown_turns`, sin `cooldown_turnos`).
   */
  const playerSkillSelectVariants = [
    `
      id,
      profile_id,
      player_skill_id,
      player_skills (
        id,
        code,
        name,
        description,
        mana_cost,
        cooldown_turns,
        target,
        effect_json,
        is_active,
        class_id,
        spec_id,
        unlock_level,
        learn_gold_cost,
        learn_wis_required
      )
    `,
    `
      id,
      profile_id,
      player_skill_id,
      player_skills (
        id,
        code,
        name,
        description,
        mana_cost,
        cooldown_turns,
        target,
        effect_json,
        is_active
      )
    `,
  ];

  type SkillsLoadAttempt = {
    profileId: string;
    rowCount: number;
    lastSelectError: { message: string; code?: string } | null;
  };

  let characterSkillRowsRaw: unknown[] = [];
  let skillsLoadAttempt: SkillsLoadAttempt = {
    profileId: characterSkillsProfileId,
    rowCount: 0,
    lastSelectError: null,
  };
  for (const selectExpr of playerSkillSelectVariants) {
    const { data, error } = await supabase
      .from("user_character_skills")
      .select(selectExpr)
      .eq("profile_id", characterSkillsProfileId)
      .lte("player_skills.unlock_level", playerLevel)
      .order("id", { ascending: true });

    if (!error) {
      characterSkillRowsRaw = (data ?? []) as unknown[];
      skillsLoadAttempt = {
        profileId: characterSkillsProfileId,
        rowCount: characterSkillRowsRaw.length,
        lastSelectError: null,
      };
      break;
    }
    skillsLoadAttempt = {
      profileId: characterSkillsProfileId,
      rowCount: 0,
      lastSelectError: { message: error.message, code: error.code },
    };
  }

  const skillMapSkips: Array<{ ucsId: string; reason: string }> = [];
  const classAndLevelFilteredRows = (characterSkillRowsRaw ?? []).filter((row) => {
    if (!(typeof row === "object" && row !== null)) return false;
    const rec = row as Record<string, unknown>;
    const ps = pickPlayerSkillJoin(rec.player_skills);
    if (!ps) return false;
    const unlockLevel = Math.max(0, Math.trunc(num(ps.unlock_level, 0)));
    if (unlockLevel > playerLevel) return false;
    if (playerClassKeys.size === 0) return true;
    const skillClassRaw = firstNonEmptyString(ps.class_id, ps.class_name);
    if (!skillClassRaw) return false;
    return playerClassKeys.has(skillClassRaw.trim().toLowerCase());
  });

  const playerSkills: CombatPlayerSkillView[] = classAndLevelFilteredRows
    .map((row) => {
      if (!(typeof row === "object" && row !== null)) return null;
      const rec = row as Record<string, unknown>;
      const mapped = mapUserCharacterSkillsRow(rec);
      if (!mapped && process.env.NODE_ENV === "development") {
        skillMapSkips.push({
          ucsId: String(rec.id ?? ""),
          reason: explainPlayerSkillSkip(rec),
        });
      }
      return mapped;
    })
    .filter((entry): entry is CombatPlayerSkillView => entry !== null);

  const consumableProfileIds = Array.from(
    new Set([characterSkillsProfileId, user.id].map((v) => String(v).trim()).filter(Boolean)),
  );

  const { data: consumableRows } = await supabase
    .from("user_inventory")
    .select(
      "id, quantity, item_id, items!inner(id, name, description, item_type_id, json_consumable_effect)",
    )
    .in("profile_id", consumableProfileIds)
    .gt("quantity", 0)
    .eq("items.item_type_id", 3)
    .order("id", { ascending: true });

  const playerConsumables: CombatPlayerConsumableView[] = ((consumableRows ??
    []) as CombatConsumableInventoryRow[])
    .map((row) => {
      const itemJoin = Array.isArray(row.items) ? (row.items[0] ?? null) : row.items;
      if (!itemJoin) return null;
      const itemId = typeof itemJoin.id === "string" ? itemJoin.id : row.item_id;
      if (!itemId || itemId.trim().length === 0) return null;
      return {
        inventoryId: Math.trunc(Number(row.id)),
        itemId,
        name:
          typeof itemJoin.name === "string" && itemJoin.name.trim().length > 0
            ? itemJoin.name.trim()
            : "Consumible",
        description:
          typeof itemJoin.description === "string" && itemJoin.description.trim().length > 0
            ? itemJoin.description.trim()
            : null,
        effect:
          itemJoin.json_consumable_effect &&
          typeof itemJoin.json_consumable_effect === "object" &&
          !Array.isArray(itemJoin.json_consumable_effect)
            ? (itemJoin.json_consumable_effect as Record<string, unknown>)
            : null,
        quantity: Math.max(0, Math.trunc(num(row.quantity, 0))),
      };
    })
    .filter((entry): entry is CombatPlayerConsumableView => entry !== null && entry.quantity > 0);

  const profileIdForPenalty =
    typeof characterSkillsProfileId === "string" && characterSkillsProfileId.trim().length > 0
      ? characterSkillsProfileId.trim()
      : user.id;
  const { data: penaltyInventoryRows } = await supabase
    .from("user_inventory")
    .select(
      "id, profile_id, quantity, weapon_instance_id, equipment_instance_id, items!inner(name, icon_path, is_stackable)",
    )
    .eq("profile_id", profileIdForPenalty)
    .gt("quantity", 0);
  const { data: penaltyEquippedRows } = await supabase
    .from("user_equipment")
    .select("inventory_id")
    .eq("profile_id", profileIdForPenalty);
  const equippedPenaltyIds = new Set(
    (penaltyEquippedRows ?? [])
      .map((row) => Number(row.inventory_id))
      .filter((value) => Number.isFinite(value))
      .map((value) => Math.trunc(value)),
  );
  const penaltyCandidates = ((penaltyInventoryRows ?? []) as DefeatPenaltyInventoryRow[])
    .filter((row) => {
      const id = Number(row.id);
      if (!Number.isFinite(id)) return false;
      if (equippedPenaltyIds.has(Math.trunc(id))) return false;
      return true;
    })
    .map((row) => {
      const itemJoin = Array.isArray(row.items) ? (row.items[0] ?? null) : row.items;
      const quantity = Math.max(0, Math.trunc(num(row.quantity, 0)));
      const isStackable = itemJoin?.is_stackable === true;
      const quantityLost = isStackable ? Math.max(1, Math.floor(quantity * 0.2)) : 1;
      return {
        inventoryId: Math.trunc(Number(row.id)),
        name:
          typeof itemJoin?.name === "string" && itemJoin.name.trim().length > 0
            ? itemJoin.name.trim()
            : "Item",
        iconPath: normalizePublicAssetUrl(
          typeof itemJoin?.icon_path === "string" ? itemJoin.icon_path : null,
        ),
        quantityLost: Math.max(1, Math.min(quantityLost, quantity)),
      } satisfies CombatDefeatLostItem;
    })
    .filter((entry) => entry.quantityLost > 0);
  const defeatLostItems: CombatDefeatLostItem[] = [];
  const penaltyPool = [...penaltyCandidates];
  while (penaltyPool.length > 0 && defeatLostItems.length < 2) {
    const randomIndex = Math.floor(Math.random() * penaltyPool.length);
    const picked = penaltyPool[randomIndex];
    if (!picked) break;
    defeatLostItems.push(picked);
    penaltyPool.splice(randomIndex, 1);
  }

  async function logPlayerDefeatedInGlobalLog() {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: actionUser },
    } = await supabaseAction.auth.getUser();
    if (!actionUser) return;

    const safePlayerName = escapeHtml(playerLogName);
    const safePlayerColor = escapeHtml(playerLogColor);
    const safeCombatName = escapeHtml(combatDisplayName);
    const eventHtml = `<span style=\"color:${safePlayerColor}\">${safePlayerName}</span> ha caido en combate en ${safeCombatName}. Prendemos una vela por él.`;

    await insertWorldEventLog(supabaseAction, actionUser.id, {
      member_name: playerLogName,
      event_html: eventHtml,
    });
  }

  async function logPlayerLevelUpInGlobalLog(newLevel: number) {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: actionUser },
    } = await supabaseAction.auth.getUser();
    if (!actionUser) return;

    const safePlayerName = escapeHtml(playerLogName);
    const safePlayerColor = escapeHtml(playerLogColor);
    const safeLevel = Math.max(1, Math.trunc(Number.isFinite(Number(newLevel)) ? Number(newLevel) : 1));
    const eventHtml = `<img src="${LEVEL_UP_WORLD_EVENT_ICON_SRC}" alt="" width="18" height="18" style="display:inline-block;vertical-align:text-bottom;margin-right:4px;" />¡<span style=\"color:${safePlayerColor}\">${safePlayerName}</span> subió a Nivel <span style=\"color:#fbbf24\">${safeLevel}</span>!`;

    await insertWorldEventLog(supabaseAction, actionUser.id, {
      member_name: playerLogName,
      event_html: eventHtml,
    });
  }

  async function persistCombatStats(payload: CombatEncounterStatsPayload) {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: actionUser },
    } = await supabaseAction.auth.getUser();
    if (!actionUser) return;

    const asNonNegativeInt = (value: unknown): number =>
      Math.max(0, Math.trunc(Number.isFinite(Number(value)) ? Number(value) : 0));
    const didWin = payload.didWin === true;
    const didLose = !didWin;
    const combatsWonDelta = didWin ? 1 : 0;
    const deathsDelta = didWin ? 0 : 1;
    const enemiesDefeatedDelta = asNonNegativeInt(payload.enemiesDefeated);
    const bossesDefeatedDelta = asNonNegativeInt(payload.bossesDefeated);
    const totalDamageDealtDelta = asNonNegativeInt(payload.totalDamageDealt);
    const totalDamageTakenDelta = asNonNegativeInt(payload.totalDamageTaken);
    const totalHealingDelta = asNonNegativeInt(payload.totalHealing);
    const highestHitDealtThisCombat = asNonNegativeInt(payload.highestHitDealt);
    const highestHitReceivedThisCombat = asNonNegativeInt(payload.highestHitReceived);
    const finalHpAfterCombat = asNonNegativeInt(payload.finalHp);
    const finalManaAfterCombat = asNonNegativeInt(payload.finalMana);

    const { data: currentStats } = await supabaseAction
      .from("user_stats")
      .select(
        "combats_won, deaths, enemies_defeated, bosses_defeated, total_damage_dealt, total_damage_taken, total_healing, highest_hit_dealt, highest_hit_received",
      )
      .eq("user_id", actionUser.id)
      .maybeSingle();

    const currentCombatsWon = asNonNegativeInt(currentStats?.combats_won);
    const currentDeaths = asNonNegativeInt(currentStats?.deaths);
    const currentEnemiesDefeated = asNonNegativeInt(currentStats?.enemies_defeated);
    const currentBossesDefeated = asNonNegativeInt(currentStats?.bosses_defeated);
    const currentTotalDamageDealt = asNonNegativeInt(currentStats?.total_damage_dealt);
    const currentTotalDamageTaken = asNonNegativeInt(currentStats?.total_damage_taken);
    const currentTotalHealing = asNonNegativeInt(currentStats?.total_healing);
    const currentHighestHitDealt = asNonNegativeInt(currentStats?.highest_hit_dealt);
    const currentHighestHitReceived = asNonNegativeInt(currentStats?.highest_hit_received);

    await supabaseAction.from("user_stats").upsert(
      {
        user_id: actionUser.id,
        combats_won: currentCombatsWon + combatsWonDelta,
        deaths: currentDeaths + deathsDelta,
        enemies_defeated: currentEnemiesDefeated + enemiesDefeatedDelta,
        bosses_defeated: currentBossesDefeated + bossesDefeatedDelta,
        total_damage_dealt: currentTotalDamageDealt + totalDamageDealtDelta,
        total_damage_taken: currentTotalDamageTaken + totalDamageTakenDelta,
        total_healing: currentTotalHealing + totalHealingDelta,
        highest_hit_dealt: Math.max(currentHighestHitDealt, highestHitDealtThisCombat),
        highest_hit_received: Math.max(currentHighestHitReceived, highestHitReceivedThisCombat),
      },
      { onConflict: "user_id" },
    );

    const profileTargets = Array.from(
      new Set([characterSkillsProfileId, actionUser.id].map((v) => String(v).trim()).filter(Boolean)),
    );

    const ammoSpentPayload = (payload.ammoSpent ?? []).filter(
      (entry) =>
        entry &&
        Number.isFinite(entry.inventoryId) &&
        Number.isFinite(entry.quantitySpent) &&
        entry.quantitySpent > 0,
    );
    await persistCombatAmmoSpent(profileTargets, ammoSpentPayload);

    const persistCharacterVitals = async () => {
      for (const profileId of profileTargets) {
        const { data: characterRow, error: characterReadError } = await supabaseAction
          .from("user_character")
          .select("hp_total, mana_total")
          .eq("profile_id", profileId)
          .maybeSingle();
        if (characterReadError || !characterRow) continue;
        const hpTotal = asNonNegativeInt(characterRow.hp_total);
        const manaTotal = asNonNegativeInt(characterRow.mana_total);
        const nextHpActual = didLose ? Math.min(hpTotal, 10) : Math.min(hpTotal, finalHpAfterCombat);
        const nextManaActual = didLose
          ? Math.min(manaTotal, 10)
          : Math.min(manaTotal, finalManaAfterCombat);
        const { error: characterUpdateError } = await supabaseAction
          .from("user_character")
          .update({ hp_actual: nextHpActual, mana_actual: nextManaActual })
          .eq("profile_id", profileId);
        if (!characterUpdateError) break;
      }
    };

    if (!didWin) {
      const RELAXING_WATER_ITEM_ID = "ecd74ed8-b2de-4bb9-b109-3fd4f27e8955";
      await persistCharacterVitals();
      if (defeatLostItems.length > 0) {
        for (const lost of defeatLostItems) {
          const { data: inventoryRow, error: inventoryReadError } = await supabaseAction
            .from("user_inventory")
            .select("id, quantity")
            .eq("id", lost.inventoryId)
            .eq("profile_id", profileIdForPenalty)
            .maybeSingle();
          if (inventoryReadError || !inventoryRow) continue;
          const currentQty = Math.max(0, Math.trunc(num(inventoryRow.quantity, 0)));
          if (currentQty <= 0) continue;
          const toRemove = Math.max(1, Math.min(Math.trunc(lost.quantityLost), currentQty));
          const nextQty = currentQty - toRemove;
          if (nextQty <= 0) {
            await supabaseAction.from("user_inventory").delete().eq("id", lost.inventoryId);
          } else {
            await supabaseAction
              .from("user_inventory")
              .update({ quantity: nextQty })
              .eq("id", lost.inventoryId);
          }
        }
      }
      const { data: globalWarehouseRow } = await supabaseAction
        .from("global_warehouse")
        .select("quantity")
        .eq("item_id", RELAXING_WATER_ITEM_ID)
        .eq("is_global_item", true)
        .maybeSingle();
      const currentGlobalQuantity =
        typeof globalWarehouseRow?.quantity === "number" && Number.isFinite(globalWarehouseRow.quantity)
          ? Math.max(0, Math.trunc(globalWarehouseRow.quantity))
          : 0;
      if (globalWarehouseRow) {
        await supabaseAction
          .from("global_warehouse")
          .update({ quantity: currentGlobalQuantity + 1 })
          .eq("item_id", RELAXING_WATER_ITEM_ID)
          .eq("is_global_item", true);
      } else {
        await supabaseAction.from("global_warehouse").insert({
          item_id: RELAXING_WATER_ITEM_ID,
          quantity: 1,
          is_global_item: true,
        });
      }
      return;
    }
    const profileIdForInventory =
      typeof characterSkillsProfileId === "string" && characterSkillsProfileId.trim().length > 0
        ? characterSkillsProfileId.trim()
        : actionUser.id;

    const safeVictoryXpGain = Math.max(0, Math.trunc(victoryXpGain));
    const didLevelUpOnVictory =
      didWin &&
      playerExperienceToNext > 0 &&
      safeVictoryXpGain >= playerExperienceToNext;
    if (safeVictoryXpGain > 0) {
      for (const profileId of profileTargets) {
        const { data: characterRow, error: characterReadError } = await supabaseAction
          .from("user_character")
          .select("experience_current")
          .eq("profile_id", profileId)
          .maybeSingle();
        if (characterReadError || !characterRow) continue;
        const currentExperience =
          typeof characterRow.experience_current === "number" &&
          Number.isFinite(characterRow.experience_current)
            ? Math.max(0, Math.trunc(characterRow.experience_current))
            : 0;
        const { error: characterUpdateError } = await supabaseAction
          .from("user_character")
          .update({ experience_current: currentExperience + safeVictoryXpGain })
          .eq("profile_id", profileId);
        if (!characterUpdateError) break;
      }
    }
    // Si hubo level up, dejamos que el trigger conserve HP/Mana al máximo.
    if (!didLevelUpOnVictory) {
      // Persistir HP/Mana al final de la rama de victoria (después de update de XP/triggeres).
      await persistCharacterVitals();
    }

    if (process.env.NODE_ENV === "development") {
      console.info(
        "[combate][loot]",
        JSON.stringify(
          {
            encounterCode: code,
            recommendedLevel: encounterRecommendedLevel,
            playerLevel,
            dropChanceMultiplier,
            rollTrace: lootRollTrace,
            finalLoot: victoryLootItems,
            victoryGoldFromLoot,
          },
          null,
          2,
        ),
      );
    }

    const lootItemIds = Array.from(
      new Set(
        victoryLootItems
          .map((loot) => (typeof loot.itemId === "string" ? loot.itemId.trim() : ""))
          .filter(Boolean),
      ),
    );
    const { data: inventoryRowsForCapacity } = await supabaseAction
      .from("user_inventory")
      .select("id, item_id, weapon_instance_id, equipment_instance_id, quantity")
      .eq("profile_id", profileIdForInventory)
      .gt("quantity", 0);
    const { data: equippedRowsForCapacity } = await supabaseAction
      .from("user_equipment")
      .select("inventory_id")
      .eq("profile_id", profileIdForInventory);
    const equippedInventoryIdSet = new Set<number>(
      (equippedRowsForCapacity ?? [])
        .map((row) => Number(row.inventory_id))
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.trunc(value)),
    );
    const currentInventoryRows = (inventoryRowsForCapacity ?? []) as Array<{
      id: number;
      item_id: string | null;
      weapon_instance_id: number | null;
      equipment_instance_id: number | null;
      quantity: number | null;
    }>;
    const unequippedInventoryCount = currentInventoryRows.reduce((sum, row) => {
      const id = Number(row.id);
      if (!Number.isFinite(id)) return sum;
      return equippedInventoryIdSet.has(Math.trunc(id)) ? sum : sum + 1;
    }, 0);
    let remainingInventorySlots = Math.max(0, 24 - unequippedInventoryCount);
    const { data: lootItemsData } =
      lootItemIds.length > 0
        ? await supabaseAction.from("items").select("id, is_stackable").in("id", lootItemIds)
        : { data: [] };
    const lootItemsMap = new Map<string, boolean>(
      (lootItemsData ?? []).map((row) => [String(row.id), row.is_stackable === true]),
    );
    const stackableItemRows = new Map<string, { id: number; quantity: number }>();
    for (const row of currentInventoryRows) {
      const itemId = typeof row.item_id === "string" ? row.item_id.trim() : "";
      const id = Number(row.id);
      if (!itemId || !Number.isFinite(id)) continue;
      if (row.weapon_instance_id != null || row.equipment_instance_id != null) continue;
      const currentQty =
        typeof row.quantity === "number" && Number.isFinite(row.quantity)
          ? Math.max(0, Math.trunc(row.quantity))
          : 0;
      const existing = stackableItemRows.get(itemId);
      if (!existing || existing.id > Math.trunc(id)) {
        stackableItemRows.set(itemId, { id: Math.trunc(id), quantity: currentQty });
      }
    }
    const parseLootInstanceId = (lootKey: string, prefix: "weapon" | "equipment"): number | null => {
      if (!lootKey.startsWith(`${prefix}:`)) return null;
      const raw = lootKey.slice(prefix.length + 1).trim();
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    };

    for (const loot of victoryLootItems) {
      const qty = Math.max(0, Math.trunc(Number(loot.quantity ?? 0)));
      if (qty <= 0) continue;
      const itemId = typeof loot.itemId === "string" ? loot.itemId.trim() : "";
      if (!itemId) continue;

      const weaponInstanceId = parseLootInstanceId(loot.lootKey, "weapon");
      const equipmentInstanceId = parseLootInstanceId(loot.lootKey, "equipment");
      if (weaponInstanceId != null) {
        if (remainingInventorySlots <= 0) continue;
        await supabaseAction.from("user_inventory").insert({
          profile_id: profileIdForInventory,
          quantity: qty,
          weapon_instance_id: weaponInstanceId,
        });
        remainingInventorySlots -= 1;
        continue;
      }
      if (equipmentInstanceId != null) {
        if (remainingInventorySlots <= 0) continue;
        await supabaseAction.from("user_inventory").insert({
          profile_id: profileIdForInventory,
          quantity: qty,
          equipment_instance_id: equipmentInstanceId,
        });
        remainingInventorySlots -= 1;
        continue;
      }

      const isStackable = lootItemsMap.get(itemId) === true;
      if (isStackable) {
        const existingItemRow = stackableItemRows.get(itemId) ?? null;
        if (existingItemRow && typeof existingItemRow.id === "number") {
          const currentQty = Math.max(0, Math.trunc(existingItemRow.quantity));
          await supabaseAction
            .from("user_inventory")
            .update({ quantity: currentQty + qty })
            .eq("id", Math.trunc(existingItemRow.id));
          stackableItemRows.set(itemId, {
            id: Math.trunc(existingItemRow.id),
            quantity: currentQty + qty,
          });
        } else {
          if (remainingInventorySlots <= 0) continue;
          await supabaseAction.from("user_inventory").insert({
            profile_id: profileIdForInventory,
            quantity: qty,
            item_id: itemId,
          });
          remainingInventorySlots -= 1;
        }
        continue;
      }

      if (remainingInventorySlots <= 0) continue;
      await supabaseAction.from("user_inventory").insert({
        profile_id: profileIdForInventory,
        quantity: qty,
        item_id: itemId,
      });
      remainingInventorySlots -= 1;
    }

    const RELAXING_WATER_ITEM_ID = "ecd74ed8-b2de-4bb9-b109-3fd4f27e8955";
    const shouldGrantRelaxingWaterOnWin = Math.random() < 0.15;
    if (shouldGrantRelaxingWaterOnWin) {
      const { data: globalWarehouseRow } = await supabaseAction
        .from("global_warehouse")
        .select("quantity")
        .eq("item_id", RELAXING_WATER_ITEM_ID)
        .eq("is_global_item", true)
        .maybeSingle();
      const currentGlobalQuantity =
        typeof globalWarehouseRow?.quantity === "number" && Number.isFinite(globalWarehouseRow.quantity)
          ? Math.max(0, Math.trunc(globalWarehouseRow.quantity))
          : 0;
      if (globalWarehouseRow) {
        await supabaseAction
          .from("global_warehouse")
          .update({ quantity: currentGlobalQuantity + 1 })
          .eq("item_id", RELAXING_WATER_ITEM_ID)
          .eq("is_global_item", true);
      } else {
        await supabaseAction.from("global_warehouse").insert({
          item_id: RELAXING_WATER_ITEM_ID,
          quantity: 1,
          is_global_item: true,
        });
      }
    }

    if (isDailyBossLimitedEncounterCode(code)) {
      await recordUserDailyBossDefeat(supabaseAction, actionUser.id, code);
    }

    const zoneProgressId = combatProgressZoneCode;
    if (!zoneProgressId) return;
    const nextCombatStep = encounterCombatStepForProgress + 1;
    if (process.env.NODE_ENV === "development") {
      console.log("[combat-progress] start", {
        encounterCode: code,
        encounterZoneId: encounterZoneRefId,
        resolvedZoneCode: zoneProgressId,
        encounterCombatStep: encounterCombatStepForProgress,
        nextCombatStep,
        userId: actionUser.id,
        didWin,
      });
    }

    const { data: currentProgress, error: currentProgressError } = await supabaseAction
      .from("user_combat_progress")
      .select("id, combat_step")
      .eq("user_id", actionUser.id)
      .eq("zone_id", zoneProgressId)
      .order("combat_step", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (process.env.NODE_ENV === "development") {
      console.log("[combat-progress] current-row", {
        zoneId: zoneProgressId,
        row: currentProgress ?? null,
        error: currentProgressError
          ? {
              message: currentProgressError.message,
              code: currentProgressError.code,
              details: currentProgressError.details,
            }
          : null,
      });
    }
    const currentCombatStep =
      typeof currentProgress?.combat_step === "number" && Number.isFinite(currentProgress.combat_step)
        ? Math.max(0, Math.trunc(currentProgress.combat_step))
        : 0;
    if (nextCombatStep <= currentCombatStep) {
      if (process.env.NODE_ENV === "development") {
        console.log("[combat-progress] skip-update", {
          reason: "next_step_not_greater",
          currentCombatStep,
          nextCombatStep,
          zoneId: zoneProgressId,
          userId: actionUser.id,
        });
      }
      return;
    }

    let progressWriteError:
      | { message: string; code?: string; details?: string | null }
      | null = null;
    if (currentProgress && typeof currentProgress.id === "number") {
      const { error: updateError } = await supabaseAction
        .from("user_combat_progress")
        .update({ combat_step: nextCombatStep })
        .eq("id", currentProgress.id);
      progressWriteError = updateError
        ? { message: updateError.message, code: updateError.code, details: updateError.details }
        : null;
    } else {
      const { error: insertError } = await supabaseAction.from("user_combat_progress").insert({
        user_id: actionUser.id,
        zone_id: zoneProgressId,
        combat_step: nextCombatStep,
      });
      progressWriteError = insertError
        ? { message: insertError.message, code: insertError.code, details: insertError.details }
        : null;
    }
    if (process.env.NODE_ENV === "development") {
      console.log("[combat-progress] upsert-result", {
        zoneId: zoneProgressId,
        userId: actionUser.id,
        writtenCombatStep: nextCombatStep,
        error: progressWriteError,
      });
    }
  }

  async function consumeCombatConsumable(inventoryId: number): Promise<CombatConsumeResult> {
    "use server";

    const safeInventoryId = Math.max(0, Math.trunc(Number(inventoryId)));
    if (safeInventoryId <= 0) {
      return { ok: false, error: "Consumible inválido." };
    }

    const supabaseAction = await createClient();
    const {
      data: { user: actionUser },
    } = await supabaseAction.auth.getUser();
    if (!actionUser) {
      return { ok: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
    }

    const { data: invRow, error: invError } = await supabaseAction
      .from("user_inventory")
      .select("id, quantity, profile_id, items!inner(json_consumable_effect)")
      .eq("id", safeInventoryId)
      .maybeSingle();

    if (invError || !invRow) {
      return { ok: false, error: "No se encontró el consumible en inventario." };
    }

    const profileId = typeof invRow.profile_id === "string" ? invRow.profile_id.trim() : "";
    if (profileId !== actionUser.id && profileId !== characterSkillsProfileId) {
      return { ok: false, error: "No podés consumir este objeto." };
    }

    const itemJoin = Array.isArray(invRow.items) ? (invRow.items[0] ?? null) : invRow.items;
    const effectRaw = itemJoin?.json_consumable_effect;
    const effect =
      effectRaw && typeof effectRaw === "object" && !Array.isArray(effectRaw)
        ? (effectRaw as Record<string, unknown>)
        : null;
    if (isAmmoConsumableEffect(effect)) {
      return { ok: false, error: "La munición solo se gasta al atacar." };
    }

    const currentQty = Math.max(0, Math.trunc(Number(invRow.quantity ?? 0)));
    if (currentQty <= 0) {
      return { ok: false, error: "Ya no te quedan unidades de ese consumible." };
    }

    const nextQty = currentQty - 1;
    const { error: updateError } = await supabaseAction
      .from("user_inventory")
      .update({ quantity: nextQty })
      .eq("id", safeInventoryId);

    if (updateError) {
      return { ok: false, error: "No se pudo descontar el consumible." };
    }

    return { ok: true, remainingQuantity: nextQty };
  }

  async function persistEscapeCombatState(payload: {
    finalHp: number;
    finalMana: number;
    ammoSpent?: CombatAmmoSpentEntry[];
  }) {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: actionUser },
    } = await supabaseAction.auth.getUser();
    if (!actionUser) return;

    const asNonNegativeInt = (value: unknown): number =>
      Math.max(0, Math.trunc(Number.isFinite(Number(value)) ? Number(value) : 0));
    const finalHpAfterEscape = asNonNegativeInt(payload.finalHp);
    const finalManaAfterEscape = asNonNegativeInt(payload.finalMana);
    const profileTargets = Array.from(
      new Set([characterSkillsProfileId, actionUser.id].map((v) => String(v).trim()).filter(Boolean)),
    );

    const ammoSpentPayload = (payload.ammoSpent ?? []).filter(
      (entry) =>
        entry &&
        Number.isFinite(entry.inventoryId) &&
        Number.isFinite(entry.quantitySpent) &&
        entry.quantitySpent > 0,
    );
    await persistCombatAmmoSpent(profileTargets, ammoSpentPayload);

    for (const profileId of profileTargets) {
      const { data: characterRow, error: characterReadError } = await supabaseAction
        .from("user_character")
        .select("hp_total, mana_total")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (characterReadError || !characterRow) continue;
      const hpTotal = asNonNegativeInt(characterRow.hp_total);
      const manaTotal = asNonNegativeInt(characterRow.mana_total);
      const nextHpActual = Math.min(hpTotal, finalHpAfterEscape);
      const nextManaActual = Math.min(manaTotal, finalManaAfterEscape);
      const { error: characterUpdateError } = await supabaseAction
        .from("user_character")
        .update({ hp_actual: nextHpActual, mana_actual: nextManaActual })
        .eq("profile_id", profileId);
      if (!characterUpdateError) break;
    }
  }

  return (
    <CombatEncounterShell
      encounterName={String(encounter.name ?? code)}
      encounterCode={String(encounter.code ?? code)}
      combatStep={encounter.combat_step != null ? String(encounter.combat_step) : null}
      isBoss={Boolean(encounter.is_boss)}
      recommendedLevel={
        encounter.recommended_level != null ? num(encounter.recommended_level, 1) : null
      }
      backgroundSrc={backgroundSrc}
      enemies={enemies}
      combatStartMessage={
        typeof encounter.combat_start_message === "string" &&
        encounter.combat_start_message.trim().length > 0
          ? encounter.combat_start_message.trim()
          : null
      }
      escapeHref={escapeToMapHref}
      escapeDisabled={escapeDisabled}
      playerDisplayName={playerDisplayName}
      playerPortraitSrc={playerPortraitSrc}
      playerSpriteSrc={playerSpriteSrc}
      playerHp={playerHp}
      playerHpMax={playerHpMax}
      playerMana={playerMana}
      playerManaMax={playerManaMax}
      playerSpeed={playerSpeed}
      playerWeaponDamageMin={playerWeaponDamageMin}
      playerWeaponDamageMax={playerWeaponDamageMax}
      playerMagicDamageMin={playerMagicDamageMin}
      playerMagicDamageMax={playerMagicDamageMax}
      playerStatStr={playerStatStr}
      playerStatDex={playerStatDex}
      playerStatInt={playerStatInt}
      playerStatWis={playerStatWis}
      playerArmor={playerArmor}
      playerMr={playerMr}
      playerExperienceToNext={playerExperienceToNext}
      playerLevelCurrent={playerLevel}
      playerLevelAfterVictory={projectedLevelAfterVictory}
      playerSkills={playerSkills}
      playerConsumables={playerConsumables}
      victoryLootItems={victoryLootItems}
      defeatLostItems={defeatLostItems}
      victoryGoldFromLoot={victoryGoldFromLoot}
      onConsumeConsumable={consumeCombatConsumable}
      onEscapePersistState={persistEscapeCombatState}
      onPlayerDefeatedGlobalLog={logPlayerDefeatedInGlobalLog}
      onPlayerLevelUpGlobalLog={logPlayerLevelUpInGlobalLog}
      onCombatFinishedStats={persistCombatStats}
      playerResistances={playerResistances}
      playerWeaknesses={playerWeaknesses}
      playerWeaponAttackFamily={playerWeaponAttackFamily}
      playerWeaponAmmoKind={playerWeaponAmmoKind}
      combatDebugEnabled={combatDebugEnabled}
    />
  );
}
