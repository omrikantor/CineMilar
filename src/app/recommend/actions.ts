"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getTitleDetails,
  getSimilarTitles,
  discoverTitles,
  genreNamesForMediaType,
} from "@/lib/tmdb";
import { extractTasteSignals, rankCandidates } from "@/lib/ai";
import { mergeCandidatePools } from "@/lib/candidatePool";
import {
  parseRecommendationRequestForm,
  ratingSchema,
  firstIssueMessage,
  type RatingInput,
} from "@/lib/validation";

export async function rateRecommendation(
  input: RatingInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const parsed = ratingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }
  const data = parsed.data;

  const { error } = await supabase.from("recommendation_feedback").upsert(
    {
      user_id: user.id,
      source_tmdb_id: data.sourceTmdbId,
      source_media_type: data.sourceMediaType,
      candidate_tmdb_id: data.candidateTmdbId,
      candidate_media_type: data.candidateMediaType,
      candidate_title: data.candidateTitle,
      candidate_poster_path: data.candidatePosterPath,
      rating: data.rating,
    },
    { onConflict: "user_id,source_tmdb_id,candidate_tmdb_id" }
  );

  if (error) {
    return { error: "Couldn't save your rating, please try again." };
  }

  return {};
}

export type CreateRequestState = {
  error?: string;
};

// Kept deliberately small: Groq's free tier caps this model at 8,000
// tokens/minute, and each candidate's overview adds real prompt tokens to
// the ranking call — a smaller, trimmed pool keeps every request well
// within that budget instead of relying on retries to paper over it.
const MAX_CANDIDATES = 14;
const MAX_PICKS = 6;
const MAX_OVERVIEW_CHARS = 220;

function truncateOverview(overview: string): string {
  return overview.length > MAX_OVERVIEW_CHARS
    ? `${overview.slice(0, MAX_OVERVIEW_CHARS)}...`
    : overview;
}

export async function createRecommendationRequest(
  _prevState: CreateRequestState,
  formData: FormData
): Promise<CreateRequestState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const parsed = parseRecommendationRequestForm(formData);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }
  // `title` is validated (non-empty = a real selection was made) but
  // intentionally not used for storage — see the trusted TMDB lookup below.
  const { tmdbId, mediaType: type, reasoning } = parsed.data;

  let requestId: string;

  try {
    const [sourceDetails, similarPool] = await Promise.all([
      getTitleDetails(tmdbId, type),
      getSimilarTitles(tmdbId, type, 10),
    ]);

    // Broaden the pool using what the user actually said they liked, not
    // just titles generically similar to the source.
    const taste = await extractTasteSignals(reasoning, genreNamesForMediaType(type));
    const discoveredPool = await discoverTitles(
      type,
      { genreNames: taste.genres, keywordTerms: taste.keywords },
      8
    );

    const candidatePool = mergeCandidatePools(
      [similarPool, discoveredPool],
      tmdbId
    ).slice(0, MAX_CANDIDATES);
    const candidateById = new Map(candidatePool.map((c) => [c.tmdbId, c]));

    if (candidatePool.length === 0) {
      return { error: "Couldn't find similar titles for that pick — try another." };
    }

    const picks = await rankCandidates({
      sourceTitle: sourceDetails.title,
      sourceYear: sourceDetails.year,
      sourceOverview: truncateOverview(sourceDetails.overview),
      reasoning,
      candidates: candidatePool.map((c) => ({
        tmdbId: c.tmdbId,
        title: c.title,
        year: c.year,
        overview: truncateOverview(c.overview),
      })),
      maxPicks: MAX_PICKS,
    });

    if (picks.length === 0) {
      return { error: "Couldn't generate recommendations, please try again." };
    }

    const { data: requestRow, error: requestError } = await supabase
      .from("recommendation_requests")
      .insert({
        user_id: user.id,
        source_tmdb_id: tmdbId,
        source_media_type: type,
        // Store the title TMDB actually returned for this id, not the raw
        // client-submitted text — the client can only choose *which* title
        // (via tmdbId), never dictate what gets stored about it.
        source_title: sourceDetails.title,
        reasoning,
      })
      .select("id")
      .single();

    if (requestError || !requestRow) {
      throw new Error(requestError?.message ?? "Failed to save request");
    }
    requestId = requestRow.id;

    const recommendationRows = picks.map((pick, index) => {
      const candidate = candidateById.get(pick.tmdbId)!;
      return {
        request_id: requestId,
        tmdb_id: candidate.tmdbId,
        media_type: candidate.mediaType,
        title: candidate.title,
        poster_path: candidate.posterPath,
        ai_explanation: pick.explanation,
        rank_position: index + 1,
      };
    });

    const { error: insertError } = await supabase
      .from("recommendations")
      .insert(recommendationRows);

    if (insertError) {
      throw new Error(insertError.message);
    }
  } catch (err) {
    console.error("createRecommendationRequest failed", err);
    return {
      error: "Something went wrong generating recommendations. Please try again.",
    };
  }

  redirect(`/recommend/${requestId}`);
}
