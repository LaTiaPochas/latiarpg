/**
 * Debug de combate: activar con `?debug=1` en la URL del encuentro
 * o `NEXT_PUBLIC_COMBAT_DEBUG=1` en `.env.local`.
 */

export function isCombatDebugEnabled(explicit?: boolean): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  if (process.env.NEXT_PUBLIC_COMBAT_DEBUG === "1") return true;
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("debug") === "1") return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

export type CombatDebugLogger = (label: string, payload?: Record<string, unknown>) => void;

export function createCombatDebugLogger(enabled: boolean, channel = "enemy-dmg"): CombatDebugLogger {
  if (!enabled) {
    return () => {};
  }
  return (label, payload = {}) => {
    // `console.log` para que aparezca con el filtro por defecto (no Verbose).
    console.log(`[${channel}] ${label}`, payload);
  };
}
