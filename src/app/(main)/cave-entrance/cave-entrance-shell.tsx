"use client";

import Image from "next/image";
import Link from "next/link";

const BG_SRC = "/img/resources/background/bg_cave_entrance.png";

/** Pantalla única sin scroll: fondo a viewport bajo TopNav (~3.5rem). */
export function CaveEntranceShell() {
  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)] w-full max-w-none overflow-hidden">
      <Image
        src={BG_SRC}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center select-none"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/55" aria-hidden />
      <div className="relative z-10 flex w-full flex-1 items-center justify-center p-4">
        <div
          role="dialog"
          aria-labelledby="cave-entrance-title"
          aria-modal="true"
          className="max-w-md rounded-xl border border-amber-800/70 bg-[#1a100c]/95 p-6 shadow-[0_0_32px_rgba(0,0,0,0.85)] backdrop-blur-sm sm:p-8"
        >
          <p
            id="cave-entrance-title"
            className="text-center text-base leading-relaxed text-amber-100/95 sm:text-lg"
          >
            Llegamos muy lejos, pero tenemos que prepararnos mejor para continuar.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/"
              className="inline-flex min-w-[12rem] items-center justify-center rounded-lg border border-amber-700/80 bg-gradient-to-b from-amber-900/80 to-[#1a100c] px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.25)] transition hover:border-amber-500/90 hover:from-amber-800/90 hover:to-[#24130e]"
            >
              Volver al campamento
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
