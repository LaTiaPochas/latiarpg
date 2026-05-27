"use server";

import { redirect } from "next/navigation";
import {
  type ComponentInventoryRow,
  type RecipeComponentRow,
  maxCraftCountFromMaterials,
  randomIdFromRows,
  recipeComponentEntries,
  parseInstanceRowId,
  resolveCraftedCatalogItemIdFromRecipeRow,
  resolveCraftInstanceKindFromRecipeRow,
  resolveRecipeComponentItemType,
  resolveRecipeCraftOutputQuantity,
} from "@/lib/herreria-craft-recipe";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export type CraftRecipeResult = { ok: true } | { ok: false; error: string };

type MaterialDeduction = {
  inventoryRowId: number;
  itemId: string;
  previousQuantity: number;
  wasDeleted: boolean;
};

async function fetchInstancePoolRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "weapon_instance" | "equipment_instances",
  craftedItemId: string,
): Promise<Array<{ id: unknown }>> {
  const { data: userPool, error: userPoolError } = await supabase
    .from(table)
    .select("id")
    .eq("item_id", craftedItemId);

  if (!userPoolError && (userPool ?? []).length > 0) {
    return userPool as Array<{ id: unknown }>;
  }

  const serviceClient = createServiceRoleClient();
  if (serviceClient) {
    const { data: adminPool, error: adminPoolError } = await serviceClient
      .from(table)
      .select("id")
      .eq("item_id", craftedItemId);
    if (!adminPoolError && (adminPool ?? []).length > 0) {
      return adminPool as Array<{ id: unknown }>;
    }
    if (adminPoolError) {
      console.error("[herreria][fetchInstancePoolRows] service role query failed", {
        table,
        craftedItemId,
        message: adminPoolError.message,
        code: adminPoolError.code,
      });
    }
  }

  if (userPoolError) {
    console.error("[herreria][fetchInstancePoolRows] user query failed", {
      table,
      craftedItemId,
      message: userPoolError.message,
      code: userPoolError.code,
    });
  }

  return (userPool ?? []) as Array<{ id: unknown }>;
}

async function pickCraftInstanceId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  kind: "weapon" | "equipment",
  craftedItemId: string,
): Promise<number | null> {
  const table = kind === "weapon" ? "weapon_instance" : "equipment_instances";

  const pool = await fetchInstancePoolRows(supabase, table, craftedItemId);
  if (pool.length === 0) return null;

  const { data: ownedRows } = await supabase
    .from("user_inventory")
    .select("weapon_instance_id, equipment_instance_id")
    .eq("profile_id", profileId)
    .gt("quantity", 0);

  const ownedIds = new Set(
    (ownedRows ?? [])
      .map((row) =>
        parseInstanceRowId(kind === "weapon" ? row.weapon_instance_id : row.equipment_instance_id),
      )
      .filter((value): value is number => value !== null),
  );

  const availablePool = pool.filter((row) => {
    const instanceId = parseInstanceRowId(row.id);
    return instanceId != null && !ownedIds.has(instanceId);
  });
  return randomIdFromRows(availablePool);
}

type InstancedInventoryInsertPayload = {
  profile_id: string;
  quantity: number;
  weapon_instance_id?: number;
  equipment_instance_id?: number;
};

async function insertInstancedCraftReward(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: InstancedInventoryInsertPayload,
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const { error: userInsertError } = await supabase.from("user_inventory").insert(payload);
  if (!userInsertError) {
    return { ok: true };
  }

  const serviceClient = createServiceRoleClient();
  if (serviceClient) {
    const { error: adminInsertError } = await serviceClient.from("user_inventory").insert(payload);
    if (!adminInsertError) {
      return { ok: true };
    }
    return { ok: false, error: adminInsertError.message, code: adminInsertError.code };
  }

  return { ok: false, error: userInsertError.message, code: userInsertError.code };
}

async function rollbackMaterialDeductions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  deductions: MaterialDeduction[],
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

