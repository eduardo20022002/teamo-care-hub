
-- Profiles table (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);

-- Children table
create table public.children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  birth_date date not null,
  created_at timestamptz not null default now()
);
alter table public.children enable row level security;
create index children_user_id_idx on public.children(user_id);

create policy "children_select_own" on public.children for select to authenticated using (auth.uid() = user_id);
create policy "children_insert_own" on public.children for insert to authenticated with check (auth.uid() = user_id);
create policy "children_update_own" on public.children for update to authenticated using (auth.uid() = user_id);
create policy "children_delete_own" on public.children for delete to authenticated using (auth.uid() = user_id);

-- Audit logs
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create index audit_logs_user_id_idx on public.audit_logs(user_id);

create policy "audit_logs_select_own" on public.audit_logs for select to authenticated using (auth.uid() = user_id);
-- Allow inserting own success events; failures (anon) inserted via authenticated session prior or with null user via service role from server. Permit anon insert with user_id null for login failures.
create policy "audit_logs_insert_authenticated_own" on public.audit_logs for insert to authenticated with check (user_id is null or auth.uid() = user_id);
create policy "audit_logs_insert_anon_failure" on public.audit_logs for insert to anon with check (user_id is null);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
