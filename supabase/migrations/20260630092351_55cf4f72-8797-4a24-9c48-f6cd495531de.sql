
-- ===== 1. Pages additions =====
ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS raw_content_html text,
  ADD COLUMN IF NOT EXISTS rendered_content_html text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS indexability_status text,
  ADD COLUMN IF NOT EXISTS noindex boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS canonical_mismatch boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_sitemap boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS extracted jsonb;

-- ===== 2. Unique constraints =====
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gsc_unique_row') THEN
    ALTER TABLE public.gsc_page_query_daily
      ADD CONSTRAINT gsc_unique_row UNIQUE (site_id, date, url, query, country, device);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ga4_unique_row') THEN
    ALTER TABLE public.ga4_landing_daily
      ADD CONSTRAINT ga4_unique_row UNIQUE (site_id, date, landing_path);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sitemap_urls_site_url_key') THEN
    ALTER TABLE public.sitemap_urls
      ADD CONSTRAINT sitemap_urls_site_url_key UNIQUE (site_id, url);
  END IF;
END $$;

-- ===== 3. Opportunities additions =====
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS source_data jsonb,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz DEFAULT now();

-- ===== 4. Role helper =====
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _min_role org_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ranks AS (
    SELECT 'viewer'::org_role AS r, 1 AS w UNION ALL
    SELECT 'editor', 2 UNION ALL
    SELECT 'admin', 3 UNION ALL
    SELECT 'owner', 4
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    JOIN ranks ur ON ur.r = m.role
    JOIN ranks mr ON mr.r = _min_role
    WHERE m.org_id = _org_id
      AND m.user_id = _user_id
      AND ur.w >= mr.w
  );
$$;

