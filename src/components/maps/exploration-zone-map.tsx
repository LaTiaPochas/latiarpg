"use client";

import { Montserrat } from "next/font/google";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";

const mapFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/** `combat_encounters.code` coincide con `id` del hotspot (misma zona en Supabase). */
export type ExplorationHotspot = {
  id: string;
  step: number;
  label: string;
  xPercent: number;
  yPercent: number;
  description: string;
  /** Sin marcador visible; solo área clickeable con cursor pointer. */
  hidden?: boolean;
};

type ExplorationZoneMapProps = {
  mapSrc: string;
  mapAlt: string;
  hotspots: ExplorationHotspot[];
  currentCombatStep: number;
  /** `zones.code` del área (p. ej. `hidden_forest` desde `game-zones`). */
  zoneCode: string;
  /** Hotspot a preseleccionar al volver desde combate. */
  initialHotspotId?: string | null;
  /** Si devuelve `true`, no se navega al combate por defecto. */
  onIrAlla?: (hotspot: ExplorationHotspot) => boolean;
  /** Si devuelve `true`, el clic queda manejado fuera (p. ej. modal en hotspot oculto). */
  onHotspotClick?: (hotspot: ExplorationHotspot) => boolean;
};

export function ExplorationZoneMap({
  mapSrc,
  mapAlt,
  hotspots,
  currentCombatStep,
  zoneCode,
  initialHotspotId = null,
  onIrAlla,
  onHotspotClick,
}: ExplorationZoneMapProps) {
  const router = useRouter();
  const visibleHotspots = useMemo(
    () => hotspots.filter((spot) => !spot.hidden),
    [hotspots],
  );
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapNaturalSize, setMapNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [mapFrame, setMapFrame] = useState<{ left: number; top: number; width: number; height: number } | null>(
    null,
  );

  const requestedHotspot =
    typeof initialHotspotId === "string" && initialHotspotId.trim().length > 0
      ? visibleHotspots.find((spot) => spot.id === initialHotspotId.trim()) ?? null
      : null;
  const initialHotspot =
    visibleHotspots.length === 0
      ? null
      : requestedHotspot && requestedHotspot.step <= currentCombatStep
        ? requestedHotspot
        : visibleHotspots.find((spot) => spot.step <= currentCombatStep) ?? visibleHotspots[0];

  const [selectedHotspotId, setSelectedHotspotId] = useState<string>(initialHotspot?.id ?? "");

  const selectedHotspot = useMemo(() => {
    if (visibleHotspots.length === 0) return null;
    return visibleHotspots.find((spot) => spot.id === selectedHotspotId) ?? visibleHotspots[0];
  }, [visibleHotspots, selectedHotspotId]);

  const mapAspectRatio = mapNaturalSize
    ? `${mapNaturalSize.width} / ${mapNaturalSize.height}`
    : "16 / 9";

  useEffect(() => {
    if (!initialHotspot?.id) return;
    setSelectedHotspotId(initialHotspot.id);
  }, [initialHotspot?.id]);

  useEffect(() => {
    if (!mapContainerRef.current || !mapNaturalSize) return;

    const container = mapContainerRef.current;
    const recalculateMapFrame = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      if (!containerWidth || !containerHeight) return;

      const imageAspect = mapNaturalSize.width / mapNaturalSize.height;
      const containerAspect = containerWidth / containerHeight;

      let renderWidth = containerWidth;
      let renderHeight = containerHeight;
      let left = 0;
      let top = 0;

      if (containerAspect > imageAspect) {
        renderHeight = containerHeight;
        renderWidth = renderHeight * imageAspect;
        left = (containerWidth - renderWidth) / 2;
      } else {
        renderWidth = containerWidth;
        renderHeight = renderWidth / imageAspect;
        top = (containerHeight - renderHeight) / 2;
      }

      setMapFrame({ left, top, width: renderWidth, height: renderHeight });
    };

    recalculateMapFrame();
    const resizeObserver = new ResizeObserver(recalculateMapFrame);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapNaturalSize]);

  const handleIrAlla = () => {
    if (!selectedHotspot) return;
    if (onIrAlla?.(selectedHotspot)) return;

    const encounterCode = encodeURIComponent(selectedHotspot.id);
    const z = encodeURIComponent(zoneCode.trim());
    const hotspot = encodeURIComponent(selectedHotspot.id);
    router.push(`/combate/${encounterCode}?zone=${z}&hotspot=${hotspot}`);
  };

  return (
    <section
      className={`rounded-lg border border-amber-900/70 bg-[#1a100c]/85 p-3 shadow-[0_0_20px_rgba(0,0,0,0.3)] lg:p-4 ${mapFont.className}`}
    >
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
      <div
        ref={mapContainerRef}
        className="relative mt-2 w-full overflow-hidden rounded-md border border-amber-900/70 bg-black/40 aspect-[var(--map-aspect-ratio)] lg:aspect-auto lg:h-[647px]"
        style={
          {
            "--map-aspect-ratio": mapAspectRatio,
          } as CSSProperties
        }
      >
        <div className="absolute inset-0">
          <Image
            src={mapSrc}
            alt={mapAlt}
            fill
            sizes="(min-width: 1024px) 1024px, 100vw"
            priority
            className="object-contain select-none"
            onLoad={(event) => {
              const imageElement = event.currentTarget;
              if (!imageElement.naturalWidth || !imageElement.naturalHeight) return;
              setMapNaturalSize({
                width: imageElement.naturalWidth,
                height: imageElement.naturalHeight,
              });
            }}
          />
          {hotspots.map((hotspot) => {
            const isHidden = Boolean(hotspot.hidden);
            const isSelected = !isHidden && hotspot.id === selectedHotspot?.id;
            const isLocked = hotspot.step > currentCombatStep;
            const hotspotLeft = mapFrame
              ? mapFrame.left + mapFrame.width * (hotspot.xPercent / 100)
              : 0;
            const hotspotTop = mapFrame
              ? mapFrame.top + mapFrame.height * (hotspot.yPercent / 100)
              : 0;

            const handleHotspotPress = (event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              if (onHotspotClick?.(hotspot)) return;
              setSelectedHotspotId(hotspot.id);
            };

            if (isHidden) {
              return (
                <div
                  key={hotspot.id}
                  className="absolute z-[2]"
                  style={{
                    left: mapFrame ? `${hotspotLeft}px` : `${hotspot.xPercent}%`,
                    top: mapFrame ? `${hotspotTop}px` : `${hotspot.yPercent}%`,
                  }}
                >
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={handleHotspotPress}
                    className={`absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-0 bg-transparent lg:h-14 lg:w-14 ${
                      isLocked ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                    aria-label={hotspot.label}
                  />
                </div>
              );
            }

            return (
              <div
                key={hotspot.id}
                className="group absolute"
                style={{
                  left: mapFrame ? `${hotspotLeft}px` : `${hotspot.xPercent}%`,
                  top: mapFrame ? `${hotspotTop}px` : `${hotspot.yPercent}%`,
                }}
              >
                {isSelected ? (
                  <span className="map-hotspot-ping pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 rounded-full border-2 border-amber-200/90 lg:h-10 lg:w-10" />
                ) : null}
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={handleHotspotPress}
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                    isLocked
                      ? "h-4 w-4 cursor-not-allowed border-slate-600 bg-slate-700/80 shadow-[0_0_8px_rgba(51,65,85,0.8)] lg:h-5 lg:w-5"
                      : "cursor-pointer"
                  } ${
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
                {isLocked ? (
                  <span className="pointer-events-none absolute left-1/2 top-[calc(50%-30px)] -translate-x-1/2 whitespace-nowrap rounded border border-amber-300/80 bg-[#2e1a13]/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-100 opacity-0 shadow-[0_0_10px_rgba(251,191,36,0.35)] transition-opacity duration-150 group-hover:opacity-100">
                    Superá el combate anterior
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {selectedHotspot ? (
        <div className="mt-2 rounded-md border border-amber-900/70 bg-[#d8c7a2]/92 px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700 underline">
            {selectedHotspot.label}
          </p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="flex-1 text-xs text-slate-800 lg:text-sm">{selectedHotspot.description}</p>
            <button
              type="button"
              disabled={selectedHotspot.step > currentCombatStep}
              onClick={handleIrAlla}
              className="shrink-0 cursor-pointer rounded border border-slate-700/90 bg-gradient-to-b from-slate-600 to-slate-800 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-100 shadow-[0_0_8px_rgba(25,25,25,0.8)] transition hover:from-slate-500 hover:to-slate-700 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-300 disabled:shadow-none"
            >
              Ir alla
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
