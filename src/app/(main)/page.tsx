import Image from "next/image";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { ZoneMapModalRouter } from "@/components/maps/zone-map-modal-router";
import { WorldEventJournal } from "@/components/home/world-event-journal";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
  {
    faceSrc: "/img/resources/caracters_faces/pj_silva_rpg_face.png",
    speaker: "Silva",
    text: "GAAAAAAAAH. ¿No se pueden poner las peleas en x1.5? *tos* *tos*",
  },
  {
    faceSrc: "/img/resources/other_faces/neutral_events.png",
    speaker: "World Events",
    text: "“It's a dangerous business going out your door. You step onto the road, and if you don't keep your feet, there's no knowing where you might be swept off to.”",
  },
  {
    faceSrc: "/img/resources/other_faces/neutral_events.png",
    speaker: "World Events",
    text: "“Not all those who wander are lost.”",
  },
  {
    faceSrc: "/img/resources/other_faces/neutral_events.png",
    speaker: "World Events",
    text: "“You've taken your first step into a larger world.”",
  },
  {
    faceSrc: "/img/resources/other_faces/neutral_events.png",
    speaker: "World Events",
    text: "“Roads? Where we're going, we don't need roads.”",
  },
  {
    faceSrc: "/img/resources/other_faces/neutral_events.png",
    speaker: "World Events",
    text: "“We are not in Kansas anymore.”",
  },
];

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const activeZoneId = params.zone;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("intro_completed, tutorial_completed, first_time_camp_entered")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!milestones?.intro_completed) {
    redirect("/introduccion");
  }

  if (!milestones?.tutorial_completed) {
    redirect("/fin-tutorial");
  }

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
  const { data: garrisonMilestone } = await supabase
    .from("global_milestones")
    .select("id, title, is_completed")
    .eq("id", 1)
    .maybeSingle();
  const initialZoneMapSrc =
    garrisonMilestone?.is_completed === true &&
    typeof garrisonMilestone.title === "string" &&
    ["campamento construido", "campamento_construido"].includes(
      garrisonMilestone.title.trim().toLowerCase(),
    )
      ? "/img/resources/maps/map_initialzone_garrison.png"
      : "/img/resources/maps/map_initialzone_campfire.png";
  const isCampBuilt =
    garrisonMilestone?.is_completed === true &&
    typeof garrisonMilestone.title === "string" &&
    ["campamento construido", "campamento_construido"].includes(
      garrisonMilestone.title.trim().toLowerCase(),
    );

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
        <ZoneMapModalRouter
          zoneId={activeZoneId}
          restrictToCamp={showFirstCampDialogue}
          mapSrc={initialZoneMapSrc}
          isCampBuilt={isCampBuilt}
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
