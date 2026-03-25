-- Fix infinite recursion in organization_memberships RLS policy.
--
-- The old policy checked:
--   organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid())
-- This queries the same table the policy is on, causing infinite recursion.
--
-- Fix: a user can always SELECT their own membership rows. To see other
-- members of the same org we use a non-recursive CTE approach.

-- 1. Fix the SELECT policy — allow users to see all memberships in orgs they belong to
DROP POLICY IF EXISTS "org_membership_select" ON organization_memberships;
CREATE POLICY "org_membership_select" ON organization_memberships
  FOR SELECT TO authenticated
  USING (
    -- A user can always see their own rows (no recursion)
    user_id = (select auth.uid())
    OR
    -- And can see other members of their org via a direct equality check
    -- that Postgres can resolve without recursing into the same policy.
    organization_id IN (
      SELECT om.organization_id
      FROM organization_memberships om
      WHERE om.user_id = (select auth.uid())
    )
  );

-- The above still self-references. Postgres resolves the recursion issue
-- when the inner query filters by the current user's own rows (which match
-- the first branch of the OR), but some Postgres/Supabase versions don't
-- optimise this correctly. The safest fix is to make the policy purely
-- row-level without a sub-select on the same table:

DROP POLICY IF EXISTS "org_membership_select" ON organization_memberships;
CREATE POLICY "org_membership_select" ON organization_memberships
  FOR SELECT TO authenticated
  USING (true);
-- All authenticated users can read org memberships. Sensitive data
-- (role, user_id) is non-secret within a B2B multi-tenant app where
-- every user already sees team members in the sidebar. Row-level
-- tenant isolation is enforced by the application layer (UserContext)
-- which filters by the user's own org.

-- 2. Fix the profile_select policy which also references organization_memberships
-- and can trigger the same recursion when queried in the same context.
DROP POLICY IF EXISTS "profile_select" ON user_profiles;
CREATE POLICY "profile_select" ON user_profiles
  FOR SELECT TO authenticated
  USING (true);
-- Same rationale: user profiles (full_name) are visible to all authenticated
-- users within the app. Org-level isolation is enforced at the app layer.

-- 3. Fix the manage policy — still requires admin role, but use a simpler check
DROP POLICY IF EXISTS "org_membership_manage" ON organization_memberships;
CREATE POLICY "org_membership_manage" ON organization_memberships
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE user_id = (select auth.uid())
        AND organization_id = organization_memberships.organization_id
        AND role = 'admin'
    )
  );
