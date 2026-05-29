export const SOUL_FRAGMENT_ITEM_ID = "bc413d4a-0bab-42df-a24e-54d6a4d11b0d";

export const SOUL_GAUNTLET_ENTRY_FRAGMENT_COST = 5;

export const SOUL_GAUNTLET_RUN_PATH = "/soul-gauntlet-run";

export const SOUL_GAUNTLET_LOBBY_PATH = "/gauntlet-pozo-de-las-almas";

export const SOUL_GAUNTLET_COMPLETED_MILESTONE_TITLE = "soul_gauntlet_completed";

/** `zones.code` en Supabase para encuentros del gauntlet. */
export const SOUL_GAUNTLET_ZONE_CODE = "soul-gauntlet";

export const SOUL_GAUNTLET_FIXED_FLOOR_COUNT = 10;

/** Último piso jugable; al ganarlo se otorgan recompensas y termina la run. */
export const SOUL_GAUNTLET_MAX_FLOOR = 15;

/** Pisos 11+ reutilizan encuentros 6–10 con buff progresivo. */
export const SOUL_GAUNTLET_EXTENDED_CYCLE_START_FLOOR = 11;
export const SOUL_GAUNTLET_EXTENDED_TEMPLATE_START = 6;
export const SOUL_GAUNTLET_EXTENDED_TEMPLATE_COUNT = 5;
/** Piso 11 = +20%; cada piso extra suma +5% (12 → 25%, …, 15 → 40%). */
export const SOUL_GAUNTLET_EXTENDED_BASE_BUFF = 0.2;
export const SOUL_GAUNTLET_EXTENDED_BUFF_STEP = 0.05;

/** Bonus fijo sobre stats de enemigos cargados desde BD en combates del gauntlet. */
export const SOUL_GAUNTLET_BASE_ENEMY_STAT_BONUS = 0.1;

export const SOUL_GAUNTLET_BASE_ENEMY_STAT_MULTIPLIER = 1 + SOUL_GAUNTLET_BASE_ENEMY_STAT_BONUS;

export const SOUL_GAUNTLET_COMBAT_MODE = "gauntlet";

export type SoulGauntletRunEndReason = "death" | "abandoned" | "completed";

export type GauntletFloorConfig = {
  floor: number;
  templateFloor: number;
  encounterCode: string;
  hpMultiplier: number;
  damageMultiplier: number;
};

export function getGauntletFloorConfig(floor: number): GauntletFloorConfig {
  const safeFloor = Math.max(1, Math.trunc(floor));

  if (safeFloor <= SOUL_GAUNTLET_FIXED_FLOOR_COUNT) {
    return {
      floor: safeFloor,
      templateFloor: safeFloor,
      encounterCode: `soul-gauntlet-floor-${safeFloor}`,
      hpMultiplier: 1,
      damageMultiplier: 1,
    };
  }

  const offset = safeFloor - SOUL_GAUNTLET_EXTENDED_CYCLE_START_FLOOR;
  const templateFloor =
    SOUL_GAUNTLET_EXTENDED_TEMPLATE_START + (offset % SOUL_GAUNTLET_EXTENDED_TEMPLATE_COUNT);
  const buff =
    SOUL_GAUNTLET_EXTENDED_BASE_BUFF + offset * SOUL_GAUNTLET_EXTENDED_BUFF_STEP;
  const mult = 1 + buff;

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
