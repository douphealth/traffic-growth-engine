import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/page-header";
import { Plus, ExternalLink, Download, MapPin, BarChart3, Loader2, Target, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { importWordpressInventory } from "@/lib/wordpress.functions";
import { crawlSitemap } from "@/lib/sitemap.functions";
import { importGscData } from "@/lib/gsc.functions";
import { scoreOpportunities } from "@/lib/opportunities.functions";
import { testWordpressConnection } from "@/lib/sites.functions";

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

  return (
    <>
      <PageHeader
        title="Site Inventory"
        description="Connect a WordPress site, then import inventory, crawl its sitemap, pull GSC data, and score opportunities."
        actions={
          <Button asChild>
            <Link to="/sites/connect">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Connect site
            </Link>
          </Button>
        }
      />
      <PageBody>
        {sitesQ.isLoading && <p className="text-sm text-muted-foreground">Loading sites…</p>}
        {sitesQ.error && (
          <p className="text-sm text-destructive">{(sitesQ.error as Error).message}</p>
        )}
        {sitesQ.data && sitesQ.data.length === 0 && (
          <EmptyState
            title="No sites connected yet"
            description="Connect your first WordPress site to start importing real inventory and scoring opportunities."
            action={
              <Button asChild>
                <Link to="/sites/connect">Connect a site</Link>
              </Button>
            }
          />
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {sitesQ.data?.map((s) => (
            <SiteCard key={s.id} site={s} onChanged={() => qc.invalidateQueries({ queryKey: ["sites"] })} />
          ))}
        </div>
      </PageBody>
    </>
  );
}

function SiteCard({ site, onChanged }: { site: SiteRow; onChanged: () => void }) {
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
          <Stat label="Pages imported" value={stats.data?.pagesCount.toString() ?? "—"} />
          <Stat label="In sitemap" value={`${stats.data?.inSitemap ?? "—"} / ${stats.data?.sitemapCount ?? "—"}`} />
          <Stat label="GSC rows" value={stats.data?.gscRows.toLocaleString() ?? "—"} />
          <Stat label="Open opportunities" value={stats.data?.oppsOpen.toString() ?? "—"} />
        </div>
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
            variant="outline"
            size="sm"
            disabled={busy !== null || !site.gsc_property}
            title={!site.gsc_property ? "Add a GSC property to this site first." : undefined}
            onClick={run(
              "gsc",
              () => importGscData({ data: { site_id: site.id } }),
              (r: any) => (r.status === "ok" ? `GSC imported ${r.rows} rows` : r.reason ?? "GSC not connected"),
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
