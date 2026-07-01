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

    const siteRows = sites ?? [];
    const siteIds = siteRows.map((site) => site.id);

    const { data: mappings } = siteIds.length
      ? await supabaseAdmin
          .from("site_gsc_connections")
          .select("site_id, gsc_properties:gsc_property_id(site_url, permission_level)")
          .in("site_id", siteIds)
      : { data: [] };

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

    const [pageRows, opportunityRows, gscRows] = await Promise.all([
      fetchAllRows<{ site_id: string; post_type: string | null; wp_post_id: number | null }>(async (from, to) => {
        return supabaseAdmin
          .from("pages")
          .select("site_id, post_type, wp_post_id")
          .in("site_id", siteIds)
          .range(from, to);
      }, siteIds.length),
      fetchAllRows<{ site_id: string; status: string | null }>(async (from, to) => {
        return supabaseAdmin
          .from("opportunities")
          .select("site_id, status")
          .in("site_id", siteIds)
          .eq("status", "open")
          .range(from, to);
      }, siteIds.length),
      fetchAllRows<{ site_id: string; url: string | null; date: string | null }>(async (from, to) => {
        return supabaseAdmin
          .from("gsc_page_query_daily")
          .select("site_id, url, date")
          .in("site_id", siteIds)
          .range(from, to);
      }, siteIds.length),
    ]);

    const pageStats = new Map<string, { pages: number; gsc_pages: number; wp_pages: number }>();
    for (const row of pageRows) {
      const current = pageStats.get(row.site_id) ?? { pages: 0, gsc_pages: 0, wp_pages: 0 };
      current.pages += 1;
      if (row.post_type === "gsc_url") current.gsc_pages += 1;
      if (row.wp_post_id != null) current.wp_pages += 1;
      pageStats.set(row.site_id, current);
    }

    const opportunityStats = new Map<string, number>();
    for (const row of opportunityRows) opportunityStats.set(row.site_id, (opportunityStats.get(row.site_id) ?? 0) + 1);

    const gscStats = new Map<string, { rows: number; urls: Set<string>; first: string | null; last: string | null }>();
    for (const row of gscRows) {
      const current = gscStats.get(row.site_id) ?? { rows: 0, urls: new Set<string>(), first: null, last: null };
      current.rows += 1;
      if (row.url) current.urls.add(row.url);
      if (row.date && (!current.first || row.date < current.first)) current.first = row.date;
      if (row.date && (!current.last || row.date > current.last)) current.last = row.date;
      gscStats.set(row.site_id, current);
    }

    const metrics: SiteMetric[] = [];
    for (const site of siteRows) {
      const pages = pageStats.get(site.id) ?? { pages: 0, gsc_pages: 0, wp_pages: 0 };
      const gsc = gscStats.get(site.id) ?? { rows: 0, urls: new Set<string>(), first: null, last: null };

      const props = propertyBySite.get(site.id) ?? [];
      metrics.push({
        site_id: site.id,
        name: site.name,
        base_url: site.base_url,
        gsc_property: site.gsc_property,
        pages: pages.pages,
        gsc_pages: pages.gsc_pages,
        wp_pages: pages.wp_pages,
        gsc_rows: gsc.rows,
        gsc_urls: gsc.urls.size,
        opportunities: opportunityStats.get(site.id) ?? 0,
        last_gsc_date: gsc.last,
        first_gsc_date: gsc.first,
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

async function fetchAllRows<T>(
  makeRequest: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  enabled: boolean | number,
): Promise<T[]> {
  if (!enabled) return [];
  const out: T[] = [];
  // The hosted PostgREST API caps responses at 1,000 rows even when a larger range is requested.
  // Use a 1,000-row page size so pagination does not stop early and under-report GSC evidence.
  const size = 1_000;
  for (let from = 0; ; from += size) {
    const { data, error } = await makeRequest(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}