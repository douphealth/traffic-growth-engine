/**
 * Centralized MOCK data for AutoTraffic AI Phase 1.
 * Every value here is clearly labeled mock and must never be presented as real
 * analytics, rankings, revenue, or AI citation evidence.
 */

export const MOCK = true as const;

export type Severity = 1 | 2 | 3 | 4 | 5;

export type OpportunityType =
  | "ctr_leak"
  | "striking_distance"
  | "decayed_page"
  | "cannibalization"
  | "indexation_risk"
  | "internal_link_gap"
  | "schema_gap"
  | "ai_answer_gap"
  | "monetization_leak"
  | "affiliate_optimization"
  | "content_refresh"
  | "technical_seo_issue"
  | "hub_opportunity"
  | "new_content_opportunity";

export const OPPORTUNITY_LABEL: Record<OpportunityType, string> = {
  ctr_leak: "CTR leak",
  striking_distance: "Striking distance",
  decayed_page: "Decayed page",
  cannibalization: "Cannibalization",
  indexation_risk: "Indexation risk",
  internal_link_gap: "Internal link gap",
  schema_gap: "Schema gap",
  ai_answer_gap: "AI-answer gap",
  monetization_leak: "Monetization leak",
  affiliate_optimization: "Affiliate optimization",
  content_refresh: "Content refresh",
  technical_seo_issue: "Technical SEO issue",
  hub_opportunity: "Hub opportunity",
  new_content_opportunity: "New content opportunity",
};

export interface MockSite {
  id: string;
  name: string;
  base_url: string;
  status: "connected" | "pending" | "error" | "paused";
  pages: number;
  opportunities_open: number;
  gsc_property: string | null;
  ga4_property_id: string | null;
  last_scan: string;
}

export const mockSites: MockSite[] = [
  {
    id: "site_demo",
    name: "Demo Site (mock)",
    base_url: "https://example-demo.com",
    status: "connected",
    pages: 142,
    opportunities_open: 38,
    gsc_property: "sc-domain:example-demo.com",
    ga4_property_id: "properties/000000000",
    last_scan: "2026-06-30T04:12:00Z",
  },
];

export interface MockPage {
  id: string;
  url: string;
  title: string;
  post_type: "post" | "page";
  status: "publish" | "draft";
  word_count: number;
  modified_at: string;
  intent: "informational" | "commercial" | "transactional" | "navigational";
  primary_keyword: string;
  health_score: number;
  open_opportunities: number;
  clicks_28d: number;
  impressions_28d: number;
  avg_position: number;
}

