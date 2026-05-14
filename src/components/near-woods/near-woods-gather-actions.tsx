"use client";

import { useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GatherNearWoodsResult, NearWoodsGrantedItemView } from "@/app/(main)/near-woods/actions";
import { gatherMagicForest, gatherNearWoods } from "@/app/(main)/near-woods/actions";
import { NearWoodsGrantedItemDisplay } from "@/components/near-woods/near-woods-granted-item-display";
import { useNearWoodsScene } from "@/components/near-woods/near-woods-scene";
import { MAGIC_FOREST_ZONE_CODE, NEAR_WOODS_ZONE_CODE } from "@/lib/game-zones";

const RESULT_MESSAGE: Record<string, string> = {
  madera: "Juntaste ramas y recolectás madera.",
  enemy: "¡Te han descubierto! Algo acecha entre los arbustos…",
  potion: "Encontrás una poción entre el follaje.",
  medium_potion: "Encontrás una poción de tamaño considerable.",
  wolf_pelt: "Recolectás un resto de piel entre las ramas.",
  thread: "Encontrás hilo útil tirado junto al sendero.",
  feather: "Atrapás una pluma ligera que cae entre las ramas.",
  oro: "Entre las hojas brilla algo: un poco de oro.",
  aguas: "Descubrís una pequeña reserva de aguas relajantes.",
  soul_fragment: "Un fragmento de alma resplandece entre la maleza.",
};

function labelForResult(result: string): string {
  return RESULT_MESSAGE[result] ?? result;
}

type GatherModalState = {
  result: string;
  chance: number;
  granted: boolean;
  item: NearWoodsGrantedItemView | null;
  /** Aguas relajantes (almacén global): solo vista previa, no inventario del PJ. */
  previewItem: NearWoodsGrantedItemView | null;
};

