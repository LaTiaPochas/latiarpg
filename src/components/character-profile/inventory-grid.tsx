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
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  consumeInventoryItem,
  discardInventoryItems,
  equipInventoryItem,
} from "@/app/(main)/character_profile/actions";
import {
  formatInstanceStatRollTooltipLine,
  formatWeaponAttackTypeLabel,
  inventoryTooltipSubtitleUnderName,
  isInstanceStatWeakTooltipKey,
  type EquipmentInstanceTooltip,
  type WeaponInstanceTooltip,
} from "@/components/character-profile/inventory-types";
import { WeaponPhysicalDamageTooltipLine } from "@/components/character-profile/weapon-physical-damage-tooltip-line";
import {
  abilityTooltipStatGetterFromSheet,
  formatAbilityTooltipDescription,
  formatAbilityTooltipTotalDamageRange,
} from "@/lib/ability-tooltip-description";

type InventoryItem = {
  id: number;
  name: string;
  itemTypeCode?: string | null;
  description: string;
  quoteText: string | null;
  iconPath: string;
  quantity: number;
  equipSlot: string | null;
  sellValue: number;
  itemTypeId: number | null;
  usableByClassNames: string[];
  requiredMinLevel: number;
  requiredStats: Array<{ key: string; value: number }>;
  rarityColor: string | null;
  equippedSlot?: string | null;
  weaponInstance?: WeaponInstanceTooltip | null;
  equipmentInstance?: EquipmentInstanceTooltip | null;
  /** `items.json_consumable_effect` parseado; solo UI — el servidor valida de nuevo. */
  consumableEffect?: Record<string, unknown> | null;
};

type InventorySlot = {
  slotNumber: number;
  item: InventoryItem | null;
};
type EquippedEntry = {
  slot: string;
  item: InventoryItem;
};
type PlayerAbilityEntry = {
  id: string;
  name: string;
  iconPath: string;
  description: string;
  manaCost: number;
  cooldownTurns: number;
  unlockLevel: number;
  target: string;
  effect: Record<string, unknown>;
};
type AbilityStatSnapshot = {
  level: number;
  str: number;
  dex: number;
  int: number;
  wis: number;
  /** Base de perfil (arma equipada); sin buffs de combate. */
  weaponDamageMin: number;
  weaponDamageMax: number;
  magicDamageMin: number;
  magicDamageMax: number;
};
type MobileAbilityTooltipPos = {
  x: number;
  y: number;
};

type TooltipState = {
  open: boolean;
  x: number;
  y: number;
  flipY: boolean;
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
  flipY: false,
  pinned: false,
  slotNumber: null,
  equippedSlotId: null,
};

/** Badge de cantidad: un poco más de lectura que el plano, sin competir con el icono. */
const INVENTORY_QUANTITY_BADGE_CLASS =
  "absolute bottom-1 right-1 min-w-[1.25rem] select-none rounded-md border border-amber-900/45 bg-gradient-to-b from-black/78 to-black/88 px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums leading-none tracking-tight text-amber-200/90 shadow-sm sm:min-w-[1.35rem] sm:px-2 sm:py-1 sm:text-xs";

const abilitiesFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const MOBILE_ABILITY_TOOLTIP_WIDTH = 240;
const MOBILE_ABILITY_TOOLTIP_EDGE_GAP = 8;

function consumableInventoryFlag(effect: Record<string, unknown>): boolean {
  const v = effect.inventory;
  return v === true || v === "true" || v === 1 || v === "1";
}

function consumableInventoryStat(effect: Record<string, unknown>): string {
  const raw =
    effect["inventory-stat"] ??
    effect.inventory_stat ??
    effect.inventoryStat;
  return typeof raw === "string" ? raw.trim() : "";
}

function consumableInventoryAmount(effect: Record<string, unknown>): number {
  const candidates = [
    effect["amount-max"],
    effect["amount_max"],
    effect["amount-min"],
    effect["amount_min"],
    effect["amount"],
  ];
  for (const raw of candidates) {
    const n = Math.trunc(Number(raw ?? 0));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/** Botón CONSUMIR cuando `json_consumable_effect` indica uso desde inventario y hay stat/cantidad. */
function inventoryConsumableShowsConsume(effect: Record<string, unknown> | null | undefined): boolean {
  if (!effect || !consumableInventoryFlag(effect)) return false;
  const stat = consumableInventoryStat(effect);
  const delta = consumableInventoryAmount(effect);
  return Boolean(stat.length > 0 && delta > 0);
}
const itemTooltipFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

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

function weaponDamageRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  const a = min != null && Number.isFinite(Number(min)) ? Number(min) : 0;
  const b = max != null && Number.isFinite(Number(max)) ? Number(max) : 0;
  return `${a} - ${b}`;
}

function isDesktopViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 1024px)").matches;
}

