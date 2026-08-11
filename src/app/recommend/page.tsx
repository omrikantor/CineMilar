import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

export default async function RecommendPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Welcome, {user.email}</h1>
      <p className="text-sm text-gray-600">
        This is a placeholder for the recommendation flow — built in the next
        step.
      </p>
      <form action={logout}>
        <button type="submit" className="text-sm underline">
          Log out
        </button>
      </form>
    </main>
  );
}
