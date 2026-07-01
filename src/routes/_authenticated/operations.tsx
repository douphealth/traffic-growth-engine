import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, CheckCircle2, FileCheck2, Globe, Search, Send, ShieldCheck, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { PageBody, PageHeader } from "@/components/page-header";
import { OpportunityQueue, PipelineActions, PipelineCommandCenter } from "@/components/ops-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getPipelineHealth } from "@/lib/quality.functions";

export const Route = createFileRoute("/_authenticated/operations")({
  component: OperationsPage,
});

function OperationsPage() {
  const healthQ = useQuery({ queryKey: ["pipeline-health"], queryFn: () => getPipelineHealth() });
  const health = healthQ.data;
  const blocked = health?.sites.filter((site) => site.status !== "ready") ?? [];

  return (
    <>
      <PageHeader
        title="Operations"
        description="A single command center for the real data pipeline: connect GSC, import rows, sync URLs into pages, score the top actions, validate, and publish safely."
        actions={<PipelineActions />}
      />
      <PageBody>
        <PipelineCommandCenter focus="If any screen feels empty, run this pipeline first: GSC import → URL/page sync → opportunity scoring." />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <OpsMetric label="Pipeline quality" value={health ? `${health.totals.average_quality}/100` : "…"} helper="Credibility score" progress={health?.totals.average_quality} />
          <OpsMetric label="GSC rows" value={health ? health.totals.gsc_rows.toLocaleString() : "…"} helper="Imported evidence rows" />
          <OpsMetric label="Analyzable pages" value={health ? health.totals.pages.toLocaleString() : "…"} helper="WordPress + GSC URLs" />
          <OpsMetric label="Open actions" value={health ? health.totals.opportunities.toLocaleString() : "…"} helper="Ranked opportunities" tone="warning" />
        </div>

        {blocked.length > 0 && (
          <Card className="border-warning/40 bg-warning/5">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Sites needing attention</CardTitle>
                  <CardDescription>Fix these first so downstream screens stop showing sparse or stale data.</CardDescription>
                </div>
                <Badge variant="outline" className="border-warning/50 text-warning">{blocked.length} blocked</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {blocked.slice(0, 6).map((site) => (
                <div key={site.canonical_site_id} className="flex flex-col gap-2 rounded-md border border-border bg-card/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{site.quality_score}/100</Badge>
                      <p className="truncate text-sm font-medium">{site.name}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{site.issues[0] ?? "Run import, page sync, and scoring."}</p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/sites">Fix in inventory</Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operational workflow</CardTitle>
            <CardDescription>Every navigation item now maps to a real job. Start at the first incomplete step.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <WorkflowLink to="/gsc/connect" icon={<Search className="h-4 w-4" />} title="1. Connect GSC" description="OAuth, choose properties, and import Search Console evidence." />
            <WorkflowLink to="/sites" icon={<Globe className="h-4 w-4" />} title="2. Inventory sites" description="See GSC rows, URL/page sync, WordPress enrichment, and next best action." />
            <WorkflowLink to="/opportunities" icon={<Target className="h-4 w-4" />} title="3. Score top actions" description="Prioritized, evidence-backed opportunities with exact queries and validation methods." />
            <WorkflowLink to="/content" icon={<FileCheck2 className="h-4 w-4" />} title="4. Plan content updates" description="Use the action queue before creating any draft or diff." />
            <WorkflowLink to="/validation" icon={<ShieldCheck className="h-4 w-4" />} title="5. Validate safely" description="Human-in-the-loop checks before any WordPress write." />
            <WorkflowLink to="/publishing" icon={<Send className="h-4 w-4" />} title="6. Publish with rollback" description="Approved jobs only; no silent writes or unsafe automation." />
          </CardContent>
        </Card>

        <OpportunityQueue
          title="Highest-priority work queue"
          description="The same real evidence powering the specialist screens, collected here for fast execution."
          emptyTitle="No work queued yet"
          emptyDescription="Run the GSC pipeline, then scoring, to generate the top 20 high-impact actions per site."
          limit={15}
        />
      </PageBody>
    </>
  );
}

function OpsMetric({ label, value, helper, progress, tone }: { label: string; value: string; helper: string; progress?: number; tone?: "warning" }) {
  return (
    <Card className={tone === "warning" ? "border-warning/40" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="text-[11px] uppercase tracking-wide">{label}</CardDescription>
          {tone === "warning" ? <BarChart3 className="h-3.5 w-3.5 text-warning" /> : <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
        {progress != null && <Progress value={progress} className="mt-3 h-1.5" />}
      </CardContent>
    </Card>
  );
}

function WorkflowLink({
  to,
  icon,
  title,
  description,
}: {
  to: "/gsc/connect" | "/sites" | "/opportunities" | "/content" | "/validation" | "/publishing";
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} className="group rounded-lg border border-border bg-muted/20 p-4 transition hover:border-primary/50 hover:bg-accent/30">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-md bg-primary/10 p-2 text-primary">{icon}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <div className="mt-3 text-sm font-medium">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </Link>
  );
}