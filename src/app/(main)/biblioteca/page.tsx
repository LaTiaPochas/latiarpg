import type { Metadata } from "next";
import Image from "next/image";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { redirect } from "next/navigation";

import { GarrisonBackLink } from "@/components/camp/garrison-back-link";
import { WoodAmountSelector } from "@/components/campsite/wood-amount-selector";
import { BibliotecaCompletedPanel } from "@/components/biblioteca/biblioteca-completed-panel";
import { BibliotecaConstructionDialogue } from "@/components/biblioteca/biblioteca-construction-dialogue";
import { createClient } from "@/lib/supabase/server";
import { insertWorldEventLog } from "@/lib/world-event-log";

import { completeBibliotecaConstructionDialog } from "./actions";

const BIBLIOTECA_PATH = "/biblioteca";
const PAGE_BG = "/img/resources/background/bg_garrisonlvl2.png";

const RESILIENT_WOOD_ITEM_ID = "1f455cfd-aa9d-4569-a364-a3c50ddc2d28";
const ANIMAL_PELT_ITEM_ID = "4d46293a-c26b-4228-95c3-bd8a56e5864a";

const RESILIENT_WOOD_FALLBACK_ICON = "/img/resources/logos/logo_latia_rpg.png";
const ANIMAL_PELT_FALLBACK_ICON = "/img/resources/logos/logo_latia_rpg.png";

const LOREMASTER_RESILIENT_WOOD_MILESTONE = {
  title: "loremaster_madera_resistente",
  label: "Madera resistente necesaria:",
  materialLabel: "madera resistente",
  logLabel: "madera resistente",
  completedEvent: "¡Objetivo completado: Madera resistente para la Biblioteca!",
} as const;

const LOREMASTER_ANIMAL_PELT_MILESTONE = {
  title: "loremaster_animal_pelt",
  label: "Pieles necesarias:",
  materialLabel: "piel de animal",
  logLabel: "piel de animal",
  completedEvent: "¡Objetivo completado: Pieles para la Biblioteca!",
} as const;

const LOREMASTER_COMPLETED_MILESTONE = {
  title: "loremaster_completed",
  completedEvent: "¡Objetivo completado: Biblioteca del Loremaster!",
} as const;

const LOREMASTER_MATERIAL_TITLES = [
  LOREMASTER_RESILIENT_WOOD_MILESTONE.title,
  LOREMASTER_ANIMAL_PELT_MILESTONE.title,
] as const;

type LoremasterMaterialKind = "resilientWood" | "animalPelt";

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Biblioteca del Loremaster",
};

