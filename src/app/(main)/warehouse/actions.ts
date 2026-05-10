"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type DepositToWarehouseResult =
  | { ok: true }
  | { ok: false; error: string };

export type DepositInventoryEntry = {
  inventoryRowId: number;
  quantity: number;
};

export type WithdrawWarehouseEntry = {
  globalWarehouseRowId: number;
  quantity: number;
};

/** Filas visibles en bolsa (objetos no equipados). Equipados no consumen estos espacios. */
const USER_INVENTORY_BAG_ROW_LIMIT = 24;

/** Filas del almacén de campamento (`global_warehouse.is_global_item === false`), mismas reglas de apilado que al depositar. */
const CAMP_WAREHOUSE_ROW_LIMIT = 24;

type UserInventoryRowForCapacity = {
  id: number;
  item_id: string | null;
  weapon_instance_id: number | null;
  equipment_instance_id: number | null;
  quantity: number | null;
};

type GlobalWarehouseRowForWithdraw = {
  id: number;
  item_id: string | null;
  weapon_instance_id: number | null;
  equipment_instance_id: number | null;
  quantity: unknown;
  is_global_item: boolean | null;
};

/**
 * Comprueba si el retiro cabe en la bolsa (24 filas sin equipados), simulando merges de `is_stackable`
 * en el mismo orden en que luego aplica `mergeQuantityIntoUserInventory`.
 */
function evaluateWithdrawAgainstBagCapacity(
  entries: WithdrawWarehouseEntry[],
  rowById: Map<number, GlobalWarehouseRowForWithdraw>,
  stackableByItemId: Map<string, boolean>,
  inventoryRows: UserInventoryRowForCapacity[],
  equippedInventoryIdSet: Set<number>,
): { ok: true } | { ok: false; error: string } {
  let unequippedRowCount = 0;
  const stackablePlainByItemId = new Map<string, { id: number; quantity: number }>();

  for (const row of inventoryRows) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    const invId = Math.trunc(id);
    if (equippedInventoryIdSet.has(invId)) continue;

    unequippedRowCount += 1;

    const itemId = typeof row.item_id === "string" ? row.item_id.trim() : "";
    if (!itemId) continue;
    if (row.weapon_instance_id != null || row.equipment_instance_id != null) continue;

    const currentQty = normalizeInventoryQty(row.quantity);
    const existing = stackablePlainByItemId.get(itemId);
    if (!existing || existing.id > invId) {
      stackablePlainByItemId.set(itemId, { id: invId, quantity: currentQty });
    }
  }

  let remainingSlots = Math.max(0, USER_INVENTORY_BAG_ROW_LIMIT - unequippedRowCount);
  const simStackable = new Map(stackablePlainByItemId);

  for (const entry of entries) {
    const row = rowById.get(entry.globalWarehouseRowId);
    if (!row) {
      return { ok: false, error: "No se pudieron leer todos los ítems del almacén." };
    }
    const withdrawQty = normalizeInventoryQty(entry.quantity);
    if (withdrawQty <= 0) continue;

    const hasWeapon =
      typeof row.weapon_instance_id === "number" &&
      Number.isFinite(row.weapon_instance_id) &&
      row.weapon_instance_id > 0;
    const hasEquipment =
      typeof row.equipment_instance_id === "number" &&
      Number.isFinite(row.equipment_instance_id) &&
      row.equipment_instance_id > 0;
    const itemIdTrim =
      row.item_id != null && String(row.item_id).trim().length > 0
        ? String(row.item_id).trim()
        : null;

    const itemIsStackable =
      !hasWeapon && !hasEquipment && itemIdTrim != null && stackableByItemId.get(itemIdTrim) === true;

    if (hasWeapon || hasEquipment) {
      if (remainingSlots < 1) {
        return {
          ok: false,
          error: `No hay lugar suficiente en tu inventario para retirar esta selección. Liberá espacio o depositá ítems en el almacén.`,
        };
      }
      remainingSlots -= 1;
      continue;
    }

    if (!itemIdTrim) {
      return { ok: false, error: "Un ítem no tiene datos válidos." };
    }

    if (!itemIsStackable) {
      if (remainingSlots < 1) {
        return {
          ok: false,
          error: `No hay lugar suficiente en tu inventario para retirar esta selección. Liberá espacio o depositá ítems en el almacén.`,
        };
      }
      remainingSlots -= 1;
      continue;
    }

    const existingStack = simStackable.get(itemIdTrim);
    if (existingStack) {
      simStackable.set(itemIdTrim, {
        id: existingStack.id,
        quantity: existingStack.quantity + withdrawQty,
      });
    } else {
      if (remainingSlots < 1) {
        return {
          ok: false,
          error: `Tu bolsa admite como máximo ${USER_INVENTORY_BAG_ROW_LIMIT} objetos no equipados (equipados aparte). No hay lugar suficiente para retirar esta selección. Liberá espacio o depositá ítems en el almacén.`,
        };
      }
      remainingSlots -= 1;
      simStackable.set(itemIdTrim, { id: -1, quantity: withdrawQty });
    }
  }

  return { ok: true };
}

