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
export function mergeCandidatePools(
  pools: TmdbSearchResult[][],
  excludeTmdbId: number
): TmdbSearchResult[] {
  const seen = new Set<number>([excludeTmdbId]);
  const merged: TmdbSearchResult[] = [];
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
