create table dishes (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references analyses (id) on delete cascade,
  name text not null,
  reason text,
  nutrition_query text not null,
  assumptions text,
  conflicts text[] not null default '{}',
  approx_macros jsonb,
  grounded_macros jsonb,
  llm_draft_verdict text,
  final_verdict text not null check (final_verdict in ('green', 'amber', 'red')),
  fit_score numeric not null,
  rank int not null
);

alter table dishes enable row level security;

create policy "own dishes" on dishes for all using (
  exists (select 1 from analyses a where a.id = dishes.analysis_id and a.user_id = auth.uid())
);
