import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/PageShell";
import { RecommendForm } from "./RecommendForm";

export const metadata: Metadata = {
  title: "Discover",
};

export default async function RecommendPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <PageShell width="narrow">
      <div className="animate-fade-up">
        <p className="eyebrow">Discover</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          What did you love?
        </h1>
        <p className="mt-3 mb-8 max-w-lg text-muted">
          Pick a movie or series and tell us why - we&apos;ll find your next watch.
        </p>
        <RecommendForm />
      </div>
    </PageShell>
  );
}
