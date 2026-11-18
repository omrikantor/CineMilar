# CineMilar - Architecture

## System components

- **Next.js app** (TypeScript, App Router) - hosts both the frontend UI and the server-side logic (Server Components, Server Actions, one API route), deployed on Vercel.
- **Supabase** - hosted Postgres database + Authentication.
- **TMDB API** - external source of real movie/TV metadata and similar-title candidates; used to *ground* recommendations in real, existing titles.
- **Groq API** (running `openai/gpt-oss-20b`) - used to interpret the user's free-text reasoning and rank/explain the TMDB candidate set. It never invents titles - it only ranks and explains titles TMDB already confirmed exist.

## Database use

Yes - Supabase Postgres, with Row Level Security enabled on every table.

### Tables

**`recommendation_requests`** - one row per search a user makes
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| user_id | uuid, fk -> auth.users | owner |
| source_tmdb_id | integer | the title the user liked |
| source_media_type | text | `movie` or `tv` |
| source_title | text | denormalized for display |
| reasoning | text | user's free-text explanation |
| created_at | timestamptz | |

**`recommendations`** - the ranked results belonging to a request
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| request_id | uuid, fk -> recommendation_requests | |
| tmdb_id | integer | |
| media_type | text | `movie` or `tv` |
| title | text | |
| poster_path | text | |
| ai_explanation | text | why the AI ranked it here |
| rank_position | integer | |
| created_at | timestamptz | |

**`recommendation_feedback`** - a user's save/rating on a specific recommendation candidate; also the raw signal behind the (stretch) cross-user ranking boost
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| user_id | uuid, fk -> auth.users | |
| source_tmdb_id | integer | |
| source_media_type | text | |
| candidate_tmdb_id | integer | |
| candidate_media_type | text | |
| candidate_title | text | |
| candidate_poster_path | text | |
| rating | smallint | `1` (liked) or `-1` (disliked) |
| created_at | timestamptz | |
| *unique(user_id, source_tmdb_id, candidate_tmdb_id)* | | one rating per pair per user |

**`recommendation_feedback_aggregate`** (Postgres **view**, not a table) - exposes only aggregated, non-identifying stats (`source_tmdb_id`, `candidate_tmdb_id`, `avg_rating`, `rating_count`) computed from `recommendation_feedback`. This is what lets recommendations benefit from *other* users' feedback without ever exposing whose rating it was - the underlying table stays private per-user via RLS; only the aggregate is broadly readable.

## Pages

| Route | Purpose | Access |
|---|---|---|
| `/` | Landing page, pitch, sign-up CTA | Public |
| `/login` | Sign in / sign up | Public |
| `/recommend` | Input form: title + reasoning + movie/TV toggle | Logged in |
| `/recommend/[requestId]` | Ranked results for one request, with save/rate actions | Logged in, owner only |
| `/history` | Paginated list of past requests | Logged in, owner only |
| `/saved` | List of saved/rated recommendations | Logged in, owner only |

## Server Actions vs. API routes

- **Server Actions** (mutations, triggered by the app's own UI): `signUp`, `signIn`, `signOut`, `createRecommendationRequest` (looks up TMDB, calls Groq, writes `recommendation_requests` + `recommendations`), `rateRecommendation` (upserts `recommendation_feedback`).
- **One API route**, `GET /api/tmdb/search`: powers a live title-search-as-you-type box in the request form. This is a plain read triggered by client-side typing (not a mutation tied to the app's own form submission flow), so a REST-style endpoint fits better than a Server Action here.
- Everything else (rendering history, saved lists, results) is read directly in **Server Components** from Supabase - no separate API layer needed.

## Data flow (example: requesting a recommendation)

```
User fills form (Client Component) -> autocompletes title via GET /api/tmdb/search
   ↓ submit
Server Action createRecommendationRequest
   ↓ authenticate (reject if no session)
   ↓ validate input (title selected, reasoning non-empty)
   ↓ call TMDB: fetch source title details + TMDB's generic "similar" titles
   ↓ call Groq (1): extract genres + keywords from the user's own reasoning, plus up to 6
     specific title ideas that fit the themes they described
   ↓ call TMDB (in parallel):
       - discover: one search per keyword + one genre search -> titles matching what the user described
       - verify the AI's title ideas: each is looked up on TMDB and kept only on an exact name match
         (an invented title is dropped here and never reaches the ranking step)
   ↓ build the candidate pool (max 18): AI-suggested and keyword/genre-discovered titles get most slots,
     TMDB "similar" titles keep a minimum of 3 (and backfill if the other sources find little);
     each candidate is tagged [DESCRIBED] or [SIMILAR]
   ↓ call Groq (2): rank & explain candidates, weighting the user's reasoning above the source title
     and allowing at most one title per franchise
   ↓ re-validate the AI's picks against the real candidate pool (drop any id not in it)
   ↓ insert recommendation_requests + recommendations rows (RLS confirms ownership)
   ↓ redirect to /recommend/[requestId]
Server Component renders the new request's recommendations from the database
```

## Users & permissions

Single user role - every logged-in user has identical capabilities, scoped entirely to their own data. There is no admin/staff role in this version. Authorization is enforced by:
1. A session check at the top of every protected Server Action / page.
2. Row Level Security policies restricting all reads/writes on `recommendation_requests`, `recommendations`, and `recommendation_feedback` to rows the requesting user owns.
3. The aggregate view is the only place data crosses between users, and it exposes only aggregated numbers, never individual feedback rows.

## External services and why

- **TMDB** - grounds every recommendation in a real, existing title (prevents AI hallucination of nonexistent movies/shows) and supplies posters, genres, and a starting candidate pool.
- **Groq API** - handles the genuinely subjective part (interpreting *why* someone liked something) that a fixed algorithm can't do well, applied only to a TMDB-verified candidate set. Chosen over Gemini after hitting Gemini's free-tier daily quota (20 requests/day) during development - Groq's free tier allows 1,000 requests/day on this model, with no billing setup required. Getting it fully reliable on the free tier took real tuning, worth documenting: `openai/gpt-oss-20b` is a *reasoning* model that generates an internal chain-of-thought before its actual answer, and both count against `max_tokens` - when reasoning ran long it silently truncated our JSON output. Diagnosed by logging raw API responses rather than guessing, then fixed with `reasoning_effort: "low"` and `include_reasoning: false`, alongside a smaller candidate pool and truncated overview text to stay within the free tier's tokens-per-minute limit. That reliability fix had its own side effect: with reasoning effort capped low and no system prompt, ranking explanations leaned toward generic plot-summary language instead of tying back to what the user actually said they liked. Adding a system prompt that requires each explanation to reference a specific element of the user's stated reasoning closed that gap without touching `reasoning_effort`, so the token-budget and rate-limit tradeoffs above still hold.
- **Supabase Auth** - avoids building a custom authentication system from scratch, while giving us Postgres-level Row Level Security for authorization.
