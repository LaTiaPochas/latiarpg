"use client";

import { usePathname } from "next/navigation";

import { GauntletRunGuard } from "@/components/soul-gauntlet/gauntlet-run-guard";

function isCombatRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/combate" || pathname.startsWith("/combate/");
}

type MainLayoutShellProps = {
  children: React.ReactNode;
  /** Server-rendered `<TopNav />` desde el layout; no importar `TopNav` acá (evita `next/headers` en cliente). */
  topNav: React.ReactNode;
};

export function MainLayoutShell({ children, topNav }: MainLayoutShellProps) {
  const pathname = usePathname();

  if (isCombatRoute(pathname)) {
    return <main className="flex min-h-[100dvh] flex-1 flex-col">{children}</main>;
  }

  return (
    <>
      <GauntletRunGuard />
      {topNav}
      <main className="flex-1 pt-14">{children}</main>
    </>
  );
}
