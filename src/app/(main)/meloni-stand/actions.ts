"use server";

import { revalidatePath } from "next/cache";

import { normalizeInventoryQty, type BagItemGrant, type InventoryRowForBag } from "@/lib/inventory-bag";
import {
  buildMeloniGrantedItemsFromTrade,
  buildMeloniRewardGrants,
  buildMeloniTradesForDisplay,
  buildPlayerInventoryQuantities,
  canReceiveMeloniTradeRewards,
  hasEnoughInventoryForItem,
  isMeloniTradeDateToday,
  type MeloniGrantedItem,
  type MeloniTradeRow,
} from "@/lib/meloni-trades";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export type ExecuteMeloniTradeResult =
  | { ok: true; granted: MeloniGrantedItem[] }
  | { ok: false; error: string };

type InventoryDeduction = {
  inventoryRowId: number;
  itemId: string;
  previousQuantity: number;
  wasDeleted: boolean;
};

type InventoryGrantMutation = {
  inventoryRowId: number;
  previousQuantity: number | null;
  wasInserted: boolean;
  itemId: string;
  grantedQuantity: number;
};

type SupabaseActionClient = Awaited<ReturnType<typeof createClient>>;

async function rollbackDeductions(
  supabase: SupabaseActionClient,
  profileId: string,
  deductions: InventoryDeduction[],
) {
  for (const deduction of deductions) {
    if (deduction.wasDeleted) {
      await supabase.from("user_inventory").insert({
        profile_id: profileId,
        item_id: deduction.itemId,
        quantity: deduction.previousQuantity,
      });
      continue;
    }
    await supabase
      .from("user_inventory")
      .update({ quantity: deduction.previousQuantity })
      .eq("id", deduction.inventoryRowId)
      .eq("profile_id", profileId);
  }
}

async function rollbackGrants(
  supabase: SupabaseActionClient,
  profileId: string,
  grants: InventoryGrantMutation[],
) {
  for (const grant of grants) {
    if (grant.grantedQuantity <= 0) continue;
    if (grant.wasInserted) {
      await supabase
        .from("user_inventory")
        .delete()
        .eq("id", grant.inventoryRowId)
        .eq("profile_id", profileId);
      continue;
    }
    if (grant.previousQuantity != null) {
      await supabase
        .from("user_inventory")
        .update({ quantity: grant.previousQuantity })
        .eq("id", grant.inventoryRowId)
        .eq("profile_id", profileId);
    }
  }
}

async function deductPlainItem(
  supabase: SupabaseActionClient,
  profileId: string,
  inventoryRows: InventoryRowForBag[],
  itemId: string,
  amount: number,
): Promise<
  | { ok: true; deductions: InventoryDeduction[] }
  | { ok: false; error: string; deductions: InventoryDeduction[] }
> {
  const deductions: InventoryDeduction[] = [];
  let pending = normalizeInventoryQty(amount);
  if (pending <= 0) return { ok: true, deductions };

  const eligibleRows = inventoryRows
    .filter((row) => {
      if (typeof row.item_id !== "string" || row.item_id !== itemId) return false;
      if (row.weapon_instance_id != null || row.equipment_instance_id != null) return false;
      return Number.isFinite(Number(row.id));
    })
    .sort((a, b) => Math.trunc(Number(a.id)) - Math.trunc(Number(b.id)));

  for (const row of eligibleRows) {
    if (pending <= 0) break;
    const rowId = Math.trunc(Number(row.id));
    const rowQty = normalizeInventoryQty(row.quantity);
    if (rowQty <= 0) continue;

    const deduct = Math.min(rowQty, pending);
    const nextQty = rowQty - deduct;
    const wasDeleted = nextQty <= 0;

    if (wasDeleted) {
      const { error } = await supabase
        .from("user_inventory")
        .delete()
        .eq("id", rowId)
        .eq("profile_id", profileId);
      if (error) {
        return { ok: false, error: "No se pudieron descontar los ítems del inventario.", deductions };
      }
    } else {
      const { error } = await supabase
        .from("user_inventory")
        .update({ quantity: nextQty })
        .eq("id", rowId)
        .eq("profile_id", profileId);
      if (error) {
        return { ok: false, error: "No se pudieron descontar los ítems del inventario.", deductions };
      }
    }

    deductions.push({ inventoryRowId: rowId, itemId, previousQuantity: rowQty, wasDeleted });
    const rowSnapshot = inventoryRows.find((r) => Math.trunc(Number(r.id)) === rowId);
    if (rowSnapshot) {
      rowSnapshot.quantity = wasDeleted ? 0 : nextQty;
    }
    pending -= deduct;
  }

  if (pending > 0) {
    return { ok: false, error: "No tenés suficientes ítems para este trueque.", deductions };
  }

  return { ok: true, deductions };
}

