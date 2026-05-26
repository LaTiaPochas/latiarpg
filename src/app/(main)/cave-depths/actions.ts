"use server";

import { revalidatePath } from "next/cache";

import { CAVE_DEPTHS_ZONE_CODE, zoneLookupCodeCandidates } from "@/lib/game-zones";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type CompleteCaveDepthsStoryResult = { ok: true } | { ok: false; error: string };

/** Tras el diálogo del puente, el siguiente combate es el hotspot 3 (no hay encuentro en `cave-depth-2`). */
const BRIDGE_DIALOG_UNLOCKS_COMBAT_STEP = 3;

export async function reconcileDepthsBridgeProgress(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("depths_bridge_dialog")
    .eq("user_id", user.id)
    .maybeSingle();

  if (milestones?.depths_bridge_dialog !== true) {
    return;
  }

  const zoneIds = zoneLookupCodeCandidates(CAVE_DEPTHS_ZONE_CODE);
  if (zoneIds.length === 0) return;

  const { data: currentProgress } = await supabase
    .from("user_combat_progress")
    .select("combat_step")
    .eq("user_id", user.id)
    .in("zone_id", zoneIds)
    .order("combat_step", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentStep =
    typeof currentProgress?.combat_step === "number" && currentProgress.combat_step > 0
      ? Math.trunc(currentProgress.combat_step)
      : 1;

  /** Solo migrar quien quedó en step 2 tras el puente; no pisar steps menores (p. ej. testing en 1). */
  if (currentStep !== 2) {
    return;
  }

  await ensureCaveDepthsCombatStepAtLeast(
    supabase,
    user.id,
    BRIDGE_DIALOG_UNLOCKS_COMBAT_STEP,
  );
}

async function ensureCaveDepthsCombatStepAtLeast(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  minStep: number,
): Promise<void> {
  const zoneIds = zoneLookupCodeCandidates(CAVE_DEPTHS_ZONE_CODE);
  if (zoneIds.length === 0) return;

  const { data: currentProgress } = await supabase
    .from("user_combat_progress")
    .select("id, combat_step, zone_id")
    .eq("user_id", userId)
    .in("zone_id", zoneIds)
    .order("combat_step", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentStep =
    typeof currentProgress?.combat_step === "number" && currentProgress.combat_step > 0
      ? Math.trunc(currentProgress.combat_step)
      : 1;

  if (minStep <= currentStep) return;

  const zoneId =
    typeof currentProgress?.zone_id === "string" && currentProgress.zone_id.trim().length > 0
      ? currentProgress.zone_id
      : zoneIds[0];

  if (currentProgress && typeof currentProgress.id === "number") {
    await supabase
      .from("user_combat_progress")
      .update({ combat_step: minStep })
      .eq("id", currentProgress.id);
    return;
  }

  await supabase.from("user_combat_progress").insert({
    user_id: userId,
    zone_id: zoneId,
    combat_step: minStep,
  });
}

export async function completeDepthsBridgeDialog(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("user_milestones")
    .update({ depths_bridge_dialog: true })
    .eq("user_id", user.id)
    .select("user_id");

  if (updateError) {
    return { ok: false };
  }

  if (!updatedRows || updatedRows.length === 0) {
    const { error: insertError } = await supabase.from("user_milestones").insert({
      user_id: user.id,
      depths_bridge_dialog: true,
    });
    if (insertError) {
      return { ok: false };
    }
  }

  await ensureCaveDepthsCombatStepAtLeast(
    supabase,
    user.id,
    BRIDGE_DIALOG_UNLOCKS_COMBAT_STEP,
  );

  return { ok: true };
}

/** Al terminar la escena con Hazramitor (`/cave-depths-story`), avanza `combat_step` en +1. */
export async function completeCaveDepthsStory(): Promise<CompleteCaveDepthsStoryResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "No estás autenticado." };
  }

  const zoneIds = zoneLookupCodeCandidates(CAVE_DEPTHS_ZONE_CODE);
  if (zoneIds.length === 0) {
    return { ok: false, error: "Zona de progreso no configurada." };
  }

  const { data: currentProgress, error: readError } = await supabase
    .from("user_combat_progress")
    .select("id, combat_step, zone_id")
    .eq("user_id", user.id)
    .in("zone_id", zoneIds)
    .order("combat_step", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: "No se pudo leer el progreso de la cueva." };
  }

  const currentStep =
    typeof currentProgress?.combat_step === "number" && currentProgress.combat_step > 0
      ? Math.trunc(currentProgress.combat_step)
      : 1;
  const nextStep = currentStep + 1;
  const zoneId =
    typeof currentProgress?.zone_id === "string" && currentProgress.zone_id.trim().length > 0
      ? currentProgress.zone_id
      : zoneIds[0];

  if (currentProgress && typeof currentProgress.id === "number") {
    const { error: updateError } = await supabase
      .from("user_combat_progress")
      .update({ combat_step: nextStep })
      .eq("id", currentProgress.id);
    if (updateError) {
      return { ok: false, error: "No se pudo guardar el progreso." };
    }
  } else {
    const { error: insertError } = await supabase.from("user_combat_progress").insert({
      user_id: user.id,
      zone_id: zoneId,
      combat_step: nextStep,
    });
    if (insertError) {
      return { ok: false, error: "No se pudo guardar el progreso." };
    }
  }

  revalidatePath("/cave-depths");
  revalidatePath("/cave-depths-story");

  return { ok: true };
}
