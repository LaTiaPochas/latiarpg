/**
 * Códigos de `zones.code` en Supabase (alineados con `combat_encounters.zone_id`).
 * Pasalos en `?zone=` al entrar a `/combate/[code]` para que el escape vuelva al mapa correcto.
 */
export const HIDDEN_FOREST_ZONE_CODE = "hidden_forest";
/** Valor recomendado para `?zone=` desde cercanías del bosque. */
export const NEAR_WOODS_ZONE_CODE = "near_woods";
/** Valor recomendado para `?zone=` desde bosque mágico. Ajustá si en BD usás otro `zones.code`. */
export const MAGIC_FOREST_ZONE_CODE = "magic-forest";

export function normalizeZoneCodeKey(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  const t = raw.trim();
  if (!t) return "";
  return t.toLowerCase().replace(/-/g, "_");
}

/**
 * Candidatos de `zones.code` a probar en BD (guion vs guión bajo, mayúsculas).
 * El primero que exista en `zones` gana.
 */
export function zoneLookupCodeCandidates(zoneQueryParam: string): string[] {
  const raw = zoneQueryParam.trim();
  if (!raw) return [];
  const key = normalizeZoneCodeKey(raw);
  const add = (list: string[], v: string) => {
    if (v && !list.includes(v)) list.push(v);
  };
  const out: string[] = [];
  add(out, raw);

  if (key === "hidden_forest") {
    add(out, "hidden_forest");
    return out;
  }
  if (key === "near_woods" || key === "nearwoods") {
    add(out, "near_woods");
    add(out, "near-woods");
    return out;
  }
  if (key === "magic_forest" || key === "magicforest") {
    add(out, "magic-forest");
    add(out, "magic_forest");
    return out;
  }
  return out;
}

/**
 * Mapa por `zones.code` (o alias) para `escapeHref` / “Volver al mapa” en combate.
 */
export function mapPathByZoneCode(zoneCode: string | null | undefined): string | null {
  const key = normalizeZoneCodeKey(zoneCode);
  if (!key) return null;

  if (key === "hidden_forest") {
    return "/bosque-inexplorado";
  }
  if (key === "near_woods" || key === "nearwoods") {
    return "/near-woods";
  }
  if (key === "magic_forest" || key === "magicforest") {
    return "/near-woods";
  }

  return null;
}
