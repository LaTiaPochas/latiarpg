"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function completeCaveEntranceDialog() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: updatedRows } = await supabase
    .from("user_milestones")
    .update({ cave_entrance_dialog: true })
    .eq("user_id", user.id)
    .select("user_id");

  if (!updatedRows || updatedRows.length === 0) {
    await supabase.from("user_milestones").insert({
      user_id: user.id,
      cave_entrance_dialog: true,
    });
  }
}
