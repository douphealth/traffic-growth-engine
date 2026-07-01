REVOKE ALL ON FUNCTION public.merge_site_into(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_site_into(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.merge_site_into(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.merge_site_into(UUID, UUID) TO service_role;