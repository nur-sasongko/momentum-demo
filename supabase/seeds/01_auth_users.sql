-- ── Demo user ──────────────────────────────────────────────────────────────────
-- Email:    demo@momentum.app
-- Password: demo1234

do $$
declare
  demo_user_id uuid := 'a1b2c3d4-0000-0000-0000-000000000001';
begin
  if not exists (select 1 from auth.users where id = demo_user_id) then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      -- GoTrue no longer uses multi-instance auth, but it still scans this
      -- column into a non-nullable uuid.UUID — leaving it NULL breaks every
      -- query that touches auth.users (Studio's user list, admin create-user's
      -- duplicate-email check, etc). All Supabase instances use this zero UUID.
      '00000000-0000-0000-0000-000000000000',
      demo_user_id,
      'authenticated',
      'authenticated',
      'demo@momentum.app',
      crypt('demo1234', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Demo User"}',
      now(),
      now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      provider,
      identity_data,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      demo_user_id,
      'demo@momentum.app',
      'email',
      json_build_object('sub', demo_user_id, 'email', 'demo@momentum.app'),
      now(),
      now(),
      now()
    );
  end if;
end $$;
