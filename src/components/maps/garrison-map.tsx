"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Hotspot = {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
  description: string;
};

type MapSpriteResponsiveSize = {
  /** Ancho en mobile (por defecto hasta lg / 1023px). Ej: "w-[48px]" */
  mobile: string;
  /** Ancho en desktop (lg+). Ej: "lg:w-[130px]" */
  desktop: string;
};

type MapSprite = {
  id: string;
  hotspotId: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  xPercent: number;
  yPercent: number;
  /** Nivel 1: clases Tailwind con breakpoints sm/lg */
  className?: string;
  completedSrc?: string;
  completedAlt?: string;
  completedClassName?: string;
  /** Nivel 2: tamaños mobile y desktop por separado */
  size?: MapSpriteResponsiveSize;
  completedSize?: MapSpriteResponsiveSize;
};

const DEFAULT_SPRITE_WIDTH_CLASS = "w-[70px] sm:w-[110px] lg:w-[130px]";

function resolveSpriteWidthClass(sprite: MapSprite, isCompleted: boolean, useLevel2Sizes: boolean) {
  if (useLevel2Sizes && sprite.size) {
    const size = isCompleted && sprite.completedSize ? sprite.completedSize : sprite.size;
    return `${size.mobile} ${size.desktop}`;
  }
  if (isCompleted) {
    return sprite.completedClassName ?? sprite.className ?? DEFAULT_SPRITE_WIDTH_CLASS;
  }
  return sprite.className ?? DEFAULT_SPRITE_WIDTH_CLASS;
}

const GARRISON_LEVEL_1_MAP = {
  src: "/img/resources/maps/map_initialzone_empty.png",
  alt: "Mapa de la guarnicion",
} as const;

const GARRISON_LEVEL_2_MAP = {
  src: "/img/resources/maps/map_garrisonlvl2.png",
  alt: "Campamento expandido",
} as const;

const HOTSPOTS_LEVEL_1: Hotspot[] = [
  {
    id: "warehouse-spot",
    label: "Warehouse",
    xPercent: 25,
    yPercent: 50,
    description: "Acá vas a poder liberar toda esa carga que tenés encima en el inventario.",
  },
  {
    id: "relaxing-waters-tent",
    label: "Aguas Relajantes",
    xPercent: 75,
    yPercent: 50,
    description: "Spot ideal para relajarse y tomar un descanso.",
  },
  {
    id: "crafting-table",
    label: "Mesa de Trabajo",
    xPercent: 17,
    yPercent: 83,
    description: "¿Tomar materiales y crear nuevos objetos? ¿Dónde me anoto?",
  },
  {
    id: "soul-altar",
    label: "Roca Extraña",
    xPercent: 83,
    yPercent: 87,
    description: "Una piedra misteriosa, con gran energía mágica.",
  },
  {
    id: "meloni",
    label: "Meloni's",
    xPercent: 95,
    yPercent: 55,
    description:
      "Meloni se instaló en la base. Parece que tiene un propósito muy particular. Chane le enseño bien.",
  },
  {
    id: "garrison-level-2",
    label: "Garrison",
    xPercent: 50,
    yPercent: 65,
    description: "La Tía piensa que ya es hora de comenzar la expansión del campamento y construir algo un poco más grande. Los materiales ya están y ya conocemos un poco más sobre el mundo.",
  },
];

