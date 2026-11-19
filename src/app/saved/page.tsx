import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { PageShell, PageHeader } from "@/components/PageShell";
import { Pagination } from "@/components/Pagination";
import { Poster } from "@/components/Poster";
import { ExternalLinkIcon, HeartIcon, SparklesIcon } from "@/components/Icons";
import type { RecommendationFeedback } from "@/types/database";

export const metadata: Metadata = {
  title: "Saved",
};

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
    <PageShell>
      <PageHeader
        title="Saved"
        description="Everything you've liked, ready for movie night."
      />

      {(!saved || saved.length === 0) && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong px-6 py-16 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <HeartIcon className="h-6 w-6" />
          </span>
          <p className="text-lg font-semibold">Nothing saved yet</p>
          <p className="max-w-xs text-sm text-muted">
            Like a recommendation and it will be saved here for later.
          </p>
          <Link href="/recommend" className="btn-primary mt-2">
            <SparklesIcon /> Get recommendations
          </Link>
        </div>
      )}

      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {(saved ?? []).map((item) => {
          const posterUrl = tmdbPosterUrl(item.candidate_poster_path, "w500");
          const tmdbUrl = `https://www.themoviedb.org/${item.candidate_media_type}/${item.candidate_tmdb_id}`;
          return (
            <li key={item.id}>
              <a
                href={tmdbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <div className="relative">
                  <Poster
                    url={posterUrl}
                    alt=""
                    className="aspect-[2/3] w-full shadow-card transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lift"
                    sizes="(min-width: 1024px) 240px, (min-width: 640px) 30vw, 45vw"
                  />
                  <span className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-snug font-semibold group-hover:text-accent">
                  {item.candidate_title}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {item.candidate_media_type === "movie" ? "Movie" : "TV Series"}
                </p>
              </a>
            </li>
          );
        })}
      </ul>

      <Pagination basePath="/saved" page={page} totalPages={totalPages} />
    </PageShell>
  );
}
