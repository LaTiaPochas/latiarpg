/**
 * Jefes de historia (`combat_encounters.is_boss`): no repetibles tras avanzar el `combat_step` de la zona.
 * (Distinto de jefes diarios en `daily-boss-combat.ts`.)
 */

export const STORY_BOSS_ALREADY_DEFEATED_MESSAGE =
  "Ya derrotaste a este jefe. Seguí explorando la zona.";

export function isStoryBossReplayBlocked(
  isBoss: boolean,
  encounterCombatStep: number,
  userZoneCombatStep: number,
): boolean {
  if (!isBoss) return false;
  const encounterStep = Math.max(0, Math.trunc(encounterCombatStep));
  const userStep = Math.max(0, Math.trunc(userZoneCombatStep));
  return userStep > encounterStep;
}

export function isStoryBossHotspotDefeated(
  hotspotId: string,
  hotspotStep: number,
  userZoneCombatStep: number,
  options: { isBoss?: boolean; storyBossEncounterCodes?: ReadonlySet<string> },
): boolean {
  const code = hotspotId.trim().toLowerCase();
  const isBoss =
    options.isBoss === true || (code.length > 0 && options.storyBossEncounterCodes?.has(code) === true);
  if (!isBoss) return false;
  const step = Math.max(0, Math.trunc(hotspotStep));
  const userStep = Math.max(0, Math.trunc(userZoneCombatStep));
  return userStep > step;
}
