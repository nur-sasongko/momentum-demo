-- ── Finance categories for demo user ──────────────────────────────────────────
-- Fixed UUIDs keep the seed idempotent across resets.

do $$
declare
  uid uuid := 'a1b2c3d4-0000-0000-0000-000000000001';
begin
  insert into public.finance_categories
    (id, user_id, name, type, color, is_system)
  values
    -- expense
    ('c0000001-0000-0000-0000-000000000001', uid, 'Food',          'expense', '#f59e0b', false),
    ('c0000001-0000-0000-0000-000000000002', uid, 'Transport',     'expense', '#0ea5e9', false),
    ('c0000001-0000-0000-0000-000000000003', uid, 'Shopping',      'expense', '#8b5cf6', false),
    ('c0000001-0000-0000-0000-000000000004', uid, 'Bills',         'expense', '#f43f5e', false),
    ('c0000001-0000-0000-0000-000000000005', uid, 'Entertainment', 'expense', '#ec4899', false),
    ('c0000001-0000-0000-0000-000000000006', uid, 'Health',        'expense', '#10b981', false),
    ('c0000001-0000-0000-0000-000000000007', uid, 'Travel',        'expense', '#f97316', false),
    ('c0000001-0000-0000-0000-000000000008', uid, 'Other',         'expense', '#71717a', true),
    -- income
    ('c0000001-0000-0000-0000-000000000011', uid, 'Salary',        'income',  '#22c55e', false),
    ('c0000001-0000-0000-0000-000000000012', uid, 'Freelance',     'income',  '#14b8a6', false),
    ('c0000001-0000-0000-0000-000000000013', uid, 'Investment',    'income',  '#6366f1', false),
    ('c0000001-0000-0000-0000-000000000014', uid, 'Other',         'income',  '#71717a', true)
  on conflict (user_id, name, type) do nothing;
end $$;
