-- CineMilar initial schema
-- Tables, indexes, Row Level Security policies, and the cross-user feedback
-- aggregate view described in docs/ARCHITECTURE.md.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- recommendation_requests: one row per search a user makes
-- ---------------------------------------------------------------------------
create table public.recommendation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_tmdb_id integer not null,
  source_media_type text not null check (source_media_type in ('movie', 'tv')),
  source_title text not null,
  reasoning text not null,
  created_at timestamptz not null default now()
);

create index idx_recommendation_requests_user_id
  on public.recommendation_requests(user_id);

alter table public.recommendation_requests enable row level security;

create policy "select own requests"
  on public.recommendation_requests for select
  using (auth.uid() = user_id);

create policy "insert own requests"
  on public.recommendation_requests for insert
  with check (auth.uid() = user_id);

create policy "delete own requests"
  on public.recommendation_requests for delete
  using (auth.uid() = user_id);

grant select, insert, delete on public.recommendation_requests to authenticated;

-- ---------------------------------------------------------------------------
-- recommendations: the ranked results belonging to a request
-- ---------------------------------------------------------------------------
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.recommendation_requests(id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster_path text,
  ai_explanation text,
  rank_position integer,
  created_at timestamptz not null default now()
);

create index idx_recommendations_request_id
  on public.recommendations(request_id);

alter table public.recommendations enable row level security;

create policy "select recommendations for own requests"
  on public.recommendations for select
  using (
    exists (
      select 1 from public.recommendation_requests r
      where r.id = recommendations.request_id
        and r.user_id = auth.uid()
    )
  );

create policy "insert recommendations for own requests"
  on public.recommendations for insert
  with check (
    exists (
      select 1 from public.recommendation_requests r
      where r.id = recommendations.request_id
        and r.user_id = auth.uid()
    )
  );

grant select, insert on public.recommendations to authenticated;

-- ---------------------------------------------------------------------------
-- recommendation_feedback: a user's save/rating on a recommended title;
-- also the raw signal behind the cross-user aggregate view below
-- ---------------------------------------------------------------------------
create table public.recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_tmdb_id integer not null,
  source_media_type text not null check (source_media_type in ('movie', 'tv')),
  candidate_tmdb_id integer not null,
  candidate_media_type text not null check (candidate_media_type in ('movie', 'tv')),
  candidate_title text not null,
  candidate_poster_path text,
  rating smallint not null check (rating in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (user_id, source_tmdb_id, candidate_tmdb_id)
);

create index idx_recommendation_feedback_user_id
  on public.recommendation_feedback(user_id);

create index idx_recommendation_feedback_source_candidate
  on public.recommendation_feedback(source_tmdb_id, candidate_tmdb_id);

alter table public.recommendation_feedback enable row level security;

create policy "select own feedback"
  on public.recommendation_feedback for select
  using (auth.uid() = user_id);

create policy "insert own feedback"
  on public.recommendation_feedback for insert
  with check (auth.uid() = user_id);

create policy "update own feedback"
  on public.recommendation_feedback for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own feedback"
  on public.recommendation_feedback for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.recommendation_feedback to authenticated;

-- ---------------------------------------------------------------------------
-- recommendation_feedback_aggregate: read-only view exposing only aggregated,
-- non-identifying stats (no user_id) so recommendations can benefit from
-- every user's feedback without exposing whose rating it was. Row Level
-- Security on recommendation_feedback still fully protects the raw rows.
-- ---------------------------------------------------------------------------
create view public.recommendation_feedback_aggregate as
select
  source_tmdb_id,
  candidate_tmdb_id,
  avg(rating)::numeric(3, 2) as avg_rating,
  count(*) as rating_count
from public.recommendation_feedback
group by source_tmdb_id, candidate_tmdb_id;

grant select on public.recommendation_feedback_aggregate to authenticated;
