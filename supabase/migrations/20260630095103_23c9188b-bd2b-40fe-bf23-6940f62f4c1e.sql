
-- Google OAuth state (CSRF)
CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  redirect_after TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at TIMESTAMPTZ
);
GRANT ALL ON public.google_oauth_states TO service_role;
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;
-- no policies: service-role only

-- Google connections (one per user per org)
CREATE TABLE IF NOT EXISTS public.google_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'connected',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_refreshed_at TIMESTAMPTZ,
  UNIQUE(org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_connections TO authenticated;
GRANT ALL ON public.google_connections TO service_role;
ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gc_select_org_members" ON public.google_connections
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "gc_modify_admins" ON public.google_connections
  FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'admin'))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'admin'));

-- Encrypted Google tokens (service-role only)
CREATE TABLE IF NOT EXISTS public.encrypted_google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.google_connections(id) ON DELETE CASCADE,
  token_kind TEXT NOT NULL,
  ciphertext BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(connection_id, token_kind)
);
GRANT ALL ON public.encrypted_google_tokens TO service_role;
ALTER TABLE public.encrypted_google_tokens ENABLE ROW LEVEL SECURITY;
-- no policies: service-role only

-- GSC properties
CREATE TABLE IF NOT EXISTS public.gsc_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.google_connections(id) ON DELETE CASCADE,
  site_url TEXT NOT NULL,
  permission_level TEXT,
  selected BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, site_url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsc_properties TO authenticated;
GRANT ALL ON public.gsc_properties TO service_role;
ALTER TABLE public.gsc_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gp_select_org_members" ON public.gsc_properties
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "gp_modify_admins" ON public.gsc_properties
  FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'admin'))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'admin'));

-- Site <-> GSC property mapping
CREATE TABLE IF NOT EXISTS public.site_gsc_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  gsc_property_id UUID NOT NULL REFERENCES public.gsc_properties(id) ON DELETE CASCADE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_gsc_connections TO authenticated;
GRANT ALL ON public.site_gsc_connections TO service_role;
ALTER TABLE public.site_gsc_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sgc_select_org_members" ON public.site_gsc_connections
  FOR SELECT TO authenticated
  USING (public.can_access_site(site_id));
CREATE POLICY "sgc_modify_admins" ON public.site_gsc_connections
  FOR ALL TO authenticated
  USING (public.can_admin_site(site_id))
  WITH CHECK (public.can_admin_site(site_id));

-- Encrypted token helpers (pgcrypto via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.write_google_token(_connection_id uuid, _kind text, _plain text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.encrypted_google_tokens (connection_id, token_kind, ciphertext)
  VALUES (_connection_id, _kind, pgp_sym_encrypt(_plain, _key))
  ON CONFLICT (connection_id, token_kind)
  DO UPDATE SET ciphertext = EXCLUDED.ciphertext, updated_at = now()
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.read_google_token(_connection_id uuid, _kind text, _key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE pt text;
BEGIN
  SELECT pgp_sym_decrypt(ciphertext, _key) INTO pt
  FROM public.encrypted_google_tokens
  WHERE connection_id = _connection_id AND token_kind = _kind
  LIMIT 1;
  RETURN pt;
END $$;

REVOKE ALL ON FUNCTION public.write_google_token(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_google_token(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_google_token(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_google_token(uuid, text, text) TO service_role;
