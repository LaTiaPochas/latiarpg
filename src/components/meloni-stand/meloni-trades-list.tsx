"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

import { executeMeloniTrade } from "@/app/(main)/meloni-stand/actions";
import {
  hasEnoughInventoryForItem,
  type MeloniGrantedItem,
  type MeloniTradeItemSnapshot,
  type MeloniTradeRow,
  type PlayerInventoryQuantities,
} from "@/lib/meloni-trades";

type MeloniTradesListProps = {
  trades: MeloniTradeRow[];
  inventoryByItemId: PlayerInventoryQuantities;
  tradeCanExchange: Record<number, boolean>;
  uiClassName?: string;
};

function TradeItemIcon({
  item,
  quantity,
  showQuantityFromOne = false,
  compact = false,
  locked = false,
  quantityClassName = "",
}: {
  item: MeloniTradeItemSnapshot;
  quantity?: number;
  /** Si true, muestra badge desde x1 (p. ej. quantity_2 del trueque). */
  showQuantityFromOne?: boolean;
  /** Filas con 2 ítems por lado: íconos más chicos en móvil para no desbordar el modal. */
  compact?: boolean;
  /** Sin stock suficiente en inventario (coste del trueque). */
  locked?: boolean;
  /** Fuente del badge de cantidad (p. ej. Montserrat en modal «Obtuviste»). */
  quantityClassName?: string;
}) {
  const showQuantity =
    typeof quantity === "number" &&
    (showQuantityFromOne ? quantity >= 1 : quantity > 1);

  return (
    <div
      className={`relative shrink-0 ${
        compact ? "h-11 w-11 sm:h-16 sm:w-16" : "h-[3.25rem] w-[3.25rem] sm:h-18 sm:w-18"
      }`}
    >
      <div
        className={`relative flex h-full w-full items-center justify-center overflow-visible rounded-md border-2 p-0.5 shadow-inner sm:p-1 ${
          locked
            ? "border-slate-500/80 bg-[#2a2a2a]/90 shadow-black/20"
            : "border-amber-900/70 bg-[#1f120e]/85 shadow-black/40"
        }`}
        style={
          locked
            ? undefined
            : item.rarityColor
              ? { borderColor: item.rarityColor }
              : undefined
        }
      >
        <Image
          src={item.iconPath}
          alt={item.name}
          width={72}
          height={72}
          className={`h-auto max-h-full w-auto max-w-full object-contain ${
            locked ? "opacity-50 grayscale" : ""
          }`}
        />
        {showQuantity ? (
          <span
            className={`absolute bottom-0 right-0 z-10 rounded-tl-md px-1 py-px font-bold leading-none tabular-nums shadow-sm sm:px-1.5 sm:py-0.5 ${
              locked
                ? "bg-slate-800/95 text-slate-300"
                : "bg-black/90 text-amber-50"
            } ${compact ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-[11px]"} ${quantityClassName}`}
          >
            x{quantity}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function MeloniTradeRewardModal({
  granted,
  uiClassName,
  titleId,
  onContinue,
}: {
  granted: MeloniGrantedItem[];
  uiClassName: string;
  titleId: string;
  onContinue: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onContinue();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm overflow-visible rounded-xl border border-[#9f8352]/90 bg-[#ddccaa]/98 p-5 text-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] sm:max-w-md sm:p-6"
      >
        <h2
          id={titleId}
          className={`${uiClassName} text-sm font-bold uppercase tracking-wide text-slate-800 sm:text-base`}
        >
          Obtuviste:
        </h2>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {granted.map((entry) => (
            <div key={entry.item.id} className="flex flex-col items-center gap-1">
              <TradeItemIcon
                item={entry.item}
                quantity={entry.quantity}
                showQuantityFromOne
                quantityClassName={uiClassName}
              />
              <span className={`${uiClassName} max-w-[5.5rem] text-[10px] font-semibold leading-tight text-slate-700 sm:text-[11px]`}>
                {entry.item.name}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          autoFocus
          onClick={onContinue}
          className={`${uiClassName} mt-6 cursor-pointer rounded-lg border border-slate-700/90 bg-gradient-to-b from-slate-600 to-slate-800 px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-100 shadow-[0_0_2px_rgba(25,25,25,0.8)] transition hover:from-slate-500 hover:to-slate-700 active:from-slate-700 active:to-slate-900`}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

export function MeloniTradesList({
  trades,
  inventoryByItemId,
  tradeCanExchange,
  uiClassName = "",
}: MeloniTradesListProps) {
  const router = useRouter();
  const rewardTitleId = useId();
  const [isPending, startTransition] = useTransition();
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [grantedItems, setGrantedItems] = useState<MeloniGrantedItem[] | null>(null);

  const canExchangeSelected =
    selectedTradeId != null && tradeCanExchange[selectedTradeId] === true;

  useEffect(() => {
    if (!grantedItems) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [grantedItems]);

  useEffect(() => {
    if (!grantedItems) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGrantedItems(null);
        setSelectedTradeId(null);
        router.refresh();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grantedItems, router]);

  const closeRewardModal = () => {
    setGrantedItems(null);
    setSelectedTradeId(null);
    router.refresh();
  };

  if (trades.length === 0) {
    return (
      <p className={`mt-4 text-center text-[12px] leading-relaxed text-slate-700 sm:text-[13px] ${uiClassName}`}>
        Meloni no tiene trueques publicados para hoy.
      </p>
    );
  }

  return (
    <>
      {grantedItems ? (
        <MeloniTradeRewardModal
          granted={grantedItems}
          uiClassName={uiClassName}
          titleId={rewardTitleId}
          onContinue={closeRewardModal}
        />
      ) : null}

      <ul className={`mt-1 max-w-full space-y-3 ${uiClassName}`}>
        {trades.map((trade) => {
          const isSelected = selectedTradeId === trade.id;
          const isCompactRow = Boolean(trade.item2 || trade.exchangeItem2);

          return (
            <li key={trade.id} className="max-w-full">
              <button
                type="button"
                data-selected={isSelected ? "true" : "false"}
                onClick={() => {
                  setExchangeError(null);
                  setSelectedTradeId((current) => (current === trade.id ? null : trade.id));
                }}
                className="meloni-trade-row grid w-full max-w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-1 gap-y-1 overflow-x-hidden overflow-y-visible rounded-lg px-1.5 py-2.5 text-left transition sm:gap-x-4 sm:px-3 sm:py-3"
                aria-pressed={isSelected}
                aria-label={`Seleccionar trueque ${trade.id}`}
              >
                <div className="flex min-h-11 min-w-0 items-center justify-end gap-0.5 overflow-visible sm:min-h-16 sm:gap-2 lg:min-h-18">
                  <TradeItemIcon
                    item={trade.item1}
                    quantity={trade.quantity1}
                    compact={isCompactRow}
                  />
                  {trade.item2 ? (
                    <TradeItemIcon
                      item={trade.item2}
                      quantity={trade.quantity2}
                      showQuantityFromOne
                      compact
                    />
                  ) : null}
                </div>
                <span
                  className="flex w-5 shrink-0 items-center justify-center text-base font-black leading-none text-slate-800 sm:w-auto sm:px-1 sm:text-xl lg:text-2xl"
                  aria-hidden
                >
                  →
                </span>
                <div className="flex min-h-11 min-w-0 items-center justify-start gap-0.5 overflow-visible sm:min-h-16 sm:gap-2 lg:min-h-18">
                  <TradeItemIcon
                    item={trade.exchangeItem}
                    quantity={trade.exchangeQuantity}
                    compact={isCompactRow}
                    locked={
                      !hasEnoughInventoryForItem(
                        inventoryByItemId,
                        trade.exchangeItem.id,
                        trade.exchangeQuantity,
                      )
                    }
                  />
                  {trade.exchangeItem2 ? (
                    <TradeItemIcon
                      item={trade.exchangeItem2}
                      quantity={trade.exchangeQuantity2}
                      showQuantityFromOne
                      compact
                      locked={
                        trade.exchangeQuantity2 > 0 &&
                        !hasEnoughInventoryForItem(
                          inventoryByItemId,
                          trade.exchangeItem2.id,
                          trade.exchangeQuantity2,
                        )
                      }
                    />
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {exchangeError ? (
        <p className={`${uiClassName} mt-3 text-center text-[11px] font-semibold text-red-800 sm:text-[12px]`}>
          {exchangeError}
        </p>
      ) : null}

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          disabled={selectedTradeId == null || !canExchangeSelected || isPending}
          onClick={() => {
            if (selectedTradeId == null || !canExchangeSelected) return;
            setExchangeError(null);
            startTransition(async () => {
              const result = await executeMeloniTrade(selectedTradeId);
              if (!result.ok) {
                setExchangeError(result.error);
                return;
              }
              setGrantedItems(result.granted);
            });
          }}
          className={`${uiClassName} cursor-pointer rounded-lg border border-slate-700/90 bg-gradient-to-b from-slate-600 to-slate-800 px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-100 shadow-[0_0_2px_rgba(25,25,25,0.8)] transition hover:from-slate-500 hover:to-slate-700 active:from-slate-700 active:to-slate-900 disabled:cursor-not-allowed disabled:border-slate-600/70 disabled:from-slate-500/60 disabled:to-slate-700/60 disabled:text-slate-300/80 disabled:shadow-none`}
        >
          {isPending ? "Intercambiando…" : "Intercambiar"}
        </button>
      </div>
    </>
  );
}
