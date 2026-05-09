import { redirect } from "next/navigation";
import { WarehouseIntroDialogue } from "@/components/warehouse/warehouse-intro-dialogue";
import { WoodAmountSelector } from "@/components/campsite/wood-amount-selector";
import { createClient } from "@/lib/supabase/server";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
const BELOW_NAV = "h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden";
const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

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
export default async function WarehousePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("warehouse_dialog")
    .eq("user_id", user.id)
    .maybeSingle();

  const shouldShowIntroDialogue = milestones?.warehouse_dialog === false;
  const shouldShowWarehouseModal = milestones?.warehouse_dialog === true;

  const { data: warehouseMilestone } = await supabase
    .from("global_milestones")
    .select("id, title, current_value, target_value, is_completed")
    .eq("title", "warehouse_construido")
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

  const milestoneTitle = "Progreso del Warehouse:";
  const milestoneCurrentValue =
    typeof warehouseMilestone?.current_value === "number" &&
    Number.isFinite(warehouseMilestone.current_value)
      ? Math.max(0, Math.trunc(warehouseMilestone.current_value))
      : 0;
  const milestoneTargetValue =
    typeof warehouseMilestone?.target_value === "number" &&
    Number.isFinite(warehouseMilestone.target_value)
      ? Math.max(1, Math.trunc(warehouseMilestone.target_value))
      : 1;
  const milestoneProgressPercent = Math.min(
    100,
    Math.max(
      0,
      Math.round((milestoneCurrentValue / milestoneTargetValue) * 100),
    ),
  );
  const isWarehouseCompleted = warehouseMilestone?.is_completed === true;
  const userWoodQuantity = (woodInventoryRows ?? []).reduce(
    (total, row) =>
      total + (typeof row.quantity === "number" ? row.quantity : 0),
    0,
  );
  const woodIconSrc = (() => {
    if (!woodItem?.icon_path || typeof woodItem.icon_path !== "string") {
      return "/img/resources/logos/logo_latia_rpg.png";
    }
    const trimmedPath = woodItem.icon_path.trim();
    if (!trimmedPath) return "/img/resources/logos/logo_latia_rpg.png";
    if (
      trimmedPath.startsWith("/") ||
      trimmedPath.startsWith("http://") ||
      trimmedPath.startsWith("https://")
    ) {
      return trimmedPath;
    }
    return `/${trimmedPath}`;
  })();

  async function completeWarehouseDialog() {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser();
    if (!currentUser) {
      return { ok: false };
    }

    const { data: updatedRows } = await supabaseAction
      .from("user_milestones")
      .update({ warehouse_dialog: true })
      .eq("user_id", currentUser.id)
      .select("user_id");

    if (!updatedRows || updatedRows.length === 0) {
      await supabaseAction.from("user_milestones").insert({
        user_id: currentUser.id,
        warehouse_dialog: true,
      });
    }

    return { ok: true };
  }

  async function contributeWood(amount: number) {
    "use server";

    const parsedAmount = Math.max(0, Math.floor(Number(amount) || 0));
    if (parsedAmount <= 0) {
      redirect("/warehouse");
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
      (total, row) =>
        total + (typeof row.quantity === "number" ? row.quantity : 0),
      0,
    );
    const amountToApply = Math.min(parsedAmount, availableWood);
    if (amountToApply <= 0) {
      redirect("/warehouse");
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
        await supabaseAction
          .from("user_inventory")
          .update({ quantity: nextQty })
          .eq("id", row.id);
      }
      pendingDiscount -= deduct;
    }

    const { data: globalMilestone } = await supabaseAction
      .from("global_milestones")
      .select("id, current_value, target_value, is_completed")
      .eq("title", "warehouse_construido")
      .maybeSingle();

    const currentGlobalValue =
      typeof globalMilestone?.current_value === "number"
        ? globalMilestone.current_value
        : 0;
    const targetGlobalValue =
      typeof globalMilestone?.target_value === "number"
        ? Math.max(1, globalMilestone.target_value)
        : 1;
    const alreadyCompleted = globalMilestone?.is_completed === true;
    const nextGlobalValue = currentGlobalValue + amountToApply;
    const shouldMarkCompleted = nextGlobalValue >= targetGlobalValue;

    await supabaseAction
      .from("global_milestones")
      .update({
        current_value: nextGlobalValue,
        is_completed: shouldMarkCompleted ? true : undefined,
        completed_at:
          shouldMarkCompleted && !alreadyCompleted
            ? new Date().toISOString()
            : undefined,
      })
      .eq("title", "warehouse_construido");

    if (shouldMarkCompleted && !alreadyCompleted) {
      await supabaseAction.from("global_world_event_log").insert({
        happened_at: new Date().toISOString(),
        member_name: "world",
        event_html:
          '<span style="color:#22c55e;font-weight:700;">¡Objetivo completado: Warehouse Construido!</span>',
      });
    }

    const { data: currentStats } = await supabaseAction
      .from("user_stats")
      .select("wood_given")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    const currentWoodGiven =
      typeof currentStats?.wood_given === "number" &&
      Number.isFinite(currentStats.wood_given)
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

    const fallbackCurrentName =
      currentUser.email?.split("@")[0] ?? "Aventurero";
    const memberNameRaw =
      typeof currentProfile?.miembro === "string" &&
      currentProfile.miembro.trim().length > 0
        ? currentProfile.miembro.trim()
        : fallbackCurrentName;
    const memberName = capitalizeFirst(memberNameRaw);
    const memberColor =
      typeof currentProfile?.color === "string" &&
      currentProfile.color.trim().length > 0
        ? currentProfile.color.trim()
        : "#f8fafc";

    const safeMemberName = escapeHtml(memberName);
    const eventHtml = `<span style="color:${memberColor}">${safeMemberName}</span> aportó ${amountToApply} de madera para la contrucción del <strong>Warehouse</strong>.`;

    await supabaseAction.from("global_world_event_log").insert({
      happened_at: new Date().toISOString(),
      member_name: memberName,
      event_html: eventHtml,
    });

    redirect("/warehouse");
  }

  return (
    <div className={`relative w-full ${BELOW_NAV}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/img/resources/background/bg_first_base.png')",
        }}
      />
      {shouldShowIntroDialogue ? (
        <WarehouseIntroDialogue onComplete={completeWarehouseDialog} />
      ) : null}
      {shouldShowWarehouseModal ? (
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
                className={`rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-4 text-center lg:p-5 ${dialogueFont.className}`}
              >
                {isWarehouseCompleted ? (
                  <>
                    <p className="text-center text-[13px] leading-relaxed text-slate-800 lg:text-base">
                      El Warehouse es encuentra en construcción, volvé más
                      tarde.
                    </p>
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
                  </>
                ) : (
                  <>
                    <p className="text-center text-[13px] leading-relaxed text-slate-800 lg:text-base">
                      Mati puede encargarse de organizar el warehouse, pero
                      primero hay que construir los cofres.
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
                      <p className="mb-2 mt-2 text-center text-xs uppercase tracking-wide text-slate-700">
                        {milestoneCurrentValue} / {milestoneTargetValue} (
                        {milestoneProgressPercent}%)
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
                    <WoodAmountSelector
                      maxAmount={userWoodQuantity}
                      onContribute={contributeWood}
                    />
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
                  </>
                )}
              </div>
            </section>
          </main>
        </div>
      ) : null}
    </div>
  );
}
