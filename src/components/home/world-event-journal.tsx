"use client";

import { useEffect, useRef } from "react";

type WorldEvent = {
  id: number;
  happened_at: string;
  event_html: string;
};

type WorldEventJournalProps = {
  events: WorldEvent[];
};

function formatJournalTimestamp(value: string) {
  const date = new Date(value);
  const dayMonth = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  const hoursMinutes = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${dayMonth} - ${hoursMinutes}`;
}

export function WorldEventJournal({ events }: WorldEventJournalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = 0;
  }, [events]);

  return (
    <div
      ref={containerRef}
      className="mt-2 max-h-[280px] space-y-1 overflow-y-auto rounded-md border border-amber-900/70 bg-[#d8c7a2]/92 p-2 lg:p-3"
    >
      {events.length > 0 ? (
        events.map((event) => (
          <article
            key={event.id}
            className="rounded-md border border-amber-900/60 bg-[#1f120e]/90 px-3 py-1.5"
          >
            <div className="text-sm text-amber-100/95">
              <span className="mr-2 text-[11px] uppercase tracking-wide text-amber-200/80">
                {formatJournalTimestamp(event.happened_at)} -
              </span>
              <span
                className="inline"
                dangerouslySetInnerHTML={{ __html: event.event_html }}
              />
            </div>
          </article>
        ))
      ) : (
        <p className="text-sm text-amber-100/80">
          Aun no hay eventos globales registrados.
        </p>
      )}
    </div>
  );
}
