"use client";

import { useMemo } from "react";

import { BibliotecaMemberFaceIcon } from "@/components/biblioteca/biblioteca-member-face-icon";
import type { BibliotecaMaterialStatKey, BibliotecaMaterialsTableRow } from "@/lib/biblioteca-user-stats";

const TABLE_COLUMNS: Array<{ key: BibliotecaMaterialStatKey; label: string }> = [
  { key: "materials_given", label: "Total" },
  { key: "wood_given", label: "Madera" },
  { key: "rock_given", label: "Piedra" },
  { key: "gold_given", label: "Oro" },
  { key: "hard_wood_given", label: "M. res." },
  { key: "animal_pelt_given", label: "Pieles" },
  { key: "iron_ingots_given", label: "Hierro" },
];

function computeColumnMaxes(
  rows: BibliotecaMaterialsTableRow[],
): Record<BibliotecaMaterialStatKey, number> {
  return TABLE_COLUMNS.reduce(
    (acc, column) => {
      acc[column.key] = rows.reduce((max, row) => Math.max(max, row[column.key]), 0);
      return acc;
    },
    {} as Record<BibliotecaMaterialStatKey, number>,
  );
}

type BibliotecaMaterialsStatsTableProps = {
  rows: BibliotecaMaterialsTableRow[];
  uiFontClassName?: string;
};

export function BibliotecaMaterialsStatsTable({
  rows,
  uiFontClassName = "",
}: BibliotecaMaterialsStatsTableProps) {
  const columnMaxes = useMemo(() => computeColumnMaxes(rows), [rows]);

  if (rows.length === 0) {
    return (
      <p className={`mt-4 text-xs font-semibold text-slate-700 ${uiFontClassName}`}>
        Todavía no hay estadísticas de materiales registradas.
      </p>
    );
  }

  return (
    <div className="biblioteca-parchment-scrollbar mt-4 max-h-[min(52vh,420px)] overflow-auto rounded-md border border-[#9f8352]/70 bg-[#f5edd8]/80 pr-1">
      <table className={`w-full min-w-[640px] border-collapse text-left text-[10px] sm:text-xs ${uiFontClassName}`}>
        <thead className="sticky top-0 z-10 bg-[#c9b48a] shadow-[0_1px_0_#9f8352]">
          <tr>
            <th className="whitespace-nowrap px-2 py-2 text-center font-bold uppercase tracking-wide text-slate-900">
              Miembro
            </th>
            {TABLE_COLUMNS.map((column) => (
              <th
                key={column.key}
                className="whitespace-nowrap px-2 py-2 text-center font-bold uppercase tracking-wide text-slate-900"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId} className="border-t border-[#9f8352]/40 odd:bg-[#f0e6cf]/60 even:bg-[#f8f1df]/80">
              <td className="whitespace-nowrap px-2 py-1.5 text-center text-slate-800">
                <BibliotecaMemberFaceIcon miembro={row.memberName} faceSrc={row.memberFaceSrc} />
              </td>
              {TABLE_COLUMNS.map((column) => {
                const value = row[column.key];
                const isColumnMax =
                  columnMaxes[column.key] > 0 && value === columnMaxes[column.key];

                return (
                  <td
                    key={column.key}
                    className={`whitespace-nowrap px-2 py-1.5 text-center tabular-nums text-slate-800 ${
                      isColumnMax ? "biblioteca-stat-column-max" : ""
                    }`}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
