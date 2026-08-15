-- Schedules purge_expired_archives() to run daily via pg_cron. Guarded so
-- this migration applies cleanly on a database without pg_cron available
-- (local resets, a self-hosted instance, CI) — the extension is optional,
-- not a hard requirement of the app. Without it, purge_expired_archives()
-- still exists and can be invoked manually; the app works fully, just
-- without automatic expiry.
--
-- unschedule-before-schedule makes this migration re-runnable against a
-- database that already has the job.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema extensions';

    perform cron.unschedule('purge-expired-archives')
    where exists (select 1 from cron.job where jobname = 'purge-expired-archives');

    perform cron.schedule(
      'purge-expired-archives',
      '0 3 * * *',
      $cron$select public.purge_expired_archives()$cron$
    );
  else
    raise notice 'pg_cron unavailable — purge_expired_archives() must be invoked manually';
  end if;
end
$$;
