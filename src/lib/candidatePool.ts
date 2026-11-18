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
  sourceTmdbId,
  maxCandidates,
  minSimilar,
}: {
  similar: TmdbSearchResult[];
  discovered: TmdbSearchResult[];
  sourceTmdbId: number;
  maxCandidates: number;
  minSimilar: number;
}): PoolCandidate[] {
  const usableDiscovered = discovered.filter((c) => c.tmdbId !== sourceTmdbId);
  const similarSlots = Math.max(minSimilar, maxCandidates - usableDiscovered.length);

  const merged = mergeCandidatePools<PoolCandidate>(
    [
      usableDiscovered.map((c) => ({ ...c, fromDescription: true })),
      similar.slice(0, similarSlots).map((c) => ({ ...c, fromDescription: false })),
    ],
    sourceTmdbId
  );

  return merged.slice(0, maxCandidates);
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
