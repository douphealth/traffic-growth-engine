import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitCompare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/content")({
  component: ContentPipeline,
});

function ContentPipeline() {
  const briefsQ = useQuery({
    queryKey: ["content-briefs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_briefs")
        .select("id, target_url, intent, status, target_queries, missing_entities, recommended_sections, monetization_angle")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const diffsQ = useQuery({
    queryKey: ["content-diffs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_diffs")
        .select("id, proposed_title, status, pages(url), diff_summary")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Content Pipeline"
        description="Briefs are generated from real opportunity evidence — never from a generic article generator. Improvements are surgical: preserve images, tables, buttons, shortcodes, affiliate boxes."
      />
      <PageBody>
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Content briefs</h2>
            <p className="text-xs text-muted-foreground">Evidence-backed briefs ready to generate diffs from.</p>
          </div>
          {briefsQ.data && briefsQ.data.length === 0 ? (
            <EmptyState
              title="No content briefs yet"
              description="Briefs are created from scored opportunities. Run opportunity scoring on a site, then promote items to briefs."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {briefsQ.data?.map((b: any) => (
                <Card key={b.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">{b.status}</Badge>
                      <span className="text-[11px] text-muted-foreground">{b.intent ?? "—"}</span>
                    </div>
                    <CardTitle className="text-base mt-2 truncate">{b.target_url ?? "Untitled brief"}</CardTitle>
                    <CardDescription className="truncate">{b.target_url ?? ""}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {Array.isArray(b.target_queries) && b.target_queries.length > 0 && (
                      <Field label="Target queries">
                        <div className="flex flex-wrap gap-1">
                          {b.target_queries.slice(0, 8).map((q: string) => (
                            <Badge key={q} variant="outline" className="font-normal text-[11px]">{q}</Badge>
                          ))}
                        </div>
                      </Field>
                    )}
                    {b.monetization_angle && (
                      <Field label="Monetization angle">
                        <p className="text-xs text-muted-foreground">{b.monetization_angle}</p>
                      </Field>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Proposed diffs</h2>
            <p className="text-xs text-muted-foreground">Each diff must pass validation before it can be queued for publish.</p>
          </div>
          {diffsQ.data && diffsQ.data.length === 0 ? (
            <EmptyState
              title="No diffs yet"
              description="Generate a diff from a brief to populate this list."
            />
          ) : (
            <div className="space-y-2">
              {diffsQ.data?.map((d: any) => (
                <Link
                  key={d.id}
                  to="/validation"
                  className="block rounded-md border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{d.status}</Badge>
                        <span className="text-sm font-medium truncate">{d.proposed_title ?? d.pages?.url ?? "Untitled"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.pages?.url ?? ""}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <GitCompare className="mr-1.5 h-3.5 w-3.5" /> Review diff
                    </Button>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </PageBody>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
