"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getGameDayIsoDate } from "@/lib/game-day";
import {
  SOUL_FRAGMENT_ITEM_ID,
  SOUL_GAUNTLET_ENTRY_FRAGMENT_COST,
  SOUL_GAUNTLET_LOBBY_PATH,
  SOUL_GAUNTLET_RUN_PATH,
} from "@/lib/soul-gauntlet";
import { resolveSoulGauntletRewardTierForNewRun } from "@/lib/soul-gauntlet-rewards";
import { endActiveSoulGauntletRun, healCharacterForGauntletStart } from "@/lib/soul-gauntlet-run";
import { createClient } from "@/lib/supabase/server";

const GAUNTLET_PATH = SOUL_GAUNTLET_LOBBY_PATH;

function inventoryQuantity(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
  }
  return 0;
}

export async function completeSoulGauntletIntro() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: updatedRows } = await supabase
    .from("user_milestones")
    .update({ soul_gauntlet: true })
    .eq("user_id", user.id)
    .select("user_id");

  if (!updatedRows || updatedRows.length === 0) {
    await supabase.from("user_milestones").insert({
      user_id: user.id,
      soul_gauntlet: true,
    });
  }

  revalidatePath(GAUNTLET_PATH);
  return { ok: true as const };
}

export async function startSoulGauntletRun() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: inventoryRows } = await supabase
    .from("user_inventory")
    .select("id, quantity")
    .eq("profile_id", user.id)
    .eq("item_id", SOUL_FRAGMENT_ITEM_ID)
    .order("id", { ascending: true });

  const availableFragments = (inventoryRows ?? []).reduce(
    (total, row) => total + inventoryQuantity(row.quantity),
    0,
  );

  if (availableFragments < SOUL_GAUNTLET_ENTRY_FRAGMENT_COST) {
    redirect(GAUNTLET_PATH);
  }

  let pendingDiscount = SOUL_GAUNTLET_ENTRY_FRAGMENT_COST;
  for (const row of inventoryRows ?? []) {
    if (pendingDiscount <= 0) break;
    const rowQty = inventoryQuantity(row.quantity);
    if (rowQty <= 0) continue;
    const deduct = Math.min(rowQty, pendingDiscount);
    const nextQty = rowQty - deduct;
    if (nextQty <= 0) {
      await supabase.from("user_inventory").delete().eq("id", row.id);
    } else {
      await supabase.from("user_inventory").update({ quantity: nextQty }).eq("id", row.id);
    }
    pendingDiscount -= deduct;
  }

  if (pendingDiscount > 0) {
    redirect(GAUNTLET_PATH);
  }

  await endActiveSoulGauntletRun(supabase, user.id, "abandoned");

  const profileId =
    typeof user.id === "string" && user.id.trim().length > 0 ? user.id.trim() : user.id;
  const { data: characterRow } = await supabase
    .from("user_character")
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  const healProfileId =
    typeof characterRow?.profile_id === "string" && characterRow.profile_id.trim().length > 0
      ? characterRow.profile_id.trim()
      : user.id;
  await healCharacterForGauntletStart(supabase, healProfileId);

  const gameDay = getGameDayIsoDate();
  const rewardTier = await resolveSoulGauntletRewardTierForNewRun(supabase, user.id, gameDay);

  const { error: insertRunError } = await supabase.from("user_soul_gauntlet_runs").insert({
    user_id: user.id,
    is_active: true,
    current_floor: 1,
    max_floor_reached: 0,
    game_day: gameDay,
    reward_tier: rewardTier,
  });

  if (insertRunError) {
    redirect(GAUNTLET_PATH);
  }

  revalidatePath(GAUNTLET_PATH);
  revalidatePath(SOUL_GAUNTLET_RUN_PATH);
  revalidatePath("/character_profile");
  redirect(SOUL_GAUNTLET_RUN_PATH);
}
