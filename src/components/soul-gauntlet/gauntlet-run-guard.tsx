"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { abandonActiveSoulGauntletRun } from "@/app/(main)/soul-gauntlet-run/actions";
import { isGauntletSafePath } from "@/lib/soul-gauntlet-run";

export function GauntletRunGuard() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    if (isGauntletSafePath(pathname)) return;

    void abandonActiveSoulGauntletRun();
  }, [pathname]);

  return null;
}
