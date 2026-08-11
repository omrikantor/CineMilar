"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getTitleDetails,
  getSimilarTitles,
  discoverTitles,
  genreNamesForMediaType,
  type TmdbSearchResult,
} from "@/lib/tmdb";
import { extractTasteSignals, rankCandidates } from "@/lib/gemini";
import type { MediaType } from "@/types/database";

export type RateRecommendationInput = {
  sourceTmdbId: number;
  sourceMediaType: MediaType;
  candidateTmdbId: number;
  candidateMediaType: MediaType;
  candidateTitle: string;
  candidatePosterPath: string | null;
  rating: 1 | -1;
};

export async function rateRecommendation(
  input: RateRecommendationInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }
  if (input.rating !== 1 && input.rating !== -1) {
    return { error: "Invalid rating." };
  }
  if (!input.sourceTmdbId || !input.candidateTmdbId || !input.candidateTitle) {
    return { error: "Invalid recommendation." };
  }

  const { error } = await supabase.from("recommendation_feedback").upsert(
    {
      user_id: user.id,
      source_tmdb_id: input.sourceTmdbId,
      source_media_type: input.sourceMediaType,
      candidate_tmdb_id: input.candidateTmdbId,
      candidate_media_type: input.candidateMediaType,
      candidate_title: input.candidateTitle,
      candidate_poster_path: input.candidatePosterPath,
      rating: input.rating,
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

const MAX_CANDIDATES = 25;
const MAX_PICKS = 6;

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

  const tmdbId = Number(formData.get("tmdbId"));
  const mediaType = formData.get("mediaType");
  const sourceTitle = String(formData.get("title") ?? "");
  const reasoning = String(formData.get("reasoning") ?? "").trim();

  if (!tmdbId || (mediaType !== "movie" && mediaType !== "tv")) {
    return { error: "Please select a title from the search results." };
  }
  if (!reasoning) {
    return { error: "Please describe what you liked about it." };
  }
  if (reasoning.length > 1000) {
    return { error: "That's a bit long — please keep it under 1000 characters." };
  }

  let requestId: string;

  try {
    const type = mediaType as MediaType;

    const [sourceDetails, similarPool] = await Promise.all([
      getTitleDetails(tmdbId, type),
      getSimilarTitles(tmdbId, type, 20),
    ]);

    // Broaden the pool using what the user actually said they liked, not
    // just titles generically similar to the source.
    const taste = await extractTasteSignals(reasoning, genreNamesForMediaType(type));
    const discoveredPool = await discoverTitles(
      type,
      { genreNames: taste.genres, keywordTerms: taste.keywords },
      15
    );

    const merged = new Map<number, TmdbSearchResult>();
    for (const item of [...similarPool, ...discoveredPool]) {
      if (item.tmdbId !== tmdbId) {
        merged.set(item.tmdbId, item);
      }
    }
    const candidatePool = Array.from(merged.values()).slice(0, MAX_CANDIDATES);

    if (candidatePool.length === 0) {
      return { error: "Couldn't find similar titles for that pick — try another." };
    }

    const picks = await rankCandidates({
      sourceTitle: sourceDetails.title,
      sourceYear: sourceDetails.year,
      sourceOverview: sourceDetails.overview,
      reasoning,
      candidates: candidatePool.map((c) => ({
        tmdbId: c.tmdbId,
        title: c.title,
        year: c.year,
        overview: c.overview,
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
        source_title: sourceTitle,
        reasoning,
      })
      .select("id")
      .single();

    if (requestError || !requestRow) {
      throw new Error(requestError?.message ?? "Failed to save request");
    }
    requestId = requestRow.id;

    const recommendationRows = picks.map((pick, index) => {
      const candidate = merged.get(pick.tmdbId)!;
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
