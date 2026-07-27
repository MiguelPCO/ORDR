create table analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete cascade,
  goal_snapshot jsonb not null,
  source_type text not null check (source_type in ('image', 'pdf', 'url')),
  source_meta jsonb,
  status text not null default 'processing' check (status in ('processing', 'done', 'error')),
  notes text,
  created_at timestamptz not null default now()
);

alter table analyses enable row level security;

create policy "own analyses" on analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
