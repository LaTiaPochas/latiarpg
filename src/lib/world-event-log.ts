import type { createClient } from "@/lib/supabase/server";

/** Cliente Supabase server-side ya inicializado (resultado de `createClient()` en `lib/supabase/server`). */
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type WorldEventLogPayload = {
  happened_at?: string;
  member_name: string;
  event_html: string;
};

const TEST_MEMBER_NAME = "test";

/**
 * Columnas posibles de `user_profiles` que enlazan con `auth.users.id`.
 * Distintas instalaciones del proyecto usan diferentes esquemas; probamos
 * las tres en orden y nos quedamos con cualquier match (ver el patrón
 * análogo en `loadCombatUserCharacter` dentro de `combate/[code]/page.tsx`).
 */
const USER_PROFILE_AUTH_COLUMNS = ["id", "user_id", "auth_user_id"] as const;

async function isTestMember(
  supabase: ServerSupabaseClient,
  authUserId: string,
): Promise<boolean> {
  for (const column of USER_PROFILE_AUTH_COLUMNS) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("miembro")
      .eq(column, authUserId)
      .maybeSingle<{ miembro: string | null }>();

    // `42703` = columna inexistente en este esquema; probamos la siguiente.
    if (error && error.code !== "42703") continue;
    if (!data) continue;

    const miembroRaw =
      typeof data.miembro === "string" ? data.miembro.trim().toLowerCase() : "";
    if (miembroRaw === TEST_MEMBER_NAME) return true;
  }
  return false;
}

/**
 * Inserta un evento en `global_world_event_log`, salvo que el usuario
 * que lo dispara sea un miembro de prueba (`user_profiles.miembro = 'test'`,
 * comparación case-insensitive y con trim).
 *
 * Pasar `authUserId = null` cuando el evento no tenga un usuario disparador
 * identificable (en cuyo caso se inserta siempre).
 *
 * Centraliza la regla anti-spam del journal para que cualquier nuevo lugar
 * que registre eventos use este helper en vez de insertar directo.
 */
export async function insertWorldEventLog(
  supabase: ServerSupabaseClient,
  authUserId: string | null | undefined,
  payload: WorldEventLogPayload,
): Promise<void> {
  if (authUserId && (await isTestMember(supabase, authUserId))) return;
  await supabase.from("global_world_event_log").insert(payload);
}
