create table public.notes (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content jsonb not null,
  plain_text text not null default '',
  excerpt text generated always as (left(plain_text, 200)) stored,
  -- Not a generated column: to_tsvector() is STABLE, not IMMUTABLE (Postgres
  -- considers text-search configs mutable), so it's kept up to date by the
  -- notes_search_vector_update trigger below instead.
  search_vector tsvector not null,
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  is_read_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_id_updated_at on public.notes(user_id, updated_at desc);
create index notes_user_id_created_at on public.notes(user_id, created_at desc);
create index notes_user_id_title on public.notes(user_id, title);
create index notes_user_id_favorite on public.notes(user_id, is_favorite) where is_favorite;
create index notes_tags_gin on public.notes using gin(tags);
create index notes_search_vector_gin on public.notes using gin(search_vector);

alter table public.notes enable row level security;

create policy "Users can view/edit their own notes" on public.notes
  for all using (auth.uid() = user_id);

-- Bump updated_at only when title or content change — tag/favorite/lock edits
-- preserve today's "last edited" semantics from the client store.
create or replace function update_notes_timestamp()
returns trigger as $$
begin
  new.updated_at = case
    when new.title is distinct from old.title
      or new.content is distinct from old.content then now()
    else old.updated_at
  end;
  return new;
end
$$ language plpgsql;

create trigger update_notes_timestamp
  before update on public.notes
  for each row
  execute function update_notes_timestamp();

-- Keeps search_vector in sync on every insert/update (see the column comment
-- above for why this can't be a generated column).
create or replace function notes_search_vector_update()
returns trigger as $$
begin
  new.search_vector := to_tsvector(
    'english',
    coalesce(new.title, '') || ' ' || coalesce(new.plain_text, '') || ' ' ||
      array_to_string(new.tags, ' ')
  );
  return new;
end
$$ language plpgsql;

create trigger notes_search_vector_update
  before insert or update on public.notes
  for each row
  execute function notes_search_vector_update();

grant select, insert, update, delete on public.notes to authenticated;
