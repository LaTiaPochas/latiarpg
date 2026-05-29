"use client";

import { useRouter } from "next/navigation";
import { Montserrat } from "next/font/google";

import { SoulGauntletRunResultDialog } from "@/components/soul-gauntlet/soul-gauntlet-run-result-dialog";
import { SoulPitGauntletPanel } from "@/components/soul-gauntlet/soul-pit-gauntlet-panel";
import type { SoulGauntletGrantedRewardView } from "@/lib/soul-gauntlet-rewards";

const PAGE_BG = "/img/resources/background/bg_cueva_inner_6.png";

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type SoulGauntletRunResultProps = {
  floor: number;
  rewardTierLabel: string;
  granted: SoulGauntletGrantedRewardView[];
  inventoryError: string | null;
  completed?: boolean;
} | null;

type SoulGauntletCompletedSceneProps = {
  soulFragmentOwned: number;
  soulFragmentIconSrc: string;
  runResult?: SoulGauntletRunResultProps;
};

export function SoulGauntletCompletedScene({
  soulFragmentOwned,
  soulFragmentIconSrc,
  runResult = null,
}: SoulGauntletCompletedSceneProps) {
  const router = useRouter();

  const dismissRunResult = () => {
    router.replace("/gauntlet-pozo-de-las-almas");
  };

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

      {runResult ? (
        <SoulGauntletRunResultDialog
          floor={runResult.floor}
          rewardTierLabel={runResult.rewardTierLabel}
          granted={runResult.granted}
          inventoryError={runResult.inventoryError}
          completed={runResult.completed}
          onClose={dismissRunResult}
        />
      ) : null}
    </main>
  );
}
