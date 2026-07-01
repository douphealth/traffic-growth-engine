ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS canonical_host TEXT,
  ADD COLUMN IF NOT EXISTS data_quality_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_pipeline_run_at TIMESTAMPTZ;

UPDATE public.sites
SET canonical_host = lower(regexp_replace(regexp_replace(regexp_replace(base_url, '^https?://', ''), '^www\.', ''), '/$', ''))
WHERE canonical_host IS NULL;

CREATE INDEX IF NOT EXISTS idx_sites_org_canonical_host ON public.sites(org_id, canonical_host);

ALTER TABLE public.gsc_page_query_daily
  ADD COLUMN IF NOT EXISTS gsc_property_id UUID REFERENCES public.gsc_properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_source TEXT NOT NULL DEFAULT 'gsc_oauth',
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_gsc_daily_property ON public.gsc_page_query_daily(gsc_property_id);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_site_date ON public.gsc_page_query_daily(site_id, date DESC);

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS discovery_source TEXT,
  ADD COLUMN IF NOT EXISTS gsc_first_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gsc_last_seen_at TIMESTAMPTZ;

UPDATE public.pages
SET discovery_source = COALESCE(discovery_source, CASE WHEN post_type = 'gsc_url' THEN 'gsc' ELSE 'wordpress' END)
WHERE discovery_source IS NULL;

CREATE OR REPLACE FUNCTION public.normalize_site_identity(_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(regexp_replace(regexp_replace(regexp_replace(_url, '^sc-domain:', ''), '^https?://', ''), '^www\.', ''), '/$', ''));
$$;