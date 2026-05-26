"use client";

import { Montserrat } from "next/font/google";

import { SoulPitGauntletPanel } from "@/components/soul-gauntlet/soul-pit-gauntlet-panel";

const PAGE_BG = "/img/resources/background/bg_cueva_inner_6.png";

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type SoulGauntletCompletedSceneProps = {
  soulFragmentOwned: number;
  soulFragmentIconSrc: string;
};

export function SoulGauntletCompletedScene({
  soulFragmentOwned,
  soulFragmentIconSrc,
}: SoulGauntletCompletedSceneProps) {
  return (
    <main
      className={`relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#120b08] px-4 py-8 ${uiFont.className}`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${PAGE_BG}')` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/55" aria-hidden />

      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-7.5rem)] w-full max-w-6xl items-center justify-center">
        <SoulPitGauntletPanel
          soulFragmentOwned={soulFragmentOwned}
          soulFragmentIconSrc={soulFragmentIconSrc}
        />
      </section>
    </main>
  );
}
