/** Zona horaria del juego (La Tía / AR) para resets diarios. */
export const GAME_DAY_TIMEZONE = "America/Argentina/Buenos_Aires";

/** Fecha calendario `YYYY-MM-DD` en la zona del juego. */
export function getGameDayIsoDate(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: GAME_DAY_TIMEZONE });
}
