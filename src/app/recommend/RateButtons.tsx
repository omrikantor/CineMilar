"use client";

import { useState, useTransition } from "react";
import { rateRecommendation } from "./actions";
import type { MediaType } from "@/types/database";

export function RateButtons({
  sourceTmdbId,
  sourceMediaType,
  candidateTmdbId,
  candidateMediaType,
  candidateTitle,
  candidatePosterPath,
  initialRating,
}: {
  sourceTmdbId: number;
  sourceMediaType: MediaType;
  candidateTmdbId: number;
  candidateMediaType: MediaType;
  candidateTitle: string;
  candidatePosterPath: string | null;
  initialRating: 1 | -1 | null;
}) {
  const [rating, setRating] = useState<1 | -1 | null>(initialRating);
  const [isPending, startTransition] = useTransition();

  function handleRate(value: 1 | -1) {
    const previous = rating;
    setRating(value);
    startTransition(async () => {
      const result = await rateRecommendation({
        sourceTmdbId,
        sourceMediaType,
        candidateTmdbId,
        candidateMediaType,
        candidateTitle,
        candidatePosterPath,
        rating: value,
      });
      if (result?.error) {
        setRating(previous);
      }
    });
  }

  return (
    <div className="mt-2 flex gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleRate(1)}
        aria-pressed={rating === 1}
        className={`rounded px-2 py-1 text-sm ${
          rating === 1 ? "bg-green-100" : "border"
        }`}
      >
        👍 Like
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleRate(-1)}
        aria-pressed={rating === -1}
        className={`rounded px-2 py-1 text-sm ${
          rating === -1 ? "bg-red-100" : "border"
        }`}
      >
        👎 Not for me
      </button>
    </div>
  );
}
