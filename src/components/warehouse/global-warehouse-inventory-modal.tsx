"use client";

import {
  depositInventoryToGlobalWarehouse,
  withdrawGlobalWarehouseToInventory,
  type DepositInventoryEntry,
  type WithdrawWarehouseEntry,
} from "@/app/(main)/warehouse/actions";
import {
  collectInstanceStatTooltipRollLines,
  formatWeaponAttackTypeLabel,
  instanceStatRollTooltipLineClassName,
  inventoryTooltipSubtitleUnderName,
  type EquipmentInstanceTooltip,
  type WeaponInstanceTooltip,
} from "@/components/character-profile/inventory-types";
import { WeaponPhysicalDamageTooltipLine } from "@/components/character-profile/weapon-physical-damage-tooltip-line";
import Image from "next/image";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const abilitiesFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const itemTooltipFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

/** Badge más chico para el grid warehouse (muchas columnas). */
const WAREHOUSE_QTY_BADGE_CLASS =
  "absolute bottom-0.5 right-0.5 min-w-[1rem] select-none rounded-sm border border-amber-900/50 bg-gradient-to-b from-black/82 to-black/90 px-[3px] py-[1px] text-center text-[8px] font-semibold tabular-nums leading-none text-amber-200/92 shadow-sm lg:text-[9px]";

/** En `lg` la grilla no usa todo el ancho del panel: slots algo más chicos en desktop. */
const WAREHOUSE_INVENTORY_GRID_CLASS =
  "grid grid-cols-5 gap-1.5 pt-2 sm:gap-1.5 sm:pt-3 lg:mx-auto lg:grid-cols-8 lg:max-w-[min(100%,36rem)] lg:gap-1 lg:pt-2";

/** Celda de grilla: mejor target táctil en móvil. */
const WAREHOUSE_SLOT_BUTTON_CLASS =
  "relative aspect-square rounded-sm border border-amber-900/75 bg-[#1f120e]/88 shadow-inner shadow-black/35 touch-manipulation active:scale-[0.97] sm:active:scale-100";

/** Scroll vertical del modal: mismo clima amber/madera que el inventario del perfil. */
const MODAL_SCROLL_AREA_CLASS =
  "min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2 pr-2.5 sm:px-5 sm:pb-5 sm:pt-4 sm:pr-4 " +
  "[scrollbar-width:thin] [scrollbar-color:rgba(180,118,54,0.92)_rgba(26,17,13,0.96)] " +
  "[scrollbar-gutter:stable] " +
  "[&::-webkit-scrollbar]:w-2.5 " +
  "[&::-webkit-scrollbar]:py-2 " +
  "[&::-webkit-scrollbar-track]:my-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[#140d0a]/95 " +
  "[&::-webkit-scrollbar-track]:shadow-[inset_0_0_0_1px_rgba(154,117,71,0.28),inset_0_2px_10px_rgba(0,0,0,0.45)] " +
  "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-[#7a5830]/85 " +
  "[&::-webkit-scrollbar-thumb]:bg-gradient-to-b [&::-webkit-scrollbar-thumb]:from-[#cfa56a]/95 [&::-webkit-scrollbar-thumb]:via-[#9a6e32]/92 [&::-webkit-scrollbar-thumb]:to-[#63401c]/94 " +
  "[&::-webkit-scrollbar-thumb]:shadow-[inset_0_1px_0_rgba(254,240,206,0.22),inset_0_-1px_0_rgba(0,0,0,0.35),0_1px_3px_rgba(0,0,0,0.4)] " +
  "hover:[&::-webkit-scrollbar-thumb]:from-[#e4bc7d] hover:[&::-webkit-scrollbar-thumb]:via-[#b07d3b] hover:[&::-webkit-scrollbar-thumb]:to-[#7a5224] " +
  "hover:[&::-webkit-scrollbar-thumb]:border-[#9b7644]/95 " +
  "active:[&::-webkit-scrollbar-thumb]:from-[#b8894a]/95 active:[&::-webkit-scrollbar-thumb]:via-[#7f552c]/95 active:[&::-webkit-scrollbar-thumb]:to-[#4f3018]/92 " +
  "[&::-webkit-scrollbar-corner]:bg-transparent";

type InventoryPanelId = "warehouse" | "inventory";

type TooltipState = {
  open: boolean;
  x: number;
  y: number;
  flipY: boolean;
  pinned: boolean;
  panel: InventoryPanelId | null;
  slotNumber: number | null;
};

const INITIAL_TOOLTIP: TooltipState = {
  open: false,
  x: 0,
  y: 0,
  flipY: false,
  pinned: false,
  panel: null,
  slotNumber: null,
};

function isDesktopViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 1024px)").matches;
}

function weaponDamageRange(min: number | null | undefined, max: number | null | undefined): string {
  const a = min != null && Number.isFinite(Number(min)) ? Number(min) : 0;
  const b = max != null && Number.isFinite(Number(max)) ? Number(max) : 0;
  return `${a} - ${b}`;
}

export type GlobalWarehouseInventoryItemPayload = {
  id: number;
  /** `user_inventory.id` cuando el slot viene de la bolsa del jugador (depositar). */
  userInventoryRowId?: number;
  /** `global_warehouse.id` cuando el slot viene del almacén de campamento (retirar). */
  globalWarehouseRowId?: number;
  name: string;
  description: string;
  quoteText: string | null;
  iconPath: string;
  quantity: number;
  equipSlot: string | null;
  sellValue: number;
  itemTypeId: number | null;
  itemTypeCode: string | null;
  rarityColor: string | null;
  usableByClassNames: string[];
  requiredMinLevel: number;
  requiredStats: Array<{ key: string; value: number }>;
  weaponInstance?: WeaponInstanceTooltip | null;
  equipmentInstance?: EquipmentInstanceTooltip | null;
};

export type GlobalWarehouseInventorySlotPayload = {
  slotNumber: number;
  item: GlobalWarehouseInventoryItemPayload | null;
};

/** Stack en una sola fila (sin instancia de arma/equipo): permite elegir cantidad al depositar. */
function isWarehouseStackableDepositItem(item: GlobalWarehouseInventoryItemPayload): boolean {
  return item.quantity > 1 && !item.weaponInstance && !item.equipmentInstance;
}

const WAREHOUSE_STACK_DRAFT_STORAGE_KEY = "ltp-warehouse-stack-draft-v1";
const WAREHOUSE_DEPOSIT_SELECTION_STORAGE_KEY = "ltp-warehouse-deposit-by-row-v1";
const WAREHOUSE_STACK_WITHDRAW_DRAFT_STORAGE_KEY = "ltp-warehouse-stack-withdraw-draft-v1";
const WAREHOUSE_WITHDRAW_SELECTION_STORAGE_KEY = "ltp-warehouse-withdraw-by-row-v1";

function readStackDraftMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(WAREHOUSE_STACK_DRAFT_STORAGE_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

function writeStackDraftMap(map: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(WAREHOUSE_STACK_DRAFT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}

function persistDepositStackDraftQuantity(inventoryRowId: number, qty: number) {
  if (inventoryRowId <= 0) return;
  const map = readStackDraftMap();
  map[String(inventoryRowId)] = qty;
  writeStackDraftMap(map);
}

function readWithdrawStackDraftMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(WAREHOUSE_STACK_WITHDRAW_DRAFT_STORAGE_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

function writeWithdrawStackDraftMap(map: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(WAREHOUSE_STACK_WITHDRAW_DRAFT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function persistWithdrawStackDraftQuantity(globalWarehouseRowId: number, qty: number) {
  if (globalWarehouseRowId <= 0) return;
  const map = readWithdrawStackDraftMap();
  map[String(globalWarehouseRowId)] = qty;
  writeWithdrawStackDraftMap(map);
}

/** Interpreta el campo de cantidad (solo dígitos); vacío → 0; acotado a [0, maxQty]. */
function parseStackQtyInputText(text: string, maxQty: number): number {
  const raw = text.replace(/\D/g, "");
  if (raw === "") return 0;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return Math.min(maxQty, Math.max(0, n));
}

function restoreDepositQtyBySlotFromSession(
  slots: GlobalWarehouseInventorySlotPayload[],
): Record<number, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(WAREHOUSE_DEPOSIT_SELECTION_STORAGE_KEY);
    const byRow = raw ? JSON.parse(raw) : {};
    if (!byRow || typeof byRow !== "object" || Array.isArray(byRow)) return {};
    const next: Record<number, number> = {};
    for (const slot of slots) {
      const rid = slot.item?.userInventoryRowId;
      if (typeof rid !== "number" || rid <= 0 || !slot.item) continue;
      const qRaw = (byRow as Record<string, unknown>)[String(rid)];
      const q =
        typeof qRaw === "number" && Number.isFinite(qRaw)
          ? Math.trunc(qRaw)
          : Math.trunc(Number(qRaw));
      if (!Number.isFinite(q) || q <= 0) continue;
      const maxQ = Math.max(1, Math.trunc(Number(slot.item.quantity)));
      next[slot.slotNumber] = Math.min(maxQ, q);
    }
    return next;
  } catch {
    return {};
  }
}

function clearWarehouseDepositSessionMemory() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(WAREHOUSE_STACK_DRAFT_STORAGE_KEY);
    sessionStorage.removeItem(WAREHOUSE_DEPOSIT_SELECTION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function restoreWithdrawQtyBySlotFromSession(
  slots: GlobalWarehouseInventorySlotPayload[],
): Record<number, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(WAREHOUSE_WITHDRAW_SELECTION_STORAGE_KEY);
    const byRow = raw ? JSON.parse(raw) : {};
    if (!byRow || typeof byRow !== "object" || Array.isArray(byRow)) return {};
    const next: Record<number, number> = {};
    for (const slot of slots) {
      const rid = slot.item?.globalWarehouseRowId;
      if (typeof rid !== "number" || rid <= 0 || !slot.item) continue;
      const qRaw = (byRow as Record<string, unknown>)[String(rid)];
      const q =
        typeof qRaw === "number" && Number.isFinite(qRaw)
          ? Math.trunc(qRaw)
          : Math.trunc(Number(qRaw));
      if (!Number.isFinite(q) || q <= 0) continue;
      const maxQ = Math.max(1, Math.trunc(Number(slot.item.quantity)));
      next[slot.slotNumber] = Math.min(maxQ, q);
    }
    return next;
  } catch {
    return {};
  }
}

function clearWarehouseWithdrawSessionMemory() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(WAREHOUSE_STACK_WITHDRAW_DRAFT_STORAGE_KEY);
    sessionStorage.removeItem(WAREHOUSE_WITHDRAW_SELECTION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type StackQuantityModalState =
  | {
      direction: "deposit";
      slotNumber: number;
      userInventoryRowId: number;
      itemName: string;
      maxQty: number;
      draft: number;
    }
  | {
      direction: "withdraw";
      slotNumber: number;
      globalWarehouseRowId: number;
      itemName: string;
      maxQty: number;
      draft: number;
    };

function persistStackModalDraft(modal: StackQuantityModalState, qty: number) {
  if (modal.direction === "deposit") {
    persistDepositStackDraftQuantity(modal.userInventoryRowId, qty);
  } else {
    persistWithdrawStackDraftQuantity(modal.globalWarehouseRowId, qty);
  }
}

type GlobalWarehouseInventoryModalProps = {
  open: boolean;
  onClose: () => void;
  /** Si viene undefined (p. ej. serialización), el panel usa `[]`. */
  warehouseSlots?: GlobalWarehouseInventorySlotPayload[] | null;
  /** Misma forma que el panel del warehouse; datos de `user_inventory` (sin equipados). */
  playerInventorySlots?: GlobalWarehouseInventorySlotPayload[] | null;
  playerClassName: string;
  playerLevel: number;
  playerStats: { str: number; dex: number; int: number; wis: number; speed: number };
};

export function GlobalWarehouseInventoryModal({
  open,
  onClose,
  warehouseSlots: warehouseSlotsIn,
  playerInventorySlots: playerInventorySlotsIn,
  playerClassName,
  playerLevel,
  playerStats,
}: GlobalWarehouseInventoryModalProps) {
  const warehouseSlots = warehouseSlotsIn ?? [];
  const playerInventorySlots = playerInventorySlotsIn ?? [];

  const router = useRouter();
  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP);
  const [inventorySelectMode, setInventorySelectMode] = useState(false);
  /** Espacio → cantidad a depositar (solo bolsa). */
  const [inventoryDepositQtyBySlot, setInventoryDepositQtyBySlot] = useState<Record<number, number>>({});
  const [stackQtyModal, setStackQtyModal] = useState<StackQuantityModalState | null>(null);
  /** Texto del input de cantidad (modal stack); se sincroniza con +/- / max y se valida en blur. */
  const [stackQtyInputText, setStackQtyInputText] = useState("0");
  const [depositFeedback, setDepositFeedback] = useState<string | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositProgress, setDepositProgress] = useState(0);

  const [warehouseSelectMode, setWarehouseSelectMode] = useState(false);
  /** Espacio → cantidad a retirar del almacén. */
  const [warehouseWithdrawQtyBySlot, setWarehouseWithdrawQtyBySlot] = useState<Record<number, number>>(
    {},
  );
  const [withdrawFeedback, setWithdrawFeedback] = useState<string | null>(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawProgress, setWithdrawProgress] = useState(0);

  const closeTooltip = useCallback(() => {
    setTooltip(INITIAL_TOOLTIP);
  }, []);

  const resetInventoryDepositUi = useCallback(() => {
    setInventorySelectMode(false);
    setInventoryDepositQtyBySlot({});
    setStackQtyModal(null);
    setStackQtyInputText("0");
    setDepositFeedback(null);
    setDepositLoading(false);
    setDepositProgress(0);
  }, []);

  const resetWarehouseWithdrawUi = useCallback(() => {
    setWarehouseSelectMode(false);
    setWarehouseWithdrawQtyBySlot({});
    setStackQtyModal(null);
    setStackQtyInputText("0");
    setWithdrawFeedback(null);
    setWithdrawLoading(false);
    setWithdrawProgress(0);
  }, []);

  useEffect(() => {
    if (!open) {
      resetInventoryDepositUi();
      resetWarehouseWithdrawUi();
      clearWarehouseDepositSessionMemory();
      clearWarehouseWithdrawSessionMemory();
      closeTooltip();
    }
  }, [open, resetInventoryDepositUi, resetWarehouseWithdrawUi, closeTooltip]);

  useEffect(() => {
    if (!stackQtyModal) return;
    setStackQtyInputText(String(stackQtyModal.draft));
  }, [stackQtyModal]);

  const stackQtyEffective =
    stackQtyModal == null ? 0 : parseStackQtyInputText(stackQtyInputText, stackQtyModal.maxQty);

  const transferBusy = depositLoading || withdrawLoading;

  const hasDepositSlotSelection = Object.keys(inventoryDepositQtyBySlot).some(
    (key) => (inventoryDepositQtyBySlot[Number(key)] ?? 0) > 0,
  );

  const hasWithdrawSlotSelection = Object.keys(warehouseWithdrawQtyBySlot).some(
    (key) => (warehouseWithdrawQtyBySlot[Number(key)] ?? 0) > 0,
  );

  const handleInventoryDepositSlotClick = useCallback(
    (slot: GlobalWarehouseInventorySlotPayload) => {
      if (transferBusy || warehouseSelectMode || !slot.item) return;
      const item = slot.item;
      const sn = slot.slotNumber;

      if (isWarehouseStackableDepositItem(item)) {
        if (inventoryDepositQtyBySlot[sn] !== undefined) {
          setInventoryDepositQtyBySlot((prev) => {
            const next = { ...prev };
            delete next[sn];
            return next;
          });
          return;
        }
        const maxQty = Math.max(1, Math.trunc(Number(item.quantity)));
        const userInventoryRowId =
          typeof item.userInventoryRowId === "number" ? item.userInventoryRowId : 0;
        if (userInventoryRowId > 0) persistDepositStackDraftQuantity(userInventoryRowId, 0);
        setStackQtyModal({
          direction: "deposit",
          slotNumber: sn,
          userInventoryRowId,
          itemName: item.name,
          maxQty,
          draft: 0,
        });
        return;
      }

      setInventoryDepositQtyBySlot((prev) => {
        const next = { ...prev };
        if (next[sn] !== undefined) delete next[sn];
        else next[sn] = Math.max(1, Math.trunc(Number(item.quantity)));
        return next;
      });
    },
    [transferBusy, warehouseSelectMode, inventoryDepositQtyBySlot],
  );

  const handleWarehouseWithdrawSlotClick = useCallback(
    (slot: GlobalWarehouseInventorySlotPayload) => {
      if (transferBusy || inventorySelectMode || !slot.item) return;
      const item = slot.item;
      const sn = slot.slotNumber;

      if (isWarehouseStackableDepositItem(item)) {
        if (warehouseWithdrawQtyBySlot[sn] !== undefined) {
          setWarehouseWithdrawQtyBySlot((prev) => {
            const next = { ...prev };
            delete next[sn];
            return next;
          });
          return;
        }
        const maxQty = Math.max(1, Math.trunc(Number(item.quantity)));
        const globalWarehouseRowId =
          typeof item.globalWarehouseRowId === "number" ? item.globalWarehouseRowId : 0;
        if (globalWarehouseRowId <= 0) return;
        persistWithdrawStackDraftQuantity(globalWarehouseRowId, 0);
        setStackQtyModal({
          direction: "withdraw",
          slotNumber: sn,
          globalWarehouseRowId,
          itemName: item.name,
          maxQty,
          draft: 0,
        });
        return;
      }

      setWarehouseWithdrawQtyBySlot((prev) => {
        const next = { ...prev };
        if (next[sn] !== undefined) delete next[sn];
        else next[sn] = Math.max(1, Math.trunc(Number(item.quantity)));
        return next;
      });
    },
    [transferBusy, inventorySelectMode, warehouseWithdrawQtyBySlot],
  );

  const tooltipPositionFromPointer = (x: number, y: number) => {
    const TOOLTIP_W = 320;
    const TOOLTIP_MIN_H = 220;
    const GAP = 12;
    const EDGE = 8;
    const nextX = Math.min(Math.max(EDGE, x + GAP), Math.max(EDGE, window.innerWidth - TOOLTIP_W));
    const shouldFlipUp = y + GAP + TOOLTIP_MIN_H > window.innerHeight - EDGE;
    const nextY = shouldFlipUp ? y - GAP : y + GAP;
    return { x: nextX, y: nextY, flipY: shouldFlipUp };
  };

  const activeItem = (() => {
    if (!tooltip.slotNumber || !tooltip.panel) return null;
    const slots = tooltip.panel === "warehouse" ? warehouseSlots : playerInventorySlots;
    const slot = slots.find((s) => s.slotNumber === tooltip.slotNumber);
    return slot?.item ?? null;
  })();

  const activeTooltipBorderStyle = activeItem?.rarityColor
    ? { borderColor: activeItem.rarityColor }
    : undefined;
  const activeTooltipNameStyle = activeItem?.rarityColor
    ? { color: activeItem.rarityColor }
    : undefined;

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!depositLoading) return;
    setDepositProgress(0);
    const id = window.setInterval(() => {
      setDepositProgress((p) => {
        if (p >= 90) return p;
        return Math.min(90, p + Math.max(2, Math.ceil((88 - p) * 0.12)));
      });
    }, 70);
    return () => clearInterval(id);
  }, [depositLoading]);

  useEffect(() => {
    if (!withdrawLoading) return;
    setWithdrawProgress(0);
    const id = window.setInterval(() => {
      setWithdrawProgress((p) => {
        if (p >= 90) return p;
        return Math.min(90, p + Math.max(2, Math.ceil((88 - p) * 0.12)));
      });
    }, 70);
    return () => clearInterval(id);
  }, [withdrawLoading]);

  useEffect(() => {
    if (!inventorySelectMode || typeof window === "undefined") return;
    const byRow: Record<string, number> = {};
    for (const [snStr, qty] of Object.entries(inventoryDepositQtyBySlot)) {
      const slot = playerInventorySlots.find((s) => s.slotNumber === Number(snStr));
      const rid = slot?.item?.userInventoryRowId;
      if (typeof rid === "number" && rid > 0 && qty > 0) {
        byRow[String(rid)] = Math.trunc(Number(qty));
      }
    }
    try {
      sessionStorage.setItem(WAREHOUSE_DEPOSIT_SELECTION_STORAGE_KEY, JSON.stringify(byRow));
    } catch {
      /* ignore */
    }
  }, [inventorySelectMode, inventoryDepositQtyBySlot, playerInventorySlots]);

  useEffect(() => {
    if (!warehouseSelectMode || typeof window === "undefined") return;
    const byRow: Record<string, number> = {};
    for (const [snStr, qty] of Object.entries(warehouseWithdrawQtyBySlot)) {
      const slot = warehouseSlots.find((s) => s.slotNumber === Number(snStr));
      const rid = slot?.item?.globalWarehouseRowId;
      if (typeof rid === "number" && rid > 0 && qty > 0) {
        byRow[String(rid)] = Math.trunc(Number(qty));
      }
    }
    try {
      sessionStorage.setItem(WAREHOUSE_WITHDRAW_SELECTION_STORAGE_KEY, JSON.stringify(byRow));
    } catch {
      /* ignore */
    }
  }, [warehouseSelectMode, warehouseWithdrawQtyBySlot, warehouseSlots]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden overscroll-none bg-black/60 p-3 sm:p-6"
      role="presentation"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        closeTooltip();
        onClose();
      }}
    >
      <div
        className={`flex h-[min(92dvh,calc(100dvh-4.5rem))] max-h-[min(92dvh,calc(100dvh-4.5rem))] w-full min-h-0 flex-col gap-2 overflow-hidden overscroll-contain p-1 sm:gap-2 sm:p-2 ${abilitiesFont.className}`}
      >
        <div
          className="relative mx-auto flex min-h-0 w-full max-w-[min(100%,22rem)] flex-1 flex-col overflow-hidden rounded-xl border border-amber-800/60 bg-[#2a1812]/96 shadow-[0_0_40px_rgba(0,0,0,0.5)] sm:max-w-2xl lg:max-w-3xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="warehouse-panel-title"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-amber-900/70 px-4 py-3 sm:px-5 sm:py-4">
            <div>
              <h2 id="warehouse-panel-title" className="text-base font-semibold tracking-wide text-amber-300 sm:text-lg">
                WAREHOUSE
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-amber-200/70 sm:text-xs">
                Warehouse global del campamento. Retirá ítems a tu bolsa o depositá desde el inventario.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                closeTooltip();
                onClose();
              }}
              className="shrink-0 rounded-md border border-amber-700/80 bg-amber-950/50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:bg-amber-900/65"
              aria-label="Cerrar almacén y ventanas"
            >
              Cerrar
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className={`${MODAL_SCROLL_AREA_CLASS} min-h-0 flex-1 overscroll-contain`}>
              <div className={WAREHOUSE_INVENTORY_GRID_CLASS}>
                {warehouseSlots.map((slot) => {
                  const withdrawQty = warehouseWithdrawQtyBySlot[slot.slotNumber];
                  const selected =
                    warehouseSelectMode && withdrawQty !== undefined && withdrawQty > 0;
                  return (
                    <button
                      key={`warehouse-${slot.slotNumber}`}
                      type="button"
                      className={`relative aspect-square rounded-sm border border-amber-900/75 bg-[#1f120e]/88 shadow-inner shadow-black/35 ${
                        warehouseSelectMode && selected ? "ring-[2.5px] ring-amber-400/95" : ""
                      } ${
                        !warehouseSelectMode &&
                        tooltip.open &&
                        tooltip.panel === "warehouse" &&
                        tooltip.slotNumber === slot.slotNumber &&
                        tooltip.pinned
                          ? "ring-[2.5px] ring-amber-400/95"
                          : ""
                      }`}
                      style={
                        warehouseSelectMode && selected
                          ? undefined
                          : slot.item?.rarityColor?.trim()
                            ? { borderColor: slot.item.rarityColor }
                            : undefined
                      }
                      aria-label={`WAREHOUSE — espacio ${slot.slotNumber}${selected ? " (seleccionado)" : ""}`}
                      aria-pressed={warehouseSelectMode && selected ? true : undefined}
                      onMouseEnter={(event) => {
                        if (warehouseSelectMode || !slot.item || !isDesktopViewport()) return;
                        const pos = tooltipPositionFromPointer(event.clientX, event.clientY);
                        setTooltip({
                          open: true,
                          x: pos.x,
                          y: pos.y,
                          flipY: pos.flipY,
                          pinned: false,
                          panel: "warehouse",
                          slotNumber: slot.slotNumber,
                        });
                      }}
                      onMouseMove={(event) => {
                        if (
                          warehouseSelectMode ||
                          !slot.item ||
                          !isDesktopViewport() ||
                          tooltip.pinned
                        )
                          return;
                        const pos = tooltipPositionFromPointer(event.clientX, event.clientY);
                        setTooltip((prev) =>
                          prev.slotNumber === slot.slotNumber && prev.panel === "warehouse"
                            ? { ...prev, x: pos.x, y: pos.y, flipY: pos.flipY }
                            : prev,
                        );
                      }}
                      onMouseLeave={() => {
                        if (warehouseSelectMode || !isDesktopViewport() || tooltip.pinned) return;
                        closeTooltip();
                      }}
                      onClick={(event) => {
                        if (!slot.item) return;
                        event.preventDefault();
                        event.stopPropagation();
                        if (warehouseSelectMode) {
                          closeTooltip();
                          handleWarehouseWithdrawSlotClick(slot);
                          return;
                        }
                        if (isDesktopViewport()) return;
                        const pos = tooltipPositionFromPointer(event.clientX, event.clientY);
                        setTooltip((prev) => {
                          if (
                            prev.pinned &&
                            prev.slotNumber === slot.slotNumber &&
                            prev.panel === "warehouse"
                          ) {
                            return INITIAL_TOOLTIP;
                          }
                          return {
                            open: true,
                            x: pos.x,
                            y: pos.y,
                            flipY: pos.flipY,
                            pinned: true,
                            panel: "warehouse",
                            slotNumber: slot.slotNumber,
                          };
                        });
                      }}
                    >
                      {slot.item ? (
                        <>
                          <Image
                            src={slot.item.iconPath}
                            alt={slot.item.name}
                            width={700}
                            height={700}
                            quality={75}
                            className="h-auto w-auto max-h-full max-w-full object-contain p-0.5 sm:p-1 lg:p-0.5"
                          />
                          {slot.item.quantity > 1 ? (
                            <span className={WAREHOUSE_QTY_BADGE_CLASS}>×{slot.item.quantity}</span>
                          ) : null}
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="shrink-0 space-y-2 border-t border-amber-900/70 bg-[#1f120e]/90 px-4 py-3 sm:px-5"
              aria-busy={withdrawLoading}
            >
              {withdrawLoading ? (
                <div className="space-y-1.5">
                  <p
                    className={`text-center text-xs font-semibold uppercase tracking-wide text-amber-200/95 ${abilitiesFont.className}`}
                  >
                    Retirando…
                  </p>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full border border-amber-800/55 bg-[#0d0806]/90 shadow-[inset_0_1px_6px_rgba(0,0,0,0.55)]"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(withdrawProgress)}
                    aria-label="Progreso del retiro"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-800/95 via-amber-500/95 to-amber-300/90 shadow-[inset_0_1px_0_rgba(255,240,200,0.35),0_0_12px_rgba(251,191,36,0.35)] transition-[width] duration-200 ease-out"
                      style={{ width: `${withdrawProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {withdrawFeedback ? (
                <p className="text-center text-xs font-medium leading-snug text-red-300">{withdrawFeedback}</p>
              ) : null}
              <button
                type="button"
                disabled={withdrawLoading || (warehouseSelectMode && !hasWithdrawSlotSelection)}
                onClick={() => {
                  setWithdrawFeedback(null);
                  if (!warehouseSelectMode) {
                    closeTooltip();
                    clearWarehouseDepositSessionMemory();
                    resetInventoryDepositUi();
                    setWarehouseSelectMode(true);
                    setWarehouseWithdrawQtyBySlot(restoreWithdrawQtyBySlotFromSession(warehouseSlots));
                    return;
                  }
                  const entries: WithdrawWarehouseEntry[] = Object.entries(warehouseWithdrawQtyBySlot)
                    .map(([sn, qty]) => {
                      const slotNum = Number(sn);
                      const q = Math.trunc(Number(qty));
                      const rowId = warehouseSlots.find((s) => s.slotNumber === slotNum)?.item
                        ?.globalWarehouseRowId;
                      if (typeof rowId !== "number" || rowId <= 0 || q <= 0) return null;
                      return { globalWarehouseRowId: rowId, quantity: q };
                    })
                    .filter((e): e is WithdrawWarehouseEntry => e != null);
                  if (entries.length === 0) {
                    setWithdrawFeedback("No se pudo identificar los ítems seleccionados.");
                    return;
                  }
                  void (async () => {
                    setWithdrawLoading(true);
                    setWithdrawProgress(0);
                    try {
                      const result = await withdrawGlobalWarehouseToInventory(entries);
                      if (!result.ok) {
                        setWithdrawFeedback(result.error);
                        setWithdrawProgress(0);
                        return;
                      }
                      clearWarehouseWithdrawSessionMemory();
                      setWithdrawProgress(100);
                      await new Promise((r) => {
                        window.setTimeout(r, 320);
                      });
                      resetWarehouseWithdrawUi();
                      closeTooltip();
                      router.refresh();
                    } finally {
                      setWithdrawLoading(false);
                    }
                  })();
                }}
                className={`w-full rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  !warehouseSelectMode
                    ? "cursor-pointer border-amber-700/85 bg-amber-950/55 text-amber-100 hover:bg-amber-900/70"
                    : hasWithdrawSlotSelection && !withdrawLoading
                      ? "cursor-pointer border-emerald-700/85 bg-emerald-900/70 text-emerald-50 hover:bg-emerald-800/85"
                      : "cursor-not-allowed border-amber-800/50 bg-amber-950/35 text-amber-200/55"
                }`}
              >
                {!warehouseSelectMode
                  ? "Seleccionar items"
                  : withdrawLoading
                    ? "Retirando…"
                    : !hasWithdrawSlotSelection
                      ? "Seleccioná ítems"
                      : "Retirar"}
              </button>
              {warehouseSelectMode ? (
                <button
                  type="button"
                  disabled={withdrawLoading}
                  onClick={() => {
                    clearWarehouseWithdrawSessionMemory();
                    resetWarehouseWithdrawUi();
                    closeTooltip();
                  }}
                  className="w-full rounded-md border border-amber-800/70 bg-amber-950/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100/90 transition hover:bg-amber-900/55 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="relative mx-auto flex min-h-0 w-full max-w-[min(100%,22rem)] flex-1 flex-col overflow-hidden rounded-xl border border-amber-800/60 bg-[#2a1812]/96 shadow-[0_0_40px_rgba(0,0,0,0.5)] sm:max-w-2xl lg:max-w-3xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="player-inventory-panel-title"
        >
          <div className="flex shrink-0 items-start gap-3 border-b border-amber-900/70 px-4 py-3 sm:px-5 sm:py-4">
            <div>
              <h2
                id="player-inventory-panel-title"
                className="text-base font-semibold tracking-wide text-amber-300 sm:text-lg"
              >
                INVENTARIO
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-amber-200/70 sm:text-xs">
                Objetos en tu bolsa (no equipados). Podés seleccionarlos para depositarlos en el Warehouse.
              </p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className={`${MODAL_SCROLL_AREA_CLASS} min-h-0 flex-1 overscroll-contain`}>
              <div className={WAREHOUSE_INVENTORY_GRID_CLASS}>
                {playerInventorySlots.map((slot) => {
                  const depositQty = inventoryDepositQtyBySlot[slot.slotNumber];
                  const selected =
                    inventorySelectMode && depositQty !== undefined && depositQty > 0;
                  return (
                    <button
                      key={`inventory-${slot.slotNumber}`}
                      type="button"
                      className={`relative aspect-square rounded-sm border border-amber-900/75 bg-[#1f120e]/88 shadow-inner shadow-black/35 ${
                        inventorySelectMode && selected
                          ? "ring-[2.5px] ring-amber-400/95"
                          : ""
                      } ${
                        !inventorySelectMode &&
                        tooltip.open &&
                        tooltip.panel === "inventory" &&
                        tooltip.slotNumber === slot.slotNumber &&
                        tooltip.pinned
                          ? "ring-[2.5px] ring-amber-400/95"
                          : ""
                      }`}
                      style={
                        inventorySelectMode && selected
                          ? undefined
                          : slot.item?.rarityColor?.trim()
                            ? { borderColor: slot.item.rarityColor }
                            : undefined
                      }
                      aria-label={`INVENTARIO — espacio ${slot.slotNumber}${selected ? " (seleccionado)" : ""}`}
                      aria-pressed={inventorySelectMode && selected ? true : undefined}
                      onMouseEnter={(event) => {
                        if (inventorySelectMode || !slot.item || !isDesktopViewport()) return;
                        const pos = tooltipPositionFromPointer(event.clientX, event.clientY);
                        setTooltip({
                          open: true,
                          x: pos.x,
                          y: pos.y,
                          flipY: pos.flipY,
                          pinned: false,
                          panel: "inventory",
                          slotNumber: slot.slotNumber,
                        });
                      }}
                      onMouseMove={(event) => {
                        if (
                          inventorySelectMode ||
                          !slot.item ||
                          !isDesktopViewport() ||
                          tooltip.pinned
                        )
                          return;
                        const pos = tooltipPositionFromPointer(event.clientX, event.clientY);
                        setTooltip((prev) =>
                          prev.slotNumber === slot.slotNumber && prev.panel === "inventory"
                            ? { ...prev, x: pos.x, y: pos.y, flipY: pos.flipY }
                            : prev,
                        );
                      }}
                      onMouseLeave={() => {
                        if (inventorySelectMode || !isDesktopViewport() || tooltip.pinned) return;
                        closeTooltip();
                      }}
                      onClick={(event) => {
                        if (!slot.item) return;
                        event.preventDefault();
                        event.stopPropagation();
                        if (inventorySelectMode) {
                          closeTooltip();
                          handleInventoryDepositSlotClick(slot);
                          return;
                        }
                        if (isDesktopViewport()) return;
                        const pos = tooltipPositionFromPointer(event.clientX, event.clientY);
                        setTooltip((prev) => {
                          if (
                            prev.pinned &&
                            prev.slotNumber === slot.slotNumber &&
                            prev.panel === "inventory"
                          ) {
                            return INITIAL_TOOLTIP;
                          }
                          return {
                            open: true,
                            x: pos.x,
                            y: pos.y,
                            flipY: pos.flipY,
                            pinned: true,
                            panel: "inventory",
                            slotNumber: slot.slotNumber,
                          };
                        });
                      }}
                    >
                      {slot.item ? (
                        <>
                          <Image
                            src={slot.item.iconPath}
                            alt={slot.item.name}
                            width={700}
                            height={700}
                            quality={75}
                            className="h-auto w-auto max-h-full max-w-full object-contain p-0.5 sm:p-1 lg:p-0.5"
                          />
                          {slot.item.quantity > 1 ? (
                            <span className={WAREHOUSE_QTY_BADGE_CLASS}>×{slot.item.quantity}</span>
                          ) : null}
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="shrink-0 space-y-2 border-t border-amber-900/70 bg-[#1f120e]/90 px-4 py-3 sm:px-5"
              aria-busy={depositLoading}
            >
              {depositLoading ? (
                <div className="space-y-1.5">
                  <p
                    className={`text-center text-xs font-semibold uppercase tracking-wide text-amber-200/95 ${abilitiesFont.className}`}
                  >
                    Depositando…
                  </p>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full border border-amber-800/55 bg-[#0d0806]/90 shadow-[inset_0_1px_6px_rgba(0,0,0,0.55)]"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(depositProgress)}
                    aria-label="Progreso del depósito"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-800/95 via-amber-500/95 to-amber-300/90 shadow-[inset_0_1px_0_rgba(255,240,200,0.35),0_0_12px_rgba(251,191,36,0.35)] transition-[width] duration-200 ease-out"
                      style={{ width: `${depositProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {depositFeedback ? (
                <p className="text-center text-xs font-medium leading-snug text-red-300">{depositFeedback}</p>
              ) : null}
              <button
                type="button"
                disabled={depositLoading || (inventorySelectMode && !hasDepositSlotSelection)}
                onClick={() => {
                  setDepositFeedback(null);
                  if (!inventorySelectMode) {
                    closeTooltip();
                    clearWarehouseWithdrawSessionMemory();
                    resetWarehouseWithdrawUi();
                    setInventorySelectMode(true);
                    setInventoryDepositQtyBySlot(restoreDepositQtyBySlotFromSession(playerInventorySlots));
                    return;
                  }
                  const entries: DepositInventoryEntry[] = Object.entries(inventoryDepositQtyBySlot)
                    .map(([sn, qty]) => {
                      const slotNum = Number(sn);
                      const q = Math.trunc(Number(qty));
                      const rowId = playerInventorySlots.find((s) => s.slotNumber === slotNum)?.item
                        ?.userInventoryRowId;
                      if (typeof rowId !== "number" || rowId <= 0 || q <= 0) return null;
                      return { inventoryRowId: rowId, quantity: q };
                    })
                    .filter((e): e is DepositInventoryEntry => e != null);
                  if (entries.length === 0) {
                    setDepositFeedback("No se pudo identificar los ítems seleccionados.");
                    return;
                  }
                  void (async () => {
                    setDepositLoading(true);
                    setDepositProgress(0);
                    try {
                      const result = await depositInventoryToGlobalWarehouse(entries);
                      if (!result.ok) {
                        setDepositFeedback(result.error);
                        setDepositProgress(0);
                        return;
                      }
                      clearWarehouseDepositSessionMemory();
                      setDepositProgress(100);
                      await new Promise((r) => {
                        window.setTimeout(r, 320);
                      });
                      resetInventoryDepositUi();
                      closeTooltip();
                      router.refresh();
                    } finally {
                      setDepositLoading(false);
                    }
                  })();
                }}
                className={`w-full rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  !inventorySelectMode
                    ? "cursor-pointer border-amber-700/85 bg-amber-950/55 text-amber-100 hover:bg-amber-900/70"
                    : hasDepositSlotSelection && !depositLoading
                      ? "cursor-pointer border-emerald-700/85 bg-emerald-900/70 text-emerald-50 hover:bg-emerald-800/85"
                      : "cursor-not-allowed border-amber-800/50 bg-amber-950/35 text-amber-200/55"
                }`}
              >
                {!inventorySelectMode
                  ? "Seleccionar items"
                  : depositLoading
                    ? "Depositando…"
                    : !hasDepositSlotSelection
                      ? "Seleccioná ítems"
                      : "Depositar"}
              </button>
              {inventorySelectMode ? (
                <button
                  type="button"
                  disabled={depositLoading}
                  onClick={() => {
                    clearWarehouseDepositSessionMemory();
                    resetInventoryDepositUi();
                    closeTooltip();
                  }}
                  className="w-full rounded-md border border-amber-800/70 bg-amber-950/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100/90 transition hover:bg-amber-900/55 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {stackQtyModal ? (
        <div
          className="fixed inset-0 z-[240] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stack-transfer-qty-title"
          onClick={() => {
            if (!transferBusy) setStackQtyModal(null);
          }}
        >
          <div
            className={`w-full max-w-sm rounded-xl border border-amber-800/70 bg-[#2a1812]/98 p-4 shadow-[0_8px_40px_rgba(0,0,0,0.55)] sm:p-5 ${abilitiesFont.className}`}
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="stack-transfer-qty-title"
              className="text-center text-sm font-semibold leading-snug text-amber-100 sm:text-base"
            >
              ¿Qué cantidad de{" "}
              <span className="text-amber-50">{stackQtyModal.itemName}</span> querés{" "}
              {stackQtyModal.direction === "deposit" ? "depositar" : "retirar"}?
            </h3>
            <div className="mt-5 flex items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                aria-label="Disminuir cantidad"
                disabled={transferBusy || stackQtyEffective <= 0}
                onClick={() => {
                  if (!stackQtyModal || transferBusy) return;
                  const cur = parseStackQtyInputText(stackQtyInputText, stackQtyModal.maxQty);
                  const nextDraft = Math.max(0, cur - 1);
                  setStackQtyInputText(String(nextDraft));
                  setStackQtyModal((m) => {
                    if (!m) return m;
                    persistStackModalDraft(m, nextDraft);
                    return { ...m, draft: nextDraft };
                  });
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-700/80 bg-amber-950/60 text-lg font-bold text-amber-100 transition hover:bg-amber-900/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                -
              </button>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={
                  stackQtyModal.direction === "deposit" ? "Cantidad a depositar" : "Cantidad a retirar"
                }
                disabled={transferBusy}
                value={stackQtyInputText}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setStackQtyInputText(digits);
                }}
                onBlur={() => {
                  if (!stackQtyModal) return;
                  const n = parseStackQtyInputText(stackQtyInputText, stackQtyModal.maxQty);
                  setStackQtyInputText(String(n));
                  setStackQtyModal((m) => {
                    if (!m) return m;
                    persistStackModalDraft(m, n);
                    return { ...m, draft: n };
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="min-w-[3.25rem] max-w-[6rem] rounded-md border border-amber-800/55 bg-[#1a100c]/92 py-1.5 text-center text-xl font-semibold tabular-nums text-amber-50 shadow-inner shadow-black/30 outline-none ring-amber-500/40 focus:border-amber-600/80 focus:ring-2 disabled:opacity-50 sm:min-w-[3.75rem]"
              />
              <button
                type="button"
                aria-label="Aumentar cantidad"
                disabled={transferBusy || stackQtyEffective >= stackQtyModal.maxQty}
                onClick={() => {
                  if (!stackQtyModal || transferBusy) return;
                  const cur = parseStackQtyInputText(stackQtyInputText, stackQtyModal.maxQty);
                  const nextDraft = Math.min(stackQtyModal.maxQty, cur + 1);
                  setStackQtyInputText(String(nextDraft));
                  setStackQtyModal((m) => {
                    if (!m) return m;
                    persistStackModalDraft(m, nextDraft);
                    return { ...m, draft: nextDraft };
                  });
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-700/80 bg-amber-950/60 text-lg font-bold text-amber-100 transition hover:bg-amber-900/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
            </div>
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                aria-label="Usar cantidad máxima"
                disabled={transferBusy || stackQtyEffective >= stackQtyModal.maxQty}
                onClick={() => {
                  if (!stackQtyModal || transferBusy) return;
                  const nextDraft = stackQtyModal.maxQty;
                  setStackQtyInputText(String(nextDraft));
                  setStackQtyModal((m) => {
                    if (!m) return m;
                    persistStackModalDraft(m, nextDraft);
                    return { ...m, draft: nextDraft };
                  });
                }}
                className="rounded border border-amber-700/65 bg-amber-950/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200/88 transition hover:bg-amber-900/55 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[11px]"
              >
                max
              </button>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={transferBusy}
                onClick={() => setStackQtyModal(null)}
                className="w-full rounded-md border border-amber-800/70 bg-amber-950/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100/90 sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={transferBusy || stackQtyEffective < 1}
                onClick={() => {
                  const m = stackQtyModal;
                  if (!m) return;
                  const n = parseStackQtyInputText(stackQtyInputText, m.maxQty);
                  if (n < 1) return;
                  persistStackModalDraft(m, n);
                  setStackQtyInputText(String(n));
                  if (m.direction === "deposit") {
                    if (m.userInventoryRowId <= 0) return;
                    setInventoryDepositQtyBySlot((prev) => ({ ...prev, [m.slotNumber]: n }));
                  } else {
                    if (m.globalWarehouseRowId <= 0) return;
                    setWarehouseWithdrawQtyBySlot((prev) => ({ ...prev, [m.slotNumber]: n }));
                  }
                  setStackQtyModal(null);
                }}
                className="w-full rounded-md border border-emerald-700/85 bg-emerald-900/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-50 hover:bg-emerald-800/85 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tooltip.open && activeItem ? (
        <>
          {tooltip.pinned ? (
            <button
              type="button"
              aria-label="Cerrar información del ítem"
              className="fixed inset-0 z-[210] cursor-default bg-transparent"
              onClick={closeTooltip}
            />
          ) : null}
          <div
            className="fixed z-[220] w-72 rounded-lg border border-amber-700/70 bg-[#120f2a]/95 p-3 text-sm text-amber-50 shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: tooltip.flipY ? "translateY(-100%)" : undefined,
              ...activeTooltipBorderStyle,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {activeItem.itemTypeId === 1 ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={`${abilitiesFont.className} text-base font-bold leading-tight text-amber-200`}
                    style={activeTooltipNameStyle}
                  >
                    {activeItem.name}
                  </p>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
                    <Image
                      src="/img/resources/iconos/icon_gold.png"
                      alt="Oro"
                      width={14}
                      height={14}
                      className="h-3.5 w-3.5 object-contain"
                    />
                    <span>{activeItem.sellValue}</span>
                  </div>
                </div>
                <p className={`${itemTooltipFont.className} mt-1 text-xs italic text-amber-100/80`}>
                  {activeItem.description}
                </p>
                {activeItem.quoteText ? (
                  <p
                    className={`${itemTooltipFont.className} mt-1.5 text-[11px] italic leading-relaxed text-amber-200/85`}
                    style={{ fontStyle: "italic" }}
                  >
                    - <em>&quot;{activeItem.quoteText}&quot;</em>
                  </p>
                ) : null}
                <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-amber-400/45 to-transparent" />
                <p className="mt-1.5 text-[11px] uppercase tracking-wide text-amber-200/90">
                  <span>{(activeItem.equipSlot ?? "Sin slot").toUpperCase()}</span>
                  {activeItem.weaponInstance?.attackType ? (
                    <span className="ml-1.5 font-normal normal-case tracking-normal text-amber-100/90">
                      · {formatWeaponAttackTypeLabel(activeItem.weaponInstance.attackType)}
                    </span>
                  ) : null}
                </p>
                {(() => {
                  const roll = activeItem.weaponInstance ?? activeItem.equipmentInstance;
                  if (!roll) return null;
                  const showDamage = Boolean(activeItem.weaponInstance);
                  return (
                    <div className="mt-3 space-y-1.5 text-sm leading-tight text-amber-100">
                      {roll.rarity ? (
                        <p className="font-semibold" style={{ color: roll.rarityColor ?? undefined }}>
                          {roll.rarity}
                        </p>
                      ) : null}
                      {showDamage ? (
                        <>
                          <p>
                            <WeaponPhysicalDamageTooltipLine
                              damageRangeText={weaponDamageRange(roll.attackDamageMin, roll.attackDamageMax)}
                              attackFamily={activeItem.weaponInstance?.attackFamily}
                            />
                          </p>
                          <p>
                            {weaponDamageRange(roll.magicDamageMin, roll.magicDamageMax)} Daño Mágico
                          </p>
                        </>
                      ) : null}
                      {collectInstanceStatTooltipRollLines(roll).map(
                        ({ statKey, valueFlat, valuePct, line }, index) => (
                          <p
                            key={`${line}-${index}`}
                            className={instanceStatRollTooltipLineClassName(
                              statKey,
                              valueFlat,
                              valuePct,
                            )}
                          >
                            {line}
                          </p>
                        ),
                      )}
                    </div>
                  );
                })()}
                {(() => {
                  const classReqs = activeItem.usableByClassNames;
                  const classReqVisible = classReqs.length > 0;
                  const classReqMet = classReqVisible
                    ? classReqs.some(
                        (name) => name.trim().toLowerCase() === playerClassName.trim().toLowerCase(),
                      )
                    : true;
                  const levelReqVisible = activeItem.requiredMinLevel > 0;
                  const levelReqMet = playerLevel >= activeItem.requiredMinLevel;
                  const statReqs = activeItem.requiredStats;
                  const hasAnyReq = classReqVisible || levelReqVisible || statReqs.length > 0;
                  if (!hasAnyReq) return null;
                  const statValueFor = (key: string): number => {
                    const k = key.trim().toLowerCase();
                    if (k === "str") return playerStats.str;
                    if (k === "dex") return playerStats.dex;
                    if (k === "int") return playerStats.int;
                    if (k === "wis") return playerStats.wis;
                    if (k === "spd" || k === "speed" || k === "vel" || k === "velocidad") {
                      return playerStats.speed;
                    }
                    return 0;
                  };
                  return (
                    <div className="mt-2">
                      <p
                        className={`${abilitiesFont.className} text-[11px] font-bold uppercase tracking-wide text-amber-300/95`}
                      >
                        REQUISITOS
                      </p>
                      {classReqVisible ? (
                        <p
                          className={`mt-1 text-xs font-semibold ${classReqMet ? "text-emerald-300" : "text-red-300"}`}
                        >
                          Clase: {classReqs.join(", ")}
                        </p>
                      ) : null}
                      {levelReqVisible ? (
                        <p
                          className={`mt-1 text-xs font-semibold ${levelReqMet ? "text-emerald-300" : "text-red-300"}`}
                        >
                          Nivel: {activeItem.requiredMinLevel}
                        </p>
                      ) : null}
                      {statReqs.map((req, idx) => {
                        const met = statValueFor(req.key) >= req.value;
                        return (
                          <p
                            key={`${req.key}-${req.value}-${idx}`}
                            className={`mt-1 text-xs font-semibold ${met ? "text-emerald-300" : "text-red-300"}`}
                          >
                            {req.value} {req.key.toUpperCase()}
                          </p>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={`${abilitiesFont.className} text-xs font-bold uppercase tracking-wider text-amber-300`}
                  >
                    {activeItem.name}
                  </p>
                  {activeItem.itemTypeId !== 2 ? (
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
                      <Image
                        src="/img/resources/iconos/icon_gold.png"
                        alt="Oro"
                        width={14}
                        height={14}
                        className="h-3.5 w-3.5 object-contain"
                      />
                      <span>{activeItem.sellValue}</span>
                    </div>
                  ) : null}
                </div>
                {(() => {
                  const subtitle = inventoryTooltipSubtitleUnderName({
                    itemTypeId: activeItem.itemTypeId,
                    itemTypeCode: activeItem.itemTypeCode,
                    equipSlot: activeItem.equipSlot,
                  });
                  if (!subtitle) return null;
                  return (
                    <p className={`${abilitiesFont.className} mt-0.5 text-[11px] font-semibold text-amber-300/85`}>
                      {subtitle}
                    </p>
                  );
                })()}
                <p className={`${itemTooltipFont.className} mt-2 italic leading-relaxed text-amber-50/90`}>
                  {activeItem.description}
                </p>
                {activeItem.quoteText ? (
                  <p
                    className={`${itemTooltipFont.className} mt-1.5 text-[11px] italic leading-relaxed text-amber-200/85`}
                    style={{ fontStyle: "italic" }}
                  >
                    - <em>&quot;{activeItem.quoteText}&quot;</em>
                  </p>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
