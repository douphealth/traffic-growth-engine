import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sites/connect")({
  component: ConnectSitePage,
});

function ConnectSitePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Site queued for scan (mock). No live WordPress call was made.");
      navigate({ to: "/sites" });
    }, 700);
  }

  return (
    <>
      <PageHeader
        title="Connect a WordPress site"
        description="WordPress credentials are stored server-side, encrypted at rest, and never exposed to the browser. Live updates require explicit approval and store a rollback snapshot."
      />
      <PageBody>
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Mock connector — no network call</AlertTitle>
          <AlertDescription>
            Phase 1 records the connection intent. WordPress, Google Search Console, GA4, and
            DataForSEO calls will activate once credentials are added securely on the server.
          </AlertDescription>
        </Alert>

        <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">WordPress REST API</CardTitle>
              <CardDescription>Use a dedicated Application Password — never an admin password.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field id="name" label="Site name" placeholder="My Headphone Reviews" required />
              <Field id="url" label="Site URL" placeholder="https://example.com" type="url" required />
              <Field id="wp_user" label="WordPress username" placeholder="seo-bot" required />
              <Field id="wp_app_password" label="Application Password" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" type="password" required helper="Stored encrypted, server-only. Never sent to the browser after save." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Analytics & SEO sources</CardTitle>
              <CardDescription>OAuth/Service-account flows wire up later. You can connect them after the first scan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field id="gsc" label="Google Search Console property" placeholder="sc-domain:example.com" />
              <Field id="ga4" label="GA4 property ID" placeholder="properties/123456789" />
              <Field id="sitemap" label="Sitemap URL" placeholder="https://example.com/sitemap_index.xml" />
              <Field id="robots" label="robots.txt URL" placeholder="https://example.com/robots.txt" />
              <Field id="llms" label="llms.txt URL (optional)" placeholder="https://example.com/llms.txt" />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Safety defaults</CardTitle>
              </div>
              <CardDescription>You can change these per-site in Settings later.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              <Bullet>Live WordPress updates require explicit approval per change.</Bullet>
              <Bullet>Every update saves a full rollback snapshot before writing.</Bullet>
              <Bullet>Validation must pass — broken links, lost images, schema-without-evidence are blocked.</Bullet>
              <Bullet>AI content is never mass-published. Drafts only until you approve.</Bullet>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate({ to: "/sites" })}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save & queue scan"}
            </Button>
          </div>
        </form>

        <Outlet />
      </PageBody>
    </>
  );
}

function Field({
  id,
  label,
  helper,
  ...rest
}: {
  id: string;
  label: string;
  helper?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...rest} />
      {helper && <p className="text-[11px] text-muted-foreground">{helper}</p>}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}
