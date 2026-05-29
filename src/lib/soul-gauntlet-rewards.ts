import { getGameDayIsoDate } from "@/lib/game-day";
import { grantBagItemGrantsToProfile } from "@/lib/inventory-grants";
import { resolveMeloniItemIconPath } from "@/lib/meloni-trades";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const SOUL_GAUNTLET_REWARD_TIERS = ["first_daily", "repeat_daily"] as const;

export type SoulGauntletRewardTier = (typeof SOUL_GAUNTLET_REWARD_TIERS)[number];

export type SoulGauntletGrantedRewardView = {
  itemId: string;
  name: string;
  quantity: number;
  iconPath: string;
  rarityColor: string | null;
};

/** Snapshot guardado en `user_soul_gauntlet_runs.granted_rewards` (jsonb). */
export type SoulGauntletGrantedRewardSnapshot = {
  itemId: string;
  quantity: number;
};

export function serializeGrantedRewardsSnapshot(
  granted: SoulGauntletGrantedRewardView[],
): SoulGauntletGrantedRewardSnapshot[] {
  return granted.map((item) => ({
    itemId: item.itemId,
    quantity: Math.max(1, Math.trunc(item.quantity)),
  }));
}

export function parseGrantedRewardsSnapshot(value: unknown): SoulGauntletGrantedRewardSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const itemId = typeof row.itemId === "string" ? row.itemId.trim() : "";
    if (!itemId) return [];
    const quantity =
      typeof row.quantity === "number" && Number.isFinite(row.quantity)
        ? Math.max(1, Math.trunc(row.quantity))
        : 1;
    return [{ itemId, quantity }];
  });
}

export function isSoulGauntletRewardTier(value: unknown): value is SoulGauntletRewardTier {
  return typeof value === "string" && SOUL_GAUNTLET_REWARD_TIERS.includes(value as SoulGauntletRewardTier);
}

export function soulGauntletRewardTierLabel(tier: SoulGauntletRewardTier): string {
  return tier === "first_daily" ? "Primera run del día" : "Ya recibiste las recompensas por primera partida del día. Vas a recibir recompensas reducidas.";
}

/** Primera run iniciada hoy (AR) → `first_daily`; el resto → `repeat_daily`. */
export async function resolveSoulGauntletRewardTierForNewRun(
  supabase: SupabaseServerClient,
  userId: string,
  gameDay: string = getGameDayIsoDate(),
): Promise<SoulGauntletRewardTier> {
  const { count, error } = await supabase
    .from("user_soul_gauntlet_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("game_day", gameDay);

  if (error) {
    return "first_daily";
  }

  return (count ?? 0) === 0 ? "first_daily" : "repeat_daily";
}

type FloorRewardRow = {
  floor: number;
  reward_tier: string;
  item_id: string;
  quantity: number | null;
  sort_order: number | null;
};

type BagItemGrantFromDb = { itemId: string; quantity: number };

export async function fetchSoulGauntletFloorRewardGrants(
  supabase: SupabaseServerClient,
  floor: number,
  rewardTier: SoulGauntletRewardTier,
): Promise<BagItemGrantFromDb[]> {
  const safeFloor = Math.max(1, Math.trunc(floor));

  const { data, error } = await supabase
    .from("soul_gauntlet_floor_rewards")
    .select("floor, reward_tier, item_id, quantity, sort_order")
    .eq("floor", safeFloor)
    .eq("reward_tier", rewardTier)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as FloorRewardRow[])
    .map((row) => {
      if (typeof row.item_id !== "string" || !row.item_id.trim()) return null;
      const quantity =
        typeof row.quantity === "number" && Number.isFinite(row.quantity)
          ? Math.max(1, Math.trunc(row.quantity))
          : 1;
      return { itemId: row.item_id.trim(), quantity };
    })
    .filter((row): row is BagItemGrantFromDb => row !== null);
}

export async function grantSoulGauntletDeathRewards(
  supabase: SupabaseServerClient,
  userId: string,
  deathFloor: number,
  rewardTier: SoulGauntletRewardTier,
): Promise<
  | {
      ok: true;
      floor: number;
      rewardTier: SoulGauntletRewardTier;
      granted: SoulGauntletGrantedRewardView[];
    }
  | {
      ok: false;
      floor: number;
      rewardTier: SoulGauntletRewardTier;
      error: string;
      granted: SoulGauntletGrantedRewardView[];
    }