export const mockPages: MockPage[] = [
  {
    id: "p1",
    url: "/best-noise-cancelling-headphones",
    title: "Best Noise-Cancelling Headphones (2026 Buyer's Guide)",
    post_type: "post",
    status: "publish",
    word_count: 2380,
    modified_at: "2026-03-14T09:21:00Z",
    intent: "commercial",
    primary_keyword: "best noise cancelling headphones",
    health_score: 62,
    open_opportunities: 7,
    clicks_28d: 412,
    impressions_28d: 18820,
    avg_position: 11.4,
  },
  {
    id: "p2",
    url: "/how-to-clean-airpods",
    title: "How to Clean AirPods (Step-by-Step)",
    post_type: "post",
    status: "publish",
    word_count: 1180,
    modified_at: "2025-11-02T17:04:00Z",
    intent: "informational",
    primary_keyword: "how to clean airpods",
    health_score: 74,
    open_opportunities: 3,
    clicks_28d: 1842,
    impressions_28d: 42110,
    avg_position: 4.2,
  },
  {
    id: "p3",
    url: "/sony-wh1000xm5-review",
    title: "Sony WH-1000XM5 Review (Hands-On)",
    post_type: "post",
    status: "publish",
    word_count: 2940,
    modified_at: "2025-08-19T12:00:00Z",
    intent: "commercial",
    primary_keyword: "sony wh-1000xm5 review",
    health_score: 55,
    open_opportunities: 9,
    clicks_28d: 287,
    impressions_28d: 9430,
    avg_position: 14.8,
  },
  {
    id: "p4",
    url: "/airpods-pro-vs-sony-xm5",
    title: "AirPods Pro vs Sony XM5: Which Should You Buy?",
    post_type: "post",
    status: "publish",
    word_count: 1860,
    modified_at: "2026-01-12T10:35:00Z",
    intent: "commercial",
    primary_keyword: "airpods pro vs sony xm5",
    health_score: 68,
    open_opportunities: 5,
    clicks_28d: 624,
    impressions_28d: 14210,
    avg_position: 8.1,
  },
  {
    id: "p5",
    url: "/bluetooth-codecs-explained",
    title: "Bluetooth Audio Codecs Explained (AAC, aptX, LDAC)",
    post_type: "post",
    status: "publish",
    word_count: 2110,
    modified_at: "2025-05-22T08:00:00Z",
    intent: "informational",
    primary_keyword: "bluetooth audio codecs",
    health_score: 49,
    open_opportunities: 11,
    clicks_28d: 96,
    impressions_28d: 5210,
    avg_position: 17.3,
  },
  {
    id: "p6",
    url: "/best-budget-anc-headphones",
    title: "Best Budget Noise-Cancelling Headphones Under $200",
    post_type: "post",
    status: "publish",
    word_count: 1950,
    modified_at: "2026-04-02T14:00:00Z",
    intent: "commercial",
    primary_keyword: "best budget noise cancelling headphones",
    health_score: 71,
    open_opportunities: 4,
    clicks_28d: 308,
    impressions_28d: 12640,
    avg_position: 9.6,
  },
];

export interface MockOpportunity {
  id: string;
  page_id: string;
  page_url: string;
  page_title: string;
  type: OpportunityType;
  title: string;
  summary: string;
  severity: Severity;
  impact: number;
  confidence: number;
  effort: number;
  risk: number;
  priority: number;
  status: "open" | "in_progress" | "queued" | "approved" | "published" | "dismissed";
  evidence: { label: string; value: string }[];
  recommended_action: string;
  validation_method: string;
}

