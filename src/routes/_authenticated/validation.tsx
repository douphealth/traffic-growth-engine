import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/validation")({
  component: ValidationPage,
});

function ValidationPage() {
  const q = useQuery({
    queryKey: ["validation-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("validation_runs")
        .select("id, passed, checks, created_at, content_diffs(id, proposed_title, pages(url))")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Validation & Diff Review"
        description="Every proposed change is checked for HTML safety, preserved assets, schema/content match, and monetization integrity. If a critical check fails, publishing is blocked."
      />
      <PageBody>
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <EmptyState
            title="No validation runs yet"
            description="A validation run is recorded automatically each time a diff is generated. Generate diffs from briefs to populate this view."
          />
        )}
        {q.data?.map((d: any) => (
          <Card key={d.id} className={d.passed ? "border-success/30" : "border-destructive/40"}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {d.passed ? <ShieldCheck className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                    {d.content_diffs?.proposed_title ?? d.content_diffs?.pages?.url ?? "Diff"}
                  </CardTitle>
                  <CardDescription className="truncate">{d.content_diffs?.pages?.url ?? ""}</CardDescription>
                </div>
                <Badge variant={d.passed ? "secondary" : "outline"} className={d.passed ? "" : "border-destructive/40 text-destructive"}>
                  {d.passed ? "Validated" : "Blocking failure"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{JSON.stringify(d.checks, null, 2)}</pre>
            </CardContent>
          </Card>
        ))}
      </PageBody>
    </>
  );
}
