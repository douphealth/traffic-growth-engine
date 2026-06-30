import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockKeywords } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/keywords")({
  component: KeywordsPage,
});

function KeywordsPage() {
  return (
    <>
      <PageHeader
        title="Keyword Strategy"
        description="Keywords are sourced from Google Search Console (real) and DataForSEO-shaped fixtures (mock) until a key is added. AutoTraffic AI never invents volumes, difficulty, or rankings."
      />
      <PageBody>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Keyword</th>
                  <th className="px-4 py-2.5 text-left font-medium">Intent</th>
                  <th className="px-4 py-2.5 text-right font-medium">Volume</th>
                  <th className="px-4 py-2.5 text-right font-medium">Difficulty</th>
                  <th className="px-4 py-2.5 text-right font-medium">Position</th>
                  <th className="px-4 py-2.5 text-right font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {mockKeywords.map((k) => (
                  <tr key={k.keyword} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{k.keyword}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize text-[10px]">{k.intent}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{k.volume.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{k.difficulty}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{k.position.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant="outline" className="text-[10px]">mock</Badge>
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
