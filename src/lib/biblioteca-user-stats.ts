export type BibliotecaUserStatRow = Record<string, unknown> & {
  user_id: string;
  miembro?: string | null;
};

export type BibliotecaStatsPayload = {
  stats: BibliotecaUserStatRow[];
};

const MEMBER_FACE_FALLBACK_SRC = "/img/resources/logos/logo_latia_rpg.png";
const TEST_MEMBER_MIEMBRO = "test";

function isTestMemberStatRow(row: BibliotecaUserStatRow): boolean {
  return resolveMiembroKeyFromStatRow(row) === TEST_MEMBER_MIEMBRO;
}

function resolveMiembroKeyFromStatRow(row: BibliotecaUserStatRow): string {
  const value = row.miembro;
  if (typeof value === "string" && value.trim()) {
    return value.trim().toLowerCase();
  }
  return "";
}

function capitalizeMiembroName(value: string): string {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function resolveMiembroFromStatRow(row: BibliotecaUserStatRow): string {
  const key = resolveMiembroKeyFromStatRow(row);
  return key ? capitalizeMiembroName(key) : "Sin nombre";
}

export function buildMemberFaceSrc(miembro: string | null | undefined): string {
  const key = typeof miembro === "string" ? miembro.trim().toLowerCase() : "";
  if (!key) return MEMBER_FACE_FALLBACK_SRC;
  return `/img/resources/iconos/icon_${key}_face.png`;
}

const MATERIAL_STAT_KEYS = [
  "materials_given",
  "wood_given",
  "rock_given",
  "gold_given",
  "hard_wood_given",
  "animal_pelt_given",
  "iron_ingots_given",
] as const;

export type BibliotecaMaterialStatKey = (typeof MATERIAL_STAT_KEYS)[number];

export const COMBAT_STAT_COLUMNS = [
  { key: "combats_won", label: "Combates Ganados" },
  { key: "deaths", label: "Muertes" },
  { key: "enemies_defeated", label: "Enemigos Derrotados" },
  { key: "bosses_defeated", label: "Bosses Derrotados" },
  { key: "total_damage_dealt", label: "Daño Total Hecho" },
  { key: "total_damage_taken", label: "Daño Total Recibido" },
  { key: "total_healing", label: "Healing Total" },
  { key: "highest_hit_dealt", label: "Golpe más Fuerte" },
  { key: "highest_hit_received", label: "Mayor Golpe Recibido" },
] as const;

export type BibliotecaCombatStatKey = (typeof COMBAT_STAT_COLUMNS)[number]["key"];

export type BibliotecaCombatMemberRow = {
  userId: string;
  memberName: string;
  memberFaceSrc: string;
} & Record<BibliotecaCombatStatKey, number>;

export type BibliotecaCombatStatTopEntry = {
  rank: number;
  userId: string;
  memberName: string;
  memberFaceSrc: string;
  value: number;
};

const COMBAT_STAT_TOP_LIMIT = 5;

export function getCombatStatTopMembers(
  members: BibliotecaCombatMemberRow[],
  statKey: BibliotecaCombatStatKey,
  limit = COMBAT_STAT_TOP_LIMIT,
): BibliotecaCombatStatTopEntry[] {
  return [...members]
    .filter((member) => member[statKey] > 0)
    .sort(
      (a, b) =>
        b[statKey] - a[statKey] || a.memberName.localeCompare(b.memberName, "es"),
    )
    .slice(0, limit)
    .map((member, index) => ({
      rank: index + 1,
      userId: member.userId,
      memberName: member.memberName,
      memberFaceSrc: member.memberFaceSrc,
      value: member[statKey],
    }));
}

export type BibliotecaMaterialsTableRow = {
  userId: string;
  memberName: string;
  memberFaceSrc: string;
} & Record<BibliotecaMaterialStatKey, number>;

function asNonNegativeInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }
  return 0;
}

export function buildBibliotecaMaterialsTableRows(
  payload: BibliotecaStatsPayload,
): BibliotecaMaterialsTableRow[] {
  return payload.stats
    .filter((row) => !isTestMemberStatRow(row))
    .map((row) => {
      const userId = typeof row.user_id === "string" ? row.user_id.trim() : "";
      if (!userId) return null;

      const materialValues = Object.fromEntries(
        MATERIAL_STAT_KEYS.map((key) => [key, asNonNegativeInt(row[key])]),
      ) as Record<BibliotecaMaterialStatKey, number>;

      const memberName = resolveMiembroFromStatRow(row);

      return {
        userId,
        memberName,
        memberFaceSrc: buildMemberFaceSrc(row.miembro),
        ...materialValues,
      };
    })
    .filter((row): row is BibliotecaMaterialsTableRow => row !== null)
    .sort(
      (a, b) =>
        b.materials_given - a.materials_given ||
        a.memberName.localeCompare(b.memberName, "es"),
    );
}

export function buildBibliotecaCombatMemberRows(
  payload: BibliotecaStatsPayload,
): BibliotecaCombatMemberRow[] {
  return payload.stats
    .filter((row) => !isTestMemberStatRow(row))
    .map((row) => {
      const userId = typeof row.user_id === "string" ? row.user_id.trim() : "";
      if (!userId) return null;

      const combatValues = Object.fromEntries(
        COMBAT_STAT_COLUMNS.map((column) => [column.key, asNonNegativeInt(row[column.key])]),
      ) as Record<BibliotecaCombatStatKey, number>;

      const memberName = resolveMiembroFromStatRow(row);

      return {
        userId,
        memberName,
        memberFaceSrc: buildMemberFaceSrc(row.miembro),
        ...combatValues,
      };
    })
    .filter((row): row is BibliotecaCombatMemberRow => row !== null)
    .sort(
      (a, b) =>
        b.combats_won - a.combats_won ||
        a.memberName.localeCompare(b.memberName, "es"),
    );
}
