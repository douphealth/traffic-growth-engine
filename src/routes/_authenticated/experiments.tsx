import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { OpportunityQueue, PipelineActions, PipelineCommandCenter } from "@/components/ops-workspace";
import { useSiteScope } from "@/hooks/use-site-scope";

export const Route = createFileRoute("/_authenticated/experiments")({
  component: ExperimentsPage,
});

function ExperimentsPage() {
  const q = useQuery({
    queryKey: ["experiments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("experiments")
        .select("id, hypothesis, status, current_result, implementation_date, pages(url)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Experiments"
        description="Experiment candidates and launched tests. Every future published change must keep a measurable GSC baseline."
        actions={<PipelineActions />}
      />
      <PageBody>
        <PipelineCommandCenter focus="Use the highest-priority opportunities as experiment candidates before any live WordPress update." />
        <OpportunityQueue
          title="Experiment candidates"
          description="Highest-impact open actions ready to become controlled tests once a diff is validated and approved."
          emptyTitle="No experiment candidates yet"
          emptyDescription="Run GSC import and opportunity scoring to generate measurable experiment candidates."
          limit={10}
        />
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <EmptyState
            title="No experiments yet"
            description="An experiment is recorded automatically when a diff is approved and published. Approve diffs in Validation to start tracking impact."
            action={<PipelineActions scope="compact" />}
          />
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {q.data?.map((e: any) => (
            <Card key={e.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm truncate">{e.pages?.url ?? "—"}</CardTitle>
                  <Badge variant="outline" className="capitalize">{e.status}</Badge>
                </div>
                <CardDescription className="text-xs">{e.hypothesis ?? "—"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <Row label="Implemented" value={e.implementation_date ? new Date(e.implementation_date).toLocaleDateString() : "—"} />
                <Row label="Current result" value={<Badge variant="outline" className="capitalize">{e.current_result}</Badge>} />
              </CardContent>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
