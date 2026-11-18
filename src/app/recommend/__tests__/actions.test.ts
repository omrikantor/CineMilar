import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/tmdb", () => ({
  getTitleDetails: vi.fn(),
  getSimilarTitles: vi.fn(),
  discoverTitles: vi.fn(),
  resolveSuggestedTitles: vi.fn(),
  genreNamesForMediaType: vi.fn(() => []),
}));
vi.mock("@/lib/ai", () => ({
  extractTasteSignals: vi.fn(),
  rankCandidates: vi.fn(),
}));

import { createRecommendationRequest } from "../actions";
import { createClient } from "@/lib/supabase/server";
import {
  getTitleDetails,
  getSimilarTitles,
  discoverTitles,
  resolveSuggestedTitles,
} from "@/lib/tmdb";
import { extractTasteSignals, rankCandidates } from "@/lib/ai";

function makeFormData(
  overrides: Partial<Record<"tmdbId" | "mediaType" | "title" | "reasoning", string>> = {}
) {
  const fd = new FormData();
  fd.set("tmdbId", overrides.tmdbId ?? "603");
  fd.set("mediaType", overrides.mediaType ?? "movie");
  fd.set("title", overrides.title ?? "The Matrix");
  fd.set("reasoning", overrides.reasoning ?? "Loved the premise.");
  return fd;
}

function makeSupabaseClient(userId: string | null = "user-1") {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
    },
    // Neither the empty-pool nor the failure path in createRecommendationRequest
    // reaches a database write, so `from` should never be called in those tests -
    // leaving it unimplemented turns an incorrect assumption into a loud failure.
    from: vi.fn(() => {
      throw new Error("supabase.from() was called but no query builder mock was provided");
    }),
  };
}

describe("createRecommendationRequest", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(getTitleDetails).mockReset();
    vi.mocked(getSimilarTitles).mockReset();
    vi.mocked(discoverTitles).mockReset();
    vi.mocked(resolveSuggestedTitles).mockReset();
    vi.mocked(extractTasteSignals).mockReset();
    vi.mocked(rankCandidates).mockReset();
  });

  it("requires an authenticated user", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseClient(null) as never);

    const result = await createRecommendationRequest({}, makeFormData());

    expect(result).toEqual({ error: "You must be logged in." });
    expect(getTitleDetails).not.toHaveBeenCalled();
  });

  it("returns the validation error without calling any external APIs when the form is invalid", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseClient() as never);

    const result = await createRecommendationRequest({}, makeFormData({ reasoning: "" }));

    expect(result.error).toBeTruthy();
    expect(getTitleDetails).not.toHaveBeenCalled();
  });

  it("returns a friendly error when TMDB has no similar or discoverable candidates", async () => {
    vi.mocked(createClient).mockResolvedValue(makeSupabaseClient() as never);
    vi.mocked(getTitleDetails).mockResolvedValue({
      tmdbId: 603,
      title: "The Matrix",
      mediaType: "movie",
      year: "1999",
      posterPath: null,
      overview: "",
      genres: [],
    });
    vi.mocked(getSimilarTitles).mockResolvedValue([]);
    vi.mocked(discoverTitles).mockResolvedValue([]);
    vi.mocked(resolveSuggestedTitles).mockResolvedValue([]);
    vi.mocked(extractTasteSignals).mockResolvedValue({
      genres: [],
      keywords: [],
      titles: [],
    });

    const result = await createRecommendationRequest({}, makeFormData());

    expect(result).toEqual({
      error: "Couldn't find similar titles for that pick - try another.",
    });
    expect(rankCandidates).not.toHaveBeenCalled();
  });

  it("returns a generic error and logs details server-side when TMDB/AI calls fail", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createClient).mockResolvedValue(makeSupabaseClient() as never);
    vi.mocked(getTitleDetails).mockRejectedValue(
      new Error("TMDB request failed (503) for /movie/603")
    );

    const result = await createRecommendationRequest({}, makeFormData());

    expect(result).toEqual({
      error: "Something went wrong generating recommendations. Please try again.",
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