function num(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function resolvePlayerName(input: string | null | undefined, fallback: string) {
  const value = input?.trim();
  return value ? value : fallback;
}

function capitalizeFirst(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveItemIconPath(raw: string | null | undefined, fallback: string) {
  const value = raw?.trim();
  if (!value) return fallback;
  return value.startsWith("/") ? value : `/${value}`;
}

function milestoneProgress(
  row:
    | {
        current_value?: number | null;
        target_value?: number | null;
        is_completed?: boolean | null;
      }
    | null
    | undefined,
) {
  const current = Math.max(0, Math.trunc(num(row?.current_value, 0)));
  const target = Math.max(1, Math.trunc(num(row?.target_value, 1)));
  const percent = Math.min(100, Math.round((current / target) * 100));
  return {
    current,
    target,
    percent,
    isCompleted: row?.is_completed === true || current >= target,
  };
}

async function sumInventoryQuantity(profileId: string, itemId: string) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("user_inventory")
    .select("quantity")
    .eq("profile_id", profileId)
    .eq("item_id", itemId);
  return (rows ?? []).reduce(
    (total, row) => total + Math.max(0, Math.trunc(num(row.quantity, 0))),
    0,
  );
}

async function completeLoremasterIfMaterialsReady(
  supabaseAction: Awaited<ReturnType<typeof createClient>>,
  authUserId?: string | null,
) {
  const { data: materialMilestones } = await supabaseAction
    .from("global_milestones")
    .select("title, current_value, target_value, is_completed")
    .in("title", [...LOREMASTER_MATERIAL_TITLES]);

  const allMaterialsCompleted = LOREMASTER_MATERIAL_TITLES.every((title) => {
    const row = (materialMilestones ?? []).find((entry) => entry.title === title);
    if (!row) return false;
    const current = Math.max(0, Math.trunc(num(row.current_value, 0)));
    const target = Math.max(1, Math.trunc(num(row.target_value, 1)));
    return row.is_completed === true || current >= target;
  });

  if (!allMaterialsCompleted) {
    return false;
  }

  const { data: completedRows } = await supabaseAction
    .from("global_milestones")
    .update({
      current_value: 1,
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq("title", LOREMASTER_COMPLETED_MILESTONE.title)
    .or("is_completed.is.false,is_completed.is.null")
    .select("id");

  const completedNow = (completedRows?.length ?? 0) > 0;
  if (completedNow) {
    await insertWorldEventLog(supabaseAction, authUserId, {
      happened_at: new Date().toISOString(),
      member_name: "world",
      event_html: `<span style="color:#22c55e;font-weight:700;">${LOREMASTER_COMPLETED_MILESTONE.completedEvent}</span>`,
    });
  }

  return completedNow;
}

type LoremasterMaterialMilestone = {
  title: string;
  label: string;
  materialLabel: string;
  logLabel: string;
  completedEvent: string;
};

const LOREMASTER_MATERIAL_CONFIG: Record<
  LoremasterMaterialKind,
  {
    itemId: string;
    milestone: LoremasterMaterialMilestone;
    iconFallback: string;
    progressBarClass: string;
    specificStatColumn: "hard_wood_given" | "animal_pelt_given";
  }
> = {
  resilientWood: {
    itemId: RESILIENT_WOOD_ITEM_ID,
    milestone: LOREMASTER_RESILIENT_WOOD_MILESTONE,
    iconFallback: RESILIENT_WOOD_FALLBACK_ICON,
    progressBarClass: "bg-gradient-to-r from-lime-600 to-emerald-700",
    specificStatColumn: "hard_wood_given",
  },
  animalPelt: {
    itemId: ANIMAL_PELT_ITEM_ID,
    milestone: LOREMASTER_ANIMAL_PELT_MILESTONE,
    iconFallback: ANIMAL_PELT_FALLBACK_ICON,
    progressBarClass: "bg-gradient-to-r from-amber-700 to-orange-600",
    specificStatColumn: "animal_pelt_given",
  },
};

/** Suma el aporte en hard_wood_given o animal_pelt_given; materials_given lo recalcula el trigger en BD. */
async function applyBibliotecaContributionUserStats(
  supabaseAction: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  specificStatColumn: "hard_wood_given" | "animal_pelt_given",
  amountToApply: number,
) {
  const { data: currentStats } = await supabaseAction
    .from("user_stats")
    .select("user_id, hard_wood_given, animal_pelt_given")
    .eq("user_id", userId)
    .maybeSingle();

  const rawStat =
    specificStatColumn === "hard_wood_given"
      ? currentStats?.hard_wood_given
      : currentStats?.animal_pelt_given;
  const currentStatValue =
    typeof rawStat === "number" && Number.isFinite(rawStat)
      ? Math.max(0, Math.trunc(rawStat))
      : 0;
  const nextStatValue = currentStatValue + amountToApply;

  if (currentStats?.user_id) {
    await supabaseAction
      .from("user_stats")
      .update({ [specificStatColumn]: nextStatValue })
      .eq("user_id", userId);
    return;
  }

  await supabaseAction.from("user_stats").insert({
    user_id: userId,
    [specificStatColumn]: nextStatValue,
  });
}

function buildBibliotecaContributionEventHtml(input: {
  memberName: string;
  memberColor: string;
  amount: number;
  materialLabel: string;
  itemIconSrc: string;
}) {
  const safeMemberName = escapeHtml(input.memberName);
  const safeMemberColor = escapeHtml(input.memberColor);
  const safeMaterialLabel = escapeHtml(input.materialLabel);
  const safeItemIconSrc = escapeHtml(input.itemIconSrc);
  const itemIconHtml = `<img src="${safeItemIconSrc}" alt="" width="16" height="16" style="display:inline-block;vertical-align:text-bottom;height:16px;width:16px;margin:0 2px;" />`;

  return `<span style="color:${safeMemberColor}">${safeMemberName}</span> ha aportado ${input.amount} de ${safeMaterialLabel} ${itemIconHtml} para la construcción de la <strong>Biblioteca del Loremaster</strong>.`;
}

async function contributeLoremasterMaterial(amount: number, kind: LoremasterMaterialKind) {
  const parsedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (parsedAmount <= 0) {
    redirect(BIBLIOTECA_PATH);
  }

  const config = LOREMASTER_MATERIAL_CONFIG[kind];
  const supabaseAction = await createClient();
  const {
    data: { user: currentUser },
  } = await supabaseAction.auth.getUser();

  if (!currentUser) {
    redirect("/login");
  }

  const { data: inventoryRows } = await supabaseAction
    .from("user_inventory")
    .select("id, quantity")
    .eq("profile_id", currentUser.id)
    .eq("item_id", config.itemId)
    .order("id", { ascending: true });

  const availableAmount = (inventoryRows ?? []).reduce(
    (total, row) => total + Math.max(0, Math.trunc(num(row.quantity, 0))),
    0,
  );

  const { data: globalMilestone } = await supabaseAction
    .from("global_milestones")
    .select("id, current_value, target_value, is_completed")
    .eq("title", config.milestone.title)
    .maybeSingle();

  if (!globalMilestone) {
    redirect(BIBLIOTECA_PATH);
  }

  const currentGlobalValue = Math.max(0, Math.trunc(num(globalMilestone.current_value, 0)));
  const targetGlobalValue = Math.max(1, Math.trunc(num(globalMilestone.target_value, 1)));
  const remainingNeeded = Math.max(0, targetGlobalValue - currentGlobalValue);
  const amountToApply = Math.min(parsedAmount, availableAmount, remainingNeeded);
  if (amountToApply <= 0) {
    redirect(BIBLIOTECA_PATH);
  }

  let pendingDiscount = amountToApply;
  for (const row of inventoryRows ?? []) {
    if (pendingDiscount <= 0) break;
    const rowQty = Math.max(0, Math.trunc(num(row.quantity, 0)));
    if (rowQty <= 0) continue;
    const deduct = Math.min(rowQty, pendingDiscount);
    const nextQty = rowQty - deduct;
    if (nextQty <= 0) {
      await supabaseAction.from("user_inventory").delete().eq("id", row.id);
    } else {
      await supabaseAction.from("user_inventory").update({ quantity: nextQty }).eq("id", row.id);
    }
    pendingDiscount -= deduct;
  }

  const alreadyCompleted = globalMilestone.is_completed === true;
  const nextGlobalValue = currentGlobalValue + amountToApply;
  const shouldMarkCompleted = nextGlobalValue >= targetGlobalValue;

  await supabaseAction
    .from("global_milestones")
    .update({
      current_value: nextGlobalValue,
      is_completed: shouldMarkCompleted ? true : undefined,
      completed_at: shouldMarkCompleted && !alreadyCompleted ? new Date().toISOString() : undefined,
    })
    .eq("title", config.milestone.title);

  await applyBibliotecaContributionUserStats(
    supabaseAction,
    currentUser.id,
    config.specificStatColumn,
    amountToApply,
  );

  const { data: currentProfile } = await supabaseAction
    .from("user_profiles")
    .select("miembro, color")
    .eq("id", currentUser.id)
    .maybeSingle();
  const { data: currentCharacter } = await supabaseAction
    .from("user_character")
    .select("character_name")
    .eq("profile_id", currentUser.id)
    .maybeSingle();
  const fallbackCurrentName = currentUser.email?.split("@")[0] ?? "Aventurero";
  const memberName = capitalizeFirst(
    resolvePlayerName(
      currentCharacter?.character_name,
      resolvePlayerName(currentProfile?.miembro, fallbackCurrentName),
    ),
  );
  const memberColor = currentProfile?.color?.trim() || "#f8fafc";

  const { data: contributedItem } = await supabaseAction
    .from("items")
    .select("icon_path")
    .eq("id", config.itemId)
    .maybeSingle();
  const itemIconSrc = resolveItemIconPath(contributedItem?.icon_path, config.iconFallback);

  const eventHtml = buildBibliotecaContributionEventHtml({
    memberName,
    memberColor,
    amount: amountToApply,
    materialLabel: config.milestone.logLabel,
    itemIconSrc,
  });
  await insertWorldEventLog(supabaseAction, currentUser.id, {
    happened_at: new Date().toISOString(),
    member_name: memberName,
    event_html: eventHtml,
  });

  if (shouldMarkCompleted && !alreadyCompleted) {
    await insertWorldEventLog(supabaseAction, currentUser.id, {
      happened_at: new Date().toISOString(),
      member_name: "world",
      event_html: `<span style="color:#22c55e;font-weight:700;">${config.milestone.completedEvent}</span>`,
    });
  }

  await completeLoremasterIfMaterialsReady(supabaseAction, currentUser.id);

  redirect(BIBLIOTECA_PATH);
}

export default async function BibliotecaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await completeLoremasterIfMaterialsReady(supabase, user.id);

  const { data: loremasterCompletedMilestone } = await supabase
    .from("global_milestones")
    .select("is_completed")
    .eq("title", LOREMASTER_COMPLETED_MILESTONE.title)
    .maybeSingle();

  if (loremasterCompletedMilestone?.is_completed === true) {
    return <BibliotecaCompletedPanel uiFontClassName={uiFont.className} />;
  }

  const { data: userMilestones } = await supabase
    .from("user_milestones")
    .select("biblioteca_construction_dialog")
    .eq("user_id", user.id)
    .maybeSingle();

  const bibliotecaConstructionDialogSeen = userMilestones?.biblioteca_construction_dialog === true;

  if (!bibliotecaConstructionDialogSeen) {
    return <BibliotecaConstructionDialogue onComplete={completeBibliotecaConstructionDialog} />;
  }

  const { data: materialMilestones } = await supabase
    .from("global_milestones")
    .select("title, current_value, target_value, is_completed")
    .in("title", [...LOREMASTER_MATERIAL_TITLES]);

  const resilientWoodMilestoneRow = materialMilestones?.find(
    (row) => row.title === LOREMASTER_RESILIENT_WOOD_MILESTONE.title,
  );
  const animalPeltMilestoneRow = materialMilestones?.find(
    (row) => row.title === LOREMASTER_ANIMAL_PELT_MILESTONE.title,
  );

  const resilientWoodProgress = milestoneProgress(resilientWoodMilestoneRow);
  const animalPeltProgress = milestoneProgress(animalPeltMilestoneRow);

  const materialsComplete = resilientWoodProgress.isCompleted && animalPeltProgress.isCompleted;

  const [
    userResilientWoodQuantity,
    userAnimalPeltQuantity,
    { data: resilientWoodItem },
    { data: animalPeltItem },
  ] = await Promise.all([
    sumInventoryQuantity(user.id, RESILIENT_WOOD_ITEM_ID),
    sumInventoryQuantity(user.id, ANIMAL_PELT_ITEM_ID),
    supabase.from("items").select("icon_path").eq("id", RESILIENT_WOOD_ITEM_ID).maybeSingle(),
    supabase.from("items").select("icon_path").eq("id", ANIMAL_PELT_ITEM_ID).maybeSingle(),
  ]);

  const resilientWoodRemaining = Math.max(
    0,
    resilientWoodProgress.target - resilientWoodProgress.current,
  );
  const animalPeltRemaining = Math.max(0, animalPeltProgress.target - animalPeltProgress.current);
  const maxResilientWoodContribution = Math.min(userResilientWoodQuantity, resilientWoodRemaining);
  const maxAnimalPeltContribution = Math.min(userAnimalPeltQuantity, animalPeltRemaining);

  const resilientWoodIconSrc = resolveItemIconPath(
    resilientWoodItem?.icon_path,
    RESILIENT_WOOD_FALLBACK_ICON,
  );
  const animalPeltIconSrc = resolveItemIconPath(animalPeltItem?.icon_path, ANIMAL_PELT_FALLBACK_ICON);

  async function contributeResilientWood(amount: number) {
    "use server";
    await contributeLoremasterMaterial(amount, "resilientWood");
  }

  async function contributeAnimalPelt(amount: number) {
    "use server";
    await contributeLoremasterMaterial(amount, "animalPelt");
  }

  return (
    <div
      className={`relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#120b08] text-amber-50 ${uiFont.className}`}
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.62)), url('${PAGE_BG}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl items-center justify-center p-4 lg:p-8">
        <section className="w-full max-w-4xl rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm lg:p-3">
          <div
            className={`rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-4 text-center lg:p-5 ${dialogueFont.className}`}
          >
            <p className="text-center text-sm leading-relaxed text-slate-800 sm:text-base">
              {materialsComplete
                ? "La comunidad reunió los materiales para la biblioteca del Loremaster."
                : "Silva necesita madera resistente y pieles de animal para armar la biblioteca del lore."}
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-3">
                <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
                  {LOREMASTER_RESILIENT_WOOD_MILESTONE.label}
                </p>
                <div className="mx-auto mt-3 h-4 w-4/5 max-w-2xl overflow-hidden rounded-full border border-[#9b7a46]/80 bg-[#e8d8b4]">
                  <div
                    className={`h-full transition-all duration-500 ${LOREMASTER_MATERIAL_CONFIG.resilientWood.progressBarClass}`}
                    style={{ width: `${resilientWoodProgress.percent}%` }}
                  />
                </div>
                <p className="mb-2 mt-2 text-xs uppercase tracking-wide text-slate-700">
                  {resilientWoodProgress.current} / {resilientWoodProgress.target} (
                  {resilientWoodProgress.percent}%)
                </p>
                <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold leading-relaxed text-slate-700 sm:text-base">
                  <p>Tenés disponible: {userResilientWoodQuantity}</p>
                  <Image
                    src={resilientWoodIconSrc}
                    alt="Madera resistente"
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] object-contain"
                  />
                </div>
                {resilientWoodProgress.isCompleted ? (
                  <p className="mt-6 text-sm font-semibold text-emerald-800">Objetivo completo.</p>
                ) : (
                  <WoodAmountSelector
                    maxAmount={maxResilientWoodContribution}
                    onContribute={contributeResilientWood}
                    materialName={LOREMASTER_RESILIENT_WOOD_MILESTONE.materialLabel}
                  />
                )}
              </div>

              <div className="rounded-lg border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-3">
                <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
                  {LOREMASTER_ANIMAL_PELT_MILESTONE.label}
                </p>
                <div className="mx-auto mt-3 h-4 w-4/5 max-w-2xl overflow-hidden rounded-full border border-[#9b7a46]/80 bg-[#e8d8b4]">
                  <div
                    className={`h-full transition-all duration-500 ${LOREMASTER_MATERIAL_CONFIG.animalPelt.progressBarClass}`}
                    style={{ width: `${animalPeltProgress.percent}%` }}
                  />
                </div>
                <p className="mb-2 mt-2 text-xs uppercase tracking-wide text-slate-700">
                  {animalPeltProgress.current} / {animalPeltProgress.target} ({animalPeltProgress.percent}
                  %)
                </p>
                <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold leading-relaxed text-slate-700 sm:text-base">
                  <p>Tenés disponible: {userAnimalPeltQuantity}</p>
                  <Image
                    src={animalPeltIconSrc}
                    alt="Piel de animal"
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] object-contain"
                  />
                </div>
                {animalPeltProgress.isCompleted ? (
                  <p className="mt-6 text-sm font-semibold text-emerald-800">Objetivo completo.</p>
                ) : (
                  <WoodAmountSelector
                    maxAmount={maxAnimalPeltContribution}
                    onContribute={contributeAnimalPelt}
                    materialName={LOREMASTER_ANIMAL_PELT_MILESTONE.materialLabel}
                  />
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <GarrisonBackLink className={uiFont.className} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
