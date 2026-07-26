-- Optional per-transaction location, captured via a Google Maps picker in the UI.
-- Denormalized directly onto finance_transactions (no lookup table): a place is a
-- one-off fact about a transaction, not a reusable/managed entity like a category.
alter table public.finance_transactions
  add column location_place_name text,
  add column location_address text,
  add column location_city text,
  add column location_country text,
  add column location_maps_url text;

-- Supports GROUP BY city / country for the spending-by-location chart.
create index finance_transactions_location_city on public.finance_transactions(location_city);
create index finance_transactions_location_country on public.finance_transactions(location_country);
