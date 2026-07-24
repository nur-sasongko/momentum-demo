create table public.finance_transactions (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.finance_categories(id) on delete restrict,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  date date not null,
  note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index finance_transactions_user_id on public.finance_transactions(user_id);
create index finance_transactions_user_id_date on public.finance_transactions(user_id, date);
create index finance_transactions_category_id on public.finance_transactions(category_id);

alter table public.finance_transactions enable row level security;

create policy "Users can view/edit their own finance transactions" on public.finance_transactions
  for all using (auth.uid() = user_id);

-- Auto-update updated_at on modifications
create or replace function update_finance_transaction_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end
$$ language plpgsql;

create trigger update_finance_transactions_timestamp
  before update on public.finance_transactions
  for each row
  execute function update_finance_transaction_timestamp();

-- Reassign transactions to the same-type 'Other' (system) category before deleting a category.
-- This prevents orphaned transactions and preserves data when users remove custom categories.
create or replace function reassign_transactions_on_category_delete()
returns trigger as $$
declare
  other_category_id uuid;
begin
  if old.is_system then
    raise exception 'Cannot delete a system category';
  end if;

  select id into other_category_id
  from public.finance_categories
  where user_id = old.user_id
    and name = 'Other'
    and type = old.type
    and is_system = true
  limit 1;

  if other_category_id is null then
    raise exception 'System Other category not found for this user/type';
  end if;

  update public.finance_transactions
  set category_id = other_category_id
  where category_id = old.id;

  return old;
end
$$ language plpgsql;

create trigger reassign_transactions_before_category_delete
  before delete on public.finance_categories
  for each row
  execute function reassign_transactions_on_category_delete();

grant select, insert, update, delete on public.finance_transactions to authenticated;
