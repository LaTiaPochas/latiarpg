/** Etiquetas del bestiario por `zones.zone_order`. */
export const BESTIARIO_ZONE_ORDER_LABELS: Record<number, string> = {
  1: "Bosque Inexplorado",
  2: "Túneles Mineros",
};

export type BibliotecaZoneRow = {
  id: string;
  code: string;
  name: string | null;
  zone_order: number;
};

export type BibliotecaBestiarioZoneGroup = {
  zoneOrder: number;
  label: string;
  zones: BibliotecaZoneRow[];
};

function asZoneOrder(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

export function resolveBestiarioZoneGroupLabel(
  zoneOrder: number,
  zones: BibliotecaZoneRow[],
): string {
  const mapped = BESTIARIO_ZONE_ORDER_LABELS[zoneOrder];
  if (mapped) return mapped;

  const namedZone = zones.find((zone) => typeof zone.name === "string" && zone.name.trim());
  if (namedZone?.name?.trim()) {
    return namedZone.name.trim();
  }

  return `Zona ${zoneOrder}`;
}

export function groupDiscoveredZonesByOrder(rows: BibliotecaZoneRow[]): BibliotecaBestiarioZoneGroup[] {
  const sorted = [...rows].sort(
    (a, b) => a.zone_order - b.zone_order || a.code.localeCompare(b.code, "es"),
  );

  const groups: BibliotecaBestiarioZoneGroup[] = [];

  for (const zone of sorted) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.zoneOrder === zone.zone_order) {
      lastGroup.zones.push(zone);
      continue;
    }

    groups.push({
      zoneOrder: zone.zone_order,
      label: resolveBestiarioZoneGroupLabel(zone.zone_order, [zone]),
      zones: [zone],
    });
  }

  for (const group of groups) {
    group.label = resolveBestiarioZoneGroupLabel(group.zoneOrder, group.zones);
  }

  return groups;
}

export function parseBibliotecaZoneRows(data: unknown[]): BibliotecaZoneRow[] {
  return data
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id.trim() : String(record.id ?? "").trim();
      const code = typeof record.code === "string" ? record.code.trim() : "";
      const zoneOrder = asZoneOrder(record.zone_order);
      if (!id || !code || zoneOrder == null) return null;

      const name = typeof record.name === "string" ? record.name.trim() || null : null;

      return { id, code, name, zone_order: zoneOrder };
    })
    .filter((row): row is BibliotecaZoneRow => row !== null);
}
