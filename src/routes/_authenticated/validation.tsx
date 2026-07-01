import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, AlertTriangle, CheckCircle2, GitCompare, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OpportunityQueue, PipelineActions, PipelineCommandCenter } from "@/components/ops-workspace";
import { toast } from "sonner";
import { useSiteScope } from "@/hooks/use-site-scope";

export const Route = createFileRoute("/_authenticated/validation")({
  component: ValidationPage,
});

function ValidationPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["validation-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("validation_runs")
        .select("id, passed, checks, blocking_failures, warnings, ran_at, content_diffs(id, proposed_title, status, site_id, page_id, pages(url))")
        .order("ran_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setDiffStatus = useMutation({
    mutationFn: async ({ diffId, status, siteId, pageId }: { diffId: string; status: "approved" | "rejected"; siteId?: string | null; pageId?: string | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const patch = status === "approved"
        ? { status, approved_at: new Date().toISOString(), approved_by: userData.user?.id ?? null }
        : { status };
      const { error } = await supabase.from("content_diffs").update(patch).eq("id", diffId);
      if (error) throw error;
      if (status === "approved" && siteId) {
        const existing = await supabase.from("publish_jobs").select("id").eq("diff_id", diffId).maybeSingle();
        if (existing.error) throw existing.error;
        if (!existing.data?.id) {
          const { error: jobError } = await supabase.from("publish_jobs").insert({
            site_id: siteId,
            diff_id: diffId,
            page_id: pageId ?? null,
            mode: "draft",
            status: "queued",
            requested_by: userData.user?.id ?? null,
          });
          if (jobError) throw jobError;
        }
      }
      return status;
    },
    onSuccess: (status) => {
      toast.success(status === "approved" ? "Diff approved for publishing queue" : "Diff rejected and sent back");
      qc.invalidateQueries({ queryKey: ["validation-runs"] });
      qc.invalidateQueries({ queryKey: ["content-diffs"] });
      qc.invalidateQueries({ queryKey: ["publishing-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Validation & Diff Review"
        description="Human-in-the-loop safety layer. Until diffs exist, use the evidence queue to decide which change should enter validation first."
        actions={<PipelineActions />}
      />
      <PageBody>
        <PipelineCommandCenter focus="Validation should only review changes that came from real GSC evidence and can be rolled back." />
        <OpportunityQueue
          title="Ready to turn into validation work"
          description="Open opportunities with evidence, action, and measurement method. Generate diffs from these before publishing."
          emptyTitle="No validation candidates yet"
          emptyDescription="Run the pipeline to generate evidence-backed actions, then promote one into a diff for validation."
          limit={8}
        />
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <EmptyState
            title="No validation runs yet"
            description="A validation run is recorded automatically each time a diff is generated. Generate diffs from briefs to populate this view."
            action={<PipelineActions scope="compact" />}
          />
        )}
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
        {q.data?.map((d: any) => {
          const diff = Array.isArray(d.content_diffs) ? d.content_diffs[0] : d.content_diffs;
          const checks = normalizeChecks(d.checks, d.blocking_failures, d.warnings);
          return (
          <Card key={d.id} className={d.passed ? "border-success/30" : "border-destructive/40"}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {d.passed ? <ShieldCheck className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                    {diff?.proposed_title ?? diff?.pages?.url ?? "Diff"}
                  </CardTitle>
                  <CardDescription className="truncate">
                    {diff?.pages?.url ?? ""} · ran {new Date(d.ran_at).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {diff?.status && <Badge variant="outline" className="capitalize">{diff.status}</Badge>}
                  <Badge variant={d.passed ? "secondary" : "outline"} className={d.passed ? "" : "border-destructive/40 text-destructive"}>
                    {d.passed ? "Validated" : "Blocking failure"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-2">
                {checks.map((check) => (
                  <div key={check.label} className="flex items-start gap-2 rounded-md border border-border bg-muted/20 p-3 text-xs">
                    {check.passed ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-success" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 text-destructive" />}
                    <div>
                      <div className="font-medium text-foreground">{check.label}</div>
                      {check.detail && <div className="mt-0.5 text-muted-foreground">{check.detail}</div>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/content"><GitCompare className="mr-1.5 h-3.5 w-3.5" /> Review source diff</Link>
                </Button>
                {diff?.id && !d.passed && (
                  <Button variant="outline" size="sm" onClick={() => setDiffStatus.mutate({ diffId: diff.id, status: "rejected" })} disabled={setDiffStatus.isPending}>
                    Reject diff
                  </Button>
                )}
                {diff?.id && d.passed && diff.status !== "approved" && diff.status !== "published" && (
                  <Button size="sm" onClick={() => setDiffStatus.mutate({ diffId: diff.id, status: "approved", siteId: diff.site_id, pageId: diff.page_id })} disabled={setDiffStatus.isPending}>
                    {setDiffStatus.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Approve for publishing
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );})}
      </PageBody>
    </>
  );
}

function normalizeChecks(checks: unknown, failures: unknown, warnings: unknown): Array<{ label: string; passed: boolean; detail?: string }> {
  const rows: Array<{ label: string; passed: boolean; detail?: string }> = [];
  if (checks && typeof checks === "object" && !Array.isArray(checks)) {
    for (const [key, raw] of Object.entries(checks as Record<string, unknown>)) {
      const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
      const passed = obj ? obj.passed !== false && obj.ok !== false && obj.status !== "failed" : Boolean(raw);
      rows.push({
        label: humanize(key),
        passed,
        detail: obj?.message ? String(obj.message) : obj?.reason ? String(obj.reason) : typeof raw === "string" ? raw : undefined,
      });
    }
  }
  for (const item of toArray(failures)) rows.push({ label: "Blocking failure", passed: false, detail: String(item) });
  for (const item of toArray(warnings)) rows.push({ label: "Warning", passed: true, detail: String(item) });
  return rows.length ? rows : [{ label: "Validation result recorded", passed: true, detail: "No detailed checks were stored for this run." }];
}

function toArray(value: unknown): unknown[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function humanize(key: string): string {
  return key.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
