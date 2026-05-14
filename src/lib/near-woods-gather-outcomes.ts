export type NearWoodsGatherOutcome = {
  result: string;
  chance: number;
};

/** Probabilidades por tirada “juntar madera” (cercanías del bosque). Suman 1. */
export const NEAR_WOODS_GATHER_OUTCOMES: NearWoodsGatherOutcome[] = [
  { result: "madera", chance: 0.44 },
  { result: "enemy", chance: 0.35 },
  { result: "potion", chance: 0.05 },
  { result: "wolf_pelt", chance: 0.05 },
  { result: "thread", chance: 0.05 },
  { result: "oro", chance: 0.04 },
  { result: "aguas", chance: 0.01 },
  { result: "soul_fragment", chance: 0.01 },
];

/** Una tirada según `chance` de cada entrada (suma debe ser 1). */
export function rollNearWoodsGatherOutcome(): NearWoodsGatherOutcome {
  const r = Math.random();
  let cumulative = 0;
  for (const outcome of NEAR_WOODS_GATHER_OUTCOMES) {
    cumulative += outcome.chance;
    if (r < cumulative) return outcome;
  }
  const list = NEAR_WOODS_GATHER_OUTCOMES;
  const last = list[list.length - 1];
  return last ?? list[0];
}