export async function craftRecipe(
  recipeId: string,
  recipeLevel: number,
  craftCount = 1,
): Promise<CraftRecipeResult> {
  const safeRecipeId = typeof recipeId === "string" ? recipeId.trim() : "";
  const parsedRecipeLevel = Math.max(0, Math.trunc(Number(recipeLevel) || 0));
  const parsedCraftCount = Math.max(1, Math.trunc(Number(craftCount) || 1));
  if (!safeRecipeId || parsedRecipeLevel <= 0) {
    return { ok: false, error: "Receta inválida." };
  }

  const supabaseAction = await createClient();
  const {
    data: { user: currentUser },
  } = await supabaseAction.auth.getUser();

  if (!currentUser) {
    redirect("/login");
  }

  const { data: globalRecipeRow } = await supabaseAction
    .from("global_herreria")
    .select("recipe_id, recipe_level")
    .eq("recipe_id", safeRecipeId)
    .maybeSingle();
  const currentGlobalLevel =
    typeof globalRecipeRow?.recipe_level === "number" && Number.isFinite(globalRecipeRow.recipe_level)
      ? Math.max(0, Math.trunc(globalRecipeRow.recipe_level))
      : 0;
  if (currentGlobalLevel !== parsedRecipeLevel) {
    return { ok: false, error: "Chane no tiene esa receta en ese nivel." };
  }

  const { data: recipeComponentData } = await supabaseAction
    .from("recipe_components")
    .select("*")
    .eq("recipe_id", safeRecipeId)
    .eq("recipe_level", parsedRecipeLevel)
    .maybeSingle();
  const recipeComponent = recipeComponentData as RecipeComponentRow | null;
  const craftedCatalogItemId = resolveCraftedCatalogItemIdFromRecipeRow(recipeComponent);
  const recipeItemType = resolveRecipeComponentItemType(recipeComponent);
  const craftInstanceKind = resolveCraftInstanceKindFromRecipeRow(recipeComponent);
  const componentEntries = recipeComponent ? recipeComponentEntries(recipeComponent) : [];

  if (!recipeComponent || !craftedCatalogItemId || componentEntries.length === 0) {
    return { ok: false, error: "La receta no tiene componentes configurados." };
  }

  const requiredByItemId = new Map<string, number>();
  for (const entry of componentEntries) {
    requiredByItemId.set(entry.itemId, (requiredByItemId.get(entry.itemId) ?? 0) + entry.quantity);
  }
  const requiredItemIds = Array.from(requiredByItemId.keys());

  const { data: inventoryRows } = await supabaseAction
    .from("user_inventory")
    .select("id, item_id, quantity")
    .eq("profile_id", currentUser.id)
    .in("item_id", requiredItemIds)
    .order("id", { ascending: true });

  const ownedByItemId = new Map<string, number>();
  for (const row of (inventoryRows ?? []) as ComponentInventoryRow[]) {
    if (typeof row.item_id !== "string" || row.item_id.trim().length === 0) continue;
    const quantity =
      typeof row.quantity === "number" && Number.isFinite(row.quantity)
        ? Math.max(0, Math.trunc(row.quantity))
        : 0;
    ownedByItemId.set(row.item_id, (ownedByItemId.get(row.item_id) ?? 0) + quantity);
  }

  const isConsumableCraft = recipeItemType === "consumable";

  const maxCraftCount = maxCraftCountFromMaterials(requiredByItemId, ownedByItemId);
  if (maxCraftCount < 1) {
    return { ok: false, error: "No tenés materiales suficientes." };
  }

  const craftBatchCount = isConsumableCraft ? Math.min(parsedCraftCount, maxCraftCount) : 1;
  if (!isConsumableCraft && parsedCraftCount > 1) {
    return { ok: false, error: "Solo los consumibles se pueden craftear en cantidad." };
  }

  for (const [itemId, requiredQuantity] of requiredByItemId) {
    if ((ownedByItemId.get(itemId) ?? 0) < requiredQuantity * craftBatchCount) {
      return { ok: false, error: "No tenés materiales suficientes." };
    }
  }

  let weaponInstanceId: number | null = null;
  let equipmentInstanceId: number | null = null;

  if (craftInstanceKind === "weapon") {
    weaponInstanceId = await pickCraftInstanceId(
      supabaseAction,
      currentUser.id,
      "weapon",
      craftedCatalogItemId,
    );
    if (weaponInstanceId == null) {
      return {
        ok: false,
        error:
          "No hay una variante de arma disponible para craftear (revisá weapon_instance.item_id = crafted_item).",
      };
    }
  } else if (craftInstanceKind === "equipment") {
    equipmentInstanceId = await pickCraftInstanceId(
      supabaseAction,
      currentUser.id,
      "equipment",
      craftedCatalogItemId,
    );
    if (equipmentInstanceId == null) {
      return {
        ok: false,
        error:
          "No hay una variante de equipamiento disponible para craftear (revisá equipment_instances.item_id = crafted_item).",
      };
    }
  }

  const craftOutputQuantity = resolveRecipeCraftOutputQuantity(recipeComponent) * craftBatchCount;

  const { data: craftedItemMeta } = await supabaseAction
    .from("items")
    .select("is_stackable")
    .eq("id", craftedCatalogItemId)
    .maybeSingle();
  const craftedItemIsStackable = craftedItemMeta?.is_stackable === true;

  const { data: inventoryRowsForCraftCapacity } = await supabaseAction
    .from("user_inventory")
    .select("id")
    .eq("profile_id", currentUser.id)
    .gt("quantity", 0);
  const { data: equippedRowsForCraftCapacity } = await supabaseAction
    .from("user_equipment")
    .select("inventory_id")
    .eq("profile_id", currentUser.id);
  const equippedCraftInventoryIds = new Set(
    (equippedRowsForCraftCapacity ?? [])
      .map((row) => row.inventory_id)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
  );
  const unequippedCraftInventoryCount = (inventoryRowsForCraftCapacity ?? []).reduce(
    (total, row) => {
      const id = typeof row.id === "number" && Number.isFinite(row.id) ? Math.trunc(row.id) : null;
      if (id == null || equippedCraftInventoryIds.has(id)) return total;
      return total + 1;
    },
    0,
  );

  const needsNewInventorySlot = async (): Promise<boolean> => {
    const { data: existingStackRows } = await supabaseAction
      .from("user_inventory")
      .select("id")
      .eq("profile_id", currentUser.id)
      .eq("item_id", craftedCatalogItemId)
      .is("weapon_instance_id", null)
      .is("equipment_instance_id", null)
      .gt("quantity", 0)
      .limit(1);
    return (existingStackRows ?? []).length === 0;
  };

  const isInstancedReward = weaponInstanceId != null || equipmentInstanceId != null;
  if (isInstancedReward && unequippedCraftInventoryCount >= 24) {
    return { ok: false, error: "Liberá espacio en el inventario para poder craftear." };
  }

  if (!isInstancedReward) {
    const requiresNewSlot = craftedItemIsStackable ? await needsNewInventorySlot() : true;
    if (requiresNewSlot && unequippedCraftInventoryCount >= 24) {
      return { ok: false, error: "Liberá espacio en el inventario para poder craftear." };
    }
  }

  const deductions: MaterialDeduction[] = [];

  for (const [itemId, requiredQuantity] of requiredByItemId) {
    let pendingDiscount = requiredQuantity * craftBatchCount;
    for (const row of (inventoryRows ?? []) as ComponentInventoryRow[]) {
      if (pendingDiscount <= 0) break;
      if (row.item_id !== itemId || typeof row.id !== "number") continue;
      const rowQty =
        typeof row.quantity === "number" && Number.isFinite(row.quantity)
          ? Math.max(0, Math.trunc(row.quantity))
          : 0;
      if (rowQty <= 0) continue;
      const deduct = Math.min(rowQty, pendingDiscount);
      const nextQty = rowQty - deduct;
      deductions.push({
        inventoryRowId: Math.trunc(row.id),
        itemId,
        previousQuantity: rowQty,
        wasDeleted: nextQty <= 0,
      });
      if (nextQty <= 0) {
        const { error: deleteError } = await supabaseAction
          .from("user_inventory")
          .delete()
          .eq("id", row.id);
        if (deleteError) {
          await rollbackMaterialDeductions(supabaseAction, currentUser.id, deductions.slice(0, -1));
          return { ok: false, error: "No se pudieron descontar los materiales." };
        }
      } else {
        const { error: updateError } = await supabaseAction
          .from("user_inventory")
          .update({ quantity: nextQty })
          .eq("id", row.id);
        if (updateError) {
          await rollbackMaterialDeductions(supabaseAction, currentUser.id, deductions.slice(0, -1));
          return { ok: false, error: "No se pudieron descontar los materiales." };
        }
      }
      pendingDiscount -= deduct;
    }
  }

  if (isInstancedReward) {
    const insertPayload: InstancedInventoryInsertPayload =
      craftInstanceKind === "weapon" && weaponInstanceId != null
        ? {
            profile_id: currentUser.id,
            quantity: 1,
            weapon_instance_id: weaponInstanceId,
          }
        : {
            profile_id: currentUser.id,
            quantity: 1,
            equipment_instance_id: equipmentInstanceId ?? undefined,
          };

    const insertResult = await insertInstancedCraftReward(supabaseAction, insertPayload);
    if (!insertResult.ok) {
      console.error("[herreria][craftRecipe] insert instanced item failed", {
        craftedCatalogItemId,
        recipeItemType,
        craftInstanceKind,
        weaponInstanceId,
        equipmentInstanceId,
        message: insertResult.error,
        code: insertResult.code,
      });
      await rollbackMaterialDeductions(supabaseAction, currentUser.id, deductions);
      return {
        ok: false,
        error: "No se pudo agregar el ítem al inventario. Los materiales fueron devueltos.",
      };
    }

    return { ok: true };
  }

  if (craftedItemIsStackable) {
    const { data: existingStackRows, error: existingStackError } = await supabaseAction
      .from("user_inventory")
      .select("id, quantity")
      .eq("profile_id", currentUser.id)
      .eq("item_id", craftedCatalogItemId)
      .is("weapon_instance_id", null)
      .is("equipment_instance_id", null)
      .order("id", { ascending: true })
      .limit(1);

    if (existingStackError) {
      await rollbackMaterialDeductions(supabaseAction, currentUser.id, deductions);
      return { ok: false, error: "No se pudo leer tu inventario." };
    }

    const existingStack = (existingStackRows ?? [])[0] as ComponentInventoryRow | undefined;
    if (existingStack && typeof existingStack.id === "number") {
      const currentQty =
        typeof existingStack.quantity === "number" && Number.isFinite(existingStack.quantity)
          ? Math.max(0, Math.trunc(existingStack.quantity))
          : 0;
      const { error: updateInventoryError } = await supabaseAction
        .from("user_inventory")
        .update({ quantity: currentQty + craftOutputQuantity })
        .eq("id", existingStack.id)
        .eq("profile_id", currentUser.id);

      if (updateInventoryError) {
        await rollbackMaterialDeductions(supabaseAction, currentUser.id, deductions);
        return { ok: false, error: "No se pudo agregar el ítem al inventario." };
      }
    } else {
      const { error: insertInventoryError } = await supabaseAction.from("user_inventory").insert({
        profile_id: currentUser.id,
        item_id: craftedCatalogItemId,
        quantity: craftOutputQuantity,
      });

      if (insertInventoryError) {
        await rollbackMaterialDeductions(supabaseAction, currentUser.id, deductions);
        return { ok: false, error: "No se pudo agregar el ítem al inventario." };
      }
    }
  } else {
    const { error: insertInventoryError } = await supabaseAction.from("user_inventory").insert({
      profile_id: currentUser.id,
      item_id: craftedCatalogItemId,
      quantity: craftOutputQuantity,
    });

    if (insertInventoryError) {
      await rollbackMaterialDeductions(supabaseAction, currentUser.id, deductions);
      return { ok: false, error: "No se pudo agregar el ítem al inventario." };
    }
  }

  return { ok: true };
}
