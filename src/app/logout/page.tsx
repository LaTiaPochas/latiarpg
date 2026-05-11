import Image from "next/image";
import Link from "next/link";
import { Montserrat } from "next/font/google";
import { signOut } from "./actions";

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export default function LogoutPage() {
  return (
    <div
      className={`relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-950 px-3 py-6 text-amber-50 sm:px-6 sm:py-10 ${uiFont.className}`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://wallpapercave.com/wp/wp12719000.jpg')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-900/60 to-black/85" />

      <main className="relative mx-auto w-full max-w-sm rounded-2xl border border-amber-400/40 bg-slate-950/75 p-5 shadow-[0_0_80px_rgba(251,191,36,0.18)] backdrop-blur-md sm:max-w-md sm:p-7">
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-amber-300/15" />

        <div className="mx-auto flex w-full justify-center">
          <Image
            src="/img/resources/logos/logo_latia_rpg.png"
            alt="La Tia RPG"
            width={320}
            height={140}
            className="h-auto w-auto max-w-[180px] sm:max-w-[240px]"
            priority
          />
        </div>

        <p className="mt-4 text-center text-sm leading-relaxed text-amber-100/95 sm:text-base">
          ¿Querés cerrar la sesión y volver a la pantalla de inicio?
        </p>

        <form action={signOut} className="mt-5 flex justify-center">
          <button
            type="submit"
            className="w-full cursor-pointer rounded-md border border-amber-300/60 bg-amber-400 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-slate-900 transition hover:bg-amber-500 sm:py-2.5 sm:text-base"
          >
            LOGOUT
          </button>
        </form>

        <div className="mt-3 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-800/70 bg-[#2a1812]/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:bg-[#3a2219]"
          >
            <span aria-hidden>←</span>
            Cancelar
          </Link>
        </div>
      </main>
    </div>
  );
}
