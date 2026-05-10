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

/** `player_skills.id` / `user_character_skills.player_skill_id` pueden ser UUID (string) o legado int. */
function normalizePlayerSkillId(raw: unknown): string | null {
  if (typeof raw === "string") {
    const t = raw.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  return null;
}

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

  // Asigna habilidades base de la clase solo una vez (idempotente por skill).
  const isDev = process.env.NODE_ENV === "development";
  const classSkillsSelect = isDev
    ? "id, code, name, unlock_level, is_active, class_id"
    : "id";

  const { data: classSkillsRaw, error: classSkillsError } = await supabase
    .from("player_skills")
    .select(classSkillsSelect)
    .eq("class_id", classId);

  const classSkills = classSkillsRaw as
    | Array<{ id?: number | string }>
    | null
    | undefined;

  if (classSkillsError) {
    return { ok: false, error: "No se pudieron leer las habilidades de la clase." };
  }

  const classSkillIds = (classSkills ?? [])
    .map((row) => normalizePlayerSkillId(row.id))
    .filter((value): value is string => value !== null);

  if (isDev) {
    const rowsWithInvalidId = (classSkills ?? []).filter((row) => normalizePlayerSkillId(row.id) === null);
    console.log("[class-selection] skills from player_skills for chosen class:", {
      classId,
      queryRowCount: classSkills?.length ?? 0,
      skillIdsUsedForInsert: classSkillIds,
      rowsWithInvalidId: rowsWithInvalidId.length ? rowsWithInvalidId : undefined,
      ...(classSkills && classSkills.length > 0 ? { preview: classSkills } : {}),
    });
    if ((classSkills?.length ?? 0) === 0) {
      console.warn(
        "[class-selection] ninguna fila en player_skills con class_id =",
        classId,
        "→ no se insertará nada en user_character_skills.",
      );
    }
  }

  if (classSkillIds.length > 0) {
    const { data: existingCharacterSkills, error: existingCharacterSkillsError } = await supabase
      .from("user_character_skills")
      .select("player_skill_id")
      .eq("profile_id", user.id);

    if (existingCharacterSkillsError) {
      return { ok: false, error: "No se pudieron leer las habilidades del personaje." };
    }

    const existingSkillIds = new Set(
      (existingCharacterSkills ?? [])
        .map((row) => normalizePlayerSkillId(row.player_skill_id))
        .filter((value): value is string => value !== null),
    );

    const missingSkillRows = classSkillIds
      .filter((skillId) => !existingSkillIds.has(skillId))
      .map((skillId) => ({
        profile_id: user.id,
        player_skill_id: skillId,
      }));

    if (isDev) {
      console.log("[class-selection] merge into user_character_skills:", {
        alreadyHad: [...existingSkillIds].sort(),
        insertedNow: missingSkillRows.map((r) => r.player_skill_id),
        skippedAlreadyPresent: classSkillIds.filter((id) => existingSkillIds.has(id)),
      });
    }

    if (missingSkillRows.length > 0) {
      const { error: insertCharacterSkillsError } = await supabase
        .from("user_character_skills")
        .insert(missingSkillRows);

      if (insertCharacterSkillsError) {
        if (isDev) {
          console.error("[class-selection] insert user_character_skills failed:", insertCharacterSkillsError);
        }
        return { ok: false, error: "No se pudieron asignar las habilidades iniciales de la clase." };
      }
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
