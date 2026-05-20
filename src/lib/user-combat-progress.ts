import type { SupabaseClient } from "@supabase/supabase-js";

import { zoneLookupCodeCandidates } from "@/lib/game-zones";

export async function getUserCombatStepForZone(
  supabase: SupabaseClient,
  userId: string,
  zoneCode: string,
): Promise<number> {
  const candidates = zoneLookupCodeCandidates(zoneCode);
  const zoneIds =
    candidates.length > 0 ? candidates : [zoneCode.trim()].filter((value) => value.length > 0);
  if (zoneIds.length === 0) {
    return 1;
  }

  const { data: progressRow } = await supabase
    .from("user_combat_progress")
    .select("combat_step")
    .eq("user_id", userId)
    .in("zone_id", zoneIds)
    .order("combat_step", { ascending: false })
    .limit(1)
    .maybeSingle();

  return typeof progressRow?.combat_step === "number" && progressRow.combat_step > 0
    ? Math.trunc(progressRow.combat_step)
    : 1;
}
