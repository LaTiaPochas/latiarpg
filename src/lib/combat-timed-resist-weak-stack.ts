import {
  canonicalizeCombatResistWeakTag,
  getCombatResistWeakIconSrc,
  normalizeCombatStateIconUrl,
} from "@/lib/combat-resist-weak-icons";

export type TimedResistWeakModifierFields = {
  stateIcons: string[];
  extraWeaknessTags: string[];
  extraResistanceTags: string[];
  remainingTurns: number;
};

function dedupeTagStrings(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const n = canonicalizeCombatResistWeakTag(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function tagKeySet(tags: Iterable<string>): Set<string> {
  return new Set(dedupeTagStrings(tags));
}

function tagSetsOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) {
    if (b.has(x)) return true;
  }
  return false;
}

function modifierWeakKeys(row: TimedResistWeakModifierFields): Set<string> {
  return tagKeySet(row.extraWeaknessTags);
}

function modifierResKeys(row: TimedResistWeakModifierFields): Set<string> {
  return tagKeySet(row.extraResistanceTags);
}

/** Mismo elemento en debilidad o resistencia → un solo buff/debuff (dura el máximo de turnos). */
export function timedResistWeakModifiersOverlap(
  a: TimedResistWeakModifierFields,
  b: TimedResistWeakModifierFields,
): boolean {
  return (
    tagSetsOverlap(modifierWeakKeys(a), modifierWeakKeys(b)) ||
    tagSetsOverlap(modifierResKeys(a), modifierResKeys(b))
  );
}

function mergeStateIconLists(...lists: readonly string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const t = raw.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Quita `state_icons` redundantes si el tag ya genera el mismo PNG (up/down). */
export function sanitizeTimedModifierStateIcons<
  T extends TimedResistWeakModifierFields,
>(row: T): T {
  const autoSrcs = new Set<string>();
  for (const tag of row.extraWeaknessTags) {
    const src = getCombatResistWeakIconSrc(tag, "down");
    if (src) autoSrcs.add(src);
  }
  for (const tag of row.extraResistanceTags) {
    const src = getCombatResistWeakIconSrc(tag, "up");
    if (src) autoSrcs.add(src);
  }
  const stateIcons = row.stateIcons.filter((raw) => {
    const src = normalizeCombatStateIconUrl(raw);
    return src != null && !autoSrcs.has(src);
  });
  return { ...row, stateIcons };
}

export function mergeTimedResistWeakModifierFields<
  T extends TimedResistWeakModifierFields,
>(existing: T, incoming: T): T {
  return sanitizeTimedModifierStateIcons({
    ...existing,
    remainingTurns: Math.max(existing.remainingTurns, incoming.remainingTurns),
    extraWeaknessTags: dedupeTagStrings([
      ...existing.extraWeaknessTags,
      ...incoming.extraWeaknessTags,
    ]),
    extraResistanceTags: dedupeTagStrings([
      ...existing.extraResistanceTags,
      ...incoming.extraResistanceTags,
    ]),
    stateIcons: mergeStateIconLists(existing.stateIcons, incoming.stateIcons),
  });
}

export function stackPlayerTimedResistWeakModifiers<
  T extends TimedResistWeakModifierFields & {
    id: string;
    lastTickTurn: number;
    sourceSkillName: string;
  },
>(prev: T[], incoming: T[], roundTurn: number): T[] {
  const next = [...prev];
  for (const row of incoming) {
    const sanitized = sanitizeTimedModifierStateIcons(row);
    const idx = next.findIndex((r) => timedResistWeakModifiersOverlap(r, sanitized));
    if (idx < 0) {
      next.push({ ...sanitized, lastTickTurn: roundTurn });
      continue;
    }
    next[idx] = {
      ...mergeTimedResistWeakModifierFields(next[idx], sanitized),
      lastTickTurn: roundTurn,
      sourceSkillName: sanitized.sourceSkillName,
    };
  }
  return next;
}

export type EnemySelfTimedResistWeakRow = {
  id: string;
  enemyId: string;
  remainingTurns: number;
  lastTickTurn: number;
  skillName: string;
  stateIcons: string[];
  weaknessTags: string[];
  resistanceTags: string[];
};

function enemySelfRowToTimedFields(row: EnemySelfTimedResistWeakRow): TimedResistWeakModifierFields {
  return {
    stateIcons: row.stateIcons,
    extraWeaknessTags: row.weaknessTags,
    extraResistanceTags: row.resistanceTags,
    remainingTurns: row.remainingTurns,
  };
}

export function stackEnemySelfTimedResistWeakModifiers(
  prev: EnemySelfTimedResistWeakRow[],
  incoming: EnemySelfTimedResistWeakRow[],
  roundTurn: number,
): EnemySelfTimedResistWeakRow[] {
  const next = [...prev];
  for (const row of incoming) {
    const sanitized = sanitizeTimedModifierStateIcons(enemySelfRowToTimedFields(row));
    const idx = next.findIndex(
      (r) =>
        r.enemyId === row.enemyId &&
        timedResistWeakModifiersOverlap(enemySelfRowToTimedFields(r), sanitized),
    );
    if (idx < 0) {
      next.push({
        ...row,
        stateIcons: sanitized.stateIcons,
        weaknessTags: sanitized.extraWeaknessTags,
        resistanceTags: sanitized.extraResistanceTags,
        lastTickTurn: roundTurn,
      });
      continue;
    }
    const merged = mergeTimedResistWeakModifierFields(
      enemySelfRowToTimedFields(next[idx]),
      sanitized,
    );
    next[idx] = {
      ...next[idx],
      remainingTurns: merged.remainingTurns,
      weaknessTags: merged.extraWeaknessTags,
      resistanceTags: merged.extraResistanceTags,
      stateIcons: merged.stateIcons,
      lastTickTurn: roundTurn,
      skillName: row.skillName,
    };
  }
  return next;
}
