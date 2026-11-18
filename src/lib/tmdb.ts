import "server-only";
import type { MediaType } from "@/types/database";
import {
  mergeCandidatePools,
  parseTitleSuggestion,
  pickMatchingResult,
} from "@/lib/candidatePool";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

// Stable, publicly documented TMDB genre name -> id maps. Movie and TV use
// different genre sets. Fetching /genre/*/list would also work, but these
// rarely change and hardcoding avoids an extra request on every search.
const MOVIE_GENRES: Record<string, number> = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 14,
  History: 36,
  Horror: 27,
  Music: 10402,
  Mystery: 9648,
  Romance: 10749,
  "Science Fiction": 878,
  "TV Movie": 10770,
  Thriller: 53,
  War: 10752,
  Western: 37,
};

const TV_GENRES: Record<string, number> = {
  "Action & Adventure": 10759,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Kids: 10762,
  Mystery: 9648,
  News: 10763,
  Reality: 10764,
  "Sci-Fi & Fantasy": 10765,
  Soap: 10766,
  Talk: 10767,
  "War & Politics": 10768,
  Western: 37,
};

export type TmdbSearchResult = {
  tmdbId: number;
  title: string;
  mediaType: MediaType;
  year: string | null;
  posterPath: string | null;
  overview: string;
};

export type TmdbTitleDetails = TmdbSearchResult & {
  genres: string[];
};

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error("TMDB_API_KEY is not configured");
  }
  return key;
}

