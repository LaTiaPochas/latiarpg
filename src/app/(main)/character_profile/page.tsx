import { createClient } from "@/lib/supabase/server";
import { InventoryGrid, type CharacterPaperDollData } from "@/components/character-profile/inventory-grid";
import type { EquipmentInstanceTooltip, WeaponInstanceTooltip } from "@/components/character-profile/inventory-types";
import Image from "next/image";
import { Montserrat } from "next/font/google";
import { redirect } from "next/navigation";
import { confirmStatAllocation } from "./actions";
import { StatsPanel } from "./stats-panel";

const inventorySlots = Array.from({ length: 24 }, (_, index) => index + 1);
const profileFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

function resolveInventoryIconPath(iconPath: string | null | undefined) {
  if (!iconPath || typeof iconPath !== "string") {
    return "/img/resources/logos/logo_latia_rpg.png";
  }

  const trimmedPath = iconPath.trim();
  if (!trimmedPath) {
    return "/img/resources/logos/logo_latia_rpg.png";
  }

  if (trimmedPath.startsWith("/") || trimmedPath.startsWith("http://") || trimmedPath.startsWith("https://")) {
    return trimmedPath;
  }

  return `/${trimmedPath}`;
}

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

type CharacterAbilityView = {
  id: string;
  name: string;
  description: string;
  manaCost: number;
  cooldownTurns: number;
  unlockLevel: number;
  target: string;
  effect: Record<string, unknown>;
};
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

type ItemTypeJoinRow = {
  code: string | null;
};

type InventoryItemRow = {
  id: string;
  name: string;
  description: string | null;
  quote_text: string | null;
  icon_path: string | null;
  equip_slot: string | null;
  sell_value: number | null;
  item_type_id: number | null;
  rarity_color: string | null;
  item_types: ItemTypeJoinRow | ItemTypeJoinRow[] | null;
  json_consumable_effect?: unknown;
};

