import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { OpportunityQueue, PipelineActions, PipelineCommandCenter } from "@/components/ops-workspace";
import { useSiteScope } from "@/hooks/use-site-scope";

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
        description="Traffic-backed revenue prioritization. Until GA4/merchant attribution is wired, this page uses real organic clicks and never invents dollars."
        actions={<PipelineActions />}
      />
      <PageBody>
        <PipelineCommandCenter focus="Prioritize monetization only on pages with real traffic and clear measurement paths." />
        <OpportunityQueue
          types={["monetization_leak"]}
          title="Revenue opportunity queue"
          description="Organic-click pages that should be reviewed for safe monetization or tracking fixes."
          emptyTitle="No revenue actions yet"
          emptyDescription="Import GSC and WordPress inventory, then run scoring to identify traffic pages without monetization coverage."
        />
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <EmptyState
            title="No traffic data yet"
            description="Import Google Search Console data on a connected site to populate this view."
            action={<PipelineActions scope="compact" />}
          />
        )}
        {q.data && q.data.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top organic traffic pages</CardTitle>
              <CardDescription>Real GSC clicks by URL for the last 28 days.</CardDescription>
            </CardHeader>
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
