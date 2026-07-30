-- Widen transaction date to carry an explicit time-of-day. Existing date
-- values are cast to midnight of that date; app layer treats local midnight
-- as the "no explicit time set" sentinel (mirrors tasks.deadline).
alter table public.finance_transactions
  alter column date type timestamptz using date::timestamptz;
