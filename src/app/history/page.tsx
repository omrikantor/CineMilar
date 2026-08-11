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
      <h1 className="text-2xl font-semibold">History</h1>

      {(!requests || requests.length === 0) && (
        <p className="text-sm text-gray-600">
          No searches yet — go find your next watch.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {(requests ?? []).map((r) => (
          <li key={r.id} className="rounded border p-3">
            <Link href={`/recommend/${r.id}`} className="font-medium underline">
              {r.source_title}
            </Link>
            <p className="text-xs text-gray-500">
              {r.source_media_type === "movie" ? "Movie" : "TV Series"} ·{" "}
              {new Date(r.created_at).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/history?page=${page - 1}`} className="underline">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/history?page=${page + 1}`} className="underline">
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
