-- The FOR ALL manage policy on organization_memberships still self-references,
-- causing infinite recursion at plan time even though the SELECT policy is
-- USING(true). Fix: use a SECURITY DEFINER function that bypasses RLS to
-- check admin status, then split the manage policy into per-operation policies
-- that don't overlap with SELECT.

-- 1. Create a helper function that bypasses RLS to check admin membership
CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = (select auth.uid())
      AND organization_id = check_org_id
      AND role = 'admin'
  );
$$;

-- 2. Drop the recursive FOR ALL policy
DROP POLICY IF EXISTS "org_membership_manage" ON organization_memberships;

-- 3. Create separate non-SELECT policies using the SECURITY DEFINER function
CREATE POLICY "org_membership_insert" ON organization_memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "org_membership_update" ON organization_memberships
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id));

CREATE POLICY "org_membership_delete" ON organization_memberships
  FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id));
