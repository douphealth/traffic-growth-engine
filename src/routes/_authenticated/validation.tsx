import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { mockDiffs } from "@/lib/mock-data";
import { Check, X, ShieldCheck, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/validation")({
  component: ValidationPage,
});

function ValidationPage() {
  return (
    <>
      <PageHeader
        title="Validation & Diff Review"
        description="Every proposed change is checked for HTML safety, preserved assets, schema/content match, and monetization integrity. If a critical check fails, publishing is blocked."
      />
      <PageBody>
        {mockDiffs.map((d) => (
          <Card key={d.id} className={d.validation.passed ? "border-success/30" : "border-destructive/40"}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {d.validation.passed ? (
                      <ShieldCheck className="h-4 w-4 text-success" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    {d.page_title}
                  </CardTitle>
                  <CardDescription className="truncate">{d.page_url}</CardDescription>
                </div>
                <Badge
                  variant={d.validation.passed ? "secondary" : "outline"}
                  className={d.validation.passed ? "" : "border-destructive/40 text-destructive"}
                >
                  {d.validation.passed ? "Validated" : "Blocking failure"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!d.validation.passed && (
                <Alert variant="destructive">
                  <AlertTitle>Publishing blocked</AlertTitle>
                  <AlertDescription>
                    One or more critical validation checks failed. Resolve them in the diff before
                    queueing for publish.
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Validation checks</div>
                <ul className="space-y-1 text-sm">
                  {d.validation.checks.map((c) => (
                    <li
                      key={c.name}
                      className="flex items-start gap-2 rounded-md border border-border bg-card/50 px-3 py-2"
                    >
                      {c.pass ? (
                        <Check className="mt-0.5 h-3.5 w-3.5 text-success shrink-0" />
                      ) : (
                        <X className="mt-0.5 h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className={c.pass ? "" : "text-destructive font-medium"}>{c.name}</div>
                        {c.note && <p className="text-xs text-muted-foreground mt-0.5">{c.note}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Proposed changes ({d.changes.length})</div>
                <div className="space-y-2">
                  {d.changes.map((c, i) => (
                    <div key={i} className="rounded-md border border-border overflow-hidden text-xs">
                      <div className="bg-muted/40 px-3 py-1.5 font-medium">{c.kind}</div>
                      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                        <div className="p-3 bg-destructive/5">
                          <div className="text-[10px] uppercase tracking-wide text-destructive mb-1">Before</div>
                          <pre className="whitespace-pre-wrap break-words text-foreground/80 font-mono text-[11px]">{c.before}</pre>
                        </div>
                        <div className="p-3 bg-success/5">
                          <div className="text-[10px] uppercase tracking-wide text-success mb-1">After</div>
                          <pre className="whitespace-pre-wrap break-words text-foreground/80 font-mono text-[11px]">{c.after}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => toast.message("Diff rejected")}>
                  Reject
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success("Saved as WordPress draft (mock)")}
                >
                  Approve as draft
                </Button>
                <Button
                  size="sm"
                  disabled={!d.validation.passed}
                  onClick={() => toast.success("Queued live update with rollback snapshot (mock)")}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Approve & queue live update
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </PageBody>
    </>
  );
}
