import type { TmdbSearchResult } from "@/lib/tmdb";
import type { RankedPick } from "@/lib/ai";

/**
 * Combines multiple TMDB result lists into one deduped pool (by tmdbId),
 * excluding the source title itself. Interleaves round-robin across pools
 * (rather than concatenating them) so that whichever pool is listed first
 * doesn't structurally crowd out the others once the combined pool gets
 * capped by the caller - each pool gets a fair share of the surviving slots
 * regardless of pool order or relative size. Pure data transform - no
 * network calls.
 */
export function mergeCandidatePools<T extends { tmdbId: number }>(
  pools: T[][],
  excludeTmdbId?: number
): T[] {
  const seen = new Set<number>(excludeTmdbId === undefined ? [] : [excludeTmdbId]);
  const merged: T[] = [];
  const maxLength = Math.max(0, ...pools.map((pool) => pool.length));

  for (let i = 0; i < maxLength; i++) {
    for (const pool of pools) {
      const item = pool[i];
      if (item && !seen.has(item.tmdbId)) {
        seen.add(item.tmdbId);
        merged.push(item);
      }
    }
  }

  return merged;
}

export type PoolCandidate = TmdbSearchResult & {
  /**
   * true  = found by searching for the themes/genres the user described.
   * false = only TMDB's generic "similar to the source title" list.
   * The ranking step is told this, so it can weigh the user's own words
   * above TMDB's generic similarity.
   */
  fromDescription: boolean;
};

/**
 * Builds the pool the AI ranks. Titles matching the user's description get
 * priority: they fill as many slots as they can, and the generic "similar"
 * titles only keep a small guaranteed minimum plus whatever slots are left
 * over (so a thin description-based search still leaves a usable pool).
 * Description-based titles are listed first so they also win any dedupe tie.
 */
export function buildCandidatePool({
  similar,
  discovered,
  suggested = [],
  sourceTmdbId,
  maxCandidates,
  minSimilar,
}: {
  similar: TmdbSearchResult[];
  discovered: TmdbSearchResult[];
  /** Titles the AI proposed for this specific reasoning, already verified to exist on TMDB. */
  suggested?: TmdbSearchResult[];
  sourceTmdbId: number;
  maxCandidates: number;
  minSimilar: number;
}): PoolCandidate[] {
  const usableSuggested = suggested.filter((c) => c.tmdbId !== sourceTmdbId);
  const usableDiscovered = discovered.filter((c) => c.tmdbId !== sourceTmdbId);
  const describedCount = new Set([
    ...usableSuggested.map((c) => c.tmdbId),
    ...usableDiscovered.map((c) => c.tmdbId),
  ]).size;
  const similarSlots = Math.max(minSimilar, maxCandidates - describedCount);

  // Round-robin across the three sources, so if the combined pool has to be
  // cut to maxCandidates no single source is squeezed out by another.
  // Suggested comes first: a title the AI picked for this exact reasoning is
  // the strongest signal, and it also wins any dedupe tie.
  const merged = mergeCandidatePools<PoolCandidate>(
    [
      usableSuggested.map((c) => ({ ...c, fromDescription: true })),
      usableDiscovered.map((c) => ({ ...c, fromDescription: true })),
      similar.slice(0, similarSlots).map((c) => ({ ...c, fromDescription: false })),
    ],
    sourceTmdbId
  );

  return merged.slice(0, maxCandidates);
}

/** Splits an AI-suggested "Title (Year)" string into its parts. The year is optional. */
export function parseTitleSuggestion(
  raw: string
): { title: string; year: string | null } | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.*?)\s*\((\d{4})\)\s*$/);
  const title = (match ? match[1] : trimmed).trim();
  if (!title) return null;
  return { title, year: match ? match[2] : null };
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Picks the TMDB search result that really is the title the AI named, or null.
 * TMDB search is fuzzy - a made-up title can still come back with an unrelated
 * result - so the result's title must match the suggestion exactly (ignoring
 * case and punctuation). That keeps a hallucinated suggestion from sneaking a
 * real-but-wrong title into the pool. When several titles share a name
 * (remakes), the one closest to the suggested year wins.
 */
export function pickMatchingResult(
  results: TmdbSearchResult[],
  suggestion: { title: string; year: string | null }
): TmdbSearchResult | null {
  const wanted = normalizeTitle(suggestion.title);
  if (!wanted) return null;

  const matches = results.filter((r) => normalizeTitle(r.title) === wanted);
  if (matches.length === 0) return null;

  if (suggestion.year) {
    const wantedYear = Number(suggestion.year);
    const closeInYear = matches.find(
      (r) => r.year !== null && Math.abs(Number(r.year) - wantedYear) <= 1
    );
    if (closeInYear) return closeInYear;
  }
  return matches[0];
}

/**
 * Defensive check applied to the AI's output: even though the prompt
 * constrains it to choose only from the given candidates, this filters out
 * any id that isn't genuinely part of the real candidate pool before it's
 * trusted (Module 9 "never trust input blindly" - applied to AI output too).
 */
export function filterValidPicks(
  picks: RankedPick[],
  validTmdbIds: number[],
  maxPicks: number
): RankedPick[] {
  const validSet = new Set(validTmdbIds);
  return picks.filter((p) => validSet.has(p.tmdbId)).slice(0, maxPicks);
}