type CampWarehouseRowForCapacity = {
  item_id: string | null;
  weapon_instance_id: number | null;
  equipment_instance_id: number | null;
  quantity: unknown;
};

type UserInventoryRowForDepositCap = {
  item_id: string | null;
  weapon_instance_id: number | null;
  equipment_instance_id: number | null;
};

/**
 * Simula el depósito en el almacén de campamento sin superar `CAMP_WAREHOUSE_ROW_LIMIT` filas,
 * con la misma lógica que `mergeQuantityIntoCampGlobalWarehouse` (instancias = fila nueva;
 * solo `item_id` apilable fusiona con fila existente del mismo ítem).
 */
function evaluateDepositAgainstCampWarehouseCapacity(
  entries: DepositInventoryEntry[],
  rowById: Map<number, UserInventoryRowForDepositCap>,
  stackableByItemId: Map<string, boolean>,
  existingCampRows: CampWarehouseRowForCapacity[],
): { ok: true } | { ok: false; error: string } {
  let rowsUsed = 0;
  /** `item_id` que ya tienen una fila solo-material en el almacén (apilable o no). */
  const plainItemIdsWithRow = new Set<string>();

  for (const r of existingCampRows) {
    const qty = normalizeInventoryQty(r.quantity);
    if (qty <= 0) continue;
    rowsUsed += 1;
    const hasWeapon =
      typeof r.weapon_instance_id === "number" &&
      Number.isFinite(r.weapon_instance_id) &&
      r.weapon_instance_id > 0;
    const hasEquipment =
      typeof r.equipment_instance_id === "number" &&
      Number.isFinite(r.equipment_instance_id) &&
      r.equipment_instance_id > 0;
    if (hasWeapon || hasEquipment) continue;
    const itemId = typeof r.item_id === "string" ? r.item_id.trim() : "";
    if (itemId) plainItemIdsWithRow.add(itemId);
  }

  let remainingSlots = Math.max(0, CAMP_WAREHOUSE_ROW_LIMIT - rowsUsed);

  for (const entry of entries) {
    const row = rowById.get(entry.inventoryRowId);
    if (!row) {
      return { ok: false, error: "No se pudieron leer todos los ítems del inventario." };
    }

    const hasWeapon =
      typeof row.weapon_instance_id === "number" &&
      Number.isFinite(row.weapon_instance_id) &&
      row.weapon_instance_id > 0;
    const hasEquipment =
      typeof row.equipment_instance_id === "number" &&
      Number.isFinite(row.equipment_instance_id) &&
      row.equipment_instance_id > 0;
    const itemIdTrim =
      row.item_id != null && String(row.item_id).trim().length > 0
        ? String(row.item_id).trim()
        : null;

    const itemIsStackable =
      !hasWeapon && !hasEquipment && itemIdTrim != null && stackableByItemId.get(itemIdTrim) === true;

    if (hasWeapon || hasEquipment) {
      if (remainingSlots < 1) {
        return {
          ok: false,
          error: `El almacén del campamento solo tiene ${CAMP_WAREHOUSE_ROW_LIMIT} espacios. No hay lugar para depositar esta selección. Retirá ítems del almacén o liberá espacio.`,
        };
      }
      remainingSlots -= 1;
      continue;
    }

    if (!itemIdTrim) {
      return { ok: false, error: "Un ítem no tiene datos válidos para el almacén." };
    }

    if (!itemIsStackable) {
      if (remainingSlots < 1) {
        return {
          ok: false,
          error: `El almacén del campamento solo tiene ${CAMP_WAREHOUSE_ROW_LIMIT} espacios. No hay lugar para depositar esta selección. Retirá ítems del almacén o liberá espacio.`,
        };
      }
      remainingSlots -= 1;
      plainItemIdsWithRow.add(itemIdTrim);
      continue;
    }

    if (plainItemIdsWithRow.has(itemIdTrim)) {
      continue;
    }

    if (remainingSlots < 1) {
      return {
        ok: false,
        error: `El almacén del campamento solo tiene ${CAMP_WAREHOUSE_ROW_LIMIT} espacios. No hay lugar para depositar esta selección. Retirá ítems del almacén o liberá espacio.`,
      };
    }
    remainingSlots -= 1;
    plainItemIdsWithRow.add(itemIdTrim);
  }

  return { ok: true };
}

