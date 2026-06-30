import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/revenue")({
  component: RevenuePage,
});

function RevenuePage() {
  const q = useQuery({
    queryKey: ["revenue-clicks"],
    queryFn: async () => {
      const since = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("gsc_page_query_daily")
        .select("url, clicks, impressions")
        .gte("date", since)
        .limit(50000);
      if (error) throw error;
      const agg = new Map<string, { clicks: number; impressions: number }>();
      for (const r of data ?? []) {
        const k = r.url ?? "";
        if (!k) continue;
        const a = agg.get(k) ?? { clicks: 0, impressions: 0 };
        a.clicks += r.clicks ?? 0;
        a.impressions += r.impressions ?? 0;
        agg.set(k, a);
      }
      return [...agg.entries()]
        .map(([url, a]) => ({ url, ...a }))
        .sort((x, y) => y.clicks - x.clicks)
        .slice(0, 200);
    },
  });

  return (
    <>
      <PageHeader
        title="Revenue"
        description="Per-URL revenue requires GA4 affiliate_click events + merchant attribution. Until GA4 is wired, this view shows real GSC clicks per page — never invented dollar values."
      />
      <PageBody>
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <EmptyState
            title="No traffic data yet"
            description="Import Google Search Console data on a connected site to populate this view."
          />
        )}
        {q.data && q.data.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">URL</th>
                    <th className="px-4 py-2.5 text-right font-medium">Clicks (28d)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Impressions (28d)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Est. revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((r) => (
                    <tr key={r.url} className="border-t border-border">
                      <td className="px-4 py-3 truncate max-w-[420px]">{r.url}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.clicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.impressions.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">— GA4 not connected</td>
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
