import type { Metadata } from "next";
import Link from "next/link";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { redirect } from "next/navigation";

import { MeloniTradesList } from "@/components/meloni-stand/meloni-trades-list";
import { MeloniTradesResetCountdown } from "@/components/meloni-stand/meloni-trades-reset-countdown";
import type { InventoryRowForBag } from "@/lib/inventory-bag";
import {
  buildMeloniTradesForDisplay,
  buildPlayerInventoryQuantities,
  canReceiveMeloniTradeRewards,
  getMeloniTradeTodayDate,
  isMeloniTradeAffordable,
  isMeloniTradeDateToday,
} from "@/lib/meloni-trades";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Meloni's",
};

export default async function MeloniStandPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /** Tabla global: el dashboard usa service role; sin política RLS el cliente auth devuelve 0 filas. */
  const tradesSupabase = createServiceRoleClient() ?? supabase;

  const todayDate = getMeloniTradeTodayDate();

  const tradeSelect =
    "id, item_id_1, item_id_2, quantity_1, quantity_2, exhange_quantity, exchange_item, exchange_item_2, exhange_quantity_2, date";

  let { data: tradeRows, error: tradesError } = await tradesSupabase
    .from("global_melonis_trades")
    .select(tradeSelect)
    .eq("date", todayDate)
    .order("id", { ascending: true });

  // Respaldo: filas con `date` en otro formato o desfase; también detecta `date` NULL.
  if (!tradesError && (tradeRows?.length ?? 0) === 0) {
    const { data: allTradeRows, error: allTradesError } = await tradesSupabase
      .from("global_melonis_trades")
      .select(tradeSelect)
      .order("id", { ascending: true });

    if (!allTradesError && allTradeRows) {
      tradeRows = allTradeRows.filter((row) => isMeloniTradeDateToday(row.date));
    }
    if (allTradesError) {
      tradesError = allTradesError;
    }
  }

  const itemIds = new Set<string>();
  for (const row of tradeRows ?? []) {
    if (typeof row.item_id_1 === "string" && row.item_id_1) itemIds.add(row.item_id_1);
    if (typeof row.item_id_2 === "string" && row.item_id_2) itemIds.add(row.item_id_2);
    if (typeof row.exchange_item === "string" && row.exchange_item) itemIds.add(row.exchange_item);
    if (typeof row.exchange_item_2 === "string" && row.exchange_item_2) {
      itemIds.add(row.exchange_item_2);
    }
  }

  const { data: itemRows, error: itemsError } =
    itemIds.size > 0
      ? await supabase
          .from("items")
          .select("id, name, icon_path, rarity_color, is_stackable")
          .in("id", [...itemIds])
      : { data: [], error: null };

  const trades = buildMeloniTradesForDisplay(tradeRows, itemRows);

  const stackableByItemId = new Map<string, boolean>(
    (itemRows ?? []).map((row) => [String(row.id), row.is_stackable === true]),
  );

  const [{ data: inventoryRowsRaw }, { data: equippedRows }] = await Promise.all([
    supabase
      .from("user_inventory")
      .select("id, item_id, weapon_instance_id, equipment_instance_id, quantity")
      .eq("profile_id", user.id)
      .gt("quantity", 0),
    supabase.from("user_equipment").select("inventory_id").eq("profile_id", user.id),
  ]);

  const inventoryRowsForBag = (inventoryRowsRaw ?? [])
    .map((row) => ({
      id: Number(row.id),
      item_id: row.item_id,
      weapon_instance_id: row.weapon_instance_id,
      equipment_instance_id: row.equipment_instance_id,
      quantity: row.quantity,
    }))
    .filter((row) => Number.isFinite(row.id)) as InventoryRowForBag[];

  const equippedInventoryIdSet = new Set(
    (equippedRows ?? [])
      .map((row) => row.inventory_id)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .map((value) => Math.trunc(value)),
  );

  const inventoryByItemId = buildPlayerInventoryQuantities(
    inventoryRowsForBag.map((row) => ({ item_id: row.item_id, quantity: row.quantity })),
  );

  const tradeCanExchange: Record<number, boolean> = {};
  for (const trade of trades) {
    tradeCanExchange[trade.id] =
      isMeloniTradeAffordable(trade, inventoryByItemId) &&
      canReceiveMeloniTradeRewards(
        trade,
        stackableByItemId,
        inventoryRowsForBag,
        equippedInventoryIdSet,
      );
  }

  const loadFailed = Boolean(tradesError || itemsError);
  const tradesMissingValidItems =
    !loadFailed && (tradeRows?.length ?? 0) > 0 && trades.length === 0;

  return (
    <div
      className={`relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#120b08] text-amber-50 ${uiFont.className}`}
      style={{
        backgroundImage: "url('/img/resources/background/bg_first_base.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-black/55" aria-hidden />
      <main
        className={`${dialogueFont.className} relative z-10 mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-4xl items-center justify-center p-4 lg:p-8`}
      >
        <section className="w-full max-w-2xl rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm lg:p-3">
          <div className="overflow-hidden rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-3 text-center sm:p-5 lg:p-6">
            <p className="text-base font-semibold leading-relaxed text-slate-800 sm:text-base">Meloni&apos;s</p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-800 sm:text-[13px]">
              Meloni es suficientemente escurridizo para entrar a la cueva sin ser visto y recolectar basura que
              encuentra tirada. <br />
              <br />
              Si bien para él no tiene valor, se dio cuenta que para La Tía es importante, y los chantajea a cambio de
              recetas.
            </p>

            <h2
              className={`${uiFont.className} mt-3 text-sm font-bold uppercase tracking-wide text-slate-700 sm:text-sm`}
            >
              Trueques del día
            </h2>

            {loadFailed ? (
              <p className="mt-4 text-center text-[12px] font-semibold text-red-800 sm:text-[13px]">
                No se pudieron cargar los trueques de hoy. Intentá de nuevo más tarde.
              </p>
            ) : tradesMissingValidItems ? (
              <p className="mt-4 text-center text-[12px] font-semibold text-red-800 sm:text-[13px]">
                Hay trueques para hoy, pero faltan ítems válidos en la base de datos.
              </p>
            ) : (
              <MeloniTradesList
                trades={trades}
                inventoryByItemId={inventoryByItemId}
                tradeCanExchange={tradeCanExchange}
                uiClassName={uiFont.className}
              />
            )}
              <MeloniTradesResetCountdown
              className={`${uiFont.className} mt-5 text-[11px] font-semibold text-slate-700 sm:text-xs`}
            />
            <div className="mt-4 flex justify-center">
              <Link
                href="/garrison"
                className={`${uiFont.className} inline-flex items-center gap-1.5 rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b]`}
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
