import {
  evaluateBagSpaceForGrants,
  type BagItemGrant,
  type InventoryRowForBag,
} from "@/lib/inventory-bag";

const ITEM_ICON_FALLBACK = "/img/resources/logos/logo_latia_rpg.png";

export type MeloniTradeItemSnapshot = {
  id: string;
  name: string;
  iconPath: string;
  rarityColor: string | null;
};

export type MeloniTradeRow = {
  id: number;
  quantity1: number;
  quantity2: number;
  exchangeQuantity: number;
  exchangeQuantity2: number;
  item1: MeloniTradeItemSnapshot;
  item2: MeloniTradeItemSnapshot | null;
  exchangeItem: MeloniTradeItemSnapshot;
  exchangeItem2: MeloniTradeItemSnapshot | null;
};

type ItemRow = {
  id: string;
  name: string | null;
  icon_path: string | null;
  rarity_color: string | null;
};

type GlobalMeloniTradeRow = {
  id: number;
  item_id_1: string | null;
  item_id_2: string | null;
  quantity_1: number | null;
  quantity_2: number | null;
  exhange_quantity: number | null;
  exchange_item: string | null;
  exchange_item_2: string | null;
  exhange_quantity_2: number | null;
};

/** Zona usada para “hoy” en trueques de Meloni (La Tía / AR). */
export const MELONI_TRADES_TIMEZONE = "America/Argentina/Buenos_Aires";

export function todayIsoDateLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Fecha YYYY-MM-DD en una zona IANA (p. ej. Argentina para trueques diarios). */
export function todayIsoDateInTimeZone(
  timeZone: string,
  date: Date = new Date(),
): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

/** Fecha de “hoy” para trueques (solo zona AR; coincide con el contador a medianoche). */
export function getMeloniTradeTodayDate(now: Date = new Date()): string {
  return todayIsoDateInTimeZone(MELONI_TRADES_TIMEZONE, now);
}

/** @deprecated Usar `getMeloniTradeTodayDate()`. Mantenido por compatibilidad. */
export function getMeloniTradeDateCandidates(now: Date = new Date()): string[] {
  return [getMeloniTradeTodayDate(now)];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Milisegundos hasta las 00:00 del día siguiente en la zona indicada. */
export function getMsUntilMidnightInTimeZone(
  timeZone: string,
  now: Date = new Date(),
): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const second = Number(parts.find((part) => part.type === "second")?.value ?? 0);
  const elapsedMs = (hour * 3600 + minute * 60 + second) * 1000;

  return MS_PER_DAY - elapsedMs;
}

/** Formato `HH:MM:SS` para tiempo restante hasta medianoche. */
export function formatMeloniTradesResetCountdown(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Normaliza `date` de Postgres/PostgREST a YYYY-MM-DD. */
export function normalizeTradeDateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return todayIsoDateInTimeZone(MELONI_TRADES_TIMEZONE, value);
  }
  return null;
}

export function isMeloniTradeDateToday(value: unknown, now: Date = new Date()): boolean {
  const normalized = normalizeTradeDateOnly(value);
  if (!normalized) return false;
  return normalized === getMeloniTradeTodayDate(now);
}

export function resolveMeloniItemIconPath(iconPath: string | null | undefined): string {
  if (!iconPath || typeof iconPath !== "string") {
    return ITEM_ICON_FALLBACK;
  }
  const trimmedPath = iconPath.trim();
  if (!trimmedPath) return ITEM_ICON_FALLBACK;
  if (
    trimmedPath.startsWith("/") ||
    trimmedPath.startsWith("http://") ||
    trimmedPath.startsWith("https://")
  ) {
    return trimmedPath;
  }
  return `/${trimmedPath}`;
}

function toPositiveInt(value: unknown, fallback = 1): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.trunc(value));
  }
  return fallback;
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  return fallback;
}

function toItemSnapshot(row: ItemRow | undefined): MeloniTradeItemSnapshot | null {
  if (!row?.id) return null;
  const name = typeof row.name === "string" && row.name.trim().length > 0 ? row.name.trim() : "Ítem";
  const rarityColor =
    typeof row.rarity_color === "string" && row.rarity_color.trim().length > 0
      ? row.rarity_color.trim()
      : null;
  return {
    id: row.id,
    name,
    iconPath: resolveMeloniItemIconPath(row.icon_path),
    rarityColor,
  };
}

/** Cantidades totales por `item_id` en la bolsa del jugador (suma de stacks). */
export type PlayerInventoryQuantities = Record<string, number>;

