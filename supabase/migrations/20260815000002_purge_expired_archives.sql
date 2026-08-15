-- Hard-deletes archived notes/transactions past the 30-day retention window,
-- across all users. SECURITY DEFINER because this runs unattended via
-- pg_cron (no auth.uid() in that context, so RLS cannot scope the delete —
-- the function body is the scope instead). Not granted to `authenticated`:
-- the client never calls this directly.
--
-- Keep the retention window here in sync with ARCHIVE_RETENTION_DAYS in
-- src/utils/archive.ts (that constant is presentational only — it never
-- drives a delete).
create or replace function public.purge_expired_archives()
returns table(notes_purged bigint, transactions_purged bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - interval '30 days';
  n bigint;
  t bigint;
begin
  with d as (
    delete from public.notes
    where deleted_at is not null and deleted_at < cutoff
    returning 1
  )
  select count(*) into n from d;

  with d as (
    delete from public.finance_transactions
    where deleted_at is not null and deleted_at < cutoff
    returning 1
  )
  select count(*) into t from d;

  return query select n, t;
end;
$$;

revoke all on function public.purge_expired_archives() from public, anon, authenticated;
