create table public.finance_categories (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  color text not null,
  is_system boolean not null default false, -- system categories (Other) cannot be deleted
  created_at timestamp with time zone not null default now(),

  unique(user_id, name, type)
);

create index finance_categories_user_id_type on public.finance_categories(user_id, type);

alter table public.finance_categories enable row level security;

create policy "Users can view/edit their own finance categories" on public.finance_categories
  for all using (auth.uid() = user_id);

grant select, insert, update, delete on public.finance_categories to authenticated;
grant usage on all sequences in schema public to authenticated;
