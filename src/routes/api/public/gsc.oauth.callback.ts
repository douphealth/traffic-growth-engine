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

        const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
        const forwardedProto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
        const appOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin;
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
          tokens = await exchangeCodeForTokens(
            code,
            `${appOrigin}/api/public/gsc/oauth/callback`,
          );
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

        // Enterprise onboarding behavior: after OAuth, immediately discover every
        // Search Console property available to the account and provision/link a
        // site record for each property. No manual WordPress connection is needed.
        let syncResult: { properties: number; created: number; linked: number } | null = null;
        try {
          const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          if (!res.ok) throw new Error(await res.text());
          const json = (await res.json()) as {
            siteEntry?: { siteUrl: string; permissionLevel?: string }[];
          };
          const entries = json.siteEntry ?? [];

          if (entries.length) {
            const now = new Date().toISOString();
            const rows = entries.map((entry) => ({
              org_id: st.org_id,
              connection_id: connectionId,
              site_url: entry.siteUrl,
              permission_level: entry.permissionLevel ?? null,
              last_seen_at: now,
            }));
            const { error: propErr } = await supabaseAdmin
              .from("gsc_properties")
              .upsert(rows as never, { onConflict: "org_id,site_url" });
            if (propErr) throw propErr;
          }

          const { data: props, error: propsErr } = await supabaseAdmin
            .from("gsc_properties")
            .select("id, site_url")
            .eq("connection_id", connectionId);
          if (propsErr) throw propsErr;

          const identityFromProperty = (siteUrl: string) => {
            if (siteUrl.startsWith("sc-domain:")) {
              const host = siteUrl.slice("sc-domain:".length).trim().replace(/^\*\./, "");
              return host ? { baseUrl: `https://${host}`, name: host } : null;
            }
            try {
              const u = new URL(siteUrl);
              const pathSuffix = u.pathname && u.pathname !== "/" ? u.pathname.replace(/\/$/, "") : "";
              return {
                baseUrl: `${u.protocol}//${u.host}${pathSuffix}`,
                name: pathSuffix ? `${u.hostname}${pathSuffix}` : u.hostname,
              };
            } catch {
              return siteUrl.trim() ? { baseUrl: siteUrl.trim(), name: siteUrl.trim() } : null;
            }
          };

          const propRows = (props ?? []) as { id: string; site_url: string }[];
          const propIds = propRows.map((p) => p.id);
          const { data: existingMaps } = propIds.length
            ? await supabaseAdmin
                .from("site_gsc_connections")
                .select("gsc_property_id")
                .in("gsc_property_id", propIds)
            : { data: [] };
          const linkedPropIds = new Set((existingMaps ?? []).map((m: any) => m.gsc_property_id));

          let created = 0;
          let linked = 0;
          for (const prop of propRows) {
            if (linkedPropIds.has(prop.id)) continue;
            const identity = identityFromProperty(prop.site_url);
            if (!identity) continue;

            const { data: exactSite } = await supabaseAdmin
              .from("sites")
              .select("id")
              .eq("org_id", st.org_id)
              .eq("gsc_property", prop.site_url)
              .maybeSingle();

            let siteId = (exactSite as { id: string } | null)?.id;
            if (!siteId) {
              const { data: candidates } = await supabaseAdmin
                .from("sites")
                .select("id, gsc_property")
                .eq("org_id", st.org_id)
                .eq("base_url", identity.baseUrl)
                .limit(10);
              const reusable = (candidates ?? []).find((site: any) => !site.gsc_property);
              siteId = reusable?.id;
              if (siteId) {
                const { error: updateErr } = await supabaseAdmin
                  .from("sites")
                  .update({ gsc_property: prop.site_url, status: "connected" })
                  .eq("id", siteId);
                if (updateErr) throw updateErr;
              }
            }

            if (!siteId) {
              const { data: inserted, error: insertErr } = await supabaseAdmin
                .from("sites")
                .insert({
                  org_id: st.org_id,
                  name: identity.name,
                  base_url: identity.baseUrl,
                  status: "connected",
                  gsc_property: prop.site_url,
                } as never)
                .select("id")
                .single();
              if (insertErr || !inserted) throw insertErr ?? new Error("Unable to create site");
              siteId = (inserted as { id: string }).id;
              created++;
            }

            const { error: mapErr } = await supabaseAdmin.from("site_gsc_connections").upsert(
              {
                site_id: siteId,
                gsc_property_id: prop.id,
                connected_at: new Date().toISOString(),
              } as never,
              { onConflict: "site_id" },
            );
            if (mapErr) throw mapErr;
            await supabaseAdmin.from("gsc_properties").update({ selected: true }).eq("id", prop.id);
            linked++;
          }

          syncResult = { properties: propRows.length, created, linked };
          await supabaseAdmin.from("audit_logs").insert({
            org_id: st.org_id,
            user_id: st.user_id,
            action: "gsc.oauth_auto_link",
            entity_type: "google_connection",
            entity_id: connectionId,
            after: syncResult,
          });
        } catch (e) {
          await supabaseAdmin.from("audit_logs").insert({
            org_id: st.org_id,
            user_id: st.user_id,
            action: "gsc.oauth_auto_link_failed",
            entity_type: "google_connection",
            entity_id: connectionId,
            after: { error: e instanceof Error ? e.message : "unknown" },
          });
        }

        const dest = st.redirect_after && st.redirect_after.startsWith("/")
          ? st.redirect_after
          : "/gsc/connect";
        const destination = new URL(dest, appOrigin);
        destination.searchParams.set("gsc", "connected");
        if (syncResult) {
          destination.searchParams.set("properties", String(syncResult.properties));
          destination.searchParams.set("created", String(syncResult.created));
          destination.searchParams.set("linked", String(syncResult.linked));
        }
        return Response.redirect(destination.toString(), 302);
      },
    },
  },
});
