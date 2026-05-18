"use client";

import Image from "next/image";
import Link from "next/link";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

import { mineAbandonedCoalMine } from "@/app/(main)/abandoned-coal-mine/actions";
import type { GatherNearWoodsResult, NearWoodsGrantedItemView } from "@/app/(main)/near-woods/actions";
import { NearWoodsGrantedItemDisplay } from "@/components/near-woods/near-woods-granted-item-display";
import { ABANDONED_COAL_MINE_ZONE_CODE } from "@/lib/game-zones";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const BG_SRC = "/img/resources/background/bg_cave_inner_1.png";
const MYSTIC_CAVE_MAP_HREF = "/mystic-cave?hotspot=cave-node-5";

const INTRO_PARAGRAPHS = [
  "El silencio en este lugar habla por si solo, todo el eco que caracteriza esta cueva, se intensifica en este túnel. Así y todo, es un lugar muy tranquilo, casi como si no quisiera ser perturbado. Los cadaveres de trasgos con sus picos rotos en mano y el olor a descomposición, es algo que no puede pasarse por alto.",
  "Las paredes están llenas de minerales, tanto que te enceguecen del peligro que pudiera surgir de intentar extraerlos.",
  "¿Qué es lo que está custodiando estos túneles?",
  "¿Te vas a animar a intentar llevarte algo de este lugar?",
] as const;

/** Mismas claves que Bosque Mágico (`magic-forest-gather-outcomes`). */
const MINE_RESULT_MESSAGE: Record<string, string> = {
  piedra: "Extraés trozos de piedra del filón.",
  enemy: "¡Algo se mueve en la oscuridad del túnel!",
  potion: "Encontrás una poción entre los escombros.",
  medium_potion: "Encontrás una poción de tamaño considerable.",
  feather: "Atrapás una pluma ligera junto a la veta.",
  oro: "Entre la roca brilla algo: un poco de oro.",
  aguas: "Descubrís una pequeña reserva de aguas relajantes.",
  soul_fragment: "Un fragmento de alma resplandece entre el polvo.",
};

function labelForMineResult(result: string): string {
  return MINE_RESULT_MESSAGE[result] ?? result;
}

type MineModalState = {
  result: string;
  chance: number;
  granted: boolean;
  item: NearWoodsGrantedItemView | null;
  previewItem: NearWoodsGrantedItemView | null;
};

type AbandonedCoalMineShellProps = {
  hasStonePickaxeInInventory: boolean;
};

