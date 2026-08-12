import "server-only";
import { filterValidPicks } from "@/lib/candidatePool";

const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const MODEL = "openai/gpt-oss-20b";

function apiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error("GROQ_API_KEY is not configured");
  }
  return key;
}

const RETRYABLE_STATUS_CODES = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateJson<T>(
  prompt: string,
  schemaName: string,
  jsonSchema: Record<string, unknown>
): Promise<T> {
  const url = `${GROQ_API_BASE}/chat/completions`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema: jsonSchema,
          },
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text: string | undefined = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error("AI provider returned no content");
      }
      return JSON.parse(text) as T;
    }

    const errText = await res.text();
    lastError = new Error(`AI request failed (${res.status}): ${errText}`);

    // 429 (rate limited) and 503 (temporarily unavailable) are both cases
    // worth a short, bounded retry rather than failing the user's request
    // outright.
    const canRetry = RETRYABLE_STATUS_CODES.has(res.status) && attempt < MAX_ATTEMPTS;
    if (!canRetry) {
      throw lastError;
    }
    await delay(attempt * 1000);
  }

  throw lastError ?? new Error("AI request failed");
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

  return generateJson<TasteSignals>(prompt, "taste_signals", {
    type: "object",
    properties: {
      genres: { type: "array", items: { type: "string" } },
      keywords: { type: "array", items: { type: "string" } },
    },
    required: ["genres", "keywords"],
    additionalProperties: false,
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

  const result = await generateJson<{ picks: RankedPick[] }>(prompt, "ranked_picks", {
    type: "object",
    properties: {
      picks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tmdbId: { type: "integer" },
            explanation: { type: "string" },
          },
          required: ["tmdbId", "explanation"],
          additionalProperties: false,
        },
      },
    },
    required: ["picks"],
    additionalProperties: false,
  });

  return filterValidPicks(
    result.picks,
    candidates.map((c) => c.tmdbId),
    maxPicks
  );
}
