import { capitalizeFirstLetterOnly } from "@/components/character-profile/inventory-types";

export type HerreriaCraftPreviewStatLine = {
  text: string;
  isNegative: boolean;
};

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatCraftPreviewStatLine(statKey: string, value: number): HerreriaCraftPreviewStatLine | null {
  const label = capitalizeFirstLetterOnly(statKey.trim());
  if (!label) return null;

  const amount = Math.trunc(value);
  const isNegative = amount < 0;
  const magnitude = Math.abs(amount);
  const text = isNegative ? `-${magnitude} ${label}` : `+ ${magnitude} ${label}`;

  return { text, isNegative };
}

export function parseCraftPreviewStatsLines(raw: unknown): HerreriaCraftPreviewStatLine[] {
  if (raw == null) return [];

  let record: Record<string, unknown> | null = null;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        record = parsed as Record<string, unknown>;
      }
    } catch {
      return [];
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    record = raw as Record<string, unknown>;
  }

  if (!record) return [];

  const lines: HerreriaCraftPreviewStatLine[] = [];
  for (const [key, value] of Object.entries(record)) {
    const numericValue = asFiniteNumber(value);
    if (numericValue == null) continue;
    const line = formatCraftPreviewStatLine(key, numericValue);
    if (line) lines.push(line);
  }

  return lines;
}
