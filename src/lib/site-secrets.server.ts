// Server-only crypto helpers using pgcrypto.
// Stores/retrieves WP Application Passwords via encrypted_site_secrets.
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
) {
  // Encrypt via Postgres pgp_sym_encrypt, then store the bytea.
  const { data, error } = await admin.rpc("encrypt_text", {
    _plain: plaintext,
    _key: key(),
  });
  if (error) {
    // Fallback: inline SQL via raw via .from-not-possible; use a function.
    throw error;
  }
  // We expect 'data' to be a base64 string from RPC; insert raw bytea via SQL function instead.
  void data;
  const { error: insErr } = await admin
    .from("encrypted_site_secrets")
    .insert({ site_id: siteId, secret_kind: kind, ciphertext: (data as unknown) as string });
  if (insErr) throw insErr;
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
