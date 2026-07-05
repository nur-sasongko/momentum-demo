alter table public.subtasks
  add column notes text,
  add column deadline timestamptz;
