-- ── Finance transactions for demo user ────────────────────────────────────────
-- ~50 transactions spread across the current month and 3 prior months.
-- Dates use date arithmetic so data is always recent after a db reset.

do $$
declare
  uid              uuid := 'a1b2c3d4-0000-0000-0000-000000000001';
  -- reusable mock locations (place, address, city, country, maps url)
  loc_super        text[] := array['Whole Foods Market', '4 Union Square S', 'New York', 'United States', 'https://maps.google.com/?q=Whole+Foods+Market+New+York'];
  loc_cafe         text[] := array['Blue Bottle Coffee', '1 Ferry Building', 'San Francisco', 'United States', 'https://maps.google.com/?q=Blue+Bottle+Coffee+San+Francisco'];
  loc_gym          text[] := array['Equinox Fitness', '895 Broadway', 'New York', 'United States', 'https://maps.google.com/?q=Equinox+Fitness+New+York'];
  loc_cinema       text[] := array['AMC Empire 25', '234 W 42nd St', 'New York', 'United States', 'https://maps.google.com/?q=AMC+Empire+25+New+York'];
  loc_electronics  text[] := array['Best Buy', '1 Union Square W', 'New York', 'United States', 'https://maps.google.com/?q=Best+Buy+Union+Square+New+York'];
  loc_restaurant   text[] := array['Katz''s Delicatessen', '205 E Houston St', 'New York', 'United States', 'https://maps.google.com/?q=Katzs+Delicatessen+New+York'];
  loc_mall         text[] := array['Westfield San Francisco Centre', '865 Market St', 'San Francisco', 'United States', 'https://maps.google.com/?q=Westfield+San+Francisco+Centre'];
  loc_airport      text[] := array['San Francisco International Airport', 'S McDonnell Rd', 'San Francisco', 'United States', 'https://maps.google.com/?q=San+Francisco+International+Airport'];
  loc_hotel        text[] := array['Hotel Nikko', '222 Mason St', 'San Francisco', 'United States', 'https://maps.google.com/?q=Hotel+Nikko+San+Francisco'];
  loc_bookstore    text[] := array['Powell''s Books', '1005 W Burnside St', 'Portland', 'United States', 'https://maps.google.com/?q=Powells+Books+Portland'];
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
    (user_id, category_id, type, amount, date, note,
     location_place_name, location_address, location_city, location_country, location_maps_url)
  values
    -- ── current month ──────────────────────────────────────────────────────
    (uid, id_salary,        'income',  4500000, m0 +  0, 'Monthly salary',            null, null, null, null, null),
    (uid, id_bills,         'expense',   850000, m0 +  1, 'Rent',                      null, null, null, null, null),
    (uid, id_bills,         'expense',     94500, m0 +  2, 'Electricity bill',          null, null, null, null, null),
    (uid, id_food,          'expense',     78200, m0 +  3, 'Weekly groceries',          loc_super[1], loc_super[2], loc_super[3], loc_super[4], loc_super[5]),
    (uid, id_transport,     'expense',     32000, m0 +  4, 'Train pass top-up',         null, null, null, null, null),
    (uid, id_food,          'expense',     22500, m0 +  5, 'Lunch with colleagues',     loc_restaurant[1], loc_restaurant[2], loc_restaurant[3], loc_restaurant[4], loc_restaurant[5]),
    (uid, id_entertainment, 'expense',     15990, m0 +  6, 'Streaming subscription',    null, null, null, null, null),
    (uid, id_shopping,      'expense',     64000, m0 +  7, 'New headphones',            loc_electronics[1], loc_electronics[2], loc_electronics[3], loc_electronics[4], loc_electronics[5]),
    (uid, id_health,        'expense',     49000, m0 +  8, 'Gym membership',            loc_gym[1], loc_gym[2], loc_gym[3], loc_gym[4], loc_gym[5]),
    (uid, id_food,          'expense',     12800, m0 +  9, 'Coffee & snacks',           loc_cafe[1], loc_cafe[2], loc_cafe[3], loc_cafe[4], loc_cafe[5]),
    (uid, id_freelance,     'income',    750000, m0 + 10, 'Logo design project',        null, null, null, null, null),
    (uid, id_transport,     'expense',     18400, m0 + 11, 'Uber to airport',           loc_airport[1], loc_airport[2], loc_airport[3], loc_airport[4], loc_airport[5]),
    (uid, id_food,          'expense',     91300, m0 + 12, 'Grocery run',               loc_super[1], loc_super[2], loc_super[3], loc_super[4], loc_super[5]),

    -- ── 1 month ago ────────────────────────────────────────────────────────
    (uid, id_salary,        'income',  4500000, m1 +  0, 'Monthly salary',            null, null, null, null, null),
    (uid, id_bills,         'expense',   850000, m1 +  1, 'Rent',                      null, null, null, null, null),
    (uid, id_bills,         'expense',     88700, m1 +  2, 'Internet & phone bill',      null, null, null, null, null),
    (uid, id_food,          'expense',     67400, m1 +  3, 'Supermarket',               loc_super[1], loc_super[2], loc_super[3], loc_super[4], loc_super[5]),
    (uid, id_entertainment, 'expense',     42000, m1 +  5, 'Cinema tickets (x2)',       loc_cinema[1], loc_cinema[2], loc_cinema[3], loc_cinema[4], loc_cinema[5]),
    (uid, id_transport,     'expense',     25600, m1 +  6, 'Taxi',                      null, null, null, null, null),
    (uid, id_shopping,      'expense',   129990, m1 +  8, 'Running shoes',              loc_mall[1], loc_mall[2], loc_mall[3], loc_mall[4], loc_mall[5]),
    (uid, id_health,        'expense',     49000, m1 +  9, 'Gym membership',            loc_gym[1], loc_gym[2], loc_gym[3], loc_gym[4], loc_gym[5]),
    (uid, id_food,          'expense',     54200, m1 + 11, 'Restaurant dinner',         loc_restaurant[1], loc_restaurant[2], loc_restaurant[3], loc_restaurant[4], loc_restaurant[5]),
    (uid, id_investment,    'income',    320000, m1 + 14, 'Dividend payout',            null, null, null, null, null),
    (uid, id_freelance,     'income',  1200000, m1 + 18, 'Website redesign — phase 1',  null, null, null, null, null),
    (uid, id_travel,        'expense',   410000, m1 + 20, 'Weekend trip flights',       loc_airport[1], loc_airport[2], loc_airport[3], loc_airport[4], loc_airport[5]),
    (uid, id_travel,        'expense',   195000, m1 + 21, 'Hotel (2 nights)',           loc_hotel[1], loc_hotel[2], loc_hotel[3], loc_hotel[4], loc_hotel[5]),
    (uid, id_food,          'expense',     38900, m1 + 22, 'Groceries',                 loc_super[1], loc_super[2], loc_super[3], loc_super[4], loc_super[5]),
    (uid, id_entertainment, 'expense',     19990, m1 + 24, 'E-book bundle',             null, null, null, null, null),

    -- ── 2 months ago ───────────────────────────────────────────────────────
    (uid, id_salary,        'income',  4500000, m2 +  0, 'Monthly salary',            null, null, null, null, null),
    (uid, id_bills,         'expense',   850000, m2 +  1, 'Rent',                      null, null, null, null, null),
    (uid, id_bills,         'expense',   102300, m2 +  3, 'Electricity (higher, winter)', null, null, null, null, null),
    (uid, id_food,          'expense',     85600, m2 +  4, 'Weekly groceries',          loc_super[1], loc_super[2], loc_super[3], loc_super[4], loc_super[5]),
    (uid, id_transport,     'expense',     32000, m2 +  5, 'Train pass',                null, null, null, null, null),
    (uid, id_health,        'expense',     49000, m2 +  6, 'Gym membership',            loc_gym[1], loc_gym[2], loc_gym[3], loc_gym[4], loc_gym[5]),
    (uid, id_shopping,      'expense',   230000, m2 +  8, 'Winter jacket',              loc_mall[1], loc_mall[2], loc_mall[3], loc_mall[4], loc_mall[5]),
    (uid, id_food,          'expense',     47100, m2 + 10, 'Dinner out',                loc_restaurant[1], loc_restaurant[2], loc_restaurant[3], loc_restaurant[4], loc_restaurant[5]),
    (uid, id_entertainment, 'expense',     15990, m2 + 12, 'Streaming subscription',    null, null, null, null, null),
    (uid, id_freelance,     'income',    550000, m2 + 15, 'Consulting (half day)',      null, null, null, null, null),
    (uid, id_food,          'expense',     73200, m2 + 17, 'Groceries',                 loc_super[1], loc_super[2], loc_super[3], loc_super[4], loc_super[5]),
    (uid, id_transport,     'expense',     14500, m2 + 19, 'Bus rides',                 null, null, null, null, null),
    (uid, id_investment,    'income',    180000, m2 + 20, 'ETF dividend',               null, null, null, null, null),
    (uid, id_shopping,      'expense',     58000, m2 + 22, 'Books',                     loc_bookstore[1], loc_bookstore[2], loc_bookstore[3], loc_bookstore[4], loc_bookstore[5]),

    -- ── 3 months ago ───────────────────────────────────────────────────────
    (uid, id_salary,        'income',  4500000, m3 +  0, 'Monthly salary',            null, null, null, null, null),
    (uid, id_bills,         'expense',   850000, m3 +  1, 'Rent',                      null, null, null, null, null),
    (uid, id_bills,         'expense',     91800, m3 +  2, 'Utilities',                 null, null, null, null, null),
    (uid, id_food,          'expense',     69900, m3 +  3, 'Groceries',                 loc_super[1], loc_super[2], loc_super[3], loc_super[4], loc_super[5]),
    (uid, id_transport,     'expense',     32000, m3 +  4, 'Train pass',                null, null, null, null, null),
    (uid, id_health,        'expense',     49000, m3 +  5, 'Gym membership',            loc_gym[1], loc_gym[2], loc_gym[3], loc_gym[4], loc_gym[5]),
    (uid, id_entertainment, 'expense',     28000, m3 +  7, 'Concert ticket',            null, null, null, null, null),
    (uid, id_food,          'expense',     61500, m3 +  9, 'Supermarket run',           loc_super[1], loc_super[2], loc_super[3], loc_super[4], loc_super[5]),
    (uid, id_freelance,     'income',    900000, m3 + 12, 'App UI audit',               null, null, null, null, null),
    (uid, id_shopping,      'expense',     44900, m3 + 14, 'Kitchenware',                loc_mall[1], loc_mall[2], loc_mall[3], loc_mall[4], loc_mall[5]),
    (uid, id_investment,    'income',    240000, m3 + 16, 'Stock dividend',             null, null, null, null, null),
    (uid, id_food,          'expense',     35400, m3 + 18, 'Takeaway',                   loc_restaurant[1], loc_restaurant[2], loc_restaurant[3], loc_restaurant[4], loc_restaurant[5]),
    (uid, id_travel,        'expense',   320000, m3 + 22, 'Train tickets (holiday)',    null, null, null, null, null),
    (uid, id_entertainment, 'expense',     15990, m3 + 24, 'Streaming subscription',    null, null, null, null, null)
  ;
end $$;
