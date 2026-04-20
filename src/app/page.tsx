import { createClient } from "@/lib/supabase/server";

const baseStats = [
  { label: "Clase", value: "Aventurero" },
  { label: "Nivel", value: "1" },
  { label: "HP", value: "100 / 100" },
  { label: "Mana", value: "60 / 60" },
];

export default async function Home() {
  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let classes:
    | Array<{ id: number; name: string; description: string | null }>
    | null = null;
  let error: Error | null = null;

  if (hasSupabaseEnv) {
    const supabase = await createClient();
    const response = await supabase
      .from("rpg_classes")
      .select("id, name, description")
      .limit(4);

    classes = response.data;
    error = response.error;
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <main className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 lg:col-span-2">
          <p className="text-sm uppercase tracking-widest text-emerald-300">
            Proyecto base listo
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">LaTiaRPG</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            Base creada con Next.js para desplegar en Vercel y con Supabase
            conectado. Puedes usar esta pantalla como lobby inicial de tu RPG
            web.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {baseStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-slate-800 bg-slate-950/80 p-4"
              >
                <p className="text-xs uppercase tracking-wider text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-2 text-xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">Clases (Supabase)</h2>
          <p className="mt-2 text-sm text-slate-300">
            Lee datos de la tabla <code>rpg_classes</code>.
          </p>

          {!error && classes && classes.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {classes.map((playerClass) => (
                <li
                  key={playerClass.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
                >
                  <p className="font-medium">{playerClass.name}</p>
                  <p className="text-sm text-slate-400">
                    {playerClass.description ?? "Sin descripcion"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-lg border border-amber-600/40 bg-amber-950/40 p-4 text-sm text-amber-200">
              {hasSupabaseEnv
                ? "No hay datos aun o la tabla rpg_classes no existe. Crea la tabla en Supabase y agrega filas para verla aqui."
                : "Faltan variables de entorno de Supabase. Configura .env.local para habilitar esta seccion."}
            </div>
          )}
        </aside>
      </main>

      <section className="mx-auto mt-6 w-full max-w-6xl rounded-xl border border-slate-800 bg-slate-900/80 p-6">
        <h2 className="text-lg font-semibold">Siguiente objetivo sugerido</h2>
        <p className="mt-2 text-slate-300">
          Implementar autenticacion (email o Google), crear personaje y guardar
          inventario/misiones por usuario.
        </p>
      </section>
    </div>
  );
}