export const mockOpportunities: MockOpportunity[] = [
  {
    id: "o1",
    page_id: "p1",
    page_url: "/best-noise-cancelling-headphones",
    page_title: "Best Noise-Cancelling Headphones (2026 Buyer's Guide)",
    type: "ctr_leak",
    title: "CTR 1.4% vs SERP-expected 3.8% at position 6",
    summary:
      "Page sits at avg position 6.2 for the head term with strong impressions but the title/meta don't match buyer language seen in PAA boxes.",
    severity: 4,
    impact: 86,
    confidence: 78,
    effort: 12,
    risk: 8,
    priority: 92,
    status: "open",
    evidence: [
      { label: "Position (28d)", value: "6.2" },
      { label: "CTR (28d)", value: "1.4%" },
      { label: "Impressions (28d)", value: "18,820" },
      { label: "Top competitor title pattern", value: "“Best X in 2026 — Tested by …”" },
    ],
    recommended_action:
      "Rewrite SEO title to surface year + tested-by signal; tighten meta to answer the buyer's price/use-case question.",
    validation_method: "GSC CTR @ position window 28d after publish vs prior 28d baseline.",
  },
  {
    id: "o2",
    page_id: "p3",
    page_url: "/sony-wh1000xm5-review",
    page_title: "Sony WH-1000XM5 Review (Hands-On)",
    type: "striking_distance",
    title: "8 queries at positions 11–15 with impressions but no clicks",
    summary:
      "Striking-distance queries cluster around comparison/intent. Adding an answer-first TL;DR and comparison table is likely to move several into top 10.",
    severity: 4,
    impact: 78,
    confidence: 70,
    effort: 18,
    risk: 9,
    priority: 81,
    status: "open",
    evidence: [
      { label: "Queries in 11–20", value: "8" },
      { label: "Combined impressions", value: "6,420" },
      { label: "Missing section", value: "Answer-first TL;DR" },
    ],
    recommended_action:
      "Insert quick-answer block + comparison table vs WH-1000XM4 and Bose QC Ultra; preserve existing affiliate product box.",
    validation_method: "Track ranks of the 8 queries weekly for 28/60/90 days.",
  },
  {
    id: "o3",
    page_id: "p5",
    page_url: "/bluetooth-codecs-explained",
    page_title: "Bluetooth Audio Codecs Explained",
    type: "decayed_page",
    title: "Traffic down 48% over last 90 days vs prior 90 days",
    summary:
      "Content is from 2024 and no longer matches updated codec landscape (LE Audio, LC3). Decay pattern matches refresh-needed.",
    severity: 3,
    impact: 58,
    confidence: 72,
    effort: 30,
    risk: 14,
    priority: 64,
    status: "open",
    evidence: [
      { label: "Clicks delta", value: "−48% (90d vs prior 90d)" },
      { label: "Last modified", value: "May 22, 2025" },
      { label: "Missing entity", value: "LC3 / LE Audio" },
    ],
    recommended_action:
      "Add an LC3/LE Audio section, refresh comparison table, update meta to surface 2026 freshness signal.",
    validation_method: "Compare clicks/impressions 28d after refresh vs preceding 28d baseline.",
  },
  {
    id: "o4",
    page_id: "p4",
    page_url: "/airpods-pro-vs-sony-xm5",
    page_title: "AirPods Pro vs Sony XM5",
    type: "ai_answer_gap",
    title: "No comparable answer-first block; AI assistants cite competitors",
    summary:
      "Across tested prompts, AI assistants cite two competitor pages with explicit verdict blocks. This page lacks a one-paragraph verdict + decision matrix.",
    severity: 3,
    impact: 55,
    confidence: 60,
    effort: 16,
    risk: 6,
    priority: 60,
    status: "open",
    evidence: [
      { label: "AI prompts tested", value: "12" },
      { label: "Brand cited", value: "0 / 12" },
      { label: "Competitor cited", value: "9 / 12 (mock)" },
    ],
    recommended_action:
      "Add a TL;DR verdict, a decision matrix (\"best for X\"), and an FAQ block that matches likely assistant queries.",
    validation_method:
      "Re-run AI Visibility prompt set after publish; monitor citation rate per model (monitoring only).",
  },
  {
    id: "o5",
    page_id: "p1",
    page_url: "/best-noise-cancelling-headphones",
    page_title: "Best Noise-Cancelling Headphones",
    type: "monetization_leak",
    title: "3 of 6 product blocks lack tracked merchant link + disclosure",
    summary:
      "Affiliate disclosure is missing above the intro and 3 product CTAs lack tracking IDs. Safe, additive monetization fix.",
    severity: 3,
    impact: 48,
    confidence: 88,
    effort: 8,
    risk: 4,
    priority: 70,
    status: "open",
    evidence: [
      { label: "Product blocks", value: "6" },
      { label: "Missing tracking", value: "3" },
      { label: "Disclosure above intro", value: "No" },
    ],
    recommended_action:
      "Insert disclosure block above intro; add Amazon tracking ID + rel=\"sponsored nofollow\" to 3 product CTAs.",
    validation_method: "GA4 affiliate_click delta on those product links 28d after publish.",
  },
  {
    id: "o6",
    page_id: "p2",
    page_url: "/how-to-clean-airpods",
    page_title: "How to Clean AirPods",
    type: "schema_gap",
    title: "HowTo schema is valid for this page (visible numbered steps)",
    summary:
      "Page has visible step-by-step instructions but no HowTo JSON-LD. Schema recommendation is supported by visible content.",
    severity: 2,
    impact: 35,
    confidence: 85,
    effort: 6,
    risk: 3,
    priority: 58,
    status: "open",
    evidence: [
      { label: "Visible steps", value: "7 ordered" },
      { label: "Current schema", value: "Article only" },
    ],
    recommended_action: "Add HowTo JSON-LD that mirrors the 7 visible steps exactly.",
    validation_method: "Search Console rich result eligibility + impressions for HowTo features.",
  },
  {
    id: "o7",
    page_id: "p3",
    page_url: "/sony-wh1000xm5-review",
    page_title: "Sony WH-1000XM5 Review",
    type: "internal_link_gap",
    title: "No internal link from the buyer's-guide hub",
    summary:
      "The primary hub page (/best-noise-cancelling-headphones) does not contextually link to this review. Anchor-text opportunity exists.",
    severity: 3,
    impact: 42,
    confidence: 80,
    effort: 5,
    risk: 3,
    priority: 65,
    status: "open",
    evidence: [
      { label: "Source page", value: "/best-noise-cancelling-headphones" },
      { label: "Suggested anchor", value: "Sony WH-1000XM5 (full hands-on review)" },
    ],
    recommended_action:
      "Insert one contextual link from hub to review using natural anchor text; do not over-optimize.",
    validation_method: "Rank movement for review page on review-intent queries 28d after change.",
  },
  {
    id: "o8",
    page_id: "p1",
    page_url: "/best-noise-cancelling-headphones",
    page_title: "Best Noise-Cancelling Headphones",
    type: "cannibalization",
    title: "Hub and budget guide compete on same head term",
    summary:
      "Both /best-noise-cancelling-headphones and /best-budget-anc-headphones rank for overlapping queries; CTR is split.",
    severity: 3,
    impact: 50,
    confidence: 65,
    effort: 22,
    risk: 18,
    priority: 56,
    status: "open",
    evidence: [
      { label: "Overlapping queries", value: "14" },
      { label: "Split clicks", value: "≈ 60/40" },
    ],
    recommended_action:
      "Differentiate intent: keep hub for broad buyers, retitle budget guide for sub-$200 only; add cross-links.",
    validation_method: "Rank split + combined clicks for overlapping query set, 60d.",
  },
];

