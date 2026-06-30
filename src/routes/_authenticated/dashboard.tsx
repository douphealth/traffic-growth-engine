import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useDemoMode } from "@/hooks/use-demo-mode";
import {
  dashboardKpis,
  mockOpportunities,
  mockPublishJobs,
  mockExperiments,
  OPPORTUNITY_LABEL,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const [demo] = useDemoMode();

  const kpis = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: async () => {
      const [sites, pages, opps, vRuns, jobs] = await Promise.all([
        supabase.from("sites").select("id", { count: "exact", head: true }),
        supabase.from("pages").select("id", { count: "exact", head: true }),
        supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("validation_runs").select("id", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("publish_jobs").select("id", { count: "exact", head: true }).eq("status", "succeeded"),
      ]);
      return {
        sites: sites.count ?? 0,
        pages: pages.count ?? 0,
        oppsOpen: opps.count ?? 0,
        validationsFailed: vRuns.count ?? 0,
        publishedSucceeded: jobs.count ?? 0,
      };
    },
  });

  const topOpps = useQuery({
    queryKey: ["dashboard-top-opps"],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("id, type, title, priority, page:pages(url), site:sites(name)")
        .eq("status", "open")
        .order("priority", { ascending: false })
        .limit(6);
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
    queryKey: ["dashboard-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, created_at, after")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const hasAnyData = (kpis.data?.sites ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live metrics across your connected WordPress sites. Connect a site to start importing real inventory."
        actions={
          <div className="flex gap-2">
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
        {!hasAnyData && !demo && (
          <EmptyState
            title="No real data yet"
            description="Connect a WordPress site to begin importing pages, sitemap, and Search Console data. Or enable Demo mode in Settings to preview the UI with mock data."
            action={
              <Button asChild>
                <Link to="/sites/connect"><Plus className="mr-1.5 h-3.5 w-3.5" /> Connect your first site</Link>
              </Button>
            }
          />
        )}

        {(hasAnyData || demo) && (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <Kpi label="Sites connected" value={hasAnyData ? kpis.data!.sites : (demo ? 2 : 0)} />
              <Kpi label="Pages imported" value={hasAnyData ? kpis.data!.pages : (demo ? 184 : 0)} />
              <Kpi label="Open opportunities" value={hasAnyData ? kpis.data!.oppsOpen : (demo ? mockOpportunities.length : 0)} tone="warning" />
              <Kpi label="Validations failed" value={hasAnyData ? kpis.data!.validationsFailed : (demo ? 2 : 0)} tone="destructive" />
              <Kpi label="Publishes succeeded" value={hasAnyData ? kpis.data!.publishedSucceeded : (demo ? mockPublishJobs.length : 0)} tone="info" />
            </div>

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
                    : demo
                      ? mockOpportunities.slice(0, 6).map((o) => (
                          <Link
                            key={o.id}
                            to="/opportunities"
                            className="flex items-start justify-between gap-3 rounded-md border border-border bg-card/50 p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[10px]">{OPPORTUNITY_LABEL[o.type]}</Badge>
                                <span className="truncate text-xs text-muted-foreground">{o.page_url}</span>
                              </div>
                              <p className="mt-1 text-sm font-medium leading-snug">{o.title}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-lg font-semibold tabular-nums text-primary">{Math.round(o.priority)}</div>
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">priority</div>
                            </div>
                          </Link>
                        ))
                      : (
                          <p className="text-sm text-muted-foreground">No opportunities yet. Run scoring from the Site Inventory.</p>
                        )}
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
                    : demo
                      ? mockExperiments.map((e) => (
                          <div key={e.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-b-0">
                            <span className="truncate text-xs">{e.page_url}</span>
                            <Badge variant="outline" className="text-[10px]">{e.result}</Badge>
                          </div>
                        ))
                      : <p className="text-xs text-muted-foreground">No activity yet.</p>}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {demo && !hasAnyData && (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {dashboardKpis.map((k) => (
              <Card key={k.label} className={cn("border", k.tone === "warning" && "border-warning/40", k.tone === "destructive" && "border-destructive/40", k.tone === "info" && "border-info/40")}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-[11px] uppercase tracking-wide">{k.label}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums">{k.value}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{k.sub} <Badge variant="outline" className="ml-1 text-[10px]">mock</Badge></div>
                </CardContent>
              </Card>
            ))}
          </div>
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
