
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- =========================
-- IDENTITY / TENANCY
-- =========================
CREATE TABLE public.users_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users_profiles TO authenticated;
GRANT ALL ON public.users_profiles TO service_role;
ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.users_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile upsert" ON public.users_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.users_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER trg_users_profiles_updated BEFORE UPDATE ON public.users_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TYPE public.org_role AS ENUM ('owner','admin','editor','viewer');

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Security definer membership helper (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = _org_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = _org_id AND user_id = auth.uid() AND role IN ('owner','admin')
  );
$$;

CREATE POLICY "members can see their orgs" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "owners can create org" ON public.organizations FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "admins can update org" ON public.organizations FOR UPDATE TO authenticated USING (public.is_org_admin(id));
CREATE POLICY "owners can delete org" ON public.organizations FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "members can see members" ON public.organization_members FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "admins manage members" ON public.organization_members FOR ALL TO authenticated
  USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));

-- Auto-create profile + personal org on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_org_id UUID;
BEGIN
  INSERT INTO public.users_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organizations (name, owner_id)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)) || '''s workspace', NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- SITES
-- =========================
CREATE TYPE public.site_status AS ENUM ('pending','connected','error','paused');

CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  wp_username TEXT,
  status public.site_status NOT NULL DEFAULT 'pending',
  gsc_property TEXT,
  ga4_property_id TEXT,
  sitemap_url TEXT,
  robots_txt_url TEXT,
  llms_txt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read sites" ON public.sites FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "members can write sites" ON public.sites FOR ALL TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE TRIGGER trg_sites_updated BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_sites_org ON public.sites(org_id);

-- Encrypted secrets (server-only writes; never expose values to clients)
CREATE TABLE public.encrypted_site_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  secret_kind TEXT NOT NULL, -- 'wp_app_password' | 'gsc_oauth' | 'ga4_oauth' | 'dataforseo' | etc.
  ciphertext BYTEA NOT NULL,
  iv BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.encrypted_site_secrets TO service_role;
ALTER TABLE public.encrypted_site_secrets ENABLE ROW LEVEL SECURITY;
-- No client policies: service_role only. Authenticated users cannot read secrets.

-- Generic site-scoped policy macro: a helper to check site membership
CREATE OR REPLACE FUNCTION public.can_access_site(_site_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sites s
    JOIN public.organization_members m ON m.org_id = s.org_id
    WHERE s.id = _site_id AND m.user_id = auth.uid()
  );
$$;

-- =========================
-- PAGES / SNAPSHOTS / SITEMAP
-- =========================
CREATE TABLE public.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  wp_post_id BIGINT,
  post_type TEXT,
  status TEXT,
  title TEXT,
  slug TEXT,
  excerpt TEXT,
  meta_description TEXT,
  canonical TEXT,
  word_count INTEGER,
  modified_at TIMESTAMPTZ,
  primary_keyword TEXT,
  intent TEXT,
  embedding vector(1536),
  last_audited_at TIMESTAMPTZ,
  health_score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pages TO authenticated;
GRANT ALL ON public.pages TO service_role;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read pages" ON public.pages FOR SELECT TO authenticated USING (public.can_access_site(site_id));
CREATE POLICY "members write pages" ON public.pages FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));
CREATE TRIGGER trg_pages_updated BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_pages_site ON public.pages(site_id);

CREATE TABLE public.page_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  raw_html TEXT,
  rendered_html TEXT,
  headings JSONB,
  schema_jsonld JSONB,
  internal_link_count INTEGER,
  outbound_link_count INTEGER,
  affiliate_link_count INTEGER,
  image_count INTEGER,
  hash TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_snapshots TO authenticated;
GRANT ALL ON public.page_snapshots TO service_role;
ALTER TABLE public.page_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read snapshots" ON public.page_snapshots FOR SELECT TO authenticated USING (public.can_access_site(site_id));
CREATE POLICY "members write snapshots" ON public.page_snapshots FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.sitemap_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  lastmod TIMESTAMPTZ,
  in_sitemap BOOLEAN DEFAULT TRUE,
  in_wordpress BOOLEAN DEFAULT FALSE,
  blocked_by_robots BOOLEAN DEFAULT FALSE,
  noindex BOOLEAN DEFAULT FALSE,
  canonical_mismatch BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sitemap_urls TO authenticated;
GRANT ALL ON public.sitemap_urls TO service_role;
ALTER TABLE public.sitemap_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read sitemap" ON public.sitemap_urls FOR SELECT TO authenticated USING (public.can_access_site(site_id));
CREATE POLICY "members write sitemap" ON public.sitemap_urls FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.robots_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  robots_txt TEXT,
  llms_txt TEXT,
  issues JSONB
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.robots_checks TO authenticated;
GRANT ALL ON public.robots_checks TO service_role;
ALTER TABLE public.robots_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access robots" ON public.robots_checks FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

-- =========================
-- ANALYTICS: GSC / GA4
-- =========================
CREATE TABLE public.gsc_page_query_daily (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  url TEXT NOT NULL,
  query TEXT NOT NULL,
  country TEXT,
  device TEXT,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr NUMERIC(6,4) DEFAULT 0,
  position NUMERIC(6,2) DEFAULT 0
);
CREATE INDEX idx_gsc_site_date ON public.gsc_page_query_daily(site_id, date);
CREATE INDEX idx_gsc_site_url ON public.gsc_page_query_daily(site_id, url);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsc_page_query_daily TO authenticated;
GRANT ALL ON public.gsc_page_query_daily TO service_role;
GRANT USAGE ON SEQUENCE public.gsc_page_query_daily_id_seq TO authenticated, service_role;
ALTER TABLE public.gsc_page_query_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access gsc" ON public.gsc_page_query_daily FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.ga4_landing_daily (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  landing_path TEXT NOT NULL,
  sessions INTEGER DEFAULT 0,
  engaged_sessions INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  affiliate_clicks INTEGER DEFAULT 0,
  outbound_clicks INTEGER DEFAULT 0,
  tool_starts INTEGER DEFAULT 0,
  tool_completes INTEGER DEFAULT 0,
  newsletter_signups INTEGER DEFAULT 0,
  revenue NUMERIC(12,2) DEFAULT 0
);
CREATE INDEX idx_ga4_site_date ON public.ga4_landing_daily(site_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ga4_landing_daily TO authenticated;
GRANT ALL ON public.ga4_landing_daily TO service_role;
GRANT USAGE ON SEQUENCE public.ga4_landing_daily_id_seq TO authenticated, service_role;
ALTER TABLE public.ga4_landing_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access ga4" ON public.ga4_landing_daily FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

-- =========================
-- KEYWORDS / SERP
-- =========================
CREATE TABLE public.keyword_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  intent TEXT,
  pillar_url TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keyword_clusters TO authenticated;
GRANT ALL ON public.keyword_clusters TO service_role;
ALTER TABLE public.keyword_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access clusters" ON public.keyword_clusters FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  cluster_id UUID REFERENCES public.keyword_clusters(id) ON DELETE SET NULL,
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  difficulty NUMERIC(5,2),
  cpc NUMERIC(8,2),
  intent TEXT,
  source TEXT, -- 'gsc' | 'dataforseo_mock' | 'manual'
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keywords TO authenticated;
GRANT ALL ON public.keywords TO service_role;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access keywords" ON public.keywords FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.rank_snapshots (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES public.keywords(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  position NUMERIC(6,2),
  url TEXT,
  is_mock BOOLEAN DEFAULT FALSE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rank_snapshots TO authenticated;
GRANT ALL ON public.rank_snapshots TO service_role;
GRANT USAGE ON SEQUENCE public.rank_snapshots_id_seq TO authenticated, service_role;
ALTER TABLE public.rank_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access ranks" ON public.rank_snapshots FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.serp_snapshots (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  features JSONB,
  results JSONB,
  is_mock BOOLEAN DEFAULT FALSE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.serp_snapshots TO authenticated;
GRANT ALL ON public.serp_snapshots TO service_role;
GRANT USAGE ON SEQUENCE public.serp_snapshots_id_seq TO authenticated, service_role;
ALTER TABLE public.serp_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access serps" ON public.serp_snapshots FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.competitor_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  keyword TEXT,
  url TEXT NOT NULL,
  domain TEXT,
  position INTEGER,
  word_count INTEGER,
  entities JSONB,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  is_mock BOOLEAN DEFAULT FALSE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_pages TO authenticated;
GRANT ALL ON public.competitor_pages TO service_role;
ALTER TABLE public.competitor_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access competitors" ON public.competitor_pages FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

-- =========================
-- OPPORTUNITIES
-- =========================
CREATE TYPE public.opportunity_type AS ENUM (
  'ctr_leak','striking_distance','decayed_page','cannibalization','indexation_risk',
  'internal_link_gap','schema_gap','ai_answer_gap','monetization_leak','affiliate_optimization',
  'content_refresh','technical_seo_issue','hub_opportunity','new_content_opportunity'
);
CREATE TYPE public.opportunity_status AS ENUM ('open','in_progress','queued','approved','published','dismissed','won','lost','neutral');

CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  type public.opportunity_type NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  evidence JSONB,
  recommended_action TEXT,
  validation_method TEXT,
  severity INTEGER CHECK (severity BETWEEN 1 AND 5),
  impact_score NUMERIC(5,2),
  confidence_score NUMERIC(5,2),
  effort_score NUMERIC(5,2),
  risk_score NUMERIC(5,2),
  reversibility_score NUMERIC(5,2),
  priority NUMERIC(7,2),
  status public.opportunity_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access opportunities" ON public.opportunities FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));
CREATE TRIGGER trg_opp_updated BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_opp_site_status ON public.opportunities(site_id, status);

-- =========================
-- CONTENT PIPELINE
-- =========================
CREATE TYPE public.brief_status AS ENUM ('draft','ready','in_writing','complete','archived');

CREATE TABLE public.content_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  target_url TEXT,
  target_queries JSONB,
  intent TEXT,
  missing_entities JSONB,
  competitor_gaps JSONB,
  internal_link_targets JSONB,
  recommended_sections JSONB,
  monetization_angle TEXT,
  schema_recommendation JSONB,
  validation_checklist JSONB,
  status public.brief_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_briefs TO authenticated;
GRANT ALL ON public.content_briefs TO service_role;
ALTER TABLE public.content_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access briefs" ON public.content_briefs FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));
CREATE TRIGGER trg_brief_updated BEFORE UPDATE ON public.content_briefs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TYPE public.diff_status AS ENUM ('proposed','validating','validated','rejected','approved','published','rolled_back');

CREATE TABLE public.content_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  brief_id UUID REFERENCES public.content_briefs(id) ON DELETE SET NULL,
  proposed_title TEXT,
  proposed_meta_description TEXT,
  proposed_slug TEXT,
  proposed_html TEXT,
  proposed_schema_jsonld JSONB,
  before_hash TEXT,
  after_hash TEXT,
  diff_summary JSONB,
  status public.diff_status NOT NULL DEFAULT 'proposed',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_diffs TO authenticated;
GRANT ALL ON public.content_diffs TO service_role;
ALTER TABLE public.content_diffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access diffs" ON public.content_diffs FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));
CREATE TRIGGER trg_diff_updated BEFORE UPDATE ON public.content_diffs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.validation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  diff_id UUID REFERENCES public.content_diffs(id) ON DELETE CASCADE,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  blocking_failures JSONB,
  warnings JSONB,
  checks JSONB,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.validation_runs TO authenticated;
GRANT ALL ON public.validation_runs TO service_role;
ALTER TABLE public.validation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access validation" ON public.validation_runs FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.wp_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  wp_post_id BIGINT,
  payload JSONB NOT NULL, -- full WP post snapshot for rollback
  hash TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wp_snapshots TO authenticated;
GRANT ALL ON public.wp_snapshots TO service_role;
ALTER TABLE public.wp_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access wp snapshots" ON public.wp_snapshots FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TYPE public.publish_job_status AS ENUM ('queued','running','succeeded','failed','rolled_back');
CREATE TYPE public.publish_mode AS ENUM ('draft','live_update','rollback');

CREATE TABLE public.publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  diff_id UUID NOT NULL REFERENCES public.content_diffs(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  mode public.publish_mode NOT NULL DEFAULT 'draft',
  status public.publish_job_status NOT NULL DEFAULT 'queued',
  rollback_snapshot_id UUID REFERENCES public.wp_snapshots(id) ON DELETE SET NULL,
  result JSONB,
  error TEXT,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_jobs TO authenticated;
GRANT ALL ON public.publish_jobs TO service_role;
ALTER TABLE public.publish_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access publish jobs" ON public.publish_jobs FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

-- =========================
-- INTERNAL LINKS / SCHEMA / MONETIZATION
-- =========================
CREATE TABLE public.internal_links (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  source_page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  target_page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor_text TEXT,
  is_nofollow BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_il_site ON public.internal_links(site_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_links TO authenticated;
GRANT ALL ON public.internal_links TO service_role;
GRANT USAGE ON SEQUENCE public.internal_links_id_seq TO authenticated, service_role;
ALTER TABLE public.internal_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access internal links" ON public.internal_links FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.link_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  source_page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  target_page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  suggested_anchor TEXT,
  placement_hint TEXT,
  similarity NUMERIC(5,4),
  status public.opportunity_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_opportunities TO authenticated;
GRANT ALL ON public.link_opportunities TO service_role;
ALTER TABLE public.link_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access link opps" ON public.link_opportunities FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.schema_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  schema_type TEXT NOT NULL,
  current_jsonld JSONB,
  recommended_jsonld JSONB,
  visible_evidence_ok BOOLEAN,
  status TEXT DEFAULT 'detected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schema_items TO authenticated;
GRANT ALL ON public.schema_items TO service_role;
ALTER TABLE public.schema_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access schema" ON public.schema_items FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  merchant TEXT,
  network TEXT,
  rel_attrs TEXT,
  tracking_id TEXT,
  has_disclosure BOOLEAN DEFAULT FALSE,
  broken BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_links TO authenticated;
GRANT ALL ON public.affiliate_links TO service_role;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access affiliate" ON public.affiliate_links FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.monetization_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- 'missing_disclosure','no_above_intro_cta','missing_comparison_table','broken_merchant','untracked_outbound'
  description TEXT,
  recommended_fix JSONB,
  status public.opportunity_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monetization_opportunities TO authenticated;
GRANT ALL ON public.monetization_opportunities TO service_role;
ALTER TABLE public.monetization_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access monetization" ON public.monetization_opportunities FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

-- =========================
-- AI VISIBILITY
-- =========================
CREATE TABLE public.ai_visibility_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  topic TEXT,
  competitor_brands JSONB,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_visibility_prompts TO authenticated;
GRANT ALL ON public.ai_visibility_prompts TO service_role;
ALTER TABLE public.ai_visibility_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access ai prompts" ON public.ai_visibility_prompts FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.ai_visibility_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.ai_visibility_prompts(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  response TEXT,
  brand_mentioned BOOLEAN,
  url_cited BOOLEAN,
  competitor_mentions JSONB,
  citation_quality TEXT,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_visibility_runs TO authenticated;
GRANT ALL ON public.ai_visibility_runs TO service_role;
ALTER TABLE public.ai_visibility_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access ai runs" ON public.ai_visibility_runs FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

CREATE TABLE public.ai_citations (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.ai_visibility_runs(id) ON DELETE CASCADE,
  url TEXT,
  domain TEXT,
  context TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_citations TO authenticated;
GRANT ALL ON public.ai_citations TO service_role;
GRANT USAGE ON SEQUENCE public.ai_citations_id_seq TO authenticated, service_role;
ALTER TABLE public.ai_citations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access citations" ON public.ai_citations FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

-- =========================
-- EXPERIMENTS / REVENUE
-- =========================
CREATE TYPE public.experiment_status AS ENUM ('baseline','running','completed','inconclusive');
CREATE TYPE public.experiment_result AS ENUM ('pending','win','loss','neutral');

CREATE TABLE public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  diff_id UUID REFERENCES public.content_diffs(id) ON DELETE SET NULL,
  hypothesis TEXT,
  baseline JSONB,
  implementation_date TIMESTAMPTZ,
  measurement_windows JSONB DEFAULT '[14,28,60,90]'::jsonb,
  current_result public.experiment_result NOT NULL DEFAULT 'pending',
  status public.experiment_status NOT NULL DEFAULT 'baseline',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiments TO authenticated;
GRANT ALL ON public.experiments TO service_role;
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access experiments" ON public.experiments FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));
CREATE TRIGGER trg_exp_updated BEFORE UPDATE ON public.experiments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.revenue_per_url (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  date DATE NOT NULL,
  affiliate_clicks INTEGER DEFAULT 0,
  est_revenue NUMERIC(12,2) DEFAULT 0,
  is_mock BOOLEAN DEFAULT FALSE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_per_url TO authenticated;
GRANT ALL ON public.revenue_per_url TO service_role;
GRANT USAGE ON SEQUENCE public.revenue_per_url_id_seq TO authenticated, service_role;
ALTER TABLE public.revenue_per_url ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access revenue" ON public.revenue_per_url FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));

-- =========================
-- LOGS / RULES
-- =========================
CREATE TABLE public.ai_usage_logs (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  task TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd NUMERIC(10,4),
  latency_ms INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;
GRANT USAGE ON SEQUENCE public.ai_usage_logs_id_seq TO authenticated, service_role;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read ai usage" ON public.ai_usage_logs FOR SELECT TO authenticated USING (org_id IS NULL OR public.is_org_member(org_id));

CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
GRANT USAGE ON SEQUENCE public.audit_logs_id_seq TO authenticated, service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (org_id IS NULL OR public.is_org_member(org_id));

CREATE TABLE public.site_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  rule_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, rule_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_rules TO authenticated;
GRANT ALL ON public.site_rules TO service_role;
ALTER TABLE public.site_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access rules" ON public.site_rules FOR ALL TO authenticated USING (public.can_access_site(site_id)) WITH CHECK (public.can_access_site(site_id));
