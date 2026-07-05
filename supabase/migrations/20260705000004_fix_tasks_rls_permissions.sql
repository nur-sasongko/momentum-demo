-- Grant basic permissions to authenticated role
grant select, insert, update, delete on public.task_lists to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.subtasks to authenticated;

-- Grant usage on sequences if they exist
grant usage on all sequences in schema public to authenticated;