CREATE OR REPLACE FUNCTION public.site_org(_site_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT org_id FROM public.sites WHERE id = _site_id $$;

CREATE OR REPLACE FUNCTION public.can_edit_site(_site_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_org_role(auth.uid(), public.site_org(_site_id), 'editor') $$;

CREATE OR REPLACE FUNCTION public.can_admin_site(_site_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_org_role(auth.uid(), public.site_org(_site_id), 'admin') $$;

-- ===== 5. RLS rewrites =====

-- sites: admins can write
DROP POLICY IF EXISTS "members read sites" ON public.sites;
DROP POLICY IF EXISTS "members write sites" ON public.sites;
DROP POLICY IF EXISTS "sites_select" ON public.sites;
DROP POLICY IF EXISTS "sites_admin_write" ON public.sites;
CREATE POLICY "sites_select" ON public.sites FOR SELECT TO authenticated
  USING (is_org_member(org_id));
CREATE POLICY "sites_admin_write" ON public.sites FOR ALL TO authenticated
  USING (has_org_role(auth.uid(), org_id, 'admin'))
  WITH CHECK (has_org_role(auth.uid(), org_id, 'admin'));

-- pages: editors write
DROP POLICY IF EXISTS "members read pages" ON public.pages;
DROP POLICY IF EXISTS "members write pages" ON public.pages;
CREATE POLICY "pages_select" ON public.pages FOR SELECT TO authenticated
  USING (can_access_site(site_id));
CREATE POLICY "pages_editor_write" ON public.pages FOR ALL TO authenticated
  USING (can_edit_site(site_id)) WITH CHECK (can_edit_site(site_id));

-- page_snapshots
DROP POLICY IF EXISTS "members access snapshots" ON public.page_snapshots;
DROP POLICY IF EXISTS "members read snapshots" ON public.page_snapshots;
DROP POLICY IF EXISTS "members write snapshots" ON public.page_snapshots;
CREATE POLICY "page_snapshots_select" ON public.page_snapshots FOR SELECT TO authenticated
  USING (can_access_site(site_id));
CREATE POLICY "page_snapshots_editor_write" ON public.page_snapshots FOR ALL TO authenticated
  USING (can_edit_site(site_id)) WITH CHECK (can_edit_site(site_id));

-- sitemap_urls
DROP POLICY IF EXISTS "members read sitemap" ON public.sitemap_urls;
DROP POLICY IF EXISTS "members write sitemap" ON public.sitemap_urls;
CREATE POLICY "sitemap_select" ON public.sitemap_urls FOR SELECT TO authenticated
  USING (can_access_site(site_id));
CREATE POLICY "sitemap_editor_write" ON public.sitemap_urls FOR ALL TO authenticated
  USING (can_edit_site(site_id)) WITH CHECK (can_edit_site(site_id));

-- gsc
DROP POLICY IF EXISTS "members access gsc" ON public.gsc_page_query_daily;
CREATE POLICY "gsc_select" ON public.gsc_page_query_daily FOR SELECT TO authenticated
  USING (can_access_site(site_id));
CREATE POLICY "gsc_editor_write" ON public.gsc_page_query_daily FOR ALL TO authenticated
  USING (can_edit_site(site_id)) WITH CHECK (can_edit_site(site_id));

-- ga4
DROP POLICY IF EXISTS "members access ga4" ON public.ga4_landing_daily;
CREATE POLICY "ga4_select" ON public.ga4_landing_daily FOR SELECT TO authenticated
  USING (can_access_site(site_id));
CREATE POLICY "ga4_editor_write" ON public.ga4_landing_daily FOR ALL TO authenticated
  USING (can_edit_site(site_id)) WITH CHECK (can_edit_site(site_id));

-- opportunities
DROP POLICY IF EXISTS "members access opportunities" ON public.opportunities;
CREATE POLICY "opp_select" ON public.opportunities FOR SELECT TO authenticated
  USING (can_access_site(site_id));
CREATE POLICY "opp_editor_write" ON public.opportunities FOR ALL TO authenticated
  USING (can_edit_site(site_id)) WITH CHECK (can_edit_site(site_id));

-- content_briefs
DROP POLICY IF EXISTS "members access briefs" ON public.content_briefs;
DROP POLICY IF EXISTS "members read briefs" ON public.content_briefs;
CREATE POLICY "briefs_select" ON public.content_briefs FOR SELECT TO authenticated
  USING (can_access_site(site_id));
CREATE POLICY "briefs_editor_write" ON public.content_briefs FOR ALL TO authenticated
  USING (can_edit_site(site_id)) WITH CHECK (can_edit_site(site_id));

-- content_diffs
DROP POLICY IF EXISTS "members access diffs" ON public.content_diffs;
DROP POLICY IF EXISTS "members read diffs" ON public.content_diffs;
CREATE POLICY "diffs_select" ON public.content_diffs FOR SELECT TO authenticated
  USING (can_access_site(site_id));
CREATE POLICY "diffs_editor_write" ON public.content_diffs FOR ALL TO authenticated
  USING (can_edit_site(site_id)) WITH CHECK (can_edit_site(site_id));

-- publish_jobs: admin only
DROP POLICY IF EXISTS "members access publish jobs" ON public.publish_jobs;
DROP POLICY IF EXISTS "members read publish" ON public.publish_jobs;
CREATE POLICY "publish_select" ON public.publish_jobs FOR SELECT TO authenticated
  USING (can_access_site(site_id));
CREATE POLICY "publish_admin_write" ON public.publish_jobs FOR ALL TO authenticated
  USING (can_admin_site(site_id)) WITH CHECK (can_admin_site(site_id));

-- audit_logs: members can insert
DROP POLICY IF EXISTS "members write audit" ON public.audit_logs;
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (org_id IS NULL OR is_org_member(org_id));

-- encrypted_site_secrets: NO authenticated access; service role only.
-- RLS already enabled with no policies = locked to authenticated users.

-- ===== 6. Indexes for performance =====
CREATE INDEX IF NOT EXISTS idx_gsc_site_url_date ON public.gsc_page_query_daily(site_id, url, date);
CREATE INDEX IF NOT EXISTS idx_opp_site_priority ON public.opportunities(site_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_pages_site_status ON public.pages(site_id, status);
