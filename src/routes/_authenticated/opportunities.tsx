import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockOpportunities, OPPORTUNITY_LABEL, type OpportunityType } from "@/lib/mock-data";
import { useMemo, useState } from "react";
import { ArrowRight, FileEdit } from "lucide-react";

export const Route = createFileRoute("/_authenticated/opportunities")({
  component: OpportunityBoard,
});

const TYPES = Object.keys(OPPORTUNITY_LABEL) as OpportunityType[];

function OpportunityBoard() {
  const [type, setType] = useState<string>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      mockOpportunities
        .filter((o) => (type === "all" ? true : o.type === type))
        .filter((o) =>
          q ? (o.title + o.page_url + o.summary).toLowerCase().includes(q.toLowerCase()) : true,
        )
        .sort((a, b) => b.priority - a.priority),
    [type, q],
  );

  return (
    <>
      <PageHeader
        title="Opportunity Board"
        description="Every opportunity is scored on impact, confidence, effort, risk, and reversibility. Priority = (impact × confidence) ÷ effort, dampened by risk."
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search title, URL, evidence…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types ({mockOpportunities.length})</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {OPPORTUNITY_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ml-auto text-[10px]">
            {filtered.length} shown · mock
          </Badge>
        </div>

        <div className="space-y-3">
          {filtered.map((o) => (
            <Card key={o.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{OPPORTUNITY_LABEL[o.type]}</Badge>
                      <Badge variant="outline" className="text-[10px]">severity {o.severity}/5</Badge>
                      <span className="text-xs text-muted-foreground truncate">{o.page_url}</span>
                    </div>
                    <CardTitle className="mt-1.5 text-base">{o.title}</CardTitle>
                    <CardDescription className="mt-1">{o.summary}</CardDescription>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-semibold tabular-nums text-primary">
                      {Math.round(o.priority)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">priority</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <Score label="Impact" value={o.impact} />
                  <Score label="Confidence" value={o.confidence} />
                  <Score label="Effort" value={o.effort} invert />
                  <Score label="Risk" value={o.risk} invert />
                </div>

                <div className="rounded-md border border-border bg-muted/20 p-3 text-xs space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Evidence</div>
                  <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                    {o.evidence.map((e) => (
                      <li key={e.label} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{e.label}</span>
                        <span className="font-medium tabular-nums truncate text-right">{e.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Recommended action</div>
                    <p className="text-foreground/90 mt-1 leading-relaxed">{o.recommended_action}</p>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Validation method</div>
                    <p className="text-foreground/90 mt-1 leading-relaxed">{o.validation_method}</p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm">Dismiss</Button>
                  <Button size="sm" asChild>
                    <Link to="/content">
                      <FileEdit className="mr-1.5 h-3.5 w-3.5" /> Generate brief
                      <ArrowRight className="ml-1.5 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}

function Score({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={invert ? "h-full bg-warning/70" : "h-full bg-primary"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
