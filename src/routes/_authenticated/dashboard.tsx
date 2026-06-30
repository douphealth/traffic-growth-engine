import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  dashboardKpis,
  mockOpportunities,
  mockPublishJobs,
  mockExperiments,
  mockRevenue,
  OPPORTUNITY_LABEL,
} from "@/lib/mock-data";
import { ArrowRight, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const toneClass = {
  default: "border-border",
  info: "border-info/40",
  warning: "border-warning/40",
  destructive: "border-destructive/40",
} as const;

function DashboardPage() {
  const topOpps = [...mockOpportunities].sort((a, b) => b.priority - a.priority).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="The highest-impact actions for your connected WordPress sites — ranked by impact × confidence ÷ effort. Every number below is mock until you connect WordPress, Google Search Console, and GA4."
        actions={
          <Button asChild>
            <Link to="/opportunities">
              Open opportunity board <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />
      <PageBody>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {dashboardKpis.map((k) => (
            <Card key={k.label} className={cn("border", toneClass[k.tone])}>
              <CardHeader className="pb-2">
                <CardDescription className="text-[11px] uppercase tracking-wide">
                  {k.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">{k.value}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{k.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Top SEO opportunities</CardTitle>
                <CardDescription>Ranked by priority across all open opportunity types.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/opportunities">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {topOpps.map((o) => (
                <Link
                  key={o.id}
                  to="/opportunities"
                  className="flex items-start justify-between gap-3 rounded-md border border-border bg-card/50 p-3 hover:border-primary/40 hover:bg-accent/30 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {OPPORTUNITY_LABEL[o.type]}
                      </Badge>
                      <span className="truncate text-xs text-muted-foreground">{o.page_url}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium leading-snug">{o.title}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-semibold tabular-nums text-primary">
                      {Math.round(o.priority)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      priority
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">AI visibility</CardTitle>
                <CardDescription>Monitoring only — do not claim improvement unless measured.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">18%</span>
                  <span className="text-xs text-muted-foreground">brand-cited rate</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Across 24 tracked prompts and 3 models. Competitors cited 64%.
                </p>
                <Button variant="link" size="sm" asChild className="px-0 mt-2">
                  <Link to="/ai-visibility">Open AI Visibility <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Validation failures</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-2xl font-semibold tabular-nums text-destructive">2</div>
                <p className="text-xs text-muted-foreground">
                  Diffs blocked from publishing until issues are resolved.
                </p>
                <Button variant="link" size="sm" asChild className="px-0">
                  <Link to="/validation">Review validation <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estimated revenue by URL</CardTitle>
              <CardDescription>
                Revenue estimation requires GA4 + merchant attribution. No values are invented.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">URL</th>
                      <th className="px-3 py-2 text-right font-medium">Clicks (28d)</th>
                      <th className="px-3 py-2 text-right font-medium">Affiliate clicks</th>
                      <th className="px-3 py-2 text-right font-medium">Est. revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockRevenue.map((r) => (
                      <tr key={r.page_url} className="border-t border-border">
                        <td className="px-3 py-2 truncate max-w-[220px]">{r.page_url}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.clicks}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.affiliate_clicks}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          —
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Revenue values intentionally blank — connect GA4 + merchant data to populate.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent activity</CardTitle>
              <CardDescription>Crawls, generations, validations, approvals, publishes, rollbacks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {mockPublishJobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-b-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{j.mode.replace("_", " ")}</Badge>
                      <span className="truncate text-xs">{j.page_url}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      requested by {j.requested_by} · {new Date(j.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={j.status === "succeeded" ? "secondary" : "outline"} className="capitalize text-[10px]">
                    {j.status}
                  </Badge>
                </div>
              ))}
              {mockExperiments.map((e) => (
                <div key={e.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-b-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <span className="truncate text-xs">{e.page_url}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Experiment · {e.status}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{e.result}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
