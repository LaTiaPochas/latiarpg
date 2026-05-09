import { normalizePublicAssetUrl } from "@/lib/normalize-asset-url";

/** Misma lógica que el perfil: URL final para `items.icon_path`. */
export function resolveInventoryIconPath(iconPath: string | null | undefined): string {
  const normalized = normalizePublicAssetUrl(iconPath);
  return normalized ?? "/img/resources/logos/logo_latia_rpg.png";
}
