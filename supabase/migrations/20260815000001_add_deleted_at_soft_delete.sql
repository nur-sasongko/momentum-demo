-- Soft delete for notes and finance_transactions. `deleted_at` null means
-- live; a timestamp means archived. Live queries filter `deleted_at is null`
-- at the read site (see notes-queries.ts / finance-queries.ts `liveOnly()`).
-- Restore is `update ... set deleted_at = null`; hard delete is only ever
-- issued against rows that already have a `deleted_at` set.

alter table public.notes                add column deleted_at timestamptz;
alter table public.finance_transactions add column deleted_at timestamptz;

-- Archive list reads: user's archived rows, newest-deleted first.
create index notes_user_id_deleted_at
  on public.notes(user_id, deleted_at desc) where deleted_at is not null;
create index finance_transactions_user_id_deleted_at
  on public.finance_transactions(user_id, deleted_at desc) where deleted_at is not null;

-- Hot live-read paths become partial so archived rows are not scanned.
drop index if exists notes_user_id_updated_at;
create index notes_user_id_updated_at
  on public.notes(user_id, updated_at desc) where deleted_at is null;

drop index if exists finance_transactions_user_id_date;
create index finance_transactions_user_id_date
  on public.finance_transactions(user_id, date) where deleted_at is null;

-- Tag aggregate must describe the *live* library only — an archived note
-- must not keep a tag chip alive in the sidebar. `rename_note_tag` and
-- `delete_note_tag` (supabase/migrations/20260808000002_create_notes_tag_functions.sql)
-- are deliberately left untouched: they must keep operating on archived
-- notes too, otherwise restoring a note could resurrect a tag name/value the
-- user already renamed or deleted away.
create or replace function get_note_tags()
returns table(tag text, note_count bigint)
language sql
security invoker
stable
as $$
  select min(t) as tag, count(*) as note_count
  from public.notes, unnest(tags) as t
  where user_id = auth.uid()
    and deleted_at is null
  group by lower(t)
  order by min(t);
$$;
