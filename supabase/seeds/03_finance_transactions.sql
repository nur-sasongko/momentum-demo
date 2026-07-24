-- ── Finance transactions for demo user ────────────────────────────────────────
-- ~50 transactions spread across the current month and 3 prior months.
-- Dates use date arithmetic so data is always recent after a db reset.

do $$
declare
  uid              uuid := 'a1b2c3d4-0000-0000-0000-000000000001';
  -- expense categories
  id_food          uuid := 'c0000001-0000-0000-0000-000000000001';
  id_transport     uuid := 'c0000001-0000-0000-0000-000000000002';
  id_shopping      uuid := 'c0000001-0000-0000-0000-000000000003';
  id_bills         uuid := 'c0000001-0000-0000-0000-000000000004';
  id_entertainment uuid := 'c0000001-0000-0000-0000-000000000005';
  id_health        uuid := 'c0000001-0000-0000-0000-000000000006';
  id_travel        uuid := 'c0000001-0000-0000-0000-000000000007';
  -- income categories
  id_salary        uuid := 'c0000001-0000-0000-0000-000000000011';
  id_freelance     uuid := 'c0000001-0000-0000-0000-000000000012';
  id_investment    uuid := 'c0000001-0000-0000-0000-000000000013';
  -- month anchors (1st of each month)
  m0 date := date_trunc('month', current_date)::date;
  m1 date := (date_trunc('month', current_date) - interval '1 month')::date;
  m2 date := (date_trunc('month', current_date) - interval '2 months')::date;
  m3 date := (date_trunc('month', current_date) - interval '3 months')::date;
begin
  insert into public.finance_transactions
    (user_id, category_id, type, amount, date, note)
  values
    -- ── current month ──────────────────────────────────────────────────────
    (uid, id_salary,        'income',  4500000, m0 +  0, 'Monthly salary'),
    (uid, id_bills,         'expense',   850000, m0 +  1, 'Rent'),
    (uid, id_bills,         'expense',     94500, m0 +  2, 'Electricity bill'),
    (uid, id_food,          'expense',     78200, m0 +  3, 'Weekly groceries'),
    (uid, id_transport,     'expense',     32000, m0 +  4, 'Train pass top-up'),
    (uid, id_food,          'expense',     22500, m0 +  5, 'Lunch with colleagues'),
    (uid, id_entertainment, 'expense',     15990, m0 +  6, 'Streaming subscription'),
    (uid, id_shopping,      'expense',     64000, m0 +  7, 'New headphones'),
    (uid, id_health,        'expense',     49000, m0 +  8, 'Gym membership'),
    (uid, id_food,          'expense',     12800, m0 +  9, 'Coffee & snacks'),
    (uid, id_freelance,     'income',    750000, m0 + 10, 'Logo design project'),
    (uid, id_transport,     'expense',     18400, m0 + 11, 'Uber to airport'),
    (uid, id_food,          'expense',     91300, m0 + 12, 'Grocery run'),

    -- ── 1 month ago ────────────────────────────────────────────────────────
    (uid, id_salary,        'income',  4500000, m1 +  0, 'Monthly salary'),
    (uid, id_bills,         'expense',   850000, m1 +  1, 'Rent'),
    (uid, id_bills,         'expense',     88700, m1 +  2, 'Internet & phone bill'),
    (uid, id_food,          'expense',     67400, m1 +  3, 'Supermarket'),
    (uid, id_entertainment, 'expense',     42000, m1 +  5, 'Cinema tickets (x2)'),
    (uid, id_transport,     'expense',     25600, m1 +  6, 'Taxi'),
    (uid, id_shopping,      'expense',   129990, m1 +  8, 'Running shoes'),
    (uid, id_health,        'expense',     49000, m1 +  9, 'Gym membership'),
    (uid, id_food,          'expense',     54200, m1 + 11, 'Restaurant dinner'),
    (uid, id_investment,    'income',    320000, m1 + 14, 'Dividend payout'),
    (uid, id_freelance,     'income',  1200000, m1 + 18, 'Website redesign — phase 1'),
    (uid, id_travel,        'expense',   410000, m1 + 20, 'Weekend trip flights'),
    (uid, id_travel,        'expense',   195000, m1 + 21, 'Hotel (2 nights)'),
    (uid, id_food,          'expense',     38900, m1 + 22, 'Groceries'),
    (uid, id_entertainment, 'expense',     19990, m1 + 24, 'E-book bundle'),

    -- ── 2 months ago ───────────────────────────────────────────────────────
    (uid, id_salary,        'income',  4500000, m2 +  0, 'Monthly salary'),
    (uid, id_bills,         'expense',   850000, m2 +  1, 'Rent'),
    (uid, id_bills,         'expense',   102300, m2 +  3, 'Electricity (higher, winter)'),
    (uid, id_food,          'expense',     85600, m2 +  4, 'Weekly groceries'),
    (uid, id_transport,     'expense',     32000, m2 +  5, 'Train pass'),
    (uid, id_health,        'expense',     49000, m2 +  6, 'Gym membership'),
    (uid, id_shopping,      'expense',   230000, m2 +  8, 'Winter jacket'),
    (uid, id_food,          'expense',     47100, m2 + 10, 'Dinner out'),
    (uid, id_entertainment, 'expense',     15990, m2 + 12, 'Streaming subscription'),
    (uid, id_freelance,     'income',    550000, m2 + 15, 'Consulting (half day)'),
    (uid, id_food,          'expense',     73200, m2 + 17, 'Groceries'),
    (uid, id_transport,     'expense',     14500, m2 + 19, 'Bus rides'),
    (uid, id_investment,    'income',    180000, m2 + 20, 'ETF dividend'),
    (uid, id_shopping,      'expense',     58000, m2 + 22, 'Books'),

    -- ── 3 months ago ───────────────────────────────────────────────────────
    (uid, id_salary,        'income',  4500000, m3 +  0, 'Monthly salary'),
    (uid, id_bills,         'expense',   850000, m3 +  1, 'Rent'),
    (uid, id_bills,         'expense',     91800, m3 +  2, 'Utilities'),
    (uid, id_food,          'expense',     69900, m3 +  3, 'Groceries'),
    (uid, id_transport,     'expense',     32000, m3 +  4, 'Train pass'),
    (uid, id_health,        'expense',     49000, m3 +  5, 'Gym membership'),
    (uid, id_entertainment, 'expense',     28000, m3 +  7, 'Concert ticket'),
    (uid, id_food,          'expense',     61500, m3 +  9, 'Supermarket run'),
    (uid, id_freelance,     'income',    900000, m3 + 12, 'App UI audit'),
    (uid, id_shopping,      'expense',     44900, m3 + 14, 'Kitchenware'),
    (uid, id_investment,    'income',    240000, m3 + 16, 'Stock dividend'),
    (uid, id_food,          'expense',     35400, m3 + 18, 'Takeaway'),
    (uid, id_travel,        'expense',   320000, m3 + 22, 'Train tickets (holiday)'),
    (uid, id_entertainment, 'expense',     15990, m3 + 24, 'Streaming subscription')
  ;
end $$;
