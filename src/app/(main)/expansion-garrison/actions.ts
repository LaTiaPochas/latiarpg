"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

const EXPANSION_PATH = "/expansion-garrison";

export async function completeGarrisonLevel2Dialog() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const };
  }

  const { data: updatedRows } = await supabase
    .from("user_milestones")
    .update({ garrison_level2_dialog: true })
    .eq("user_id", user.id)
    .select("user_id");

  if (!updatedRows || updatedRows.length === 0) {
    await supabase.from("user_milestones").insert({
      user_id: user.id,
      garrison_level2_dialog: true,
    });
  }

  revalidatePath(EXPANSION_PATH);
  return { ok: true as const };
}
