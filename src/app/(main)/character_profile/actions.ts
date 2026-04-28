"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type AllocationPayload = {
  str: number;
  dex: number;
  int: number;
  wis: number;
};

function sanitizeAllocation(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

export async function confirmStatAllocation(payload: AllocationPayload) {
  const strAlloc = sanitizeAllocation(payload.str);
  const dexAlloc = sanitizeAllocation(payload.dex);
  const intAlloc = sanitizeAllocation(payload.int);
  const wisAlloc = sanitizeAllocation(payload.wis);

  const pointsSpent = strAlloc + dexAlloc + intAlloc + wisAlloc;
  if (pointsSpent <= 0) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado.");
  }

  const { data: currentCharacter, error: readError } = await supabase
    .from("user_character")
    .select("str, dex, int, wis, stat_points_remaining")
    .eq("profile_id", user.id)
    .single();

  if (readError || !currentCharacter) {
    throw new Error("No se pudo leer el personaje.");
  }

  if (pointsSpent > currentCharacter.stat_points_remaining) {
    throw new Error("No hay suficientes puntos disponibles.");
  }

  const { error: updateError } = await supabase
    .from("user_character")
    .update({
      str: currentCharacter.str + strAlloc,
      dex: currentCharacter.dex + dexAlloc,
      int: currentCharacter.int + intAlloc,
      wis: currentCharacter.wis + wisAlloc,
      stat_points_remaining: currentCharacter.stat_points_remaining - pointsSpent,
    })
    .eq("profile_id", user.id);

  if (updateError) {
    throw new Error("No se pudo guardar la subida de nivel.");
  }

  revalidatePath("/character_profile");
}

export async function equipInventoryItem(inventoryId: number, targetSlot?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado.");
  }

  const { data: inventoryRow, error: inventoryError } = await supabase
    .from("user_inventory")
    .select("id, profile_id, item_id, weapon_instance_id, equipment_instance_id, quantity")
    .eq("id", inventoryId)
    .maybeSingle();

  if (inventoryError || !inventoryRow) {
    throw new Error("No se pudo leer el objeto del inventario.");
  }
  if (inventoryRow.profile_id !== user.id) {
    throw new Error("No podés equipar un objeto que no te pertenece.");
  }
  if ((inventoryRow.quantity ?? 0) <= 0) {
    throw new Error("No hay unidades disponibles para equipar.");
  }

  let itemId: string | null = inventoryRow.item_id ?? null;
  if (!itemId && inventoryRow.weapon_instance_id) {
    const { data: weaponInstance, error: weaponInstanceError } = await supabase
      .from("weapon_instance")
      .select("item_id")
      .eq("id", inventoryRow.weapon_instance_id)
      .maybeSingle();
    if (weaponInstanceError || !weaponInstance) {
      throw new Error("No se pudo leer la instancia del arma.");
    }
    itemId = weaponInstance.item_id;
  }
  if (!itemId && inventoryRow.equipment_instance_id) {
    const { data: equipmentInstance, error: equipmentInstanceError } = await supabase
      .from("equipment_instances")
      .select("item_id")
      .eq("id", inventoryRow.equipment_instance_id)
      .maybeSingle();
    if (equipmentInstanceError || !equipmentInstance) {
      throw new Error("No se pudo leer la instancia del equipamiento.");
    }
    itemId = equipmentInstance.item_id;
  }
  if (!itemId) {
    throw new Error("El objeto no tiene una referencia de item válida.");
  }

  const { data: itemData, error: itemError } = await supabase
    .from("items")
    .select("equip_slot")
    .eq("id", itemId)
    .maybeSingle();

  if (itemError || !itemData) {
    throw new Error("No se pudo leer la información del objeto.");
  }

  const equipSlot = itemData.equip_slot?.trim();
  if (!equipSlot) {
    throw new Error("Este objeto no se puede equipar.");
  }
  if (targetSlot && targetSlot !== equipSlot) {
    throw new Error("No podés equipar este objeto en ese slot.");
  }

  const { error: equipError } = await supabase.from("user_equipment").upsert(
    {
      profile_id: user.id,
      slot: equipSlot,
      inventory_id: inventoryRow.id,
    },
    { onConflict: "profile_id,slot" },
  );

  if (equipError) {
    throw new Error("No se pudo equipar el objeto.");
  }

  // El trigger de stats vive en user_character; equipar solo toca user_equipment.
  // Forzar un UPDATE benigno para que Postgres ejecute el BEFORE trigger y reaplique el arma.
  const { data: charRow } = await supabase
    .from("user_character")
    .select("str")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (charRow) {
    const { error: bumpError } = await supabase
      .from("user_character")
      .update({ str: charRow.str })
      .eq("profile_id", user.id);

    if (bumpError) {
      throw new Error(
        `Equipo guardado pero no se pudo recalcular el personaje: ${bumpError.message}`,
      );
    }
  }

  revalidatePath("/character_profile");
}
