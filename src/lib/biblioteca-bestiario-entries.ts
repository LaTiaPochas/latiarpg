import { normalizeEnemyTemplateAssetUrl } from "@/lib/normalize-asset-url";

export const BESTIARIO_UNDISCOVERED_NAME = "????";

export type BibliotecaBestiarioEnemyEntry = {
  templateId: string;
  name: string;
  spriteSrc: string | null;
  discovered: boolean;
  sortOrder: number;
};

function firstNonEmptyString(...vals: unknown[]): string | null {
  for (const val of vals) {
    if (typeof val === "string") {
      const s = val.trim();
      if (s) return s;
    }
  }
  return null;
}

function pickRelationRow<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function templateSpriteRaw(record: Record<string, unknown>): string | null {
  return firstNonEmptyString(record.sprite_path);
}

function asSortOrder(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return 0;
}

export function buildBestiarioEnemyEntries(
  catalogRows: unknown[],
  discoveredTemplateIds: ReadonlySet<string>,
): BibliotecaBestiarioEnemyEntry[] {
  const byTemplate = new Map<
    string,
    {
      name: string;
      spriteSrc: string | null;
      sortOrder: number;
    }
  >();

  for (const row of catalogRows) {
    if (!row || typeof row !== "object") continue;
    const entry = row as Record<string, unknown>;
    const templateId =
      typeof entry.enemy_template_id === "string"
        ? entry.enemy_template_id.trim()
        : entry.enemy_template_id != null
          ? String(entry.enemy_template_id).trim()
          : "";
    if (!templateId) continue;

    const sortOrder = asSortOrder(entry.sort_order);
    const template = pickRelationRow(entry.enemy_templates);
    let name: string | null = null;
    let spriteSrc: string | null = null;

    if (template && typeof template === "object") {
      const templateRecord = template as Record<string, unknown>;
      name = firstNonEmptyString(templateRecord.name, templateRecord.display_name);
      spriteSrc = normalizeEnemyTemplateAssetUrl(templateSpriteRaw(templateRecord), "sprite");
    }

    if (!name) {
      name = `Enemigo ${templateId.slice(0, 8)}`;
    }

    const existing = byTemplate.get(templateId);
    if (!existing || sortOrder < existing.sortOrder) {
      byTemplate.set(templateId, {
        name,
        spriteSrc,
        sortOrder,
      });
    }
  }

  const enemies: BibliotecaBestiarioEnemyEntry[] = [];

  for (const [templateId, meta] of byTemplate) {
    const discovered = discoveredTemplateIds.has(templateId);

    enemies.push({
      templateId,
      name: meta.name,
      spriteSrc: meta.spriteSrc,
      discovered,
      sortOrder: meta.sortOrder,
    });
  }

  return enemies.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"),
  );
}
