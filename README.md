# CineMilar

Tell us a movie or TV series you loved — and why — and get real, TMDB-grounded, AI-ranked recommendations for what to watch next.

**Live app:** https://cine-milar.vercel.app
**Course:** Internet Technologies — RUNI CS 2026

## Tech stack

- **Next.js** (App Router) + **TypeScript**
- **Supabase** — Postgres database + Authentication (with Row Level Security)
- **TMDB API** — real movie/TV data and candidate discovery
- **Groq API** (`openai/gpt-oss-20b`) — ranks and explains recommendations from the TMDB-grounded candidate pool
- **Vitest** + **React Testing Library** + **Playwright** — testing
- Deployed on **Vercel**

See [`docs/`](docs/) for the full product spec, architecture, technical plan, test plan, scale, and security write-ups.

## Local setup

1. **Clone and install**

   ```bash
   git clone https://github.com/omrikantor/CineMilar.git
   cd CineMilar
   npm install
   ```

2. **Create `.env.local`** in the project root with the following variables (see "Environment variables" below for where to get each one):

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   TMDB_API_KEY=
   GROQ_API_KEY=
   ```

3. **Set up the database** — in your Supabase project's SQL Editor, run the script in [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql). This creates all tables, indexes, and Row Level Security policies.

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → anon/publishable key |
| `TMDB_API_KEY` | themoviedb.org → account → API settings (free) |
| `GROQ_API_KEY` | console.groq.com → API Keys (free tier, no billing required) |

For local development, also add `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` (a confirmed Supabase test account) if you want to run the logged-in Playwright tests.

## Testing

```bash
npm test          # Vitest — unit + component tests
npm run test:e2e  # Playwright — end-to-end tests (starts the dev server automatically)
```

See [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) for what's covered and why.

## Project structure

```
src/
  app/            Pages, layouts, Server Actions, the one API route
  components/     Shared UI (Nav)
  lib/            Supabase clients, TMDB/Groq API wrappers, validation, candidate-pool logic
  types/          TypeScript types matching the database schema
supabase/
  migrations/     Database schema (tables, RLS policies, the feedback aggregate view)
e2e/              Playwright tests
docs/             Product spec, architecture, technical plan, test plan, scale, security
```
