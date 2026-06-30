// Server-only crypto helpers using pgcrypto via SECURITY DEFINER RPCs.
import type { SupabaseClient } from "@supabase/supabase-js";

function key(): string {
  const k = process.env.WP_ENCRYPTION_KEY;
  if (!k) throw new Error("WP_ENCRYPTION_KEY not configured");
  return k;
}

export async function storeSiteSecret(
  admin: SupabaseClient,
  siteId: string,
  kind: string,
  plaintext: string,
): Promise<void> {
  const { error } = await admin.rpc("write_site_secret", {
    _site_id: siteId,
    _kind: kind,
    _plain: plaintext,
    _key: key(),
  });
  if (error) throw error;
}

export async function readSiteSecret(
  admin: SupabaseClient,
  siteId: string,
  kind: string,
): Promise<string | null> {
  const { data, error } = await admin.rpc("read_site_secret", {
    _site_id: siteId,
    _kind: kind,
    _key: key(),
  });
  if (error) throw error;
  return (data as string) ?? null;
}
