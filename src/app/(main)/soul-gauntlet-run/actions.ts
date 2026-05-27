"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { SOUL_GAUNTLET_LOBBY_PATH, SOUL_GAUNTLET_RUN_PATH } from "@/lib/soul-gauntlet";
import {
  endActiveSoulGauntletRun,
  gauntletLobbyResultPath,
  getActiveSoulGauntletRun,
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
  const nextFloor = safeFloorWon + 1;
  const nextMax = Math.max(run.max_floor_reached, safeFloorWon);
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

export async function finalizeGauntletDeath(runId: string) {
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

  const maxFloor = run.max_floor_reached;

  await endActiveSoulGauntletRun(supabase, user.id, "death");

  // TODO: recompensas por piso alcanzado (`max_floor`) según tabla de config.

  revalidatePath(SOUL_GAUNTLET_LOBBY_PATH);
  revalidatePath(SOUL_GAUNTLET_RUN_PATH);
  redirect(gauntletLobbyResultPath(maxFloor));
}
