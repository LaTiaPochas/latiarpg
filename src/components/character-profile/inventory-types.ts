export type WeaponInstanceTooltip = {
  rarity: string | null;
  rarityColor: string | null;
  /** `weapon_instance.attack_type` (p. ej. finesse, martial). */
  attackType: string | null;
  /** `weapon_instance.attack_family` (RES/WEAK en combate; tooltip junto al daño físico). */
  attackFamily: string | null;
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
  /** Puede ser número (mods) o texto (p. ej. tipo de daño con RES/WEAK). */
  valueFlat4: string | number | null;
  valuePct4: number | null;
  statKey5: string | null;
  valueFlat5: string | number | null;
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

/**
 * Etiqueta legible en tooltip para `stat_key` de instancia (arma / armadura).
 * Otras claves se devuelven tal cual en la DB.
 */
export function formatInstanceStatKeyForTooltip(statKey: string | null | undefined): string {
  const raw = statKey?.trim() ?? "";
  if (!raw) return "";
  const k = raw.toLowerCase();
  if (k === "attack_damage") return "Daño Marcial";
  if (k === "magic_damage") return "Daño Mágico";
  if (k === "finesse_damage" || k === "finesse") return "Daño Finesse";
  return raw;
}

/** Primera letra en mayúscula; el resto se deja igual (p. ej. `fire` → `Fire`). */
export function capitalizeFirstLetterOnly(raw: string | null | undefined): string {
  const t = raw?.trim() ?? "";
  if (!t) return t;
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}`;
}

/**
 * Una línea de stat para tooltip de instancia (arma / armadura).
 * `RES` / `WEAK`: `+RES {tipo}` / `+WEAK {tipo}` (valor desde `value_flat`, primera letra mayúscula).
 * Otras claves: `+ {flat} {clave}` o `+ {pct}% {clave}` como antes.
 */
export function formatInstanceStatRollTooltipLine(
  statKey: string | null | undefined,
  valueFlat: string | number | null | undefined,
  valuePct: number | null | undefined,
): string | null {
  const keyRaw = statKey?.trim() ?? "";
  if (!keyRaw) return null;
  const keyNorm = keyRaw.toLowerCase();
  if (keyNorm === "res" || keyNorm === "weak") {
    const flatStr =
      valueFlat == null
        ? ""
        : typeof valueFlat === "number" && Number.isFinite(valueFlat)
          ? String(valueFlat).trim()
          : String(valueFlat).trim();
    if (!flatStr) return null;
    const tag = keyNorm === "res" ? "RES" : "WEAK";
    return `+${tag} ${capitalizeFirstLetterOnly(flatStr)}`;
  }
  const keyLabel = formatInstanceStatKeyForTooltip(keyRaw);
  if (valueFlat != null && valueFlat !== "") {
    const n = Number(valueFlat);
    if (Number.isFinite(n)) {
      return `+ ${n} ${keyLabel}`;
    }
  }
  if (valuePct != null && Number.isFinite(Number(valuePct))) {
    return `+ ${valuePct}% ${keyLabel}`;
  }
  return null;
}

/** `stat_key` de instancia que muestra debilidad en tooltip (línea en rojo en la UI). */
export function isInstanceStatWeakTooltipKey(statKey: string | null | undefined): boolean {
  return (statKey?.trim().toLowerCase() ?? "") === "weak";
}

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
