"use server";

import { isWeaponAttackFamilyConsumableEffect } from "@/lib/combat-weapon-attack-family-consumable";
import { resolveEquippedWeaponSprites } from "@/lib/equipped-weapon-sprites";
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
    .select("equip_slot, code")
    .eq("id", itemId)
    .maybeSingle();

  if (itemError || !itemData) {
    throw new Error("No se pudo leer la información del objeto.");
  }

  const equipSlot = itemData.equip_slot?.trim();
  if (!equipSlot) {
    throw new Error("Este objeto no se puede equipar.");
  }

  const { data: classReqRows, error: classReqError } = await supabase
    .from("item_class_requirements")
    .select("min_level, required_stat_key_1, required_stat_value_1, required_stat_key_2, required_stat_value_2, classes(name)")
    .eq("item_id", itemId);
  if (classReqError) {
    throw new Error("No se pudieron validar las restricciones de clase del objeto.");
  }
  const requiredClassNames = (classReqRows ?? [])
    .map((row) => {
      const join = (row as { classes?: { name?: string } | Array<{ name?: string }> }).classes;
      const cls = Array.isArray(join) ? join[0] : join;
      const name = typeof cls?.name === "string" ? cls.name.trim() : "";
      return name.length > 0 ? name : null;
    })
    .filter((name): name is string => name !== null);

  const loadCharacterForRequirements = async () => {
    const selectWithMods =
      "class_name, level, str, dex, int, wis, str_mod, dex_mod, int_mod, wis_mod, speed_total";
    const selectFallback = "class_name, level, str, dex, int, wis";

    const byProfileWithMods = await supabase
      .from("user_character")
      .select(selectWithMods)
      .eq("profile_id", user.id)
      .maybeSingle();
    const byProfile =
      byProfileWithMods.error?.code === "42703"
        ? await supabase
            .from("user_character")
            .select(selectFallback)
            .eq("profile_id", user.id)
            .maybeSingle()
        : byProfileWithMods;

    if (byProfile.data) return byProfile.data as Record<string, unknown>;

    const byUserWithMods = await supabase
      .from("user_character")
      .select(selectWithMods)
      .eq("user_id", user.id)
      .maybeSingle();
    const byUser =
      byUserWithMods.error?.code === "42703"
        ? await supabase
            .from("user_character")
            .select(selectFallback)
            .eq("user_id", user.id)
            .maybeSingle()
        : byUserWithMods;

    return (byUser.data ?? null) as Record<string, unknown> | null;
  };

  const userCharacterForReq = await loadCharacterForRequirements();

  if (requiredClassNames.length > 0) {
    const rawClassName = userCharacterForReq?.class_name;
    let playerClassName =
      typeof rawClassName === "string" && rawClassName.trim().length > 0
        ? rawClassName.trim()
        : "";
    if (playerClassName) {
      const { data: classById } = await supabase
        .from("classes")
        .select("name")
        .eq("id", playerClassName)
        .maybeSingle();
      if (classById?.name) playerClassName = classById.name.trim();
    }

    const isAllowed = requiredClassNames.some(
      (name) => name.toLowerCase() === playerClassName.toLowerCase(),
    );
    if (!isAllowed) {
      throw new Error(`Tu clase no puede equipar este objeto. Usable por: ${requiredClassNames.join(", ")}.`);
    }
  }

  const playerLevel = Math.max(0, Math.trunc(Number(userCharacterForReq?.level ?? 0)));
  const playerStats = {
    str: Math.max(
      0,
      Math.trunc(Number(userCharacterForReq?.str ?? 0)) +
        Math.trunc(Number(userCharacterForReq?.str_mod ?? 0)),
    ),
    dex: Math.max(
      0,
      Math.trunc(Number(userCharacterForReq?.dex ?? 0)) +
        Math.trunc(Number(userCharacterForReq?.dex_mod ?? 0)),
    ),
    int: Math.max(
      0,
      Math.trunc(Number(userCharacterForReq?.int ?? 0)) +
        Math.trunc(Number(userCharacterForReq?.int_mod ?? 0)),
    ),
    wis: Math.max(
      0,
      Math.trunc(Number(userCharacterForReq?.wis ?? 0)) +
        Math.trunc(Number(userCharacterForReq?.wis_mod ?? 0)),
    ),
    // `speed_total` ya viene agregada (base + mods de equipo) desde user_character.
    // Si la columna no existe en este entorno, el fallback del SELECT la omite y queda en 0.
    speed: Math.max(0, Math.trunc(Number(userCharacterForReq?.speed_total ?? 0))),
  };
  const statValueFor = (key: string): number => {
    const k = key.trim().toLowerCase();
    if (k === "str") return playerStats.str;
    if (k === "dex") return playerStats.dex;
    if (k === "int") return playerStats.int;
    if (k === "wis") return playerStats.wis;
    if (k === "spd" || k === "speed" || k === "vel" || k === "velocidad") {
      return playerStats.speed;
    }
    return 0;
  };
  for (const row of (classReqRows ?? []) as Array<Record<string, unknown>>) {
    const minLevel = Math.max(0, Math.trunc(Number(row.min_level ?? 0)));
    if (minLevel > 0 && playerLevel < minLevel) {
      throw new Error(`No cumplís el requisito de nivel (${minLevel}).`);
    }
    const pairs: Array<{ key: unknown; value: unknown }> = [
      { key: row.required_stat_key_1, value: row.required_stat_value_1 },
      { key: row.required_stat_key_2, value: row.required_stat_value_2 },
    ];
    for (const pair of pairs) {
      const reqKey = typeof pair.key === "string" ? pair.key.trim().toLowerCase() : "";
      const reqVal = Math.max(0, Math.trunc(Number(pair.value ?? 0)));
      if (!reqKey || reqVal <= 0) continue;
      if (statValueFor(reqKey) < reqVal) {
        throw new Error(`No cumplís el requisito de stats: ${reqVal} ${reqKey.toUpperCase()}.`);
      }
    }
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
    .select("str, character_name")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (charRow) {
    const payload: {
      str: number;
      active_combat_sprite?: string;
      active_still_sprite?: string;
    } = { str: charRow.str };

    if (equipSlot === "weapon") {
      const rawCode =
        itemData &&
        typeof itemData === "object" &&
        "code" in itemData &&
        (itemData as { code?: unknown }).code != null
          ? String((itemData as { code?: unknown }).code)
          : null;
      const sprites = resolveEquippedWeaponSprites(
        typeof charRow.character_name === "string" ? charRow.character_name : null,
        rawCode,
      );
      payload.active_combat_sprite = sprites.active_combat_sprite;
      payload.active_still_sprite = sprites.active_still_sprite;

      if (process.env.NODE_ENV === "development" || process.env.DEBUG_WEAPON_SPRITES === "1") {
        console.log(
          "[weapon-sprites] equipInventoryItem → user_character.update payload",
          JSON.stringify(
            {
              profileId: user.id,
              inventoryId: inventoryRow.id,
              itemId,
              rawItemCodeFromDb: rawCode,
              active_combat_sprite: payload.active_combat_sprite,
              active_still_sprite: payload.active_still_sprite,
            },
            null,
            2,
          ),
        );
      }
    }

    const { error: bumpError } = await supabase
      .from("user_character")
      .update(payload)
      .eq("profile_id", user.id);

    if (bumpError) {
      throw new Error(
        `Equipo guardado pero no se pudo recalcular el personaje: ${bumpError.message}`,
      );
    }
  }

  revalidatePath("/character_profile");
}