async function grantPlainItem(
  supabase: SupabaseActionClient,
  profileId: string,
  itemId: string,
  amount: number,
  isStackable: boolean,
): Promise<
  | { ok: true; mutation: InventoryGrantMutation }
  | { ok: false; error: string }
> {
  const addQty = normalizeInventoryQty(amount);
  if (addQty <= 0) {
    return {
      ok: true,
      mutation: {
        inventoryRowId: -1,
        previousQuantity: null,
        wasInserted: false,
        itemId,
        grantedQuantity: 0,
      },
    };
  }

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
      const rowId = Math.trunc(existing.id);
      const { error: updateError } = await supabase
        .from("user_inventory")
        .update({ quantity: currentQty + addQty })
        .eq("id", rowId)
        .eq("profile_id", profileId);
      if (updateError) {
        return { ok: false, error: "No se pudieron agregar los ítems al inventario." };
      }
      return {
        ok: true,
        mutation: {
          inventoryRowId: rowId,
          previousQuantity: currentQty,
          wasInserted: false,
          itemId,
          grantedQuantity: addQty,
        },
      };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("user_inventory")
      .insert({
        profile_id: profileId,
        item_id: itemId,
        quantity: addQty,
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      return { ok: false, error: "No se pudieron agregar los ítems al inventario." };
    }

    return {
      ok: true,
      mutation: {
        inventoryRowId: Math.trunc(inserted.id),
        previousQuantity: null,
        wasInserted: true,
        itemId,
        grantedQuantity: addQty,
      },
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("user_inventory")
    .insert({
      profile_id: profileId,
      item_id: itemId,
      quantity: addQty,
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    return { ok: false, error: "No se pudieron agregar los ítems al inventario." };
  }

  return {
    ok: true,
    mutation: {
      inventoryRowId: Math.trunc(inserted.id),
      previousQuantity: null,
      wasInserted: true,
      itemId,
      grantedQuantity: addQty,
    },
  };
}

function buildCostGrants(trade: MeloniTradeRow): BagItemGrant[] {
  const costs: BagItemGrant[] = [
    { itemId: trade.exchangeItem.id, quantity: trade.exchangeQuantity },
  ];
  if (trade.exchangeItem2 && trade.exchangeQuantity2 > 0) {
    costs.push({ itemId: trade.exchangeItem2.id, quantity: trade.exchangeQuantity2 });
  }
  return costs;
}

export async function executeMeloniTrade(tradeId: number): Promise<ExecuteMeloniTradeResult> {
  const parsedTradeId = Math.trunc(Number(tradeId));
  if (!Number.isFinite(parsedTradeId) || parsedTradeId <= 0) {
    return { ok: false, error: "Trueque inválido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "No estás autenticado." };
  }

  const tradesSupabase = createServiceRoleClient() ?? supabase;

  const tradeSelect =
    "id, item_id_1, item_id_2, quantity_1, quantity_2, exhange_quantity, exchange_item, exchange_item_2, exhange_quantity_2, date";

  const { data: tradeRow, error: tradeError } = await tradesSupabase
    .from("global_melonis_trades")
    .select(tradeSelect)
    .eq("id", parsedTradeId)
    .maybeSingle();

  if (tradeError || !tradeRow) {
    return { ok: false, error: "No se encontró el trueque." };
  }

  if (!isMeloniTradeDateToday(tradeRow.date)) {
    return { ok: false, error: "Este trueque no está disponible hoy." };
  }

  const itemIds = new Set<string>();
  if (typeof tradeRow.item_id_1 === "string" && tradeRow.item_id_1) itemIds.add(tradeRow.item_id_1);
  if (typeof tradeRow.item_id_2 === "string" && tradeRow.item_id_2) itemIds.add(tradeRow.item_id_2);
  if (typeof tradeRow.exchange_item === "string" && tradeRow.exchange_item) {
    itemIds.add(tradeRow.exchange_item);
  }
  if (typeof tradeRow.exchange_item_2 === "string" && tradeRow.exchange_item_2) {
    itemIds.add(tradeRow.exchange_item_2);
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("items")
    .select("id, name, icon_path, rarity_color, is_stackable")
    .in("id", [...itemIds]);

  if (itemsError) {
    return { ok: false, error: "No se pudieron cargar los ítems del trueque." };
  }

  const trades = buildMeloniTradesForDisplay([tradeRow], itemRows);
  const trade = trades[0];
  if (!trade) {
    return { ok: false, error: "El trueque no tiene ítems válidos." };
  }

  const stackableByItemId = new Map<string, boolean>(
    (itemRows ?? []).map((row) => [
      String(row.id),
      (row as { is_stackable?: boolean | null }).is_stackable === true,
    ]),
  );

  const { data: inventoryRowsRaw, error: inventoryError } = await supabase
    .from("user_inventory")
    .select("id, item_id, weapon_instance_id, equipment_instance_id, quantity")
    .eq("profile_id", user.id)
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

  const { data: equippedRows } = await supabase
    .from("user_equipment")
    .select("inventory_id")
    .eq("profile_id", user.id);

  const equippedInventoryIdSet = new Set(
    (equippedRows ?? [])
      .map((row) => row.inventory_id)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .map((value) => Math.trunc(value)),
  );

  const inventoryTotals = buildPlayerInventoryQuantities(
    inventoryRows.map((row) => ({ item_id: row.item_id, quantity: row.quantity })),
  );

  if (!hasEnoughInventoryForItem(inventoryTotals, trade.exchangeItem.id, trade.exchangeQuantity)) {
    return { ok: false, error: "No tenés suficientes ítems para este trueque." };
  }
  if (
    trade.exchangeItem2 &&
    trade.exchangeQuantity2 > 0 &&
    !hasEnoughInventoryForItem(
      inventoryTotals,
      trade.exchangeItem2.id,
      trade.exchangeQuantity2,
    )
  ) {
    return { ok: false, error: "No tenés suficientes ítems para este trueque." };
  }

  if (
    !canReceiveMeloniTradeRewards(
      trade,
      stackableByItemId,
      inventoryRows,
      equippedInventoryIdSet,
    )
  ) {
    return {
      ok: false,
      error:
        "No hay lugar en tu inventario para recibir los ítems. Liberá espacio e intentá de nuevo.",
    };
  }

  const allDeductions: InventoryDeduction[] = [];

  for (const cost of buildCostGrants(trade)) {
    const deductResult = await deductPlainItem(
      supabase,
      user.id,
      inventoryRows,
      cost.itemId,
      cost.quantity,
    );
    if (!deductResult.ok) {
      await rollbackDeductions(supabase, user.id, allDeductions);
      return { ok: false, error: deductResult.error };
    }
    allDeductions.push(...deductResult.deductions);
  }

  const grantMutations: InventoryGrantMutation[] = [];

  for (const reward of buildMeloniRewardGrants(trade)) {
    const grantResult = await grantPlainItem(
      supabase,
      user.id,
      reward.itemId,
      reward.quantity,
      stackableByItemId.get(reward.itemId) === true,
    );
    if (!grantResult.ok) {
      await rollbackGrants(supabase, user.id, grantMutations);
      await rollbackDeductions(supabase, user.id, allDeductions);
      return { ok: false, error: grantResult.error };
    }
    if (grantResult.mutation.grantedQuantity > 0) {
      grantMutations.push(grantResult.mutation);
    }
  }

  revalidatePath("/meloni-stand");
  revalidatePath("/character_profile");
  revalidatePath("/garrison");

  return { ok: true, granted: buildMeloniGrantedItemsFromTrade(trade) };
}
