import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PipelineActions, PipelineCommandCenter } from "@/components/ops-workspace";
import { ArrowRight } from "lucide-react";
import { useSiteScope } from "@/hooks/use-site-scope";

export const Route = createFileRoute("/_authenticated/keywords")({
  component: KeywordsPage,
});

type Row = {
  query: string;
  site_id: string | null;
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  intent: "protect" | "improve_ctr" | "push_distance" | "monitor";
};

function KeywordsPage() {
  const { siteId } = useSiteScope();
  const q = useQuery({
    queryKey: ["keywords-gsc", siteId ?? "all"],
    queryFn: async () => {
      const since = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
      let req = supabase
        .from("gsc_page_query_daily")
        .select("site_id, url, query, clicks, impressions, position")
        .gte("date", since)
        .limit(50000);
      if (siteId) req = req.eq("site_id", siteId);
      const { data, error } = await req;
      if (error) throw error;
      const agg = new Map<string, { site_id: string | null; clicks: number; impressions: number; posSum: number; n: number; urls: Map<string, number> }>();
      for (const r of data ?? []) {
        const k = r.query ?? "";
        if (!k) continue;
        const a = agg.get(k) ?? { site_id: r.site_id ?? null, clicks: 0, impressions: 0, posSum: 0, n: 0, urls: new Map<string, number>() };
        a.clicks += r.clicks ?? 0;
        a.impressions += r.impressions ?? 0;
        if (r.position != null && r.impressions) {
          a.posSum += Number(r.position) * Number(r.impressions ?? 0);
          a.n += Number(r.impressions ?? 0);
        }
        if (r.url) a.urls.set(r.url, (a.urls.get(r.url) ?? 0) + (r.impressions ?? 0));
        agg.set(k, a);
      }
      const rows: Row[] = [...agg.entries()].map(([query, a]) => ({
        query,
        site_id: a.site_id,
        url: [...a.urls.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "",
        clicks: a.clicks,
        impressions: a.impressions,
        ctr: a.impressions ? a.clicks / a.impressions : 0,
        position: a.n ? a.posSum / a.n : 0,
        intent: classifyKeyword(a.impressions ? a.clicks / a.impressions : 0, a.n ? a.posSum / a.n : 0, a.clicks),
      }));
      rows.sort((x, y) => y.impressions - x.impressions);
      return rows.slice(0, 200);
    },
  });

  return (
    <>
      <PageHeader
        title="Keyword Strategy"
        description="Real Search Console queries from the last 28 days with the top URL and next action. No invented volume or difficulty."
        actions={<PipelineActions />}
      />
      <PageBody>
        <PipelineCommandCenter focus="Refresh GSC data before prioritizing keywords; every row below is imported from Search Console." />
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <EmptyState
            title="No Search Console data yet"
            description="Import GSC data on a connected site, then keywords will appear here."
            action={<PipelineActions scope="compact" />}
          />
        )}
        {q.data && q.data.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top query opportunities</CardTitle>
              <CardDescription>Sorted by impressions so the highest-reach decisions are first.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Query</th>
                    <th className="px-4 py-2.5 text-left font-medium">Top URL</th>
                    <th className="px-4 py-2.5 text-right font-medium">Clicks</th>
                    <th className="px-4 py-2.5 text-right font-medium">Impressions</th>
                    <th className="px-4 py-2.5 text-right font-medium">CTR</th>
                    <th className="px-4 py-2.5 text-right font-medium">Avg pos</th>
                    <th className="px-4 py-2.5 text-left font-medium">Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((k) => (
                    <tr key={k.query} className="border-t border-border">
                      <td className="px-4 py-3 font-medium truncate max-w-[420px]">{k.query}</td>
                      <td className="px-4 py-3 truncate max-w-[340px] text-xs text-muted-foreground">{k.url || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{k.clicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{k.impressions.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{(k.ctr * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right tabular-nums">{k.position.toFixed(1)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={k.intent === "protect" ? "secondary" : "outline"} className="text-[10px]">
                          {keywordAction(k.intent)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link to="/opportunities">Open exact opportunity evidence <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      </PageBody>
    </>
  );
}

function classifyKeyword(ctr: number, position: number, clicks: number): Row["intent"] {
  if (clicks >= 50 && position <= 3) return "protect";
  if (position <= 10 && ctr < 0.02) return "improve_ctr";
  if (position > 3 && position <= 30) return "push_distance";
  return "monitor";
}

function keywordAction(intent: Row["intent"]): string {
  if (intent === "protect") return "Protect winner";
  if (intent === "improve_ctr") return "Improve CTR";
  if (intent === "push_distance") return "Push ranking";
  return "Monitor";
}
