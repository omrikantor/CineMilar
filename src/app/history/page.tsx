import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageShell, PageHeader } from "@/components/PageShell";
import { Pagination } from "@/components/Pagination";
import {
  ChevronRightIcon,
  ClockIcon,
  FilmIcon,
  SparklesIcon,
  TvIcon,
} from "@/components/Icons";
import type { RecommendationRequest } from "@/types/database";

export const metadata: Metadata = {
  title: "History",
};

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
    <PageShell width="narrow">
      <PageHeader
        title="History"
        description="Every search you've made, newest first."
      />

      {(!requests || requests.length === 0) && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong px-6 py-16 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <ClockIcon className="h-6 w-6" />
          </span>
          <p className="text-lg font-semibold">No searches yet</p>
          <p className="max-w-xs text-sm text-muted">
            Your searches will appear here once you&apos;ve found your next watch.
          </p>
          <Link href="/recommend" className="btn-primary mt-2">
            <SparklesIcon /> Find something to watch
          </Link>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {(requests ?? []).map((r) => (
          <li key={r.id}>
            <Link
              href={`/recommend/${r.id}`}
              className="card card-interactive group flex items-center gap-4 p-4"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                {r.source_media_type === "movie" ? <FilmIcon /> : <TvIcon />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.source_title}</p>
                {r.reasoning && (
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted">
                    &ldquo;{r.reasoning}&rdquo;
                  </p>
                )}
                <p className="mt-1.5 flex items-center gap-2 text-xs text-muted">
                  <span className="badge">
                    {r.source_media_type === "movie" ? "Movie" : "TV Series"}
                  </span>
                  {new Date(r.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
            </Link>
          </li>
        ))}
      </ul>

      <Pagination basePath="/history" page={page} totalPages={totalPages} />
    </PageShell>
  );
}
