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

type MapSprite = {
  id: string;
  hotspotId: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  xPercent: number;
  yPercent: number;
  className?: string;
  completedSrc?: string;
  completedAlt?: string;
  completedClassName?: string;
};

const HOTSPOTS: Hotspot[] = [
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
  /*
  {
    id: "tasty-meals",
    label: "Delicias de La Tia",
    xPercent: 44,
    yPercent: 73,
    description: "Por suerte en La Tia tenemos muy buenos cocineros, aprovechemoslos.",
  },*/
];

const MAP_SPRITES: MapSprite[] = [
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
    className: "w-[65px] sm:w-[82px] lg:w-[100px]",
    completedSrc: "/img/resources/maps/garrison_altar_completed.png",
    completedAlt: "Altar de almas",
    completedClassName: "w-[84px] sm:w-[112px] lg:w-[160px]",
  },
];

type GarrisonMapProps = {
  showWarehouseSprite?: boolean;
  showRelaxingWatersSprite?: boolean;
  showAdvancedHotspots?: boolean;
  isCraftingBenchCompleted?: boolean;
  isSoulAltarCompleted?: boolean;
};

export function GarrisonMap({
  showWarehouseSprite = false,
  showRelaxingWatersSprite = false,
  showAdvancedHotspots = false,
  isCraftingBenchCompleted = false,
  isSoulAltarCompleted = false,
}: GarrisonMapProps) {
  const router = useRouter();
  const [selectedHotspotId, setSelectedHotspotId] = useState(HOTSPOTS[0].id);
  const availableHotspots = useMemo(
    () =>
      HOTSPOTS.map((spot) =>
        spot.id === "soul-altar" && isSoulAltarCompleted
          ? { ...spot, label: "Altar de Almas" }
          : spot,
      ).filter(
        (spot) =>
          showAdvancedHotspots ||
          (spot.id !== "crafting-table" && spot.id !== "lesser-shop"),
      ),
    [isSoulAltarCompleted, showAdvancedHotspots],
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
      MAP_SPRITES.filter(
        (sprite) =>
          (sprite.id !== "warehouse-spot-sprite" || showWarehouseSprite) &&
          (sprite.id !== "relaxing-waters-tent-sprite" || showRelaxingWatersSprite) &&
          (sprite.id !== "crafting-table-sprite" || showAdvancedHotspots),
      ),
    [showAdvancedHotspots, showRelaxingWatersSprite, showWarehouseSprite],
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
          src="/img/resources/maps/map_initialzone_empty.png"
          alt="Mapa de la guarnicion"
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
          const imageSrc =
            isCraftingCompleted
              ? "/img/resources/maps/garrison_anvil_completed.png"
              : isSoulAltarSpriteCompleted && sprite.completedSrc
                ? sprite.completedSrc
                : sprite.src;
          const imageAlt =
            isCraftingCompleted
              ? "Yunque de herrería completado"
              : isSoulAltarSpriteCompleted && sprite.completedAlt
                ? sprite.completedAlt
                : sprite.alt;
          const defaultSpriteWidthClass = "w-[70px] sm:w-[110px] lg:w-[130px]";
          return (
          <div
            key={sprite.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${sprite.xPercent}%`,
              top: `${sprite.yPercent}%`,
            }}
          >
            {isSoulAltarSpriteCompleted && sprite.completedSrc ? (
              <div
                className={
                  sprite.completedClassName ??
                  sprite.className ??
                  defaultSpriteWidthClass
                }
              >
                <Image
                  src={imageSrc}
                  alt={imageAlt}
                  width={sprite.width}
                  height={sprite.height}
                  className="h-auto w-full max-w-full object-contain"
                />
              </div>
            ) : (
              <Image
                src={imageSrc}
                alt={imageAlt}
                width={sprite.width}
                height={sprite.height}
                className={`h-auto object-contain ${
                  isCraftingCompleted
                    ? (sprite.completedClassName ?? sprite.className ?? defaultSpriteWidthClass)
                    : (sprite.className ?? defaultSpriteWidthClass)
                }`}
              />
            )}
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
