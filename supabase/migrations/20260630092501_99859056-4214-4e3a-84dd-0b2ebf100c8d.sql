
-- Encryption helpers, restricted to service_role.
CREATE OR REPLACE FUNCTION public.write_site_secret(_site_id uuid, _kind text, _plain text, _key text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE new_id uuid;
BEGIN
  DELETE FROM public.encrypted_site_secrets WHERE site_id = _site_id AND secret_kind = _kind;
  INSERT INTO public.encrypted_site_secrets (site_id, secret_kind, ciphertext)
  VALUES (_site_id, _kind, pgp_sym_encrypt(_plain, _key))
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.read_site_secret(_site_id uuid, _kind text, _key text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE pt text;
BEGIN
  SELECT pgp_sym_decrypt(ciphertext, _key) INTO pt
  FROM public.encrypted_site_secrets
  WHERE site_id = _site_id AND secret_kind = _kind
  ORDER BY created_at DESC LIMIT 1;
  RETURN pt;
END $$;

REVOKE ALL ON FUNCTION public.write_site_secret(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_site_secret(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_site_secret(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_site_secret(uuid, text, text) TO service_role;
