import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { PageShell } from "@/components/PageShell";
import { Poster } from "@/components/Poster";
import { ArrowLeftIcon, SparklesIcon } from "@/components/Icons";
import { RateButtons } from "../RateButtons";
import type { Recommendation, RecommendationRequest } from "@/types/database";

export const metadata: Metadata = {
  title: "Your recommendations",
};

export default async function RecommendationResultsPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const supabase = await createClient();

  // RLS means a request that doesn't exist and a request that belongs to
  // someone else look identical here (both come back null) - that's
  // deliberate: we never reveal whether another user's data exists.
  const { data: request } = await supabase
    .from("recommendation_requests")
    .select("*")
    .eq("id", requestId)
    .single<RecommendationRequest>();

  if (!request) {
    notFound();
  }

  const { data: recommendations } = await supabase
    .from("recommendations")
    .select("*")
    .eq("request_id", requestId)
    .order("rank_position", { ascending: true })
    .returns<Recommendation[]>();

  const candidateIds = (recommendations ?? []).map((r) => r.tmdb_id);
  const { data: feedbackRows } = await supabase
    .from("recommendation_feedback")
    .select("candidate_tmdb_id, rating")
    .eq("source_tmdb_id", request.source_tmdb_id)
    .in("candidate_tmdb_id", candidateIds.length > 0 ? candidateIds : [-1]);

  const ratingByCandidateId = new Map<number, 1 | -1>(
    (feedbackRows ?? []).map((f) => [f.candidate_tmdb_id, f.rating])
  );

  return (
    <PageShell>
      <Link href="/recommend" className="btn-ghost -ml-2.5">
        <ArrowLeftIcon /> New search
      </Link>

      <div className="animate-fade-up mt-6 mb-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="eyebrow">Because you liked</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            {request.source_title}
          </h1>
        </div>
        {request.reasoning && (
          <figure className="card max-w-md border-l-4 border-l-accent py-4">
            <figcaption className="text-xs font-semibold tracking-wide text-muted uppercase">
              What you said
            </figcaption>
            <blockquote className="mt-1.5 line-clamp-4 text-sm leading-relaxed">
              &ldquo;{request.reasoning}&rdquo;
            </blockquote>
          </figure>
        )}
      </div>

      <ol className="grid gap-5 md:grid-cols-2">
        {(recommendations ?? []).map((rec, index) => {
          const posterUrl = tmdbPosterUrl(rec.poster_path, "w500");
          return (
            <li
              key={rec.id}
              className="card card-interactive animate-fade-up flex gap-4 p-4"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="relative">
                <Poster
                  url={posterUrl}
                  alt={rec.title}
                  className="h-36 w-24 sm:h-[168px] sm:w-28"
                  sizes="112px"
                />
                <span className="bg-brand-gradient absolute -top-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-accent-foreground shadow-md ring-2 ring-surface">
                  {rec.rank_position}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg leading-snug font-semibold">{rec.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {rec.ai_explanation}
                </p>
                <RateButtons
                  sourceTmdbId={request.source_tmdb_id}
                  sourceMediaType={request.source_media_type}
                  candidateTmdbId={rec.tmdb_id}
                  candidateMediaType={rec.media_type}
                  candidateTitle={rec.title}
                  candidatePosterPath={rec.poster_path}
                  initialRating={ratingByCandidateId.get(rec.tmdb_id) ?? null}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong p-8 text-center">
        <p className="font-medium">Not quite right?</p>
        <p className="max-w-sm text-sm text-muted">
          Try again with a different title, or describe what you liked in more
          detail.
        </p>
        <Link href="/recommend" className="btn-secondary mt-1">
          <SparklesIcon /> Start a new search
        </Link>
      </div>
    </PageShell>
  );
}
