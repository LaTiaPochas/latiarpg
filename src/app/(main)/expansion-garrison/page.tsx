import type { Metadata } from "next";
import Image from "next/image";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { redirect } from "next/navigation";

import { GarrisonBackLink } from "@/components/camp/garrison-back-link";
import { WoodAmountSelector } from "@/components/campsite/wood-amount-selector";
import { GarrisonExpansionCompletedPanel } from "@/components/expansion-garrison/garrison-expansion-completed-panel";
import { GarrisonLevel2IntroDialogue } from "@/components/expansion-garrison/garrison-level2-intro-dialogue";
import { createClient } from "@/lib/supabase/server";
import { insertWorldEventLog } from "@/lib/world-event-log";

import { completeGarrisonLevel2Dialog } from "./actions";

const EXPANSION_PATH = "/expansion-garrison";
const PAGE_BG = "/img/resources/background/bg_first_base.png";

const WOOD_ITEM_ID = "ea5b9601-8a7d-4270-b5d9-cf292d49945e";
const STONE_ITEM_ID = "e2b70f4d-19d5-4406-bcd9-23c8820c1505";
const IRON_ITEM_ID = "f655085d-c163-4433-9197-162d17eb6bca";

const STONE_FALLBACK_ICON = "/img/resources/items/resource_rock.png";
const IRON_FALLBACK_ICON = "/img/resources/items/resource_iron.png";
const WOOD_FALLBACK_ICON = "/img/resources/items/resource_wood.png";

const GARRISON_LEVEL2_WOOD_MILESTONE = {
  title: "garrison_level2_wood",
  label: "Madera necesaria:",
  materialLabel: "madera",
  logLabel: "madera",
  completedEvent: "¡Objetivo completado: Madera para la expansión del campamento!",
} as const;

const GARRISON_LEVEL2_STONE_MILESTONE = {
  title: "garrison_level2_stone",
  label: "Piedra necesaria:",
  materialLabel: "piedra",
  logLabel: "piedra",
  completedEvent: "¡Objetivo completado: Piedra para la expansión del campamento!",
} as const;

const GARRISON_LEVEL2_IRON_MILESTONE = {
  title: "garrison_level2_iron",
  label: "Hierro necesario:",
  materialLabel: "hierro",
  logLabel: "hierro",
  completedEvent: "¡Objetivo completado: Hierro para la expansión del campamento!",
} as const;

const GARRISON_LEVEL2_COMPLETED_MILESTONE = {
  title: "garrison_level2_completed",
  completedEvent: "¡Objetivo completado: Expansión del campamento!",
} as const;

const GARRISON_LEVEL2_MATERIAL_TITLES = [
  GARRISON_LEVEL2_WOOD_MILESTONE.title,
  GARRISON_LEVEL2_STONE_MILESTONE.title,
  GARRISON_LEVEL2_IRON_MILESTONE.title,
] as const;

type GarrisonExpansionMaterialKind = "wood" | "stone" | "iron";

type GarrisonExpansionMaterialMilestone = {
  title: string;
  label: string;
  materialLabel: string;
  logLabel: string;
  completedEvent: string;
};

const GARRISON_EXPANSION_MATERIAL_CONFIG: Record<
  GarrisonExpansionMaterialKind,
  {
    itemId: string;
    milestone: GarrisonExpansionMaterialMilestone;
    iconFallback: string;
    statColumn?: "wood_given" | "rock_given";
    progressBarClass: string;
  }
> = {
  wood: {
    itemId: WOOD_ITEM_ID,
    milestone: GARRISON_LEVEL2_WOOD_MILESTONE,
    iconFallback: WOOD_FALLBACK_ICON,
    statColumn: "wood_given",
    progressBarClass: "bg-gradient-to-r from-lime-500 to-emerald-600",
  },
  stone: {
    itemId: STONE_ITEM_ID,
    milestone: GARRISON_LEVEL2_STONE_MILESTONE,
    iconFallback: STONE_FALLBACK_ICON,
    statColumn: "rock_given",
    progressBarClass: "bg-gradient-to-r from-stone-500 to-slate-500",
  },
  iron: {
    itemId: IRON_ITEM_ID,
    milestone: GARRISON_LEVEL2_IRON_MILESTONE,
    iconFallback: IRON_FALLBACK_ICON,
    progressBarClass: "bg-gradient-to-r from-amber-600 to-orange-700",
  },
};

