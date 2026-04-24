import { IntroStory } from "@/components/intro/intro-story";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function IntroduccionPage() {
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
    .select("intro_completed, tutorial_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  if (milestones?.intro_completed && milestones?.tutorial_completed) {
    redirect("/");
  }

  if (milestones?.intro_completed && !milestones?.tutorial_completed) {
    redirect("/fin-tutorial");
  }

  async function completeIntro() {
    "use server";

    const supabaseClient = await createClient();
    const {
      data: { user: currentUser },
    } = await supabaseClient.auth.getUser();

    if (!currentUser) {
      redirect("/login");
    }

    await supabaseClient
      .from("user_milestones")
      .update({ intro_completed: true })
      .eq("user_id", currentUser.id);

    redirect("/");
  }

  return <IntroStory completeIntro={completeIntro} />;
}
