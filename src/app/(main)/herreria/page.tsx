import Image from "next/image";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { redirect } from "next/navigation";
import { WoodAmountSelector } from "@/components/campsite/wood-amount-selector";
import {
  HerreriaCompletedModal,
  type HerreriaAvailableRecipeItem,
  type HerreriaRecipeInventoryItem,
} from "@/components/herreria/herreria-completed-modal";
import { HerreriaConstructionDialogue } from "@/components/herreria/herreria-construction-dialogue";
import { createClient } from "@/lib/supabase/server";
import { insertWorldEventLog } from "@/lib/world-event-log";
import Link from "next/link";

const WOOD_ITEM_ID = "ea5b9601-8a7d-4270-b5d9-cf292d49945e";
const STONE_FALLBACK_ICON = "/img/resources/items/resource_rock.png";
const HERRERIA_WOOD_MILESTONE = {
  id: 6,
  title: "crafting_bench_madera",
  label: "Madera necesaria:",
  materialLabel: "madera",
  completedEvent: "¡Objetivo completado: Madera de Herrería reunida!",
} as const;
const HERRERIA_STONE_MILESTONE = {
  id: 7,
  title: "crafting_bench_piedra",
  label: "Piedra necesaria:",
  materialLabel: "piedra",
  completedEvent: "¡Objetivo completado: Piedra de Herrería reunida!",
} as const;
const HERRERIA_COMPLETED_MILESTONE = {
  id: 9,
  title: "crafting_bench_completed",
} as const;

type HerreriaMilestoneRow = {
  id: number | null;
  title: string | null;
  current_value: number | null;
  target_value: number | null;
  is_completed: boolean | null;
};
type HerreriaRecipeInventoryRow = {
  id: number;
  quantity: number | null;
  item_id: string | null;
  items:
    | {
        name: string | null;
        icon_path: string | null;
        rarity_color: string | null;
      }
    | Array<{
        name: string | null;
        icon_path: string | null;
        rarity_color: string | null;
      }>
    | null;
};
type HerreriaRecipeInventoryActionRow = {
  item_id: string | null;
  items:
    | {
        equip_slot: string | null;
      }
    | Array<{
        equip_slot: string | null;
      }>
    | null;
};
type GlobalHerreriaRecipeRow = {
  recipe_id: string | null;
  recipe_level: number | null;
  max_level: number | null;
};
type HerreriaRecipeItemRow = {
  id: string;
  name: string | null;
  description?: string | null;
  quote_text?: string | null;
  icon_path: string | null;
  rarity_color: string | null;
  equip_slot?: string | null;
};
type RecipeComponentRow = {
  recipe_id: string | null;
  recipe_level: number | null;
  crafted_item: unknown;
  [key: string]: unknown;
};
type CraftedWeaponInstanceRow = {
  id: number;
  item_id: string;
  rarity: string | null;
  rarity_color: string | null;
  attack_type: string | null;
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
  stat_key_4: string | null;
  value_flat_4: number | null;
  stat_key_5: string | null;
  value_flat_5: number | null;
};
type CraftedEquipmentInstanceRow = Omit<
  CraftedWeaponInstanceRow,
  "attack_type" | "attack_damage_min" | "attack_damage_max" | "magic_damage_min" | "magic_damage_max"
>;
type CraftedItemRequirementRow = {
  item_id: string;
  min_level: number | null;
  required_stat_key_1: string | null;
  required_stat_value_1: number | null;
  required_stat_key_2: string | null;
  required_stat_value_2: number | null;
  classes:
    | { name: string | null }
    | Array<{ name: string | null }>
    | null;
};
type ComponentInventoryRow = {
  id?: number | null;
  item_id: string | null;
  quantity: number | null;
};

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

function resolvePlayerName(input: string | null | undefined, fallback: string) {
  const value = input?.trim();
  return value ? value : fallback;
}

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

function resolveItemIconPath(iconPath: string | null | undefined) {
  if (!iconPath || typeof iconPath !== "string") {
    return "/img/resources/logos/logo_latia_rpg.png";
  }
  const trimmedPath = iconPath.trim();
  if (!trimmedPath) return "/img/resources/logos/logo_latia_rpg.png";
  if (
    trimmedPath.startsWith("/") ||
    trimmedPath.startsWith("http://") ||
    trimmedPath.startsWith("https://")
  ) {
    return trimmedPath;
  }
  return `/${trimmedPath}`;
}

function resolveCraftedItemId(input: unknown): string | null {
  if (typeof input === "string" && input.trim().length > 0) {
    return input.trim();
  }
  if (Array.isArray(input)) {
    for (const entry of input) {
      const resolved = resolveCraftedItemId(entry);
      if (resolved) return resolved;
    }
    return null;
  }
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    const candidates = [record.id, record.item_id, record.itemId, record.crafted_item_id];
    for (const candidate of candidates) {
      const resolved = resolveCraftedItemId(candidate);
      if (resolved) return resolved;
    }
  }
  return null;
}

function resolveRecipeComponentItemId(input: unknown): string | null {
  if (typeof input === "string" && input.trim().length > 0) {
    return input.trim();
  }
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    const candidates = [
      record.component_item,
      record.component_item_id,
      record.component_id,
      record.item_id,
      record.item,
      record.material_item,
      record.material_item_id,
      record.required_item,
      record.required_item_id,
      record.id,
    ];
    for (const candidate of candidates) {
      const resolved = resolveRecipeComponentItemId(candidate);
      if (resolved) return resolved;
    }
  }
  return null;
}

function resolveRecipeComponentQuantity(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.max(1, Math.trunc(input));
  }
  if (typeof input === "string") {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : 1;
  }
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    const candidates = [
      record.quantity,
      record.qty,
      record.amount,
      record.required_quantity,
      record.component_quantity,
      record.count,
    ];
    for (const candidate of candidates) {
      const resolved = resolveRecipeComponentQuantity(candidate);
      if (resolved > 1) return resolved;
    }
  }
  return 1;
}

