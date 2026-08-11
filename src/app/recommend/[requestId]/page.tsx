import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { Nav } from "@/components/Nav";
import { RateButtons } from "../RateButtons";
import type { Recommendation, RecommendationRequest } from "@/types/database";

export default async function RecommendationResultsPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const supabase = await createClient();

  // RLS means a request that doesn't exist and a request that belongs to
  // someone else look identical here (both come back null) — that's
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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Nav />

      <div>
        <Link href="/recommend" className="text-sm underline">
          ← New search
        </Link>
        <p className="mt-2 text-sm text-gray-500">Because you liked</p>
        <h1 className="text-2xl font-semibold">{request.source_title}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(recommendations ?? []).map((rec) => {
          const posterUrl = tmdbPosterUrl(rec.poster_path, "w500");
          return (
            <div key={rec.id} className="flex gap-3 rounded border p-3">
              {posterUrl && (
                <Image
                  src={posterUrl}
                  alt={rec.title}
                  width={80}
                  height={120}
                  className="h-fit rounded"
                />
              )}
              <div>
                <h2 className="font-medium">{rec.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{rec.ai_explanation}</p>
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
            </div>
          );
        })}
      </div>
    </main>
  );
}
