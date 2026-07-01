import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * syncPagesFromGsc — for a given site, ensure every distinct URL seen in
 * gsc_page_query_daily has a row in `pages`. Required because the
 * opportunity engine iterates `pages`; without this step a GSC-only site
 * has no rows to score against.
 */
export const syncPagesFromGsc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ site_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: site } = await supabase
      .from("sites")
      .select("id, org_id")
      .eq("id", data.site_id)
      .single();
    if (!site) throw new Error("Site not found");

    // Distinct URLs from GSC for this site. Order by URL so pagination is
    // deterministic and keep going until Supabase returns a short page; do not
    // cap at 200k rows because large enterprise GSC exports regularly exceed it.
    const urls = new Set<string>();
    let from = 0;
    const pageSize = 5000;
    while (true) {
      const { data: rows, error } = await supabaseAdmin
        .from("gsc_page_query_daily")
        .select("url")
        .eq("site_id", site.id)
        .order("url", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!rows || !rows.length) break;
      for (const r of rows) if (r.url) urls.add(r.url);
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    if (urls.size === 0) {
      return { discovered: 0, inserted: 0, updated: 0 };
    }

    // Existing pages for these URLs
    const urlArr = Array.from(urls);
    const existing = new Map<string, { id: string; wp_post_id: number | null }>();
    const chunk = 500;
    for (let i = 0; i < urlArr.length; i += chunk) {
      const slice = urlArr.slice(i, i + chunk);
      const { data: ex } = await supabaseAdmin
        .from("pages")
        .select("id, url, wp_post_id")
        .eq("site_id", site.id)
        .in("url", slice);
      for (const r of ex ?? []) existing.set(r.url, { id: r.id, wp_post_id: r.wp_post_id });
    }

    const now = new Date().toISOString();
    const toInsert: Array<Record<string, unknown>> = [];
    const toTouch: string[] = [];

    for (const url of urlArr) {
      const ex = existing.get(url);
      if (!ex) {
        toInsert.push({
          site_id: site.id,
          url,
          post_type: "gsc_url",
          status: "unknown",
          title: url,
          indexability_status: "unknown",
          discovery_source: "gsc",
          gsc_first_seen_at: now,
          gsc_last_seen_at: now,
          last_imported_at: now,
        });
      } else if (ex.wp_post_id == null) {
        // Refresh last_imported_at only for GSC-discovered pages; never overwrite WP fields
        toTouch.push(ex.id);
      }
    }

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 500) {
      const batch = toInsert.slice(i, i + 500);
      const { error } = await supabaseAdmin
        .from("pages")
        .insert(batch as never)
        .select("id");
      if (error) throw new Error(error.message);
      inserted += batch.length;
    }

    let updated = 0;
    for (let i = 0; i < toTouch.length; i += 500) {
      const batch = toTouch.slice(i, i + 500);
      const { error, count } = await supabaseAdmin
        .from("pages")
        .update({ last_imported_at: now, discovery_source: "gsc", gsc_last_seen_at: now } as never, { count: "exact" })
        .in("id", batch);
      if (error) throw new Error(error.message);
      updated += count ?? batch.length;
    }

    await supabase.from("audit_logs").insert({
      org_id: site.org_id,
      site_id: site.id,
      user_id: userId,
      action: "pages.sync_from_gsc",
      entity_type: "site",
      entity_id: site.id,
      after: { discovered: urls.size, inserted, updated },
    });

    await supabaseAdmin
      .from("sites")
      .update({ last_pipeline_run_at: now, data_quality_status: "pages_synced_from_gsc" } as never)
      .eq("id", site.id);

    return { discovered: urls.size, inserted, updated };
  });

/**
 * importAllConnectedGscProperties — for every site in the user's org that
 * has a linked GSC property, run the full pipeline:
 *   import GSC rows → sync pages from GSC → score opportunities.
 */