export async function discardInventoryItem(inventoryId: number) {
  const safeInventoryId = Math.max(0, Math.trunc(Number(inventoryId)));
  if (safeInventoryId <= 0) {
    throw new Error("Ítem inválido.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado.");
  }

  const { data: inventoryRow, error: readError } = await supabase
    .from("user_inventory")
    .select("id, profile_id")
    .eq("id", safeInventoryId)
    .maybeSingle();

  if (readError || !inventoryRow) {
    throw new Error("No se encontró el ítem en inventario.");
  }
  if (inventoryRow.profile_id !== user.id) {
    throw new Error("No podés descartar un ítem que no te pertenece.");
  }

  const { error: deleteError } = await supabase
    .from("user_inventory")
    .delete()
    .eq("id", safeInventoryId)
    .eq("profile_id", user.id);
  if (deleteError) {
    throw new Error("No se pudo descartar el ítem.");
  }

  revalidatePath("/character_profile");
}

export async function discardInventoryItems(rawInventoryIds: number[]) {
  const uniqueIds = Array.from(
    new Set(
      rawInventoryIds.map((id) => Math.max(0, Math.trunc(Number(id)))).filter((id) => id > 0),
    ),
  );
  if (uniqueIds.length === 0) {
    throw new Error("No hay ítems válidos para descartar.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado.");
  }

  const { data: ownedRows, error: readError } = await supabase
    .from("user_inventory")
    .select("id")
    .eq("profile_id", user.id)
    .in("id", uniqueIds);

  if (readError || !ownedRows?.length || ownedRows.length !== uniqueIds.length) {
    throw new Error("No se encontraron todos los ítems en tu inventario.");
  }

  const { data: equippedRows } = await supabase
    .from("user_equipment")
    .select("inventory_id")
    .eq("profile_id", user.id)
    .in("inventory_id", uniqueIds);

  if (equippedRows?.some((row) => row.inventory_id != null)) {
    throw new Error("No podés descartar ítems equipados.");
  }

  const { error: deleteError } = await supabase
    .from("user_inventory")
    .delete()
    .eq("profile_id", user.id)
    .in("id", uniqueIds);

  if (deleteError) {
    throw new Error("No se pudo descartar los ítems.");
  }

  revalidatePath("/character_profile");
}

