import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { redirect } from "next/navigation";

import { WoodAmountSelector } from "@/components/campsite/wood-amount-selector";
import { SoulGauntletCompletedScene } from "@/components/soul-gauntlet/soul-gauntlet-completed-scene";
import { SoulGauntletIntroDialogue } from "@/components/soul-gauntlet/soul-gauntlet-intro-dialogue";
import { createClient } from "@/lib/supabase/server";
import { insertWorldEventLog } from "@/lib/world-event-log";

import { SOUL_FRAGMENT_ITEM_ID } from "@/lib/soul-gauntlet";
import {
  loadSoulGauntletRunRewardGrantViews,
  soulGauntletRewardTierLabel,
} from "@/lib/soul-gauntlet-rewards";

import { completeSoulGauntletIntro } from "./actions";

const GAUNTLET_PATH = "/gauntlet-pozo-de-las-almas";
const PAGE_BG = "/img/resources/background/bg_cueva_inner_6.png";
const WOOD_ITEM_ID = "ea5b9601-8a7d-4270-b5d9-cf292d49945e";
const STONE_ITEM_ID = "e2b70f4d-19d5-4406-bcd9-23c8820c1505";
const STONE_FALLBACK_ICON = "/img/resources/items/resource_rock.png";

const SOUL_GAUNTLET_WOOD_MILESTONE = {
  title: "soul_gauntlet_madera",
  label: "Madera necesaria:",
  materialLabel: "madera",
  completedEvent: "¡Objetivo completado: Madera del Pozo de las Almas reunida!",
} as const;

const SOUL_GAUNTLET_STONE_MILESTONE = {
  title: "soul_gauntlet_piedra",
  label: "Piedra necesaria:",
  materialLabel: "piedra",
  completedEvent: "¡Objetivo completado: Piedra del Pozo de las Almas reunida!",
} as const;

const SOUL_GAUNTLET_COMPLETED_MILESTONE = {
  title: "soul_gauntlet_completed",
  completedEvent: "¡Objetivo completado: Pozo de las Almas Construido!",
} as const;

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});
const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Pozo de las Almas",
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

function capitalizeFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

