import { RelaxingWatersStory } from "@/components/maps/relaxing-waters-story";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function resolvePlayerName(input: string | null | undefined, fallback: string) {
  const value = input?.trim();
  return value ? value : fallback;
}

function buildPlayerToken(playerName: string) {
  return playerName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export default async function RelaxingWatersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("intro_completed, tutorial_completed, relaxing_waters_entered")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!milestones?.intro_completed) {
    redirect("/introduccion");
  }

  if (!milestones?.tutorial_completed) {
    redirect("/fin-tutorial");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("miembro")
    .eq("id", user.id)
    .maybeSingle();
  const { data: userCharacter } = await supabase
    .from("user_character")
    .select("character_name, hp_actual, hp_total, mana_actual, mana_total")
    .eq("profile_id", user.id)
    .maybeSingle();
  const GOLD_ITEM_ID = "8438bdcd-b4b6-412c-8a54-0dcdb6636289";
  const { data: goldInventoryRows } = await supabase
    .from("user_inventory")
    .select("id, quantity")
    .eq("profile_id", user.id)
    .eq("item_id", GOLD_ITEM_ID)
    .gt("quantity", 0)
    .order("id", { ascending: true });
  const initialGoldAmount = (goldInventoryRows ?? []).reduce((sum, row) => {
    const qty =
      typeof row.quantity === "number" && Number.isFinite(row.quantity)
        ? Math.max(0, Math.trunc(row.quantity))
        : 0;
    return sum + qty;
  }, 0);

  const fallbackName = user.email?.split("@")[0] ?? "Aventurero";
  const playerName = resolvePlayerName(userCharacter?.character_name, resolvePlayerName(profile?.miembro, fallbackName));
  const playerToken = buildPlayerToken(playerName) || "fede";
  const playerFaceSrc = `/img/resources/caracters_faces/pj_${playerToken}_rpg_face.png`;
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

  async function completeRelaxingWatersEntry() {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: actionUser },
    } = await supabaseAction.auth.getUser();

    if (!actionUser) {
      redirect("/login");
    }

    const { data: updatedRows } = await supabaseAction
      .from("user_milestones")
      .update({ relaxing_waters_entered: true })
      .eq("user_id", actionUser.id)
      .select("user_id");
    if (!updatedRows || updatedRows.length === 0) {
      await supabaseAction.from("user_milestones").insert({
        user_id: actionUser.id,
        relaxing_waters_entered: true,
      });
    }

    const profileTargets = Array.from(
      new Set([actionUser.id].map((value) => String(value).trim()).filter(Boolean)),
    );
    for (const profileId of profileTargets) {
      const { data: characterRow, error: characterReadError } = await supabaseAction
        .from("user_character")
        .select("hp_total, mana_total")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (characterReadError || !characterRow) continue;

      const hpTotal =
        typeof characterRow.hp_total === "number" && Number.isFinite(characterRow.hp_total)
          ? Math.max(0, Math.trunc(characterRow.hp_total))
          : 0;
      const manaTotal =
        typeof characterRow.mana_total === "number" && Number.isFinite(characterRow.mana_total)
          ? Math.max(0, Math.trunc(characterRow.mana_total))
          : 0;

      const { error: characterUpdateError } = await supabaseAction
        .from("user_character")
        .update({ hp_actual: hpTotal, mana_actual: manaTotal })
        .eq("profile_id", profileId);
      if (!characterUpdateError) break;
    }
  }

  async function payGoldToHeal() {
    "use server";

    const supabaseAction = await createClient();
    const {
      data: { user: actionUser },
    } = await supabaseAction.auth.getUser();

    if (!actionUser) {
      return { ok: false, error: "Tu sesión expiró." };
    }

    const { data: goldRows } = await supabaseAction
      .from("user_inventory")
      .select("id, quantity")
      .eq("profile_id", actionUser.id)
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
    if (totalGold < 1) {
      return { ok: false, error: "No tenés suficiente oro.", goldAmount: totalGold };
    }

    let pendingDiscount = 1;
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
      .eq("profile_id", actionUser.id)
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
        .eq("profile_id", actionUser.id);
    }

    const remainingGold = Math.max(0, totalGold - 1);
    return { ok: true, goldAmount: remainingGold };
  }

  return (
    <RelaxingWatersStory
      shouldPlayIntro={milestones?.relaxing_waters_entered === false}
      playerFaceSrc={playerFaceSrc}
      onCompleteIntro={completeRelaxingWatersEntry}
      initialGoldAmount={initialGoldAmount}
      isCharacterAlreadyFull={isCharacterAlreadyFull}
      onPayToHeal={payGoldToHeal}
    />
  );
}
