"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type NearWoodsWoodsView = "entrance" | "deepForest";

type NearWoodsSceneContextValue = {
  woodsView: NearWoodsWoodsView;
  setWoodsView: (view: NearWoodsWoodsView) => void;
  hasStoneAxeInInventory: boolean;
};

const NearWoodsSceneContext = createContext<NearWoodsSceneContextValue | null>(null);

export function useNearWoodsScene(): NearWoodsSceneContextValue {
  const ctx = useContext(NearWoodsSceneContext);
  if (!ctx) {
    throw new Error("useNearWoodsScene debe usarse dentro de NearWoodsScene");
  }
  return ctx;
}

const BG_NEAR_WOODS = "url('/img/resources/background/bg_near_woods.png')";
const BG_MAGIC_FOREST = "url('/img/resources/background/bg_magic_forest.png')";

type NearWoodsSceneProps = {
  hasStoneAxeInInventory: boolean;
  className: string;
  children: ReactNode;
};

export function NearWoodsScene({ hasStoneAxeInInventory, className, children }: NearWoodsSceneProps) {
  const [woodsView, setWoodsView] = useState<NearWoodsWoodsView>("entrance");

  const contextValue = useMemo(
    () => ({ woodsView, setWoodsView, hasStoneAxeInInventory }),
    [woodsView, hasStoneAxeInInventory],
  );

  const backgroundImage =
    hasStoneAxeInInventory && woodsView === "deepForest" ? BG_MAGIC_FOREST : BG_NEAR_WOODS;

  return (
    <NearWoodsSceneContext.Provider value={contextValue}>
      <div className={className}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage }}
        />
        {children}
      </div>
    </NearWoodsSceneContext.Provider>
  );
}

/** Título y texto de la entrada; se oculta al adentrarse en el bosque mágico (con hacha). */
export function NearWoodsEntranceCopy() {
  const { hasStoneAxeInInventory, woodsView } = useNearWoodsScene();
  if (hasStoneAxeInInventory && woodsView === "deepForest") return null;

  return (
    <>
      <h1 className="text-xl font-bold uppercase tracking-wide text-amber-100 sm:text-2xl">
        Cercanías del Bosque
      </h1>
      <p className="mt-2 text-xs italic text-amber-200 lg:text-sm">
        - &quot;Whatever you do, don&apos;t leave the path!&quot;
      </p>
      <p className="mt-8 text-[11px] leading-snug text-amber-100/95 sm:mt-8 sm:text-[13px] sm:leading-relaxed lg:text-sm">
        Estás buscando una forma sencilla de juntar recursos sin exponerte a los peligros del sendero como
        algunos de tus compañeros. <br /> Cada ramita que juntes, trae consigo la posibilidad de alertar
        enemigos que están escondidos esperando para atacarte. <br />
        ¿Qué es mejor? ¿Malo conocido o bueno por conocer?
      </p>
    </>
  );
}
