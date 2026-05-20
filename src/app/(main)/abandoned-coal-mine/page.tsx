import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AbandonedCoalMineShell } from "./abandoned-coal-mine-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Minas abandonadas",
};

/** Pico de Piedra (`items.id`). */
const STONE_PICKAXE_ITEM_ID = "817548a0-9037-4cd7-b03b-0b78ea34f340";

export default async function AbandonedCoalMinePage() {
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

  const { data: pickaxeRows } = await supabase
    .from("user_inventory")
    .select("quantity")
    .eq("profile_id", user.id)
    .eq("item_id", STONE_PICKAXE_ITEM_ID)
    .gt("quantity", 0)
    .limit(1);
  const hasStonePickaxeInInventory = Boolean(pickaxeRows && pickaxeRows.length > 0);

  return <AbandonedCoalMineShell hasStonePickaxeInInventory={hasStonePickaxeInInventory} />;
}