function rawConsumableEffectFromItem(raw: unknown): Record<string, unknown> | null {
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

export default async function CharacterProfilePage() {
  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasSupabaseEnv) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 px-6 py-10 text-slate-100">
        <main className="mx-auto w-full max-w-3xl rounded-xl border border-amber-700/40 bg-amber-950/30 p-6">
          <h1 className="text-2xl font-bold">Faltan variables de Supabase</h1>
          <p className="mt-3 text-amber-100">
            Configura <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en <code>.env.local</code>
            .
          </p>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: character, error: characterError } = await supabase
    .from("user_character")
    .select(
      "character_name, level, experience_current, str, dex, int, wis, str_mod, dex_mod, int_mod, wis_mod, speed_total, hp_total, hp_actual, mana_total, mana_actual, armor_total, mr_total, attack_damage_total, magic_damage_total, weapon_damage_min, weapon_damage_max, magic_damage_min, magic_damage_max, stat_points_remaining",
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("miembro")
    .eq("id", user.id)
    .maybeSingle();

  const { data: userCharacterByProfileId, error: userCharacterProfileError } = await supabase
    .from("user_character")
    .select("class_name")
    .eq("profile_id", user.id)
    .maybeSingle();

  const { data: userCharacterByUserId } = userCharacterByProfileId
    ? { data: null }
    : await supabase
        .from("user_character")
        .select("class_name")
        .eq("user_id", user.id)
        .maybeSingle();

  const userCharacter = userCharacterByProfileId ?? userCharacterByUserId;
  const { data: classDataById, error: classByIdError } = userCharacter?.class_name
    ? await supabase
        .from("classes")
        .select("name")
        .eq("id", userCharacter.class_name)
        .maybeSingle()
    : { data: null };

  const { data: classDataByName } =
    userCharacter?.class_name && !classDataById
      ? await supabase
          .from("classes")
          .select("name")
          .eq("name", userCharacter.class_name)
          .maybeSingle()
      : { data: null };

  const { data: inventoryRows } = await supabase
    .from("user_inventory")
    .select("id, item_id, weapon_instance_id, equipment_instance_id, quantity")
    .eq("profile_id", user.id)
    .gt("quantity", 0)
    .order("id", { ascending: true });
  const { data: equippedRows } = await supabase
    .from("user_equipment")
    .select("slot, inventory_id")
    .eq("profile_id", user.id);
  const equippedInventoryIds = new Set((equippedRows ?? []).map((row) => row.inventory_id));
  const visibleInventoryRows = (inventoryRows ?? [])
    .filter((row) => !equippedInventoryIds.has(row.id))
    .slice(0, inventorySlots.length);
  const weaponInstanceIds = (inventoryRows ?? [])
    .map((row) => row.weapon_instance_id)
    .filter((value): value is number => typeof value === "number");
  const equipmentInstanceIds = (inventoryRows ?? [])
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
      (inventoryRows ?? [])
        .map((row) => {
          if (row.item_id) return row.item_id;
          if (row.weapon_instance_id) return weaponInstanceMap.get(row.weapon_instance_id)?.item_id ?? null;
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
          .select(
            "id, name, description, quote_text, icon_path, equip_slot, sell_value, item_type_id, rarity_color, json_consumable_effect, item_types(code)",
          )
          .in("id", inventoryItemIds)
      : { data: [] };
  const inventoryItemMap = new Map(
    ((inventoryItems ?? []) as InventoryItemRow[]).map((item) => [item.id, item]),
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
  const inventoryRowById = new Map((inventoryRows ?? []).map((row) => [row.id, row]));
  const inventorySlotsData = inventorySlots.map((slotNumber, index) => {
    const row = visibleInventoryRows[index];
    if (!row) {
      return { slotNumber, item: null as null };
    }

    const resolvedItemId =
      row.item_id ??
      (row.weapon_instance_id ? weaponInstanceMap.get(row.weapon_instance_id)?.item_id ?? null : null) ??
      (row.equipment_instance_id
        ? equipmentInstanceMap.get(row.equipment_instance_id)?.item_id ?? null
        : null);
    const item = resolvedItemId ? inventoryItemMap.get(resolvedItemId) : null;
    if (!item) {
      return { slotNumber, item: null as null };
    }
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

    return {
      slotNumber,
      item: {
        itemTypeCode: (() => {
          const typeJoin = Array.isArray(item.item_types) ? (item.item_types[0] ?? null) : item.item_types;
          const raw = typeJoin?.code;
          return typeof raw === "string" && raw.trim().length > 0 ? raw.trim().toLowerCase() : null;
        })(),
        id: row.id,
        name: item.name,
        description: item.description ?? "Sin descripción.",
        quoteText:
          typeof item.quote_text === "string" && item.quote_text.trim().length > 0
            ? item.quote_text.trim()
            : null,
        iconPath: resolveInventoryIconPath(item.icon_path),
        quantity: row.quantity,
        equipSlot: item.equip_slot,
        sellValue: item.sell_value ?? 0,
        itemTypeId: item.item_type_id ?? null,
        usableByClassNames: itemAllowedClassNamesMap.get(item.id) ?? [],
        requiredMinLevel: itemRequiredMinLevelMap.get(item.id) ?? 0,
        requiredStats: itemRequiredStatsMap.get(item.id) ?? [],
        rarityColor,
        equippedSlot: null,
        weaponInstance: weaponInstance ?? undefined,
        equipmentInstance: equipmentInstance ?? undefined,
        consumableEffect: rawConsumableEffectFromItem(item.json_consumable_effect),
      },
    };
  });
  const equippedItems = (equippedRows ?? [])
    .map((equippedRow) => {
      const row = inventoryRowById.get(equippedRow.inventory_id);
      if (!row) return null;
      const resolvedItemId =
        row.item_id ??
        (row.weapon_instance_id ? weaponInstanceMap.get(row.weapon_instance_id)?.item_id ?? null : null) ??
        (row.equipment_instance_id
          ? equipmentInstanceMap.get(row.equipment_instance_id)?.item_id ?? null
          : null);
      const item = resolvedItemId ? inventoryItemMap.get(resolvedItemId) : null;
      if (!item) return null;
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
      const weaponInstanceEquipped = row.weapon_instance_id
        ? mapWeaponInstanceForTooltip(weaponInstanceMap.get(row.weapon_instance_id))
        : null;
      const equipmentInstanceEquipped =
        !row.weapon_instance_id && row.equipment_instance_id
          ? mapEquipmentInstanceForTooltip(equipmentInstanceMap.get(row.equipment_instance_id))
          : null;

      return {
        slot: equippedRow.slot,
        item: {
          itemTypeCode: (() => {
            const typeJoin = Array.isArray(item.item_types) ? (item.item_types[0] ?? null) : item.item_types;
            const raw = typeJoin?.code;
            return typeof raw === "string" && raw.trim().length > 0 ? raw.trim().toLowerCase() : null;
          })(),
          id: row.id,
          name: item.name,
          description: item.description ?? "Sin descripción.",
          quoteText:
            typeof item.quote_text === "string" && item.quote_text.trim().length > 0
              ? item.quote_text.trim()
              : null,
          iconPath: resolveInventoryIconPath(item.icon_path),
          quantity: row.quantity,
          equipSlot: item.equip_slot,
          sellValue: item.sell_value ?? 0,
          itemTypeId: item.item_type_id ?? null,
          usableByClassNames: itemAllowedClassNamesMap.get(item.id) ?? [],
          requiredMinLevel: itemRequiredMinLevelMap.get(item.id) ?? 0,
          requiredStats: itemRequiredStatsMap.get(item.id) ?? [],
          rarityColor,
          equippedSlot: equippedRow.slot,
          weaponInstance: weaponInstanceEquipped ?? undefined,
          equipmentInstance: equipmentInstanceEquipped ?? undefined,
          consumableEffect: rawConsumableEffectFromItem(item.json_consumable_effect),
        },
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const characterName =
    profile?.miembro?.trim() || character?.character_name || "Aventurero sin nombre";
  const characterNameUppercase = characterName.toUpperCase();
  const level = character?.level ?? 1;
  const className = classDataById?.name || classDataByName?.name || userCharacter?.class_name || "Aventurero";
  const experiencePoints = character?.experience_current ?? 0;
  const { data: currentLevelProgress, error: currentLevelProgressError } = await supabase
    .from("level_progression")
    .select("xp_required_total")
    .eq("level", level)
    .maybeSingle();
  const { data: nextLevelProgress, error: nextLevelProgressError } = await supabase
    .from("level_progression")
    .select("xp_required_total")
    .eq("level", level + 1)
    .maybeSingle();
  const currentLevelXp = currentLevelProgress?.xp_required_total ?? 0;
  const nextLevelXp = nextLevelProgress?.xp_required_total ?? currentLevelXp;
  const xpRange = nextLevelXp - currentLevelXp;
  const xpProgressPercent =
    xpRange > 0
      ? Math.min(
          100,
          Math.max(0, Math.round(((experiencePoints - currentLevelXp) / xpRange) * 100)),
        )
      : 100;
  const characterImageName = (character?.character_name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const avatarSrc = characterImageName
    ? `/img/resources/characters/pj_${characterImageName}_rpg_standing.png`
    : "/img/resources/logos/logo_latia_rpg.png";
  const characterPaperDoll: CharacterPaperDollData = {
    characterNameUppercase,
    level,
    className,
    xpProgressPercent,
    experiencePoints,
    currentLevelXp,
    xpRange,
    avatarSrc,
  };
  /** Bonos de equipo van a `*_mod`; la UI debe mostrar base + mod (como ya hace `speed_total` / `armor_total`). */
  const strEffective =
    Math.trunc(Number(character?.str ?? 0)) + Math.trunc(Number(character?.str_mod ?? 0));
  const dexEffective =
    Math.trunc(Number(character?.dex ?? 0)) + Math.trunc(Number(character?.dex_mod ?? 0));
  const intEffective =
    Math.trunc(Number(character?.int ?? 0)) + Math.trunc(Number(character?.int_mod ?? 0));
  const wisEffective =
    Math.trunc(Number(character?.wis ?? 0)) + Math.trunc(Number(character?.wis_mod ?? 0));
  const stats: Array<{ label: "STR" | "DEX" | "INT" | "WIS"; value: number }> = [
    { label: "STR", value: strEffective },
    { label: "DEX", value: dexEffective },
    { label: "INT", value: intEffective },
    { label: "WIS", value: wisEffective },
  ];
  const weaponMin = character?.weapon_damage_min ?? 0;
  const weaponMax = character?.weapon_damage_max ?? 0;
  const magicSheetMin = character?.magic_damage_min ?? 0;
  const magicSheetMax = character?.magic_damage_max ?? 0;
  const hpTotal = Math.max(0, character?.hp_total ?? 0);
  const hpActual = Math.min(hpTotal, Math.max(0, character?.hp_actual ?? hpTotal));
  const manaTotal = Math.max(0, character?.mana_total ?? 0);
  const manaActual = Math.min(manaTotal, Math.max(0, character?.mana_actual ?? manaTotal));
  const hpPercent = hpTotal > 0 ? Math.round((hpActual / hpTotal) * 100) : 0;
  const manaPercent = manaTotal > 0 ? Math.round((manaActual / manaTotal) * 100) : 0;

  const derivedStats: Array<{ label: string; value: string; icon: string }> = [
    {
      label: "ATK Damage",
      value: `${weaponMin} - ${weaponMax}`,
      icon: "/img/resources/iconos/icon_atkdamage.png",
    },
    {
      label: "Magic Damage",
      value: `${magicSheetMin} - ${magicSheetMax}`,
      icon: "/img/resources/iconos/icon_class_hechicero.png",
    },
    {
      label: "Armor",
      value: String(character?.armor_total ?? 0),
      icon: "/img/resources/iconos/icon_armor_profile.png",
    },
    {
      label: "Magic Resistance",
      value: String(character?.mr_total ?? 0),
      icon: "/img/resources/iconos/icon_mr_profile.png",
    },
    {
      label: "Speed",
      value: String(character?.speed_total ?? 0),
      icon: "/img/resources/iconos/icon_speed_profile.png",
    },
  ];

  const characterLevel = Math.max(1, Math.trunc(Number(character?.level ?? 1)));

  const { data: rawAbilityRows } = await supabase
    .from("user_character_skills")
    .select(
      `
      id,
      profile_id,
      player_skills (
        id,
        name,
        description,
        mana_cost,
        cooldown_turns,
        unlock_level,
        target,
        effect_json,
        is_active
      )
    `,
    )
    .eq("profile_id", user.id)
    .lte("player_skills.unlock_level", characterLevel)
    .order("id", { ascending: true });

  const abilities: CharacterAbilityView[] = ((rawAbilityRows ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const skillJoin = row.player_skills;
      const skill = Array.isArray(skillJoin)
        ? ((skillJoin[0] as Record<string, unknown> | undefined) ?? null)
        : (skillJoin as Record<string, unknown> | null);
      if (!skill || skill.is_active === false) return null;

      const skillId =
        typeof skill.id === "string" || typeof skill.id === "number" ? String(skill.id) : "";
      if (!skillId) return null;

      const name =
        typeof skill.name === "string" && skill.name.trim().length > 0
          ? skill.name.trim()
          : "Habilidad";
      const description =
        typeof skill.description === "string" && skill.description.trim().length > 0
          ? skill.description.trim()
          : typeof skill.effect_json === "object" &&
              skill.effect_json !== null &&
              typeof (skill.effect_json as Record<string, unknown>).description === "string" &&
              ((skill.effect_json as Record<string, unknown>).description as string).trim().length > 0
            ? ((skill.effect_json as Record<string, unknown>).description as string).trim()
            : "Sin descripción.";
      const manaCost =
        typeof skill.mana_cost === "number" ? Math.max(0, Math.trunc(skill.mana_cost)) : 0;
      const unlockLevel =
        typeof skill.unlock_level === "number" ? Math.max(0, Math.trunc(skill.unlock_level)) : 0;
      
        const cooldownTurns =
        typeof skill.cooldown_turns === "number"
          ? Math.max(1, Math.trunc(skill.cooldown_turns))
          : 1;
      const target =
        typeof skill.target === "string" && skill.target.trim().length > 0
          ? skill.target.trim()
          : "enemy_single";
      const effect =
        skill.effect_json && typeof skill.effect_json === "object" && !Array.isArray(skill.effect_json)
          ? (skill.effect_json as Record<string, unknown>)
          : {};

      return {
        id: skillId,
        name,
        description,
        manaCost,
        cooldownTurns,
        unlockLevel,
        target,
        effect,
      };
    })
    .filter((entry): entry is CharacterAbilityView => entry !== null)
    .sort((a, b) => a.unlockLevel - b.unlockLevel || a.name.localeCompare(b.name, "es"));

  return (
    <div
      className={`${profileFont.className} min-h-[100dvh] bg-fixed bg-cover bg-center bg-no-repeat px-6 pb-8 pt-3 text-amber-50 lg:py-10`}
      style={{
        backgroundImage:
          "linear-gradient(rgba(16, 10, 8, 0.74), rgba(16, 10, 8, 0.74)), url('/img/resources/background/bg_armory.jpg')",
      }}
    >
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <InventoryGrid
          profileTopRow={
            <section className="flex h-full min-h-0 flex-col rounded-xl border border-amber-800/60 bg-[#2a1812]/90 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] lg:col-span-3">
              <h2 className="text-lg font-semibold tracking-wide text-amber-300">ESTADISTICAS</h2>
              <div className="border-t border-amber-900/70" />
              <StatsPanel
                key={`${character?.stat_points_remaining ?? 0}-${strEffective}-${dexEffective}-${intEffective}-${wisEffective}`}
                stats={stats}
                statPointsRemaining={character?.stat_points_remaining ?? 0}
                onConfirm={confirmStatAllocation}
              />

              <div className="mt-5 border-t border-amber-900/70" />
              <div className="mt-3 grid grid-cols-1 gap-2">
                <div className="rounded-md border border-amber-900/60 bg-[#1f120e]/90 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Image
                      src="/img/resources/iconos/icon_hp_profile.png"
                      alt="HP"
                      width={22}
                      height={22}
                      className="h-[22px] w-[22px] rounded-sm object-cover"
                    />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-amber-200/70">HP</p>
                      <p className="mt-0.5 text-base font-bold leading-none text-amber-100">
                        {hpActual} / {hpTotal}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/45">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
                      style={{ width: `${hpPercent}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-md border border-amber-900/60 bg-[#1f120e]/90 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Image
                      src="/img/resources/iconos/icon_mana_profile.png"
                      alt="Mana"
                      width={22}
                      height={22}
                      className="h-[22px] w-[22px] rounded-sm object-cover"
                    />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-amber-200/70">MANA</p>
                      <p className="mt-0.5 text-base font-bold leading-none text-amber-100">
                        {manaActual} / {manaTotal}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/45">
                    <div
                      className="h-full bg-gradient-to-r from-sky-600 to-cyan-400 transition-all duration-300"
                      style={{ width: `${manaPercent}%` }}
                    />
                  </div>
                </div>

                {derivedStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center gap-2 rounded-md border border-amber-900/60 bg-[#1f120e]/90 px-3 py-2"
                  >
                    <Image
                      src={stat.icon}
                      alt={stat.label}
                      width={22}
                      height={22}
                      className="h-[22px] w-[22px] rounded-sm object-cover"
                    />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-amber-200/70">
                        {stat.label}
                      </p>
                      <p className="mt-0.5 text-base font-bold leading-none text-amber-100">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          }
          characterPaperDoll={characterPaperDoll}
          slots={inventorySlotsData}
          equippedItems={equippedItems}
          currentClassName={className}
          currentLevel={level}
          currentStats={{
            str: strEffective,
            dex: dexEffective,
            int: intEffective,
            wis: wisEffective,
          }}
          abilities={abilities}
          abilityStats={{
            str: strEffective,
            dex: dexEffective,
            int: intEffective,
            wis: wisEffective,
          }}
        />
      </main>
    </div>
  );
}
