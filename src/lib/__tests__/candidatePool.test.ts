import { describe, it, expect } from "vitest";
import {
  mergeCandidatePools,
  buildCandidatePool,
  parseTitleSuggestion,
  pickMatchingResult,
  filterValidPicks,
} from "@/lib/candidatePool";
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

describe("buildCandidatePool", () => {
  const ids = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => makeResult(from + i));

  it("gives description-based titles most of the slots, keeping only a minimum of generic similar ones", () => {
    const pool = buildCandidatePool({
      similar: ids(1, 10),
      discovered: ids(101, 13),
      sourceTmdbId: -1,
      maxCandidates: 18,
      minSimilar: 5,
    });

    expect(pool).toHaveLength(18);
    expect(pool.filter((c) => c.fromDescription)).toHaveLength(13);
    expect(pool.filter((c) => !c.fromDescription)).toHaveLength(5);
  });

  it("backfills with similar titles when the description-based search finds little", () => {
    const pool = buildCandidatePool({
      similar: ids(1, 10),
      discovered: ids(101, 3),
      sourceTmdbId: -1,
      maxCandidates: 18,
      minSimilar: 5,
    });

    expect(pool.filter((c) => c.fromDescription)).toHaveLength(3);
    expect(pool.filter((c) => !c.fromDescription)).toHaveLength(10);
  });

  it("falls back to only similar titles when nothing was discovered", () => {
    const pool = buildCandidatePool({
      similar: ids(1, 10),
      discovered: [],
      sourceTmdbId: -1,
      maxCandidates: 18,
      minSimilar: 5,
    });

    expect(pool).toHaveLength(10);
    expect(pool.every((c) => !c.fromDescription)).toBe(true);
  });

  it("excludes the source title and lets the description-based copy win a duplicate", () => {
    const pool = buildCandidatePool({
      similar: [makeResult(1), makeResult(7)],
      discovered: [makeResult(7), makeResult(2)],
      sourceTmdbId: 1,
      maxCandidates: 18,
      minSimilar: 5,
    });

    expect(pool.map((c) => c.tmdbId).sort()).toEqual([2, 7]);
    expect(pool.find((c) => c.tmdbId === 7)?.fromDescription).toBe(true);
  });

  it("includes AI-suggested titles as description-based candidates, ahead of generic similar ones", () => {
    const pool = buildCandidatePool({
      similar: ids(1, 10),
      discovered: ids(101, 12),
      suggested: ids(201, 6),
      sourceTmdbId: -1,
      maxCandidates: 18,
      minSimilar: 3,
    });

    expect(pool).toHaveLength(18);
    expect(pool.filter((c) => c.tmdbId >= 201 && c.tmdbId < 300)).toHaveLength(6);
    expect(pool.filter((c) => !c.fromDescription)).toHaveLength(3);
    expect(pool.filter((c) => c.fromDescription)).toHaveLength(15);
  });

  it("works unchanged when no suggestions are provided", () => {
    const pool = buildCandidatePool({
      similar: ids(1, 10),
      discovered: ids(101, 13),
      sourceTmdbId: -1,
      maxCandidates: 18,
      minSimilar: 5,
    });

    expect(pool).toHaveLength(18);
  });

  it("never returns more than maxCandidates", () => {
    const pool = buildCandidatePool({
      similar: ids(1, 10),
      discovered: ids(101, 20),
      sourceTmdbId: -1,
      maxCandidates: 18,
      minSimilar: 5,
    });

    expect(pool).toHaveLength(18);
  });
});

describe("parseTitleSuggestion", () => {
  it("splits a trailing (Year)", () => {
    expect(parseTitleSuggestion("Arrival (2016)")).toEqual({ title: "Arrival", year: "2016" });
  });

  it("accepts a title with no year", () => {
    expect(parseTitleSuggestion("  Contact ")).toEqual({ title: "Contact", year: null });
  });

  it("keeps parentheses that aren't a year", () => {
    expect(parseTitleSuggestion("Evangelion (Rebuild)")).toEqual({
      title: "Evangelion (Rebuild)",
      year: null,
    });
  });

  it("rejects empty input", () => {
    expect(parseTitleSuggestion("   ")).toBeNull();
    expect(parseTitleSuggestion("(2016)")).toBeNull();
  });
});

describe("pickMatchingResult", () => {
  const withYear = (tmdbId: number, title: string, year: string | null): TmdbSearchResult => ({
    ...makeResult(tmdbId, title),
    year,
  });

  it("returns the result whose title matches, ignoring case and punctuation", () => {
    const results = [withYear(1, "Something Else", "2000"), withYear(2, "Mad Max: Fury Road", "2015")];
    const picked = pickMatchingResult(results, { title: "mad max fury road", year: null });
    expect(picked?.tmdbId).toBe(2);
  });

  it("rejects a fuzzy TMDB hit that isn't the suggested title (hallucination guard)", () => {
    const results = [withYear(1, "Stellar Journey of Doom", "2011")];
    expect(pickMatchingResult(results, { title: "Stellar Odyssey", year: "2014" })).toBeNull();
  });

  it("prefers the remake closest to the suggested year", () => {
    const results = [withYear(1, "Solaris", "1972"), withYear(2, "Solaris", "2002")];
    expect(pickMatchingResult(results, { title: "Solaris", year: "2002" })?.tmdbId).toBe(2);
    expect(pickMatchingResult(results, { title: "Solaris", year: "1972" })?.tmdbId).toBe(1);
  });

  it("still accepts an exact-name match when the suggested year is off", () => {
    const results = [withYear(1, "Moon", "2009")];
    expect(pickMatchingResult(results, { title: "Moon", year: "2012" })?.tmdbId).toBe(1);
  });

  it("returns null when there are no results", () => {
    expect(pickMatchingResult([], { title: "Moon", year: null })).toBeNull();
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
