"use client";

import Image from "next/image";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";

import { giveFortuneCookieToMeloni } from "@/app/(main)/actions/meloni-fortune-cookie";

const MELONI_PORTRAIT_SRC = "/img/resources/characters/pj_meloni.png";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const MELONI_MAP_MODAL_PARAGRAPHS = [
  "Este es el oso que rescataste de la cueva. No te habías dado cuenta que era Meloni.",
  "Está sentado durmiendo placidamente contra un árbol, pero no pareciera querer ser perturbado.",
  "Le hacés señas, pero finje seguir durmiendo para no prestarte atención.",
] as const;

type Hotspot = {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
  description: string;
  /** Área clickeable sin marcador visible (p. ej. Meloni). */
  hidden?: boolean;
};

const DEFAULT_MAP_SRC = "/img/resources/maps/map_initialzone_campfire.png";

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
  {
    id: "relaxing-waters",
    label: "Aguas relajantes",
    xPercent: 40,
    yPercent: 87,
    description: "Podés tomar un descanso en estas aguas.",
  },
];

const MELONI_HOTSPOT: Hotspot = {
  id: "meloni",
  label: "Meloni",
  xPercent: 11,
  yPercent: 31,
  description:
    "Meloni apareció cerca del campamento. Dicen que no para de hablar de las galletas de la fortuna del barrio chino.",
  hidden: true,
};

type InitialZoneMapModalProps = {
  restrictToCamp?: boolean;
  mapSrc?: string;
  isCampBuilt?: boolean;
  meloniFoundCave?: boolean;
  hasFortuneCookieInInventory?: boolean;
  meloniGalletaGiven?: boolean;
};

