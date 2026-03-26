-- Create "Community Members" KPI and Discourse integration for each venture
-- Tracks total user_count from Discourse, synced daily via cron

DO $$
DECLARE
  v_record RECORD;
  v_kpi_id uuid;
  v_max_order integer;
  v_owner_id uuid;
BEGIN
  FOR v_record IN
    SELECT id AS venture_id, organization_id
    FROM ventures
  LOOP
    -- Get the next display_order for this org
    SELECT COALESCE(MAX(display_order), 0) + 1
    INTO v_max_order
    FROM kpis
    WHERE organization_id = v_record.organization_id;

    -- Get an owner (first admin/owner in the org)
    SELECT user_id INTO v_owner_id
    FROM organization_memberships
    WHERE organization_id = v_record.organization_id
    ORDER BY role ASC
    LIMIT 1;

    -- Insert the KPI
    INSERT INTO kpis (
      id, organization_id, venture_id,
      name, description, unit, frequency, tier, directionality,
      target, current_value, health_status, lifecycle_status,
      icon, display_order, owner_id,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_record.organization_id, v_record.venture_id,
      'Community Members', 'Total number of registered members in the Discourse forum',
      'members', 'daily', 'tier2', 'up_is_good',
      NULL, NULL, 'green', 'active',
      'comment', v_max_order, v_owner_id,
      now(), now()
    )
    RETURNING id INTO v_kpi_id;

    -- Insert the Discourse integration
    INSERT INTO kpi_integrations (
      id, kpi_id, integration_type, config, enabled,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_kpi_id, 'discourse',
      jsonb_build_object(
        'baseUrl', 'https://community.fullstack.ag',
        'apiKey', '07dd07330c51808829f000c0e98e6fb5ad13a718f9c348b03d2b057bbea7fd5c',
        'apiUsername', 'nickhorob',
        'metric', 'user_count'
      ),
      true,
      now(), now()
    );
  END LOOP;
END $$;
