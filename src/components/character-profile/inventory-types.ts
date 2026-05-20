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

/** Prefijo con signo para stats numéricos en tooltip (`+ 5` / `- 5`, sin `+ -5`). */
export function formatInstanceStatSignedValue(n: number): string {
  if (!Number.isFinite(n)) return `+ ${n}`;
  if (n < 0) return `- ${Math.abs(n)}`;
  return `+ ${n}`;
}

function instanceStatNumericFlat(valueFlat: string | number | null | undefined): number | null {
  if (valueFlat == null || valueFlat === "") return null;
  const n = Number(valueFlat);
  return Number.isFinite(n) ? n : null;
}

/**
 * Una línea de stat para tooltip de instancia (arma / armadura).
 * `RES` / `WEAK`: `+RES {tipo}` / `+WEAK {tipo}` (valor desde `value_flat`, primera letra mayúscula).
 * Otras claves: `+ {flat} {clave}` / `- {flat} {clave}` o lo mismo con `%`.
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
  const flatNum = instanceStatNumericFlat(valueFlat);
  if (flatNum != null) {
    return `${formatInstanceStatSignedValue(flatNum)} ${keyLabel}`;
  }
  if (valuePct != null && Number.isFinite(Number(valuePct))) {
    const pct = Number(valuePct);
    return `${formatInstanceStatSignedValue(pct)}% ${keyLabel}`;
  }
  return null;
}

/** `value_flat` o `value_pct` negativos en tooltip de instancia (penalización). */
export function isInstanceStatRollNegativeForTooltip(
  valueFlat: string | number | null | undefined,
  valuePct: number | null | undefined,
): boolean {
  const flatNum = instanceStatNumericFlat(valueFlat);
  if (flatNum != null && flatNum < 0) return true;
  if (valuePct != null && Number.isFinite(Number(valuePct)) && Number(valuePct) < 0) return true;
  return false;
}

/** `stat_key` de instancia que muestra debilidad en tooltip (línea en rojo en la UI). */
export function isInstanceStatWeakTooltipKey(statKey: string | null | undefined): boolean {
  return (statKey?.trim().toLowerCase() ?? "") === "weak";
}

/** Clase Tailwind para líneas de stat en tooltip (debilidad o valor negativo). */
export function instanceStatRollTooltipLineClassName(
  statKey: string | null | undefined,
  valueFlat: string | number | null | undefined,
  valuePct: number | null | undefined,
): string | undefined {
  if (
    isInstanceStatWeakTooltipKey(statKey) ||
    isInstanceStatRollNegativeForTooltip(valueFlat, valuePct)
  ) {
    return "font-medium text-red-400";
  }
  return undefined;
}

export type InstanceStatTooltipRollSource = {
  statKey1: string | null;
  valueFlat1: string | number | null;
  valuePct1: number | null;
  statKey2: string | null;
  valueFlat2: string | number | null;
  valuePct2: number | null;
  statKey3: string | null;
  valueFlat3: string | number | null;
  valuePct3: number | null;
  statKey4: string | null;
  valueFlat4: string | number | null;
  valuePct4: number | null;
  statKey5: string | null;
  valueFlat5: string | number | null;
  valuePct5: number | null;
};

export type InstanceStatTooltipRollLine = {
  statKey: string;
  valueFlat: string | number | null;
  valuePct: number | null;
  line: string;
};

/** Filas de stats de instancia listas para renderizar en tooltips de arma / equipo. */
export function collectInstanceStatTooltipRollLines(
  roll: InstanceStatTooltipRollSource,
): InstanceStatTooltipRollLine[] {
  const rows: Array<[string | null, string | number | null, number | null]> = [
    [roll.statKey1, roll.valueFlat1, roll.valuePct1],
    [roll.statKey2, roll.valueFlat2, roll.valuePct2],
    [roll.statKey3, roll.valueFlat3, roll.valuePct3],
    [roll.statKey4, roll.valueFlat4, roll.valuePct4],
    [roll.statKey5, roll.valueFlat5, roll.valuePct5],
  ];

  const out: InstanceStatTooltipRollLine[] = [];
  for (const [statKey, valueFlat, valuePct] of rows) {
    const line = formatInstanceStatRollTooltipLine(statKey, valueFlat, valuePct);
    const key = statKey?.trim() ?? "";
    if (!line || !key) continue;
    out.push({ statKey: key, valueFlat, valuePct, line });
  }
  return out;
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
