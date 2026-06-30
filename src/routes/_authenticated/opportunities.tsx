import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, FileEdit, Loader2, Target, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scoreOpportunities } from "@/lib/opportunities.functions";
import { syncPagesFromGsc, importAllConnectedGscProperties } from "@/lib/gsc-pages.functions";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/opportunities")({
  component: OpportunityBoard,
});

const OPPORTUNITY_LABEL: Record<string, string> = {
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

type OppRow = {
  id: string;
  site_id: string;
  page_id: string | null;
  type: string;
  title: string;
  summary: string | null;
  evidence: Record<string, unknown> | null;
  recommended_action: string | null;
  validation_method: string | null;
  severity: number | null;
  impact_score: number | null;
  confidence_score: number | null;
  effort_score: number | null;
  risk_score: number | null;
  reversibility_score: number | null;
  priority: number | null;
  status: string;
  generated_at: string | null;
  page?: { url: string | null; title: string | null } | null;
  site?: { name: string | null } | null;
};

function OpportunityBoard() {
  const qc = useQueryClient();
  const [type, setType] = useState("all");
  const [siteId, setSiteId] = useState("all");
  const [risk, setRisk] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");

  const sitesQ = useQuery({
    queryKey: ["sites-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("sites").select("id, name").order("name");
      return data ?? [];
    },
  });

  const oppsQ = useQuery({
    queryKey: ["opportunities", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select(
          "id, site_id, page_id, type, title, summary, evidence, recommended_action, validation_method, severity, impact_score, confidence_score, effort_score, risk_score, reversibility_score, priority, status, generated_at, page:pages(url, title), site:sites(name)",
        )
        .eq("status", status as never)
        .order("priority", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as OppRow[];
    },
  });

  const filtered = useMemo(() => {
    return (oppsQ.data ?? []).filter((o) => {
      if (type !== "all" && o.type !== type) return false;
      if (siteId !== "all" && o.site_id !== siteId) return false;
      if (risk !== "all") {
        const r = o.risk_score ?? 0;
        if (risk === "low" && r > 25) return false;
        if (risk === "med" && (r <= 25 || r > 50)) return false;
        if (risk === "high" && r <= 50) return false;
      }
      if (confidence !== "all") {
        const c = o.confidence_score ?? 0;
        if (confidence === "low" && c >= 60) return false;
        if (confidence === "med" && (c < 60 || c >= 80)) return false;
        if (confidence === "high" && c < 80) return false;
      }
      if (q) {
        const hay = (o.title + " " + (o.summary ?? "") + " " + (o.page?.url ?? "")).toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [oppsQ.data, type, siteId, risk, confidence, q]);

  const score = useMutation({
    mutationFn: async () => {
      const sites = sitesQ.data ?? [];
      if (!sites.length) throw new Error("No sites to score");
      const targets = siteId === "all" ? sites : sites.filter((s) => s.id === siteId);
      let total = 0;
      for (const s of targets) {
        const r = await scoreOpportunities({ data: { site_id: s.id } });
        total += r.inserted;
      }
      return total;
    },
    onSuccess: (n) => {
      toast.success(`Generated ${n} opportunities`);
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Diagnostic: are there GSC rows but zero opportunities? (suggests pages weren't synced)
  const gscRowsQ = useQuery({
    queryKey: ["gsc-rows-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("gsc_page_query_daily")
        .select("site_id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const repair = useMutation({
    mutationFn: async () => {
      const sites = sitesQ.data ?? [];
      const targets = siteId === "all" ? sites : sites.filter((s) => s.id === siteId);
      if (!targets.length) {
        const r = await importAllConnectedGscProperties();
        return { mode: "import_all" as const, opps: r.totals.opportunities };
      }
      let opps = 0;
      for (const s of targets) {
        await syncPagesFromGsc({ data: { site_id: s.id } });
        const r = await scoreOpportunities({ data: { site_id: s.id } });
        opps += r.inserted;
      }
      return { mode: "rescore" as const, opps };
    },
    onSuccess: (r) => {
      toast.success(`Repair complete — ${r.opps} opportunities generated.`);
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["gsc-rows-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // If we just returned from OAuth with ?auto_import=1, run the full pipeline once.
  const autoFired = useRef(false);
  const autoImport = useMutation({
    mutationFn: () => importAllConnectedGscProperties(),
    onSuccess: (r) => {
      toast.success(
        `Imported ${r.totals.rows} rows · ${r.totals.urls} URLs · ${r.totals.pages} pages · ${r.totals.opportunities} opportunities.`,
      );
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["gsc-rows-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  useEffect(() => {
    if (typeof window === "undefined" || autoFired.current) return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("auto_import") === "1") {
      autoFired.current = true;
      autoImport.mutate();
      p.delete("auto_import");
      const newUrl = window.location.pathname + (p.toString() ? `?${p.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <>
      <PageHeader
        title="Opportunity Board"
        description="Real opportunities scored from imported WordPress, Sitemap, and Search Console data. Priority is a weighted blend of impact, CTR leak, striking-distance, decay, monetization, AI readiness, link gaps, schema gaps, and safety."
        actions={
          <Button onClick={() => score.mutate()} disabled={score.isPending}>
            {score.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Target className="mr-1.5 h-3.5 w-3.5" />}
            Run opportunity scoring
          </Button>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search title, URL…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(OPPORTUNITY_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={siteId} onValueChange={setSiteId}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              {sitesQ.data?.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={risk} onValueChange={setRisk}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Risk" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risk</SelectItem>
              <SelectItem value="low">Low risk</SelectItem>
              <SelectItem value="med">Med risk</SelectItem>
              <SelectItem value="high">High risk</SelectItem>
            </SelectContent>
          </Select>
          <Select value={confidence} onValueChange={setConfidence}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Confidence" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All confidence</SelectItem>
              <SelectItem value="high">High (≥80)</SelectItem>
              <SelectItem value="med">Med (60–79)</SelectItem>
              <SelectItem value="low">Low (&lt;60)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ml-auto text-[10px]">{filtered.length} shown</Badge>
        </div>

        {oppsQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!oppsQ.isLoading && filtered.length === 0 && (gscRowsQ.data ?? 0) > 0 && (
          <Card className="border-warning/40 bg-warning/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">GSC data exists, but no opportunities were generated.</CardTitle>
              <CardDescription>
                This usually means pages were not synced from your GSC URLs. Run the repair below — it will discover pages from GSC URLs and rescore opportunities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => repair.mutate()} disabled={repair.isPending}>
                {repair.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Repair: create pages from GSC URLs and rescore
              </Button>
            </CardContent>
          </Card>
        )}

        {!oppsQ.isLoading && filtered.length === 0 && (gscRowsQ.data ?? 0) === 0 && (
          <EmptyState
            title="No opportunities yet"
            description="Connect Google Search Console, import data, then run scoring. WordPress is optional."
            action={
              <Button onClick={() => score.mutate()} disabled={score.isPending || !(sitesQ.data?.length)}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Run opportunity scoring
              </Button>
            }
          />
        )}


        <div className="space-y-3">
          {filtered.map((o) => (
            <Card key={o.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{OPPORTUNITY_LABEL[o.type] ?? o.type}</Badge>
                      {o.severity != null && (
                        <Badge variant="outline" className="text-[10px]">severity {o.severity}/5</Badge>
                      )}
                      {o.site?.name && <Badge variant="outline" className="text-[10px]">{o.site.name}</Badge>}
                      {o.page?.url && (
                        <span className="text-xs text-muted-foreground truncate max-w-md">{o.page.url}</span>
                      )}
                    </div>
                    <CardTitle className="mt-1.5 text-base">{o.title}</CardTitle>
                    {o.summary && <CardDescription className="mt-1">{o.summary}</CardDescription>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-semibold tabular-nums text-primary">
                      {Math.round(o.priority ?? 0)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">priority</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <Score label="Impact" value={o.impact_score ?? 0} />
                  <Score label="Confidence" value={o.confidence_score ?? 0} />
                  <Score label="Effort" value={o.effort_score ?? 0} invert />
                  <Score label="Risk" value={o.risk_score ?? 0} invert />
                  <Score label="Reversibility" value={o.reversibility_score ?? 0} />
                </div>

                {o.evidence && Object.keys(o.evidence).length > 0 && (
                  <div className="rounded-md border border-border bg-muted/20 p-3 text-xs space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Evidence</div>
                    <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                      {Object.entries(o.evidence).slice(0, 10).map(([k, v]) => (
                        <li key={k} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-medium tabular-nums truncate text-right max-w-[60%]">
                            {typeof v === "number" ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 }) : String(Array.isArray(v) ? v.length + " items" : v).slice(0, 80)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  {o.recommended_action && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Recommended action</div>
                      <p className="text-foreground/90 mt-1 leading-relaxed">{o.recommended_action}</p>
                    </div>
                  )}
                  {o.validation_method && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Validation method</div>
                      <p className="text-foreground/90 mt-1 leading-relaxed">{o.validation_method}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await supabase.from("opportunities").update({ status: "dismissed" }).eq("id", o.id);
                      qc.invalidateQueries({ queryKey: ["opportunities"] });
                    }}
                  >
                    Dismiss
                  </Button>
                  <Button size="sm" asChild>
                    <Link to="/content">
                      <FileEdit className="mr-1.5 h-3.5 w-3.5" /> Generate brief
                      <ArrowRight className="ml-1.5 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}

function Score({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={invert ? "h-full bg-warning/70" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
