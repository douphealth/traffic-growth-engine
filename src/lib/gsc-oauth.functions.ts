import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Start OAuth ----------
export const startGscOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ redirect_after: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isGoogleOAuthConfigured, buildConsentUrl, newState } = await import(
      "@/lib/google-oauth.server"
    );
    if (!isGoogleOAuthConfigured()) {
      return {
        ok: false as const,
        reason:
          "Google OAuth is not configured. Ask the workspace admin to add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.",
      };
    }

    const { data: member } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!member) return { ok: false as const, reason: "No workspace found for user." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const state = newState();
    const { error } = await supabaseAdmin.from("google_oauth_states").insert({
      user_id: userId,
      org_id: member.org_id,
      state,
      redirect_after: data.redirect_after ?? "/gsc/connect",
    });
    if (error) throw new Error(error.message);

    return { ok: true as const, url: buildConsentUrl(state) };
  });

// ---------- List GSC properties ----------
export const listGscProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ refresh: z.boolean().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: conn } = await supabase
      .from("google_connections")
      .select("id, org_id, google_email, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (!conn) return { ok: false as const, reason: "not_connected" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getFreshAccessToken } = await import("@/lib/google-tokens.server");

    if (data.refresh !== false) {
      const accessToken = await getFreshAccessToken(supabaseAdmin, conn.id);
      const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Search Console list failed: ${res.status} ${t.slice(0, 200)}`);
      }
      const j = (await res.json()) as {
        siteEntry?: { siteUrl: string; permissionLevel?: string }[];
      };
      const entries = j.siteEntry ?? [];
      if (entries.length) {
        const rows = entries.map((e) => ({
          org_id: conn.org_id,
          connection_id: conn.id,
          site_url: e.siteUrl,
          permission_level: e.permissionLevel ?? null,
          last_seen_at: new Date().toISOString(),
        }));
        const { error } = await supabaseAdmin
          .from("gsc_properties")
          .upsert(rows as never, { onConflict: "org_id,site_url" });
        if (error) throw new Error(error.message);
      }
    }

    const { data: props } = await supabase
      .from("gsc_properties")
      .select("id, site_url, permission_level, selected, last_seen_at")
      .eq("connection_id", conn.id)
      .order("site_url");

    return {
      ok: true as const,
      connection: { id: conn.id, email: conn.google_email, status: conn.status },
      properties: props ?? [],
    };
  });

// ---------- Connect property to site ----------
export const connectGscPropertyToSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ site_id: z.string().uuid(), gsc_property_id: z.string().uuid() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prop } = await supabase
      .from("gsc_properties")
      .select("id, site_url, org_id")
      .eq("id", data.gsc_property_id)
      .maybeSingle();
    if (!prop) throw new Error("Property not found");

    const { data: site } = await supabase
      .from("sites")
      .select("id, org_id")
      .eq("id", data.site_id)
      .maybeSingle();
    if (!site) throw new Error("Site not found");
    if (site.org_id !== prop.org_id) throw new Error("Site and property are in different workspaces");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin
      .from("site_gsc_connections")
      .upsert(
        { site_id: site.id, gsc_property_id: prop.id, connected_at: new Date().toISOString() } as never,
        { onConflict: "site_id" },
      );
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin
      .from("sites")
      .update({ gsc_property: prop.site_url })
      .eq("id", site.id);

    await supabaseAdmin
      .from("gsc_properties")
      .update({ selected: true })
      .eq("id", prop.id);

    await supabase.from("audit_logs").insert({
      org_id: prop.org_id,
      site_id: site.id,
      user_id: userId,
      action: "gsc.property.connect",
      entity_type: "site",
      entity_id: site.id,
      after: { gsc_property: prop.site_url },
    });

    return { ok: true as const };
  });

// ---------- Disconnect ----------
export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: conn } = await supabase
      .from("google_connections")
      .select("id, org_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!conn) return { ok: true as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("google_connections").delete().eq("id", conn.id);
    await supabase.from("audit_logs").insert({
      org_id: conn.org_id,
      user_id: userId,
      action: "gsc.disconnect",
      entity_type: "google_connection",
      entity_id: conn.id,
    });
    return { ok: true as const };
  });

// ---------- Get connection status ----------
export const getGoogleConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: conn } = await supabase
      .from("google_connections")
      .select("id, google_email, status, scopes, connected_at, last_refreshed_at")
      .eq("user_id", userId)
      .maybeSingle();
    return conn ?? null;
  });

// ---------- Auto-create + link sites from GSC properties ----------
export const autoLinkGscProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: conn } = await supabase
      .from("google_connections")
      .select("id, org_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!conn) return { ok: false as const, reason: "not_connected" };

    const { data: props } = await supabase
      .from("gsc_properties")
      .select("id, site_url, org_id")
      .eq("connection_id", conn.id);
    if (!props || props.length === 0) return { ok: true as const, created: 0, linked: 0 };

    const { data: existingMaps } = await supabase
      .from("site_gsc_connections")
      .select("gsc_property_id, site_id");
    const linkedPropIds = new Set((existingMaps ?? []).map((m) => m.gsc_property_id));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let created = 0;
    let linked = 0;

    for (const p of props) {
      if (linkedPropIds.has(p.id)) continue;

      let host = "";
      let baseUrl = "";
      if (p.site_url.startsWith("sc-domain:")) {
        host = p.site_url.slice("sc-domain:".length).trim();
        baseUrl = `https://${host}`;
      } else {
        try {
          const u = new URL(p.site_url);
          host = u.hostname;
          baseUrl = `${u.protocol}//${u.host}`;
        } catch {
          host = p.site_url;
          baseUrl = p.site_url;
        }
      }
      if (!host) continue;

      const { data: existingSite } = await supabaseAdmin
        .from("sites")
        .select("id")
        .eq("org_id", p.org_id)
        .eq("base_url", baseUrl)
        .maybeSingle();

      let siteId = (existingSite as { id: string } | null)?.id;
      if (!siteId) {
        const { data: ins, error: insErr } = await supabaseAdmin
          .from("sites")
          .insert({
            org_id: p.org_id,
            name: host,
            base_url: baseUrl,
            status: "pending",
            gsc_property: p.site_url,
          } as never)
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);
        siteId = (ins as { id: string }).id;
        created++;
      }

      const { error: mapErr } = await supabaseAdmin
        .from("site_gsc_connections")
        .upsert(
          {
            site_id: siteId,
            gsc_property_id: p.id,
            connected_at: new Date().toISOString(),
          } as never,
          { onConflict: "site_id" },
        );
      if (mapErr) throw new Error(mapErr.message);

      await supabaseAdmin
        .from("gsc_properties")
        .update({ selected: true })
        .eq("id", p.id);

      linked++;
    }

    await supabase.from("audit_logs").insert({
      org_id: conn.org_id,
      user_id: userId,
      action: "gsc.auto_link",
      entity_type: "google_connection",
      entity_id: conn.id,
      after: { created, linked },
    });

    return { ok: true as const, created, linked };
  });
