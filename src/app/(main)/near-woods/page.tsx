import { NearWoodsGatherActions } from "@/components/near-woods/near-woods-gather-actions";
import { NearWoodsEntranceCopy, NearWoodsScene } from "@/components/near-woods/near-woods-scene";
import { createClient } from "@/lib/supabase/server";
import { Montserrat } from "next/font/google";

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

/** Hacha de Piedra: desbloquea texto y acción “Adentrarse”. */
const STONE_AXE_ITEM_ID = "bb95dc53-389d-450b-a44e-ea8154bbebc0";

/** Altura útil bajo `TopNav`: `(main)` del layout aplica `pt-14` para el header fijo. */
const BELOW_NAV = "h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden";

export default async function NearWoodsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasStoneAxeInInventory = false;
  if (user) {
    const { data: axeRows } = await supabase
      .from("user_inventory")
      .select("quantity")
      .eq("profile_id", user.id)
      .eq("item_id", STONE_AXE_ITEM_ID)
      .gt("quantity", 0)
      .limit(1);
    hasStoneAxeInInventory = Boolean(axeRows && axeRows.length > 0);
  }

  return (
    <NearWoodsScene
      className={`${uiFont.className} relative flex w-full shrink-0 flex-col ${BELOW_NAV}`}
      hasStoneAxeInInventory={hasStoneAxeInInventory}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 py-3 sm:px-5 sm:py-4">
        <section className="flex max-h-full min-h-0 w-full max-w-2xl flex-col justify-center overflow-hidden rounded-xl border border-amber-700/70 bg-[#1a100c]/90 p-4 text-center shadow-[0_18px_45px_rgba(0,0,0,0.45)] sm:p-5">
          <NearWoodsEntranceCopy />
          <NearWoodsGatherActions />
        </section>
      </div>
    </NearWoodsScene>
  );
}
