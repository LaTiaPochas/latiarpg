"use client";

import Image from "next/image";
import { useState } from "react";

import {
  BESTIARIO_UNDISCOVERED_NAME,
  type BibliotecaBestiarioEnemyEntry,
} from "@/lib/biblioteca-bestiario-entries";

const ENEMY_SPRITE_FALLBACK_SRC = "/img/resources/logos/logo_latia_rpg.png";

type BibliotecaBestiarioEnemyGridProps = {
  enemies: BibliotecaBestiarioEnemyEntry[];
  uiFontClassName?: string;
};

function BestiarioEnemyCell({ enemy }: { enemy: BibliotecaBestiarioEnemyEntry }) {
  const displayName = enemy.discovered ? enemy.name : BESTIARIO_UNDISCOVERED_NAME;
  const initialSrc = enemy.discovered ? enemy.spriteSrc?.trim() || ENEMY_SPRITE_FALLBACK_SRC : null;
  const [imgSrc, setImgSrc] = useState(initialSrc);

  return (
    <li className="flex flex-col items-center gap-2 rounded-lg border border-[#7a5c31]/40 bg-[#f5edd8]/60 px-3 py-3 text-center shadow-sm">
      {enemy.discovered && imgSrc ? (
        <Image
          src={imgSrc}
          alt={displayName}
          title={displayName}
          width={72}
          height={72}
          className="h-[72px] w-[72px] object-contain object-bottom drop-shadow-sm"
          onError={() => {
            if (imgSrc !== ENEMY_SPRITE_FALLBACK_SRC) {
              setImgSrc(ENEMY_SPRITE_FALLBACK_SRC);
            }
          }}
        />
      ) : (
        <div
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-dashed border-[#7a5c31]/60 bg-[#e8dcc0] text-3xl font-bold text-[#5c4828]"
          aria-hidden
        >
          ?
        </div>
      )}
      <span className="text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-900">
        {displayName}
      </span>
    </li>
  );
}

export function BibliotecaBestiarioEnemyGrid({
  enemies,
  uiFontClassName = "",
}: BibliotecaBestiarioEnemyGridProps) {
  if (enemies.length === 0) {
    return (
      <p className={`mt-4 text-xs font-semibold text-slate-700 ${uiFontClassName}`}>
        No hay enemigos registrados en esta zona todavía.
      </p>
    );
  }

  return (
    <ul
      className={`biblioteca-parchment-scrollbar mx-auto mt-4 grid max-h-[min(52vh,420px)] w-full max-w-lg grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 ${uiFontClassName}`}
    >
      {enemies.map((enemy) => (
        <BestiarioEnemyCell
          key={`${enemy.templateId}-${enemy.discovered ? "1" : "0"}`}
          enemy={enemy}
        />
      ))}
    </ul>
  );
}
