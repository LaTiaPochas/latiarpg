import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tabla en Supabase (crear una vez):
 *
 * create table public.user_daily_boss_defeats (
 *   id bigint generated always as identity primary key,
 *   user_id uuid not null references auth.users(id) on delete cascade,
 *   encounter_code text not null,
 *   defeated_on date not null,
 *   created_at timestamptz not null default now(),
 *   unique (user_id, encounter_code, defeated_on)
 * );
 * alter table public.user_daily_boss_defeats enable row level security;
 * create policy "own daily boss rows" on public.user_daily_boss_defeats
 *   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
 */

export const MYSTIC_CAVE_DAILY_BOSS_ENCOUNTER_CODE = "cave-node-9";
export const BOSQUE_INEXPLORADO_DAILY_BOSS_ENCOUNTER_CODE = "forest-advance";

export const DAILY_BOSS_ALREADY_DEFEATED_MESSAGE =
  "Ya derrotaste a este jefe hoy. Volvé mañana para intentarlo de nuevo.";

const DAILY_BOSS_ENCOUNTER_CODES = new Set<string>([MYSTIC_CAVE_DAILY_BOSS_ENCOUNTER_CODE, BOSQUE_INEXPLORADO_DAILY_BOSS_ENCOUNTER_CODE]);

const DAILY_BOSS_DEFEATS_TABLE = "user_daily_boss_defeats";

/** Fecha calendario (YYYY-MM-DD) para el reset diario del jefe. */
export function getDailyBossCalendarDateKey(
  timeZone = "America/Argentina/Buenos_Aires",
): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function isDailyBossLimitedEncounterCode(encounterCode: string): boolean {
  return DAILY_BOSS_ENCOUNTER_CODES.has(encounterCode.trim().toLowerCase());
}

export async function hasUserDefeatedDailyBossToday(
  supabase: SupabaseClient,
  userId: string,
  encounterCode: string,
): Promise<boolean> {
  if (!isDailyBossLimitedEncounterCode(encounterCode)) return false;

  const defeatedOn = getDailyBossCalendarDateKey();
  const { data, error } = await supabase
    .from(DAILY_BOSS_DEFEATS_TABLE)
    .select("id")
    .eq("user_id", userId)
    .eq("encounter_code", encounterCode.trim().toLowerCase())
    .eq("defeated_on", defeatedOn)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[daily-boss] read failed:", error.message, error.code);
    }
    return false;
  }

  return data != null;
}

export async function recordUserDailyBossDefeat(
  supabase: SupabaseClient,
  userId: string,
  encounterCode: string,
): Promise<void> {
  if (!isDailyBossLimitedEncounterCode(encounterCode)) return;

  const normalizedCode = encounterCode.trim().toLowerCase();
  const defeatedOn = getDailyBossCalendarDateKey();

  const { error } = await supabase.from(DAILY_BOSS_DEFEATS_TABLE).upsert(
    {
      user_id: userId,
      encounter_code: normalizedCode,
      defeated_on: defeatedOn,
    },
    { onConflict: "user_id,encounter_code,defeated_on", ignoreDuplicates: true },
  );

  if (error && process.env.NODE_ENV === "development") {
    console.warn("[daily-boss] record failed:", error.message, error.code);
  }
}
