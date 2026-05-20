import Image from "next/image";
import Link from "next/link";
import { Libre_Baskerville, Montserrat } from "next/font/google";

import { MysticCaveMap } from "@/components/maps/mystic-cave-map";
import { WorldEventJournal } from "@/components/home/world-event-journal";
import {
  MYSTIC_CAVE_PLACEHOLDER_DIALOGUES,
  mysticCaveDialoguePortraitAlt,
} from "@/lib/mystic-cave-placeholders";
import { MYSTIC_CAVE_ZONE_CODE } from "@/lib/game-zones";
import { getUserCombatStepForZone } from "@/lib/user-combat-progress";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const pageFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type MysticCavePageProps = {
  searchParams?: Promise<{ hotspot?: string }>;
};

export const metadata = {
  title: "Cueva mística",
};

export default async function MysticCavePage({ searchParams }: MysticCavePageProps) {
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
    .select("cave_entrance_dialog, meloni_found_cave")
    .eq("user_id", user.id)
    .maybeSingle();

  if (milestones?.cave_entrance_dialog !== true) {
    redirect("/bosque-inexplorado?hotspot=cave-entrance");
  }

  const currentCombatStep = await getUserCombatStepForZone(supabase, user.id, MYSTIC_CAVE_ZONE_CODE);

  const { data: worldEvents } = await supabase
    .from("global_world_event_log")
    .select("id, happened_at, event_html")
    .order("happened_at", { ascending: false })
    .limit(50);

  const randomDialogue =
    MYSTIC_CAVE_PLACEHOLDER_DIALOGUES.length > 0
      ? MYSTIC_CAVE_PLACEHOLDER_DIALOGUES[
          Math.floor(Math.random() * MYSTIC_CAVE_PLACEHOLDER_DIALOGUES.length)
        ]
      : null;

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
        {randomDialogue ? (
          <div
            className={`mb-3 flex items-start gap-3 rounded-lg border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-1 lg:gap-4 lg:py-1 ${dialogueFont.className}`}
          >
            <div className="shrink-0 rounded-md border border-amber-900/70 bg-[#24130e] p-0">
              <Image
                src={randomDialogue.faceSrc}
                alt={mysticCaveDialoguePortraitAlt(randomDialogue.faceSrc, randomDialogue.speaker)}
                width={92}
                height={92}
                className="h-[52px] w-[52px] rounded-md object-cover lg:h-[72px] lg:w-[72px]"
                priority
              />
            </div>
            <div className="min-w-0 flex-1">
              {randomDialogue.speaker?.trim() ? (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                  {randomDialogue.speaker}
                </p>
              ) : null}
              <p className="text-xs leading-relaxed text-slate-900/95 lg:text-sm lg:my-1">
                <i>{randomDialogue.text}</i>
              </p>
            </div>
          </div>
        ) : null}

        <div className="mb-1 flex items-center justify-between gap-3">
          <h1 className="text-sm font-semibold uppercase tracking-wide text-amber-300">Cueva mística</h1>
          <Link
            href="/bosque-inexplorado?hotspot=cave-entrance"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-800/70 bg-[#1a100c]/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:bg-[#24130e]"
          >
            <span className="text-base leading-none" aria-hidden>
              ←
            </span>
            Bosque inexplorado
          </Link>
        </div>

        <MysticCaveMap
          currentCombatStep={currentCombatStep}
          zoneCode={MYSTIC_CAVE_ZONE_CODE}
          initialHotspotId={hotspotQuery}
          meloniFoundCave={milestones?.meloni_found_cave === true}
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
