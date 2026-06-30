import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockAiPrompts } from "@/lib/mock-data";
import { Sparkles, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ai-visibility")({
  component: AIVisibilityPage,
});

function AIVisibilityPage() {
  return (
    <>
      <PageHeader
        title="AI Visibility"
        description="Monitor whether AI assistants cite or recommend your brand and URLs for relevant prompts. Monitoring only — never claim improvement unless measured."
        actions={
          <Button>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add prompt
          </Button>
        }
      />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-3">
          <Stat title="Tracked prompts" value="24" />
          <Stat title="Brand citation rate" value="18%" sub="across 3 models · mock" />
          <Stat title="Competitor citation rate" value="64%" sub="across 3 models · mock" />
        </div>

        <div className="space-y-2">
          {mockAiPrompts.map((p) => {
            const rate = Math.round((p.brand_cited / p.runs) * 100);
            return (
              <Card key={p.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        {p.prompt}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {p.runs} runs across openai/anthropic/google · mock
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={rate >= 50 ? "border-success/40 text-success" : rate >= 20 ? "border-warning/40 text-warning" : "border-destructive/40 text-destructive"}
                    >
                      {rate}% brand cited
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground flex gap-4">
                  <span>Brand cited: <span className="text-foreground font-medium">{p.brand_cited}/{p.runs}</span></span>
                  <span>Competitor cited: <span className="text-foreground font-medium">{p.competitor_cited}/{p.runs}</span></span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}

function Stat({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-[11px] uppercase tracking-wide">{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
