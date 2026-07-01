import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OpportunityQueue, PipelineActions, PipelineCommandCenter } from "@/components/ops-workspace";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/monetization")({
  component: MonetizationPage,
});

function MonetizationPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["monetization"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monetization_opportunities")
        .select("id, kind, description, status, page_id, pages(url)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "queued" | "dismissed" }) => {
      const { error } = await supabase.from("monetization_opportunities").update({ status }).eq("id", id);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(status === "queued" ? "Monetization fix queued" : "Monetization opportunity dismissed");
      qc.invalidateQueries({ queryKey: ["monetization"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Monetization"
        description="Monetization actions from real traffic and page evidence. No invented revenue, reviews, or merchant claims."
        actions={<PipelineActions />}
      />
      <PageBody>
        <PipelineCommandCenter focus="Find pages with real clicks first, then prioritize safe monetization changes." />
        <OpportunityQueue
          types={["monetization_leak"]}
          title="Revenue action queue"
          description="Pages receiving organic clicks where monetization instrumentation or affiliate coverage is missing."
          emptyTitle="No monetization actions yet"
          emptyDescription="Import GSC data, import WordPress inventory for affiliate detection, then run scoring."
        />
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <EmptyState
            title="No monetization opportunities yet"
            description="These are detected when opportunity scoring runs against pages with affiliate links. Run scoring on a site to populate this list."
            action={<PipelineActions scope="compact" />}
          />
        )}
        {q.data && q.data.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Page</th>
                    <th className="px-4 py-2.5 text-left font-medium">Kind</th>
                    <th className="px-4 py-2.5 text-left font-medium">Description</th>
                    <th className="px-4 py-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((m: any) => (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-4 py-3 truncate max-w-[320px]">{m.pages?.url ?? "—"}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{m.kind}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{m.description ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {m.pages?.url && <Button size="sm" variant="outline" asChild><a href={m.pages.url} target="_blank" rel="noreferrer">Open page</a></Button>}
                          <Button size="sm" onClick={() => setStatus.mutate({ id: m.id, status: "queued" })} disabled={setStatus.isPending}>Queue fix</Button>
                          <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: m.id, status: "dismissed" })} disabled={setStatus.isPending}>Ignore</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}
