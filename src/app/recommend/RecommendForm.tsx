"use client";

import { useActionState, useEffect, useState } from "react";
import { createRecommendationRequest, type CreateRequestState } from "./actions";
import { Poster } from "@/components/Poster";
import {
  AlertIcon,
  CheckCircleIcon,
  FilmIcon,
  SearchIcon,
  SparklesIcon,
  SpinnerIcon,
  TvIcon,
} from "@/components/Icons";

type SearchResult = {
  tmdbId: number;
  title: string;
  mediaType: "movie" | "tv";
  year: string | null;
  posterUrl: string | null;
};

const initialState: CreateRequestState = {};

const MAX_REASONING = 1000;

const IDEAS = [
  "plot twists",
  "slow-burn tension",
  "morally grey characters",
  "world-building",
  "emotional depth",
  "dark humour",
];

const PROGRESS_STEPS = [
  "Reading what you loved about it",
  "Finding titles that match your taste",
  "Checking that every title is real",
  "Ranking picks and writing your explanations",
];

/** Shown while the recommendations are being generated (about 10-15 seconds). */
function GeneratingPanel() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setStep((s) => Math.min(s + 1, PROGRESS_STEPS.length - 1)),
      3200
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-border bg-accent-soft/60 p-4"
    >
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent">
        <SparklesIcon /> Working on your picks - this takes about 10-15 seconds
      </p>
      <ol className="flex flex-col gap-2">
        {PROGRESS_STEPS.map((label, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <li
              key={label}
              className={`flex items-center gap-2.5 text-sm transition-colors ${
                done || current ? "text-foreground" : "text-muted opacity-60"
              }`}
            >
              {done ? (
                <CheckCircleIcon className="h-4 w-4 text-success" />
              ) : current ? (
                <SpinnerIcon className="h-4 w-4 text-accent" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-border-strong" />
              )}
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function RecommendForm() {
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [reasoning, setReasoning] = useState("");
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

  function addIdea(idea: string) {
    setReasoning((current) => {
      const base = current.trim().replace(/[,.\s]+$/, "");
      const next = base ? `${base}, ${idea}` : idea;
      return next.slice(0, MAX_REASONING);
    });
  }

  return (
    <form action={formAction} className="card flex flex-col gap-6 p-5 sm:p-7">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">What are you looking for?</span>
        <div className="segmented self-start" role="group" aria-label="Type">
          <button
            type="button"
            onClick={() => switchMediaType("movie")}
            aria-pressed={mediaType === "movie"}
            className="segmented-item"
          >
            <FilmIcon /> Movie
          </button>
          <button
            type="button"
            onClick={() => switchMediaType("tv")}
            aria-pressed={mediaType === "tv"}
            className="segmented-item"
          >
            <TvIcon /> TV Series
          </button>
        </div>
      </div>

      <div className="relative">
        <label className="field">
          Title you liked
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={selected ? selected.title : query}
              onChange={(e) => {
                setSelected(null);
                setQuery(e.target.value);
              }}
              placeholder={`Search for a ${mediaType === "movie" ? "movie" : "TV series"}...`}
              className="field-input pl-10"
              autoComplete="off"
              required
            />
          </div>
        </label>
        {results.length > 0 && !selected && (
          <ul className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-border-strong bg-surface p-1.5 shadow-lift">
            {results.map((r) => (
              <li key={r.tmdbId}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(r);
                    setResults([]);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent-soft"
                >
                  <Poster
                    url={r.posterUrl}
                    alt=""
                    className="h-[54px] w-9"
                    sizes="36px"
                  />
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
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-2/70 p-3">
          <Poster
            url={selected.posterUrl}
            alt=""
            className="h-[72px] w-12"
            sizes="48px"
          />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Selected</p>
            <p className="truncate font-semibold">{selected.title}</p>
            <p className="text-xs text-muted">
              {selected.mediaType === "movie" ? "Movie" : "TV series"}
              {selected.year && ` · ${selected.year}`}
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setQuery(selected.title);
              setSelected(null);
            }}
          >
            Change
          </button>
        </div>
      )}

      {selected && (
        <>
          <input type="hidden" name="tmdbId" value={selected.tmdbId} />
          <input type="hidden" name="mediaType" value={selected.mediaType} />
          <input type="hidden" name="title" value={selected.title} />
        </>
      )}

      <div className="flex flex-col gap-2.5">
        <label className="field">
          What did you like about it?
          <textarea
            name="reasoning"
            required
            rows={4}
            maxLength={MAX_REASONING}
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            placeholder="e.g. the slow-burn tension, the morally grey characters, the twist ending..."
            className="field-input resize-y leading-relaxed"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Need ideas?</span>
            {IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => addIdea(idea)}
                className="chip"
              >
                + {idea}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted tabular-nums">
            {reasoning.length}/{MAX_REASONING}
          </span>
        </div>
      </div>

      {state?.error && !pending && (
        <p role="alert" className="notice notice-error">
          <AlertIcon className="mt-0.5 h-4 w-4" />
          {state.error}
        </p>
      )}

      {pending && <GeneratingPanel />}

      <button
        type="submit"
        disabled={pending || !selected}
        className="btn-primary w-full py-3 text-base"
      >
        {pending ? (
          <>
            <SpinnerIcon /> Finding recommendations...
          </>
        ) : (
          <>
            <SparklesIcon /> Get recommendations
          </>
        )}
      </button>
    </form>
  );
}
