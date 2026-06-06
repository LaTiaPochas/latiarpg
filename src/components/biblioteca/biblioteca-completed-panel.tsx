"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Libre_Baskerville, Montserrat } from "next/font/google";

import { GarrisonBackLink, garrisonBackLinkClassName } from "@/components/camp/garrison-back-link";
import { BibliotecaBestiarioEnemyGrid } from "@/components/biblioteca/biblioteca-bestiario-enemy-grid";
import { BibliotecaBestiarioZoneList } from "@/components/biblioteca/biblioteca-bestiario-zone-list";
import { BibliotecaCombatStatsGrid } from "@/components/biblioteca/biblioteca-combat-stats-grid";
import { BibliotecaMaterialsStatsTable } from "@/components/biblioteca/biblioteca-materials-stats-table";
import {
  fetchAllUserStatsForBiblioteca,
  fetchBestiarioEnemiesForZoneGroup,
  fetchDiscoveredZonesForBestiario,
} from "@/app/(main)/biblioteca/actions";
import type { BibliotecaBestiarioEnemyEntry } from "@/lib/biblioteca-bestiario-entries";
import type { BibliotecaBestiarioZoneGroup } from "@/lib/biblioteca-bestiario-zones";
import {
  buildBibliotecaCombatMemberRows,
  buildBibliotecaMaterialsTableRows,
  type BibliotecaStatsPayload,
} from "@/lib/biblioteca-user-stats";

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const PAGE_BG = "/img/resources/background/bg_garrisonlvl2.png";
const LIBRARY_COMPLETED_SPRITE = "/img/resources/maps/garrison_library_completed.png";

const menuButtonClassName = `${garrisonBackLinkClassName} w-full justify-center px-5 py-2.5 text-xs`;

type BibliotecaCompletedPanelProps = {
  uiFontClassName?: string;
};

type PanelView = "home" | "estadisticas" | "materiales" | "combate" | "bestiario";

