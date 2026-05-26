import { redirect } from "next/navigation";

import {
  SOUL_GAUNTLET_LOBBY_PATH,
  buildSoulGauntletCombatPath,
} from "@/lib/soul-gauntlet";
import { getActiveSoulGauntletRun } from "@/lib/soul-gauntlet-run";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Soul Pit Gauntlet — Run",
};

export default async function SoulGauntletRunPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const run = await getActiveSoulGauntletRun(supabase, user.id);
  if (!run) {
    redirect(SOUL_GAUNTLET_LOBBY_PATH);
  }

  const { href } = buildSoulGauntletCombatPath(run.current_floor, run.id);
  redirect(href);
}
