import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/internal-links")({
  component: InternalLinksPage,
});

function InternalLinksPage() {
  const q = useQuery({
    queryKey: ["link-opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("link_opportunities")
        .select("id, source_url, target_url, suggested_anchor, similarity, status")
        .eq("status", "open")
        .order("similarity", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Internal Links"
        description="Semantic link recommendations from the sitewide graph. Computed from imported WordPress content — not generated."
      />
      <PageBody>
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <EmptyState
            title="No internal link opportunities yet"
            description="Internal link suggestions are produced from page embeddings. Import WordPress inventory and run scoring on a site to populate this list."
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}
