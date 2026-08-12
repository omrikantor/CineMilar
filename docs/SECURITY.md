# CineMilar - Security

## Authentication

Handled entirely by **Supabase Auth** (email + password) - we never store or hash a password ourselves. Sessions are cookie-based; `src/proxy.ts` (using `src/lib/supabase/middleware.ts`) refreshes the session token on every request, and `src/lib/supabase/server.ts` / `src/lib/supabase/client.ts` provide the two Supabase clients used server-side and browser-side respectively. New accounts require email confirmation before login works (Supabase's default), which we rely on rather than building our own verification flow.

## Authorization

Two independent layers, deliberately redundant:

1. **Application-level checks** - every Server Action that mutates or reads user-specific data (`createRecommendationRequest`, `rateRecommendation`, and every protected page) starts by calling `supabase.auth.getUser()` and rejecting immediately if there's no session.
2. **Row Level Security at the database** - every table (`recommendation_requests`, `recommendations`, `recommendation_feedback`) has RLS enabled with policies scoped to `auth.uid()`, so even a bug in the application layer couldn't leak another user's data - the database itself refuses.

This "defense in depth" means a mistake in one layer doesn't become a breach on its own.

## Actions restricted to logged-in users

Creating a recommendation request, rating/saving a recommendation, and viewing `/recommend`, `/history`, `/saved`, or any specific `/recommend/[requestId]` result page all require a session - enforced both by `src/proxy.ts` (redirects logged-out users to `/login` before the page even renders) and again inside each Server Action itself, per the "framework protections aren't a substitute for application-level checks" guidance in Next.js's own Server Actions documentation.

## Preventing access to another user's data

Row Level Security is the real guarantee here, not application logic. Every policy is scoped by `auth.uid()` (directly on `recommendation_requests` and `recommendation_feedback`, and via an ownership subquery on `recommendations`, which has no `user_id` column of its own). Practically, this means: a request that belongs to another user and a request that doesn't exist at all are **indistinguishable** from the outside - both return zero rows, and `/recommend/[requestId]` renders the same `notFound()` either way. This is verified by an automated Playwright test (see `TEST_PLAN.md`).

## Input validation

Every Server Action validates input server-side using **Zod schemas** (`src/lib/validation.ts`) before touching the database or calling an external API - regardless of whatever the client-side form already checked (HTML `required`/`minLength` attributes are a UX convenience, never the actual enforcement). `createRecommendationRequest` stores the title **TMDB itself returned** for the validated `tmdbId`, not the raw text the client submitted in the form - following the same principle Next.js's own docs call out explicitly: a client may tell the server *which* item to act on, but the server should re-derive the actual data from a trusted source rather than trusting what the client claims about it.

## Protecting API calls

- Server Actions get Next.js's built-in CSRF protection for free: the framework compares the request's `Origin` against its `Host` and rejects mismatches automatically.
- The one REST endpoint, `GET /api/tmdb/search`, exists specifically so the browser's autocomplete box never sees the TMDB key directly - the key stays server-side and the endpoint only ever returns already-public search results.
- The AI-calling path (`createRecommendationRequest`) re-validates the model's own output before trusting it (`filterValidPicks` in `src/lib/candidatePool.ts`) - even though the prompt constrains Gemini to only choose from the given candidates, we don't assume it complied.

## Storing secrets

`TMDB_API_KEY` and `GEMINI_API_KEY` have **no** `NEXT_PUBLIC_` prefix, so Next.js never bundles them into browser code - only `NEXT_PUBLIC_SUPABASE_URL` and the Supabase *publishable* key (safe by design, since real enforcement happens via RLS) are exposed client-side. All four live in `.env.local` locally (git-ignored, never committed) and are mirrored in Vercel's project settings for the deployed app. The `server-only` npm package is imported at the top of `src/lib/tmdb.ts` and `src/lib/gemini.ts` specifically so that accidentally importing either file into a Client Component would fail the build, rather than silently leaking a secret.

## Remaining risks and future improvements

Being honest about what's still imperfect:

- **`GET /api/tmdb/search` is unauthenticated.** It doesn't touch our database or cost AI money, but it does mean anyone could hit it directly and indirectly consume our TMDB key's rate limit. Low severity, but a real gap - a next step would be light rate limiting or requiring a session.
- **No rate limiting on `createRecommendationRequest`.** Nothing currently stops a user from submitting requests in a tight loop, each costing real TMDB + Gemini usage - this is the most realistic cost/abuse risk in the current product, and the top priority if this went further.
- **No automated dependency vulnerability scanning** (e.g. `npm audit` in CI) - currently a manual, occasional check.
- **No structured logging or alerting** for suspicious activity (repeated failed logins, unusual request volume) - errors are currently just `console.error`-logged server-side.
- **The `recommendation_feedback_aggregate` view intentionally bypasses per-row RLS** (it's a plain view, not `security_invoker`) so it can aggregate across all users - this is deliberate and safe *because* it only ever exposes aggregated numbers (`avg_rating`, `rating_count`), never an individual user's rating or identity, but it's worth naming explicitly as a spot where a schema change could accidentally leak more than intended if someone later adds a column to the view without thinking it through.
