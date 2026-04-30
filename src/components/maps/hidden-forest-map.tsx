"use client";

import { Montserrat } from "next/font/google";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const mapFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type Hotspot = {
  id: string;
  step: number;
  label: string;
  xPercent: number;
  yPercent: number;
  description: string;
};

const MAP_SRC = "/img/resources/maps/map_hiddenforest_start.png";

const HOTSPOTS: Hotspot[] = [
  {
    id: "trail-head",
    step: 1,
    label: "Entrada al bosque",
    xPercent: 29,
    yPercent: 87,
    description:
      "Se deja ver un camino entre los árboles como si alguien o algo se hubiera abierto paso hace tiempo para poder transitar con más tranquilidad. Si bien no parece haber sido usado recientemente, es posible que haya peligros cerca.",
  },
  {
    id: "leafy-forest",
    step: 2,
    label: "Bosque frondoso",
    xPercent: 50,
    yPercent: 80,
    description: "A medida que te adentrás en el bosque empezás a sentir el peligro más presente que nunca. El bosque es cada vez más frondoso y ya no podés ver la salida, aunque sabrías por donde volver si lo necesitás. De todas formas, aun no hay señales de mayores impedimentos.",
  },
  {
    id: "forest-exit",
    step: 3,
    label: "Salida del bosque",
    xPercent: 82,
    yPercent: 66,
    description: "Después de una larga caminata, finalmente podés ver la salida del bosque. Sin embargo, por algún motive sentís que puede ser más peligroso ir aun más allá.",
  },
  {
    id: "occupied-ruins",
    step: 4,
    label: "Ruinas de Utul-Dum",
    xPercent: 90,
    yPercent: 30,
    description: "Es el primer momento de tu aventura donde sentís miedo. Viste demasiadas películas y jugaste demasiados juegos para saber que este tipo de ruinas están tomadas por enemigos, sin embargo, te proponés a continuar.",
  },
  {
    id: "forest-advance",
    step: 5,
    label: "Puesto de control Trasgo",
    xPercent: 46,
    yPercent: 27,
    description: "Dejando atras las ruinas, continuás tu camino hacia el norte. Ya desde el horizonte ves una atalaya que se levanta entre arbustos y árboles bajos, que no te gusta nada. Sabés que este va a ser el desafio más difícil hasta el momento.",
  },
  {
    id: "cave-entrance",
    step: 6,
    label: "Entrada a la cueva",
    xPercent: 10,
    yPercent: 14,
    description: "Evidentemente esta cueva era importante para los trasgos. ¿Porqué se tomarían tantas molestias para defenderla? Al acercarte, ves carros de extracción llenos de piedra. Parece no haber enemigos en la entrada." ,
  },
];

type HiddenForestMapProps = {
  currentCombatStep: number;
};

export function HiddenForestMap({ currentCombatStep }: HiddenForestMapProps) {
  const router = useRouter();
  const initialHotspot =
    HOTSPOTS.find((spot) => spot.step <= currentCombatStep) ?? HOTSPOTS[0];
  const [selectedHotspotId, setSelectedHotspotId] = useState<string>(
    initialHotspot.id,
  );

  const selectedHotspot = useMemo(
    () => HOTSPOTS.find((spot) => spot.id === selectedHotspotId) ?? HOTSPOTS[0],
    [selectedHotspotId],
  );

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
      <div className="relative h-[min(70dvh,640px)] w-full overflow-hidden rounded-md border border-amber-900/70 bg-black/40 lg:h-[min(75dvh,645px)]">
        <div className="absolute inset-0">
          <Image
            src={MAP_SRC}
            alt="Mapa del bosque inexplorado"
            fill
            priority
            className="object-contain select-none"
          />
          {HOTSPOTS.map((hotspot) => {
            const isSelected = hotspot.id === selectedHotspot.id;
            const isLocked = hotspot.step > currentCombatStep;
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
                    Superá el combate anterior
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 rounded-md border border-amber-900/70 bg-[#d8c7a2]/92 px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-700 underline">
          {selectedHotspot.label}
        </p>
        <p className="mt-1 text-sm text-slate-800">
          {selectedHotspot.description}
        </p>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={selectedHotspot.step > currentCombatStep}
            onClick={() => {
              router.push(
                `/bosque-inexplorado?combat_step=${selectedHotspot.step}`,
              );
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
