import Link from "next/link";
import { HiddenForestMap } from "@/components/maps/hidden-forest-map";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function BosqueInexploradoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: progressRow } = await supabase
    .from("user_combat_progress")
    .select("combat_step")
    .eq("user_id", user.id)
    .eq("zone_id", "hidden_forest_1")
    .order("combat_step", { ascending: false })
    .limit(1)
    .maybeSingle();
  const currentCombatStep =
    typeof progressRow?.combat_step === "number" && progressRow.combat_step > 0
      ? progressRow.combat_step
      : 1;

  return (
    <div
      className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-slate-950 px-4 pb-8 pt-4 text-amber-50 lg:px-6 lg:pt-6"
      style={{
        backgroundImage: "url('https://wallpapercave.com/wp/wp12719000.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-900/70 to-black/90" />
      <main className="relative mx-auto w-full max-w-4xl">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h1 className="text-sm font-semibold uppercase tracking-wide text-amber-300">Bosque inexplorado</h1>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-800/70 bg-[#1a100c]/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:bg-[#24130e]"
          >
            <span className="text-base leading-none" aria-hidden>
              ←
            </span>
            Volver al campamento
          </Link>
        </div>
        <HiddenForestMap currentCombatStep={currentCombatStep} />
      </main>
    </div>
  );
}
