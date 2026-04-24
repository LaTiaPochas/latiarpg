import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { redirect } from "next/navigation";

export default async function Home() {
  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasSupabaseEnv) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 px-6 py-10 text-slate-100">
        <main className="mx-auto w-full max-w-3xl rounded-xl border border-amber-700/40 bg-amber-950/30 p-6">
          <h1 className="text-2xl font-bold">Faltan variables de Supabase</h1>
          <p className="mt-3 text-amber-100">
            Configura <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en <code>.env.local</code>
            .
          </p>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: milestones } = await supabase
    .from("user_milestones")
    .select("intro_completed, tutorial_completed, class_selected")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!milestones?.intro_completed) {
    redirect("/introduccion");
  }

  if (!milestones?.tutorial_completed) {
    redirect("/fin-tutorial");
  }

  if (!milestones?.class_selected) {
    redirect("/class-selection");
  }

  const profileResponse = await supabase
    .from("user_profiles")
    .select("email, miembro, puntos, color, role")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileResponse.data;

  const response = await supabase
    .from("rpg_classes")
    .select("id, name, description")
    .limit(4);

  const classes = response.data;
  const error = response.error;
  const canPlay = !!profile;
  const profileColor = profile?.color || "#22C55E";

  const startCards = [
    { label: "Miembro", value: profile?.miembro || "Sin asignar" },
    { label: "Puntos", value: String(profile?.puntos ?? 0) },
    { label: "Rango", value: profile?.role || "player" },
    { label: "Estado", value: canPlay ? "Activo" : "Pendiente" },
  ];

  async function signOut() {
    "use server";

    const supabaseClient = await createClient();
    await supabaseClient.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-[100dvh] bg-slate-950 px-6 py-10 text-slate-100">
      <main className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 lg:col-span-2">
          <p className="text-sm uppercase tracking-widest text-emerald-300">
            Lobby principal
          </p>
          <div className="mt-2">
            <Image
              src="/img/resources/logos/logo_latia_rpg.png"
              alt="La Tia RPG"
              width={340}
              height={150}
              className="h-auto w-auto max-w-[340px]"
              priority
            />
          </div>
          <p className="mt-4 max-w-2xl text-slate-300">
            Esta es la pantalla de inicio del juego. Desde aca podes revisar tu
            progreso y entrar a las secciones principales.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm">
            <p className="text-slate-300">Sesion iniciada como: {user.email}</p>
            <p className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">
              Mi color:{" "}
              <span className="font-semibold" style={{ color: profileColor }}>
                {profileColor}
              </span>
            </p>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md bg-slate-100 px-3 py-1 font-medium text-slate-900 hover:bg-white"
              >
                Cerrar sesion
              </button>
            </form>
          </div>

          {!canPlay ? (
            <div className="mt-6 rounded-lg border border-amber-600/40 bg-amber-950/40 p-4 text-sm text-amber-200">
              Tu usuario existe en Auth, pero no tiene perfil en{" "}
              <code>user_profiles</code>. Ejecuta el script de backfill en
              Supabase para vincular usuarios ya creados.
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {startCards.map((stat) => (
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
          <h2 className="text-lg font-semibold">Clases disponibles</h2>
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
              No hay datos aun o la tabla rpg_classes no existe. Crea la tabla
              en Supabase y agrega filas para verla aqui.
            </div>
          )}
        </aside>
      </main>

      <section className="mx-auto mt-6 w-full max-w-6xl rounded-xl border border-slate-800 bg-slate-900/80 p-6">
        <h2 className="text-lg font-semibold">Menu rapido</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="rounded-lg border border-slate-700 bg-slate-950/80 p-4 text-left transition hover:border-slate-500"
          >
            <p className="text-sm font-semibold">Personaje</p>
            <p className="mt-1 text-xs text-slate-400">
              Equipamiento, atributos y progreso.
            </p>
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700 bg-slate-950/80 p-4 text-left transition hover:border-slate-500"
          >
            <p className="text-sm font-semibold">Misiones</p>
            <p className="mt-1 text-xs text-slate-400">
              Actividades para sumar puntos.
            </p>
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700 bg-slate-950/80 p-4 text-left transition hover:border-slate-500"
          >
            <p className="text-sm font-semibold">Ranking</p>
            <p className="mt-1 text-xs text-slate-400">
              Tabla general de miembros.
            </p>
          </button>
        </div>
      </section>
    </div>
  );
}
