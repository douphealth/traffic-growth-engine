ALTER TABLE public.site_gsc_connections
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.site_gsc_connections
  DROP CONSTRAINT IF EXISTS site_gsc_connections_site_id_key;

ALTER TABLE public.site_gsc_connections
  DROP CONSTRAINT IF EXISTS site_gsc_connections_gsc_property_id_key;

ALTER TABLE public.site_gsc_connections
  DROP CONSTRAINT IF EXISTS site_gsc_connections_site_id_gsc_property_id_key;

ALTER TABLE public.site_gsc_connections
  ADD CONSTRAINT site_gsc_connections_gsc_property_id_key UNIQUE (gsc_property_id);

ALTER TABLE public.site_gsc_connections
  ADD CONSTRAINT site_gsc_connections_site_id_gsc_property_id_key UNIQUE (site_id, gsc_property_id);

CREATE UNIQUE INDEX IF NOT EXISTS site_gsc_one_primary_per_site
  ON public.site_gsc_connections(site_id)
  WHERE is_primary;

UPDATE public.site_gsc_connections sgc
SET is_primary = true
WHERE sgc.id IN (
  SELECT DISTINCT ON (sgc2.site_id) sgc2.id
  FROM public.site_gsc_connections sgc2
  JOIN public.gsc_properties gp ON gp.id = sgc2.gsc_property_id
  ORDER BY sgc2.site_id,
    CASE WHEN gp.site_url LIKE 'sc-domain:%' THEN 0 ELSE 1 END,
    sgc2.connected_at
);