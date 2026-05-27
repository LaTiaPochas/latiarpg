"use client";

import { useEffect, useState } from "react";

import {
  formatMeloniTradesResetCountdown,
  getMsUntilMidnightInTimeZone,
  MELONI_TRADES_TIMEZONE,
} from "@/lib/meloni-trades";

type MeloniTradesResetCountdownProps = {
  className?: string;
};

export function MeloniTradesResetCountdown({ className }: MeloniTradesResetCountdownProps) {
  const [remainingMs, setRemainingMs] = useState(() =>
    getMsUntilMidnightInTimeZone(MELONI_TRADES_TIMEZONE),
  );

  useEffect(() => {
    const tick = () => {
      setRemainingMs(getMsUntilMidnightInTimeZone(MELONI_TRADES_TIMEZONE));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <p className={className}>
      Nuevos trueques en:{" "}
      <span className="font-bold tabular-nums tracking-wide">
        {formatMeloniTradesResetCountdown(remainingMs)}
      </span>
    </p>
  );
}
