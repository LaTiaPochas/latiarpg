import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  CombatEncounterShell,
  type CombatEncounterDebugPayload,
  type CombatEncounterEnemyView,
  type CombatEncounterEnemySkill,
  type CombatPlayerConsumableView,
  type CombatPlayerSkillView,
} from "@/components/combat/combat-encounter-shell";
import { mapPathByZoneCode } from "@/lib/game-zones";
import { normalizeEnemyTemplateAssetUrl, normalizePublicAssetUrl } from "@/lib/normalize-asset-url";
import { createClient } from "@/lib/supabase/server";

type CombatEncounterPageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ debug?: string; zone?: string }>;
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
      }
    | Array<{
        id: string;
        name: string | null;
        description: string | null;
        item_type_id: string | null;
      }>
    | null;
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

function optionalNum(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
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
  const { debug: debugParam, zone: zoneQuery } = await searchParams;
  const zoneCode =
    typeof zoneQuery === "string" && zoneQuery.trim().length > 0
      ? zoneQuery.trim()
      : "";
  const showCombatDebug =
    debugParam === "1" || debugParam === "true" || debugParam === "yes";

  const supabase = await createClient();
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
      }
    : null;

  const backgroundRaw = encounter.background;
  const backgroundSrc =
    typeof backgroundRaw === "string" && backgroundRaw.trim().length > 0
      ? backgroundRaw.trim()
      : null;
  const escapeToMapHref = mapPathByZoneCode(zoneCode || null) ?? "/";
  const playerDisplayName =
    typeof userCharacter.character_name === "string" && userCharacter.character_name.trim().length > 0
      ? userCharacter.character_name.trim().toUpperCase()
      : "AVENTURERO";
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
      "id, quantity, item_id, items!inner(id, name, description, item_type_id)",
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
        quantity: Math.max(0, Math.trunc(num(row.quantity, 0))),
      };
    })
    .filter((entry): entry is CombatPlayerConsumableView => entry !== null && entry.quantity > 0);

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
    />
  );
}