function normalizeInventoryQty(value: unknown): number {
  const raw =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number(value ?? 0);
  return Math.max(0, Math.trunc(raw));
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type InventoryRowForDeposit = {
  item_id: string | null;
  weapon_instance_id: number | null;
  equipment_instance_id: number | null;
};

/**
 * Depósito en campamento (`is_global_item: false`).
 * - Arma / equipo con instancia: siempre nueva fila (nunca sumar a otra).
 * - Solo `item_id`: si `items.is_stackable`, sumar a fila existente con mismo `item_id`; si no, nueva fila.
 */
async function mergeQuantityIntoCampGlobalWarehouse(
  supabase: SupabaseServerClient,
  row: InventoryRowForDeposit,
  addQty: number,
  options: { itemIsStackable: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (addQty <= 0) {
    return { ok: false, error: "Cantidad inválida." };
  }

  const hasWeapon =
    typeof row.weapon_instance_id === "number" &&
    Number.isFinite(row.weapon_instance_id) &&
    row.weapon_instance_id > 0;
  const hasEquipment =
    typeof row.equipment_instance_id === "number" &&
    Number.isFinite(row.equipment_instance_id) &&
    row.equipment_instance_id > 0;

  const insertPayload = {
    item_id: row.item_id,
    weapon_instance_id: hasWeapon ? row.weapon_instance_id : null,
    equipment_instance_id: hasEquipment ? row.equipment_instance_id : null,
    quantity: addQty,
    is_global_item: false,
  };

  if (hasWeapon || hasEquipment) {
    const { error: insErr } = await supabase.from("global_warehouse").insert(insertPayload);
    if (insErr) {
      return { ok: false, error: "No se pudo depositar en el almacén global." };
    }
    return { ok: true };
  }

  const itemId =
    row.item_id != null && String(row.item_id).trim().length > 0
      ? String(row.item_id).trim()
      : null;
  if (!itemId) {
    return { ok: false, error: "Ítem sin referencia para el almacén." };
  }

  if (!options.itemIsStackable) {
    const { error: insErr } = await supabase.from("global_warehouse").insert(insertPayload);
    if (insErr) {
      return { ok: false, error: "No se pudo depositar en el almacén global." };
    }
    return { ok: true };
  }

  const { data: foundRows, error: selErr } = await supabase
    .from("global_warehouse")
    .select("id, quantity")
    .eq("is_global_item", false)
    .eq("item_id", itemId)
    .is("weapon_instance_id", null)
    .is("equipment_instance_id", null)
    .limit(1);

  if (selErr) {
    return { ok: false, error: "No se pudo leer el almacén global." };
  }

  const existing = foundRows?.[0];
  if (existing && typeof existing.id === "number") {
    const current = normalizeInventoryQty(existing.quantity);
    const { error: upErr } = await supabase
      .from("global_warehouse")
      .update({ quantity: current + addQty })
      .eq("id", existing.id);
    if (upErr) {
      return { ok: false, error: "No se pudo actualizar el almacén global." };
    }
    return { ok: true };
  }

  const { error: insErr } = await supabase.from("global_warehouse").insert(insertPayload);
  if (insErr) {
    return { ok: false, error: "No se pudo depositar en el almacén global." };
  }
  return { ok: true };
}

/**
 * Suma cantidad al inventario del usuario (`profile_id`).
 * Misma regla que el warehouse inverso: instancias siempre fila nueva; solo `item_id` usa `items.is_stackable` para fusionar.
 */
async function mergeQuantityIntoUserInventory(
  supabase: SupabaseServerClient,
  profileId: string,
  row: InventoryRowForDeposit,
  addQty: number,
  options: { itemIsStackable: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (addQty <= 0) {
    return { ok: false, error: "Cantidad inválida." };
  }

  const hasWeapon =
    typeof row.weapon_instance_id === "number" &&
    Number.isFinite(row.weapon_instance_id) &&
    row.weapon_instance_id > 0;
  const hasEquipment =
    typeof row.equipment_instance_id === "number" &&
    Number.isFinite(row.equipment_instance_id) &&
    row.equipment_instance_id > 0;

  const insertPayload = {
    profile_id: profileId,
    item_id: row.item_id,
    weapon_instance_id: hasWeapon ? row.weapon_instance_id : null,
    equipment_instance_id: hasEquipment ? row.equipment_instance_id : null,
    quantity: addQty,
  };

  if (hasWeapon || hasEquipment) {
    const { error: insErr } = await supabase.from("user_inventory").insert(insertPayload);
    if (insErr) {
      return { ok: false, error: "No se pudo agregar a tu inventario." };
    }
    return { ok: true };
  }

  const itemId =
    row.item_id != null && String(row.item_id).trim().length > 0
      ? String(row.item_id).trim()
      : null;
  if (!itemId) {
    return { ok: false, error: "Ítem sin referencia para el inventario." };
  }

  if (!options.itemIsStackable) {
    const { error: insErr } = await supabase.from("user_inventory").insert(insertPayload);
    if (insErr) {
      return { ok: false, error: "No se pudo agregar a tu inventario." };
    }
    return { ok: true };
  }

  const { data: foundRows, error: selErr } = await supabase
    .from("user_inventory")
    .select("id, quantity")
    .eq("profile_id", profileId)
    .eq("item_id", itemId)
    .is("weapon_instance_id", null)
    .is("equipment_instance_id", null)
    .limit(1);

  if (selErr) {
    return { ok: false, error: "No se pudo leer tu inventario." };
  }

  const existing = foundRows?.[0];
  if (existing && typeof existing.id === "number") {
    const current = normalizeInventoryQty(existing.quantity);
    const { error: upErr } = await supabase
      .from("user_inventory")
      .update({ quantity: current + addQty })
      .eq("id", existing.id)
      .eq("profile_id", profileId);
    if (upErr) {
      return { ok: false, error: "No se pudo actualizar tu inventario." };
    }
    return { ok: true };
  }

  const { error: insErr } = await supabase.from("user_inventory").insert(insertPayload);
  if (insErr) {
    return { ok: false, error: "No se pudo agregar a tu inventario." };
  }
  return { ok: true };
}

/**
 * Mueve cantidades de `user_inventory` a `global_warehouse` (`is_global_item: false`).
 * Objetos con instancia de arma/equipo solo se pueden depositar completos (cantidad = fila); siempre nueva fila en el warehouse.
 * Solo `item_id`: si `items.is_stackable`, se suma a la fila de campamento con el mismo `item_id`; si no, nueva fila.
 */
export async function depositInventoryToGlobalWarehouse(
  rawEntries: DepositInventoryEntry[],
): Promise<DepositToWarehouseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "No estás autenticado." };
  }

  const mergedById = new Map<number, number>();
  for (const entry of rawEntries) {
    const id = Math.max(0, Math.trunc(Number(entry.inventoryRowId)));
    const q = Math.max(0, Math.trunc(Number(entry.quantity)));
    if (id <= 0 || q <= 0) {
      return { ok: false, error: "Cantidad o ítem inválido." };
    }
    mergedById.set(id, (mergedById.get(id) ?? 0) + q);
  }

  const entries: DepositInventoryEntry[] = Array.from(mergedById.entries()).map(
    ([inventoryRowId, quantity]) => ({ inventoryRowId, quantity }),
  );
  if (entries.length === 0) {
    return { ok: false, error: "No hay ítems para depositar." };
  }

  const uniqueIds = entries.map((e) => e.inventoryRowId);

  const { data: rows, error: readError } = await supabase
    .from("user_inventory")
    .select("id, profile_id, item_id, weapon_instance_id, equipment_instance_id, quantity")
    .eq("profile_id", user.id)
    .in("id", uniqueIds);

  if (readError || !rows || rows.length !== uniqueIds.length) {
    return { ok: false, error: "No se pudieron leer todos los ítems del inventario." };
  }

  for (const row of rows) {
    if (row.profile_id !== user.id) {
      return { ok: false, error: "Un ítem no pertenece a tu perfil." };
    }
  }

  const { data: equippedRows } = await supabase
    .from("user_equipment")
    .select("inventory_id")
    .eq("profile_id", user.id);
  const equippedIds = new Set(
    (equippedRows ?? [])
      .map((r) => r.inventory_id)
      .filter((id): id is number => typeof id === "number" && Number.isFinite(id)),
  );

  const rowById = new Map(rows.map((r) => [r.id, r]));

  for (const entry of entries) {
    const row = rowById.get(entry.inventoryRowId);
    if (!row) {
      return { ok: false, error: "No se pudieron leer todos los ítems del inventario." };
    }
    const rowQty = normalizeInventoryQty(row.quantity);
    if (rowQty <= 0) {
      return { ok: false, error: "Un ítem tiene cantidad inválida." };
    }
    if (entry.quantity > rowQty) {
      return { ok: false, error: "No podés depositar más cantidad de la que tenés." };
    }
    if (equippedIds.has(row.id)) {
      return { ok: false, error: "No podés depositar un objeto equipado." };
    }
    const hasItem = row.item_id != null && String(row.item_id).trim().length > 0;
    const hasWeapon =
      typeof row.weapon_instance_id === "number" &&
      Number.isFinite(row.weapon_instance_id) &&
      row.weapon_instance_id > 0;
    const hasEquipment =
      typeof row.equipment_instance_id === "number" &&
      Number.isFinite(row.equipment_instance_id) &&
      row.equipment_instance_id > 0;
    if (!hasItem && !hasWeapon && !hasEquipment) {
      return { ok: false, error: "Un ítem no tiene datos válidos para el almacén." };
    }
    if ((hasWeapon || hasEquipment) && entry.quantity !== rowQty) {
      return { ok: false, error: "Este objeto solo se puede depositar completo." };
    }
  }

  const plainItemIdsForStackableLookup = new Set<string>();
  for (const entry of entries) {
    const row = rowById.get(entry.inventoryRowId)!;
    const hasWeapon =
      typeof row.weapon_instance_id === "number" &&
      Number.isFinite(row.weapon_instance_id) &&
      row.weapon_instance_id > 0;
    const hasEquipment =
      typeof row.equipment_instance_id === "number" &&
      Number.isFinite(row.equipment_instance_id) &&
      row.equipment_instance_id > 0;
    if (hasWeapon || hasEquipment) continue;
    const iid =
      row.item_id != null && String(row.item_id).trim().length > 0
        ? String(row.item_id).trim()
        : null;
    if (iid) plainItemIdsForStackableLookup.add(iid);
  }

  const stackableByItemId = new Map<string, boolean>();
  if (plainItemIdsForStackableLookup.size > 0) {
    const { data: itemMetaRows, error: itemMetaError } = await supabase
      .from("items")
      .select("id, is_stackable")
      .in("id", Array.from(plainItemIdsForStackableLookup));
    if (itemMetaError) {
      return { ok: false, error: "No se pudo leer la definición de los ítems." };
    }
    for (const meta of itemMetaRows ?? []) {
      const id = meta.id != null ? String(meta.id).trim() : "";
      if (!id) continue;
      stackableByItemId.set(id, meta.is_stackable === true);
    }
  }

  const { data: existingCampWarehouseRows, error: campWarehouseReadError } = await supabase
    .from("global_warehouse")
    .select("item_id, weapon_instance_id, equipment_instance_id, quantity")
    .eq("is_global_item", false)
    .gt("quantity", 0);

  if (campWarehouseReadError) {
    return { ok: false, error: "No se pudo leer el almacén del campamento." };
  }

  const depositCap = evaluateDepositAgainstCampWarehouseCapacity(
    entries,
    rowById as Map<number, UserInventoryRowForDepositCap>,
    stackableByItemId,
    (existingCampWarehouseRows ?? []) as CampWarehouseRowForCapacity[],
  );
  if (!depositCap.ok) {
    return depositCap;
  }

  for (const entry of entries) {
    const row = rowById.get(entry.inventoryRowId)!;
    const rowQty = normalizeInventoryQty(row.quantity);
    const depositQty = entry.quantity;

    const hasWeapon =
      typeof row.weapon_instance_id === "number" &&
      Number.isFinite(row.weapon_instance_id) &&
      row.weapon_instance_id > 0;
    const hasEquipment =
      typeof row.equipment_instance_id === "number" &&
      Number.isFinite(row.equipment_instance_id) &&
      row.equipment_instance_id > 0;

    const itemIdTrim =
      row.item_id != null && String(row.item_id).trim().length > 0
        ? String(row.item_id).trim()
        : null;
    const itemIsStackable =
      !hasWeapon && !hasEquipment && itemIdTrim != null && stackableByItemId.get(itemIdTrim) === true;

    const merged = await mergeQuantityIntoCampGlobalWarehouse(supabase, row, depositQty, {
      itemIsStackable,
    });
    if (!merged.ok) {
      return merged;
    }

    if (depositQty >= rowQty) {
      const { error: deleteError } = await supabase
        .from("user_inventory")
        .delete()
        .eq("id", row.id)
        .eq("profile_id", user.id);
      if (deleteError) {
        return { ok: false, error: "Se depositó pero no se pudo vaciar del inventario. Contactá soporte." };
      }
    } else {
      const { error: updateError } = await supabase
        .from("user_inventory")
        .update({ quantity: rowQty - depositQty })
        .eq("id", row.id)
        .eq("profile_id", user.id);
      if (updateError) {
        return { ok: false, error: "Se depositó pero no se pudo actualizar tu inventario. Contactá soporte." };
      }
    }
  }

  revalidatePath("/warehouse");
  revalidatePath("/character_profile");
  return { ok: true };
}

