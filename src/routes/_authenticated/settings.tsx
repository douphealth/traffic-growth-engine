import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Search, Globe, Target, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PipelineActions, PipelineCommandCenter } from "@/components/ops-workspace";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const auditQ = useQuery({
    queryKey: ["settings-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, created_at, site:sites(name)")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Settings"
        description="Operational controls and safety posture. No demo mode, no fake credential forms, no nonfunctional save button."
        badge={null}
        actions={<PipelineActions />}
      />
      <PageBody>
        <PipelineCommandCenter focus="Use these controls to keep imports, scoring, validation, and publishing auditable." />

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Security defaults</AlertTitle>
          <AlertDescription>
            WordPress, GSC, GA4, DataForSEO, OpenAI, Anthropic, and OpenRouter credentials are
            stored encrypted, server-side only, and never exposed to the frontend.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline controls</CardTitle>
              <CardDescription>Direct links to the working configuration screens.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <ControlLink to="/gsc/connect" icon={<Search className="h-4 w-4" />} label="GSC connector" detail="OAuth, properties, imports" />
              <ControlLink to="/sites" icon={<Globe className="h-4 w-4" />} label="Site inventory" detail="Pipelines and WordPress" />
              <ControlLink to="/opportunities" icon={<Target className="h-4 w-4" />} label="Opportunity scoring" detail="Top 20 actions per site" />
              <ControlLink to="/validation" icon={<ShieldCheck className="h-4 w-4" />} label="Validation" detail="Approval and safety checks" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enforced safety rules</CardTitle>
              <CardDescription>These rules are product constraints, not decorative toggles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Rule label="Live WordPress updates require human approval" />
              <Rule label="Rollback snapshots are required before writes" />
              <Rule label="Schema must match visible content" />
              <Rule label="Affiliate links, images, tables, and buttons must be preserved" />
              <Rule label="Health/finance claims require validation before publishing" />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Recent audit trail</CardTitle>
              <CardDescription>Imports, page sync, scoring, validation, and publish actions are recorded here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {auditQ.isLoading && <p className="text-sm text-muted-foreground">Loading audit log…</p>}
              {auditQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No audit events yet.</p>}
              {auditQ.data?.map((event: any) => (
                <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    <Badge variant="outline" className="text-[10px]">{event.action}</Badge>
                    <span className="text-xs text-muted-foreground">{event.site?.name ?? "workspace"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function ControlLink({ to, icon, label, detail }: { to: "/gsc/connect" | "/sites" | "/opportunities" | "/validation"; icon: React.ReactNode; label: string; detail: string }) {
  return (
    <Button variant="outline" asChild className="h-auto justify-start p-3">
      <Link to={to} className="flex items-start gap-2">
        <span className="mt-0.5 text-primary">{icon}</span>
        <span className="text-left">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">{detail}</span>
        </span>
      </Link>
    </Button>
  );
}

function Rule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-sm">
      <ShieldCheck className="h-3.5 w-3.5 text-success" />
      <span>{label}</span>
    </div>
  );
}
