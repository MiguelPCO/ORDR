create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  sex text not null check (sex in ('male', 'female')),
  birth_date date not null,
  height_cm numeric not null,
  weight_kg numeric not null,
  activity_level text not null check (
    activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')
  ),
  diet text not null check (diet in ('none', 'vegan', 'vegetarian', 'keto')),
  allergies text[] not null default '{}',
  goal text not null check (goal in ('cut', 'bulk', 'maintain')),
  meals_per_day int not null default 3,
  protein_g_per_kg numeric not null default 2.0,
  manual_tdee int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
