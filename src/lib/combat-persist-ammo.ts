import { createClient } from "@/lib/supabase/server";

export type CombatAmmoSpentEntry = {
  inventoryId: number;
  quantitySpent: number;
};

/** Descuenta munición gastada en combate del inventario (solo servidor). */
export async function persistCombatAmmoSpent(
  profileIds: string[],
  ammoSpent: CombatAmmoSpentEntry[],
): Promise<void> {
  if (ammoSpent.length === 0 || profileIds.length === 0) return;

  const supabase = await createClient();

  for (const entry of ammoSpent) {
    const spent = Math.max(0, Math.trunc(entry.quantitySpent));
    const inventoryId = Math.max(0, Math.trunc(entry.inventoryId));
    if (spent <= 0 || inventoryId <= 0) continue;

    const { data: invRow, error: invError } = await supabase
      .from("user_inventory")
      .select("id, quantity, profile_id")
      .eq("id", inventoryId)
      .maybeSingle();

    if (invError || !invRow) continue;

    const profileId = typeof invRow.profile_id === "string" ? invRow.profile_id.trim() : "";
    if (!profileIds.includes(profileId)) continue;

    const currentQty = Math.max(0, Math.trunc(Number(invRow.quantity ?? 0)));
    const nextQty = Math.max(0, currentQty - spent);
    if (nextQty <= 0) {
      await supabase.from("user_inventory").delete().eq("id", inventoryId);
    } else {
      await supabase.from("user_inventory").update({ quantity: nextQty }).eq("id", inventoryId);
    }
  }
}
