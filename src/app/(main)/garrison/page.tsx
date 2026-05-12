import Image from "next/image";
import Link from "next/link";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { GarrisonMap } from "@/components/maps/garrison-map";
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

type GarrisonQuoteOption = {
  faceSrc: string;
  speaker: string;
  text: string;
};

const GARRISON_QUOTES: GarrisonQuoteOption[] = [
  {
    faceSrc: "/img/resources/caracters_faces/pj_fede_rpg_face.png",
    speaker: "Fede",
    text: "Lindo lugar para descansar construimos. ¿Que bichito me dropeará una Guiness?.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_nacho_rpg_face.png",
    speaker: "Nacho",
    text: "*Se agacha frente a la fogata y acerca su pipa*. Lo bueno de este juego es que nunca me quedo sin tabaco.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_silva_rpg_face.png",
    speaker: "Silva",
    text: "Delu, Perdiste.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_leo_rpg_face.png",
    speaker: "Leo",
    text: "NIIII NUUUUU NIIIII NUUUU UUUUUUU UUUUUU UUUUUU A A A A A.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_checho_rpg_face.png",
    speaker: "Checho",
    text: "MIBOOOOMBO.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_mati_rpg_face.png",
    speaker: "Mati",
    text: "Que satisfactorio es ver este mundo cobrando vida.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_becho_rpg_face.png",
    speaker: "Becho",
    text: "Niuuuuuuuuum.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_chane_rpg_face.png",
    speaker: "Chane",
    text: "Habría que ver si esos lobos son comestibles.",
  },
];

export default async function GarrisonPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  const { data: worldEvents } = await supabase
    .from("global_world_event_log")
    .select("id, happened_at, event_html")
    .order("happened_at", { ascending: false })
    .limit(50);
  const { data: warehouseMilestone } = await supabase
    .from("global_milestones")
    .select("id, title, is_completed")
    .eq("id", 2)
    .maybeSingle();
  const showWarehouseSprite =
    warehouseMilestone?.id === 2 &&
    warehouseMilestone?.is_completed === true &&
    typeof warehouseMilestone?.title === "string" &&
    warehouseMilestone.title.trim().toLowerCase() === "warehouse_construido";
  const { data: relaxingWatersMilestone } = await supabase
    .from("global_milestones")
    .select("title, is_completed")
    .eq("title", "aguas_termales_completadas")
    .eq("is_completed", true)
    .maybeSingle();
  const showRelaxingWatersSprite =
    typeof relaxingWatersMilestone?.title === "string" &&
    relaxingWatersMilestone.title.trim().toLowerCase() === "aguas_termales_completadas" &&
    relaxingWatersMilestone.is_completed === true;
  const { data: craftingBenchMilestone } = await supabase
    .from("global_milestones")
    .select("title, is_completed")
    .eq("title", "crafting_bench_completed")
    .maybeSingle();
  const isCraftingBenchCompleted =
    typeof craftingBenchMilestone?.title === "string" &&
    craftingBenchMilestone.title.trim().toLowerCase() === "crafting_bench_completed" &&
    craftingBenchMilestone.is_completed === true;
  const showAdvancedHotspots = showWarehouseSprite && showRelaxingWatersSprite;
  const randomQuote = GARRISON_QUOTES[Math.floor(Math.random() * GARRISON_QUOTES.length)];

  return (
    <div
      className={`relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-slate-950 px-4 pb-8 pt-4 text-amber-50 lg:px-6 lg:pt-6 ${homeFont.className}`}
      style={{
        backgroundImage: "url('https://wallpapercave.com/wp/wp12719000.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-900/70 to-black/90" />
      <main className="relative mx-auto w-full max-w-4xl">
        <div
          className={`mb-3 flex items-start gap-3 rounded-lg border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-1 lg:gap-4 lg:py-1 ${dialogueFont.className}`}
        >
          <div className="shrink-0 rounded-md border border-amber-900/70 bg-[#24130e] p-0">
            <Image
              src={randomQuote.faceSrc}
              alt={randomQuote.speaker}
              width={92}
              height={92}
              className="h-[52px] w-[52px] rounded-md object-cover lg:h-[72px] lg:w-[72px]"
              priority
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-relaxed text-slate-900/95 lg:text-sm lg:my-1">
              <i>{randomQuote.text}</i>
            </p>
          </div>
        </div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <h1 className="text-sm font-semibold uppercase tracking-wide text-amber-300">Base de La Tia</h1>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-800/70 bg-[#1a100c]/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:bg-[#24130e]"
          >
            <span className="text-base leading-none" aria-hidden>
              ←
            </span>
            Zona Inicial
          </Link>
        </div>

        <section className="rounded-lg border border-amber-900/70 bg-[#1a100c]/85 p-3 shadow-[0_0_20px_rgba(0,0,0,0.3)] lg:p-4">
          <GarrisonMap
            showWarehouseSprite={showWarehouseSprite}
            showRelaxingWatersSprite={showRelaxingWatersSprite}
            showAdvancedHotspots={showAdvancedHotspots}
            isCraftingBenchCompleted={isCraftingBenchCompleted}
          />
        </section>
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
