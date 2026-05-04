-- Households — the atomic unit; two devices share one row
create table households (
  id          uuid primary key default gen_random_uuid(),
  invite_code text unique not null
    default upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  family_size integer not null default 4,
  created_at  timestamptz default now()
);

-- All shared state stored as a single JSONB document per household.
-- This mirrors the localStorage shape so the port is minimal, and
-- avoids multi-table merge complexity for a 2-user app.
create table household_state (
  household_id  uuid primary key references households(id) on delete cascade,
  plan          jsonb,
  day_config    jsonb not null default '{}',
  kids_config   jsonb not null default '{}',
  day_overrides jsonb not null default '{}',
  preferences   jsonb not null default '{"favourites":[],"dislikes":[],"pantry":"","dietaryMode":"none","timeFilter":"any"}',
  cook_history  jsonb not null default '[]',
  updated_at    timestamptz default now()
);

-- Custom & imported meals live separately so they can be edited individually
create table custom_meals (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  meal_data    jsonb not null,
  source_url   text,
  created_at   timestamptz default now()
);

-- RLS: any request that knows the household_id can read/write their rows.
-- The UUID is unguessable; this is the appropriate security model for a
-- private household app with no sensitive PII.
alter table households       enable row level security;
alter table household_state  enable row level security;
alter table custom_meals     enable row level security;

-- Allow anonymous (no JWT) access scoped to household_id.
-- In production you'd use a signed JWT; for a household app this is fine.
create policy "household access" on households
  for all using (true);
create policy "household access" on household_state
  for all using (true);
create policy "household access" on custom_meals
  for all using (true);

-- Trigger: keep updated_at current on household_state
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger household_state_updated_at
  before update on household_state
  for each row execute procedure touch_updated_at();

-- Convenience: insert default state row when a household is created
create or replace function init_household_state()
returns trigger language plpgsql as $$
begin
  insert into household_state(household_id) values(new.id);
  return new;
end;
$$;

create trigger on_household_created
  after insert on households
  for each row execute procedure init_household_state();

-- Enable Realtime on household_state so both devices get live updates
alter publication supabase_realtime add table household_state;
alter publication supabase_realtime add table custom_meals;
