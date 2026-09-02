alter table dishes add column eaten_at timestamptz;

-- Fuerza "solo un plato comido por análisis" también a nivel DB, no solo en la UI.
create unique index dishes_one_eaten_per_analysis
  on dishes (analysis_id)
  where eaten_at is not null;
