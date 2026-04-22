import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { redirect } from "next/navigation";
import { confirmStatAllocation } from "./actions";
import { StatsPanel } from "./stats-panel";

const spellBook = [
  {
    name: "Llama Astral",
    type: "Fuego",
    cost: "18 MP",
    description: "Invoca una llamarada mistica que quema al enemigo por 2 turnos.",
  },
  {
    name: "Velo Esmeralda",
    type: "Soporte",
    cost: "14 MP",
    description: "Crea una barrera natural que aumenta la resistencia magica.",
  },
  {
    name: "Hoja del Viento",
    type: "Destreza",
    cost: "10 MP",
    description: "Ataque rapido que escala con DEX y puede golpear dos veces.",
  },
  {
    name: "Juicio Arcano",
    type: "Sagrado",
    cost: "24 MP",
    description: "Canaliza energia ancestral y golpea con dano alto de WIS.",
  },
];

export default async function CharacterProfilePage() {
  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasSupabaseEnv) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
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

  const { data: character } = await supabase
    .from("characters")
    .select(
      "character_name, level, class_name, str, dex, int, wis, speed_total, hp_total, mana_total, armor_total, mr_total, stat_points_remaining",
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  const characterName = character?.character_name || "Aventurero sin nombre";
  const level = character?.level ?? 1;
  const className = character?.class_name || "Aventurero";
  const stats: Array<{ label: "STR" | "DEX" | "INT" | "WIS"; value: number }> = [
    { label: "STR", value: character?.str ?? 0 },
    { label: "DEX", value: character?.dex ?? 0 },
    { label: "INT", value: character?.int ?? 0 },
    { label: "WIS", value: character?.wis ?? 0 },
  ];
  const derivedStats = [
    {
      label: "HP",
      value: character?.hp_total ?? 0,
      icon: "/img/resources/iconos/icon_hp_profile.png",
    },
    {
      label: "MANA",
      value: character?.mana_total ?? 0,
      icon: "/img/resources/iconos/icon_mana_profile.png",
    },
    {
      label: "Speed",
      value: character?.speed_total ?? 0,
      icon: "/img/resources/iconos/icon_speed_profile.png",
    },
    {
      label: "Armor",
      value: character?.armor_total ?? 0,
      icon: "/img/resources/iconos/icon_armor_profile.png",
    },
    {
      label: "Magic Resistance",
      value: character?.mr_total ?? 0,
      icon: "/img/resources/iconos/icon_mr_profile.png",
    },
  ];

  return (
    <div className="min-h-screen bg-[#1b0f0b] px-6 py-10 text-amber-50 [background-image:linear-gradient(90deg,rgba(59,34,23,0.95)_0%,rgba(59,34,23,0.95)_16%,rgba(77,45,30,0.95)_16%,rgba(77,45,30,0.95)_33%,rgba(52,30,20,0.95)_33%,rgba(52,30,20,0.95)_50%,rgba(74,43,29,0.95)_50%,rgba(74,43,29,0.95)_66%,rgba(56,33,22,0.95)_66%,rgba(56,33,22,0.95)_83%,rgba(70,41,27,0.95)_83%,rgba(70,41,27,0.95)_100%),linear-gradient(180deg,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.08)_8%,rgba(0,0,0,0.2)_16%,rgba(0,0,0,0.08)_24%,rgba(0,0,0,0.2)_32%,rgba(0,0,0,0.08)_40%,rgba(0,0,0,0.2)_48%,rgba(0,0,0,0.08)_56%,rgba(0,0,0,0.2)_64%,rgba(0,0,0,0.08)_72%,rgba(0,0,0,0.2)_80%,rgba(0,0,0,0.08)_88%,rgba(0,0,0,0.2)_100%)] [background-size:420px_100%,100%_22px]">
      <main className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-amber-800/60 bg-[#2a1812]/90 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] lg:col-span-3">
          <h2 className="text-lg font-semibold tracking-wide text-amber-300">
            ESTADISTICAS
          </h2>
          <div className="border-t border-amber-900/70" />
          <StatsPanel
            key={`${character?.stat_points_remaining ?? 0}-${character?.str ?? 0}-${character?.dex ?? 0}-${character?.int ?? 0}-${character?.wis ?? 0}`}
            stats={stats}
            statPointsRemaining={character?.stat_points_remaining ?? 0}
            onConfirm={confirmStatAllocation}
          />

          <div className="mt-5 border-t border-amber-900/70" />
          <h3 className="mt-4 text-sm font-semibold uppercase tracking-wider text-amber-300">
          
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {derivedStats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-2 rounded-md border border-amber-900/60 bg-[#1f120e]/90 px-3 py-2"
              >
                <Image
                  src={stat.icon}
                  alt={stat.label}
                  width={22}
                  height={22}
                  className="h-[22px] w-[22px] rounded-sm object-cover"
                />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-amber-200/70">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-base font-bold leading-none text-amber-100">
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-amber-800/60 bg-[#2a1812]/90 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] lg:col-span-5">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-amber-200">{characterName}</h1>
            <p className="mt-2 text-amber-100/80">
              Nivel <span className="font-semibold">{level}</span> - Clase{" "}
              <span className="font-semibold">{className}</span>
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center rounded-xl border border-amber-900/60 bg-[#1f120e]/90 p-4">
            <Image
              src="/img/resources/logos/logo_latia_rpg.png"
              alt="Avatar del personaje"
              width={420}
              height={420}
              className="h-auto max-h-[420px] w-auto"
              priority
            />
          </div>
        </section>

        <section className="rounded-xl border border-amber-800/60 bg-[#2a1812]/90 p-6 shadow-[0_0_30px_rgba(0,0,0,0.35)] lg:col-span-4">
          <h2 className="text-lg font-semibold tracking-wide text-amber-300">
            Hechizos disponibles
          </h2>
          <p className="mt-1 text-sm text-amber-100/70">
            Lista temporal de hechizos de ejemplo
          </p>

          <div className="mt-4 space-y-3">
            {spellBook.map((spell) => (
              <article
                key={spell.name}
                className="rounded-lg border border-amber-900/60 bg-[#1f120e]/90 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-amber-100">{spell.name}</h3>
                  <span className="rounded-full bg-amber-950/70 px-2 py-1 text-xs text-amber-100">
                    {spell.cost}
                  </span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wider text-amber-300">
                  {spell.type}
                </p>
                <p className="mt-2 text-sm text-amber-50/85">{spell.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
