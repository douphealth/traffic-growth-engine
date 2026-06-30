import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/keywords")({
  component: KeywordsPage,
});

type Row = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function KeywordsPage() {
  const q = useQuery({
    queryKey: ["keywords-gsc"],
    queryFn: async () => {
      const since = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("gsc_page_query_daily")
        .select("query, clicks, impressions, position")
        .gte("date", since)
        .limit(20000);
      if (error) throw error;
      const agg = new Map<string, { clicks: number; impressions: number; posSum: number; n: number }>();
      for (const r of data ?? []) {
        const k = r.query ?? "";
        if (!k) continue;
        const a = agg.get(k) ?? { clicks: 0, impressions: 0, posSum: 0, n: 0 };
        a.clicks += r.clicks ?? 0;
        a.impressions += r.impressions ?? 0;
        a.posSum += Number(r.position ?? 0);
        a.n += 1;
        agg.set(k, a);
      }
      const rows: Row[] = [...agg.entries()].map(([query, a]) => ({
        query,
        clicks: a.clicks,
        impressions: a.impressions,
        ctr: a.impressions ? a.clicks / a.impressions : 0,
        position: a.n ? a.posSum / a.n : 0,
      }));
      rows.sort((x, y) => y.impressions - x.impressions);
      return rows.slice(0, 200);
    },
  });

  return (
    <>
      <PageHeader
        title="Keyword Strategy"
        description="Real queries from Google Search Console for the last 28 days, aggregated across all connected sites. No volumes or difficulty are invented."
      />
      <PageBody>
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <EmptyState
            title="No Search Console data yet"
            description="Import GSC data on a connected site, then keywords will appear here."
          />
        )}
        {q.data && q.data.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Query</th>
                    <th className="px-4 py-2.5 text-right font-medium">Clicks</th>
                    <th className="px-4 py-2.5 text-right font-medium">Impressions</th>
                    <th className="px-4 py-2.5 text-right font-medium">CTR</th>
                    <th className="px-4 py-2.5 text-right font-medium">Avg pos</th>
                    <th className="px-4 py-2.5 text-right font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((k) => (
                    <tr key={k.query} className="border-t border-border">
                      <td className="px-4 py-3 font-medium truncate max-w-[420px]">{k.query}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{k.clicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{k.impressions.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{(k.ctr * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right tabular-nums">{k.position.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="outline" className="text-[10px]">GSC</Badge>
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
