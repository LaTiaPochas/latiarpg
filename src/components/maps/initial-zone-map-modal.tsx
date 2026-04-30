"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Hotspot = {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
  description: string;
};

const MAP_SRC = "/img/resources/maps/map_initialzone_campfire.png";

const HOTSPOTS: Hotspot[] = [
  {
    id: "campfire",
    label: "Campamento",
    xPercent: 50,
    yPercent: 54,
    description: "Punto base para reunirse y planear defensas.",
  },
  {
    id: "wood-forest",
    label: "Bosque inexplorado",
    xPercent: 31,
    yPercent: 15,
    description: "Zona ideal para recolectar madera. Quien sabe que peligros nos esperan.",
  },
  {
    id: "near-woods",
    label: "Orillas del bosque",
    xPercent: 70,
    yPercent: 26,
    description: "Una forma fácil de recolectar madera sin exponerse a grandes peligros.",
  },
];

type InitialZoneMapModalProps = {
  restrictToCamp?: boolean;
};

export function InitialZoneMapModal({ restrictToCamp = false }: InitialZoneMapModalProps) {
  const router = useRouter();
  const [selectedHotspotId, setSelectedHotspotId] = useState<string>(HOTSPOTS[0].id);

  const selectedHotspot = useMemo(
    () => HOTSPOTS.find((spot) => spot.id === selectedHotspotId) ?? HOTSPOTS[0],
    [selectedHotspotId],
  );

  return (
    <section className="mt-3 rounded-lg border border-amber-900/70 bg-[#1a100c]/85 p-3 shadow-[0_0_20px_rgba(0,0,0,0.3)] lg:p-4">
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
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-300">Mapa de la zona</h2>
      </div>

      <div
        className="relative mt-2 h-[270px] overflow-hidden rounded-md border border-amber-900/70 bg-black/30 lg:h-[647px]"
      >
        <div className="absolute inset-0">
          <Image src={MAP_SRC} alt="Mapa zona inicial campamento" fill className="object-contain select-none" />
          {HOTSPOTS.map((hotspot) => {
            const isSelected = hotspot.id === selectedHotspot.id;
            const isLocked = restrictToCamp && hotspot.id !== "campfire";
            return (
              <div
                key={hotspot.id}
                className="group absolute"
                style={{ left: `${hotspot.xPercent}%`, top: `${hotspot.yPercent}%` }}
              >
                {isSelected ? (
                  <span className="map-hotspot-ping pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 rounded-full border-2 border-amber-200/90" />
                ) : null}
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedHotspotId(hotspot.id);
                  }}
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                    isLocked
                      ? "h-5 w-5 cursor-not-allowed border-slate-600 bg-slate-700/80 shadow-[0_0_8px_rgba(51,65,85,0.8)]"
                      : "cursor-pointer"
                  } ${
                    isSelected
                      ? "h-6 w-6 border-amber-50 bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,1)]"
                      : "h-5 w-5 border-amber-900 bg-amber-500 shadow-[0_0_14px_rgba(251,191,36,0.95)]"
                  }`}
                  aria-label={hotspot.label}
                />
                {isSelected ? (
                  <span className="pointer-events-none absolute left-1/2 top-[calc(50%+14px)] -translate-x-1/2 whitespace-nowrap rounded border border-amber-300 bg-[#2e1a13] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.55)]">
                    {hotspot.label}
                  </span>
                ) : null}
                {isLocked ? (
                  <span className="pointer-events-none absolute left-1/2 top-[calc(50%-30px)] -translate-x-1/2 whitespace-nowrap rounded border border-amber-300/80 bg-[#2e1a13]/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-100 opacity-0 shadow-[0_0_10px_rgba(251,191,36,0.35)] transition-opacity duration-150 group-hover:opacity-100">
                    Organicemosnos primero
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 rounded-md border border-amber-900/70 bg-[#d8c7a2]/92 px-3 py-2">
        <p className="text-s font-bold uppercase tracking-wide text-slate-700">
          {selectedHotspot.label}
        </p>
        <p className="mt-1 text-sm text-slate-800">{selectedHotspot.description}</p>
        {restrictToCamp && selectedHotspot.id !== "campfire" ? (
          <p className="mt-1 text-xs text-amber-300/90">Disponible despues de entrar al campamento por primera vez.</p>
        ) : null}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={restrictToCamp && selectedHotspot.id !== "campfire"}
            onClick={() => {
              if (selectedHotspot.id === "campfire") {
                router.push("/campsite");
                return;
              }
              if (selectedHotspot.id === "wood-forest") {
                router.push("/bosque-inexplorado");
                return;
              }
              router.push(`/?destino=${encodeURIComponent(selectedHotspot.id)}`);
            }}
            className="cursor-pointer rounded border border-slate-700/90 bg-gradient-to-b from-slate-600 to-slate-800 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-100 shadow-[0_0_8px_rgba(25,25,25,0.8)] transition hover:from-slate-500 hover:to-slate-700 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-300 disabled:shadow-none"
          >
            Ir alla
          </button>
        </div>
      </div>
    </section>
  );
}

