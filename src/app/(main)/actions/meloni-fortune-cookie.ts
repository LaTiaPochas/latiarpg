"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { FORTUNE_COOKIE_ITEM_ID } from "@/lib/fortune-cookie-item";
import { insertWorldEventLog } from "@/lib/world-event-log";
import { createClient } from "@/lib/supabase/server";

const MELONI_GALLETTA_GIVEN_MILESTONE_TITLE = "meloni_galleta_given";
const WORLD_EVENT_JOURNAL_GOLD = "#e8c060";

function resolvePlayerName(input: string | null | undefined, fallback: string): string {
  const value = input?.trim();
  return value ? value : fallback;
}

function capitalizeFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function giveFortuneCookieToMeloni(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existingMilestone } = await supabase
    .from("global_milestones")
    .select("is_completed")
    .eq("title", MELONI_GALLETTA_GIVEN_MILESTONE_TITLE)
    .maybeSingle();

  if (existingMilestone?.is_completed === true) {
    revalidatePath("/");
    revalidatePath("/garrison");
    return { ok: true };
  }

  const { data: inventoryRows } = await supabase
    .from("user_inventory")
    .select("id, quantity")
    .eq("profile_id", user.id)
    .eq("item_id", FORTUNE_COOKIE_ITEM_ID)
    .gt("quantity", 0)
    .order("id", { ascending: true });

  const available = (inventoryRows ?? []).reduce(
    (total, row) => total + (typeof row.quantity === "number" ? Math.max(0, row.quantity) : 0),
    0,
  );
  if (available <= 0) {
    return { ok: false, error: "No tenés una galleta de la fortuna." };
  }

  let pendingDiscount = 1;
  for (const row of inventoryRows ?? []) {
    if (pendingDiscount <= 0) break;
    const rowQty = typeof row.quantity === "number" ? row.quantity : 0;
    if (rowQty <= 0) continue;
    const deduct = Math.min(rowQty, pendingDiscount);
    const nextQty = rowQty - deduct;
    if (nextQty <= 0) {
      const { error: deleteError } = await supabase.from("user_inventory").delete().eq("id", row.id);
      if (deleteError) {
        return { ok: false, error: "No se pudo quitar la galleta del inventario." };
      }
    } else {
      const { error: updateError } = await supabase
        .from("user_inventory")
        .update({ quantity: nextQty })
        .eq("id", row.id);
      if (updateError) {
        return { ok: false, error: "No se pudo quitar la galleta del inventario." };
      }
    }
    pendingDiscount -= deduct;
  }

  const { error: milestoneError } = await supabase
    .from("global_milestones")
    .update({
      current_value: 1,
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq("title", MELONI_GALLETTA_GIVEN_MILESTONE_TITLE);

  if (milestoneError) {
    return { ok: false, error: "No se pudo registrar el hito global." };
  }

  const { data: userCharacter } = await supabase
    .from("user_character")
    .select("character_name")
    .eq("profile_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("miembro")
    .eq("id", user.id)
    .maybeSingle();

  const fallbackName = user.email?.split("@")[0] ?? "Aventurero";
  const playerName = capitalizeFirst(
    resolvePlayerName(
      typeof userCharacter?.character_name === "string" ? userCharacter.character_name : null,
      resolvePlayerName(profile?.miembro, fallbackName),
    ),
  );

  const safePlayerName = escapeHtml(playerName);
  const safeGold = escapeHtml(WORLD_EVENT_JOURNAL_GOLD);
  const eventHtml = `<span style="color:${safeGold};font-weight:700;">¡${safePlayerName} convenció a Meloni de unirse a la base de la Tía!</span>`;

  await insertWorldEventLog(supabase, user.id, {
    happened_at: new Date().toISOString(),
    member_name: playerName,
    event_html: eventHtml,
  });

  revalidatePath("/");
  revalidatePath("/garrison");
  return { ok: true };
}
