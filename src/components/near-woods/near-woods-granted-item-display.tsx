"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import type { NearWoodsGrantedItemView } from "@/app/(main)/near-woods/actions";

const abilitiesFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const itemTooltipFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
});

function capitalizeFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function ItemTooltipBody({
  item,
  borderStyle,
  nameStyle,
}: {
  item: NearWoodsGrantedItemView;
  borderStyle: CSSProperties | undefined;
  nameStyle: CSSProperties | undefined;
}) {
  return (
    <div
      className="w-full rounded-lg border border-amber-700/70 bg-[#120f2a]/98 p-3 text-left text-sm text-amber-50 shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
      style={borderStyle}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`${abilitiesFont.className} text-xs font-bold uppercase tracking-wider text-amber-300`}
          style={nameStyle}
        >
          {item.name}
        </p>
        {item.itemTypeId !== 2 ? (
          <div className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-amber-200">
            <Image
              src="/img/resources/iconos/icon_gold.png"
              alt="Oro"
              width={14}
              height={14}
              className="h-3.5 w-3.5 object-contain"
            />
            <span>{item.sellValue}</span>
          </div>
        ) : null}
      </div>
      {item.itemTypeCode && (item.itemTypeId === 2 || item.itemTypeId === 3) ? (
        <p className={`${abilitiesFont.className} mt-0.5 text-[11px] font-semibold text-amber-300/85`}>
          {capitalizeFirst(item.itemTypeCode)}
        </p>
      ) : null}
      <p className={`${itemTooltipFont.className} mt-2 italic leading-relaxed text-amber-50/90`}>
        {item.description}
      </p>
      {item.quoteText ? (
        <p className={`${itemTooltipFont.className} mt-1.5 text-[11px] italic leading-relaxed text-amber-200/85`}>
          - <em>&quot;{item.quoteText}&quot;</em>
        </p>
      ) : null}
    </div>
  );
}

export function NearWoodsGrantedItemDisplay({ item }: { item: NearWoodsGrantedItemView }) {
  const borderStyle = item.rarityColor ? { borderColor: item.rarityColor } : undefined;
  const nameStyle = item.rarityColor ? { color: item.rarityColor } : undefined;

  return (
    <div className="flex flex-col items-center">
      {/* Recuadro ceñido solo al tamaño del ícono; el tooltip va fuera del flujo (absolute) */}
      <div
        className="inline-flex rounded-xl border-2 border-amber-600/75 bg-gradient-to-b from-[#2a1810]/95 to-[#1a100c]/98 p-2 shadow-[inset_0_1px_0_rgba(251,191,36,0.12)] sm:p-2.5"
        style={borderStyle}
      >
        <div className="group relative h-18 w-18 shrink-0 sm:h-18 sm:w-18">
          <Image
            src={item.iconPath}
            alt={item.name}
            width={112}
            height={112}
            className="relative z-10 h-full w-full cursor-pointer object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]"
          />

          <div
            id={`near-woods-loot-tip-${item.id}`}
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 min-w-[min(18rem,calc(100vw-3rem))] max-w-[min(18rem,calc(100vw-3rem))] -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100"
          >
            <ItemTooltipBody item={item} borderStyle={borderStyle} nameStyle={nameStyle} />
          </div>
        </div>
      </div>

      <p className={`${abilitiesFont.className} mt-3 max-w-[min(20rem,calc(100vw-2.5rem))] text-center text-xs font-bold uppercase text-amber-200/95 sm:text-xs`}>
        {item.name.trim().toUpperCase()} x {item.grantedQuantity}
      </p>
    </div>
  );
}
