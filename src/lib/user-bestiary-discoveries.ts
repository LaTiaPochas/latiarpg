import type { SupabaseClient } from "@supabase/supabase-js";

export function collectEnemyTemplateIds(
  templateIds: readonly (string | null | undefined)[],
): string[] {
  const unique = new Set<string>();
  for (const raw of templateIds) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (id) unique.add(id);
  }
  return [...unique];
}

/**
 * Marca enemigos del encuentro como vistos (user_bestiary_discoveries).
 * Idempotente: no pisa discovered_at si ya existía.
 */
export async function recordUserBestiaryDiscoveries(
  supabase: SupabaseClient,
  userId: string,
  enemyTemplateIds: readonly (string | null | undefined)[],
): Promise<void> {
  const templateIds = collectEnemyTemplateIds(enemyTemplateIds);
  if (templateIds.length === 0) return;

  const rows = templateIds.map((enemy_template_id) => ({
    user_id: userId,
    enemy_template_id,
  }));

  await supabase.from("user_bestiary_discoveries").upsert(rows, {
    onConflict: "user_id,enemy_template_id",
    ignoreDuplicates: true,
  });
}
