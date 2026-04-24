import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { redirect } from "next/navigation";
import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasSupabaseEnv) {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-950 px-6 py-10 text-slate-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#3b2f1f_0%,#0f172a_45%,#020617_100%)]" />
        <main className="relative mx-auto w-full max-w-md rounded-2xl border border-amber-500/40 bg-amber-950/35 p-6 shadow-[0_0_60px_rgba(245,158,11,0.15)] backdrop-blur-sm">
          <h1 className="text-2xl font-bold">Configura Supabase primero</h1>
          <p className="mt-3 text-amber-100">
            Agrega las variables de entorno para habilitar el login.
          </p>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const params = await searchParams;
  const errorMessage = params.error;

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-950 px-3 py-6 text-amber-50 sm:px-6 sm:py-10">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://wallpapercave.com/wp/wp12719000.jpg')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/35 via-slate-900/55 to-black/80" />

      <main className="relative mx-auto w-full max-w-sm rounded-2xl border border-amber-400/40 bg-slate-950/70 p-5 shadow-[0_0_80px_rgba(251,191,36,0.2)] backdrop-blur-md sm:max-w-lg sm:p-7">
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-amber-300/15" />
        <div className="mx-auto flex w-full justify-center">
          <Image
            src="/img/resources/logos/logo_latia_rpg.png"
            alt="La Tia RPG"
            width={320}
            height={140}
            className="h-auto w-auto max-w-[220px] transition duration-300 hover:scale-105 hover:drop-shadow-[0_0_18px_rgba(251,191,36,0.55)] sm:max-w-[320px]"
            priority
          />
        </div>
        <p className="mt-3 text-center text-xs italic leading-relaxed text-amber-100/90 sm:mt-4 sm:text-sm">
          It&apos;s a dangerous business, going out your door.
          <br />
          You step onto the road, and if you don&apos;t keep your feet,
          there&apos;s no knowing where you might be swept off to.
        </p>

        {errorMessage ? (
          <div className="mt-5 rounded-lg border border-rose-500/40 bg-rose-950/45 p-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <form action={login} className="mt-5 space-y-3.5 sm:mt-6 sm:space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs text-amber-100 sm:mb-2 sm:text-sm">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-md border border-amber-700/50 bg-slate-900/70 px-2.5 py-1.5 text-sm text-amber-50 outline-none transition placeholder:text-amber-100/40 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/40 sm:px-3 sm:py-2"
              placeholder="jugador@latiarpg.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs text-amber-100 sm:mb-2 sm:text-sm"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-amber-700/50 bg-slate-900/70 px-2.5 py-1.5 text-sm text-amber-50 outline-none transition placeholder:text-amber-100/40 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/40 sm:px-3 sm:py-2"
              placeholder="********"
            />
          </div>

          <button
            type="submit"
            className="mt-1 w-full cursor-pointer rounded-md border border-amber-300/60 bg-amber-400 px-4 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-500 sm:py-2"
          >
            Comenzar la Aventura
          </button>
        </form>
      </main>
    </div>
  );
}
