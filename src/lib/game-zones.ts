/**
 * Códigos de `zones.code` en Supabase (alineados con `combat_encounters.zone_id`).
 * Pasalos en `?zone=` al entrar a `/combate/[code]` para que el escape vuelva al mapa correcto.
 */
export const HIDDEN_FOREST_ZONE_CODE = "hidden_forest";
/** Encuentros aleatorios del hotspot «Bosques de lobos» en bosque inexplorado. */
export const WOLF_FOREST_ZONE_CODE = "wolf-forest";
/** Debe coincidir con `user_combat_progress.zone_id` y `zones.code` en Supabase. */
export const MYSTIC_CAVE_ZONE_CODE = "mystic-cave";
/** Segundo piso / profundidades (`/cave-depths`). */
export const CAVE_DEPTHS_ZONE_CODE = "cave-depths";
/** Valor recomendado para `?zone=` desde cercanías del bosque. */
export const NEAR_WOODS_ZONE_CODE = "near_woods";
/** Valor recomendado para `?zone=` desde bosque mágico. Ajustá si en BD usás otro `zones.code`. */
export const MAGIC_FOREST_ZONE_CODE = "magic-forest";
/** Minas abandonadas — `combat_encounters.zone_id` y `?zone=` al minar. */
export const ABANDONED_COAL_MINE_ZONE_CODE = "abandoned-coal-mine";

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
  if (key === "wolf_forest") {
    add(out, "wolf-forest");
    add(out, "wolf_forest");
    return out;
  }
  if (key === "mystic_cave") {
    add(out, "mystic-cave");
    add(out, "mystic_cave");
    return out;
  }
  if (key === "cave_depths") {
    add(out, "cave-depths");
    add(out, "cave_depths");
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
  if (key === "abandoned_coal_mine") {
    add(out, "abandoned-coal-mine");
    add(out, "abandoned_coal_mine");
    return out;
  }
  return out;
}

/** Zonas donde los encuentros por recolectar/minar no permiten escapar. */
const COMBAT_ESCAPE_DISABLED_ZONE_KEYS = new Set([
  "magic_forest",
  "magicforest",
  "abandoned_coal_mine",
]);

/** `true` si el combate entró desde bosque mágico o minas abandonadas (`?zone=`). */
export function isCombatEscapeDisabledZone(zoneCode: string | null | undefined): boolean {
  const key = normalizeZoneCodeKey(zoneCode);
  if (!key) return false;
  return COMBAT_ESCAPE_DISABLED_ZONE_KEYS.has(key);
}

/**
 * Mapa por `zones.code` (o alias) para `escapeHref` / “Volver al mapa” en combate.
 */
export function mapPathByZoneCode(zoneCode: string | null | undefined): string | null {
  const key = normalizeZoneCodeKey(zoneCode);
  if (!key) return null;

  if (key === "hidden_forest" || key === "wolf_forest") {
    return "/bosque-inexplorado";
  }
  if (key === "mystic_cave") {
    return "/mystic-cave";
  }
  if (key === "cave_depths") {
    return "/cave-depths";
  }
  if (key === "near_woods" || key === "nearwoods") {
    return "/near-woods";
  }
  if (key === "magic_forest" || key === "magicforest") {
    return "/near-woods";
  }
  if (key === "abandoned_coal_mine") {
    return "/abandoned-coal-mine";
  }

  return null;
}
