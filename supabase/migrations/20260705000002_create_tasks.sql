create table public.tasks (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null references public.task_lists(id) on delete restrict, -- restrict prevents orphaned tasks; reassign in mutation
  title text not null,
  notes text, -- optional task description
  deadline date, -- optional ISO date
  starred boolean not null default false,
  completed boolean not null default false,
  completed_at timestamp with time zone, -- set when completed = true
  "order" int not null default 0, -- position within its list column
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint valid_completed check (
    (completed = false and completed_at is null) or
    (completed = true and completed_at is not null)
  )
);

create index tasks_user_id on public.tasks(user_id);
create index tasks_list_id on public.tasks(list_id);
create index tasks_user_id_completed on public.tasks(user_id, completed);
create index tasks_user_id_starred on public.tasks(user_id, starred);

alter table public.tasks enable row level security;

create policy "Users can view/edit their own tasks" on public.tasks
  for all using (auth.uid() = user_id);

-- Auto-update updated_at on task modifications
create or replace function update_task_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end
$$ language plpgsql;

create trigger update_tasks_timestamp
  before update on public.tasks
  for each row
  execute function update_task_timestamp();
