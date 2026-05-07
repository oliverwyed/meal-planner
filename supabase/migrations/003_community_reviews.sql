-- Community meals: recipes published by any household, visible to all
create table if not exists community_meals (
  id                  uuid primary key default gen_random_uuid(),
  meal_data           jsonb not null,
  source_url          text,
  photo_url           text,
  source_household_id uuid references households(id) on delete set null,
  published_at        timestamptz not null default now()
);

alter table community_meals enable row level security;
create policy "community meals public read"   on community_meals for select using (true);
create policy "community meals public insert" on community_meals for insert with check (true);
create policy "community meals public delete" on community_meals for delete using (true);

-- Recipe reviews: star ratings + comments on any meal, keyed by recipe name
create table if not exists recipe_reviews (
  id           uuid primary key default gen_random_uuid(),
  recipe_name  text not null,
  stars        int  not null check (stars between 1 and 5),
  comment      text,
  household_id uuid references households(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table recipe_reviews enable row level security;
create policy "reviews public read"   on recipe_reviews for select using (true);
create policy "reviews public insert" on recipe_reviews for insert with check (true);
create policy "reviews public delete" on recipe_reviews for delete using (true);

-- Storage bucket for user-uploaded recipe photos (public read)
insert into storage.buckets (id, name, public)
  values ('recipe-photos', 'recipe-photos', true)
  on conflict (id) do nothing;

create policy "recipe photos read"   on storage.objects for select using (bucket_id = 'recipe-photos');
create policy "recipe photos insert" on storage.objects for insert with check (bucket_id = 'recipe-photos');
