import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { WoodAmountSelector } from "@/components/campsite/wood-amount-selector";
import { resolveEquippedWeaponSprites } from "@/lib/equipped-weapon-sprites";
import { createClient } from "@/lib/supabase/server";
import { insertWorldEventLog } from "@/lib/world-event-log";
import { SoulAltarGloballyCompletedPanel } from "./soul-altar-globally-completed-panel";
import { SoulAltarScene } from "./soul-altar-scene";

const STONE_FALLBACK_ICON = "/img/resources/items/resource_rock.png";
const GOLD_ITEM_ID = "8438bdcd-b4b6-412c-8a54-0dcdb6636289";
const GOLD_FALLBACK_ICON = "/img/resources/items/resource_gold.png";
const SOUL_FALLBACK_ICON = "/img/resources/items/resource_soul_fragment.png";
/** Dorado legible sobre el fondo oscuro del diario de eventos globales. */
const WORLD_EVENT_ALTAR_JOURNAL_GOLD = "#e8c060";
const SOUL_ALTAR_MATERIAL_TITLES = {
  stone: "soul_altar_piedra",
  gold: "soul_altar_oro",
  souls: "soul_altar_souls",
} as const;
const SOUL_ALTAR_COMPLETED_TITLE = "soul_altar_completed";
const INVENTORY_BAG_SLOT_LIMIT = 24;
const RECONSTRUCT_SOUL_GOLD_COST = 50;
const RECONSTRUCT_SOUL_FRAGMENT_COST = 1;
const REBIRTH_SOUL_FRAGMENT_COST = 10;

type SoulAltarMaterialKind = keyof typeof SOUL_ALTAR_MATERIAL_TITLES;

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});
const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Altar de Almas",
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

async function resolveSoulAltarMaterialItemId(kind: SoulAltarMaterialKind): Promise<string | null> {
  if (kind === "gold") return GOLD_ITEM_ID;

  const supabase = await createClient();
  const query =
    kind === "stone"
      ? "icon_path.ilike.%resource_rock%,name.ilike.%piedra%,name.ilike.%stone%"
      : "icon_path.ilike.%resource_soul_fragment%,name.ilike.%soul%,name.ilike.%alma%";
  const { data: item } = await supabase.from("items").select("id").or(query).limit(1).maybeSingle();
  return typeof item?.id === "string" ? item.id : null;
}

