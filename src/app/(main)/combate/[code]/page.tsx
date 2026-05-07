import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  CombatEncounterShell,
  type CombatConsumeResult,
  type CombatEncounterDebugPayload,
  type CombatEncounterEnemyView,
  type CombatEncounterEnemySkill,
  type CombatVictoryLootItem,
  type CombatPlayerConsumableView,
  type CombatPlayerSkillView,
} from "@/components/combat/combat-encounter-shell";
import { mapPathByZoneCode } from "@/lib/game-zones";
import { normalizeEnemyTemplateAssetUrl, normalizePublicAssetUrl } from "@/lib/normalize-asset-url";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

type CombatEncounterPageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ debug?: string; zone?: string; hotspot?: string }>;
};

type EnemyTemplateRow = Record<string, unknown>;

type EncounterEnemyRow = {
  spawn_index: number | null;
  hp_override: number | null;
  mana_override: number | null;
  ai_profile: string | null;
  sprite_offset_x: number | null;
  sprite_offset_y: number | null;
  sprite_scale: number | null;
  sprite_z_index: number | null;
  enemy_templates: EnemyTemplateRow | EnemyTemplateRow[] | null;
};

type UserCharacterRow = {
  /** Puede ser `user_profiles.id` u otro UUID; no siempre es igual a `auth.uid()`. */
  profile_id?: string | null;
  character_name: string | null;
  hp_total: number | null;
  hp_actual: number | null;
  mana_total: number | null;
  mana_actual: number | null;
  speed_total: number | null;
  weapon_damage_min: number | null;
  weapon_damage_max: number | null;
  str: number | null;
  dex: number | null;
  int: number | null;
  wis: number | null;
  armor_total: number | null;
  mr_total: number | null;
  active_combat_sprite: string | null;
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
      }
    | Array<{
        id: number;
        item_id: string | null;
        rarity_color: string | null;
        rarity: string | null;
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
      }>
    | null;
};

type WeaponInstancePoolRow = {
  id: number;
  item_id: string | null;
  rarity: string | null;
  rarity_color: string | null;
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

function enemySkillDamageSubtype(effect: Record<string, unknown>): "physical" | "magical" | "buff" | "neutral" {
  const raw = effect.subtype;
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "physical") return "physical";
  if (s === "magical") return "magical";
  if (s === "buff") return "buff";
  return "neutral";
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
    if (!effectRaw || typeof effectRaw !== "object") continue;
    const effect = effectRaw as Record<string, unknown>;
    if (effect.type !== "damage" || effect.target !== "player") continue;
    const min = Math.max(0, num(effect.min, 0));
    const max = Math.max(min, num(effect.max, min));

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
      effect: {
        type: "damage",
        target: "player",
        min,
        max,
        subtype: enemySkillDamageSubtype(effect),
        chance: Math.max(0, Math.min(1, num(effect.chance, 1))),
      },
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
      cooldownTurns: Math.max(1, num(ps.cooldown_turns, 1)),
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

function mapRowToEnemyView(
  encounterId: string,
  row: EncounterEnemyRow,
  index: number,
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

  return {
    id: `${encounterId}-${spawn}-${index}`,
    templateId:
      t.id != null && (typeof t.id === "string" || typeof t.id === "number")
        ? String(t.id)
        : null,
    spawnIndex: spawn,
    name,
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
    xpReward: Math.max(0, num(t.xp_reward, 0)),
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
  };
}

export async function generateMetadata({
  params,
}: CombatEncounterPageProps): Promise<Metadata> {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);
  return {
    title: `Combate — ${code}`,
  };
}

