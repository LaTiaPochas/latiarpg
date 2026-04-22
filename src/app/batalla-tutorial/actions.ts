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

  await supabase
    .from("user_milestones")
    .update({ intro_completed: true })
    .eq("user_id", user.id);
}
