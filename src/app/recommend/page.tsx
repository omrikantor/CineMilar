import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { RecommendForm } from "./RecommendForm";

export default async function RecommendPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 p-6">
      <Nav />
      <div>
        <h1 className="text-2xl font-semibold">What did you love?</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Pick a movie or series and tell us why - we&apos;ll find your next watch.
        </p>
      </div>
      <RecommendForm />
    </main>
  );
}