/** Hotspots del mapa nivel 2 — ajustá xPercent / yPercent según map_garrisonlvl2.png */
const HOTSPOTS_LEVEL_2: Hotspot[] = [
  {
    id: "warehouse-spot",
    label: "Warehouse",
    xPercent: 20,
    yPercent: 20,
    description: "Acá vas a poder liberar toda esa carga que tenés encima en el inventario.",
  },
  {
    id: "relaxing-waters-tent",
    label: "Aguas Relajantes",
    xPercent: 80,
    yPercent: 20,
    description: "Spot ideal para relajarse y tomar un descanso.",
  },
  {
    id: "crafting-table",
    label: "Mesa de Trabajo",
    xPercent: 16,
    yPercent: 60,
    description: "¿Tomar materiales y crear nuevos objetos? ¿Dónde me anoto?",
  },
  {
    id: "soul-altar",
    label: "Roca Extraña",
    xPercent: 89,
    yPercent: 45,
    description: "Una piedra misteriosa, con gran energía mágica.",
  },
  {
    id: "meloni",
    label: "Meloni's",
    xPercent: 76,
    yPercent: 47,
    description:
      "Meloni se instaló en la base. Parece que tiene un propósito muy particular. Chane le enseño bien.",
  },
  {
    id: "tuneles-delu",
    label: "Túneles",
    xPercent: 90,
    yPercent: 68,
    description:
      "Delu está tramando algo con sus túneles.",
  },
  {
    id: "bibliotca-silva",
    label: "Loremaster",
    xPercent: 40,
    yPercent: 45,
    description:
      "Silva está juntando lore sobre este mundo, ayudá al master a completar su Lore.",
  },
];

const MAP_SPRITES_LEVEL_1: MapSprite[] = [
  {
    id: "warehouse-spot-sprite",
    hotspotId: "warehouse-spot",
    src: "/img/resources/maps/garrison_warehouse.png",
    alt: "Warehouse",
    width: 170,
    height: 170,
    xPercent: 22,
    yPercent: 48,
  },
  {
    id: "relaxing-waters-tent-sprite",
    hotspotId: "relaxing-waters-tent",
    src: "/img/resources/maps/garrison_relaxing_waters.png",
    alt: "Tienda de aguas relajantes",
    width: 170,
    height: 170,
    xPercent: 76,
    yPercent: 48,
  },
  {
    id: "crafting-table-sprite",
    hotspotId: "crafting-table",
    src: "/img/resources/characters/pj_chane_rpg_standing_stick.png",
    alt: "Chane en la mesa de trabajo",
    width: 170,
    height: 170,
    xPercent: 13,
    yPercent: 78,
    className: "w-[65px] sm:w-[82px] lg:w-[110px]",
    completedClassName: "w-[74px] sm:w-[112px] lg:w-[140px]",
  },
  {
    id: "soul-altar-sprite",
    hotspotId: "soul-altar",
    src: "/img/resources/maps/garrison_altar_construction.png",
    alt: "Leo escondido",
    width: 170,
    height: 170,
    xPercent: 83,
    yPercent: 82,
    className: "w-[72px] sm:w-[90px] lg:w-[125px]",
    completedSrc: "/img/resources/maps/garrison_altar_completed.png",
    completedAlt: "Altar de almas",
    completedClassName: "w-[92px] sm:w-[122px] lg:w-[175px]",
  },
  {
    id: "meloni-sprite",
    hotspotId: "meloni",
    src: "/img/resources/characters/pj_meloni.png",
    alt: "Meloni",
    width: 170,
    height: 170,
    xPercent: 95,
    yPercent: 54,
    className: "w-[40px] sm:w-[60px] lg:w-[60px]",
  },
];

/**
 * Sprites del mapa nivel 2 — ajustá xPercent / yPercent y `size` / `completedSize`.
 * `size.mobile` → ancho hasta lg (1023px). `size.desktop` → lg+ (ej. "lg:w-[130px]").
 */