async function contributeSoulAltarMaterial(amount: number, kind: SoulAltarMaterialKind) {
  const parsedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (parsedAmount <= 0) {
    redirect("/soul-altar");
  }

  const supabaseAction = await createClient();
  const {
    data: { user: currentUser },
  } = await supabaseAction.auth.getUser();

  if (!currentUser) {
    redirect("/login");
  }

  const itemId = await resolveSoulAltarMaterialItemId(kind);
  if (!itemId) {
    redirect("/soul-altar");
  }

  const { data: inventoryRows } = await supabaseAction
    .from("user_inventory")
    .select("id, quantity")
    .eq("profile_id", currentUser.id)
    .eq("item_id", itemId)
    .order("id", { ascending: true });
  const availableAmount = (inventoryRows ?? []).reduce(
    (total, row) => total + Math.max(0, Math.trunc(num(row.quantity, 0))),
    0,
  );

  const { data: globalMilestone } = await supabaseAction
    .from("global_milestones")
    .select("id, current_value, target_value, is_completed")
    .eq("title", SOUL_ALTAR_MATERIAL_TITLES[kind])
    .maybeSingle();
  if (!globalMilestone) {
    redirect("/soul-altar");
  }

  const currentGlobalValue = Math.max(0, Math.trunc(num(globalMilestone.current_value, 0)));
  const targetGlobalValue = Math.max(1, Math.trunc(num(globalMilestone.target_value, 1)));
  const remainingNeeded = Math.max(0, targetGlobalValue - currentGlobalValue);
  const amountToApply = Math.min(parsedAmount, availableAmount, remainingNeeded);
  if (amountToApply <= 0) {
    redirect("/soul-altar");
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
    .eq("title", SOUL_ALTAR_MATERIAL_TITLES[kind]);

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
  const safeMemberColor = escapeHtml(memberColor);
  const materialLogLabel =
    kind === "stone" ? "Piedra" : kind === "gold" ? "Oro" : "Fragmentos de Alma";
  const eventHtml = `<span style="color:${safeMemberColor}">${safeMemberName}</span> aportó ${amountToApply} de ${materialLogLabel} para el Altar de las Almas.`;
  await insertWorldEventLog(supabaseAction, currentUser.id, {
    happened_at: new Date().toISOString(),
    member_name: memberName,
    event_html: eventHtml,
  });

  const { data: materialMilestones } = await supabaseAction
    .from("global_milestones")
    .select("title, current_value, target_value, is_completed")
    .in("title", Object.values(SOUL_ALTAR_MATERIAL_TITLES));
  const allMaterialsCompleted = Object.values(SOUL_ALTAR_MATERIAL_TITLES).every((title) => {
    const row = (materialMilestones ?? []).find((entry) => entry.title === title);
    if (!row) return false;
    const current = Math.max(0, Math.trunc(num(row.current_value, 0)));
    const target = Math.max(1, Math.trunc(num(row.target_value, 1)));
    return row.is_completed === true || current >= target;
  });

  if (allMaterialsCompleted) {
    const { data: completedRows } = await supabaseAction
      .from("global_milestones")
      .update({
        current_value: 1,
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq("title", SOUL_ALTAR_COMPLETED_TITLE)
      .or("is_completed.is.false,is_completed.is.null")
      .select("id");
    if (completedRows && completedRows.length > 0) {
      await insertWorldEventLog(supabaseAction, currentUser.id, {
        happened_at: new Date().toISOString(),
        member_name: "world",
        event_html:
          '<span style="color:#22c55e;font-weight:700;">¡Objetivo completado: Altar de Almas Construido!</span>',
      });
    }
  }

  redirect("/soul-altar");
}

export default async function SoulAltarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: userCharacter } = await supabase
    .from("user_character")
    .select("character_name")
    .eq("profile_id", user.id)
    .maybeSingle();
  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("miembro")
    .eq("id", user.id)
    .maybeSingle();
  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("soul_altar_dialog")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: soulAltarCompletedRow } = await supabase
    .from("global_milestones")
    .select("title, current_value, target_value, is_completed")
    .eq("title", SOUL_ALTAR_COMPLETED_TITLE)
    .maybeSingle();
  const soulAltarCompletedTitleMatches =
    typeof soulAltarCompletedRow?.title === "string" &&
    soulAltarCompletedRow.title.trim().toLowerCase() === SOUL_ALTAR_COMPLETED_TITLE;
  const isSoulAltarGloballyCompleted =
    soulAltarCompletedTitleMatches && milestoneProgress(soulAltarCompletedRow).isCompleted;

  let hasInventorySpaceForSoulReconstruct = true;
  if (isSoulAltarGloballyCompleted) {
    const { data: allInventoryRows } = await supabase
      .from("user_inventory")
      .select("id")
      .eq("profile_id", user.id)
      .gt("quantity", 0);
    hasInventorySpaceForSoulReconstruct =
      (allInventoryRows ?? []).length <= INVENTORY_BAG_SLOT_LIMIT;
  }

  const { data: soulAltarMilestones } = await supabase
    .from("global_milestones")
    .select("id, title, current_value, target_value, is_completed")
    .in("title", Object.values(SOUL_ALTAR_MATERIAL_TITLES));
  const { data: stoneItem } = await supabase
    .from("items")
    .select("id, icon_path")
    .or("icon_path.ilike.%resource_rock%,name.ilike.%piedra%,name.ilike.%stone%")
    .limit(1)
    .maybeSingle();
  const { data: goldItem } = await supabase
    .from("items")
    .select("id, icon_path")
    .eq("id", GOLD_ITEM_ID)
    .maybeSingle();
  const { data: soulItem } = await supabase
    .from("items")
    .select("id, icon_path")
    .or("icon_path.ilike.%resource_soul_fragment%,name.ilike.%soul%,name.ilike.%alma%")
    .limit(1)
    .maybeSingle();
  const stoneItemId = typeof stoneItem?.id === "string" ? stoneItem.id : null;
  const goldItemId = typeof goldItem?.id === "string" ? goldItem.id : GOLD_ITEM_ID;
  const soulItemId = typeof soulItem?.id === "string" ? soulItem.id : null;
  const materialItemIds = Array.from(
    new Set([stoneItemId, goldItemId, soulItemId].filter((value): value is string => Boolean(value))),
  );
  const { data: materialInventoryRows } = materialItemIds.length > 0
    ? await supabase
        .from("user_inventory")
        .select("item_id, quantity")
        .eq("profile_id", user.id)
        .in("item_id", materialItemIds)
    : { data: [] };
  const fallbackName = user.email?.split("@")[0] ?? "Aventurero";
  const playerName = resolvePlayerName(
    userCharacter?.character_name,
    resolvePlayerName(userProfile?.miembro, fallbackName),
  );
  const shouldShowSoulAltarIntro =
    !isSoulAltarGloballyCompleted && milestones?.soul_altar_dialog !== true;
  const soulAltarMilestoneByTitle = new Map(
    (soulAltarMilestones ?? []).map((row) => [String(row.title), row]),
  );
  const materialQuantityByItemId = new Map<string, number>();
  for (const row of materialInventoryRows ?? []) {
    const itemId = typeof row.item_id === "string" ? row.item_id : "";
    if (!itemId) continue;
    materialQuantityByItemId.set(
      itemId,
      (materialQuantityByItemId.get(itemId) ?? 0) + Math.max(0, Math.trunc(num(row.quantity, 0))),
    );
  }
  const stoneIconSrc = resolveItemIconPath(stoneItem?.icon_path, STONE_FALLBACK_ICON);
  const goldIconSrc = resolveItemIconPath(goldItem?.icon_path, GOLD_FALLBACK_ICON);
  const soulIconSrc = resolveItemIconPath(soulItem?.icon_path, SOUL_FALLBACK_ICON);

  async function completeSoulAltarDialog() {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser();

    if (!currentUser) return { ok: false };

    const { data: updatedRows } = await supabaseAction
      .from("user_milestones")
      .update({ soul_altar_dialog: true })
      .eq("user_id", currentUser.id)
      .select("user_id");

    if (!updatedRows || updatedRows.length === 0) {
      await supabaseAction.from("user_milestones").insert({
        user_id: currentUser.id,
        soul_altar_dialog: true,
      });
    }

    return { ok: true };
  }

  async function contributeSoulAltarStone(amount: number) {
    "use server";
    await contributeSoulAltarMaterial(amount, "stone");
  }

  async function contributeSoulAltarGold(amount: number) {
    "use server";
    await contributeSoulAltarMaterial(amount, "gold");
  }

  async function contributeSoulAltarSouls(amount: number) {
    "use server";
    await contributeSoulAltarMaterial(amount, "souls");
  }

  const soulAltarMaterialCards = [
    {
      title: SOUL_ALTAR_MATERIAL_TITLES.stone,
      label: "Piedra:",
      materialName: "piedra",
      iconSrc: stoneIconSrc,
      available: stoneItemId ? (materialQuantityByItemId.get(stoneItemId) ?? 0) : 0,
      progress: milestoneProgress(soulAltarMilestoneByTitle.get(SOUL_ALTAR_MATERIAL_TITLES.stone)),
      barClassName: "from-stone-500 to-slate-500",
      onContribute: contributeSoulAltarStone,
    },
    {
      title: SOUL_ALTAR_MATERIAL_TITLES.gold,
      label: "Oro:",
      materialName: "oro",
      iconSrc: goldIconSrc,
      available: materialQuantityByItemId.get(goldItemId) ?? 0,
      progress: milestoneProgress(soulAltarMilestoneByTitle.get(SOUL_ALTAR_MATERIAL_TITLES.gold)),
      barClassName: "from-amber-400 to-yellow-600",
      onContribute: contributeSoulAltarGold,
    },
    {
      title: SOUL_ALTAR_MATERIAL_TITLES.souls,
      label: "Fragmentos de alma:",
      materialName: "fragmentos de alma",
      iconSrc: soulIconSrc,
      available: soulItemId ? (materialQuantityByItemId.get(soulItemId) ?? 0) : 0,
      progress: milestoneProgress(soulAltarMilestoneByTitle.get(SOUL_ALTAR_MATERIAL_TITLES.souls)),
      barClassName: "from-violet-500 to-fuchsia-600",
      onContribute: contributeSoulAltarSouls,
    },
  ];

  async function reconstructSoulAtAltar() {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser();

    if (!currentUser) {
      throw new Error("No estás autenticado.");
    }

    const { data: doneRow } = await supabaseAction
      .from("global_milestones")
      .select("title, current_value, target_value, is_completed")
      .eq("title", SOUL_ALTAR_COMPLETED_TITLE)
      .maybeSingle();
    const titleOk =
      typeof doneRow?.title === "string" &&
      doneRow.title.trim().toLowerCase() === SOUL_ALTAR_COMPLETED_TITLE;
    if (!titleOk || !milestoneProgress(doneRow).isCompleted) {
      throw new Error("El Altar de Almas no está construido.");
    }

    const { data: allInventoryRows } = await supabaseAction
      .from("user_inventory")
      .select("id")
      .eq("profile_id", currentUser.id)
      .gt("quantity", 0);
    const totalInventoryRows = (allInventoryRows ?? []).filter(
      (row) => typeof row.id === "number" && Number.isFinite(row.id),
    ).length;
    if (totalInventoryRows > INVENTORY_BAG_SLOT_LIMIT) {
      throw new Error(
        "Necesitás espacio en el inventario para depositar tus objetos equipados (máximo 24 ítems en total en la bolsa).",
      );
    }

    const goldItemIdResolved = await resolveSoulAltarMaterialItemId("gold");
    const soulItemIdResolved = await resolveSoulAltarMaterialItemId("souls");
    if (!goldItemIdResolved || !soulItemIdResolved) {
      throw new Error("No se pudieron resolver los ítems de costo.");
    }

    const { data: goldInvRows } = await supabaseAction
      .from("user_inventory")
      .select("id, quantity")
      .eq("profile_id", currentUser.id)
      .eq("item_id", goldItemIdResolved)
      .order("id", { ascending: true });
    const { data: soulInvRows } = await supabaseAction
      .from("user_inventory")
      .select("id, quantity")
      .eq("profile_id", currentUser.id)
      .eq("item_id", soulItemIdResolved)
      .order("id", { ascending: true });

    const goldAvailable = (goldInvRows ?? []).reduce(
      (total, row) => total + Math.max(0, Math.trunc(num(row.quantity, 0))),
      0,
    );
    const soulAvailable = (soulInvRows ?? []).reduce(
      (total, row) => total + Math.max(0, Math.trunc(num(row.quantity, 0))),
      0,
    );
    if (goldAvailable < RECONSTRUCT_SOUL_GOLD_COST || soulAvailable < RECONSTRUCT_SOUL_FRAGMENT_COST) {
      throw new Error("No tenés suficientes materiales para pagar el coste.");
    }

    let pendingGold = RECONSTRUCT_SOUL_GOLD_COST;
    for (const row of goldInvRows ?? []) {
      if (pendingGold <= 0) break;
      const rowQty = Math.max(0, Math.trunc(num(row.quantity, 0)));
      if (rowQty <= 0) continue;
      const deduct = Math.min(rowQty, pendingGold);
      const nextQty = rowQty - deduct;
      if (nextQty <= 0) {
        await supabaseAction.from("user_inventory").delete().eq("id", row.id);
      } else {
        await supabaseAction.from("user_inventory").update({ quantity: nextQty }).eq("id", row.id);
      }
      pendingGold -= deduct;
    }

    let pendingSoul = RECONSTRUCT_SOUL_FRAGMENT_COST;
    for (const row of soulInvRows ?? []) {
      if (pendingSoul <= 0) break;
      const rowQty = Math.max(0, Math.trunc(num(row.quantity, 0)));
      if (rowQty <= 0) continue;
      const deduct = Math.min(rowQty, pendingSoul);
      const nextQty = rowQty - deduct;
      if (nextQty <= 0) {
        await supabaseAction.from("user_inventory").delete().eq("id", row.id);
      } else {
        await supabaseAction.from("user_inventory").update({ quantity: nextQty }).eq("id", row.id);
      }
      pendingSoul -= deduct;
    }

    const { error: delEquipError } = await supabaseAction
      .from("user_equipment")
      .delete()
      .eq("profile_id", currentUser.id);
    if (delEquipError) {
      throw new Error(`No se pudo desequipar el equipo: ${delEquipError.message}`);
    }

    const { data: charRow } = await supabaseAction
      .from("user_character")
      .select("class_name, character_name, stat_points_totales")
      .eq("profile_id", currentUser.id)
      .maybeSingle();

    if (!charRow) {
      throw new Error("No se encontró el personaje.");
    }

    const rawClass =
      typeof charRow.class_name === "string" && charRow.class_name.trim().length > 0
        ? charRow.class_name.trim()
        : "";
    if (!rawClass) {
      throw new Error("El personaje no tiene clase asignada.");
    }

    let { data: classData } = await supabaseAction
      .from("classes")
      .select("str, dex, int, wis")
      .eq("id", rawClass)
      .maybeSingle();

    if (!classData) {
      const { data: classByName } = await supabaseAction
        .from("classes")
        .select("str, dex, int, wis")
        .eq("name", rawClass)
        .maybeSingle();
      classData = classByName;
    }

    if (!classData) {
      throw new Error("No se encontró la definición de la clase.");
    }

    const pointsTotales = Math.max(0, Math.trunc(num(charRow.stat_points_totales, 0)));
    const baseStr = Math.max(0, Math.trunc(num(classData.str, 0)));
    const baseDex = Math.max(0, Math.trunc(num(classData.dex, 0)));
    const baseInt = Math.max(0, Math.trunc(num(classData.int, 0)));
    const baseWis = Math.max(0, Math.trunc(num(classData.wis, 0)));

    const sprites = resolveEquippedWeaponSprites(
      typeof charRow.character_name === "string" ? charRow.character_name : null,
      null,
    );

    const { error: bumpError } = await supabaseAction
      .from("user_character")
      .update({
        str: baseStr,
        dex: baseDex,
        int: baseInt,
        wis: baseWis,
        str_mod: 0,
        dex_mod: 0,
        int_mod: 0,
        wis_mod: 0,
        active_combat_sprite: sprites.active_combat_sprite,
        active_still_sprite: sprites.active_still_sprite,
        stat_points_remaining: pointsTotales,
      })
      .eq("profile_id", currentUser.id);
    if (bumpError) {
      throw new Error(`No se pudo actualizar el personaje: ${bumpError.message}`);
    }

    const { data: currentProfile } = await supabaseAction
      .from("user_profiles")
      .select("miembro, color")
      .eq("id", currentUser.id)
      .maybeSingle();
    const fallbackCurrentName = currentUser.email?.split("@")[0] ?? "Aventurero";
    const memberName = capitalizeFirst(
      resolvePlayerName(
        typeof charRow.character_name === "string" ? charRow.character_name : null,
        resolvePlayerName(currentProfile?.miembro, fallbackCurrentName),
      ),
    );
    const memberColor = currentProfile?.color?.trim() || "#f8fafc";
    const safeMemberName = escapeHtml(memberName);
    const safeMemberColor = escapeHtml(memberColor);
    const eventHtml = `<img src="${SOUL_FALLBACK_ICON}" alt="" width="18" height="18" style="display:inline-block;vertical-align:text-bottom;margin-right:4px;" /> <span style="color:${safeMemberColor}">${safeMemberName}</span> llevó adelante la reconstrucción de su alma.`;
    await insertWorldEventLog(supabaseAction, currentUser.id, {
      happened_at: new Date().toISOString(),
      member_name: memberName,
      event_html: eventHtml,
    });

    revalidatePath("/soul-altar");
    revalidatePath("/character_profile");
    redirect("/character_profile");
  }

  async function rebirthAtAltar() {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser();

    if (!currentUser) {
      throw new Error("No estás autenticado.");
    }

    const { data: doneRow } = await supabaseAction
      .from("global_milestones")
      .select("title, current_value, target_value, is_completed")
      .eq("title", SOUL_ALTAR_COMPLETED_TITLE)
      .maybeSingle();
    const titleOk =
      typeof doneRow?.title === "string" &&
      doneRow.title.trim().toLowerCase() === SOUL_ALTAR_COMPLETED_TITLE;
    if (!titleOk || !milestoneProgress(doneRow).isCompleted) {
      throw new Error("El Altar de Almas no está construido.");
    }

    const { data: allInventoryRows } = await supabaseAction
      .from("user_inventory")
      .select("id")
      .eq("profile_id", currentUser.id)
      .gt("quantity", 0);
    const totalInventoryRows = (allInventoryRows ?? []).filter(
      (row) => typeof row.id === "number" && Number.isFinite(row.id),
    ).length;
    if (totalInventoryRows > INVENTORY_BAG_SLOT_LIMIT) {
      throw new Error(
        "Necesitás espacio en el inventario para depositar tus objetos equipados (máximo 24 ítems en total en la bolsa).",
      );
    }

    const soulItemIdResolved = await resolveSoulAltarMaterialItemId("souls");
    if (!soulItemIdResolved) {
      throw new Error("No se pudieron resolver los ítems de costo.");
    }

    const { data: soulInvRows } = await supabaseAction
      .from("user_inventory")
      .select("id, quantity")
      .eq("profile_id", currentUser.id)
      .eq("item_id", soulItemIdResolved)
      .order("id", { ascending: true });

    const soulAvailable = (soulInvRows ?? []).reduce(
      (total, row) => total + Math.max(0, Math.trunc(num(row.quantity, 0))),
      0,
    );
    if (soulAvailable < REBIRTH_SOUL_FRAGMENT_COST) {
      throw new Error("No tenés suficientes Fragmentos de Alma para el Renacimiento.");
    }

    let pendingSoul = REBIRTH_SOUL_FRAGMENT_COST;
    for (const row of soulInvRows ?? []) {
      if (pendingSoul <= 0) break;
      const rowQty = Math.max(0, Math.trunc(num(row.quantity, 0)));
      if (rowQty <= 0) continue;
      const deduct = Math.min(rowQty, pendingSoul);
      const nextQty = rowQty - deduct;
      if (nextQty <= 0) {
        await supabaseAction.from("user_inventory").delete().eq("id", row.id);
      } else {
        await supabaseAction.from("user_inventory").update({ quantity: nextQty }).eq("id", row.id);
      }
      pendingSoul -= deduct;
    }

    const { error: delEquipError } = await supabaseAction
      .from("user_equipment")
      .delete()
      .eq("profile_id", currentUser.id);
    if (delEquipError) {
      throw new Error(`No se pudo desequipar el equipo: ${delEquipError.message}`);
    }

    const { data: charRow } = await supabaseAction
      .from("user_character")
      .select("character_name, stat_points_totales")
      .eq("profile_id", currentUser.id)
      .maybeSingle();

    if (!charRow) {
      throw new Error("No se encontró el personaje.");
    }

    const { error: delSkillsError } = await supabaseAction
      .from("user_character_skills")
      .delete()
      .eq("profile_id", currentUser.id);
    if (delSkillsError) {
      throw new Error(`No se pudieron quitar las habilidades del personaje: ${delSkillsError.message}`);
    }

    const pointsTotales = Math.max(0, Math.trunc(num(charRow.stat_points_totales, 0)));
    const sprites = resolveEquippedWeaponSprites(
      typeof charRow.character_name === "string" ? charRow.character_name : null,
      null,
    );

    const { error: bumpError } = await supabaseAction
      .from("user_character")
      .update({
        class_name: null,
        str_mod: 0,
        dex_mod: 0,
        int_mod: 0,
        wis_mod: 0,
        active_combat_sprite: sprites.active_combat_sprite,
        active_still_sprite: sprites.active_still_sprite,
        stat_points_remaining: pointsTotales,
      })
      .eq("profile_id", currentUser.id);
    if (bumpError) {
      throw new Error(`No se pudo actualizar el personaje: ${bumpError.message}`);
    }

    await supabaseAction.from("user_milestones").update({ class_selected: false }).eq("user_id", currentUser.id);

    const { data: rebirthProfile } = await supabaseAction
      .from("user_profiles")
      .select("miembro, color")
      .eq("id", currentUser.id)
      .maybeSingle();
    const fallbackRebirthName = currentUser.email?.split("@")[0] ?? "Aventurero";
    const rebirthMemberName = capitalizeFirst(
      resolvePlayerName(
        typeof charRow.character_name === "string" ? charRow.character_name : null,
        resolvePlayerName(rebirthProfile?.miembro, fallbackRebirthName),
      ),
    );
    const rebirthMemberColor = rebirthProfile?.color?.trim() || "#f8fafc";
    const safeRebirthName = escapeHtml(rebirthMemberName);
    const safeRebirthColor = escapeHtml(rebirthMemberColor);
    const safeJournalGold = escapeHtml(WORLD_EVENT_ALTAR_JOURNAL_GOLD);
    const rebirthEventHtml = `<span style="color:${safeJournalGold};"><img src="${SOUL_FALLBACK_ICON}" alt="" width="18" height="18" style="display:inline-block;vertical-align:text-bottom;margin-right:4px;" />¡</span><span style="color:${safeRebirthColor};">${safeRebirthName}</span><span style="color:${safeJournalGold};"> ha renacido en el Altar de Almas!</span>`;
    await insertWorldEventLog(supabaseAction, currentUser.id, {
      happened_at: new Date().toISOString(),
      member_name: rebirthMemberName,
      event_html: rebirthEventHtml,
    });

    revalidatePath("/");
    revalidatePath("/soul-altar");
    revalidatePath("/class-selection");
    revalidatePath("/character_profile");
    redirect("/class-selection");
  }

  const soulAltarPageBackgroundImage = isSoulAltarGloballyCompleted
    ? "url('/img/resources/background/bg_altar_base.png')"
    : "url('/img/resources/background/bg_second_base.png')";

  return (
    <div
      className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-slate-950 text-amber-50"
      style={{
        backgroundImage: soulAltarPageBackgroundImage,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {isSoulAltarGloballyCompleted ? (
        <>
          <div className="absolute inset-0 bg-black/65" aria-hidden />
          <main
            className={`${dialogueFont.className} relative z-10 mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-4xl items-center justify-center p-4 lg:p-8`}
          >
            <SoulAltarGloballyCompletedPanel
              goldOwned={materialQuantityByItemId.get(goldItemId) ?? 0}
              soulFragmentOwned={
                soulItemId ? (materialQuantityByItemId.get(soulItemId) ?? 0) : 0
              }
              hasInventorySpaceForReconstruct={hasInventorySpaceForSoulReconstruct}
              reconstructSoulAtAltar={reconstructSoulAtAltar}
              rebirthAtAltar={rebirthAtAltar}
            />
          </main>
        </>
      ) : shouldShowSoulAltarIntro ? (
        <SoulAltarScene playerName={playerName} onComplete={completeSoulAltarDialog} />
      ) : (
        <>
          <div className="absolute inset-0 bg-black/65" aria-hidden />
          <main
            className={`${dialogueFont.className} relative z-10 mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-4xl items-center justify-center p-4 lg:p-8`}
          >
            <section className="w-full max-w-3xl rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm lg:p-6">
              <div className="rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-4 text-center lg:p-5">
                <p className="text-[13px] leading-relaxed text-slate-800 sm:text-sm">
                  Leo te pidió una paga a cambio de contarte un secreto que descubrió. Te pidió cosas que ni siquiera sabías que existían. Traele todos los materiales si te da curiosidad saber de que se trata.
                </p>
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  {soulAltarMaterialCards.map((card) => {
                    const remainingNeeded = Math.max(0, card.progress.target - card.progress.current);
                    const maxContribution = Math.min(card.available, remainingNeeded);
                    return (
                      <div
                        key={card.title}
                        className="rounded-lg border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-3"
                      >
                        <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
                          {card.label}
                        </p>
                        <div className="mx-auto mt-3 h-4 w-4/5 max-w-2xl overflow-hidden rounded-full border border-[#9b7a46]/80 bg-[#e8d8b4]">
                          <div
                            className={`h-full bg-gradient-to-r ${card.barClassName} transition-all duration-500`}
                            style={{ width: `${card.progress.percent}%` }}
                          />
                        </div>
                        <p className="mb-2 mt-2 text-xs uppercase tracking-wide text-slate-700">
                          {card.progress.current} / {card.progress.target} ({card.progress.percent}
                          %)
                        </p>
                        <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold leading-relaxed text-slate-700 sm:text-base">
                          <p>Tenés: {card.available}</p>
                          <Image
                            src={card.iconSrc}
                            alt={card.materialName}
                            width={18}
                            height={18}
                            className="h-[18px] w-[18px] object-contain"
                          />
                        </div>
                        {card.progress.isCompleted ? (
                          <p className="mt-6 text-sm font-semibold text-emerald-800">
                            Objetivo completo.
                          </p>
                        ) : (
                          <WoodAmountSelector
                            maxAmount={maxContribution}
                            onContribute={card.onContribute}
                            materialName={card.materialName}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 flex justify-center">
                  <Link
                    href="/garrison"
                    className={`${uiFont.className} inline-flex items-center gap-1.5 rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-3 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] lg:text-xs`}
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
        </>
      )}
    </div>
  );
}
