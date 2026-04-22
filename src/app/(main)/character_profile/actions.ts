"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type AllocationPayload = {
  str: number;
  dex: number;
  int: number;
  wis: number;
};

function sanitizeAllocation(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

export async function confirmStatAllocation(payload: AllocationPayload) {
  const strAlloc = sanitizeAllocation(payload.str);
  const dexAlloc = sanitizeAllocation(payload.dex);
  const intAlloc = sanitizeAllocation(payload.int);
  const wisAlloc = sanitizeAllocation(payload.wis);

  const pointsSpent = strAlloc + dexAlloc + intAlloc + wisAlloc;
  if (pointsSpent <= 0) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario no autenticado.");
  }

  const { data: currentCharacter, error: readError } = await supabase
    .from("characters")
    .select("str, dex, int, wis, stat_points_remaining")
    .eq("profile_id", user.id)
    .single();

  if (readError || !currentCharacter) {
    throw new Error("No se pudo leer el personaje.");
  }

  if (pointsSpent > currentCharacter.stat_points_remaining) {
    throw new Error("No hay suficientes puntos disponibles.");
  }

  const { error: updateError } = await supabase
    .from("characters")
    .update({
      str: currentCharacter.str + strAlloc,
      dex: currentCharacter.dex + dexAlloc,
      int: currentCharacter.int + intAlloc,
      wis: currentCharacter.wis + wisAlloc,
      stat_points_remaining: currentCharacter.stat_points_remaining - pointsSpent,
    })
    .eq("profile_id", user.id);

  if (updateError) {
    throw new Error("No se pudo guardar la subida de nivel.");
  }

  revalidatePath("/character_profile");
}
