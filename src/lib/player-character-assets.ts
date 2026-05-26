export function resolvePlayerName(
  characterName: string | null | undefined,
  profileMember: string | null | undefined,
  emailFallback: string,
): string {
  const fromCharacter = characterName?.trim();
  if (fromCharacter) return fromCharacter;
  const fromProfile = profileMember?.trim();
  if (fromProfile) return fromProfile;
  return emailFallback;
}

export function buildPlayerToken(playerName: string): string {
  return playerName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function buildPlayerFaceSrc(playerToken: string): string {
  const token = playerToken.trim() || "fede";
  return `/img/resources/caracters_faces/pj_${token}_rpg_face.png`;
}

export function buildPlayerCombatSpriteFallback(playerToken: string): string {
  const token = playerToken.trim() || "fede";
  return `/img/resources/characters/pj_${token}_rpg_standing.png`;
}
