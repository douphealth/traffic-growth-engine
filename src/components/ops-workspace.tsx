import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BarChart3, CheckCircle2, ExternalLink, FileText, Loader2, RefreshCw, ShieldAlert, Target, XCircle } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { importAllConnectedGscProperties } from "@/lib/gsc-pages.functions";
import { scoreOpportunities } from "@/lib/opportunities.functions";
import { getPipelineHealth } from "@/lib/quality.functions";

export const OPPORTUNITY_LABEL: Record<string, string> = {
  ctr_leak: "CTR leak",
  striking_distance: "Striking distance",
  decayed_page: "Decayed page",
  cannibalization: "Cannibalization",
  indexation_risk: "Indexation risk",
  internal_link_gap: "Internal link gap",
  schema_gap: "Schema gap",
  ai_answer_gap: "AI answer gap",
  monetization_leak: "Monetization leak",
};

type OpsOpportunity = {
  id: string;
  site_id: string;
  page_id: string | null;
  type: string;
  title: string;
  summary: string | null;
  recommended_action: string | null;
  validation_method: string | null;
  priority: number | null;
  impact_score: number | null;
  confidence_score: number | null;
  risk_score: number | null;
  source_data: Record<string, unknown> | null;
  evidence: Record<string, unknown> | null;
  page?: { url: string | null; title: string | null } | null;
  site?: { name: string | null } | null;
};

