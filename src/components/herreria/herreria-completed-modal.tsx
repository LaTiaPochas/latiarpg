"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { GarrisonBackLink } from "@/components/camp/garrison-back-link";
import { HerreriaHelpButton } from "@/components/herreria/herreria-help-button";
import { WeaponPhysicalDamageTooltipLine } from "@/components/character-profile/weapon-physical-damage-tooltip-line";

export type HerreriaRecipeInventoryItem = {
  inventoryId: number;
  name: string;
  iconPath: string;
  quantity: number;
  rarityColor: string | null;
  isMaxLevel: boolean;
};
export type HerreriaCraftCategory = "consumable" | "equipment" | "other";

export type HerreriaAvailableRecipeItem = {
  recipeId: string;
  name: string;
  craftedItemName: string;
  /** `items.item_types.code` del ítem fabricado (p. ej. `consumable`, `equipment`, `weapon`). */
  craftedItemTypeCode: string | null;
  recipeLevel: number;
  isMaxLevel: boolean;
  iconPath: string;
  rarityColor: string | null;
  craftedTooltip: {
    name: string;
    description: string | null;
    quoteText: string | null;
    rarity: string | null;
    rarityColor: string | null;
    slotLabel: string | null;
    attackType: string | null;
    physicalDamageRangeText: string | null;
    physicalDamageAttackFamily: string | null;
    magicDamageLine: string | null;
    craftPreviewStats: Array<{ text: string; isNegative: boolean }>;
    requirements: Array<{ label: string; value: string }>;
  } | null;
  components: Array<{
    itemId: string;
    name: string;
    iconPath: string;
    rarityColor: string | null;
    quantity: number;
    ownedQuantity: number;
  }>;
};

