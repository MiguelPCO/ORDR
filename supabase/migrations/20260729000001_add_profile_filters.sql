-- supabase/migrations/20260729000001_add_profile_filters.sql
alter table profiles
  add column dislikes text[] not null default '{}',
  add column fat_limit_g numeric,
  add column carb_limit_g numeric;
