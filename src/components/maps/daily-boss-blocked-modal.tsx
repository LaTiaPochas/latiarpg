"use client";

import { Libre_Baskerville, Montserrat } from "next/font/google";

const dialogueFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

type DailyBossBlockedModalProps = {
  message: string;
  onClose: () => void;
};

export function DailyBossBlockedModal({ message, onClose }: DailyBossBlockedModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="daily-boss-blocked-title"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-amber-700/80 bg-[#1a100c]/97 shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`${dialogueFont.className} px-5 py-6 sm:px-8 sm:py-8`}>
          <h2
            id="daily-boss-blocked-title"
            className="text-center text-sm tracking-wide text-amber-300"
          >
            <i>- "You shall not pass!"</i>
          </h2>
          <p className="mt-4 text-center text-[13px] leading-relaxed text-amber-50/95 sm:text-sm">
            {message}
          </p>
          <div className={`${uiFont.className} mt-6 flex justify-center`}>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="inline-flex min-w-[11rem] cursor-pointer flex-col items-center rounded-md border-2 border-[#6b4a1f] bg-gradient-to-b from-[#c9a86c] via-[#a67c3d] to-[#7a5528] px-6 py-3 text-center shadow-[0_4px_0_#4a3218,inset_0_1px_0_rgba(255,240,200,0.45),0_8px_20px_rgba(0,0,0,0.45)] transition hover:from-[#d4b87a] hover:via-[#b8894a] hover:to-[#8a6230] active:translate-y-0.5"
            >
              <span className="mt-0.5 text-sm font-extrabold uppercase tracking-[0.14em] text-[#2a1808] drop-shadow-[0_1px_0_rgba(255,235,190,0.5)]">
                Entendido
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
