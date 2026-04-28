"use client";

import {
  DndContext,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { equipInventoryItem } from "@/app/(main)/character_profile/actions";
import type { EquipmentInstanceTooltip, WeaponInstanceTooltip } from "@/components/character-profile/inventory-types";

type InventoryItem = {
  id: number;
  name: string;
  description: string;
  iconPath: string;
  quantity: number;
  equipSlot: string | null;
  sellValue: number;
  itemTypeId: number | null;
  rarityColor: string | null;
  equippedSlot?: string | null;
  weaponInstance?: WeaponInstanceTooltip | null;
  equipmentInstance?: EquipmentInstanceTooltip | null;
};

type InventorySlot = {
  slotNumber: number;
  item: InventoryItem | null;
};
type EquippedEntry = {
  slot: string;
  item: InventoryItem;
};

type TooltipState = {
  open: boolean;
  x: number;
  y: number;
  pinned: boolean;
  /** Celda del inventario (1–24); null si el tooltip es de un slot equipado. */
  slotNumber: number | null;
  /** id UI del slot del paper doll (`weapon`, `armor`, …); null si el tooltip es del inventario. */
  equippedSlotId: string | null;
};
type DragOverState = {
  slot: string | null;
  isCompatible: boolean;
};
type ToastState = {
  open: boolean;
  message: string;
};

const INITIAL_TOOLTIP: TooltipState = {
  open: false,
  x: 0,
  y: 0,
  pinned: false,
  slotNumber: null,
  equippedSlotId: null,
};

/** Badge de cantidad: un poco más de lectura que el plano, sin competir con el icono. */
const INVENTORY_QUANTITY_BADGE_CLASS =
  "absolute bottom-1 right-1 min-w-[1.25rem] select-none rounded-md border border-amber-900/45 bg-gradient-to-b from-black/78 to-black/88 px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums leading-none tracking-tight text-amber-200/90 shadow-sm sm:min-w-[1.35rem] sm:px-2 sm:py-1 sm:text-xs";

/** Inventario UI: `id` único (DnD); `dbSlot` = `items.equip_slot` / `user_equipment.slot`. */
const EQUIPMENT_SLOT_DEFS = [
  { id: "weapon", dbSlot: "weapon", label: "ARMA" },
  { id: "armor", dbSlot: "armor", label: "ARMADURA" },
  { id: "helmet", dbSlot: "helmet", label: "CASCO" },
  { id: "shoulders", dbSlot: "shoulders", label: "HOMBROS" },
  { id: "boots", dbSlot: "boots", label: "BOTAS" },
  { id: "gloves", dbSlot: "gloves", label: "GUANTES" },
  { id: "ring", dbSlot: "ring", label: "ANILLO" },
  { id: "neck", dbSlot: "neck", label: "COLLAR" },
] as const;

/** Orden en columnas del paper doll (izq. / der.). */
const PAPER_DOLL_LEFT = ["helmet", "shoulders", "gloves", "weapon"] as const;
const PAPER_DOLL_RIGHT = ["neck", "armor", "ring", "boots"] as const;

function equipmentDefById(id: (typeof EQUIPMENT_SLOT_DEFS)[number]["id"]) {
  const def = EQUIPMENT_SLOT_DEFS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown equipment slot: ${id}`);
  return def;
}

function buildEquippedBySlotId(entries: EquippedEntry[]): Map<string, InventoryItem> {
  const map = new Map<string, InventoryItem>();
  const byDb = new Map<string, EquippedEntry[]>();
  for (const entry of entries) {
    const list = byDb.get(entry.slot) ?? [];
    list.push(entry);
    byDb.set(entry.slot, list);
  }

  for (const def of EQUIPMENT_SLOT_DEFS) {
    const candidates = byDb.get(def.dbSlot);
    if (!candidates?.length) continue;
    const picked = candidates[0];
    if (picked) map.set(def.id, picked.item);
  }
  return map;
}

function formatWeaponStatLine(
  statKey: string | null | undefined,
  valueFlat: number | null | undefined,
  valuePct: number | null | undefined,
): string | null {
  const key = statKey?.trim();
  if (!key) return null;
  if (valueFlat != null && Number.isFinite(Number(valueFlat))) {
    return `+ ${valueFlat} ${key}`;
  }
  if (valuePct != null && Number.isFinite(Number(valuePct))) {
    return `+ ${valuePct}% ${key}`;
  }
  return null;
}

function weaponDamageRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  const a = min != null && Number.isFinite(Number(min)) ? Number(min) : 0;
  const b = max != null && Number.isFinite(Number(max)) ? Number(max) : 0;
  return `${a} - ${b}`;
}

function DraggableInventorySlot({
  slot,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onClick,
}: {
  slot: InventorySlot;
  onMouseEnter: (x: number, y: number) => void;
  onMouseMove: (x: number, y: number) => void;
  onMouseLeave: () => void;
  onClick: (x: number, y: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    // Debe ser único por celda: NO usar user_inventory.id solo, choca con slotNumber (1..24).
    id: `inventory-slot-${slot.slotNumber}`,
    disabled: !slot.item?.equipSlot,
    data: {
      inventoryId: slot.item?.id ?? null,
      equipSlot: slot.item?.equipSlot ?? null,
    },
  });

  const isEquipment = slot.item?.itemTypeId === 1;
  const rarityBorderStyle =
    isEquipment && slot.item?.rarityColor
      ? { borderColor: slot.item.rarityColor }
      : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`relative aspect-square rounded-md border-2 border-amber-900/70 bg-[#1f120e]/85 shadow-inner shadow-black/40 ${
        isDragging ? "opacity-40 ring-2 ring-amber-400/60" : ""
      }`}
      style={rarityBorderStyle}
      aria-label={`Espacio de inventario ${slot.slotNumber}`}
      onMouseEnter={(event) => {
        if (!slot.item) return;
        onMouseEnter(event.clientX, event.clientY);
      }}
      onMouseMove={(event) => {
        if (!slot.item) return;
        onMouseMove(event.clientX, event.clientY);
      }}
      onMouseLeave={onMouseLeave}
      onClick={(event) => {
        if (!slot.item) return;
        event.preventDefault();
        event.stopPropagation();
        onClick(event.clientX, event.clientY);
      }}
      {...listeners}
      {...attributes}
    >
      {slot.item ? (
        <>
          <Image
            src={slot.item.iconPath}
            alt={slot.item.name}
            width={700}
            height={700}
            quality={100}
            className="h-auto w-auto max-h-full max-w-full object-contain p-1.5"
          />
          {slot.item.quantity > 1 ? (
            <span className={INVENTORY_QUANTITY_BADGE_CLASS}>×{slot.item.quantity}</span>
          ) : null}
        </>
      ) : null}
    </button>
  );
}

function EquipmentDropSlot({
  slotId,
  label,
  equippedItem,
  dragState,
  className,
  onEquippedTooltipEnter,
  onEquippedTooltipMove,
  onEquippedTooltipLeave,
  onEquippedTooltipClick,
}: {
  slotId: string;
  label: string;
  equippedItem: InventoryItem | undefined;
  dragState: DragOverState;
  className?: string;
  onEquippedTooltipEnter?: (clientX: number, clientY: number, slotId: string) => void;
  onEquippedTooltipMove?: (clientX: number, clientY: number, slotId: string) => void;
  onEquippedTooltipLeave?: () => void;
  onEquippedTooltipClick?: (clientX: number, clientY: number, slotId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `equip-${slotId}`,
    data: { slotId },
  });

  const isActiveDrop = dragState.slot === slotId;
  const isCompatible = isActiveDrop && dragState.isCompatible;
  const isIncompatible = isActiveDrop && !dragState.isCompatible;

  const dragBorderClasses =
    isOver && !isActiveDrop
      ? "border-2 border-amber-500/80 bg-amber-900/20"
      : isCompatible
        ? "border-2 border-emerald-500/90 bg-emerald-900/30"
        : isIncompatible
          ? "border-2 border-red-500/90 bg-red-900/25"
          : null;

  const idleRarityBorder =
    Boolean(equippedItem?.rarityColor?.trim()) && !dragBorderClasses && !isOver;

  const rarityBorderStyle = idleRarityBorder
    ? { borderColor: equippedItem?.rarityColor ?? undefined }
    : undefined;

  const idleBorderClasses = idleRarityBorder
    ? "border-2 border-amber-900/70 bg-[#1a100c]/80"
    : "border border-amber-900/70 bg-[#1a100c]/80";

  return (
    <div
      ref={setNodeRef}
      className={`relative flex aspect-square w-full min-w-0 flex-col overflow-hidden rounded-md p-1 text-center transition ${
        dragBorderClasses ?? idleBorderClasses
      } ${equippedItem ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={rarityBorderStyle}
      onMouseEnter={(event) => {
        if (!equippedItem || !onEquippedTooltipEnter) return;
        onEquippedTooltipEnter(event.clientX, event.clientY, slotId);
      }}
      onMouseMove={(event) => {
        if (!equippedItem || !onEquippedTooltipMove) return;
        onEquippedTooltipMove(event.clientX, event.clientY, slotId);
      }}
      onMouseLeave={() => {
        onEquippedTooltipLeave?.();
      }}
      onClick={(event) => {
        if (!equippedItem || !onEquippedTooltipClick) return;
        event.preventDefault();
        event.stopPropagation();
        onEquippedTooltipClick(event.clientX, event.clientY, slotId);
      }}
    >
      <p className="shrink-0 text-[8px] font-semibold uppercase leading-tight tracking-wide text-amber-300/90">
        {label}
      </p>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5">
        {equippedItem ? (
          <>
            <Image
              src={equippedItem.iconPath}
              alt={equippedItem.name}
              width={64}
              height={64}
              quality={100}
              className="max-h-[55%] max-w-[92%] object-contain"
            />
            <p className="line-clamp-2 w-full text-[8px] leading-tight text-amber-100">{equippedItem.name}</p>
          </>
        ) : (
          <p className="px-0.5 text-[8px] leading-tight text-amber-100/45">Arrastrar aquí</p>
        )}
      </div>
    </div>
  );
}

export type CharacterPaperDollData = {
  characterNameUppercase: string;
  level: number;
  className: string;
  xpProgressPercent: number;
  experiencePoints: number;
  currentLevelXp: number;
  xpRange: number;
  avatarSrc: string;
};

function ClassicPaperDollPanel({
  character,
  equippedBySlotId,
  dragState,
  onEquippedTooltipEnter,
  onEquippedTooltipMove,
  onEquippedTooltipLeave,
  onEquippedTooltipClick,
}: {
  character: CharacterPaperDollData;
  equippedBySlotId: Map<string, InventoryItem>;
  dragState: DragOverState;
  onEquippedTooltipEnter: (clientX: number, clientY: number, slotId: string) => void;
  onEquippedTooltipMove: (clientX: number, clientY: number, slotId: string) => void;
  onEquippedTooltipLeave: () => void;
  onEquippedTooltipClick: (clientX: number, clientY: number, slotId: string) => void;
}) {
  const classDisplay =
    character.className.replace(/^\s*clase\s+/i, "").trim() || character.className;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-amber-800/60 bg-[#2a1812]/90 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] lg:col-span-5">
      <div className="shrink-0 text-center">
        <h1 className="text-2xl font-bold text-amber-200 sm:text-3xl">{character.characterNameUppercase}</h1>
        <p className="mt-2 text-sm text-amber-100/80 sm:text-base">
          Nivel <span className="font-semibold">{character.level}</span> -{" "}
          <span className="font-semibold">{classDisplay}</span>
        </p>
        <div className="mx-auto mt-3 w-full max-w-md">
          <div className="h-3 overflow-hidden rounded-full border border-violet-300/50 bg-[#140a1e]">
            <div
              className="h-full bg-gradient-to-r from-violet-700 via-violet-500 to-fuchsia-400 transition-all duration-300"
              style={{ width: `${character.xpProgressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-violet-200/90">
            EXP: {character.xpProgressPercent}% ({character.experiencePoints - character.currentLevelXp}/
            {character.xpRange})
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-amber-900/65 bg-gradient-to-b from-[#1c100c] via-[#120a08] to-[#0a0605] shadow-inner shadow-black/50 lg:min-h-[14rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(90,50,28,0.2)_0%,transparent_72%)]"
        />
        <div className="relative z-10 flex min-h-0 flex-1 flex-row items-stretch justify-between gap-3 px-3 py-4 sm:gap-5 sm:px-5 sm:py-5">
          <div className="flex shrink-0 flex-col items-start justify-center gap-2.5 self-stretch">
            {PAPER_DOLL_LEFT.map((slotId) => {
              const def = equipmentDefById(slotId);
              return (
                <div key={def.id} className="w-[4.6rem] sm:w-[5.1rem]">
                  <EquipmentDropSlot
                    slotId={def.id}
                    label={def.label}
                    equippedItem={equippedBySlotId.get(def.id)}
                    dragState={dragState}
                    className="shadow-[0_0_14px_rgba(0,0,0,0.4)]"
                    onEquippedTooltipEnter={onEquippedTooltipEnter}
                    onEquippedTooltipMove={onEquippedTooltipMove}
                    onEquippedTooltipLeave={onEquippedTooltipLeave}
                    onEquippedTooltipClick={onEquippedTooltipClick}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center px-1">
            <Image
              src={character.avatarSrc}
              alt="Avatar del personaje"
              width={384}
              height={384}
              className="h-auto max-h-[min(280px,46dvh)] w-auto max-w-full object-contain object-bottom drop-shadow-[0_14px_28px_rgba(0,0,0,0.5)] sm:max-h-[min(300px,50dvh)] lg:max-h-[min(320px,52dvh)]"
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </div>

          <div className="flex shrink-0 flex-col items-end justify-center gap-2.5 self-stretch">
            {PAPER_DOLL_RIGHT.map((slotId) => {
              const def = equipmentDefById(slotId);
              return (
                <div key={def.id} className="w-[4.6rem] sm:w-[5.1rem]">
                  <EquipmentDropSlot
                    slotId={def.id}
                    label={def.label}
                    equippedItem={equippedBySlotId.get(def.id)}
                    dragState={dragState}
                    className="shadow-[0_0_14px_rgba(0,0,0,0.4)]"
                    onEquippedTooltipEnter={onEquippedTooltipEnter}
                    onEquippedTooltipMove={onEquippedTooltipMove}
                    onEquippedTooltipLeave={onEquippedTooltipLeave}
                    onEquippedTooltipClick={onEquippedTooltipClick}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function InventoryGrid({
  profileTopRow,
  characterPaperDoll,
  slots,
  equippedItems,
}: {
  /** Solo columna de estadísticas (izquierda). */
  profileTopRow: ReactNode;
  characterPaperDoll: CharacterPaperDollData;
  slots: InventorySlot[];
  equippedItems: EquippedEntry[];
}) {
  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP);
  const [dragState, setDragState] = useState<DragOverState>({
    slot: null,
    isCompatible: false,
  });
  const [toast, setToast] = useState<ToastState>({ open: false, message: "" });
  const [abilitiesOpen, setAbilitiesOpen] = useState(false);
  const [activeDragItem, setActiveDragItem] = useState<InventoryItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const dndContextId = useId().replace(/:/g, "");

  const equippedBySlotId = useMemo(() => buildEquippedBySlotId(equippedItems), [equippedItems]);

  const activeItem = useMemo(() => {
    if (tooltip.equippedSlotId) {
      return equippedBySlotId.get(tooltip.equippedSlotId) ?? null;
    }
    if (tooltip.slotNumber != null) {
      const slot = slots.find((s) => s.slotNumber === tooltip.slotNumber);
      return slot?.item ?? null;
    }
    return null;
  }, [tooltip.equippedSlotId, tooltip.slotNumber, slots, equippedBySlotId]);
  const activeTooltipBorderStyle =
    activeItem?.itemTypeId === 1 && activeItem?.rarityColor
      ? { borderColor: activeItem.rarityColor }
      : undefined;
  const activeTooltipNameStyle =
    activeItem?.itemTypeId === 1 && activeItem?.rarityColor
      ? { color: activeItem.rarityColor }
      : undefined;

  function openTooltip(x: number, y: number, slotNumber: number, pinned: boolean) {
    setTooltip({
      open: true,
      x: Math.min(x + 12, window.innerWidth - 320),
      y: Math.min(y + 12, window.innerHeight - 180),
      pinned,
      slotNumber,
      equippedSlotId: null,
    });
  }

  function openEquippedTooltip(x: number, y: number, equippedSlotId: string, pinned: boolean) {
    setTooltip({
      open: true,
      x: Math.min(x + 12, window.innerWidth - 320),
      y: Math.min(y + 12, window.innerHeight - 180),
      pinned,
      slotNumber: null,
      equippedSlotId,
    });
  }

  function hideTooltip() {
    setTooltip((previous) => (previous.pinned ? previous : INITIAL_TOOLTIP));
  }

  function closeTooltip() {
    setTooltip(INITIAL_TOOLTIP);
  }

  function togglePinnedTooltip(x: number, y: number, slotNumber: number) {
    setTooltip((previous) =>
      previous.open &&
      previous.pinned &&
      previous.slotNumber === slotNumber &&
      previous.equippedSlotId == null
        ? INITIAL_TOOLTIP
        : {
            open: true,
            x: Math.min(x + 12, window.innerWidth - 320),
            y: Math.min(y + 12, window.innerHeight - 180),
            pinned: true,
            slotNumber,
            equippedSlotId: null,
          },
    );
  }

  function togglePinnedEquippedTooltip(x: number, y: number, equippedSlotId: string) {
    setTooltip((previous) =>
      previous.open && previous.pinned && previous.equippedSlotId === equippedSlotId
        ? INITIAL_TOOLTIP
        : {
            open: true,
            x: Math.min(x + 12, window.innerWidth - 320),
            y: Math.min(y + 12, window.innerHeight - 180),
            pinned: true,
            slotNumber: null,
            equippedSlotId,
          },
    );
  }

  function handleEquipClick(item: InventoryItem) {
    if (!item.equipSlot) return;
    startTransition(async () => {
      try {
        await equipInventoryItem(item.id, item.equipSlot ?? undefined);
        closeTooltip();
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudo equipar el objeto.";
        setToast({ open: true, message });
        window.setTimeout(() => setToast({ open: false, message: "" }), 2600);
      }
    });
  }

  function handleDropInSlot(targetSlot: string, inventoryId: number | null) {
    if (!inventoryId) return;
    startTransition(async () => {
      try {
        await equipInventoryItem(inventoryId, targetSlot);
        setDragState({ slot: null, isCompatible: false });
        closeTooltip();
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudo equipar el objeto.";
        setToast({ open: true, message });
        window.setTimeout(() => setToast({ open: false, message: "" }), 2600);
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragState({ slot: null, isCompatible: false });
    setActiveDragItem(null);
    const overId = event.over?.id;
    if (!overId || typeof overId !== "string" || !overId.startsWith("equip-")) {
      return;
    }
    const slotId = overId.slice("equip-".length);
    const def = EQUIPMENT_SLOT_DEFS.find((d) => d.id === slotId);
    if (!def) return;
    const targetDbSlot = def.dbSlot;
    const draggedEquipSlot = String(event.active.data.current?.equipSlot ?? "");
    if (!draggedEquipSlot || draggedEquipSlot !== targetDbSlot) {
      setToast({
        open: true,
        message: "Ese objeto no se puede equipar en ese slot.",
      });
      window.setTimeout(() => setToast({ open: false, message: "" }), 2600);
      return;
    }
    const inventoryId = Number(event.active.data.current?.inventoryId ?? "");
    if (!Number.isFinite(inventoryId)) {
      return;
    }
    handleDropInSlot(targetDbSlot, inventoryId);
  }

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    const slotMatch = activeId.match(/^inventory-slot-(\d+)$/);
    if (!slotMatch) {
      setActiveDragItem(null);
      return;
    }
    const slotNumber = Number(slotMatch[1]);
    const draggedItem = slots.find((s) => s.slotNumber === slotNumber)?.item ?? null;
    setActiveDragItem(draggedItem);
  }

  return (
    <>
      <DndContext
        id={dndContextId}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={(event) => {
          const overId = event.over?.id;
          if (typeof overId === "string" && overId.startsWith("equip-")) {
            const slotId = overId.slice("equip-".length);
            const def = EQUIPMENT_SLOT_DEFS.find((d) => d.id === slotId);
            const draggedEquipSlot = String(event.active.data.current?.equipSlot ?? "");
            setDragState({
              slot: slotId,
              isCompatible: Boolean(def && draggedEquipSlot === def.dbSlot),
            });
            return;
          }
          setDragState({ slot: null, isCompatible: false });
        }}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setDragState({ slot: null, isCompatible: false });
          setActiveDragItem(null);
        }}
      >
        <div className="grid items-stretch gap-6 lg:grid-cols-12">
          {profileTopRow}
          <ClassicPaperDollPanel
            character={characterPaperDoll}
            equippedBySlotId={equippedBySlotId}
            dragState={dragState}
            onEquippedTooltipEnter={(clientX, clientY, slotId) => {
              const item = equippedBySlotId.get(slotId);
              if (!item) return;
              openEquippedTooltip(clientX, clientY, slotId, false);
            }}
            onEquippedTooltipMove={(clientX, clientY, slotId) => {
              const item = equippedBySlotId.get(slotId);
              if (!item) return;
              openEquippedTooltip(clientX, clientY, slotId, false);
            }}
            onEquippedTooltipLeave={hideTooltip}
            onEquippedTooltipClick={(clientX, clientY, slotId) => {
              const item = equippedBySlotId.get(slotId);
              if (!item) return;
              togglePinnedEquippedTooltip(clientX, clientY, slotId);
            }}
          />
          <section className="flex h-full min-h-0 flex-col rounded-xl border border-amber-800/60 bg-[#2a1812]/90 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] lg:col-span-4">
            <h2 className="shrink-0 text-lg font-semibold tracking-wide text-amber-300">INVENTARIO</h2>
            <div className="mt-3 shrink-0 border-t border-amber-900/70" />
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] lg:mt-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-900/80">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
                {slots.map((slot) => (
                  <DraggableInventorySlot
                    key={slot.slotNumber}
                    slot={slot}
                    onMouseEnter={(x, y) => openTooltip(x, y, slot.slotNumber, false)}
                    onMouseMove={(x, y) => openTooltip(x, y, slot.slotNumber, false)}
                    onMouseLeave={hideTooltip}
                    onClick={(x, y) => togglePinnedTooltip(x, y, slot.slotNumber)}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>

        <DragOverlay>
          {activeDragItem ? (
            <div
              className={`pointer-events-none relative aspect-square h-20 w-20 rounded-md border-2 bg-[#1f120e]/95 shadow-[0_8px_24px_rgba(0,0,0,0.45)] ${
                activeDragItem.rarityColor?.trim() ? "border-amber-900/70" : "border-amber-700/80"
              }`}
              style={
                activeDragItem.rarityColor?.trim()
                  ? { borderColor: activeDragItem.rarityColor }
                  : undefined
              }
            >
              <Image
                src={activeDragItem.iconPath}
                alt={activeDragItem.name}
                width={700}
                height={700}
                quality={100}
                className="h-auto w-auto max-h-full max-w-full object-contain p-1.5"
              />
              {activeDragItem.quantity > 1 ? (
                <span className={INVENTORY_QUANTITY_BADGE_CLASS}>×{activeDragItem.quantity}</span>
              ) : null}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <section
        className="mt-6 w-full rounded-xl border border-amber-800/60 bg-[#2a1812]/90 shadow-[0_0_30px_rgba(0,0,0,0.35)]"
        aria-label="Panel de habilidades"
      >
        <button
          type="button"
          id="habilidades-panel-toggle"
          aria-expanded={abilitiesOpen}
          aria-controls="habilidades-panel-body"
          onClick={() => setAbilitiesOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition hover:bg-amber-950/30"
        >
          <span id="habilidades-heading" className="text-lg font-semibold tracking-wide text-amber-300">
            HABILIDADES
          </span>
          <span className="shrink-0 text-amber-300/90" aria-hidden>
            <svg
              className={`h-5 w-5 transition-transform duration-200 ${abilitiesOpen ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>
        {abilitiesOpen ? (
          <div
            id="habilidades-panel-body"
            role="region"
            aria-labelledby="habilidades-heading"
            className="border-t border-amber-900/70 px-6 py-4"
          >
            <p className="text-sm text-amber-100/65">Por el momento no hay habilidades</p>
          </div>
        ) : null}
      </section>

      {tooltip.open && activeItem ? (
        <>
          {tooltip.pinned ? (
            <button
              type="button"
              aria-label="Cerrar información del ítem"
              className="fixed inset-0 z-40 cursor-default bg-transparent"
              onClick={closeTooltip}
            />
          ) : null}
          <div
            className="fixed z-50 w-72 rounded-lg border border-amber-700/70 bg-[#120f2a]/95 p-3 text-sm text-amber-50 shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
            style={{ left: tooltip.x, top: tooltip.y, ...activeTooltipBorderStyle }}
            onClick={(event) => event.stopPropagation()}
          >
            {activeItem.itemTypeId === 1 ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-bold leading-tight text-amber-200" style={activeTooltipNameStyle}>
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
                <p className="mt-1 text-xs italic text-amber-100/80">{activeItem.description}</p>
                <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-amber-400/45 to-transparent" />
                <p className="mt-1.5 text-[11px] uppercase tracking-wide text-amber-200/90">
                  {(activeItem.equipSlot ?? "Sin slot").toUpperCase()}
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
                            {weaponDamageRange(roll.attackDamageMin, roll.attackDamageMax)} Daño
                          </p>
                          <p>
                            {weaponDamageRange(roll.magicDamageMin, roll.magicDamageMax)} Daño Mágico
                          </p>
                        </>
                      ) : null}
                      {[
                        formatWeaponStatLine(roll.statKey1, roll.valueFlat1, roll.valuePct1),
                        formatWeaponStatLine(roll.statKey2, roll.valueFlat2, roll.valuePct2),
                        formatWeaponStatLine(roll.statKey3, roll.valueFlat3, roll.valuePct3),
                      ]
                        .filter(Boolean)
                        .map((line, index) => (
                          <p key={`${line}-${index}`}>{line}</p>
                        ))}
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {activeItem.name}
                </p>
                <p className="mt-2 italic leading-relaxed text-amber-50/90">{activeItem.description}</p>
              </>
            )}
            {activeItem.equipSlot && tooltip.slotNumber != null ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleEquipClick(activeItem)}
                className={`mt-3 w-full rounded-md border px-2 py-1.5 text-xs font-semibold transition md:hidden ${
                  isPending
                    ? "cursor-wait border-amber-800/60 bg-amber-900/35 text-amber-100/75"
                    : "cursor-pointer border-emerald-700/80 bg-emerald-800/70 text-emerald-100 hover:bg-emerald-700"
                }`}
              >
                {isPending ? "Equipando..." : "Equipar"}
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {toast.open ? (
        <div className="fixed bottom-4 right-4 z-[60] max-w-sm rounded-md border border-red-700/70 bg-[#2a120f]/95 px-3 py-2 text-sm text-red-100 shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
          {toast.message}
        </div>
      ) : null}
    </>
  );
}
