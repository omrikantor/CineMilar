import { NextResponse } from "next/server";
import { searchTitles, tmdbPosterUrl } from "@/lib/tmdb";
import type { MediaType } from "@/types/database";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const mediaType = searchParams.get("mediaType");

  if (mediaType !== "movie" && mediaType !== "tv") {
    return NextResponse.json(
      { error: "mediaType must be 'movie' or 'tv'" },
      { status: 400 }
    );
  }

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchTitles(query, mediaType as MediaType);
    return NextResponse.json({
      results: results.map((r) => ({
        ...r,
        posterUrl: tmdbPosterUrl(r.posterPath),
      })),
    });
  } catch (err) {
    console.error("TMDB search failed", err);
    return NextResponse.json(
      { error: "Search failed, please try again." },
      { status: 502 }
    );
  }
}
