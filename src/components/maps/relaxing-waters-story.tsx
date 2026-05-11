"use client";

import Image from "next/image";
import Link from "next/link";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import { useState } from "react";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Mantener sincronizado con `HEAL_COST_GOLD` en src/app/(main)/relaxing-waters/page.tsx.
const HEAL_COST_GOLD = 1;

type RelaxingWatersStoryProps = {
  shouldPlayIntro: boolean;
  playerFaceSrc: string;
  onCompleteIntro: () => Promise<void>;
  initialGoldAmount: number;
  isCharacterAlreadyFull: boolean;
  onPayToHeal: () => Promise<{ ok: boolean; goldAmount?: number; error?: string }>;
};

const DIALOGUES = [
  {
    hasFace: false,
    text: "Cada uno se fue a explorar por su parte, y Nachito encontró este spot super relajante.",
  },
  {
    hasFace: true,
    text: "Voy a probar estas aguas a ver que tal están.",
  },
  {
    hasFace: false,
    text: "Realmente es un lugar soñado, al bañarte sentís como la energía vuelve a tu cuerpo.",
  },
  {
    hasFace: false,
    text: "Tu vida y tu mana se recuperaron por completo.",
  },
] as const;

export function RelaxingWatersStory({
  shouldPlayIntro,
  playerFaceSrc,
  onCompleteIntro,
  initialGoldAmount,
  isCharacterAlreadyFull,
  onPayToHeal,
}: RelaxingWatersStoryProps) {
  const [isEnteredRelaxingWaters, setIsEnteredRelaxingWaters] = useState(!shouldPlayIntro);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [didFinish, setDidFinish] = useState(!shouldPlayIntro);
  const [goldAmount, setGoldAmount] = useState(Math.max(0, Math.trunc(initialGoldAmount)));
  const [isPaying, setIsPaying] = useState(false);
  const [payFeedback, setPayFeedback] = useState<string | null>(null);
  const activeDialogue = DIALOGUES[Math.min(dialogueIndex, DIALOGUES.length - 1)];

  const handleAdvance = async () => {
    if (didFinish || isSaving) return;
    if (dialogueIndex < DIALOGUES.length - 1) {
      setDialogueIndex((value) => value + 1);
      return;
    }
    setIsSaving(true);
    try {
      await onCompleteIntro();
      setIsEnteredRelaxingWaters(true);
      setDidFinish(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePayToHeal = async () => {
    if (isPaying) return;
    setIsPaying(true);
    setPayFeedback(null);
    try {
      const result = await onPayToHeal();
      if (!result.ok) {
        setPayFeedback(result.error ?? "No se pudo completar la acción.");
        return;
      }
      const nextGold =
        typeof result.goldAmount === "number" && Number.isFinite(result.goldAmount)
          ? Math.max(0, Math.trunc(result.goldAmount))
          : Math.max(0, goldAmount - HEAL_COST_GOLD);
      setGoldAmount(nextGold);
      setPayFeedback("Te sentís renovado. Vida y mana recuperados por completo.");
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <main
      className={`relative h-[calc(100dvh-3.5rem)] overflow-hidden bg-fixed bg-cover bg-center bg-no-repeat text-amber-50 ${uiFont.className}`}
      style={{
        backgroundImage:
          "linear-gradient(rgba(8, 18, 24, 0.42), rgba(6, 12, 18, 0.58)), url('/img/resources/background/bg_aguas_termales.png')",
      }}
    >
      {!didFinish ? (
        <>
          <button
            type="button"
            onClick={() => void handleAdvance()}
            disabled={isSaving}
            className="absolute inset-0 z-10 cursor-pointer outline-none"
            aria-label="Continuar dialogo"
          />
          <div
            className={`${dialogueFont.className} absolute inset-x-0 bottom-0 z-20 p-2 sm:p-6`}
          >
            <div
              className={`mx-auto flex w-full max-w-4xl rounded-lg border border-cyan-700/65 bg-[#0f1e2a]/90 px-4 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-6 sm:py-4 ${
                activeDialogue.hasFace ? "gap-3 sm:gap-4" : ""
              }`}
            >
              {activeDialogue.hasFace ? (
                <div className="w-16 shrink-0 overflow-hidden rounded-md border border-cyan-600/70 bg-black/35 sm:w-24">
                  <Image
                    src={playerFaceSrc}
                    alt="Retrato del personaje"
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-left text-[13px] leading-relaxed text-cyan-50/95 sm:text-lg">
                  {activeDialogue.text}
                </p>
                <div className="mt-4 flex justify-center">
                  <span className="text-xs text-cyan-100/90">
                    {isSaving ? "Guardando..." : "Click o Enter para continuar"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {didFinish && !isEnteredRelaxingWaters ? (
        <div className="absolute inset-x-0 bottom-6 z-30 flex justify-center px-4">
          <Link
            href="/"
            className="rounded-md border border-cyan-500/80 bg-cyan-800/80 px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-50 transition hover:bg-cyan-700/90"
          >
            Volver al mapa
          </Link>
        </div>
      ) : null}
      {didFinish && isEnteredRelaxingWaters ? (
        <div className="absolute inset-x-0 bottom-0 z-30 p-2 sm:p-5">
          <div className="mx-auto w-full max-w-3xl rounded-lg border border-cyan-700/70 bg-[#0f1e2a]/92 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-6 sm:py-4">
            <p className="text-center text-sm leading-relaxed text-cyan-50 sm:text-lg">
              ¿Querés curar tu vida y mana por completo?
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={goldAmount < HEAL_COST_GOLD || isPaying || isCharacterAlreadyFull}
                onClick={() => void handlePayToHeal()}
                className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition sm:text-sm ${
                  goldAmount < HEAL_COST_GOLD || isPaying || isCharacterAlreadyFull
                    ? "cursor-not-allowed border-amber-700/40 bg-amber-950/40 text-amber-200/60"
                    : "cursor-pointer border-amber-500/80 bg-amber-700/85 text-amber-50 hover:bg-amber-600/90"
                }`}
              >
                {isPaying ? "Procesando..." : `Pagar ${HEAL_COST_GOLD} Oro`}
              </button>
              <Link
                href="/"
                className="rounded-md border border-cyan-500/80 bg-cyan-800/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-50 transition hover:bg-cyan-700/90 sm:text-sm"
              >
                Volver al Mapa
              </Link>
            </div>
            <div className="mt-3 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-md border border-cyan-800/70 bg-black/20 px-2.5 py-1.5">
                {isCharacterAlreadyFull ? (
                  <span className="text-xs text-cyan-100/90 sm:text-sm">
                    Tu vida y tu mana están completos.
                  </span>
                ) : (
                  <>
                    <span className="text-xs text-cyan-100/90 sm:text-sm">
                      Tenés disponibles {goldAmount} monedas de oro.
                    </span>
                    <Image
                      src="/img/resources/items/resource_gold.png"
                      alt="Monedas de oro"
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px] object-contain"
                    />
                  </>
                )}
              </div>
            </div>
            {payFeedback ? (
              <p className="mt-2 text-center text-xs text-cyan-200/90 sm:text-sm">{payFeedback}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
