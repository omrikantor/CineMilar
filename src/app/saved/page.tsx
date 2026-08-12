import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { Nav } from "@/components/Nav";
import type { RecommendationFeedback } from "@/types/database";

const PAGE_SIZE = 12;

export default async function SavedPage({
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

  const { data: saved, count } = await supabase
    .from("recommendation_feedback")
    .select("*", { count: "exact" })
    .eq("rating", 1)
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<RecommendationFeedback[]>();

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Nav />
      <div>
        <Link href="/recommend" className="btn-ghost">
          ← New search
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Saved</h1>
      </div>

      {(!saved || saved.length === 0) && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Nothing saved yet — like a recommendation to see it here.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(saved ?? []).map((item) => {
          const posterUrl = tmdbPosterUrl(item.candidate_poster_path, "w200");
          const tmdbUrl = `https://www.themoviedb.org/${item.candidate_media_type}/${item.candidate_tmdb_id}`;
          return (
            <a
              key={item.id}
              href={tmdbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="card flex gap-3 transition-colors hover:bg-black/5"
            >
              {posterUrl ? (
                <Image
                  src={posterUrl}
                  alt={item.candidate_title}
                  width={60}
                  height={90}
                  className="h-[90px] w-[60px] shrink-0 rounded-lg"
                />
              ) : (
                <div
                  className="h-[90px] w-[60px] shrink-0 rounded-lg"
                  style={{ backgroundColor: "var(--border)" }}
                />
              )}
              <div>
                <h2 className="font-medium">{item.candidate_title}</h2>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {item.candidate_media_type === "movie" ? "🎬 Movie" : "📺 TV Series"}
                </p>
              </div>
            </a>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/saved?page=${page - 1}`} className="btn-ghost">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span style={{ color: "var(--muted)" }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/saved?page=${page + 1}`} className="btn-ghost">
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
