create table public.task_lists (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text, -- optional hex color (e.g. '#FF5733'), null defaults to neutral gray
  "order" int not null default 0, -- column/sidebar order
  created_at timestamp with time zone not null default now(),

  unique(user_id, name) -- user can't have duplicate list names
);

create index task_lists_user_id_order on public.task_lists(user_id, "order");

alter table public.task_lists enable row level security;

create policy "Users can view/edit their own lists" on public.task_lists
  for all using (auth.uid() = user_id);
