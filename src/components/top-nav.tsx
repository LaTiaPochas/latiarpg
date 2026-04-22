import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";

export async function TopNav() {
  let gold = 0;

  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (hasSupabaseEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("oro")
        .eq("id", user.id)
        .maybeSingle();

      gold = profile?.oro ?? 0;
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b-2 border-[#8d5a2b] bg-[#1b0f0b]/90 shadow-[0_1px_0_#c08a4a,inset_0_-1px_0_#e2b06f,inset_0_1px_0_#5a351b] backdrop-blur-sm">
      <nav className="flex h-14 w-full items-center px-2 sm:px-3">
        <Link href="/" className="inline-flex items-center" aria-label="Ir al inicio">
          <Image
            src="/img/resources/logos/logo_latia_rpg.png"
            alt="La Tia RPG"
            width={125}
            height={40}
            className="h-auto w-auto max-h-13"
            priority
          />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/character_profile"
            className="inline-flex items-center gap-2 rounded-md border border-amber-800/70 bg-[#2a1812]/85 px-2 py-1 text-amber-100 transition hover:bg-[#3a2219]"
          >
            <Image
              src="/img/resources/iconos/icon_profile.png"
              alt="Perfil"
              width={18}
              height={18}
              className="h-[18px] w-[18px]"
            />
            <span className="text-sm font-semibold">Perfíl y Stats</span>
          </Link>

          <div className="flex items-center gap-2 rounded-md border border-amber-800/70 bg-[#2a1812]/85 px-2 py-1 text-amber-100">
            <Image
              src="/img/resources/iconos/icon_gold.png"
              alt="Oro"
              width={18}
              height={18}
              className="h-[18px] w-[18px]"
            />
            <span className="text-sm font-semibold tabular-nums">{gold}</span>
          </div>
        </div>
      </nav>
    </header>
  );
}
