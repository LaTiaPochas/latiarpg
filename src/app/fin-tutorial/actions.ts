"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type MarkTutorialCompletedResult = {
  ok: boolean;
  error?: string;
};

export async function markTutorialCompleted(): Promise<MarkTutorialCompletedResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Usuario no autenticado." };
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("user_milestones")
    .update({ tutorial_completed: true })
    .eq("user_id", user.id)
    .select("user_id");

  if (updateError) {
    return { ok: false, error: `No se pudo actualizar el tutorial: ${updateError.message}` };
  }

  if (!updatedRows || updatedRows.length === 0) {
    const { error: insertError } = await supabase.from("user_milestones").insert({
      user_id: user.id,
      tutorial_completed: true,
    });
    if (insertError) {
      return { ok: false, error: `No se pudo crear milestones: ${insertError.message}` };
    }
  }

  revalidatePath("/fin-tutorial");
  revalidatePath("/class-selection");
  return { ok: true };
}
