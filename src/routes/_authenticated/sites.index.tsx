import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockSites } from "@/lib/mock-data";
import { Plus, ExternalLink, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sites/")({
  component: SitesPage,
});

function SitesPage() {
  return (
    <>
      <PageHeader
        title="Site Inventory"
        description="Connect WordPress sites and inspect what AutoTraffic AI has crawled, imported, and scored."
        actions={
          <Button asChild>
            <Link to="/sites/connect">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Connect site
            </Link>
          </Button>
        }
      />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-2">
          {mockSites.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <a href={s.base_url} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                        {s.base_url} <ExternalLink className="h-3 w-3" />
                      </a>
                    </CardDescription>
                  </div>
                  <Badge variant={s.status === "connected" ? "secondary" : "outline"} className="capitalize">
                    {s.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Pages imported" value={s.pages.toString()} />
                  <Stat label="Open opportunities" value={s.opportunities_open.toString()} />
                  <Stat label="GSC property" value={s.gsc_property ?? "—"} />
                  <Stat label="GA4 property" value={s.ga4_property_id ?? "—"} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                  <span>Last scan: {new Date(s.last_scan).toLocaleString()}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Activity className="mr-1 h-3 w-3" /> Re-scan
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}
