export type MagicForestGatherOutcome = {
  result: string;
  chance: number;
};

/** Probabilidades “juntar madera” en Bosque Mágico. Suman 1. */
export const MAGIC_FOREST_GATHER_OUTCOMES: MagicForestGatherOutcome[] = [
  { result: "madera", chance: 0.45 },
  { result: "enemy", chance: 0.35 },
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