export function BibliotecaCompletedPanel({
  uiFontClassName = uiFont.className,
}: BibliotecaCompletedPanelProps) {
  const [view, setView] = useState<PanelView>("home");
  const [statsLoadError, setStatsLoadError] = useState<string | null>(null);
  const [isLoadingStats, startStatsTransition] = useTransition();
  const [materialsTableRows, setMaterialsTableRows] = useState<
    ReturnType<typeof buildBibliotecaMaterialsTableRows>
  >([]);
  const [combatMemberRows, setCombatMemberRows] = useState<
    ReturnType<typeof buildBibliotecaCombatMemberRows>
  >([]);
  const [bestiarioZoneGroups, setBestiarioZoneGroups] = useState<BibliotecaBestiarioZoneGroup[]>(
    [],
  );
  const [bestiarioLoadError, setBestiarioLoadError] = useState<string | null>(null);
  const [isLoadingBestiario, startBestiarioTransition] = useTransition();
  const [selectedBestiarioZoneGroup, setSelectedBestiarioZoneGroup] =
    useState<BibliotecaBestiarioZoneGroup | null>(null);
  const [bestiarioEnemies, setBestiarioEnemies] = useState<BibliotecaBestiarioEnemyEntry[]>([]);
  const [bestiarioEnemiesError, setBestiarioEnemiesError] = useState<string | null>(null);
  const [isLoadingBestiarioEnemies, startBestiarioEnemiesTransition] = useTransition();
  const statsPayloadRef = useRef<BibliotecaStatsPayload | null>(null);
  const bestiarioZonesRef = useRef<BibliotecaBestiarioZoneGroup[] | null>(null);
  const bestiarioEnemiesCacheRef = useRef<Map<number, BibliotecaBestiarioEnemyEntry[]>>(new Map());

  const syncStatsViews = () => {
    if (!statsPayloadRef.current) {
      setMaterialsTableRows([]);
      setCombatMemberRows([]);
      return;
    }
    setMaterialsTableRows(buildBibliotecaMaterialsTableRows(statsPayloadRef.current));
    setCombatMemberRows(buildBibliotecaCombatMemberRows(statsPayloadRef.current));
  };

  const ensureStatsLoaded = (onLoaded?: () => void) => {
    setStatsLoadError(null);

    if (statsPayloadRef.current !== null) {
      syncStatsViews();
      onLoaded?.();
      return;
    }

    startStatsTransition(async () => {
      const result = await fetchAllUserStatsForBiblioteca();
      if (!result.ok) {
        setStatsLoadError(result.error);
        return;
      }
      statsPayloadRef.current = result.data;
      syncStatsViews();
      onLoaded?.();
    });
  };

  const openEstadisticas = () => {
    setView("estadisticas");
    ensureStatsLoaded();
  };

  const openMaterialesAportados = () => {
    if (statsPayloadRef.current) {
      setView("materiales");
      return;
    }

    ensureStatsLoaded(() => setView("materiales"));
  };

  const openEstadisticasCombate = () => {
    if (statsPayloadRef.current) {
      setView("combate");
      return;
    }

    ensureStatsLoaded(() => setView("combate"));
  };

  const ensureBestiarioZonesLoaded = (onLoaded?: () => void) => {
    setBestiarioLoadError(null);

    if (bestiarioZonesRef.current !== null) {
      setBestiarioZoneGroups(bestiarioZonesRef.current);
      onLoaded?.();
      return;
    }

    startBestiarioTransition(async () => {
      const result = await fetchDiscoveredZonesForBestiario();
      if (!result.ok) {
        setBestiarioLoadError(result.error);
        return;
      }
      bestiarioZonesRef.current = result.data;
      setBestiarioZoneGroups(result.data);
      onLoaded?.();
    });
  };

  const openBestiario = () => {
    setSelectedBestiarioZoneGroup(null);
    setBestiarioEnemies([]);
    setBestiarioEnemiesError(null);
    setView("bestiario");
    ensureBestiarioZonesLoaded();
  };

  const loadBestiarioEnemiesForGroup = (group: BibliotecaBestiarioZoneGroup) => {
    setSelectedBestiarioZoneGroup(group);
    setBestiarioEnemiesError(null);

    const cached = bestiarioEnemiesCacheRef.current.get(group.zoneOrder);
    if (cached) {
      setBestiarioEnemies(cached);
      return;
    }

    startBestiarioEnemiesTransition(async () => {
      const result = await fetchBestiarioEnemiesForZoneGroup(group.zones.map((zone) => zone.id));
      if (!result.ok) {
        setBestiarioEnemiesError(result.error);
        setBestiarioEnemies([]);
        return;
      }
      bestiarioEnemiesCacheRef.current.set(group.zoneOrder, result.data);
      setBestiarioEnemies(result.data);
    });
  };

  const isWidePanel =
    view === "materiales" || view === "combate" || (view === "bestiario" && selectedBestiarioZoneGroup);

  return (
    <div
      className={`relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#120b08] ${uiFontClassName}`}
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.62)), url('${PAGE_BG}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl items-center justify-center p-4 lg:p-8">
        <section
          className={`w-full rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm lg:p-3 ${
            isWidePanel ? "max-w-4xl" : "max-w-md"
          }`}
        >
          <div
            className={`rounded-lg border border-[#9f8352]/80 bg-[#ddccaa]/94 p-4 text-center lg:p-6 ${dialogueFont.className}`}
          >
            {view === "home" ? (
              <>
                <div className="pointer-events-none flex justify-center">
                  <Image
                    src={LIBRARY_COMPLETED_SPRITE}
                    alt="Biblioteca del Loremaster"
                    width={360}
                    height={360}
                    className="mb-4 h-auto w-[min(65vw,300px)] object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
                  />
                </div>
                <p
                  className={`text-lg font-bold uppercase tracking-wide text-emerald-800 ${uiFont.className}`}
                >
                  Completado
                </p>
                <p className="mt-3 text-xs leading-relaxed text-slate-800 sm:text-sm">
                  La biblioteca del Loremaster ya está lista para registrar el lore del mundo.
                </p>
                <div className="mx-auto mt-6 flex w-full max-w-xs flex-col gap-3">
                  <button
                    type="button"
                    onClick={openEstadisticas}
                    className={`${menuButtonClassName} ${uiFontClassName}`}
                  >
                    ESTADISTICAS
                  </button>
                  <button
                    type="button"
                    onClick={openBestiario}
                    className={`${menuButtonClassName} ${uiFontClassName}`}
                  >
                    BESTIARIO
                  </button>
                </div>
                <div className="mt-6 flex justify-center">
                  <GarrisonBackLink className={uiFontClassName} />
                </div>
              </>
            ) : null}

            {view === "estadisticas" ? (
              <>
                <p className={`text-base font-bold leading-relaxed text-slate-900 sm:text-lg ${uiFont.className}`}>
                  ¿Qué estadísticas querés ver?
                </p>
                {isLoadingStats ? (
                  <p className={`mt-4 text-xs font-semibold text-slate-700 ${uiFontClassName}`}>
                    Cargando estadísticas...
                  </p>
                ) : null}
                {statsLoadError ? (
                  <p className={`mt-4 text-xs font-semibold text-red-800 ${uiFontClassName}`}>
                    {statsLoadError}
                  </p>
                ) : null}
                <div className="mx-auto mt-6 flex w-full max-w-xs flex-col gap-3">
                  <button
                    type="button"
                    disabled={isLoadingStats || Boolean(statsLoadError)}
                    onClick={openMaterialesAportados}
                    className={`${menuButtonClassName} disabled:cursor-not-allowed disabled:border-slate-500/70 disabled:bg-slate-500/60 disabled:text-slate-200/80 ${uiFontClassName}`}
                  >
                    Materiales Aportados
                  </button>
                  <button
                    type="button"
                    disabled={isLoadingStats || Boolean(statsLoadError)}
                    onClick={openEstadisticasCombate}
                    className={`${menuButtonClassName} disabled:cursor-not-allowed disabled:border-slate-500/70 disabled:bg-slate-500/60 disabled:text-slate-200/80 ${uiFontClassName}`}
                  >
                    Estadisticas de Combate
                  </button>
                </div>
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setView("home")}
                    className={`inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900 transition hover:text-amber-800 ${uiFontClassName}`}
                  >
                    <span className="text-base leading-none" aria-hidden>
                      ←
                    </span>
                    Volver
                  </button>
                </div>
              </>
            ) : null}

            {view === "materiales" ? (
              <>
                <p className={`text-base font-bold leading-relaxed text-slate-900 sm:text-lg ${uiFont.className}`}>
                  Materiales aportados
                </p>
                <BibliotecaMaterialsStatsTable rows={materialsTableRows} uiFontClassName={uiFontClassName} />
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setView("estadisticas")}
                    className={`inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900 transition hover:text-amber-800 ${uiFontClassName}`}
                  >
                    <span className="text-base leading-none" aria-hidden>
                      ←
                    </span>
                    Volver
                  </button>
                </div>
              </>
            ) : null}

            {view === "combate" ? (
              <>
                <p className={`text-base font-bold leading-relaxed text-slate-900 sm:text-lg ${uiFont.className}`}>
                  Estadísticas de combate
                </p>
                <p className={`text-xs leading-relaxed text-slate-600 sm:text-sm ${dialogueFont.className}`}>
                  ( Clickea los elementos para ver el Top 5 )
                </p>
                <BibliotecaCombatStatsGrid members={combatMemberRows} uiFontClassName={uiFontClassName} />
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setView("estadisticas")}
                    className={`inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900 transition hover:text-amber-800 ${uiFontClassName}`}
                  >
                    <span className="text-base leading-none" aria-hidden>
                      ←
                    </span>
                    Volver
                  </button>
                </div>
              </>
            ) : null}

            {view === "bestiario" ? (
              <>
                <p className={`text-base font-bold leading-relaxed text-slate-900 sm:text-lg ${uiFont.className}`}>
                  {selectedBestiarioZoneGroup ? selectedBestiarioZoneGroup.label : "Bestiario"}
                </p>
                {isLoadingBestiario && !selectedBestiarioZoneGroup ? (
                  <p className={`mt-4 text-xs font-semibold text-slate-700 ${uiFontClassName}`}>
                    Cargando zonas...
                  </p>
                ) : null}
                {bestiarioLoadError && !selectedBestiarioZoneGroup ? (
                  <p className={`mt-4 text-xs font-semibold text-red-800 ${uiFontClassName}`}>
                    {bestiarioLoadError}
                  </p>
                ) : null}
                {selectedBestiarioZoneGroup ? (
                  <>
                    {isLoadingBestiarioEnemies ? (
                      <p className={`mt-4 text-xs font-semibold text-slate-700 ${uiFontClassName}`}>
                        Cargando enemigos...
                      </p>
                    ) : null}
                    {bestiarioEnemiesError ? (
                      <p className={`mt-4 text-xs font-semibold text-red-800 ${uiFontClassName}`}>
                        {bestiarioEnemiesError}
                      </p>
                    ) : null}
                    <BibliotecaBestiarioEnemyGrid
                      enemies={bestiarioEnemies}
                      uiFontClassName={uiFontClassName}
                    />
                  </>
                ) : (
                  <BibliotecaBestiarioZoneList
                    zoneGroups={bestiarioZoneGroups}
                    onSelectZoneGroup={loadBestiarioEnemiesForGroup}
                    uiFontClassName={uiFontClassName}
                  />
                )}
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBestiarioZoneGroup) {
                        setSelectedBestiarioZoneGroup(null);
                        setBestiarioEnemiesError(null);
                        return;
                      }
                      setView("home");
                    }}
                    className={`inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900 transition hover:text-amber-800 ${uiFontClassName}`}
                  >
                    <span className="text-base leading-none" aria-hidden>
                      ←
                    </span>
                    Volver
                  </button>
                </div>
              </>
            ) : null}

          </div>
        </section>
      </main>
    </div>
  );
}
