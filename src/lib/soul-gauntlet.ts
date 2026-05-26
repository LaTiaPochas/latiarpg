export const SOUL_FRAGMENT_ITEM_ID = "bc413d4a-0bab-42df-a24e-54d6a4d11b0d";

export const SOUL_GAUNTLET_ENTRY_FRAGMENT_COST = 5;

export const SOUL_GAUNTLET_RUN_PATH = "/soul-gauntlet-run";

export const SOUL_GAUNTLET_LOBBY_PATH = "/gauntlet-pozo-de-las-almas";

export const SOUL_GAUNTLET_COMPLETED_MILESTONE_TITLE = "soul_gauntlet_completed";

/** `zones.code` en Supabase para encuentros del gauntlet. */
export const SOUL_GAUNTLET_ZONE_CODE = "soul-gauntlet";

export const SOUL_GAUNTLET_FIXED_FLOOR_COUNT = 10;

/** +12% HP y daño por cada piso después del 10. */
export const SOUL_GAUNTLET_SCALE_PER_FLOOR_AFTER_10 = 0.12;

export const SOUL_GAUNTLET_COMBAT_MODE = "gauntlet";

export type SoulGauntletRunEndReason = "death" | "abandoned";

export type GauntletFloorConfig = {
  floor: number;
  templateFloor: number;
  encounterCode: string;
  hpMultiplier: number;
  damageMultiplier: number;
};

export function getGauntletFloorConfig(floor: number): GauntletFloorConfig {
  const safeFloor = Math.max(1, Math.trunc(floor));
  const templateFloor = ((safeFloor - 1) % SOUL_GAUNTLET_FIXED_FLOOR_COUNT) + 1;
  const extraFloors = Math.max(0, safeFloor - SOUL_GAUNTLET_FIXED_FLOOR_COUNT);
  const mult = 1 + extraFloors * SOUL_GAUNTLET_SCALE_PER_FLOOR_AFTER_10;

  return {
    floor: safeFloor,
    templateFloor,
    encounterCode: `soul-gauntlet-floor-${templateFloor}`,
    hpMultiplier: mult,
    damageMultiplier: mult,
  };
}

export function buildSoulGauntletCombatPath(
  floor: number,
  runId: string,
): { encounterCode: string; href: string } {
  const { encounterCode } = getGauntletFloorConfig(floor);
  const params = new URLSearchParams({
    zone: SOUL_GAUNTLET_ZONE_CODE,
    mode: SOUL_GAUNTLET_COMBAT_MODE,
    floor: String(Math.max(1, Math.trunc(floor))),
    run: runId,
  });
  return {
    encounterCode,
    href: `/combate/${encodeURIComponent(encounterCode)}?${params.toString()}`,
  };
}
