import { weaponRequiresAmmo, type AmmoAttackType } from "@/lib/combat-ammo";

export const WEAPON_ATTACK_FAMILY_CONSUMABLE_KIND = "weapon_attack_family";

function effectString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function effectKind(effect: Record<string, unknown> | null): string {
  if (!effect) return "";
  return (effectString(effect.kind) ?? effectString(effect.type) ?? "").toLowerCase();
}

/** Consumible que cambia el `attack_family` del arma equipada solo en combate. */
export function isWeaponAttackFamilyConsumableEffect(
  effect: Record<string, unknown> | null | undefined,
): boolean {
  return effectKind(effect ?? null) === WEAPON_ATTACK_FAMILY_CONSUMABLE_KIND;
}

export type ParsedWeaponAttackFamilyConsumable = {
  /** Tag elemental / familia de daño (RES/WEAK): `fire`, `perforante`, etc. */
  attackFamily: string;
  /** Mitigación del golpe básico: `physical` → armor; `magical` → MR. */
  attackType: AmmoAttackType;
  /** Turnos de combate; `null` = hasta que termine el encuentro. */
  durationTurns: number | null;
  /** Icono HUD en combate (`effect_icon` en JSON). */
  effectIcon: string | null;
};

const MITIGATION_ATTACK_TYPES = new Set<AmmoAttackType>(["physical", "magical"]);

function normalizeAttackFamilyTag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return normalized.length > 0 ? normalized : null;
}

function parseMitigationAttackType(effect: Record<string, unknown>): AmmoAttackType {
  const candidates = [
    effect.attack_type,
    effect["attack-type"],
    effect.attackType,
    effect.mitigation_type,
    effect["mitigation-type"],
  ];
  for (const raw of candidates) {
    const s = effectString(raw)?.toLowerCase();
    if (s === "magical") return "magical";
    if (s === "physical") return "physical";
  }
  return "physical";
}

/** Tag elemental desde JSON (no confundir con `attack_type` physical/magical). */
function parseElementalAttackFamily(effect: Record<string, unknown>): string | null {
  const candidates = [
    effect.damage_type,
    effect.damage_types,
    effect.attack_family,
    effect["attack-family"],
  ];
  for (const raw of candidates) {
    const normalized = normalizeAttackFamilyTag(raw);
    if (!normalized) continue;
    if (MITIGATION_ATTACK_TYPES.has(normalized as AmmoAttackType)) continue;
    return normalized;
  }
  return null;
}

function parseDurationTurns(effect: Record<string, unknown>): number | null {
  const raw =
    effect.duration_turns ??
    effect["duration-turns"] ??
    effect.durationTurnos ??
    effect["duration-turnos"];
  if (raw == null || raw === "") return null;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parseWeaponAttackFamilyConsumableEffect(
  effect: Record<string, unknown> | null | undefined,
): ParsedWeaponAttackFamilyConsumable | null {
  if (!effect || !isWeaponAttackFamilyConsumableEffect(effect)) return null;

  const attackFamily = parseElementalAttackFamily(effect);
  if (!attackFamily) return null;

  const effectIcon =
    effectString(effect.effect_icon) ??
    effectString(effect["effect-icon"]) ??
    effectString(effect.effectIcon);

  return {
    attackFamily,
    attackType: parseMitigationAttackType(effect),
    durationTurns: parseDurationTurns(effect),
    effectIcon,
  };
}

/** Bloquea uso fuera de combate (`inventory: true` en el JSON). */
export function weaponAttackFamilyConsumableAllowsInventoryUse(
  effect: Record<string, unknown> | null | undefined,
): boolean {
  if (!effect || !isWeaponAttackFamilyConsumableEffect(effect)) return false;
  const v = effect.inventory;
  return v === true || v === "true" || v === 1 || v === "1";
}

/** Mensaje de error si el arma equipada no cumple; `null` si puede usarse. */
export function validateWeaponAttackFamilyConsumableForWeapon(
  weaponAmmoKind: string | null | undefined,
): string | null {
  if (weaponRequiresAmmo(weaponAmmoKind)) {
    return "Solo podés usarlo con un arma que no requiera munición.";
  }
  return null;
}
