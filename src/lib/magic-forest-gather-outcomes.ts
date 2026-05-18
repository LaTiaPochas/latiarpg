export type MagicForestGatherOutcome = {
  result: string;
  chance: number;
};

/** Cantidad de madera al resultado `madera` en Bosque Mágico (inclusive). */
export const MAGIC_FOREST_WOOD_QUANTITY_MIN = 2;
export const MAGIC_FOREST_WOOD_QUANTITY_MAX = 5;

export function rollMagicForestWoodQuantity(): number {
  const span = MAGIC_FOREST_WOOD_QUANTITY_MAX - MAGIC_FOREST_WOOD_QUANTITY_MIN + 1;
  return MAGIC_FOREST_WOOD_QUANTITY_MIN + Math.floor(Math.random() * span);
}

/** Probabilidades “juntar madera” en Bosque Mágico. Suman 1. */
export const MAGIC_FOREST_GATHER_OUTCOMES: MagicForestGatherOutcome[] = [
  { result: "madera", chance: 0.40 },
  { result: "enemy", chance: 0.40 },
  { result: "potion", chance: 0.05 },
  { result: "medium_potion", chance: 0.01 },
  { result: "feather", chance: 0.05 },
  { result: "oro", chance: 0.05 },
  { result: "aguas", chance: 0.01 },
  { result: "soul_fragment", chance: 0.03 },
];

export function rollMagicForestGatherOutcome(): MagicForestGatherOutcome {
  const r = Math.random();
  let cumulative = 0;
  for (const outcome of MAGIC_FOREST_GATHER_OUTCOMES) {
    cumulative += outcome.chance;
    if (r < cumulative) return outcome;
  }
  const list = MAGIC_FOREST_GATHER_OUTCOMES;
  const last = list[list.length - 1];
  return last ?? list[0];
}