export function InitialZoneMapModal({
  restrictToCamp = false,
  mapSrc = DEFAULT_MAP_SRC,
  isCampBuilt = false,
  meloniFoundCave = false,
  hasFortuneCookieInInventory = false,
  meloniGalletaGiven = false,
}: InitialZoneMapModalProps) {
  const router = useRouter();
  const availableHotspots = useMemo<Hotspot[]>(() => {
    let base: Hotspot[];
    if (!isCampBuilt) {
      base = [...HOTSPOTS];
    } else {
      const builtCampHotspot: Hotspot = {
        id: "garrison",
        label: "Base de La Tia",
        xPercent: 50,
        yPercent: 54,
        description: "El campamento fue reforzado y ahora funciona como base de operaciones central.",
      };
      base = [builtCampHotspot, ...HOTSPOTS.filter((spot) => spot.id !== "campfire")];
    }
    if (meloniFoundCave && !meloniGalletaGiven) {
      return [...base, MELONI_HOTSPOT];
    }
    return base;
  }, [isCampBuilt, meloniFoundCave, meloniGalletaGiven]);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string>(availableHotspots[0].id);
  const [meloniModalOpen, setMeloniModalOpen] = useState(false);
  const [canGiveFortuneCookie, setCanGiveFortuneCookie] = useState(hasFortuneCookieInInventory);
  const [fortuneCookieError, setFortuneCookieError] = useState<string | null>(null);
  const [fortuneCookieGiven, setFortuneCookieGiven] = useState(meloniGalletaGiven);
  const [isGivingFortuneCookie, startGiveFortuneCookie] = useTransition();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFortuneCookieGiven(meloniGalletaGiven);
  }, [meloniGalletaGiven]);

  useEffect(() => {
    if (meloniModalOpen) {
      setCanGiveFortuneCookie(hasFortuneCookieInInventory && !meloniGalletaGiven);
      setFortuneCookieError(null);
      if (!meloniGalletaGiven) {
        setFortuneCookieGiven(false);
      }
    }
  }, [meloniModalOpen, hasFortuneCookieInInventory, meloniGalletaGiven]);
  const [mapNaturalSize, setMapNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [mapFrame, setMapFrame] = useState<{ left: number; top: number; width: number; height: number } | null>(
    null,
  );

  const selectedHotspot = useMemo(
    () => availableHotspots.find((spot) => spot.id === selectedHotspotId) ?? availableHotspots[0],
    [selectedHotspotId, availableHotspots],
  );
  useEffect(() => {
    const visibleHotspots = availableHotspots.filter((spot) => !spot.hidden);
    const pool = visibleHotspots.length > 0 ? visibleHotspots : availableHotspots;
    if (pool.some((spot) => spot.id === selectedHotspotId)) return;
    setSelectedHotspotId(pool[0]?.id ?? availableHotspots[0]?.id ?? "campfire");
  }, [availableHotspots, selectedHotspotId]);
  const mapAspectRatio = mapNaturalSize
    ? `${mapNaturalSize.width} / ${mapNaturalSize.height}`
    : "16 / 9";

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

  return (
    <>
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
      <div
        ref={mapContainerRef}
        className="relative mt-2 w-full overflow-hidden rounded-md border border-amber-900/70 bg-black/30 aspect-[var(--map-aspect-ratio)] lg:aspect-auto lg:h-[647px]"
        style={
          {
            "--map-aspect-ratio": mapAspectRatio,
          } as CSSProperties
        }
      >
        <div className="absolute inset-0">
          <Image
            src={mapSrc}
            alt="Mapa zona inicial campamento"
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            loading="eager"
            fetchPriority="high"
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
          {availableHotspots.map((hotspot) => {
            const isHidden = Boolean(hotspot.hidden);
            const isSelected = !isHidden && hotspot.id === selectedHotspot.id;
            const isCampNode = hotspot.id === "campfire" || hotspot.id === "garrison";
            const isLocked = restrictToCamp && !isCampNode;
            const hotspotLeft = mapFrame
              ? mapFrame.left + mapFrame.width * (hotspot.xPercent / 100)
              : 0;
            const hotspotTop = mapFrame
              ? mapFrame.top + mapFrame.height * (hotspot.yPercent / 100)
              : 0;

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
                    onClick={(event) => {
                      event.stopPropagation();
                      if (hotspot.id === "meloni") {
                        setMeloniModalOpen(true);
                        return;
                      }
                      setSelectedHotspotId(hotspot.id);
                    }}
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
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedHotspotId(hotspot.id);
                  }}
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                    isLocked
                      ? "h-4 w-4 cursor-not-allowed border-slate-600 bg-slate-700/80 shadow-[0_0_8px_rgba(51,65,85,0.8)] lg:h-5 lg:w-5"
                      : "cursor-pointer"
                  } ${
                    isSelected
                      ? "h-4 w-4 border-amber-50 bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,1)] lg:h-6 lg:w-6"
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
                    Organicemosnos primero
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 rounded-md border border-amber-900/70 bg-[#d8c7a2]/92 px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-700 lg:text-s">
          {selectedHotspot.label}
        </p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <p className="flex-1 text-xs text-slate-800 lg:text-sm">{selectedHotspot.description}</p>
          <button
            type="button"
            disabled={restrictToCamp && selectedHotspot.id !== "campfire"}
            onClick={() => {
              if (selectedHotspot.id === "campfire") {
                router.push("/campsite");
                return;
              }
              if (selectedHotspot.id === "garrison") {
                router.push("/garrison");
                return;
              }
              if (selectedHotspot.id === "wood-forest") {
                router.push("/bosque-inexplorado");
                return;
              }
              if (selectedHotspot.id === "near-woods") {
                router.push("/near-woods");
                return;
              }
              if (selectedHotspot.id === "relaxing-waters") {
                router.push("/relaxing-waters");
                return;
              }
              if (selectedHotspot.id === "meloni") {
                setMeloniModalOpen(true);
                return;
              }
              router.push(`/?destino=${encodeURIComponent(selectedHotspot.id)}`);
            }}
            className="shrink-0 cursor-pointer rounded border border-slate-700/90 bg-gradient-to-b from-slate-600 to-slate-800 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-100 shadow-[0_0_8px_rgba(25,25,25,0.8)] transition hover:from-slate-500 hover:to-slate-700 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-300 disabled:shadow-none"
          >
            Ir alla
          </button>
        </div>
        {restrictToCamp && selectedHotspot.id !== "campfire" && selectedHotspot.id !== "garrison" ? (
          <p className="mt-1 text-xs text-amber-300/90">Disponible despues de entrar al campamento por primera vez.</p>
        ) : null}
      </div>
    </section>

      {meloniModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => setMeloniModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={
              fortuneCookieGiven ? "initial-zone-meloni-fortune" : "initial-zone-meloni-title"
            }
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-amber-700/80 bg-[#1a100c]/97 shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col px-5 py-6 sm:px-8 sm:py-8">
              {fortuneCookieGiven ? (
                <div
                  id="initial-zone-meloni-fortune"
                  className={`${dialogueFont.className} space-y-4 text-center text-[13px] leading-relaxed text-amber-50/95 sm:text-sm`}
                >
                  <p>Meloni agarra la galleta, la rompe al medio y te lee su fortuna</p>
                  <p className="italic text-[#e8c060]">
                    &ldquo;La basura de algunos, será el tesoro de otros. Puedes sacar ventaja de eso&rdquo;.
                  </p>
                  <p className="text-amber-100/90">Se queda pensativo un momento, y se levanta sin emitir palabra.</p>
                </div>
              ) : (
                <>
                  <div
                    id="initial-zone-meloni-title"
                    className="relative mx-auto aspect-[3/4] w-full max-w-[220px] shrink-0 overflow-hidden rounded-lg border border-amber-800/60 bg-black/40"
                  >
                    <Image
                      src={MELONI_PORTRAIT_SRC}
                      alt="Meloni"
                      fill
                      priority
                      sizes="220px"
                      className="object-contain object-center select-none p-1"
                    />
                  </div>

                  <div
                    className={`${dialogueFont.className} mt-6 space-y-4 text-center text-[13px] leading-relaxed text-amber-50/95 sm:text-sm`}
                  >
                    {MELONI_MAP_MODAL_PARAGRAPHS.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>

                  {canGiveFortuneCookie ? (
                    <div className={`${uiFont.className} mt-6 flex flex-col items-center gap-3 sm:mt-8`}>
                      <button
                        type="button"
                        disabled={isGivingFortuneCookie}
                        onClick={() => {
                          setFortuneCookieError(null);
                          startGiveFortuneCookie(async () => {
                            const result = await giveFortuneCookieToMeloni();
                            if (!result.ok) {
                              setFortuneCookieError(result.error);
                              setCanGiveFortuneCookie(false);
                              return;
                            }
                            setCanGiveFortuneCookie(false);
                            setFortuneCookieGiven(true);
                          });
                        }}
                        className="cursor-pointer rounded-md border border-amber-600/90 bg-gradient-to-b from-amber-700 to-amber-950 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-amber-50 shadow-[0_0_14px_rgba(251,191,36,0.2)] transition hover:from-amber-600 hover:to-amber-900 disabled:cursor-wait disabled:opacity-70"
                      >
                        {isGivingFortuneCookie
                          ? "Entregando…"
                          : "dar galleta de la fortuna a Meloni"}
                      </button>
                      {fortuneCookieError ? (
                        <p className="text-center text-xs text-red-300" role="alert">
                          {fortuneCookieError}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}

              <div className={`${uiFont.className} mt-6 flex justify-center sm:mt-8`}>
                <button
                  type="button"
                  autoFocus={fortuneCookieGiven || !canGiveFortuneCookie}
                  onClick={() => setMeloniModalOpen(false)}
                  className="inline-flex min-w-[11rem] cursor-pointer flex-col items-center rounded-md border-2 border-[#6b4a1f] bg-gradient-to-b from-[#c9a86c] via-[#a67c3d] to-[#7a5528] px-6 py-3 text-center shadow-[0_4px_0_#4a3218,inset_0_1px_0_rgba(255,240,200,0.45),0_8px_20px_rgba(0,0,0,0.45)] transition hover:from-[#d4b87a] hover:via-[#b8894a] hover:to-[#8a6230] active:translate-y-0.5 active:shadow-[0_2px_0_#4a3218,inset_0_1px_0_rgba(255,240,200,0.35)]"
                  aria-label="Volver al mapa"
                >
                  <span className="mt-0.5 text-sm font-extrabold uppercase tracking-[0.14em] text-[#2a1808] drop-shadow-[0_1px_0_rgba(255,235,190,0.5)]">
                    Volver
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