export function AbandonedCoalMineShell({ hasStonePickaxeInInventory }: AbandonedCoalMineShellProps) {
  const router = useRouter();
  const titleId = useId();
  const [introOpen, setIntroOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [rolled, setRolled] = useState<MineModalState | null>(null);
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

  function applyMineOutcome(out: GatherNearWoodsResult) {
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
      const z = encodeURIComponent(ABANDONED_COAL_MINE_ZONE_CODE);
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

  function runMine() {
    if (!hasStonePickaxeInInventory) return;
    setActionError(null);
    startTransition(async () => {
      const out = await mineAbandonedCoalMine();
      applyMineOutcome(out);
    });
  }

  const outcomeModal = rolled ? (
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
          Resultado
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
                Objeto agregado al inventario, pero no se pudieron cargar los datos para mostrarlo.
              </p>
            );
          }
          return (
            <p className="mt-4 text-sm leading-relaxed text-amber-100/95">{labelForMineResult(rolled.result)}</p>
          );
        })()}
        <button
          type="button"
          autoFocus
          className="mt-6 cursor-pointer rounded-md border border-amber-500/80 bg-gradient-to-b from-amber-600 to-amber-800 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-50 transition hover:from-amber-500 hover:to-amber-700"
          onClick={() => {
            setRolled(null);
            setIntroOpen(false);
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)] w-full max-w-none overflow-hidden">
      <Image
        src={BG_SRC}
        alt="Interior de la mina abandonada"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center select-none"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/60" aria-hidden />

      {introOpen ? (
        <div className="relative z-10 flex w-full flex-1 items-center justify-center overflow-y-auto p-4">
          <div
            role="dialog"
            aria-labelledby="abandoned-coal-mine-title"
            aria-modal="true"
            className="max-h-[min(92dvh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-amber-800/70 bg-[#1a100c]/95 p-5 shadow-[0_0_32px_rgba(0,0,0,0.85)] backdrop-blur-sm sm:p-8"
          >
            <h1
              id="abandoned-coal-mine-title"
              className={`${uiFont.className} text-center text-lg font-bold uppercase tracking-wide text-amber-200 sm:text-xl`}
            >
              Minas Abandonadas
            </h1>
            <div
              className={`${dialogueFont.className} mt-4 space-y-3 text-center text-sm leading-relaxed text-amber-100/95 sm:text-sm`}
            >
              {INTRO_PARAGRAPHS.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className={`${uiFont.className} mt-6 flex flex-col items-center gap-3`}>
              <button
                type="button"
                disabled={!hasStonePickaxeInInventory || isPending}
                onClick={runMine}
                title={hasStonePickaxeInInventory ? undefined : "Necesitás un Pico de Piedra en el inventario"}
                className={`inline-flex min-w-[10rem] items-center justify-center rounded-lg border px-6 py-2.5 text-sm font-semibold uppercase tracking-wide shadow-[0_0_12px_rgba(25,25,25,0.8)] transition ${
                  hasStonePickaxeInInventory && !isPending
                    ? "cursor-pointer border-slate-700/90 bg-gradient-to-b from-slate-600 to-slate-800 text-slate-100 hover:from-slate-500 hover:to-slate-700"
                    : "cursor-not-allowed border-slate-700/50 bg-gradient-to-b from-slate-700/80 to-slate-800/80 text-slate-400"
                }`}
              >
                {isPending ? "Minando…" : "Minar"}
              </button>
              {actionError ? (
                <p className="text-center text-xs text-red-300" role="alert">
                  {actionError}
                </p>
              ) : null}
              <Link
                href={MYSTIC_CAVE_MAP_HREF}
                className="inline-flex min-w-[10rem] items-center justify-center rounded-lg border border-amber-700/80 bg-gradient-to-b from-amber-900/80 to-[#1a100c] px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-amber-100 shadow-[0_0_4px_rgba(251,191,36,0.2)] transition hover:border-amber-500/90 hover:from-amber-800/90 hover:to-[#24130e]"
              >
                Volver
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-end gap-4 p-4 pb-8">
          <div className={`${uiFont.className} flex w-full max-w-sm flex-col items-stretch gap-3`}>
            <button
              type="button"
              disabled={!hasStonePickaxeInInventory || isPending}
              onClick={runMine}
              title={hasStonePickaxeInInventory ? undefined : "Necesitás un Pico de Piedra en el inventario"}
              className={`inline-flex min-w-[12rem] items-center justify-center rounded-lg border px-5 py-2.5 text-sm font-semibold uppercase tracking-wide shadow-[0_0_16px_rgba(251,191,36,0.25)] transition ${
                hasStonePickaxeInInventory && !isPending
                  ? "cursor-pointer border-slate-700/90 bg-gradient-to-b from-slate-600 to-slate-800 text-slate-100 hover:from-slate-500 hover:to-slate-700"
                  : "cursor-not-allowed border-slate-700/50 bg-slate-800/60 text-slate-500"
              }`}
            >
              {isPending ? "Minando…" : "Minar de nuevo"}
            </button>
            {actionError ? (
              <p className="text-center text-xs text-red-300" role="alert">
                {actionError}
              </p>
            ) : null}
            <Link
              href={MYSTIC_CAVE_MAP_HREF}
              className="inline-flex min-w-[12rem] items-center justify-center rounded-lg border border-amber-700/80 bg-gradient-to-b from-amber-900/80 to-[#1a100c] px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.25)] transition hover:border-amber-500/90 hover:from-amber-800/90 hover:to-[#24130e]"
            >
              Volver al mapa
            </Link>
          </div>
        </div>
      )}

      {outcomeModal}
    </div>
  );
}
