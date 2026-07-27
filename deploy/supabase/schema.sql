-- MaalBot — Optional cloud sync schema (Supabase)
-- ---------------------------------------------------
-- Right now sessions/settings live only in browser localStorage — clear
-- your browser data and everything's gone, and it doesn't follow you to
-- another device. This schema + auth-helper.js adds real accounts (email
-- or Google login) and syncs sessions to the cloud.
--
-- SETUP:
-- 1. Create a free project at https://supabase.com
-- 2. Project → SQL Editor → paste this file → Run
-- 3. Project → Settings → API → copy your Project URL + anon public key
-- 4. Put them into deploy/supabase/auth-helper.js (see placeholders there)
-- 5. Enable Email or Google auth under Authentication → Providers
-- 6. Import auth-helper.js from app.js and swap the Storage.* calls for
--    the sync* functions it exports (see comments in that file)

create table if not exists public.sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'New Strategy Session',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  model text default 'llama-3.3-70b-versatile',
  temperature numeric default 0.7,
  theme text default 'dark'
);

-- Row Level Security: users can only ever see/edit their own rows
alter table public.sessions enable row level security;
alter table public.user_settings enable row level security;

create policy "Users manage their own sessions"
  on public.sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own settings"
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
