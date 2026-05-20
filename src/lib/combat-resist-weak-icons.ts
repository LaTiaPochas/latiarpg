import { normalizePublicAssetUrl } from "@/lib/normalize-asset-url";

const ICONOS_DIR = "/img/resources/iconos";

/** Rutas de `state_icon` en JSON: nombre suelto → carpeta `iconos`. */
export function normalizeCombatStateIconUrl(raw: unknown): string | null {
  const normalized = normalizePublicAssetUrl(raw);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith(`${ICONOS_DIR}/`)) return normalized;
  if (normalized.startsWith("/img/")) return normalized;
  const base = normalized.replace(/^\//, "");
  if (!base.includes("/") && /^icon_/i.test(base)) {
    return `${ICONOS_DIR}/${base}`;
  }
  return normalized;
}

/** Elementos con iconos `icon_{element}resist_{up|down}.png` en `public`. */
export type CombatElementIconKey =
  | "fire"
  | "water"
  | "earth"
  | "wind"
  | "arcane"
  | "contundente"
  | "perforante"
  | "cortante";

const ELEMENT_ICON_ALIASES: Record<string, CombatElementIconKey> = {
  fire: "fire",
  fuego: "fire",
  water: "water",
  agua: "water",
  earth: "earth",
  tierra: "earth",
  wind: "wind",
  aire: "wind",
  viento: "wind",
  arcane: "arcane",
  arcano: "arcane",
  arcano_damage: "arcane",
  dano_arcano: "arcane",
  arcane_damage: "arcane",
  contundente: "contundente",
  perforante: "perforante",
  cortante: "cortante",
};

function normalizeTag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return normalized.length > 0 ? normalized : null;
}

export function resolveCombatElementIconKey(tag: unknown): CombatElementIconKey | null {
  const normalized = normalizeTag(tag);
  if (!normalized) return null;
  return ELEMENT_ICON_ALIASES[normalized] ?? null;
}

/** Tag canónico para comparar debilidad/resistencia con `attack_type` (p. ej. `arcano` → `arcane`). */
export function canonicalizeCombatResistWeakTag(tag: unknown): string | null {
  const element = resolveCombatElementIconKey(tag);
  if (element) return element;
  return normalizeTag(tag);
}

export function getCombatResistWeakIconSrc(
  tag: unknown,
  variant: "up" | "down",
): string | null {
  const element = resolveCombatElementIconKey(tag);
  if (!element) return null;
  return `${ICONOS_DIR}/icon_${element}resist_${variant}.png`;
}

/** Catálogo completo (en memoria al importar el módulo). */
export const COMBAT_RESIST_WEAK_ICON_CATALOG: Readonly<{
  elements: readonly CombatElementIconKey[];
  byElement: Readonly<
    Record<CombatElementIconKey, Readonly<{ up: string; down: string }>>
  >;
  allSrcs: readonly string[];
}> = (() => {
  const elements: CombatElementIconKey[] = [
    "fire",
    "water",
    "earth",
    "wind",
    "arcane",
    "contundente",
    "perforante",
    "cortante",
  ];
  const byElement = {} as Record<CombatElementIconKey, { up: string; down: string }>;
  const allSrcs: string[] = [];
  for (const element of elements) {
    const up = `${ICONOS_DIR}/icon_${element}resist_up.png`;
    const down = `${ICONOS_DIR}/icon_${element}resist_down.png`;
    byElement[element] = { up, down };
    allSrcs.push(up, down);
  }
  return { elements, byElement, allSrcs };
})();

const preloadedSrcs = new Set<string>();

/** Precarga en el navegador (idempotente). */
export function preloadCombatResistWeakIcons(extraSrcs: Iterable<string> = []): void {
  if (typeof window === "undefined") return;
  const toLoad = new Set<string>([...COMBAT_RESIST_WEAK_ICON_CATALOG.allSrcs, ...extraSrcs]);
  for (const raw of toLoad) {
    const src = normalizePublicAssetUrl(raw);
    if (!src || preloadedSrcs.has(src)) continue;
    preloadedSrcs.add(src);
    const img = new window.Image();
    img.decoding = "async";
    img.src = src;
  }
}

export type CombatStateIconResolved = {
  src: string;
  /** p. ej. `RES: arcane` / `WEAK: fire`; null si no es resist/debilidad automática. */
  tooltip: string | null;
};

function formatResistWeakTooltip(kind: "RES" | "WEAK", tag: unknown): string | null {
  const canonical = canonicalizeCombatResistWeakTag(tag) ?? normalizeTag(tag);
  if (!canonical) return null;
  const label = canonical.replace(/_/g, " ");
  return `${kind}: ${label}`;
}

/** Iconos para HUD: JSON explícito + resist (up) + debilidad (down). */
export function resolveCombatStateIconSrcs(opts: {
  stateIcons?: Iterable<string>;
  resistanceTags?: Iterable<string>;
  weaknessTags?: Iterable<string>;
}): CombatStateIconResolved[] {
  const seen = new Set<string>();
  const out: CombatStateIconResolved[] = [];

  const push = (src: string | null, tooltip: string | null) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    out.push({ src, tooltip });
  };

  for (const raw of opts.stateIcons ?? []) {
    push(normalizeCombatStateIconUrl(raw), null);
  }
  for (const tag of opts.resistanceTags ?? []) {
    push(getCombatResistWeakIconSrc(tag, "up"), formatResistWeakTooltip("RES", tag));
  }
  for (const tag of opts.weaknessTags ?? []) {
    push(getCombatResistWeakIconSrc(tag, "down"), formatResistWeakTooltip("WEAK", tag));
  }

  return out;
}

/** Si el HUD solo tiene la ruta del ícono (sin tag), deduce `RES: arcane` / `WEAK: fire`. */
export function inferResistWeakTooltipFromIconSrc(src: string): string | null {
  const file = (normalizePublicAssetUrl(src) ?? src).split("/").pop() ?? "";
  const match = /^icon_(.+)resist_(up|down)\.png$/i.exec(file);
  if (!match) return null;
  const element = match[1].replace(/_/g, " ");
  const kind = match[2].toLowerCase() === "up" ? "RES" : "WEAK";
  return `${kind}: ${element}`;
}

/** Rutas a precargar según resistencias/debilidades de enemigos del encuentro. */
export function collectResistWeakIconSrcsForEnemyTags(
  enemies: ReadonlyArray<{ resistances?: unknown; weaknesses?: unknown }>,
): string[] {
  const out = new Set<string>();
  const addTag = (tag: unknown, variant: "up" | "down") => {
    const src = getCombatResistWeakIconSrc(tag, variant);
    if (src) out.add(src);
  };

  for (const enemy of enemies) {
    const resList = Array.isArray(enemy.resistances) ? enemy.resistances : [];
    const weakList = Array.isArray(enemy.weaknesses) ? enemy.weaknesses : [];
    for (const r of resList) addTag(r, "up");
    for (const w of weakList) addTag(w, "down");
  }

  return Array.from(out);
}
