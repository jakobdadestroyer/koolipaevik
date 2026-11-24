-- Koolipäeviku andmebaas. Kopeeri kogu see tekst Supabase'i: SQL Editor -> New query -> Run.
-- Iga kasutaja näeb ja muudab AINULT enda rida (Row Level Security).

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  diary      jsonb,
  notes      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "Oma andmete lugemine"   on public.user_data;
drop policy if exists "Oma andmete lisamine"   on public.user_data;
drop policy if exists "Oma andmete muutmine"   on public.user_data;
drop policy if exists "Oma andmete kustutamine" on public.user_data;

create policy "Oma andmete lugemine"    on public.user_data for select using (auth.uid() = user_id);
create policy "Oma andmete lisamine"    on public.user_data for insert with check (auth.uid() = user_id);
create policy "Oma andmete muutmine"    on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Oma andmete kustutamine" on public.user_data for delete using (auth.uid() = user_id);

-- Õigused sisselogitud kasutajatele (reeglid ülal piiravad need ainult oma reale)
grant select, insert, update, delete on public.user_data to authenticated;

-- AI-konspektide kasutuse arvestus (päevane piirang). Ligi pääseb ainult server (Edge Function).
create table if not exists public.ai_usage (
  id         bigserial primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_time on public.ai_usage (user_id, created_at);
alter table public.ai_usage enable row level security;
