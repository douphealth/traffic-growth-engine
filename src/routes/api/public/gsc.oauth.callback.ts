// Public OAuth callback. Auth identity is established by the signed `state` row.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/gsc/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        const appOrigin = url.origin;
        const fail = (msg: string) =>
          Response.redirect(
            `${appOrigin}/gsc/connect?gsc_error=${encodeURIComponent(msg)}`,
            302,
          );

        if (error) return fail(error);
        if (!code || !state) return fail("missing_code_or_state");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { exchangeCodeForTokens, fetchGoogleUserEmail } = await import(
          "@/lib/google-oauth.server"
        );
        const { writeGoogleToken } = await import("@/lib/google-tokens.server");

        // Look up + consume state
        const { data: st } = await supabaseAdmin
          .from("google_oauth_states")
          .select("id, user_id, org_id, redirect_after, expires_at, consumed_at")
          .eq("state", state)
          .maybeSingle();
        if (!st) return fail("invalid_state");
        if (st.consumed_at) return fail("state_already_used");
        if (new Date(st.expires_at).getTime() < Date.now()) return fail("state_expired");

        let tokens;
        try {
          tokens = await exchangeCodeForTokens(code);
        } catch (e) {
          return fail(e instanceof Error ? e.message : "token_exchange_failed");
        }
        if (!tokens.refresh_token) {
          return fail(
            "no_refresh_token_returned_revoke_and_retry",
          );
        }

        const email = await fetchGoogleUserEmail(tokens.access_token);
        const scopes = tokens.scope ? tokens.scope.split(" ") : [];

        // Upsert connection
        const { data: existing } = await supabaseAdmin
          .from("google_connections")
          .select("id")
          .eq("org_id", st.org_id)
          .eq("user_id", st.user_id)
          .maybeSingle();

        let connectionId: string;
        if (existing) {
          connectionId = existing.id;
          await supabaseAdmin
            .from("google_connections")
            .update({
              google_email: email,
              scopes,
              status: "connected",
              last_refreshed_at: new Date().toISOString(),
            })
            .eq("id", connectionId);
        } else {
          const { data: created, error: insErr } = await supabaseAdmin
            .from("google_connections")
            .insert({
              org_id: st.org_id,
              user_id: st.user_id,
              google_email: email,
              scopes,
              status: "connected",
              last_refreshed_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (insErr || !created) return fail(insErr?.message ?? "insert_failed");
          connectionId = created.id;
        }

        try {
          await writeGoogleToken(supabaseAdmin, connectionId, "refresh", tokens.refresh_token);
          await writeGoogleToken(supabaseAdmin, connectionId, "access", tokens.access_token);
        } catch (e) {
          return fail(e instanceof Error ? e.message : "token_store_failed");
        }

        await supabaseAdmin
          .from("google_oauth_states")
          .update({ consumed_at: new Date().toISOString() })
          .eq("id", st.id);

        await supabaseAdmin.from("audit_logs").insert({
          org_id: st.org_id,
          user_id: st.user_id,
          action: "gsc.connect",
          entity_type: "google_connection",
          entity_id: connectionId,
          after: { email, scopes },
        });

        const dest = st.redirect_after && st.redirect_after.startsWith("/")
          ? st.redirect_after
          : "/gsc/connect";
        return Response.redirect(`${appOrigin}${dest}?gsc=connected`, 302);
      },
    },
  },
});
