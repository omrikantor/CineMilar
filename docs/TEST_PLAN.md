# CineMilar - Test Plan

## Philosophy

Per the assignment brief, the goal isn't 100% code coverage - it's proving the core flows genuinely work, invalid input is handled, and permissions are enforced. Tests split across three layers : fast **unit tests** for pure logic, **component tests** for UI behavior, and **end-to-end tests** for real user journeys through a real browser against the real Supabase project.

One deliberate scoping decision: the AI-dependent recommendation pipeline (calling TMDB + Groq) is **not** run in the automated E2E suite. Each run costs real API calls, is slower, and depends on services outside our control - the kind of flakiness automated suites should avoid. Instead, its core *logic* is unit-tested (see below), and the end-to-end behavior is covered by **documented manual testing**.

## Test categories -> what covers them

### 1. Core features

| Feature | Covered by |
|---|---|
| Input validation (recommendation request, rating, login, signup) | Vitest - `src/lib/__tests__/validation.test.ts` |
| Candidate pool merging/deduping/prioritising, AI-title parsing and verification matching | Vitest - `src/lib/__tests__/candidatePool.test.ts` |
| AI output is never trusted blindly (hallucinated ids get filtered out) | Vitest - `filterValidPicks` tests in `candidatePool.test.ts` |
| Recommend form UI (selection required before submit, error display) | RTL - `RecommendForm.test.tsx` |
| Rate buttons (optimistic update, revert on failure, reflects existing rating) | RTL - `RateButtons.test.tsx` |
| Full search -> TMDB grounding -> AI ranking -> results pipeline | **Manual, documented below** (happy path); Vitest - `actions.test.ts` (auth guard, invalid input, empty-candidate-pool, and TMDB/AI failure paths) |
| Save/rate -> appears on Saved page | **Manual, documented below** |
| History listing | **Manual, documented below** + Playwright smoke test |

### 2. Invalid inputs

- Empty/whitespace reasoning, missing title selection, reasoning over 1000 characters, invalid media type, invalid rating value - all covered by `validation.test.ts`.
- Login/signup with empty fields - `signupCredentialsSchema`/`loginCredentialsSchema` unit tests, plus Playwright checks the browser's own HTML validation blocks a too-short password and an empty required field before it ever reaches the server (`auth-errors.spec.ts`).
- Wrong login credentials - Playwright `auth-errors.spec.ts` confirms a real Supabase auth error renders and the user stays on `/login`.

### 3. Core business processes (Playwright, real browser + real Supabase)

- Logged-out user is redirected away from every protected page (`/recommend`, `/history`, `/saved`) -> `/login`.
- Logged-in user can reach `/recommend` and sees the request form.
- Logout returns to `/login` and immediately re-protects routes.
- Full "describe a liked title -> get grounded, AI-ranked recommendations -> rate one -> see it under Saved" journey - **manual, documented below**.

### 4. Permissions

- `logged-in.spec.ts` visits a recommendation request that doesn't belong to the logged-in session (a random UUID) and confirms a **404**, not the data.
- This is the same code path as "another user's real request": Row Level Security filters `recommendation_requests` by `user_id = auth.uid()` at the database level, so a request that exists but belongs to someone else and a request that doesn't exist at all are indistinguishable - both return zero rows, both render `notFound()`. Testing one is equivalent to testing the other, without needing a second live test account for every run.

### 5. Database

- Every RLS-dependent test above is a real database test - Playwright and the unit-tested query logic run against the actual Supabase project, not mocks. This is intentional: RLS behavior is exactly what shouldn't be faked, since real security guarantees only mean something if verified against the real database.

### 6. Edge cases

- Reasoning at exactly 1000 characters (accepted) and over it (rejected) - `validation.test.ts`.
- Empty candidate pool (TMDB returns nothing similar or discoverable) - `actions.test.ts`, with TMDB/AI mocked so the real early return in `createRecommendationRequest` is exercised directly rather than only verified by code review.
- TMDB or AI request failure mid-pipeline - `actions.test.ts` confirms a generic, non-leaking error message is returned to the client while the real error is still logged server-side (`console.error` is asserted to have been called).
- Unauthenticated call to `createRecommendationRequest` - `actions.test.ts`.
- AI returns an id not present in the candidate pool (hallucination) - `filterValidPicks` unit tests.
- Empty history/saved lists - both pages render an explicit "nothing yet" message rather than a blank page (verified manually).
- Invalid `page` query param (negative or non-numeric) on `/history` and `/saved` - Playwright confirms the page falls back to page 1 instead of erroring (`logged-in.spec.ts`).
- Rating the same recommendation twice - not separately tested. `recommendation_feedback` has a database-level `unique (user_id, source_tmdb_id, candidate_tmdb_id)` constraint and `rateRecommendation` upserts on that exact conflict target, so there's no application logic beyond "call upsert with the right conflict target" left to test once the schema and the one-line call are read together.
- Session expiring mid-flow - not automated. Time-based and inherently flaky to simulate reliably in a fast test suite; the session-refresh behavior itself (via `src/proxy.ts`) is exercised on every Playwright run since each test performs real requests through it.

### 7. Basic UI

- `RecommendForm.test.tsx`, `RateButtons.test.tsx` - button disabled states, error rendering, ARIA pressed-state on rating buttons.
- Playwright confirms key headings/labels render on `/history`, `/saved`, `/recommend`.

## Documented manual tests

Performed live during development (Aug 2026), against the real TMDB and Groq APIs and the real Supabase project:

1. **Full recommendation pipeline** - searched "The Matrix" (movie), reasoning: *"I loved the mind-bending reality-questioning premise, the stylish action, and the philosophical themes about choice versus fate."* Result: 6 real, TMDB-verified titles (e.g. *The Thirteenth Floor*, *Fahrenheit 451*) each with a specific AI-written explanation tied to the stated reasoning. Confirmed no invented/nonexistent titles appeared.
2. **Rate -> Saved flow** - rated "The Thirteenth Floor" 👍 from the results page; confirmed it immediately appeared on `/saved` with correct title, poster, and a working link out to its TMDB page.
3. **History** - confirmed the earlier Matrix search appeared on `/history` with the correct title and date, and linked back to its full results page with ratings preserved.
4. **Movie/TV toggle** - confirmed switching between Movie and TV Series clears the current search and restricts autocomplete/search results to the selected media type.

## Running the tests

- `npm test` - Vitest (unit + component), fast, no external dependencies.
- `npm run test:e2e` - Playwright, requires the dev server's environment variables configured (including a confirmed `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` test account for the logged-in suite) and TMDB/Supabase network access.
