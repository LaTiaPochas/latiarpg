/** Filas visibles en bolsa (objetos no equipados). Equipados no consumen estos espacios. */
export const USER_INVENTORY_BAG_ROW_LIMIT = 24;

export function normalizeInventoryQty(value: unknown): number {
  const raw =
    typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? 0);
  return Math.max(0, Math.trunc(raw));
}

export type InventoryRowForBag = {
  id: number;
  item_id: string | null;
  weapon_instance_id: number | null;
  equipment_instance_id: number | null;
  quantity: number | null;
};

export type BagItemGrant = {
  itemId: string;
  quantity: number;
};

/**
 * Simula si los ítems caben en la bolsa (24 filas sin equipados), fusionando `is_stackable`.
 */
export function evaluateBagSpaceForGrants(
  grants: BagItemGrant[],
  stackableByItemId: Map<string, boolean>,
  inventoryRows: InventoryRowForBag[],
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

  for (const grant of grants) {
    const addQty = normalizeInventoryQty(grant.quantity);
    if (addQty <= 0) continue;

    const itemIdTrim = grant.itemId.trim();
    if (!itemIdTrim) {
      return { ok: false, error: "Un ítem del trueque no es válido." };
    }

    const itemIsStackable = stackableByItemId.get(itemIdTrim) === true;

    if (!itemIsStackable) {
      const existingStack = simStackable.get(itemIdTrim);
      if (existingStack) {
        simStackable.set(itemIdTrim, {
          id: existingStack.id,
          quantity: existingStack.quantity + addQty,
        });
      } else {
        if (remainingSlots < 1) {
          return {
            ok: false,
            error: `No hay lugar en tu inventario para recibir los ítems (máximo ${USER_INVENTORY_BAG_ROW_LIMIT} objetos en la bolsa). Liberá espacio e intentá de nuevo.`,
          };
        }
        remainingSlots -= 1;
        simStackable.set(itemIdTrim, { id: -1, quantity: addQty });
      }
      continue;
    }

    const existingStack = simStackable.get(itemIdTrim);
    if (existingStack) {
      simStackable.set(itemIdTrim, {
        id: existingStack.id,
        quantity: existingStack.quantity + addQty,
      });
    } else {
      if (remainingSlots < 1) {
        return {
          ok: false,
          error: `No hay lugar en tu inventario para recibir los ítems (máximo ${USER_INVENTORY_BAG_ROW_LIMIT} objetos en la bolsa). Liberá espacio e intentá de nuevo.`,
        };
      }
      remainingSlots -= 1;
      simStackable.set(itemIdTrim, { id: -1, quantity: addQty });
    }
  }

  return { ok: true };
}
