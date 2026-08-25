import { describe, it, expect } from "vitest";
import { mergeCandidatePools, filterValidPicks } from "@/lib/candidatePool";
import type { TmdbSearchResult } from "@/lib/tmdb";

function makeResult(tmdbId: number, title = `Title ${tmdbId}`): TmdbSearchResult {
  return {
    tmdbId,
    title,
    mediaType: "movie",
    year: "2020",
    posterPath: null,
    overview: "",
  };
}

describe("mergeCandidatePools", () => {
  it("deduplicates items appearing in multiple pools", () => {
    const poolA = [makeResult(1), makeResult(2)];
    const poolB = [makeResult(2), makeResult(3)];

    const merged = mergeCandidatePools([poolA, poolB], -1);

    expect(merged).toHaveLength(3);
    expect(merged.map((m) => m.tmdbId).sort()).toEqual([1, 2, 3]);
  });

  it("excludes the source title itself", () => {
    const merged = mergeCandidatePools([[makeResult(1), makeResult(2)]], 2);
    expect(merged.map((m) => m.tmdbId)).toEqual([1]);
  });

  it("returns an empty array when given no pools", () => {
    expect(mergeCandidatePools([], 1)).toEqual([]);
  });

  it("interleaves pools round-robin instead of letting the first pool dominate", () => {
    const bigPool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => makeResult(id));
    const smallPool = [101, 102, 103].map((id) => makeResult(id));

    const merged = mergeCandidatePools([bigPool, smallPool], -1);

    // If capped at 6 (as a caller might), a fair interleave keeps candidates
    // from both pools instead of the first pool crowding out the second.
    const capped = merged.slice(0, 6).map((m) => m.tmdbId);
    expect(capped).toEqual([1, 101, 2, 102, 3, 103]);
  });
});

describe("filterValidPicks", () => {
  it("keeps only picks whose id is in the valid list", () => {
    const picks = [
      { tmdbId: 1, explanation: "a" },
      { tmdbId: 999, explanation: "hallucinated" },
      { tmdbId: 2, explanation: "b" },
    ];

    const result = filterValidPicks(picks, [1, 2, 3], 10);

    expect(result.map((p) => p.tmdbId)).toEqual([1, 2]);
  });

  it("caps the result at maxPicks", () => {
    const picks = [1, 2, 3, 4].map((id) => ({ tmdbId: id, explanation: "x" }));
    const result = filterValidPicks(picks, [1, 2, 3, 4], 2);
    expect(result).toHaveLength(2);
  });

  it("returns an empty array when nothing matches", () => {
    const picks = [{ tmdbId: 999, explanation: "hallucinated" }];
    expect(filterValidPicks(picks, [1, 2], 10)).toEqual([]);
  });
});
