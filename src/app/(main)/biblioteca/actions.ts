"use server";

import { revalidatePath } from "next/cache";

import { buildBestiarioEnemyEntries, type BibliotecaBestiarioEnemyEntry } from "@/lib/biblioteca-bestiario-entries";
import {
  groupDiscoveredZonesByOrder,
  parseBibliotecaZoneRows,
  type BibliotecaBestiarioZoneGroup,
} from "@/lib/biblioteca-bestiario-zones";
import type { BibliotecaStatsPayload, BibliotecaUserStatRow } from "@/lib/biblioteca-user-stats";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export type { BibliotecaBestiarioEnemyEntry } from "@/lib/biblioteca-bestiario-entries";
export type { BibliotecaBestiarioZoneGroup } from "@/lib/biblioteca-bestiario-zones";
export type { BibliotecaStatsPayload, BibliotecaUserStatRow } from "@/lib/biblioteca-user-stats";

const BIBLIOTECA_PATH = "/biblioteca";

export async function completeBibliotecaConstructionDialog() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const };
  }

  const { data: updatedRows } = await supabase
    .from("user_milestones")
    .update({ biblioteca_construction_dialog: true })
    .eq("user_id", user.id)
    .select("user_id");

  if (!updatedRows || updatedRows.length === 0) {
    await supabase.from("user_milestones").insert({
      user_id: user.id,
      biblioteca_construction_dialog: true,
    });
  }

  revalidatePath(BIBLIOTECA_PATH);
  revalidatePath("/garrison");
  return { ok: true as const };
}

export async function fetchAllUserStatsForBiblioteca(): Promise<
  { ok: true; data: BibliotecaStatsPayload } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "No autenticado." };
  }

  // Service role si existe; si no, el cliente autenticado + políticas RLS de biblioteca.
  const readClient = createServiceRoleClient() ?? supabase;
  const { data, error } = await readClient.from("user_stats").select("*");

  if (error) {
    return { ok: false, error: error.message };
  }

  const stats = (data ?? []) as BibliotecaUserStatRow[];

  return { ok: true, data: { stats } };
}

export async function fetchDiscoveredZonesForBestiario(): Promise<
  { ok: true; data: BibliotecaBestiarioZoneGroup[] } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "No autenticado." };
  }

  const readClient = createServiceRoleClient() ?? supabase;
  const { data, error } = await readClient
    .from("zones")
    .select("id, code, name, zone_order, discovered_zone")
    .eq("discovered_zone", true)
    .order("zone_order", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  const zones = parseBibliotecaZoneRows(data ?? []);
  return { ok: true, data: groupDiscoveredZonesByOrder(zones) };
}

export async function fetchBestiarioEnemiesForZoneGroup(
  zoneIds: string[],
): Promise<
  { ok: true; data: BibliotecaBestiarioEnemyEntry[] } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "No autenticado." };
  }

  const normalizedZoneIds = [...new Set(zoneIds.map((id) => id.trim()).filter(Boolean))];
  if (normalizedZoneIds.length === 0) {
    return { ok: true, data: [] };
  }

  const readClient = createServiceRoleClient() ?? supabase;
  const { data: catalogRows, error: catalogError } = await readClient
    .from("zone_bestiary_entries")
    .select(
      `
      zone_id,
      enemy_template_id,
      sort_order,
      is_hidden_until_discovered,
      enemy_templates (
        id,
        name,
        sprite_path
      )
    `,
    )
    .in("zone_id", normalizedZoneIds)
    .order("sort_order", { ascending: true });

  if (catalogError) {
    return { ok: false, error: catalogError.message };
  }

  const templateIds = new Set<string>();
  for (const row of catalogRows ?? []) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const templateId =
      typeof record.enemy_template_id === "string"
        ? record.enemy_template_id.trim()
        : record.enemy_template_id != null
          ? String(record.enemy_template_id).trim()
          : "";
    if (templateId) templateIds.add(templateId);
  }

  const discoveredTemplateIds = new Set<string>();
  if (templateIds.size > 0) {
    const { data: discoveryRows, error: discoveryError } = await supabase
      .from("user_bestiary_discoveries")
      .select("enemy_template_id, discovered_at")
      .in("enemy_template_id", [...templateIds]);

    if (discoveryError) {
      return { ok: false, error: discoveryError.message };
    }

    for (const row of discoveryRows ?? []) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      if (record.discovered_at == null) continue;
      const templateId =
        typeof record.enemy_template_id === "string"
          ? record.enemy_template_id.trim()
          : record.enemy_template_id != null
            ? String(record.enemy_template_id).trim()
            : "";
      if (templateId) discoveredTemplateIds.add(templateId);
    }
  }

  return {
    ok: true,
    data: buildBestiarioEnemyEntries(catalogRows ?? [], discoveredTemplateIds),
  };
}