async function completeSoulGauntletIfMaterialsReady(
  supabaseAction: Awaited<ReturnType<typeof createClient>>,
  authUserId?: string | null,
) {
  const { data: materialMilestones } = await supabaseAction
    .from("global_milestones")
    .select("title, is_completed")
    .in("title", [SOUL_GAUNTLET_WOOD_MILESTONE.title, SOUL_GAUNTLET_STONE_MILESTONE.title]);

  const woodCompleted = materialMilestones?.some(
    (row) => row.title === SOUL_GAUNTLET_WOOD_MILESTONE.title && row.is_completed === true,
  );
  const stoneCompleted = materialMilestones?.some(
    (row) => row.title === SOUL_GAUNTLET_STONE_MILESTONE.title && row.is_completed === true,
  );

  if (!woodCompleted || !stoneCompleted) {
    return false;
  }

  const { data: completedRows } = await supabaseAction
    .from("global_milestones")
    .update({
      current_value: 1,
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq("title", SOUL_GAUNTLET_COMPLETED_MILESTONE.title)
    .or("is_completed.is.false,is_completed.is.null")
    .select("id");

  const completedNow = (completedRows?.length ?? 0) > 0;
  if (completedNow) {
    await insertWorldEventLog(supabaseAction, authUserId, {
      happened_at: new Date().toISOString(),
      member_name: "world",
      event_html: `<span style="color:#22c55e;font-weight:700;">${SOUL_GAUNTLET_COMPLETED_MILESTONE.completedEvent}</span>`,
    });
  }

  return completedNow;
}

type GauntletPozoDeLasAlmasPageProps = {
  searchParams?: Promise<{
    gauntlet_result?: string;
    run?: string;
    floor?: string;
    gauntlet_completed?: string;
  }>;
};

export default async function GauntletPozoDeLasAlmasPage({
  searchParams,
}: GauntletPozoDeLasAlmasPageProps) {
  const resolvedSearch = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: gauntletCompletedMilestone } = await supabase
    .from("global_milestones")
    .select("is_completed")
    .eq("title", SOUL_GAUNTLET_COMPLETED_MILESTONE.title)
    .maybeSingle();

  if (gauntletCompletedMilestone?.is_completed === true) {
    const { data: soulItem } = await supabase
      .from("items")
      .select("icon_path")
      .eq("id", SOUL_FRAGMENT_ITEM_ID)
      .maybeSingle();

    const { data: soulInventoryRows } = await supabase
      .from("user_inventory")
      .select("quantity")
      .eq("profile_id", user.id)
      .eq("item_id", SOUL_FRAGMENT_ITEM_ID);

    const soulFragmentOwned = (soulInventoryRows ?? []).reduce(
      (total, row) => total + Math.max(0, Math.trunc(num(row.quantity, 0))),
      0,
    );
    const soulFragmentIconSrc = resolveItemIconPath(
      soulItem?.icon_path,
      "/img/resources/items/resource_soul_fragment.png",
    );

    let runResult = null;
    const showRunResult = resolvedSearch?.gauntlet_result === "1";
    const resultRunId =
      typeof resolvedSearch?.run === "string" && resolvedSearch.run.trim().length > 0
        ? resolvedSearch.run.trim()
        : null;

    if (showRunResult && resultRunId) {
      const floorFromQuery =
        typeof resolvedSearch?.floor === "string" && resolvedSearch.floor.trim() !== ""
          ? Math.max(1, Math.trunc(Number(resolvedSearch.floor) || 1))
          : null;
      const completedFromQuery = resolvedSearch?.gauntlet_completed === "1";

      const loaded = await loadSoulGauntletRunRewardGrantViews(supabase, resultRunId, user.id);
      if (loaded) {
        runResult = {
          floor: loaded.floor,
          rewardTierLabel: soulGauntletRewardTierLabel(loaded.rewardTier),
          granted: loaded.granted,
          inventoryError: loaded.inventoryError,
          completed: loaded.completed || completedFromQuery,
        };
      } else {
        runResult = {
          floor: floorFromQuery ?? 1,
          rewardTierLabel: "Partida del gauntlet",
          granted: [],
          inventoryError:
            "No se pudieron cargar las recompensas de esta partida. Si acabas de morir, pulsa Continuar otra vez en el combate.",
          completed: completedFromQuery,
        };
      }
    }

    return (
      <SoulGauntletCompletedScene
        soulFragmentOwned={soulFragmentOwned}
        soulFragmentIconSrc={soulFragmentIconSrc}
        runResult={runResult}
      />
    );
  }

  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("soul_gauntlet")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: woodMilestone } = await supabase
    .from("global_milestones")
    .select("id, title, current_value, target_value, is_completed")
    .eq("title", SOUL_GAUNTLET_WOOD_MILESTONE.title)
    .maybeSingle();
  const { data: stoneMilestone } = await supabase
    .from("global_milestones")
    .select("id, title, current_value, target_value, is_completed")
    .eq("title", SOUL_GAUNTLET_STONE_MILESTONE.title)
    .maybeSingle();
  const { data: woodInventoryRows } = await supabase
    .from("user_inventory")
    .select("quantity")
    .eq("profile_id", user.id)
    .eq("item_id", WOOD_ITEM_ID);
  const { data: stoneInventoryRows } = await supabase
    .from("user_inventory")
    .select("quantity")
    .eq("profile_id", user.id)
    .eq("item_id", STONE_ITEM_ID);
  const { data: woodItem } = await supabase
    .from("items")
    .select("icon_path")
    .eq("id", WOOD_ITEM_ID)
    .maybeSingle();
  const { data: stoneItem } = await supabase
    .from("items")
    .select("icon_path")
    .eq("id", STONE_ITEM_ID)
    .maybeSingle();

  const soulGauntletIntroSeen = milestones?.soul_gauntlet === true;
  const woodMilestoneProgress = milestoneProgress(woodMilestone);
  const stoneMilestoneProgress = milestoneProgress(stoneMilestone);
  const materialsComplete =
    woodMilestoneProgress.isCompleted && stoneMilestoneProgress.isCompleted;

  const userWoodQuantity = (woodInventoryRows ?? []).reduce(
    (total, row) => total + Math.max(0, Math.trunc(num(row.quantity, 0))),
    0,
  );
  const userStoneQuantity = (stoneInventoryRows ?? []).reduce(
    (total, row) => total + Math.max(0, Math.trunc(num(row.quantity, 0))),
    0,
  );

  const woodRemaining = Math.max(0, woodMilestoneProgress.target - woodMilestoneProgress.current);
  const stoneRemaining = Math.max(0, stoneMilestoneProgress.target - stoneMilestoneProgress.current);
  const maxWoodContribution = Math.min(userWoodQuantity, woodRemaining);
  const maxStoneContribution = Math.min(userStoneQuantity, stoneRemaining);

  const woodIconSrc = resolveItemIconPath(woodItem?.icon_path, "/img/resources/items/resource_wood.png");
  const stoneIconSrc = resolveItemIconPath(stoneItem?.icon_path, STONE_FALLBACK_ICON);

  async function contributeWood(amount: number) {
    "use server";

    const parsedAmount = Math.max(0, Math.floor(Number(amount) || 0));
    if (parsedAmount <= 0) {
      redirect(GAUNTLET_PATH);
    }

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
      .eq("item_id", WOOD_ITEM_ID)
      .order("id", { ascending: true });

    const availableWood = (inventoryRows ?? []).reduce(
      (total, row) => total + Math.max(0, Math.trunc(num(row.quantity, 0))),
      0,
    );

    const { data: globalMilestone } = await supabaseAction
      .from("global_milestones")
      .select("id, current_value, target_value, is_completed")
      .eq("title", SOUL_GAUNTLET_WOOD_MILESTONE.title)
      .maybeSingle();

    if (!globalMilestone) {
      redirect(GAUNTLET_PATH);
    }

    const currentGlobalValue = Math.max(0, Math.trunc(num(globalMilestone.current_value, 0)));
    const targetGlobalValue = Math.max(1, Math.trunc(num(globalMilestone.target_value, 1)));
    const remainingNeeded = Math.max(0, targetGlobalValue - currentGlobalValue);
    const amountToApply = Math.min(parsedAmount, availableWood, remainingNeeded);
    if (amountToApply <= 0) {
      redirect(GAUNTLET_PATH);
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
      .eq("title", SOUL_GAUNTLET_WOOD_MILESTONE.title);

    const { data: currentStats } = await supabaseAction
      .from("user_stats")
      .select("wood_given")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    const currentWoodGiven = Math.max(0, Math.trunc(num(currentStats?.wood_given, 0)));
    await supabaseAction.from("user_stats").upsert(
      {
        user_id: currentUser.id,
        wood_given: currentWoodGiven + amountToApply,
      },
      { onConflict: "user_id" },
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
    const safeMemberName = escapeHtml(memberName);
    const eventHtml = `<span style="color:${memberColor}">${safeMemberName}</span> aportó ${amountToApply} de madera para reconstruir el Pozo de las Almas.`;
    await insertWorldEventLog(supabaseAction, currentUser.id, {
      happened_at: new Date().toISOString(),
      member_name: memberName,
      event_html: eventHtml,
    });

    if (shouldMarkCompleted && !alreadyCompleted) {
      await insertWorldEventLog(supabaseAction, currentUser.id, {
        happened_at: new Date().toISOString(),
        member_name: "world",
        event_html: `<span style="color:#22c55e;font-weight:700;">${SOUL_GAUNTLET_WOOD_MILESTONE.completedEvent}</span>`,
      });
    }

    await completeSoulGauntletIfMaterialsReady(supabaseAction, currentUser.id);

    redirect(GAUNTLET_PATH);
  }

  async function contributeStone(amount: number) {
    "use server";

    const parsedAmount = Math.max(0, Math.floor(Number(amount) || 0));
    if (parsedAmount <= 0) {
      redirect(GAUNTLET_PATH);
    }

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
      .eq("item_id", STONE_ITEM_ID)
      .order("id", { ascending: true });

    const availableStone = (inventoryRows ?? []).reduce(
      (total, row) => total + Math.max(0, Math.trunc(num(row.quantity, 0))),
      0,
    );

    const { data: globalMilestone } = await supabaseAction
      .from("global_milestones")
      .select("id, current_value, target_value, is_completed")
      .eq("title", SOUL_GAUNTLET_STONE_MILESTONE.title)
      .maybeSingle();

    if (!globalMilestone) {
      redirect(GAUNTLET_PATH);
    }

    const currentGlobalValue = Math.max(0, Math.trunc(num(globalMilestone.current_value, 0)));
    const targetGlobalValue = Math.max(1, Math.trunc(num(globalMilestone.target_value, 1)));
    const remainingNeeded = Math.max(0, targetGlobalValue - currentGlobalValue);
    const amountToApply = Math.min(parsedAmount, availableStone, remainingNeeded);
    if (amountToApply <= 0) {
      redirect(GAUNTLET_PATH);
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
      .eq("title", SOUL_GAUNTLET_STONE_MILESTONE.title);

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
    const safeMemberName = escapeHtml(memberName);
    const eventHtml = `<span style="color:${memberColor}">${safeMemberName}</span> aportó ${amountToApply} de piedra para reconstruir el Pozo de las Almas.`;
    await insertWorldEventLog(supabaseAction, currentUser.id, {
      happened_at: new Date().toISOString(),
      member_name: memberName,
      event_html: eventHtml,
    });

    if (shouldMarkCompleted && !alreadyCompleted) {
      await insertWorldEventLog(supabaseAction, currentUser.id, {
        happened_at: new Date().toISOString(),
        member_name: "world",
        event_html: `<span style="color:#22c55e;font-weight:700;">${SOUL_GAUNTLET_STONE_MILESTONE.completedEvent}</span>`,
      });
    }

    await completeSoulGauntletIfMaterialsReady(supabaseAction, currentUser.id);

    redirect(GAUNTLET_PATH);
  }

  if (!soulGauntletIntroSeen) {
    return <SoulGauntletIntroDialogue onComplete={completeSoulGauntletIntro} />;
  }

  return (
    <main
      className={`relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#120b08] px-4 py-8 text-amber-50 ${uiFont.className}`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${PAGE_BG}')` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/55" aria-hidden />

      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-7.5rem)] w-full max-w-6xl items-center justify-center">
        <div className="w-full max-w-3xl rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm lg:p-3">
          <div
            className={`rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-4 text-center lg:p-5 ${dialogueFont.className}`}
          >
            {materialsComplete ? (
              <p className="text-sm leading-relaxed text-slate-800 sm:text-sm">
                La comunidad reunió madera y piedra para reconstruir la entrada al Pozo de las Almas.
                Hazramitor podrá liberar el pozo de los intrusos que quedaron dentro.
              </p>
            ) : (
              <p className="text-[12px] leading-relaxed text-slate-800 sm:text-sm">
                Hazramitor te pidió ayuda para reconstruir la entrada al pozo de las almas. Aportá
                madera y piedra para que la comunidad pueda cerrar el acceso y recuperar la paz en
                estas cuevas.
              </p>
            )}

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-3">
                <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
                  {SOUL_GAUNTLET_WOOD_MILESTONE.label}
                </p>
                <div className="mx-auto mt-3 h-4 w-4/5 max-w-2xl overflow-hidden rounded-full border border-[#9b7a46]/80 bg-[#e8d8b4]">
                  <div
                    className="h-full bg-gradient-to-r from-lime-500 to-emerald-600 transition-all duration-500"
                    style={{ width: `${woodMilestoneProgress.percent}%` }}
                  />
                </div>
                <p className="mb-2 mt-2 text-xs uppercase tracking-wide text-slate-700">
                  {woodMilestoneProgress.current} / {woodMilestoneProgress.target} (
                  {woodMilestoneProgress.percent}%)
                </p>
                <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold leading-relaxed text-slate-700 sm:text-base">
                  <p>Tenés disponible: {userWoodQuantity}</p>
                  <Image
                    src={woodIconSrc}
                    alt="Madera"
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] object-contain"
                  />
                </div>
                {woodMilestoneProgress.isCompleted ? (
                  <p className="mt-6 text-sm font-semibold text-emerald-800">Objetivo completo.</p>
                ) : (
                  <WoodAmountSelector
                    maxAmount={maxWoodContribution}
                    onContribute={contributeWood}
                    materialName={SOUL_GAUNTLET_WOOD_MILESTONE.materialLabel}
                  />
                )}
              </div>

              <div className="rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-3">
                <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
                  {SOUL_GAUNTLET_STONE_MILESTONE.label}
                </p>
                <div className="mx-auto mt-3 h-4 w-4/5 max-w-2xl overflow-hidden rounded-full border border-[#9b7a46]/80 bg-[#e8d8b4]">
                  <div
                    className="h-full bg-gradient-to-r from-stone-500 to-slate-500 transition-all duration-500"
                    style={{ width: `${stoneMilestoneProgress.percent}%` }}
                  />
                </div>
                <p className="mb-2 mt-2 text-xs uppercase tracking-wide text-slate-700">
                  {stoneMilestoneProgress.current} / {stoneMilestoneProgress.target} (
                  {stoneMilestoneProgress.percent}%)
                </p>
                <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold leading-relaxed text-slate-700 sm:text-base">
                  <p>Tenés disponible: {userStoneQuantity}</p>
                  <Image
                    src={stoneIconSrc}
                    alt="Piedra"
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] object-contain"
                  />
                </div>
                {stoneMilestoneProgress.isCompleted ? (
                  <p className="mt-6 text-sm font-semibold text-emerald-800">Objetivo completo.</p>
                ) : (
                  <WoodAmountSelector
                    maxAmount={maxStoneContribution}
                    onContribute={contributeStone}
                    materialName={SOUL_GAUNTLET_STONE_MILESTONE.materialLabel}
                  />
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <Link
                href="/cave-depths?hotspot=cave-depth-5"
                className={`${uiFont.className} inline-flex items-center gap-1.5 rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-3 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] lg:text-xs`}
              >
                <span className="text-base leading-none" aria-hidden>
                  ←
                </span>
                volver a las profundidades
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
