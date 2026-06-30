import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockExperiments } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/experiments")({
  component: ExperimentsPage,
});

function ExperimentsPage() {
  return (
    <>
      <PageHeader
        title="Experiments"
        description="Every approved change becomes an experiment with a baseline. Outcomes are classified as win, loss, or neutral at 14, 28, 60, and 90 days."
      />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-2">
          {mockExperiments.map((e) => (
            <Card key={e.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">{e.page_url}</CardTitle>
                  <Badge variant="outline" className="capitalize">{e.status}</Badge>
                </div>
                <CardDescription className="text-xs">{e.hypothesis}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <Row label="Implemented" value={e.implemented_at ?? "—"} />
                <Row label="Window" value={e.window} />
                <Row label="Current result" value={<Badge variant="outline" className="capitalize">{e.result}</Badge>} />
              </CardContent>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
