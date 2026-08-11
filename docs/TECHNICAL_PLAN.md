# CineMilar - Detailed Technical Plan

## Folder structure

```
cinemilar/
  src/
    app/
      page.tsx                       landing page
      login/
        page.tsx
      recommend/
        page.tsx                     request form
        [requestId]/
          page.tsx                   results page
        actions.ts                   "use server" mutations for this flow
      history/
        page.tsx
      saved/
        page.tsx
      api/
        tmdb/
          search/
            route.ts                 GET title-search-as-you-type
    components/
      TitleSearchInput.tsx           client component, autocomplete
      RecommendationCard.tsx         displays one recommendation + rate buttons
      ReasoningForm.tsx               client component wrapping the request form
    lib/
      supabase/
        client.ts                    browser Supabase client
        server.ts                    server Supabase client
      tmdb.ts                        TMDB fetch helpers (server-only)
      gemini.ts                      Gemini call + prompt construction (server-only)
      validation.ts                  shared input validation (Zod schemas)
    types/
      database.ts                    TypeScript types matching the DB schema
  docs/
    PRODUCT_SPEC.md
    ARCHITECTURE.md
    TECHNICAL_PLAN.md
    TEST_PLAN.md
    SCALE.md
    SECURITY.md
  supabase/
    migrations/                      SQL for tables, RLS policies, the aggregate view
```

## Component structure

- Pages are **Server Components** by default (they fetch and render).
- `TitleSearchInput` and `ReasoningForm` are **Client Components** (`"use client"`) - they hold form state and call the autocomplete API / submit the Server Action.
- `RecommendationCard` is a Client Component only for its rate/save buttons (local optimistic state); the surrounding results page that fetches the list is a Server Component.

## Database structure

See `ARCHITECTURE.md` for the full schema (`recommendation_requests`, `recommendations`, `recommendation_feedback`, and the `recommendation_feedback_aggregate` view). RLS policies, in plain terms:

- `recommendation_requests`: select/insert/delete where `user_id = auth.uid()`
- `recommendations`: select where `request_id` belongs to a request owned by `auth.uid()`; insert only performed server-side immediately after creating the owning request
- `recommendation_feedback`: select/insert/update/delete where `user_id = auth.uid()`
- `recommendation_feedback_aggregate`: readable by any authenticated user (aggregated, non-identifying)

## Core CRUD operations

| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| `recommendation_requests` | `createRecommendationRequest` action | history page, results page | - | (future) delete-from-history |
| `recommendations` | inserted by `createRecommendationRequest` | results page | - | cascades with request |
| `recommendation_feedback` | `rateRecommendation` action | saved page, feeds aggregate view | `rateRecommendation` (upsert changes rating) | (future) un-save |

## API description

- **`GET /api/tmdb/search?q=...`** - proxies a TMDB title search server-side (keeps the TMDB key off the client), returns a small JSON list of `{ tmdbId, title, mediaType, year, posterPath }` for the autocomplete dropdown.
- **Server Actions** (`src/app/recommend/actions.ts`):
  - `createRecommendationRequest(formData)` -> returns the new `requestId` (or a validation error) and redirects
  - `rateRecommendation({ sourceTmdbId, sourceMediaType, candidate, rating })` -> upserts feedback

## Core business logic

`createRecommendationRequest`:
1. Confirm a logged-in session exists; reject otherwise.
2. Validate form input (title selected from autocomplete, not free-typed; reasoning text non-empty, length-capped).
3. Fetch the source title's TMDB details and a candidate pool (TMDB "similar"/genre+keyword search), capped to a reasonable number (e.g. 15-20) to bound the AI call size.
4. Send the candidate pool + user's reasoning to Gemini, asking it to select and rank the best-matching subset (e.g. top 6) **only from the given candidates**, with a short explanation each.
5. Insert one `recommendation_requests` row and the ranked `recommendations` rows.
6. Redirect to the results page.

## State management

- **Server state** (requests, recommendations, feedback) always read fresh from Supabase in Server Components - no client-side cache to keep in sync.
- **Client (UI) state**: form input values, autocomplete dropdown open/closed, per-card "saving..." indicator - local `useState` in the relevant Client Components only.

## Error handling

- TMDB/Gemini calls wrapped so failures produce a friendly message ("Couldn't fetch recommendations, please try again") instead of a crash; technical detail logged server-side only.
- `error.tsx` boundaries on `/recommend` and `/recommend/[requestId]` for unexpected failures.
- Server Actions return a typed result (`{ ok: true, requestId }` or `{ ok: false, error: string }`) so the UI can show a specific message rather than a generic failure.

## Input validation

- Zod schema (`lib/validation.ts`) shared conceptually between the client form (instant feedback) and the Server Action (actual enforcement): title must be a selected TMDB result (has a numeric `tmdbId`), reasoning must be non-empty and under a max length, rating must be `1` or `-1`.
- Every Server Action re-validates independently of what the client already checked.

## Key UX flow (the core loop)

1. User logs in, lands on `/recommend`.
2. Types a title -> autocomplete (via the API route) shows real TMDB matches -> user picks one.
3. Writes a sentence or two on what they liked.
4. Submits -> loading state -> redirected to `/recommend/[requestId]` showing a ranked list of posters + explanations.
5. User can rate (👍/👎) any card, which upserts into `recommendation_feedback` - reflected immediately with optimistic UI.
6. `/history` and `/saved` give paginated ways to revisit past activity.
