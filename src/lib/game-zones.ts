/**
 * Códigos de `zones.code` en Supabase (alineados con `combat_encounters.zone_id`).
 * /bosque-inexplorado corresponde a esta zona.
 */
export const HIDDEN_FOREST_ZONE_CODE = "hidden_forest";

/**
 * Mapa por `zones.code` para volver al área desde pantallas hijas (p. ej. combate).
 */
export function mapPathByZoneCode(zoneCode: string | null | undefined): string | null {
  const code = typeof zoneCode === "string" ? zoneCode.trim() : "";
  if (!code) return null;

  if (code === HIDDEN_FOREST_ZONE_CODE) {
    return "/bosque-inexplorado";
  }

  return null;
}
