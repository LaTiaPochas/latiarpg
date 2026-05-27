import "server-only";
import fs from "node:fs";
import path from "node:path";

/** Igual que el avatar del perfil: `pj_{slug}_standing.png`. */
function characterSpriteSlug(characterName: string | null | undefined): string {
  return String(characterName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/** Para `pj_*_fight_{code}.png` en disco. */
function weaponItemCodeForFilename(itemCode: string | null | undefined): string {
  return String(itemCode ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const CHARACTERS_PUBLIC_DIR = path.join(
  process.cwd(),
  "public",
  "img",
  "resources",
  "characters",
);

let fightSpriteFilenames: Set<string> | null = null;

function getFightSpriteFilenames(): Set<string> {
  if (fightSpriteFilenames) return fightSpriteFilenames;
  try {
    fightSpriteFilenames = new Set(
      fs.readdirSync(CHARACTERS_PUBLIC_DIR).filter((name) => name.includes("_rpg_fight_")),
    );
  } catch {
    fightSpriteFilenames = new Set();
  }
  return fightSpriteFilenames;
}

const LOG_WEAPON_SPRITES =
  process.env.NODE_ENV === "development" || process.env.DEBUG_WEAPON_SPRITES === "1";

function logWeaponSprites(payload: Record<string, unknown>) {
  if (!LOG_WEAPON_SPRITES) return;
  console.log("[weapon-sprites]", JSON.stringify(payload, null, 2));
}

/**
 * Combate / still iguales: sprite de fight si existe en `public/`, si no fallback standing.
 */
export function resolveEquippedWeaponSprites(
  characterName: string | null | undefined,
  itemCode: string | null | undefined,
): { active_combat_sprite: string; active_still_sprite: string } {
  const slug = characterSpriteSlug(characterName);
  const code = weaponItemCodeForFilename(itemCode);

  const standingUrl =
    slug.length > 0
      ? `/img/resources/characters/pj_${slug}_rpg_standing.png`
      : "/img/resources/logos/logo_latia_rpg.png";

  if (!slug.length || !code.length) {
    logWeaponSprites({
      phase: "resolve",
      branch: !slug.length ? "no_character_slug" : "no_item_code",
      rawCharacterName: characterName ?? null,
      slug: slug || null,
      rawItemCode: itemCode ?? null,
      codeNormalized: code || null,
      standingUrl,
      active_combat_sprite: standingUrl,
      active_still_sprite: standingUrl,
    });
    return { active_combat_sprite: standingUrl, active_still_sprite: standingUrl };
  }

  const fightUrl = `/img/resources/characters/pj_${slug}_rpg_fight_${code}.png`;
  const fightFilename = `pj_${slug}_rpg_fight_${code}.png`;
  const useFight = getFightSpriteFilenames().has(fightFilename);
  const chosen = useFight ? fightUrl : standingUrl;
  logWeaponSprites({
    phase: "resolve",
    branch: useFight ? "fight_file_exists" : "fallback_standing",
    rawCharacterName: characterName ?? null,
    slug,
    rawItemCode: itemCode ?? null,
    codeNormalized: code,
    fightUrl,
    fightFilename,
    fightFileExists: useFight,
    standingUrl,
    active_combat_sprite: chosen,
    active_still_sprite: chosen,
  });
  return { active_combat_sprite: chosen, active_still_sprite: chosen };
}
