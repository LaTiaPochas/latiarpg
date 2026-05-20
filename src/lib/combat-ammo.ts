export type AmmoAttackType = "physical" | "magical";

export type ParsedAmmoEffect = {
  ammoKind: string;
  damageMin: number;
  damageMax: number;
  attackFamily: string | null;
  attackType: AmmoAttackType;
};

/** Tipo de daño de la munición básica (flecha/birote de madera). */
export const DEFAULT_COMBAT_AMMO_ATTACK_FAMILY = "perforante";

/** Mitigación por defecto de la munición básica (armor del enemigo). */
export const DEFAULT_COMBAT_AMMO_ATTACK_TYPE: AmmoAttackType = "physical";

/** Sinónimos históricos → clave canónica en `DEFAULT_COMBAT_AMMO_BY_KIND`. */
const CANONICAL_AMMO_KIND_ALIASES: Record<string, string> = {
  crossbow: "bolt",
};

function canonicalAmmoKind(kind: string): string {
  const normalized = kind.trim().toLowerCase();
  return CANONICAL_AMMO_KIND_ALIASES[normalized] ?? normalized;
}

/** IDs negativos: munición básica de combate (no está en inventario, no se persiste al gastar). */
const DEFAULT_COMBAT_AMMO_INVENTORY_ID = {
  arrow: -1,
  bolt: -2,
} as const;

const DEFAULT_COMBAT_AMMO_BY_KIND: Record<
  string,
  {
    inventoryId: number;
    itemId: string;
    name: string;
    effect: Record<string, unknown>;
  }
> = {
  arrow: {
    inventoryId: DEFAULT_COMBAT_AMMO_INVENTORY_ID.arrow,
    itemId: "__combat_default_wooden_arrow__",
    name: "Flecha de Madera",
    effect: {
      kind: "ammo",
      ammo_kind: "arrow",
      damage_min: 0,
      damage_max: 0,
      attack_family: DEFAULT_COMBAT_AMMO_ATTACK_FAMILY,
      attack_type: DEFAULT_COMBAT_AMMO_ATTACK_TYPE,
    },
  },
  bolt: {
    inventoryId: DEFAULT_COMBAT_AMMO_INVENTORY_ID.bolt,
    itemId: "__combat_default_wooden_bolt__",
    name: "Birote de Madera",
    effect: {
      kind: "ammo",
      ammo_kind: "bolt",
      damage_min: 0,
      damage_max: 0,
      attack_family: DEFAULT_COMBAT_AMMO_ATTACK_FAMILY,
      attack_type: DEFAULT_COMBAT_AMMO_ATTACK_TYPE,
    },
  },
};

export type CombatAmmoMenuEntry = {
  inventoryId: number;
  itemId: string;
  name: string;
  description: string | null;
  effect: Record<string, unknown> | null;
  quantity: number;
  isDefaultAmmo: boolean;
};

function normalizeAmmoKindKey(kind: string): string {
  return canonicalAmmoKind(kind);
}

export function isDefaultCombatAmmoInventoryId(inventoryId: number): boolean {
  return Math.trunc(inventoryId) < 0;
}

/** Munición básica (0 daño) siempre disponible para el `ammo_kind` del arma. */
export function createDefaultCombatAmmoEntry(
  weaponAmmoKind: string,
): CombatAmmoMenuEntry | null {
  const def = DEFAULT_COMBAT_AMMO_BY_KIND[normalizeAmmoKindKey(weaponAmmoKind)];
  if (!def) return null;
  return {
    inventoryId: def.inventoryId,
    itemId: def.itemId,
    name: def.name,
    description: null,
    effect: def.effect,
    quantity: 1,
    isDefaultAmmo: true,
  };
}

function effectString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function effectNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function effectKind(effect: Record<string, unknown> | null): string {
  if (!effect) return "";
  return effectString(effect.kind) ?? effectString(effect["type"]) ?? "";
}

/** Consumible de combate con `kind: "ammo"` (flechas, virotes, etc.). */
export function isAmmoConsumableEffect(effect: Record<string, unknown> | null): boolean {
  return effectKind(effect).toLowerCase() === "ammo";
}

export function weaponRequiresAmmo(weaponAmmoKind: string | null | undefined): boolean {
  return typeof weaponAmmoKind === "string" && weaponAmmoKind.trim().length > 0;
}

export function isAmmoCompatibleWithWeapon(
  weaponAmmoKind: string | null | undefined,
  effect: Record<string, unknown> | null,
): boolean {
  if (!weaponRequiresAmmo(weaponAmmoKind)) return false;
  const parsed = parseAmmoEffect(effect);
  if (!parsed) return false;
  return (
    canonicalAmmoKind(parsed.ammoKind) === canonicalAmmoKind(weaponAmmoKind!)
  );
}

export function parseAmmoEffect(effect: Record<string, unknown> | null): ParsedAmmoEffect | null {
  if (!isAmmoConsumableEffect(effect) || !effect) return null;

  const ammoKind = effectString(effect.ammo_kind) ?? effectString(effect["ammo-kind"]);
  if (!ammoKind) return null;

  const damageMin = Math.max(
    0,
    Math.trunc(
      effectNumber(effect.damage_min, effectNumber(effect["damage-min"], 0)),
    ),
  );
  const damageMax = Math.max(
    damageMin,
    Math.trunc(
      effectNumber(effect.damage_max, effectNumber(effect["damage-max"], damageMin)),
    ),
  );

  const attackFamily =
    effectString(effect.attack_family) ?? effectString(effect["attack-family"]);

  const attackTypeRaw =
    effectString(effect.attack_type) ?? effectString(effect["attack-type"]);
  const attackType: AmmoAttackType =
    attackTypeRaw?.trim().toLowerCase() === "magical" ? "magical" : "physical";

  return {
    ammoKind,
    damageMin,
    damageMax,
    attackFamily,
    attackType,
  };
}

/** `physical` → armor; `magical` → MR del enemigo. */
export function resolveAmmoAttackTypeForHit(parsed: ParsedAmmoEffect): AmmoAttackType {
  return parsed.attackType;
}

/** Tipo de daño del golpe completo cuando se ataca con munición (arma + bonus de flecha). */
export function resolveAmmoAttackFamilyForHit(parsed: ParsedAmmoEffect): string {
  const fromAmmo = parsed.attackFamily?.trim();
  if (fromAmmo) return fromAmmo;
  return DEFAULT_COMBAT_AMMO_ATTACK_FAMILY;
}

export function rollAmmoDamage(parsed: ParsedAmmoEffect): number {
  const min = Math.max(0, parsed.damageMin);
  const max = Math.max(min, parsed.damageMax);
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Rango de daño para UI: `3` si min === max, si no `1-4`. */
export function formatAmmoDamageRangeLabel(parsed: ParsedAmmoEffect | null): string {
  if (!parsed) return "—";
  if (parsed.damageMin === parsed.damageMax) return String(parsed.damageMin);
  return `${parsed.damageMin}-${parsed.damageMax}`;
}

/** Etiqueta del menú de munición: `Nombre (daño Dmg.) xcantidad` (sin cantidad si es ilimitada). */
export function formatAmmoMenuButtonLabel(
  name: string,
  quantity: number,
  effect: Record<string, unknown> | null,
  options?: { unlimitedQuantity?: boolean },
): string {
  const dmg = formatAmmoDamageRangeLabel(parseAmmoEffect(effect));
  if (options?.unlimitedQuantity) return `${name} (${dmg} Dmg.)`;
  return `${name} (${dmg} Dmg.) x${quantity}`;
}
