import "server-only";
import { z } from "zod";
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
const RETRYABLE_ERROR_CODES = new Set(["json_validate_failed"]);
const MAX_ATTEMPTS = 3;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class InvalidShapeError extends Error {}

async function generateJson<T>(
  prompt: string,
  schemaName: string,
  jsonSchema: Record<string, unknown>,
  zodSchema: z.ZodType<T>,
  maxOutputTokens: number
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
        // Sized per call, not one generous blanket value: the free tier's
        // tokens-per-minute cap makes over-requesting output tokens costly,
        // while too little risks truncating the JSON before it parses.
        max_tokens: maxOutputTokens,
        // This model spends variable, sometimes large amounts of tokens on
        // an internal chain-of-thought "reasoning" field before emitting
        // the actual JSON content — both counted against max_tokens. That
        // was silently truncating our JSON output whenever reasoning ran
        // long. We only need the final answer, not the reasoning trace.
        reasoning_effort: "low",
        include_reasoning: false,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            // Best-effort, not strict: strict mode's constrained decoding
            // was consistently failing with an empty failed_generation for
            // this model, even on requests well within the token budget.
            // We enforce the real shape guarantee ourselves below with Zod
            // instead of relying on Groq's server-side validation.
            strict: false,
            schema: jsonSchema,
          },
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text: string | undefined = data.choices?.[0]?.message?.content;

      const parsed = text ? safeJsonParse(text) : undefined;
      const validated = parsed !== undefined ? zodSchema.safeParse(parsed) : undefined;

      if (validated?.success) {
        return validated.data;
      }

      lastError = new InvalidShapeError(
        `AI response didn't match the expected shape: ${text ?? "(empty)"}`
      );
      if (attempt < MAX_ATTEMPTS) {
        await delay(attempt * 500);
        continue;
      }
      throw lastError;
    }

    const errText = await res.text();
    lastError = new Error(`AI request failed (${res.status}): ${errText}`);

    // 429 (rate limited), 503 (temporarily unavailable), and a
    // json_validate_failed response (Groq's own docs describe this as
    // sometimes transient) are all worth a short, bounded retry rather than
    // failing the user's request outright.
    const errorCode = safeJsonParse(errText) as { error?: { code?: string } } | undefined;
    const isRetryableCode =
      RETRYABLE_STATUS_CODES.has(res.status) ||
      RETRYABLE_ERROR_CODES.has(errorCode?.error?.code ?? "");
    const canRetry = isRetryableCode && attempt < MAX_ATTEMPTS;
    if (!canRetry) {
      throw lastError;
    }
    await delay(suggestedRetryDelayMs(errText) ?? attempt * 1000);
  }

  throw lastError ?? new Error("AI request failed");
}

const MAX_RETRY_DELAY_MS = 12000;

/** Parses Groq's "Please try again in 4.58s" hint, if present, capped to a sane maximum. */
function suggestedRetryDelayMs(errText: string): number | null {
  const match = errText.match(/try again in ([\d.]+)s/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds)) return null;
  return Math.min(Math.ceil(seconds * 1000) + 250, MAX_RETRY_DELAY_MS);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const tasteSignalsSchema = z.object({
  genres: z.array(z.string()),
  keywords: z.array(z.string()),
});

export type TasteSignals = z.infer<typeof tasteSignalsSchema>;

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

If nothing clearly matches, return empty arrays rather than guessing.

Respond with ONLY a JSON object of the exact shape { "genres": string[], "keywords": string[] }, nothing else.`;

  return generateJson(
    prompt,
    "taste_signals",
    {
      type: "object",
      properties: {
        genres: { type: "array", items: { type: "string" } },
        keywords: { type: "array", items: { type: "string" } },
      },
      required: ["genres", "keywords"],
    },
    tasteSignalsSchema,
    300
  );
}

export type RankCandidate = {
  tmdbId: number;
  title: string;
  year: string | null;
  overview: string;
};

const rankedPickSchema = z.object({
  tmdbId: z.number(),
  explanation: z.string(),
});

export type RankedPick = z.infer<typeof rankedPickSchema>;

const rankedPicksResponseSchema = z.object({
  picks: z.array(rankedPickSchema),
});

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
${candidateList}

Respond with ONLY a JSON object of the exact shape { "picks": [{ "tmdbId": number, "explanation": string }] }, nothing else.`;

  const result = await generateJson(
    prompt,
    "ranked_picks",
    {
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
          },
        },
      },
      required: ["picks"],
    },
    rankedPicksResponseSchema,
    1200
  );

  return filterValidPicks(
    result.picks,
    candidates.map((c) => c.tmdbId),
    maxPicks
  );
}