export const dashboardKpis = [
  { label: "Open opportunities", value: 38, sub: "mock", tone: "default" as const },
  { label: "Striking-distance URLs", value: 12, sub: "positions 11–20", tone: "info" as const },
  { label: "CTR leaks", value: 7, sub: "below SERP-expected", tone: "warning" as const },
  { label: "Decaying pages", value: 5, sub: "90d traffic ↓", tone: "warning" as const },
  { label: "AI visibility rate", value: "18%", sub: "across 24 prompts", tone: "info" as const },
  { label: "Validation failures", value: 2, sub: "blocking publish", tone: "destructive" as const },
];

export interface MockBrief {
  id: string;
  page_id: string;
  page_url: string;
  page_title: string;
  status: "draft" | "ready" | "in_writing" | "complete";
  intent: string;
  target_queries: string[];
  missing_entities: string[];
  recommended_sections: string[];
  monetization_angle: string;
  updated_at: string;
}

export const mockBriefs: MockBrief[] = [
  {
    id: "b1",
    page_id: "p3",
    page_url: "/sony-wh1000xm5-review",
    page_title: "Sony WH-1000XM5 Review",
    status: "ready",
    intent: "commercial review",
    target_queries: [
      "sony wh-1000xm5 review",
      "sony xm5 vs xm4",
      "sony xm5 vs bose qc ultra",
      "is sony xm5 worth it 2026",
    ],
    missing_entities: ["LE Audio", "LC3", "Aware Mode", "Multipoint", "Speak-to-Chat"],
    recommended_sections: [
      "TL;DR verdict (one paragraph)",
      "Best-for-X decision matrix",
      "Comparison table vs XM4 & Bose QC Ultra",
      "FAQ block (battery, multipoint, codecs)",
    ],
    monetization_angle: "Above-intro CTA + comparison-table CTA. Keep existing product box untouched.",
    updated_at: "2026-06-29T18:00:00Z",
  },
  {
    id: "b2",
    page_id: "p5",
    page_url: "/bluetooth-codecs-explained",
    page_title: "Bluetooth Audio Codecs Explained",
    status: "draft",
    intent: "informational refresh",
    target_queries: ["bluetooth audio codecs", "lc3 vs ldac", "what is le audio"],
    missing_entities: ["LC3", "LE Audio", "Auracast"],
    recommended_sections: [
      "Updated codec comparison table",
      "LC3 / LE Audio explainer",
      "FAQ block (compatibility, latency)",
    ],
    monetization_angle: "No direct affiliate; supports buyer-guide internal links.",
    updated_at: "2026-06-28T11:30:00Z",
  },
];

