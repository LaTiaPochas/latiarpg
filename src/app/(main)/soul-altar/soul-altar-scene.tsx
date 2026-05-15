"use client";

import Image from "next/image";
import { useState } from "react";

import { SoulAltarDialogue } from "./soul-altar-dialogue";

type SoulAltarSceneProps = {
  playerName: string;
  onComplete: () => Promise<{ ok: boolean }>;
};

export function SoulAltarScene({ playerName, onComplete }: SoulAltarSceneProps) {
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const shouldMoveLeoUp = dialogueIndex >= 2;
  const shouldHideLeo = dialogueIndex >= 3;
  const shouldShowGiantLeo = dialogueIndex === 9;
  const shouldShowCenteredLeo = dialogueIndex >= 10;

  return (
    <>
      <Image
        src="/img/resources/background/objeto_piedra.png"
        alt="Piedra del altar"
        width={820}
        height={820}
        priority
        className="pointer-events-none absolute bottom-[18%] left-1/2 z-30 h-auto w-[170px]  -translate-x-1/2 translate-y-28 object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.65)] sm:w-[240px] lg:w-[620px]"
      />
      <Image
        src="/img/resources/characters/pj_leo_rpg_standing.png"
        alt="Leo"
        width={620}
        height={930}
        priority
        className={`pointer-events-none absolute bottom-[13%] right-[10%] z-28 h-auto w-[150px] -rotate-45 -translate-x-150 object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.65)] transition-all duration-[2200ms] ease-in-out sm:w-[230px] lg:w-[300px] ${
          shouldMoveLeoUp ? "-translate-y-28 sm:-translate-y-32 lg:-translate-y-60 lg:-translate-x-160" : "translate-y-0"
        } ${shouldHideLeo ? "opacity-0" : "opacity-100"}`}
      />
      <Image
        src="/img/resources/characters/pj_leo_rpg_standing.png"
        alt="Leo gigante"
        width={1100}
        height={1650}
        priority
        className={`pointer-events-none absolute bottom-[-12%] left-1/2 z-[35] h-auto w-[min(92vw,620px)] -translate-x-1/2 object-contain drop-shadow-[0_24px_44px_rgba(0,0,0,0.75)] transition-all duration-300 ease-out sm:w-[min(78vw,760px)] lg:w-[820px] ${
          shouldShowGiantLeo ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      />
      <Image
        src="/img/resources/characters/pj_leo_rpg_standing.png"
        alt="Leo"
        width={620}
        height={930}
        priority
        className={`pointer-events-none absolute bottom-[14%] left-1/2 z-[35] h-auto w-[150px] -translate-x-1/2 object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.65)] transition-opacity duration-300 sm:w-[230px] lg:w-[300px] ${
          shouldShowCenteredLeo ? "opacity-100" : "opacity-0"
        }`}
      />
      <SoulAltarDialogue
        playerName={playerName}
        onDialogueIndexChange={setDialogueIndex}
        onComplete={onComplete}
      />
    </>
  );
}
