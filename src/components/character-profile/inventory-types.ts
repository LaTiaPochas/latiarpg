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
