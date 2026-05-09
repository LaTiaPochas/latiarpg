"use server";

import { revalidatePath } from "next/cache";
import { resolveInventoryIconPath } from "@/lib/inventory-icon-path";
import { rollNearWoodsEnemyCombatCode } from "@/lib/near-woods-enemy-combats";
import { rollNearWoodsGatherOutcome } from "@/lib/near-woods-gather-outcomes";
import { createClient } from "@/lib/supabase/server";

const OUTCOME_ITEM_IDS: Record<string, string> = {
  madera: "ea5b9601-8a7d-4270-b5d9-cf292d49945e",
  potion: "77cc0fd9-3dff-4c10-b127-6b212d2bd9e1",
  wolf_pelt: "4d46293a-c26b-4228-95c3-bd8a56e5864a",
  oro: "8438bdcd-b4b6-412c-8a54-0dcdb6636289",
  thread: "f6994ca0-795d-4b05-a9e0-85af33367af3",
};

/** Aguas relajantes en almacén global (mismo ítem que combate / puesto). */
const RELAXING_WATER_GLOBAL_ITEM_ID = "ecd74ed8-b2de-4bb9-b109-3fd4f27e8955";

export type NearWoodsGrantedItemView = {
  id: string;
  name: string;
  description: string;
  quoteText: string | null;
  iconPath: string;
  sellValue: number;
  itemTypeId: number | null;
  itemTypeCode: string | null;
  rarityColor: string | null;
};

function mapItemsRowToGrantedView(data: unknown): NearWoodsGrantedItemView | null {
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
  };
}

export type GatherNearWoodsResult =
  | {
      ok: true;
      result: string;
      chance: number;
      granted: false;
      /** Ítem para mostrar icono/tooltip (p. ej. aguas → almacén global, no inventario del PJ). */
      previewItem?: NearWoodsGrantedItemView | null;
      /** Solo si `result === "enemy"`; destino `/combate/[encounterCode]`. */
      encounterCode?: string;
    }
  | {
      ok: true;
      result: string;
      chance: number;
      granted: true;
      item: NearWoodsGrantedItemView | null;
    }
  | { ok: false; error: string };

export async function gatherNearWoods(): Promise<GatherNearWoodsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "No estás autenticado." };
  }

  const rolled = rollNearWoodsGatherOutcome();
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

    revalidatePath("/near-woods");
    revalidatePath("/character_profile");
    revalidatePath("/relaxing_waters_stand");
    revalidatePath("/garrison");
    return { ok: true, result, chance, granted: false as const, previewItem };
  }

  if (result === "enemy") {
    const encounterCode = rollNearWoodsEnemyCombatCode();
    revalidatePath("/near-woods");
    revalidatePath("/character_profile");
    return {
      ok: true,
      result,
      chance,
      granted: false as const,
      encounterCode,
    };
  }

  const itemId = OUTCOME_ITEM_IDS[result];
  if (!itemId) {
    return { ok: false, error: "Resultado sin ítem configurado." };
  }

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
      .update({ quantity: currentQty + 1 })
      .eq("id", existing.id)
      .eq("profile_id", user.id);

    if (updateError) {
      return { ok: false, error: "No se pudo agregar al inventario." };
    }
  } else {
    const { error: insertError } = await supabase.from("user_inventory").insert({
      profile_id: user.id,
      item_id: itemId,
      quantity: 1,
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

  const item = mapItemsRowToGrantedView(itemRow);

  revalidatePath("/near-woods");
  revalidatePath("/character_profile");
  return { ok: true, result, chance, granted: true as const, item };
}
