import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockLinkOpportunities } from "@/lib/mock-data";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/internal-links")({
  component: InternalLinksPage,
});

function InternalLinksPage() {
  return (
    <>
      <PageHeader
        title="Internal Links"
        description="Semantic link recommendations from the sitewide graph. Anchor text is suggested to be natural — over-optimized anchors are blocked at validation."
      />
      <PageBody>
        <div className="space-y-2">
          {mockLinkOpportunities.map((l, i) => (
            <Card key={i}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <code className="text-xs truncate text-muted-foreground max-w-[200px]">{l.source}</code>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <code className="text-xs truncate text-foreground max-w-[200px]">{l.target}</code>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className="text-[11px] font-normal">
                    anchor: “{l.anchor}”
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    sim {l.similarity.toFixed(2)}
                  </span>
                  <Button size="sm" variant="outline">Approve</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}
