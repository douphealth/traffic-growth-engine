import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, CheckCircle2, Plus, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { getPipelineHealth } from "@/lib/quality.functions";
import { PipelineActions } from "@/components/ops-workspace";
import { useSiteScope } from "@/hooks/use-site-scope";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { siteId, currentSite } = useSiteScope();
  const healthQ = useQuery({
    queryKey: ["pipeline-health"],
    queryFn: () => getPipelineHealth(),
  });

  const kpis = useQuery({
    queryKey: ["dashboard-kpis", siteId ?? "all"],
    queryFn: async () => {
      const withSite = <T extends { eq: (c: string, v: string) => T }>(q: T) => (siteId ? q.eq("site_id", siteId) : q);
      const [sites, pages, opps, vRuns, jobs] = await Promise.all([
        supabase.from("sites").select("id", { count: "exact", head: true }),
        withSite(supabase.from("pages").select("id", { count: "exact", head: true })),
        withSite(supabase.from("opportunities").select("id", { count: "exact", head: true })).eq("status", "open"),
        withSite(supabase.from("validation_runs").select("id", { count: "exact", head: true })).eq("passed", false),
        withSite(supabase.from("publish_jobs").select("id", { count: "exact", head: true })).eq("status", "succeeded"),
      ]);
      return {
        sites: siteId ? 1 : sites.count ?? 0,
        pages: pages.count ?? 0,
        oppsOpen: opps.count ?? 0,
        validationsFailed: vRuns.count ?? 0,
        publishedSucceeded: jobs.count ?? 0,
      };
    },
  });

  const topOpps = useQuery({
    queryKey: ["dashboard-top-opps", siteId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("opportunities")
        .select("id, type, title, priority, page:pages(url), site:sites(name)")
        .eq("status", "open")
        .order("priority", { ascending: false })
        .limit(6);
      if (siteId) q = q.eq("site_id", siteId);
      const { data } = await q;
      return (data ?? []) as Array<{
        id: string;
        type: string;
        title: string;
        priority: number | null;
        page: { url: string | null } | null;
        site: { name: string | null } | null;
      }>;
    },
  });

  const activity = useQuery({
    queryKey: ["dashboard-activity", siteId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("id, action, created_at, after")
        .order("created_at", { ascending: false })
        .limit(8);
      if (siteId) q = q.eq("site_id", siteId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const scopedHealthSites = healthQ.data ? (siteId ? healthQ.data.sites.filter((s) => s.canonical_site_id === siteId) : healthQ.data.sites) : [];
  const scopedTotals = healthQ.data
    ? siteId
      ? scopedHealthSites.reduce(
          (acc, s) => ({
            sites: 1,
            pages: acc.pages + s.pages,
            gsc_urls: acc.gsc_urls + (s as unknown as { gsc_urls?: number }).gsc_urls ?? 0,
            gsc_rows: acc.gsc_rows + s.gsc_rows,
            opportunities: acc.opportunities + s.opportunities,
            average_quality: s.quality_score,
          }),
          { sites: 0, pages: 0, gsc_urls: 0, gsc_rows: 0, opportunities: 0, average_quality: 0 },
        )
      : healthQ.data.totals
    : null;
  const hasAnyData = (scopedTotals?.sites ?? kpis.data?.sites ?? 0) > 0;
  const needsAttention = scopedHealthSites.filter((s) => s.status !== "ready");
  void currentSite;


  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Evidence-backed pipeline health from live Search Console, page inventory, and opportunity scoring data. No demo metrics."
        actions={
          <div className="flex gap-2">
            <PipelineActions scope="compact" />
            <Button variant="outline" asChild>
              <Link to="/sites/connect"><Plus className="mr-1.5 h-3.5 w-3.5" /> Connect site</Link>
            </Button>
            <Button asChild>
              <Link to="/opportunities">
                Opportunity board <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        }
      />
      <PageBody>
        {!hasAnyData && (
          <EmptyState
            title="No real data yet"
            description="Connect Google Search Console to import real query/page data, discover analyzable URLs, and score evidence-backed opportunities."
            action={
              <Button asChild>
                <Link to="/gsc/connect"><Plus className="mr-1.5 h-3.5 w-3.5" /> Connect Search Console</Link>
              </Button>
            }
          />
        )}

        {hasAnyData && (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <Kpi label="Canonical sites" value={healthQ.data?.totals.sites ?? kpis.data?.sites ?? 0} />
              <Kpi label="Analyzable pages" value={healthQ.data?.totals.pages ?? kpis.data?.pages ?? 0} />
              <Kpi label="GSC URLs" value={healthQ.data?.totals.gsc_urls ?? 0} tone="info" />
              <Kpi label="GSC rows" value={healthQ.data?.totals.gsc_rows ?? 0} tone="info" />
              <Kpi label="Open opportunities" value={healthQ.data?.totals.opportunities ?? kpis.data?.oppsOpen ?? 0} tone="warning" />
            </div>

            {healthQ.data && (
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Data credibility monitor</CardTitle>
                      <CardDescription>
                        Quality is computed from live imports, URL/page sync, freshness, duplicate-property consolidation, and opportunity coverage.
                      </CardDescription>
                    </div>
                    <Badge variant={needsAttention.length ? "outline" : "secondary"} className={needsAttention.length ? "border-warning/50 text-warning" : ""}>
                      {needsAttention.length ? `${needsAttention.length} need attention` : "credible"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-[220px_1fr]">
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Average quality</div>
                    <div className="mt-1 flex items-end gap-2">
                      <span className="text-4xl font-semibold tabular-nums">{healthQ.data.totals.average_quality}</span>
                      <span className="pb-1 text-sm text-muted-foreground">/100</span>
                    </div>
                    <Progress value={healthQ.data.totals.average_quality} className="mt-3" />
                  </div>
                  <div className="space-y-2">
                    {healthQ.data.sites.slice(0, 5).map((site) => (
                      <div key={site.canonical_site_id} className="rounded-lg border border-border bg-card/50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {site.status === "ready" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <ShieldAlert className="h-3.5 w-3.5 text-warning" />}
                              <p className="truncate text-sm font-medium">{site.name}</p>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {site.pages.toLocaleString()} pages · {site.gsc_rows.toLocaleString()} GSC rows · {site.opportunities.toLocaleString()} opportunities
                            </p>
                          </div>
                          <div className="w-24 text-right">
                            <div className="text-sm font-semibold tabular-nums">{site.quality_score}/100</div>
                            <Progress value={site.quality_score} className="mt-1 h-1.5" />
                          </div>
                        </div>
                        {site.issues.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{site.issues[0]}</p>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Top opportunities</CardTitle>
                    <CardDescription>Ranked by priority across open opportunities.</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/opportunities">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topOpps.data && topOpps.data.length > 0
                    ? topOpps.data.map((o) => (
                        <Link
                          key={o.id}
                          to="/opportunities"
                          className="flex items-start justify-between gap-3 rounded-md border border-border bg-card/50 p-3 hover:border-primary/40 hover:bg-accent/30 transition"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px]">{o.type.replace(/_/g, " ")}</Badge>
                              <span className="truncate text-xs text-muted-foreground">{o.page?.url ?? o.site?.name ?? ""}</span>
                            </div>
                            <p className="mt-1 text-sm font-medium leading-snug">{o.title}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-semibold tabular-nums text-primary">
                              {Math.round(o.priority ?? 0)}
                            </div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">priority</div>
                          </div>
                        </Link>
                      ))
                    : <p className="text-sm text-muted-foreground">No opportunities yet. Import Search Console data, sync pages, then run scoring.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent activity</CardTitle>
                  <CardDescription>Audit log of imports, scoring, validations, publishes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {activity.data && activity.data.length > 0
                    ? activity.data.map((a) => (
                        <div key={a.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-b-0">
                          <div className="min-w-0">
                            <Badge variant="outline" className="text-[10px]">{a.action}</Badge>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {new Date(a.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))
                    : <p className="text-xs text-muted-foreground">No activity yet.</p>}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "warning" | "destructive" | "info" }) {
  return (
    <Card className={cn("border", tone === "warning" && "border-warning/40", tone === "destructive" && "border-destructive/40", tone === "info" && "border-info/40")}>
      <CardHeader className="pb-2">
        <CardDescription className="text-[11px] uppercase tracking-wide">{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
