import Link from "next/link";

export default function RenacimientoPage() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-6 bg-slate-950 p-6 text-center text-amber-100">
      <h1 className="text-lg font-semibold text-amber-200 sm:text-xl">Renacimiento</h1>
      <Link
        href="/soul-altar"
        className="rounded-md border border-amber-700/60 bg-amber-950/40 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-900/50"
      >
        Volver al altar
      </Link>
    </div>
  );
}
