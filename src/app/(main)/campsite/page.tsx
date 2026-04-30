import { CampsiteStory } from "@/components/campsite/campsite-story";
import { MilestoneCompletePanel } from "@/components/campsite/milestone-complete-panel";
import { WoodAmountSelector } from "@/components/campsite/wood-amount-selector";
import { createClient } from "@/lib/supabase/server";
import { Libre_Baskerville } from "next/font/google";
import Image from "next/image";
import { redirect } from "next/navigation";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
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

function buildPlayerSpritePath(playerName: string) {
  const normalizedName = playerName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  if (!normalizedName) {
    return "/img/resources/logos/logo_latia_rpg.png";
  }

  return `/img/resources/characters/pj_${normalizedName}_rpg_standing.png`;
}

function getNumericValue(
  record: Record<string, unknown>,
  keys: string[],
  fallback: number,
) {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
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

export default async function CampsitePage() {
  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasSupabaseEnv) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 px-6 py-10 text-slate-100">
        <main className="mx-auto w-full max-w-3xl rounded-xl border border-amber-700/40 bg-amber-950/30 p-6">
          <h1 className="text-2xl font-bold">Faltan variables de Supabase</h1>
          <p className="mt-3 text-amber-100">
            Configura <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en{" "}
            <code>.env.local</code>.
          </p>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("first_time_camp_entered")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: campMilestone } = await supabase
    .from("global_milestones")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("miembro")
    .eq("id", user.id)
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

  const fallbackName = user.email?.split("@")[0] ?? "Aventurero";
  const playerName = resolvePlayerName(profile?.miembro, fallbackName);
  const playerSpriteSrc = buildPlayerSpritePath(playerName);
  const isFirstTimeCampEntryPending =
    milestones?.first_time_camp_entered === false;
  const campMilestoneRecord = (campMilestone ?? {}) as Record<string, unknown>;
  const isMilestoneCompleted = campMilestoneRecord.is_completed === true;
  const milestoneCompletedAt =
    typeof campMilestoneRecord.completed_at === "string"
      ? campMilestoneRecord.completed_at
      : null;
  const milestoneTitle = "Madera aportada por la comunidad:";
  const milestoneCurrentValue = getNumericValue(
    campMilestoneRecord,
    ["current_value", "current", "progress_current", "value_current"],
    0,
  );
  const milestoneTargetValue = Math.max(
    1,
    getNumericValue(
      campMilestoneRecord,
      ["target_value", "target", "progress_target", "value_target"],
      1,
    ),
  );
  const milestoneProgressPercent = Math.min(
    100,
    Math.max(
      0,
      Math.round((milestoneCurrentValue / milestoneTargetValue) * 100),
    ),
  );
  const userWoodQuantity = (woodInventoryRows ?? []).reduce(
    (total, row) =>
      total + (typeof row.quantity === "number" ? row.quantity : 0),
    0,
  );
  const woodIconSrc = resolveItemIconPath(woodItem?.icon_path);

  async function completeFirstCampEntry() {
    "use server";

    const supabaseClient = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseClient.auth.getUser();

    if (!currentUser) {
      redirect("/login");
    }

    await supabaseClient
      .from("user_milestones")
      .update({ first_time_camp_entered: true })
      .eq("user_id", currentUser.id);

    redirect("/campsite");
  }

  async function contributeWood(amount: number) {
    "use server";

    const parsedAmount = Math.max(0, Math.floor(Number(amount) || 0));
    if (parsedAmount <= 0) {
      redirect("/campsite");
    }

    const supabaseClient = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseClient.auth.getUser();

    if (!currentUser) {
      redirect("/login");
    }

    const { data: inventoryRows } = await supabaseClient
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
      redirect("/campsite");
    }

    let pendingDiscount = amountToApply;
    for (const row of inventoryRows ?? []) {
      if (pendingDiscount <= 0) break;
      const rowQty = typeof row.quantity === "number" ? row.quantity : 0;
      if (rowQty <= 0) continue;
      const deduct = Math.min(rowQty, pendingDiscount);
      const nextQty = rowQty - deduct;
      await supabaseClient.from("user_inventory").update({ quantity: nextQty }).eq("id", row.id);
      pendingDiscount -= deduct;
    }

    const { data: globalMilestone } = await supabaseClient
      .from("global_milestones")
      .select("current_value, target_value, is_completed")
      .eq("id", 1)
      .maybeSingle();
    const currentGlobalValue =
      typeof globalMilestone?.current_value === "number" ? globalMilestone.current_value : 0;
    const targetGlobalValue =
      typeof globalMilestone?.target_value === "number" ? globalMilestone.target_value : 1;
    const alreadyCompleted = globalMilestone?.is_completed === true;
    const nextGlobalValue = currentGlobalValue + amountToApply;
    const shouldMarkCompleted = nextGlobalValue >= Math.max(1, targetGlobalValue);

    await supabaseClient
      .from("global_milestones")
      .update({
        current_value: nextGlobalValue,
        is_completed: shouldMarkCompleted ? true : undefined,
        completed_at: shouldMarkCompleted && !alreadyCompleted ? new Date().toISOString() : undefined,
      })
      .eq("id", 1);

    const { data: currentProfile } = await supabaseClient
      .from("user_profiles")
      .select("miembro, color")
      .eq("id", currentUser.id)
      .maybeSingle();
    const fallbackCurrentName = currentUser.email?.split("@")[0] ?? "Aventurero";
    const memberName = capitalizeFirst(resolvePlayerName(currentProfile?.miembro, fallbackCurrentName));
    const memberColor = currentProfile?.color?.trim() || "#f8fafc";
    const safeMemberName = escapeHtml(memberName);
    const eventHtml = `<span style="color:${memberColor}">${safeMemberName}</span> aportó ${amountToApply} de Madera para construir el campamento base.`;

    await supabaseClient.from("global_world_event_log").insert({
      member_name: memberName,
      event_html: eventHtml,
    });
    if (shouldMarkCompleted && !alreadyCompleted) {
      await supabaseClient.from("global_world_event_log").insert({
        member_name: "world",
        event_html: "¡Objetivo completado: Campamento Construido!",
      });
    }

    redirect("/campsite");
  }

  if (isFirstTimeCampEntryPending) {
    return (
      <CampsiteStory
        playerName={playerName}
        playerSpriteSrc={playerSpriteSrc}
        onViewContributions={completeFirstCampEntry}
      />
    );
  }

  return (
    <div
      className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#120b08] text-amber-50"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.62)), url('/img/resources/background/bg_intro_forest.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl items-center justify-center p-4 lg:p-8">
        <section className="w-full max-w-3xl rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm lg:p-6">
          <div
            className={`rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-4 lg:p-5 ${dialogueFont.className}`}
          >
            {isMilestoneCompleted ? (
              <MilestoneCompletePanel completedAtIso={milestoneCompletedAt} />
            ) : (
              <>
                <p className="text-center text-sm leading-relaxed text-slate-800 lg:text-base">
                  Los miembros de La Tia Pochas están juntando madera para armar
                  el primer campamento y protegerse de los peligros de este
                  mundo.
                </p>
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
                <p className="mt-10 text-center text-sm font-semibold leading-relaxed text-slate-900 lg:text-base">
                  {milestoneTitle}
                </p>

                <div className="mx-auto mt-3 h-4 w-3/5 max-w-2xl overflow-hidden rounded-full border border-[#9b7a46]/80 bg-[#e8d8b4]">
                  <div
                    className="h-full bg-gradient-to-r from-lime-500 to-emerald-600 transition-all duration-500"
                    style={{ width: `${milestoneProgressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-xs uppercase tracking-wide text-slate-700">
                  {milestoneCurrentValue} / {milestoneTargetValue} (
                  {milestoneProgressPercent}%)
                </p>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
