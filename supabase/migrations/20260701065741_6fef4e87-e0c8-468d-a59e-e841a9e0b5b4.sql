CREATE OR REPLACE FUNCTION public.merge_site_into(_loser UUID, _target UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target_org UUID;
  _loser_org UUID;
  _deleted_duplicate_pages INTEGER := 0;
  _moved_pages INTEGER := 0;
  _deleted_gsc_conflicts INTEGER := 0;
  _moved_gsc_rows INTEGER := 0;
  _deleted_sitemap_conflicts INTEGER := 0;
  _moved_sitemap_rows INTEGER := 0;
  _deleted_rule_conflicts INTEGER := 0;
  _moved_rule_rows INTEGER := 0;
  _table_name TEXT;
  _updated INTEGER;
  _simple_updates JSONB := '{}'::jsonb;
BEGIN
  IF _loser = _target THEN
    RETURN jsonb_build_object('merged', false, 'reason', 'same_site');
  END IF;

  SELECT org_id INTO _target_org FROM public.sites WHERE id = _target;
  SELECT org_id INTO _loser_org FROM public.sites WHERE id = _loser;

  IF _target_org IS NULL OR _loser_org IS NULL THEN
    RAISE EXCEPTION 'merge_site_into: target or loser site not found';
  END IF;
  IF _target_org <> _loser_org THEN
    RAISE EXCEPTION 'merge_site_into: sites are in different organizations';
  END IF;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp
    JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.opportunities o SET page_id = d.target_page_id FROM duplicate_pages d WHERE o.page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.content_briefs x SET page_id = d.target_page_id FROM duplicate_pages d WHERE x.page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.content_diffs x SET page_id = d.target_page_id FROM duplicate_pages d WHERE x.page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.page_snapshots x SET page_id = d.target_page_id FROM duplicate_pages d WHERE x.page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.publish_jobs x SET page_id = d.target_page_id FROM duplicate_pages d WHERE x.page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.wp_snapshots x SET page_id = d.target_page_id FROM duplicate_pages d WHERE x.page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.schema_items x SET page_id = d.target_page_id FROM duplicate_pages d WHERE x.page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.affiliate_links x SET page_id = d.target_page_id FROM duplicate_pages d WHERE x.page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.monetization_opportunities x SET page_id = d.target_page_id FROM duplicate_pages d WHERE x.page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.experiments x SET page_id = d.target_page_id FROM duplicate_pages d WHERE x.page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.internal_links x SET source_page_id = d.target_page_id FROM duplicate_pages d WHERE x.source_page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.internal_links x SET target_page_id = d.target_page_id FROM duplicate_pages d WHERE x.target_page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.link_opportunities x SET source_page_id = d.target_page_id FROM duplicate_pages d WHERE x.source_page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id, tp.id AS target_page_id
    FROM public.pages lp JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) UPDATE public.link_opportunities x SET target_page_id = d.target_page_id FROM duplicate_pages d WHERE x.target_page_id = d.loser_page_id;

  WITH duplicate_pages AS (
    SELECT lp.id AS loser_page_id
    FROM public.pages lp
    JOIN public.pages tp ON tp.site_id = _target AND tp.url = lp.url
    WHERE lp.site_id = _loser
  ) DELETE FROM public.pages p USING duplicate_pages d WHERE p.id = d.loser_page_id;
  GET DIAGNOSTICS _deleted_duplicate_pages = ROW_COUNT;

  UPDATE public.pages SET site_id = _target WHERE site_id = _loser;
  GET DIAGNOSTICS _moved_pages = ROW_COUNT;

  DELETE FROM public.gsc_page_query_daily l
  USING public.gsc_page_query_daily t
  WHERE l.site_id = _loser
    AND t.site_id = _target
    AND t.date = l.date
    AND t.url = l.url
    AND t.query = l.query
    AND t.country IS NOT DISTINCT FROM l.country
    AND t.device IS NOT DISTINCT FROM l.device;
  GET DIAGNOSTICS _deleted_gsc_conflicts = ROW_COUNT;

  UPDATE public.gsc_page_query_daily SET site_id = _target WHERE site_id = _loser;
  GET DIAGNOSTICS _moved_gsc_rows = ROW_COUNT;

  DELETE FROM public.sitemap_urls l
  USING public.sitemap_urls t
  WHERE l.site_id = _loser AND t.site_id = _target AND t.url = l.url;
  GET DIAGNOSTICS _deleted_sitemap_conflicts = ROW_COUNT;

  UPDATE public.sitemap_urls SET site_id = _target WHERE site_id = _loser;
  GET DIAGNOSTICS _moved_sitemap_rows = ROW_COUNT;

  DELETE FROM public.site_rules l
  USING public.site_rules t
  WHERE l.site_id = _loser AND t.site_id = _target AND t.rule_key = l.rule_key;
  GET DIAGNOSTICS _deleted_rule_conflicts = ROW_COUNT;

  UPDATE public.site_rules SET site_id = _target WHERE site_id = _loser;
  GET DIAGNOSTICS _moved_rule_rows = ROW_COUNT;

  DELETE FROM public.ga4_landing_daily l
  USING public.ga4_landing_daily t
  WHERE l.site_id = _loser AND t.site_id = _target AND t.date = l.date AND t.landing_path = l.landing_path;
  UPDATE public.ga4_landing_daily SET site_id = _target WHERE site_id = _loser;

  IF EXISTS (SELECT 1 FROM public.site_gsc_connections WHERE site_id = _target AND is_primary) THEN
    UPDATE public.site_gsc_connections SET is_primary = false WHERE site_id = _loser;
  END IF;
  UPDATE public.site_gsc_connections SET site_id = _target WHERE site_id = _loser;

  FOREACH _table_name IN ARRAY ARRAY[
    'encrypted_site_secrets', 'page_snapshots', 'robots_checks', 'competitor_pages',
    'content_briefs', 'content_diffs', 'validation_runs', 'wp_snapshots', 'publish_jobs',
    'internal_links', 'link_opportunities', 'schema_items', 'affiliate_links',
    'monetization_opportunities', 'ai_visibility_prompts', 'ai_visibility_runs',
    'ai_citations', 'experiments', 'revenue_per_url', 'ai_usage_logs', 'audit_logs',
    'keyword_clusters', 'keywords', 'rank_snapshots', 'serp_snapshots'
  ] LOOP
    EXECUTE format('UPDATE public.%I SET site_id = $1 WHERE site_id = $2', _table_name) USING _target, _loser;
    GET DIAGNOSTICS _updated = ROW_COUNT;
    _simple_updates := _simple_updates || jsonb_build_object(_table_name, _updated);
  END LOOP;

  UPDATE public.sites t
  SET
    gsc_property = COALESCE(NULLIF(t.gsc_property, ''), l.gsc_property),
    sitemap_url = COALESCE(t.sitemap_url, l.sitemap_url),
    robots_txt_url = COALESCE(t.robots_txt_url, l.robots_txt_url),
    llms_txt_url = COALESCE(t.llms_txt_url, l.llms_txt_url),
    ga4_property_id = COALESCE(t.ga4_property_id, l.ga4_property_id),
    wp_username = COALESCE(t.wp_username, l.wp_username),
    status = CASE WHEN t.status = 'connected' OR l.status = 'connected' THEN 'connected'::public.site_status ELSE t.status END,
    data_quality_status = 'canonical_merged',
    last_pipeline_run_at = now()
  FROM public.sites l
  WHERE t.id = _target AND l.id = _loser;

  DELETE FROM public.sites WHERE id = _loser;

  RETURN jsonb_build_object(
    'merged', true,
    'loser', _loser,
    'target', _target,
    'deleted_duplicate_pages', _deleted_duplicate_pages,
    'moved_pages', _moved_pages,
    'deleted_gsc_conflicts', _deleted_gsc_conflicts,
    'moved_gsc_rows', _moved_gsc_rows,
    'deleted_sitemap_conflicts', _deleted_sitemap_conflicts,
    'moved_sitemap_rows', _moved_sitemap_rows,
    'deleted_rule_conflicts', _deleted_rule_conflicts,
    'moved_rule_rows', _moved_rule_rows,
    'updated_tables', _simple_updates
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_site_into(UUID, UUID) TO service_role;