import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OpportunityQueue, PipelineActions, PipelineCommandCenter } from "@/components/ops-workspace";
import { toast } from "sonner";
import { useSiteScope } from "@/hooks/use-site-scope";

export const Route = createFileRoute("/_authenticated/internal-links")({
  component: InternalLinksPage,
});

function InternalLinksPage() {
  const qc = useQueryClient();
  const { siteId } = useSiteScope();
  const q = useQuery({
    queryKey: ["link-opportunities", siteId ?? "all"],
    queryFn: async () => {
      let req = supabase
        .from("link_opportunities")
        .select("id, source_url, target_url, suggested_anchor, similarity, status")
        .eq("status", "open")
        .order("similarity", { ascending: false })
        .limit(200);
      if (siteId) req = req.eq("site_id", siteId);
      const { data, error } = await req;
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "queued" | "dismissed" }) => {
      const { error } = await supabase.from("link_opportunities").update({ status }).eq("id", id);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(status === "queued" ? "Internal link queued for validation" : "Internal link dismissed");
      qc.invalidateQueries({ queryKey: ["link-opportunities"] });
      qc.invalidateQueries({ queryKey: ["pipeline-health"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Internal Links"
        description="Internal-link work queue. WordPress inventory enables exact source→target suggestions; GSC data still identifies high-impact pages that need link equity."
        actions={<PipelineActions />}
      />
      <PageBody>
        <PipelineCommandCenter focus="Import WordPress for exact source links; use GSC-backed internal-link-gap opportunities for prioritization." />
        <OpportunityQueue
          types={["internal_link_gap"]}
          title="Internal-link priority queue"
          description="High-value pages with weak internal-link support."
          emptyTitle="No internal-link gap actions yet"
          emptyDescription="Import WordPress inventory and run scoring to compute source-target recommendations."
        />
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <EmptyState
            title="No internal link opportunities yet"
            description="Internal link suggestions are produced from page embeddings. Import WordPress inventory and run scoring on a site to populate this list."
            action={<PipelineActions scope="compact" />}
          />
        )}
        <div className="space-y-2">
          {q.data?.map((l) => (
            <Card key={l.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <code className="text-xs truncate text-muted-foreground max-w-[260px]">{l.source_url}</code>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <code className="text-xs truncate text-foreground max-w-[260px]">{l.target_url}</code>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {l.suggested_anchor && (
                    <Badge variant="outline" className="text-[11px] font-normal">
                      anchor: “{l.suggested_anchor}”
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    sim {Number(l.similarity ?? 0).toFixed(2)}
                  </span>
                  {l.target_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={l.target_url} target="_blank" rel="noreferrer">Open target</a>
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setStatus.mutate({ id: l.id, status: "queued" })} disabled={setStatus.isPending}>
                    Queue link
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setStatus.mutate({ id: l.id, status: "dismissed" })} disabled={setStatus.isPending}>
                    Ignore
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