export const importAllConnectedGscProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { importGscData } = await import("@/lib/gsc.functions");

    const { data: orgs } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", context.userId);
    const orgIds = (orgs ?? []).map((o) => o.org_id);
    if (!orgIds.length) {
      return { processed: 0, results: [], totals: { rows: 0, urls: 0, pages: 0, opportunities: 0 } };
    }

    const { data: sites } = await supabase
      .from("sites")
      .select("id, name, base_url, gsc_property, site_gsc_connections(gsc_property_id)")
      .in("org_id", orgIds);

    const results: Array<{
      site_id: string;
      site_name: string;
      ok: boolean;
      rows?: number;
      urls?: number;
      pages_inserted?: number;
      pages_updated?: number;
      opportunities?: number;
      error?: string;
    }> = [];

    let totRows = 0,
      totUrls = 0,
      totPages = 0,
      totOpps = 0;

    const targets = (sites ?? []).filter((s: any) => Boolean(s.gsc_property) || (s.site_gsc_connections?.length ?? 0) > 0);

    for (const s of targets) {
      try {
        const imp = await importGscData({ data: { site_id: s.id } });
        if ("status" in imp && imp.status === "not_connected") {
          results.push({ site_id: s.id, site_name: s.name, ok: false, error: imp.reason });
          continue;
        }
        const i = imp as {
          rows: number;
          skipped_rows?: number;
          pages?: { discovered: number; inserted: number; updated: number };
          opportunities?: number;
        };
        totRows += i.rows ?? 0;
        totUrls += i.pages?.discovered ?? 0;
        totPages += (i.pages?.inserted ?? 0) + (i.pages?.updated ?? 0);
        totOpps += i.opportunities ?? 0;
        results.push({
          site_id: s.id,
          site_name: s.name,
          ok: true,
          rows: i.rows,
          urls: i.pages?.discovered,
          pages_inserted: i.pages?.inserted,
          pages_updated: i.pages?.updated,
          opportunities: i.opportunities,
        });
      } catch (e) {
        results.push({
          site_id: s.id,
          site_name: s.name,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return {
      processed: results.length,
      results,
      totals: { rows: totRows, urls: totUrls, pages: totPages, opportunities: totOpps },
    };
  });

/**
 * Lightweight diagnostic for /gsc/connect.
 */
export const getGscDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const oauthConfigured = Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_REDIRECT_URI,
    );
    const gatewayConfigured = Boolean(
      process.env.LOVABLE_API_KEY && process.env.GOOGLE_SEARCH_CONSOLE_API_KEY,
    );

    const { data: conn } = await supabase
      .from("google_connections")
      .select("id, google_email, status, connected_at, last_refreshed_at, org_id")
      .eq("user_id", userId)
      .maybeSingle();

    let refreshTokenStored = false;
    if (conn) {
      const { count } = await supabaseAdmin
        .from("encrypted_google_tokens")
        .select("id", { count: "exact", head: true })
        .eq("connection_id", conn.id)
        .eq("token_kind", "refresh_token");
      refreshTokenStored = (count ?? 0) > 0;
    }

    const { count: propertyCount } = conn
      ? await supabaseAdmin
          .from("gsc_properties")
          .select("id", { count: "exact", head: true })
          .eq("connection_id", conn.id)
      : { count: 0 };

    const { data: orgs } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", userId);
    const orgIds = (orgs ?? []).map((o) => o.org_id);

    const { count: linkedCount } = orgIds.length
      ? await supabaseAdmin
          .from("site_gsc_connections")
          .select("site_id, sites!inner(org_id)", { count: "exact", head: true })
          .in("sites.org_id", orgIds)
      : { count: 0 };

    const { data: siteIds } = orgIds.length
      ? await supabaseAdmin.from("sites").select("id").in("org_id", orgIds)
      : { data: [] };
    const ids = (siteIds ?? []).map((s: { id: string }) => s.id);

    let gscRows = 0;
    let gscUrls = 0;
    let pagesFromGsc = 0;
    let oppsCount = 0;
    let lastImport: string | null = null;
    if (ids.length) {
      const { count: rc } = await supabaseAdmin
        .from("gsc_page_query_daily")
        .select("site_id", { count: "exact", head: true })
        .in("site_id", ids);
      gscRows = rc ?? 0;

      const { data: distinctUrls } = await supabaseAdmin
        .from("gsc_page_query_daily")
        .select("url")
        .in("site_id", ids)
        .limit(50000);
      gscUrls = new Set((distinctUrls ?? []).map((r) => r.url)).size;

      const { count: pc } = await supabaseAdmin
        .from("pages")
        .select("id", { count: "exact", head: true })
        .in("site_id", ids)
        .eq("post_type", "gsc_url");
      pagesFromGsc = pc ?? 0;

      const { count: oc } = await supabaseAdmin
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .in("site_id", ids);
      oppsCount = oc ?? 0;

      const { data: latest } = await supabaseAdmin
        .from("audit_logs")
        .select("created_at")
        .eq("action", "gsc.import")
        .in("site_id", ids)
        .order("created_at", { ascending: false })
        .limit(1);
      lastImport = latest?.[0]?.created_at ?? null;
    }

    return {
      oauthConfigured,
      gatewayConfigured,
      connection: conn
        ? {
            email: conn.google_email,
            status: conn.status,
            connected_at: conn.connected_at,
            last_refreshed_at: conn.last_refreshed_at,
          }
        : null,
      refreshTokenStored,
      propertyCount: propertyCount ?? 0,
      linkedSiteCount: linkedCount ?? 0,
      gscRows,
      gscUrls,
      pagesFromGsc,
      opportunities: oppsCount,
      lastImport,
    };
  });
