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
  variant?: "default" | "golden";
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

const MELONI_GARRISON_QUOTE: GarrisonQuoteOption = {
  faceSrc: "/img/resources/caracters_faces/pj_chane_rpg_face.png",
  speaker: "Meloni",
  text: "A Meloni le encantaban las galletas de la fortuna que comprabamos en el barrio chino.",
  variant: "golden",
};

function pickRandomGarrisonQuote(
  meloniFoundCave: boolean,
  meloniGalletaGiven: boolean,
): GarrisonQuoteOption {
  const includeGoldenMeloniQuote = meloniFoundCave && !meloniGalletaGiven;
  const pool = includeGoldenMeloniQuote
    ? [...GARRISON_QUOTES, MELONI_GARRISON_QUOTE]
    : GARRISON_QUOTES;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function globalMilestoneLooksComplete(row: {
  is_completed: boolean | null;
  current_value?: unknown;
  target_value?: unknown;
} | null | undefined): boolean {
  if (!row) return false;
  if (row.is_completed === true) return true;
  const current = Math.max(0, Math.trunc(Number(row.current_value ?? 0)));
  const target = Math.max(1, Math.trunc(Number(row.target_value ?? 1)));
  return current >= target;
}

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
  const soulAltarMaterialTitles = ["soul_altar_piedra", "soul_altar_oro", "soul_altar_souls"];
  const { data: soulAltarCompletedMilestone } = await supabase
    .from("global_milestones")
    .select("title, is_completed, current_value, target_value")
    .eq("title", "soul_altar_completed")
    .maybeSingle();
  const soulAltarCompletedTitleMatches =
    typeof soulAltarCompletedMilestone?.title === "string" &&
    soulAltarCompletedMilestone.title.trim().toLowerCase() === "soul_altar_completed";
  const isSoulAltarCompletedByGlobalRow =
    soulAltarCompletedTitleMatches &&
    globalMilestoneLooksComplete(soulAltarCompletedMilestone);
  const { data: soulAltarMilestones } = await supabase
    .from("global_milestones")
    .select("title, is_completed, current_value, target_value")
    .in("title", soulAltarMaterialTitles);
  const areSoulAltarMaterialsCompleted =
    soulAltarMaterialTitles.length > 0 &&
    soulAltarMaterialTitles.every((title) => {
      const row = (soulAltarMilestones ?? []).find(
        (entry) => typeof entry.title === "string" && entry.title.trim().toLowerCase() === title,
      );
      return globalMilestoneLooksComplete(row);
    });
  const isSoulAltarCompleted = isSoulAltarCompletedByGlobalRow || areSoulAltarMaterialsCompleted;
  const showAdvancedHotspots = showWarehouseSprite && showRelaxingWatersSprite;
  const { data: garrisonLevel2CompletedMilestone } = await supabase
    .from("global_milestones")
    .select("title, is_completed")
    .eq("title", "garrison_level2_completed")
    .maybeSingle();
  const isGarrisonLevel2Completed =
    typeof garrisonLevel2CompletedMilestone?.title === "string" &&
    garrisonLevel2CompletedMilestone.title.trim().toLowerCase() === "garrison_level2_completed" &&
    garrisonLevel2CompletedMilestone.is_completed === true;
  const { data: loremasterCompletedMilestone } = await supabase
    .from("global_milestones")
    .select("title, is_completed")
    .eq("title", "loremaster_completed")
    .maybeSingle();
  const isBibliotecaCompleted =
    typeof loremasterCompletedMilestone?.title === "string" &&
    loremasterCompletedMilestone.title.trim().toLowerCase() === "loremaster_completed" &&
    loremasterCompletedMilestone.is_completed === true;
  const { data: userMilestones } = await supabase
    .from("user_milestones")
    .select("meloni_found_cave")
    .eq("user_id", user.id)
    .maybeSingle();
  const meloniFoundCave = userMilestones?.meloni_found_cave === true;
  const { data: meloniGalletaMilestone } = await supabase
    .from("global_milestones")
    .select("title, is_completed")
    .eq("title", "meloni_galleta_given")
    .maybeSingle();
  const meloniGalletaGiven =
    typeof meloniGalletaMilestone?.title === "string" &&
    meloniGalletaMilestone.title.trim().toLowerCase() === "meloni_galleta_given" &&
    meloniGalletaMilestone.is_completed === true;
  const randomQuote = pickRandomGarrisonQuote(meloniFoundCave, meloniGalletaGiven);
  const isGoldenQuote = randomQuote.variant === "golden";

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
          className={`mb-3 flex items-start gap-3 rounded-lg border p-1 lg:gap-4 lg:py-1 ${dialogueFont.className} ${
            isGoldenQuote
              ? "border-2 border-[#ffd700] bg-gradient-to-br from-[#fff176] via-[#ffc107] to-[#b8860b] shadow-[0_0_24px_rgba(255,215,0,0.75),0_0_48px_rgba(218,165,32,0.45),inset_0_2px_0_rgba(255,248,200,0.85)] ring-2 ring-[#fff59d]/70"
              : "border-[#9f8352]/80 bg-[#d8c7a2]/92"
          }`}
        >
          <div
            className={`shrink-0 rounded-md border p-0 ${
              isGoldenQuote
                ? "border-2 border-[#ffeb3b] bg-gradient-to-b from-[#5c4a00] to-[#1a1400] shadow-[0_0_16px_rgba(255,215,0,0.65)]"
                : "border-amber-900/70 bg-[#24130e]"
            }`}
          >
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
            <p
              className={`text-xs leading-relaxed lg:text-sm lg:my-1 ${
                isGoldenQuote
                  ? "font-semibold text-[#3d2600] drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]"
                  : "text-slate-900/95"
              }`}
            >
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
            showMeloniSprite={meloniGalletaGiven}
            isCraftingBenchCompleted={isCraftingBenchCompleted}
            isSoulAltarCompleted={isSoulAltarCompleted}
            isGarrisonLevel2Completed={isGarrisonLevel2Completed}
            isBibliotecaCompleted={isBibliotecaCompleted}
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
