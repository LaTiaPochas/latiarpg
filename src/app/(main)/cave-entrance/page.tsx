import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CaveEntranceShell } from "./cave-entrance-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Entrada a la cueva",
};

export default async function CaveEntrancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <CaveEntranceShell />;
}