> {
  const safeFloor = Math.max(1, Math.trunc(deathFloor));
  const rewardGrants = await fetchSoulGauntletFloorRewardGrants(supabase, safeFloor, rewardTier);

  if (rewardGrants.length === 0) {
    return { ok: true, floor: safeFloor, rewardTier, granted: [] };
  }

  const itemIds = rewardGrants.map((g) => g.itemId);
  const { data: itemRows, error: itemsError } = await supabase
    .from("items")
    .select("id, name, icon_path, rarity_color")
    .in("id", itemIds);

  if (itemsError) {
    return {
      ok: false,
      floor: safeFloor,
      rewardTier,
      error: "No se pudieron cargar los ítems de recompensa.",
      granted: [],
    };
  }

  const itemById = new Map(
    (itemRows ?? [])
      .filter((row) => typeof row.id === "string")
      .map((row) => [row.id, row]),
  );

  const bagGrants = rewardGrants.map((g) => ({ itemId: g.itemId, quantity: g.quantity }));
  const grantResult = await grantBagItemGrantsToProfile(supabase, userId, bagGrants);

  const grantedViews: SoulGauntletGrantedRewardView[] = rewardGrants.map((grant) => {
    const item = itemById.get(grant.itemId);
    const name =
      typeof item?.name === "string" && item.name.trim().length > 0
        ? item.name.trim()
        : "Ítem";
    const rarityColor =
      typeof item?.rarity_color === "string" && item.rarity_color.trim().length > 0
        ? item.rarity_color.trim()
        : null;
    return {
      itemId: grant.itemId,
      name,
      quantity: grant.quantity,
      iconPath: resolveMeloniItemIconPath(
        typeof item?.icon_path === "string" ? item.icon_path : null,
      ),
      rarityColor,
    };
  });

  if (!grantResult.ok) {
    return {
      ok: false,
      floor: safeFloor,
      rewardTier,
      error: grantResult.error,
      granted: [],
    };
  }

  return { ok: true, floor: safeFloor, rewardTier, granted: grantedViews };
}

export async function loadSoulGauntletRunRewardGrantViews(
  supabase: SupabaseServerClient,
  runId: string,
  userId: string,
): Promise<{
  floor: number;
  rewardTier: SoulGauntletRewardTier;
  granted: SoulGauntletGrantedRewardView[];
  inventoryError: string | null;
  completed: boolean;
} | null> {
  const { data: run, error: runError } = await supabase
    .from("user_soul_gauntlet_runs")
    .select(
      "id, user_id, death_floor, reward_tier, rewards_inventory_error, granted_rewards, end_reason",
    )
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();

  if (runError || !run || typeof run.id !== "string") {
    return null;
  }

  const floor = Math.max(1, Math.trunc(Number(run.death_floor) || 1));
  const rewardTier = isSoulGauntletRewardTier(run.reward_tier) ? run.reward_tier : "first_daily";

  const grantSnapshots = parseGrantedRewardsSnapshot(run.granted_rewards);

  const itemIds = [...new Set(grantSnapshots.map((row) => row.itemId))];

  const { data: itemRows } =
    itemIds.length > 0
      ? await supabase
          .from("items")
          .select("id, name, icon_path, rarity_color")
          .in("id", itemIds)
      : { data: [] };

  const itemById = new Map(
    (itemRows ?? [])
      .filter((row) => typeof row.id === "string")
      .map((row) => [row.id, row]),
  );

  const granted = grantSnapshots.flatMap((row) => {
    const itemId = row.itemId;
    const quantity = row.quantity;
    const item = itemById.get(itemId);
    const name =
      typeof item?.name === "string" && item.name.trim().length > 0
        ? item.name.trim()
        : "Ítem";
    return [
      {
        itemId,
        name,
        quantity,
        iconPath: resolveMeloniItemIconPath(
          typeof item?.icon_path === "string" ? item.icon_path : null,
        ),
        rarityColor:
          typeof item?.rarity_color === "string" && item.rarity_color.trim().length > 0
            ? item.rarity_color.trim()
            : null,
      },
    ];
  });

  const inventoryError =
    typeof run.rewards_inventory_error === "string" && run.rewards_inventory_error.trim().length > 0
      ? run.rewards_inventory_error.trim()
      : null;

  return {
    floor,
    rewardTier,
    granted,
    inventoryError,
    completed: run.end_reason === "completed",
  };
}
