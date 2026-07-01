import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { OpportunityQueue, PipelineActions, PipelineCommandCenter } from "@/components/ops-workspace";
import { useSiteScope } from "@/hooks/use-site-scope";

export const Route = createFileRoute("/_authenticated/ai-visibility")({
  component: AIVisibilityPage,
});

function AIVisibilityPage() {
  const { siteId } = useSiteScope();
  const q = useQuery({
    queryKey: ["ai-visibility", siteId ?? "all"],
    queryFn: async () => {
      let promptsReq = supabase.from("ai_visibility_prompts").select("id, prompt, active").eq("active", true);
      if (siteId) promptsReq = promptsReq.eq("site_id", siteId);
      const [prompts, runs] = await Promise.all([
        promptsReq,
        supabase.from("ai_visibility_runs").select("prompt_id, brand_mentioned, competitor_mentions, model"),
      ]);
      if (prompts.error) throw prompts.error;
      if (runs.error) throw runs.error;
      return { prompts: prompts.data ?? [], runs: runs.data ?? [] };
    },
  });

  const prompts = q.data?.prompts ?? [];
  const runs = q.data?.runs ?? [];
  const totalRuns = runs.length;
  const brandHits = runs.filter((r: any) => r.brand_mentioned).length;
  const compHits = runs.filter((r: any) => Array.isArray(r.competitor_mentions) && r.competitor_mentions.length > 0).length;

  return (
    <>
      <PageHeader
        title="AI Visibility"
        description="AI visibility polling is not enabled yet. This page is still useful: it shows AI-answer readiness actions derived from real GSC/page evidence."
        actions={<PipelineActions />}
      />
      <PageBody>
        <PipelineCommandCenter focus="Use Search Console evidence to prepare pages for answer engines before enabling AI polling." />
        <OpportunityQueue
          types={["ai_answer_gap"]}
          title="AI-answer readiness queue"
          description="Pages with real search demand that need concise answers, FAQs, and stronger extractable structure."
          emptyTitle="No AI-readiness actions yet"
          emptyDescription="Run scoring after GSC import. AI polling remains disabled, but readiness gaps can still be identified from imported pages."
        />

        <div className="grid gap-3 md:grid-cols-3">
          <Stat title="Tracked prompts" value={prompts.length.toString()} />
          <Stat title="Brand citation rate" value={totalRuns ? `${Math.round((brandHits / totalRuns) * 100)}%` : "—"} sub={`${brandHits} / ${totalRuns} runs`} />
          <Stat title="Competitor citation rate" value={totalRuns ? `${Math.round((compHits / totalRuns) * 100)}%` : "—"} sub={`${compHits} / ${totalRuns} runs`} />
        </div>

        {prompts.length === 0 ? (
          <EmptyState
            title="No tracked prompts yet"
            description="AI visibility polling is not enabled in this build. Tracked prompts and polling runs will appear here once configured."
            action={<PipelineActions scope="compact" />}
          />
        ) : (
          <div className="space-y-2">
            {prompts.map((p: any) => {
              const pr = runs.filter((r: any) => r.prompt_id === p.id);
              const brand = pr.filter((r: any) => r.brand_mentioned).length;
              const rate = pr.length ? Math.round((brand / pr.length) * 100) : 0;
              return (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          {p.prompt}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">{pr.length} runs</CardDescription>
                      </div>
                      <Badge variant="outline">{rate}% brand cited</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Brand cited: <span className="text-foreground font-medium">{brand}/{pr.length}</span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
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