function recipeComponentEntries(row: RecipeComponentRow) {
  const record = row as Record<string, unknown>;
  const nestedComponents = record.components ?? record.componentes ?? record.required_components;

  if (Array.isArray(nestedComponents)) {
    return nestedComponents.flatMap((entry) => {
      const itemId = resolveRecipeComponentItemId(entry);
      if (!itemId) return [];
      return [{ itemId, quantity: resolveRecipeComponentQuantity(entry) }];
    });
  }

  const numberedComponents = Object.keys(record).flatMap((key) => {
    const match = /^component_(\d+)$/.exec(key);
    if (!match) return [];
    const itemId = resolveRecipeComponentItemId(record[key]);
    if (!itemId) return [];
    return [
      {
        itemId,
        quantity: resolveRecipeComponentQuantity(record[`quantity_${match[1]}`]),
      },
    ];
  });
  if (numberedComponents.length > 0) {
    return numberedComponents;
  }

  const itemId = resolveRecipeComponentItemId(record);
  if (!itemId) return [];
  return [{ itemId, quantity: resolveRecipeComponentQuantity(record) }];
}

function recipeComponentItemType(row: RecipeComponentRow): "weapon" | "equipment" | null {
  const raw = row.item_type;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "weapon" || normalized === "equipment") return normalized;
  return null;
}

function randomIdFromRows(rows: Array<{ id: number | null }>) {
  const ids = rows
    .map((row) => row.id)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (ids.length === 0) return null;
  return ids[Math.floor(Math.random() * ids.length)] ?? null;
}

function formatCraftedStatLine(
  statKey: string | null | undefined,
  valueFlat: number | null | undefined,
  valuePct: number | null | undefined,
) {
  const key = statKey?.trim();
  if (!key) return null;
  if (valueFlat != null && Number.isFinite(Number(valueFlat))) {
    return `+ ${valueFlat} ${key}`;
  }
  if (valuePct != null && Number.isFinite(Number(valuePct))) {
    return `+ ${valuePct}% ${key}`;
  }
  return null;
}

function craftedDamageRange(min: number | null | undefined, max: number | null | undefined) {
  const a = min != null && Number.isFinite(Number(min)) ? Number(min) : 0;
  const b = max != null && Number.isFinite(Number(max)) ? Number(max) : 0;
  return `${a} - ${b}`;
}

function formatAttackType(raw: string | null | undefined) {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "finesse") return "Finesse";
  if (lower === "martial") return "Martial";
  return value;
}

function craftedItemRequirementLines(requirements: CraftedItemRequirementRow[]) {
  const classNames: string[] = [];
  const seenClassNames = new Set<string>();
  let requiredMinLevel = 0;
  const statRequirements = new Map<string, { key: string; value: number }>();

  const addStatRequirement = (keyInput: string | null, valueInput: number | null) => {
    const key = keyInput?.trim();
    const value = Math.max(0, Math.trunc(Number(valueInput ?? 0)));
    if (!key || value <= 0) return;
    const normalizedKey = key.toLowerCase();
    const previous = statRequirements.get(normalizedKey);
    if (!previous || value > previous.value) {
      statRequirements.set(normalizedKey, { key: key.toUpperCase(), value });
    }
  };

  for (const requirement of requirements) {
    const classJoin = Array.isArray(requirement.classes)
      ? (requirement.classes[0] ?? null)
      : requirement.classes;
    const className =
      classJoin && typeof classJoin.name === "string" && classJoin.name.trim().length > 0
        ? classJoin.name.trim()
        : null;
    if (className) {
      const normalizedClassName = className.toLowerCase();
      if (!seenClassNames.has(normalizedClassName)) {
        seenClassNames.add(normalizedClassName);
        classNames.push(className);
      }
    }

    requiredMinLevel = Math.max(
      requiredMinLevel,
      Math.max(0, Math.trunc(Number(requirement.min_level ?? 0))),
    );
    addStatRequirement(requirement.required_stat_key_1, requirement.required_stat_value_1);
    addStatRequirement(requirement.required_stat_key_2, requirement.required_stat_value_2);
  }

  return [
    ...(classNames.length > 0 ? [{ label: "Clase", value: classNames.join(", ") }] : []),
    ...(requiredMinLevel > 0 ? [{ label: "Nivel", value: String(requiredMinLevel) }] : []),
    ...Array.from(statRequirements.values()).map((requirement) => ({
      label: "Stat",
      value: `${requirement.value} ${requirement.key}`,
    })),
  ];
}

function milestoneProgress(row: HerreriaMilestoneRow | null | undefined) {
  const current =
    typeof row?.current_value === "number" && Number.isFinite(row.current_value)
      ? Math.max(0, Math.trunc(row.current_value))
      : 0;
  const target =
    typeof row?.target_value === "number" && Number.isFinite(row.target_value)
      ? Math.max(1, Math.trunc(row.target_value))
      : 1;
  const percent = Math.min(100, Math.max(0, Math.round((current / target) * 100)));
  return { current, target, percent, isCompleted: row?.is_completed === true };
}

async function completeHerreriaIfMaterialsReady(
  supabaseAction: Awaited<ReturnType<typeof createClient>>,
  authUserId?: string | null,
) {
  const { data: materialMilestones } = await supabaseAction
    .from("global_milestones")
    .select("id, title, is_completed")
    .in("id", [HERRERIA_WOOD_MILESTONE.id, HERRERIA_STONE_MILESTONE.id]);

  const woodCompleted = materialMilestones?.some(
    (row) =>
      row.id === HERRERIA_WOOD_MILESTONE.id &&
      row.title === HERRERIA_WOOD_MILESTONE.title &&
      row.is_completed === true,
  );
  const stoneCompleted = materialMilestones?.some(
    (row) =>
      row.id === HERRERIA_STONE_MILESTONE.id &&
      row.title === HERRERIA_STONE_MILESTONE.title &&
      row.is_completed === true,
  );

  if (!woodCompleted || !stoneCompleted) {
    return false;
  }

  const { data: completedRows } = await supabaseAction
    .from("global_milestones")
    .update({
      current_value: 1,
      is_completed: true,
    })
    .eq("id", HERRERIA_COMPLETED_MILESTONE.id)
    .eq("title", HERRERIA_COMPLETED_MILESTONE.title)
    .or("is_completed.is.false,is_completed.is.null")
    .select("id");

  const completedNow = (completedRows?.length ?? 0) > 0;
  if (completedNow) {
    await insertWorldEventLog(supabaseAction, authUserId, {
      happened_at: new Date().toISOString(),
      member_name: "world",
      event_html:
        '<span style="color:#22c55e;font-weight:700;">¡Objetivo completado: Herreria Construida!</span>',
    });
  }

  return completedNow;
}

