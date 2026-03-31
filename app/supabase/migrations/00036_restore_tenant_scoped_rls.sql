-- Restore tenant-scoped RLS for organization memberships and user profiles.
-- Migration 00018 temporarily opened both tables to all authenticated users
-- to work around recursion. This migration replaces that fallback with
-- SECURITY DEFINER helpers so org isolation remains enforced in the database.

CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(array_agg(organization_id), '{}'::uuid[])
  FROM public.organization_memberships
  WHERE user_id = (select auth.uid());
$$;

REVOKE ALL ON FUNCTION public.current_user_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_org_membership(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT target_organization_id = ANY (public.current_user_org_ids());
$$;

REVOKE ALL ON FUNCTION public.can_read_org_membership(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_org_membership(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_profile(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships viewer
    JOIN public.organization_memberships target
      ON viewer.organization_id = target.organization_id
    WHERE viewer.user_id = (select auth.uid())
      AND target.user_id = target_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.can_read_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS "org_membership_select" ON public.organization_memberships;
CREATE POLICY "org_membership_select" ON public.organization_memberships
  FOR SELECT TO authenticated
  USING (public.can_read_org_membership(organization_id));

DROP POLICY IF EXISTS "profile_select" ON public.user_profiles;
CREATE POLICY "profile_select" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (public.can_read_profile(id));