export default async function CombatEncounterPage({
  params,
  searchParams,
}: CombatEncounterPageProps) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);
  const { debug: debugParam, zone: zoneQuery, hotspot: hotspotQuery } = await searchParams;
  const zoneCode =
    typeof zoneQuery === "string" && zoneQuery.trim().length > 0
      ? zoneQuery.trim()
      : "";
  const hotspotId =
    typeof hotspotQuery === "string" && hotspotQuery.trim().length > 0
      ? hotspotQuery.trim()
      : "";
  const showCombatDebug =
    debugParam === "1" || debugParam === "true" || debugParam === "yes";

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
    "profile_id, character_name, hp_total, hp_actual, mana_total, mana_actual, speed_total, weapon_damage_min, weapon_damage_max, str, dex, int, wis, armor_total, mr_total, active_combat_sprite";
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

  let encounterZoneId: string | null = null;
  if (zoneCode) {
    const { data: zoneRow, error: zoneError } = await supabase
      .from("zones")
      .select("id")
      .eq("code", zoneCode)
      .maybeSingle();

    if (zoneError || !zoneRow || zoneRow.id == null) {
      notFound();
    }
    encounterZoneId = String(zoneRow.id);
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

  const baseEnemySelect = `
      spawn_index,
      hp_override,
      mana_override,
      ai_profile,
      sprite_offset_x,
      sprite_offset_y,
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
    .map((row, i) => mapRowToEnemyView(String(encounter.id), row, i))
    .filter((e): e is CombatEncounterEnemyView => e !== null);

  const { data: enemyDropRows } = await supabase
    .from("enemy_drop_tables")
    .select(
      "combat_encounter_id, enemy_template_id, item_id, weapon_instance_id, equipment_instance_id, drop_chance, drop_group, min_qty, max_qty, items(id, name, description, quote_text, icon_path, sell_value, item_type_id, equip_slot, rarity, rarity_color, item_types(code)), weapon_instance(id, item_id, rarity, rarity_color, attack_damage_min, attack_damage_max, magic_damage_min, magic_damage_max, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3), equipment_instances(id, item_id, rarity, rarity_color, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3)",
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
            "id, item_id, rarity, rarity_color, attack_damage_min, attack_damage_max, magic_damage_min, magic_damage_max, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3",
          )
          .in("item_id", dropResolvedItemIds)
      : { data: [] };
  const { data: equipmentInstancePoolRows } =
    dropResolvedItemIds.length > 0
      ? await lootInstancePoolClient
          .from("equipment_instances")
          .select(
            "id, item_id, rarity, rarity_color, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3",
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

  const rollRow = (row: EnemyDropTableRow, traceId: string, source: "ungrouped" | "grouped") => {
    const chance = Math.max(0, Math.min(1, num(row.drop_chance, 0)));
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
        const chance = Math.max(0, Math.min(1, num(row.drop_chance, 0)));
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


  const combatDebug: CombatEncounterDebugPayload | null = showCombatDebug
    ? {
        encounterCode: code,
        zoneFilter: zoneCode || null,
        encounterId: String(encounter.id),
        rowsError: rowsErrorPayload,
        rawRowCount: enemyRows.length,
        mappedEnemyCount: enemies.length,
        enemies,
        rawRows: enemyRows.map((row, index) => ({
          index,
          spawn_index: row.spawn_index,
          hp_override: row.hp_override,
          mana_override: row.mana_override,
          ai_profile: row.ai_profile,
          enemyTemplate: pickTemplate(row.enemy_templates),
        })),
        lootDebug: {
          combatEncounterLootKey: code,
          dropTableRows: dropRowsSafe.map((row) => ({
            combat_encounter_id: row.combat_encounter_id,
            enemy_template_id: row.enemy_template_id,
            item_id_raw: row.item_id,
            weapon_instance_id: row.weapon_instance_id,
            equipment_instance_id: row.equipment_instance_id,
            item_id: rowItemId(row),
            item_name: rowItemName(row),
            drop_chance: num(row.drop_chance, 0),
            drop_group: row.drop_group,
            min_qty: Math.max(0, Math.trunc(num(row.min_qty, 0))),
            max_qty: Math.max(0, Math.trunc(num(row.max_qty, num(row.min_qty, 0)))),
          })),
          rollTrace: lootRollTrace,
          finalLoot: victoryLootItems,
          victoryGoldFromLoot,
        },
      }
    : null;

  const backgroundRaw = encounter.background;
  const backgroundSrc =
    typeof backgroundRaw === "string" && backgroundRaw.trim().length > 0
      ? backgroundRaw.trim()
      : null;
  const mapBaseHref = mapPathByZoneCode(zoneCode || null) ?? "/";
  const mapDisplayName =
    zoneCode === "hidden_forest"
      ? "Bosque Inexplorado"
      : encounter.name != null && String(encounter.name).trim().length > 0
        ? String(encounter.name).trim()
        : "Mapa desconocido";
  const escapeToMapHref =
    hotspotId && mapBaseHref.startsWith("/")
      ? `${mapBaseHref}?hotspot=${encodeURIComponent(hotspotId)}`
      : mapBaseHref;
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
  const playerStatStr = Math.max(0, num(userCharacter.str, 0));
  const playerStatDex = Math.max(0, num(userCharacter.dex, 0));
  const playerStatInt = Math.max(0, num(userCharacter.int, 0));
  const playerStatWis = Math.max(0, num(userCharacter.wis, 0));
  const playerArmor = Math.max(0, num(userCharacter.armor_total, 0));
  const playerMr = Math.max(0, num(userCharacter.mr_total, 0));

  /**
   * `user_character_skills.profile_id` referencia el personaje igual que `user_character.profile_id`.
   * Solo si la fila no trae ese campo usamos auth.uid() (compatibilidad).
   */
  const characterSkillsProfileId =
    typeof userCharacter.profile_id === "string" && userCharacter.profile_id.trim().length > 0
      ? userCharacter.profile_id.trim()
      : user.id;

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
  const playerSkills: CombatPlayerSkillView[] = (characterSkillRowsRaw ?? [])
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

  async function logPlayerDefeatedInGlobalLog() {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: actionUser },
    } = await supabaseAction.auth.getUser();
    if (!actionUser) return;

    const safePlayerName = escapeHtml(playerLogName);
    const safePlayerColor = escapeHtml(playerLogColor);
    const safeMapName = escapeHtml(mapDisplayName);
    const eventHtml = `<span style=\"color:${safePlayerColor}\">${safePlayerName}</span> ha caido en combate en ${safeMapName}. Prendemos una vela por él.`;

    await supabaseAction.from("global_world_event_log").insert({
      member_name: playerLogName,
      event_html: eventHtml,
    });
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
      .select("id, quantity, profile_id")
      .eq("id", safeInventoryId)
      .maybeSingle();

    if (invError || !invRow) {
      return { ok: false, error: "No se encontró el consumible en inventario." };
    }

    const profileId = typeof invRow.profile_id === "string" ? invRow.profile_id.trim() : "";
    if (profileId !== actionUser.id && profileId !== characterSkillsProfileId) {
      return { ok: false, error: "No podés consumir este objeto." };
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
      combatDebug={combatDebug}
      combatStartMessage={
        typeof encounter.combat_start_message === "string" &&
        encounter.combat_start_message.trim().length > 0
          ? encounter.combat_start_message.trim()
          : null
      }
      escapeHref={escapeToMapHref}
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
      playerStatStr={playerStatStr}
      playerStatDex={playerStatDex}
      playerStatInt={playerStatInt}
      playerStatWis={playerStatWis}
      playerArmor={playerArmor}
      playerMr={playerMr}
      playerSkills={playerSkills}
      playerConsumables={playerConsumables}
      victoryLootItems={victoryLootItems}
      victoryGoldFromLoot={victoryGoldFromLoot}
      onConsumeConsumable={consumeCombatConsumable}
      onPlayerDefeatedGlobalLog={logPlayerDefeatedInGlobalLog}
    />
  );
}
