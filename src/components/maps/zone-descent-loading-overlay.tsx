"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ZoneDescentLoadingOverlayProps = {
  visible: boolean;
  label: string;
  uiClassName?: string;
};

export function ZoneDescentLoadingOverlay({
  visible,
  label,
  uiClassName = "",
}: ZoneDescentLoadingOverlayProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!visible) {
      setProgress(0);
      return;
    }
    setProgress(0);
    const intervalId = window.setInterval(() => {
      setProgress((current) => (current >= 90 ? current : current + 8));
    }, 120);
    return () => window.clearInterval(intervalId);
  }, [visible]);

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/65 px-4">
      <div
        className={`w-full max-w-sm rounded-xl border border-amber-700/80 bg-[#1a100c]/95 p-5 text-center shadow-[0_12px_40px_rgba(0,0,0,0.55)] ${uiClassName}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-100">{label}</p>
        <div className="mt-4 h-4 overflow-hidden rounded-full border border-amber-900/70 bg-black/50 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-700 via-amber-300 to-amber-600 transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
