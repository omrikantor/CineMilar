import type { TmdbSearchResult } from "@/lib/tmdb";
import type { RankedPick } from "@/lib/ai";

/**
 * Combines multiple TMDB result lists into one deduped pool (by tmdbId),
 * excluding the source title itself. Pure data transform — no network calls.
 */
export function mergeCandidatePools(
  pools: TmdbSearchResult[][],
  excludeTmdbId: number
): TmdbSearchResult[] {
  const merged = new Map<number, TmdbSearchResult>();
  for (const pool of pools) {
    for (const item of pool) {
      if (item.tmdbId !== excludeTmdbId) {
        merged.set(item.tmdbId, item);
      }
    }
  }
  return Array.from(merged.values());
}

/**
 * Defensive check applied to the AI's output: even though the prompt
 * constrains it to choose only from the given candidates, this filters out
 * any id that isn't genuinely part of the real candidate pool before it's
 * trusted (Module 9 "never trust input blindly" — applied to AI output too).
 */
export function filterValidPicks(
  picks: RankedPick[],
  validTmdbIds: number[],
  maxPicks: number
): RankedPick[] {
  const validSet = new Set(validTmdbIds);
  return picks.filter((p) => validSet.has(p.tmdbId)).slice(0, maxPicks);
}
