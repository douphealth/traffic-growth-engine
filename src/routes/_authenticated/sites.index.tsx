import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/page-header";
import { Progress } from "@/components/ui/progress";
import { Plus, ExternalLink, Download, MapPin, BarChart3, Loader2, Target, RefreshCw, Search, ShieldAlert, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { importWordpressInventory } from "@/lib/wordpress.functions";
import { crawlSitemap } from "@/lib/sitemap.functions";
import { importGscData } from "@/lib/gsc.functions";
import { scoreOpportunities } from "@/lib/opportunities.functions";
import { testWordpressConnection } from "@/lib/sites.functions";
import { getPipelineHealth, type SitePipelineHealth } from "@/lib/quality.functions";
import { importAllConnectedGscProperties } from "@/lib/gsc-pages.functions";

export const Route = createFileRoute("/_authenticated/sites/")({
  component: SitesPage,
});

type SiteRow = {
  id: string;
  name: string;
  base_url: string;
  status: string | null;
  sitemap_url: string | null;
  gsc_property: string | null;
  ga4_property_id: string | null;
  created_at: string;
};

function SitesPage() {
  const qc = useQueryClient();
  const sitesQ = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, base_url, status, sitemap_url, gsc_property, ga4_property_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SiteRow[];
    },
  });

  const healthQ = useQuery({
    queryKey: ["pipeline-health"],
    queryFn: () => getPipelineHealth(),
  });

  const runAllGsc = useMutation({
    mutationFn: () => importAllConnectedGscProperties(),
    onSuccess: (r) => {
      toast.success(`Pipeline complete · ${r.totals.rows.toLocaleString()} rows · ${r.totals.urls.toLocaleString()} URLs · ${r.totals.opportunities.toLocaleString()} opportunities`);
      qc.invalidateQueries({ queryKey: ["sites"] });
      qc.invalidateQueries({ queryKey: ["pipeline-health"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const healthBySiteId = useMemo(() => {
    const map = new Map<string, SitePipelineHealth>();
    for (const h of healthQ.data?.sites ?? []) for (const id of h.site_ids) map.set(id, h);
    return map;
  }, [healthQ.data]);

  const visibleSites = useMemo(() => {
    const rows = sitesQ.data ?? [];
    if (!healthQ.data?.sites.length) return rows;
    const canonical = new Set(healthQ.data.sites.map((h) => h.canonical_site_id));
    return rows.filter((s) => canonical.has(s.id) || !healthBySiteId.has(s.id));
  }, [healthBySiteId, healthQ.data, sitesQ.data]);

  return (
    <>
      <PageHeader
        title="Site Inventory"
        description="GSC-first site pipeline: import Search Console rows, create analyzable URL records, and score real opportunities. WordPress is optional enrichment."
        actions={
          <>
            <Button onClick={() => runAllGsc.mutate()} disabled={runAllGsc.isPending}>
              {runAllGsc.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="mr-1.5 h-3.5 w-3.5" />}
              Run all GSC pipelines
            </Button>
            <Button asChild variant="outline">
              <Link to="/gsc/connect">
                <Search className="mr-1.5 h-3.5 w-3.5" /> Connect GSC
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/sites/connect">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add WordPress
              </Link>
            </Button>
          </>
        }
      />
      <PageBody>
        {sitesQ.isLoading && <p className="text-sm text-muted-foreground">Loading sites…</p>}
        {sitesQ.error && (
          <p className="text-sm text-destructive">{(sitesQ.error as Error).message}</p>
        )}
        {sitesQ.data && sitesQ.data.length === 0 && (
          <EmptyState
            title="No real properties imported yet"
            description="Connect Google Search Console to create site records, import query/page data, discover URLs, and score opportunities without WordPress."
            action={
              <Button asChild>
                <Link to="/gsc/connect">Connect Search Console</Link>
              </Button>
            }
          />
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {visibleSites.map((s) => (
            <SiteCard
              key={s.id}
              site={s}
              health={healthBySiteId.get(s.id)}
              onChanged={() => {
                qc.invalidateQueries({ queryKey: ["sites"] });
                qc.invalidateQueries({ queryKey: ["pipeline-health"] });
              }}
            />
          ))}
        </div>
      </PageBody>
    </>
  );
}

function SiteCard({ site, health, onChanged }: { site: SiteRow; health?: SitePipelineHealth; onChanged: () => void }) {
  const qc = useQueryClient();
  const stats = useQuery({
    queryKey: ["site-stats", site.id],
    queryFn: async () => {
      const [pages, sitemaps, opps, gsc] = await Promise.all([
        supabase.from("pages").select("id, in_sitemap, status", { count: "exact", head: false }).eq("site_id", site.id),
        supabase.from("sitemap_urls").select("id", { count: "exact", head: true }).eq("site_id", site.id),
        supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("site_id", site.id).eq("status", "open"),
        supabase.from("gsc_page_query_daily").select("id", { count: "exact", head: true }).eq("site_id", site.id),
      ]);
      const inSitemap = (pages.data ?? []).filter((p) => p.in_sitemap).length;
      return {
        pagesCount: pages.count ?? (pages.data?.length ?? 0),
        inSitemap,
        sitemapCount: sitemaps.count ?? 0,
        oppsOpen: opps.count ?? 0,
        gscRows: gsc.count ?? 0,
      };
    },
  });

  const [busy, setBusy] = useState<string | null>(null);
  const hasGsc = Boolean(site.gsc_property || health?.property_variants.length);
  const gscRows = health?.gsc_rows ?? stats.data?.gscRows ?? 0;
  const pagesCount = health?.pages ?? stats.data?.pagesCount ?? 0;
  const oppsOpen = health?.opportunities ?? stats.data?.oppsOpen ?? 0;
  function run(label: string, fn: () => Promise<unknown>, success: (r: any) => string) {
    return async () => {
      setBusy(label);
      try {
        const r = await fn();
        toast.success(success(r));
        onChanged();
        qc.invalidateQueries({ queryKey: ["site-stats", site.id] });
        qc.invalidateQueries({ queryKey: ["opportunities"] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    };
  }

  const testConn = useMutation({
    mutationFn: () => testWordpressConnection({ data: { site_id: site.id } }),
    onSuccess: (r) =>
      r.ok ? toast.success(`WordPress OK · ${r.wp_user}`) : toast.error(r.message ?? "Failed"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{site.name}</CardTitle>
            <CardDescription>
              <a href={site.base_url} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                {site.base_url} <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </div>
          <Badge variant={site.status === "connected" ? "secondary" : "outline"} className="capitalize">
            {site.status ?? "pending"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Pages imported" value={health ? pagesCount.toLocaleString() : stats.data?.pagesCount.toString() ?? "—"} />
          <Stat label="In sitemap" value={`${stats.data?.inSitemap ?? "—"} / ${stats.data?.sitemapCount ?? "—"}`} />
          <Stat label="GSC rows" value={health ? gscRows.toLocaleString() : stats.data?.gscRows.toLocaleString() ?? "—"} />
          <Stat label="Open opportunities" value={health ? oppsOpen.toLocaleString() : stats.data?.oppsOpen.toString() ?? "—"} />
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">Next best action</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {!hasGsc
                  ? "Link a Search Console property first."
                  : gscRows === 0
                    ? "Run the GSC pipeline to import real rows."
                    : pagesCount === 0
                      ? "Run the GSC pipeline to create analyzable pages from URLs."
                      : oppsOpen === 0
                        ? "Run scoring to create evidence-backed opportunities."
                        : "Review opportunities ranked by impact and confidence."}
              </p>
            </div>
            {oppsOpen > 0 ? (
              <Button size="sm" asChild>
                <Link to="/opportunities">Open opportunities</Link>
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={busy !== null || !hasGsc}
                onClick={run(
                  "gsc",
                  () => importGscData({ data: { site_id: site.id } }),
                  (r: any) => (r.status === "ok" ? `Imported ${r.rows} GSC rows · ${r.pages?.discovered ?? 0} URLs · ${r.opportunities ?? 0} opportunities` : r.reason ?? "GSC not connected"),
                )}
              >
                {busy === "gsc" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <BarChart3 className="mr-1 h-3 w-3" />}
                Run GSC pipeline
              </Button>
            )}
          </div>
        </div>
        {health && (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium">
                {health.status === "ready" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <ShieldAlert className="h-3.5 w-3.5 text-warning" />}
                Data quality
              </div>
              <span className="text-sm font-semibold tabular-nums">{health.quality_score}/100</span>
            </div>
            <Progress value={health.quality_score} className="mt-2 h-1.5" />
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[10px]">{health.property_variants.length} GSC propert{health.property_variants.length === 1 ? "y" : "ies"}</Badge>
              <Badge variant="outline" className="text-[10px]">{health.gsc_urls.toLocaleString()} URLs</Badge>
              <Badge variant="outline" className="text-[10px]">{health.gsc_rows.toLocaleString()} rows</Badge>
            </div>
            {health.issues.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{health.issues[0]}</p>}
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" disabled={testConn.isPending} onClick={() => testConn.mutate()}>
            <RefreshCw className={`mr-1 h-3 w-3 ${testConn.isPending ? "animate-spin" : ""}`} /> Test WP
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={run(
              "import",
              () => importWordpressInventory({ data: { site_id: site.id } }),
              (r: any) => `Imported ${r.imported} pages (${r.skipped} skipped)`,
            )}
          >
            {busy === "import" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
            Import WP
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={run(
              "sitemap",
              () => crawlSitemap({ data: { site_id: site.id } }),
              (r: any) => `Sitemap: ${r.sitemap_count} URLs, ${r.matched} matched`,
            )}
          >
            {busy === "sitemap" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <MapPin className="mr-1 h-3 w-3" />}
            Crawl sitemap
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
          >
            <Link to="/gsc/connect">
              <Search className="mr-1 h-3 w-3" />
              {site.gsc_property ? "Manage GSC" : "Connect GSC"}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null || !hasGsc}
            title={!hasGsc ? "Link a Search Console property at /gsc/connect first." : undefined}
            onClick={run(
              "gsc",
              () => importGscData({ data: { site_id: site.id } }),
              (r: any) => (r.status === "ok" ? `Imported ${r.rows} GSC rows · ${r.pages?.discovered ?? 0} URLs · ${r.opportunities ?? 0} opportunities` : r.reason ?? "GSC not connected"),
            )}
          >
            {busy === "gsc" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <BarChart3 className="mr-1 h-3 w-3" />}
            Import GSC
          </Button>
          <Button
            size="sm"
            disabled={busy !== null}
            onClick={run(
              "score",
              () => scoreOpportunities({ data: { site_id: site.id } }),
              (r: any) => `Scored ${r.inserted} opportunities`,
            )}
          >
            {busy === "score" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Target className="mr-1 h-3 w-3" />}
            Score
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}
