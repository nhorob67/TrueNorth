-- Auto-create user profile, organization, and venture on signup

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org_name text;
  org_slug text;
  new_org_id uuid;
  new_venture_id uuid;
BEGIN
  -- Create user profile
  INSERT INTO user_profiles (id, full_name, avatar_url, settings)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    '{}'
  );

  -- Create organization from signup metadata
  org_name := COALESCE(NEW.raw_user_meta_data->>'org_name', 'My Organization');
  org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  -- Append random suffix to avoid slug collisions
  org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

  INSERT INTO organizations (name, slug, settings)
  VALUES (org_name, org_slug, '{}')
  RETURNING id INTO new_org_id;

  -- Add user as admin of the org
  INSERT INTO organization_memberships (user_id, organization_id, role)
  VALUES (NEW.id, new_org_id, 'admin');

  -- Auto-create first venture
  INSERT INTO ventures (organization_id, name, slug, settings)
  VALUES (new_org_id, org_name, 'default', '{}')
  RETURNING id INTO new_venture_id;

  -- Add user as admin of the venture
  INSERT INTO venture_memberships (user_id, venture_id, role)
  VALUES (NEW.id, new_venture_id, 'admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