export function NearWoodsGatherActions() {
  const { woodsView, setWoodsView, hasStoneAxeInInventory } = useNearWoodsScene();
  const router = useRouter();
  const titleId = useId();
  const [isPending, startTransition] = useTransition();
  const [rolled, setRolled] = useState<GatherModalState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!rolled) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [rolled]);

  useEffect(() => {
    if (!rolled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRolled(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rolled]);

  const runGatherNearWoods = () => {
    setActionError(null);
    startTransition(async () => {
      const out = await gatherNearWoods();
      applyGatherOutcome(out, NEAR_WOODS_ZONE_CODE);
    });
  };

  const runGatherMagicForest = () => {
    setActionError(null);
    startTransition(async () => {
      const out = await gatherMagicForest();
      applyGatherOutcome(out, MAGIC_FOREST_ZONE_CODE);
    });
  };

  function applyGatherOutcome(out: GatherNearWoodsResult, combatZoneCode: string) {
    if (!out.ok) {
      setActionError(out.error);
      return;
    }
    if (
      out.result === "enemy" &&
      "encounterCode" in out &&
      typeof out.encounterCode === "string" &&
      out.encounterCode.length > 0
    ) {
      const z = encodeURIComponent(combatZoneCode);
      router.push(`/combate/${encodeURIComponent(out.encounterCode)}?zone=${z}`);
      return;
    }
    if (out.granted) {
      setRolled({
        result: out.result,
        chance: out.chance,
        granted: true,
        item: out.item ?? null,
        previewItem: null,
      });
    } else {
      setRolled({
        result: out.result,
        chance: out.chance,
        granted: false,
        item: null,
        previewItem: "previewItem" in out ? out.previewItem ?? null : null,
      });
    }
  }

  const gatherOutcomeModal = rolled ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setRolled(null);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md overflow-visible rounded-xl border border-amber-600/80 bg-[#1a100c]/95 p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
      >
        <h2 id={titleId} className="text-lg font-bold tracking-wide text-amber-100 sm:text-xl">
          Encontraste:
        </h2>
        {(() => {
          const displayItem = rolled.granted ? rolled.item : rolled.previewItem;
          if (displayItem) {
            return (
              <div className="mt-4">
                <NearWoodsGrantedItemDisplay item={displayItem} />
              </div>
            );
          }
          if (rolled.granted && !rolled.item) {
            return (
              <p className="mt-4 text-sm leading-relaxed text-amber-200/90">
                Agregaste el objeto al inventario, pero no se pudieron cargar los datos para mostrarlo.
              </p>
            );
          }
          return (
            <p className="mt-4 text-sm leading-relaxed text-amber-100/95">{labelForResult(rolled.result)}</p>
          );
        })()}
        <button
          type="button"
          autoFocus
          className="mt-6 cursor-pointer rounded-md border border-amber-500/80 bg-gradient-to-b from-amber-600 to-amber-800 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-50 transition hover:from-amber-500 hover:to-amber-700"
          onClick={() => setRolled(null)}
        >
          Cerrar
        </button>
      </div>
    </div>
  ) : null;

  if (hasStoneAxeInInventory && woodsView === "deepForest") {
    return (
      <>
        <h2 className="mt-6 text-xl font-bold uppercase tracking-wide text-cyan-300/70 sm:text-2xl">
          Bosque Mágico
        </h2>
        <p className="mt-4 text-[11px] leading-snug text-amber-100/95 sm:text-[13px] sm:leading-relaxed">
          Cuando te adentrás en el bosque, sentís como el aire se mezcla con magia de forma natural. <br />Te es
          denso, pero no es difícil respirar.
          <br />
          Si querés volver, ahora es el momento.
        </p>
        <div className="mt-8 flex w-full max-w-md flex-col items-stretch gap-3 self-center sm:mx-auto">
          <button
            type="button"
            disabled={isPending}
            className="inline-flex cursor-pointer justify-center rounded-md border border-slate-500/90 bg-gradient-to-b from-slate-500 to-slate-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-50 shadow-[0_0_14px_rgba(87,151,209,0.35)] transition hover:from-slate-400 hover:to-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={runGatherMagicForest}
          >
            {isPending ? "Juntando…" : "Juntar Madera"}
          </button>
          <button
            type="button"
            className="inline-flex cursor-pointer justify-center rounded-md border border-amber-600/85 bg-gradient-to-b from-amber-700 to-amber-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-amber-50 shadow-[0_0_14px_rgba(245,158,11,0.35)] transition hover:from-amber-600 hover:to-amber-800"
            onClick={() => setWoodsView("entrance")}
          >
            Regresar a la entrada
          </button>
        </div>
        {actionError ? (
          <p className="mt-3 text-center text-xs text-red-300" role="alert">
            {actionError}
          </p>
        ) : null}
        {gatherOutcomeModal}
      </>
    );
  }

  return (
    <>
      {hasStoneAxeInInventory ? (
        <div
          className="mx-auto mt-6 w-full max-w-md rounded-xl border-2 border-emerald-500/55 bg-gradient-to-b from-emerald-950/45 via-[#142018]/90 to-[#1a100c]/95 p-4 shadow-[0_0_28px_rgba(16,185,129,0.22),inset_0_1px_0_rgba(167,243,208,0.14)] ring-1 ring-emerald-400/25 sm:p-5"
          role="region"
          aria-label="Acceso al bosque mágico"
        >
          <p className="text-[11px] leading-snug text-amber-100/95 sm:text-[13px] sm:leading-relaxed">
            Con este Hacha de Piedra que tenés, podés adentrarte más aun en el bosque para talar los árboles
            más grandes.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              className="inline-flex cursor-pointer rounded-md border border-emerald-600/90 bg-gradient-to-b from-emerald-700 to-emerald-950 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-50 shadow-[0_0_5px_rgba(16,185,129,0.35)] transition hover:from-emerald-600 hover:to-emerald-900"
              onClick={() => {
                setActionError(null);
                setWoodsView("deepForest");
              }}
            >
              Adentrarse
            </button>
          </div>
        </div>
      ) : null}
      <div className="mt-8 flex flex-row flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={isPending}
          className="inline-flex cursor-pointer rounded-md border border-slate-500/90 bg-gradient-to-b from-slate-500 to-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-50 shadow-[0_0_14px_rgba(87,151,209,0.35)] transition hover:from-slate-400 hover:to-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={runGatherNearWoods}
        >
          {isPending ? "Juntando…" : "Juntar Madera"}
        </button>
        <Link
          href="/"
          className="inline-flex cursor-pointer rounded-md border border-amber-600/85 bg-gradient-to-b from-amber-700 to-amber-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-50 shadow-[0_0_14px_rgba(245,158,11,0.35)] transition hover:from-amber-600 hover:to-amber-800"
        >
          Volver
        </Link>
      </div>
      {actionError ? (
        <p className="mt-3 text-center text-xs text-red-300" role="alert">
          {actionError}
        </p>
      ) : null}
      {gatherOutcomeModal}
    </>
  );
}
