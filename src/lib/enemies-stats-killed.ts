import type { SupabaseClient } from "@supabase/supabase-js";

export type CreatureKillIncrements = Record<string, number>;

export function buildCreatureKillIncrements(
  creatureTypes: readonly (string | null | undefined)[],
): CreatureKillIncrements {
  const increments: CreatureKillIncrements = {};

  for (const raw of creatureTypes) {
    const creatureType = typeof raw === "string" ? raw.trim() : "";
    if (!creatureType) continue;
    increments[creatureType] = (increments[creatureType] ?? 0) + 1;
  }

  return increments;
}

/** Un round-trip: incrementa kill_count por creature_type vía RPC en Postgres. */
export async function recordEnemyCreatureKills(
  supabase: SupabaseClient,
  defeatedCreatureTypes: readonly (string | null | undefined)[],
): Promise<void> {
  const pKills = buildCreatureKillIncrements(defeatedCreatureTypes);
  if (Object.keys(pKills).length === 0) return;

  await supabase.rpc("increment_enemies_stats_killed", { p_kills: pKills });
}
