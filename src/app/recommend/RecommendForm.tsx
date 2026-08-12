"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { createRecommendationRequest, type CreateRequestState } from "./actions";

type SearchResult = {
  tmdbId: number;
  title: string;
  mediaType: "movie" | "tv";
  year: string | null;
  posterUrl: string | null;
};

const initialState: CreateRequestState = {};

export function RecommendForm() {
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [state, formAction, pending] = useActionState(
    createRecommendationRequest,
    initialState
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      if (!query.trim() || selected) {
        setResults([]);
        return;
      }
      fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}&mediaType=${mediaType}`)
        .then((res) => res.json())
        .then((data) => setResults(data.results ?? []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, mediaType, selected]);

  function switchMediaType(next: "movie" | "tv") {
    setMediaType(next);
    setSelected(null);
    setQuery("");
    setResults([]);
  }

  return (
    <form action={formAction} className="card flex flex-col gap-5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => switchMediaType("movie")}
          className={mediaType === "movie" ? "chip-active" : "chip"}
        >
          🎬 Movie
        </button>
        <button
          type="button"
          onClick={() => switchMediaType("tv")}
          className={mediaType === "tv" ? "chip-active" : "chip"}
        >
          📺 TV Series
        </button>
      </div>

      <div className="relative">
        <label className="field">
          Title you liked
          <input
            type="text"
            value={selected ? selected.title : query}
            onChange={(e) => {
              setSelected(null);
              setQuery(e.target.value);
            }}
            placeholder={`Search for a ${mediaType === "movie" ? "movie" : "TV series"}...`}
            className="field-input"
            required
          />
        </label>
        {results.length > 0 && !selected && (
          <ul
            className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            {results.map((r) => (
              <li key={r.tmdbId}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(r);
                    setResults([]);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-black/5"
                >
                  {r.posterUrl ? (
                    <Image
                      src={r.posterUrl}
                      alt=""
                      width={32}
                      height={48}
                      className="h-12 w-8 shrink-0 rounded"
                    />
                  ) : (
                    <div
                      className="h-12 w-8 shrink-0 rounded"
                      style={{ backgroundColor: "var(--border)" }}
                    />
                  )}
                  <span className="text-sm">
                    {r.title} {r.year && `(${r.year})`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <>
          <input type="hidden" name="tmdbId" value={selected.tmdbId} />
          <input type="hidden" name="mediaType" value={selected.mediaType} />
          <input type="hidden" name="title" value={selected.title} />
        </>
      )}

      <label className="field">
        What did you like about it?
        <textarea
          name="reasoning"
          required
          rows={4}
          maxLength={1000}
          placeholder="e.g. the slow-burn tension, the morally grey characters, the twist ending..."
          className="field-input"
        />
      </label>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !selected}
        className="btn-primary"
      >
        {pending ? "Finding recommendations..." : "Get recommendations"}
      </button>
    </form>
  );
}
