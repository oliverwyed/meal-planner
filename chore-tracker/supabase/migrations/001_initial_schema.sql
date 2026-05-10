-- Profiles (one per auth user)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can view all profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Tasks
create table tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  recurrence_days int not null default 7,
  assigned_to uuid not null references profiles(id) on delete cascade,
  last_completed_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);

alter table tasks enable row level security;
create policy "Authenticated users can view all tasks" on tasks for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert tasks" on tasks for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update tasks" on tasks for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete tasks" on tasks for delete using (auth.role() = 'authenticated');

-- Completions (audit log)
create table completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  completed_by uuid not null references profiles(id),
  completed_at timestamptz default now()
);

alter table completions enable row level security;
create policy "Authenticated users can view completions" on completions for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert completions" on completions for insert with check (auth.role() = 'authenticated');

-- Push subscriptions (one per user per browser)
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;
create policy "Users can manage own push subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Allow edge functions (service role) to read push_subscriptions and tasks
-- No additional policy needed — service role bypasses RLS
