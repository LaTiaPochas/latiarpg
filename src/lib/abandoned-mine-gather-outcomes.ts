export type AbandonedMineGatherOutcome = {
  result: string;
  chance: number;
};

/** Cantidades al minar (inclusive). El resto de resultados otorga 1. */
export const ABANDONED_MINE_PIEDRA_QUANTITY_MIN = 1;
export const ABANDONED_MINE_PIEDRA_QUANTITY_MAX = 4;
export const ABANDONED_MINE_COAL_QUANTITY_MIN = 1;
export const ABANDONED_MINE_COAL_QUANTITY_MAX = 3;
export const ABANDONED_MINE_IRON_QUANTITY_MIN = 1;
export const ABANDONED_MINE_IRON_QUANTITY_MAX = 3;
export const ABANDONED_MINE_BONES_QUANTITY_MIN = 1;
export const ABANDONED_MINE_BONES_QUANTITY_MAX = 2;
export const ABANDONED_MINE_CAVE_CRYSTAL_QUANTITY_MIN = 1;
export const ABANDONED_MINE_CAVE_CRYSTAL_QUANTITY_MAX = 2;

function rollInclusiveQuantity(min: number, max: number): number {
  const lo = Math.max(1, Math.trunc(min));
  const hi = Math.max(lo, Math.trunc(max));
  const span = hi - lo + 1;
  return lo + Math.floor(Math.random() * span);
}

/** Cantidad otorgada según el resultado de minar (poción, enemigo, etc. → 1). */
export function rollAbandonedMineGrantQuantity(result: string): number {
  switch (result) {
    case "piedra":
      return rollInclusiveQuantity(
        ABANDONED_MINE_PIEDRA_QUANTITY_MIN,
        ABANDONED_MINE_PIEDRA_QUANTITY_MAX,
      );
    case "coal":
      return rollInclusiveQuantity(
        ABANDONED_MINE_COAL_QUANTITY_MIN,
        ABANDONED_MINE_COAL_QUANTITY_MAX,
      );
    case "iron":
      return rollInclusiveQuantity(
        ABANDONED_MINE_IRON_QUANTITY_MIN,
        ABANDONED_MINE_IRON_QUANTITY_MAX,
      );
    case "bones":
      return rollInclusiveQuantity(
        ABANDONED_MINE_BONES_QUANTITY_MIN,
        ABANDONED_MINE_BONES_QUANTITY_MAX,
      );
    case "cave_crystal":
      return rollInclusiveQuantity(
        ABANDONED_MINE_CAVE_CRYSTAL_QUANTITY_MIN,
        ABANDONED_MINE_CAVE_CRYSTAL_QUANTITY_MAX,
      );
    default:
      return 1;
  }
}

/**
 * Probabilidades por tirada “minar” en minas abandonadas. Suman 1.
 */
export const ABANDONED_MINE_GATHER_OUTCOMES: AbandonedMineGatherOutcome[] = [
  { result: "piedra", chance: 0.30 },
  { result: "enemy", chance: 0.30 },
  { result: "coal", chance: 0.15 },
  { result: "iron", chance: 0.10 },
  { result: "potion", chance: 0.03 },
  { result: "medium_potion", chance: 0.01 },
  { result: "bones", chance: 0.05 },
  { result: "cave_crystal", chance: 0.04 },
  { result: "soul_fragment", chance: 0.01 },
  { result: "aguas", chance: 0.01 },
];

export function rollAbandonedMineGatherOutcome(): AbandonedMineGatherOutcome {
  const r = Math.random();
  let cumulative = 0;
  for (const outcome of ABANDONED_MINE_GATHER_OUTCOMES) {
    cumulative += outcome.chance;
    if (r < cumulative) return outcome;
  }
  const list = ABANDONED_MINE_GATHER_OUTCOMES;
  const last = list[list.length - 1];
  return last ?? list[0];
}