const MAP_SPRITES_LEVEL_2: MapSprite[] = [
  {
    id: "warehouse-spot-sprite",
    hotspotId: "warehouse-spot",
    src: "/img/resources/maps/garrison_warehouse.png",
    alt: "Warehouse",
    width: 170,
    height: 170,
    xPercent: 17,
    yPercent: 14,
    size: { mobile: "w-[54px]", desktop: "lg:w-[110px]" },
  },
  {
    id: "relaxing-waters-tent-sprite",
    hotspotId: "relaxing-waters-tent",
    src: "/img/resources/maps/garrison_relaxing_waters.png",
    alt: "Tienda de aguas relajantes",
    width: 170,
    height: 170,
    xPercent: 81,
    yPercent: 16,
    size: { mobile: "w-[54px]", desktop: "lg:w-[100px]" },
  },
  {
    id: "crafting-table-sprite",
    hotspotId: "crafting-table",
    src: "/img/resources/characters/pj_chane_rpg_standing_stick.png",
    alt: "Chane en la mesa de trabajo",
    width: 170,
    height: 170,
    xPercent: 14,
    yPercent: 55,
    size: { mobile: "w-[65px]", desktop: "lg:w-[110px]" },
    completedSize: { mobile: "w-[54px]", desktop: "lg:w-[110px]" },
  },
  {
    id: "soul-altar-sprite",
    hotspotId: "soul-altar",
    src: "/img/resources/maps/garrison_altar_construction.png",
    alt: "Leo escondido",
    width: 170,
    height: 170,
    xPercent: 89,
    yPercent: 38,
    size: { mobile: "w-[72px]", desktop: "lg:w-[125px]" },
    completedSrc: "/img/resources/maps/garrison_altar_completed.png",
    completedAlt: "Altar de almas",
    completedSize: { mobile: "w-[48px]", desktop: "lg:w-[110px]" },
  },
  {
    id: "meloni-sprite",
    hotspotId: "meloni",
    src: "/img/resources/characters/pj_meloni.png",
    alt: "Meloni",
    width: 170,
    height: 170,
    xPercent: 76,
    yPercent: 43,
    size: { mobile: "w-[26px]", desktop: "lg:w-[50px]" },
  },
  {
    id: "tuneles-sprite",
    hotspotId: "tuneles-delu",
    src: "/img/resources/maps/garrison_tunel_construction.png",
    alt: "Túneles de Delu",
    width: 170,
    height: 170,
    xPercent: 90,
    yPercent: 65,
    size: { mobile: "w-[40px]", desktop: "lg:w-[75px]" },
    completedSrc: "/img/resources/maps/garrison_tunel_completed.png",
    completedAlt: "Altar de almas",
    completedSize: { mobile: "w-[48px]", desktop: "lg:w-[110px]" }
  },
  {
    id: "biblioteca-sprite",
    hotspotId: "bibliotca-silva",
    src: "/img/resources/maps/garrison_library_construction.png",
    alt: "Loremaster",
    width: 170,
    height: 170,
    xPercent: 40,
    yPercent: 40,
    size: { mobile: "w-[45px]", desktop: "lg:w-[110px]" },
    completedSrc: "/img/resources/maps/garrison_library_completed.png",
    completedAlt: "Biblioteca del Loremater",
    completedSize: { mobile: "w-[56px]", desktop: "lg:w-[130px]" }
  },
];

type GarrisonMapProps = {
  showWarehouseSprite?: boolean;
  showRelaxingWatersSprite?: boolean;
  showAdvancedHotspots?: boolean;
  showMeloniSprite?: boolean;
  isCraftingBenchCompleted?: boolean;
  isSoulAltarCompleted?: boolean;
  isGarrisonLevel2Completed?: boolean;
  isBibliotecaCompleted?: boolean;
};

