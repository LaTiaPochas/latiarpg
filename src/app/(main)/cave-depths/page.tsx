import Link from "next/link";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { redirect } from "next/navigation";

import { reconcileDepthsBridgeProgress } from "@/app/(main)/cave-depths/actions";
import { CaveDepthsMap } from "@/components/maps/cave-depths-map";
import { WorldEventJournal } from "@/components/home/world-event-journal";
import { CAVE_DEPTHS_ZONE_CODE } from "@/lib/game-zones";
import { getUserCombatStepForZone } from "@/lib/user-combat-progress";
import { createClient } from "@/lib/supabase/server";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const pageFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type CaveDepthsPageProps = {
  searchParams?: Promise<{ hotspot?: string }>;
};

export const metadata = {
  title: "Profundidades de la cueva",
};

export default async function CaveDepthsPage({ searchParams }: CaveDepthsPageProps) {
  const resolvedSearch = searchParams ? await searchParams : {};
  const hotspotQuery =
    typeof resolvedSearch?.hotspot === "string" && resolvedSearch.hotspot.trim().length > 0
      ? resolvedSearch.hotspot.trim()
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("cave_entrance_dialog, depths_bridge_dialog")
    .eq("user_id", user.id)
    .maybeSingle();

  if (milestones?.cave_entrance_dialog !== true) {
    redirect("/bosque-inexplorado?hotspot=cave-entrance");
  }

  if (milestones?.depths_bridge_dialog === true) {
    await reconcileDepthsBridgeProgress();
  }

  const currentCombatStep = await getUserCombatStepForZone(
    supabase,
    user.id,
    CAVE_DEPTHS_ZONE_CODE,
  );

  const { data: worldEvents } = await supabase
    .from("global_world_event_log")
    .select("id, happened_at, event_html")
    .order("happened_at", { ascending: false })
    .limit(50);

  return (
    <div
      className={`relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-slate-950 px-4 pb-8 pt-4 text-amber-50 lg:px-6 lg:pt-6 ${pageFont.className}`}
      style={{
        backgroundImage: "url('https://wallpapercave.com/wp/wp12719000.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-900/70 to-black/90" />
      <main className="relative mx-auto w-full max-w-4xl">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h1 className="text-sm font-semibold uppercase tracking-wide text-amber-300">
            Las Profundidades
          </h1>
          <Link
            href="/mystic-cave?hotspot=cave-node-10"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-800/70 bg-[#1a100c]/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:bg-[#24130e]"
          >
            <span className="text-base leading-none" aria-hidden>
              ←
            </span>
            Volver
          </Link>
        </div>

        <CaveDepthsMap
          currentCombatStep={currentCombatStep}
          zoneCode={CAVE_DEPTHS_ZONE_CODE}
          initialHotspotId={hotspotQuery}
          depthsBridgeDialogCompleted={milestones?.depths_bridge_dialog === true}
        />

        <section className="mt-3 rounded-lg border border-amber-900/70 bg-[#1a100c]/85 p-3 shadow-[0_0_20px_rgba(0,0,0,0.3)] lg:p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-300 lg:text-sm">
            Journal de La Tia
          </h2>
          <div className={dialogueFont.className}>
            <WorldEventJournal events={worldEvents ?? []} />
          </div>
        </section>
      </main>
    </div>
  );
}