export interface MockDiff {
  id: string;
  page_id: string;
  page_url: string;
  page_title: string;
  status: "proposed" | "validating" | "validated" | "rejected" | "approved" | "published";
  changes: { kind: string; before: string; after: string }[];
  validation: { passed: boolean; checks: { name: string; pass: boolean; note?: string }[] };
  created_at: string;
}

export const mockDiffs: MockDiff[] = [
  {
    id: "d1",
    page_id: "p3",
    page_url: "/sony-wh1000xm5-review",
    page_title: "Sony WH-1000XM5 Review",
    status: "validated",
    changes: [
      {
        kind: "SEO title",
        before: "Sony WH-1000XM5 Review (Hands-On)",
        after: "Sony WH-1000XM5 Review (2026): Hands-On After 6 Months",
      },
      {
        kind: "Meta description",
        before: "Our hands-on review of the Sony WH-1000XM5.",
        after:
          "Hands-on Sony WH-1000XM5 review after 6 months: ANC vs XM4 & Bose QC Ultra, battery, codecs, and who should actually buy them.",
      },
      {
        kind: "Insert: Answer-first TL;DR",
        before: "(none)",
        after:
          "<p><strong>TL;DR:</strong> The WH-1000XM5 is the best all-rounder for travel and calls in 2026. Skip if you already own the XM4 …</p>",
      },
      {
        kind: "Insert: Comparison table",
        before: "(none)",
        after: "<table>… XM5 vs XM4 vs Bose QC Ultra …</table>",
      },
    ],
    validation: {
      passed: true,
      checks: [
        { name: "HTML safety (no scripts, no inline handlers)", pass: true },
        { name: "Images / tables / buttons preserved", pass: true },
        { name: "Affiliate links preserved with rel attributes", pass: true },
        { name: "Amazon tracking ID present where applicable", pass: true },
        { name: "Schema matches visible content", pass: true },
        { name: "No fake claims / unsupported reviews", pass: true },
        { name: "No noindex / canonical damage", pass: true },
        { name: "Classic Editor compatible", pass: true },
      ],
    },
    created_at: "2026-06-29T20:14:00Z",
  },
  {
    id: "d2",
    page_id: "p5",
    page_url: "/bluetooth-codecs-explained",
    page_title: "Bluetooth Codecs Explained",
    status: "proposed",
    changes: [
      {
        kind: "Insert: LC3 / LE Audio section",
        before: "(none)",
        after: "<h2>LC3 and LE Audio (2026 update)</h2><p>…</p>",
      },
    ],
    validation: {
      passed: false,
      checks: [
        { name: "HTML safety", pass: true },
        { name: "Schema/content match", pass: true },
        {
          name: "Affiliate links preserved",
          pass: false,
          note: "Proposed diff removes one outbound product link — blocked.",
        },
      ],
    },
    created_at: "2026-06-30T05:55:00Z",
  },
];

export interface MockPublishJob {
  id: string;
  diff_id: string;
  page_url: string;
  mode: "draft" | "live_update" | "rollback";
  status: "queued" | "running" | "succeeded" | "failed" | "rolled_back";
  requested_by: string;
  created_at: string;
}

export const mockPublishJobs: MockPublishJob[] = [
  {
    id: "j1",
    diff_id: "d1",
    page_url: "/sony-wh1000xm5-review",
    mode: "draft",
    status: "succeeded",
    requested_by: "you",
    created_at: "2026-06-29T20:30:00Z",
  },
  {
    id: "j2",
    diff_id: "d1",
    page_url: "/sony-wh1000xm5-review",
    mode: "live_update",
    status: "queued",
    requested_by: "you",
    created_at: "2026-06-30T06:00:00Z",
  },
];