export default async function HerreriaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("herreria_construction_dialog")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: userCharacter } = await supabase
    .from("user_character")
    .select("character_name")
    .eq("profile_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("miembro, color")
    .eq("id", user.id)
    .maybeSingle();
  const { data: herreriaWoodMilestone } = await supabase
    .from("global_milestones")
    .select("id, title, current_value, target_value, is_completed")
    .eq("id", HERRERIA_WOOD_MILESTONE.id)
    .eq("title", HERRERIA_WOOD_MILESTONE.title)
    .maybeSingle();
  const { data: herreriaStoneMilestone } = await supabase
    .from("global_milestones")
    .select("id, title, current_value, target_value, is_completed")
    .eq("id", HERRERIA_STONE_MILESTONE.id)
    .eq("title", HERRERIA_STONE_MILESTONE.title)
    .maybeSingle();
  const { data: herreriaCompletedMilestone } = await supabase
    .from("global_milestones")
    .select("id, title, current_value, target_value, is_completed")
    .eq("id", HERRERIA_COMPLETED_MILESTONE.id)
    .eq("title", HERRERIA_COMPLETED_MILESTONE.title)
    .maybeSingle();
  const { data: woodInventoryRows } = await supabase
    .from("user_inventory")
    .select("quantity")
    .eq("profile_id", user.id)
    .eq("item_id", WOOD_ITEM_ID);
  const { data: woodItem } = await supabase
    .from("items")
    .select("icon_path")
    .eq("id", WOOD_ITEM_ID)
    .maybeSingle();
  const { data: stoneItem } = await supabase
    .from("items")
    .select("id, icon_path")
    .or("icon_path.ilike.%resource_rock%,name.ilike.%piedra%,name.ilike.%stone%")
    .limit(1)
    .maybeSingle();
  const stoneItemId = typeof stoneItem?.id === "string" ? stoneItem.id : null;
  const { data: stoneInventoryRows } = stoneItemId
    ? await supabase
        .from("user_inventory")
        .select("quantity")
        .eq("profile_id", user.id)
        .eq("item_id", stoneItemId)
    : { data: [] };
  const { data: recipeInventoryRows } = await supabase
    .from("user_inventory")
    .select("id, item_id, quantity, items!inner(name, icon_path, rarity_color, equip_slot)")
    .eq("profile_id", user.id)
    .gt("quantity", 0)
    .eq("items.equip_slot", "recipe")
    .order("id", { ascending: true })
    .limit(8);
  const typedRecipeInventoryRows = (recipeInventoryRows ?? []) as HerreriaRecipeInventoryRow[];
  const recipeItemIds = Array.from(
    new Set(
      typedRecipeInventoryRows
        .map((row) => row.item_id)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ),
  );
  const { data: globalHerreriaRecipeRows } =
    recipeItemIds.length > 0
      ? await supabase
          .from("global_herreria")
          .select("recipe_id, recipe_level, max_level")
          .in("recipe_id", recipeItemIds)
      : { data: [] };
  const { data: availableGlobalHerreriaRows } = await supabase
    .from("global_herreria")
    .select("recipe_id, recipe_level, max_level")
    .gt("recipe_level", 0);
  const availableRecipeItemIds = Array.from(
    new Set(
      ((availableGlobalHerreriaRows ?? []) as GlobalHerreriaRecipeRow[])
        .map((row) => row.recipe_id)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ),
  );
  const { data: availableRecipeItems } =
    availableRecipeItemIds.length > 0
      ? await supabase
          .from("items")
          .select("id, name, icon_path, rarity_color")
          .in("id", availableRecipeItemIds)
      : { data: [] };
  const { data: availableRecipeComponents } =
    availableRecipeItemIds.length > 0
      ? await supabase
          .from("recipe_components")
          .select("*")
          .in("recipe_id", availableRecipeItemIds)
      : { data: [] };
  const craftedItemIds = Array.from(
    new Set(
      ((availableRecipeComponents ?? []) as RecipeComponentRow[])
        .map((row) => resolveCraftedItemId(row.crafted_item))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const { data: craftedItems } =
    craftedItemIds.length > 0
      ? await supabase
          .from("items")
          .select("id, name, description, quote_text, icon_path, rarity_color, equip_slot")
          .in("id", craftedItemIds)
      : { data: [] };
  const { data: craftedWeaponInstances } =
    craftedItemIds.length > 0
      ? await supabase
          .from("weapon_instance")
          .select(
            "id, item_id, rarity, rarity_color, attack_type, attack_damage_min, attack_damage_max, magic_damage_min, magic_damage_max, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3, stat_key_4, value_flat_4, stat_key_5, value_flat_5",
          )
          .in("item_id", craftedItemIds)
      : { data: [] };
  const { data: craftedEquipmentInstances } =
    craftedItemIds.length > 0
      ? await supabase
          .from("equipment_instances")
          .select(
            "id, item_id, rarity, rarity_color, stat_key_1, value_flat_1, value_pct_1, stat_key_2, value_flat_2, value_pct_2, stat_key_3, value_flat_3, value_pct_3, stat_key_4, value_flat_4, stat_key_5, value_flat_5",
          )
          .in("item_id", craftedItemIds)
      : { data: [] };
  const { data: craftedItemRequirements } =
    craftedItemIds.length > 0
      ? await supabase
          .from("item_class_requirements")
          .select("item_id, min_level, required_stat_key_1, required_stat_value_1, required_stat_key_2, required_stat_value_2, classes(name)")
          .in("item_id", craftedItemIds)
      : { data: [] };
  const componentItemIds = Array.from(
    new Set(
      ((availableRecipeComponents ?? []) as RecipeComponentRow[])
        .flatMap((row) => recipeComponentEntries(row).map((entry) => entry.itemId))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const { data: componentItems } =
    componentItemIds.length > 0
      ? await supabase
          .from("items")
          .select("id, name, icon_path, rarity_color")
          .in("id", componentItemIds)
      : { data: [] };
  const { data: componentInventoryRows } =
    componentItemIds.length > 0
      ? await supabase
          .from("user_inventory")
          .select("item_id, quantity")
          .eq("profile_id", user.id)
          .in("item_id", componentItemIds)
      : { data: [] };
  const { data: inventoryRowsForCapacity } = await supabase
    .from("user_inventory")
    .select("id")
    .eq("profile_id", user.id)
    .gt("quantity", 0);
  const { data: equippedRowsForCapacity } = await supabase
    .from("user_equipment")
    .select("inventory_id")
    .eq("profile_id", user.id);
  const typedAvailableRecipeComponents = (availableRecipeComponents ?? []) as RecipeComponentRow[];

  const isFinished = milestones?.herreria_construction_dialog === true;
  const fallbackName = user.email?.split("@")[0] ?? "Aventurero";
  const playerName = resolvePlayerName(
    userCharacter?.character_name,
    resolvePlayerName(profile?.miembro, fallbackName),
  );
  const woodMilestoneProgress = milestoneProgress(herreriaWoodMilestone);
  const stoneMilestoneProgress = milestoneProgress(herreriaStoneMilestone);
  const completedMilestoneProgress = milestoneProgress(herreriaCompletedMilestone);
  if (
    isFinished &&
    woodMilestoneProgress.isCompleted &&
    stoneMilestoneProgress.isCompleted &&
    !completedMilestoneProgress.isCompleted
  ) {
    const completedNow = await completeHerreriaIfMaterialsReady(supabase, user.id);
    if (completedNow) {
      redirect("/herreria");
    }
  }
  const isHerreriaCompleted = completedMilestoneProgress.isCompleted;
  const userWoodQuantity = (woodInventoryRows ?? []).reduce(
    (total, row) => total + (typeof row.quantity === "number" ? row.quantity : 0),
    0,
  );
  const userStoneQuantity = (stoneInventoryRows ?? []).reduce(
    (total, row) => total + (typeof row.quantity === "number" ? row.quantity : 0),
    0,
  );
  const remainingWoodNeeded = Math.max(
    0,
    woodMilestoneProgress.target - woodMilestoneProgress.current,
  );
  const remainingStoneNeeded = Math.max(
    0,
    stoneMilestoneProgress.target - stoneMilestoneProgress.current,
  );
  const maxWoodContribution = Math.min(userWoodQuantity, remainingWoodNeeded);
  const maxStoneContribution = Math.min(userStoneQuantity, remainingStoneNeeded);
  const woodIconSrc = resolveItemIconPath(woodItem?.icon_path);
  const stoneIconSrc = resolveItemIconPath(stoneItem?.icon_path ?? STONE_FALLBACK_ICON);
  const equippedInventoryIdsForCapacity = new Set(
    (equippedRowsForCapacity ?? [])
      .map((row) => row.inventory_id)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
  );
  const unequippedInventoryCount = (inventoryRowsForCapacity ?? []).reduce((total, row) => {
    const id = typeof row.id === "number" && Number.isFinite(row.id) ? Math.trunc(row.id) : null;
    if (id == null || equippedInventoryIdsForCapacity.has(id)) return total;
    return total + 1;
  }, 0);
  const hasInventorySpace = unequippedInventoryCount < 24;
  const globalRecipeById = new Map(
    ((globalHerreriaRecipeRows ?? []) as GlobalHerreriaRecipeRow[]).flatMap((row) => {
      if (typeof row.recipe_id !== "string" || row.recipe_id.trim().length === 0) return [];
      return [[row.recipe_id, row] as const];
    }),
  );
  const recipeInventoryItems: HerreriaRecipeInventoryItem[] = typedRecipeInventoryRows.flatMap((row) => {
    const item = Array.isArray(row.items) ? row.items[0] ?? null : row.items;
    if (!item?.name) return [];
    const globalRecipe = row.item_id ? globalRecipeById.get(row.item_id) : null;
    const recipeLevel =
      typeof globalRecipe?.recipe_level === "number" && Number.isFinite(globalRecipe.recipe_level)
        ? Math.max(0, Math.trunc(globalRecipe.recipe_level))
        : 0;
    const maxLevel =
      typeof globalRecipe?.max_level === "number" && Number.isFinite(globalRecipe.max_level)
        ? Math.max(0, Math.trunc(globalRecipe.max_level))
        : 0;
    return [
      {
        inventoryId: row.id,
        name: item.name,
        iconPath: resolveItemIconPath(item.icon_path),
        quantity:
          typeof row.quantity === "number" && Number.isFinite(row.quantity)
            ? Math.max(1, Math.trunc(row.quantity))
            : 1,
        rarityColor:
          typeof item.rarity_color === "string" && item.rarity_color.trim().length > 0
            ? item.rarity_color.trim()
            : null,
        isMaxLevel: maxLevel > 0 && recipeLevel >= maxLevel,
      },
    ];
  });
  const availableRecipeItemById = new Map(
    ((availableRecipeItems ?? []) as HerreriaRecipeItemRow[]).map((item) => [item.id, item]),
  );
  const recipeComponentsByRecipeAndLevel = new Map<string, RecipeComponentRow[]>();
  for (const row of typedAvailableRecipeComponents) {
    if (typeof row.recipe_id !== "string" || row.recipe_id.trim().length === 0) continue;
      const recipeLevel =
        typeof row.recipe_level === "number" && Number.isFinite(row.recipe_level)
          ? Math.max(0, Math.trunc(row.recipe_level))
          : 0;
    if (recipeLevel <= 0) continue;
    const key = `${row.recipe_id}:${recipeLevel}`;
    const list = recipeComponentsByRecipeAndLevel.get(key) ?? [];
    list.push(row);
    recipeComponentsByRecipeAndLevel.set(key, list);
  }
  const craftedItemById = new Map(
    ((craftedItems ?? []) as HerreriaRecipeItemRow[]).map((item) => [item.id, item]),
  );
  const craftedWeaponByItemId = new Map(
    ((craftedWeaponInstances ?? []) as CraftedWeaponInstanceRow[]).map((instance) => [
      instance.item_id,
      instance,
    ]),
  );
  const craftedEquipmentByItemId = new Map(
    ((craftedEquipmentInstances ?? []) as CraftedEquipmentInstanceRow[]).map((instance) => [
      instance.item_id,
      instance,
    ]),
  );
  const craftedRequirementsByItemId = new Map<string, CraftedItemRequirementRow[]>();
  for (const requirement of (craftedItemRequirements ?? []) as CraftedItemRequirementRow[]) {
    const list = craftedRequirementsByItemId.get(requirement.item_id) ?? [];
    list.push(requirement);
    craftedRequirementsByItemId.set(requirement.item_id, list);
  }
  const componentItemById = new Map(
    ((componentItems ?? []) as HerreriaRecipeItemRow[]).map((item) => [item.id, item]),
  );
  const componentOwnedQuantityByItemId = new Map<string, number>();
  for (const row of (componentInventoryRows ?? []) as ComponentInventoryRow[]) {
    if (typeof row.item_id !== "string" || row.item_id.trim().length === 0) continue;
    const quantity =
      typeof row.quantity === "number" && Number.isFinite(row.quantity)
        ? Math.max(0, Math.trunc(row.quantity))
        : 0;
    componentOwnedQuantityByItemId.set(
      row.item_id,
      (componentOwnedQuantityByItemId.get(row.item_id) ?? 0) + quantity,
    );
  }
  const availableRecipeItemsForModal: HerreriaAvailableRecipeItem[] = (
    (availableGlobalHerreriaRows ?? []) as GlobalHerreriaRecipeRow[]
  ).flatMap((row) => {
    if (typeof row.recipe_id !== "string" || row.recipe_id.trim().length === 0) return [];
    const recipeItem = availableRecipeItemById.get(row.recipe_id);
    if (!recipeItem?.name) return [];
    const recipeLevel =
      typeof row.recipe_level === "number" && Number.isFinite(row.recipe_level)
        ? Math.max(0, Math.trunc(row.recipe_level))
        : 0;
    const matchingComponents =
      recipeComponentsByRecipeAndLevel.get(`${row.recipe_id}:${recipeLevel}`) ?? [];
    const craftedItemId = resolveCraftedItemId(matchingComponents[0]?.crafted_item);
    const craftedItem = craftedItemId ? craftedItemById.get(craftedItemId) : null;
    const displayItem = craftedItem ?? recipeItem;
    const weaponInstance = craftedItemId ? craftedWeaponByItemId.get(craftedItemId) : null;
    const equipmentInstance =
      !weaponInstance && craftedItemId ? craftedEquipmentByItemId.get(craftedItemId) : null;
    const roll = weaponInstance ?? equipmentInstance ?? null;
    const firstStatLine = roll
      ? [
          formatCraftedStatLine(roll.stat_key_1, roll.value_flat_1, roll.value_pct_1),
          formatCraftedStatLine(roll.stat_key_2, roll.value_flat_2, roll.value_pct_2),
          formatCraftedStatLine(roll.stat_key_3, roll.value_flat_3, roll.value_pct_3),
          formatCraftedStatLine(roll.stat_key_4, roll.value_flat_4, null),
          formatCraftedStatLine(roll.stat_key_5, roll.value_flat_5, null),
        ].find((line): line is string => Boolean(line)) ?? null
      : null;
    const requirements = craftedItemId
      ? craftedItemRequirementLines(craftedRequirementsByItemId.get(craftedItemId) ?? [])
      : [];
    const components = matchingComponents.flatMap((componentRow) =>
      recipeComponentEntries(componentRow).flatMap((entry) => {
        const componentItem = componentItemById.get(entry.itemId);
        if (!componentItem?.name) return [];
        return [
          {
            itemId: entry.itemId,
            name: componentItem.name,
            iconPath: resolveItemIconPath(componentItem.icon_path),
            rarityColor:
              typeof componentItem.rarity_color === "string" &&
              componentItem.rarity_color.trim().length > 0
                ? componentItem.rarity_color.trim()
                : null,
            quantity: entry.quantity,
            ownedQuantity: componentOwnedQuantityByItemId.get(entry.itemId) ?? 0,
          },
        ];
      }),
    );

    return [
      {
        recipeId: row.recipe_id,
        name: recipeItem.name,
        craftedItemName: craftedItem?.name ?? recipeItem.name,
        recipeLevel,
        iconPath: resolveItemIconPath(displayItem.icon_path),
        rarityColor:
          typeof displayItem.rarity_color === "string" && displayItem.rarity_color.trim().length > 0
            ? displayItem.rarity_color.trim()
            : null,
        craftedTooltip: {
          name: craftedItem?.name ?? recipeItem.name,
          description:
            typeof craftedItem?.description === "string" && craftedItem.description.trim().length > 0
              ? craftedItem.description.trim()
              : null,
          quoteText:
            typeof craftedItem?.quote_text === "string" && craftedItem.quote_text.trim().length > 0
              ? craftedItem.quote_text.trim()
              : null,
          rarity: roll?.rarity ?? null,
          rarityColor: roll?.rarity_color ?? displayItem.rarity_color ?? null,
          slotLabel: craftedItem?.equip_slot?.toUpperCase() ?? null,
          attackType: weaponInstance ? formatAttackType(weaponInstance.attack_type) : null,
          damageLine: weaponInstance
            ? `${craftedDamageRange(weaponInstance.attack_damage_min, weaponInstance.attack_damage_max)} Daño`
            : null,
          magicDamageLine: weaponInstance
            ? `${craftedDamageRange(weaponInstance.magic_damage_min, weaponInstance.magic_damage_max)} Daño Mágico`
            : null,
          firstStatLine,
          requirements,
        },
        components,
      },
    ];
  });

  async function completeHerreriaConstructionDialog() {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser();

    if (!currentUser) return { ok: false };

    const { data: updatedRows } = await supabaseAction
      .from("user_milestones")
      .update({ herreria_construction_dialog: true })
      .eq("user_id", currentUser.id)
      .select("user_id");

    if (!updatedRows || updatedRows.length === 0) {
      await supabaseAction.from("user_milestones").insert({
        user_id: currentUser.id,
        herreria_construction_dialog: true,
      });
    }

    return { ok: true };
  }

  async function giveRecipeToChane(inventoryId: number) {
    "use server";

    const parsedInventoryId = Math.max(0, Math.trunc(Number(inventoryId) || 0));
    if (parsedInventoryId <= 0) {
      redirect("/herreria");
    }

    const supabaseAction = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser();

    if (!currentUser) {
      redirect("/login");
    }

    const { data: selectedInventoryRow } = await supabaseAction
      .from("user_inventory")
      .select("item_id, items!inner(equip_slot)")
      .eq("id", parsedInventoryId)
      .eq("profile_id", currentUser.id)
      .gt("quantity", 0)
      .eq("items.equip_slot", "recipe")
      .maybeSingle();

    const recipeInventoryRow = selectedInventoryRow as HerreriaRecipeInventoryActionRow | null;
    const recipeId =
      typeof recipeInventoryRow?.item_id === "string" && recipeInventoryRow.item_id.trim().length > 0
        ? recipeInventoryRow.item_id
        : null;
    if (!recipeId) {
      redirect("/herreria");
    }

    const { data: existingGlobalRecipe } = await supabaseAction
      .from("global_herreria")
      .select("recipe_id, recipe_level, max_level")
      .eq("recipe_id", recipeId)
      .maybeSingle();

    const globalRecipe = existingGlobalRecipe as GlobalHerreriaRecipeRow | null;
    const currentRecipeLevel =
      typeof globalRecipe?.recipe_level === "number" && Number.isFinite(globalRecipe.recipe_level)
        ? Math.max(0, Math.trunc(globalRecipe.recipe_level))
        : 0;
    const maxRecipeLevel =
      typeof globalRecipe?.max_level === "number" && Number.isFinite(globalRecipe.max_level)
        ? Math.max(0, Math.trunc(globalRecipe.max_level))
        : 0;

    if (!globalRecipe || maxRecipeLevel <= 0 || currentRecipeLevel >= maxRecipeLevel) {
      return;
    }

    await supabaseAction
      .from("global_herreria")
      .update({ recipe_level: Math.min(maxRecipeLevel, currentRecipeLevel + 1) })
      .eq("recipe_id", recipeId);

    await supabaseAction
      .from("user_inventory")
      .delete()
      .eq("id", parsedInventoryId)
      .eq("profile_id", currentUser.id);
  }

  async function craftRecipe(recipeId: string, recipeLevel: number) {
    "use server";

    const safeRecipeId = typeof recipeId === "string" ? recipeId.trim() : "";
    const parsedRecipeLevel = Math.max(0, Math.trunc(Number(recipeLevel) || 0));
    if (!safeRecipeId || parsedRecipeLevel <= 0) {
      return { ok: false };
    }

    const supabaseAction = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser();

    if (!currentUser) {
      redirect("/login");
    }

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
    if (unequippedCraftInventoryCount >= 24) {
      return { ok: false };
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
      return { ok: false };
    }

    const { data: recipeComponentData } = await supabaseAction
      .from("recipe_components")
      .select("*")
      .eq("recipe_id", safeRecipeId)
      .eq("recipe_level", parsedRecipeLevel)
      .maybeSingle();
    const recipeComponent = recipeComponentData as RecipeComponentRow | null;
    const craftedItemId = recipeComponent ? resolveCraftedItemId(recipeComponent.crafted_item) : null;
    const componentEntries = recipeComponent ? recipeComponentEntries(recipeComponent) : [];

    if (!recipeComponent || !craftedItemId || componentEntries.length === 0) {
      return { ok: false };
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

    for (const [itemId, requiredQuantity] of requiredByItemId) {
      if ((ownedByItemId.get(itemId) ?? 0) < requiredQuantity) {
        return { ok: false };
      }
    }

    for (const [itemId, requiredQuantity] of requiredByItemId) {
      let pendingDiscount = requiredQuantity;
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
    }

    const itemType = recipeComponentItemType(recipeComponent);
    let weaponInstanceId: number | null = null;
    let equipmentInstanceId: number | null = null;

    if (itemType === "weapon") {
      const { data: weaponRows } = await supabaseAction
        .from("weapon_instance")
        .select("id")
        .eq("item_id", craftedItemId);
      weaponInstanceId = randomIdFromRows((weaponRows ?? []) as Array<{ id: number | null }>);
    }

    if (itemType === "equipment") {
      const { data: equipmentRows } = await supabaseAction
        .from("equipment_instances")
        .select("id")
        .eq("item_id", craftedItemId);
      equipmentInstanceId = randomIdFromRows((equipmentRows ?? []) as Array<{ id: number | null }>);
    }

    if (itemType === "weapon" && weaponInstanceId == null) {
      return { ok: false };
    }

    if (itemType === "equipment" && equipmentInstanceId == null) {
      return { ok: false };
    }

    const insertPayload: {
      profile_id: string;
      quantity: number;
      item_id?: string;
      weapon_instance_id?: number;
      equipment_instance_id?: number;
    } = {
      profile_id: currentUser.id,
      quantity: 1,
    };

    if (weaponInstanceId != null) {
      insertPayload.weapon_instance_id = weaponInstanceId;
    } else if (equipmentInstanceId != null) {
      insertPayload.equipment_instance_id = equipmentInstanceId;
    } else {
      insertPayload.item_id = craftedItemId;
    }

    const { error: insertInventoryError } = await supabaseAction
      .from("user_inventory")
      .insert(insertPayload);

    if (insertInventoryError) {
      return { ok: false };
    }

    return { ok: true };
  }

  async function contributeWood(amount: number) {
    "use server";

    const parsedAmount = Math.max(0, Math.floor(Number(amount) || 0));
    if (parsedAmount <= 0) {
      redirect("/herreria");
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
      .eq("item_id", WOOD_ITEM_ID)
      .order("id", { ascending: true });

    const availableWood = (inventoryRows ?? []).reduce(
      (total, row) => total + (typeof row.quantity === "number" ? row.quantity : 0),
      0,
    );
    const { data: globalMilestone } = await supabaseAction
      .from("global_milestones")
      .select("id, current_value, target_value, is_completed")
      .eq("id", HERRERIA_WOOD_MILESTONE.id)
      .eq("title", HERRERIA_WOOD_MILESTONE.title)
      .maybeSingle();

    if (!globalMilestone) {
      redirect("/herreria");
    }

    const currentGlobalValue =
      typeof globalMilestone.current_value === "number" &&
      Number.isFinite(globalMilestone.current_value)
        ? Math.max(0, Math.trunc(globalMilestone.current_value))
        : 0;
    const targetGlobalValue =
      typeof globalMilestone.target_value === "number" &&
      Number.isFinite(globalMilestone.target_value)
        ? Math.max(1, Math.trunc(globalMilestone.target_value))
        : 1;
    const remainingNeeded = Math.max(0, targetGlobalValue - currentGlobalValue);
    const amountToApply = Math.min(parsedAmount, availableWood, remainingNeeded);
    if (amountToApply <= 0) {
      redirect("/herreria");
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

    const alreadyCompleted = globalMilestone.is_completed === true;
    const nextGlobalValue = currentGlobalValue + amountToApply;
    const shouldMarkCompleted = nextGlobalValue >= targetGlobalValue;

    await supabaseAction
      .from("global_milestones")
      .update({
        current_value: nextGlobalValue,
        is_completed: shouldMarkCompleted ? true : undefined,
        completed_at: shouldMarkCompleted && !alreadyCompleted ? new Date().toISOString() : undefined,
      })
      .eq("id", HERRERIA_WOOD_MILESTONE.id)
      .eq("title", HERRERIA_WOOD_MILESTONE.title);

    const { data: currentStats } = await supabaseAction
      .from("user_stats")
      .select("wood_given")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    const currentWoodGiven =
      typeof currentStats?.wood_given === "number" && Number.isFinite(currentStats.wood_given)
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
    const { data: currentCharacter } = await supabaseAction
      .from("user_character")
      .select("character_name")
      .eq("profile_id", currentUser.id)
      .maybeSingle();
    const fallbackCurrentName = currentUser.email?.split("@")[0] ?? "Aventurero";
    const memberName = capitalizeFirst(
      resolvePlayerName(
        currentCharacter?.character_name,
        resolvePlayerName(currentProfile?.miembro, fallbackCurrentName),
      ),
    );
    const memberColor = currentProfile?.color?.trim() || "#f8fafc";
    const safeMemberName = escapeHtml(memberName);
    const eventHtml = `<span style="color:${memberColor}">${safeMemberName}</span> aportó ${amountToApply} de madera para construir la Herreria.`;
    await insertWorldEventLog(supabaseAction, currentUser.id, {
      happened_at: new Date().toISOString(),
      member_name: memberName,
      event_html: eventHtml,
    });

    if (shouldMarkCompleted && !alreadyCompleted) {
      await insertWorldEventLog(supabaseAction, currentUser.id, {
        happened_at: new Date().toISOString(),
        member_name: "world",
        event_html: `<span style="color:#22c55e;font-weight:700;">${HERRERIA_WOOD_MILESTONE.completedEvent}</span>`,
      });
    }

    await completeHerreriaIfMaterialsReady(supabaseAction, currentUser.id);

    redirect("/herreria");
  }

  async function contributeStone(amount: number) {
    "use server";

    const parsedAmount = Math.max(0, Math.floor(Number(amount) || 0));
    if (parsedAmount <= 0) {
      redirect("/herreria");
    }

    const supabaseAction = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser();

    if (!currentUser) {
      redirect("/login");
    }

    const { data: currentStoneItem } = await supabaseAction
      .from("items")
      .select("id")
      .or("icon_path.ilike.%resource_rock%,name.ilike.%piedra%,name.ilike.%stone%")
      .limit(1)
      .maybeSingle();
    const currentStoneItemId =
      typeof currentStoneItem?.id === "string" ? currentStoneItem.id : null;
    if (!currentStoneItemId) {
      redirect("/herreria");
    }

    const { data: inventoryRows } = await supabaseAction
      .from("user_inventory")
      .select("id, quantity")
      .eq("profile_id", currentUser.id)
      .eq("item_id", currentStoneItemId)
      .order("id", { ascending: true });

    const availableStone = (inventoryRows ?? []).reduce(
      (total, row) => total + (typeof row.quantity === "number" ? row.quantity : 0),
      0,
    );
    const { data: globalMilestone } = await supabaseAction
      .from("global_milestones")
      .select("id, current_value, target_value, is_completed")
      .eq("id", HERRERIA_STONE_MILESTONE.id)
      .eq("title", HERRERIA_STONE_MILESTONE.title)
      .maybeSingle();

    if (!globalMilestone) {
      redirect("/herreria");
    }

    const currentGlobalValue =
      typeof globalMilestone.current_value === "number" &&
      Number.isFinite(globalMilestone.current_value)
        ? Math.max(0, Math.trunc(globalMilestone.current_value))
        : 0;
    const targetGlobalValue =
      typeof globalMilestone.target_value === "number" &&
      Number.isFinite(globalMilestone.target_value)
        ? Math.max(1, Math.trunc(globalMilestone.target_value))
        : 1;
    const remainingNeeded = Math.max(0, targetGlobalValue - currentGlobalValue);
    const amountToApply = Math.min(parsedAmount, availableStone, remainingNeeded);
    if (amountToApply <= 0) {
      redirect("/herreria");
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

    const alreadyCompleted = globalMilestone.is_completed === true;
    const nextGlobalValue = currentGlobalValue + amountToApply;
    const shouldMarkCompleted = nextGlobalValue >= targetGlobalValue;

    await supabaseAction
      .from("global_milestones")
      .update({
        current_value: nextGlobalValue,
        is_completed: shouldMarkCompleted ? true : undefined,
        completed_at: shouldMarkCompleted && !alreadyCompleted ? new Date().toISOString() : undefined,
      })
      .eq("id", HERRERIA_STONE_MILESTONE.id)
      .eq("title", HERRERIA_STONE_MILESTONE.title);

    const { data: currentProfile } = await supabaseAction
      .from("user_profiles")
      .select("miembro, color")
      .eq("id", currentUser.id)
      .maybeSingle();
    const { data: currentCharacter } = await supabaseAction
      .from("user_character")
      .select("character_name")
      .eq("profile_id", currentUser.id)
      .maybeSingle();
    const fallbackCurrentName = currentUser.email?.split("@")[0] ?? "Aventurero";
    const memberName = capitalizeFirst(
      resolvePlayerName(
        currentCharacter?.character_name,
        resolvePlayerName(currentProfile?.miembro, fallbackCurrentName),
      ),
    );
    const memberColor = currentProfile?.color?.trim() || "#f8fafc";
    const safeMemberName = escapeHtml(memberName);
    const eventHtml = `<span style="color:${memberColor}">${safeMemberName}</span> aportó ${amountToApply} de piedra para construir la Herreria.`;
    await insertWorldEventLog(supabaseAction, currentUser.id, {
      happened_at: new Date().toISOString(),
      member_name: memberName,
      event_html: eventHtml,
    });

    if (shouldMarkCompleted && !alreadyCompleted) {
      await insertWorldEventLog(supabaseAction, currentUser.id, {
        happened_at: new Date().toISOString(),
        member_name: "world",
        event_html: `<span style="color:#22c55e;font-weight:700;">${HERRERIA_STONE_MILESTONE.completedEvent}</span>`,
      });
    }

    await completeHerreriaIfMaterialsReady(supabaseAction, currentUser.id);

    redirect("/herreria");
  }

  return (
    <main
      className={`relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#120b08] px-4 py-8 text-amber-50 ${uiFont.className}`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: isHerreriaCompleted
            ? "url('/img/resources/background/bg_herreria_base.png')"
            : "url('/img/resources/background/bg_second_base.png')",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/45" aria-hidden />

      {isHerreriaCompleted ? (
        <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-7.5rem)] w-full max-w-6xl items-center justify-center">
          <div className="w-full max-w-md rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm lg:p-4">
            <HerreriaCompletedModal
              recipes={recipeInventoryItems}
              availableRecipes={availableRecipeItemsForModal}
              hasInventorySpace={hasInventorySpace}
              onGiveRecipe={giveRecipeToChane}
              onCraftRecipe={craftRecipe}
              className={dialogueFont.className}
              actionButtonClassName={uiFont.className}
              tooltipClassName={uiFont.className}
              uiClassName={uiFont.className}
            />
          </div>
        </section>
      ) : isFinished ? (
        <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-7.5rem)] w-full max-w-6xl items-center justify-center">
          <div className="w-full max-w-3xl rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm lg:p-4">
            <div
              className={`rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-4 text-center lg:p-5 ${dialogueFont.className}`}
            >
              <p className="text-sm leading-relaxed text-slate-800 sm:text-base">
                Chane está juntando madera y piedra para armar la herrería y empezar a trabajar esas recetas de armaduras.
              </p>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-3">
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
                    {HERRERIA_WOOD_MILESTONE.label}
                  </p>
                  <div className="mx-auto mt-3 h-4 w-4/5 max-w-2xl overflow-hidden rounded-full border border-[#9b7a46]/80 bg-[#e8d8b4]">
                    <div
                      className="h-full bg-gradient-to-r from-lime-500 to-emerald-600 transition-all duration-500"
                      style={{ width: `${woodMilestoneProgress.percent}%` }}
                    />
                  </div>
                  <p className="mb-2 mt-2 text-xs uppercase tracking-wide text-slate-700">
                    {woodMilestoneProgress.current} / {woodMilestoneProgress.target} (
                    {woodMilestoneProgress.percent}%)
                  </p>
                  <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold leading-relaxed text-slate-700 sm:text-base">
                    <p>Tenés disponible: {userWoodQuantity}</p>
                    <Image
                      src={woodIconSrc}
                      alt="Madera"
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px] object-contain"
                    />
                  </div>
                  <WoodAmountSelector
                    maxAmount={maxWoodContribution}
                    onContribute={contributeWood}
                    materialName={HERRERIA_WOOD_MILESTONE.materialLabel}
                  />
                </div>
                <div className="rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-3">
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
                    {HERRERIA_STONE_MILESTONE.label}
                  </p>
                  <div className="mx-auto mt-3 h-4 w-4/5 max-w-2xl overflow-hidden rounded-full border border-[#9b7a46]/80 bg-[#e8d8b4]">
                    <div
                      className="h-full bg-gradient-to-r from-stone-500 to-slate-500 transition-all duration-500"
                      style={{ width: `${stoneMilestoneProgress.percent}%` }}
                    />
                  </div>
                  <p className="mb-2 mt-2 text-xs uppercase tracking-wide text-slate-700">
                    {stoneMilestoneProgress.current} / {stoneMilestoneProgress.target} (
                    {stoneMilestoneProgress.percent}%)
                  </p>
                  <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold leading-relaxed text-slate-700 sm:text-base">
                    <p>Tenés disponible: {userStoneQuantity}</p>
                    <Image
                      src={stoneIconSrc}
                      alt="Piedra"
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px] object-contain"
                    />
                  </div>
                  <WoodAmountSelector
                    maxAmount={maxStoneContribution}
                    onContribute={contributeStone}
                    materialName={HERRERIA_STONE_MILESTONE.materialLabel}
                  />
              
                </div>

              </div>
              <div className="mt-6 flex justify-center">
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
          </div>
        </section>
      ) : (
        <HerreriaConstructionDialogue
          playerName={playerName}
          onComplete={completeHerreriaConstructionDialog}
        />
      )}
    </main>
  );
}
