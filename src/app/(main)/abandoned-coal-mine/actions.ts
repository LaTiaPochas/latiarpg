"use server";

import { revalidatePath } from "next/cache";

import { resolveInventoryIconPath } from "@/lib/inventory-icon-path";
import { rollAbandonedCoalMineEnemyCombatCode } from "@/lib/abandoned-coal-mine-enemy-combats";
import { rollAbandonedMineGatherOutcome } from "@/lib/abandoned-mine-gather-outcomes";
import { createClient } from "@/lib/supabase/server";

import type { GatherNearWoodsResult, NearWoodsGrantedItemView } from "@/app/(main)/near-woods/actions";

/** Drops fijos (piedra se resuelve por ítem en BD, igual que herrería). */
const ABANDONED_MINE_DROP_ITEM_IDS: Record<string, string> = {
  potion: "77cc0fd9-3dff-4c10-b127-6b212d2bd9e1",
  medium_potion: "65130711-55e7-461a-a72a-ecc54b7c327f",
  oro: "8438bdcd-b4b6-412c-8a54-0dcdb6636289",
  soul_fragment: "bc413d4a-0bab-42df-a24e-54d6a4d11b0d",
  piedra: "e2b70f4d-19d5-4406-bcd9-23c8820c1505",
  aguas: "ecd74ed8-b2de-4bb9-b109-3fd4f27e8955",
  coal: "1f85956f-9f81-46d5-a067-c6c6dc6fa398",
  iron: "45b352bd-4ac3-40fd-b7fc-87b008e9a607",
  bones: "1d341344-135a-447b-a2cd-6ef7bf3d035f"
};

const RELAXING_WATER_GLOBAL_ITEM_ID = "ecd74ed8-b2de-4bb9-b109-3fd4f27e8955";

/** Pico de Piedra — mismo que `abandoned-coal-mine/page.tsx`. */
const STONE_PICKAXE_ITEM_ID = "817548a0-9037-4cd7-b03b-0b78ea34f340";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/** Misma búsqueda que la herrería: ítem “piedra” en BD. */
async function resolveStoneItemId(supabase: ServerSupabase): Promise<string | null> {
  const { data: stoneItem } = await supabase
    .from("items")
    .select("id")
    .or("icon_path.ilike.%resource_rock%,name.ilike.%piedra%,name.ilike.%stone%")
    .limit(1)
    .maybeSingle();
  return typeof stoneItem?.id === "string" ? stoneItem.id : null;
}

function mapItemsRowToGrantedView(data: unknown, grantedQuantity = 1): NearWoodsGrantedItemView | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : null;
  const name = typeof row.name === "string" ? row.name : null;
  if (!id || !name) return null;

  const itemTypesRaw = row.item_types;
  const typeJoin = Array.isArray(itemTypesRaw) ? itemTypesRaw[0] : itemTypesRaw;
  const codeRaw =
    typeJoin && typeof typeJoin === "object" && typeJoin !== null && "code" in typeJoin
      ? (typeJoin as { code?: unknown }).code
      : null;
  const itemTypeCode =
    typeof codeRaw === "string" && codeRaw.trim().length > 0 ? codeRaw.trim().toLowerCase() : null;

  const description =
    typeof row.description === "string" && row.description.trim().length > 0
      ? row.description.trim()
      : "Sin descripción.";
  const quoteText =
    typeof row.quote_text === "string" && row.quote_text.trim().length > 0
      ? row.quote_text.trim()
      : null;

  const sellValueRaw = row.sell_value;
  const sellValue =
    typeof sellValueRaw === "number" && Number.isFinite(sellValueRaw)
      ? Math.max(0, Math.trunc(sellValueRaw))
      : 0;

  const itemTypeIdRaw = row.item_type_id;
  const itemTypeId =
    typeof itemTypeIdRaw === "number" && Number.isFinite(itemTypeIdRaw)
      ? Math.trunc(itemTypeIdRaw)
      : null;

  const rarityColor =
    typeof row.rarity_color === "string" && row.rarity_color.trim().length > 0
      ? row.rarity_color.trim()
      : null;

  const qty =
    typeof grantedQuantity === "number" && Number.isFinite(grantedQuantity)
      ? Math.max(1, Math.trunc(grantedQuantity))
      : 1;

  return {
    id,
    name,
    description,
    quoteText,
    iconPath: resolveInventoryIconPath(typeof row.icon_path === "string" ? row.icon_path : null),
    sellValue,
    itemTypeId,
    itemTypeCode,
    rarityColor,
    grantedQuantity: qty,
  };
}

export type MineAbandonedCoalMineResult = GatherNearWoodsResult;

/**
 * Minar: probabilidades como Bosque Mágico (`ABANDONED_MINE_GATHER_OUTCOMES`), recurso principal `piedra` 1–3,
 * encuentros con `rollAbandonedCoalMineEnemyCombatCode` (`abandoned-coal-mine-1` … `5`).
 */