export const mockKeywords = [
  { keyword: "best noise cancelling headphones", volume: 74000, difficulty: 64, position: 6.2, intent: "commercial" },
  { keyword: "sony wh-1000xm5 review", volume: 22000, difficulty: 48, position: 14.8, intent: "commercial" },
  { keyword: "airpods pro vs sony xm5", volume: 9100, difficulty: 42, position: 8.1, intent: "commercial" },
  { keyword: "how to clean airpods", volume: 60500, difficulty: 28, position: 4.2, intent: "informational" },
  { keyword: "bluetooth audio codecs", volume: 4400, difficulty: 36, position: 17.3, intent: "informational" },
  { keyword: "lc3 vs ldac", volume: 1900, difficulty: 30, position: 32.0, intent: "informational" },
];

export const mockAiPrompts = [
  {
    id: "ap1",
    prompt: "What are the best noise-cancelling headphones in 2026?",
    runs: 18,
    brand_cited: 2,
    competitor_cited: 14,
  },
  {
    id: "ap2",
    prompt: "Sony WH-1000XM5 vs Bose QC Ultra — which is better for travel?",
    runs: 12,
    brand_cited: 0,
    competitor_cited: 9,
  },
  {
    id: "ap3",
    prompt: "How do I clean my AirPods safely?",
    runs: 10,
    brand_cited: 6,
    competitor_cited: 3,
  },
];

export const mockLinkOpportunities = [
  {
    source: "/best-noise-cancelling-headphones",
    target: "/sony-wh1000xm5-review",
    anchor: "Sony WH-1000XM5 (full hands-on review)",
    similarity: 0.84,
  },
  {
    source: "/best-noise-cancelling-headphones",
    target: "/airpods-pro-vs-sony-xm5",
    anchor: "AirPods Pro vs Sony XM5 head-to-head",
    similarity: 0.79,
  },
  {
    source: "/bluetooth-codecs-explained",
    target: "/sony-wh1000xm5-review",
    anchor: "Sony XM5 LDAC support",
    similarity: 0.71,
  },
];

export const mockSchemaItems = [
  { page_url: "/how-to-clean-airpods", current: "Article", recommended: "HowTo", evidence_ok: true },
  { page_url: "/sony-wh1000xm5-review", current: "Article", recommended: "Review", evidence_ok: true },
  { page_url: "/best-noise-cancelling-headphones", current: "Article", recommended: "ItemList", evidence_ok: true },
  { page_url: "/bluetooth-codecs-explained", current: "Article", recommended: "Article (FAQ pending)", evidence_ok: false },
];

export const mockMonetization = [
  { page_url: "/best-noise-cancelling-headphones", issue: "Missing disclosure above intro", severity: 3 },
  { page_url: "/best-noise-cancelling-headphones", issue: "3 product CTAs missing tracking ID", severity: 3 },
  { page_url: "/sony-wh1000xm5-review", issue: "No comparison-table CTA", severity: 2 },
  { page_url: "/airpods-pro-vs-sony-xm5", issue: "Outbound merchant link returns 404", severity: 4 },
];

export const mockExperiments = [
  {
    id: "e1",
    page_url: "/how-to-clean-airpods",
    hypothesis: "Adding HowTo schema + answer-first paragraph will increase impressions for step queries.",
    status: "running",
    result: "pending",
    implemented_at: "2026-06-10",
    window: "28d",
  },
  {
    id: "e2",
    page_url: "/sony-wh1000xm5-review",
    hypothesis: "TL;DR + comparison table will lift CTR at positions 8–14.",
    status: "baseline",
    result: "pending",
    implemented_at: null,
    window: "—",
  },
];

export const mockRevenue = [
  { page_url: "/best-noise-cancelling-headphones", clicks: 412, affiliate_clicks: 64, est_revenue: 0 },
  { page_url: "/sony-wh1000xm5-review", clicks: 287, affiliate_clicks: 41, est_revenue: 0 },
  { page_url: "/airpods-pro-vs-sony-xm5", clicks: 624, affiliate_clicks: 88, est_revenue: 0 },
  { page_url: "/best-budget-anc-headphones", clicks: 308, affiliate_clicks: 36, est_revenue: 0 },
];
