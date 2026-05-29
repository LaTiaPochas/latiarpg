"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getGameDayIsoDate } from "@/lib/game-day";
import {
  SOUL_GAUNTLET_LOBBY_PATH,
  SOUL_GAUNTLET_MAX_FLOOR,
  SOUL_GAUNTLET_RUN_PATH,
} from "@/lib/soul-gauntlet";
import {
  grantSoulGauntletDeathRewards,
  isSoulGauntletRewardTier,
  serializeGrantedRewardsSnapshot,
  type SoulGauntletRewardTier,
} from "@/lib/soul-gauntlet-rewards";
import {
  endActiveSoulGauntletRun,
  gauntletLobbyResultPath,
  getActiveSoulGauntletRun,
  getSoulGauntletRunByIdForUser,
} from "@/lib/soul-gauntlet-run";
import { createClient } from "@/lib/supabase/server";

export async function abandonActiveSoulGauntletRun() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await endActiveSoulGauntletRun(supabase, user.id, "abandoned");
  revalidatePath(SOUL_GAUNTLET_RUN_PATH);
  revalidatePath(SOUL_GAUNTLET_LOBBY_PATH);
}

function asNonNegativeInt(value: unknown): number {
  return Math.max(0, Math.trunc(Number.isFinite(Number(value)) ? Number(value) : 0));
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function persistGauntletFloorRewards(
  supabase: SupabaseServerClient,
  userId: string,
  runId: string,
  rewardFloor: number,
  rewardTier: SoulGauntletRewardTier,
) {
  const safeFloor = Math.max(1, Math.trunc(rewardFloor));
  const rewardResult = await grantSoulGauntletDeathRewards(supabase, userId, safeFloor, rewardTier);
  const rewardsGrantedAt = new Date().toISOString();
  const grantedRewardsJson = rewardResult.ok
    ? serializeGrantedRewardsSnapshot(rewardResult.granted)
    : [];

  await supabase
    .from("user_soul_gauntlet_runs")
    .update({
      death_floor: safeFloor,
      rewards_granted_at: rewardsGrantedAt,
      rewards_inventory_error: rewardResult.ok ? null : rewardResult.error,
      granted_rewards: grantedRewardsJson,
    })
    .eq("id", runId)
    .eq("user_id", userId);

  return rewardResult;
}

export async function finalizeGauntletVictory(
  runId: string,
  floorWon: number,
  finalHp: number,
  finalMana: number,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const run = await getActiveSoulGauntletRun(supabase, user.id);
  if (!run || run.id !== runId) {
    redirect(SOUL_GAUNTLET_LOBBY_PATH);
  }

  const safeFloorWon = Math.max(1, Math.trunc(floorWon));
  if (safeFloorWon !== run.current_floor) {
    redirect(SOUL_GAUNTLET_LOBBY_PATH);
  }

  const safeFinalHp = asNonNegativeInt(finalHp);
  const safeFinalMana = asNonNegativeInt(finalMana);

  const { data: characterRow } = await supabase
    .from("user_character")
    .select("hp_total, mana_total")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (characterRow) {
    const hpTotal = Math.max(1, asNonNegativeInt(characterRow.hp_total));
    const manaTotal = asNonNegativeInt(characterRow.mana_total);
    await supabase
      .from("user_character")
      .update({
        hp_actual: Math.min(hpTotal, safeFinalHp),
        mana_actual: Math.min(manaTotal, safeFinalMana),
      })
      .eq("profile_id", user.id);
  }

  if (safeFloorWon >= SOUL_GAUNTLET_MAX_FLOOR) {
    const runDetails = await getSoulGauntletRunByIdForUser(supabase, user.id, run.id);
    const rewardTier = isSoulGauntletRewardTier(runDetails?.reward_tier)
      ? runDetails.reward_tier
      : "first_daily";

    await persistGauntletFloorRewards(
      supabase,
      user.id,
      run.id,
      SOUL_GAUNTLET_MAX_FLOOR,
      rewardTier,
    );

    await supabase
      .from("user_soul_gauntlet_runs")
      .update({
        max_floor_reached: SOUL_GAUNTLET_MAX_FLOOR,
        current_floor: SOUL_GAUNTLET_MAX_FLOOR,
      })
      .eq("id", run.id)
      .eq("user_id", user.id);

    await endActiveSoulGauntletRun(supabase, user.id, "completed");

    revalidatePath(SOUL_GAUNTLET_LOBBY_PATH);
    revalidatePath(SOUL_GAUNTLET_RUN_PATH);
    revalidatePath("/character_profile");
    redirect(
      gauntletLobbyResultPath(run.id, SOUL_GAUNTLET_MAX_FLOOR, { completed: true }),
    );
  }

  const nextFloor = safeFloorWon + 1;
  const nextMax = Math.max(run.max_floor_reached, safeFloorWon);

  await supabase
    .from("user_soul_gauntlet_runs")
    .update({
      max_floor_reached: nextMax,
      current_floor: nextFloor,
    })
    .eq("id", run.id)
    .eq("user_id", user.id)
    .eq("is_active", true);

  revalidatePath(SOUL_GAUNTLET_RUN_PATH);
  redirect(SOUL_GAUNTLET_RUN_PATH);
}

export async function finalizeGauntletDeath(runId: string, deathFloor: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const safeRunId = runId.trim();
  const safeDeathFloor = Math.max(1, Math.trunc(deathFloor));
  const run = await getSoulGauntletRunByIdForUser(supabase, user.id, safeRunId);
  if (!run) {
    redirect(SOUL_GAUNTLET_LOBBY_PATH);
  }

  const resultFloor = run.death_floor ?? safeDeathFloor;

  if (run.rewards_granted_at) {
    redirect(
      gauntletLobbyResultPath(run.id, resultFloor, {
        completed: run.end_reason === "completed",
      }),
    );
  }

  if (run.is_active && safeDeathFloor !== run.current_floor) {
    redirect(SOUL_GAUNTLET_LOBBY_PATH);
  }

  const rewardTier = isSoulGauntletRewardTier(run.reward_tier) ? run.reward_tier : "first_daily";

  await persistGauntletFloorRewards(supabase, user.id, run.id, safeDeathFloor, rewardTier);

  if (run.is_active) {
    await endActiveSoulGauntletRun(supabase, user.id, "death");
  }

  revalidatePath(SOUL_GAUNTLET_LOBBY_PATH);
  revalidatePath(SOUL_GAUNTLET_RUN_PATH);
  revalidatePath("/character_profile");
  redirect(gauntletLobbyResultPath(run.id, safeDeathFloor));
}
