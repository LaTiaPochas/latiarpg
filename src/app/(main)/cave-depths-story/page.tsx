import { redirect } from "next/navigation";

import { CaveDepthsStory } from "@/components/cave-depths/cave-depths-story";
import { CAVE_DEPTHS_ZONE_CODE } from "@/lib/game-zones";
import { normalizePublicAssetUrl } from "@/lib/normalize-asset-url";
import {
  buildPlayerCombatSpriteFallback,
  buildPlayerFaceSrc,
  buildPlayerToken,
  resolvePlayerName,
} from "@/lib/player-character-assets";
import { getUserCombatStepForZone } from "@/lib/user-combat-progress";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Encuentro en las profundidades",
};

export default async function CaveDepthsStoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("cave_entrance_dialog")
    .eq("user_id", user.id)
    .maybeSingle();

  if (milestones?.cave_entrance_dialog !== true) {
    redirect("/bosque-inexplorado?hotspot=cave-entrance");
  }

  const currentCombatStep = await getUserCombatStepForZone(
    supabase,
    user.id,
    CAVE_DEPTHS_ZONE_CODE,
  );

  if (currentCombatStep < 4) {
    redirect("/cave-depths");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("miembro")
    .eq("id", user.id)
    .maybeSingle();

  const { data: userCharacter } = await supabase
    .from("user_character")
    .select("character_name, active_combat_sprite")
    .eq("profile_id", user.id)
    .maybeSingle();

  const fallbackName = user.email?.split("@")[0] ?? "Aventurero";
  const playerName = resolvePlayerName(
    userCharacter?.character_name,
    profile?.miembro,
    fallbackName,
  );
  const playerToken = buildPlayerToken(playerName) || "fede";
  const playerFaceSrc = buildPlayerFaceSrc(playerToken);
  const playerSpriteSrc =
    normalizePublicAssetUrl(userCharacter?.active_combat_sprite) ??
    buildPlayerCombatSpriteFallback(playerToken);

  return (
    <CaveDepthsStory
      playerName={playerName}
      playerSpriteSrc={playerSpriteSrc}
      playerFaceSrc={playerFaceSrc}
    />
  );
}
