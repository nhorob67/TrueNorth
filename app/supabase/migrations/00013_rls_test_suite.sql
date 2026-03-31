-- TrueNorth Migration 00013: RLS Test Suite
-- Comprehensive SQL test functions for verifying Row Level Security policies.
-- Run in test/staging environments only.
-- Usage: SELECT * FROM run_all_rls_tests();

-- ============================================================
-- Helper: create test org, users, ventures for isolation tests
-- ============================================================

CREATE OR REPLACE FUNCTION _rls_test_setup()
RETURNS TABLE(
  org_a_id uuid,
  org_b_id uuid,
  venture_a1_id uuid,
  venture_a2_id uuid,
  venture_b1_id uuid,
  user_a_admin_id uuid,
  user_a_member_id uuid,
  user_b_admin_id uuid
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _org_a uuid;
  _org_b uuid;
  _v_a1 uuid;
  _v_a2 uuid;
  _v_b1 uuid;
  _u_a_admin uuid;
  _u_a_member uuid;
  _u_b_admin uuid;
BEGIN
  -- Create two orgs
  INSERT INTO public.organizations (name, slug) VALUES ('RLS Test Org A', 'rls-test-a-' || substr(gen_random_uuid()::text,1,8))
    RETURNING id INTO _org_a;
  INSERT INTO public.organizations (name, slug) VALUES ('RLS Test Org B', 'rls-test-b-' || substr(gen_random_uuid()::text,1,8))
    RETURNING id INTO _org_b;

  -- Create ventures
  INSERT INTO public.ventures (organization_id, name, slug) VALUES (_org_a, 'Venture A1', 'va1')
    RETURNING id INTO _v_a1;
  INSERT INTO public.ventures (organization_id, name, slug) VALUES (_org_a, 'Venture A2', 'va2')
    RETURNING id INTO _v_a2;
  INSERT INTO public.ventures (organization_id, name, slug) VALUES (_org_b, 'Venture B1', 'vb1')
    RETURNING id INTO _v_b1;

  -- Create test users in auth.users (we use gen_random_uuid for ids)
  _u_a_admin := gen_random_uuid();
  _u_a_member := gen_random_uuid();
  _u_b_admin := gen_random_uuid();

  -- Insert into auth.users (minimal)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, instance_id)
    VALUES (_u_a_admin, 'rls-test-a-admin@test.local', crypt('testpass123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, instance_id)
    VALUES (_u_a_member, 'rls-test-a-member@test.local', crypt('testpass123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, instance_id)
    VALUES (_u_b_admin, 'rls-test-b-admin@test.local', crypt('testpass123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  -- Create profiles
  INSERT INTO public.user_profiles (id, full_name) VALUES (_u_a_admin, 'Test A Admin');
  INSERT INTO public.user_profiles (id, full_name) VALUES (_u_a_member, 'Test A Member');
  INSERT INTO public.user_profiles (id, full_name) VALUES (_u_b_admin, 'Test B Admin');

  -- Org memberships
  INSERT INTO public.organization_memberships (user_id, organization_id, role) VALUES (_u_a_admin, _org_a, 'admin');
  INSERT INTO public.organization_memberships (user_id, organization_id, role) VALUES (_u_a_member, _org_a, 'member');
  INSERT INTO public.organization_memberships (user_id, organization_id, role) VALUES (_u_b_admin, _org_b, 'admin');

  -- Venture memberships: user_a_admin in both ventures, user_a_member only in venture_a1
  INSERT INTO public.venture_memberships (user_id, venture_id, role) VALUES (_u_a_admin, _v_a1, 'admin');
  INSERT INTO public.venture_memberships (user_id, venture_id, role) VALUES (_u_a_admin, _v_a2, 'admin');
  INSERT INTO public.venture_memberships (user_id, venture_id, role) VALUES (_u_a_member, _v_a1, 'member');
  INSERT INTO public.venture_memberships (user_id, venture_id, role) VALUES (_u_b_admin, _v_b1, 'admin');

  RETURN QUERY SELECT _org_a, _org_b, _v_a1, _v_a2, _v_b1, _u_a_admin, _u_a_member, _u_b_admin;
END;
$$;


CREATE OR REPLACE FUNCTION _rls_test_cleanup(
  _org_a uuid, _org_b uuid,
  _u_a_admin uuid, _u_a_member uuid, _u_b_admin uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Cascading deletes handle most child rows
  DELETE FROM public.organizations WHERE id IN (_org_a, _org_b);
  DELETE FROM public.user_profiles WHERE id IN (_u_a_admin, _u_a_member, _u_b_admin);
  DELETE FROM auth.users WHERE id IN (_u_a_admin, _u_a_member, _u_b_admin);
END;
$$;


-- ============================================================
-- Test 1: Organization Isolation
-- ============================================================

CREATE OR REPLACE FUNCTION test_rls_org_isolation()
RETURNS TABLE(test_name text, passed boolean, detail text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _s record;
  _count bigint;
  _kpi_a uuid;
  _kpi_b uuid;
  _bet_a uuid;
  _bet_b uuid;
  _pulse_a uuid;
BEGIN
  -- Setup
  SELECT * INTO _s FROM public._rls_test_setup();

  -- Seed data in org A
  INSERT INTO public.kpis (organization_id, venture_id, name, owner_id)
    VALUES (_s.org_a_id, _s.venture_a1_id, 'KPI A', _s.user_a_admin_id) RETURNING id INTO _kpi_a;
  INSERT INTO public.bets (organization_id, venture_id, outcome, owner_id, quarter)
    VALUES (_s.org_a_id, _s.venture_a1_id, 'Bet A', _s.user_a_admin_id, 'q1') RETURNING id INTO _bet_a;

  -- Seed data in org B
  INSERT INTO public.kpis (organization_id, venture_id, name, owner_id)
    VALUES (_s.org_b_id, _s.venture_b1_id, 'KPI B', _s.user_b_admin_id) RETURNING id INTO _kpi_b;
  INSERT INTO public.bets (organization_id, venture_id, outcome, owner_id, quarter)
    VALUES (_s.org_b_id, _s.venture_b1_id, 'Bet B', _s.user_b_admin_id, 'q1') RETURNING id INTO _bet_b;

  -- Test: user_a sees only org A kpis when impersonating
  -- We simulate RLS by setting the role and jwt claims
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _s.user_a_admin_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT count(*) INTO _count FROM public.kpis WHERE id = _kpi_b;
  test_name := 'org_isolation_kpis_user_a_cannot_see_org_b';
  passed := (_count = 0);
  detail := format('user_a saw %s KPIs from org_b (expected 0)', _count);
  RETURN NEXT;

  SELECT count(*) INTO _count FROM public.organization_memberships WHERE organization_id = _s.org_b_id;
  test_name := 'org_isolation_memberships_user_a_cannot_see_org_b';
  passed := (_count = 0);
  detail := format('user_a saw %s memberships from org_b (expected 0)', _count);
  RETURN NEXT;

  SELECT count(*) INTO _count FROM public.user_profiles WHERE id = _s.user_b_admin_id;
  test_name := 'org_isolation_profiles_user_a_cannot_see_org_b';
  passed := (_count = 0);
  detail := format('user_a saw %s profiles from org_b (expected 0)', _count);
  RETURN NEXT;

  SELECT count(*) INTO _count FROM public.kpis WHERE id = _kpi_a;
  test_name := 'org_isolation_kpis_user_a_sees_own';
  passed := (_count = 1);
  detail := format('user_a saw %s own KPIs (expected 1)', _count);
  RETURN NEXT;

  SELECT count(*) INTO _count FROM public.organization_memberships WHERE organization_id = _s.org_a_id;
  test_name := 'org_isolation_memberships_user_a_sees_own';
  passed := (_count = 2);
  detail := format('user_a saw %s memberships from org_a (expected 2)', _count);
  RETURN NEXT;

  SELECT count(*) INTO _count FROM public.user_profiles WHERE id = _s.user_a_member_id;
  test_name := 'org_isolation_profiles_user_a_sees_own_org';
  passed := (_count = 1);
  detail := format('user_a saw %s peer profiles from own org (expected 1)', _count);
  RETURN NEXT;

  SELECT count(*) INTO _count FROM public.bets WHERE id = _bet_b;
  test_name := 'org_isolation_bets_user_a_cannot_see_org_b';
  passed := (_count = 0);
  detail := format('user_a saw %s bets from org_b (expected 0)', _count);
  RETURN NEXT;

  -- Switch to user_b
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _s.user_b_admin_id::text, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO _count FROM public.kpis WHERE id = _kpi_a;
  test_name := 'org_isolation_kpis_user_b_cannot_see_org_a';
  passed := (_count = 0);
  detail := format('user_b saw %s KPIs from org_a (expected 0)', _count);
  RETURN NEXT;

  SELECT count(*) INTO _count FROM public.organization_memberships WHERE organization_id = _s.org_a_id;
  test_name := 'org_isolation_memberships_user_b_cannot_see_org_a';
  passed := (_count = 0);
  detail := format('user_b saw %s memberships from org_a (expected 0)', _count);
  RETURN NEXT;

  SELECT count(*) INTO _count FROM public.user_profiles WHERE id = _s.user_a_admin_id;
  test_name := 'org_isolation_profiles_user_b_cannot_see_org_a';
  passed := (_count = 0);
  detail := format('user_b saw %s profiles from org_a (expected 0)', _count);
  RETURN NEXT;

  SELECT count(*) INTO _count FROM public.bets WHERE id = _bet_a;
  test_name := 'org_isolation_bets_user_b_cannot_see_org_a';
  passed := (_count = 0);
  detail := format('user_b saw %s bets from org_a (expected 0)', _count);
  RETURN NEXT;

  -- Reset role
  PERFORM set_config('role', 'postgres', true);

  -- Cleanup
  PERFORM public._rls_test_cleanup(_s.org_a_id, _s.org_b_id, _s.user_a_admin_id, _s.user_a_member_id, _s.user_b_admin_id);
END;
$$;


-- ============================================================
-- Test 2: Venture Isolation (within same org)
-- ============================================================

CREATE OR REPLACE FUNCTION test_rls_venture_isolation()
RETURNS TABLE(test_name text, passed boolean, detail text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _s record;
  _count bigint;
  _kpi_v2 uuid;
BEGIN
  SELECT * INTO _s FROM public._rls_test_setup();

  -- Seed data in venture_a2 (user_a_member is NOT in venture_a2)
  INSERT INTO public.kpis (organization_id, venture_id, name, owner_id)
    VALUES (_s.org_a_id, _s.venture_a2_id, 'KPI in V-A2', _s.user_a_admin_id) RETURNING id INTO _kpi_v2;

  -- Note: current RLS is org-scoped, not venture-scoped for most tables.
  -- So a member of org A CAN see all ventures within org A.
  -- This test documents that behavior — venture-level isolation is at the app layer.

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _s.user_a_member_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT count(*) INTO _count FROM public.kpis WHERE id = _kpi_v2;
  test_name := 'venture_isolation_org_member_sees_all_ventures';
  -- This is expected to be 1 since RLS is org-scoped
  passed := (_count = 1);
  detail := format('org_member saw %s KPIs from other venture (org-scoped RLS allows this)', _count);
  RETURN NEXT;

  -- But venture_memberships table itself is properly scoped
  SELECT count(*) INTO _count FROM public.venture_memberships WHERE venture_id = _s.venture_a2_id;
  test_name := 'venture_memberships_visible_to_org_member';
  passed := (_count >= 1);
  detail := format('org_member saw %s venture_a2 memberships', _count);
  RETURN NEXT;

  -- Reset
  PERFORM set_config('role', 'postgres', true);
  PERFORM public._rls_test_cleanup(_s.org_a_id, _s.org_b_id, _s.user_a_admin_id, _s.user_a_member_id, _s.user_b_admin_id);
END;
$$;


-- ============================================================
-- Test 3: Private Data (Todos, Notifications)
-- ============================================================

CREATE OR REPLACE FUNCTION test_rls_private_data()
RETURNS TABLE(test_name text, passed boolean, detail text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _s record;
  _count bigint;
  _todo_private uuid;
  _todo_team uuid;
  _notif_a uuid;
BEGIN
  SELECT * INTO _s FROM public._rls_test_setup();

  -- Create private todo for user_a_admin
  INSERT INTO public.todos (organization_id, user_id, title, visibility)
    VALUES (_s.org_a_id, _s.user_a_admin_id, 'Admin private todo', 'private')
    RETURNING id INTO _todo_private;

  -- Create team todo for user_a_admin
  INSERT INTO public.todos (organization_id, user_id, title, visibility)
    VALUES (_s.org_a_id, _s.user_a_admin_id, 'Admin team todo', 'team')
    RETURNING id INTO _todo_team;

  -- Create notification for user_a_admin
  INSERT INTO public.notifications (user_id, organization_id, title, body, tier)
    VALUES (_s.user_a_admin_id, _s.org_a_id, 'Test notif', 'body', 'immediate')
    RETURNING id INTO _notif_a;

  -- Impersonate user_a_member
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _s.user_a_member_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Member should NOT see admin's private todo
  SELECT count(*) INTO _count FROM public.todos WHERE id = _todo_private;
  test_name := 'private_todo_not_visible_to_other_user';
  passed := (_count = 0);
  detail := format('member saw %s private todos of admin (expected 0)', _count);
  RETURN NEXT;

  -- Member SHOULD see admin's team todo (same org)
  SELECT count(*) INTO _count FROM public.todos WHERE id = _todo_team;
  test_name := 'team_todo_visible_to_org_member';
  passed := (_count = 1);
  detail := format('member saw %s team todos (expected 1)', _count);
  RETURN NEXT;

  -- Member should NOT see admin's notification
  SELECT count(*) INTO _count FROM public.notifications WHERE id = _notif_a;
  test_name := 'notification_not_visible_to_other_user';
  passed := (_count = 0);
  detail := format('member saw %s notifications of admin (expected 0)', _count);
  RETURN NEXT;

  -- Reset
  PERFORM set_config('role', 'postgres', true);
  PERFORM public._rls_test_cleanup(_s.org_a_id, _s.org_b_id, _s.user_a_admin_id, _s.user_a_member_id, _s.user_b_admin_id);
END;
$$;


-- ============================================================
-- Test 4: Admin-Only Operations
-- ============================================================

CREATE OR REPLACE FUNCTION test_rls_admin_only_ops()
RETURNS TABLE(test_name text, passed boolean, detail text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _s record;
  _bet_id uuid;
  _kpi_id uuid;
  _cron_id uuid;
  _deleted boolean;
BEGIN
  SELECT * INTO _s FROM public._rls_test_setup();

  -- Create test entities
  INSERT INTO public.bets (organization_id, venture_id, outcome, owner_id, quarter)
    VALUES (_s.org_a_id, _s.venture_a1_id, 'Test Bet', _s.user_a_admin_id, 'q1')
    RETURNING id INTO _bet_id;

  INSERT INTO public.kpis (organization_id, venture_id, name, owner_id)
    VALUES (_s.org_a_id, _s.venture_a1_id, 'Test KPI', _s.user_a_admin_id)
    RETURNING id INTO _kpi_id;

  INSERT INTO public.cron_jobs (organization_id, name, schedule, query_template)
    VALUES (_s.org_a_id, 'Test Cron', '0 * * * *', 'test_template')
    RETURNING id INTO _cron_id;

  -- Impersonate member (not admin)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _s.user_a_member_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Member should NOT be able to delete bets (admin/manager only)
  BEGIN
    DELETE FROM public.bets WHERE id = _bet_id;
    GET DIAGNOSTICS _deleted = ROW_COUNT;
    test_name := 'member_cannot_delete_bets';
    -- If row_count > 0, the delete succeeded (RLS did not block)
    passed := NOT _deleted;
    detail := format('member delete bets returned %s rows (expected 0)', CASE WHEN _deleted THEN 1 ELSE 0 END);
    RETURN NEXT;
  EXCEPTION WHEN insufficient_privilege THEN
    test_name := 'member_cannot_delete_bets';
    passed := true;
    detail := 'delete blocked by RLS (insufficient_privilege)';
    RETURN NEXT;
  END;

  -- Member should NOT be able to delete KPIs (admin/manager only)
  BEGIN
    DELETE FROM public.kpis WHERE id = _kpi_id;
    GET DIAGNOSTICS _deleted = ROW_COUNT;
    test_name := 'member_cannot_delete_kpis';
    passed := NOT _deleted;
    detail := format('member delete kpis returned %s rows (expected 0)', CASE WHEN _deleted THEN 1 ELSE 0 END);
    RETURN NEXT;
  EXCEPTION WHEN insufficient_privilege THEN
    test_name := 'member_cannot_delete_kpis';
    passed := true;
    detail := 'delete blocked by RLS';
    RETURN NEXT;
  END;

  -- Member should NOT be able to insert/update cron_jobs (admin only)
  BEGIN
    UPDATE public.cron_jobs SET name = 'Hacked' WHERE id = _cron_id;
    GET DIAGNOSTICS _deleted = ROW_COUNT;
    test_name := 'member_cannot_update_cron_jobs';
    passed := NOT _deleted;
    detail := format('member update cron_jobs returned %s rows (expected 0)', CASE WHEN _deleted THEN 1 ELSE 0 END);
    RETURN NEXT;
  EXCEPTION WHEN insufficient_privilege THEN
    test_name := 'member_cannot_update_cron_jobs';
    passed := true;
    detail := 'update blocked by RLS';
    RETURN NEXT;
  END;

  -- Member should NOT be able to delete cron_jobs
  BEGIN
    DELETE FROM public.cron_jobs WHERE id = _cron_id;
    GET DIAGNOSTICS _deleted = ROW_COUNT;
    test_name := 'member_cannot_delete_cron_jobs';
    passed := NOT _deleted;
    detail := format('member delete cron_jobs returned %s rows (expected 0)', CASE WHEN _deleted THEN 1 ELSE 0 END);
    RETURN NEXT;
  EXCEPTION WHEN insufficient_privilege THEN
    test_name := 'member_cannot_delete_cron_jobs';
    passed := true;
    detail := 'delete blocked by RLS';
    RETURN NEXT;
  END;

  -- Reset
  PERFORM set_config('role', 'postgres', true);
  PERFORM public._rls_test_cleanup(_s.org_a_id, _s.org_b_id, _s.user_a_admin_id, _s.user_a_member_id, _s.user_b_admin_id);
END;
$$;


-- ============================================================
-- Test 5: Write Isolation (pulses, comments, todos)
-- ============================================================

CREATE OR REPLACE FUNCTION test_rls_write_isolation()
RETURNS TABLE(test_name text, passed boolean, detail text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _s record;
  _count bigint;
  _pulse_admin uuid;
  _comment_admin uuid;
  _todo_admin uuid;
  _updated boolean;
BEGIN
  SELECT * INTO _s FROM public._rls_test_setup();

  -- Create test data owned by admin
  INSERT INTO public.pulses (user_id, organization_id, date, items)
    VALUES (_s.user_a_admin_id, _s.org_a_id, CURRENT_DATE, '[]'::jsonb)
    RETURNING id INTO _pulse_admin;

  INSERT INTO public.comments (organization_id, entity_id, entity_type, author_id, body)
    VALUES (_s.org_a_id, gen_random_uuid(), 'bet', _s.user_a_admin_id, 'Admin comment')
    RETURNING id INTO _comment_admin;

  INSERT INTO public.todos (organization_id, user_id, title, visibility)
    VALUES (_s.org_a_id, _s.user_a_admin_id, 'Admin todo', 'private')
    RETURNING id INTO _todo_admin;

  -- Impersonate member
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _s.user_a_member_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Member cannot update admin's pulse
  UPDATE public.pulses SET items = '[{"text":"hacked"}]'::jsonb WHERE id = _pulse_admin;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  test_name := 'member_cannot_update_admin_pulse';
  passed := NOT _updated;
  detail := format('member update on admin pulse: %s rows (expected 0)', CASE WHEN _updated THEN 1 ELSE 0 END);
  RETURN NEXT;

  -- Member cannot update admin's comment
  UPDATE public.comments SET body = 'hacked' WHERE id = _comment_admin;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  test_name := 'member_cannot_update_admin_comment';
  passed := NOT _updated;
  detail := format('member update on admin comment: %s rows (expected 0)', CASE WHEN _updated THEN 1 ELSE 0 END);
  RETURN NEXT;

  -- Member cannot update admin's todo
  UPDATE public.todos SET title = 'hacked' WHERE id = _todo_admin;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  test_name := 'member_cannot_update_admin_todo';
  passed := NOT _updated;
  detail := format('member update on admin todo: %s rows (expected 0)', CASE WHEN _updated THEN 1 ELSE 0 END);
  RETURN NEXT;

  -- Member cannot delete admin's todo
  DELETE FROM public.todos WHERE id = _todo_admin;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  test_name := 'member_cannot_delete_admin_todo';
  passed := NOT _updated;
  detail := format('member delete on admin todo: %s rows (expected 0)', CASE WHEN _updated THEN 1 ELSE 0 END);
  RETURN NEXT;

  -- Reset
  PERFORM set_config('role', 'postgres', true);
  PERFORM public._rls_test_cleanup(_s.org_a_id, _s.org_b_id, _s.user_a_admin_id, _s.user_a_member_id, _s.user_b_admin_id);
END;
$$;


-- ============================================================
-- Master Runner
-- ============================================================

CREATE OR REPLACE FUNCTION run_all_rls_tests()
RETURNS TABLE(test_name text, passed boolean, detail text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE NOTICE 'Running RLS test suite...';

  RETURN QUERY SELECT * FROM public.test_rls_org_isolation();
  RETURN QUERY SELECT * FROM public.test_rls_venture_isolation();
  RETURN QUERY SELECT * FROM public.test_rls_private_data();
  RETURN QUERY SELECT * FROM public.test_rls_admin_only_ops();
  RETURN QUERY SELECT * FROM public.test_rls_write_isolation();

  RAISE NOTICE 'RLS test suite complete.';
END;
$$;
