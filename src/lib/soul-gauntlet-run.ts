import type { CombatEncounterEnemyView } from "@/components/combat/combat-encounter-shell";
import {
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

  return enemies.map((enemy) => {
    const hpMax = Math.max(1, scaleStat(enemy.hpMax, hpMultiplier));
    return {
      ...enemy,
      hpMax,
      hp: hpMax,
      attackMin: scaleStat(enemy.attackMin, damageMultiplier),
      attackMax: Math.max(
        scaleStat(enemy.attackMin, damageMultiplier),
        scaleStat(enemy.attackMax, damageMultiplier),
      ),
      magicMin: scaleStat(enemy.magicMin, damageMultiplier),
      magicMax: Math.max(
        scaleStat(enemy.magicMin, damageMultiplier),
        scaleStat(enemy.magicMax, damageMultiplier),
      ),
    };
  });
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
      data.end_reason === "death" || data.end_reason === "abandoned" ? data.end_reason : null,
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

export function gauntletLobbyResultPath(maxFloor: number): string {
  const safe = Math.max(0, Math.trunc(maxFloor));
  return `${SOUL_GAUNTLET_LOBBY_PATH}?gauntlet_result=1&floor=${safe}`;
}
