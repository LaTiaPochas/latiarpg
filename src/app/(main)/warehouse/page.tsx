import { redirect } from "next/navigation";
import { WarehouseIntroDialogue } from "@/components/warehouse/warehouse-intro-dialogue";
import { WarehouseCompletedView } from "@/components/warehouse/warehouse-completed-view";
import { WoodAmountSelector } from "@/components/campsite/wood-amount-selector";
import type { EquipmentInstanceTooltip, WeaponInstanceTooltip } from "@/components/character-profile/inventory-types";
import type { GlobalWarehouseInventorySlotPayload } from "@/components/warehouse/global-warehouse-inventory-modal";
import { createClient } from "@/lib/supabase/server";
import { resolveInventoryIconPath } from "@/lib/inventory-icon-path";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

const warehouseInventorySlotNumbers = Array.from({ length: 24 }, (_, index) => index + 1);

type ItemClassRequirementRow = {
  item_id: string;
  min_level: number | null;
  required_stat_key_1: string | null;
  required_stat_value_1: number | null;
  required_stat_key_2: string | null;
  required_stat_value_2: number | null;
  classes:
    | {
        name: string | null;
      }
    | Array<{
        name: string | null;
      }>
    | null;
};

type WarehouseItemsRow = {
  id: string;
  name: string;
  description: string | null;
  quote_text: string | null;
  icon_path: string | null;
  equip_slot: string | null;
  sell_value: number | null;
  item_type_id: number | null;
  rarity_color: string | null;
  item_types: { code: string | null } | { code: string | null }[] | null;
};

type WeaponInstanceRow = {
  id: number;
  item_id: string;
  rarity: string | null;
  rarity_color: string | null;
  attack_damage_min: number | null;
  attack_damage_max: number | null;
  magic_damage_min: number | null;
  magic_damage_max: number | null;
  stat_key_1: string | null;
  value_flat_1: number | null;
  value_pct_1: number | null;
  stat_key_2: string | null;
  value_flat_2: number | null;
  value_pct_2: number | null;
  stat_key_3: string | null;
  value_flat_3: number | null;
  value_pct_3: number | null;
};

type EquipmentInstanceRow = {
  id: number;
  item_id: string;
  rarity: string | null;
  rarity_color: string | null;
  stat_key_1: string | null;
  value_flat_1: number | null;
  value_pct_1: number | null;
  stat_key_2: string | null;
  value_flat_2: number | null;
  value_pct_2: number | null;
  stat_key_3: string | null;
  value_flat_3: number | null;
  value_pct_3: number | null;
};

function mapWeaponInstanceForTooltip(row: WeaponInstanceRow | undefined | null): WeaponInstanceTooltip | null {
  if (!row) return null;
  return {
    rarity: row.rarity,
    rarityColor: row.rarity_color,
    attackDamageMin: row.attack_damage_min,
    attackDamageMax: row.attack_damage_max,
    magicDamageMin: row.magic_damage_min,
    magicDamageMax: row.magic_damage_max,
    statKey1: row.stat_key_1,
    valueFlat1: row.value_flat_1,
    valuePct1: row.value_pct_1,
    statKey2: row.stat_key_2,
    valueFlat2: row.value_flat_2,
    valuePct2: row.value_pct_2,
    statKey3: row.stat_key_3,
    valueFlat3: row.value_flat_3,
    valuePct3: row.value_pct_3,
  };
}

function mapEquipmentInstanceForTooltip(
  row: EquipmentInstanceRow | undefined | null,
): EquipmentInstanceTooltip | null {
  if (!row) return null;
  return {
    rarity: row.rarity,
    rarityColor: row.rarity_color,
    attackDamageMin: null,
    attackDamageMax: null,
    magicDamageMin: null,
    magicDamageMax: null,
    statKey1: row.stat_key_1,
    valueFlat1: row.value_flat_1,
    valuePct1: row.value_pct_1,
    statKey2: row.stat_key_2,
    valueFlat2: row.value_flat_2,
    valuePct2: row.value_pct_2,
    statKey3: row.stat_key_3,
    valueFlat3: row.value_flat_3,
    valuePct3: row.value_pct_3,
  };
}
const BELOW_NAV = "h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden";
const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

