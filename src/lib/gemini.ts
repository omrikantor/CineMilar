import "server-only";
import { filterValidPicks } from "@/lib/candidatePool";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "gemini-3.6-flash";

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return key;
}

async function generateJson<T>(
  prompt: string,
  responseSchema: Record<string, unknown>
): Promise<T> {
  const url = `${GEMINI_API_BASE}/models/${MODEL}:generateContent?key=${apiKey()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned no content");
  }
  return JSON.parse(text) as T;
}

export type TasteSignals = {
  genres: string[];
  keywords: string[];
};

/**
 * A small, bounded extraction step: turns the user's free-text reasoning into
 * a handful of real, structured TMDB search signals (not a recommendation).
 */
export async function extractTasteSignals(
  reasoning: string,
  validGenres: string[]
): Promise<TasteSignals> {
  const prompt = `A user explained what they liked about a movie/TV series they watched:
"${reasoning}"

From this, extract:
1. Up to 4 genres that match, chosen ONLY from this exact list (spell them exactly as shown): ${validGenres.join(", ")}
2. Up to 4 short thematic keywords or phrases (e.g. "time travel", "found family", "revenge") that capture what they described.

If nothing clearly matches, return empty arrays rather than guessing.`;

  return generateJson<TasteSignals>(prompt, {
    type: "OBJECT",
    properties: {
      genres: { type: "ARRAY", items: { type: "STRING" } },
      keywords: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: ["genres", "keywords"],
  });
}

export type RankCandidate = {
  tmdbId: number;
  title: string;
  year: string | null;
  overview: string;
};

export type RankedPick = {
  tmdbId: number;
  explanation: string;
};

/**
 * Ranks and explains a real candidate pool against the user's reasoning.
 * The prompt constrains the model to only choose ids from the given list, and
 * the caller re-validates that constraint against real data afterward.
 */
export async function rankCandidates({
  sourceTitle,
  sourceYear,
  sourceOverview,
  reasoning,
  candidates,
  maxPicks = 6,
}: {
  sourceTitle: string;
  sourceYear: string | null;
  sourceOverview: string;
  reasoning: string;
  candidates: RankCandidate[];
  maxPicks?: number;
}): Promise<RankedPick[]> {
  const candidateList = candidates
    .map(
      (c) =>
        `- id: ${c.tmdbId}, title: "${c.title}" (${c.year ?? "n/a"}), overview: ${c.overview}`
    )
    .join("\n");

  const prompt = `A user loved "${sourceTitle}" (${sourceYear ?? "n/a"}). Its synopsis: ${sourceOverview}

Here's what they said they liked about it:
"${reasoning}"

Below is a list of real candidate titles. Pick the best ${maxPicks} matches for this user, ranked best-first, and explain in one short sentence each why it matches what they described. You MUST only choose ids that appear in this list — never invent a title or use an id that isn't listed.

Candidates:
${candidateList}`;

  const result = await generateJson<{ picks: RankedPick[] }>(prompt, {
    type: "OBJECT",
    properties: {
      picks: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            tmdbId: { type: "INTEGER" },
            explanation: { type: "STRING" },
          },
          required: ["tmdbId", "explanation"],
        },
      },
    },
    required: ["picks"],
  });

  return filterValidPicks(
    result.picks,
    candidates.map((c) => c.tmdbId),
    maxPicks
  );
}
