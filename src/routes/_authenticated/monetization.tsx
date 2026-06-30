import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockMonetization } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/monetization")({
  component: MonetizationPage,
});

function MonetizationPage() {
  return (
    <>
      <PageHeader
        title="Monetization"
        description="Safe affiliate fixes only: disclosures, tracked outbound links, comparison-table CTAs. Never invents revenue, reviews, or merchant claims."
      />
      <PageBody>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Page</th>
                  <th className="px-4 py-2.5 text-left font-medium">Issue</th>
                  <th className="px-4 py-2.5 text-right font-medium">Severity</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {mockMonetization.map((m, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-3 truncate max-w-[260px]">{m.page_url}</td>
                    <td className="px-4 py-3">{m.issue}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant="outline" className={m.severity >= 4 ? "border-destructive/40 text-destructive" : m.severity >= 3 ? "border-warning/40 text-warning" : ""}>
                        {m.severity}/5
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline">Generate fix</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
