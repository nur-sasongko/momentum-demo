-- One row per case-insensitive tag across the caller's whole library, with the
-- first-seen casing as the display value.
create or replace function get_note_tags()
returns table(tag text, note_count bigint)
language sql
security invoker
stable
as $$
  select min(t) as tag, count(*) as note_count
  from public.notes, unnest(tags) as t
  where user_id = auth.uid()
  group by lower(t)
  order by min(t);
$$;

-- Atomically replaces a tag (case-insensitive match) across every note that
-- carries it, de-duplicating within each row's array afterwards.
create or replace function rename_note_tag(old_tag text, new_tag text)
returns void
language plpgsql
security invoker
as $$
begin
  update public.notes n
  set tags = coalesce((
    select array_agg(x.tag order by x.ord)
    from (
      select distinct on (lower(mapped.tag)) mapped.tag, mapped.ord
      from (
        select
          case when lower(elem) = lower(old_tag) then new_tag else elem end as tag,
          ord
        from unnest(n.tags) with ordinality as u(elem, ord)
      ) mapped
      order by lower(mapped.tag), mapped.ord
    ) x
  ), '{}'::text[])
  where n.user_id = auth.uid()
    and exists (select 1 from unnest(n.tags) as t(v) where lower(t.v) = lower(old_tag));
end;
$$;

-- Removes a tag (case-insensitive match) from every note that carries it. The
-- notes themselves are untouched otherwise.
create or replace function delete_note_tag(target_tag text)
returns void
language plpgsql
security invoker
as $$
begin
  update public.notes n
  set tags = coalesce((
    select array_agg(elem order by ord)
    from unnest(n.tags) with ordinality as u(elem, ord)
    where lower(elem) <> lower(target_tag)
  ), '{}'::text[])
  where n.user_id = auth.uid()
    and exists (select 1 from unnest(n.tags) as t(v) where lower(t.v) = lower(target_tag));
end;
$$;

grant execute on function get_note_tags() to authenticated;
grant execute on function rename_note_tag(text, text) to authenticated;
grant execute on function delete_note_tag(text) to authenticated;
