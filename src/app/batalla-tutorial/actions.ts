"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function markIntroCompleted() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("intro_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  const shouldGrantWoodReward = !milestones?.intro_completed;

  if (shouldGrantWoodReward) {
    const { data: characterRow } = await supabase
      .from("user_character")
      .select("experience_current")
      .eq("profile_id", user.id)
      .maybeSingle();

    const currentExperience = Math.max(0, characterRow?.experience_current ?? 0);
    await supabase
      .from("user_character")
      .update({ experience_current: currentExperience + 10 })
      .eq("profile_id", user.id);

    await supabase.from("user_inventory").insert({
      profile_id: user.id,
      quantity: 5,
      item_id: "ea5b9601-8a7d-4270-b5d9-cf292d49945e",
    });

    const { data: insertedWoodenStickRow } = await supabase
      .from("user_inventory")
      .insert({
        profile_id: user.id,
        quantity: 1,
        weapon_instance_id: 1,
      })
      .select("id")
      .single();

    if (insertedWoodenStickRow?.id) {
      await supabase.from("user_equipment").upsert(
        {
          profile_id: user.id,
          slot: "weapon",
          inventory_id: insertedWoodenStickRow.id,
        },
        { onConflict: "profile_id,slot" },
      );
    }
  }

  await supabase
    .from("user_milestones")
    .update({ intro_completed: true })
    .eq("user_id", user.id);
}