type AbilitySubtype = "physical" | "magical" | "buff" | "neutral";
function abilitySubtype(effect: Record<string, unknown>): AbilitySubtype {
  const raw = effect.subtype;
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "physical") return "physical";
  if (s === "magical") return "magical";
  if (s === "buff") return "buff";
  return "neutral";
}
function abilityTargetKind(effect: Record<string, unknown>): "Single" | "AoE" | "Self" {
  const raw = typeof effect.target === "string" ? effect.target.trim().toLowerCase() : "";
  if (["self", "player", "ally", "friendly"].includes(raw)) return "Self";
  if (["area", "aoe", "all", "enemies_all", "enemies"].includes(raw)) return "AoE";
  return "Single";
}
function effectNum(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}
function abilityScalingEntryBonus(
  entry: unknown,
  getStat: ReturnType<typeof abilityTooltipStatGetterFromSheet>,
): number {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return 0;
  const rec = entry as Record<string, unknown>;
  const stat = typeof rec.stat === "string" ? rec.stat.trim().toUpperCase() : "";
  const ratio = effectNum(rec.ratio, Number.NaN);
  if (stat === "" || !Number.isFinite(ratio)) return 0;
  return Math.floor(Math.max(0, getStat(stat)) * ratio);
}

function abilityScalingBonus(
  scaling: unknown,
  getStat: ReturnType<typeof abilityTooltipStatGetterFromSheet>,
): number {
  if (scaling == null) return 0;
  if (Array.isArray(scaling)) {
    return scaling.reduce((sum, entry) => sum + abilityScalingEntryBonus(entry, getStat), 0);
  }
  if (typeof scaling === "object") return abilityScalingEntryBonus(scaling, getStat);
  return 0;
}

function abilityDamageRange(
  effect: Record<string, unknown>,
  getStat: ReturnType<typeof abilityTooltipStatGetterFromSheet>,
): { min: number; max: number } | null {
  const typeRaw = typeof effect.type === "string" ? effect.type.trim().toLowerCase() : "";
  if (typeRaw !== "damage") return null;
  const minV = Math.max(0, effectNum(effect.min, 0));
  const maxV = Math.max(minV, effectNum(effect.max, minV));
  const bonus = abilityScalingBonus(effect.scaling, getStat);
  return { min: Math.max(0, minV + bonus), max: Math.max(0, maxV + bonus) };
}
function abilityCardClass(subtype: AbilitySubtype): string {
  if (subtype === "physical") return "border-red-700/65 bg-red-950/40";
  if (subtype === "magical") return "border-sky-800/65 bg-sky-950/40";
  if (subtype === "buff") return "border-emerald-900/90 bg-emerald-500/30";
  return "border-slate-700/65 bg-slate-900/35";
}

function SkillCooldownClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function DraggableInventorySlot({
  slot,
  isSelected,
  discardMode,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onClick,
  onSelect,
}: {
  slot: InventorySlot;
  isSelected: boolean;
  /** Si está activo, no se permite arrastrar a equipamiento (solo selección múltiple para descarte). */
  discardMode: boolean;
  onMouseEnter: (x: number, y: number) => void;
  onMouseMove: (x: number, y: number) => void;
  onMouseLeave: () => void;
  onClick: (x: number, y: number) => void;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    // Debe ser único por celda: NO usar user_inventory.id solo, choca con slotNumber (1..24).
    id: `inventory-slot-${slot.slotNumber}`,
    disabled: discardMode || !slot.item?.equipSlot,
    data: {
      inventoryId: slot.item?.id ?? null,
      equipSlot: slot.item?.equipSlot ?? null,
    },
  });

  const rarityBorderStyle =
    slot.item?.rarityColor
      ? { borderColor: slot.item.rarityColor }
      : undefined;

  const blockItemTooltipsInDiscardMobile = discardMode && !isDesktopViewport();

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`relative aspect-square rounded-md border-2 border-amber-900/70 bg-[#1f120e]/85 shadow-inner shadow-black/40 ${
        isDragging ? "opacity-40 ring-2 ring-amber-400/60" : ""
      } ${
        isSelected ? "border-6 border-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.7)]" : ""
      }`}
      style={rarityBorderStyle}
      aria-label={`Espacio de inventario ${slot.slotNumber}`}
      onMouseEnter={(event) => {
        if (!slot.item || blockItemTooltipsInDiscardMobile) return;
        onMouseEnter(event.clientX, event.clientY);
      }}
      onMouseMove={(event) => {
        if (!slot.item || blockItemTooltipsInDiscardMobile) return;
        onMouseMove(event.clientX, event.clientY);
      }}
      onMouseLeave={
        blockItemTooltipsInDiscardMobile
          ? undefined
          : onMouseLeave
      }
      onClick={(event) => {
        if (!slot.item) return;
        event.preventDefault();
        event.stopPropagation();
        onSelect();
        if (!blockItemTooltipsInDiscardMobile) {
          onClick(event.clientX, event.clientY);
        }
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
            quality={75}
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
              quality={75}
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
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-amber-800/60 bg-[#2a1812]/90 p-4 shadow-[0_0_30px_rgba(0,0,0,0.35)] sm:p-5 lg:col-span-5 lg:p-6">
      <div className="shrink-0 text-center">
        <h1 className="text-xl font-bold text-amber-200 sm:text-2xl lg:text-3xl">{character.characterNameUppercase}</h1>
        <p className="mt-1 text-xs text-amber-100/80 sm:text-sm lg:mt-2 lg:text-base">
          Nivel <span className="font-semibold">{character.level}</span> -{" "}
          <span className="font-semibold">{classDisplay}</span>
        </p>
        <div className="mx-auto mt-2 w-full max-w-md lg:mt-3">
          <div className="h-2.5 overflow-hidden rounded-full border border-violet-300/50 bg-[#140a1e] lg:h-3">
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

      <div className="relative mt-3 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-amber-900/65 bg-gradient-to-b from-[#1c100c] via-[#120a08] to-[#0a0605] shadow-inner shadow-black/50 lg:mt-4 lg:min-h-[14rem]">
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

          <div className="relative z-0 flex min-h-0 min-w-0 flex-1 items-center justify-center px-0.5 sm:px-1">
            <Image
              src={character.avatarSrc}
              alt="Avatar del personaje"
              width={384}
              height={384}
              className="relative z-0 h-auto max-h-[min(480px,80dvh)] w-auto max-w-[150%] object-contain object-bottom drop-shadow-[0_14px_28px_rgba(0,0,0,0.5)] sm:max-h-[min(360px,60dvh)] sm:max-w-[112%] lg:max-h-[min(320px,52dvh)] lg:max-w-full"
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
  currentClassName,
  currentLevel,
  currentStats,
  abilities,
  abilityStats,
}: {
  /** Solo columna de estadísticas (izquierda). */
  profileTopRow: ReactNode;
  characterPaperDoll: CharacterPaperDollData;
  slots: InventorySlot[];
  equippedItems: EquippedEntry[];
  currentClassName: string;
  currentLevel: number;
  currentStats: { str: number; dex: number; int: number; wis: number; speed: number };
  abilities: PlayerAbilityEntry[];
  abilityStats: AbilityStatSnapshot;
}) {
  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP);
  const [dragState, setDragState] = useState<DragOverState>({
    slot: null,
    isCompatible: false,
  });
  const [errorModal, setErrorModal] = useState<ToastState>({ open: false, message: "" });
  const [discardInstructionModalOpen, setDiscardInstructionModalOpen] = useState(false);
  const [discardFinalConfirmOpen, setDiscardFinalConfirmOpen] = useState(false);
  const [isDiscardSelecting, setIsDiscardSelecting] = useState(false);
  const [discardSelectedSlotNumbers, setDiscardSelectedSlotNumbers] = useState<number[]>([]);
  const [abilitiesOpen, setAbilitiesOpen] = useState(false);
  const [mobileAbilityTooltipId, setMobileAbilityTooltipId] = useState<string | null>(null);
  const [mobileAbilityTooltipPos, setMobileAbilityTooltipPos] = useState<MobileAbilityTooltipPos | null>(null);
  const [desktopTooltipUpById, setDesktopTooltipUpById] = useState<Record<string, boolean>>({});
  const [activeMobilePanel, setActiveMobilePanel] = useState<"stats" | "inventory" | "abilities" | null>(
    null,
  );
  const [activeDragItem, setActiveDragItem] = useState<InventoryItem | null>(null);
  const [selectedInventorySlot, setSelectedInventorySlot] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const dndContextId = useId().replace(/:/g, "");

  const equippedBySlotId = useMemo(() => buildEquippedBySlotId(equippedItems), [equippedItems]);

  const abilityTooltipGetStat = abilityTooltipStatGetterFromSheet(abilityStats);

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
    activeItem?.rarityColor
      ? { borderColor: activeItem.rarityColor }
      : undefined;
  const activeTooltipNameStyle =
    activeItem?.rarityColor
      ? { color: activeItem.rarityColor }
      : undefined;
  useEffect(() => {
    if (selectedInventorySlot == null) return;
    const stillExists = slots.some((slot) => slot.slotNumber === selectedInventorySlot && Boolean(slot.item));
    if (!stillExists) setSelectedInventorySlot(null);
  }, [selectedInventorySlot, slots]);

  useEffect(() => {
    if (isDiscardSelecting) closeTooltip();
  }, [isDiscardSelecting]);

  useEffect(() => {
    if (!isDiscardSelecting) return;
    setDiscardSelectedSlotNumbers((previous) =>
      previous.filter((slotNumber) => {
        const slot = slots.find((s) => s.slotNumber === slotNumber);
        const item = slot?.item ?? null;
        return Boolean(item && !item.equippedSlot);
      }),
    );
  }, [slots, isDiscardSelecting]);

  useEffect(() => {
    if (!mobileAbilityTooltipId) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-mobile-ability-tooltip="true"]')) return;
      if (target.closest('[data-mobile-ability-trigger="true"]')) return;
      setMobileAbilityTooltipId(null);
      setMobileAbilityTooltipPos(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [mobileAbilityTooltipId]);

  const discardSelectedItems = useMemo(() => {
    const list: InventoryItem[] = [];
    for (const slotNumber of discardSelectedSlotNumbers) {
      const slot = slots.find((s) => s.slotNumber === slotNumber);
      const item = slot?.item ?? null;
      if (item && !item.equippedSlot) list.push(item);
    }
    return list;
  }, [discardSelectedSlotNumbers, slots]);

  function resetDiscardFlow() {
    setDiscardInstructionModalOpen(false);
    setDiscardFinalConfirmOpen(false);
    setIsDiscardSelecting(false);
    setDiscardSelectedSlotNumbers([]);
    setSelectedInventorySlot(null);
  }

  function tooltipPositionFromPointer(x: number, y: number): { x: number; y: number; flipY: boolean } {
    const TOOLTIP_W = 320;
    // Solo decide si conviene abrir arriba; el anclaje exacto se resuelve con transform.
    const TOOLTIP_MIN_H = 220;
    const GAP = 12;
    const EDGE = 8;

    const nextX = Math.min(Math.max(EDGE, x + GAP), Math.max(EDGE, window.innerWidth - TOOLTIP_W));
    const shouldFlipUp = y + GAP + TOOLTIP_MIN_H > window.innerHeight - EDGE;
    const nextY = shouldFlipUp ? y - GAP : y + GAP;

    return { x: nextX, y: nextY, flipY: shouldFlipUp };
  }

  function openTooltip(x: number, y: number, slotNumber: number, pinned: boolean) {
    setTooltip((previous) => {
      // No sustituir un tooltip ya fijado (p. ej. consumible en desktop) por el hover del mismo slot.
      if (
        !pinned &&
        previous.pinned &&
        previous.slotNumber === slotNumber &&
        previous.equippedSlotId == null
      ) {
        return previous;
      }
      const pos = tooltipPositionFromPointer(x, y);
      return {
        open: true,
        x: pos.x,
        y: pos.y,
        flipY: pos.flipY,
        pinned,
        slotNumber,
        equippedSlotId: null,
      };
    });
  }

  function openEquippedTooltip(x: number, y: number, equippedSlotId: string, pinned: boolean) {
    const pos = tooltipPositionFromPointer(x, y);
    setTooltip({
      open: true,
      x: pos.x,
      y: pos.y,
      flipY: pos.flipY,
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
    const slot = slots.find((s) => s.slotNumber === slotNumber);
    const usePinnedOnDesktop =
      Boolean(slot?.item && inventoryConsumableShowsConsume(slot.item.consumableEffect));

    if (isDesktopViewport() && !usePinnedOnDesktop) {
      openTooltip(x, y, slotNumber, false);
      return;
    }
    const pos = tooltipPositionFromPointer(x, y);
    setTooltip((previous) =>
      previous.open &&
      previous.pinned &&
      previous.slotNumber === slotNumber &&
      previous.equippedSlotId == null
        ? INITIAL_TOOLTIP
        : {
            open: true,
            x: pos.x,
            y: pos.y,
            flipY: pos.flipY,
            pinned: true,
            slotNumber,
            equippedSlotId: null,
          },
    );
  }

  function togglePinnedEquippedTooltip(x: number, y: number, equippedSlotId: string) {
    if (isDesktopViewport()) {
      openEquippedTooltip(x, y, equippedSlotId, false);
      return;
    }
    const pos = tooltipPositionFromPointer(x, y);
    setTooltip((previous) =>
      previous.open && previous.pinned && previous.equippedSlotId === equippedSlotId
        ? INITIAL_TOOLTIP
        : {
            open: true,
            x: pos.x,
            y: pos.y,
            flipY: pos.flipY,
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
        setErrorModal({ open: true, message });
      }
    });
  }

  function handleConsumeInventoryItem(item: InventoryItem) {
    startTransition(async () => {
      try {
        await consumeInventoryItem(item.id);
        closeTooltip();
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudo consumir el objeto.";
        setErrorModal({ open: true, message });
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
        setErrorModal({ open: true, message });
      }
    });
  }

  function handleOpenDiscardIntro() {
    if (isPending) return;
    setDiscardInstructionModalOpen(true);
  }

  function handleBeginDiscardSelection() {
    setDiscardInstructionModalOpen(false);
    setIsDiscardSelecting(true);
    setDiscardSelectedSlotNumbers([]);
    setSelectedInventorySlot(null);
    closeTooltip();
  }

  function handleCancelDiscardIntro() {
    setDiscardInstructionModalOpen(false);
  }

  function handleInventorySlotSelect(slot: InventorySlot) {
    const item = slot.item;
    if (!item) return;
    if (isDiscardSelecting) {
      if (item.equippedSlot) {
        setErrorModal({
          open: true,
          message: "No podés descartar objetos equipados.",
        });
        return;
      }
      setDiscardSelectedSlotNumbers((previous) =>
        previous.includes(slot.slotNumber)
          ? previous.filter((n) => n !== slot.slotNumber)
          : [...previous, slot.slotNumber],
      );
      return;
    }
    setSelectedInventorySlot((previous) => (previous === slot.slotNumber ? null : slot.slotNumber));
  }

  function handleOpenDiscardFinalConfirm() {
    if (!discardSelectedItems.length || isPending) return;
    setDiscardFinalConfirmOpen(true);
  }

  function handleCancelDiscardFinal() {
    setDiscardFinalConfirmOpen(false);
    resetDiscardFlow();
    closeTooltip();
  }

  function handleConfirmDiscardMany() {
    const ids = discardSelectedItems.map((item) => item.id);
    if (!ids.length) return;
    startTransition(async () => {
      try {
        await discardInventoryItems(ids);
        setDiscardFinalConfirmOpen(false);
        resetDiscardFlow();
        closeTooltip();
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudieron descartar los objetos.";
        setErrorModal({ open: true, message });
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
      setErrorModal({
        open: true,
        message: "Ese objeto no se puede equipar en ese slot.",
      });
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
        <div className="grid items-stretch gap-3 lg:gap-6 lg:grid-cols-12">
          <div className="order-1 lg:order-2 lg:col-span-5">
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
          </div>

          <section className="order-3 rounded-lg border border-amber-800/60 bg-[#2a1812]/90 shadow-[0_0_20px_rgba(0,0,0,0.3)] lg:rounded-xl lg:shadow-[0_0_30px_rgba(0,0,0,0.35)] lg:order-1 lg:col-span-3 lg:border-none lg:bg-transparent lg:shadow-none">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-1 text-left lg:hidden"
              aria-expanded={activeMobilePanel === "stats"}
              onClick={() =>
                setActiveMobilePanel((current) => (current === "stats" ? null : "stats"))
              }
            >
              <span className="text-sm font-semibold tracking-wide text-amber-300">ESTADISTICAS</span>
              <span
                className={`text-amber-300/90 transition-transform ${
                  activeMobilePanel === "stats" ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>
            <div
              className={`${activeMobilePanel === "stats" ? "block" : "hidden"} lg:block [&_h2:first-of-type]:hidden lg:[&_h2:first-of-type]:block`}
            >
              {profileTopRow}
            </div>
          </section>

          <section className="order-2 flex min-h-0 flex-col rounded-lg border border-amber-800/60 bg-[#2a1812]/90 shadow-[0_0_20px_rgba(0,0,0,0.3)] lg:rounded-xl lg:shadow-[0_0_30px_rgba(0,0,0,0.35)] lg:col-span-4">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-1 text-left lg:hidden"
              aria-expanded={activeMobilePanel === "inventory"}
              onClick={() =>
                setActiveMobilePanel((current) => (current === "inventory" ? null : "inventory"))
              }
            >
              <span className="text-sm font-semibold tracking-wide text-amber-300">INVENTARIO</span>
              <span
                className={`text-amber-300/90 transition-transform ${
                  activeMobilePanel === "inventory" ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>
            <div className={`${activeMobilePanel === "inventory" ? "block" : "hidden"} lg:block`}>
              <div className="px-3 pb-3 pt-1.5 lg:p-6">
                <h2 className="hidden shrink-0 text-lg font-semibold tracking-wide text-amber-300 lg:block">
                  INVENTARIO
                </h2>
                <div className="mt-2 shrink-0 border-t border-amber-900/70" />
                <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] lg:mt-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-900/80">
                  <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-5 sm:gap-2 lg:grid-cols-3 xl:grid-cols-4">
                    {slots.map((slot) => (
                      <DraggableInventorySlot
                        key={slot.slotNumber}
                        slot={slot}
                        discardMode={isDiscardSelecting}
                        isSelected={
                          isDiscardSelecting
                            ? discardSelectedSlotNumbers.includes(slot.slotNumber)
                            : selectedInventorySlot === slot.slotNumber
                        }
                        onMouseEnter={(x, y) => openTooltip(x, y, slot.slotNumber, false)}
                        onMouseMove={(x, y) => openTooltip(x, y, slot.slotNumber, false)}
                        onMouseLeave={hideTooltip}
                        onClick={(x, y) => togglePinnedTooltip(x, y, slot.slotNumber)}
                        onSelect={() => handleInventorySlotSelect(slot)}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {isDiscardSelecting ? (
                    <>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          resetDiscardFlow();
                          closeTooltip();
                        }}
                        className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                          isPending
                            ? "cursor-not-allowed border-amber-800/65 bg-amber-950/45 text-amber-100/65"
                            : "cursor-pointer border-amber-700/85 bg-amber-950/50 text-amber-100 hover:bg-amber-900/65"
                        }`}
                        aria-label="Cancelar modo descarte"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={discardSelectedItems.length === 0 || isPending}
                        onClick={handleOpenDiscardFinalConfirm}
                        className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                          discardSelectedItems.length === 0 || isPending
                            ? "cursor-not-allowed border-red-800/65 bg-red-950/45 text-red-200/70"
                            : "cursor-pointer border-red-700/85 bg-red-900/70 text-red-100 hover:bg-red-800/80"
                        }`}
                        aria-label="Confirmar objetos seleccionados para descartar"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                          aria-hidden
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M6 6l1 14h10l1-14" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                        CONFIRMAR
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleOpenDiscardIntro}
                      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                        isPending
                          ? "cursor-not-allowed border-red-800/65 bg-red-950/45 text-red-200/70"
                          : "cursor-pointer border-red-700/85 bg-red-900/70 text-red-100 hover:bg-red-800/80"
                      }`}
                      aria-label="Descartar items"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                        aria-hidden
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M6 6l1 14h10l1-14" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                      Descartar
                    </button>
                  )}
                </div>
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
                quality={75}
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
        className={`${abilitiesFont.className} mt-1 w-full rounded-lg border border-amber-800/60 bg-[#2a1812]/90 shadow-[0_0_20px_rgba(0,0,0,0.3)] lg:mt-6 lg:rounded-xl lg:shadow-[0_0_30px_rgba(0,0,0,0.35)]`}
        aria-label="Panel de habilidades"
      >
        <button
          type="button"
          id="habilidades-panel-toggle"
          aria-expanded={abilitiesOpen || activeMobilePanel === "abilities"}
          aria-controls="habilidades-panel-body"
          onClick={() => {
            setAbilitiesOpen((open) => !open);
            setActiveMobilePanel((current) => (current === "abilities" ? null : "abilities"));
          }}
          className="flex w-full items-center justify-between px-3 py-1 text-left transition hover:bg-amber-950/30 lg:px-6 lg:py-4"
        >
          <span id="habilidades-heading" className="text-sm font-semibold tracking-wide text-amber-300 lg:text-lg">
            HABILIDADES
          </span>
          <span
            className={`shrink-0 text-amber-300/90 transition-transform ${
              abilitiesOpen || activeMobilePanel === "abilities" ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            ▼
          </span>
        </button>
        {(abilitiesOpen || activeMobilePanel === "abilities") ? (
          <div
            id="habilidades-panel-body"
            role="region"
            aria-labelledby="habilidades-heading"
            className="border-t border-amber-900/70 px-3 py-2.5 lg:px-6 lg:py-4"
          >
            {abilities.length === 0 ? (
              <p className="text-sm text-amber-100/65">No tenés habilidades aprendidas.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {abilities.map((ability) => {
                  const subtype = abilitySubtype(ability.effect);
                  const targetKind = abilityTargetKind(ability.effect);
                  const dmg = abilityDamageRange(ability.effect, abilityTooltipGetStat);
                  const isMobileTooltipOpen = mobileAbilityTooltipId === ability.id;
                  const shouldOpenUpDesktop = desktopTooltipUpById[ability.id] === true;
                  return (
                    <article
                      key={ability.id}
                      className={`group relative rounded-md border px-1 py-1 sm:px-2 sm:py-2 ${abilityCardClass(subtype)}`}
                      onMouseEnter={(event) => {
                        if (!isDesktopViewport()) return;
                        const cardRect = event.currentTarget.getBoundingClientRect();
                        const estimatedTooltipHeight = 180;
                        const spaceBelow = window.innerHeight - cardRect.bottom;
                        setDesktopTooltipUpById((prev) => ({
                          ...prev,
                          [ability.id]: spaceBelow < estimatedTooltipHeight,
                        }));
                      }}
                    >
                      <button
                        type="button"
                        data-mobile-ability-trigger="true"
                        onClick={(event) => {
                          if (isDesktopViewport()) return;
                          const visualViewport = window.visualViewport;
                          const viewportWidth = visualViewport?.width ?? window.innerWidth;
                          const viewportHeight = visualViewport?.height ?? window.innerHeight;
                          const viewportOffsetLeft = visualViewport?.offsetLeft ?? 0;
                          const viewportOffsetTop = visualViewport?.offsetTop ?? 0;
                          const clickX = event.clientX + viewportOffsetLeft;
                          const clickY = event.clientY + viewportOffsetTop;
                          const availableWidth = viewportWidth - MOBILE_ABILITY_TOOLTIP_EDGE_GAP * 2;
                          const effectiveTooltipWidth = Math.max(
                            120,
                            Math.min(MOBILE_ABILITY_TOOLTIP_WIDTH, availableWidth),
                          );
                          const halfTooltipWidth = effectiveTooltipWidth / 2;
                          const minX =
                            viewportOffsetLeft + MOBILE_ABILITY_TOOLTIP_EDGE_GAP + halfTooltipWidth;
                          const maxX =
                            viewportOffsetLeft +
                            viewportWidth -
                            MOBILE_ABILITY_TOOLTIP_EDGE_GAP -
                            halfTooltipWidth;
                          const clampedX =
                            minX > maxX
                              ? viewportOffsetLeft + viewportWidth / 2
                              : Math.min(Math.max(clickX, minX), maxX);
                          const anchorY = Math.min(
                            viewportOffsetTop + viewportHeight - MOBILE_ABILITY_TOOLTIP_EDGE_GAP,
                            Math.max(viewportOffsetTop + MOBILE_ABILITY_TOOLTIP_EDGE_GAP, clickY),
                          );
                          setMobileAbilityTooltipId((current) => {
                            const next = current === ability.id ? null : ability.id;
                            if (next === null) {
                              setMobileAbilityTooltipPos(null);
                            } else {
                              setMobileAbilityTooltipPos({ x: clampedX, y: anchorY });
                            }
                            return next;
                          });
                        }}
                        className="flex w-full items-start gap-2 text-left sm:gap-2"
                      >
                        <Image
                          src={ability.iconPath}
                          alt={ability.name}
                          width={250}
                          height={250}
                          className="h-11 w-11 rounded-sm object-cover sm:h-20 sm:w-20"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-amber-100">{ability.name}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-[8px] font-semibold text-amber-300/90 sm:text-[11px]">
                            <span>{ability.manaCost} MP</span>
                            <span className="inline-flex items-center gap-1">
                              <SkillCooldownClockIcon className="h-3 w-3 shrink-0 opacity-95" />
                              CD {ability.cooldownTurns}
                            </span>
                          </div>
                        </div>
                      </button>

                      <div
                        className={`absolute left-1/2 bottom-[calc(100%+8px)] z-20 hidden w-[240px] -translate-x-1/2 rounded-md border border-amber-700/70 bg-[#1a100c]/95 p-2 text-xs shadow-[0_10px_25px_rgba(0,0,0,0.35)] lg:w-[260px] lg:group-hover:block ${
                          shouldOpenUpDesktop
                            ? "lg:bottom-[calc(100%+8px)] lg:top-auto"
                            : "lg:top-[calc(100%+8px)] lg:bottom-auto"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold">
                            <span className="text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.25)]">
                              {ability.name}
                            </span>
                            <span className="text-amber-200/88">
                              {" "}
                              ({ability.manaCost} MP) - {targetKind}
                            </span>
                          </p>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300/90">
                            <SkillCooldownClockIcon className="h-3 w-3 shrink-0 opacity-95" />
                            CD {ability.cooldownTurns}
                          </span>
                        </div>
                        {dmg ? (
                          <>
                            <p className="mt-1 text-xs font-semibold text-amber-100/90">
                              Daño:{" "}
                              {formatAbilityTooltipTotalDamageRange(
                                dmg.min,
                                dmg.max,
                                0,
                              )}
                            </p>
                            <div
                              className="mt-1 h-px w-full bg-gradient-to-r from-transparent via-amber-300/50 to-transparent"
                              aria-hidden
                            />
                          </>
                        ) : null}
                        <p className="mt-1 text-xs leading-relaxed text-amber-100/75">
                          {formatAbilityTooltipDescription(
                            ability.description,
                            ability.effect,
                            abilityTooltipGetStat,
                          )}
                        </p>
                      </div>
                      {isMobileTooltipOpen &&
                      mobileAbilityTooltipPos &&
                      typeof document !== "undefined"
                        ? createPortal(
                            <div
                              data-mobile-ability-tooltip="true"
                              className="fixed z-[90] rounded-md border border-amber-700/70 bg-[#1a100c]/95 p-2 text-xs shadow-[0_10px_25px_rgba(0,0,0,0.35)] lg:hidden"
                              style={{
                                left: `${mobileAbilityTooltipPos.x}px`,
                                top: `${mobileAbilityTooltipPos.y}px`,
                                transform: "translate(-50%, -100%)",
                                width: `min(${MOBILE_ABILITY_TOOLTIP_WIDTH}px, calc(100vw - ${MOBILE_ABILITY_TOOLTIP_EDGE_GAP * 2}px))`,
                                maxWidth: `calc(100vw - ${MOBILE_ABILITY_TOOLTIP_EDGE_GAP * 2}px)`,
                                maxHeight: `${Math.max(
                                  120,
                                  mobileAbilityTooltipPos.y - MOBILE_ABILITY_TOOLTIP_EDGE_GAP,
                                )}px`,
                                overflowY: "auto",
                              }}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold">
                                  <span className="text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.25)]">
                                    {ability.name}
                                  </span>
                                  <span className="text-amber-200/88">
                                    {" "}
                                    ({ability.manaCost} MP) - {targetKind}
                                  </span>
                                </p>
                                <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300/90">
                                  <SkillCooldownClockIcon className="h-3 w-3 shrink-0 opacity-95" />
                                  CD {ability.cooldownTurns}
                                </span>
                              </div>
                              {dmg ? (
                                <>
                                  <p className="mt-1 text-xs font-semibold text-amber-100/90">
                                    Daño:{" "}
                                    {formatAbilityTooltipTotalDamageRange(
                                      dmg.min,
                                      dmg.max,
                                      0,
                                    )}
                                  </p>
                                  <div
                                    className="mt-1 h-px w-full bg-gradient-to-r from-transparent via-amber-300/50 to-transparent"
                                    aria-hidden
                                  />
                                </>
                              ) : null}
                              <p className="mt-1 text-xs leading-relaxed text-amber-100/75">
                                {formatAbilityTooltipDescription(
                            ability.description,
                            ability.effect,
                            abilityTooltipGetStat,
                          )}
                              </p>
                            </div>,
                            document.body,
                          )
                        : null}
                    </article>
                  );
                })}
              </div>
            )}
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
                    - <em>"{activeItem.quoteText}"</em>
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
                      {(
                        [
                          [roll.statKey1, formatInstanceStatRollTooltipLine(roll.statKey1, roll.valueFlat1, roll.valuePct1)],
                          [roll.statKey2, formatInstanceStatRollTooltipLine(roll.statKey2, roll.valueFlat2, roll.valuePct2)],
                          [roll.statKey3, formatInstanceStatRollTooltipLine(roll.statKey3, roll.valueFlat3, roll.valuePct3)],
                          [roll.statKey4, formatInstanceStatRollTooltipLine(roll.statKey4, roll.valueFlat4, roll.valuePct4)],
                          [roll.statKey5, formatInstanceStatRollTooltipLine(roll.statKey5, roll.valueFlat5, roll.valuePct5)],
                        ] as const
                      )
                        .filter((entry): entry is [typeof roll.statKey1, string] => Boolean(entry[1]))
                        .map(([statKey, line], index) => (
                          <p
                            key={`${line}-${index}`}
                            className={isInstanceStatWeakTooltipKey(statKey) ? "font-medium text-red-400" : undefined}
                          >
                            {line}
                          </p>
                        ))}
                    </div>
                  );
                })()}
                {(() => {
                  const classReqs = activeItem.usableByClassNames;
                  const classReqVisible = classReqs.length > 0;
                  const classReqMet = classReqVisible
                    ? classReqs.some(
                        (name) => name.trim().toLowerCase() === currentClassName.trim().toLowerCase(),
                      )
                    : true;

                  const levelReqVisible = activeItem.requiredMinLevel > 0;
                  const levelReqMet = currentLevel >= activeItem.requiredMinLevel;

                  const statReqs = activeItem.requiredStats;
                  const hasAnyReq = classReqVisible || levelReqVisible || statReqs.length > 0;
                  if (!hasAnyReq) return null;

                  const statValueFor = (key: string): number => {
                    const k = key.trim().toLowerCase();
                    if (k === "str") return currentStats.str;
                    if (k === "dex") return currentStats.dex;
                    if (k === "int") return currentStats.int;
                    if (k === "wis") return currentStats.wis;
                    if (k === "spd" || k === "speed" || k === "vel" || k === "velocidad") {
                      return currentStats.speed;
                    }
                    return 0;
                  };

                  return (
                    <div className="mt-2">
                      <p className={`${abilitiesFont.className} text-[11px] font-bold uppercase tracking-wide text-amber-300/95`}>
                        REQUISITOS
                      </p>
                      {classReqVisible ? (
                        <p className={`mt-1 text-xs font-semibold ${classReqMet ? "text-emerald-300" : "text-red-300"}`}>
                          Clase: {classReqs.join(", ")}
                        </p>
                      ) : null}
                      {levelReqVisible ? (
                        <p className={`mt-1 text-xs font-semibold ${levelReqMet ? "text-emerald-300" : "text-red-300"}`}>
                          Nivel: {activeItem.requiredMinLevel}
                        </p>
                      ) : null}
                      {statReqs.map((req, idx) => {
                        const met = statValueFor(req.key) >= req.value;
                        return (
                          <p key={`${req.key}-${req.value}-${idx}`} className={`mt-1 text-xs font-semibold ${met ? "text-emerald-300" : "text-red-300"}`}>
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
                  <p className={`${abilitiesFont.className} text-xs font-bold uppercase tracking-wider text-amber-300`}>
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
                    <p className={`${abilitiesFont.className} mt-0 text-[11px] font-semibold text-amber-300/85`}>
                      {subtitle}
                    </p>
                  );
                })()}
                <p className={`${itemTooltipFont.className} text-[12px] mt-2 italic leading-relaxed text-amber-50/90`}>
                  {activeItem.description}
                </p>
                {activeItem.quoteText ? (
                  <p
                    className={`${itemTooltipFont.className} mt-1.5 text-[11px] italic leading-relaxed text-amber-200/85`}
                    style={{ fontStyle: "italic" }}
                  >
                    - <em>"{activeItem.quoteText}"</em>
                  </p>
                ) : null}
              </>
            )}
            {(() => {
              if (!activeItem.equipSlot || tooltip.slotNumber == null) return null;
              const equipSlot = (activeItem.equipSlot ?? "").trim().toLowerCase();
              const hideEquipButton = [
                "material",
                "consumable",
                "resource",
                "recipe",
                "key items",
                "key_items",
                "keyitems",
              ].includes(equipSlot);
              if (hideEquipButton) return null;
              return (
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
              );
            })()}
            {tooltip.slotNumber != null &&
            inventoryConsumableShowsConsume(activeItem.consumableEffect) ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleConsumeInventoryItem(activeItem)}
                className={`mt-3 w-full rounded-md border px-2 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  isPending
                    ? "cursor-wait border-violet-800/60 bg-violet-950/35 text-violet-100/75"
                    : "cursor-pointer border-violet-600/85 bg-violet-900/75 text-violet-50 hover:bg-violet-800/85"
                }`}
              >
                {isPending ? "Consumiendo..." : "CONSUMIR"}
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {errorModal.open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div
            className={`${abilitiesFont.className} relative w-full max-w-md rounded-xl border border-red-700/80 bg-[#2a120f]/95 p-4 pr-10 text-red-100 shadow-[0_14px_40px_rgba(0,0,0,0.55)]`}
            role="dialog"
            aria-modal="true"
            aria-label="Error al equipar objeto"
          >
            <button
              type="button"
              onClick={() => setErrorModal({ open: false, message: "" })}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-red-500/80 bg-red-950/70 text-xs font-black text-red-100 transition hover:bg-red-800/80"
              aria-label="Cerrar error"
            >
              X
            </button>
            <p className="text-sm font-semibold leading-relaxed">{errorModal.message}</p>
          </div>
        </div>
      ) : null}
      {discardInstructionModalOpen ? (
        <div className="fixed inset-0 z-[81] flex items-center justify-center bg-black/65 p-4">
          <div
            className={`${abilitiesFont.className} w-full max-w-md rounded-xl border border-amber-700/80 bg-[#2a1812]/95 p-5 text-amber-100 shadow-[0_14px_40px_rgba(0,0,0,0.55)]`}
            role="dialog"
            aria-modal="true"
            aria-label="Selección de items para descartar"
          >
            <p className="text-base font-semibold leading-relaxed">
              Selecciona los items que queres descartar
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelDiscardIntro}
                className="rounded-md border border-amber-700/80 bg-amber-950/45 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:bg-amber-900/60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBeginDiscardSelection}
                className="rounded-md border border-red-700/85 bg-red-900/75 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-red-100 transition hover:bg-red-800/85"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {discardFinalConfirmOpen ? (
        <div className="fixed inset-0 z-[82] flex items-center justify-center bg-black/65 p-4">
          <div
            className={`${abilitiesFont.className} w-full max-w-md rounded-xl border border-amber-700/80 bg-[#2a1812]/95 p-5 text-amber-100 shadow-[0_14px_40px_rgba(0,0,0,0.55)]`}
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar eliminación de items"
          >
            <p className="text-base font-semibold leading-relaxed">
              ¿Estás seguro que querés eliminar los items seleccionados?
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-amber-200/95">
              {discardSelectedItems.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
            {discardSelectedItems.some((item) => item.quantity > 1) ? (
              <p className="mt-3 text-xs italic text-red-400/80">
                (Si un item es stackeable, se eliminará el stack completo).
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleCancelDiscardFinal}
                className="rounded-md border border-amber-700/80 bg-amber-950/45 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:bg-amber-900/60"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmDiscardMany}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  isPending
                    ? "cursor-wait border-red-800/65 bg-red-950/45 text-red-200/70"
                    : "cursor-pointer border-red-700/85 bg-red-900/75 text-red-100 hover:bg-red-800/85"
                }`}
              >
                {isPending ? "Eliminando..." : "CONFIRMAR"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
