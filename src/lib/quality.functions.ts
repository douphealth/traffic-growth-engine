import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SiteMetric = {
  site_id: string;
  name: string;
  base_url: string;
  gsc_property: string | null;
  pages: number;
  gsc_pages: number;
  wp_pages: number;
  gsc_rows: number;
  gsc_urls: number;
  opportunities: number;
  last_gsc_date: string | null;
  first_gsc_date: string | null;
  linked_properties: string[];
  permission_levels: string[];
};

export type SitePipelineHealth = {
  key: string;
  canonical_site_id: string;
  name: string;
  base_url: string;
  site_ids: string[];
  property_variants: string[];
  permission_levels: string[];
  pages: number;
  gsc_pages: number;
  wp_pages: number;
  gsc_rows: number;
  gsc_urls: number;
  opportunities: number;
  first_gsc_date: string | null;
  last_gsc_date: string | null;
  freshness_days: number | null;
  quality_score: number;
  status: "ready" | "needs_attention" | "not_imported";
  issues: string[];
};

function normalizeBaseUrl(input: string): string {
  try {
    const url = input.startsWith("sc-domain:")
      ? new URL(`https://${input.slice("sc-domain:".length)}`)
      : new URL(input);
    const path = url.pathname && url.pathname !== "/" ? url.pathname.replace(/\/$/, "") : "";
    return `${url.hostname.toLowerCase()}${path}`;
  } catch {
    return input.replace(/^https?:\/\//, "").replace(/^sc-domain:/, "").replace(/\/$/, "").toLowerCase();
  }
}

function daysSince(date: string | null): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export const getPipelineHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: memberships } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", userId);
    const orgIds = (memberships ?? []).map((m) => m.org_id);
    if (!orgIds.length) {
      return { generated_at: new Date().toISOString(), totals: emptyTotals(), sites: [] as SitePipelineHealth[] };
    }

    const { data: sites, error: sitesError } = await supabaseAdmin
      .from("sites")
      .select("id, org_id, name, base_url, gsc_property, created_at")
      .in("org_id", orgIds)
      .order("created_at", { ascending: true });
    if (sitesError) throw new Error(sitesError.message);

    const { data: mappings } = await supabaseAdmin
      .from("site_gsc_connections")
      .select("site_id, gsc_properties:gsc_property_id(site_url, permission_level)");

    const propertyBySite = new Map<string, Array<{ site_url: string | null; permission_level: string | null }>>();
    for (const m of mappings ?? []) {
      const prop = Array.isArray((m as any).gsc_properties)
        ? (m as any).gsc_properties[0]
        : (m as any).gsc_properties;
      const siteId = (m as any).site_id;
      propertyBySite.set(siteId, [
        ...(propertyBySite.get(siteId) ?? []),
        {
        site_url: prop?.site_url ?? null,
        permission_level: prop?.permission_level ?? null,
        },
      ]);
    }

    const metrics: SiteMetric[] = [];
    for (const site of sites ?? []) {
      const [pages, gscPages, wpPages, opps, gscRows, gscUrlsRows, gscDateRows] = await Promise.all([
        supabaseAdmin.from("pages").select("id", { count: "exact", head: true }).eq("site_id", site.id),
        supabaseAdmin.from("pages").select("id", { count: "exact", head: true }).eq("site_id", site.id).eq("post_type", "gsc_url"),
        supabaseAdmin.from("pages").select("id", { count: "exact", head: true }).eq("site_id", site.id).not("wp_post_id", "is", null),
        supabaseAdmin.from("opportunities").select("id", { count: "exact", head: true }).eq("site_id", site.id).eq("status", "open"),
        supabaseAdmin.from("gsc_page_query_daily").select("id", { count: "exact", head: true }).eq("site_id", site.id),
        supabaseAdmin.from("gsc_page_query_daily").select("url").eq("site_id", site.id).limit(50_000),
        supabaseAdmin.from("gsc_page_query_daily").select("date").eq("site_id", site.id).order("date", { ascending: false }).limit(1),
      ]);

      const { data: oldest } = await supabaseAdmin
        .from("gsc_page_query_daily")
        .select("date")
        .eq("site_id", site.id)
        .order("date", { ascending: true })
        .limit(1);

      const props = propertyBySite.get(site.id) ?? [];
      metrics.push({
        site_id: site.id,
        name: site.name,
        base_url: site.base_url,
        gsc_property: site.gsc_property,
        pages: pages.count ?? 0,
        gsc_pages: gscPages.count ?? 0,
        wp_pages: wpPages.count ?? 0,
        gsc_rows: gscRows.count ?? 0,
        gsc_urls: new Set((gscUrlsRows.data ?? []).map((r: { url: string }) => r.url)).size,
        opportunities: opps.count ?? 0,
        last_gsc_date: gscDateRows.data?.[0]?.date ?? null,
        first_gsc_date: oldest?.[0]?.date ?? null,
        linked_properties: props.length ? props.map((p) => p.site_url).filter(Boolean) as string[] : (site.gsc_property ? [site.gsc_property] : []),
        permission_levels: props.map((p) => p.permission_level).filter(Boolean) as string[],
      });
    }

    const grouped = new Map<string, SiteMetric[]>();
    for (const m of metrics) {
      const key = normalizeBaseUrl(m.base_url || m.gsc_property || m.name);
      grouped.set(key, [...(grouped.get(key) ?? []), m]);
    }

    const health: SitePipelineHealth[] = [...grouped.entries()].map(([key, rows]) => {
      const canonical = [...rows].sort((a, b) =>
        b.gsc_rows - a.gsc_rows || b.pages - a.pages || b.opportunities - a.opportunities || a.base_url.localeCompare(b.base_url),
      )[0];
      const last = rows
        .map((r) => r.last_gsc_date)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
      const first = rows
        .map((r) => r.first_gsc_date)
        .filter(Boolean)
        .sort()[0] ?? null;
      const rowCount = sum(rows, "gsc_rows");
      const urlCount = sum(rows, "gsc_urls");
      const pageCount = sum(rows, "pages");
      const oppCount = sum(rows, "opportunities");
      const freshness = daysSince(last);
      const issues: string[] = [];
      if (rows.length > 1) issues.push(`${rows.length} Search Console property variants are represented; metrics are aggregated under one site.`);
      if (rowCount === 0) issues.push("No Search Console rows imported yet.");
      if (rowCount > 0 && pageCount === 0) issues.push("GSC URLs are not synced into analyzable page records yet.");
      if (rowCount > 0 && pageCount > 0 && oppCount === 0) issues.push("Imported data exists, but opportunity scoring has not produced actions yet.");
      if (freshness != null && freshness > 5) issues.push(`Latest GSC row is ${freshness} days old.`);

      const quality = clamp(
        100 -
          (rowCount === 0 ? 45 : 0) -
          (rowCount > 0 && pageCount === 0 ? 25 : 0) -
          (rowCount > 0 && pageCount > 0 && oppCount === 0 ? 18 : 0) -
          (freshness != null && freshness > 5 ? 12 : 0) -
          (rows.length > 1 ? 6 : 0),
      );

      return {
        key,
        canonical_site_id: canonical.site_id,
        name: canonical.name,
        base_url: canonical.base_url,
        site_ids: rows.map((r) => r.site_id),
        property_variants: Array.from(new Set(rows.flatMap((r) => r.linked_properties))),
        permission_levels: Array.from(new Set(rows.flatMap((r) => r.permission_levels))),
        pages: pageCount,
        gsc_pages: sum(rows, "gsc_pages"),
        wp_pages: sum(rows, "wp_pages"),
        gsc_rows: rowCount,
        gsc_urls: urlCount,
        opportunities: oppCount,
        first_gsc_date: first,
        last_gsc_date: last,
        freshness_days: freshness,
        quality_score: quality,
        status: rowCount === 0 ? "not_imported" : quality >= 75 ? "ready" : "needs_attention",
        issues,
      } satisfies SitePipelineHealth;
    });

    health.sort((a, b) => b.gsc_rows - a.gsc_rows || a.name.localeCompare(b.name));
    return {
      generated_at: new Date().toISOString(),
      totals: {
        sites: health.length,
        property_variants: metrics.length,
        pages: health.reduce((n, s) => n + s.pages, 0),
        gsc_urls: health.reduce((n, s) => n + s.gsc_urls, 0),
        gsc_rows: health.reduce((n, s) => n + s.gsc_rows, 0),
        opportunities: health.reduce((n, s) => n + s.opportunities, 0),
        average_quality: health.length ? Math.round(health.reduce((n, s) => n + s.quality_score, 0) / health.length) : 0,
      },
      sites: health,
    };
  });

function sum(rows: SiteMetric[], key: keyof Pick<SiteMetric, "pages" | "gsc_pages" | "wp_pages" | "gsc_rows" | "gsc_urls" | "opportunities">): number {
  return rows.reduce((n, r) => n + Number(r[key] ?? 0), 0);
}

function emptyTotals() {
  return { sites: 0, property_variants: 0, pages: 0, gsc_urls: 0, gsc_rows: 0, opportunities: 0, average_quality: 0 };
}