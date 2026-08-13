# CineMilar - Scale

## What happens with tens or hundreds of users

The heaviest cost per user action isn't the database - it's the recommendation pipeline itself: each request to `/recommend` triggers up to ~2 Groq calls and 4-5 TMDB calls in sequence, which is why a single recommendation currently takes roughly 10-15 seconds end-to-end (observed during manual testing). At dozens or low hundreds of users, Vercel's serverless functions scale automatically to handle concurrent requests, and Supabase's managed Postgres comfortably handles that level of read/write load - so the app itself wouldn't fall over. The real bottleneck at that scale is **cost and latency of the AI/TMDB calls**, not infrastructure capacity.

## Heavy queries

- `recommendation_feedback_aggregate` (the view behind cross-user learning, if fully wired up) runs a `GROUP BY` over the entire `recommendation_feedback` table on every read. This is the one query in the schema that gets proportionally slower as usage grows - mitigated today by the `idx_recommendation_feedback_source_candidate` index (`source_tmdb_id, candidate_tmdb_id`), which lets Postgres group efficiently instead of scanning the whole table.
- Everything else (`recommendation_requests` and `recommendations` reads) is filtered by an indexed `user_id`/`request_id`, so per-user data stays fast regardless of how large the tables get overall.

## Indexes

Four were added directly in the schema migration (`supabase/migrations/0001_initial_schema.sql`), each matching a column we actually filter by:
- `recommendation_requests(user_id)` - every history/ownership query filters here
- `recommendations(request_id)` - every results-page query filters here
- `recommendation_feedback(user_id)` - every saved-list query filters here
- `recommendation_feedback(source_tmdb_id, candidate_tmdb_id)` - the aggregate view's `GROUP BY`

## Avoiding unnecessary loading

- TMDB responses are cached for an hour via Next.js's `fetch` cache (`next: { revalidate: 3600 }` in `src/lib/tmdb.ts`) - searching or looking up the same title repeatedly within that window doesn't re-hit TMDB.
- Supabase queries select only the columns actually used (`select("*")` is used, but on narrow, purpose-built tables - there's no over-fetching of unrelated joined data since our schema doesn't have wide tables with unused columns).
- The recommendation pipeline caps the AI candidate pool at 14 titles (`MAX_CANDIDATES`) and truncates each overview to ~220 characters - bounding the size (and therefore cost/latency, and Groq's per-minute token budget) of the AI call.

## Pagination

Both `/history` and `/saved` are paginated (10 and 12 items per page respectively), using Supabase's `.range()` with an exact `count`, rather than loading a user's entire history at once. Lists with no realistic growth (a single request's recommendation results, capped at 6) are intentionally not paginated - pagination there would add complexity without benefit.

## Client/server separation

Every page is a Server Component by default; the only Client Components are the ones that genuinely need interactivity - the search-and-submit form, the like/dislike buttons. All TMDB/Groq calls, all validation, and all database writes happen server-side; the browser never holds API keys and never does the "heavy lifting" of filtering or aggregating data - it only renders what the server already decided to send it.

## Current limitations

- **No rate limiting** on `createRecommendationRequest` - nothing currently stops a single user (or a script) from submitting requests in a tight loop, each one costing real TMDB/Groq API usage. At low/personal scale this is a non-issue; at real scale it's the first thing to fix (see Security doc).
- **No dedicated cache table** for TMDB lookups - the Next.js fetch cache helps, but a real `titles` cache table in Supabase would let *popular* searches (e.g. many different users searching "Inception") skip TMDB entirely after the first lookup, rather than relying on an in-memory/edge cache that isn't guaranteed to persist.
- **The AI call is synchronous** - the user waits ~10-15 seconds on the request page with no progress feedback beyond a disabled button. This is a real UX ceiling, not just a performance one.
- **The cross-user feedback aggregate view exists but isn't wired into ranking yet** (a deliberate scope decision, see `ARCHITECTURE.md`) - so it currently costs a small amount of index-maintenance overhead per feedback write, without yet delivering its intended benefit.

## What I'd improve for real scale

- Move the AI generation step to a background job (queue + polling or a webhook-driven update) so the request page returns instantly and the results stream in, instead of blocking on a 10-15 second synchronous call.
- Add a `titles` cache table in Supabase for TMDB lookups, shared across all users.
- Add rate limiting (e.g. per-user, per-minute) on the recommendation endpoint specifically, since it's the only endpoint with a real external cost per call.
- Wire the `recommendation_feedback_aggregate` view into the ranking prompt, and consider caching its results (e.g. a materialized view refreshed periodically) once feedback volume is high enough that recomputing on every read matters.
