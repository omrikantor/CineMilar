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
   ↓ call TMDB: fetch source title details + candidate similar titles
   ↓ call Groq: rank & explain candidates using the user's reasoning
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
- **Groq API** - handles the genuinely subjective part (interpreting *why* someone liked something) that a fixed algorithm can't do well, applied only to a TMDB-verified candidate set. Chosen over Gemini after hitting Gemini's free-tier daily quota (20 requests/day) during development - Groq's free tier allows 1,000 requests/day on this model, with no billing setup required.
- **Supabase Auth** - avoids building a custom authentication system from scratch, while giving us Postgres-level Row Level Security for authorization.
