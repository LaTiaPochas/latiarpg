export type WeaponInstanceTooltip = {
  rarity: string | null;
  rarityColor: string | null;
  /** `weapon_instance.attack_type` (p. ej. finesse, martial). */
  attackType: string | null;
  attackDamageMin: number | null;
  attackDamageMax: number | null;
  magicDamageMin: number | null;
  magicDamageMax: number | null;
  statKey1: string | null;
  valueFlat1: number | null;
  valuePct1: number | null;
  statKey2: string | null;
  valueFlat2: number | null;
  valuePct2: number | null;
  statKey3: string | null;
  valueFlat3: number | null;
  valuePct3: number | null;
  statKey4: string | null;
  valueFlat4: number | null;
  valuePct4: number | null;
  statKey5: string | null;
  valueFlat5: number | null;
  valuePct5: number | null;
};

/** Etiqueta legible para el tooltip (al lado de WEAPON). */
export function formatWeaponAttackTypeLabel(raw: string | null | undefined): string {
  const t = raw?.trim() ?? "";
  if (!t) return "";
  const s = t.toLowerCase();
  if (s === "finesse") return "Finesse";
  if (s === "martial") return "Martial";
  return t;
}

/** Misma forma que instancia de arma (rareza, daños, stats por filas). */
export type EquipmentInstanceTooltip = WeaponInstanceTooltip;

function capitalizeWord(value: string): string {
  const v = value.trim();
  if (!v) return v;
  return `${v.charAt(0).toUpperCase()}${v.slice(1).toLowerCase()}`;
}

/** Etiqueta legible tipo "Key Items", "Recipe" a partir de `equip_slot`. */
export function formatEquipSlotLabelForTooltip(raw: string | null | undefined): string {
  const s = raw?.trim() ?? "";
  if (!s) return "";
  return s
    .replace(/_/g, " ")
    .split(/\s+/u)
    .filter(Boolean)
    .map(capitalizeWord)
    .join(" ");
}

/**
 * Subtítulo bajo el nombre en tooltips compactos (no `item_type_id === 1`):
 * oro/madera siguen mostrando el código de tipo (p. ej. "Resource"); el resto usa `equip_slot` si existe.
 */
export function inventoryTooltipSubtitleUnderName(args: {
  itemTypeId: number | null;
  itemTypeCode?: string | null;
  equipSlot?: string | null;
}): string | null {
  const typeId = args.itemTypeId;
  const code = args.itemTypeCode?.trim() ?? "";
  const slot = args.equipSlot?.trim() ?? "";

  const isResourceStyle = (typeId === 2 || typeId === 3) && code.length > 0;
  if (isResourceStyle) {
    return formatEquipSlotLabelForTooltip(code);
  }
  if (slot.length > 0) {
    return formatEquipSlotLabelForTooltip(slot);
  }
  if (code.length > 0) {
    return formatEquipSlotLabelForTooltip(code);
  }
  return null;
}
