-- Widen deadline to carry an explicit time-of-day. Existing date values are
-- cast to midnight of that date; app layer treats local midnight as the
-- "no explicit time set" sentinel.
alter table public.tasks
  alter column deadline type timestamptz using deadline::timestamptz;