export function GarrisonMap({
  showWarehouseSprite = false,
  showRelaxingWatersSprite = false,
  showAdvancedHotspots = false,
  showMeloniSprite = false,
  isCraftingBenchCompleted = false,
  isSoulAltarCompleted = false,
  isGarrisonLevel2Completed = false,
  isBibliotecaCompleted = false,
}: GarrisonMapProps) {
  const router = useRouter();
  const mapImage = isGarrisonLevel2Completed ? GARRISON_LEVEL_2_MAP : GARRISON_LEVEL_1_MAP;
  const hotspotsSource = isGarrisonLevel2Completed ? HOTSPOTS_LEVEL_2 : HOTSPOTS_LEVEL_1;
  const spritesSource = isGarrisonLevel2Completed ? MAP_SPRITES_LEVEL_2 : MAP_SPRITES_LEVEL_1;

  const [selectedHotspotId, setSelectedHotspotId] = useState(hotspotsSource[0]?.id ?? "");
  const availableHotspots = useMemo(
    () =>
      hotspotsSource
        .map((spot) =>
          spot.id === "soul-altar" && isSoulAltarCompleted
            ? { ...spot, label: "Altar de Almas" }
            : spot,
        )
        .filter((spot) => {
          if (isGarrisonLevel2Completed) {
            if (spot.id === "garrison-level-2") return false;
            if (spot.id === "meloni") return showMeloniSprite;
            if (spot.id === "warehouse-spot") return showWarehouseSprite;
            if (spot.id === "relaxing-waters-tent") return showRelaxingWatersSprite;
            return true;
          }
          if (spot.id === "meloni") return showMeloniSprite;
          if (spot.id === "garrison-level-2") return showAdvancedHotspots;
          return (
            showAdvancedHotspots ||
            (spot.id !== "crafting-table" && spot.id !== "lesser-shop")
          );
        }),
    [
      hotspotsSource,
      isGarrisonLevel2Completed,
      isSoulAltarCompleted,
      showAdvancedHotspots,
      showMeloniSprite,
      showRelaxingWatersSprite,
      showWarehouseSprite,
    ],
  );
  const selectedHotspot = useMemo(
    () =>
      availableHotspots.find((spot) => spot.id === selectedHotspotId) ??
      availableHotspots[0],
    [selectedHotspotId, availableHotspots],
  );
  useEffect(() => {
    if (availableHotspots.some((spot) => spot.id === selectedHotspotId)) return;
    setSelectedHotspotId(availableHotspots[0].id);
  }, [availableHotspots, selectedHotspotId]);
  const visibleSprites = useMemo(
    () =>
      spritesSource.filter((sprite) => {
        if (isGarrisonLevel2Completed) {
          if (sprite.id === "meloni-sprite") return showMeloniSprite;
          if (sprite.id === "warehouse-spot-sprite") return showWarehouseSprite;
          if (sprite.id === "relaxing-waters-tent-sprite") return showRelaxingWatersSprite;
          return true;
        }
        return (
          (sprite.id !== "warehouse-spot-sprite" || showWarehouseSprite) &&
          (sprite.id !== "relaxing-waters-tent-sprite" || showRelaxingWatersSprite) &&
          (sprite.id !== "crafting-table-sprite" || showAdvancedHotspots) &&
          (sprite.id !== "meloni-sprite" || showMeloniSprite)
        );
      }),
    [
      isGarrisonLevel2Completed,
      showAdvancedHotspots,
      showMeloniSprite,
      showRelaxingWatersSprite,
      showWarehouseSprite,
      spritesSource,
    ],
  );

  return (
    <>
      <style jsx>{`
        @keyframes map-ping {
          0% {
            transform: translate(-50%, -50%) scale(0.9);
            opacity: 0.9;
          }
          70% {
            transform: translate(-50%, -50%) scale(1.9);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.9);
            opacity: 0;
          }
        }
        .map-hotspot-ping {
          animation: map-ping 1.8s ease-out infinite;
        }
      `}</style>

      <div className="relative mt-2 w-full overflow-hidden rounded-md border border-amber-900/70 bg-black/40 lg:h-[647px]">
        <Image
          src={mapImage.src}
          alt={mapImage.alt}
          width={1024}
          height={647}
          priority
          className="h-auto w-full object-contain select-none lg:h-full"
        />
        {visibleSprites.map((sprite) => {
          const isCraftingCompleted =
            sprite.id === "crafting-table-sprite" && isCraftingBenchCompleted;
          const isSoulAltarSpriteCompleted =
            sprite.id === "soul-altar-sprite" && isSoulAltarCompleted;
          const isBibliotecaSpriteCompleted =
            sprite.id === "biblioteca-sprite" && isBibliotecaCompleted;
          const imageSrc = isCraftingCompleted
            ? "/img/resources/maps/garrison_anvil_completed.png"
            : isBibliotecaSpriteCompleted && sprite.completedSrc
              ? sprite.completedSrc
              : isSoulAltarSpriteCompleted && sprite.completedSrc
                ? sprite.completedSrc
                : sprite.src;
          const imageAlt = isCraftingCompleted
            ? "Yunque de herrería completado"
            : isBibliotecaSpriteCompleted && sprite.completedAlt
              ? sprite.completedAlt
              : isSoulAltarSpriteCompleted && sprite.completedAlt
                ? sprite.completedAlt
                : sprite.alt;
          const isSpriteCompleted =
            isCraftingCompleted || isSoulAltarSpriteCompleted || isBibliotecaSpriteCompleted;
          const spriteWidthClass = resolveSpriteWidthClass(
            sprite,
            isSpriteCompleted,
            isGarrisonLevel2Completed,
          );
          return (
          <div
            key={sprite.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${sprite.xPercent}%`,
              top: `${sprite.yPercent}%`,
            }}
          >
            <div className={spriteWidthClass}>
              <Image
                src={imageSrc}
                alt={imageAlt}
                width={sprite.width}
                height={sprite.height}
                className="h-auto w-full max-w-full object-contain"
              />
            </div>
          </div>
          );
        })}
        {availableHotspots.map((hotspot) => {
          const isSelected = hotspot.id === selectedHotspot.id;
          return (
            <div
              key={hotspot.id}
              className="group absolute"
              style={{
                left: `${hotspot.xPercent}%`,
                top: `${hotspot.yPercent}%`,
              }}
            >
              {isSelected ? (
                <span className="map-hotspot-ping pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 rounded-full border-2 border-amber-200/90 lg:h-10 lg:w-10" />
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedHotspotId(hotspot.id);
                }}
                className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 ${
                  isSelected
                    ? "h-5 w-5 border-amber-50 bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,1)] lg:h-6 lg:w-6"
                    : "h-4 w-4 border-amber-900 bg-amber-500 shadow-[0_0_14px_rgba(251,191,36,0.95)] lg:h-5 lg:w-5"
                }`}
                aria-label={hotspot.label}
              />
              {isSelected ? (
                <span className="pointer-events-none absolute left-1/2 top-[calc(50%+12px)] -translate-x-1/2 whitespace-nowrap rounded border border-amber-300 bg-[#2e1a13] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.55)] lg:top-[calc(50%+14px)] lg:px-1.5 lg:text-[10px]">
                  {hotspot.label}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-2 rounded-md border border-amber-900/70 bg-[#d8c7a2]/92 px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-700 underline">{selectedHotspot.label}</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <p className="flex-1 text-xs text-slate-800 lg:text-sm">{selectedHotspot.description}</p>
          <button
            type="button"
            onClick={() => {
              if (selectedHotspot.id === "warehouse-spot") {
                router.push("/warehouse");
                return;
              }
              if (selectedHotspot.id === "relaxing-waters-tent") {
                router.push("/relaxing_waters_stand");
                return;
              }
              if (selectedHotspot.id === "crafting-table") {
                router.push("/herreria");
                return;
              }
              if (selectedHotspot.id === "soul-altar") {
                router.push("/soul-altar");
                return;
              }
              if (selectedHotspot.id === "meloni") {
                router.push("/meloni-stand");
                return;
              }
              if (selectedHotspot.id === "garrison-level-2") {
                router.push("/expansion-garrison");
                return;
              }
              if (selectedHotspot.id === "bibliotca-silva") {
                router.push("/biblioteca");
                return;
              }
              router.push(`/?destino=${encodeURIComponent(selectedHotspot.id)}`);
            }}
            className="shrink-0 cursor-pointer rounded border border-slate-700/90 bg-gradient-to-b from-slate-600 to-slate-800 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-100 shadow-[0_0_8px_rgba(25,25,25,0.8)] transition hover:from-slate-500 hover:to-slate-700 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-300 disabled:shadow-none"
          >
            Ir alla
          </button>
        </div>
      </div>
    </>
  );
}