/**
 * Mueve cantidades de `global_warehouse` (campamento, `is_global_item: false`) a `user_inventory` del usuario.
 * Misma lógica de apilado que el depósito, en sentido inverso.
 */
export async function withdrawGlobalWarehouseToInventory(
  rawEntries: WithdrawWarehouseEntry[],
): Promise<DepositToWarehouseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "No estás autenticado." };
  }

  const mergedById = new Map<number, number>();
  for (const entry of rawEntries) {
    const id = Math.max(0, Math.trunc(Number(entry.globalWarehouseRowId)));
    const q = Math.max(0, Math.trunc(Number(entry.quantity)));
    if (id <= 0 || q <= 0) {
      return { ok: false, error: "Cantidad o ítem inválido." };
    }
    mergedById.set(id, (mergedById.get(id) ?? 0) + q);
  }

  const entries: WithdrawWarehouseEntry[] = Array.from(mergedById.entries()).map(
    ([globalWarehouseRowId, quantity]) => ({ globalWarehouseRowId, quantity }),
  );
  if (entries.length === 0) {
    return { ok: false, error: "No hay ítems para retirar." };
  }

  const uniqueIds = entries.map((e) => e.globalWarehouseRowId);

  const { data: rows, error: readError } = await supabase
    .from("global_warehouse")
    .select("id, item_id, weapon_instance_id, equipment_instance_id, quantity, is_global_item")
    .in("id", uniqueIds);

  if (readError || !rows || rows.length !== uniqueIds.length) {
    return { ok: false, error: "No se pudieron leer todos los ítems del almacén." };
  }

  const rowById = new Map(rows.map((r) => [r.id, r]));

  for (const entry of entries) {
    const row = rowById.get(entry.globalWarehouseRowId);
    if (!row) {
      return { ok: false, error: "No se pudieron leer todos los ítems del almacén." };
    }
    if (row.is_global_item === true) {
      return { ok: false, error: "Este objeto no se puede retirar del almacén." };
    }
    const rowQty = normalizeInventoryQty(row.quantity);
    if (rowQty <= 0) {
      return { ok: false, error: "Un ítem tiene cantidad inválida." };
    }
    if (entry.quantity > rowQty) {
      return { ok: false, error: "No podés retirar más cantidad de la que hay en el almacén." };
    }
    const hasItem = row.item_id != null && String(row.item_id).trim().length > 0;
    const hasWeapon =
      typeof row.weapon_instance_id === "number" &&
      Number.isFinite(row.weapon_instance_id) &&
      row.weapon_instance_id > 0;
    const hasEquipment =
      typeof row.equipment_instance_id === "number" &&
      Number.isFinite(row.equipment_instance_id) &&
      row.equipment_instance_id > 0;
    if (!hasItem && !hasWeapon && !hasEquipment) {
      return { ok: false, error: "Un ítem no tiene datos válidos." };
    }
    if ((hasWeapon || hasEquipment) && entry.quantity !== rowQty) {
      return { ok: false, error: "Este objeto solo se puede retirar completo." };
    }
  }

  const plainItemIdsForStackableLookup = new Set<string>();
  for (const entry of entries) {
    const row = rowById.get(entry.globalWarehouseRowId)!;
    const hasWeapon =
      typeof row.weapon_instance_id === "number" &&
      Number.isFinite(row.weapon_instance_id) &&
      row.weapon_instance_id > 0;
    const hasEquipment =
      typeof row.equipment_instance_id === "number" &&
      Number.isFinite(row.equipment_instance_id) &&
      row.equipment_instance_id > 0;
    if (hasWeapon || hasEquipment) continue;
    const iid =
      row.item_id != null && String(row.item_id).trim().length > 0
        ? String(row.item_id).trim()
        : null;
    if (iid) plainItemIdsForStackableLookup.add(iid);
  }

  const stackableByItemId = new Map<string, boolean>();
  if (plainItemIdsForStackableLookup.size > 0) {
    const { data: itemMetaRows, error: itemMetaError } = await supabase
      .from("items")
      .select("id, is_stackable")
      .in("id", Array.from(plainItemIdsForStackableLookup));
    if (itemMetaError) {
      return { ok: false, error: "No se pudo leer la definición de los ítems." };
    }
    for (const meta of itemMetaRows ?? []) {
      const id = meta.id != null ? String(meta.id).trim() : "";
      if (!id) continue;
      stackableByItemId.set(id, meta.is_stackable === true);
    }
  }

  const { data: bagRowsForCap, error: bagCapError } = await supabase
    .from("user_inventory")
    .select("id, item_id, weapon_instance_id, equipment_instance_id, quantity")
    .eq("profile_id", user.id)
    .gt("quantity", 0);

  if (bagCapError) {
    return { ok: false, error: "No se pudo leer tu inventario." };
  }

  const { data: equippedForCap, error: eqCapError } = await supabase
    .from("user_equipment")
    .select("inventory_id")
    .eq("profile_id", user.id);

  if (eqCapError) {
    return { ok: false, error: "No se pudo verificar tu equipo." };
  }

  const equippedIdSetForCap = new Set<number>(
    (equippedForCap ?? [])
      .map((r) => Number(r.inventory_id))
      .filter((n) => Number.isFinite(n))
      .map((n) => Math.trunc(n)),
  );

  const inventoryRowsForCap: UserInventoryRowForCapacity[] = (bagRowsForCap ?? []).flatMap((r) => {
    const id = Number(r.id);
    if (!Number.isFinite(id)) return [];
    return [
      {
        id: Math.trunc(id),
        item_id: r.item_id,
        weapon_instance_id: r.weapon_instance_id,
        equipment_instance_id: r.equipment_instance_id,
        quantity: r.quantity,
      },
    ];
  });

  const rowByIdForCap = rowById as Map<number, GlobalWarehouseRowForWithdraw>;

  const capacityCheck = evaluateWithdrawAgainstBagCapacity(
    entries,
    rowByIdForCap,
    stackableByItemId,
    inventoryRowsForCap,
    equippedIdSetForCap,
  );
  if (!capacityCheck.ok) {
    return capacityCheck;
  }

  for (const entry of entries) {
    const row = rowById.get(entry.globalWarehouseRowId)!;
    const rowQty = normalizeInventoryQty(row.quantity);
    const withdrawQty = entry.quantity;

    const hasWeapon =
      typeof row.weapon_instance_id === "number" &&
      Number.isFinite(row.weapon_instance_id) &&
      row.weapon_instance_id > 0;
    const hasEquipment =
      typeof row.equipment_instance_id === "number" &&
      Number.isFinite(row.equipment_instance_id) &&
      row.equipment_instance_id > 0;

    const itemIdTrim =
      row.item_id != null && String(row.item_id).trim().length > 0
        ? String(row.item_id).trim()
        : null;
    const itemIsStackable =
      !hasWeapon && !hasEquipment && itemIdTrim != null && stackableByItemId.get(itemIdTrim) === true;

    const merged = await mergeQuantityIntoUserInventory(supabase, user.id, row, withdrawQty, {
      itemIsStackable,
    });
    if (!merged.ok) {
      return merged;
    }

    if (withdrawQty >= rowQty) {
      const { error: deleteError } = await supabase.from("global_warehouse").delete().eq("id", row.id);
      if (deleteError) {
        return { ok: false, error: "Se agregó a tu inventario pero no se pudo vaciar el almacén. Contactá soporte." };
      }
    } else {
      const { error: updateError } = await supabase
        .from("global_warehouse")
        .update({ quantity: rowQty - withdrawQty })
        .eq("id", row.id);
      if (updateError) {
        return { ok: false, error: "Se agregó a tu inventario pero no se pudo actualizar el almacén. Contactá soporte." };
      }
    }
  }

  revalidatePath("/warehouse");
  revalidatePath("/character_profile");
  return { ok: true };
}
