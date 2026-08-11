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
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => switchMediaType("movie")}
          className={`rounded px-3 py-1 text-sm ${
            mediaType === "movie" ? "bg-black text-white" : "border"
          }`}
        >
          Movie
        </button>
        <button
          type="button"
          onClick={() => switchMediaType("tv")}
          className={`rounded px-3 py-1 text-sm ${
            mediaType === "tv" ? "bg-black text-white" : "border"
          }`}
        >
          TV Series
        </button>
      </div>

      <div className="relative">
        <label className="flex flex-col gap-1 text-sm">
          Title you liked
          <input
            type="text"
            value={selected ? selected.title : query}
            onChange={(e) => {
              setSelected(null);
              setQuery(e.target.value);
            }}
            placeholder={`Search for a ${mediaType === "movie" ? "movie" : "TV series"}...`}
            className="rounded border px-3 py-2"
            required
          />
        </label>
        {results.length > 0 && !selected && (
          <ul className="absolute z-10 mt-1 w-full rounded border bg-white shadow">
            {results.map((r) => (
              <li key={r.tmdbId}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(r);
                    setResults([]);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100"
                >
                  {r.posterUrl && (
                    <Image
                      src={r.posterUrl}
                      alt=""
                      width={32}
                      height={48}
                      className="rounded"
                    />
                  )}
                  <span>
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

      <label className="flex flex-col gap-1 text-sm">
        What did you like about it?
        <textarea
          name="reasoning"
          required
          rows={4}
          maxLength={1000}
          className="rounded border px-3 py-2"
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
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Finding recommendations..." : "Get recommendations"}
      </button>
    </form>
  );
}
