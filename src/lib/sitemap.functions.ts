import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { XMLParser } from "fast-xml-parser";

const xml = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

async function fetchUrls(url: string, depth = 0): Promise<{ loc: string; lastmod?: string }[]> {
  if (depth > 2) return [];
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) return [];
  const text = await res.text();
  const parsed = xml.parse(text) as any;
  if (parsed.sitemapindex?.sitemap) {
    const list = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap];
    const out: { loc: string; lastmod?: string }[] = [];
    for (const s of list) {
      if (s?.loc) {
        const sub = await fetchUrls(String(s.loc), depth + 1);
        out.push(...sub);
      }
    }
    return out;
  }
  if (parsed.urlset?.url) {
    const list = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
    return list
      .map((u: any) => ({ loc: String(u.loc ?? ""), lastmod: u.lastmod ? String(u.lastmod) : undefined }))
      .filter((u: { loc: string }) => u.loc);
  }
  return [];
}

export const crawlSitemap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ site_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: site } = await supabase
      .from("sites")
      .select("id, org_id, base_url, sitemap_url")
      .eq("id", data.site_id)
      .single();
    if (!site) throw new Error("Site not found");
    const sitemap = site.sitemap_url || `${site.base_url}/sitemap_index.xml`;

    const urls = await fetchUrls(sitemap);
    if (urls.length === 0) {
      return { sitemap_count: 0, matched: 0, wp_missing: 0, sitemap_missing_from_wp: 0, message: "No URLs found." };
    }

    // Upsert sitemap rows in batches
    const batchSize = 500;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize).map((u) => ({
        site_id: site.id,
        url: u.loc,
        lastmod: u.lastmod ? new Date(u.lastmod).toISOString() : null,
        in_sitemap: true,
      }));
      await supabaseAdmin.from("sitemap_urls").upsert(batch as never, { onConflict: "site_id,url" });
    }

    // Reset in_sitemap then mark matched
    await supabaseAdmin.from("pages").update({ in_sitemap: false } as never).eq("site_id", site.id);
    const sitemapSet = new Set(urls.map((u) => u.loc));
    const { data: allPages } = await supabaseAdmin
      .from("pages")
      .select("id, url")
      .eq("site_id", site.id);
    const pageUrls = new Set((allPages ?? []).map((p) => p.url));
    const toMark = (allPages ?? []).filter((p) => sitemapSet.has(p.url)).map((p) => p.id);
    if (toMark.length) {
      await supabaseAdmin
        .from("pages")
        .update({ in_sitemap: true } as never)
        .in("id", toMark);
    }
    const wp_missing = (allPages ?? []).filter((p) => !sitemapSet.has(p.url)).length;
    const sitemap_missing_from_wp = urls.filter((u) => !pageUrls.has(u.loc)).length;

    await supabase.from("audit_logs").insert({
      org_id: site.org_id,
      site_id: site.id,
      user_id: userId,
      action: "sitemap.crawl",
      entity_type: "site",
      entity_id: site.id,
      after: { sitemap_count: urls.length, matched: toMark.length, wp_missing, sitemap_missing_from_wp },
    });

    return {
      sitemap_count: urls.length,
      matched: toMark.length,
      wp_missing,
      sitemap_missing_from_wp,
    };
  });
