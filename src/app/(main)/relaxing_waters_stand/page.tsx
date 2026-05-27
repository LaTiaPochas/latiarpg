import { RelaxingWatersStandStory } from "@/components/relaxing-waters-stand/relaxing-waters-stand-story";
import { RelaxingWatersHelpButton } from "@/components/relaxing-waters-stand/relaxing-waters-help-button";
import { WoodAmountSelector } from "@/components/campsite/wood-amount-selector";
import { createClient } from "@/lib/supabase/server";
import { insertWorldEventLog } from "@/lib/world-event-log";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});
const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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

function buildPlayerToken(playerName: string) {
  return playerName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function buildPlayerSpritePath(playerName: string) {
  const normalizedName = buildPlayerToken(playerName);
  if (!normalizedName) return "/img/resources/logos/logo_latia_rpg.png";
  return `/img/resources/characters/pj_${normalizedName}_rpg_standing.png`;
}

function buildPlayerFacePath(playerName: string) {
  const normalizedName = buildPlayerToken(playerName);
  if (!normalizedName) return "/img/resources/logos/logo_latia_rpg.png";
  return `/img/resources/caracters_faces/pj_${normalizedName}_rpg_face.png`;
}

function resolveItemIconPath(iconPath: string | null | undefined) {
  if (!iconPath || typeof iconPath !== "string") {
    return "/img/resources/logos/logo_latia_rpg.png";
  }
  const trimmedPath = iconPath.trim();
  if (!trimmedPath) {
    return "/img/resources/logos/logo_latia_rpg.png";
  }
  if (
    trimmedPath.startsWith("/") ||
    trimmedPath.startsWith("http://") ||
    trimmedPath.startsWith("https://")
  ) {
    return trimmedPath;
  }
  return `/${trimmedPath}`;
}

export default async function RelaxingWatersStandPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("miembro")
    .eq("id", user.id)
    .maybeSingle();
  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("relaxing_water_stand_dialog")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: standMilestone } = await supabase
    .from("global_milestones")
    .select("id, title, current_value, target_value, is_completed")
    .eq("id", 3)
    .eq("title", "aguas_termales_completadas")
    .maybeSingle();
  const { data: userCharacter } = await supabase
    .from("user_character")
    .select("hp_actual, hp_total, mana_actual, mana_total")
    .eq("profile_id", user.id)
    .maybeSingle();
  const { data: woodInventoryRows } = await supabase
    .from("user_inventory")
    .select("quantity")
    .eq("profile_id", user.id)
    .eq("item_id", "ea5b9601-8a7d-4270-b5d9-cf292d49945e");
  const { data: woodItem } = await supabase
    .from("items")
    .select("icon_path")
    .eq("id", "ea5b9601-8a7d-4270-b5d9-cf292d49945e")
    .maybeSingle();
  const RELAXING_WATER_ITEM_ID = "ecd74ed8-b2de-4bb9-b109-3fd4f27e8955";
  const GOLD_ITEM_ID = "8438bdcd-b4b6-412c-8a54-0dcdb6636289";
  const HEAL_COST_GOLD = 1;
  const { data: relaxingWatersStockRow } = await supabase
    .from("global_warehouse")
    .select("quantity")
    .eq("item_id", RELAXING_WATER_ITEM_ID)
    .maybeSingle();
  const { data: relaxingWaterItem } = await supabase
    .from("items")
    .select("icon_path")
    .eq("id", RELAXING_WATER_ITEM_ID)
    .maybeSingle();
  const { data: goldInventoryRows } = await supabase
    .from("user_inventory")
    .select("quantity")
    .eq("profile_id", user.id)
    .eq("item_id", GOLD_ITEM_ID)
    .gt("quantity", 0);

  const fallbackName = user.email?.split("@")[0] ?? "Aventurero";
  const playerName = resolvePlayerName(profile?.miembro, fallbackName);
  const playerSpriteSrc = buildPlayerSpritePath(playerName);
  const playerFaceSrc = buildPlayerFacePath(playerName);
  const milestoneTitle = "Madera necesaria para armar el puesto:";
  const milestoneCurrentValue =
    typeof standMilestone?.current_value === "number" && Number.isFinite(standMilestone.current_value)
      ? Math.max(0, Math.trunc(standMilestone.current_value))
      : 0;
  const milestoneTargetValue =
    typeof standMilestone?.target_value === "number" && Number.isFinite(standMilestone.target_value)
      ? Math.max(1, Math.trunc(standMilestone.target_value))
      : 1;
  const milestoneProgressPercent = Math.min(
    100,
    Math.max(0, Math.round((milestoneCurrentValue / milestoneTargetValue) * 100)),
  );
  const hpActual =
    typeof userCharacter?.hp_actual === "number" && Number.isFinite(userCharacter.hp_actual)
      ? Math.max(0, Math.trunc(userCharacter.hp_actual))
      : 0;
  const hpTotal =
    typeof userCharacter?.hp_total === "number" && Number.isFinite(userCharacter.hp_total)
      ? Math.max(0, Math.trunc(userCharacter.hp_total))
      : 0;
  const manaActual =
    typeof userCharacter?.mana_actual === "number" && Number.isFinite(userCharacter.mana_actual)
      ? Math.max(0, Math.trunc(userCharacter.mana_actual))
      : 0;
  const manaTotal =
    typeof userCharacter?.mana_total === "number" && Number.isFinite(userCharacter.mana_total)
      ? Math.max(0, Math.trunc(userCharacter.mana_total))
      : 0;
  const isCharacterAlreadyFull = hpTotal > 0 && manaTotal > 0 && hpActual >= hpTotal && manaActual >= manaTotal;
  const relaxingWatersAvailable =
    typeof relaxingWatersStockRow?.quantity === "number" && Number.isFinite(relaxingWatersStockRow.quantity)
      ? Math.max(0, Math.trunc(relaxingWatersStockRow.quantity))
      : 0;
  const isNoBottleAvailable = relaxingWatersAvailable <= 0;
  const playerGoldAmount = (goldInventoryRows ?? []).reduce(
    (total, row) =>
      total +
      (typeof row.quantity === "number" && Number.isFinite(row.quantity)
        ? Math.max(0, Math.trunc(row.quantity))
        : 0),
    0,
  );
  const canPayGoldToHeal = playerGoldAmount >= HEAL_COST_GOLD;
  const showPayGoldHealButton = isNoBottleAvailable && !isCharacterAlreadyFull;
  const relaxingWaterIconSrc = resolveItemIconPath(relaxingWaterItem?.icon_path);
  const userWoodQuantity = (woodInventoryRows ?? []).reduce(
    (total, row) => total + (typeof row.quantity === "number" ? row.quantity : 0),
    0,
  );
  const woodIconSrc = resolveItemIconPath(woodItem?.icon_path);

  async function continueToGarrison() {
    "use server";
    const supabaseAction = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser();
    if (!currentUser) return { ok: false };

    const { data: updatedRows } = await supabaseAction
      .from("user_milestones")
      .update({ relaxing_water_stand_dialog: true })
      .eq("user_id", currentUser.id)
      .select("user_id");

    if (!updatedRows || updatedRows.length === 0) {
      await supabaseAction.from("user_milestones").insert({
        user_id: currentUser.id,
        relaxing_water_stand_dialog: true,
      });
    }

    return { ok: true };
  }

  async function contributeWood(amount: number) {
    "use server";

    const parsedAmount = Math.max(0, Math.floor(Number(amount) || 0));
    if (parsedAmount <= 0) {
      redirect("/relaxing_waters_stand");
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
      .eq("item_id", "ea5b9601-8a7d-4270-b5d9-cf292d49945e")
      .order("id", { ascending: true });

    const availableWood = (inventoryRows ?? []).reduce(
      (total, row) => total + (typeof row.quantity === "number" ? row.quantity : 0),
      0,
    );
    const amountToApply = Math.min(parsedAmount, availableWood);
    if (amountToApply <= 0) {
      redirect("/relaxing_waters_stand");
    }

    let pendingDiscount = amountToApply;
    for (const row of inventoryRows ?? []) {
      if (pendingDiscount <= 0) break;
      const rowQty = typeof row.quantity === "number" ? row.quantity : 0;
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

    const { data: globalMilestone } = await supabaseAction
      .from("global_milestones")
      .select("current_value, target_value, is_completed")
      .eq("id", 3)
      .eq("title", "aguas_termales_completadas")
      .maybeSingle();
    const currentGlobalValue =
      typeof globalMilestone?.current_value === "number" ? globalMilestone.current_value : 0;
    const targetGlobalValue =
      typeof globalMilestone?.target_value === "number" ? Math.max(1, globalMilestone.target_value) : 1;
    const alreadyCompleted = globalMilestone?.is_completed === true;
    const nextGlobalValue = currentGlobalValue + amountToApply;
    const shouldMarkCompleted = nextGlobalValue >= targetGlobalValue;
    await supabaseAction
      .from("global_milestones")
      .update({
        current_value: nextGlobalValue,
        is_completed: shouldMarkCompleted ? true : undefined,
        completed_at: shouldMarkCompleted && !alreadyCompleted ? new Date().toISOString() : undefined,
      })
      .eq("id", 3)
      .eq("title", "aguas_termales_completadas");
    if (shouldMarkCompleted && !alreadyCompleted) {
      await insertWorldEventLog(supabaseAction, currentUser.id, {
        happened_at: new Date().toISOString(),
        member_name: "world",
        event_html:
          '<span style="color:#22c55e;font-weight:700;">¡Objetivo completado: Puesto de Aguas Relajantes Construido!</span>',
      });
    }
    const { data: currentStats } = await supabaseAction
      .from("user_stats")
      .select("wood_given")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    const currentWoodGiven =
      typeof currentStats?.wood_given === "number" && Number.isFinite(currentStats.wood_given)
        ? Math.max(0, Math.trunc(currentStats.wood_given))
        : 0;
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
    const fallbackCurrentName = currentUser.email?.split("@")[0] ?? "Aventurero";
    const memberName = capitalizeFirst(resolvePlayerName(currentProfile?.miembro, fallbackCurrentName));
    const memberColor = currentProfile?.color?.trim() || "#f8fafc";
    const safeMemberName = escapeHtml(memberName);
    const eventHtml = `<span style="color:${memberColor}">${safeMemberName}</span> aportó ${amountToApply} de madera para la contrucción del <strong>Puesto de Aguas Relajantes</strong>.`;
    await insertWorldEventLog(supabaseAction, currentUser.id, {
      happened_at: new Date().toISOString(),
      member_name: memberName,
      event_html: eventHtml,
    });

    redirect("/relaxing_waters_stand");
  }

  async function takeOneBottle() {
    "use server";
    const supabaseAction = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser();
    if (!currentUser) {
      redirect("/login");
    }
    const { data: stockRow } = await supabaseAction
      .from("global_warehouse")
      .select("quantity")
      .eq("item_id", RELAXING_WATER_ITEM_ID)
      .maybeSingle();
    const currentStock =
      typeof stockRow?.quantity === "number" && Number.isFinite(stockRow.quantity)
        ? Math.max(0, Math.trunc(stockRow.quantity))
        : 0;
    if (currentStock <= 0) {
      redirect("/relaxing_waters_stand");
    }

    await supabaseAction
      .from("global_warehouse")
      .update({ quantity: currentStock - 1 })
      .eq("item_id", RELAXING_WATER_ITEM_ID);

    const { data: characterRow } = await supabaseAction
      .from("user_character")
      .select("hp_total, mana_total")
      .eq("profile_id", currentUser.id)
      .maybeSingle();
    if (characterRow) {
      const hpTotal =
        typeof characterRow.hp_total === "number" && Number.isFinite(characterRow.hp_total)
          ? Math.max(0, Math.trunc(characterRow.hp_total))
          : 0;
      const manaTotal =
        typeof characterRow.mana_total === "number" && Number.isFinite(characterRow.mana_total)
          ? Math.max(0, Math.trunc(characterRow.mana_total))
          : 0;
      await supabaseAction
        .from("user_character")
        .update({ hp_actual: hpTotal, mana_actual: manaTotal })
        .eq("profile_id", currentUser.id);
    }

    redirect("/relaxing_waters_stand");
  }

  async function healPayingGold() {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser();
    if (!currentUser) {
      redirect("/login");
    }

    const { data: goldRows } = await supabaseAction
      .from("user_inventory")
      .select("id, quantity")
      .eq("profile_id", currentUser.id)
      .eq("item_id", GOLD_ITEM_ID)
      .gt("quantity", 0)
      .order("id", { ascending: true });

    let totalGold = 0;
    for (const row of goldRows ?? []) {
      const qty =
        typeof row.quantity === "number" && Number.isFinite(row.quantity)
          ? Math.max(0, Math.trunc(row.quantity))
          : 0;
      totalGold += qty;
    }
    if (totalGold < HEAL_COST_GOLD) {
      redirect("/relaxing_waters_stand");
    }

    let pendingDiscount = HEAL_COST_GOLD;
    for (const row of goldRows ?? []) {
      if (pendingDiscount <= 0) break;
      const rowQty =
        typeof row.quantity === "number" && Number.isFinite(row.quantity)
          ? Math.max(0, Math.trunc(row.quantity))
          : 0;
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

    const { data: characterRow } = await supabaseAction
      .from("user_character")
      .select("hp_total, mana_total")
      .eq("profile_id", currentUser.id)
      .maybeSingle();
    if (characterRow) {
      const hpTotal =
        typeof characterRow.hp_total === "number" && Number.isFinite(characterRow.hp_total)
          ? Math.max(0, Math.trunc(characterRow.hp_total))
          : 0;
      const manaTotal =
        typeof characterRow.mana_total === "number" && Number.isFinite(characterRow.mana_total)
          ? Math.max(0, Math.trunc(characterRow.mana_total))
          : 0;
      await supabaseAction
        .from("user_character")
        .update({ hp_actual: hpTotal, mana_actual: manaTotal })
        .eq("profile_id", currentUser.id);
    }

    redirect("/relaxing_waters_stand");
  }

  if (standMilestone?.is_completed === true) {
    return (
      <main
        className={`relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-fixed bg-cover bg-center bg-no-repeat text-amber-50 ${uiFont.className}`}
        style={{
          backgroundImage:
            "linear-gradient(rgba(8, 18, 24, 0.42), rgba(6, 12, 18, 0.58)), url('/img/resources/background/bg_aguas_termales_base.png')",
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4">
          <Image
            src="/img/resources/characters/pj_nacho_seller.png"
            alt="Nacho vendedor"
            width={420}
            height={420}
            className="h-auto w-[350px] translate-x-25 translate-y-5 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] sm:w-[700px] sm:translate-x-100 sm:translate-y-50"
            priority
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 z-30 p-2 sm:p-5">
          <div className="relative mx-auto w-full max-w-3xl rounded-lg border border-cyan-700/70 bg-[#0f1e2a]/92 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-6 sm:py-4">
            <RelaxingWatersHelpButton />
            <p className="text-center text-xs leading-relaxed text-cyan-50 sm:text-sm">
              Nacho se está encargando de embotellar y traer agua del río para que puedan recuperar fuerzas.
            </p>
            <div className="mt-3 flex items-center justify-center gap-1 text-[11px] font-semibold text-cyan-100 sm:text-sm">
              <span>Aguas Relajantes disponibles: <span className="text-amber-200 text-[13px] font-bold">{relaxingWatersAvailable}</span></span>
              <Image
                src={relaxingWaterIconSrc}
                alt="Aguas relajantes"
                width={18}
                height={18}
                className="h-[30px] w-[30px] object-contain -translate-y-1"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              <div className="group relative">
                <form action={takeOneBottle}>
                  <button
                    type="submit"
                    disabled={isCharacterAlreadyFull || isNoBottleAvailable}
                    className={`rounded-md border px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] transition sm:text-xs ${
                      isCharacterAlreadyFull || isNoBottleAvailable
                        ? "cursor-not-allowed border-cyan-700/40 bg-cyan-950/40 text-cyan-200/60"
                        : "cursor-pointer border-cyan-500/80 bg-cyan-700/85 text-cyan-50 hover:bg-cyan-600/90"
                    }`}
                  >
                    TOMAR 1 BOTELLA
                  </button>
                </form>
                {isCharacterAlreadyFull ? (
                  <span className="pointer-events-none absolute -top-10 left-1/2 z-20 w-max -translate-x-1/2 rounded-md border border-cyan-700/70 bg-[#0f1e2a]/95 px-2 py-1 text-[10px] text-cyan-100 opacity-0 shadow-[0_8px_18px_rgba(0,0,0,0.35)] transition-opacity duration-150 group-active:opacity-100 sm:hidden">
                    Tu vida y tu mana están completos.
                  </span>
                ) : isNoBottleAvailable ? (
                  <span className="pointer-events-none absolute -top-10 left-1/2 z-20 w-max -translate-x-1/2 rounded-md border border-cyan-700/70 bg-[#0f1e2a]/95 px-1 py-1 text-[10px] text-cyan-100 opacity-0 shadow-[0_8px_18px_rgba(0,0,0,0.35)] transition-opacity duration-150 group-active:opacity-100 sm:hidden">
                    No quedan Aguas Relajantes disponibles.
                  </span>
                ) : null}
              </div>
              {showPayGoldHealButton ? (
                <div className="group relative">
                  <form action={healPayingGold}>
                    <button
                      type="submit"
                      disabled={!canPayGoldToHeal}
                      className={`rounded-md border px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] transition sm:text-sm ${
                        canPayGoldToHeal
                          ? "cursor-pointer border-amber-500/80 bg-amber-700/90 text-amber-50 hover:bg-amber-600/90"
                          : "cursor-not-allowed border-cyan-700/40 bg-cyan-950/40 text-cyan-200/60"
                      }`}
                    >
                      Curarse pagando 1 de oro
                    </button>
                  </form>
                  {!canPayGoldToHeal ? (
                    <span className="pointer-events-none absolute -top-10 left-1/2 z-20 w-max -translate-x-1/2 rounded-md border border-cyan-700/70 bg-[#0f1e2a]/95 px-2 py-1 text-[10px] text-cyan-100 opacity-0 shadow-[0_8px_18px_rgba(0,0,0,0.35)] transition-opacity duration-150 group-active:opacity-100 sm:hidden">
                      No tenés suficiente oro.
                    </span>
                  ) : null}
                </div>
              ) : null}
              <Link
                href="/garrison"
                className="rounded-md border border-amber-500/80 bg-amber-800/80 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-50 transition hover:bg-amber-700/90 sm:text-xs"
              >
                VOLVER AL CAMPAMENTO
              </Link>
            </div>
            <div className="mt-3 hidden justify-center sm:flex">
              <div className="inline-flex items-center gap-2 rounded-md border border-cyan-800/70 bg-black/20 px-2.5 py-1.5">
                <span className="text-[10px] text-cyan-100/90 sm:text-sm">
                  {isCharacterAlreadyFull
                    ? "Tu vida y tu mana están completos."
                    : isNoBottleAvailable
                      ? canPayGoldToHeal
                        ? "No quedan botellas. Podés curarte pagando 1 de oro."
                        : "No quedan botellas y no tenés oro suficiente para curarte."
                      : "Podés tomar una botella para recuperar vida y mana."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (milestones?.relaxing_water_stand_dialog === true) {
    return (
      <div
        className={`relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#120b08] text-amber-50 ${uiFont.className}`}
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.62)), url('/img/resources/background/bg_first_base.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl items-center justify-center p-4 lg:p-8">
          <section className="w-full max-w-3xl rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm lg:p-6">
            <div
              className={`relative rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-4 text-center lg:p-5 ${dialogueFont.className}`}
            >
              <RelaxingWatersHelpButton />
              <p className="text-center text-[11px] leading-relaxed text-slate-800 lg:text-base">
                Nacho tiene la idea de levantar un puesto de aguas del río para tener más a mano la recuperación. <br /> Él
                se va a encargar de embotellarla y traerla hasta acá, pero tenemos que ayudarlo a construir el
                puesto.
              </p>
              <div className="mt-8 rounded-lg border border-[#9f8352]/80 bg-[#d8c7a2]/92 lg:mt-12">
                <p className="mt-2 text-center text-sm font-semibold leading-relaxed text-slate-900 lg:text-base">
                  {milestoneTitle}
                </p>
                <div className="mx-auto mt-3 h-4 w-3/5 max-w-2xl overflow-hidden rounded-full border border-[#9b7a46]/80 bg-[#e8d8b4]">
                  <div
                    className="h-full bg-gradient-to-r from-lime-500 to-emerald-600 transition-all duration-500"
                    style={{ width: `${milestoneProgressPercent}%` }}
                  />
                </div>
                <p className="mt-2 mb-2 text-center text-xs uppercase tracking-wide text-slate-700">
                  {milestoneCurrentValue} / {milestoneTargetValue} ({milestoneProgressPercent}%)
                </p>
              </div>
              <div className="mt-10 flex items-center justify-center gap-2 text-sm font-semibold leading-relaxed text-slate-700 lg:text-base">
                <p>Tenés disponible: {userWoodQuantity}</p>
                <Image
                  src={woodIconSrc}
                  alt="Madera"
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] object-contain"
                />
              </div>
              <WoodAmountSelector maxAmount={userWoodQuantity} onContribute={contributeWood} />
              <div className="mt-8 flex justify-center">
                <Link
                  href="/garrison"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-3 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] lg:text-xs"
                >
                  <span className="text-base leading-none" aria-hidden>
                    ←
                  </span>
                  volver al campamento
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <RelaxingWatersStandStory
      playerName={playerName}
      playerSpriteSrc={playerSpriteSrc}
      playerFaceSrc={playerFaceSrc}
      onContinue={continueToGarrison}
    />
  );
}
