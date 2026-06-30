// Server-only helpers for encrypted Google token storage and access-token issuance.
import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshAccessToken } from "./google-oauth.server";

function key(): string {
  const k = process.env.WP_ENCRYPTION_KEY;
  if (!k) throw new Error("WP_ENCRYPTION_KEY not configured");
  return k;
}

export async function writeGoogleToken(
  admin: SupabaseClient,
  connectionId: string,
  kind: "refresh" | "access",
  plaintext: string,
): Promise<void> {
  const { error } = await admin.rpc("write_google_token", {
    _connection_id: connectionId,
    _kind: kind,
    _plain: plaintext,
    _key: key(),
  });
  if (error) throw error;
}

export async function readGoogleToken(
  admin: SupabaseClient,
  connectionId: string,
  kind: "refresh" | "access",
): Promise<string | null> {
  const { data, error } = await admin.rpc("read_google_token", {
    _connection_id: connectionId,
    _kind: kind,
    _key: key(),
  });
  if (error) throw error;
  return (data as string) ?? null;
}

// Get a fresh access token for a connection, refreshing if needed.
// Always refreshes to keep it simple (we don't track expiry separately).
export async function getFreshAccessToken(
  admin: SupabaseClient,
  connectionId: string,
): Promise<string> {
  const refresh = await readGoogleToken(admin, connectionId, "refresh");
  if (!refresh) throw new Error("No refresh token; reconnect Google Search Console.");
  try {
    const tok = await refreshAccessToken(refresh);
    await writeGoogleToken(admin, connectionId, "access", tok.access_token);
    await admin
      .from("google_connections")
      .update({ last_refreshed_at: new Date().toISOString(), status: "connected" })
      .eq("id", connectionId);
    return tok.access_token;
  } catch (e) {
    await admin
      .from("google_connections")
      .update({ status: "revoked" })
      .eq("id", connectionId);
    throw e;
  }
}
