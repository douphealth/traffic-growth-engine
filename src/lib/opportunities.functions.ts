import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type PageRow = {
  id: string;
  url: string;
  title: string | null;
  word_count: number | null;
  status: string | null;
  noindex: boolean | null;
  canonical_mismatch: boolean | null;
  in_sitemap: boolean | null;
  extracted: { internal_links?: string[]; schema_jsonld?: unknown[]; affiliate_links?: string[] } | null;
};

// Expected CTR by position (approx Advanced Web Ranking 2024)
const EXPECTED_CTR = [0, 0.32, 0.18, 0.12, 0.08, 0.06, 0.045, 0.035, 0.028, 0.022, 0.018];

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export const scoreOpportunities = createServerFn({ method: "POST" })
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

    // Load pages
    const { data: pages } = await supabaseAdmin
      .from("pages")
      .select("id, url, title, word_count, status, noindex, canonical_mismatch, in_sitemap, extracted")
      .eq("site_id", site.id);
    const pageList = (pages ?? []) as PageRow[];
    const pageByUrl = new Map(pageList.map((p) => [p.url, p]));

    // Load GSC aggregated by url+query for last 28d and prev 28d
    const today = new Date();
    const d = (off: number) => new Date(today.getTime() - off * 86400000).toISOString().slice(0, 10);
    const last28End = d(3);
    const last28Start = d(30);
    const prev28End = d(31);
    const prev28Start = d(58);

    const { data: gscLast } = await supabaseAdmin
      .from("gsc_page_query_daily")
      .select("url, query, clicks, impressions, position")
      .eq("site_id", site.id)
      .gte("date", last28Start)
      .lte("date", last28End);
    const { data: gscPrev } = await supabaseAdmin
      .from("gsc_page_query_daily")
      .select("url, query, clicks, impressions, position")
      .eq("site_id", site.id)
      .gte("date", prev28Start)
      .lte("date", prev28End);

    type Agg = { clicks: number; impressions: number; positionSum: number; positionN: number };
    const aggLast = new Map<string, Agg>(); // url
    const aggPrev = new Map<string, Agg>();
    const queryByUrl = new Map<string, Map<string, Agg>>();
    const urlsByQuery = new Map<string, Set<string>>(); // for cannibalization

    const add = (m: Map<string, Agg>, key: string, r: { clicks: number | null; impressions: number | null; position: number | null }) => {
      const cur = m.get(key) ?? { clicks: 0, impressions: 0, positionSum: 0, positionN: 0 };
      cur.clicks += r.clicks ?? 0;
      cur.impressions += r.impressions ?? 0;
      if (r.position != null && r.impressions) {
        cur.positionSum += r.position * (r.impressions ?? 0);
        cur.positionN += r.impressions ?? 0;
      }
      m.set(key, cur);
    };

    for (const r of gscLast ?? []) {
      add(aggLast, r.url, r);
      if (!queryByUrl.has(r.url)) queryByUrl.set(r.url, new Map());
      add(queryByUrl.get(r.url)!, r.query, r);
      if ((r.position ?? 99) <= 20) {
        if (!urlsByQuery.has(r.query)) urlsByQuery.set(r.query, new Set());
        urlsByQuery.get(r.query)!.add(r.url);
      }
    }
    for (const r of gscPrev ?? []) add(aggPrev, r.url, r);

    // Build inbound internal link count map
    const inboundCount = new Map<string, number>();
    for (const p of pageList) {
      for (const link of p.extracted?.internal_links ?? []) {
        inboundCount.set(link, (inboundCount.get(link) ?? 0) + 1);
      }
    }

    type Opp = {
      site_id: string;
      page_id: string | null;
      type:
        | "ctr_leak"
        | "striking_distance"
        | "decayed_page"
        | "cannibalization"
        | "indexation_risk"
        | "internal_link_gap"
        | "schema_gap"
        | "ai_answer_gap"
        | "monetization_leak";
      title: string;
      summary: string;
      evidence: Record<string, unknown>;
      recommended_action: string;
      validation_method: string;
      severity: number;
      impact_score: number;
      confidence_score: number;
      effort_score: number;
      risk_score: number;
      reversibility_score: number;
      priority: number;
      source_data: Record<string, unknown>;
      generated_at: string;
    };

    const opps: Opp[] = [];
    const now = new Date().toISOString();

    function score(parts: {
      traffic_upside: number;
      ctr_leak: number;
      striking_distance: number;
      decay: number;
      monetization: number;
      ai_answer: number;
      internal_link_gap: number;
      schema_gap: number;
      safety: number;
    }) {
      return clamp(
        0.22 * parts.traffic_upside +
          0.16 * parts.ctr_leak +
          0.14 * parts.striking_distance +
          0.12 * parts.decay +
          0.10 * parts.monetization +
          0.10 * parts.ai_answer +
          0.08 * parts.internal_link_gap +
          0.05 * parts.schema_gap +
          0.03 * parts.safety,
      );
    }

    for (const p of pageList) {
      const a = aggLast.get(p.url) ?? { clicks: 0, impressions: 0, positionSum: 0, positionN: 0 };
      const prev = aggPrev.get(p.url) ?? { clicks: 0, impressions: 0, positionSum: 0, positionN: 0 };
      const avgPos = a.positionN ? a.positionSum / a.positionN : null;
      const ctr = a.impressions ? a.clicks / a.impressions : 0;
      const hasSchema = (p.extracted?.schema_jsonld?.length ?? 0) > 0;
      const hasAffiliate = (p.extracted?.affiliate_links?.length ?? 0) > 0;
      const inbound = inboundCount.get(p.url) ?? 0;
      const upside = clamp((a.impressions / 50) + a.clicks / 5);

      // CTR leak: pos<=10 and ctr < expected*0.7
      if (avgPos != null && avgPos <= 10 && a.impressions >= 200) {
        const expected = EXPECTED_CTR[Math.round(avgPos)] ?? 0.02;
        if (expected > 0 && ctr < expected * 0.7) {
          const ctr_leak = clamp(((expected - ctr) / expected) * 100);
          opps.push({
            site_id: site.id,
            page_id: p.id,
            type: "ctr_leak",
            title: `CTR below expected at position ${avgPos.toFixed(1)}`,
            summary: `Page ranks ${avgPos.toFixed(1)} but CTR is ${(ctr * 100).toFixed(2)}% vs ~${(expected * 100).toFixed(1)}% expected.`,
            evidence: { impressions: a.impressions, clicks: a.clicks, ctr, expected_ctr: expected, avg_position: avgPos },
            recommended_action: "Rewrite title tag + meta description with stronger SERP magnets (numbers, brackets, intent words).",
            validation_method: "Track CTR delta over next 28 days vs prior 28 days for the same queries.",
            severity: ctr_leak > 60 ? 4 : 3,
            impact_score: clamp(upside * 1.2 + ctr_leak * 0.4),
            confidence_score: 85,
            effort_score: 20,
            risk_score: 15,
            reversibility_score: 95,
            priority: score({ traffic_upside: upside, ctr_leak, striking_distance: 0, decay: 0, monetization: 0, ai_answer: 0, internal_link_gap: 0, schema_gap: 0, safety: 0 }),
            source_data: { window: "28d" },
            generated_at: now,
          });
        }
      }

      // Striking distance: pos 8-20, impressions > 100
      if (avgPos != null && avgPos >= 8 && avgPos <= 20 && a.impressions >= 100) {
        const sd = clamp(100 - (avgPos - 8) * 6);
        opps.push({
          site_id: site.id,
          page_id: p.id,
          type: "striking_distance",
          title: `Striking distance at position ${avgPos.toFixed(1)}`,
          summary: `${a.impressions.toLocaleString()} impressions, position ${avgPos.toFixed(1)}. Small content boost may push into top 5.`,
          evidence: { impressions: a.impressions, clicks: a.clicks, avg_position: avgPos },
          recommended_action: "Expand sections answering top non-clicked queries; add FAQ; refresh internal links.",
          validation_method: "Re-measure position and clicks after 4 weeks.",
          severity: 3,
          impact_score: clamp(upside * 1.5),
          confidence_score: 70,
          effort_score: 45,
          risk_score: 10,
          reversibility_score: 90,
          priority: score({ traffic_upside: upside, ctr_leak: 0, striking_distance: sd, decay: 0, monetization: 0, ai_answer: 0, internal_link_gap: 0, schema_gap: 0, safety: 0 }),
          source_data: { window: "28d" },
          generated_at: now,
        });
      }

      // Decay: clicks down >30%
      if (prev.clicks >= 50 && a.clicks < prev.clicks * 0.7) {
        const decay = clamp(((prev.clicks - a.clicks) / prev.clicks) * 100);
        opps.push({
          site_id: site.id,
          page_id: p.id,
          type: "decayed_page",
          title: `Decayed page — clicks down ${decay.toFixed(0)}%`,
          summary: `${prev.clicks} → ${a.clicks} clicks vs prior 28 days.`,
          evidence: { clicks_prev: prev.clicks, clicks_now: a.clicks, impressions_prev: prev.impressions, impressions_now: a.impressions },
          recommended_action: "Audit freshness: update dates, screenshots, prices; refresh intro and conclusion; resubmit URL.",
          validation_method: "Compare next-28-day clicks vs current 28-day baseline.",
          severity: decay > 60 ? 4 : 3,
          impact_score: clamp(prev.clicks / 5),
          confidence_score: 75,
          effort_score: 35,
          risk_score: 15,
          reversibility_score: 90,
          priority: score({ traffic_upside: upside, ctr_leak: 0, striking_distance: 0, decay, monetization: 0, ai_answer: 0, internal_link_gap: 0, schema_gap: 0, safety: 0 }),
          source_data: { window: "28d-vs-prev-28d" },
          generated_at: now,
        });
      }

      // Indexation risk
      if ((p.noindex || p.canonical_mismatch || p.in_sitemap === false) && a.impressions >= 100) {
        opps.push({
          site_id: site.id,
          page_id: p.id,
          type: "indexation_risk",
          title: `Indexation risk on high-traffic page`,
          summary: `Page is noindexed, has canonical mismatch, or missing from sitemap, yet earns ${a.impressions} impressions.`,
          evidence: { noindex: !!p.noindex, canonical_mismatch: !!p.canonical_mismatch, in_sitemap: !!p.in_sitemap, impressions: a.impressions },
          recommended_action: "Verify intentional. If not, remove noindex, fix canonical, add to sitemap, request re-indexing.",
          validation_method: "Inspect URL in Search Console after fix; monitor impressions.",
          severity: 5,
          impact_score: clamp(upside * 2),
          confidence_score: 95,
          effort_score: 15,
          risk_score: 25,
          reversibility_score: 95,
          priority: score({ traffic_upside: upside, ctr_leak: 0, striking_distance: 0, decay: 0, monetization: 0, ai_answer: 0, internal_link_gap: 0, schema_gap: 0, safety: 90 }),
          source_data: {},
          generated_at: now,
        });
      }

      // Internal link gap
      if (inbound === 0 && (a.impressions > 50 || (p.word_count ?? 0) > 800)) {
        opps.push({
          site_id: site.id,
          page_id: p.id,
          type: "internal_link_gap",
          title: `No inbound internal links`,
          summary: `Page has 0 inbound internal links from other pages on this site.`,
          evidence: { inbound_links: 0, impressions: a.impressions, word_count: p.word_count },
          recommended_action: "Add 3–5 contextual internal links from related high-authority pages.",
          validation_method: "Re-crawl and confirm inbound count > 0; observe impressions over 4 weeks.",
          severity: 2,
          impact_score: clamp(upside * 0.8 + 20),
          confidence_score: 70,
          effort_score: 25,
          risk_score: 5,
          reversibility_score: 100,
          priority: score({ traffic_upside: upside, ctr_leak: 0, striking_distance: 0, decay: 0, monetization: 0, ai_answer: 0, internal_link_gap: 80, schema_gap: 0, safety: 0 }),
          source_data: {},
          generated_at: now,
        });
      }

      // Schema gap
      if (!hasSchema && a.impressions >= 100) {
        opps.push({
          site_id: site.id,
          page_id: p.id,
          type: "schema_gap",
          title: `No JSON-LD schema detected`,
          summary: `Page earns traffic but emits no structured data.`,
          evidence: { schema_jsonld_count: 0, impressions: a.impressions },
          recommended_action: "Add Article / Product / FAQ / HowTo JSON-LD aligned to visible page content.",
          validation_method: "Validate with Rich Results Test; monitor SERP appearance.",
          severity: 2,
          impact_score: clamp(upside * 0.6 + 15),
          confidence_score: 60,
          effort_score: 20,
          risk_score: 10,
          reversibility_score: 100,
          priority: score({ traffic_upside: upside, ctr_leak: 0, striking_distance: 0, decay: 0, monetization: 0, ai_answer: 0, internal_link_gap: 0, schema_gap: 80, safety: 0 }),
          source_data: {},
          generated_at: now,
        });
      }

      // AI answer gap (long-form, no h2-driven FAQ-style summary)
      if ((p.word_count ?? 0) > 1200 && a.impressions >= 50) {
        opps.push({
          site_id: site.id,
          page_id: p.id,
          type: "ai_answer_gap",
          title: `AI-answer readiness gap`,
          summary: `Long-form page lacking concise TL;DR + FAQ block — weak for AI citation.`,
          evidence: { word_count: p.word_count, impressions: a.impressions },
          recommended_action: "Add a 50–80 word TL;DR at top and a 5-question FAQ at bottom with explicit Q/A structure.",
          validation_method: "Re-run AI visibility check 4 weeks later (when AI module enabled).",
          severity: 2,
          impact_score: clamp(upside * 0.5 + 10),
          confidence_score: 55,
          effort_score: 30,
          risk_score: 5,
          reversibility_score: 100,
          priority: score({ traffic_upside: upside, ctr_leak: 0, striking_distance: 0, decay: 0, monetization: 0, ai_answer: 70, internal_link_gap: 0, schema_gap: 0, safety: 0 }),
          source_data: {},
          generated_at: now,
        });
      }

      // Monetization leak
      if (!hasAffiliate && a.clicks >= 30) {
        opps.push({
          site_id: site.id,
          page_id: p.id,
          type: "monetization_leak",
          title: `Traffic without monetization`,
          summary: `${a.clicks} clicks/28d but page has no affiliate or commerce link.`,
          evidence: { clicks: a.clicks, affiliate_links: 0 },
          recommended_action: "Add 1–3 contextual affiliate or product links matched to the page intent.",
          validation_method: "Track outbound clicks + revenue per URL after 30 days.",
          severity: 3,
          impact_score: clamp(a.clicks * 1.5),
          confidence_score: 75,
          effort_score: 25,
          risk_score: 15,
          reversibility_score: 100,
          priority: score({ traffic_upside: upside, ctr_leak: 0, striking_distance: 0, decay: 0, monetization: 80, ai_answer: 0, internal_link_gap: 0, schema_gap: 0, safety: 0 }),
          source_data: {},
          generated_at: now,
        });
      }
    }

    // Cannibalization across pages
    for (const [query, urls] of urlsByQuery) {
      if (urls.size < 2) continue;
      const list = Array.from(urls);
      const primary = pageByUrl.get(list[0]);
      if (!primary) continue;
      const totalImp = list.reduce((s, u) => s + (aggLast.get(u)?.impressions ?? 0), 0);
      if (totalImp < 200) continue;
      opps.push({
        site_id: site.id,
        page_id: primary.id,
        type: "cannibalization",
        title: `Cannibalization on "${query}"`,
        summary: `${list.length} URLs rank in top 20 for the same query.`,
        evidence: { query, urls: list, total_impressions: totalImp },
        recommended_action: "Choose one canonical URL, redirect/consolidate weaker pages, or differentiate intent.",
        validation_method: "Confirm only the chosen URL ranks in top 20 after 4 weeks.",
        severity: 3,
        impact_score: clamp(totalImp / 50),
        confidence_score: 70,
        effort_score: 50,
        risk_score: 35,
        reversibility_score: 60,
        priority: score({ traffic_upside: clamp(totalImp / 50), ctr_leak: 0, striking_distance: 0, decay: 0, monetization: 0, ai_answer: 0, internal_link_gap: 0, schema_gap: 0, safety: 0 }),
        source_data: { competing_urls: list },
        generated_at: now,
      });
    }

    // Replace previous open auto-generated opportunities
    await supabaseAdmin
      .from("opportunities")
      .delete()
      .eq("site_id", site.id)
      .eq("status", "open");

    let inserted = 0;
    if (opps.length) {
      const batch = 200;
      for (let i = 0; i < opps.length; i += batch) {
        const { error } = await supabaseAdmin
          .from("opportunities")
          .insert(opps.slice(i, i + batch) as never);
        if (error) throw new Error(error.message);
        inserted += Math.min(batch, opps.length - i);
      }
    }

    await supabase.from("audit_logs").insert({
      org_id: site.org_id,
      site_id: site.id,
      user_id: userId,
      action: "opportunities.score",
      entity_type: "site",
      entity_id: site.id,
      after: { inserted, types: countBy(opps.map((o) => o.type)) },
    });

    return { inserted, by_type: countBy(opps.map((o) => o.type)) };
  });

function countBy(arr: string[]): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, k) => {
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}
