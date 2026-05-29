import {
  evaluateBagSpaceForGrants,
  normalizeInventoryQty,
  type BagItemGrant,
  type InventoryRowForBag,
} from "@/lib/inventory-bag";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function loadInventoryContextForGrants(
  supabase: SupabaseServerClient,
  profileId: string,
): Promise<
  | {
      ok: true;
      inventoryRows: InventoryRowForBag[];
      equippedInventoryIdSet: Set<number>;
      stackableByItemId: Map<string, boolean>;
    }
  | { ok: false; error: string }
> {
  const { data: inventoryRowsRaw, error: inventoryError } = await supabase
    .from("user_inventory")
    .select("id, item_id, weapon_instance_id, equipment_instance_id, quantity")
    .eq("profile_id", profileId)
    .gt("quantity", 0);

  if (inventoryError) {
    return { ok: false, error: "No se pudo leer tu inventario." };
  }

  const inventoryRows = (inventoryRowsRaw ?? [])
    .map((row) => ({
      id: Number(row.id),
      item_id: row.item_id,
      weapon_instance_id: row.weapon_instance_id,
      equipment_instance_id: row.equipment_instance_id,
      quantity: row.quantity,
    }))
    .filter((row) => Number.isFinite(row.id)) as InventoryRowForBag[];

  const { data: equippedRows, error: equippedError } = await supabase
    .from("user_equipment")
    .select("inventory_id")
    .eq("profile_id", profileId);

  if (equippedError) {
    return { ok: false, error: "No se pudo leer tu equipamiento." };
  }

  const equippedInventoryIdSet = new Set(
    (equippedRows ?? [])
      .map((row) => row.inventory_id)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .map((value) => Math.trunc(value)),
  );

  const itemIds = [
    ...new Set(
      inventoryRows
        .map((row) => (typeof row.item_id === "string" ? row.item_id.trim() : ""))
        .filter((id) => id.length > 0),
    ),
  ];

  const stackableByItemId = new Map<string, boolean>();
  if (itemIds.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from("items")
      .select("id, is_stackable")
      .in("id", itemIds);

    if (itemsError) {
      return { ok: false, error: "No se pudieron cargar los ítems." };
    }

    for (const row of itemRows ?? []) {
      if (typeof row.id === "string") {
        stackableByItemId.set(row.id, row.is_stackable === true);
      }
    }
  }

  return { ok: true, inventoryRows, equippedInventoryIdSet, stackableByItemId };
}

async function grantPlainItem(
  supabase: SupabaseServerClient,
  profileId: string,
  itemId: string,
  amount: number,
  isStackable: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const addQty = normalizeInventoryQty(amount);
  if (addQty <= 0) return { ok: true };

  if (isStackable) {
    const { data: existingRows, error: selectError } = await supabase
      .from("user_inventory")
      .select("id, quantity")
      .eq("profile_id", profileId)
      .eq("item_id", itemId)
      .is("weapon_instance_id", null)
      .is("equipment_instance_id", null)
      .order("id", { ascending: true })
      .limit(1);

    if (selectError) {
      return { ok: false, error: "No se pudo leer tu inventario." };
    }

    const existing = existingRows?.[0];
    if (existing && typeof existing.id === "number") {
      const currentQty = normalizeInventoryQty(existing.quantity);
      const { error: updateError } = await supabase
        .from("user_inventory")
        .update({ quantity: currentQty + addQty })
        .eq("id", Math.trunc(existing.id))
        .eq("profile_id", profileId);
      if (updateError) {
        return { ok: false, error: "No se pudieron agregar los ítems al inventario." };
      }
      return { ok: true };
    }
  }

  const { error: insertError } = await supabase.from("user_inventory").insert({
    profile_id: profileId,
    item_id: itemId,
    quantity: addQty,
  });

  if (insertError) {
    return { ok: false, error: "No se pudieron agregar los ítems al inventario." };
  }

  return { ok: true };
}

export async function grantBagItemGrantsToProfile(
  supabase: SupabaseServerClient,
  profileId: string,
  grants: BagItemGrant[],
  options?: {
    stackableByItemId?: Map<string, boolean>;
    inventoryRows?: InventoryRowForBag[];
    equippedInventoryIdSet?: Set<number>;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalizedGrants = grants
    .map((grant) => ({
      itemId: grant.itemId.trim(),
      quantity: normalizeInventoryQty(grant.quantity),
    }))
    .filter((grant) => grant.itemId.length > 0 && grant.quantity > 0);

  if (normalizedGrants.length === 0) {
    return { ok: true };
  }

  const inventoryContext =
    options?.inventoryRows && options?.equippedInventoryIdSet
      ? {
          ok: true as const,
          inventoryRows: options.inventoryRows,
          equippedInventoryIdSet: options.equippedInventoryIdSet,
          stackableByItemId: options.stackableByItemId ?? new Map<string, boolean>(),
        }
      : await loadInventoryContextForGrants(supabase, profileId);

  if (!inventoryContext.ok) {
    return inventoryContext;
  }

  const grantItemIds = [...new Set(normalizedGrants.map((g) => g.itemId))];
  const stackableByItemId = new Map(inventoryContext.stackableByItemId);

  const missingItemIds = grantItemIds.filter((id) => !stackableByItemId.has(id));
  if (missingItemIds.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from("items")
      .select("id, is_stackable")
      .in("id", missingItemIds);

    if (itemsError) {
      return { ok: false, error: "No se pudieron cargar los ítems de recompensa." };
    }

    for (const row of itemRows ?? []) {
      if (typeof row.id === "string") {
        stackableByItemId.set(row.id, row.is_stackable === true);
      }
    }
  }

  const bagCheck = evaluateBagSpaceForGrants(
    normalizedGrants,
    stackableByItemId,
    inventoryContext.inventoryRows,
    inventoryContext.equippedInventoryIdSet,
  );

  if (!bagCheck.ok) {
    return bagCheck;
  }

  for (const grant of normalizedGrants) {
    const grantResult = await grantPlainItem(
      supabase,
      profileId,
      grant.itemId,
      grant.quantity,
      stackableByItemId.get(grant.itemId) === true,
    );
    if (!grantResult.ok) {
      return grantResult;
    }
  }

  return { ok: true };
}
