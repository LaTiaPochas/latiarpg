"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { HerreriaHelpButton } from "@/components/herreria/herreria-help-button";

export type HerreriaRecipeInventoryItem = {
  inventoryId: number;
  name: string;
  iconPath: string;
  quantity: number;
  rarityColor: string | null;
  isMaxLevel: boolean;
};
export type HerreriaAvailableRecipeItem = {
  recipeId: string;
  name: string;
  craftedItemName: string;
  recipeLevel: number;
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
    damageLine: string | null;
    magicDamageLine: string | null;
    firstStatLine: string | null;
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
  onCraftRecipe: (recipeId: string, recipeLevel: number) => Promise<{ ok: boolean }>;
  className?: string;
  actionButtonClassName?: string;
  tooltipClassName?: string;
  uiClassName?: string;
};

const SLOT_COUNT = 8;
const TOOLTIP_VIEWPORT_PADDING = 12;

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
    "options" | "give-recipe" | "available-recipes" | "recipe-components"
  >("options");
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [selectedAvailableRecipeId, setSelectedAvailableRecipeId] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<RecipeTooltipState | null>(null);
  const [usesHoverTooltips, setUsesHoverTooltips] = useState(false);
  const [craftProgressVisible, setCraftProgressVisible] = useState(false);
  const [craftProgress, setCraftProgress] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [isCraftPending, startCraftTransition] = useTransition();
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const slots = Array.from({ length: SLOT_COUNT }, (_, index) => recipes[index] ?? null);
  const availableRecipeSlots = availableRecipes;
  const selectedAvailableRecipe =
    availableRecipes.find((recipe) => recipe.recipeId === selectedAvailableRecipeId) ?? null;
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
        ) : mode === "available-recipes" ? (
          <>
            <p className="text-base font-bold leading-relaxed text-slate-900 sm:text-base">
              Recetas disponibles:
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
                      <span className="absolute bottom-1 right-1 rounded-full border border-amber-300/70 bg-gradient-to-b from-amber-600 to-amber-900 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-50 shadow-[0_0_8px_rgba(251,191,36,0.45)]">
                        Lv. {recipe.recipeLevel}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
            {availableRecipes.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-slate-700">
                Chane todavía no tiene recetas disponibles.
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
        ) : mode === "recipe-components" ? (
          <>
            <p className="text-base font-bold leading-relaxed text-slate-900 sm:text-base">
              {selectedAvailableRecipe?.craftedItemName ?? "Item seleccionado"}
            </p>
            <p className={`mt-1 text-xs font-semibold uppercase tracking-wide text-slate-700 ${uiClassName}`}>
              Componentes necesarios
            </p>
            {selectedAvailableRecipe && selectedAvailableRecipe.components.length > 0 ? (
              <div className="mx-auto mt-6 grid max-w-sm grid-cols-4 gap-3">
                {selectedAvailableRecipe.components.map((component) => (
                  <div key={component.itemId} className="text-center">
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
                  setCraftProgressVisible(true);
                  setCraftProgress(0);
                  startCraftTransition(async () => {
                    const result = await onCraftRecipe(
                      selectedAvailableRecipe.recipeId,
                      selectedAvailableRecipe.recipeLevel,
                    );
                    if (!result.ok) {
                      setCraftProgressVisible(false);
                      setCraftProgress(0);
                      return;
                    }
                    setActiveTooltip(null);
                    setCraftProgress(100);
                    window.setTimeout(() => {
                      router.push("/character_profile");
                    }, 260);
                  });
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
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setMode("give-recipe")}
                className={`w-full cursor-pointer rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] sm:w-auto ${uiClassName}`}
              >
                Aprender
              </button>
              <button
                type="button"
                onClick={() => setMode("available-recipes")}
                className={`w-full cursor-pointer rounded-lg border border-slate-500/80 bg-slate-700 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-100 shadow-sm transition-colors hover:bg-slate-600 active:bg-[#b9a47b] sm:w-auto ${uiClassName}`}
              >
                CRAFTEAR
              </button>
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
                  activeTooltip.craftedTooltip.damageLine ||
                  activeTooltip.craftedTooltip.magicDamageLine ||
                  activeTooltip.craftedTooltip.firstStatLine ? (
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
                      {activeTooltip.craftedTooltip.damageLine ? (
                        <p>{activeTooltip.craftedTooltip.damageLine}</p>
                      ) : null}
                      {activeTooltip.craftedTooltip.magicDamageLine ? (
                        <p>{activeTooltip.craftedTooltip.magicDamageLine}</p>
                      ) : null}
                      {activeTooltip.craftedTooltip.firstStatLine ? (
                        <>
                          <p>{activeTooltip.craftedTooltip.firstStatLine}</p>
                          <p className="text-[11px] font-semibold text-emerald-300">
                            (Stats adicionales generados al momento de craftear)
                          </p>
                        </>
                      ) : null}
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