async function tmdbFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_API_BASE}${path}`);
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("language", "en-US");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  // Cache results for an hour: identical searches/lookups don't need to hit
  // TMDB again immediately (Module 10 "avoid over-fetching" applied).
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`TMDB request failed (${res.status}) for ${path}`);
  }
  return res.json();
}

type TmdbRawItem = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  overview?: string;
  genres?: { name: string }[];
};

function toSearchResult(item: TmdbRawItem, mediaType: MediaType): TmdbSearchResult {
  const date = mediaType === "movie" ? item.release_date : item.first_air_date;
  return {
    tmdbId: item.id,
    title: (mediaType === "movie" ? item.title : item.name) ?? "Untitled",
    mediaType,
    year: date ? date.slice(0, 4) : null,
    posterPath: item.poster_path ?? null,
    overview: item.overview ?? "",
  };
}

export async function searchTitles(
  query: string,
  mediaType: MediaType
): Promise<TmdbSearchResult[]> {
  if (!query.trim()) return [];

  const endpoint = mediaType === "movie" ? "/search/movie" : "/search/tv";
  const data = await tmdbFetch(endpoint, { query, include_adult: "false" });
  const results: TmdbRawItem[] = data.results ?? [];

  return results.slice(0, 8).map((item) => toSearchResult(item, mediaType));
}

export async function getTitleDetails(
  tmdbId: number,
  mediaType: MediaType
): Promise<TmdbTitleDetails> {
  const endpoint = mediaType === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
  const data: TmdbRawItem = await tmdbFetch(endpoint);

  return {
    ...toSearchResult(data, mediaType),
    genres: (data.genres ?? []).map((g) => g.name),
  };
}

export async function getSimilarTitles(
  tmdbId: number,
  mediaType: MediaType,
  limit = 20
): Promise<TmdbSearchResult[]> {
  const endpoint =
    mediaType === "movie" ? `/movie/${tmdbId}/similar` : `/tv/${tmdbId}/similar`;
  const data = await tmdbFetch(endpoint);
  const results: TmdbRawItem[] = data.results ?? [];

  return results.slice(0, limit).map((item) => toSearchResult(item, mediaType));
}

/** The exact genre names valid for this media type - used to constrain the AI's extraction step. */
export function genreNamesForMediaType(mediaType: MediaType): string[] {
  return Object.keys(mediaType === "movie" ? MOVIE_GENRES : TV_GENRES);
}

function genreIdsFromNames(names: string[], mediaType: MediaType): number[] {
  const map = mediaType === "movie" ? MOVIE_GENRES : TV_GENRES;
  const lowerMap = new Map(
    Object.entries(map).map(([name, id]) => [name.toLowerCase(), id])
  );
  return names
    .map((name) => lowerMap.get(name.toLowerCase()))
    .filter((id): id is number => id !== undefined);
}

async function searchKeywordIds(term: string): Promise<number[]> {
  const data = await tmdbFetch("/search/keyword", { query: term });
  const results: { id: number }[] = data.results ?? [];
  return results.slice(0, 3).map((k) => k.id);
}

const MAX_TITLE_SUGGESTIONS = 6;

/**
 * Turns the AI's suggested "Title (Year)" strings into real TMDB titles.
 * This is what keeps AI suggestions grounded: a title only survives if TMDB
 * has a result with that exact name, so an invented title is silently
 * dropped and can never reach the ranking step.
 */
export async function resolveSuggestedTitles(
  mediaType: MediaType,
  suggestions: string[]
): Promise<TmdbSearchResult[]> {
  const endpoint = mediaType === "movie" ? "/search/movie" : "/search/tv";

  const resolved = await Promise.all(
    suggestions.slice(0, MAX_TITLE_SUGGESTIONS).map(async (raw) => {
      const parsed = parseTitleSuggestion(raw);
      if (!parsed) return null;
      try {
        const data = await tmdbFetch(endpoint, {
          query: parsed.title,
          include_adult: "false",
        });
        const results: TmdbRawItem[] = data.results ?? [];
        return pickMatchingResult(
          results.slice(0, 5).map((item) => toSearchResult(item, mediaType)),
          parsed
        );
      } catch {
        // One failed lookup shouldn't fail the whole request - the other
        // candidate sources still fill the pool.
        return null;
      }
    })
  );

  return resolved.filter((r): r is TmdbSearchResult => r !== null);
}

// Sorting by rating alone would surface obscure titles with a handful of
// votes, so require a minimum number of votes (TV shows collect fewer).
const MIN_VOTE_COUNT: Record<MediaType, string> = { movie: "100", tv: "50" };

async function discoverRaw(
  mediaType: MediaType,
  filters: Record<string, string>
): Promise<TmdbSearchResult[]> {
  const endpoint = mediaType === "movie" ? "/discover/movie" : "/discover/tv";
  const data = await tmdbFetch(endpoint, {
    sort_by: "vote_average.desc",
    "vote_count.gte": MIN_VOTE_COUNT[mediaType],
    ...filters,
  });
  const results: TmdbRawItem[] = data.results ?? [];
  return results.map((item) => toSearchResult(item, mediaType));
}

/**
 * Finds additional real candidates using genres/keywords extracted from the
 * user's own reasoning, rather than only titles similar to the source movie.
 *
 * Each keyword the user's reasoning produced gets its own search, so every
 * theme they mentioned contributes candidates (OR-ing them all into one
 * query let one broad keyword drown out the specific ones). The genres form
 * one more search that requires ALL the genres at once, falling back to ANY
 * of them if that's too narrow to return anything. Results are interleaved
 * across those searches and ranked by rating (above a minimum vote count)
 * rather than raw popularity, which mostly returned generic blockbusters.
 * A failed individual search just contributes nothing - the caller still
 * has TMDB's "similar" titles to fall back on.
 */
export async function discoverTitles(
  mediaType: MediaType,
  options: { genreNames?: string[]; keywordTerms?: string[] },
  limit = 15
): Promise<TmdbSearchResult[]> {
  const genreIds = genreIdsFromNames(options.genreNames ?? [], mediaType);
  const keywordTerms = options.keywordTerms ?? [];

  const keywordIdsPerTerm = await Promise.all(
    keywordTerms.map((term) => searchKeywordIds(term).catch(() => []))
  );

  const searches: Promise<TmdbSearchResult[]>[] = keywordIdsPerTerm
    .filter((ids) => ids.length > 0)
    .map((ids) =>
      discoverRaw(mediaType, { with_keywords: ids.join("|") }).catch(() => [])
    );

  if (genreIds.length > 0) {
    searches.push(
      discoverRaw(mediaType, { with_genres: genreIds.join(",") })
        .then((all) =>
          all.length > 0 || genreIds.length === 1
            ? all
            : discoverRaw(mediaType, { with_genres: genreIds.join("|") })
        )
        .catch(() => [])
    );
  }

  if (searches.length === 0) {
    return [];
  }

  const pools = await Promise.all(searches);
  return mergeCandidatePools(pools).slice(0, limit);
}

export function tmdbPosterUrl(
  posterPath: string | null,
  size: "w200" | "w500" = "w200"
): string | null {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
}
