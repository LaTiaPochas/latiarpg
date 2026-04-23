"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SelectClassResult = {
  ok: boolean;
  error?: string;
};

type CompleteClassSelectionResult = {
  ok: boolean;
  error?: string;
};

export async function selectClass(classId: string): Promise<SelectClassResult> {
  if (!classId) {
    return { ok: false, error: "Clase invalida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Usuario no autenticado." };
  }

  const { data: existingClass, error: classReadError } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .maybeSingle();

  if (classReadError || !existingClass) {
    return { ok: false, error: "La clase seleccionada no existe." };
  }

  const { data: currentCharacter, error: characterReadError } = await supabase
    .from("user_character")
    .select("profile_id, class_name")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (characterReadError) {
    return { ok: false, error: "No se pudo leer el personaje." };
  }

  if (currentCharacter?.class_name) {
    return { ok: false, error: "La clase ya fue seleccionada y no puede cambiarse." };
  }

  if (currentCharacter) {
    const { error: updateError } = await supabase
      .from("user_character")
      .update({ class_name: classId })
      .eq("profile_id", user.id);

    if (updateError) {
      return { ok: false, error: "No se pudo guardar la clase." };
    }
  } else {
    const { error: insertError } = await supabase
      .from("user_character")
      .insert({ profile_id: user.id, class_name: classId });

    if (insertError) {
      return { ok: false, error: "No se pudo crear el personaje con clase." };
    }
  }

  revalidatePath("/class-selection");
  revalidatePath("/character_profile");
  return { ok: true };
}

export async function completeClassSelection(): Promise<CompleteClassSelectionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Usuario no autenticado." };
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("user_milestones")
    .update({ class_selected: true })
    .eq("user_id", user.id)
    .select("user_id");

  if (updateError) {
    return {
      ok: false,
      error: `No se pudo completar el tutorial (update): ${updateError.message}`,
    };
  }

  if (!updatedRows || updatedRows.length === 0) {
    const { error: insertError } = await supabase.from("user_milestones").insert({
      user_id: user.id,
      class_selected: true,
    });

    if (insertError) {
      return {
        ok: false,
        error: `No se pudo completar el tutorial (insert): ${insertError.message}`,
      };
    }
  }

  revalidatePath("/");
  revalidatePath("/class-selection");
  revalidatePath("/character_profile");
  return { ok: true };
}
