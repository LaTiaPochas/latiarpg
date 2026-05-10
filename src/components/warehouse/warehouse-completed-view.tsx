"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  GlobalWarehouseInventoryModal,
  type GlobalWarehouseInventorySlotPayload,
} from "@/components/warehouse/global-warehouse-inventory-modal";

type WarehouseCompletedViewProps = {
  uiFontClassName: string;
  dialogueFontClassName: string;
  warehouseSlots: GlobalWarehouseInventorySlotPayload[];
  playerInventorySlots: GlobalWarehouseInventorySlotPayload[];
  playerClassName: string;
  playerLevel: number;
  playerStats: { str: number; dex: number; int: number; wis: number };
};

export function WarehouseCompletedView({
  uiFontClassName,
  dialogueFontClassName,
  warehouseSlots,
  playerInventorySlots,
  playerClassName,
  playerLevel,
  playerStats,
}: WarehouseCompletedViewProps) {
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);

  return (
    <div
      className={`relative h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden text-amber-50 ${uiFontClassName}`}
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.42), rgba(0,0,0,0.58)), url('/img/resources/background/bg_warehouse_base.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <main className="relative h-full min-h-0 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4">
          <Image
            src="/img/resources/characters/pj_mati_seller.png"
            alt="Mati"
            width={520}
            height={520}
            className="h-auto w-[min(92vw,380px)] translate-x-25 translate-y-0 object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.55)] sm:w-[min(78vw,720px)] sm:translate-x-100 sm:translate-y-14"
            priority
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 z-30 p-2 sm:p-5">
          <div className="mx-auto w-full max-w-3xl rounded-xl border border-[#9f8352]/80 bg-[#d8c7a2]/92 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-6 sm:py-4">
            <p className={`${dialogueFontClassName} text-center text-xs leading-relaxed text-slate-800 sm:text-sm`}>
              Acá vamos a poder dejar objetos, para que no se pierdan si tenés el inventario lleno. Este warehouse es
              compartido entre todos, así que ojo con lo que dejás.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {!warehouseModalOpen ? (
                <button
                  type="button"
                  onClick={() => setWarehouseModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#5c4a2d]/85 bg-[#6b5430] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#5c482a] active:bg-[#4d3b24] sm:text-xs"
                >
                  Ver almacén global
                </button>
              ) : null}
              <Link
                href="/garrison"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#7a5c31]/80 bg-[#7d6138] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#fdfbf7] shadow-sm transition-colors hover:bg-[#6e5532] active:bg-[#5f482b] sm:text-xs"
              >
                <span className="text-base leading-none" aria-hidden>
                  ←
                </span>
                volver al campamento
              </Link>
            </div>
          </div>
        </div>
      </main>

      <GlobalWarehouseInventoryModal
        open={warehouseModalOpen}
        onClose={() => setWarehouseModalOpen(false)}
        warehouseSlots={warehouseSlots ?? []}
        playerInventorySlots={playerInventorySlots ?? []}
        playerClassName={playerClassName}
        playerLevel={playerLevel}
        playerStats={playerStats}
      />
    </div>
  );
}
