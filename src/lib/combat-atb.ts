/** Umbral de la barra ATB (estilo Final Fantasy). */
export const ATB_GAUGE_MAX = 10_000;

export type AtbCombatant = {
  id: string;
  speed: number;
  alive: boolean;
};

export type AtbGaugeMap = Record<string, number>;

function aliveCombatants(combatants: AtbCombatant[]): AtbCombatant[] {
  return combatants.filter((c) => c.alive && c.speed > 0);
}

function compareReadyActors(a: AtbCombatant, b: AtbCombatant, gauges: AtbGaugeMap): number {
  const overflowA = (gauges[a.id] ?? 0) - ATB_GAUGE_MAX;
  const overflowB = (gauges[b.id] ?? 0) - ATB_GAUGE_MAX;
  if (overflowB !== overflowA) return overflowB - overflowA;
  if (b.speed !== a.speed) return b.speed - a.speed;
  return a.id.localeCompare(b.id);
}

/** Gauges iniciales: el más rápido puede actuar primero; el resto escalonado por velocidad. */
export function createInitialAtbGauges(combatants: AtbCombatant[]): AtbGaugeMap {
  const alive = aliveCombatants(combatants);
  const gauges: AtbGaugeMap = {};
  if (alive.length === 0) return gauges;

  const maxSpeed = Math.max(1, ...alive.map((c) => c.speed));
  for (const c of alive) {
    gauges[c.id] = Math.floor((c.speed / maxSpeed) * ATB_GAUGE_MAX * 0.82);
  }

  const fastest = [...alive].sort((a, b) => b.speed - a.speed || a.id.localeCompare(b.id))[0];
  if (fastest) gauges[fastest.id] = ATB_GAUGE_MAX;

  return gauges;
}

function pickReadyActor(combatants: AtbCombatant[], gauges: AtbGaugeMap): AtbCombatant | null {
  const ready = aliveCombatants(combatants).filter((c) => (gauges[c.id] ?? 0) >= ATB_GAUGE_MAX);
  if (ready.length === 0) return null;
  ready.sort((a, b) => compareReadyActors(a, b, gauges));
  return ready[0] ?? null;
}

/** Avanza barras ATB hasta que alguien pueda actuar; devuelve su id. */
export function resolveNextAtbActor(
  gauges: AtbGaugeMap,
  combatants: AtbCombatant[],
): string | null {
  const ready = pickReadyActor(combatants, gauges);
  if (ready) return ready.id;

  const alive = aliveCombatants(combatants);
  if (alive.length === 0) return null;

  let safety = 0;
  while (safety++ < 512) {
    let minTicks = Infinity;
    for (const c of alive) {
      const g = gauges[c.id] ?? 0;
      if (g >= ATB_GAUGE_MAX) continue;
      const need = ATB_GAUGE_MAX - g;
      minTicks = Math.min(minTicks, need / Math.max(1, c.speed));
    }
    if (!Number.isFinite(minTicks) || minTicks <= 0) minTicks = 1;

    for (const c of alive) {
      gauges[c.id] = (gauges[c.id] ?? 0) + c.speed * minTicks;
    }

    const next = pickReadyActor(combatants, gauges);
    if (next) return next.id;
  }

  return alive[0]?.id ?? null;
}

/** Tras actuar: gauge a 0 y calcular el siguiente. */
export function advanceAtbAfterAction(
  gauges: AtbGaugeMap,
  combatants: AtbCombatant[],
  actedActorId: string,
): string | null {
  gauges[actedActorId] = 0;
  return resolveNextAtbActor(gauges, combatants);
}

/** Orden previsto en la línea de tiempo (el primero es el que actúa ahora o el próximo). */
export function predictAtbTimeline(
  gauges: AtbGaugeMap,
  combatants: AtbCombatant[],
  slotCount: number,
): string[] {
  const count = Math.max(1, Math.trunc(slotCount));
  const simGauges: AtbGaugeMap = { ...gauges };
  const simCombatants = combatants.map((c) => ({ ...c }));
  const out: string[] = [];
  let safety = 0;

  while (out.length < count && safety++ < 1024) {
    const nextId = resolveNextAtbActor(simGauges, simCombatants);
    if (!nextId) break;
    out.push(nextId);
    simGauges[nextId] = 0;
  }

  return out;
}

export function pruneAtbGaugesForCombatants(
  gauges: AtbGaugeMap,
  combatants: AtbCombatant[],
): AtbGaugeMap {
  const valid = new Set(combatants.filter((c) => c.alive).map((c) => c.id));
  const next: AtbGaugeMap = {};
  for (const [id, value] of Object.entries(gauges)) {
    if (valid.has(id)) next[id] = value;
  }
  for (const c of combatants) {
    if (c.alive && next[c.id] == null) next[c.id] = 0;
  }
  return next;
}

export function atbGaugePercent(gauge: number): number {
  return Math.max(0, Math.min(100, (Math.max(0, gauge) / ATB_GAUGE_MAX) * 100));
}