type HerreriaCompletedModalProps = {
  recipes: HerreriaRecipeInventoryItem[];
  availableRecipes: HerreriaAvailableRecipeItem[];
  hasInventorySpace: boolean;
  onGiveRecipe: (inventoryId: number) => Promise<void>;
  onCraftRecipe: (
    recipeId: string,
    recipeLevel: number,
    craftCount?: number,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  className?: string;
  actionButtonClassName?: string;
  tooltipClassName?: string;
  uiClassName?: string;
};

const SLOT_COUNT = 8;
const TOOLTIP_VIEWPORT_PADDING = 12;

const CRAFT_CATEGORY_LABELS: Record<HerreriaCraftCategory, string> = {
  consumable: "Consumibles",
  equipment: "Equipamento",
  other: "Otros",
};

/** Máximo de crafts según el material más limitante (p. ej. 4 madera / 1 por craft → 4). */
function maxCraftableUnits(components: HerreriaAvailableRecipeItem["components"]): number {
  if (components.length === 0) return 0;
  let max = Number.POSITIVE_INFINITY;
  for (const component of components) {
    const perCraft = Math.max(1, Math.trunc(component.quantity));
    const batches = Math.floor(Math.max(0, Math.trunc(component.ownedQuantity)) / perCraft);
    max = Math.min(max, batches);
  }
  return Number.isFinite(max) && max > 0 ? max : 0;
}

function recipeMatchesCraftCategory(
  recipe: HerreriaAvailableRecipeItem,
  category: HerreriaCraftCategory,
): boolean {
  const code = (recipe.craftedItemTypeCode ?? "").trim().toLowerCase();
  if (category === "consumable") return code === "consumable";
  if (category === "equipment") return code === "equipment" || code === "weapon";
  return code !== "consumable" && code !== "equipment" && code !== "weapon";
}

type RecipeTooltipState = {
  recipeId: number;
  name: string;
  tone: "default" | "danger";
  craftedTooltip?: HerreriaAvailableRecipeItem["craftedTooltip"];
  left: number;
  top: number;
  transform: string;
};

function tooltipPositionFromPoint(clientX: number, clientY: number) {
  const isNearLeftEdge = clientX < TOOLTIP_VIEWPORT_PADDING + 80;
  const isNearRightEdge = clientX > window.innerWidth - TOOLTIP_VIEWPORT_PADDING - 80;
  const left = isNearLeftEdge
    ? TOOLTIP_VIEWPORT_PADDING
    : isNearRightEdge
      ? window.innerWidth - TOOLTIP_VIEWPORT_PADDING
      : clientX;
  const translateX = isNearLeftEdge ? "0" : isNearRightEdge ? "-100%" : "-50%";
  const shouldPlaceBelow = clientY < 48;
  const top = shouldPlaceBelow
    ? Math.min(window.innerHeight - TOOLTIP_VIEWPORT_PADDING, clientY + 12)
    : Math.max(TOOLTIP_VIEWPORT_PADDING, clientY - 12);
  const translateY = shouldPlaceBelow ? "0" : "-100%";

  return {
    left,
    top,
    transform: `translate(${translateX}, ${translateY})`,
  };
}

function craftedTooltipPositionFromPoint(clientX: number, clientY: number) {
  const position = tooltipPositionFromPoint(clientX, clientY);
  if (clientY >= 260) return position;

  const translateX = position.transform.split(", ")[0]?.replace("translate(", "") ?? "-50%";
  return {
    ...position,
    top: Math.min(window.innerHeight - TOOLTIP_VIEWPORT_PADDING, clientY + 12),
    transform: `translate(${translateX}, 0)`,
  };
}

function recipeTooltipFromElement(
  recipe: HerreriaRecipeInventoryItem | HerreriaAvailableRecipeItem,
  element: HTMLElement,
): RecipeTooltipState {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const isNearLeftEdge = centerX < TOOLTIP_VIEWPORT_PADDING + 80;
  const isNearRightEdge = centerX > window.innerWidth - TOOLTIP_VIEWPORT_PADDING - 80;
  const left = isNearLeftEdge
    ? TOOLTIP_VIEWPORT_PADDING
    : isNearRightEdge
      ? window.innerWidth - TOOLTIP_VIEWPORT_PADDING
      : centerX;
  const translateX = isNearLeftEdge ? "0" : isNearRightEdge ? "-100%" : "-50%";
  const shouldPlaceBelow = rect.top < 48;
  const top = shouldPlaceBelow ? rect.bottom + 8 : rect.top - 8;
  const translateY = shouldPlaceBelow ? "0" : "-100%";

  return {
    recipeId: "inventoryId" in recipe ? recipe.inventoryId : Number.NaN,
    name:
      "isMaxLevel" in recipe && recipe.isMaxLevel
        ? "Chane ya tiene está receta en máximo nivel"
        : recipe.name,
    tone: "isMaxLevel" in recipe && recipe.isMaxLevel ? "danger" : "default",
    craftedTooltip: "craftedTooltip" in recipe ? recipe.craftedTooltip : null,
    left,
    top,
    transform: `translate(${translateX}, ${translateY})`,
  };
}

function recipeTooltipFromPoint(
  recipe: HerreriaRecipeInventoryItem | HerreriaAvailableRecipeItem,
  clientX: number,
  clientY: number,
): RecipeTooltipState {
  return {
    recipeId: "inventoryId" in recipe ? recipe.inventoryId : Number.NaN,
    name:
      "isMaxLevel" in recipe && recipe.isMaxLevel
        ? "Chane ya tiene está receta en máximo nivel"
        : recipe.name,
    tone: "isMaxLevel" in recipe && recipe.isMaxLevel ? "danger" : "default",
    craftedTooltip: "craftedTooltip" in recipe ? recipe.craftedTooltip : null,
    ...("craftedTooltip" in recipe && recipe.craftedTooltip
      ? craftedTooltipPositionFromPoint(clientX, clientY)
      : tooltipPositionFromPoint(clientX, clientY)),
  };
}

function componentTooltipFromElement(
  component: HerreriaAvailableRecipeItem["components"][number],
  element: HTMLElement,
): RecipeTooltipState {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const isNearLeftEdge = centerX < TOOLTIP_VIEWPORT_PADDING + 80;
  const isNearRightEdge = centerX > window.innerWidth - TOOLTIP_VIEWPORT_PADDING - 80;
  const left = isNearLeftEdge
    ? TOOLTIP_VIEWPORT_PADDING
    : isNearRightEdge
      ? window.innerWidth - TOOLTIP_VIEWPORT_PADDING
      : centerX;
  const translateX = isNearLeftEdge ? "0" : isNearRightEdge ? "-100%" : "-50%";
  const shouldPlaceBelow = rect.top < 48;
  const top = shouldPlaceBelow ? rect.bottom + 8 : rect.top - 8;
  const translateY = shouldPlaceBelow ? "0" : "-100%";

  return {
    recipeId: Number.NaN,
    name: component.name,
    tone: "default",
    left,
    top,
    transform: `translate(${translateX}, ${translateY})`,
  };
}

function componentTooltipFromPoint(
  component: HerreriaAvailableRecipeItem["components"][number],
  clientX: number,
  clientY: number,
): RecipeTooltipState {
  return {
    recipeId: Number.NaN,
    name: component.name,
    tone: "default",
    ...tooltipPositionFromPoint(clientX, clientY),
  };
}

export function HerreriaCompletedModal({
  recipes,
  availableRecipes,
  hasInventorySpace,
  onGiveRecipe,
  onCraftRecipe,
  className = "",
  actionButtonClassName = "",
  tooltipClassName = "",
  uiClassName = "",
}: HerreriaCompletedModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<
    | "options"
    | "give-recipe"
    | "craft-category"
    | "available-recipes"
    | "recipe-components"
  >("options");
  const [craftCategory, setCraftCategory] = useState<HerreriaCraftCategory | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [selectedAvailableRecipeId, setSelectedAvailableRecipeId] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<RecipeTooltipState | null>(null);
  const [usesHoverTooltips, setUsesHoverTooltips] = useState(false);
  const [craftProgressVisible, setCraftProgressVisible] = useState(false);
  const [craftProgress, setCraftProgress] = useState(0);
  const [craftQuantityPickerVisible, setCraftQuantityPickerVisible] = useState(false);
  const [craftQuantity, setCraftQuantity] = useState(1);
  const [craftQuantityInput, setCraftQuantityInput] = useState("1");
  const [craftErrorMessage, setCraftErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCraftPending, startCraftTransition] = useTransition();
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const slots = Array.from({ length: SLOT_COUNT }, (_, index) => recipes[index] ?? null);
  const filteredAvailableRecipes = useMemo(() => {
    if (!craftCategory) return [];
    return availableRecipes.filter((recipe) => recipeMatchesCraftCategory(recipe, craftCategory));
  }, [availableRecipes, craftCategory]);
  const availableRecipeSlots = filteredAvailableRecipes;
  const selectedAvailableRecipe =
    filteredAvailableRecipes.find((recipe) => recipe.recipeId === selectedAvailableRecipeId) ??
    null;
  const canCraftSelectedRecipe = Boolean(
    selectedAvailableRecipe &&
      selectedAvailableRecipe.components.length > 0 &&
      hasInventorySpace &&
      selectedAvailableRecipe.components.every(
        (component) => component.ownedQuantity >= component.quantity,
      ),
  );
  const craftDisabledTooltip = !hasInventorySpace
    ? "Liberá espacio en el inventario para poder craftear"
    : null;
  const isConsumableCraft =
    (selectedAvailableRecipe?.craftedItemTypeCode ?? "").trim().toLowerCase() === "consumable";
  const maxCraftQuantity = selectedAvailableRecipe
    ? maxCraftableUnits(selectedAvailableRecipe.components)
    : 0;

  const clampCraftQuantity = (value: number) =>
    Math.max(1, Math.min(maxCraftQuantity || 1, Math.trunc(value)));

  const commitCraftQuantityInput = (raw?: string): number => {
    const parsed = Math.trunc(Number((raw ?? craftQuantityInput).replace(/\D/g, "")));
    const clamped =
      Number.isFinite(parsed) && parsed >= 1 ? clampCraftQuantity(parsed) : 1;
    setCraftQuantity(clamped);
    setCraftQuantityInput(String(clamped));
    return clamped;
  };

  const setCraftQuantityBoth = (value: number) => {
    const clamped = clampCraftQuantity(value);
    setCraftQuantity(clamped);
    setCraftQuantityInput(String(clamped));
    return clamped;
  };

  const runCraft = (count: number) => {
    if (!selectedAvailableRecipe || !canCraftSelectedRecipe) return;
    const safeCount = Math.max(1, Math.min(Math.trunc(count), maxCraftQuantity || 1));
    setCraftQuantityPickerVisible(false);
    setCraftErrorMessage(null);
    setCraftProgressVisible(true);
    setCraftProgress(0);
    startCraftTransition(async () => {
      const result = await onCraftRecipe(
        selectedAvailableRecipe.recipeId,
        selectedAvailableRecipe.recipeLevel,
        safeCount,
      );
      if (!result.ok) {
        setCraftProgressVisible(false);
        setCraftProgress(0);
        setCraftErrorMessage(result.error);
        return;
      }
      setActiveTooltip(null);
      setCraftProgress(100);
      window.setTimeout(() => {
        setCraftProgressVisible(false);
        setCraftProgress(0);
        setCraftQuantity(1);
        setCraftQuantityInput("1");
        setSelectedAvailableRecipeId(null);
        setSelectedRecipeId(null);
        setCraftCategory(null);
        setMode("options");
        router.refresh();
      }, 260);
    });
  };

  useEffect(() => {
    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateHoverMode = () => setUsesHoverTooltips(hoverQuery.matches);

    updateHoverMode();
    hoverQuery.addEventListener("change", updateHoverMode);
    return () => hoverQuery.removeEventListener("change", updateHoverMode);
  }, []);

  useEffect(() => {
    if (!activeTooltip || usesHoverTooltips || mode === "options") return;

    const closeMobileTooltip = (event: PointerEvent) => {
      const tooltipNode = tooltipRef.current;
      if (tooltipNode?.contains(event.target as Node)) return;
      setActiveTooltip(null);
    };

    document.addEventListener("pointerdown", closeMobileTooltip);
    return () => document.removeEventListener("pointerdown", closeMobileTooltip);
  }, [activeTooltip, mode, usesHoverTooltips]);

  useEffect(() => {
    if (!craftQuantityPickerVisible || maxCraftQuantity < 1) return;
    setCraftQuantityBoth(
      Math.min(Math.max(1, craftQuantity), maxCraftQuantity),
    );
  }, [craftQuantityPickerVisible, maxCraftQuantity]);

  useEffect(() => {
    if (!craftProgressVisible || craftProgress >= 90) return;

    const intervalId = window.setInterval(() => {
      setCraftProgress((current) => {
        if (current >= 90) return 90;
        return Math.min(90, current + 2);
      });
    }, 120);

    return () => window.clearInterval(intervalId);
  }, [craftProgress, craftProgressVisible]);

  return (
    <>
      <div
        className={`relative rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-4 text-center lg:p-4 ${className}`}
      >
        <HerreriaHelpButton />
        {mode === "give-recipe" ? (
          <>
            <p className="text-xl font-bold leading-relaxed text-slate-900 sm:text-xl">
              Seleccioná una receta:
            </p>
            <div className="mx-auto mt-6 grid max-w-sm grid-cols-4 gap-2">
              {slots.map((recipe, index) => {
                const isSelected = Boolean(
                  recipe && !recipe.isMaxLevel && selectedRecipeId === recipe.inventoryId,
                );

                return (
                  <div key={recipe?.inventoryId ?? `empty-${index}`} className="relative aspect-square">
                    <button
                      type="button"
                      disabled={!recipe}
                      onMouseEnter={(event) => {
                        if (!recipe || !usesHoverTooltips) return;
                        setActiveTooltip(recipeTooltipFromPoint(recipe, event.clientX, event.clientY));
                      }}
                      onMouseMove={(event) => {
                        if (!recipe || !usesHoverTooltips) return;
                        setActiveTooltip(recipeTooltipFromPoint(recipe, event.clientX, event.clientY));
                      }}
                      onMouseLeave={() => {
                        if (!usesHoverTooltips) return;
                        setActiveTooltip(null);
                      }}
                      onClick={(event) => {
                        if (!recipe) return;
                        if (recipe.isMaxLevel) {
                          setActiveTooltip(
                            usesHoverTooltips
                              ? recipeTooltipFromPoint(recipe, event.clientX, event.clientY)
                              : recipeTooltipFromPoint(recipe, event.clientX, event.clientY),
                          );
                          return;
                        }
                        setSelectedRecipeId((current) =>
                          current === recipe.inventoryId ? null : recipe.inventoryId,
                        );
                        setActiveTooltip(
                          usesHoverTooltips
                            ? null
                            : recipeTooltipFromPoint(recipe, event.clientX, event.clientY),
                        );
                      }}
                      className={`relative h-full w-full rounded-md border-2 border-amber-900/70 bg-[#1f120e]/85 shadow-inner shadow-black/40 transition disabled:cursor-default ${
                        isSelected ? "ring-4 ring-green-700 ring-offset-0 ring-offset-[#ddccaa]" : ""
                      } ${
                        recipe?.isMaxLevel ? "cursor-not-allowed opacity-55 grayscale" : ""
                      }`}
                      style={recipe?.rarityColor ? { borderColor: recipe.rarityColor } : undefined}
                      aria-label={recipe ? `Receta ${recipe.name}` : `Espacio vacío ${index + 1}`}
                      aria-pressed={isSelected}
                    >
                      {recipe ? (
                        <>
                          <Image
                            src={recipe.iconPath}
                            alt={recipe.name}
                            width={700}
                            height={700}
                            quality={75}
                            className="h-auto w-auto max-h-full max-w-full object-contain p-1.5"
                          />
                          {recipe.quantity > 1 ? (
                            <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-50 shadow">
                              x{recipe.quantity}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
            {recipes.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-slate-700">
                No tenés recetas disponibles para darle a Chane.
              </p>
            ) : (
              <button
                type="button"
                disabled={selectedRecipeId == null || isPending}
                onClick={() => {
                  if (selectedRecipeId == null) return;
                  startTransition(async () => {
                    await onGiveRecipe(selectedRecipeId);
                    setActiveTooltip(null);
                    setSelectedRecipeId(null);
                    router.refresh();
                  });
                }}
                className={`mt-6 cursor-pointer rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] disabled:cursor-not-allowed disabled:border-slate-500/70 disabled:bg-slate-500/60 disabled:text-slate-200/80 ${actionButtonClassName}`}
              >
                {isPending ? "dando receta..." : "dar receta"}
              </button>
            )}
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTooltip(null);
                  setSelectedRecipeId(null);
                  setMode("options");
                }}
                className={`inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900 transition hover:text-amber-800 ${uiClassName}`}
              >
                <span className="text-base leading-none" aria-hidden>
                  ←
                </span>
                Volver
              </button>
            </div>
          </>
        ) : mode === "craft-category" ? (
          <>
            <p className="text-base font-bold leading-relaxed text-slate-900 sm:text-base">
              ¿Qué querés craftear?
            </p>
            <div className="mx-auto mt-6 flex max-w-md flex-col gap-3">
              {(["consumable", "equipment", "other"] as const).map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setActiveTooltip(null);
                    setSelectedAvailableRecipeId(null);
                    setCraftCategory(category);
                    setMode("available-recipes");
                  }}
                  className={`w-full cursor-pointer rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] ${actionButtonClassName}`}
                >
                  {CRAFT_CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTooltip(null);
                  setCraftCategory(null);
                  setMode("options");
                }}
                className={`inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900 transition hover:text-amber-800 ${uiClassName}`}
              >
                <span className="text-base leading-none" aria-hidden>
                  ←
                </span>
                Volver
              </button>
            </div>
          </>
        ) : mode === "available-recipes" ? (
          <>
            <p className="text-base font-bold leading-relaxed text-slate-900 sm:text-base">
              Recetas disponibles
              {craftCategory ? ` — ${CRAFT_CATEGORY_LABELS[craftCategory]}` : ""}:
            </p>
            <div className="mx-auto mt-6 grid max-w-sm grid-cols-4 gap-2">
              {availableRecipeSlots.map((recipe) => {
                const isSelected = selectedAvailableRecipeId === recipe.recipeId;

                return (
                  <div key={recipe.recipeId} className="relative aspect-square">
                    <button
                      type="button"
                      onMouseEnter={(event) => {
                        if (!usesHoverTooltips) return;
                        setActiveTooltip(recipeTooltipFromPoint(recipe, event.clientX, event.clientY));
                      }}
                      onMouseMove={(event) => {
                        if (!usesHoverTooltips) return;
                        setActiveTooltip(recipeTooltipFromPoint(recipe, event.clientX, event.clientY));
                      }}
                      onMouseLeave={() => {
                        if (!usesHoverTooltips) return;
                        setActiveTooltip(null);
                      }}
                      onClick={(event) => {
                        setSelectedAvailableRecipeId((current) =>
                          current === recipe.recipeId ? null : recipe.recipeId,
                        );
                        setActiveTooltip(
                          usesHoverTooltips
                            ? null
                            : recipeTooltipFromPoint(recipe, event.clientX, event.clientY),
                        );
                      }}
                      className={`relative h-full w-full rounded-md border-4 border-amber-900/70 bg-[#1f120e]/85 shadow-inner shadow-black/40 transition ${
                        isSelected ? "ring-4 ring-green-600 ring-offset-0 ring-offset-[#ddccaa]" : ""
                      }`}
                      style={recipe.rarityColor ? { borderColor: recipe.rarityColor } : undefined}
                      aria-label={`Receta ${recipe.name}`}
                      aria-pressed={isSelected}
                    >
                      <Image
                        src={recipe.iconPath}
                        alt={recipe.name}
                        width={700}
                        height={700}
                        quality={75}
                        className="h-auto w-auto max-h-full max-w-full object-contain p-1.5"
                      />
                      <span
                        className={
                          recipe.isMaxLevel
                            ? "absolute bottom-1 right-1 rounded-full border border-amber-300/70 bg-gradient-to-b from-amber-600 to-amber-900 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-amber-50 shadow-[0_0_2px_rgba(251,191,36,0.75)]"
                            : "absolute bottom-1 right-1 rounded-full border border-sky-300/70 bg-gradient-to-b from-slate-500 via-sky-700 to-slate-900 px-1.5 py-0.5 text-[8px] font-black tracking-wide text-slate-100 shadow-[0_0_8px_rgba(56,189,248,0.35)]"
                        }
                      >
                        {recipe.isMaxLevel ? "MAX" : `Lv. ${recipe.recipeLevel}`}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
            {filteredAvailableRecipes.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-slate-700">
                {craftCategory
                  ? `Chane no tiene recetas de ${CRAFT_CATEGORY_LABELS[craftCategory].toLowerCase()} en este nivel.`
                  : "Chane todavía no tiene recetas disponibles."}
              </p>
            ) : (
              <button
                type="button"
                disabled={selectedAvailableRecipeId == null}
                onClick={() => {
                  if (!selectedAvailableRecipeId) return;
                  setActiveTooltip(null);
                  setMode("recipe-components");
                }}
                className={`mt-6 cursor-pointer rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] disabled:cursor-not-allowed disabled:border-slate-500/70 disabled:bg-slate-500/60 disabled:text-slate-200/80 ${actionButtonClassName}`}
              >
                Seleccionar Receta
              </button>
            )}
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTooltip(null);
                  setSelectedAvailableRecipeId(null);
                  setMode("craft-category");
                }}
                className={`inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900 transition hover:text-amber-800 ${uiClassName}`}
              >
                <span className="text-base leading-none" aria-hidden>
                  ←
                </span>
                Volver
              </button>
            </div>
          </>
        ) : mode === "recipe-components" ? (
          <>
            <p className="text-base font-bold leading-relaxed text-slate-900 sm:text-base">
              {selectedAvailableRecipe?.craftedItemName ?? "Item seleccionado"}
            </p>
            <p className={`mt-1 text-xs font-semibold uppercase tracking-wide text-slate-700 ${uiClassName}`}>
              Componentes necesarios
            </p>
            {selectedAvailableRecipe && selectedAvailableRecipe.components.length > 0 ? (
              <div className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-4">
                {selectedAvailableRecipe.components.map((component) => (
                  <div key={component.itemId} className="w-[4.5rem] shrink-0 text-center sm:w-20">
                    <button
                      type="button"
                      className="relative aspect-square rounded-md border-2 border-amber-900/70 bg-[#1f120e]/85 shadow-inner shadow-black/40"
                      style={
                        component.rarityColor ? { borderColor: component.rarityColor } : undefined
                      }
                      onMouseEnter={(event) => {
                        if (!usesHoverTooltips) return;
                        setActiveTooltip(componentTooltipFromPoint(component, event.clientX, event.clientY));
                      }}
                      onMouseMove={(event) => {
                        if (!usesHoverTooltips) return;
                        setActiveTooltip(componentTooltipFromPoint(component, event.clientX, event.clientY));
                      }}
                      onMouseLeave={() => {
                        if (!usesHoverTooltips) return;
                        setActiveTooltip(null);
                      }}
                      onClick={(event) => {
                        setActiveTooltip(
                          usesHoverTooltips
                            ? null
                            : componentTooltipFromPoint(component, event.clientX, event.clientY),
                        );
                      }}
                      aria-label={component.name}
                    >
                      <Image
                        src={component.iconPath}
                        alt={component.name}
                        width={700}
                        height={700}
                        quality={75}
                        className="h-auto w-auto max-h-full max-w-full object-contain p-1.5"
                      />
                    </button>
                    <p
                      className={`mt-1 text-sm font-bold ${
                        component.ownedQuantity >= component.quantity ? "text-green-700" : "text-red-700"
                      } ${uiClassName}`}
                    >
                      {component.ownedQuantity}/{component.quantity}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm font-semibold text-slate-700">
                Esta receta no tiene componentes cargados.
              </p>
            )}
            {craftErrorMessage ? (
              <p className="mt-4 text-sm font-semibold text-red-800">{craftErrorMessage}</p>
            ) : null}
            <span
              className="inline-block"
              onMouseEnter={(event) => {
                if (!craftDisabledTooltip || !usesHoverTooltips) return;
                setActiveTooltip({
                  recipeId: Number.NaN,
                  name: craftDisabledTooltip,
                  tone: "danger",
                  ...tooltipPositionFromPoint(event.clientX, event.clientY),
                });
              }}
              onMouseMove={(event) => {
                if (!craftDisabledTooltip || !usesHoverTooltips) return;
                setActiveTooltip({
                  recipeId: Number.NaN,
                  name: craftDisabledTooltip,
                  tone: "danger",
                  ...tooltipPositionFromPoint(event.clientX, event.clientY),
                });
              }}
              onMouseLeave={() => {
                if (!usesHoverTooltips) return;
                setActiveTooltip(null);
              }}
              onClick={(event) => {
                if (!craftDisabledTooltip || usesHoverTooltips) return;
                setActiveTooltip({
                  recipeId: Number.NaN,
                  name: craftDisabledTooltip,
                  tone: "danger",
                  ...tooltipPositionFromPoint(event.clientX, event.clientY),
                });
              }}
            >
              <button
                type="button"
                disabled={!canCraftSelectedRecipe || isCraftPending}
                onClick={() => {
                  if (!selectedAvailableRecipe || !canCraftSelectedRecipe) return;
                  if (isConsumableCraft && maxCraftQuantity > 0) {
                    setCraftQuantityBoth(1);
                    setCraftQuantityPickerVisible(true);
                    return;
                  }
                  runCraft(1);
                }}
                className={`mt-6 cursor-pointer rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] disabled:cursor-not-allowed disabled:border-slate-500/70 disabled:bg-slate-500/60 disabled:text-slate-200/80 ${actionButtonClassName}`}
              >
                {isCraftPending ? "Crafteando..." : "Craftear"}
              </button>
            </span>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTooltip(null);
                  setCraftErrorMessage(null);
                  setMode("available-recipes");
                }}
                className={`inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900 transition hover:text-amber-800 ${uiClassName}`}
              >
                <span className="text-base leading-none" aria-hidden>
                  ←
                </span>
                Volver
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-base font-bold leading-relaxed text-slate-800 sm:text-base">
              Herrería de Chane
            </p>
            <p className="text-xs leading-relaxed text-slate-700 sm:text-sm">
              Dale tus recetas a Chane para que pueda descifrarlas y fabricar los objetos que se encuentran en ellas.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setMode("give-recipe")}
                  className={`w-full cursor-pointer rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] sm:w-auto ${uiClassName}`}
                >
                  Aprender
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTooltip(null);
                    setCraftCategory(null);
                    setSelectedAvailableRecipeId(null);
                    setMode("craft-category");
                  }}
                  className={`w-full cursor-pointer rounded-lg border border-slate-500/80 bg-slate-700 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-100 shadow-sm transition-colors hover:bg-slate-600 active:bg-[#b9a47b] sm:w-auto ${uiClassName}`}
                >
                  CRAFTEAR
                </button>
              </div>
              <GarrisonBackLink className={uiClassName} />
            </div>
          </>
        )}
      </div>
      {activeTooltip && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tooltipRef}
              className={
                activeTooltip.craftedTooltip
                  ? `fixed z-[1000] w-72 max-w-[calc(100vw-1.5rem)] rounded-lg border border-amber-700/70 bg-[#120f2a]/95 p-3 text-sm text-amber-50 shadow-[0_8px_30px_rgba(0,0,0,0.45)] ${tooltipClassName}`
                  : `fixed z-[1000] max-w-[calc(100vw-1.5rem)] overflow-hidden text-ellipsis whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs font-bold shadow-lg ${
                      activeTooltip.tone === "danger"
                        ? "border-red-700/80 bg-red-950/95 text-red-100"
                        : "border-amber-700/70 bg-[#1f120e]/95 text-amber-50"
                    } ${tooltipClassName}`
              }
              style={{
                left: activeTooltip.left,
                top: activeTooltip.top,
                transform: activeTooltip.transform,
              }}
            >
              {activeTooltip.craftedTooltip ? (
                <div className="whitespace-normal text-left">
                  <p
                    className="text-base font-bold leading-tight text-amber-200"
                    style={{
                      color: activeTooltip.craftedTooltip.rarityColor ?? undefined,
                    }}
                  >
                    {activeTooltip.craftedTooltip.name}
                  </p>
                  {activeTooltip.craftedTooltip.description ? (
                    <p className={`mt-1 text-xs italic leading-relaxed text-amber-100/80 ${className}`}>
                      {activeTooltip.craftedTooltip.description}
                    </p>
                  ) : null}
                  {activeTooltip.craftedTooltip.quoteText ? (
                    <p
                      className={`mt-1.5 text-[11px] italic leading-relaxed text-amber-200/85 ${className}`}
                      style={{ fontStyle: "italic" }}
                    >
                      - <em>"{activeTooltip.craftedTooltip.quoteText}"</em>
                    </p>
                  ) : null}
                  {activeTooltip.craftedTooltip.description || activeTooltip.craftedTooltip.quoteText ? (
                    <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-amber-400/45 to-transparent" />
                  ) : null}
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">
                    {activeTooltip.craftedTooltip.slotLabel ?? "ITEM"}
                    {activeTooltip.craftedTooltip.attackType ? (
                      <span className="ml-1.5 font-normal normal-case tracking-normal text-amber-100/90">
                        · {activeTooltip.craftedTooltip.attackType}
                      </span>
                    ) : null}
                  </p>
                  {activeTooltip.craftedTooltip.rarity ||
                  activeTooltip.craftedTooltip.physicalDamageRangeText ||
                  activeTooltip.craftedTooltip.magicDamageLine ? (
                    <div className="mt-2 space-y-1 text-xs leading-tight text-amber-100">
                      {activeTooltip.craftedTooltip.rarity ? (
                        <p
                          className="font-semibold"
                          style={{
                            color: activeTooltip.craftedTooltip.rarityColor ?? undefined,
                          }}
                        >
                          {activeTooltip.craftedTooltip.rarity}
                        </p>
                      ) : null}
                      {activeTooltip.craftedTooltip.physicalDamageRangeText ? (
                        <p>
                          <WeaponPhysicalDamageTooltipLine
                            damageRangeText={activeTooltip.craftedTooltip.physicalDamageRangeText}
                            attackFamily={activeTooltip.craftedTooltip.physicalDamageAttackFamily}
                          />
                        </p>
                      ) : null}
                      {activeTooltip.craftedTooltip.magicDamageLine ? (
                        <p>{activeTooltip.craftedTooltip.magicDamageLine}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {activeTooltip.craftedTooltip.craftPreviewStats.length > 0 ? (
                    <div className="mt-2 space-y-1 text-xs leading-tight text-amber-100">
                      {activeTooltip.craftedTooltip.craftPreviewStats.map((statLine, index) => (
                        <p
                          key={`${statLine.text}-${index}`}
                          className={
                            statLine.isNegative ? "font-medium text-red-400" : "text-amber-100"
                          }
                        >
                          {statLine.text}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {activeTooltip.craftedTooltip.requirements.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-300/95">
                        REQUISITOS
                      </p>
                      {activeTooltip.craftedTooltip.requirements.map((requirement, index) => (
                        <p
                          key={`${requirement.label}-${requirement.value}-${index}`}
                          className="mt-1 text-xs font-semibold text-amber-100"
                        >
                          {requirement.label === "Stat"
                            ? requirement.value
                            : `${requirement.label}: ${requirement.value}`}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                activeTooltip.name
              )}
            </div>,
            document.body,
          )
        : null}
      {craftQuantityPickerVisible && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 px-4">
              <div
                className={`w-full max-w-sm rounded-xl border border-[#9f8352]/80 bg-[#ddccaa] p-5 text-center shadow-[0_12px_40px_rgba(0,0,0,0.45)] ${uiClassName}`}
                role="dialog"
                aria-labelledby="herreria-craft-quantity-title"
                aria-modal="true"
              >
                <p
                  id="herreria-craft-quantity-title"
                  className="text-sm font-bold leading-relaxed text-slate-900"
                >
                  ¿Cuántas unidades querés craftear?
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-700">
                  Máximo {maxCraftQuantity} según tus materiales
                </p>
                <div className="mx-auto mt-5 flex max-w-[12rem] items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={craftQuantity <= 1 || isCraftPending}
                    onClick={() => setCraftQuantityBoth(craftQuantity - 1)}
                    className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] text-lg font-bold text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] disabled:cursor-not-allowed disabled:border-slate-500/70 disabled:bg-slate-500/60 disabled:text-slate-200/80 ${actionButtonClassName}`}
                    aria-label="Menos unidades"
                  >
                    −
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={isCraftPending}
                    value={craftQuantityInput}
                    onChange={(event) => {
                      const digitsOnly = event.target.value.replace(/\D/g, "");
                      if (!digitsOnly) {
                        setCraftQuantityInput("");
                        return;
                      }
                      const parsed = Math.trunc(Number(digitsOnly));
                      if (!Number.isFinite(parsed) || parsed < 1) return;
                      const clamped = clampCraftQuantity(parsed);
                      setCraftQuantity(clamped);
                      setCraftQuantityInput(String(clamped));
                    }}
                    onBlur={() => {
                      commitCraftQuantityInput();
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      const count = commitCraftQuantityInput();
                      runCraft(count);
                    }}
                    className={`h-10 w-20 rounded-lg border-2 border-amber-900/60 bg-[#fdfbf7]/95 text-center text-2xl font-black tabular-nums text-amber-950 shadow-inner outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-600/40 disabled:cursor-not-allowed disabled:opacity-60 ${uiClassName}`}
                    aria-label="Cantidad a craftear"
                    aria-valuemin={1}
                    aria-valuemax={maxCraftQuantity}
                    aria-valuenow={craftQuantity}
                  />
                  <button
                    type="button"
                    disabled={craftQuantity >= maxCraftQuantity || isCraftPending}
                    onClick={() => setCraftQuantityBoth(craftQuantity + 1)}
                    className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] text-lg font-bold text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] disabled:cursor-not-allowed disabled:border-slate-500/70 disabled:bg-slate-500/60 disabled:text-slate-200/80 ${actionButtonClassName}`}
                    aria-label="Más unidades"
                  >
                    +
                  </button>
                </div>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    disabled={isCraftPending || maxCraftQuantity < 1}
                    onClick={() => runCraft(commitCraftQuantityInput())}
                    className={`cursor-pointer rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] disabled:cursor-not-allowed disabled:border-slate-500/70 disabled:bg-slate-500/60 disabled:text-slate-200/80 ${actionButtonClassName}`}
                  >
                    Craftear ×{craftQuantity}
                  </button>
                  <button
                    type="button"
                    disabled={isCraftPending}
                    onClick={() => {
                      setCraftQuantityPickerVisible(false);
                      setCraftQuantityBoth(1);
                    }}
                    className={`cursor-pointer rounded-lg border border-slate-500/80 bg-slate-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-100 shadow-sm transition-colors hover:bg-slate-500 active:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${actionButtonClassName}`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {craftProgressVisible && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 px-4">
              <div className={`w-full max-w-sm rounded-xl border border-[#9f8352]/80 bg-[#ddccaa] p-5 text-center shadow-[0_12px_40px_rgba(0,0,0,0.45)] ${uiClassName}`}>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-950">
                  CRAFTEANDO...
                </p>
                <div className="mt-4 h-4 overflow-hidden rounded-full border border-amber-900/70 bg-[#1f120e]/85 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-200 to-amber-600 transition-[width] duration-300 ease-out"
                    style={{ width: `${craftProgress}%` }}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
