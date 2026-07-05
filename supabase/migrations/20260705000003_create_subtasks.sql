create table public.subtasks (
  id uuid not null default gen_random_uuid() primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  created_at timestamp with time zone not null default now(),

  unique(task_id, title) -- task can't have duplicate subtask titles
);

create index subtasks_task_id on public.subtasks(task_id);

alter table public.subtasks enable row level security;

create policy "Users can view/edit subtasks of their own tasks" on public.subtasks
  for all using (
    exists (select 1 from public.tasks where id = task_id and user_id = auth.uid())
  );
