import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OpportunityQueue, PipelineActions, PipelineCommandCenter } from "@/components/ops-workspace";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/schema")({
  component: SchemaPage,
});

function SchemaPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["schema-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schema_items")
        .select("id, schema_type, visible_evidence_ok, status, pages(url)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("schema_items").update({ status }).eq("id", id);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(status === "dismissed" ? "Schema finding dismissed" : "Schema item queued for validation");
      qc.invalidateQueries({ queryKey: ["schema-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Schema"
        description="Structured-data queue from real page evidence. Recommendations stay conservative: visible content must support every schema field."
        actions={<PipelineActions />}
      />
      <PageBody>
        <PipelineCommandCenter focus="Prioritize schema only when a page has traffic and enough visible content evidence." />
        <OpportunityQueue
          types={["schema_gap", "indexation_risk"]}
          title="Schema and indexability action queue"
          description="Traffic-backed pages where structured data or indexability deserves attention."
          emptyTitle="No schema/indexability actions yet"
          emptyDescription="Import WordPress inventory and run scoring to detect schema gaps and indexability risks."
        />
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <EmptyState
            title="No schema findings yet"
            description="Schema items are detected when WordPress inventory is imported and pages are parsed for JSON-LD. Import inventory on a site to populate this view."
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
                    <th className="px-4 py-2.5 text-left font-medium">Schema type</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium">Visible evidence</th>
                    <th className="px-4 py-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((s: any) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-4 py-3 truncate max-w-[320px]">{s.pages?.url ?? "—"}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{s.schema_type}</Badge></td>
                      <td className="px-4 py-3"><Badge variant="secondary" className="capitalize">{s.status ?? "—"}</Badge></td>
                      <td className="px-4 py-3">
                        {s.visible_evidence_ok === true ? (
                          <span className="text-xs text-success">✓ supported</span>
                        ) : s.visible_evidence_ok === false ? (
                          <span className="text-xs text-destructive">✗ unsupported</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">— unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: s.id, status: "queued" })} disabled={setStatus.isPending || s.visible_evidence_ok === false}>
                            Queue validation
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: s.id, status: "dismissed" })} disabled={setStatus.isPending}>
                            Ignore
                          </Button>
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
