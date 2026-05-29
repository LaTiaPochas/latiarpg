import type { CombatEncounterEnemyView } from "@/components/combat/types";
import {
  SOUL_GAUNTLET_BASE_ENEMY_STAT_MULTIPLIER,
  SOUL_GAUNTLET_LOBBY_PATH,
  getGauntletFloorConfig,
  type SoulGauntletRunEndReason,
} from "@/lib/soul-gauntlet";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type SoulGauntletRunRow = {
  id: string;
  user_id: string;
  is_active: boolean;
  current_floor: number;
  max_floor_reached: number;
  started_at: string;
  ended_at: string | null;
  end_reason: SoulGauntletRunEndReason | null;
};

function asInt(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return fallback;
}

function scaleStat(value: number, multiplier: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.round(value * multiplier));
}

export function applyGauntletScalingToEnemies(
  enemies: CombatEncounterEnemyView[],
  floor: number,
): CombatEncounterEnemyView[] {
  const { hpMultiplier, damageMultiplier } = getGauntletFloorConfig(floor);
  const hpMult = hpMultiplier * SOUL_GAUNTLET_BASE_ENEMY_STAT_MULTIPLIER;
  const dmgMult = damageMultiplier * SOUL_GAUNTLET_BASE_ENEMY_STAT_MULTIPLIER;

  return enemies.map((enemy) => {
    const hpMax = Math.max(1, scaleStat(enemy.hpMax, hpMult));
    const mana = scaleStat(enemy.mana, hpMult);
    const attackMin = scaleStat(enemy.attackMin, dmgMult);
    const attackMax = Math.max(attackMin, scaleStat(enemy.attackMax, dmgMult));
    const magicMin = scaleStat(enemy.magicMin, dmgMult);
    const magicMax = Math.max(magicMin, scaleStat(enemy.magicMax, dmgMult));

    return {
      ...enemy,
      hpMax,
      hp: hpMax,
      mana,
      armor: scaleStat(enemy.armor, dmgMult),
      mr: scaleStat(enemy.mr, dmgMult),
      speed: scaleStat(enemy.speed, dmgMult),
      attackMin,
      attackMax,
      magicMin,
      magicMax,
    };
  });
}

export type SoulGauntletRunForFinalize = SoulGauntletRunRow & {
  reward_tier: string | null;
  death_floor: number | null;
  rewards_granted_at: string | null;
};

export async function getSoulGauntletRunByIdForUser(
  supabase: SupabaseServerClient,
  userId: string,
  runId: string,
): Promise<SoulGauntletRunForFinalize | null> {
  const safeRunId = runId.trim();
  if (!safeRunId) return null;

  const { data } = await supabase
    .from("user_soul_gauntlet_runs")
    .select(
      "id, user_id, is_active, current_floor, max_floor_reached, started_at, ended_at, end_reason, reward_tier, death_floor, rewards_granted_at",
    )
    .eq("id", safeRunId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data || typeof data.id !== "string") return null;

  return {
    id: data.id,
    user_id: data.user_id,
    is_active: data.is_active === true,
    current_floor: Math.max(1, asInt(data.current_floor, 1)),
    max_floor_reached: Math.max(0, asInt(data.max_floor_reached, 0)),
    started_at: data.started_at,
    ended_at: data.ended_at,
    end_reason:
      data.end_reason === "death" ||
      data.end_reason === "abandoned" ||
      data.end_reason === "completed"
        ? data.end_reason
        : null,
    reward_tier: typeof data.reward_tier === "string" ? data.reward_tier : null,
    death_floor:
      typeof data.death_floor === "number" && Number.isFinite(data.death_floor)
        ? Math.max(1, Math.trunc(data.death_floor))
        : null,
    rewards_granted_at:
      typeof data.rewards_granted_at === "string" && data.rewards_granted_at.trim().length > 0
        ? data.rewards_granted_at
        : null,
  };
}

export async function getActiveSoulGauntletRun(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<SoulGauntletRunRow | null> {
  const { data } = await supabase
    .from("user_soul_gauntlet_runs")
    .select("id, user_id, is_active, current_floor, max_floor_reached, started_at, ended_at, end_reason")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!data || typeof data.id !== "string") return null;

  return {
    id: data.id,
    user_id: data.user_id,
    is_active: data.is_active === true,
    current_floor: Math.max(1, asInt(data.current_floor, 1)),
    max_floor_reached: Math.max(0, asInt(data.max_floor_reached, 0)),
    started_at: data.started_at,
    ended_at: data.ended_at,
    end_reason:
      data.end_reason === "death" ||
      data.end_reason === "abandoned" ||
      data.end_reason === "completed"
        ? data.end_reason
        : null,
  };
}

export async function endActiveSoulGauntletRun(
  supabase: SupabaseServerClient,
  userId: string,
  endReason: SoulGauntletRunEndReason,
): Promise<void> {
  await supabase
    .from("user_soul_gauntlet_runs")
    .update({
      is_active: false,
      ended_at: new Date().toISOString(),
      end_reason: endReason,
    })
    .eq("user_id", userId)
    .eq("is_active", true);
}

export async function healCharacterForGauntletStart(
  supabase: SupabaseServerClient,
  profileId: string,
): Promise<void> {
  const { data: character } = await supabase
    .from("user_character")
    .select("hp_total, mana_total")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!character) return;

  const hpTotal = Math.max(1, asInt(character.hp_total, 1));
  const manaTotal = Math.max(0, asInt(character.mana_total, 0));

  await supabase
    .from("user_character")
    .update({ hp_actual: hpTotal, mana_actual: manaTotal })
    .eq("profile_id", profileId);
}

export function isGauntletSafePath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/soul-gauntlet-run" || pathname.startsWith("/soul-gauntlet-run/")) {
    return true;
  }
  if (pathname === "/combate" || pathname.startsWith("/combate/")) {
    return true;
  }
  return false;
}

export function gauntletLobbyResultPath(
  runId: string,
  floor?: number,
  options?: { completed?: boolean },
): string {
  const safeRunId = runId.trim();
  const params = new URLSearchParams({
    gauntlet_result: "1",
    run: safeRunId,
  });
  if (floor !== undefined && Number.isFinite(floor)) {
    params.set("floor", String(Math.max(1, Math.trunc(floor))));
  }
  if (options?.completed) {
    params.set("gauntlet_completed", "1");
  }
  return `${SOUL_GAUNTLET_LOBBY_PATH}?${params.toString()}`;
}