function capitalizeFirst(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
export default async function WarehousePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("warehouse_dialog")
    .eq("user_id", user.id)
    .maybeSingle();

  const shouldShowIntroDialogue = milestones?.warehouse_dialog === false;
  const shouldShowWarehouseModal = milestones?.warehouse_dialog === true;

  const { data: warehouseMilestone } = await supabase
    .from("global_milestones")
    .select("id, title, current_value, target_value, is_completed")
    .eq("title", "warehouse_construido")
    .maybeSingle();
  const { data: woodInventoryRows } = await supabase
    .from("user_inventory")
    .select("quantity")
    .eq("profile_id", user.id)
    .eq("item_id", "ea5b9601-8a7d-4270-b5d9-cf292d49945e");
  const { data: woodItem } = await supabase
    .from("items")
    .select("icon_path")
    .eq("id", "ea5b9601-8a7d-4270-b5d9-cf292d49945e")
    .maybeSingle();

  const milestoneTitle = "Progreso del Warehouse:";
  const milestoneCurrentValue =
    typeof warehouseMilestone?.current_value === "number" &&
    Number.isFinite(warehouseMilestone.current_value)
      ? Math.max(0, Math.trunc(warehouseMilestone.current_value))
      : 0;
  const milestoneTargetValue =
    typeof warehouseMilestone?.target_value === "number" &&
    Number.isFinite(warehouseMilestone.target_value)
      ? Math.max(1, Math.trunc(warehouseMilestone.target_value))
      : 1;
  const milestoneProgressPercent = Math.min(
    100,
    Math.max(
      0,
      Math.round((milestoneCurrentValue / milestoneTargetValue) * 100),
    ),
  );
  const isWarehouseCompleted = warehouseMilestone?.is_completed === true;
  const userWoodQuantity = (woodInventoryRows ?? []).reduce(
    (total, row) =>
      total + (typeof row.quantity === "number" ? row.quantity : 0),
    0,
  );
  const woodIconSrc = (() => {
    if (!woodItem?.icon_path || typeof woodItem.icon_path !== "string") {
      return "/img/resources/logos/logo_latia_rpg.png";
    }
    const trimmedPath = woodItem.icon_path.trim();
    if (!trimmedPath) return "/img/resources/logos/logo_latia_rpg.png";
    if (
      trimmedPath.startsWith("/") ||
      trimmedPath.startsWith("http://") ||
      trimmedPath.startsWith("https://")
    ) {
      return trimmedPath;
    }
    return `/${trimmedPath}`;
  })();

  async function completeWarehouseDialog() {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser();
    if (!currentUser) {
      return { ok: false };
    }

    const { data: updatedRows } = await supabaseAction
      .from("user_milestones")
      .update({ warehouse_dialog: true })
      .eq("user_id", currentUser.id)
      .select("user_id");

    if (!updatedRows || updatedRows.length === 0) {
      await supabaseAction.from("user_milestones").insert({
        user_id: currentUser.id,
        warehouse_dialog: true,
      });
    }

    return { ok: true };
  }

  async function contributeWood(amount: number) {
    "use server";

    const parsedAmount = Math.max(0, Math.floor(Number(amount) || 0));
    if (parsedAmount <= 0) {
      redirect("/warehouse");
    }

    const supabaseAction = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser();
    if (!currentUser) {
      redirect("/login");
    }

    const { data: inventoryRows } = await supabaseAction
      .from("user_inventory")
      .select("id, quantity")
      .eq("profile_id", currentUser.id)
      .eq("item_id", "ea5b9601-8a7d-4270-b5d9-cf292d49945e")
      .order("id", { ascending: true });

    const availableWood = (inventoryRows ?? []).reduce(
      (total, row) =>
        total + (typeof row.quantity === "number" ? row.quantity : 0),
      0,
    );
    const amountToApply = Math.min(parsedAmount, availableWood);
    if (amountToApply <= 0) {
      redirect("/warehouse");
    }

    let pendingDiscount = amountToApply;
    for (const row of inventoryRows ?? []) {
      if (pendingDiscount <= 0) break;
      const rowQty = typeof row.quantity === "number" ? row.quantity : 0;
      if (rowQty <= 0) continue;
      const deduct = Math.min(rowQty, pendingDiscount);
      const nextQty = rowQty - deduct;
      if (nextQty <= 0) {
        await supabaseAction.from("user_inventory").delete().eq("id", row.id);
      } else {
        await supabaseAction
          .from("user_inventory")
          .update({ quantity: nextQty })
          .eq("id", row.id);
      }
      pendingDiscount -= deduct;
    }

    const { data: globalMilestone } = await supabaseAction
      .from("global_milestones")
      .select("id, current_value, target_value, is_completed")
      .eq("title", "warehouse_construido")
      .maybeSingle();

    const currentGlobalValue =
      typeof globalMilestone?.current_value === "number"
        ? globalMilestone.current_value
        : 0;
    const targetGlobalValue =
      typeof globalMilestone?.target_value === "number"
        ? Math.max(1, globalMilestone.target_value)
        : 1;
    const alreadyCompleted = globalMilestone?.is_completed === true;
    const nextGlobalValue = currentGlobalValue + amountToApply;
    const shouldMarkCompleted = nextGlobalValue >= targetGlobalValue;

    await supabaseAction
      .from("global_milestones")
      .update({
        current_value: nextGlobalValue,
        is_completed: shouldMarkCompleted ? true : undefined,
        completed_at:
          shouldMarkCompleted && !alreadyCompleted
            ? new Date().toISOString()
            : undefined,
      })
      .eq("title", "warehouse_construido");

    if (shouldMarkCompleted && !alreadyCompleted) {
      await supabaseAction.from("global_world_event_log").insert({
        happened_at: new Date().toISOString(),
        member_name: "world",
        event_html:
          '<span style="color:#22c55e;font-weight:700;">¡Objetivo completado: Warehouse Construido!</span>',
      });
    }

    const { data: currentStats } = await supabaseAction
      .from("user_stats")
      .select("wood_given")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    const currentWoodGiven =
      typeof currentStats?.wood_given === "number" &&
      Number.isFinite(currentStats.wood_given)
        ? Math.max(0, Math.trunc(currentStats.wood_given))
        : 0;

    await supabaseAction.from("user_stats").upsert(
      {
        user_id: currentUser.id,
        wood_given: currentWoodGiven + amountToApply,
      },
      { onConflict: "user_id" },
    );

    const { data: currentProfile } = await supabaseAction
      .from("user_profiles")
      .select("miembro, color")
      .eq("id", currentUser.id)
      .maybeSingle();

    const fallbackCurrentName =
      currentUser.email?.split("@")[0] ?? "Aventurero";
    const memberNameRaw =
      typeof currentProfile?.miembro === "string" &&
      currentProfile.miembro.trim().length > 0
        ? currentProfile.miembro.trim()
        : fallbackCurrentName;
    const memberName = capitalizeFirst(memberNameRaw);
    const memberColor =
      typeof currentProfile?.color === "string" &&
      currentProfile.color.trim().length > 0
        ? currentProfile.color.trim()
        : "#f8fafc";

    const safeMemberName = escapeHtml(memberName);
    const eventHtml = `<span style="color:${memberColor}">${safeMemberName}</span> aportó ${amountToApply} de madera para la contrucción del <strong>Warehouse</strong>.`;

    await supabaseAction.from("global_world_event_log").insert({
      happened_at: new Date().toISOString(),
      member_name: memberName,
      event_html: eventHtml,
    });

    redirect("/warehouse");
  }

  /** Datos opcionales del grid en escena “warehouse completado”. */
  let warehouseCompletedSlots: GlobalWarehouseInventorySlotPayload[] =
    warehouseInventorySlotNumbers.map((slotNumber) => ({ slotNumber, item: null }));
  let playerBagSlots: GlobalWarehouseInventorySlotPayload[] =
    warehouseInventorySlotNumbers.map((slotNumber) => ({ slotNumber, item: null }));
  let warehousePlayerClass = "Aventurero";
  let warehousePlayerLevel = 1;
  let warehousePlayerStats = { str: 0, dex: 0, int: 0, wis: 0 };

  if (shouldShowWarehouseModal && isWarehouseCompleted) {
    const { data: gwRows } = await supabase
      .from("global_warehouse")
      .select("id, item_id, weapon_instance_id, equipment_instance_id, quantity, is_global_item")
      .gt("quantity", 0)
      .order("id", { ascending: true });

    const { data: userCharacterByProfileId } = await supabase
      .from("user_character")
      .select(
        "class_name, level, str, dex, int, wis, str_mod, dex_mod, int_mod, wis_mod",
      )
      .eq("profile_id", user.id)
      .maybeSingle();

    const { data: userCharacterByUserId } = userCharacterByProfileId
      ? { data: null }
      : await supabase
          .from("user_character")
          .select(
            "class_name, level, str, dex, int, wis, str_mod, dex_mod, int_mod, wis_mod",
          )
          .eq("user_id", user.id)
          .maybeSingle();

    const uc = userCharacterByProfileId ?? userCharacterByUserId;
    const classDataById = uc?.class_name
      ? await supabase
          .from("classes")
          .select("name")
          .eq("id", uc.class_name)
          .maybeSingle()
      : { data: null };

    const { data: classDataByName } =
      uc?.class_name && !classDataById?.data
        ? await supabase
            .from("classes")
            .select("name")
            .eq("name", uc.class_name)
            .maybeSingle()
        : { data: null };

    warehousePlayerClass =
      classDataById?.data?.name ||
      classDataByName?.name ||
      (typeof uc?.class_name === "string" && uc.class_name.trim().length > 0
        ? uc.class_name.trim()
        : "Aventurero");
    warehousePlayerLevel = Math.max(1, Math.trunc(Number(uc?.level ?? 1)));
    warehousePlayerStats = {
      str: Math.trunc(Number(uc?.str ?? 0)) + Math.trunc(Number(uc?.str_mod ?? 0)),
      dex: Math.trunc(Number(uc?.dex ?? 0)) + Math.trunc(Number(uc?.dex_mod ?? 0)),
      int: Math.trunc(Number(uc?.int ?? 0)) + Math.trunc(Number(uc?.int_mod ?? 0)),
      wis: Math.trunc(Number(uc?.wis ?? 0)) + Math.trunc(Number(uc?.wis_mod ?? 0)),
    };

    const visibleGw = (gwRows ?? [])
      .filter((row) => {
        if (row.is_global_item === true) return false;
        const qty =
          typeof row.quantity === "number" && Number.isFinite(row.quantity)
            ? Math.max(0, Math.trunc(row.quantity))
            : 0;
        if (qty <= 0) return false;
        const rawItem = typeof row.item_id === "string" ? row.item_id.trim() : "";
        const hasItem = rawItem.length > 0;
        const hasWeapon =
          typeof row.weapon_instance_id === "number" &&
          Number.isFinite(row.weapon_instance_id) &&
          row.weapon_instance_id > 0;
        const hasEquipment =
          typeof row.equipment_instance_id === "number" &&
          Number.isFinite(row.equipment_instance_id) &&
          row.equipment_instance_id > 0;
        return hasItem || hasWeapon || hasEquipment;
      })
      .slice(0, warehouseInventorySlotNumbers.length);

    const weaponInstanceIds = visibleGw
      .map((row) => row.weapon_instance_id)
      .filter((value): value is number => typeof value === "number");
    const equipmentInstanceIds = visibleGw
      .map((row) => row.equipment_instance_id)
      .filter((value): value is number => typeof value === "number");

    const { data: weaponInstances } =
      weaponInstanceIds.length > 0
        ? await supabase
            .from("weapon_instance")
            .select(
              "id, item_id, rarity, rarity_color, attack_damage_min, attack_damage_max, magic_damage_min, magic_damage_max, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3",
            )
            .in("id", weaponInstanceIds)
        : { data: [] };

    const { data: equipmentInstances } =
      equipmentInstanceIds.length > 0
        ? await supabase
            .from("equipment_instances")
            .select(
              "id, item_id, rarity, rarity_color, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3",
            )
            .in("id", equipmentInstanceIds)
        : { data: [] };

    const weaponInstanceMap = new Map<number, WeaponInstanceRow>(
      (weaponInstances ?? []).map((instance) => [instance.id, instance as WeaponInstanceRow]),
    );
    const equipmentInstanceMap = new Map<number, EquipmentInstanceRow>(
      (equipmentInstances ?? []).map((instance) => [instance.id, instance as EquipmentInstanceRow]),
    );

    const inventoryItemIds = Array.from(
      new Set(
        visibleGw
          .map((row) => {
            const direct =
              typeof row.item_id === "string" && row.item_id.trim().length > 0
                ? row.item_id.trim()
                : null;
            if (direct) return direct;
            if (row.weapon_instance_id) {
              return weaponInstanceMap.get(row.weapon_instance_id)?.item_id ?? null;
            }
            if (row.equipment_instance_id) {
              return equipmentInstanceMap.get(row.equipment_instance_id)?.item_id ?? null;
            }
            return null;
          })
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const { data: inventoryItems } =
      inventoryItemIds.length > 0
        ? await supabase
            .from("items")
            .select("id, name, description, quote_text, icon_path, equip_slot, sell_value, item_type_id, rarity_color, item_types(code)")
            .in("id", inventoryItemIds)
        : { data: [] };

    const inventoryItemMap = new Map(
      ((inventoryItems ?? []) as WarehouseItemsRow[]).map((item) => [item.id, item]),
    );

    const { data: itemClassRequirements } =
      inventoryItemIds.length > 0
        ? await supabase
            .from("item_class_requirements")
            .select("item_id, min_level, required_stat_key_1, required_stat_value_1, required_stat_key_2, required_stat_value_2, classes(name)")
            .in("item_id", inventoryItemIds)
        : { data: [] };

    const itemAllowedClassNamesMap = new Map<string, string[]>();
    const itemRequiredMinLevelMap = new Map<string, number>();
    const itemRequiredStatsMap = new Map<string, Array<{ key: string; value: number }>>();

    for (const row of (itemClassRequirements ?? []) as ItemClassRequirementRow[]) {
      const classJoin = Array.isArray(row.classes) ? row.classes[0] ?? null : row.classes;
      const className =
        classJoin && typeof classJoin.name === "string" && classJoin.name.trim().length > 0
          ? classJoin.name.trim()
          : null;
      if (!className) continue;
      const list = itemAllowedClassNamesMap.get(row.item_id) ?? [];
      if (!list.includes(className)) list.push(className);
      itemAllowedClassNamesMap.set(row.item_id, list);

      const minLevel = Math.max(0, Math.trunc(Number(row.min_level ?? 0)));
      if (minLevel > 0) {
        const prev = itemRequiredMinLevelMap.get(row.item_id) ?? 0;
        itemRequiredMinLevelMap.set(row.item_id, Math.max(prev, minLevel));
      }

      const addStatReq = (rawKey: string | null, rawVal: number | null) => {
        const statKey = typeof rawKey === "string" ? rawKey.trim().toLowerCase() : "";
        const statVal = Math.max(0, Math.trunc(Number(rawVal ?? 0)));
        if (!statKey || statVal <= 0) return;
        const stats = itemRequiredStatsMap.get(row.item_id) ?? [];
        if (!stats.some((s) => s.key === statKey && s.value === statVal)) {
          stats.push({ key: statKey, value: statVal });
        }
        itemRequiredStatsMap.set(row.item_id, stats);
      };
      addStatReq(row.required_stat_key_1, row.required_stat_value_1);
      addStatReq(row.required_stat_key_2, row.required_stat_value_2);
    }

    warehouseCompletedSlots = warehouseInventorySlotNumbers.map((slotNumber, index) => {
      const row = visibleGw[index];
      if (!row) return { slotNumber, item: null };

      const resolvedItemId =
        (typeof row.item_id === "string" && row.item_id.trim().length > 0 ? row.item_id.trim() : null) ??
        (row.weapon_instance_id
          ? weaponInstanceMap.get(row.weapon_instance_id)?.item_id ?? null
          : null) ??
        (row.equipment_instance_id
          ? equipmentInstanceMap.get(row.equipment_instance_id)?.item_id ?? null
          : null);
      if (!resolvedItemId) return { slotNumber, item: null };

      const item = inventoryItemMap.get(resolvedItemId);
      if (!item) return { slotNumber, item: null };

      const qty = Math.max(0, Math.trunc(Number(row.quantity ?? 0)));
      if (qty <= 0) return { slotNumber, item: null };

      const rarityColor =
        (row.weapon_instance_id
          ? weaponInstanceMap.get(row.weapon_instance_id)?.rarity_color ?? null
          : null) ??
        (row.equipment_instance_id
          ? equipmentInstanceMap.get(row.equipment_instance_id)?.rarity_color ?? null
          : null) ??
        (typeof item.rarity_color === "string" && item.rarity_color.trim().length > 0
          ? item.rarity_color.trim()
          : null);

      const weaponInstance = row.weapon_instance_id
        ? mapWeaponInstanceForTooltip(weaponInstanceMap.get(row.weapon_instance_id))
        : null;
      const equipmentInstance =
        !row.weapon_instance_id && row.equipment_instance_id
          ? mapEquipmentInstanceForTooltip(equipmentInstanceMap.get(row.equipment_instance_id))
          : null;

      const typeJoin = Array.isArray(item.item_types) ? (item.item_types[0] ?? null) : item.item_types;
      const rawTypeCode = typeJoin?.code;
      const itemTypeCode =
        typeof rawTypeCode === "string" && rawTypeCode.trim().length > 0
          ? rawTypeCode.trim().toLowerCase()
          : null;

      const gwRowId = typeof row.id === "number" && Number.isFinite(row.id) ? row.id : undefined;
      return {
        slotNumber,
        item: {
          id: slotNumber + 740_000,
          globalWarehouseRowId: gwRowId,
          name: item.name,
          description: item.description ?? "Sin descripción.",
          quoteText:
            typeof item.quote_text === "string" && item.quote_text.trim().length > 0
              ? item.quote_text.trim()
              : null,
          iconPath: resolveInventoryIconPath(item.icon_path),
          quantity: qty,
          equipSlot: item.equip_slot,
          sellValue: item.sell_value ?? 0,
          itemTypeId: item.item_type_id ?? null,
          itemTypeCode,
          rarityColor,
          usableByClassNames: itemAllowedClassNamesMap.get(item.id) ?? [],
          requiredMinLevel: itemRequiredMinLevelMap.get(item.id) ?? 0,
          requiredStats: itemRequiredStatsMap.get(item.id) ?? [],
          weaponInstance: weaponInstance ?? undefined,
          equipmentInstance: equipmentInstance ?? undefined,
        },
      };
    });

    const { data: userInventoryRowsBag } = await supabase
      .from("user_inventory")
      .select("id, item_id, weapon_instance_id, equipment_instance_id, quantity")
      .eq("profile_id", user.id)
      .gt("quantity", 0)
      .order("id", { ascending: true });

    const { data: userEquippedRowsBag } = await supabase
      .from("user_equipment")
      .select("slot, inventory_id")
      .eq("profile_id", user.id);

    const equippedBagIds = new Set((userEquippedRowsBag ?? []).map((row) => row.inventory_id));
    const visibleUserBag = (userInventoryRowsBag ?? [])
      .filter((row) => !equippedBagIds.has(row.id))
      .slice(0, warehouseInventorySlotNumbers.length);

    const bagWeaponIds = visibleUserBag
      .map((row) => row.weapon_instance_id)
      .filter((value): value is number => typeof value === "number");
    const bagEquipmentIds = visibleUserBag
      .map((row) => row.equipment_instance_id)
      .filter((value): value is number => typeof value === "number");

    const { data: bagWeaponInstances } =
      bagWeaponIds.length > 0
        ? await supabase
            .from("weapon_instance")
            .select(
              "id, item_id, rarity, rarity_color, attack_damage_min, attack_damage_max, magic_damage_min, magic_damage_max, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3",
            )
            .in("id", bagWeaponIds)
        : { data: [] };

    const { data: bagEquipmentInstances } =
      bagEquipmentIds.length > 0
        ? await supabase
            .from("equipment_instances")
            .select(
              "id, item_id, rarity, rarity_color, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3",
            )
            .in("id", bagEquipmentIds)
        : { data: [] };

    const bagWeaponMap = new Map<number, WeaponInstanceRow>(
      (bagWeaponInstances ?? []).map((inst) => [inst.id, inst as WeaponInstanceRow]),
    );
    const bagEquipmentMap = new Map<number, EquipmentInstanceRow>(
      (bagEquipmentInstances ?? []).map((inst) => [inst.id, inst as EquipmentInstanceRow]),
    );

    const bagItemIdsList = Array.from(
      new Set(
        visibleUserBag
          .map((row) => {
            const direct =
              typeof row.item_id === "string" && row.item_id.trim().length > 0
                ? row.item_id.trim()
                : null;
            if (direct) return direct;
            if (row.weapon_instance_id) {
              return bagWeaponMap.get(row.weapon_instance_id)?.item_id ?? null;
            }
            if (row.equipment_instance_id) {
              return bagEquipmentMap.get(row.equipment_instance_id)?.item_id ?? null;
            }
            return null;
          })
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const { data: bagItemsRows } =
      bagItemIdsList.length > 0
        ? await supabase
            .from("items")
            .select("id, name, description, quote_text, icon_path, equip_slot, sell_value, item_type_id, rarity_color, item_types(code)")
            .in("id", bagItemIdsList)
        : { data: [] };

    const bagItemMap = new Map(
      ((bagItemsRows ?? []) as WarehouseItemsRow[]).map((item) => [item.id, item]),
    );

    const { data: bagClassReqs } =
      bagItemIdsList.length > 0
        ? await supabase
            .from("item_class_requirements")
            .select(
              "item_id, min_level, required_stat_key_1, required_stat_value_1, required_stat_key_2, required_stat_value_2, classes(name)",
            )
            .in("item_id", bagItemIdsList)
        : { data: [] };

    const bagAllowedClassMap = new Map<string, string[]>();
    const bagMinLevelMap = new Map<string, number>();
    const bagStatsMap = new Map<string, Array<{ key: string; value: number }>>();

    for (const row of (bagClassReqs ?? []) as ItemClassRequirementRow[]) {
      const classJoin = Array.isArray(row.classes) ? row.classes[0] ?? null : row.classes;
      const cname =
        classJoin && typeof classJoin.name === "string" && classJoin.name.trim().length > 0
          ? classJoin.name.trim()
          : null;
      if (!cname) continue;
      const list = bagAllowedClassMap.get(row.item_id) ?? [];
      if (!list.includes(cname)) list.push(cname);
      bagAllowedClassMap.set(row.item_id, list);

      const minLevel = Math.max(0, Math.trunc(Number(row.min_level ?? 0)));
      if (minLevel > 0) {
        const prev = bagMinLevelMap.get(row.item_id) ?? 0;
        bagMinLevelMap.set(row.item_id, Math.max(prev, minLevel));
      }

      const addStat = (rawKey: string | null, rawVal: number | null) => {
        const statKey = typeof rawKey === "string" ? rawKey.trim().toLowerCase() : "";
        const statVal = Math.max(0, Math.trunc(Number(rawVal ?? 0)));
        if (!statKey || statVal <= 0) return;
        const stats = bagStatsMap.get(row.item_id) ?? [];
        if (!stats.some((s) => s.key === statKey && s.value === statVal)) {
          stats.push({ key: statKey, value: statVal });
        }
        bagStatsMap.set(row.item_id, stats);
      };
      addStat(row.required_stat_key_1, row.required_stat_value_1);
      addStat(row.required_stat_key_2, row.required_stat_value_2);
    }

    playerBagSlots = warehouseInventorySlotNumbers.map((slotNumber, index) => {
      const row = visibleUserBag[index];
      if (!row) return { slotNumber, item: null };

      const resolvedItemId =
        (typeof row.item_id === "string" && row.item_id.trim().length > 0 ? row.item_id.trim() : null) ??
        (row.weapon_instance_id ? bagWeaponMap.get(row.weapon_instance_id)?.item_id ?? null : null) ??
        (row.equipment_instance_id
          ? bagEquipmentMap.get(row.equipment_instance_id)?.item_id ?? null
          : null);
      if (!resolvedItemId) return { slotNumber, item: null };

      const item = bagItemMap.get(resolvedItemId);
      if (!item) return { slotNumber, item: null };

      const qty = Math.max(0, Math.trunc(Number(row.quantity ?? 0)));
      if (qty <= 0) return { slotNumber, item: null };

      const rarityColor =
        (row.weapon_instance_id ? bagWeaponMap.get(row.weapon_instance_id)?.rarity_color ?? null : null) ??
        (row.equipment_instance_id ? bagEquipmentMap.get(row.equipment_instance_id)?.rarity_color ?? null : null) ??
        (typeof item.rarity_color === "string" && item.rarity_color.trim().length > 0
          ? item.rarity_color.trim()
          : null);

      const weaponInstance = row.weapon_instance_id
        ? mapWeaponInstanceForTooltip(bagWeaponMap.get(row.weapon_instance_id))
        : null;
      const equipmentInstance =
        !row.weapon_instance_id && row.equipment_instance_id
          ? mapEquipmentInstanceForTooltip(bagEquipmentMap.get(row.equipment_instance_id))
          : null;

      const typeJoin = Array.isArray(item.item_types) ? (item.item_types[0] ?? null) : item.item_types;
      const rawTypeCode = typeJoin?.code;
      const itemTypeCode =
        typeof rawTypeCode === "string" && rawTypeCode.trim().length > 0
          ? rawTypeCode.trim().toLowerCase()
          : null;

      const userInvId = typeof row.id === "number" ? row.id : null;
      return {
        slotNumber,
        item: {
          id: userInvId ?? slotNumber + 480_000,
          userInventoryRowId: userInvId ?? undefined,
          name: item.name,
          description: item.description ?? "Sin descripción.",
          quoteText:
            typeof item.quote_text === "string" && item.quote_text.trim().length > 0
              ? item.quote_text.trim()
              : null,
          iconPath: resolveInventoryIconPath(item.icon_path),
          quantity: qty,
          equipSlot: item.equip_slot,
          sellValue: item.sell_value ?? 0,
          itemTypeId: item.item_type_id ?? null,
          itemTypeCode,
          rarityColor,
          usableByClassNames: bagAllowedClassMap.get(item.id) ?? [],
          requiredMinLevel: bagMinLevelMap.get(item.id) ?? 0,
          requiredStats: bagStatsMap.get(item.id) ?? [],
          weaponInstance: weaponInstance ?? undefined,
          equipmentInstance: equipmentInstance ?? undefined,
        },
      };
    });
  }

  return (
    <div className={`relative w-full overflow-x-hidden ${BELOW_NAV}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/img/resources/background/bg_warehouse_base.png')",
        }}
      />
      {shouldShowIntroDialogue ? (
        <WarehouseIntroDialogue onComplete={completeWarehouseDialog} />
      ) : null}
      {shouldShowWarehouseModal ? (
        isWarehouseCompleted ? (
          <WarehouseCompletedView
            uiFontClassName={uiFont.className}
            dialogueFontClassName={dialogueFont.className}
            warehouseSlots={warehouseCompletedSlots}
            playerInventorySlots={playerBagSlots}
            playerClassName={warehousePlayerClass}
            playerLevel={warehousePlayerLevel}
            playerStats={warehousePlayerStats}
          />
        ) : (
          <div
            className={`relative h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden bg-[#120b08] text-amber-50 ${uiFont.className}`}
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.62)), url('/img/resources/background/bg_warehouse_base.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <main className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-6xl items-center justify-center overflow-y-auto overscroll-contain p-4 lg:p-8">
              <section className="w-full max-w-3xl rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm lg:p-6">
                <div
                  className={`rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-4 text-center lg:p-5 ${dialogueFont.className}`}
                >
                  <p className="text-center text-[13px] leading-relaxed text-slate-800 lg:text-base">
                    Mati puede encargarse de organizar el warehouse, pero primero hay que construir los cofres.
                  </p>
                  <div className="mt-8 rounded-lg border border-[#9f8352]/80 bg-[#d8c7a2]/92 lg:mt-12">
                    <p className="mt-2 text-center text-sm font-semibold leading-relaxed text-slate-900 lg:text-base">
                      {milestoneTitle}
                    </p>
                    <div className="mx-auto mt-3 h-4 w-3/5 max-w-2xl overflow-hidden rounded-full border border-[#9b7a46]/80 bg-[#e8d8b4]">
                      <div
                        className="h-full bg-gradient-to-r from-lime-500 to-emerald-600 transition-all duration-500"
                        style={{ width: `${milestoneProgressPercent}%` }}
                      />
                    </div>
                    <p className="mb-2 mt-2 text-center text-xs uppercase tracking-wide text-slate-700">
                      {milestoneCurrentValue} / {milestoneTargetValue} ({milestoneProgressPercent}%)
                    </p>
                  </div>
                  <div className="mt-10 flex items-center justify-center gap-2 text-sm font-semibold leading-relaxed text-slate-700 lg:text-base">
                    <p>Tenés disponible: {userWoodQuantity}</p>
                    <Image
                      src={woodIconSrc}
                      alt="Madera"
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px] object-contain"
                    />
                  </div>
                  <WoodAmountSelector maxAmount={userWoodQuantity} onContribute={contributeWood} />
                  <div className="mt-8 flex justify-center">
                    <Link
                      href="/garrison"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-3 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] lg:text-xs"
                    >
                      <span className="text-base leading-none" aria-hidden>
                        ←
                      </span>
                      volver al campamento
                    </Link>
                  </div>
                </div>
              </section>
            </main>
          </div>
        )
      ) : null}
    </div>
  );
}
