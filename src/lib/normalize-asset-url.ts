/**
 * Convierte rutas guardadas en BD a URL usable en el cliente.
 * - Añade `/` inicial para assets bajo `public/`.
 * - Quita prefijo `public/` si vino así en el seed.
 * - Respeta URLs absolutas (p. ej. Supabase Storage).
 */
export function normalizePublicAssetUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().replace(/\\/g, "/");
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return `https:${s}`;
  if (s.startsWith("/")) return s;
  if (/^public\//i.test(s)) return `/${s.slice(7)}`;
  return `/${s.replace(/^\.+\//, "")}`;
}

const ENEMY_SPRITE_PUBLIC_DIR = "/img/resources/enemigos/";
const ENEMY_FACE_PUBLIC_DIR = "/img/resources/enemigos_faces/";

/**
 * Resuelve rutas de `enemy_templates` cuando en BD solo guardás el nombre del archivo
 * (p. ej. `enemy_sprite_blackwolf.png`) o una ruta completa bajo `/public`.
 */
export function normalizeEnemyTemplateAssetUrl(
  raw: unknown,
  kind: "sprite" | "portrait",
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\\/g, "/");
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const normalized = normalizePublicAssetUrl(trimmed);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;

  if (
    normalized.startsWith(ENEMY_SPRITE_PUBLIC_DIR) ||
    normalized.startsWith(ENEMY_FACE_PUBLIC_DIR)
  ) {
    return normalized;
  }
  if (normalized.startsWith("/img/")) {
    return normalized;
  }

  const withoutLeadingSlash = normalized.replace(/^\//, "");
  if (!withoutLeadingSlash.includes("/")) {
    const dir = kind === "portrait" ? ENEMY_FACE_PUBLIC_DIR : ENEMY_SPRITE_PUBLIC_DIR;
    return `${dir}${withoutLeadingSlash}`;
  }

  return normalized;
}
