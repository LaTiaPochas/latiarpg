export type AbandonedMineGatherOutcome = {
  result: string;
  chance: number;
};

/**
 * Igual que `MAGIC_FOREST_GATHER_OUTCOMES`, pero el recurso principal es `piedra` (mina) en lugar de `madera`.
 * Las probabilidades suman 1.
 */
export const ABANDONED_MINE_GATHER_OUTCOMES: AbandonedMineGatherOutcome[] = [
  { result: "piedra", chance: 0.44 },
  { result: "enemy", chance: 0.4 },
  { result: "potion", chance: 0.05 },
  { result: "medium_potion", chance: 0.01 },
  { result: "coal", chance: 0.01 },
  { result: "iron", chance: 0.01 },
  { result: "bones", chance: 0.01 },
  { result: "oro", chance: 0.05 },
  { result: "aguas", chance: 0.01 },
  { result: "soul_fragment", chance: 0.03 },
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