/** Columnas de `user_character` permitidas para `inventory-stat` / `inventory_stat` en el JSON (evita SQL injection vía PostgREST). */
const INVENTORY_CONSUME_CHARACTER_COLUMNS = new Set([
  "hp_actual",
  "mana_actual",
  "str",
  "dex",
  "int",
  "wis",
  "experience_current",
  "speed_total",
  "armor_total",
  "mr_total",
]);

function parseItemsConsumableEffect(raw: unknown): Record<string, unknown> | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function inventoryConsumeFlag(effect: Record<string, unknown>): boolean {
  const v = effect.inventory;
  return v === true || v === "true" || v === 1 || v === "1";
}

function inventoryConsumeDelta(effect: Record<string, unknown>): number {
  const keys = ["amount-max", "amount_max", "amount-min", "amount_min", "amount"] as const;
  for (const k of keys) {
    const n = Math.trunc(Number(effect[k] ?? 0));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export async function consumeInventoryItem(inventoryId: number) {
  const safeInventoryId = Math.max(0, Math.trunc(Number(inventoryId)));
  if (safeInventoryId <= 0) {
    throw new Error("Ítem inválido.");
  }

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
    .eq("id", safeInventoryId)
    .maybeSingle();

  if (inventoryError || !inventoryRow) {
    throw new Error("No se pudo leer el objeto del inventario.");
  }
  if (inventoryRow.profile_id !== user.id) {
    throw new Error("No podés usar un objeto que no te pertenece.");
  }

  const quantity = Math.max(0, Math.trunc(Number(inventoryRow.quantity ?? 0)));
  if (quantity <= 0) {
    throw new Error("No quedan unidades en el stack.");
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

  const { data: itemData, error: itemReadError } = await supabase
    .from("items")
    .select("json_consumable_effect")
    .eq("id", itemId)
    .maybeSingle();

  if (itemReadError || !itemData) {
    throw new Error("No se pudo leer la información del objeto.");
  }

  const effect = parseItemsConsumableEffect(itemData.json_consumable_effect);
  if (!effect) {
    throw new Error("Este objeto no se puede consumir.");
  }

  if (isWeaponAttackFamilyConsumableEffect(effect)) {
    throw new Error("Este consumible solo se puede usar en combate.");
  }

  if (!inventoryConsumeFlag(effect)) {
    throw new Error("Este objeto no se puede consumir desde el inventario.");
  }

  const statRaw =
    effect["inventory-stat"] ?? effect.inventory_stat ?? effect.inventoryStat;
  const statKey =
    typeof statRaw === "string" ? statRaw.trim().toLowerCase() : "";
  if (!statKey || !INVENTORY_CONSUME_CHARACTER_COLUMNS.has(statKey)) {
    throw new Error("Efecto de consumible inválido.");
  }

  const delta = inventoryConsumeDelta(effect);
  if (delta <= 0) {
    throw new Error("Cantidad de efecto inválida.");
  }

  const { data: characterRow, error: characterError } = await supabase
    .from("user_character")
    .select(
      "hp_actual, mana_actual, hp_total, mana_total, str, dex, int, wis, experience_current, speed_total, armor_total, mr_total",
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  if (characterError || !characterRow) {
    throw new Error("No se pudo leer el personaje.");
  }

  const num = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
    return 0;
  };

  const currentVal = num((characterRow as Record<string, unknown>)[statKey]);
  let nextVal = currentVal + delta;

  if (statKey === "hp_actual") {
    const maxHp = Math.max(0, num((characterRow as Record<string, unknown>).hp_total));
    nextVal = Math.min(Math.max(0, nextVal), maxHp);
  } else if (statKey === "mana_actual") {
    const maxMana = Math.max(0, num((characterRow as Record<string, unknown>).mana_total));
    nextVal = Math.min(Math.max(0, nextVal), maxMana);
  } else {
    nextVal = Math.max(0, nextVal);
  }

  const { error: characterUpdateError } = await supabase
    .from("user_character")
    .update({ [statKey]: nextVal })
    .eq("profile_id", user.id);

  if (characterUpdateError) {
    throw new Error("No se pudo aplicar el efecto del consumible.");
  }

  if (quantity <= 1) {
    const { error: deleteInvError } = await supabase
      .from("user_inventory")
      .delete()
      .eq("id", safeInventoryId)
      .eq("profile_id", user.id);
    if (deleteInvError) {
      throw new Error("No se pudo actualizar el inventario.");
    }
  } else {
    const { error: invQtyError } = await supabase
      .from("user_inventory")
      .update({ quantity: quantity - 1 })
      .eq("id", safeInventoryId)
      .eq("profile_id", user.id);
    if (invQtyError) {
      throw new Error("No se pudo actualizar el inventario.");
    }
  }

  revalidatePath("/character_profile");
}
