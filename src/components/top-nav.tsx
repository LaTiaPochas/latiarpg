import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";

/** `items.id` del oro como ítem de inventario; fuente de verdad real (la columna `user_profiles.oro` está sin sincronizar). */
const GOLD_ITEM_ID = "8438bdcd-b4b6-412c-8a54-0dcdb6636289";

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
      const { data: goldRows } = await supabase
        .from("user_inventory")
        .select("quantity")
        .eq("profile_id", user.id)
        .eq("item_id", GOLD_ITEM_ID)
        .gt("quantity", 0);

      gold = (goldRows ?? []).reduce(
        (sum, row) =>
          sum +
          (typeof row.quantity === "number" && Number.isFinite(row.quantity)
            ? Math.max(0, Math.trunc(row.quantity))
            : 0),
        0,
      );
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
            style={{ width: "auto", height: "auto" }}
            priority
          />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/garrison"
            aria-label="Campamento"
            className="inline-flex items-center gap-2 rounded-md border border-amber-800/70 bg-[#2a1812]/85 px-2 py-1 text-amber-100 transition hover:bg-[#3a2219]"
          >
            <Image
              src="/img/resources/iconos/icon_campfire.png"
              alt="Campamento"
              width={18}
              height={18}
              className="h-[18px] w-[18px]"
            />
            <span className="hidden text-sm font-semibold tracking-wide sm:inline">Campamento</span>
          </Link>

          <Link
            href="/character_profile"
            aria-label="Perfil"
            className="inline-flex items-center gap-2 rounded-md border border-amber-800/70 bg-[#2a1812]/85 px-2 py-1 text-amber-100 transition hover:bg-[#3a2219]"
          >
            <Image
              src="/img/resources/iconos/icon_profile.png"
              alt="Perfil"
              width={18}
              height={18}
              className="h-[18px] w-[18px]"
            />
            <span className="hidden text-sm font-semibold sm:inline">Perfíl</span>
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

          <Link
            href="/logout"
            className="inline-flex items-center gap-1.5 rounded-md border border-red-800/70 bg-[#4f0404]/85 px-2 py-1 text-red-100 transition hover:bg-[#3a2219]"
            aria-label="Cerrar sesion"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[18px] w-[18px] sm:hidden"
              aria-hidden="true"
            >
              <path d="M15 17l5-5-5-5" />
              <path d="M20 12H9" />
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            </svg>
            <span className="hidden text-sm font-semibold tracking-wide sm:inline">Logout</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
