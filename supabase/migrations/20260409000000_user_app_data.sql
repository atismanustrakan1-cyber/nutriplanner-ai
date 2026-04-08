-- One row per authenticated user: mirrors localStorage JSON blobs (targets, meals, settings, weekly planner).
create table if not exists public.user_app_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  targets jsonb,
  meals jsonb,
  settings jsonb,
  weekly_events jsonb,
  updated_at timestamptz not null default now(),
  constraint user_app_data_user_id_key unique (user_id)
);

alter table public.user_app_data enable row level security;

create policy "user_app_data_select_own"
  on public.user_app_data
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_app_data_insert_own"
  on public.user_app_data
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_app_data_update_own"
  on public.user_app_data
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_app_data_delete_own"
  on public.user_app_data
  for delete
  to authenticated
  using (auth.uid() = user_id);