export function buildPlayerInventoryQuantities(
  rows: { item_id: string | null; quantity: number | null }[] | null | undefined,
): PlayerInventoryQuantities {
  const totals: PlayerInventoryQuantities = {};
  for (const row of rows ?? []) {
    if (typeof row.item_id !== "string" || !row.item_id) continue;
    const qty =
      typeof row.quantity === "number" && Number.isFinite(row.quantity)
        ? Math.max(0, Math.trunc(row.quantity))
        : 0;
    totals[row.item_id] = (totals[row.item_id] ?? 0) + qty;
  }
  return totals;
}

export function hasEnoughInventoryForItem(
  inventory: PlayerInventoryQuantities,
  itemId: string,
  required: number,
): boolean {
  if (required <= 0) return true;
  return (inventory[itemId] ?? 0) >= required;
}

/** True si el jugador tiene todo lo que debe entregar (`exchange_item` / `exchange_item_2`). */
export function isMeloniTradeAffordable(
  trade: MeloniTradeRow,
  inventory: PlayerInventoryQuantities,
): boolean {
  if (!hasEnoughInventoryForItem(inventory, trade.exchangeItem.id, trade.exchangeQuantity)) {
    return false;
  }
  if (trade.exchangeItem2 && trade.exchangeQuantity2 > 0) {
    if (!hasEnoughInventoryForItem(inventory, trade.exchangeItem2.id, trade.exchangeQuantity2)) {
      return false;
    }
  }
  return true;
}

export type MeloniGrantedItem = {
  item: MeloniTradeItemSnapshot;
  quantity: number;
};

export function buildMeloniGrantedItemsFromTrade(trade: MeloniTradeRow): MeloniGrantedItem[] {
  const granted: MeloniGrantedItem[] = [{ item: trade.item1, quantity: trade.quantity1 }];
  if (trade.item2 && trade.quantity2 > 0) {
    granted.push({ item: trade.item2, quantity: trade.quantity2 });
  }
  return granted;
}

export function buildMeloniRewardGrants(trade: MeloniTradeRow): BagItemGrant[] {
  const grants: BagItemGrant[] = [{ itemId: trade.item1.id, quantity: trade.quantity1 }];
  if (trade.item2 && trade.quantity2 > 0) {
    grants.push({ itemId: trade.item2.id, quantity: trade.quantity2 });
  }
  return grants;
}

export function canReceiveMeloniTradeRewards(
  trade: MeloniTradeRow,
  stackableByItemId: Map<string, boolean>,
  inventoryRows: InventoryRowForBag[],
  equippedInventoryIdSet: Set<number>,
): boolean {
  return evaluateBagSpaceForGrants(
    buildMeloniRewardGrants(trade),
    stackableByItemId,
    inventoryRows,
    equippedInventoryIdSet,
  ).ok;
}

export function buildMeloniTradesForDisplay(
  tradeRows: GlobalMeloniTradeRow[] | null | undefined,
  itemRows: ItemRow[] | null | undefined,
): MeloniTradeRow[] {
  const itemById = new Map(
    (itemRows ?? [])
      .filter((row): row is ItemRow => typeof row.id === "string" && row.id.length > 0)
      .map((row) => [row.id, row]),
  );

  return (tradeRows ?? []).flatMap((trade) => {
    if (typeof trade.id !== "number" || !Number.isFinite(trade.id)) return [];
    if (typeof trade.item_id_1 !== "string" || !trade.item_id_1) return [];
    if (typeof trade.exchange_item !== "string" || !trade.exchange_item) return [];

    const item1 = toItemSnapshot(itemById.get(trade.item_id_1));
    const exchangeItem = toItemSnapshot(itemById.get(trade.exchange_item));
    if (!item1 || !exchangeItem) return [];

    const item2 =
      typeof trade.item_id_2 === "string" && trade.item_id_2
        ? toItemSnapshot(itemById.get(trade.item_id_2))
        : null;

    const exchangeItem2 =
      typeof trade.exchange_item_2 === "string" && trade.exchange_item_2
        ? toItemSnapshot(itemById.get(trade.exchange_item_2))
        : null;

    return [
      {
        id: Math.trunc(trade.id),
        quantity1: toPositiveInt(trade.quantity_1),
        quantity2: toNonNegativeInt(trade.quantity_2),
        exchangeQuantity: toPositiveInt(trade.exhange_quantity),
        exchangeQuantity2: toNonNegativeInt(trade.exhange_quantity_2),
        item1,
        item2,
        exchangeItem,
        exchangeItem2,
      },
    ];
  });
}