export async function mineAbandonedCoalMine(): Promise<MineAbandonedCoalMineResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "No estás autenticado." };
  }

  const { data: pickaxeRows } = await supabase
    .from("user_inventory")
    .select("quantity")
    .eq("profile_id", user.id)
    .eq("item_id", STONE_PICKAXE_ITEM_ID)
    .gt("quantity", 0)
    .limit(1);
  if (!pickaxeRows || pickaxeRows.length === 0) {
    return { ok: false, error: "Necesitás un Pico de Piedra para minar." };
  }

  const rolled = rollAbandonedMineGatherOutcome();
  const { result, chance } = rolled;

  if (result === "aguas") {
    const { data: globalWarehouseRow, error: gwSelectError } = await supabase
      .from("global_warehouse")
      .select("quantity")
      .eq("item_id", RELAXING_WATER_GLOBAL_ITEM_ID)
      .eq("is_global_item", true)
      .maybeSingle();

    if (gwSelectError) {
      return { ok: false, error: "No se pudo leer el almacén global." };
    }

    const currentGlobalQty =
      typeof globalWarehouseRow?.quantity === "number" && Number.isFinite(globalWarehouseRow.quantity)
        ? Math.max(0, Math.trunc(globalWarehouseRow.quantity))
        : 0;

    if (globalWarehouseRow) {
      const { error: gwUpdateError } = await supabase
        .from("global_warehouse")
        .update({ quantity: currentGlobalQty + 1 })
        .eq("item_id", RELAXING_WATER_GLOBAL_ITEM_ID)
        .eq("is_global_item", true);

      if (gwUpdateError) {
        return { ok: false, error: "No se pudo actualizar el almacén global." };
      }
    } else {
      const { error: gwInsertError } = await supabase.from("global_warehouse").insert({
        item_id: RELAXING_WATER_GLOBAL_ITEM_ID,
        quantity: 1,
        is_global_item: true,
      });

      if (gwInsertError) {
        return { ok: false, error: "No se pudo actualizar el almacén global." };
      }
    }

    const { data: relaxingWaterItemRow } = await supabase
      .from("items")
      .select("id, name, description, quote_text, icon_path, sell_value, item_type_id, rarity_color, item_types(code)")
      .eq("id", RELAXING_WATER_GLOBAL_ITEM_ID)
      .maybeSingle();

    const previewItem = mapItemsRowToGrantedView(relaxingWaterItemRow);

    revalidatePath("/abandoned-coal-mine");
    revalidatePath("/character_profile");
    revalidatePath("/relaxing_waters_stand");
    revalidatePath("/garrison");
    return { ok: true, result, chance, granted: false as const, previewItem };
  }

  if (result === "enemy") {
    const encounterCode = rollAbandonedCoalMineEnemyCombatCode();
    revalidatePath("/abandoned-coal-mine");
    revalidatePath("/character_profile");
    return {
      ok: true,
      result,
      chance,
      granted: false as const,
      encounterCode,
    };
  }

  let itemId: string | null = null;
  if (result === "piedra") {
    itemId = await resolveStoneItemId(supabase);
    if (!itemId) {
      return { ok: false, error: "No se encontró el ítem piedra en la base de datos." };
    }
  } else {
    itemId = ABANDONED_MINE_DROP_ITEM_IDS[result] ?? null;
    if (!itemId) {
      return { ok: false, error: "Resultado sin ítem configurado." };
    }
  }

  const grantQuantity = result === "piedra" ? Math.floor(Math.random() * 3) + 1 : 1;

  const { data: existingRows, error: selectError } = await supabase
    .from("user_inventory")
    .select("id, quantity")
    .eq("profile_id", user.id)
    .eq("item_id", itemId)
    .is("weapon_instance_id", null)
    .is("equipment_instance_id", null)
    .order("id", { ascending: true })
    .limit(1);

  if (selectError) {
    return { ok: false, error: "No se pudo leer el inventario." };
  }

  const existing = existingRows?.[0];
  if (existing && typeof existing.id === "number") {
    const currentQty =
      typeof existing.quantity === "number" && Number.isFinite(existing.quantity)
        ? Math.max(0, Math.trunc(existing.quantity))
        : 0;
    const { error: updateError } = await supabase
      .from("user_inventory")
      .update({ quantity: currentQty + grantQuantity })
      .eq("id", existing.id)
      .eq("profile_id", user.id);

    if (updateError) {
      return { ok: false, error: "No se pudo agregar al inventario." };
    }
  } else {
    const { error: insertError } = await supabase.from("user_inventory").insert({
      profile_id: user.id,
      item_id: itemId,
      quantity: grantQuantity,
    });

    if (insertError) {
      return { ok: false, error: "No se pudo agregar al inventario." };
    }
  }

  const { data: itemRow } = await supabase
    .from("items")
    .select("id, name, description, quote_text, icon_path, sell_value, item_type_id, rarity_color, item_types(code)")
    .eq("id", itemId)
    .maybeSingle();

  const item = mapItemsRowToGrantedView(itemRow, grantQuantity);

  revalidatePath("/abandoned-coal-mine");
  revalidatePath("/character_profile");
  return { ok: true, result, chance, granted: true as const, item };
}
