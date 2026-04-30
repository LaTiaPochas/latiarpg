import Image from "next/image";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { ZoneMapModalRouter } from "@/components/maps/zone-map-modal-router";
import { WorldEventJournal } from "@/components/home/world-event-journal";
import { createClient } from "@/lib/supabase/server";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const homeFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type HomePageProps = {
  searchParams: Promise<{ zone?: string }>;
};

type CampDialogueOption = {
  faceSrc: string;
  speaker: string;
  text: string;
};

const CAMP_RETURN_DIALOGUES: CampDialogueOption[] = [
  {
    faceSrc: "/img/resources/caracters_faces/pj_checho_rpg_face.png",
    speaker: "Checho",
    text: "PIIIIIIIROOOOOOKAAAAAAAAA",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_chane_rpg_face.png",
    speaker: "Chane",
    text: "Ya hice el diseño industrial de como tenemos que construir la base, espero que consigamos suficiente madera.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_leo_rpg_face.png",
    speaker: "Leo",
    text: "Bece nunca se va a dar cuenta que le estoy escondiendo la madera.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_nacho_rpg_face.png",
    speaker: "Nacho",
    text: "¿Se podrá fumar alguna de estas hierbas? *suspira* Vamos a bucar madera.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_delu_rpg_face.png",
    speaker: "Delu",
    text: "¿Si hago un pozo por acá cuando tardaran en encontrarme?",
  },
];

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const activeZoneId = params.zone;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: milestones } = user
    ? await supabase
        .from("user_milestones")
        .select("first_time_camp_entered")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const showFirstCampDialogue = milestones?.first_time_camp_entered === false;
  const returnCampDialogue = showFirstCampDialogue
    ? null
    : CAMP_RETURN_DIALOGUES[
        Math.floor(Math.random() * CAMP_RETURN_DIALOGUES.length)
      ];
  const { data: worldEvents } = await supabase
    .from("global_world_event_log")
    .select("id, happened_at, event_html")
    .order("happened_at", { ascending: false })
    .limit(100);

  return (
    <div
      className={`relative min-h-[100dvh] overflow-hidden bg-slate-950 px-4 pb-8 pt-3 text-amber-50 lg:px-6 lg:pt-6 ${homeFont.className}`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://wallpapercave.com/wp/wp12719000.jpg')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/35 via-slate-900/55 to-black/80" />

      <main className="relative mx-auto w-full max-w-4xl">
        <div
          className={`flex items-start gap-3 rounded-lg border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-1 lg:gap-4 lg:py-1 ${dialogueFont.className}`}
        >
          <div className="shrink-0 rounded-md border border-amber-900/70 bg-[#24130e] p-0">
            <Image
              src={returnCampDialogue?.faceSrc ?? "/img/resources/other_faces/neutral_events.png"}
              alt={returnCampDialogue?.speaker ?? "Silva"}
              width={92}
              height={92}
              className="h-[52px] w-[52px] rounded-md object-cover lg:h-[72px] lg:w-[72px]"
              priority
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-relaxed text-slate-900/95 lg:text-sm lg: my-1">
              {showFirstCampDialogue ? (
                <i>
                  “It's a dangerous business going out your door. You step onto the road, and if you don't keep your feet,
                  there's no knowing where you might be swept off to.”
                </i>
              ) : (
                <i>{returnCampDialogue?.text}</i>
              )}
            </p>
          </div>
        </div>
        <ZoneMapModalRouter zoneId={activeZoneId} restrictToCamp={showFirstCampDialogue} />
        <section className="mt-3 rounded-lg border border-amber-900/70 bg-[#1a100c]/85 p-3 shadow-[0_0_20px_rgba(0,0,0,0.3)] lg:p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-300">
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
