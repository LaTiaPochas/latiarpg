export type HerreriaItemTypeJoinRow = { code: string | null } | Array<{ code: string | null }>;

export type HerreriaRecipeItemRow = {
  id: string;
  name: string | null;
  description?: string | null;
  quote_text?: string | null;
  icon_path: string | null;
  rarity_color: string | null;
  equip_slot?: string | null;
  item_types?: HerreriaItemTypeJoinRow | null;
};

export type RecipeComponentRow = {
  recipe_id: string | null;
  recipe_level: number | null;
  crafted_item: unknown;
  /** Cantidad del ítem fabricado (stackables). */
  quantity?: number | null;
  [key: string]: unknown;
};

export type ComponentInventoryRow = {
  id?: number | null;
  item_id: string | null;
  quantity: number | null;
};

export function resolveItemTypeCode(
  itemTypes: HerreriaItemTypeJoinRow | null | undefined,
): string | null {
  const join = Array.isArray(itemTypes) ? (itemTypes[0] ?? null) : itemTypes;
  const code = typeof join?.code === "string" ? join.code.trim().toLowerCase() : "";
  return code.length > 0 ? code : null;
}

export function resolveCraftedItemId(input: unknown): string | null {
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
    /** Catálogo `items.id` antes que `id` de fila (p. ej. `weapon_instance.id`). */
    const catalogCandidates = [
      record.item_id,
      record.itemId,
      record.crafted_item_id,
      record.output_item_id,
      record.result_item_id,
    ];
    for (const candidate of catalogCandidates) {
      const resolved = resolveCraftedItemId(candidate);
      if (resolved) return resolved;
    }
    if (typeof record.id === "string" && record.id.trim().length > 0) {
      return record.id.trim();
    }
  }
  return null;
}

/**
 * `recipe_components.crafted_item` = `items.id` del ítem fabricado.
 * Se usa para matchear `weapon_instance.item_id` / `equipment_instances.item_id`.
 */
export function resolveCraftedCatalogItemIdFromRecipeRow(
  row: RecipeComponentRow | null,
): string | null {
  if (!row) return null;
  const record = row as Record<string, unknown>;

  if (typeof record.crafted_item === "string" && record.crafted_item.trim().length > 0) {
    return record.crafted_item.trim();
  }
  if (typeof record.crafted_item_id === "string" && record.crafted_item_id.trim().length > 0) {
    return record.crafted_item_id.trim();
  }

  const crafted = record.crafted_item;
  if (crafted && typeof crafted === "object" && !Array.isArray(crafted)) {
    const cr = crafted as Record<string, unknown>;
    if (typeof cr.item_id === "string" && cr.item_id.trim().length > 0) {
      return cr.item_id.trim();
    }
    if (typeof cr.id === "string" && cr.id.trim().length > 0) {
      return cr.id.trim();
    }
  }

  return null;
}

/** @deprecated Alias de `resolveCraftedCatalogItemIdFromRecipeRow`. */
export function resolveCraftedItemFromRecipeRow(row: RecipeComponentRow | null): string | null {
  return resolveCraftedCatalogItemIdFromRecipeRow(row);
}

/** `recipe_components.item_type` (texto en la fila de receta). */
export function resolveRecipeComponentItemType(row: RecipeComponentRow | null): string | null {
  if (!row) return null;
  const record = row as Record<string, unknown>;
  const raw = record.item_type;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/** Arma o equipamiento instanciado según `recipe_components.item_type`. */
export function resolveCraftInstanceKindFromRecipeRow(
  row: RecipeComponentRow | null,
): "weapon" | "equipment" | null {
  const itemType = resolveRecipeComponentItemType(row);
  if (itemType === "weapon") return "weapon";
  if (itemType === "equipment") return "equipment";
  return null;
}

export function parseInstanceRowId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
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

export function maxCraftCountFromMaterials(
  requiredByItemId: Map<string, number>,
  ownedByItemId: Map<string, number>,
): number {
  if (requiredByItemId.size === 0) return 0;
  let max = Number.POSITIVE_INFINITY;
  for (const [itemId, requiredQuantity] of requiredByItemId) {
    const perCraft = Math.max(1, Math.trunc(requiredQuantity));
    const owned = ownedByItemId.get(itemId) ?? 0;
    max = Math.min(max, Math.floor(owned / perCraft));
  }
  return Number.isFinite(max) && max > 0 ? max : 0;
}

/** `recipe_components.quantity`: unidades del ítem fabricado que se agregan al inventario. */
export function resolveRecipeCraftOutputQuantity(row: RecipeComponentRow): number {
  const raw = row.quantity;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(1, Math.trunc(raw));
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return Math.max(1, Math.trunc(parsed));
  }
  return 1;
}

export function recipeComponentEntries(row: RecipeComponentRow) {
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

/** @deprecated Usar `resolveCraftInstanceKindFromRecipeRow`. */
export function recipeComponentItemType(row: RecipeComponentRow): "weapon" | "equipment" | null {
  return resolveCraftInstanceKindFromRecipeRow(row);
}

export function randomIdFromRows(rows: Array<{ id: unknown }>) {
  const ids = rows
    .map((row) => parseInstanceRowId(row.id))
    .filter((value): value is number => value !== null);
  if (ids.length === 0) return null;
  return ids[Math.floor(Math.random() * ids.length)] ?? null;
}