export function PipelineActions({ scope = "full" }: { scope?: "full" | "compact" }) {
  const qc = useQueryClient();
  const sitesQ = useQuery({
    queryKey: ["sites-mini-actions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sites").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const importAll = useMutation({
    mutationFn: () => importAllConnectedGscProperties(),
    onSuccess: (r) => {
      toast.success(
        `Pipeline complete · ${r.totals.rows.toLocaleString()} rows · ${r.totals.pages.toLocaleString()} page updates · ${r.totals.opportunities.toLocaleString()} opportunities`,
      );
      invalidateOps(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scoreAll = useMutation({
    mutationFn: async () => {
      const sites = sitesQ.data ?? [];
      if (!sites.length) throw new Error("No sites connected yet.");
      let inserted = 0;
      const failures: string[] = [];
      for (const site of sites) {
        try {
          const r = await scoreOpportunities({ data: { site_id: site.id } });
          inserted += r.inserted;
        } catch (e) {
          failures.push(`${site.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      if (failures.length && inserted === 0) throw new Error(failures[0]);
      return { inserted, failures };
    },
    onSuccess: (r) => {
      toast.success(`Scoring complete · ${r.inserted.toLocaleString()} open opportunities generated`);
      if (r.failures.length) toast.error(`${r.failures.length} site${r.failures.length === 1 ? "" : "s"} failed during scoring.`);
      invalidateOps(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => importAll.mutate()} disabled={importAll.isPending} size={scope === "compact" ? "sm" : "default"}>
        {importAll.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="mr-1.5 h-3.5 w-3.5" />}
        Run full GSC pipeline
      </Button>
      <Button variant="outline" onClick={() => scoreAll.mutate()} disabled={scoreAll.isPending || importAll.isPending} size={scope === "compact" ? "sm" : "default"}>
        {scoreAll.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Target className="mr-1.5 h-3.5 w-3.5" />}
        Rescore opportunities
      </Button>
      <Button variant="outline" asChild size={scope === "compact" ? "sm" : "default"}>
        <Link to="/gsc/connect">
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          GSC connector
        </Link>
      </Button>
    </div>
  );
}

export function PipelineCommandCenter({ focus }: { focus?: string }) {
  const healthQ = useQuery({ queryKey: ["pipeline-health"], queryFn: () => getPipelineHealth() });
  const health = healthQ.data;
  const worst = health?.sites.find((site) => site.status !== "ready");

  if (healthQ.isLoading) return <p className="text-sm text-muted-foreground">Loading pipeline health…</p>;

  if (!health || health.totals.sites === 0) {
    return (
      <EmptyState
        title="No connected properties yet"
        description="Connect Search Console first. The app will create sites, import GSC rows, materialize URLs as pages, and generate ranked actions."
        action={
          <Button asChild>
            <Link to="/gsc/connect">Connect Search Console</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Card className={worst ? "border-warning/40" : "border-success/30"}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {worst ? <ShieldAlert className="h-4 w-4 text-warning" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
              <CardTitle className="text-base">Operational command center</CardTitle>
            </div>
            <CardDescription className="mt-1">
              {focus ?? "Run the real-data pipeline before reviewing recommendations."}
            </CardDescription>
          </div>
          <PipelineActions scope="compact" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[180px_1fr]">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Data quality</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-3xl font-semibold tabular-nums">{health.totals.average_quality}</span>
            <span className="pb-1 text-xs text-muted-foreground">/100</span>
          </div>
          <Progress value={health.totals.average_quality} className="mt-2 h-1.5" />
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <Metric label="Sites" value={health.totals.sites} />
          <Metric label="GSC rows" value={health.totals.gsc_rows} />
          <Metric label="Pages" value={health.totals.pages} />
          <Metric label="Open actions" value={health.totals.opportunities} tone="warning" />
        </div>
        {worst?.issues[0] && (
          <p className="md:col-span-2 text-xs text-muted-foreground">
            Priority fix: <span className="text-foreground">{worst.name}</span> — {worst.issues[0]}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function OpportunityQueue({
  types,
  title = "Action queue",
  description,
  emptyTitle = "No matching actions yet",
  emptyDescription = "Run the GSC pipeline and opportunity scoring to populate this queue from real data.",
  limit = 12,
}: {
  types?: string[];
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  limit?: number;
}) {
  const q = useQuery({
    queryKey: ["ops-opportunity-queue", types?.join("|") ?? "all", limit],
    queryFn: async () => {
      let req = supabase
        .from("opportunities")
        .select("id, site_id, page_id, type, title, summary, recommended_action, validation_method, priority, impact_score, confidence_score, risk_score, source_data, evidence, page:pages(url, title), site:sites(name)")
        .eq("status", "open")
        .order("priority", { ascending: false })
        .limit(limit);
      if (types?.length) req = req.in("type", types as never);
      const { data, error } = await req;
      if (error) throw error;
      return (data ?? []) as unknown as OpsOpportunity[];
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/opportunities">Open board <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading actions…</p>}
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
        {q.data && q.data.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} action={<PipelineActions scope="compact" />} />}
        {q.data?.map((opp) => <OpportunityQueueItem key={opp.id} opportunity={opp} />)}
      </CardContent>
    </Card>
  );
}

function OpportunityQueueItem({ opportunity }: { opportunity: OpsOpportunity }) {
  const qc = useQueryClient();
  const evidence = { ...(opportunity.source_data ?? {}), ...(opportunity.evidence ?? {}) };
  const topQueries = Array.isArray(evidence.top_queries) ? evidence.top_queries.slice(0, 3) as Array<Record<string, unknown>> : [];
  const targetQueries = topQueries.map((q) => String(q.query ?? "")).filter(Boolean);

  const setStatus = useMutation({
    mutationFn: async (status: "in_progress" | "dismissed") => {
      const { error } = await supabase.from("opportunities").update({ status }).eq("id", opportunity.id);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(status === "dismissed" ? "Opportunity dismissed" : "Opportunity marked in progress");
      invalidateOps(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createBrief = useMutation({
    mutationFn: async () => {
      const existing = await supabase
        .from("content_briefs")
        .select("id")
        .eq("opportunity_id", opportunity.id)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data?.id) return { reused: true };

      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("content_briefs").insert({
        site_id: opportunity.site_id,
        page_id: opportunity.page_id,
        opportunity_id: opportunity.id,
        created_by: userData.user?.id ?? null,
        status: "ready",
        target_url: opportunity.page?.url ?? null,
        intent: OPPORTUNITY_LABEL[opportunity.type] ?? opportunity.type,
        target_queries: targetQueries,
        recommended_sections: [opportunity.recommended_action ?? opportunity.summary ?? opportunity.title],
        validation_checklist: [
          "Use only imported Search Console evidence.",
          "Preserve existing affiliate links, tables, images, buttons, and claims.",
          "Create a reversible diff and pass validation before publishing.",
        ],
      });
      if (error) throw error;
      await supabase.from("opportunities").update({ status: "in_progress" }).eq("id", opportunity.id);
      return { reused: false };
    },
    onSuccess: (r) => {
      toast.success(r.reused ? "A brief already exists for this opportunity" : "Content brief created");
      qc.invalidateQueries({ queryKey: ["content-briefs"] });
      invalidateOps(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-md border border-border bg-card/50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">{OPPORTUNITY_LABEL[opportunity.type] ?? opportunity.type}</Badge>
            {opportunity.site?.name && <Badge variant="outline" className="text-[10px]">{opportunity.site.name}</Badge>}
            {opportunity.page?.url && <span className="truncate text-xs text-muted-foreground">{opportunity.page.url}</span>}
          </div>
          <div className="mt-1 text-sm font-medium leading-snug">{opportunity.title}</div>
          {opportunity.summary && <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{opportunity.summary}</p>}
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <div className="text-xl font-semibold tabular-nums text-primary">{Math.round(opportunity.priority ?? 0)}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">priority</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <MiniScore label="Impact" value={opportunity.impact_score ?? 0} />
        <MiniScore label="Confidence" value={opportunity.confidence_score ?? 0} />
        <MiniScore label="Risk" value={opportunity.risk_score ?? 0} />
      </div>
      {topQueries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {topQueries.map((query, index) => (
            <Badge key={`${String(query.query)}-${index}`} variant="outline" className="max-w-full text-[10px] font-normal">
              {String(query.query ?? "query")} · {formatNumber(query.impressions)} impr.
            </Badge>
          ))}
        </div>
      )}
      {opportunity.recommended_action && (
        <p className="mt-3 text-xs leading-relaxed">
          <span className="text-muted-foreground">Action: </span>{opportunity.recommended_action}
        </p>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {opportunity.page?.url && (
          <Button variant="outline" size="sm" asChild>
            <a href={opportunity.page.url} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open URL
            </a>
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => createBrief.mutate()} disabled={createBrief.isPending || setStatus.isPending}>
          {createBrief.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
          Create brief
        </Button>
        <Button variant="outline" size="sm" onClick={() => setStatus.mutate("dismissed")} disabled={createBrief.isPending || setStatus.isPending}>
          <XCircle className="mr-1.5 h-3.5 w-3.5" /> Dismiss
        </Button>
        <Button size="sm" asChild>
          <Link to="/opportunities">Review evidence</Link>
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "warning" }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={tone === "warning" ? "mt-1 text-xl font-semibold tabular-nums text-warning" : "mt-1 text-xl font-semibold tabular-nums"}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground tabular-nums">{Math.round(v)}</span>
      </div>
      <Progress value={v} className="h-1.5" />
    </div>
  );
}

function formatNumber(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

function invalidateOps(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["pipeline-health"] });
  qc.invalidateQueries({ queryKey: ["opportunities"] });
  qc.invalidateQueries({ queryKey: ["ops-opportunity-queue"] });
  qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
  qc.invalidateQueries({ queryKey: ["dashboard-top-opps"] });
  qc.invalidateQueries({ queryKey: ["sites"] });
  qc.invalidateQueries({ queryKey: ["gsc-diagnostics"] });
}