import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockBriefs, mockDiffs } from "@/lib/mock-data";
import { FileText, GitCompare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/content")({
  component: ContentPipeline,
});

const briefBadge: Record<string, "secondary" | "outline" | "default"> = {
  draft: "outline",
  ready: "secondary",
  in_writing: "default",
  complete: "secondary",
};

function ContentPipeline() {
  return (
    <>
      <PageHeader
        title="Content Pipeline"
        description="Briefs are generated from real opportunity evidence — never from a generic article generator. Improvements are surgical: preserve images, tables, buttons, shortcodes, affiliate boxes."
      />
      <PageBody>
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Content briefs</h2>
              <p className="text-xs text-muted-foreground">Evidence-backed briefs ready to generate diffs from.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {mockBriefs.map((b) => (
              <Card key={b.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant={briefBadge[b.status] ?? "outline"} className="capitalize">
                      {b.status.replace("_", " ")}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{b.intent}</span>
                  </div>
                  <CardTitle className="text-base mt-2">{b.page_title}</CardTitle>
                  <CardDescription className="truncate">{b.page_url}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Field label="Target queries">
                    <div className="flex flex-wrap gap-1">
                      {b.target_queries.map((q) => (
                        <Badge key={q} variant="outline" className="font-normal text-[11px]">{q}</Badge>
                      ))}
                    </div>
                  </Field>
                  <Field label="Missing entities">
                    <div className="flex flex-wrap gap-1">
                      {b.missing_entities.map((e) => (
                        <Badge key={e} className="bg-warning/15 text-warning border-warning/30 font-normal text-[11px]" variant="outline">{e}</Badge>
                      ))}
                    </div>
                  </Field>
                  <Field label="Recommended sections">
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {b.recommended_sections.map((s) => <li key={s}>• {s}</li>)}
                    </ul>
                  </Field>
                  <Field label="Monetization angle">
                    <p className="text-xs text-muted-foreground">{b.monetization_angle}</p>
                  </Field>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm"><FileText className="mr-1.5 h-3.5 w-3.5" /> Edit brief</Button>
                    <Button size="sm">Generate diff</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Proposed diffs</h2>
              <p className="text-xs text-muted-foreground">Each diff must pass validation before it can be queued for publish.</p>
            </div>
          </div>
          <div className="space-y-2">
            {mockDiffs.map((d) => (
              <Link
                key={d.id}
                to="/validation"
                className="block rounded-md border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={d.status === "validated" ? "secondary" : d.status === "proposed" ? "outline" : "default"}
                        className="capitalize"
                      >
                        {d.status}
                      </Badge>
                      <span className="text-sm font-medium truncate">{d.page_title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.page_url} · {d.changes.length} change(s)</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={d.validation.passed ? "text-xs text-success" : "text-xs text-destructive"}>
                      {d.validation.passed ? "✓ Validated" : "✗ Validation failed"}
                    </span>
                    <Button variant="outline" size="sm">
                      <GitCompare className="mr-1.5 h-3.5 w-3.5" /> Review diff
                    </Button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
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
