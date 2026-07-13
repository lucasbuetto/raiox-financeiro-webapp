create table if not exists public.finance_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_states enable row level security;

drop policy if exists "Users can read own finance state" on public.finance_states;
create policy "Users can read own finance state"
  on public.finance_states
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own finance state" on public.finance_states;
create policy "Users can insert own finance state"
  on public.finance_states
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own finance state" on public.finance_states;
create policy "Users can update own finance state"
  on public.finance_states
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists finance_states_set_updated_at on public.finance_states;
create trigger finance_states_set_updated_at
  before update on public.finance_states
  for each row
  execute function public.set_updated_at();
