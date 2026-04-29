import { createClient } from "@/lib/supabase/server";
import { InventoryGrid, type CharacterPaperDollData } from "@/components/character-profile/inventory-grid";
import type { EquipmentInstanceTooltip, WeaponInstanceTooltip } from "@/components/character-profile/inventory-types";
import Image from "next/image";
import { redirect } from "next/navigation";
import { confirmStatAllocation } from "./actions";
import { StatsPanel } from "./stats-panel";

const inventorySlots = Array.from({ length: 24 }, (_, index) => index + 1);

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
      "character_name, level, experience_current, str, dex, int, wis, speed_total, hp_total, mana_total, armor_total, mr_total, attack_damage_total, magic_damage_total, weapon_damage_min, weapon_damage_max, magic_damage_min, magic_damage_max, stat_points_remaining",
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
    .order("id", { ascending: true })
    .limit(inventorySlots.length);
  const { data: equippedRows } = await supabase
    .from("user_equipment")
    .select("slot, inventory_id")
    .eq("profile_id", user.id);
  const equippedInventoryIds = new Set((equippedRows ?? []).map((row) => row.inventory_id));
  const visibleInventoryRows = (inventoryRows ?? []).filter((row) => !equippedInventoryIds.has(row.id));
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
          .select("id, name, description, icon_path, equip_slot, sell_value, item_type_id")
          .in("id", inventoryItemIds)
      : { data: [] };
  const inventoryItemMap = new Map((inventoryItems ?? []).map((item) => [item.id, item]));
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
        id: row.id,
        name: item.name,
        description: item.description ?? "Sin descripción.",
        iconPath: resolveInventoryIconPath(item.icon_path),
        quantity: row.quantity,
        equipSlot: item.equip_slot,
        sellValue: item.sell_value ?? 0,
        itemTypeId: item.item_type_id ?? null,
        rarityColor,
        equippedSlot: null,
        weaponInstance: weaponInstance ?? undefined,
        equipmentInstance: equipmentInstance ?? undefined,
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
          id: row.id,
          name: item.name,
          description: item.description ?? "Sin descripción.",
          iconPath: resolveInventoryIconPath(item.icon_path),
          quantity: row.quantity,
          equipSlot: item.equip_slot,
          sellValue: item.sell_value ?? 0,
          itemTypeId: item.item_type_id ?? null,
          rarityColor,
          equippedSlot: equippedRow.slot,
          weaponInstance: weaponInstanceEquipped ?? undefined,
          equipmentInstance: equipmentInstanceEquipped ?? undefined,
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
  const stats: Array<{ label: "STR" | "DEX" | "INT" | "WIS"; value: number }> = [
    { label: "STR", value: character?.str ?? 0 },
    { label: "DEX", value: character?.dex ?? 0 },
    { label: "INT", value: character?.int ?? 0 },
    { label: "WIS", value: character?.wis ?? 0 },
  ];
  const weaponMin = character?.weapon_damage_min ?? 0;
  const weaponMax = character?.weapon_damage_max ?? 0;
  const magicSheetMin = character?.magic_damage_min ?? 0;
  const magicSheetMax = character?.magic_damage_max ?? 0;

  const derivedStats: Array<{ label: string; value: string; icon: string }> = [
    {
      label: "HP",
      value: String(character?.hp_total ?? 0),
      icon: "/img/resources/iconos/icon_hp_profile.png",
    },
    {
      label: "MANA",
      value: String(character?.mana_total ?? 0),
      icon: "/img/resources/iconos/icon_mana_profile.png",
    },
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

  return (
    <div className="min-h-[100dvh] bg-[#1b0f0b] px-6 py-10 text-amber-50 [background-image:linear-gradient(90deg,rgba(59,34,23,0.95)_0%,rgba(59,34,23,0.95)_16%,rgba(77,45,30,0.95)_16%,rgba(77,45,30,0.95)_33%,rgba(52,30,20,0.95)_33%,rgba(52,30,20,0.95)_50%,rgba(74,43,29,0.95)_50%,rgba(74,43,29,0.95)_66%,rgba(56,33,22,0.95)_66%,rgba(56,33,22,0.95)_83%,rgba(70,41,27,0.95)_83%,rgba(70,41,27,0.95)_100%),linear-gradient(180deg,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.08)_8%,rgba(0,0,0,0.2)_16%,rgba(0,0,0,0.08)_24%,rgba(0,0,0,0.2)_32%,rgba(0,0,0,0.08)_40%,rgba(0,0,0,0.2)_48%,rgba(0,0,0,0.08)_56%,rgba(0,0,0,0.2)_64%,rgba(0,0,0,0.08)_72%,rgba(0,0,0,0.2)_80%,rgba(0,0,0,0.08)_88%,rgba(0,0,0,0.2)_100%)] [background-size:420px_100%,100%_22px]">
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <InventoryGrid
          profileTopRow={
            <section className="flex h-full min-h-0 flex-col rounded-xl border border-amber-800/60 bg-[#2a1812]/90 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] lg:col-span-3">
              <h2 className="text-lg font-semibold tracking-wide text-amber-300">ESTADISTICAS</h2>
              <div className="border-t border-amber-900/70" />
              <StatsPanel
                key={`${character?.stat_points_remaining ?? 0}-${character?.str ?? 0}-${character?.dex ?? 0}-${character?.int ?? 0}-${character?.wis ?? 0}`}
                stats={stats}
                statPointsRemaining={character?.stat_points_remaining ?? 0}
                onConfirm={confirmStatAllocation}
              />

              <div className="mt-5 border-t border-amber-900/70" />
              <div className="mt-3 grid grid-cols-1 gap-2">
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
        />
      </main>
    </div>
  );
}