function buildGarrisonContributionEventHtml(input: {
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

  return `<span style="color:${safeMemberColor}">${safeMemberName}</span> ha aportado ${input.amount} de ${safeMaterialLabel} ${itemIconHtml} para la construcción de <strong>Garrison Nivel 2</strong>.`;
}

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Expansión del campamento",
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

async function completeGarrisonLevel2IfMaterialsReady(
  supabaseAction: Awaited<ReturnType<typeof createClient>>,
  authUserId?: string | null,
) {
  const { data: materialMilestones } = await supabaseAction
    .from("global_milestones")
    .select("title, current_value, target_value, is_completed")
    .in("title", [...GARRISON_LEVEL2_MATERIAL_TITLES]);

  const allMaterialsCompleted = GARRISON_LEVEL2_MATERIAL_TITLES.every((title) => {
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
    .eq("title", GARRISON_LEVEL2_COMPLETED_MILESTONE.title)
    .or("is_completed.is.false,is_completed.is.null")
    .select("id");

  const completedNow = (completedRows?.length ?? 0) > 0;
  if (completedNow) {
    await insertWorldEventLog(supabaseAction, authUserId, {
      happened_at: new Date().toISOString(),
      member_name: "world",
      event_html: `<span style="color:#22c55e;font-weight:700;">${GARRISON_LEVEL2_COMPLETED_MILESTONE.completedEvent}</span>`,
    });
  }

  return completedNow;
}

async function contributeGarrisonExpansionMaterial(
  amount: number,
  kind: GarrisonExpansionMaterialKind,
) {
  const parsedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (parsedAmount <= 0) {
    redirect(EXPANSION_PATH);
  }

  const config = GARRISON_EXPANSION_MATERIAL_CONFIG[kind];
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
    redirect(EXPANSION_PATH);
  }

  const currentGlobalValue = Math.max(0, Math.trunc(num(globalMilestone.current_value, 0)));
  const targetGlobalValue = Math.max(1, Math.trunc(num(globalMilestone.target_value, 1)));
  const remainingNeeded = Math.max(0, targetGlobalValue - currentGlobalValue);
  const amountToApply = Math.min(parsedAmount, availableAmount, remainingNeeded);
  if (amountToApply <= 0) {
    redirect(EXPANSION_PATH);
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

  if (config.statColumn) {
    const { data: currentStats } = await supabaseAction
      .from("user_stats")
      .select("wood_given, rock_given")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    const rawStat = currentStats?.[config.statColumn];
    const currentStatValue =
      typeof rawStat === "number" && Number.isFinite(rawStat)
        ? Math.max(0, Math.trunc(rawStat))
        : 0;
    await supabaseAction.from("user_stats").upsert(
      {
        user_id: currentUser.id,
        [config.statColumn]: currentStatValue + amountToApply,
      },
      { onConflict: "user_id" },
    );
  }

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

  const eventHtml = buildGarrisonContributionEventHtml({
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

  await completeGarrisonLevel2IfMaterialsReady(supabaseAction, currentUser.id);

  redirect(EXPANSION_PATH);
}

export default async function ExpansionGarrisonPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: userMilestones } = await supabase
    .from("user_milestones")
    .select("garrison_level2_dialog")
    .eq("user_id", user.id)
    .maybeSingle();

  const garrisonLevel2DialogSeen = userMilestones?.garrison_level2_dialog === true;

  const { data: expansionCompletedMilestone } = await supabase
    .from("global_milestones")
    .select("is_completed")
    .eq("title", GARRISON_LEVEL2_COMPLETED_MILESTONE.title)
    .maybeSingle();

  if (expansionCompletedMilestone?.is_completed === true) {
    return <GarrisonExpansionCompletedPanel uiFontClassName={uiFont.className} />;
  }

  if (!garrisonLevel2DialogSeen) {
    return <GarrisonLevel2IntroDialogue onComplete={completeGarrisonLevel2Dialog} />;
  }

  const { data: materialMilestones } = await supabase
    .from("global_milestones")
    .select("title, current_value, target_value, is_completed")
    .in("title", [...GARRISON_LEVEL2_MATERIAL_TITLES]);

  const woodMilestoneRow = materialMilestones?.find(
    (row) => row.title === GARRISON_LEVEL2_WOOD_MILESTONE.title,
  );
  const stoneMilestoneRow = materialMilestones?.find(
    (row) => row.title === GARRISON_LEVEL2_STONE_MILESTONE.title,
  );
  const ironMilestoneRow = materialMilestones?.find(
    (row) => row.title === GARRISON_LEVEL2_IRON_MILESTONE.title,
  );

  const woodMilestoneProgress = milestoneProgress(woodMilestoneRow);
  const stoneMilestoneProgress = milestoneProgress(stoneMilestoneRow);
  const ironMilestoneProgress = milestoneProgress(ironMilestoneRow);

  const materialsComplete =
    woodMilestoneProgress.isCompleted &&
    stoneMilestoneProgress.isCompleted &&
    ironMilestoneProgress.isCompleted;

  const [
    userWoodQuantity,
    userStoneQuantity,
    userIronQuantity,
    { data: woodItem },
    { data: stoneItem },
    { data: ironItem },
  ] = await Promise.all([
    sumInventoryQuantity(user.id, WOOD_ITEM_ID),
    sumInventoryQuantity(user.id, STONE_ITEM_ID),
    sumInventoryQuantity(user.id, IRON_ITEM_ID),
    supabase.from("items").select("icon_path").eq("id", WOOD_ITEM_ID).maybeSingle(),
    supabase.from("items").select("icon_path").eq("id", STONE_ITEM_ID).maybeSingle(),
    supabase.from("items").select("icon_path").eq("id", IRON_ITEM_ID).maybeSingle(),
  ]);

  const woodRemaining = Math.max(0, woodMilestoneProgress.target - woodMilestoneProgress.current);
  const stoneRemaining = Math.max(
    0,
    stoneMilestoneProgress.target - stoneMilestoneProgress.current,
  );
  const ironRemaining = Math.max(0, ironMilestoneProgress.target - ironMilestoneProgress.current);

  const maxWoodContribution = Math.min(userWoodQuantity, woodRemaining);
  const maxStoneContribution = Math.min(userStoneQuantity, stoneRemaining);
  const maxIronContribution = Math.min(userIronQuantity, ironRemaining);

  const woodIconSrc = resolveItemIconPath(woodItem?.icon_path, WOOD_FALLBACK_ICON);
  const stoneIconSrc = resolveItemIconPath(stoneItem?.icon_path, STONE_FALLBACK_ICON);
  const ironIconSrc = resolveItemIconPath(ironItem?.icon_path, IRON_FALLBACK_ICON);

  async function contributeWood(amount: number) {
    "use server";
    await contributeGarrisonExpansionMaterial(amount, "wood");
  }

  async function contributeStone(amount: number) {
    "use server";
    await contributeGarrisonExpansionMaterial(amount, "stone");
  }

  async function contributeIron(amount: number) {
    "use server";
    await contributeGarrisonExpansionMaterial(amount, "iron");
  }

  const materialPanels = [
    {
      key: "wood" as const,
      milestone: GARRISON_LEVEL2_WOOD_MILESTONE,
      progress: woodMilestoneProgress,
      userQuantity: userWoodQuantity,
      maxContribution: maxWoodContribution,
      iconSrc: woodIconSrc,
      iconAlt: "Madera",
      onContribute: contributeWood,
      progressBarClass: GARRISON_EXPANSION_MATERIAL_CONFIG.wood.progressBarClass,
    },
    {
      key: "stone" as const,
      milestone: GARRISON_LEVEL2_STONE_MILESTONE,
      progress: stoneMilestoneProgress,
      userQuantity: userStoneQuantity,
      maxContribution: maxStoneContribution,
      iconSrc: stoneIconSrc,
      iconAlt: "Piedra",
      onContribute: contributeStone,
      progressBarClass: GARRISON_EXPANSION_MATERIAL_CONFIG.stone.progressBarClass,
    },
    {
      key: "iron" as const,
      milestone: GARRISON_LEVEL2_IRON_MILESTONE,
      progress: ironMilestoneProgress,
      userQuantity: userIronQuantity,
      maxContribution: maxIronContribution,
      iconSrc: ironIconSrc,
      iconAlt: "Hierro",
      onContribute: contributeIron,
      progressBarClass: GARRISON_EXPANSION_MATERIAL_CONFIG.iron.progressBarClass,
    },
  ];

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
        <section className="w-full max-w-5xl rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm lg:p-4">
          <div
            className={`rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-4 text-center lg:p-5 ${dialogueFont.className}`}
          >
            <p className="text-center text-sm leading-relaxed text-slate-800 sm:text-base">
              {materialsComplete
                ? "La comunidad reunió madera, piedra e hierro para expandir el campamento."
                : "La comunidad está reuniendo madera, piedra e hierro para expandir el campamento y construir una base más grande."}
            </p>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {materialPanels.map((panel) => (
                <div
                  key={panel.key}
                  className="rounded-lg border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-3"
                >
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
                    {panel.milestone.label}
                  </p>
                  <div className="mx-auto mt-3 h-4 w-4/5 max-w-2xl overflow-hidden rounded-full border border-[#9b7a46]/80 bg-[#e8d8b4]">
                    <div
                      className={`h-full transition-all duration-500 ${panel.progressBarClass}`}
                      style={{ width: `${panel.progress.percent}%` }}
                    />
                  </div>
                  <p className="mb-2 mt-2 text-xs uppercase tracking-wide text-slate-700">
                    {panel.progress.current} / {panel.progress.target} ({panel.progress.percent}
                    %)
                  </p>
                  <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold leading-relaxed text-slate-700 sm:text-base">
                    <p>Tenés disponible: {panel.userQuantity}</p>
                    <Image
                      src={panel.iconSrc}
                      alt={panel.iconAlt}
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px] object-contain"
                    />
                  </div>
                  {panel.progress.isCompleted ? (
                    <p className="mt-6 text-sm font-semibold text-emerald-800">Objetivo completo.</p>
                  ) : (
                    <WoodAmountSelector
                      maxAmount={panel.maxContribution}
                      onContribute={panel.onContribute}
                      materialName={panel.milestone.materialLabel}
                    />
                  )}
                </div>
              ))}
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
