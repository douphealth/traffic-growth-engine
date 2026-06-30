import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck } from "lucide-react";
import { useDemoMode } from "@/hooks/use-demo-mode";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [demo, setDemo] = useDemoMode();
  return (
    <>
      <PageHeader
        title="Settings"
        description="Per-site safety rules, AI provider routing, and audit log access."
        badge={null}
      />
      <PageBody>
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Security defaults</AlertTitle>
          <AlertDescription>
            WordPress, GSC, GA4, DataForSEO, OpenAI, Anthropic, and OpenRouter credentials are
            stored encrypted, server-side only, and never exposed to the frontend.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Demo mode</CardTitle>
            <CardDescription>
              Show mock fixtures on screens that don't have real data yet (Content Pipeline, Validation, Publishing, etc.).
              Dashboard, Site Inventory, and Opportunity Board always use real data when present.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <div className="text-sm font-medium">Demo mode is {demo ? "ON" : "OFF"}</div>
                <p className="text-xs text-muted-foreground">A warning banner appears globally while ON.</p>
              </div>
              <Switch checked={demo} onCheckedChange={setDemo} />
            </div>
          </CardContent>
        </Card>


        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publish safety rules</CardTitle>
              <CardDescription>Block destructive changes by default.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Toggle defaultChecked label="Require approval for every live update" />
              <Toggle defaultChecked label="Store rollback snapshot before any write" />
              <Toggle defaultChecked label="Block publish if affiliate links would be removed" />
              <Toggle defaultChecked label="Block publish if images / tables / buttons would be lost" />
              <Toggle defaultChecked label="Block schema without visible content evidence" />
              <Toggle defaultChecked label="Block unsupported health / financial claims" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI provider</CardTitle>
              <CardDescription>Default routing for briefs, improvements, and AI-visibility runs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Default model</Label>
                <Input defaultValue="google/gemini-3-flash-preview" />
                <p className="text-[11px] text-muted-foreground">Lovable AI Gateway routes to the provider — no API key needed.</p>
              </div>
              <Toggle defaultChecked label="Reject AI outputs that fail schema validation" />
              <Toggle defaultChecked label="Log token usage and latency per request" />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">External credentials (placeholders)</CardTitle>
              <CardDescription>Add via the secure secret store later — fields shown are non-functional in Phase 1.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field id="dfs" label="DataForSEO login" placeholder="not configured" />
              <Field id="dfsk" label="DataForSEO password" placeholder="not configured" type="password" />
              <Field id="psi" label="PageSpeed Insights key" placeholder="not configured" />
              <Field id="indexnow" label="IndexNow key" placeholder="not configured" />
            </CardContent>
          </Card>

          <div className="lg:col-span-2 flex justify-end">
            <Button>Save settings</Button>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/40 px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

function Field({ id, label, ...rest }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...rest} />
    </div>
  );
}
