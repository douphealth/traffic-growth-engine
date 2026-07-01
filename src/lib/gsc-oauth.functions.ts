import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type GscPropertyRow = {
  id: string;
  site_url: string;
  org_id: string;
  permission_level?: string | null;
  selected?: boolean;
  last_seen_at?: string;
};

type GscApiEntry = { siteUrl: string; permissionLevel?: string };

const GSC_GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_search_console";

function hasGscGatewayConnection(): boolean {
  return Boolean(process.env.LOVABLE_API_KEY && process.env.GOOGLE_SEARCH_CONSOLE_API_KEY);
}

async function callGscGateway(path: string, init?: RequestInit): Promise<Response> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectionKey = process.env.GOOGLE_SEARCH_CONSOLE_API_KEY;
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Search Console connector is not linked to this app.");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${lovableKey}`);
  headers.set("X-Connection-Api-Key", connectionKey);

  const res = await fetch(`${GSC_GATEWAY_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Search Console connector failed: ${res.status} ${body.slice(0, 300)}`);
  }
  return res;
}

function canonicalHostFromProperty(siteUrl: string): string {
  const identity = siteIdentityFromProperty(siteUrl);
  return (identity?.host ?? siteUrl)
    .replace(/^https?:\/\//, "")
    .replace(/^sc-domain:/, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function siteIdentityFromProperty(siteUrl: string): { host: string; baseUrl: string; name: string; canonicalHost: string } | null {
  if (siteUrl.startsWith("sc-domain:")) {
    const host = siteUrl.slice("sc-domain:".length).trim().replace(/^\*\./, "").replace(/^www\./, "").toLowerCase();
    if (!host) return null;
    return { host, baseUrl: `https://${host}`, name: host, canonicalHost: host };
  }

  try {
    const u = new URL(siteUrl);
    const pathSuffix = u.pathname && u.pathname !== "/" ? u.pathname.replace(/\/$/, "") : "";
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return {
      host,
      baseUrl: `${u.protocol}//${host}${pathSuffix}`,
      name: pathSuffix ? `${host}${pathSuffix}` : host,
      canonicalHost: pathSuffix ? `${host}${pathSuffix}` : host,
    };
  } catch {
    const cleaned = siteUrl.trim();
    const canonicalHost = cleaned.replace(/^www\./, "").toLowerCase();
    return cleaned ? { host: canonicalHost, baseUrl: cleaned, name: canonicalHost, canonicalHost } : null;
  }
}

function choosePrimaryProperty(properties: GscPropertyRow[], propertyId: string, siteUrl: string) {
  const variants = properties.filter((p) => canonicalHostFromProperty(p.site_url) === canonicalHostFromProperty(siteUrl));
  const preferred = variants.find((p) => p.site_url.startsWith("sc-domain:")) ?? variants[0];
  return preferred?.id === propertyId;
}

async function getFirstOrgForUser(supabase: any, userId: string) {
  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return member?.org_id as string | undefined;
}

async function ensureConnectorConnection(supabaseAdmin: any, orgId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("google_connections")
    .upsert(
      {
        org_id: orgId,
        user_id: userId,
        google_email: "Google Search Console connector",
        scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
        status: "connector",
        last_refreshed_at: new Date().toISOString(),
      },
      { onConflict: "org_id,user_id" },
    )
    .select("id, org_id, google_email, status")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Unable to initialize GSC connector");
  return data as { id: string; org_id: string; google_email: string | null; status: string };
}

async function syncGatewayProperties(supabaseAdmin: any, orgId: string, userId: string) {
  const connection = await ensureConnectorConnection(supabaseAdmin, orgId, userId);
  const res = await callGscGateway("/webmasters/v3/sites");
  const json = (await res.json()) as { siteEntry?: GscApiEntry[] };
  const entries = json.siteEntry ?? [];

  if (entries.length) {
    const rows = entries.map((entry) => ({
      org_id: orgId,
      connection_id: connection.id,
      site_url: entry.siteUrl,
      permission_level: entry.permissionLevel ?? null,
      last_seen_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin
      .from("gsc_properties")
      .upsert(rows as never, { onConflict: "org_id,site_url" });
    if (error) throw new Error(error.message);
  }

  const { data: properties, error: propErr } = await supabaseAdmin
    .from("gsc_properties")
    .select("id, site_url, org_id, permission_level, selected, last_seen_at")
    .eq("connection_id", connection.id)
    .order("site_url");
  if (propErr) throw new Error(propErr.message);

  return { connection, properties: (properties ?? []) as GscPropertyRow[] };
}

async function autoCreateAndLinkSites(
  supabaseAdmin: any,
  orgId: string,
  userId: string,
  connectionId: string,
  properties: GscPropertyRow[],
) {
  const propIds = properties.map((p) => p.id);
  const { data: existingMaps } = propIds.length
    ? await supabaseAdmin
        .from("site_gsc_connections")
        .select("gsc_property_id, site_id")
        .in("gsc_property_id", propIds)
    : { data: [] };
  const linkedPropIds = new Set((existingMaps ?? []).map((m: any) => m.gsc_property_id));

  const { data: existingSites } = await supabaseAdmin
    .from("sites")
    .select("id, base_url, gsc_property, canonical_host")
    .eq("org_id", orgId);
  const siteCache = [...((existingSites ?? []) as Array<{ id: string; base_url: string; gsc_property: string | null; canonical_host?: string | null }>)];

  let created = 0;
  let linked = 0;

  for (const prop of properties) {
    if (linkedPropIds.has(prop.id)) continue;

    const identity = siteIdentityFromProperty(prop.site_url);
    if (!identity) continue;

    let siteId = siteCache.find(
      (site) => site.gsc_property === prop.site_url,
    )?.id;

    if (!siteId) {
      const reusable = siteCache.find(
        (site) => (site.canonical_host ?? canonicalHostFromProperty(site.base_url)) === identity.canonicalHost,
      );
      siteId = reusable?.id;

      if (siteId) {
        const { error: updateErr } = await supabaseAdmin
          .from("sites")
          .update({
            gsc_property: prop.site_url.startsWith("sc-domain:") ? prop.site_url : reusable?.gsc_property ?? prop.site_url,
            status: "connected",
            canonical_host: identity.canonicalHost,
            data_quality_status: "gsc_linked",
          } as never)
          .eq("id", siteId);
        if (updateErr) throw new Error(updateErr.message);
        const cached = siteCache.find((site) => site.id === siteId);
        if (cached) {
          cached.gsc_property = prop.site_url.startsWith("sc-domain:") ? prop.site_url : cached.gsc_property ?? prop.site_url;
          cached.canonical_host = identity.canonicalHost;
        }
      }
    }

    if (!siteId) {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("sites")
        .insert({
          org_id: orgId,
          name: identity.name,
          base_url: identity.baseUrl,
          status: "connected",
          gsc_property: prop.site_url,
          canonical_host: identity.canonicalHost,
          data_quality_status: "gsc_linked",
        } as never)
        .select("id")
        .single();
      if (insertErr || !inserted) throw new Error(insertErr?.message ?? "Unable to create site");
      siteId = (inserted as { id: string }).id;
      siteCache.push({ id: siteId, base_url: identity.baseUrl, gsc_property: prop.site_url, canonical_host: identity.canonicalHost });
      created++;
    }

    const { error: mapErr } = await supabaseAdmin.from("site_gsc_connections").upsert(
      {
        site_id: siteId,
        gsc_property_id: prop.id,
        connected_at: new Date().toISOString(),
        is_primary: choosePrimaryProperty(properties, prop.id, prop.site_url),
      } as never,
      { onConflict: "gsc_property_id" },
    );
    if (mapErr) throw new Error(mapErr.message);

    await supabaseAdmin.from("gsc_properties").update({ selected: true }).eq("id", prop.id);
    linked++;
  }

  await supabaseAdmin.from("audit_logs").insert({
    org_id: orgId,
    user_id: userId,
    action: "gsc.connector_auto_link",
    entity_type: "google_connection",
    entity_id: connectionId,
    after: { created, linked, properties: properties.length },
  });

  return { created, linked };
}

async function syncAndAutoLinkFromGateway(supabaseAdmin: any, orgId: string, userId: string) {
  const synced = await syncGatewayProperties(supabaseAdmin, orgId, userId);
  const result = await autoCreateAndLinkSites(
    supabaseAdmin,
    orgId,
    userId,
    synced.connection.id,
    synced.properties,
  );
  return { ...synced, ...result };
}

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
      if (hasGscGatewayConnection()) {
        const orgId = await getFirstOrgForUser(supabase, userId);
        if (!orgId) return { ok: false as const, reason: "No workspace found for user." };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const synced = await syncAndAutoLinkFromGateway(supabaseAdmin, orgId, userId);
        return {
          ok: true as const,
          mode: "connector" as const,
          created: synced.created,
          linked: synced.linked,
          properties: synced.properties.length,
        };
      }
      return {
        ok: false as const,
        reason:
          "Google OAuth is not configured. Ask the workspace admin to add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.",
      };
    }

    // Gateway is only a fallback when first-party OAuth is not configured.
    // (Block intentionally removed; OAuth path below handles configured installs.)


    const { data: member } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!member) return { ok: false as const, reason: "No workspace found for user." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const state = newState();
    const { getRequestUrl } = await import("@tanstack/react-start/server");
    const requestUrl = getRequestUrl({ xForwardedHost: true, xForwardedProto: true });
    const redirectUri = `${requestUrl.origin}/api/public/gsc/oauth/callback`;
    const { error } = await supabaseAdmin.from("google_oauth_states").insert({
      user_id: userId,
      org_id: member.org_id,
      state,
      redirect_after: data.redirect_after ?? "/gsc/connect",
    });
    if (error) throw new Error(error.message);

    return { ok: true as const, mode: "oauth" as const, url: buildConsentUrl(state, redirectUri) };
  });

// ---------- List GSC properties ----------
export const listGscProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ refresh: z.boolean().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let { data: conn } = await supabase
      .from("google_connections")
      .select("id, org_id, google_email, status")
      .eq("user_id", userId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!conn && hasGscGatewayConnection()) {
      const orgId = await getFirstOrgForUser(supabase, userId);
      if (!orgId) return { ok: false as const, reason: "No workspace found for user." };
      await syncAndAutoLinkFromGateway(supabaseAdmin, orgId, userId);
      const { data: refreshedConn } = await supabase
        .from("google_connections")
        .select("id, org_id, google_email, status")
        .eq("user_id", userId)
        .maybeSingle();
      conn = refreshedConn;
    }

    if (!conn) return { ok: false as const, reason: "not_connected" };

    if (data.refresh !== false) {
      if (conn.status === "connector" && hasGscGatewayConnection()) {
        await syncAndAutoLinkFromGateway(supabaseAdmin, conn.org_id, userId);
      } else {
        const { getFreshAccessToken } = await import("@/lib/google-tokens.server");
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
      .select("id, org_id, status")
      .eq("id", data.site_id)
      .maybeSingle();
    if (!site) throw new Error("Site not found");
    if (site.org_id !== prop.org_id) throw new Error("Site and property are in different workspaces");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count: siteMappings } = await supabaseAdmin
      .from("site_gsc_connections")
      .select("id", { count: "exact", head: true })
      .eq("site_id", site.id);

    const { error: upErr } = await supabaseAdmin
      .from("site_gsc_connections")
      .upsert(
        {
          site_id: site.id,
          gsc_property_id: prop.id,
          connected_at: new Date().toISOString(),
          is_primary: (siteMappings ?? 0) === 0,
        } as never,
        { onConflict: "gsc_property_id" },
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
      .select("id, org_id, status")
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
      .select("id, org_id, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (!conn) return { ok: false as const, reason: "not_connected" };

    if (conn.status === "connector" && hasGscGatewayConnection()) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const synced = await syncAndAutoLinkFromGateway(supabaseAdmin, conn.org_id, userId);
      return { ok: true as const, created: synced.created, linked: synced.linked };
    }

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
