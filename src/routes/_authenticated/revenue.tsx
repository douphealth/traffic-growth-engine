import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { mockRevenue } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/revenue")({
  component: RevenuePage,
});

function RevenuePage() {
  return (
    <>
      <PageHeader
        title="Revenue"
        description="Estimated revenue per URL requires GA4 affiliate_click events + merchant attribution. AutoTraffic AI never invents revenue numbers."
      />
      <PageBody>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">URL</th>
                  <th className="px-4 py-2.5 text-right font-medium">Clicks (28d)</th>
                  <th className="px-4 py-2.5 text-right font-medium">Affiliate clicks</th>
                  <th className="px-4 py-2.5 text-right font-medium">Est. revenue</th>
                </tr>
              </thead>
              <tbody>
                {mockRevenue.map((r) => (
                  <tr key={r.page_url} className="border-t border-border">
                    <td className="px-4 py-3 truncate max-w-[300px]">{r.page_url}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.clicks}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.affiliate_clicks}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">—</td>
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
