import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import type { RecommendationRequest } from "@/types/database";

const PAGE_SIZE = 10;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: requests, count } = await supabase
    .from("recommendation_requests")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<RecommendationRequest[]>();

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Nav />
      <div>
        <Link href="/recommend" className="btn-ghost">
          ← New search
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">History</h1>
      </div>

      {(!requests || requests.length === 0) && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No searches yet — go find your next watch.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {(requests ?? []).map((r) => (
          <li key={r.id} className="card">
            <Link href={`/recommend/${r.id}`} className="font-medium hover:underline">
              {r.source_title}
            </Link>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              {r.source_media_type === "movie" ? "🎬 Movie" : "📺 TV Series"} ·{" "}
              {new Date(r.created_at).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/history?page=${page - 1}`} className="btn-ghost">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span style={{ color: "var(--muted)" }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/history?page=${page + 1}`} className="btn-ghost">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </main>
  );
}
